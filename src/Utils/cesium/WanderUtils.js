/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-28
 * Last modified: 2026-02-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Track }    from '@Core/Track'
import { Wanderer } from '@Core/ui/Wanderer.js'

export const WANDER_MODE_MARKER = 'wander-mode'

export class WanderUtils {

    static initWanderMode = () => {
        __.ui.wanderer.update({
            coordinates:__.ui.wanderer.prepareData(),
                                  duration: parseInt(lgs.stores.main.components.wanderer.duration),
            events: new Map(
                [
                    // args[0] = index,
                    // args[1] = {longitude,latitude,height}

                     [Wanderer.START_TICK_EVENT, () => {

                     }],
                     [Wanderer.PAUSE_TICK_EVENT, (args) => {
                         const [serie, index] = args
                         __.ui.profiler.updateChartMarker(serie,index)

                     }],
                    [Wanderer.UPDATE_TICK_EVENT, async (args) => {
                       const [serie,index,point] =args
                        lgs.theTrack = Track.deserialize({object: Track.unproxify(Array.from(lgs.theJourney.tracks.values())[serie])}) // TODO Ameliorer
                       await  lgs.theTrack.marker.showOnTrack([point.longitude,point.latitude, point.height])
                       __.ui.profiler.updateChartMarker(serie,index)
                    }],
                    [Wanderer.STOP_TICK_EVENT, () => {
                       // Change UI
                        lgs.stores.main.components.wanderer.run = undefined
                    }],
                ]
            ),
        })
    }

}