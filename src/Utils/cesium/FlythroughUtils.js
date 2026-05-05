/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughUtils.js
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
import { FlythroughRunner } from '@Core/ui/FlythroughRunner.js'

export const FLYTHROUGH_MODE_MARKER = 'flythrough-mode'

export class FlythroughUtils {

    static initFlythroughMode = () => {
        if (__.ui.flythrough?.start) {
            __.ui.flythrough.start()
            return
        }

        __.ui.flythroughRunner.update({
            coordinates:__.ui.flythroughRunner.prepareData(),
                                  duration: parseInt(lgs.stores.main.components.flythroughRunner.duration),
            events: new Map(
                [
                    // args[0] = index,
                    // args[1] = {longitude,latitude,height}

                     [FlythroughRunner.START_TICK_EVENT, () => {

                     }],
                     [FlythroughRunner.PAUSE_TICK_EVENT, (args) => {
                         const [serie, index] = args
                         __.ui.profiler.updateChartMarker(serie,index)

                     }],
                    [FlythroughRunner.UPDATE_TICK_EVENT, async (args) => {
                       const [serie,index,point] =args
                        lgs.theTrack = Track.deserialize({object: Track.unproxify(Array.from(lgs.theJourney.tracks.values())[serie])}) // TODO Ameliorer
                       await  lgs.theTrack.marker.showOnTrack([point.longitude,point.latitude, point.height])
                       __.ui.profiler.updateChartMarker(serie,index)
                    }],
                    [FlythroughRunner.STOP_TICK_EVENT, () => {
                       // Change UI
                        lgs.stores.main.components.flythroughRunner.run = undefined
                    }],
                ]
            ),
        })
    }

}
