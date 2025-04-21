/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MapPOI.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-24
 * Last modified: 2025-02-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { CURRENT_POI, POI_CATEGORY_ICONS, POI_STANDARD_TYPE, POI_TMP_TYPE } from '@Core/constants'
import { MapElement }                                                       from '@Core/MapElement'
import { v4 as uuid }                                                       from 'uuid'

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
     * @type {boolean}
     */
    frontOfTerrain = true

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
     * @type {number}
     */
    over = false

    /**
     * @type {number}
     */
    scale = 1

    /**
     * @type {boolean}
     */
    showFlag = false

    /**
     * @type {string}
     */
    track

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
    tooFar = false

    /**
     * @type {string}
     */
    type = POI_TMP_TYPE

    /**
     * @type {string}
     */
    formerType

    /**
     * @type {boolean}
     */
    withinScreen = true

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

    /**
     *  Hide the POI
     */
    hide = () => {
        this.visible = false
    }

    /**
     * show the POI
     */
    show = () => {
        this.visible = true
    }

    /***********************************
     * Getters and Setters
     **********************************/

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

    get icon() {
        return Object.values(POI_CATEGORY_ICONS.get(this.category ?? POI_STANDARD_TYPE))[0]
    }

    draw = (visibility) => {
        __.ui.poiManager.createContent(this, visibility)
    }


}