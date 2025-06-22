/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-22
 * Last modified: 2025-06-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    ADD_POI_EVENT, FLAG_START_TYPE, FLAG_STOP_TYPE, HIGH_TERRAIN_PRECISION, POI_STANDARD_TYPE, POI_STARTER_TYPE,
    POI_THRESHOLD_DISTANCE, POI_TMP_TYPE, POIS_STORE, REMOVE_POI_EVENT,
}                     from '@Core/constants'
import { MapPOI }     from '@Core/MapPOI'
import { Export }     from '@Core/ui/Export'
import { POIUtils }   from '@Utils/cesium/POIUtils'
import { TrackUtils } from '@Utils/cesium/TrackUtils'
import { UIToast }    from '@Utils/UIToast'
import { KM }         from '@Utils/UnitUtils'
import { v4 as uuid } from 'uuid'
import { snapshot }   from 'valtio/index'
import { proxyMap }   from 'valtio/utils'
import { subscribe }  from 'valtio/vanilla'

/*******************************************************************************
 * POIManager.js
 *
 * This class implements a Point of Interest (POI)
 * management system with simplified change management.
 *
 ******************************************************************************/

export class POIManager {
    threshold = POI_THRESHOLD_DISTANCE
    utils = POIUtils

    // Simplified tracking - only for structural changes
    #structureSubscription = null
    #initialized = false
    #pendingWrites = new Map() // Debounce database writes
    #updateTimeout = 300 // ms for debouncing

    constructor() {
        // Singleton pattern implementation
        if (POIManager.instance) {
            return POIManager.instance
        }
        POIManager.instance = this
        this.setupSubscriptions()
    }

    /**
     * Access the reactive POI list
     * @return {Map} The proxied map of POIs
     */
    get list() {
        return lgs.stores.main.components.pois.list
    }

    /**
     * Retrieves the special starter POI that serves as the application's initial focus point.
     * @return {MapPOI} The starter POI object
     */
    get starter() {
        return Array.from(this.list.values()).find(poi => poi.type === POI_STARTER_TYPE)
    }

    /**
     * Updates application settings with properties from the starter POI.
     * This allows the app to remember the last starter location.
     * @param {MapPOI} poi - The POI to use for updating settings
     */
    set starterSettings(poi) {
        Object.keys(lgs.settings.starter).forEach(key => {
            lgs.settings.starter[key] = poi[key]
        })
    }

    /**
     * Static factory method to create and initialize a POIManager instance
     * @returns {Promise<POIManager>} A fully initialized POIManager
     */
    static async create() {
        const manager = new POIManager()
        await manager.initialize()
        return manager
    }

    /**
     * Initializes the POIManager by loading data from the database
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.#initialized) {
            return
        }

        try {
            // Load POIs from database
            await this.readAllFromDB()
            this.#initialized = true
        }
        catch (error) {
            console.error('Error initializing POIManager:', error)
            throw error
        }
    }

    /**
     * Checks if the manager is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.#initialized
    }

    /**
     * Centralized method for updating POI properties
     * Handles store synchronization and database persistence automatically
     *
     * @param {string} id - POI identifier
     * @param {Object} updates - Properties to update
     * @param {Object} options - Update options
     * @param {boolean} options.skipPersist - Skip database persistence
     * @param {boolean} options.immediate - Skip debouncing for immediate update
     * @returns {Promise<MapPOI|null>} Updated POI or null if not found
     */
    async updatePOI(id, updates, options = {}) {
        const {skipPersist = false, immediate = false} = options

        const currentPOI = this.list.get(id)
        if (!currentPOI) {
            console.warn(`POI with id ${id} not found`)
            return null
        }

        // Create updated POI with modification timestamp
        const updatedPOI = {
            ...currentPOI,
            ...updates,
        }

        // Update main list
        this.list.set(id, updatedPOI)

        // Auto-sync filtered collections
        this.#syncFilteredCollections(id, updatedPOI)

        // Handle database persistence
        if (!skipPersist) {
            if (immediate) {
                await this.persistToDatabase(updatedPOI)
            }
            else {
                this.#debouncedPersist(updatedPOI)
            }
        }

        return updatedPOI
    }

