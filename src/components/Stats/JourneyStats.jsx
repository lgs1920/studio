/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStats.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-18
 * Last modified: 2026-02-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                                from '@Components/DataDisplay/NameValueUnit'
import { WIDGET_RADIUS }                                from '@Core/constants'
import { faArrowDownToLine, faArrowUpToLine }           from '@fortawesome/pro-regular-svg-icons'
import { SlDivider, SlIcon }                            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                        from '@Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import React, { memo, useEffect, useMemo }              from 'react'
import { useSnapshot }                                  from 'valtio'

/**
 * Statistical display component for journeys.
 * Maintains layout consistency by preserving slots even when values are zero.
 */
export const JourneyStats = memo(({id, metrics, units, style = {}}) => {
    const $configuration = lgs.settings.widgets['journey-stats-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $metricsStore = lgs.theJourney.metrics
    const metricsSnap = useSnapshot($metricsStore)

    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem).current
    const isImperial = unitSystem === 'imperial'

    const element = useMemo(() => {
        if (id && configuration.elements?.[id]) {
            return configuration.elements[id]
        }
        return configuration.user ?? configuration.default
    }, [id, configuration])

    const displayMetrics = useMemo(() => {
        const source = element.dataSource || 'global'
        const global = metricsSnap.global
        const external = metricsSnap.external || {}
        const user = metricsSnap.user || {}

        if (source === 'global') {
            return global
        }

        return {
            ...global,
            ...(source === 'external' ? external : {}),
            ...(source === 'user' ? {...external, ...user} : {}),
            positive: {
                ...(global.positive || {}),
                ...(source === 'external' ? (external.positive || {}) : {}),
                ...(source === 'user' ? {...(external.positive || {}), ...(user.positive || {})} : {}),
            },
        }
    }, [element.dataSource, metricsSnap])

    const formattedDuration = useMemo(() => {
        const seconds = displayMetrics?.duration
        if (!Number.isFinite(seconds) || seconds <= 0) {
            return null
        }
        const hours = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        if (hours === 0 && mins === 0) {
            return null
        }
        const hh = String(hours).padStart(2, '0')
        const mm = String(mins).padStart(2, '0')
        if (isImperial) {
            return `${hh}:${mm}`
        }
        return (
            <>
                {hh}<span className="duration-hour">h</span>{mm}<span className="duration-minute">m</span>
            </>
        )
    }, [displayMetrics?.duration, isImperial])

    const formatPace = (paceSeconds) => {
        if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) {
            return null
        }
        const m = Math.floor(paceSeconds / 60)
        const s = Math.floor(paceSeconds % 60)
        if (m === 0 && s === 0) {
            return null
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }

    const paceValues = useMemo(() => ({
        average: formatPace(displayMetrics?.averagePace),
        min: formatPace(displayMetrics?.minPace),
    }), [displayMetrics?.averagePace, displayMetrics?.minPace])

    const hasDuration = lgs.theJourney.hasTime
    const hasElevation = lgs.theJourney.hasAltitude
    const date = __.ui.ui.formatJourneyDurationDates(lgs.theJourney.getDate())

    const _moveable = useMemo(() => __.ui.widgetManager.getMoveable(id), [id])

    useEffect(() => {
        if (_moveable?.current) {
            _moveable.current.updateRect()
        }
    }, [_moveable, element?.date, element?.altitude, element?.performance, element.separator, element.border])

    const mainStyle = useMemo(() => ({
        ...style,
        color:          __.ui.ui.resolveItemColor(element.text, true),
        textShadow:     element.text.shadow?.show ? (
            element.text.shadow.value === 'small' ? `0 1px 2px ${__.ui.ui.resolveItemColor(element.text.shadow, true)}` :
            element.text.shadow.value === 'large' ? `0 4px 8px ${__.ui.ui.resolveItemColor(element.text.shadow, true)}` :
            `0 2px 4px ${__.ui.ui.resolveItemColor(element.text.shadow, true)}`
        ) : undefined,
        border:         element.border.show ? `${element.border.thickness}px solid ${__.ui.ui.resolveItemColor(element.border, true)}` : 'none',
        background:     __.ui.ui.resolveItemColor(element.background, true),
        backdropFilter: (element.background?.show && element.background?.blur) ? 'blur(var(--lgs-blur-s))' : 'blur(0)',
        borderRadius: element.border?.show ? WIDGET_RADIUS.get(element.border.radius ?? 'none')?.value : '0',
    }), [style, element.text, element.border, element.background])

    const separatorStyle = useMemo(() => ({
        '--color': __.ui.ui.resolveItemColor(element.separator, true),
        'display': element.separator.show ? 'block' : 'none',
    }), [element.separator])

    const showAltitudeRow = (hasElevation || element?.altitude) && (displayMetrics.minHeight > 0 || displayMetrics.maxHeight > 0)
    const showSpeedRow = element?.performance && (displayMetrics.averageSpeed > 0 || displayMetrics.maxSpeed > 0)
    const showPaceRow = element?.performance && (paceValues.average !== null || paceValues.min !== null)

    return (
        <div className="journey-stats-widget" style={mainStyle}>
            {(hasDuration && element?.date) && (
                <>
                    <div className="journey-stats-date">
                        <span>{date.prefix}</span><span>{date.sufix}</span>
                    </div>
                    <SlDivider style={separatorStyle}/>
                </>
            )}

            <div className="journey-stats-row-center">
                {displayMetrics.distance > 0 &&
                    <div className="journey-stats-summary-item track-summary-column">
                        <div className="journey-stats-val-huge">
                            <NameValueUnit value={displayMetrics.distance} units={DISTANCE_UNITS} noUnit/>
                        </div>
                        <div className="journey-stats-label-bold">{`Distance (${units.distance})`}</div>
                    </div>
                }
                {displayMetrics.positive?.elevation > 0 &&
                    <div className="journey-stats-summary-item track-summary-column">
                        <div className="journey-stats-val-huge">
                            <NameValueUnit value={displayMetrics.positive.elevation} units={ELEVATION_UNITS} noUnit
                                           precision="0"/>
                        </div>
                        <div className="journey-stats-label-bold">{`Elevation (${units.elevation})`}</div>
                    </div>
                }
                {formattedDuration &&
                    <div className="journey-stats-summary-item track-summary-column">
                        <div className="journey-stats-val-huge">{formattedDuration}</div>
                        <div className="journey-stats-label-bold">{'DURATION'}</div>
                    </div>
                }
            </div>

            {showAltitudeRow && (
                <>
                    <SlDivider style={separatorStyle}/>
                    <div className="journey-stats-row">
                        <div className="journey-stats-label">{'Altitude'}<span>{`(${units.elevation})`}</span></div>
                        <div className="journey-stats-value">
                            {displayMetrics.minHeight > 0 &&
                                <>
                                    <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowDownToLine)}/>
                                    <NameValueUnit value={displayMetrics.minHeight} units={ELEVATION_UNITS} noUnit
                                                   precision="0"/>
                                </>
                            }
                        </div>
                        <div className="journey-stats-value">
                            {displayMetrics.maxHeight > 0 &&
                                <>
                                    <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                                    <NameValueUnit value={displayMetrics.maxHeight} units={ELEVATION_UNITS} noUnit
                                                   precision="0"/>
                                </>
                            }
                        </div>
                    </div>
                </>
            )}

            {(showSpeedRow || showPaceRow) && <SlDivider style={separatorStyle}/>}

            {showSpeedRow && (
                <div className="journey-stats-row">
                    <div className="journey-stats-label">{'Speed'}<span>{`(${units.speed})`}</span></div>
                    <div className="journey-stats-value">
                        {displayMetrics.averageSpeed > 0 &&
                            <NameValueUnit value={displayMetrics.averageSpeed} units={SPEED_UNITS} noUnit/>
                        }
                    </div>
                    <div className="journey-stats-value">
                        {displayMetrics.maxSpeed > 0 &&
                            <>
                                <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                                <NameValueUnit value={displayMetrics.maxSpeed} units={SPEED_UNITS} noUnit/>
                            </>
                        }
                    </div>
                </div>
            )}

            {showPaceRow && (
                <div className="journey-stats-row">
                    <div className="journey-stats-label">{'Pace'}<span>{`(${units.pace})`}</span></div>
                    <div className="journey-stats-value">
                        {paceValues.average && paceValues.average}
                    </div>
                    <div className="journey-stats-value">
                        {paceValues.min &&
                            <>
                                <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                                {paceValues.min}
                            </>
                        }
                    </div>
                </div>
            )}
        </div>
    )
})