import { POI }                       from '@Core/POI'
import { POI_VERTICAL_ALIGN_CENTER } from '../../core/POI'
import { APP_KEY }                   from '../../core/VT3D'
import { PIN_CIRCLE }                from '../../Utils/cesium/POIUtils'

export class ProfileMapMarker extends POI {
    constructor(options) {

        const POIOptions = {
            type: PIN_CIRCLE,
            name: 'profileMapMarker',
            slug: 'profile-map-marker',
            journey: APP_KEY,
            coordinates: [vt3d.configuration.center.latitude, vt3d.configuration.center.longitude],
            altitude: false,
            time: false,
            visible: false,
            vertical: POI_VERTICAL_ALIGN_CENTER,
        }

        super(POIOptions)
    }

}