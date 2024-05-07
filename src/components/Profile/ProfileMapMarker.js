import { POI } from '@Core/POI'

import { faCircleDot }               from '@fortawesome/pro-regular-svg-icons'
import { POI_VERTICAL_ALIGN_CENTER } from '../../core/POI'
import { APP_KEY }                   from '../../core/VT3D'
import { JUST_ICON }                 from '../../Utils/cesium/POIUtils'

export class ProfileMapMarker extends POI {
    prof

    constructor(options) {

        const POIOptions = {
            type: JUST_ICON,
            icon: faCircleDot,
            name: 'profileMapMarker',
            slug: 'profile-map-marker',
            journey: APP_KEY,
            coordinates: [vt3d.configuration.center.longitude, vt3d.configuration.center.latitude],
            altitude: false,
            time: false,
            visible: true,
            vertical: POI_VERTICAL_ALIGN_CENTER,
            border: 3,
            backgroundColor: 'transparent',//vt3d.configuration.journey.pois.border,
            foregroundColor: vt3d.theTrack?.color ?? vt3d.configuration.journey.pois.color,
        }

        super(POIOptions)
    }

}