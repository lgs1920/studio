/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidgetPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JourneyStats }                                             from '@Components/Stats/JourneyStats'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS } from '@Utils/UnitUtils'
import { useOptionalSnapshot }                                      from '@Utils/ValtioUtils'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                                              from 'valtio'

/**
 * Preview component for Journey Stats.
 * Syncs initial rotation with widgetManager via async call and handles live updates.
 */
export const JourneyStatsWidgetPreview = ({entity, widgetKey = 'journey-stats-widget', mode = 'journey'}) => {
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
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

    /**
     * Priority to live Valtio store if selected, otherwise use fetched initial rotation
     */
    const isSelected = widget.current?.id === entity
    const activeRotation = isSelected && widget.current?.rotate !== undefined
                           ? Number(widget.current.rotate)
                           : initialRotation

    if (!journeySlug || !journey || !journeyMetrics) {
        return null
    }

    return (
        <div
            className="journey-stats-widget-preview-surface"
            style={{
                backgroundSize:     'cover',
                backgroundPosition: 'center',
                border:     element.border?.width ? `${element.border.width}px solid ${__.ui.ui.resolveItemColor(element.border, true)}` : 'none',
                boxShadow:  element.shadow?.active ? `${element.shadow.x}px ${element.shadow.y}px ${element.shadow.blur}px ${__.ui.ui.resolveItemColor(element.shadow, true)}` : 'none',
            }}
        >
            <div className="journey-stats-widget-preview-chart">
                <div style={{transform: `scale(0.8) rotate(${activeRotation}deg)`}}>
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
