import { POI } from '@Core/POI'

import { faCircle }                  from '@fortawesome/pro-solid-svg-icons'
import { PIN_CIRCLE }                 from '../Utils/cesium/POIUtils'
import { POI_VERTICAL_ALIGN_CENTER } from './POI'
import { APP_KEY }                   from './LGS1920Context.js'

export class ProfileTrackMarker extends POI {

    constructor(options) {

        const POIOptions = {
            type:            PIN_CIRCLE,
            icon:            faCircle,
            size:            options?.size ?? lgs.configuration.profile.marker.size,
            name:            `profileTrackMarker-${lgs.theJourney.slug}`,
            slug:            'profile-map-marker-${lgs.theJourney.slug}',
            journey:         APP_KEY,
            coordinates:     [lgs.configuration.starter.longitude, lgs.configuration.starter.latitude],
            altitude:        false,
            time:            false,
            visible:         true,
            vertical:        POI_VERTICAL_ALIGN_CENTER,
            border:          options?.border?.width ??  lgs.configuration.profile.marker.border.width,
            backgroundColor: options?.border?.color ?? lgs.configuration.profile.marker.border.color,
            foregroundColor: options?.color ?? lgs.configuration.profile.marker.color,
            verticalOrigin:'center'
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