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
            size: vt3d.configuration.profile.marker.size,
            name: 'profileMapMarker',
            slug: 'profile-map-marker',
            journey: APP_KEY,
            coordinates: [vt3d.configuration.center.longitude, vt3d.configuration.center.latitude],
            altitude: false,
            time: false,
            visible: true,
            vertical: POI_VERTICAL_ALIGN_CENTER,
            backgroundColor: 'transparent',
            foregroundColor: vt3d.configuration.profile.marker.color,
        }

        super(POIOptions)
    }

}