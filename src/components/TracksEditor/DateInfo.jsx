/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DateInfo.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-15
 * Last modified: 2026-04-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faLocationPin }     from '@fortawesome/pro-solid-svg-icons'
import { SlDivider, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import { WaDivider, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { DateTime }          from 'luxon'

export const DateInfo = function DateInfo(props) {

    const $editor = lgs.theJourneyEditorProxy

    const data = props.date
    const date = {
        start: {
            date: DateTime.fromISO(data.start).toLocaleString(DateTime.DATE_FULL),
            time: DateTime.fromISO(data.start).toLocaleString(DateTime.TIME_SIMPLE),
        },
        stop: {
            date: DateTime.fromISO(data.stop).toLocaleString(DateTime.DATE_FULL),
            time: DateTime.fromISO(data.stop).toLocaleString(DateTime.TIME_SIMPLE),
        },
    }
    const sameDay = date.start.date === date.stop.date

    return (<>
        {__.ui.poiManager.list.get($editor.track.flags.start) && __.ui.poiManager.list.get($editor.track.flags.stop) &&
            <>
                {sameDay &&
                    <div className={'track-date'}>
                        <span>{date.start.date}</span>
                        <span>
                    <WaIcon name="location-pin"
                            variant="regular"
                            style={{
                                color: __.ui.poiManager.list.get($editor.track.flags.start).bgColor
                                           ?? lgs.settings.journey.pois.start.color,
                            }}/>
                            {date.start.time}
                </span>
                        <span>
                    <WaIcon name="location-pin"
                            variant="regular"
                            style={{
                                color: __.ui.poiManager.list.get($editor.track.flags.stop).bgColor
                                           ?? lgs.settings.journey.pois.stop.color,
                            }}/>
                            {date.stop.time}
                </span>
                    </div>

                }

                {!sameDay &&
                    <div className={'track-date'}>
                <span>
                <WaIcon name="location-pin"
                        variant="regular"
                        style={{
                            color: __.ui.poiManager.list.get($editor.track.flags.start).bgColor
                                       ?? lgs.settings.journey.pois.start,
                        }}/>
                    {date.start.date} {date.start.time}
                </span>
                        <span>
                <WaIcon name="location-pin"
                        variant="regular"
                        style={{
                            color: __.ui.poiManager.list.get($editor.track.flags.stop).bgColor
                                       ?? lgs.settings.journey.pois.stop,
                        }}/>
                            {date.stop.date} {date.stop.time}
                </span>
                    </div>
                }
                <WaDivider/>
            </>
        }
    </>)
}
