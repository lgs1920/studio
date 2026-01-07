/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TextWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-07
 * Last modified: 2026-01-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Widget }                                                                 from '@Components/MainUI/widgets/Widget'
import { EditableText }                                                           from '@Components/Text/EditableText'
import { JOURNEY_WIDGETS, LGS_VISUAL_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD } from '@Core/constants'
import React, { useEffect, useMemo, useState }                                    from 'react'
import { useSnapshot }                                                            from 'valtio'
import './style.css'

export const TextWidget = ({id, context}) => {
    // Destructure context properties used as dependencies
    const {widgetEditor, widgetsBoard} = context

    /**
     * Proxy for the profile component state, used to update values.
     * Accessible only inside the component to prevent initial mounting errors.
     * @type {{show: boolean, key: string}}
     */
    const $profile = lgs.stores.main.components.profile
    /**
     * Proxy for the video UI state (example of deep store access).
     * @type {object}
     */
    const $video = lgs.stores.ui.video

    /**
     * Snapshot of the profile state, triggering re-renders on change (e.g., when profile.key changes).
     * @type {{key: string}}
     */
    const profile = useSnapshot($profile)

    /**
     * Snapshot of the video state (included for completeness).
     * @type {object}
     */
    const video = useSnapshot($video)

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
            attachTo:        'center',
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
        }
    }, [widgetEditor, container, widgetsBoard, id]) // Include all dependencies to ensure accurate recalculation

    // Safety check: if the board is missing or the config generation failed, return null.
    // We check Object.keys(config).length for cases where config returned {} inside useMemo.
    if (!widgetsBoard || Object.keys(config).length === 0) {
        return null
    }

    console.log(id)
    // Render the generic Widget wrapper with the determined config
    return (
        <Widget isVisible={true} config={config}>
            <EditableText id={id}/>
        </Widget>
    )
}