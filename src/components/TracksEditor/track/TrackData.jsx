/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TrackData.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-01
 * Last modified: 2026-04-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                                            from '@Components/DataDisplay/NameValueUnit'
import { ProfileChart }                                             from '@Components/Profile/ProfileChart'
import {
    faArrowDownRight, faArrowUpRight, faClockDesk, faDownToLine, faGaugeSimpleHigh, faPause, faPersonHiking, faRoute,
    faUpToLine,
}                                                                   from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlIcon }                                        from '@shoelace-style/shoelace/dist/react'
import { TrackUtils }                                               from '@Utils/cesium/TrackUtils'
import { FA2SL }                                                    from '@Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import { WaButton, WaDivider, WaIcon, WaSwitch, WaTooltip }         from '@web.awesome.me/webawesome-pro/dist/react'
import React, { memo, useEffect, useMemo }                          from 'react'
import { useSnapshot }                                              from 'valtio'
import { DateInfo }                                                 from '../DateInfo'

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
        <>
            <label>{'Main stats'}</label>
            <div className="journey-profile-chart-menu">
                <WaSwitch size="xsmall" label-at-start width-auto checked={true}
                          onChange={() => {
                          }}>
                    {'Add widget on scene'}
                </WaSwitch>

                <WaTooltip for="export-chart-button-in-settings">{'Export profile to image'}</WaTooltip>
                <WaButton appearance="plain"
                          variant="brand"
                          id="export-chart-button-in-settings"
                          onChange={() => {
                          }}>
                    <WaIcon variant="regular" name="file-arrow-down"/>
                </WaButton>
            </div>
            <WaDivider/>
            {hasDuration && <DateInfo date={trackDate}/>}

            <div className="element-row">
                <div className="element-item title">{'Distance'}</div>
                <div className="element-item">
                    <WaIcon variant="regular" name={'route'}/>
                    <NameValueUnit value={metrics.distance} units={DISTANCE_UNITS}/>
                </div>
            </div>
            {metrics.positive && (
                <div className="element-row">
                    <div className="element-item indented">
                        <WaIcon variant="regular" name={'arrow-up-right'}/>
                        <NameValueUnit value={metrics.positive.distance} units={DISTANCE_UNITS}/>
                    </div>
                    <div className="element-item">
                        <WaIcon variant="regular" name={'arrow-down-right'}/>
                        <NameValueUnit value={metrics.negative.distance} units={DISTANCE_UNITS}/>
                    </div>
                </div>
            )}

            {hasDuration && (
                <>
                    <div className="element-row">
                        <div className="element-item title">{'Duration'}</div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'clock-desk'}/>
                            <NameValueUnit value={__.convert(metrics.duration).toTime()} id="cursor-duration"/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <WaIcon variant="regular" name={'person-hiking'}/>
                            <NameValueUnit
                                value={__.convert(metrics.duration - metrics.idleTime).toTime()}
                                id="cursor-duration"
                            />
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'pause'}/>
                            <NameValueUnit value={__.convert(metrics.idleTime).toTime()} id="cursor-duration"/>
                        </div>
                    </div>
                </>
            )}

            {hasElevation && (
                <>
                    <WaDivider/>
                    <div className="element-row">
                        <div className="element-item title">{'Elevation'}</div>
                        {metrics.positive.elevation > 0 && (
                            <div className="element-item">
                                <WaIcon variant="regular" name={'arrow-up-right'}/>
                                <NameValueUnit value={metrics.positive.elevation} units={ELEVATION_UNITS}
                                               format="%d"/>
                            </div>
                        )}
                        {metrics.negative.elevation < 0 && (
                            <div className="element-item">
                                <WaIcon variant="regular" name={'arrow-down-right'}/>
                                <NameValueUnit value={metrics.negative.elevation} units={ELEVATION_UNITS}
                                               format="%d"/>
                            </div>
                        )}
                    </div>
                </>
            )}

            {hasAltitude && (
                <div className="element-row">
                    <div className="element-item title">{'Altitude'}</div>
                    <div className="element-item">
                        <WaIcon variant="regular" name={'arrow-down-to-line'}/>
                        <NameValueUnit value={metrics.minHeight} units={ELEVATION_UNITS} format="%d"/>
                    </div>
                    <div className="element-item">
                        <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                        <NameValueUnit value={metrics.maxHeight} units={ELEVATION_UNITS} format="%d"/>
                    </div>
                </div>
            )}

            {hasDuration && (
                <>
                    <WaDivider/>
                    <div className="element-row">
                        <div className="element-item title">{'Speed'}</div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'gauge-simple-high'}/>
                            <NameValueUnit value={metrics.averageSpeed} units={SPEED_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'person-hiking'}/>
                            <NameValueUnit value={metrics.averageSpeedMoving} units={SPEED_UNITS}/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <WaIcon variant="regular" name={'arrow-down-to-line'}/>
                            <NameValueUnit value={metrics.minSpeed} units={SPEED_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                            <NameValueUnit value={metrics.maxSpeed} units={SPEED_UNITS}/>
                        </div>
                    </div>
                    {!isNaN(metrics.minHeight) && (
                        <div className="element-row">
                            {metrics.positive.elevation > 0 && (
                                <div className="element-item indented">
                                    <WaIcon variant="regular" name={'arrow-up-right'}/>
                                    <NameValueUnit value={metrics.positive.speed} units={SPEED_UNITS}/>
                                </div>
                            )}
                            {metrics.negative.elevation < 0 && (
                                <div className="element-item">
                                    <WaIcon variant="regular" name={'arrow-down-right'}/>
                                    <NameValueUnit value={metrics.negative.speed} units={SPEED_UNITS}/>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {hasDuration && (
                <>
                    <WaDivider/>
                    <div className="element-row">
                        <div className="element-item title">{'Pace'}</div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'gauge-simple-high'}/>
                            <NameValueUnit value={metrics.averagePace} units={PACE_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'person-hiking'}/>
                            <NameValueUnit value={metrics.averageSpeedMoving} units={PACE_UNITS}/>
                        </div>
                    </div>
                    <div className="element-row">
                        <div className="element-item indented">
                            <WaIcon variant="regular" name={'arrow-down-to-line'}/>
                            <NameValueUnit value={metrics.maxPace} units={PACE_UNITS}/>
                        </div>
                        <div className="element-item">
                            <WaIcon variant="regular" name={'arrow-up-to-line'}/>
                            <NameValueUnit value={metrics.minPace} units={PACE_UNITS}/>
                        </div>
                    </div>
                    {!isNaN(metrics.minHeight) && (
                        <div className="element-row">
                            {metrics.positive.elevation > 0 && (
                                <div className="element-item indented">
                                    <WaIcon variant="regular" name={'arrow-up-right'}/>
                                    <NameValueUnit value={metrics.positive.pace} units={PACE_UNITS}/>
                                </div>
                            )}
                            {metrics.negative.elevation < 0 && (
                                <div className="element-item">
                                    <WaIcon variant="regular" name={'arrow-down-right'}/>
                                    <NameValueUnit value={metrics.negative.pace} units={PACE_UNITS}/>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </>
    )
})