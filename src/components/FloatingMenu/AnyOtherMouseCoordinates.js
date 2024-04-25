import { NOT_AN_ENTITY } from '@Utils/cesium/EntitiesUtils'
import { MouseUtils }    from '@Utils/cesium/MouseUtils'
import * as Cesium       from 'cesium'

export class AnyOtherMouseCoordinates {

    /** Tapstheclick then show the menu at this location
     *
     * @param data
     */
    static show = (data) => {
        if (data.picked.type !== NOT_AN_ENTITY) {
            return
        }

        const menuStore = vt3d.mainProxy.components.floatingMenu
        const position = data.positions.position ?? data.positions.position.endPosition
        const cartesian = vt3d.viewer.camera.pickEllipsoid(position, vt3d.viewer.scene.globe.ellipsoid)

        if (cartesian) {
            // Get Latitude and longitude and save them
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            menuStore.longitude = Cesium.Math.toDegrees(cartographic.longitude)
            menuStore.latitude = Cesium.Math.toDegrees(cartographic.latitude)

            // Then transform them to screen coordinate in order to show the menu
            let {x, y} = Cesium.SceneTransforms.wgs84ToWindowCoordinates(vt3d.viewer.scene, cartesian)
            menuStore.coordinates.x = x
            menuStore.coordinates.y = y

            MouseUtils.showMenu(data.picked.type)

        }
    }
}