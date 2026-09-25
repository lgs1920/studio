/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoSceneWidgetsPortal.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-28
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { WidgetPreviewContext } from '@Components/MainUI/widgets/Widget'
import { MULTI_PURPOSE_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {
    filterReplayVideoWidgetKeys,
    REPLAY_VIDEO_WIDGET_TYPES,
} from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSnapshot } from 'valtio'

export const VideoSceneWidgetsPortal = memo(({context, hidden = false}) => {
    const list = useSnapshot(lgs.stores.ui.widget.list)
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    // The editor can stay open while the video widgets are shown in preview.
    // Rehydration and invalidation must only run while an actual capture phase
    // is active, otherwise the portal loops during normal editor use.
    const videoCaptureActive = video.preRecording === true
                              || video.recording === true
                              || video.snapshot === true
                              || video.finalizing === true
    const synchronizedRecording = (video.recording === true || video.recordingHQ === true)
                                  && replay.recordingSync === true
    const previewOnly = videoCaptureActive || synchronizedRecording
    const restrictedWidgetPhase = videoCaptureActive || replay.simplePreparationActive === true
    const _rehydrateKey = useRef('')
    const allWidgetEntries = Array.from(list.entries())
        .filter(([, props]) => props?.widgetsBoard === VIDEO_WIDGETS_BOARD)
        .sort(([, a], [, b]) => (b.zIndex || 0) - (a.zIndex || 0))
    const widgetEntries = restrictedWidgetPhase
        ? allWidgetEntries.filter(([key]) => filterReplayVideoWidgetKeys([key]).length > 0)
        : allWidgetEntries
    const widgetIds = widgetEntries.map(([key]) => key).join('|')

    const [boardElement, setBoardElement] = useState(null)
    const [boardReady, setBoardReady] = useState(false)

    useEffect(() => {
        if (hidden || typeof document === 'undefined') {
            setBoardElement(null)
            return undefined
        }

        let cancelled = false
        let frame = null

        const resolveBoardElement = () => {
            if (cancelled) {
                return
            }

            const nextBoardElement = globalThis.__?.ui?.widgetManager?.resolveWidgetsBoardBoundsContainer?.(VIDEO_WIDGETS_BOARD)
                                    ?? document.querySelector(`#${VIDEO_WIDGETS_BOARD}.defined`)
            setBoardElement(current => current === nextBoardElement ? current : nextBoardElement)

            if (!nextBoardElement) {
                frame = requestAnimationFrame(resolveBoardElement)
            }
        }

        resolveBoardElement()

        return () => {
            cancelled = true
            if (frame) {
                cancelAnimationFrame(frame)
            }
        }
    }, [hidden])

    useEffect(() => {
        if (!boardElement || typeof document === 'undefined') {
            setBoardReady(false)
            return
        }

        let cancelled = false
        const updateBoardReady = () => {
            if (cancelled) {
                return
            }

            const rect = boardElement.getBoundingClientRect?.()
            const ready = Boolean(rect && rect.width > 0 && rect.height > 0)
            setBoardReady(current => current === ready ? current : ready)
        }

        updateBoardReady()

        const observer = typeof ResizeObserver !== 'undefined'
                         ? new ResizeObserver(updateBoardReady)
                         : null
        observer?.observe(boardElement)

        return () => {
            cancelled = true
            observer?.disconnect()
        }
    }, [boardElement])

    useEffect(() => {
        if (hidden || !boardReady || typeof document === 'undefined') {
            return
        }

        const renderer = WidgetDynamicRenderer.instance
        const registeredWidgetTypes = new Set(
            widgetIds.split('|').filter(Boolean).map(widgetId => widgetId.split('#')[0]),
        )
        for (const widgetType of REPLAY_VIDEO_WIDGET_TYPES) {
            const alreadyRegistered = registeredWidgetTypes.has(widgetType)
            if (!alreadyRegistered) {
                void renderer.renderWidget(MULTI_PURPOSE_WIDGETS, widgetType, {
                    widgetsBoard: VIDEO_WIDGETS_BOARD,
                    forceRefresh: true,
                }).catch(error => {
                    console.error(`[LGS1920][ReplayWidgets] Failed to mount ${widgetType}`, error)
                })
            }
        }
    }, [boardReady, hidden, widgetIds])

    useEffect(() => {
        if (!boardReady || hidden || !videoCaptureActive || !widgetIds) {
            return
        }

        // Une session de capture possède un seul cycle de vie du tableau.
        // Les étapes d'enregistrement et de finalisation ne doivent pas
        // reconstruire les mêmes widgets.
        const key = `${videoCaptureActive}-${boardReady}-${widgetIds}`
        if (_rehydrateKey.current === key) {
            return
        }
        _rehydrateKey.current = key

        __.ui.widgetManager.invalidateRuntimeByBoard(VIDEO_WIDGETS_BOARD)
        void __.ui.widgetManager.rehydrateWidgetsByBoard(VIDEO_WIDGETS_BOARD)
    }, [boardReady, hidden, videoCaptureActive, widgetIds])

    useEffect(() => {
        if (!videoCaptureActive) {
            _rehydrateKey.current = ''
            return undefined
        }

        return () => {
            __.ui.widgetManager.invalidateRuntimeByBoard(VIDEO_WIDGETS_BOARD)
        }
    }, [videoCaptureActive])

    if (hidden || typeof document === 'undefined' || widgetEntries.length === 0 || !boardElement || !boardReady) {
        return null
    }

    return createPortal(
        <WidgetPreviewContext.Provider value={previewOnly}>
            <div
            className={`video-scene-widgets-portal${previewOnly ? ' video-scene-widgets-portal-preview' : ''}${videoCaptureActive ? ' video-scene-widgets-portal-capture' : ''}${synchronizedRecording ? ' video-scene-widgets-portal-input-blocked' : ''}`}
            data-widgets-board={VIDEO_WIDGETS_BOARD}
            style={{
                position: 'fixed',
                inset: '0',
                pointerEvents: 'none',
                zIndex: 'var(--lgs-video-widgets-zindex)',
            }}
        >
            {widgetEntries.map(([key, props]) => (
                <div key={key} style={{pointerEvents: previewOnly ? 'none' : 'auto'}}>
                    <DynamicWidget
                        id={key}
                        props={props}
                        context={context}
                    />
                </div>
            ))}
            </div>
        </WidgetPreviewContext.Provider>,
        document.body,
    )
})

VideoSceneWidgetsPortal.displayName = 'VideoSceneWidgetsPortal'
