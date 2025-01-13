import { icon, library } from '@fortawesome/fontawesome-svg-core'
import { faLocationDot } from '@fortawesome/pro-regular-svg-icons'
import { faLocationPin } from '@fortawesome/pro-solid-svg-icons'

import { Canvg }                                                                        from 'canvg'
import { Cartesian3, Cartographic, Color, HeightReference, PinBuilder, VerticalOrigin } from 'cesium'

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
export const POI_PROFILER = 'profiler'


export class POIUtils {
    static verticalOrigin = () => {
        const location = {
            top: VerticalOrigin.TOP, bottom: VerticalOrigin.BOTTOM, center: VerticalOrigin.CENTER,
        }
        return location?.origin ?? VerticalOrigin.CENTER
    }

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
     * @type {DataSource}
     */
    static getDataSource = (poi => {
        return lgs.viewer.dataSources.getByName(poi.parent)[0]
    })

    static update = (poi, options) => {
        const dataSource = POIUtils.getDataSource(poi)
        if (dataSource?.entities) {
            const entity = dataSource.entities.getById(poi.slug)
            if (entity) {
                // Update positions
                entity.position = options?.coordinates ? Cartesian3.fromDegrees(options.coordinates[0], options.coordinates[1], options.coordinates[2]) : entity.position
                // Update visibility
                if (options?.visibility !== undefined) {
                    entity.show = options.visibility
                }
                if (options?.foregroundColor !== undefined) {
                    entity.color = Color.fromCssColorString(options.foregroundColor)
                }
                else {
                    entity.color = Color.fromCssColorString(lgs.theTrack.color)
                }
            }
        }

    }

    /**
     *
     * @param poi
     * @param parentVisibility
     * @return {Promise<*>}
     */
    static draw = async (poi, parentVisibility = true) => {

        // Bail early if POI already drawn
        if (poi.drawn) {
            return
        }

        // Else we'll draw it
        poi.drawn = true

        const disableTestDistance = __.ui.sceneManager.is2D ? 0 : 1.2742018E7 // Diameter of Earth

        let poiOptions = {
            name:        poi.name,
            id:          poi.slug,
            description: poi.description,
            position:                 Cartesian3.fromDegrees(poi.coordinates[0], poi.coordinates[1], poi.coordinates[2]),
            show:        POIUtils.setPOIVisibility(poi, parentVisibility),
            disableDepthTestDistance: disableTestDistance,

        }
        const pinBuilder = new PinBuilder()

        const billboard = {
            heightReference:          __.ui.sceneManager.noRelief() ? HeightReference.NONE : HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: POIUtils.verticalOrigin(poi.vertical),
            show:           true,
            disableDepthTestDistance: disableTestDistance,
        }
        const backgroundColor = poi.backgroundColor ? Color.fromCssColorString(poi.backgroundColor) : ''
        const foregroundColor = poi.foregroundColor ? Color.fromCssColorString(poi.foregroundColor) : ''

        const dataSource = POIUtils.getDataSource(poi)
        if (!dataSource) {
            return
        }
        await POIUtils.remove(poi)

        switch (poi.type) {
            case PIN_CIRCLE:
                return dataSource.entities.add({
                                                   ...poiOptions,
                                                   point: {
                                                       pixelSize:      poi.size,
                                                       color:          foregroundColor,
                                                       outlineColor:   backgroundColor,
                                                       outlineWidth:   poi.border,
                                                       verticalOrigin: POIUtils.verticalOrigin(poi.vertical),
                                                   },
                                               })
            case PIN_COLOR:
                billboard.image = pinBuilder.fromColor(backgroundColor, poi.size).toDataURL()
                poiOptions.billboard = {...billboard}
                return await dataSource.entities.add(poiOptions)
            case PIN_TEXT:
                billboard.image = pinBuilder.fromText(poi.text, backgroundColor, poi.size).toDataURL()
                poiOptions.billboard = {...billboard}
                return await dataSource.entities.add(poiOptions)
            case PIN_ICON:
                pinBuilder.fromUrl(POIUtils.useFontAwesome(poi).src, backgroundColor, poi.size).then(async image => {
                    billboard.image = image
                    poiOptions.billboard = {...billboard}
                    return await dataSource.entities.add(poiOptions)
                })
                break
            case JUST_ICON:
                billboard.image = POIUtils.useOnlyFontAwesome(poi)
                poiOptions.billboard = {...billboard}
                return await dataSource.entities.add(poiOptions)
                break
        }

    }

    static useOnlyFontAwesome = (poi) => {
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
            src:   `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`,
            html:  svg.outerHTML,
            width: svg.viewBox.baseVal.width,
            height: svg.viewBox.baseVal.height,
        }
    }

    static remove = async (poi) => {
        const dataSource = POIUtils.getDataSource(poi)
        if (dataSource?.entities) {
            for (const entity of dataSource.entities.values) {
                if (entity.id === poi.slug) {
                    await dataSource.entities.remove(entity)
                }
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

    /**
     *
     * @param point  {longitude,latitude,elevation}
     * @return {boolean}
     */
    static isPointVisible = (point) => {
        const globe = lgs.scene.globe
        const cartesian = Cartesian3.fromDegrees(point.longitude, point.latitude,
                                                 __.ui.sceneManager.noRelief() ? 0 : point.elevation)

        const screenPosition = lgs.scene.cartesianToCanvasCoordinates(cartesian)
        if (!screenPosition) {
            return false
        }
        const pickRay = lgs.camera.getPickRay(screenPosition)
        const pickedPosition = globe.pick(pickRay, lgs.scene)

        if (!pickedPosition) {
            return false
        }

        const pickedCartographic = Cartographic.fromCartesian(pickedPosition)
        return Math.abs((pickedCartographic.height - (point?.elevation ?? 0))) < 10.00
    }

}