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

import { WaDivider, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { DateTime }          from 'luxon'
import { useEffect, useState } from 'react'

export const DateInfo = function DateInfo(props) {

    const $editor = lgs.theJourneyEditorProxy
    const track = props.track ?? $editor.track
    const trackSlug = track?.slug ?? null
    const [trackLocationState, setTrackLocationState] = useState({slug: null, value: ''})

    const data = props.date
    const hasDates = Boolean(data?.start && data?.stop)
    const date = {
        start: {
            date: hasDates ? DateTime.fromISO(data.start).toLocaleString(DateTime.DATE_FULL) : '',
            time: hasDates ? DateTime.fromISO(data.start).toLocaleString(DateTime.TIME_SIMPLE) : '',
        },
        stop: {
            date: hasDates ? DateTime.fromISO(data.stop).toLocaleString(DateTime.DATE_FULL) : '',
            time: hasDates ? DateTime.fromISO(data.stop).toLocaleString(DateTime.TIME_SIMPLE) : '',
        },
    }
    const sameDay = date.start.date === date.stop.date
    const trackLocation = trackLocationState.slug === trackSlug ? trackLocationState.value : ''
    const startPOI = __.ui.poiManager.list.get(track?.flags?.start)
    const stopPOI = __.ui.poiManager.list.get(track?.flags?.stop)
    const showDates = hasDates && startPOI && stopPOI

    useEffect(() => {
        let isMounted = true

        if (!trackSlug || !__.ui.geocoder?.getTrackLocation) {
            return () => {
                isMounted = false
            }
        }

        __.ui.geocoder.getTrackLocation(track)
            .then(location => {
                if (isMounted) {
                    setTrackLocationState({slug: trackSlug, value: location})
                }
            })
            .catch(error => {
                console.error(error)
                if (isMounted) {
                    setTrackLocationState({slug: trackSlug, value: ''})
                }
            })

        return () => {
            isMounted = false
        }
    }, [track, trackSlug])

    if (!trackLocation && !showDates) {
        return null
    }

    return (<>
        {(trackLocation || showDates) &&
            <>
                {trackLocation && (
                    <div className="track-location">
                        <WaIcon name="location-dot" variant="regular"/>
                        <span>{trackLocation}</span>
                    </div>
                )}
                {showDates && sameDay &&
                    <div className={'track-date'}>
                        <span>{date.start.date}</span>
                        <span>
                    <WaIcon name="location-pin"
                            variant="regular"
                            style={{
                                color: startPOI.bgColor
                                           ?? lgs.settings.journey.pois.start.color,
                            }}/>
                            {date.start.time}
                </span>
                        <span>
                    <WaIcon name="location-pin"
                            variant="regular"
                            style={{
                                color: stopPOI.bgColor
                                           ?? lgs.settings.journey.pois.stop.color,
                            }}/>
                            {date.stop.time}
                </span>
                    </div>

                }

                {showDates && !sameDay &&
                    <div className={'track-date'}>
                <span>
                <WaIcon name="location-pin"
                        variant="regular"
                        style={{
                            color: startPOI.bgColor
                                       ?? lgs.settings.journey.pois.start.color,
                        }}/>
                    {date.start.date} {date.start.time}
                </span>
                        <span>
                <WaIcon name="location-pin"
                        variant="regular"
                        style={{
                            color: stopPOI.bgColor
                                       ?? lgs.settings.journey.pois.stop.color,
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
