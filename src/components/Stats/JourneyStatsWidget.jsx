/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidget.jsx
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

import { Widget }                              from '@Components/MainUI/widgets/Widget'
import { JourneyStats }                        from '@Components/Stats/JourneyStats'
import {
    JOURNEY_WIDGETS,
    LGS_VISUAL_WIDGET,
    SCENE_WIDGETS,
    SCENE_WIDGETS_BOARD,
}                                              from '@Core/constants'
import {
    DISTANCE_UNITS,
    ELEVATION_UNITS,
    PACE_UNITS,
    SPEED_UNITS,
}                                              from '@Utils/UnitUtils'
import { DateTime }                            from 'luxon'
import React, { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                         from 'valtio'
import './style.css'

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
        positive: metrics.positive ?? {
            elevation: positiveElevation,
            distance:  positiveDistance,
            speed:     metrics.positiveSpeed,
            pace:      metrics.positivePace,
        },
        negative: metrics.negative ?? {
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
    if (!metrics || Number.isNaN(metrics.duration)) {
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

export const JourneyStatsWidget = ({id, context}) => {
    const {widgetEditor, widgetsBoard} = context

    const $unitSystem = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitSystem)
    const unitSystem = unitStore.current

    const journey = lgs.theJourney
    const journeyMetricsRaw = useMemo(() => journey?.metrics?.global ?? journey?.metrics ?? null, [journey, unitSystem])

    const video = useSnapshot(lgs.stores.ui.video)

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[unitSystem],
        distance:  DISTANCE_UNITS[unitSystem],
        pace:      PACE_UNITS[unitSystem],
        speed: SPEED_UNITS[unitSystem],
    }), [unitSystem])

    const [container, setContainer] = useState(lgs.canvas)

    /**
     * Updates the container element reference when the widget board changes.
     */
    useEffect(() => {
        if (widgetsBoard && widgetsBoard !== SCENE_WIDGETS_BOARD) {
            const element = document.querySelector(`#${widgetsBoard}.defined`)
            if (element) {
                setContainer(element)
            }
        }
        else {
            setContainer(lgs.canvas)
        }
        __.ui.ui.importFonts()
    }, [widgetsBoard])

    const metrics = useMemo(() => normalizeMetrics(journeyMetricsRaw), [journeyMetricsRaw])
    const dateLines = useMemo(() => (metrics ? buildDateLines(journey.metrics) : []), [metrics])

    const config = useMemo(() => {
        return {
            container:       container,
            contextMenu:     {
                canReset:    true,
                canEdit: true,
                canRemove:   true,
                canPosition: true,
            },
            width:           400,
            top:             '0%',
            left:            '50%',
            type:            LGS_VISUAL_WIDGET,
            group:           widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
            margin:          5,
            attachTo:        'top',
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
    }, [container, widgetsBoard, id, widgetEditor])

    if (!widgetsBoard || Object.keys(config).length === 0) {
        return null
    }

    return (
        <Widget
            isVisible={true}
            config={config}
            key={lgs.theJourney.slug}
        >
            {(journey && metrics) && (
                <JourneyStats
                    metrics={metrics}
                    dateLines={dateLines}
                    units={units}
                />
            )}
        </Widget>
    )
}