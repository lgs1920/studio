import { PIN_CIRCLE, POIUtils, POI_STD  } from '@Utils/cesium/POIUtils'

export class POI {


    /**
     * Get marker by ID
     *
     * @type {function(*): *}
     */
    static getMarkerById = (id => {
        return lgs.markers.filter(marker => marker.id === id)[0]
    })
    type
    coordinates
    backgroundColor
    foregroundColor
    text
    icon
    size
    marker
    drawn
    name
    border
    description
    image
    usage

    constructor(options) {
        this.type = options.type
        this.usage = options.usage ?? POI_STD,
        this.parent = options.parent
        this.slug = options.slug
        this.name = options.name
        this.coordinates = options.coordinates || {}
        this.altitude = options.altitude || false
        this.time = options.time || false
        this.backgroundColor = options.backgroundColor ?? lgs.POI_TRANSPARENT_COLOR
        this.foregroundColor = options.foregroundColor ?? lgs.POI_DEFAULT_COLOR
        this.border = options.border ?? 0
        this.text = options.text ?? undefined
        this.icon = this.defineIcon(options.icon ?? undefined)
        this.size = options.size ?? (this.type === PIN_CIRCLE ? lgs.POI_PIN_DEFAULT_SIZE : lgs.POI_DEFAULT_SIZE)
        this.description = options.description ?? undefined
        this.image = options.image ?? undefined
        this.visible = options.visible ?? true
        this.vertical = options.vertical ?? POI_VERTICAL_ALIGN_CENTER
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

    update = async (options) => {
        await POIUtils.update(this, options)
    }

    draw = async (parentVisibility = true) => {
        await POIUtils.draw(this, parentVisibility)
        this.drawn = true
    }
    remove = async () => {
        await POIUtils.remove(this)
    }

    moveTo = async (coordinates) => {
        await this.update({coordinates: coordinates, visibility: true})
    }

    toggleVisibility = async () => {
        await this.update({visibility: !this.visible})
    }

    hide = async () => {
        await this.update({visibility: false})
    }
    show = async () => {
        await this.update({visibility: true})
    }

}

export const POI_VERTICAL_ALIGN_TOP = 'top'
export const POI_VERTICAL_ALIGN_BOTTOM = 'bottom'
export const POI_VERTICAL_ALIGN_CENTER = 'center'
