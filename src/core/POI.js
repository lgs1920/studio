import { PIN_CIRCLE, POIUtils } from '@Utils/cesium/POIUtils'

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
        this.backgroundColor = options.backgroundColor ?? vt3d.POI_TRANSPARENT_COLOR
        this.foregroundColor = options.foregroundColor ?? vt3d.POI_DEFAULT_COLOR
        this.border = options.border ?? 0
        this.text = options.text ?? undefined
        this.icon = this.defineIcon(options.icon ?? undefined)
        this.size = options.size ?? (this.type === PIN_CIRCLE ? 10 : 32)
        this.description = options.description ?? undefined
        this.image = options.image ?? undefined
        this.visible = options.visible ?? true
        this.vertical = options.vertical ?? POI_VERTICAL_ALIGN_CENTER
        this.track = options.track ?? undefined
        this.journey = options.journey ?? undefined
        this.drawn = false
    }

    static clone = (source, exceptions = {}) => {
        return new POI(POI.extractObject(source))
    }

    static extractObject = (source) => {
        return JSON.parse(JSON.stringify(source))
    }

    /**
     * Get the icon identifier and return the icon definition
     *
     * If the icon is not a string, we assume that it is the
     * icon definition already saved in DB
     *
     * @param icon
     * @return {*}
     */
    defineIcon = (icon) => {
        icon = icon ?? POIUtils.setIcon()
        if (typeof icon === 'string') {
            return POIUtils.setIcon(icon)
        }
        return icon
    }

    draw = async (parentVisibility = true) => {
        await POIUtils.draw(this, parentVisibility)
        this.drawn = true
    }
    remove = async () => {
        await POIUtils.remove(this)
    }

    moveTo = async (coordinates) => {
        await POIUtils.update(this, {coordinates: coordinates, visibility: true})
    }

    toggleVisibility = async () => {
        await POIUtils.update(this, {visibility: !this.visible})
    }

}

export const POI_VERTICAL_ALIGN_TOP = 'top'
export const POI_VERTICAL_ALIGN_BOTTOM = 'bottom'
export const POI_VERTICAL_ALIGN_CENTER = 'center'
