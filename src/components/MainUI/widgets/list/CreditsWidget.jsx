/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CreditsWidget.jsx
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

import { CreditsBar }                          from '@Components/MainUI/credits/CreditsBar'
import { Widget }                              from '@Components/MainUI/widgets/Widget'
import { HOUR, LGS_VISUAL_WIDGET, MULTI_PURPOSE_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { useEffect, useMemo, useRef } from 'react'
import { useSnapshot } from 'valtio'

const CREDITS_WIDGET_CONTEXT_FALLBACK = {widgetEditor: false, widgetsBoard: ''}
const CREDITS_WIDGET_MIN_SCALE = 0.8
const CREDITS_WIDGET_MAX_SCALE = 2

/**
 * CreditsWidget component to display a compass in the widget editor
 * @param {Object} props - Component props
 * @param {string} props.id - Unique identifier for the widget
 * @param {Object} props.context - Valtio proxy context containing widgetsBoard and widgetEditor
 * @returns {JSX.Element|null} The credits widget or null if not in editor mode or container is not ready
 */
export const CreditsWidget = ({id, context, zIndex, widgetsBoard: persistedWidgetsBoard}) => {
    // Get snapshot of context
    const contextState = useOptionalSnapshot(context, CREDITS_WIDGET_CONTEXT_FALLBACK)
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const widgetEditor = contextState.widgetEditor
    const widgetsBoard = contextState.widgetsBoard || persistedWidgetsBoard || ''
    const isHqExporting = replay.deferredExportPlan?.runtime?.status === 'exporting'
    const showDuringDraftRecording = widgetsBoard === VIDEO_WIDGETS_BOARD
        && (video.preRecording || video.recording)
        && !isHqExporting
    const shouldRender = widgetEditor || showDuringDraftRecording
    const _content = useRef(null)
    const container = useMemo(
        () => __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard),
        [widgetsBoard],
    )

    useEffect(() => {
        if (!shouldRender || !container || !_content.current) {
            return
        }

        const updateRect = () => {
            requestAnimationFrame(() => {
                __.ui.widgetManager.getMoveable(id)?.current?.updateRect()
            })
        }

        const observer = new ResizeObserver(updateRect)
        observer.observe(_content.current)

        const images = Array.from(_content.current.querySelectorAll('img'))
        images.forEach((image) => {
            if (!image.complete) {
                image.addEventListener('load', updateRect)
                image.addEventListener('error', updateRect)
            }
        })

        updateRect()

        return () => {
            observer.disconnect()
            images.forEach((image) => {
                image.removeEventListener('load', updateRect)
                image.removeEventListener('error', updateRect)
            })
        }
    }, [container, id, shouldRender])

    // Memoize widget configuration
    const config = useMemo(() => {
        return {
            container,
            contextMenu:     {
                canReset:    true,
                canMaximize: false,
                canPosition: false,
            },
            top:             '100%',
            left:            '0px',
            type:            LGS_VISUAL_WIDGET,
            group:           MULTI_PURPOSE_WIDGETS,
            margin:          5,
            attachTo:        'bottom-left',
            anchorOnScale:   'bottom-left',
            draggable:       false,
            minScale:        CREDITS_WIDGET_MIN_SCALE,
            maxScale:        CREDITS_WIDGET_MAX_SCALE,
            resizable:       false,
            scalable:        true,
            showControlBox:  true,
            canLock:         false,
            id,
            persist:         true,
            transient:       true,
            dynamic:         true,
            ttl:             HOUR,
            mandatory:       true,
            stopPropagation: true,
            widgetsBoard:    widgetsBoard,
            zIndex:          zIndex ?? 10000,
        }
    }, [container, id, widgetsBoard, zIndex])

    // Render in widget editor and during draft recording capture.
    if (!shouldRender || !container) {
        return null
    }

    return (
        <Widget isVisible={true} config={config}>
            <CreditsBar contentRef={_content} widgetMode showMainLogo={false}/>
        </Widget>
    )
}
