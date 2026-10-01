/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-07-14
 * Last modified: 2026-10-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Compass }                                        from '@Components/MainUI/compass/Compass'
import { Widget }                                         from '@Components/MainUI/widgets/Widget'
import { HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { useMemo }             from 'react'
import { useSnapshot }         from 'valtio'

const COMPASS_WIDGET_CONTEXT_FALLBACK = {widgetEditor: false, widgetsBoard: ''}

/**
 * CompassWidget component to display a compass in the widget editor
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the widget
 * @param {Object} props.context - Valtio proxy context containing widgetsBoard and widgetEditor
 * @returns {JSX.Element|null} The compass widget or null if not in editor mode or container is not ready
 */
export const CompassWidget = ({id, context, zIndex, widgetsBoard: persistedWidgetsBoard, detached = false}) => {
    // Get snapshot of context
    const contextState = useOptionalSnapshot(context, COMPASS_WIDGET_CONTEXT_FALLBACK)
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const widgetEditor = contextState.widgetEditor || detached
    const widgetsBoard = contextState.widgetsBoard || persistedWidgetsBoard || ''
    const fixedVideoCompass = widgetsBoard === VIDEO_WIDGETS_BOARD
    const simpleReplay = replay.simplePreparationActive === true
    const showDuringVideoCapture = widgetsBoard === VIDEO_WIDGETS_BOARD
        && (video.editing || video.preRecording || video.exporting || video.snapshot || video.finalizing)
    const container = useMemo(() => __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard), [widgetsBoard])

    // Memoize widget configuration
    const config = useMemo(() => {
        return {
            container,
            contextMenu:  {
                canReset:    !simpleReplay,
                canPosition: !fixedVideoCompass && !simpleReplay,
                canRemove:   !simpleReplay,
                canEdit:     true,
                canDetach:   !fixedVideoCompass,
            },
            canHide:      !simpleReplay,
            canLock:      !simpleReplay,
            top:          '0px',
            left:         fixedVideoCompass ? '0px' : '100%',
            type:         LGS_VISUAL_WIDGET,
            group:        MULTI_PURPOSE_WIDGETS,
            attachTo:     fixedVideoCompass ? 'top-left' : 'right',
            positionKey:  fixedVideoCompass ? 'video-crop-top-left-v2' : undefined,
            draggable:    !fixedVideoCompass && !simpleReplay,
            resizable:    !fixedVideoCompass && !simpleReplay,
            scalable:     !fixedVideoCompass && !simpleReplay,
            rotatable:    !fixedVideoCompass && !simpleReplay,
            snappable:    !simpleReplay,
            showControlBox: !fixedVideoCompass && !simpleReplay,
            id,
            persist:      true,
            transient:    true,
            dynamic:      true,
            ttl:          HOUR,
            // Crop resizing must not persist a temporary downscale for the fixed video compass.
            minScale:     fixedVideoCompass ? 1 : undefined,
            maxScale:     fixedVideoCompass ? 1 : undefined,
            min:          {width: 50},
            max:          {width: 300},
            snap:         'svg',
            margin:       fixedVideoCompass ? (lgs.gutter?.s ?? 8) : (lgs.gutter?.xs ?? 5),
            widgetsBoard: widgetsBoard,
            zIndex:       zIndex,
        }
    }, [container, fixedVideoCompass, id, simpleReplay, widgetsBoard, zIndex])

    // The Replay video portal owns this mandatory overlay and can render it
    // while editor/capture flags transition between Simple and Expert modes.
    if ((!fixedVideoCompass && !widgetEditor && !showDuringVideoCapture) || !container) {
        return null
    }

    return (
        <Widget isVisible={true} className="lgs-compass-widget" config={config}>
            <Compass inWidget entity={id}/>
        </Widget>
    )
}
