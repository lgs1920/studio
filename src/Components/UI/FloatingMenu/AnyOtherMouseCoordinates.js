import * as Cesium       from 'cesium'
import { NOT_AN_ENTITY } from '../../../Utils/cesium/EntitiesUtils'
import { MouseUtils }    from '../../../Utils/cesium/MouseUtils'

export class AnyOtherMouseCoordinates {

    static show = (data) => {
        if (data.picked.type !== NOT_AN_ENTITY) {
            return
        }

        const menuStore = vt3d.mainProxy.components.floatingMenu
        const offset = 5 // pixels
        const position = data.positions.position ?? data.positions.position.endPosition
        const cartesian = vt3d.viewer.camera.pickEllipsoid(position, vt3d.viewer.scene.globe.ellipsoid)

        if (cartesian) {

            menuStore.show = true
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            menuStore.longitude = Cesium.Math.toDegrees(cartographic.longitude)
            menuStore.latitude = Cesium.Math.toDegrees(cartographic.latitude)

            let {x, y} = Cesium.SceneTransforms.wgs84ToWindowCoordinates(vt3d.viewer.scene, cartesian)

            MouseUtils.recalculateMenuPosition(x, y, offset)

        }
    }
}