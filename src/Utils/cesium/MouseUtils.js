import * as Cesium    from 'cesium'
import { Track }      from '../../classes/Track'
import { SECOND }     from '../AppUtils'
import { TrackUtils } from './TrackUtils'

export class MouseUtils {


    static mouseCoordinatesInfo // Mouse Coordinates container
    static NORMAL_DELAY = 2 // seconds
    static remaining = MouseUtils.NORMAL_DELAY
    static timer = undefined
    static coordinatesStore

    /**
     * Global canvas mouse action manager
     *
     * @type {boolean}
     */
    static eventsManager = (movement) => {

        const event = window.event
        const mousePosition = movement.position ?? movement.endPosition
        MouseUtils.coordinatesStore = vt3d.mainProxy.components.mouseCoordinates

        const MARKER = 1, TRACK = 2, ELSE = 99

        let type = ELSE
        let track
        let marker
        let entity = undefined

        /**
         * First, check if it is a feature
         */
        if (Cesium.defined(vt3d.viewer.selectedEntity)) {
            // Stop event propagation to cesium. From now, we'll manage events on our side
            entity = vt3d.viewer.selectedEntity
            vt3d.viewer.selectedEntity = undefined
        }

        /**
         * We are on entity.
         *
         * Let's check the entity type ie MARKER or TRACK
         *
         */
        if (entity) {
            // Check if it is marker
            const info = Track.getMarkerInformation(entity.id)
            if (info && info.marker) {
                track = info.track
                marker = info.marker
                type = MARKER
            } else {
                // Should be a track
                // Let's search the par ent DataSource then ths entity slug
                const datasource = TrackUtils.getDataSourceNameByEntityId(entity.id)
                if (datasource) {
                    track = vt3d.getTrackBySlug(datasource.name)
                    if (track) {
                        type = TRACK
                    }
                }
            }
        }

        switch (type) {
            case MARKER:
                switch (event.button) {
                    case vt3d.eventHandler.buttons.LEFT: {
                        if (event.ctrlKey) {
                            console.log('marker ctrl left')
                        } else {
                            console.log('marker left')
                        }
                        break
                    }
                }
                break
            case TRACK:
                switch (event.button) {
                    case  vt3d.eventHandler.buttons.LEFT: {
                        console.log('track left')
                        break
                    }
                    case  vt3d.eventHandler.buttons.RIGHT: {
                        console.log('track right')
                        break
                    }
                }
                break
            default:
                if (event.ctrlKey) {
                    console.log('ctrl else')
                } else {
                    console.log('else')
                }
                MouseUtils.showCoordinates(movement)
                break
        }

    }

    static bindEvent = (eventType, element, key = '') => {
        vt3d.eventHandler.subscribe(eventType, new Cesium.ScreenSpaceEventHandler(element), key)
    }

    static autoRemoveCoordinatesContainer = () => {
        MouseUtils.remaining--
        if (MouseUtils.remaining < 0) {
            clearInterval(MouseUtils.timer)
            MouseUtils.remaining = MouseUtils.NORMAL_DELAY
            MouseUtils.coordinatesStore.show = false
            MouseUtils.mouseCoordinatesInfo.style.left = `-9999px`
        }
    }
    static showCoordinates = (movement) => {

        const offset = 5 // pixels
        /**
         * Manage a delay of 3 seconds, then hides the popup
         *
         * @type {number}
         */

        const position = movement.position ?? movement.endPosition
        const cartesian = vt3d.viewer.camera.pickEllipsoid(position, vt3d.viewer.scene.globe.ellipsoid)

        if (cartesian) {

            MouseUtils.coordinatesStore.show = true
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
            MouseUtils.coordinatesStore.longitude = Cesium.Math.toDegrees(cartographic.longitude)
            MouseUtils.coordinatesStore.latitude = Cesium.Math.toDegrees(cartographic.latitude)

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
