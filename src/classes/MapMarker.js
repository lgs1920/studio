import { MarkerUtils, NO_MARKER_COLOR, PIN_CIRCLE } from '../Utils/cesium/MarkerUtils'

export class MapMarker {


    /**
     * Get marker by ID
     *
     * @type {function(*): *}
     */
    static getMarkerById = (id => {
        return vt3d.markers.filter(marker => marker.id === id)[0]
    })
    type
    coordinates
    backgroundColor
    foregroundColor
    text
    icon
    size
    marker
    name
    border
    description
    image

    constructor(options) {
        this.type = options.type
        this.slug = options.slug
        this.name = options.name
        this.parent = options.parent
        this.id = options.id
        this.coordinates = options.coordinates || {}
        this.altitude = options.altitude || false
        this.time = options.time || false
        this.backgroundColor = options.backgroundColor ?? NO_MARKER_COLOR
        this.foregroundColor = options.foregroundColor ?? 'white'
        this.border = options.border ?? 0
        this.text = options.text ?? undefined
        this.icon = options.icon ?? undefined
        this.size = options.size ?? (this.type === PIN_CIRCLE ? 10 : 32)
        this.description = options.description ?? undefined
        this.image = options.image ?? undefined
        this.visible = options.visible ?? true

        this.register()
    }

    static clone = (source, exceptions = {}) => {
        return new MapMarker(MapMarker.extractObject(source))
    }

    static extractObject = (source) => {
        return JSON.parse(JSON.stringify(source))
    }

    /**
     * Add a marker to the registry
     *
     *
     */
    register = () => {
        vt3d.markers.set(this.id, this)
    }

    draw = async () => {
        await MarkerUtils.draw(this)
    }

}