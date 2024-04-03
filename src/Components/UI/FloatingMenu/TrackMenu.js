import { point }                         from '@turf/helpers'
import { default as nearestPointOnLine } from '@turf/nearest-point-on-line'

import * as Cesium               from 'cesium'
import { default as lineString } from 'turf-linestring'
import { TRACK_TYPE }            from '../../../Utils/cesium/EntitiesUtils'
import { MouseUtils }            from '../../../Utils/cesium/MouseUtils'

export class TrackMenu {
    static show = (data) => {
        if (data.picked.type !== TRACK_TYPE) {
            return
        }


        const menuStore = vt3d.mainProxy.components.floatingMenu

        // Save track in store
        menuStore.target = data.picked

        // Get coordinates of clicked point
        const position = data.positions.position ?? data.positions.position.endPosition
        const cartesian = vt3d.viewer.camera.pickEllipsoid(position, vt3d.viewer.scene.globe.ellipsoid)

        if (cartesian) {
            // Find the nearest point on the track

            // Cesum isbugged.... so the result is wrong
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            const clickedPoint = point([Cesium.Math.toDegrees(cartographic.longitude), Cesium.Math.toDegrees(cartographic.latitude)])
            const nearest = nearestPointOnLine(lineString(data.picked.track.geoJson.features[0].geometry.coordinates), clickedPoint)
            // We need coordinates
            menuStore.longitude = nearest.geometry.coordinates[0]
            menuStore.latitude = nearest.geometry.coordinates[1]
            // But also the window coordinates and point inex
            const {
                      x,
                      y,
                  } = Cesium.SceneTransforms.wgs84ToWindowCoordinates(vt3d.viewer.scene, Cesium.Cartesian3.fromDegrees(menuStore.longitude, menuStore.latitude))

            menuStore.coordinates.x = x
            menuStore.coordinates.y = y
            menuStore.index = nearest.properties.index

            // let's show the menu
            MouseUtils.showMenu(data.picked.type)

            // we show clicked point on the track
            data.picked.longitude = menuStore.longitude
            data.picked.latitude = menuStore.latitude
            data.picked.index = nearest.properties.index
            vt3d.events.emit('wander/drawPoint', data)

        }
    }

}