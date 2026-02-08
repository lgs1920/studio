/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStats.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-08
 * Last modified: 2026-02-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit } from '@Components/DataDisplay/NameValueUnit'
import { WIDGET_RADIUS }                   from '@Core/constants'
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
}                                          from '@Utils/UnitUtils'
import React, { memo, useEffect, useMemo } from 'react'
import { useSnapshot }                     from 'valtio'

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
export const JourneyStats = memo(({id, metrics, units, style = {}}) => {
    const $configuration = lgs.settings.widgets['journey-stats-widget'].configuration
    const configuration = useSnapshot($configuration)

    /**
     * Resolve the specific element configuration for this instance
     */

    const element = useMemo(() => {
        // Si l'ID est fourni, on cherche dans elements
        if (id && configuration.elements?.[id]) {
            return configuration.elements[id]
        }
        return configuration.user ?? configuration.default
    }, [id, configuration])

    const hasElevation = metrics?.negative?.elevation < 0 && metrics?.positive?.elevation > 0
    const hasDuration = metrics?.duration
    const date = __.ui.ui.formatJourneyDurationDates(lgs.theJourney.getDate())

    /**
     * Access to the moveable reference from the widget manager
     */
    const _moveable = useMemo(() => {
        return __.ui.widgetManager.getMoveable(id)
    }, [id])

    /**
     * Synchronize the bounding box when the visible date content changes
     */
    useEffect(() => {
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [_moveable, element?.date, element?.altitude, element?.performance, element.separator, element.border])

    /**
     * Compute styles dynamically based on snapshot values
     * We include element.text in the dependencies to force recalculation
     * when the color/opacity changes in the store.
     */
    const mainStyle = useMemo(() => {
        return {
            ...style,
            color:          __.ui.ui.resolveItemColor(element.text, true),
            textShadow:     element.text.shadow?.show ? (
                element.text.shadow.value === 'small' ? `0 1px 2px ${__.ui.ui.resolveItemColor(element.text.shadow, true)}` :
                element.text.shadow.value === 'large' ? `0 4px 8px ${__.ui.ui.resolveItemColor(element.text.shadow, true)}` :
                `0 2px 4px ${__.ui.ui.resolveItemColor(element.text.shadow, true)}`
            ) : undefined,
            border:         element.border.show
                            ? `${element.border.thickness}px solid ${__.ui.ui.resolveItemColor(element.border, true)}`
                            : 'none',
            background:     __.ui.ui.resolveItemColor(element.background, true),
            backdropFilter: (element.background?.show && element.background?.blur) ? 'blur(var(--lgs-blur-s))' : 'blur(0)',
            borderRadius:   element.border?.show ? WIDGET_RADIUS.get(element.border.radius ?? 'none')?.value : '0',

        }
    }, [style, element.text])

    const separatorStyle = useMemo(() => {
        return {
            '--color': __.ui.ui.resolveItemColor(element.separator, true),
            'display': element.separator.show ? 'block' : 'none',
        }
    }, [style, element.text])


    return (
        <div className="journey-stats-widget" style={mainStyle}>
            {hasDuration && element?.date && (
                <>
                    <div className="journey-stats-date">
                        <span>{date.prefix}</span><span>{date.sufix}</span>
                    </div>
                    <SlDivider style={separatorStyle}/>
                </>
            )}
            <div className="journey-stats-row">
                <div className="journey-stats-summary-item track-summary-column">
                    <div className="journey-stats-val-huge">
                        <NameValueUnit value={metrics.distance} units={DISTANCE_UNITS} noUnit/>
                    </div>
                    <div className="journey-stats-label-bold">{`Distance (${units.distance})`}</div>
                </div>
                <div className="journey-stats-summary-item track-summary-column">
                    {hasElevation &&
                        <div className="journey-stats-val-huge">
                            <NameValueUnit value={metrics.positive.elevation} units={ELEVATION_UNITS} noUnit
                                           precision="0"/>
                        </div>
                    }
                    <div className="journey-stats-label-bold">{`Elevation (${units.elevation})`}</div>
                </div>
                <div className="journey-stats-summary-item track-summary-column">
                    {hasDuration &&
                        <div className="journey-stats-val-huge">
                            {formatDuration(metrics.duration)}
                        </div>
                    }
                    <div className="journey-stats-label-bold">{'DURATION'}</div>
                </div>
            </div>

            {hasElevation && element?.altitude && (
                <>
                    <SlDivider style={separatorStyle}/>
                    <div className="journey-stats-row">
                        <div className="journey-stats-label">{'Altitude'}<span>{`(${units.elevation})`}</span></div>
                        <div className="journey-stats-value">
                            <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowDownToLine)}/>
                            <NameValueUnit value={metrics.minHeight} units={ELEVATION_UNITS} noUnit precision="0"/>
                        </div>
                        <div className="journey-stats-value">
                            <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                            <NameValueUnit value={metrics.maxHeight} units={ELEVATION_UNITS} noUnit precision="0"/>
                        </div>
                    </div>
                </>
            )}
            {hasElevation && hasDuration && element?.performance && (
                <>
                    <SlDivider style={separatorStyle}/>
                    <div className="journey-stats-row">
                        <div className="journey-stats-label">{'Speed'}<span>{`(${units.speed})`}</span></div>
                        <div className="journey-stats-value">
                            <NameValueUnit value={metrics.averageSpeed} units={SPEED_UNITS} noUnit/>
                        </div>
                        <div className="journey-stats-value">
                            <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                            <NameValueUnit value={metrics.maxSpeed} units={SPEED_UNITS} noUnit/>
                        </div>
                    </div>
                    <div className="journey-stats-row">
                        <div className="journey-stats-label">{'Pace'}<span>{`(${units.pace})`}</span></div>
                        <div className="journey-stats-value">
                            <NameValueUnit value={metrics.averagePace} units={PACE_UNITS} noUnit/>
                        </div>
                        <div className="journey-stats-value">
                            <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                            <NameValueUnit value={metrics.minPace} units={PACE_UNITS} noUnit/>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
})