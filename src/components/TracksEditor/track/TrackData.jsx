/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackData.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-14
 * Last modified: 2025-06-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { memo, useEffect, useMemo }  from 'react'
import { useSnapshot }               from 'valtio'
import { SlCard, SlDivider, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { NameValueUnit } from '@Components/DataDisplay/NameValueUnit'
import { DateInfo }                  from '../DateInfo'
import { TrackUtils }                from '@Utils/cesium/TrackUtils'
import { FA2SL }                     from '@Utils/FA2SL'
import {
    faRoute,
    faArrowUpRight,
    faArrowDownRight,
    faClockDesk,
    faPersonHiking,
    faPause,
    faUpToLine,
    faDownToLine,
    faGaugeSimpleHigh,
}                                    from '@fortawesome/pro-regular-svg-icons'
import {
    DISTANCE_UNITS,
    ELEVATION_UNITS,
    SPEED_UNITS,
    PACE_UNITS,
}                                    from '@Utils/UnitUtils'

// Static icon names to avoid recalculation
const ICON_ROUTE = FA2SL.set(faRoute)
const ICON_UP_RIGHT = FA2SL.set(faArrowUpRight)
const ICON_DOWN_RIGHT = FA2SL.set(faArrowDownRight)
const ICON_CLOCK = FA2SL.set(faClockDesk)
const ICON_HIKING = FA2SL.set(faPersonHiking)
const ICON_PAUSE = FA2SL.set(faPause)
const ICON_UP_TO_LINE = FA2SL.set(faUpToLine)
const ICON_DOWN_TO_LINE = FA2SL.set(faDownToLine)
const ICON_GAUGE = FA2SL.set(faGaugeSimpleHigh)

// Static divider style to avoid object recreation
const DIVIDER_STYLE = {'--width': '1px'}

/**
 * A memoized React component that displays metrics for a journey track.
 * @returns {JSX.Element|null} The rendered component or null if no metrics are available
 */
export const TrackData = memo(() => {
    // Targeted snapshot to minimize re-renders
    const {track} = useSnapshot(lgs.stores.journeyEditor)

    // Initialize track if undefined
    useEffect(() => {
        if (!track) {
            TrackUtils.setTheTrack(false)
        }
    }, [track])

    // Return null if no metrics are available
    const metrics = track?.metrics?.global
    if (!metrics) {
        return null
    }

    // Memoized track date calculation
    const trackDate = useMemo(() => {
        if (isNaN(metrics.duration)) {
            return {}
        }
        const points = track.metrics.points
        return {
            start: points[0]?.time,
            stop:  points[points.length - 1]?.time,
        }
    }, [metrics.duration, track.metrics.points])

    // Memoized flags for repeated conditions
    const hasDuration = !isNaN(metrics.duration)
    const hasElevation = metrics.negative?.elevation < 0 && metrics.positive?.elevation > 0
    const hasAltitude = !isNaN(metrics.minHeight) && !isNaN(metrics.maxHeight)

    return (
        <SlCard className="element-data">
            {hasDuration && <DateInfo date={trackDate}/>}

            <div className="element-row">
                <div className="element-item title">Distance</div>
                <div className="element-item">
                    <SlIcon variant="primary" library="fa" name={ICON_ROUTE}/>
                    <NameValueUnit value={metrics.distance} units={DISTANCE_UNITS}/>
                </div>
            </div>
            {metrics.positive && (
                <div className="element-row">
                    <div className="element-item indented">
                        <SlIcon variant="primary" library="fa" name={ICON_UP_RIGHT}/>
                        <NameValueUnit value={metrics.positive.distance} units={DISTANCE_UNITS}/>
                    </div>
                    <div className="element-item">
                        <SlIcon variant="primary" library="fa" name={ICON_DOWN_RIGHT}/>
                        <NameValueUnit value={metrics.negative.distance} units={DISTANCE_UNITS}/>
                    </div>
                </div>
            )}

            {hasDuration && (
                <>
                    <div className="element-row">
                        <div className="element-item title">Duration</div>
                        <div className="element-item">
                            <SlIcon variant="primary" library="fa" name={ICON_CLOCK}/>
                            <NameValueUnit value={__.convert(metrics.duration).toTime()} id="cursor-duration"/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <SlIcon variant="primary" library="fa" name={ICON_HIKING}/>
                            <NameValueUnit
                                value={__.convert(metrics.duration - metrics.idleTime).toTime()}
                                id="cursor-duration"
                            />
                        </div>
                        <div className="element-item">
                            <SlIcon variant="primary" library="fa" name={ICON_PAUSE}/>
                            <NameValueUnit value={__.convert(metrics.idleTime).toTime()} id="cursor-duration"/>
                        </div>
                    </div>
                </>
            )}

            {hasElevation && (
                <>
                    <SlDivider style={DIVIDER_STYLE}/>
                    <div className="element-row">
                        <div className="element-item title">{'Elevation'}</div>
                        {metrics.positive.elevation > 0 && (
                            <div className="element-item">
                                <SlIcon variant="primary" library="fa" name={ICON_UP_RIGHT}/>
                                <NameValueUnit value={metrics.positive.elevation} units={ELEVATION_UNITS} format="%d"/>
                            </div>
                        )}
                        {metrics.negative.elevation < 0 && (
                            <div className="element-item">
                                <SlIcon variant="primary" library="fa" name={ICON_DOWN_RIGHT}/>
                                <NameValueUnit value={metrics.negative.elevation} units={ELEVATION_UNITS} format="%d"/>
                            </div>
                        )}
                    </div>
                </>
            )}

            {hasAltitude && (
                <div className="element-row">
                    <div className="element-item title">Altitude</div>
                    <div className="element-item">
                        <SlIcon variant="primary" library="fa" name={ICON_DOWN_TO_LINE}/>
                        <NameValueUnit value={metrics.minHeight} units={ELEVATION_UNITS} format="%d"/>
                    </div>
                    <div className="element-item">
                        <SlIcon variant="primary" library="fa" name={ICON_UP_TO_LINE}/>
                        <NameValueUnit value={metrics.maxHeight} units={ELEVATION_UNITS} format="%d"/>
                    </div>
                </div>
            )}

            {hasDuration && (
                <>
                    <SlDivider style={DIVIDER_STYLE}/>
                    <div className="element-row">
                        <div className="element-item title">Speed</div>
                        <div className="element-item">
                            <SlIcon variant="primary" library="fa" name={ICON_GAUGE}/>
                            <NameValueUnit value={metrics.averageSpeed} units={SPEED_UNITS}/>
                        </div>
                        <div className="element-item">
                            <SlIcon variant="primary" library="fa" name={ICON_HIKING}/>
                            <NameValueUnit value={metrics.averageSpeedMoving} units={SPEED_UNITS}/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <SlIcon variant="primary" library="fa" name={ICON_DOWN_TO_LINE}/>
                            <NameValueUnit value={metrics.minSpeed} units={SPEED_UNITS}/>
                        </div>
                        <div className="element-item">
                            <SlIcon variant="primary" library="fa" name={ICON_UP_TO_LINE}/>
                            <NameValueUnit value={metrics.maxSpeed} units={SPEED_UNITS}/>
                        </div>
                    </div>
                    {!isNaN(metrics.minHeight) && (
                        <div className="element-row">
                            {metrics.positive.elevation > 0 && (
                                <div className="element-item indented">
                                    <SlIcon variant="primary" library="fa" name={ICON_UP_RIGHT}/>
                                    <NameValueUnit value={metrics.positive.speed} units={SPEED_UNITS}/>
                                </div>
                            )}
                            {metrics.negative.elevation < 0 && (
                                <div className="element-item">
                                    <SlIcon variant="primary" library="fa" name={ICON_DOWN_RIGHT}/>
                                    <NameValueUnit value={metrics.negative.speed} units={SPEED_UNITS}/>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {hasDuration && (
                <>
                    <SlDivider style={DIVIDER_STYLE}/>
                    <div className="element-row">
                        <div className="element-item title">Pace</div>
                        <div className="element-item">
                            <SlIcon variant="primary" library="fa" name={ICON_GAUGE}/>
                            <NameValueUnit value={metrics.averagePace} units={PACE_UNITS}/>
                        </div>
                        <div className="element-item">
                            <SlIcon variant="primary" library="fa" name={ICON_HIKING}/>
                            <NameValueUnit value={metrics.averageSpeedMoving} units={PACE_UNITS}/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <SlIcon variant="primary" library="fa" name={ICON_DOWN_TO_LINE}/>
                            <NameValueUnit value={metrics.minPace} units={PACE_UNITS}/>
                        </div>
                        <div className="element-item">
                            <SlIcon variant="primary" library="fa" name={ICON_UP_TO_LINE}/>
                            <NameValueUnit value={metrics.maxPace} units={PACE_UNITS}/>
                        </div>
                    </div>
                    {!isNaN(metrics.minHeight) && (
                        <div className="element-row">
                            {metrics.positive.elevation > 0 && (
                                <div className="element-item indented">
                                    <SlIcon variant="primary" library="fa" name={ICON_UP_RIGHT}/>
                                    <NameValueUnit value={metrics.positive.pace} units={PACE_UNITS}/>
                                </div>
                            )}
                            {metrics.negative.elevation < 0 && (
                                <div className="element-item">
                                    <SlIcon variant="primary" library="fa" name={ICON_DOWN_RIGHT}/>
                                    <NameValueUnit value={metrics.negative.pace} units={PACE_UNITS}/>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </SlCard>
    )
})