/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-22
 * Last modified: 2025-05-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { CURRENT_POI, POI_CATEGORY_ICONS, POI_STANDARD_TYPE, POI_TMP_TYPE, POIS_STORE } from '@Core/constants'
import { MapElement }                                                                   from '@Core/MapElement'
import { POIUtils }                                                                     from '@Utils/cesium/POIUtils'
import { v4 as uuid }                                                                   from 'uuid'

export class MapPOI extends MapElement {
    /**
     * @type {boolean}
     */
    animated = false
    /**
     * @type {string}
     */
    bgColor

    /**
     * @type {Camera}
     */
    camera

    /**
     * @type {string}
     */
    category

    /**
     * @type {string}
     */
    color

    /**
     * @type {string}
     */
    description

    /**
     * @type {number}
     */
    cameraDistance

    eventSubscriptions = {}


    /**
     * @type {boolean}
     */
    expanded = false

    /**
     * @type {number}
     */
    height

    /**
     * @type {string}
     */
    id

    /**
     * @type {number}
     */
    latitude

    /**
     * @type {number}
     */
    longitude

    /**
     * @type {string[null]}
     */
    parent = null

    /**
     * @type {boolean}
     */
    showFlag = false

    /** @type {POIUtils} **/
    utils = POIUtils

    /**
     * @type {boolean}
     */
    visible = true

    /**
     * @type {number}
     */
    simulatedHeight

    /**
     * @type {string}
     */
    title

    /**
     * @type {string}
     */
    type = POI_TMP_TYPE

    /**
     * @type {string}
     */
    formerType


    /**
     * Initializes a new instance of the MapPOI class.
     * If there is no id provided, a unique id will be automatically generated.
     *
     * @param {Object} options - The options object containing initial properties.
     */
    constructor(options = null) {
        super(CURRENT_POI)
        // If there is no id provided, we generate one
        options.id = options?.id ? options.id.toString() : uuid()
        options.slug = options.id
        this.update(options)
    }

    toggleExpand = async (event, poi) => {
        if (this.expanded) {
            await this.shrink()
        }
        else {
            await this.expand()
        }
    }



    /**
     * Gets the coordinates (longitude, latitude, height, simulatedHeight) of the POI.
     *
     * @returns {Object} An object containing the coordinates and height properties.
     */
    get coordinates() {
        return {
            longitude:       this.longitude,
            latitude:        this.latitude,
            height:          this.height,
            simulatedHeight: this.simulatedHeight,
        }
    }

    /**
     * Retrieves the icon associated with the current category or a standard type if no category is specified.
     *
     * @return {string} The icon corresponding to the category or the standard type.
     */
    get icon() {
        return Object.values(POI_CATEGORY_ICONS.get(this.category ?? POI_STANDARD_TYPE))[0]
    }

    set icon(icon) {
        // we need it to avoid an error but icon iset by POI category
    }

    static deserialize = (object, json = false) => MapElement.deserialize(object, json)

    static serialize = (props) => MapElement.serialize(props)

    static clone = (source) => new MapPOI(MapPOI.extractObject(source))

    static extractObject = (source) => {
        return JSON.parse(JSON.stringify(source))
    }
    // /**
    //  * Updates the properties of the MapPOI instance.
    //  *
    //  * @param {Object} options - The options object containing properties to update.
    //  */
    // updateCurrentPOI = (options) => {
    //     for (const key in options) {
    //         if (this.hasOwnProperty(key)) {
    //             this[key] = options[key]
    //         }
    //     }
    //     return this
    // }

    isView = (entity) => {
        return this.utils.isEntityInView() //TODO
    }

    /**
     * Updates the properties of the current MapPOI instance with the provided changes.
     *
     * Re draw the POI, with special handling for:
     * - when specific keys are modified
     * - Optional database synchronization
     * - Handling visibility state
     *
     * @param {Object} changes - An object containing key-value pairs of properties to update
     * @param {boolean} [dbSync=true] - Whether to synchronize changes with the database after updating
     *
     * @returns {Promise<MapPOI>} The updated MapPOI instance
     */
    redraw = (changes, dbSync = true) => {
        // Early return if no changes are provided
        if (!changes) {
            return this
        }

        // Define a set of keys that trigger a redraw when modified
        const keys = new Set(['bgcolor', 'category', 'color', 'showFlag', 'category', 'expanded', 'type'])
        // Additional keys to check when the item is expanded
        const keysWhenExpanded = new Set(['title', 'description', 'height'])

        let shouldRedraw = false

        // If the item is expanded, add expanded-specific keys to the redraw keys
        if (this.expanded) {
            for (const value of keysWhenExpanded) {
                keys.add(value)
            }
        }

        // Iterate through the changes to determine if a redraw is necessary
        for (const [key, value] of Object.entries(changes)) {
            // If the changed key is in our predefined set, mark for redraw
            if (keys.has(key)) {
                shouldRedraw = true
            }
            else {
                // Special handling for visibility changes
                if (key === 'visible') {
                    this.utils.toggleVisibility(this)
                }
            }
        }

        // If redraw is needed, call the draw method
        if (shouldRedraw) {
            this.draw(dbSync).then(async () => {
                                       // Optionally persist changes to database
                                       if (dbSync) {
                                           await this.persistToDatabase()
                                       }
                                   },
            )
        }



        // Return the current instance for method chaining
        return this
    }


