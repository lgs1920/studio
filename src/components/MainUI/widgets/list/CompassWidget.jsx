/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-14
 * Last modified: 2025-12-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Compass }                             from '@Components/cesium/CompassUI/Compass'
import { Widget }                              from '@Components/MainUI/widgets/Widget'
import { HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS } from '@Core/constants'
import React, { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                         from 'valtio'

/**
 * CompassWidget component to display a compass in the widget editor
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the widget
 * @param {Object} props.context - Valtio proxy context containing widgetsBoard and widgetEditor
 * @returns {JSX.Element|null} The compass widget or null if not in editor mode or container is not ready
 */
export const CompassWidget = ({id, context}) => {
    // Get snapshot of context
    const {widgetEditor, widgetsBoard} = useSnapshot(context ?? {widgetEditor: false, widgetsBoard: ''})
    const [_container, setContainer] = useState(null)

    // Set container when widgetsBoard changes
    useEffect(() => {
        const element = document.querySelector(`#${widgetsBoard}.defined`)
        setContainer(element)
    }, [widgetsBoard])

    // Memoize widget configuration
    const config = useMemo(() => {
        if (widgetEditor && _container) {
            return {
                container: _container,
                contextMenu: {
                    canReset:    true,
                    canPosition: true,
                    canRemove:   true,
                },
                top:       '0px',
                left:      '100%',
                type: LGS_VISUAL_WIDGET,
                group: MULTI_PURPOSE_WIDGETS,
                attachTo:  'right',
                scalable:  true,
                id,
                persist:   true,
                transient: true,
                dynamic:   true,
                ttl:       HOUR,
                min: {width: 50},
                max: {width: 300},
                snap: 'svg',
                margin: 0,
            }
        }

        return {}
    }, [widgetEditor, _container])

    // Render only when widgetEditor is true and container is defined
    if (!widgetEditor || !_container) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <Compass/>
        </Widget>
    )
}