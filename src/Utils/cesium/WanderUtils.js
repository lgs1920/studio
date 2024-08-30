import { DateTime } from 'luxon'
import { Track }    from '../../core/Track'
import { Wanderer } from '../../core/ui/Wanderer.js'

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

                     [Wanderer.START_TICK_EVENT, () => {}],
                    // [Wanderer.PAUSE_TICK_EVENT, () => {}],
                    [Wanderer.UPDATE_TICK_EVENT, async (args) => {
                       const [serie,index,point] =args
                        lgs.theTrack = Track.deserialize({object: Track.unproxify(Array.from(lgs.theJourney.tracks.values())[serie])}) // TODO Ameliorer
                       await  lgs.theTrack.marker.showOnTrack([point.longitude,point.latitude, point.height])
                       __.ui.profiler.updateChartMarker(serie,index)
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