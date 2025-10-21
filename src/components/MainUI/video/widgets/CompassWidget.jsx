/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-21
 * Last modified: 2025-10-21
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Compass }                             from '@Components/cesium/CompassUI/Compass'
import { Widget }                                      from '@Components/MainUI/Widget'
import { HOUR, LGS_SNAP, VIDEO_ELEMENTS_WIDGET_GROUP } from '@Core/constants'
import React, { useEffect, useMemo, useState }         from 'react'
import { useSnapshot }                         from 'valtio'

/**
 * CompassWidget component to display a compass in the widget editor
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the widget
 * @param {Object} props.context - Valtio proxy context containing cropZone and widgetEditor
 * @returns {JSX.Element|null} The compass widget or null if not in editor mode or container is not ready
 */
export const CompassWidget = ({id, context}) => {
    // Get snapshot of context
    const {widgetEditor, cropZone} = useSnapshot(context)
    const [_container, setContainer] = useState(null)

    // Set container when cropZone changes
    useEffect(() => {
        const element = document.querySelector(`#${cropZone}.defined`)
        setContainer(element)
    }, [cropZone])

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
                type:      LGS_SNAP,
                group:     VIDEO_ELEMENTS_WIDGET_GROUP,
                attachTo:  'right',
                scalable:  true,
                id,
                persist:   true,
                transient: true,
                dynamic:   true,
                ttl:       HOUR,
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