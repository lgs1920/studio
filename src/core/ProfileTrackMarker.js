import { POI }                       from '@Core/POI'
import { faCircle }                  from '@fortawesome/pro-solid-svg-icons'
import { JUST_ICON, POI_MARKER }     from '../Utils/cesium/POIUtils'
import { POI_VERTICAL_ALIGN_CENTER } from './POI'

export class ProfileTrackMarker extends POI {

    constructor(options) {
        const track = options?.track ?? lgs.theTrack
        const POIOptions = {
            type:            JUST_ICON,
            usage: POI_MARKER,
            size:  options?.size ?? lgs.configuration.profile.marker.size,
            name:  `${POI_MARKER}#${track.slug}`,
            slug:  `${POI_MARKER}#${track.slug}`,
            icon:faCircle,
            journey: track.parent,
            track:track.slug,
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

    changeColor = async (color) => {
        console.log(this.clone())
    }

}