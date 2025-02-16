import { POI_TMP_TYPE } from '@Core/constants'
import { v4 as uuid }   from 'uuid'

export class MapPOI {
    /**
     * @type {Camera}
     */
    camera

    /**
     * @type {string}
     */
    color

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
    scale = 1

    /**
     * @type {boolean}
     */
    showFlag = undefined

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
    withinScreen = null

    /**
     * Initializes a new instance of the MapPOI class.
     * If there is no id provided, a unique id will be automatically generated.
     *
     * @param {Object} options - The options object containing initial properties.
     */
    constructor(options = null) {
        // If there is no id provided, we generate one
        options.id = options.id === null ? uuid() : options.id.toString()
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

}