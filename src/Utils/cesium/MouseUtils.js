import { Track }                                           from '../../classes/Track'
import { NOT_AN_ENTITY, OTHER_TYPE, POI_TYPE, TRACK_TYPE } from './EntitiesUtils'
import { TrackUtils }                                      from './TrackUtils'

export class MouseUtils {


    /**
     * Check if the user clicks on a marker or a track or elsewhere
     *
     * @param movement the movement data
     *
     * @returns {object}    {
     *     track : the track if  POI_TYPE | TRACK_TYPE
     *     marker : the marker  if  POI_TYPE
     *     entity  the entity if OTHER_TYPE
     *     type: POI_TYPE | TRACK_TYPE | OTHER_TYPE | NOT_AN_ENTITY
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
                    type: POI_TYPE,
                }
            } else {
                // Is it a track ? Let's search the parent DataSource then the entity slug
                const datasource = TrackUtils.getDataSourceNameByEntityId(entity.id)
                if (datasource) {
                    const track = vt3d.getJourneyBySlug(datasource.name)
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

    /**
     * Change settings to show menu
     *
     * @param type entity type
     *
     * @return {{x: number, y: number}} fixed coordinates
     *
     */
    static showMenu = (type) => {

        const menuStore = vt3d.mainProxy.components.floatingMenu
        menuStore.type = type
        menuStore.show = true
    }
}
