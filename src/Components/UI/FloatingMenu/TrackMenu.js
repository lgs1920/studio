import * as Cesium    from 'cesium'
import { TRACK_TYPE } from '../../../Utils/cesium/EntitiesUtils'
import { MouseUtils } from '../../../Utils/cesium/MouseUtils'

export class TrackMenu {
    static show = (data) => {

        const menuStore = vt3d.mainProxy.components.floatingMenu

        if (data.picked.type !== TRACK_TYPE) {
            return
        }

        // Save slugs in store
        menuStore.target = data.picked

        console.log(data.picked)

        const position = data.positions.position ?? data.positions.position.endPosition
        const cartesian = vt3d.viewer.camera.pickEllipsoid(position, vt3d.viewer.scene.globe.ellipsoid)

        if (cartesian) {
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            menuStore.longitude = Cesium.Math.toDegrees(cartographic.longitude)
            menuStore.latitude = Cesium.Math.toDegrees(cartographic.latitude)

            let {x, y} = Cesium.SceneTransforms.wgs84ToWindowCoordinates(vt3d.viewer.scene, cartesian)
            menuStore.coordinates.x = x
            menuStore.coordinates.y = y

            MouseUtils.showMenu(data.picked.type)
        }
    }

}