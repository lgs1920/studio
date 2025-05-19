/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-19
 * Last modified: 2025-05-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import {
    ADD_POI_EVENT, FLAG_START_TYPE, FLAG_STOP_TYPE, HIGH_TERRAIN_PRECISION, POI_SIZES, POI_STANDARD_TYPE,
    POI_STARTER_TYPE, POI_THRESHOLD_DISTANCE, POI_TMP_TYPE, POIS_STORE, REMOVE_POI_EVENT, UPDATE_POI_EVENT,
}                              from '@Core/constants'
import { MapPOI }              from '@Core/MapPOI'
import { Export }              from '@Core/ui/Export'
import { POIUtils }            from '@Utils/cesium/POIUtils'
import { TrackUtils }          from '@Utils/cesium/TrackUtils'
import { UIToast }             from '@Utils/UIToast'
import { ELEVATION_UNITS, KM } from '@Utils/UnitUtils'
import Konva                   from 'konva'
import { v4 as uuid }          from 'uuid'
import { snapshot }            from 'valtio/index'
import { proxyMap, watch }     from 'valtio/utils'
import { subscribe }           from 'valtio/vanilla'

/*******************************************************************************
 * POIManager.js
 *
 * This class implements a Point of Interest (POI)
 * management system.
 *
 ******************************************************************************/

export class POIManager {
    threshold = POI_THRESHOLD_DISTANCE
    utils = POIUtils
    // To store our unsubscribe functions
    unsubscribeFunctions = {
        listStructure:  null,
        contentChanges: null,
    }
    // To track previous state of POIs for change detection
    previousPoiState = new Map()

    // Flag to track initialization status
    #initialized = false

