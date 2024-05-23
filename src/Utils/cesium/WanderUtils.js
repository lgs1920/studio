import { faLocationDot }                   from '@fortawesome/pro-solid-svg-icons'
import { POI }                             from '../../core/POI'
import { ELEVATION_VS_DISTANCE }           from '../../core/ui/Profiler.js'
import { Wanderer }                        from '../../core/ui/Wanderer.js'
import { DISTANCE_UNITS, ELEVATION_UNITS } from '../UnitUtils.js'
import { NOT_AN_ENTITY }                   from './EntitiesUtils'
import { JUST_ICON }                       from './POIUtils'

export const WANDER_MODE_MARKER = 'wander-mode'

export class WanderUtils {

    static initWanderMode = () => {
        __.ui.wanderer.update({
            coordinates:__.ui.wanderer.prepareData(),
            duration:parseInt(lgs.mainProxy.components.wanderer.duration),
            events: new Map(
                [
                    // args[0] = index,
                    // args[1] = {longitude,latitude,height}

                    // [Wanderer.START_TICK_EVENT, () => {}],
                    // [Wanderer.PAUSE_TICK_EVENT, () => {}],
                    [Wanderer.UPDATE_TICK_EVENT, async (args) => {
                        await lgs.profileTrackMarker.showOnTrack([args[1].longitude, args[1].latitude, args[1].height])
                    }],
                    [Wanderer.STOP_TICK_EVENT, () => {
                       // Change UI
                        lgs.mainProxy.components.wanderer.run = undefined
                    }],
                ]
            ),
        })
    }

}