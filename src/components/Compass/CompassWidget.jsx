/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidget.jsx
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

import { Compass }                                        from '@Components/MainUI/compass/Compass'
import { Widget }                                         from '@Components/MainUI/widgets/Widget'
import { HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS } from '@Core/constants'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { useMemo }             from 'react'

const COMPASS_WIDGET_CONTEXT_FALLBACK = {widgetEditor: false, widgetsBoard: ''}

/**
 * CompassWidget component to display a compass in the widget editor
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the widget
 * @param {Object} props.context - Valtio proxy context containing widgetsBoard and widgetEditor
 * @returns {JSX.Element|null} The compass widget or null if not in editor mode or container is not ready
 */
export const CompassWidget = ({id, context, zIndex, widgetsBoard: persistedWidgetsBoard}) => {
    // Get snapshot of context
    const contextState = useOptionalSnapshot(context, COMPASS_WIDGET_CONTEXT_FALLBACK)
    const widgetEditor = contextState.widgetEditor
    const widgetsBoard = contextState.widgetsBoard || persistedWidgetsBoard || ''
    const container = useMemo(() => __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard), [widgetsBoard])

    // Memoize widget configuration
    const config = useMemo(() => {
        return {
            container,
            contextMenu:  {
                canReset:    true,
                canPosition: true,
                canRemove:   true,
                canEdit:     true,
            },
            top:          '0px',
            left:         '100%',
            type:         LGS_VISUAL_WIDGET,
            group:        MULTI_PURPOSE_WIDGETS,
            attachTo:     'right',
            scalable:     true,
            id,
            persist:      true,
            transient:    true,
            dynamic:      true,
            ttl:          HOUR,
            min:          {width: 50},
            max:          {width: 300},
            snap:         'svg',
            margin:       0,
            widgetsBoard: widgetsBoard,
            zIndex:       zIndex,
        }
    }, [container, id, widgetsBoard, zIndex])

    // Render only when widgetEditor is true and container is defined
    if (!widgetEditor || !container) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <Compass inWidget entity={id}/>
        </Widget>
    )
}
