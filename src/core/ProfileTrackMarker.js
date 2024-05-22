import { POI } from '@Core/POI'

import { faCircle }                  from '@fortawesome/pro-solid-svg-icons'
import { JUST_ICON }                 from '../Utils/cesium/POIUtils'
import { POI_VERTICAL_ALIGN_CENTER } from './POI'
import { APP_KEY }                   from './VT3D'

export class ProfileTrackMarker extends POI {
    prof

    constructor(options) {

        const POIOptions = {
            type: JUST_ICON,
            icon: faCircle,
            size: vt3d.configuration.profile.marker.size,
            name: 'profileTrackMarker',
            slug: 'profile-map-marker',
            journey: APP_KEY,
            coordinates: [vt3d.configuration.starter.longitude, vt3d.configuration.starter.latitude],
            altitude: false,
            time: false,
            visible: true,
            vertical: POI_VERTICAL_ALIGN_CENTER,
            backgroundColor: 'transparent',
            foregroundColor: options?.foregroundColor ?? vt3d.configuration.profile.marker.color,
        }

        super(POIOptions)
    }

    showOnTrack = async (coordinates) => {
        if (!this.drawn) {
            this.coordinates = coordinates
            await this.draw()
        } else {
            await this.moveTo(coordinates)
        }
    }

}