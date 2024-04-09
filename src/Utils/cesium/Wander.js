import { faLocationDot }          from '@fortawesome/pro-solid-svg-icons'
import { POI }                    from '../../classes/POI'
import { JUST_ICON, MARKER_SIZE } from './MarkerUtils'

export const WANDER_MODE_MARKER = 'wander-mode'

export class Wander {

    static drawPoint = (data => {

        const dataSource = vt3d.viewer.dataSources.getByName(data.picked.track.slug)
        let marker = vt3d.markers.get(WANDER_MODE_MARKER)

        //We force wander mode
        vt3d.wanderMode = true

        // If no wander marker exists, let's create it
        if (!vt3d.markers.has(WANDER_MODE_MARKER)) {
            marker = new POI({
                    name: WANDER_MODE_MARKER,
                    slug: _.app.slugify(WANDER_MODE_MARKER),
                    parent: data.picked.track.slug,
                    id: WANDER_MODE_MARKER,
                    coordinates: [data.picked.longitude, data.picked.latitude],
                    altitude: 0,
                    type: JUST_ICON,
                    size: MARKER_SIZE,
                    icon: faLocationDot,

                    backgroundColor: vt3d.configuration.track.markers.wanderer.color,
                    visible: vt3d.wanderMode,
                },
            )
        } else {
            // We update it
            marker.visible = vt3d.wanderMode
            marker.coordinates = [data.picked.longitude, data.picked.latitude]
        }

        marker.remove().then(() => {
            marker.draw()
        })
    })
}