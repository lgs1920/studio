/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LayerAndTerrainManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-07
 * Last modified: 2025-07-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { TerrainUtils } from '@Utils/cesium/TerrainUtils'

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
     * The current terrain configuration (not actively used in this implementation).
     * @type {null}
     * @private
     */
    #terrain = null
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
        this.#base = lgs.settings.getLayers.base
        this.#overlay = lgs.settings.getLayers.overlay
        this.#provider = this.#base?.split('-')[0] ?? null

        // Map providers and layers in a single pass, adding country field
        lgs.settings.layers.providers.forEach(provider => {
            this.#providers.set(provider.id, provider)
            provider.layers.forEach(layer => {
                // Add country field with 'WORLD' as default
                const enhancedLayer = {...layer, provider: provider.id, country: layer.country ?? ''}
                this.#bases.set(layer.id, enhancedLayer)
                // Collect unique country names
                this.#countries.add(enhancedLayer.country)
            })
        })

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
        return entityId?.split('-')[0] ?? null
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
        return lgs.settings.layers.providers.find(provider => provider.id === providerId) ?? null
    }

    /**
     * Retrieves a provider from settings by an entity ID.
     * @param {string|null} entityId - The entity ID (e.g., layer ID)
     * @returns {Object|null} The provider object or null if not found
     */
    getProviderProxyByEntity = (entityId) => {
        if (!entityId) {
            return null
        }
        const providerId = this.getProviderByEntity(entityId)
        return this.getProviderProxy(providerId)
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
        const provider = this.getProviderProxy(this.getProviderByEntity(entityId))
        return provider?.layers.find(layer => layer.id === entityId) ?? null
    }

    /**
     * Changes the terrain configuration using TerrainUtils.
     * @param {string|Object} entity - The terrain entity or configuration
     */
    changeTerrain = (entity) => {
        TerrainUtils.changeTerrain(entity)
    }
}