import { icon, library } from '@fortawesome/fontawesome-svg-core'
import { faLocation }    from '@fortawesome/pro-regular-svg-icons'
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
    static draw = async (poi) => {

        // Check data source
        let dataSource = vt3d.viewer.dataSources.getByName(poi.parent)[0]
        // If undefined, it's for free POIs so we create a new one
        // using journey slug in order to group all of them
        if (dataSource === undefined) {
            dataSource = new Cesium.CustomDataSource(poi.parent)
            vt3d.viewer.dataSources.add(dataSource)
        }

        const properties = new Cesium.PropertyBag()
        properties.addProperty('slug', poi.id)
        let poiOptions = {
            name: poi.name,
            id: poi.id,
            description: poi.description,
            position: Cesium.Cartesian3.fromDegrees(poi.coordinates[0], poi.coordinates[1], poi.coordinates[2]),
            show: poi.visible,
            properties: properties,
            disableDepthTestDistance: new Cesium.ConstantProperty(0),
        }
        const pinBuilder = new Cesium.PinBuilder()

        poiOptions.billboard = {
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: new Cesium.ConstantProperty(0),//Number.POSITIVE_INFINITY,

        }

        const backgroundColor = Cesium.Color.fromCssColorString(poi.backgroundColor)
        const foregroundColor = poi.foregroundColor ? Cesium.Color.fromCssColorString(poi.foregroundColor) : undefined


        switch (poi.type) {
            case PIN_CIRCLE:
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
        // TODO library.add(marker.icon)
        library.add(faLocation)

        // TODO const html = icon(marker.icon).html[0]
        const html = icon(faLocation).html[0]

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

    static remove = async (marker) => {
        const dataSource = vt3d.viewer.dataSources.getByName(marker.parent)[0]
        dataSource.entities.values.forEach(entity => {
            if (entity.id === marker.id) {
                dataSource.entities.remove(entity)
            }
        })

    }

}