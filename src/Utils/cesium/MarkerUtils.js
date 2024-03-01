import * as Cesium from 'cesium'

// Pin Marker Type
export const MARKER_ICON = 1
export const MARKER_TEXT = 2
export const MARKER_COLOR = 3
//Other paths
export const MARKER_CIRCLE = 4

export class MarkerUtils {
    static draw = (marker) => {

        let markerOptions = {
            name: marker.name,
            description: marker.description,
            position: Cesium.Cartesian3.fromDegrees(marker.coordinates[0], marker.coordinates[1], marker.coordinates[2]),
        }
        const pinBuilder = new Cesium.PinBuilder()
        if ([MARKER_COLOR, MARKER_COLOR, MARKER_TEXT].includes(marker.type)) {
            markerOptions.billboard = {
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            }
        } else {

        }

        const backgroundColor = Cesium.Color.fromCssColorString(marker.backgroundColor)
        const foregroundColor = marker.foregroundColor ? Cesium.Color.fromCssColorString(marker.foregroundColor) : undefined

        let entity

        switch (marker.type) {
            case MARKER_CIRCLE:
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
            case MARKER_COLOR:
                markerOptions.billboard.image = pinBuilder.fromColor(backgroundColor, marker.size).toDataURL()
                console.log(pinBuilder.fromColor(backgroundColor, marker.size).toDataURL())
                entity = vt3d.viewer.entities.add(markerOptions)
                break
            case MARKER_TEXT:
                markerOptions.billboard.image = pinBuilder.fromText(marker.text, backgroundColor, marker.size).toDataURL()
                entity = vt3d.viewer.entities.add(markerOptions)
                break
            case MARKER_ICON:
                //TODO
                markerOptions.billboard.image = pinBuilder.fromUrl(MarkerUtils.useFontAwesome(marker.icon), backgroundColor, marker.size)
                entity = vt3d.viewer.entities.add(markerOptions)
                break
        }

        return entity

    }
    static useFontAwesome = (iconDefinition) => {
        library.add(iconDefinition)
        return `data:image/svg+xml,${encodeURIComponent(icon(iconDefinition).html)}`
    }
}