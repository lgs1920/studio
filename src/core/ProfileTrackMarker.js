import { POI }                       from '@Core/POI'
import { faCircle }                  from '@fortawesome/pro-solid-svg-icons'
import { JUST_ICON, POI_MARKER }     from '../Utils/cesium/POIUtils'
import { POI_VERTICAL_ALIGN_CENTER } from './POI'

export class ProfileTrackMarker extends POI {

    constructor(options) {
        let track = options?.parent ?? lgs.theTrack
        track = (typeof track === 'string')?track:track.slug
        const POIOptions = {
            type:            JUST_ICON,
            usage: POI_MARKER,
            size:  options?.size ?? lgs.configuration.profile.marker.track.size,
            name:  options?.name ?? `${POI_MARKER}#${track}`,
            slug: options?.slug ?? `${POI_MARKER}#${track}`,
            icon:faCircle,
            parent : track,
            coordinates:     [lgs.configuration.starter.longitude, lgs.configuration.starter.latitude],
            altitude:        false,
            time:            false,
            visible:         true,
            vertical:        POI_VERTICAL_ALIGN_CENTER,
            border:          options?.border?.width ?? options?.foregroundColor?.border ?? lgs.configuration.profile.marker.track.border.width,
            backgroundColor: options?.border?.color ??  options?.backgroundColor ?? lgs.configuration.profile.marker.track.border.color,
            foregroundColor: options?.color ??  options?.foregroundColor  ?? lgs.configuration.profile.marker.track.color,
            drawn:options?.drawn??false
        }

        super(POIOptions)
    }

    showOnTrack = async (coordinates) => {
        if (!this.drawn) {
            await this.draw()
        }
            await this.move(coordinates)

        this.visible =true
    }

}