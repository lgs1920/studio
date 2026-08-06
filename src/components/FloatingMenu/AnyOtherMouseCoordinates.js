/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AnyOtherMouseCoordinates.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-02-28
 * Last modified: 2026-02-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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

        const menuStore = lgs.stores.main.components.floatingMenu
        const position = data.positions.position ?? data.positions.position.endPosition
        const cartesian = lgs.viewer.camera.pickEllipsoid(position, lgs.viewer.scene.globe.ellipsoid)

        if (cartesian) {
            // Get Latitude and longitude and save them
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            menuStore.longitude = Cesium.Math.toDegrees(cartographic.longitude)
            menuStore.latitude = Cesium.Math.toDegrees(cartographic.latitude)

            // Then transform them to screen coordinate in order to show the menu
            let {x, y} = Cesium.SceneTransforms.wgs84ToWindowCoordinates(lgs.viewer.scene, cartesian)
            menuStore.coordinates.x = x
            menuStore.coordinates.y = y

            MouseUtils.showMenu(data.picked.type)

        }
    }
}