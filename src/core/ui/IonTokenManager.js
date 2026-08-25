/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: IonTokenManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VAULT_STORE } from '@Core/constants'
import { ion } from '@Core/stores/ion'
import { IonLayerUtils } from '@Utils/cesium/IonLayerUtils'
import { TerrainUtils } from '@Utils/cesium/TerrainUtils'
import * as Cesium from 'cesium'

const ION_TOKEN_KEY = 'cesium_ion_token'
const ION_SETTINGS_KEY = 'ion'
const LEGACY_MANAGEMENT_KEYS = [
    'cesium_ion_token_usage_seconds',
    'cesium_ion_intro_seen',
]
const ION_TOKEN_VALIDATION_URL = 'https://api.cesium.com/v1/assets?limit=1'

/**
 * Normalizes a token value before it is stored or used.
 * @param {*} value Candidate token value.
 * @returns {string} The trimmed token or an empty string.
 */
const normalizeToken = value => typeof value === 'string' ? value.trim() : ''

/**
 * Returns the runtime Ion store, including isolated test contexts.
 * @returns {Object} The Ion store.
 */
const getIonState = () => globalThis.lgs?.stores?.ion ?? ion

/**
 * Removes the obsolete shared-token trial data from the local settings database.
 * @returns {Promise<void>} A promise that resolves after cleanup.
 */
const removeLegacyTrialData = async () => {
    const settings = globalThis.lgs?.db?.settings
    const vault = globalThis.lgs?.db?.vault

    if (settings?.delete) {
        await settings.delete(ION_SETTINGS_KEY, 'settings')
        for (const key of LEGACY_MANAGEMENT_KEYS) {
            await settings.delete(key, 'settings')
        }
    }

    if (vault?.delete) {
        for (const key of LEGACY_MANAGEMENT_KEYS) {
            await vault.delete(key, VAULT_STORE)
        }
    }
}

/**
 * Manages the protected provider-level Cesium Ion credential.
 */
export class IonTokenManager {
    #loadPromise = null

    /**
     * Validates a personal token against the Cesium Ion API.
     * @param {string} token Token to validate.
     * @returns {Promise<void>} A promise that resolves when the token is valid.
     */
    #validateToken = async token => {
        if (typeof fetch !== 'function') {
            return
        }

        const controller = typeof AbortController === 'function' ? new AbortController() : null
        const timeout = controller ? globalThis.setTimeout(() => controller.abort(), 8000) : null

