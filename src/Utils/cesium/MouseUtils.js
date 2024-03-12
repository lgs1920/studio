import { Track }      from '../../classes/Track'
import { TrackUtils } from './TrackUtils'

export const MARKER_TYPE = 1
export const TRACK_TYPE = 2
export const OTHER_TYPE = 3
export const NOT_AN_ENTITY = 0

export class MouseUtils {


    static mouseCoordinatesInfo // Mouse FloatingMenu container
    static NORMAL_DELAY = 2 // seconds
    static remaining = MouseUtils.NORMAL_DELAY
    static timer = undefined


    static autoRemoveCoordinatesContainer = () => {
        MouseUtils.remaining--
        if (MouseUtils.remaining < 0) {
            clearInterval(MouseUtils.timer)
            MouseUtils.remaining = MouseUtils.NORMAL_DELAY
            vt3d.mainProxy.components.floatingMenu.show = false
            MouseUtils.mouseCoordinatesInfo.style.left = `-9999px`
        }
    }


    /**
     * Check if the user clicks on a marker or a track or elsewhere
     *
     * @param movement the movement data
     *
     * @returns {object}    {
     *     track : the track if  MARKER_TYPE | TRACK_TYPE
     *     marker : the marker  if  MARKER_TYPE
     *     entity  the entity if OTHER_TYPE
     *     type: MARKER_TYPE | TRACK_TYPE | OTHER_TYPE | NOT_AN_ENTITY
     * }
     *
     */
    static getEntityType = (movement) => {

        const position = movement.position ?? movement.endPosition

        const pickedObject = vt3d.viewer.scene.pick(position)
        const entity = (pickedObject?.primitive) ? pickedObject.id : undefined


        if (entity) {

            // If it is an entity, we stop event propagation to cesium.
            // From now, we'll manage events on our side
            vt3d.viewer.selectedEntity = undefined

            // Check if it is marker
            const info = Track.getMarkerInformation(entity.id)
            if (info && info.marker) {
                return {
                    track: info.track,
                    marker: info.marker,
                    type: MARKER_TYPE,
                }
            } else {
                // Is it a track ? Let's search the parent DataSource then the entity slug
                const datasource = TrackUtils.getDataSourceNameByEntityId(entity.id)
                if (datasource) {
                    const track = vt3d.getTrackBySlug(datasource.name)
                    if (track) {
                        return {
                            track: track,
                            type: TRACK_TYPE,
                        }
                    } else {
                        return {
                            entity: entity,
                            type: OTHER_TYPE,
                        }
                    }
                }
            }
        }
        return {
            type: NOT_AN_ENTITY,
        }
    }
}
