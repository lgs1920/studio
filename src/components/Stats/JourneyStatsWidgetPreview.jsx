/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyStats }                                             from '@Components/Stats/JourneyStats'
import { getPreviewChartSize }                                      from '@Components/MainUI/widgets/editor/previewUtils'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import { useOptionalSnapshot }                                      from '@Utils/ValtioUtils'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                              from 'valtio'

/**
 * Preview component for Journey Stats.
 * Renders the stats content while the editor preview stage owns widget rotation.
 */
export const JourneyStatsWidgetPreview = ({entity, widgetKey = 'journey-stats-widget', mode = 'journey'}) => {
    const MAX_PREVIEW_SCALE = 0.9
    const main = useSnapshot(lgs.stores.main)
    const journey = lgs.theJourney
    const journeySlug = main.theJourney?.slug ?? null

    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem)
    const currentUnit = unitSystem.current

    const widgets = lgs.settings.widgets ?? {}
    const configuration = useOptionalSnapshot(
        widgets?.[widgetKey]?.configuration
        ?? __.widgets.get(widgetKey)?.configuration
        ?? null,
        {default: {}, user: {}, elements: {}},
    )

    const $metrics = journey?.metrics ?? lgs.stores.main.components.journeyStats
    const metrics = useSnapshot($metrics)

    const [previewBox, setPreviewBox] = useState({width: 0, height: 0})
    const [contentBox, setContentBox] = useState({width: 0, height: 0})
    const surfaceRef = useRef(null)
    const measureRef = useRef(null)

    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    const journeyMetrics = useMemo(() => {
        if (!journeySlug || !journey || !metrics) {
            return null
        }
        return journey.getMetrics()
    }, [journeySlug, journey, metrics])

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[currentUnit],
        distance:  DISTANCE_UNITS[currentUnit],
        pace:      PACE_UNITS[currentUnit],
        speed:     SPEED_UNITS[currentUnit],
    }), [currentUnit])

    useLayoutEffect(() => {
        if (!surfaceRef.current) {
            return undefined
        }

        let frame1 = 0
        let frame2 = 0

        const updateSize = () => {
            const element = surfaceRef.current
            if (!element) {
                return
            }

            const rect = element.getBoundingClientRect()
            const styles = window.getComputedStyle(element)
            const horizontalPadding = (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0)
            const verticalPadding = (Number.parseFloat(styles.paddingTop) || 0) + (Number.parseFloat(styles.paddingBottom) || 0)
            const width = rect.width - horizontalPadding
            const height = rect.height - verticalPadding

            if (width > 0 && height > 0) {
                setPreviewBox(previous => (
                    previous.width === width && previous.height === height
                        ? previous
                        : {width, height}
                ))
            }
        }

        updateSize()
        const observer = new ResizeObserver(updateSize)
        observer.observe(surfaceRef.current)

        frame1 = requestAnimationFrame(() => {
            updateSize()
            frame2 = requestAnimationFrame(updateSize)
        })

        return () => {
            if (frame1) {
                cancelAnimationFrame(frame1)
            }
            if (frame2) {
                cancelAnimationFrame(frame2)
            }
            observer.disconnect()
        }
    }, [])

    useLayoutEffect(() => {
        if (!measureRef.current) {
            return undefined
        }

        let frame = 0

        const updateSize = () => {
            const element = measureRef.current
            if (!element) {
                return
            }

            const width = Math.ceil(Math.max(element.offsetWidth || 0, element.scrollWidth || 0))
            const height = Math.ceil(Math.max(element.offsetHeight || 0, element.scrollHeight || 0))

            if (width > 0 && height > 0) {
                setContentBox(previous => (
                    previous.width === width && previous.height === height
                        ? previous
                        : {width, height}
                ))
            }
        }

        updateSize()
        const observer = new ResizeObserver(updateSize)
        observer.observe(measureRef.current)

        frame = requestAnimationFrame(updateSize)

        return () => {
            if (frame) {
                cancelAnimationFrame(frame)
            }
            observer.disconnect()
        }
    }, [element, entity, journeyMetrics, mode, widgetKey, currentUnit])

    const previewScale = useMemo(() => {
        if (!previewBox.width || !previewBox.height || !contentBox.width || !contentBox.height) {
            return MAX_PREVIEW_SCALE
        }

        const ratio = contentBox.width / contentBox.height
        const chartSize = getPreviewChartSize({
            containerWidth:  previewBox.width,
            containerHeight: previewBox.height,
            ratio,
            scale:           0.9,
        })

        if (!chartSize) {
            return MAX_PREVIEW_SCALE
        }

        const fitScale = Math.min(
            chartSize.width / contentBox.width,
            chartSize.height / contentBox.height,
        )

        return Math.min(MAX_PREVIEW_SCALE, fitScale)
    }, [contentBox.height, contentBox.width, previewBox.height, previewBox.width])

    if (!journeySlug || !journey || !journeyMetrics) {
        return null
    }

    return (
        <div
            ref={surfaceRef}
            className="journey-stats-widget-preview-surface"
            style={{
                backgroundSize:     'cover',
                backgroundPosition: 'center',
                border:     element.border?.width ? `${element.border.width}px solid ${__.ui.ui.resolveItemColor(element.border, true)}` : 'none',
                boxShadow:  element.shadow?.active ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${__.ui.ui.resolveItemColor(element.shadow, true)}` : 'none',
            }}
        >
            <div className="journey-stats-widget-preview-chart">
                <div
                    ref={measureRef}
                    className="journey-stats-widget-preview-measure"
                    aria-hidden
                >
                    <JourneyStats
                        metrics={journeyMetrics.metrics}
                        id={undefined}
                        units={units}
                        mode={mode}
                        widgetKey={widgetKey}
                    />
                </div>
                <div
                    className="journey-stats-widget-preview-stage"
                    style={{transform: `scale(${previewScale})`}}
                >
                    <JourneyStats
                        metrics={journeyMetrics.metrics}
                        id={entity}
                        units={units}
                        mode={mode}
                        widgetKey={widgetKey}
                    />
                </div>
            </div>
        </div>
    )
}
