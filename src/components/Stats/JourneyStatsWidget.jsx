/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-20
 * Last modified: 2026-04-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                                                 from '@Components/MainUI/widgets/Widget'
import { JourneyStats }                                                           from '@Components/Stats/JourneyStats'
import { JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { DISTANCE_UNITS, ELEVATION_UNITS, PACE_UNITS, SPEED_UNITS }               from '@Utils/UnitUtils'
import React, { useEffect, useMemo, useState }                                    from 'react'
import { useSnapshot }                                                            from 'valtio'
import './style.css'

export const JourneyStatsWidget = ({id, context, zIndex}) => {
    /**
     * Early return if the journey is not defined to avoid unnecessary computations
     */
    if (!lgs.theJourney) {
        return null
    }

    const {widgetEditor, widgetsBoard} = context
    const journey = lgs.theJourney

    const $unitSystem = lgs.settings.unitSystem
    const {current: unitSystem} = useSnapshot($unitSystem)

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const journeyMetrics = useMemo(() => {
        if (!journey?.metrics) {
            return null
        }
        return {...journey.getMetrics()}
    }, [journey, unitSystem])

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
    }, [widgetsBoard])

    const metrics = useMemo(() => journeyMetrics?.metrics, [journeyMetrics])

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
            zIndex: zIndex,
        }
    }, [container, widgetsBoard, id, widgetEditor, zIndex])

    if (!widgetsBoard || Object.keys(config).length === 0) {
        return null
    }

    return (
        <Widget
            isVisible={true}
            config={config}
            key={journey.slug}
        >
            {metrics && (
                <JourneyStats
                    id={id}
                    metrics={metrics}
                    units={units}
                />
            )}
        </Widget>
    )
}