/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LayerAndTerrainManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { TerrainUtils } from '@Utils/cesium/TerrainUtils'
import { IonLayerUtils } from '@Utils/cesium/IonLayerUtils'
import { BASE_ENTITY, TERRAIN_ENTITY } from '@Core/constants'

/**
 * Manages layers and terrain for a mapping application, providing access to base layers, overlays, providers, and
 * countries. Implements a singleton pattern to ensure a single instance across the application.
 * @class
 */
export class LayersAndTerrainManager {
    /**
     * The singleton instance of LayersAndTerrainManager.
     * @type {LayersAndTerrainManager}
     * @static
     */
    static instance = null
    /**
     * The current base layer ID.
     * @type {string|null}
     * @private
     */
    #base = null
    /**
     * The current overlay layer ID.
     * @type {string|null}
     * @private
     */
    #overlay = null
    /**
     * Default layer IDs read from the current IDs in layers-terrains.yaml.
     * @type {{base: string|null, terrain: string|null}}
     * @private
     */
    #defaults = {
        base: null,
        terrain: null,
    }
    /**
     * The current provider ID derived from the base layer.
     * @type {string|null}
     * @private
     */
    #provider = null
    /**
     * A map of provider IDs to provider objects for efficient lookup.
     * @type {Map<string, Object>}
     * @private
     */
    #providers = new Map()
    /**
     * A map of layer IDs to layer objects for efficient access.
     * @type {Map<string, Object>}
     * @private
     */
    #bases = new Map()
    /**
     * A set of unique country names from layers.
     * @type {Set<string>}
     * @private
     */
    #countries = new Set()

    /**
     * Creates or returns the singleton instance, initializing layers, providers, and countries from settings.
     * @constructor
     */
    constructor() {
        // Return existing instance for singleton pattern
        if (LayersAndTerrainManager.instance) {
            return LayersAndTerrainManager.instance
        }

        // Initialize private fields from settings
        const startupLayers = lgs.savedConfiguration?.layers ?? {}
        this.#base = lgs.settings.getLayers.base ?? lgs.settings.layers?.base ?? null
        this.#overlay = lgs.settings.getLayers.overlay ?? lgs.settings.layers?.overlay ?? null
        this.#defaults.base = startupLayers.base ?? null
        this.#defaults.terrain = startupLayers.terrain ?? null
        this.#provider = this.#base?.split('-')[0] ?? null

        // Map providers and layers in a single pass, adding countries field
        for (const provider of (lgs.settings.layers.providers ?? [])) {
            if (!provider?.id || !Array.isArray(provider.layers)) {
                continue
            }

            this.#providers.set(provider.id, provider)
            for (const layer of provider.layers) {
                if (!layer?.id) {
                    continue
                }

                const enhancedLayer = {
                    ...layer,
                    provider:     provider.id,
                    providerName: provider.name ?? '',
                    providerFullname: provider.fullname ?? provider.name ?? '',
                    countries:    layer.countries ?? [],
                }
                this.#bases.set(layer.id, enhancedLayer)
                // Collect unique country names
                if (Array.isArray(enhancedLayer.countries)) {
                    enhancedLayer.countries.forEach(country => {
                        if (typeof country === 'string' && country.trim() !== '') {
                            this.#countries.add(country.trim())
                        }
                    })
                }
            }
        }

        const currentBase = lgs.settings.layers?.base ?? null
        const currentTerrain = lgs.settings.layers?.terrain ?? null

        if (!lgs.stores.ion?.token) {
            const fallbackBase = this.#defaults.base ?? 'arcgis-normal'
            const fallbackTerrain = this.#defaults.terrain ?? 'reearth-world'
            const selectedKeys = ['base', 'overlay', 'base3d', 'tiles3d', 'terrain']

            for (const key of selectedKeys) {
                const selected = this.#bases.get(lgs.settings.layers?.[key])
                if (!IonLayerUtils.isIonDependentLayer(selected)) {
                    continue
                }

                if (key === 'base') {
                    lgs.settings.layers.base = fallbackBase
                    this.#base = fallbackBase
                }
                else if (key === 'terrain') {
                    lgs.settings.layers.terrain = fallbackTerrain
                }
                else {
                    lgs.settings.layers[key] = ''
                }
            }
        }

        if (!currentBase || !this.#bases.has(currentBase)) {
            const fallbackBase = this.#defaults.base
            if (fallbackBase && this.#bases.has(fallbackBase)) {
                this.#base = fallbackBase
                if (lgs.settings.layers?.base !== fallbackBase) {
                    lgs.settings.layers.base = fallbackBase
                }
            }
        }

        if (!currentTerrain || !this.#bases.has(currentTerrain)) {
            const fallbackTerrain = this.#defaults.terrain
            if (fallbackTerrain && this.#bases.has(fallbackTerrain)) {
                if (lgs.settings.layers?.terrain !== fallbackTerrain) {
                    lgs.settings.layers.terrain = fallbackTerrain
                }
            }
        }

        this.#provider = this.getProviderByEntity(this.#base) ?? this.#provider

        // Set singleton instance
        LayersAndTerrainManager.instance = this
    }

    /**
     * Gets the list of unique countries declared in the layers.
     * @returns {string[]} An array of unique country names
     */
    get countries() {
        return Array.from(this.#countries)
    }

    /**
     * Gets the current base layer object.
     * @returns {Object|null} The current base layer or null if not set
     */
    get layer() {
        return this.#bases.get(this.#base) ?? null
    }

    /**
     * Sets the current base layer ID and updates the provider ID.
     * @param {string|null} layerId - The ID of the new base layer
     */
    set layer(layerId) {
        this.#base = layerId
        this.#provider = layerId?.split('-')[0] ?? null
    }

    /**
     * Gets the current overlay layer object.
     * @returns {Object|null} The current overlay layer or null if not set
     */
    get overlay() {
        return this.#bases.get(this.#overlay) ?? null
    }

    /**
     * Gets all available layers.
     * @returns {Map<string, Object>} A map of layer IDs to layer objects
     */
    get layers() {
        return this.#bases
    }

    /**
     * Gets the current provider object.
     * @returns {Object|null} The current provider or null if not set
     */
    get provider() {
        return this.#providers.get(this.#provider) ?? null
    }

    /**
     * Gets all available providers.
     * @returns {Map<string, Object>} A map of provider IDs to provider objects
     */
    get providers() {
        return this.#providers
    }

    /**
     * Retrieves a layer by its ID.
     * @param {string} [layerId=this.#base] - The ID of the layer to retrieve
     * @returns {Object|null} The layer object or null if not found
     */
    getALayer = (layerId = this.#base) => {
        return this.#bases.get(layerId) ?? null
    }

    /**
     * Extracts the provider ID from an entity ID.
     * @param {string|null} entityId - The entity ID (e.g., layer ID)
     * @returns {string|null} The provider ID or null if entityId is invalid
     */
    getProviderByEntity = (entityId) => {
        if (!entityId) {
            return null
        }
        const entity = this.#bases.get(entityId)
        if (entity?.provider) {
            return entity.provider
        }
        return null
    }

    /**
     * Gets the provider ID from a layer ID (deprecated, use getProviderByEntity).
     * @param {string|null} layerId - The layer ID
     * @returns {string|null} The provider ID or null if layerId is invalid
     * @deprecated Use getProviderByEntity instead
     */
    getProviderIdByLayerId = this.getProviderByEntity

    /**
     * Retrieves a provider from settings by its ID.
     * @param {string|null} providerId - The provider ID
     * @returns {Object|null} The provider object or null if not found
     */
    getProviderProxy = (providerId) => {
        if (!providerId) {
            return null
        }
        return lgs.settings.layers.providers.find(provider => provider?.id === providerId) ?? null
    }

    /**
     * Retrieves a provider from settings by an entity ID.
     * @param {string|null} entityId - The entity ID (e.g., layer ID)
     * @returns {Object|null} The provider object or null if not found
     */
    getProviderProxyByEntity = (entityId, entityType = null) => {
        if (!entityId) {
            return this.#getFallbackProviderProxy(entityType)
        }
        const providerId = this.getProviderByEntity(entityId)
        const provider = this.getProviderProxy(providerId)
        if (provider) {
            return provider
        }
        return this.#getFallbackProviderProxy(entityType)
    }

    #getFallbackEntityIdByType = (entityType) => {
        switch (entityType) {
            case BASE_ENTITY:
                return this.#defaults.base
            case TERRAIN_ENTITY:
                return this.#defaults.terrain
            default:
                return null
        }
    }

    #getFallbackProviderProxy = (entityType) => {
        const fallbackEntityId = this.#getFallbackEntityIdByType(entityType)
        if (!fallbackEntityId) {
            return null
        }
        const fallbackProviderId = this.getProviderByEntity(fallbackEntityId)
        return this.getProviderProxy(fallbackProviderId)
    }

    /**
     * Retrieves a layer from settings by its entity ID.
     * @param {string|null} entityId - The entity ID (layer ID)
     * @returns {Object|null} The layer object or null if not found
     */
    getEntityProxy = (entityId) => {
        if (!entityId) {
            return null
        }
        return this.#bases.get(entityId) ?? null
    }

    getEntityProxyByType = (entityId, entityType = null) => {
        if (entityId) {
            const entity = this.getEntityProxy(entityId)
            if (entity) {
                return entity
            }
        }

        const fallbackEntityId = this.#getFallbackEntityIdByType(entityType)
        return fallbackEntityId ? this.getEntityProxy(fallbackEntityId) : null
    }

    /**
     * Changes the terrain configuration using TerrainUtils.
     * @param {string|Object} entity - The terrain entity or configuration
     */
    changeTerrain = (entity) => {
        void TerrainUtils.changeTerrain(entity)
    }
}