    /**
     * Simplified subscription setup - only tracks structural changes
     */
    setupSubscriptions() {
        // Only subscribe to structure changes (add/remove)
        this.#structureSubscription = subscribe(
            lgs.stores.main.components.pois.list,
            (ops) => {
                ops.forEach(([op, path, value, prevValue]) => {
                    if (op === 'set' && prevValue === undefined) {
                        // New POI added
                        this.#handlePOIAdded(path[0], value)
                    }
                    else if (op === 'delete') {
                        // POI removed
                        this.#handlePOIRemoved(path[0], prevValue)
                    }
                })
            },
        )
    }

    /**
     * Synchronizes POI data across filtered collections
     * @param {string} id - POI identifier
     * @param {Object} poi - Updated POI data
     * @private
     */
    #syncFilteredCollections(id, poi) {
        const $pois = lgs.stores.main.components.pois

        // Sync global filtered collection
        if ($pois.filtered.global.has(id)) {
            $pois.filtered.global.set(id, poi)
        }

        // Sync journey filtered collection
        if ($pois.filtered.journey.has(id)) {
            $pois.filtered.journey.set(id, poi)
        }
    }

    /**
     * Debounced database persistence to avoid excessive writes
     * @param {Object} poi - POI to persist
     * @private
     */
    #debouncedPersist(poi) {
        const existingTimeout = this.#pendingWrites.get(poi.id)
        if (existingTimeout) {
            clearTimeout(existingTimeout)
        }

        const timeoutId = setTimeout(async () => {
            try {
                await this.persistToDatabase(poi)
                this.#pendingWrites.delete(poi.id)
            }
            catch (error) {
                console.error(`Failed to persist POI ${poi.id}:`, error)
            }
        }, this.#updateTimeout)

        this.#pendingWrites.set(poi.id, timeoutId)
    }

    /**
     * Handles POI addition events
     * @param {string} id - POI identifier
     * @param {Object} poi - POI data
     * @private
     */
    #handlePOIAdded(id, poi) {
        window.dispatchEvent(new CustomEvent(ADD_POI_EVENT, {
            detail:  {poi},
            bubbles: true,
        }))
    }

    /**
     * Handles POI removal events
     * @param {string} id - POI identifier
     * @param {Object} poi - POI data that was removed
     * @private
     */
    #handlePOIRemoved(id, poi) {
        // Clear any pending writes for this POI
        const existingTimeout = this.#pendingWrites.get(id)
        if (existingTimeout) {
            clearTimeout(existingTimeout)
            this.#pendingWrites.delete(id)
        }

        window.dispatchEvent(new CustomEvent(REMOVE_POI_EVENT, {
            detail:  {poi},
            bubbles: true,
        }))
    }

    /**
     * Cleanup method to clear subscriptions and pending operations
     */
    destroy() {
        if (this.#structureSubscription) {
            this.#structureSubscription()
            this.#structureSubscription = null
        }

        // Clear all pending writes
        this.#pendingWrites.forEach(timeoutId => clearTimeout(timeoutId))
        this.#pendingWrites.clear()

        this.#initialized = false
        POIManager.instance = null
    }

    /**
     * Adds a new POI to the map and optionally saves it to the database.
     * Checks proximity to existing POIs to prevent overcrowding.
     *
     * @param {Object} poi - The POI object to add
     * @param {boolean} checkDistance - Whether to verify distance to existing POIs
     * @param {boolean} dbSync - Whether to save to database
     * @return {MapPOI|false} - The added POI or false if too close to existing points
     */
    add = async (poi, checkDistance = true, dbSync = true) => {
        if (!(poi instanceof MapPOI)) {
            const id = poi.id ?? uuid()
            poi = new MapPOI({...poi, id})
        }

        if (checkDistance && this.isTooCloseThanExistingPoints(poi, this.threshold)) {
            return false
        }

        this.list.set(poi.id, poi)

        if (dbSync) {
            await this.persistToDatabase(poi)
        }

        return poi
    }

    /**
     * Retrieves a POI by its unique identifier.
     *
     * @param {string} id - The POI identifier
     * @return {MapPOI} The found POI or undefined
     */
    get = id => this.list.get(id)

    /**
     * Retrieves a list of POI with the same parent
     *
     * @param {string} parent - the parent identifier
     * @return {Array<MapPOI>} Array of POIs with the same parent
     */
    getByParent = parent => {
        return Array.from(this.list.values()).filter(poi => poi.parent === parent)
    }

    /**
     * Set visibility for all POIs with the the same parent
     *
     * @param {string} parent - the parent identifier
     * @param {boolean} visibility - the visibility
     */
    setVisibilityByParent = async (parent, visibility) => {
        for (const poi of this.getByParent(parent)) {
            if (visibility) {
                poi.show()
            }
            else {
                poi.hide()
            }
            await poi.persistToDatabase()
        }
    }

    /**
     * Extracts and normalizes POI data from a GeoJSON point feature.
     *
     * This method transforms a GeoJSON point feature into a standardized point object
     * that can be used to create a POI in the application. It extracts coordinates,
     * title, description, and applies default styling.
     *
     * When the 'simulate' parameter is true, the method will additionally calculate
     * and include terrain height at the point's location using the terrain service.
     * Otherwise, it will use the height value already present in the POI data.
     *
     * @async
     * @param {Object} json - The GeoJSON point feature to extract data from
     * @param {boolean} [simulate=false] - Whether to simulate height from terrain data
     *
     * @returns {Promise<Object>} A promise that resolves to a standardized point
     * @throws {Error} If terrain height calculation fails during simulation, falls back to height=0
     */
    getPointFromGeoJson = async (json, simulate = false) => {
        const point = {
            longitude:   json.geometry.coordinates[0],
            latitude:    json.geometry.coordinates[1],
            title:       json.properties.name ?? '',
            description: json.properties.display_name
                         ? json.properties.display_name.split(', ').join(' - ')
                         : '',
            color:       lgs.darkContrastColor,
            bgColor:     lgs.colors.poiDefaultBackground,
        }

        if (simulate) {
            try {
                point.simulatedHeight = await this.getHeightFromTerrain({
                                                                            coordinates: {
                                                                                longitude: json.geometry.coordinates[0],
                                                                                latitude:  json.geometry.coordinates[1],
                                                                            },
                                                                        })
            }
            catch (error) {
                console.log(error)
                point.simulatedHeight = 0
            }
        }
        else {
            point.height = json.height
        }

        return point
    }

    /**
     * Removes a Point of Interest (POI) from the list.
     *
     * @param {Object} options - The removal options.
     * @param {string} options.id - The ID of the POI to remove.
     * @param {boolean} [options.dbSync=true] - Whether to sync with the database.
     * @param {boolean} [options.force=false] - Whether to force deletion of START and STOP POIs.
     * @returns {Promise<Object>} - The result of the removal operation.
     */
    remove = async ({id, dbSync = true, force = false} = {}) => {
        const poi = this.list.get(id)

        // If the POI does not exist, return failure
        if (!poi) {
            return {id: id, success: false}
        }

        // The STARTER POI cannot be deleted, as it is essential for the application
        if (poi.type === POI_STARTER_TYPE) {
            UIToast.warning({
                                caption: sprintf(`The POI "%s" can not be deleted !`, poi.title),
                                text:    'It is the starter POI.',
                            });
            return {id: id, success: false}
        }

        // If force is false, prevent deletion of START or STOP POIs
        if ((poi.type === FLAG_START_TYPE || poi.type === FLAG_STOP_TYPE) && !force) {
            UIToast.warning({
                                caption: sprintf(`The POI "%s" can not be deleted !`, poi.title),
                                text:    'It is a required POI.',
                            })
            return {id: id, success: false}
        }

        // Remove the POI from the lists and the database
        this.list.delete(id)
        lgs.stores.main.components.pois.list.delete(id)
        if (lgs.stores.main.components.pois.filtered.global.has(id)) {
            lgs.stores.main.components.pois.filtered.global.delete(id)
        }
        if (lgs.stores.main.components.pois.filtered.journey.has(id)) {
            lgs.stores.main.components.pois.filtered.journey.delete(id)
        }
        await poi.remove(dbSync)

        // Show a success toast only if force = true and the POI is not STARTER
        if (poi.type !== POI_STARTER_TYPE && force) {
            UIToast.success({
                                caption: sprintf(`The POI "%s" has been deleted !`, poi.title),
                                text:    '',
                            });
        }

        return {id: id, success: true}
    };

    /**
     * Determines if two points are closer than a specified threshold.
     *
     * @param {Object} poi1 - First point coordinates
     * @param {Object} poi2 - Second point coordinates
     * @param {number} threshold - Distance threshold in meters
     * @return {boolean} True if points are closer than threshold
     */
    closerThan = (poi1, poi2, threshold = this.threshold) => {
        return this.haversineDistance(poi1, poi2) <= threshold
    }

    /**
     * Calculates distance between two geographic points using the Haversine formula.
     * This accounts for Earth's curvature to provide accurate distances.
     *
     * @param {Object} poi1 - First point with latitude/longitude
     * @param {Object} poi2 - Second point with latitude/longitude
     * @return {number} Distance in meters
     */
    haversineDistance = (poi1, poi2) => {
        const toRadians = (degrees) => degrees * (Math.PI / 180)
        const R = 6371  // Earth radius in kilometers
        const dLat = toRadians(poi2.latitude - poi1.latitude)
        const dLon = toRadians(poi2.longitude - poi1.longitude)
        const a =
                  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRadians(poi1.latitude)) * Math.cos(toRadians(poi2.latitude)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return R * c / KM   // Convert to meters
    }

    /**
     * Copies formatted coordinates to the system clipboard.
     * Formats according to user's preferred coordinate system.
     *
     * @param {Object} point - Point with latitude and longitude
     * @return {Promise<boolean>} Success indicator
     */
    copyCoordinatesToClipboard = async (point) => {
        return Export.toClipboard(`${__.convert(point.latitude).to(lgs.settings.coordinateSystem.current)}, ${__.convert(point.longitude).to(lgs.settings.coordinateSystem.current)}`)
    }

    /**
     * Searches for POIs matching a specific property value.
     *
     * @param {string} key - Property name to match
     * @param {*} value - Value to match
     * @return {Array<MapPOI>} Array of matching POIs
     */
    getPOIByKeyValue = (key, value) => {
        const result = []
        this.list.forEach(poi => {
            if (poi[key] === value) {
                result.push(poi)
            }
        })
        return result
    }

    /**
     * Checks if a new POI would be too close to any existing POIs.
     * Special exception for starter POIs which can be placed anywhere.
     *
     * @param {Object} newPoi - POI to check
     * @param {number} threshold - Distance threshold in meters
     * @param {Object|null} tempList - Optional alternative POI list
     * @return {boolean} True if too close to an existing POI
     */
    isTooCloseThanExistingPoints = (newPoi, threshold = this.threshold, tempList = null) => {
        const list = (tempList === null) ? this.list : tempList
        if (newPoi.type === POI_STARTER_TYPE) {
            return false
        }
        for (let poi of list.values()) {
            if (this.closerThan(newPoi, poi, threshold)) {
                return true
            }
        }
        return false
    }

    /**
     * Gets elevation from terrain for a geographic point.
     *
     * @param {Object} point - Geographic point
     * @return {Promise<number>} Elevation value
     */
    getElevationFromTerrain = async (point) => {
        return TrackUtils.getElevationFromTerrain(point)
    }

    /**
     * Gets terrain height with configurable precision and detail level.
     *
     * @param {Object} options - Configuration parameters
     * @param {Object} options.coordinates - Geographic coordinates
     * @param {number} options.precision - Sampling precision
     * @param {number} options.level - Detail level
     * @return {Promise<number>} Height value
     */
    getHeightFromTerrain = async ({coordinates, precision = HIGH_TERRAIN_PRECISION, level = 11}) => {
        return __.ui.sceneManager.getHeightFromTerrain({
                                                           coordinates: coordinates,
                                                           precision:   precision,
                                                           level:       level,
                                                       })
    }

    /**
     * Designates a POI as the starter point and updates the previous starter.
     * Handles visual styling and type changes for both POIs.
     *
     * @param {MapPOI} current - POI to designate as starter
     * @return {Object|boolean} Object with old and new starter or false if no former starter
     */
    setStarter = async (current) => {
        const former = this.getPOIByKeyValue('type', POI_STARTER_TYPE)[0]
        if (former) {
            // Restore the former starter POI to its previous type with standard styling
            await this.updatePOI(former.id, {
                type: former.formerType ?? POI_STANDARD_TYPE,
                color:   lgs.colors.poiDefault,
                bgColor: lgs.colors.poiDefaultBackground,
            }, {immediate: true})

            // Configure the new starter POI with appropriate type and styling
            await this.updatePOI(current.id, {
                formerType: current.type ?? POI_STANDARD_TYPE,
                type: POI_STARTER_TYPE,
                color: lgs.settings.starter.color,
            }, {immediate: true})

            const starter = this.list.get(current.id)
            this.starterSettings = starter
            return {former, starter}
        }
        return false
    }

    /**
     * Persists a POI to the database if it's not a temporary POI.
     *
     * @param poi {MapPOI|string}  - POI to save (id or MapPOI object) [default: current id]
     * @return {Promise<void>}
     */
    persistToDatabase = async (poi = lgs.stores.main.components.pois.current) => {
        if (typeof poi === 'string') {
            // let's get the poi according to the id
            poi = lgs.stores.main.components.pois.list.get(poi)
        }
        if (poi.type && poi.type !== POI_TMP_TYPE) {
            await lgs.db.lgs1920.put(poi.id, MapPOI.serialize({...poi, ...{__class: MapPOI}}), POIS_STORE)
        }
    }

    /**
     * Removes a POI from the database.
     *
     * @param poi {MapPOI|string}  - POI to remove (id or MapPOI object) [default: current id]
     * @return {Promise<void>}
     */
    removeInDB = async (poi = lgs.stores.main.components.pois.current) => {
        if (poi instanceof MapPOI) {
            // It is a MapPOI object, let's get id
            poi = poi.id
        }
        await lgs.db.lgs1920.delete(poi, POIS_STORE)
    }

    /**
     * Reads a specific POI from the database and adds it to the list.
     *
     * @param {MapPOI} poi - POI to retrieve
     * @return {Promise<void>}
     */
    readFromDB = async (poi = lgs.stores.main.components.pois.current) => {
        if (poi instanceof MapPOI) {
            // It is a MapPOI object, let's get id
            poi = poi.id
        }
        const poiFromDB = await lgs.db.lgs1920.get(poi, POIS_STORE)
        if (poiFromDB) {
            this.list.set(poiFromDB.id, new MapPOI(poiFromDB))
        }
    }

    /**
     * Loads all POIs from the database and populates the list.
     * Ensures terrain heights are available for all POIs.
     *
     * @return {Promise<proxyMap|false>} List of POIs or false on error
     */
    readAllFromDB = async () => {
        try {
            // Get all POI IDs from database
            const keys = await lgs.db.lgs1920.keys(POIS_STORE)

            // Retrieve each POI by its ID
            const poiPromises = keys.map(async (key) => {
                return await lgs.db.lgs1920.get(key, POIS_STORE)
            })
            const list = await Promise.all(poiPromises)

            // Process and add each POI to the list
            for (const poi of list) {
                if (!poi.simulatedHeight) {
                    poi.simulatedHeight = await this.getHeightFromTerrain({
                                                                              coordinates: {
                                                                                  longitude: poi.longitude,
                                                                                  latitude:  poi.latitude,
                                                                                  height:    poi.height,
                                                                              },
                                                                          })
                }
                this.list.set(poi.id, new MapPOI(poi))
            }
            return this.list
        }
        catch (error) {
            console.error('Error when trying to get pois from browser database :', error)
            return false
        }
    }

    /**
     * Persists all POIs to the database.
     *
     * @return {Promise<Array>} Promise resolving to operation results
     */
    saveAllInDB = async () => {
        try {
            // Save each POI in the database
            const poiPromises = Array.from(this.list.entries()).map(async ([key, poi]) => {
                return snapshot(
                    {
                        object: await lgs.db.lgs1920.put(key, MapPOI.serialize({...poi, ...{__class: MapPOI}}), POIS_STORE),
                        reset:  true,
                    },
                )
            })
            return await Promise.all(poiPromises)
        }
        catch (error) {
            console.error('Error when trying to save pois to browser database :', error)
            return []
        }
    }

    /**
     * Checks if any POIs exist in the collection.
     *
     * @return {boolean} True if POIs exist, false otherwise
     */
    hasPOIs = () => {
        return this.list.size > 0
    }

    /**
     * Determines if two points are approximately equal within a distance tolerance.
     *
     * @param {Object} start - First point
     * @param {Object} end - Second point
     * @param {number} distance - Distance tolerance in degrees
     * @return {boolean} True if points are approximately equal
     */
    almostEquals = (start, end, distance = 0.5) => {
        return end === null ? false : this.utils.almostEquals(start, end, distance)
    }

    /**
     * Opens the POI editor
     * @param {MapPOI} poi - POI to edit
     */
    openEditor = (poi) => {
        // Implementation placeholder
    }
}