    /**
     * Sets the coordinates and height properties of the POI.
     *
     * @param {Object}  - An object containing longitude, latitude, height, and simulatedHeight.
     */
    set coordinates({
                        longitude = this.longitude,
                        latitude = this.latitude,
                        height = this.height,
                        simulatedHeight = this.simulatedHeight,
                    }) {
        this.longitude = longitude
        this.latitude = latitude
        this.height = height
        this.simulatedHeight = simulatedHeight
    }


    /**
     * Updates this POI with new properties and persists to database
     * @private
     * @param {Object} updates - Properties to update
     * @returns {Promise<MapPOI>} Updated POI
     */
    #update = (updates) => {
        // Private method for internal updates
        // Appliquer les mises à jour à l'objet local
        Object.assign(this, updates)

        const $pois = lgs.stores.main.components.pois
        $pois.list.set(this.id, {...this})
        this.persistToDatabase()
        return this
    };

    update(updates) {
        const $pois = lgs.stores.main.components.pois
        // Update the instance in $pois.list (ProxyMap handles reactivity)
        const poiInList = $pois.list.get(this.id)
        if (poiInList) {
            Object.assign(poiInList, updates)
        }

        // Update this instance
        Object.assign(this, updates)
        // Persist to database
        this.persistToDatabase()
        return this
    }
    /**
     * Updates this POI's type
     * @param {string} [type] - New POI type (defaults to standard)
     * @returns {Promise<MapPOI>} Updated POI
     */
    saveAsPOI = async (type = POI_STANDARD_TYPE) => {
        return this.#update({type})
    }

    /**
     * Collapses this POI to show minimal information
     * @returns {Promise<MapPOI>} Updated POI
     */
    shrink = () => {
        return this.#update({expanded: false})
    }

    /**
     * Expands this POI to show full information
     * @returns {Promise<MapPOI>} Updated POI
     */
    expand = () => {
        return this.#update({expanded: true})
    }

    /**
     * Makes this POI invisible
     * @returns {Promise<MapPOI>} Updated POI
     */
    hide = () => {
        this.#update({visible: false})
        this.utils.toggleVisibility(this)
        return this

    }

    /**
     * Makes this POI visible
     * @returns {Promise<MapPOI>} Updated POI
     */
    show = async () => {
        this.#update({visible: true})
        this.utils.toggleVisibility(this)
        return this
    }

    /**
     * Activates animation for this POI
     * @returns {MapPOI} Updated POI
     */
    startAnimation = () => {
        // Implementation to start POI animation
        this.#update({animated: true})
        return this
    }

    /**
     * Deactivates animation for this POI
     * @returns {MapPOI} Updated POI
     */
    stopAnimation = () => {
        // Implementation to stop POI animation
        this.#update({animated: false})
        return this
    }
    /**
     * Renders and processes a visual representation of POI.
     *
     * @param {boolean} [dbSync=true] - Indicates whether to sync with database
     * @returns {Promise<Object>} A promise that resolves to the created entity
     */
    draw = async (dbSync = true) => {
        //this.image = __.ui.poiManager.createContent(this)
        const entity = await this.utils.draw(this)

        if (dbSync) {
            this.persistToDatabase()
        }
        return entity
    }

    /**
     * Saves the current Point of Interest (POI) object to the database.
     * The method ensures that the POI has a valid type before attempting to persist data.
     * If the type is invalid, the operation is aborted.
     *
     * This function serializes the POI data and stores it in a specified database store.
     *
     */
    persistToDatabase = () => {
        // Guard clause to ensure the POI has a valid type
        if (!this.type || this.type === POI_TMP_TYPE) {
            return
        }
        // Persist the serialized POI data into the database
        lgs.db.lgs1920.put(this.id, MapPOI.serialize({
                                                         ...this,
                                                         __class: MapPOI,
                                                     }), POIS_STORE).then()

    }


    /**
     * Removes the POI
     *
     *
     * @returns {Promise<void>}
     * @param dbSync
     */
    remove = (dbSync = true) => {
        try {
            this.clearEvents()
            this.utils.remove(this).then(async () => {
                if (dbSync) {
                    await lgs.db.lgs1920.delete(this.id, POIS_STORE)
                }
            })


        }
        catch (error) {
            console.error(`Failed to remove POI from database: ${error.message}`)
        }
    }

    /**
     * Sets up event handlers for this POI entity
     * @param {Object} entity - The Cesium entity to attach events to
     * @param {Object} handlers - Object containing event handler functions
     * @returns {MapPOI} - Returns this for method chaining
     */


    /**
     * Clears all event subscriptions for this POI
     * @returns {MapPOI} - Returns this instance for method chaining
     */
    clearEvents = () => {
        if (!__.canvasEvents) {
            console.warn('Cannot clear events: missing CanvasEventManager')
            return this
        }

        // Remove each registered event listener
        for (const [eventType, listenerId] of Object.entries(this.eventSubscriptions)) {
            if (listenerId) {
                __.canvasEvents.removeEventListener(eventType, listenerId)
            }
        }

        this.eventSubscriptions = {}
        return this
    }

}