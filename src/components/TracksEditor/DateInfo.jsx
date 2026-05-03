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
import { useEffect, useState } from 'react'
import { DateTimeDisplay }   from '@Components/DateTimeDisplay'

export const DateInfo = function DateInfo(props) {

    const $editor = lgs.theJourneyEditorProxy
    const track = props.track ?? $editor.track
    const trackSlug = track?.slug ?? null
    const [trackLocationState, setTrackLocationState] = useState({slug: null, value: ''})

    const data = props.date
    const hasDates = Boolean(data?.start && data?.stop)
    const trackLocation = trackLocationState.slug === trackSlug ? trackLocationState.value : ''
    const startPOI = __.ui.poiManager.list.get(track?.flags?.start)
    const stopPOI = __.ui.poiManager.list.get(track?.flags?.stop)
    const showDates = hasDates && startPOI && stopPOI
    const dateItems = showDates
                      ? [
            {
                value:   data.start,
                leading: <WaIcon name="location-pin"
                                 variant="regular"
                                 style={{
                                     color: startPOI.bgColor
                                            ?? lgs.settings.journey.pois.start.color,
                                 }}/>,
            },
            {
                value:   data.stop,
                leading: <WaIcon name="location-pin"
                                 variant="regular"
                                 style={{
                                     color: stopPOI.bgColor
                                            ?? lgs.settings.journey.pois.stop.color,
                                 }}/>,
            },
        ]
                      : []

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
                {showDates && <DateTimeDisplay className="track-date" items={dateItems} forceStack/>}
                <WaDivider/>
            </>
        }
    </>)
}
