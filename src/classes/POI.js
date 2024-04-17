import { MarkerUtils, NO_MARKER_COLOR, PIN_CIRCLE } from '../Utils/cesium/MarkerUtils'

export class POI {


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
        this.coordinates = options.coordinates || {}
        this.altitude = options.altitude || false
        this.time = options.time || false
        this.backgroundColor = options.backgroundColor ?? NO_MARKER_COLOR
        this.foregroundColor = options.foregroundColor ?? vt3d.configuration.poi.color
        this.border = options.border ?? 0
        this.text = options.text ?? undefined
        this.icon = this.defineIcon(options.icon ?? undefined)
        this.size = options.size ?? (this.type === PIN_CIRCLE ? 10 : 32)
        this.description = options.description ?? undefined
        this.image = options.image ?? undefined
        this.visible = options.visible ?? true
        this.vertical = options.vertical ?? POI_VERTICAL_ALIGN_CENTER
    }

    static clone = (source, exceptions = {}) => {
        return new POI(POI.extractObject(source))
    }

    static extractObject = (source) => {
        return JSON.parse(JSON.stringify(source))
    }

    defineIcon = (icon) => {
        return MarkerUtils.setIcon(icon)
    }

    draw = async (forcedToHide = false) => {
        await MarkerUtils.draw(this, forcedToHide)
    }
    remove = async () => {
        await MarkerUtils.remove(this)
    }

}

export const POI_VERTICAL_ALIGN_TOP = 'top'
export const POI_VERTICAL_ALIGN_BOTTOM = 'bottom'
export const POI_VERTICAL_ALIGN_CENTER = 'center'
