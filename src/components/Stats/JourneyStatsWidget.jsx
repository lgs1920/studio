/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                                                 from '@Components/MainUI/widgets/Widget'
import { JourneyStats }                                                           from '@Components/Stats/JourneyStats'
import { JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { useManagedStylesheet }                                                   from '@Utils/useManagedStylesheet'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS }               from '@Utils/UnitUtils'
import { useMemo } from 'react'
import { useSnapshot }                                                            from 'valtio'
import journeyStatsStylesheetHref                                                 from './style.css?url'

const JOURNEY_STATS_WIDGET_CONTEXT_FALLBACK = {widgetsBoard: ''}
const JOURNEY_STATS_WIDGET_STYLESHEET_ID = 'journey-stats-widget'

export const JourneyStatsWidget = ({
    id,
    context,
    zIndex,
    widgetsBoard: persistedWidgetsBoard,
    mode = 'journey',
    widgetKey = 'journey-stats-widget',
}) => {
    useManagedStylesheet(JOURNEY_STATS_WIDGET_STYLESHEET_ID, journeyStatsStylesheetHref)

    const contextState = useOptionalSnapshot(context, JOURNEY_STATS_WIDGET_CONTEXT_FALLBACK)
    const video = useSnapshot(lgs.stores.ui.video)
    const widgetsBoard = contextState.widgetsBoard
                         || persistedWidgetsBoard
                         || (video.editing || video.preRecording || video.recording || video.snapshot || video.finalizing
                             ? VIDEO_WIDGETS_BOARD
                             : '')
    const main = useSnapshot(lgs.stores.main)
    const journey = lgs.theJourney
    const journeySlug = main.theJourney?.slug ?? null

    const $unitSystem = lgs.settings.unitSystem
    const {current: unitSystem} = useSnapshot($unitSystem)

    const journeyMetrics = useMemo(() => {
        if (!journeySlug || !journey?.metrics) {
            return null
        }

        return {...journey.getMetrics()}
    }, [journey, journeySlug])

    const units = useMemo(() => ({
        elevation: ELEVATION_UNITS[unitSystem],
        distance:  DISTANCE_UNITS[unitSystem],
        pace:      PACE_UNITS[unitSystem],
        speed: SPEED_UNITS[unitSystem],
    }), [unitSystem])

    const container = useMemo(() => {
        return __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard) ?? lgs.canvas
    }, [widgetsBoard])

    const metrics = useMemo(() => journeyMetrics?.metrics ?? null, [journeyMetrics])

    const config = useMemo(() => {
        return {
            container:       container,
            contextMenu:     {
                canReset:    true,
                canEdit: true,
                canRemove:   true,
                canPosition: true,
                canSnapshot: true,
            },
            width:           400,
            top:             '0%',
            left:            '50%',
            type:            LGS_VISUAL_WIDGET,
            group:           widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
            margin:          lgs.gutter?.xs ?? 5,
            attachTo:        'top',
            scalable:        true,
            rotatable:       true,
            id,
            min: {width: 50},
            max: {width: 1000},
            persist:         true,
            transient:       true,
            mandatory:       false,
            stopPropagation: false,
            snap:            false,
            captureWholeWidget: true,
            // Dynamic Stats refreshes are scheduled by JourneyStats after its layout pass.
            refreshMode:     mode === 'dynamic' ? 'manual' : undefined,
            widgetsBoard:    widgetsBoard,
            zIndex: zIndex,
        }
    }, [container, widgetsBoard, id, mode, zIndex])

    const isVisible = useMemo(() => {
        if (!widgetsBoard) {
            return false
        }

        return true
    }, [widgetsBoard])

    if (!journeySlug || !journey || !widgetsBoard || Object.keys(config).length === 0 || !isVisible) {
        return null
    }

    return (
        <Widget
            isVisible={isVisible}
            config={config}
            key={journeySlug}
        >
            <JourneyStats
                id={id}
                metrics={metrics}
                units={units}
                mode={mode}
                widgetKey={widgetKey}
                widgetsBoard={widgetsBoard}
            />
        </Widget>
    )
}
