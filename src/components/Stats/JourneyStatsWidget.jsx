/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-31
 * Last modified: 2026-01-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                    from '@Components/MainUI/widgets/Widget'
import {
    JOURNEY_WIDGETS,
    LGS_VISUAL_WIDGET,
    SCENE_WIDGETS,
    SCENE_WIDGETS_BOARD,
}                                                    from '@Core/constants'
import {
    DISTANCE_UNITS,
    ELEVATION_UNITS,
    PACE_UNITS,
    SPEED_UNITS,
    units as unitsList,
}                                                    from '@Utils/UnitUtils'
import { DateTime }                                  from 'luxon'
import React, { memo, useEffect, useMemo, useState } from 'react'
import { sprintf }                                   from 'sprintf-js'
import { useSnapshot }                               from 'valtio'
import './style.css'

const ROW_HEIGHT = 26
const ROW_GAP = 6
const PADDING_X = 18
const PADDING_Y = 18
const CONTENT_RIGHT = 580
const MIN_HEIGHT = 220
const SUMMARY_HEIGHT = 120 // Space for huge numbers

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
 * Formats numeric values and units for display.
 */
const formatValue = (value, units, unitSystem, {format, precision, callback} = {}) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return {valueText: '', unitText: ''}
    }

    if (typeof units === 'string') {
        units = [units, units]
    }
    else if (Array.isArray(units) && units.length === 1) {
        units = [units[0], units[0]]
    }
    else if (!Array.isArray(units)) {
        units = ['', '']
    }

    const unitText = units[unitSystem] ?? ''
    let toShow = value

    if (typeof toShow !== 'string') {
        const numeric = Number(toShow)
        if (Number.isNaN(numeric)) {
            return {valueText: '', unitText}
        }
        if (unitsList.includes(units[0])) {
            toShow = __.convert(numeric).to(units[unitSystem])
        }
        else {
            toShow = numeric
        }

        if (callback) {
            toShow = callback(toShow)
        }
        else {
            let fmt = format ?? '%\' .2f'
            if (precision !== null && precision !== undefined) {
                fmt = `%' .${precision}f`
            }
            toShow = sprintf(fmt, toShow)
        }
    }

    return {valueText: `${toShow}`, unitText}
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

/**
 * Builds rows definitions for the SVG table.
 */
