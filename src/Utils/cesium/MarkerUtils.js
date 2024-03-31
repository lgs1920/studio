import { icon, library } from '@fortawesome/fontawesome-svg-core'
import { Canvg }         from 'canvg'
import * as Cesium       from 'cesium'

// Pin Marker Type
export const PIN_ICON = 1
export const PIN_TEXT = 2
export const PIN_COLOR = 3
//Other paths
export const PIN_CIRCLE = 4
export const JUST_ICON = 5

export const MARKER_SIZE = 16

export const NO_MARKER_COLOR = 'transparent'

export class MarkerUtils {
    static draw = async (marker) => {
        const dataSource = vt3d.viewer.dataSources.getByName(marker.parent)[0]

        // If an entity with the same name already exists, bail early , we do not recreate it
        // dataSource.entities.values.forEach((item) => {
        //     console.log(`${item.id}/${marker.id}`)
        //     if (item.id === marker.id) {
        //         console.log('egal')
        //         return new Promise()
        //     }
        // })


        const properties = new Cesium.PropertyBag()
        properties.addProperty('slug', marker.id)
        let markerOptions = {
            name: marker.name,
            id: marker.id,
            description: marker.description,
            position: Cesium.Cartesian3.fromDegrees(marker.coordinates[0], marker.coordinates[1], marker.coordinates[2]),
            show: marker.visible,
            properties: properties,
            disableDepthTestDistance: new Cesium.ConstantProperty(0),
        }
        const pinBuilder = new Cesium.PinBuilder()

        markerOptions.billboard = {
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: new Cesium.ConstantProperty(0),//Number.POSITIVE_INFINITY,

        }

        const backgroundColor = Cesium.Color.fromCssColorString(marker.backgroundColor)
        const foregroundColor = marker.foregroundColor ? Cesium.Color.fromCssColorString(marker.foregroundColor) : undefined


        switch (marker.type) {
            case PIN_CIRCLE:
                return await dataSource.entities.add({
                    point: {
                        position: Cesium.Cartesian3.fromDegrees(marker.coordinates[0], marker.coordinates[1]),
                        backgroundPadding: Cesium.Cartesian2(8, 4),
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        color: marker.backgroundColor,
                        pixelSize: marker.size,
                        outlineColor: marker.foregroundColor,
                        outlineWidth: marker.border,
                    },
                })
            case PIN_COLOR:
                markerOptions.billboard.image = pinBuilder.fromColor(backgroundColor, marker.size).toDataURL()
                return await dataSource.entities.add(markerOptions)
            case PIN_TEXT:
                markerOptions.billboard.image = pinBuilder.fromText(marker.text, backgroundColor, marker.size).toDataURL()
                return await dataSource.entities.add(markerOptions)
            case PIN_ICON:
                pinBuilder.fromUrl(MarkerUtils.useFontAwesome(marker).src, backgroundColor, marker.size).then(async image => {
                    markerOptions.billboard.image = image
                    return await dataSource.entities.add(markerOptions)
                })
            case JUST_ICON:
                console.log(markerOptions)
                return MarkerUtils.useOnlyFontAwesome(marker).then(async canvas => {
                    markerOptions.billboard.image = canvas
                    return await dataSource.entities.add(markerOptions)
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
        if (marker.backgroundColor !== NO_MARKER_COLOR) {
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

    static useOnlyFontAwesome = async (marker) => {
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        const image = MarkerUtils.useFontAwesome(marker)
        const ratio = image.height / image.width
        canvas.width = marker.size * (ratio > 1 ? 1 : ratio)
        canvas.height = marker.size * (ratio > 1 ? ratio : 1)
        const v = Canvg.fromString(context, MarkerUtils.useFontAwesome(marker).html)
        v.start()
        return canvas
    }

}