/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-02-28
 * Last modified: 2026-02-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Track }    from '@Core/Track'
import { JourneyReplayRunner } from '@Core/ui/JourneyReplayRunner.js'

export const REPLAY_MODE_MARKER = 'replay-mode'

export class JourneyReplayUtils {

    static initJourneyReplayMode = () => {
        if (__.ui.replay?.start) {
            __.ui.replay.start()
            return
        }

        __.ui.replayRunner.update({
            coordinates:__.ui.replayRunner.prepareData(),
                                  duration: parseInt(lgs.stores.main.components.replayRunner.duration),
            events: new Map(
                [
                    // args[0] = index,
                    // args[1] = {longitude,latitude,height}

                     [JourneyReplayRunner.START_TICK_EVENT, () => {

                     }],
                     [JourneyReplayRunner.PAUSE_TICK_EVENT, (args) => {
                         const [serie, index] = args
                         __.ui.profiler.updateChartMarker(serie,index)

                     }],
                    [JourneyReplayRunner.UPDATE_TICK_EVENT, async (args) => {
                       const [serie,index,point] =args
                        lgs.theTrack = Track.deserialize({object: Track.unproxify(Array.from(lgs.theJourney.tracks.values())[serie])}) // TODO Ameliorer
                       await  lgs.theTrack.marker.showOnTrack([point.longitude,point.latitude, point.height])
                       __.ui.profiler.updateChartMarker(serie,index)
                    }],
                    [JourneyReplayRunner.STOP_TICK_EVENT, () => {
                       // Change UI
                        lgs.stores.main.components.replayRunner.run = undefined
                    }],
                ]
            ),
        })
    }

}
