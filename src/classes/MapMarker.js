import { icon, library } from '@fortawesome/fontawesome-svg-core'
import * as Cesium       from 'cesium'


// Pin Marker Type
export const MARKER_ICON = 1
export const MARKER_TEXT = 2
export const MARKER_COLOR = 3
//Other paths
export const MARKER_CIRCLE = 4

export class MapMarker {


    static markers = new Map()
    /**
     * Get marker by ID
     *
     * @type {function(*): *}
     */
    static getMarkerById = (id => {
        return MapMarker.markers.filter(marker => marker.id === id)[0]
    })
    #type
    #coordinates
    #backgroundColor
    #foregroundColor
    #text
    #icon
    #size
    #marker
    #name
    #border
    #description
    #image

    constructor(options) {
        this.#type = options.type
        this.#name = options.name
        this.#coordinates = options.coordinates || {}
        this.#backgroundColor = options.backgroundColor
        this.#foregroundColor = options.foregroundColor
        this.#border = options.border ?? 0
        this.#text = options.text ?? undefined
        this.#icon = options.icon ?? undefined
        this.#size = options.size ?? (this.#type === MARKER_CIRCLE ? 10 : 48)
        this.#description = options.description ?? undefined
        this.#image = options.image ?? undefined

        this.register()
    }

    /**
     * Remove a marker
     *
     * @param markerOrId  MapMarker instance or only id
     *
     */
    static remover = (markerOrId) => {
        let id = (markerOrId instanceof MapMarker) ? markerOrId.id : markerOrId
        MapMarker.markers.delete(id)
    }

    /**
     * Add a marker to the registry
     *
     *
     */
    register = () => {
        MapMarker.markers.set(this.id, this)
    }

    draw = () => {

        let markerOptions = {
            name: this.#name,
            description: this.#description,
            position: Cesium.Cartesian3.fromDegrees(this.#coordinates[0], this.#coordinates[1], this.#coordinates[2]),
        }
        const pinBuilder = new Cesium.PinBuilder()
        if ([MARKER_COLOR, MARKER_COLOR, MARKER_TEXT].includes(this.#type)) {
            markerOptions.billboard = {
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            }
        } else {

        }

        const backgroundColor = Cesium.Color.fromCssColorString(this.#backgroundColor)
        const foregroundColor = this.#foregroundColor ? Cesium.Color.fromCssColorString(this.#foregroundColor) : undefined

        switch (this.#type) {
            case MARKER_CIRCLE:
                this.#marker = vt3d.viewer.entities.add({
                    point: {
                        position: Cesium.Cartesian3.fromDegrees(this.#coordinates[0], this.#coordinates[1]),
                        backgroundPadding: new Cesium.Cartesian2(8, 4),
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        color: this.#backgroundColor,
                        pixelSize: 50,//this.#size,
                        outlineColor: this.#foregroundColor,
                        outlineWidth: this.#border,
                    },
                })
                break
            case MARKER_COLOR:
                markerOptions.billboard.image = pinBuilder.fromColor(backgroundColor, this.#size).toDataURL()
                this.#marker = vt3d.viewer.entities.add(markerOptions)
                break
            case MARKER_TEXT:
                markerOptions.billboard.image = pinBuilder.fromText(this.#text, backgroundColor, this.#size).toDataURL()
                this.#marker = vt3d.viewer.entities.add(markerOptions)
                break
            case MARKER_ICON:

                markerOptions.billboard.image = pinBuilder.fromUrl(this.useFontAwesome(this.#icon), backgroundColor, this.#size)
                this.#marker = vt3d.viewer.entities.add(markerOptions)
                break
        }

        this.id = this.#marker.id

    }

    useFontAwesome = (iconDefinition) => {
        library.add(iconDefinition)
        return `data:image/svg+xml,${encodeURIComponent(icon(iconDefinition).html)}`
    }
}