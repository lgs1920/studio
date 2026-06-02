/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                                                 from '@Components/MainUI/widgets/Widget'
import { EditableText }                                                           from '@Components/Text/EditableText'
import { JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { useMemo }             from 'react'
import './style.css'

const TEXT_WIDGET_CONTEXT_FALLBACK = {widgetEditor: false, widgetsBoard: ''}

export const TextWidget = ({id, context, zIndex, widgetsBoard: persistedWidgetsBoard}) => {
    const contextState = useOptionalSnapshot(context, TEXT_WIDGET_CONTEXT_FALLBACK)
    const widgetsBoard = contextState.widgetsBoard || persistedWidgetsBoard || ''
    const container = useMemo(() => __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard) ?? lgs.canvas, [widgetsBoard])

    /**
     * Prepares and memoizes the data required for the profile chart.
     * Recalculates if profile.key changes (signaling a journey change or reset) or if unit system changes.
     * @returns {object | undefined} The prepared data for the chart.
     */

    /**
     * Memoizes the configuration object required for the generic Widget component.
     * This logic determines widget grouping, positioning, and persistence settings based on the context.
     */
    const config = useMemo(() => {
        return {
            container:       container,
            contextMenu:     {
                canReset:    true,
                canEdit:     true,
                canRemove:   true,
                canPosition: true,
            },
            top:             '50%',
            left:            '50%',
            type:            LGS_VISUAL_WIDGET,
            group:           widgetsBoard === SCENE_WIDGETS_BOARD ? SCENE_WIDGETS : JOURNEY_WIDGETS,
            margin:          5,
            attachTo: 'center',
            scalable:        true,
            rotatable:       true,
            id,
            min:             {width: 25},
            max:             {width: 900},
            persist:         true,
            transient:       true,
            mandatory:       false,
            stopPropagation: false,
            snap:            false,
            widgetsBoard:    widgetsBoard,
            zIndex: zIndex,
        }
    }, [container, widgetsBoard, id, zIndex]) // Include all dependencies to ensure accurate recalculation

    // Safety check: if the board is missing or the config generation failed, return null.
    // We check Object.keys(config).length for cases where config returned {} inside useMemo.
    if (!widgetsBoard || Object.keys(config).length === 0) {
        return null
    }

    // Render the generic Widget wrapper with the determined config
    return (
        <Widget isVisible={true} config={config}>
            <EditableText id={id}/>
        </Widget>
    )
}