const buildRows = (metrics, unitSystem) => {
    const rows = []
    const pushRow = (label, valueLeft, valueRight, options = {}) => {
        rows.push({label, valueLeft, valueRight, options})
    }

    pushRow('Distance', formatValue(metrics.distance, DISTANCE_UNITS, unitSystem))
    if (metrics.positive) {
        pushRow('', formatValue(metrics.positive.distance, DISTANCE_UNITS, unitSystem), formatValue(metrics.negative.distance, DISTANCE_UNITS, unitSystem))
    }

    if (!Number.isNaN(metrics.duration)) {
        pushRow('Duration', {valueText: __.convert(metrics.duration).toTime(), unitText: ''})
        pushRow('', {valueText: __.convert(metrics.duration - metrics.idleTime).toTime(), unitText: ''},
                {valueText: __.convert(metrics.idleTime).toTime(), unitText: ''})
    }

    const hasElevation = metrics.negative?.elevation < 0 && metrics.positive?.elevation > 0
    if (hasElevation) {
        rows.push({divider: true})
        pushRow('Elevation',
                formatValue(metrics.positive.elevation, ELEVATION_UNITS, unitSystem, {format: '%d'}),
                formatValue(metrics.negative.elevation, ELEVATION_UNITS, unitSystem, {format: '%d'}))
    }

    const hasAltitude = !Number.isNaN(metrics.minHeight) && !Number.isNaN(metrics.maxHeight)
    if (hasAltitude) {
        pushRow('Altitude',
                formatValue(metrics.minHeight, ELEVATION_UNITS, unitSystem, {format: '%d'}),
                formatValue(metrics.maxHeight, ELEVATION_UNITS, unitSystem, {format: '%d'}))
    }

    if (!Number.isNaN(metrics.duration)) {
        rows.push({divider: true})
        pushRow('Speed',
                formatValue(metrics.averageSpeed, SPEED_UNITS, unitSystem),
                formatValue(metrics.averageSpeedMoving, SPEED_UNITS, unitSystem))
        pushRow('',
                formatValue(metrics.minSpeed, SPEED_UNITS, unitSystem),
                formatValue(metrics.maxSpeed, SPEED_UNITS, unitSystem))
        if (!Number.isNaN(metrics.minHeight)) {
            pushRow('',
                    formatValue(metrics.positive.speed, SPEED_UNITS, unitSystem),
                    formatValue(metrics.negative.speed, SPEED_UNITS, unitSystem))
        }

        rows.push({divider: true})
        pushRow('Pace',
                formatValue(metrics.averagePace, PACE_UNITS, unitSystem),
                formatValue(metrics.averageSpeedMoving, PACE_UNITS, unitSystem))
        pushRow('',
                formatValue(metrics.minPace, PACE_UNITS, unitSystem),
                formatValue(metrics.maxPace, PACE_UNITS, unitSystem))
        if (!Number.isNaN(metrics.minHeight)) {
            pushRow('',
                    formatValue(metrics.positive.pace, PACE_UNITS, unitSystem),
                    formatValue(metrics.negative.pace, PACE_UNITS, unitSystem))
        }
    }

    return rows
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

    useEffect(() => {
        if (widgetsBoard && widgetsBoard !== SCENE_WIDGETS_BOARD) {
            const element = document.querySelector(`#${widgetsBoard}.defined`)
            if (element) {
                setContainer(element)
            }
        }
    }, [widgetsBoard])

    const metrics = normalizeMetrics(journeyMetricsRaw)
    const rows = useMemo(() => (metrics ? buildRows(metrics, unitSystem) : []), [metrics, unitSystem])
    const dateLines = useMemo(() => (metrics ? buildDateLines(journeyMetricsRaw) : []), [metrics, journeyMetricsRaw])

    const contentHeight = useMemo(() => {
        const rowCount = rows.length
        const dividerCount = rows.filter(row => row.divider).length
        const dateLineCount = dateLines.length
        return PADDING_Y * 2 + SUMMARY_HEIGHT + (rowCount * ROW_HEIGHT) + (Math.max(0, rowCount - 1) * ROW_GAP) + (dividerCount * 12) + (dateLineCount * 20 + (dateLineCount ? 8 : 0))
    }, [rows, dateLines])

    const contentWidth = CONTENT_RIGHT + PADDING_X
    const viewBoxHeight = Math.max(MIN_HEIGHT, Math.ceil(contentHeight))

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
            top:             '50%',
            left:            '50%',
            type:            LGS_VISUAL_WIDGET,
            group:           widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
            margin:          5,
            attachTo:        'center',
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

    let cursorY = PADDING_Y
    const colWidth = CONTENT_RIGHT / 3
    const summaryCols = [colWidth * 0.5, colWidth * 1.5, colWidth * 2.5]

    const summaryData = [
        {label: 'DISTANCE', ...formatValue(metrics.distance, DISTANCE_UNITS, unitSystem, {precision: 1})},
        {label: 'ELEVATION', ...formatValue(metrics.positive.elevation, ELEVATION_UNITS, unitSystem, {format: '%d'})},
        {label: 'DURATION', valueText: formatDuration(metrics.duration), unitText: ''},
    ]

    const svgContent = []

    // 1. Top Summary Bar - Huge bold numbers
    summaryData.forEach((item, i) => {
        const x = summaryCols[i]
        const labelText = item.unitText ? `${item.label} (${item.unitText})` : item.label
        svgContent.push(
            <g key={`summary-${i}`} textAnchor="middle">
                {/* 3x Larger Bold Numbers */}
                <text x={x} y={cursorY + 45} fontWeight="bold" fontSize="48" className="track-data-svg-val-huge">
                    {item.valueText}
                </text>
                {/* Bold Legend */}
                <text x={x} y={cursorY + 70} fontWeight="bold" fontSize="12" className="track-data-svg-label-bold">
                    {labelText}
                </text>
            </g>,
        )
    })

    cursorY += SUMMARY_HEIGHT

    // 2. Date Header
    if (dateLines.length) {
        dateLines.forEach((line, index) => {
            svgContent.push(<text key={`date-${index}`} className="track-data-svg-text track-data-svg-date"
                                  x={PADDING_X} y={cursorY + 16}>{line}</text>)
            cursorY += 20
        })
        cursorY += 8
    }

    // 3. Table Rows
    rows.forEach((row, index) => {
        if (row.divider) {
            svgContent.push(<line key={`div-${index}`} className="track-data-svg-divider" x1={PADDING_X}
                                  x2={CONTENT_RIGHT} y1={cursorY + 6} y2={cursorY + 6}/>)
            cursorY += 12
            return
        }

        const baseY = cursorY + 18
        if (row.label) {
            svgContent.push(<text key={`lbl-${index}`} className="track-data-svg-label" x={PADDING_X}
                                  y={baseY}>{row.label}</text>)
        }

        [row.valueLeft, row.valueRight].forEach((val, i) => {
            if (val?.valueText) {
                svgContent.push(
                    <text key={`val-${index}-${i}`} className="track-data-svg-value" x={i === 0 ? 220 : 390} y={baseY}>
                        <tspan>{val.valueText}</tspan>
                        {val.unitText && <tspan className="track-data-svg-unit-text" dx="5">{val.unitText}</tspan>}
                    </text>,
                )
            }
        })
        cursorY += ROW_HEIGHT + ROW_GAP
    })

    return (
        <Widget isVisible={true} config={config}>
            <div className="track-data-svg-widget" style={{width: `${contentWidth}px`, height: `${viewBoxHeight}px`}}>
                <svg viewBox={`0 0 ${contentWidth} ${viewBoxHeight}`} width={contentWidth} height={viewBoxHeight}>
                    <rect className="track-data-svg-bg" width={contentWidth} height={viewBoxHeight} rx="18" ry="18"/>
                    {svgContent}
                </svg>
            </div>
        </Widget>
    )
})
