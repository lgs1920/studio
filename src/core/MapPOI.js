/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-04
 * Last modified: 2025-05-04
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
     * @param {boolean} [dbSync=true] - Indicates whether to sync with database
     * @returns {Promise<Object>} A promise that resolves to the created entity
     */
    draw = async (dbSync = true) => {
        this.image = __.ui.poiManager.createContent(this)
        const entity = await this.utils.draw(this)

        if (dbSync) {
            await this.persistToDatabase()
        }

        // Configure handlers for this POI
        const handlers = {
            // Click handler
            onClick: (event, entity) => {
                console.log('POI clicked:', this.title)
            },

            // Right click handler
            onRightClick: (event, entity) => {
                console.log('Right-click on POI:', this.title)
            },

            // Double click handler
            onDoubleClick: (event, entity) => {
                console.log('Double-click on POI:', this.title)
            },

            // Tap handler (touch)
            onTap: (event, entity) => {
                console.log('Tap on POI:', this.title)
            },

            // Long tap handler (touch)
            onLongTap: (event, entity) => {
                console.log('Long tap on POI:', this.title)
            },

            // Double tap handler (touch)
            onDoubleTap: (event, entity) => {
                console.log('Double tap on POI:', this.title)
            },

            // Modifier key combinations
            onCtrlClick: (event, entity) => {
                console.log('Ctrl+Click on POI:', this.title)
            },

            // onShiftClick: (event, entity) => {
            //     console.log('Shift+Click on POI:', this.title)
            // },

            // onAltClick: (event, entity) => {
            //     console.log('Alt+Click on POI:', this.title)
            // },
        }

        // Use the setupEvents method to set up all the handlers
        this.setupEvents(entity, handlers)

        return entity
    }

    /**
     * Sets up event handlers for a specified entity by registering them
     * with the CanvasEventManager. This function ensures that only events
     * associated with the given entity are handled and supports standard
     * and modifier key combinations.
     *
     * @param {Object} entity - The entity to associate with events.
     * @param {Object} handlers - An object containing event handler functions.
     * @param {Function} [handlers.onClick] - Function to handle left-click events.
     * @param {Function} [handlers.onRightClick] - Function to handle right-click events.
     * @param {Function} [handlers.onDoubleClick] - Function to handle double-click events.
     * @param {Function} [handlers.onTap] - Function to handle tap events.
     * @param {Function} [handlers.onLongTap] - Function to handle long tap events.
     * @param {Function} [handlers.onCtrlClick] - Function to handle left-click events with the Ctrl key.
     * @param {Function} [handlers.onShiftClick] - Function to handle left-click events with the Shift key.
     * @param {Function} [handlers.onAltClick] - Function to handle left-click events with the Alt key.
     * @returns {Object} - The current instance.
     */
    setupEvents = (entity, handlers) => {
        // Clear any existing event subscriptions first
        this.clearEvents()

        if (!__.canvasEvents || !entity) {
            console.warn('Cannot set up events: missing CanvasEventManager or entity')
            return this
        }

        // Map the handler names to CanvasEventManager event types
        const eventMap = {
            onClick:       __.canvasEvents.events.LEFT_CLICK,
            onRightClick:  __.canvasEvents.events.RIGHT_CLICK,
            onDoubleClick: __.canvasEvents.events.LEFT_DOUBLE_CLICK,
            onTap:         __.canvasEvents.events.TAP,
            onDoubleTap:   __.canvasEvents.events.DOUBLE_TAP,
            onLongTap:     __.canvasEvents.events.LONG_TAP,
        }

        // Register standard event handlers
        for (const [handlerName, eventType] of Object.entries(eventMap)) {
            if (typeof handlers[handlerName] === 'function') {
                // Create a filter that ensures the event only fires for this entity
                const filter = {entity: entity}

                // Register the event with the CanvasEventManager
                const listenerId = __.canvasEvents.addEventListener(
                    eventType,
                    (event, pickedEntity) => {
                        if (pickedEntity && pickedEntity.id === entity.id) {
                            handlers[handlerName](event, entity)
                        }
                    },
                    this,
                    filter,
                )

                // Store the listener ID for cleanup
                this.eventSubscriptions[eventType] = listenerId
            }
        }

        // Handle modifier key combinations separately
        if (typeof handlers.onCtrlClick === 'function') {
            const listenerId = __.canvasEvents.addEventListener(
                `CTRL${__.canvasEvents.events.EVENT_SEPARATOR}${__.canvasEvents.events.LEFT_CLICK}`,
                (event, pickedEntity) => {
                    if (pickedEntity && pickedEntity.id === entity.id) {
                        handlers.onCtrlClick(event, entity)
                    }
                },
                this,
                {entity: entity},
            )
            this.eventSubscriptions['CTRL_LEFT_CLICK'] = listenerId
        }

        if (typeof handlers.onShiftClick === 'function') {
            const listenerId = __.canvasEvents.addEventListener(
                `SHIFT${__.canvasEvents.events.EVENT_SEPARATOR}${__.canvasEvents.events.LEFT_CLICK}`,
                (event, pickedEntity) => {
                    if (pickedEntity && pickedEntity.id === entity.id) {
                        handlers.onShiftClick(event, entity)
                    }
                },
                this,
                {entity: entity},
            )
            this.eventSubscriptions['SHIFT_LEFT_CLICK'] = listenerId
        }

        if (typeof handlers.onAltClick === 'function') {
            const listenerId = __.canvasEvents.addEventListener(
                `ALT${__.canvasEvents.events.EVENT_SEPARATOR}${__.canvasEvents.events.LEFT_CLICK}`,
                (event, pickedEntity) => {
                    if (pickedEntity && pickedEntity.id === entity.id) {
                        handlers.onAltClick(event, entity)
                    }
                },
                this,
                {entity: entity},
            )
            this.eventSubscriptions['ALT_LEFT_CLICK'] = listenerId
        }

        return this
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
     * Removes the POI
     *
     * @param {string} [id=this.id] - Identifier of the POI to remove
     *
     * @returns {Promise<void>}
     */
    remove = async (dbSync = true) => {
        try {
            this.clearEvents()
            this.utils.remove(this)

            if (dbSync) {
                await lgs.db.lgs1920.delete(this.id, POIS_STORE)
            }
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