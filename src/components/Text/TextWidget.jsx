/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-14
 * Last modified: 2026-06-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                                                 from '@Components/MainUI/widgets/Widget'
import { EditableText }                                                           from '@Components/Text/EditableText'
import { JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import React, { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                         from 'valtio'
import './style.css'

export const TextWidget = ({id, context, zIndex}) => {
    // Destructure context properties used as dependencies
    const {widgetEditor, widgetsBoard} = context

    /**
     * Snapshot of the video state (included for completeness).
     * @type {object}
     */
    const video = useSnapshot(lgs.stores.ui.video)

    /**
     * State for the container element where the widget should attach.
     * Initialized to the global canvas element (default attach point).
     * @type {[HTMLElement, React.Dispatch<React.SetStateAction<HTMLElement>>]}
     */
    const [container, setContainer] = useState(lgs.canvas)

    /**
     * Updates the container element reference when the widget board changes.
     * If the board is not the main scene board, it looks up the specific board element.
     */
    useEffect(() => {
        if (widgetsBoard && widgetsBoard !== SCENE_WIDGETS_BOARD) {
            // Find the board element using its ID and the 'defined' class for safety
            const element = document.querySelector(`#${widgetsBoard}.defined`)
            if (element) {
                setContainer(element)
            }
        }
    }, [widgetsBoard]) // Re-run only when the board ID changes

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
    }, [widgetEditor, container, widgetsBoard, id, zIndex]) // Include all dependencies to ensure accurate recalculation

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
