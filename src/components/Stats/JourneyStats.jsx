/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStats.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-03
 * Last modified: 2026-02-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit } from '@Components/DataDisplay/NameValueUnit'
import {
    faArrowDownToLine, faArrowUpToLine,
}                        from '@fortawesome/pro-regular-svg-icons'
import {
    SlDivider, SlIcon,
}                        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }         from '@Utils/FA2SL'
import {
    DISTANCE_UNITS,
    ELEVATION_UNITS,
    PACE_UNITS,
    SPEED_UNITS,
}                        from '@Utils/UnitUtils'
import React, { memo }   from 'react'

/**
 * Custom duration formatter for Days, Hours, Minutes.
 */
const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '--:--'
    }
    const totalMinutes = Math.floor(seconds / 60)
    const days = Math.floor(totalMinutes / (24 * 60))
    const hours = Math.floor((totalMinutes - (days * 24 * 60)) / 60)
    const mins = totalMinutes % 60
    const hh = String(hours).padStart(2, '0')
    const mm = String(mins).padStart(2, '0')
    return days > 0 ? `${days}d ${hh}:${mm}` : `${hh}:${mm}`
}

/**
 * Internal component to handle the statistical display logic.
 * Isolated to prevent parent Widget re-mounts on data updates.
 */
export const JourneyStats = memo(({metrics, dateLines, units}) => {
    const hasElevation = metrics?.negative?.elevation < 0 && metrics?.positive?.elevation > 0
    const hasDuration = metrics?.duration

    return (
        <div className="track-data-widget">
            {hasDuration && (
                <>
                    <div className="track-data-date">
                        <span>{dateLines[0]}</span><span>{dateLines[1]}</span>
                    </div>
                    <SlDivider/>
                </>
            )}
            <div className="track-data-row">
                <div className="track-data-summary-item track-summary-column">
                    <div className="track-data-val-huge">
                        <NameValueUnit value={metrics.distance} units={DISTANCE_UNITS} noUnit/>
                    </div>
                    <div className="track-data-label-bold">{`Distance (${units.distance})`}</div>
                </div>
                <div className="track-data-summary-item track-summary-column">
                    {hasElevation &&
                        <div className="track-data-val-huge">
                            <NameValueUnit value={metrics.positive.elevation} units={ELEVATION_UNITS} noUnit
                                           precision="0"/>
                        </div>
                    }
                    <div className="track-data-label-bold">{`Elevation (${units.elevation})`}</div>
                </div>
                <div className="track-data-summary-item track-summary-column">
                    {hasDuration &&
                        <div className="track-data-val-huge">
                            {formatDuration(metrics.duration)}
                        </div>
                    }
                    <div className="track-data-label-bold">{'DURATION'}</div>
                </div>
            </div>

            {hasElevation && (
                <>
                    <SlDivider/>
                    <div className="track-data-row">
                        <div className="track-data-label">{'Altitude'}<span>{`(${units.elevation})`}</span></div>
                        <div className="track-data-value">
                            <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowDownToLine)}/>
                            <NameValueUnit value={metrics.minHeight} units={ELEVATION_UNITS} noUnit precision="0"/>
                        </div>
                        <div className="track-data-value">
                            <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                            <NameValueUnit value={metrics.maxHeight} units={ELEVATION_UNITS} noUnit precision="0"/>
                        </div>
                    </div>
                </>
            )}
            {hasElevation && hasDuration && (
                <>
                    <SlDivider/>
                    <div className="track-data-row">
                        <div className="track-data-label">{'Speed'}<span>{`(${units.speed})`}</span></div>
                        <div className="track-data-value">
                            <NameValueUnit value={metrics.averageSpeed} units={SPEED_UNITS} noUnit/>
                        </div>
                        <div className="track-data-value">
                            <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                            <NameValueUnit value={metrics.maxSpeed} units={SPEED_UNITS} noUnit/>
                        </div>
                    </div>
                    <div className="track-data-row">
                        <div className="track-data-label">{'Pace'}<span>{`(${units.pace})`}</span></div>
                        <div className="track-data-value">
                            <NameValueUnit value={metrics.averagePace} units={PACE_UNITS} noUnit/>
                        </div>
                        <div className="track-data-value">
                            <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                            <NameValueUnit value={metrics.minPace} units={PACE_UNITS} noUnit/>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
})