    constructor() {
        // Singleton pattern implementation
        if (POIManager.instance) {
            return POIManager.instance
        }
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
     *
     * @return {MapPOI} The starter POI object
     */
    get starter() {
        return this.list.values().find(poi => poi.type === POI_STARTER_TYPE)
    }

    /**
     * Updates application settings with properties from the starter POI.
     * This allows the app to remember the last starter location.
     *
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

            // Initialize previous state with current POIs
            this.updatePreviousState()

            // Mark as initialized
            this.#initialized = true

        }
        catch (error) {
            console.error('Error initializing POIManager:', error)
            throw error // Re-throw to allow caller to handle
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
     * Updates the previous state of all POIs to enable change detection
     */
    updatePreviousState() {
        this.previousPoiState.clear()
        // Clone the current state of each POI
        lgs.stores.main.components.pois.list.forEach((poi, id) => {
            this.previousPoiState.set(id, JSON.parse(JSON.stringify(poi)))
        })
    }

    /**
     * Configures and sets up subscriptions for observing changes in POIs structure
     * and content updates. It initializes the previous state of POIs and sets up appropriate listeners
     * for handling changes.
     *
     * @return {void} No return value.
     */
    setupSubscriptions() {
        // Initialize previous POI state
        this.initializePreviousPoiState()

        // Subscribe to structure changes (additions and removals)
        this.unsubscribeFunctions.listStructure = subscribe(
            lgs.stores.main.components.pois.list,
            this.handleListStructureChanges.bind(this),
        )

        // Subscribe to content changes
        this.unsubscribeFunctions.contentChanges = watch(
            this.handleContentChanges.bind(this),
            {sync: true},
        )
    }

    /**
     * Initializes the previousPoiState map to store deep copies of POI data.
     * Iterates through the list of POIs and saves their deep-cloned state keyed by their ID.
     *
     * @return {void} Does not return a value.
     */
    initializePreviousPoiState() {
        this.previousPoiState = new Map()
        lgs.stores.main.components.pois.list.forEach((poi, id) => {
            this.previousPoiState.set(id, JSON.parse(JSON.stringify(poi)))
        })
    }

    /**
     * Handles changes in the structure of the POI list by identifying added and removed POIs.
     *
     * This method compares the current POI identifiers with the previous state,
     * determines the added and removed POIs, and performs the required operations
     * for each case. It also updates the stored state to reflect the current structure.
     *
     * @return {void} Does not return a value. Executes handling of POI structure changes.
     */
    handleListStructureChanges() {
        const currentPoiIds = [...lgs.stores.main.components.pois.list.keys()]
        const previousPoiIds = [...this.previousPoiState.keys()]

        this.handleAddedPois(currentPoiIds, previousPoiIds)
        this.handleRemovedPois(currentPoiIds, previousPoiIds)

        this.updatePreviousState()
    }

    /**
     * Handles the processing of POIs (Points of Interest) that were added by comparing the current and previous POI
     * IDs.
     *
     * @param {Array<string|number>} currentPoiIds - An array of POI IDs currently available.
     * @param {Array<string|number>} previousPoiIds - An array of POI IDs that were previously available.
     * @return {void} - Does not return a value.
     */
    handleAddedPois(currentPoiIds, previousPoiIds) {
        const addedPoiIds = currentPoiIds.filter(id => !previousPoiIds.includes(id))

        addedPoiIds.forEach(poiId => {
            const addedPoi = lgs.stores.main.components.pois.list.get(poiId)
            if (addedPoi) {
                window.dispatchEvent(new CustomEvent(ADD_POI_EVENT, {
                    detail:  {poi: addedPoi},
                    bubbles: true,
                }))
            }
        })
    }

    /**
     * Identifies and handles POIs that were removed by comparing the current list of POI IDs
     * with the previous list. For each removed POI, a custom event is dispatched to remove it.
     *
     * @param {Array<string>} currentPoiIds - An array of POI IDs that are currently active.
     * @param {Array<string>} previousPoiIds - An array of POI IDs that were active previously.
     * @return {void} This method does not return a value.
     */
    handleRemovedPois(currentPoiIds, previousPoiIds) {
        const removedPoiIds = previousPoiIds.filter(id => !currentPoiIds.includes(id))

        removedPoiIds.forEach(poiId => {
            const previousData = this.previousPoiState.get(poiId)
            if (!previousData) {
                console.warn(`Missing previous data for POI ${poiId}`)
                return
            }

            const removedPoi = new MapPOI(previousData)
            window.dispatchEvent(new CustomEvent(REMOVE_POI_EVENT, {
                detail:  {poi: removedPoi},
                bubbles: true,
            }))
        })
    }

    /**
     * Handles changes in the content of POIs by comparing
     * the current state with the previously stored state, detecting changes,
     * and dispatching an event if changes are found.
     *
     * @param {Function} get - The getter function to retrieve the latest state
     * of the POI list from the store.
     * @return {void} This method does not return a value.
     */
    handleContentChanges(get) {
        const poiList = get(lgs.stores.main.components.pois.list)

        poiList.forEach((currentPoi, id) => {
            const previousPoi = this.previousPoiState.get(id)

            if (previousPoi) {
                const changedFields = this.detectChanges(previousPoi, currentPoi)
                if (Object.keys(changedFields).length > 0) {
                    window.dispatchEvent(new CustomEvent(UPDATE_POI_EVENT, {
                        detail:  {
                            poi:    new MapPOI(currentPoi),
                            former: previousPoi,
                            changedFields,
                        },
                        bubbles: true,
                    }))

                    // Update previous state for this POI
                    this.previousPoiState.set(id, JSON.parse(JSON.stringify(currentPoi)))
                }
            }
        })
    }

    /**
     * Detects differences between two objects and returns an object representing the changes.
     * Only enumerable properties that are non-function types are compared.
     * If one of the objects is null or undefined, an empty object is returned.
     *
     * @param {Object} previous - The initial object to compare.
     * @param {Object} current - The updated object to compare against the initial object.
     * @return {Object} An object containing the properties that have changed, where each key maps to an object with
     *     the previous and current values.
     */
    detectChanges(previous, current) {
        const changes = {}

        if (!previous || !current) {
            return changes
        }

        // Ne compare que les propriétés énumérables et non-fonctions
        for (const key in current) {
            if (
                typeof current[key] !== 'function' && // Ignore les méthodes
                typeof previous[key] !== 'function' && // Ignore les méthodes
                previous[key] !== current[key]
            ) {
                changes[key] = {
                    previous: previous[key],
                    current:  current[key],
                }
            }
        }
        return changes
    }

    /**
     * Unsubscribes all active event listeners related to structure changes and content changes.
     * This method ensures that previously subscribed functions for monitoring these changes
     * are properly cleaned up and set to null to avoid redundant operations.
     *
     * @return {void} No return value.
     */
    unsubscribeAll() {
        // Unsubscribe from structure changes
        if (typeof this.unsubscribeFunctions.listStructure === 'function') {
            this.unsubscribeFunctions.listStructure()
            this.unsubscribeFunctions.listStructure = null
        }

        // Unsubscribe from content changes
        if (typeof this.unsubscribeFunctions.contentChanges === 'function') {
            this.unsubscribeFunctions.contentChanges()
            this.unsubscribeFunctions.contentChanges = null
        }
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
     *
     * @return
     */
    getByParent = parent => {
        return this.list.values().filter(poi => poi.parent === parent)
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
                                                                            longitude: json.geometry.coordinates[0],
                                                                            latitude:  json.geometry.coordinates[1],
                                                                        })
            }
            catch {
                point.simulatedHeight = 0
            }
        }
        else {
            point.height = json.height
        }

        return point
    }

    /**
     * Updates an existing POI with new properties.
     *
     * @param {string} id - The ID of the POI to update
     * @param {Object} updates - The updates to apply
     * @return {MapPOI|false} Updated POI or false if not found
     */
    update = (id, updates) => {
        const poi = this.list.get(id)
        if (poi) {
            this.list.set(id, poi.update(updates))
            return this.list.get(id)
        }
        return false
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
                                text: 'It is the starter POI.',
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

        // Remove the POI from the list and the database
        this.list.delete(id)
        await poi.remove(dbSync)

        // Show a success toast only if force = true and the POI is not STARTER
        if (poi.type !== POI_STARTER_TYPE && force) {
            UIToast.success({
                                caption: sprintf(`The POI "%s" has been deleted !`, poi.title),
                                text: '',
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
            Object.assign(this.list.get(former.id), {
                type: former.formerType ?? POI_STANDARD_TYPE,
                color:   lgs.colors.poiDefault,
                bgColor: lgs.colors.poiDefaultBackground,
            })
            await this.list.get(former.id).persistToDatabase()

            // Configure the new starter POI with appropriate type and styling
            Object.assign(this.list.get(current.id), {
                formerType: current.type ?? POI_STANDARD_TYPE,
                type: POI_STARTER_TYPE,
                color:      lgs.settings.starter.color,
            })

            await this.list.get(current.id).persistToDatabase()
            const starter = this.starterSettings = this.list.get(current.id)
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
            Array.from(this.list.entries()).map(async ([key, poi]) => {
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
     * Generates a visual representation of a POI using Konva.js.
     * Creates a canvas with background, border, arrow, and text elements.
     *
     * @param {MapPOI} poi - POI to visualize
     * @return {string} Data URL of rendered image
     */
    createContent = (poi) => {
        // Calculate dimensions based on POI expanded state
        const width = poi.expanded ? POI_SIZES.expanded.width : POI_SIZES.reduced.width
        const height = poi.expanded ? POI_SIZES.expanded.height : POI_SIZES.reduced.height
        const arrow = {width: POI_SIZES.arrow.width, height: POI_SIZES.arrow.height, content: ''}

        // Get styling from CSS and POI properties
        const textFont = __.ui.css.getCSSVariable('--lgs-font-family')
        const bgColor = poi.bgColor ?? lgs.colors.poiDefaultBackground
        const borderColor = poi.color ?? lgs.colors.poiDefault
        const color = poi.color ?? lgs.colors.poiDefault

        // Create Konva stage and layer
        const stage = new Konva.Stage({
                                          container: 'konva-container', // HTML container ID
                                          width:     width,
                                          height:    height + arrow.height,
                                      })
        const layer = new Konva.Layer()
        stage.add(layer)

        // Create content group
        const content = new Konva.Group({
                                            x: 0,
                                            y: 0,
                                        })

        // Create background with blur effect
        const background = new Konva.Rect({
                                              width:        width,
                                              height:       height,
                                              cornerRadius: 4,
                                              fill:         bgColor,
                                              opacity:      0.7,
                                              stroke:       null,
                                          })
        background.filters([Konva.Filters.Blur])
        background.blurRadius(10)

        // Create border
        const border = new Konva.Rect({
                                          width:        width - 3,
                                          height:       height - 3,
                                          x:            1,
                                          y:            2,
                                          cornerRadius: 2,
                                          fill:         null,
                                          stroke:       borderColor,
                                          strokeWidth:  2.0,
                                          opacity:      1,
                                      })

        arrow.content = new Konva.Line({
                                           points:  [
                                               width / 2, height + arrow.height,
                                               width / 2 - arrow.width / 2, height,
                                               width / 2 + arrow.width / 2, height,
                                           ],
                                           fill:    color,
                                           opacity: 1,
                                           closed:  true,
                                       })

        // Draw container and arrow
        content.add(background)
        content.add(border)
        content.add(arrow.content)

        if (poi.expanded) {
            const title = new Konva.Text({
                                             x:          10,
                                             y:          8,
                                             text:       poi.title,
                                             fontSize:   13,
                                             fontStyle:  'bold',
                                             fill:       color,
                                             fontFamily: textFont,
                                         })

            const coordinates = new Konva.Text({
                                                   x:          10,
                                                   y:          43,
                                                   text:       `${__.convert(poi.latitude).to(lgs.settings.coordinateSystem.current)}, ${__.convert(poi.longitude).to(lgs.settings.coordinateSystem.current)}`,
                                                   fontSize:   11,
                                                   fill:       color,
                                                   fontFamily: textFont,
                                               })


            const hUnits = ELEVATION_UNITS[lgs.settings.getUnitSystem.current]
            const theAltitude = __.convert(poi.height ?? 0).to(hUnits)

            const altitude = new Konva.Text({
                                                x:          10,
                                                y:          29,
                                                text:       poi.height ? sprintf('%d %s', theAltitude, hUnits) : '',
                                                fontSize:   11,
                                                fill:       color,
                                                fontFamily: textFont,
                                            })

            content.add(title)
            content.add(altitude)
            content.add(coordinates)
        }
        else {
        }

        // Add it to the stage an export result as HDPI image
        layer.add(content)
        stage.add(layer)
        const image = stage.toDataURL({pixelRatio: 2}) // HDPI
        stage.destroy()

        return image
    }

    openEditor = (poi) => {

    }
}