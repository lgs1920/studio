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
                        const track = Track.deserialize({object: Track.unproxify(lgs.theTrack)}) // TODO Check
                        await track.marker.showOnTrack([args[1].longitude, args[1].latitude, args[1].height])
                        lgs.theTrack.marker = track.marker
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