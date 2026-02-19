/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-19
 * Last modified: 2026-02-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyStats }                                             from '@Components/Stats/JourneyStats'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                                              from 'valtio'

/**
 * Preview component for Journey Stats.
 * Syncs initial rotation with widgetManager via async call and handles live updates.
 */
export const JourneyStatsWidgetPreview = ({entity}) => {
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem)
    const currentUnit = unitSystem.current

    const $configuration = lgs.settings.widgets['journey-stats-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $metrics = lgs.theJourney.metrics
    const metrics = useSnapshot($metrics)

    const [initialRotation, setInitialRotation] = useState(0)

    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    /**
     * Fetch initial position from manager on mount
     */
    useEffect(() => {
        let isMounted = true

        const fetchPosition = async () => {
            const position = await __.ui.widgetManager.getWidgetPosition(entity)
            if (isMounted && position) {
                setInitialRotation(Number(position.rotate) || 0)
            }
        }

        fetchPosition()
        return () => {
            isMounted = false
        }
    }, [entity])

    const journeyMetrics = useMemo(() => {
        if (!metrics) {
            return null
        }
        return lgs.theJourney.getMetrics()
    }, [metrics, currentUnit])

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[currentUnit],
        distance:  DISTANCE_UNITS[currentUnit],
        pace:      PACE_UNITS[currentUnit],
        speed:     SPEED_UNITS[currentUnit],
    }), [currentUnit])

    const previewBg = widget.currentSnapshot?.image || null

    /**
     * Priority to live Valtio store if selected, otherwise use fetched initial rotation
     */
    const isSelected = widget.current?.id === entity
    const activeRotation = isSelected && widget.current?.rotate !== undefined
                           ? Number(widget.current.rotate)
                           : initialRotation

    if (!journeyMetrics) {
        return null
    }

    return (
        <div
            className="journey-stats-widget-preview-surface"
            style={{
                background: __.ui.ui.resolveItemColor(element.background, true),
                backgroundSize:     'cover',
                backgroundPosition: 'center',
                border:     element.border?.width ? `${element.border.width}px solid ${__.ui.ui.resolveItemColor(element.border, true)}` : 'none',
                boxShadow:  element.shadow?.active ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${__.ui.ui.resolveItemColor(element.shadow, true)}` : 'none',
            }}
        >
            <div
                className="journey-stats-widget-preview-chart"
                style={{'--lgs-journey-stats-preview-bg': previewBg ? `url(${previewBg})` : 'none'}}
            >
                <div style={{transform: `scale(0.8) rotate(${activeRotation}deg)`}}>
                    <JourneyStats
                        metrics={journeyMetrics.metrics}
                        id={entity}
                        units={units}
                    />
                </div>
            </div>
        </div>
    )
}