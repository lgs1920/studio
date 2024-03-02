import { icon, library } from '@fortawesome/fontawesome-svg-core'
import * as Cesium       from 'cesium'

// Pin Marker Type
export const PIN_ICON = 1
export const PIN_TEXT = 2
export const PIN_COLOR = 3
//Other paths
export const PIN_CIRCLE = 4
export const JUST_ICON = 5

export class MarkerUtils {
    static draw = async (marker) => {

        let markerOptions = {
            name: marker.name,
            description: marker.description,
            position: Cesium.Cartesian3.fromDegrees(marker.coordinates[0], marker.coordinates[1], marker.coordinates[2]),
        }
        const pinBuilder = new Cesium.PinBuilder()

        markerOptions.billboard = {
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        }

        const backgroundColor = Cesium.Color.fromCssColorString(marker.backgroundColor)
        const foregroundColor = marker.foregroundColor ? Cesium.Color.fromCssColorString(marker.foregroundColor) : undefined

        let entity

        switch (marker.type) {
            case PIN_CIRCLE:
                entity = vt3d.viewer.entities.add({
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
                break
            case PIN_COLOR:
                markerOptions.billboard.image = pinBuilder.fromColor(backgroundColor, marker.size).toDataURL()
                entity = await vt3d.viewer.entities.add(markerOptions)
                break
            case PIN_TEXT:
                markerOptions.billboard.image = pinBuilder.fromText(marker.text, backgroundColor, marker.size).toDataURL()
                entity = await vt3d.viewer.entities.add(markerOptions)
                break
            case PIN_ICON:
                pinBuilder.fromUrl(MarkerUtils.useFontAwesome(marker).src, backgroundColor, marker.size).then(async image => {
                    markerOptions.billboard.image = image
                    entity = await vt3d.viewer.entities.add(markerOptions)
                })
                break
            case JUST_ICON:
                MarkerUtils.useOnlyFontAwesome(marker).then(async canvas => {
                    markerOptions.billboard.image = canvas
                    entity = await vt3d.viewer.entities.add(markerOptions)
                })
                break
        }

        return entity
    }
    static useFontAwesome = (marker) => {
        library.add(marker.icon)
        const html = icon(marker.icon).html[0]
        // Get SVG
        const svg = (new DOMParser()).parseFromString(html, 'image/svg+xml').querySelector('svg')
        svg.querySelector('path').setAttribute('fill', 'yellow')
        return {
            src: `data:image/svg+xml,${encodeURIComponent(svg.outerHTML)}`,
            width: svg.viewBox.baseVal.width,
            height: svg.viewBox.baseVal.height,
        }
    }

    static useOnlyFontAwesome = async (marker) => {

        function loadElement(imageURL) {
            return new Promise((resolve) => {
                const image = new Image()
                image.addEventListener('load', () => {
                    resolve(image)
                })
                image.src = imageURL
            })
        }

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        const image = MarkerUtils.useFontAwesome(marker)
        const ratio = window.devicePixelRatio || 1
        // context.scale(ratio, ratio)
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        canvas.width = image.width * ratio * marker.size / image.height
        canvas.height = ratio * marker.size
        const v = await canvg.from(context)

        // 1. Multiply the canvas's width and height by the devicePixelRatio


        // 2. Force it to display at the original (logical) size with CSS or style attributes
        // canvas.style.width = marker.size + 'px'
        // canvas.style.height = marker.size + 'px'

        // 3. Scale the context so you can draw on it without considering the ratio.

        return loadElement(image.src)
            .then((image) => {
                var canvasW = canvas.width, canvasH = canvas.height
                var imgW = image.naturalWidth || canvasW, imgH = image.naturalHeight || canvasH

                console.log(imgW, imgH, canvasW, canvasH)
                context.drawImage(image, 0, 0, canvasW, imgH * canvasW / imgW)
                return canvas
            })


    }
}