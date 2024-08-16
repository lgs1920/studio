import { POI }        from '@Core/POI'
import { PIN_CIRCLE } from '../Utils/cesium/POIUtils'
import { POI_VERTICAL_ALIGN_CENTER } from './POI'

export class ProfileTrackMarker extends POI {

    constructor(options) {
        const track = options?.track ?? lgs.theTrack
        const POIOptions = {
            type:            PIN_CIRCLE,
            size:            options?.size ?? lgs.configuration.profile.marker.size,
            name:    `profileTrackMarker-${track.slug}`,
            slug:    `profile-map-marker-${track.slug}`,
            journey: track.parent,
            coordinates:     [lgs.configuration.starter.longitude, lgs.configuration.starter.latitude],
            altitude:        false,
            time:            false,
            visible:         true,
            vertical:        POI_VERTICAL_ALIGN_CENTER,
            border:          options?.border?.width ??  lgs.configuration.profile.marker.border.width,
            backgroundColor: options?.border?.color ?? lgs.configuration.profile.marker.border.color,
            foregroundColor: options?.color ?? lgs.configuration.profile.marker.color,
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