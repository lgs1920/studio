import { Track }                                              from '../../classes/Track'
import { MARKER_TYPE, NOT_AN_ENTITY, OTHER_TYPE, TRACK_TYPE } from './EntitiesUtils'
import { TrackUtils }                                         from './TrackUtils'

export class MouseUtils {


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

    /**
     * Recalculate a new position and relocate to it if the menu is near the right or bottom and could not be
     * displayed.
     *
     * Then display it
     *
     * @param x   initial left value
     * @param y   initial top value
     * @param offset offset from the window limit
     *
     * @return {{x: number, y: number}} fixed coordinates
     *
     */
    static showMenu = (x, y) => {

        const menuStore = vt3d.mainProxy.components.floatingMenu
        const offset = Number(_utils.ui.css.getCSSVariable('menu-offset'))

        if (vt3d.floatingMenu.element !== undefined) {
            const width  = vt3d.floatingMenu.element.offsetWidth,
                  height = vt3d.floatingMenu.element.offsetHeight

            // When right side of the box goes too far...
            if ((x + width + offset) > document.documentElement.clientWidth) {
                x = document.documentElement.clientWidth - width - 2 * offset
            }
            // When bottom side of the box goes too far...
            if ((y + height + offset) > document.documentElement.clientHeight) {
                y = document.documentElement.clientHeight - height - 2 * offset
            }

            menuStore.coordinates.x = x + 'px'
            menuStore.coordinates.y = y + 'px'
            menuStore.show = true
            menuStore.key++
        }


    }
}
