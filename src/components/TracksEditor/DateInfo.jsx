/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DateInfo.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
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
    const showDates = hasDates
    const dateItems = showDates
                      ? [
            {
                value: data.start,
            },
            {
                value: data.stop,
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
                {showDates && (
                    <div className="track-date">
                        <DateTimeDisplay
                            items={dateItems}
                            stackItems
                            leading={<WaIcon name="clock" variant="regular"/>}
                        />
                    </div>
                )}
                <WaDivider/>
            </>
        }
    </>)
}
