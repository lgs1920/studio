import { POI }                       from '@Core/POI'
import { faCircle }                  from '@fortawesome/pro-solid-svg-icons'
import { JUST_ICON, POI_MARKER }     from '../Utils/cesium/POIUtils'
import { POI_VERTICAL_ALIGN_CENTER } from './POI'
import { APP_KEY }                        from '@Core/LGS1920Context.js'

export class ProfileTrackMarker extends POI {

    constructor(options) {
        let track = options?.parent ?? lgs.theTrack
        track = (typeof track === 'string')?track:track.slug
        const POIOptions = {
            type:            JUST_ICON,
            usage: POI_MARKER,
            size:  options?.size ?? lgs.configuration.profile.marker.size,
            name:  options?.name ?? `${POI_MARKER}#${track}`,
            slug: options?.slug ?? `${POI_MARKER}#${track}`,
            icon:faCircle,
            parent : options?.parent,
            coordinates:     [lgs.configuration.starter.longitude, lgs.configuration.starter.latitude],
            altitude:        false,
            time:            false,
            visible:         true,
            vertical:        POI_VERTICAL_ALIGN_CENTER,
            border:          options?.border?.width ??  lgs.configuration.profile.marker.border.width,
            backgroundColor: options?.border?.color ?? lgs.configuration.profile.marker.border.color,
            foregroundColor: options?.color ?? lgs.configuration.profile.marker.color,
            drawn:false,
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
        this.visible =true
    }

    changeColor = async (color) => {
        console.log(this.clone())
    }

}