/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-04-28
 * Last modified: 2025-04-28
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

    /**
     * @type {boolean}
     */
    expanded = true

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

    static deserialize = (object, json = false) => MapElement.deserialize(object, json)

    static serialize = (props) => MapElement.serialize(props)

    static clone = (source) => new MapPOI(MapPOI.extractObject(source))

    static extractObject = (source) => {
        return JSON.parse(JSON.stringify(source))
    }
    /**
     * Updates the properties of the MapPOI instance.
     *
     * @param {Object} options - The options object containing properties to update.
     */
    update = (options) => {
        for (const key in options) {
            if (this.hasOwnProperty(key)) {
                this[key] = options[key]
            }
        }
        return this
    }

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
    redraw = async (changes, dbSync = true) => {
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
            await this.draw(dbSync)
        }

        // Optionally persist changes to database
        if (dbSync) {
            await this.persistToDatabase()
        }

        // Return the current instance for method chaining
        return this
    }

    /**
     *  Hide the POI
     */
    hide = () => {
        this.visible = false
        let b = this.utils.toggleVisibility(this)
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
     * show the POI
     */
    show = () => {
        this.visible = true
        this.utils.toggleVisibility(this)
    }

    /**
     * Renders and processes a visual representation of POI.
     *
     * This function creates an image representation, performs drawing operations,
     * and can optionally synchronize the resultant data with the database.
     *
     * @param {boolean} [dbSync=true] - Indicates whether the rendered result should be synchronized with the database.
     * @returns {Promise<void>} A promise that resolves when the rendering and optional database synchronization are
     *     complete.
     */
    draw = async (dbSync = true) => {
        this.image = __.ui.poiManager.createContent(this)
        await this.utils.draw(this)
        if (dbSync) {
            await this.persistToDatabase()
        }
    }

    /**
     * Saves the current Point of Interest (POI) object to the database.
     * The method ensures that the POI has a valid type before attempting to persist data.
     * If the type is invalid, the operation is aborted.
     *
     * This function serializes the POI data and stores it in a specified database store.
     *
     */
    persistToDatabase = async () => {

        // Guard clause to ensure the POI has a valid type
        if (!this.type || this.type === POI_TMP_TYPE) {
            return
        }

        // Persist the serialized POI data into the database
        await lgs.db.lgs1920.put(this.id, MapPOI.serialize({
                                                               ...this,
                                                               __class: MapPOI,
                                                           }), POIS_STORE)
    }


    /**
     * Removes an entry from the database
     *
     * @param {string} [id=this.id] - Identifier of the POI to remove
     *
     * @returns {Promise<void>}
     */
    removeFromDB = async (id = this.id) => {
        try {
            if (!id) {
                console.warn('Cannot remove POI: No ID provided')
                return
            }
            await lgs.db.lgs1920.delete(id, POIS_STORE)
        }
        catch (error) {
            console.error(`Failed to remove POI from database: ${error.message}`)
        }
    }


}