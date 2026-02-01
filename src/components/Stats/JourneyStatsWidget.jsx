/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-01
 * Last modified: 2026-02-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { NameValueUnit }                                                                from '@Components/DataDisplay/NameValueUnit'
import {
    Widget,
}                                                                                       from '@Components/MainUI/widgets/Widget'
import { JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD }       from '@Core/constants'
import {
    faArrowDownToLine, faArrowUpToLine,
}                                                                                       from '@fortawesome/pro-regular-svg-icons'
import {
    SlDivider, SlIcon,
}                                                                                       from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                                        from '@Utils/FA2SL'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS, units as unitsList } from '@Utils/UnitUtils'
import { DateTime }                                                                     from 'luxon'
import React, { memo, useEffect, useMemo, useState }                                    from 'react'
import { sprintf }                                                                      from 'sprintf-js'
import { useSnapshot }                                                                  from 'valtio'
import './style.css'


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
 * Ensures metrics object has all required fields for rendering.
 */
const normalizeMetrics = (metrics) => {
    if (!metrics) {
        return null
    }
    if (metrics.positive && metrics.negative) {
        return metrics
    }

    const positiveElevation = metrics.positiveElevation ?? metrics.positive?.elevation
    const negativeElevation = metrics.negativeElevation ?? metrics.negative?.elevation
    const positiveDistance = metrics.positiveDistance ?? metrics.positive?.distance
    const negativeDistance = metrics.negativeDistance ?? metrics.negative?.distance

    return {
        ...metrics,
        positive:           metrics.positive ?? {
            elevation: positiveElevation,
            distance:  positiveDistance,
            speed:     metrics.positiveSpeed,
            pace:      metrics.positivePace,
        },
        negative:           metrics.negative ?? {
            elevation: negativeElevation,
            distance:  negativeDistance,
            speed:     metrics.negativeSpeed,
            pace:      metrics.negativePace,
        },
        minHeight:          metrics.minHeight ?? metrics.altitude,
        maxHeight:          metrics.maxHeight ?? metrics.altitude,
        averageSpeedMoving: metrics.averageSpeedMoving ?? metrics.averageSpeed,
        averagePace:        metrics.averagePace ?? metrics.pace,
        idleTime:           metrics.idleTime ?? 0,
    }
}

const buildDateLines = (metrics) => {
    if (Number.isNaN(metrics.duration)) {
        return []
    }
    const points = metrics.points
    if (!points?.length) {
        return []
    }
    const start = points[0]?.time
    const stop = points[points.length - 1]?.time
    if (!start || !stop) {
        return []
    }

    const startDate = DateTime.fromISO(start).toLocaleString(DateTime.DATE_FULL)
    const startTime = DateTime.fromISO(start).toLocaleString(DateTime.TIME_SIMPLE)
    const stopDate = DateTime.fromISO(stop).toLocaleString(DateTime.DATE_FULL)
    const stopTime = DateTime.fromISO(stop).toLocaleString(DateTime.TIME_SIMPLE)

    return startDate === stopDate ? [startDate, `${startTime} - ${stopTime}`] : [`${startDate} ${startTime}`, `${stopDate} ${stopTime}`]
}


export const JourneyStatsWidget = memo(({id, context}) => {
    const widgetSnapshot = useSnapshot(lgs.stores.ui.widget)
    const listEntry = widgetSnapshot.list.get(id)
    const widgetEditor = context?.widgetEditor ?? listEntry?.widgetEditor ?? false
    const widgetsBoard = context?.widgetsBoard ?? listEntry?.widgetsBoard ?? null
    const profileStore = useSnapshot(lgs.stores.main.components.profile)
    const unitStore = useSnapshot(lgs.settings.unitSystem)
    const unitSystem = unitStore.current
    const mainStore = useSnapshot(lgs.stores.main)
    const journey = mainStore.theJourney
    const journeyMetricsRaw = useMemo(() => journey?.metrics?.global ?? journey?.metrics ?? null, [journey, profileStore.key, unitSystem])
    const [container, setContainer] = useState(lgs.canvas)

    const units = {
        elevation: ELEVATION_UNITS[unitSystem],
        distance:  DISTANCE_UNITS[unitSystem],
        pace:      PACE_UNITS[unitSystem],
        speed:     PACE_UNITS[unitSystem],
    }

    useEffect(() => {
        if (widgetsBoard && widgetsBoard !== SCENE_WIDGETS_BOARD) {
            const element = document.querySelector(`#${widgetsBoard}.defined`)
            if (element) {
                setContainer(element)
            }
        }
    }, [widgetsBoard])

    const metrics = normalizeMetrics(journeyMetricsRaw)
    const dateLines = useMemo(() => (metrics ? buildDateLines(journey.metrics) : []), [metrics, journeyMetricsRaw])

    const hasElevation = metrics.negative?.elevation < 0 && metrics.positive?.elevation > 0
    const hasDuration = metrics.duration

    if (!journey || !widgetsBoard || !metrics) {
        return null
    }

    const config = useMemo(() => {
        return {
            container:       container,
            contextMenu:     {
                canReset:    true,
                canEdit:     false,
                canRemove:   true,
                canPosition: true,
            },
            top:      '0%',
            left:     '50%',
            type:            LGS_VISUAL_WIDGET,
            group:           widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
            margin:          5,
            attachTo: 'top',
            scalable:        true,
            rotatable:       true,
            id,
            min:             {width: 250},
            max:             {width: 900},
            persist:         true,
            transient:       true,
            mandatory:       false,
            stopPropagation: false,
            snap:            false,
            widgetsBoard:    widgetsBoard,
        }
    }, [widgetEditor, container, widgetsBoard, id])

    return (
        <Widget isVisible={true} config={config}>
            <div className="track-data-widget" key={lgs.theJourney.slug}>
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
                            <div className="track-data-label">{`Altitude (${units.elevation})`}</div>
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
                            <div className="track-data-label">{`Speed (${units.speed})`}</div>

                            <div className="track-data-value">
                                <NameValueUnit value={metrics.averageSpeed} units={SPEED_UNITS} noUnit/>
                            </div>
                            <div className="track-data-value">
                                <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                                <NameValueUnit value={metrics.maxSpeed} units={SPEED_UNITS} noUnit/>
                            </div>
                        </div>
                        <div className="track-data-row">
                            <div className="track-data-label">{`Pace (${units.pace})`}</div>
                            <div className="track-data-value">
                                <NameValueUnit value={metrics.averagePace} units={PACE_UNITS} noUnit/>
                            </div>
                            <div className="track-data-value">
                                <SlIcon variant="primary" library="fa" name={FA2SL.set(faArrowUpToLine)}/>
                                <NameValueUnit value={metrics.maxPace} units={PACE_UNITS} noUnit/>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Widget>
    )
})