        try {
            const response = await fetch(ION_TOKEN_VALIDATION_URL, {
                method:  'GET',
                headers: {
                    Accept:        'application/json',
                    Authorization: `Bearer ${token}`,
                },
                signal: controller?.signal,
            })

            if (response.ok) {
                return
            }

            throw new Error('The Cesium Ion token could not be validated.')
        }
        catch (error) {
            if (error?.name === 'AbortError') {
                throw new Error('The Cesium Ion token validation timed out.', {cause: error})
            }
            throw error
        }
        finally {
            if (timeout !== null) {
                globalThis.clearTimeout(timeout)
            }
        }
    }

    /**
     * Applies a provider credential to the runtime store without setting Cesium's global fallback token.
     * @param {string} token Provider credential.
     */
    #applyState = token => {
        const state = getIonState()
        state.token = normalizeToken(token) || null
        state.source = state.token ? 'user' : 'none'
    }

    /**
     * Finds a legacy per-layer Ion token that can be migrated to the provider credential.
     * @returns {Promise<string>} The first valid legacy Ion token.
     */
    #findLegacyLayerToken = async () => {
        const providers = globalThis.lgs?.settings?.layers?.providers ?? []
        const vault = globalThis.lgs?.db?.vault
        if (!vault?.get) {
            return ''
        }

        let migratedToken = ''
        for (const provider of providers) {
            for (const layer of provider?.layers ?? []) {
                const enrichedLayer = {...layer, provider: provider.id}
                if (!IonLayerUtils.isIonDependentLayer(enrichedLayer)) {
                    continue
                }

                const token = normalizeToken(await vault.get(layer.id, VAULT_STORE))
                if (token) {
                    await vault.delete?.(layer.id, VAULT_STORE)
                    migratedToken ||= token
                }
            }
        }

        return migratedToken
    }

    /**
     * Replaces active Ion selections with the approved non-Ion defaults.
     * @returns {Promise<void>} A promise that resolves after terrain fallback.
     */
    #fallbackActiveSelections = async () => {
        const layers = globalThis.lgs?.settings?.layers
        const manager = globalThis.__?.layersAndTerrainManager
        if (!layers || !manager) {
            return
        }

        const fallback = globalThis.lgs?.savedConfiguration?.layers ?? {}
        const fallbackBase = fallback.base ?? 'arcgis-normal'
        const fallbackTerrain = fallback.terrain ?? 'reearth-world'
        const selectedKeys = ['base', 'overlay', 'base3d', 'tiles3d', 'terrain']

        for (const key of selectedKeys) {
            const selected = manager.getEntityProxy?.(layers[key])
            if (!IonLayerUtils.isIonDependentLayer(selected)) {
                continue
            }

            if (key === 'base') {
                layers.base = fallbackBase
            }
            else if (key === 'terrain') {
                layers.terrain = fallbackTerrain
            }
            else {
                layers[key] = ''
            }
        }

        const terrain = manager.getEntityProxy?.(layers.terrain)
        if (terrain && globalThis.lgs?.scene) {
            await TerrainUtils.changeTerrain(terrain)
        }
    }

    /**
     * Loads the provider credential and migrates legacy per-layer credentials.
     * @returns {Promise<Object>} The current Ion store.
     */
    load = async () => {
        if (this.#loadPromise) {
            return this.#loadPromise
        }

        this.#loadPromise = (async () => {
            const state = getIonState()
            let token = ''

            try {
                token = normalizeToken(await globalThis.lgs?.db?.vault?.get?.(ION_TOKEN_KEY, VAULT_STORE))
                if (!token) {
                    token = await this.#findLegacyLayerToken()
                    if (token) {
                        await globalThis.lgs.db.vault.put(ION_TOKEN_KEY, token, VAULT_STORE)
                    }
                }
                await removeLegacyTrialData()
            }
            catch (error) {
                console.error('[IonTokenManager] Failed to load Ion token state:', error)
            }

            this.#applyState(token)
            state.loaded = true
            Cesium.Ion.defaultAccessToken = undefined
            return state
        })()

        const loadPromise = this.#loadPromise
        this.#loadPromise = loadPromise.finally(() => {
            this.#loadPromise = null
        })
        return this.#loadPromise
    }

    /**
     * Saves and activates a provider-level personal token.
     * @param {string} token Token to save.
     * @returns {Promise<string>} The normalized saved token.
     */
    save = async token => {
        const nextToken = normalizeToken(token)
        if (!nextToken) {
            throw new Error('Please enter a Cesium Ion token.')
        }

        await this.#validateToken(nextToken)
        await globalThis.lgs.db.vault.put(ION_TOKEN_KEY, nextToken, VAULT_STORE)
        this.#applyState(nextToken)
        await IonLayerUtils.clearCesiumCache()
        return nextToken
    }

    /**
     * Removes the provider credential and safely falls back from active Ion layers.
     * @returns {Promise<Object>} The resulting Ion store.
     */
    clear = async () => {
        await globalThis.lgs?.db?.vault?.delete?.(ION_TOKEN_KEY, VAULT_STORE)
        await IonLayerUtils.clearCesiumCache()
        this.#applyState('')
        const editor = globalThis.lgs?.editorSettingsProxy
        if (editor?.layer) {
            editor.layer.tokenDialog = false
            editor.layer.tmpEntity = null
            editor.layer.refreshList = true
        }
        await this.#fallbackActiveSelections()
        return getIonState()
    }

}

export const ionTokenManager = new IonTokenManager()
