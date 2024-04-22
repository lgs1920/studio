import { icon, library } from '@fortawesome/fontawesome-svg-core'
import { faLocationDot } from '@fortawesome/pro-regular-svg-icons'
import { faLocationPin } from '@fortawesome/pro-solid-svg-icons'

import { Canvg }                          from 'canvg'
import * as Cesium                        from 'cesium'
import { FLAG_START, FLAG_STOP, POI_STD } from '../../classes/Journey'

// Pin Marker Type
export const PIN_ICON = 1
export const PIN_TEXT = 2
export const PIN_COLOR = 3
//Other paths
export const PIN_CIRCLE = 4
export const JUST_ICON = 5

export class MarkerUtils {
    static verticalOrigin = (origin => {
        const location = {
            top: Cesium.VerticalOrigin.TOP,
            bottom: Cesium.VerticalOrigin.BOTTOM,
            center: Cesium.VerticalOrigin.CENTER,
        }
        return location[origin]
    })

    static setIcon = (icon => {
        switch (icon) {
            case FLAG_START:
            case FLAG_STOP:
                return faLocationPin
                break
            default:
                return faLocationDot

        }
    })

    /**
     *
     * @param poi
     * @return {Promise<*>}
     */
    static draw = async (poi) => {

        let poiOptions = {
            name: poi.name,
            id: poi.slug,
            description: poi.description,
            position: Cesium.Cartesian3.fromDegrees(poi.coordinates[0], poi.coordinates[1], poi.coordinates[2]),
            show: poi.visible,
            disableDepthTestDistance: new Cesium.ConstantProperty(0),
        }
        const pinBuilder = new Cesium.PinBuilder()

        poiOptions.billboard = {
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: MarkerUtils.verticalOrigin(poi.vertical ?? 'center'),
            disableDepthTestDistance: new Cesium.ConstantProperty(0),//Number.POSITIVE_INFINITY,
        }

        const backgroundColor = Cesium.Color.fromCssColorString(poi.backgroundColor)
        const foregroundColor = poi.foregroundColor ? Cesium.Color.fromCssColorString(poi.foregroundColor) : undefined


        // Check data source
        let dataSource = vt3d.viewer.dataSources.getByName(poi.journey, true)[0]
        switch (poi.type) {
            case PIN_CIRCLE:
                // TODO manque des options id, name ....
                return await dataSource.entities.add({
                    point: {
                        position: Cesium.Cartesian3.fromDegrees(poi.coordinates[0], poi.coordinates[1]),
                        //backgroundPadding: Cesium.Cartesian2(8, 4),
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        color: poi.backgroundColor,
                        pixelSize: poi.size,
                        outlineColor: poi.foregroundColor,
                        outlineWidth: poi.border,
                    },
                })
            case PIN_COLOR:
                poiOptions.billboard.image = pinBuilder.fromColor(backgroundColor, poi.size).toDataURL()
                return await dataSource.entities.add(poiOptions)
            case PIN_TEXT:
                poiOptions.billboard.image = pinBuilder.fromText(poi.text, backgroundColor, poi.size).toDataURL()
                return await dataSource.entities.add(poiOptions)
            case PIN_ICON:
                pinBuilder.fromUrl(MarkerUtils.useFontAwesome(poi).src, backgroundColor, poi.size).then(async image => {
                    poiOptions.billboard.image = image
                    return await dataSource.entities.add(poiOptions)
                })
            case JUST_ICON:
                return MarkerUtils.useOnlyFontAwesome(poi).then(async canvas => {
                    poiOptions.billboard.image = canvas
                    return await dataSource.entities.add(poiOptions)
                })
        }

    }

    static useFontAwesome = (marker) => {
        library.add(marker.icon)

        const html = icon(marker.icon).html[0]

        // Get SVG
        const svg = (new DOMParser()).parseFromString(html, 'image/svg+xml').querySelector('svg')
        // add foreground
        svg.querySelector('path').setAttribute('fill', marker.foregroundColor)
        if (marker.backgroundColor !== vt3d.POI_TRANSPARENT_COLOR) {
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
        const image = MarkerUtils.useFontAwesome(poi)
        const ratio = image.height / image.width
        canvas.width = poi.size * (ratio > 1 ? 1 : ratio)
        canvas.height = poi.size * (ratio > 1 ? ratio : 1)
        const v = Canvg.fromString(context, MarkerUtils.useFontAwesome(poi).html)
        v.start()
        return canvas
    }

    static remove = async (poi) => {
        const dataSource = vt3d.viewer.dataSources.getByName(poi.slug.startsWith(POI_STD) ? poi.journey : poi.track)[0]
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
     * @param poi
     * @param visibility
     *
     * @returns {Boolean}
     *
     */
    static updatePOIVisibility = (poi, visibility) => {
        return visibility ? poi.visible : false
    }

}