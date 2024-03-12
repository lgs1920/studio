import * as Cesium                 from 'cesium'
import { SECOND }                  from '../../../Utils/AppUtils'
import { MARKER_TYPE, MouseUtils } from '../../../Utils/cesium/MouseUtils'

export class MarkerMenu {
    static show = (data) => {

        const menuStore = vt3d.mainProxy.components.floatingMenu


        if (data.picked.type !== MARKER_TYPE) {
            return
        }

        const offset = 5 // pixels
        /**
         * Manage a delay of 3 seconds, then hides the popup
         *
         * @type {number}
         */

        const position = data.positions.position ?? data.positions.position.endPosition
        const cartesian = vt3d.viewer.camera.pickEllipsoid(position, vt3d.viewer.scene.globe.ellipsoid)


        if (cartesian) {

            menuStore.show = true
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            menuStore.longitude = Cesium.Math.toDegrees(cartographic.longitude)
            menuStore.latitude = Cesium.Math.toDegrees(cartographic.latitude)

            let {x, y} = Cesium.SceneTransforms.wgs84ToWindowCoordinates(vt3d.viewer.scene, cartesian)

            // Recalculate position:

            if (MouseUtils.mouseCoordinatesInfo !== undefined) {
                const width  = MouseUtils.mouseCoordinatesInfo.offsetWidth,
                      height = MouseUtils.mouseCoordinatesInfo.offsetHeight

                // When right side of the box goes too far...
                if ((x + width) > document.documentElement.clientWidth + offset) {
                    x = document.documentElement.clientWidth - width - 2 * offset
                }
                // When bottom side of the box goes too far...
                if ((y + height) > document.documentElement.clientHeight + offset) {
                    y = document.documentElement.clientHeight - height - 2 * offset
                }

                MouseUtils.mouseCoordinatesInfo.style.top = `${y + offset}px`
                MouseUtils.mouseCoordinatesInfo.style.left = `${x + offset}px`


                MouseUtils.timer = setInterval(MouseUtils.autoRemoveCoordinatesContainer, SECOND)
            }


        }
    }

}