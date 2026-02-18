/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetPreview.jsx
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

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetPreview.jsx
 *
 ******************************************************************************/

import { JourneyStats }                                             from '@Components/Stats/JourneyStats'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import { useMemo }                                                  from 'react'
import { useSnapshot }                                              from 'valtio'

/**
 * Preview component for Journey Stats.
 * Handles metrics calculation and visual representation.
 */
export const JourneyStatsWidgetPreview = ({entity}) => {
    // Global store access
    const $widgetStore = lgs.stores.ui.widget
    const widgetStore = useSnapshot($widgetStore)

    const $unitStore = lgs.settings.unitSystem
    const unitStore = useSnapshot($unitStore)
    const unitSystem = unitStore.current

    const $configuration = lgs.settings.widgets['journey-stats-widget'].configuration
    const configuration = useSnapshot($configuration)

    const $metrics = lgs.theJourney.metrics
    const metricsSnap = useSnapshot($metrics)

    // Configuration resolution
    const element = useMemo(() => {
        return configuration.elements?.[entity] ?? configuration.user ?? configuration.default
    }, [configuration, entity])

    // Calculation logic
    const journeyMetrics = useMemo(() => {
        if (!metricsSnap) {
            return null
        }
        return lgs.theJourney.getMetrics()
    }, [metricsSnap, unitSystem])

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[unitSystem],
        distance:  DISTANCE_UNITS[unitSystem],
        pace:      PACE_UNITS[unitSystem],
        speed:     SPEED_UNITS[unitSystem],
    }), [unitSystem])

    // Visual helpers
    const getColor = (item, alpha = false) => __.ui.ui.resolveItemColor(item, alpha)
    const previewBg = widgetStore.currentSnapshot?.image || null

    // Safety check for rotation
    const localRotation = Math.ceil(widgetStore.current?.rotate ?? 0)

    if (!journeyMetrics) {
        return null
    }

    return (
        <div
            className="journey-stats-widget-preview-surface"
            style={{
                background:         getColor(element.background),
                backgroundSize:     'cover',
                backgroundPosition: 'center',
                border:             element.border?.width ? `${element.border.width}px solid ${getColor(element.border.color)}` : 'none',
                boxShadow:          element.shadow?.active ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${getColor(element.shadow.color)}` : 'none',
            }}
        >
            <div
                className="journey-stats-widget-preview-chart"
                style={{'--lgs-journey-stats-preview-bg': previewBg ? `url(${previewBg})` : 'none'}}
            >
                <JourneyStats
                    metrics={journeyMetrics.metrics}
                    id={entity}
                    units={units}
                    style={{transform: `scale(0.8) rotate(${localRotation}deg)`}}
                />
            </div>
        </div>
    )
}