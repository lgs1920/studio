import { MarkerUtils } from '../Utils/cesium/MarkerUtils'


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
        this.type = options.type
        this.name = options.name
        this.coordinates = options.coordinates || {}
        this.backgroundColor = options.backgroundColor
        this.foregroundColor = options.foregroundColor
        this.border = options.border ?? 0
        this.text = options.text ?? undefined
        this.icon = options.icon ?? undefined
        this.size = options.size ?? (this.type === MARKER_CIRCLE ? 10 : 48)
        this.description = options.description ?? undefined
        this.image = options.image ?? undefined

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
        this.marker = MarkerUtils.draw(this)
        this.id = this.marker.id

    }

}