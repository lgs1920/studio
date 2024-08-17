import { icon, library } from '@fortawesome/fontawesome-svg-core'
import { faLocationDot } from '@fortawesome/pro-regular-svg-icons'
import { faLocationPin } from '@fortawesome/pro-solid-svg-icons'

import { Canvg }                          from 'canvg'
import * as Cesium                        from 'cesium'
import { FLAG_START, FLAG_STOP, POI_STD } from '../../core/Journey'
import { APP_KEY }                        from '../../core/LGS1920Context.js'

// Pin Marker Type
export const PIN_ICON = 1
export const PIN_TEXT = 2
export const PIN_COLOR = 3
//Other paths
export const PIN_CIRCLE = 4
export const JUST_ICON = 5

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
                break
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
            position: Cesium.Cartesian3.fromDegrees(poi.coordinates[0], poi.coordinates[1]),
            show: POIUtils.setPOIVisibility(poi, parentVisibility),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
           verticalOrigin: POIUtils.verticalOrigin(poi.vertical),

        }
        const pinBuilder = new Cesium.PinBuilder()

        const billboard = {
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: POIUtils.verticalOrigin(poi.vertical),
        }

        const backgroundColor = poi.backgroundColor?Cesium.Color.fromCssColorString(poi.backgroundColor):''
        const foregroundColor = poi.foregroundColor ? Cesium.Color.fromCssColorString(poi.foregroundColor) : ''

        // Check data source
        const dataSource = lgs.viewer.dataSources.getByName(poi.journey, true)[0]
        // We remove the existing if it exists
        dataSource.entities.removeById(poiOptions.id)

        switch (poi.type) {
            case PIN_CIRCLE:
                return await dataSource.entities.add({
                    ...poiOptions, point: {
                        pixelSize: poi.size,
                        color: foregroundColor,
                        outlineColor: backgroundColor,
                        outlineWidth: poi.border,
                        disableDepthTestDistance:0,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        verticalOrigin: POIUtils.verticalOrigin(poi.vertical),
                    },
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
            case JUST_ICON:

                return POIUtils.useOnlyFontAwesome(poi).then(async canvas => {
                    billboard.image = canvas
                    poiOptions.billboard={...billboard}
                    return await dataSource.entities.add(poiOptions)
                })
        }

    }

    static update = (poi, options) => {
        const dataSource = lgs.viewer.dataSources.getByName(poi.journey ?? APP_KEY, true)[0]
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

    static remove = async (poi) => {
        const dataSource = lgs.viewer.dataSources.getByName(poi.slug.startsWith(POI_STD) ? poi.journey : poi.track)[0]
        dataSource.entities.values.forEach(entity => {
            if (entity.id === poi.id) {
                dataSource.entities.remove(entity)
            }
        })

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
        return visibility ? poi.visible : false
    }
}