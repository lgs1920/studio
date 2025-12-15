/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CreditsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-16
 * Last modified: 2025-12-16
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { CreditsBar }                          from '@Components/MainUI/credits/CreditsBar'
import { Widget }                              from '@Components/MainUI/widgets/Widget'
import { HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS } from '@Core/constants'
import React, { useEffect, useMemo, useState } from 'react'
import { useSnapshot } from 'valtio'

/**
 * CreditsWidget component to display a compass in the widget editor
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the widget
 * @param {Object} props.context - Valtio proxy context containing widgetsBoard and widgetEditor
 * @returns {JSX.Element|null} The credits widget or null if not in editor mode or container is not ready
 */
export const CreditsWidget = ({id, context}) => {
    // Get snapshot of context
    const {widgetEditor, widgetsBoard} = useSnapshot(context ?? {widgetEditor: false, widgetsBoard: ''})
    const [_container, setContainer] = useState(null)
    console.log(widgetsBoard)
    // Set container when widgetsBoard changes
    useEffect(() => {
        const element = document.querySelector(`#${widgetsBoard}.defined`)
        setContainer(element)
    }, [widgetsBoard])

    // Memoize widget configuration
    const config = useMemo(() => {
        return {
            container:       _container,
            contextMenu:     {
                canReset:    false,
                canMaximize: false,
                canPosition: true,
            },
            top:             '100%',
            left:            '0px',
            type:            LGS_VISUAL_WIDGET,
            group:           MULTI_PURPOSE_WIDGETS,
            margin:          5,
            attachTo:        'bottom',
            scalable:        false,
            id,
            persist:         true,
            transient:       true,
            dynamic:         true,
            ttl:             HOUR,
            mandatory:       true,
            stopPropagation: true,
            widgetsBoard:    widgetsBoard,
        }

        return {}
    }, [widgetEditor, _container])

    // Render only when widgetEditor is true and container is defined
    if (!widgetEditor || !_container) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <CreditsBar/>
        </Widget>
    )
}