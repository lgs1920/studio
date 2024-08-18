import { icon, library } from '@fortawesome/fontawesome-svg-core'
import { faLocationDot } from '@fortawesome/pro-regular-svg-icons'
import { faLocationPin } from '@fortawesome/pro-solid-svg-icons'

import { Canvg }                          from 'canvg'
import * as Cesium                        from 'cesium'
import { APP_KEY }                        from '../../core/LGS1920Context.js'

// Pin Marker Type
export const PIN_ICON = 1
export const PIN_TEXT = 2
export const PIN_COLOR = 3
//Other paths
export const PIN_CIRCLE = 4
export const JUST_ICON = 5

export const FLAG_START = 'start'
export const FLAG_STOP = 'stop'
export const POI_FLAG = 'flag'
export const POI_STD = 'poi'
export const POI_MARKER = 'marker'


export class POIUtils {
    static verticalOrigin = (origin => {
        const location = {
            top: Cesium.VerticalOrigin.TOP, bottom: Cesium.VerticalOrigin.BOTTOM, center: Cesium.VerticalOrigin.CENTER,
        }
        return location?.origin ??  Cesium.VerticalOrigin.CENTER
    })

    static setIcon = (icon = '') => {
        switch (icon) {
            case FLAG_START:
            case FLAG_STOP:
                return faLocationPin
            default:
                return faLocationDot

        }
    }

    /**
     *
     * @param poi
     * @return {Promise<*>}
     */
    static draw = async (poi, parentVisibility = true) => {

        // Bail early if POI already exists
        if (poi.drawn) {
            return
        }

        // Else we'll draw it
        poi.drawn = true

        let poiOptions = {
            name: poi.name,
            parent: poi.parent,
            id: poi.slug,
            description: poi.description,
            position: Cesium.Cartesian3.fromDegrees(poi.coordinates[0], poi.coordinates[1], 0),
            show: POIUtils.setPOIVisibility(poi, parentVisibility),
            backgroundColor : poi.backgroundColor?Cesium.Color.fromCssColorString(poi.backgroundColor):'',
            foregroundColor : poi.foregroundColor ? Cesium.Color.fromCssColorString(poi.foregroundColor) : '',
            disableDepthTestDistance: 1.2742018E7 // Diameter of Earth

        }
        const pinBuilder = new Cesium.PinBuilder()

        const billboard = {
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: POIUtils.verticalOrigin(poi.vertical),
            disableDepthTestDistance: 1.2742018E7 // Diameter of Earth
        }

        const backgroundColor = poi.backgroundColor?Cesium.Color.fromCssColorString(poi.backgroundColor):''
        const foregroundColor = poi.foregroundColor ? Cesium.Color.fromCssColorString(poi.foregroundColor) : ''

        const dataSource=POIUtils.getDataSource(poi)
        await POIUtils.remove(poi)

        switch (poi.type) {
            case PIN_CIRCLE:
                return await dataSource.entities.add({
                                                         ...poiOptions,
                                                         point: {
                                                             pixelSize:                poi.size,
                                                             color:                    foregroundColor,
                                                             outlineColor:             backgroundColor,
                                                             outlineWidth:             poi.border,
                                                             verticalOrigin:           POIUtils.verticalOrigin(poi.vertical),
                                                         }
                                                     })
            case PIN_COLOR:
                billboard.image = pinBuilder.fromColor(backgroundColor, poi.size).toDataURL()
                poiOptions.billboard={...billboard}
                return await dataSource.entities.add(poiOptions)
            case PIN_TEXT:
                billboard.image = pinBuilder.fromText(poi.text, backgroundColor, poi.size).toDataURL()
                poiOptions.billboard={...billboard}
                return await dataSource.entities.add(poiOptions)
            case PIN_ICON:
                pinBuilder.fromUrl(POIUtils.useFontAwesome(poi).src, backgroundColor, poi.size).then(async image => {
                    billboard.image = image
                    poiOptions.billboard={...billboard}
                    return await dataSource.entities.add(poiOptions)
                })
                break;
            case JUST_ICON:
                return POIUtils.useOnlyFontAwesome(poi).then(async canvas => {
                    billboard.image = canvas
                    poiOptions.billboard={...billboard}
                    return await dataSource.entities.add(poiOptions)
                })
        }

    }

    static update = (poi, options) => {
        const dataSource = POIUtils.getDataSource(poi)
        const entity = dataSource.entities.getById(poi.slug)
        if (entity) {
            // Update positions
            entity.position = options?.coordinates ? Cesium.Cartesian3.fromDegrees(options.coordinates[0], options.coordinates[1], options.coordinates[2]) : entity.position
            // Update visibility
            if (options?.visibility !== undefined) {
                entity.show = options.visibility
            }
            if (options?.foregroundColor !== undefined) {
                entity.color = Cesium.Color.fromCssColorString(options.foregroundColor)
            } else {
                entity.color = Cesium.Color.fromCssColorString(lgs.theTrack.color)
            }
        }

    }

    static useFontAwesome = (marker) => {
        library.add(marker.icon)

        const html = icon(marker.icon).html[0]

        // Get SVG
        const svg = (new DOMParser()).parseFromString(html, 'image/svg+xml').querySelector('svg')
        // add foreground
         svg.querySelector('path').setAttribute('fill', marker.foregroundColor)

        if (marker.backgroundColor !== lgs.POI_TRANSPARENT_COLOR) {
            // add background
            const rectangle = document.createElement('rect')
            rectangle.setAttribute('rx', 10)
            rectangle.setAttribute('ry', 10)
            rectangle.setAttribute('width', '120%')
            rectangle.setAttribute('height', '120%')
            rectangle.setAttribute('fill', marker.backgroundColor)
            svg.insertBefore(rectangle, svg.firstChild)
        }

        return {
            src: `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`,
            html: svg.outerHTML,
            width: svg.viewBox.baseVal.width,
            height: svg.viewBox.baseVal.height,
        }
    }

    static useOnlyFontAwesome = async (poi) => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        const image = POIUtils.useFontAwesome(poi)
        const ratio = image.height / image.width
        canvas.width = poi.size * (ratio > 1 ? 1 : ratio)
        canvas.height = poi.size * (ratio > 1 ? ratio : 1)
        const v = Canvg.fromString(context, POIUtils.useFontAwesome(poi).html)
        v.start()
        return canvas
    }

    /**
     *
     * @type {DataSource}
     */
    static getDataSource = (poi => {
        let target
                switch (poi.usage) {
                case POI_MARKER:
                case POI_FLAG:
                    target = poi.track
                    break
                    case POI_STD:
                default:
                    target = poi.journey
                }
       return lgs.viewer.dataSources.getByName(target)[0]
    })

    static remove = async (poi) => {
        const dataSource = POIUtils.getDataSource(poi)
        console.log(dataSource.name)
        for (const entity of dataSource.entities.values) {
            if (entity.id === poi.id) {
                await dataSource.entities.remove(entity)
            }
        }
    }

    /**
     * Manage POI visibility
     *
     * Whatever its visibility, we hide the POI, but we take into account th visibility status
     * when we show it (ie if it is marked a hidden, we do not show it)
     *
     * @param {POI} poi
     * @param {boolean} visibility
     *
     * @returns {boolean}
     *
     */
    static setPOIVisibility = (poi, visibility) => {
        return visibility ? poi?.visible : false
    }
}