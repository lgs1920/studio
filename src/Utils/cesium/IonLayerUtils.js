/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: IonLayerUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-25
 * Last modified on: 2026-06-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { BASE3D_ENTITY } from '@Core/constants'
import { CacheManager } from '@Core/cache/CacheManager'
import { Cesium3DTileset, Google2DImageryProvider, Ion, IonImageryProvider, IonResource, createGooglePhotorealistic3DTileset } from 'cesium'

const CESIUM_CACHE_NAME = 'cesium-ion-assets'
const DEFAULT_CACHE_QUOTA = 500 * 1024 * 1024

const normalizeToken = value => typeof value === 'string' ? value.trim() : ''

const getActiveToken = () => normalizeToken(globalThis.lgs?.stores?.ion?.token)

export class IonLayerUtils {
    static lastSyncedToken = null
    static tokenCacheName = () => CESIUM_CACHE_NAME

    static async syncCesiumCache(token = getActiveToken(), {purgePrevious = true} = {}) {
        const normalizedToken = normalizeToken(token)
        if (!normalizedToken) {
            return null
        }

        const cacheName = IonLayerUtils.tokenCacheName(token)
        const currentCache = globalThis.__?.app?.cesiumCache

        if (currentCache?.cacheName === cacheName) {
            if (purgePrevious && IonLayerUtils.lastSyncedToken !== null && IonLayerUtils.lastSyncedToken !== normalizedToken) {
                try {
                    currentCache.clear?.()
                }
                catch (error) {
                    console.error('[IonLayerUtils] Failed to clear Cesium cache after token change:', error)
                }
            }

            IonLayerUtils.lastSyncedToken = normalizedToken
            return cacheName
        }

        if (purgePrevious && currentCache?.cacheName && currentCache.cacheName !== cacheName) {
            try {
                currentCache.clear?.()
            }
            catch (error) {
                console.error('[IonLayerUtils] Failed to clear previous Cesium cache:', error)
            }
        }

        if (globalThis.__?.app) {
            globalThis.__.app.cesiumCache = new CacheManager(cacheName, DEFAULT_CACHE_QUOTA)
        }
        IonLayerUtils.lastSyncedToken = normalizedToken
        return cacheName
    }

    /**
     * Returns the provider-level token and initializes the optional cache lazily.
     * @param {string} accessToken Optional explicit token.
     * @returns {Promise<string>} A usable Cesium Ion token.
     */
    static async getIonAccessToken(accessToken = getActiveToken()) {
        const token = normalizeToken(accessToken)
        if (!token) {
            throw new Error('A Cesium Ion token is required for this layer.')
        }

        await IonLayerUtils.syncCesiumCache(token)
        return token
    }

    /**
     * Clears the optional Cesium Ion cache without creating a replacement cache.
     * @returns {Promise<void>} A promise that resolves after the clear request is sent.
     */
    static async clearCesiumCache() {
        const currentCache = globalThis.__?.app?.cesiumCache
        try {
            currentCache?.clear?.()
        }
        catch (error) {
            console.error('[IonLayerUtils] Failed to clear Cesium cache:', error)
        }

        if (globalThis.__?.app) {
            globalThis.__.app.cesiumCache = null
        }
        IonLayerUtils.lastSyncedToken = null
    }

    static async ionResourceFromAssetId(assetId, accessToken = getActiveToken()) {
        const id = Number(assetId)
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error(`Invalid Cesium Ion asset ID: ${assetId}`)
        }

        const token = await IonLayerUtils.getIonAccessToken(accessToken)
        return IonResource.fromAssetId(id, {accessToken: token})
    }

    static async imageryProviderFromLayer(layer, {accessToken = getActiveToken()} = {}) {
        const id = Number(layer?.ionAssetId ?? layer?.assetId)
        if (!Number.isInteger(id) || id <= 0) {
            return null
        }

        const token = await IonLayerUtils.getIonAccessToken(accessToken)
        const imageryKind = `${layer?.imageryKind ?? layer?.tilesKind ?? layer?.providerKind ?? ''}`.toLowerCase()
        if (imageryKind === 'google2d') {
            return Google2DImageryProvider.fromIonAssetId({
                assetId:     id,
                accessToken: token,
                mapType: layer?.mapType ?? 'satellite',
                overlayLayerType: layer?.overlayLayerType,
            })
        }

        return IonImageryProvider.fromAssetId(id, {accessToken: token})
    }

    static async createTileset(layer, {accessToken = getActiveToken()} = {}) {
        const kind = `${layer?.sceneKind ?? layer?.base3d?.kind ?? layer?.tiles3d?.kind ?? ''}`.toLowerCase()
        const assetId = Number(layer?.ionAssetId ?? layer?.assetId)
        const tilesetUrl = layer?.tiles3d?.url ?? layer?.url ?? layer?.tiles3d?.tilesetUrl ?? layer?.tilesetUrl

        if (kind === 'google-photorealistic'
            || kind === 'google-photorealistic-3d'
            || kind === 'google-photorealistic-tiles'
            || `${layer?.id ?? ''}`.includes('photorealistic')) {
            const token = await IonLayerUtils.getIonAccessToken(accessToken)
            const previousToken = Ion.defaultAccessToken
            Ion.defaultAccessToken = token
            try {
                return await createGooglePhotorealistic3DTileset(
                    {onlyUsingWithGoogleGeocoder: true},
                    {
                        show: layer?.show ?? true,
                    },
                )
            }
            finally {
                Ion.defaultAccessToken = previousToken
            }
        }

        if (kind === 'url' || tilesetUrl) {
            if (!tilesetUrl) {
                throw new Error(`Missing 3D tiles URL for layer: ${layer?.id ?? 'unknown'}`)
            }

            return Cesium3DTileset.fromUrl(tilesetUrl, {
                maximumScreenSpaceError: layer?.tiles3d?.maximumScreenSpaceError ?? layer?.maximumScreenSpaceError ?? 16,
                show: layer?.show ?? true,
            })
        }

        if (!Number.isInteger(assetId) || assetId <= 0) {
            throw new Error(`Invalid Cesium Ion asset ID: ${layer?.ionAssetId ?? layer?.assetId}`)
        }

        const resource = await IonLayerUtils.ionResourceFromAssetId(assetId, accessToken)
        return Cesium3DTileset.fromUrl(resource, {
            maximumScreenSpaceError: layer?.tiles3d?.maximumScreenSpaceError ?? layer?.maximumScreenSpaceError ?? 16,
            show: layer?.show ?? true,
        })
    }

    static isIonDependentLayer = layer => {
        const assetId = Number(layer?.ionAssetId ?? layer?.assetId)
        const sceneKind = `${layer?.sceneKind ?? layer?.base3d?.kind ?? layer?.tiles3d?.kind ?? ''}`.toLowerCase()
        return layer?.tile === 'ion'
            || layer?.terrainType === 'cesium'
            || sceneKind.startsWith('google-photorealistic')
            || (layer?.provider === 'cesium' && Number.isInteger(assetId) && assetId > 0)
    }

    static isBase3DLayer = (layer) => `${layer?.type ?? ''}`.toLowerCase() === BASE3D_ENTITY

    static getActiveToken = getActiveToken
}
