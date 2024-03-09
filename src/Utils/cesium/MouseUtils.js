import * as Cesium from 'cesium'

export class MouseUtils {
    static showCoordinatesOnHover = () => {
        const entity = vt3d.viewer.entities.add({
            label: {
                show: false,
                showBackground: true,
                font: '12px monospace',
                horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(15, 0),
            },
        })

        // Mouse over the globe to see the cartographic position
        const handler = new Cesium.ScreenSpaceEventHandler(vt3d.viewer.scene.canvas)
        handler.setInputAction(function (movement) {
            const cartesian = vt3d.viewer.camera.pickEllipsoid(
                movement.endPosition,
                vt3d.viewer.scene.globe.ellipsoid,
            )
            if (cartesian) {
                const cartographic = Cesium.Cartographic.fromCartesian(
                    cartesian,
                )
                const longitudeString = Cesium.Math.toDegrees(
                    cartographic.longitude,
                ).toFixed(2)
                const latitudeString = Cesium.Math.toDegrees(
                    cartographic.latitude,
                ).toFixed(2)

                entity.position = cartesian
                entity.label.show = true
                entity.label.text =
                    `Lon: ${`   ${longitudeString}`.slice(-7)}\u00B0` +
                    `\nLat: ${`   ${latitudeString}`.slice(-7)}\u00B0`
            } else {
                entity.label.show = false
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    }

}