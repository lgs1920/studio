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
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { WidgetPreviewContext } from '@Components/MainUI/widgets/WidgetContexts'
import { MULTI_PURPOSE_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {
    filterReplayVideoWidgetKeys,
    getReplayVideoWidgetTypes,
} from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import {isJourneyReplayBasicMode} from '@Core/ui/replay/ReplayUserModeConstants'
import {resolveReplayTimelineWidgetIds} from '@Core/ui/replay/ReplayTimelinePersistence'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSnapshot } from 'valtio'

const VIDEO_WIDGETS_CONTEXT_FALLBACK = {resizing: false}

export const VideoSceneWidgetsPortal = memo(({context, hidden = false}) => {
    const list = useSnapshot(lgs.stores.ui.widget.list)
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const cropperState = useOptionalSnapshot(context, VIDEO_WIDGETS_CONTEXT_FALLBACK)
    // The editor can stay open while the video widgets are shown in preview.
    // Rehydration and invalidation must only run while an actual capture phase
    // is active, otherwise the portal loops during normal editor use.
    const videoCaptureActive = video.preRecording === true
                              || video.exporting === true
                              || video.snapshot === true
                              || video.finalizing === true
    const synchronizedRecording = video.exporting === true
                                  && replay.recordingSync === true
    const basicReplay = isJourneyReplayBasicMode({replay})
    const previewOnly = videoCaptureActive || synchronizedRecording
    const _rehydrateKey = useRef('')
    const allWidgetEntries = Array.from(list.entries())
        .filter(([, props]) => props?.widgetsBoard === VIDEO_WIDGETS_BOARD)
        .sort(([, a], [, b]) => (b.zIndex || 0) - (a.zIndex || 0))
    const allowedWidgetIds = new Set(filterReplayVideoWidgetKeys(
        allWidgetEntries.map(([widgetId]) => widgetId),
        {basicReplay},
    ))
    const widgetEntries = allWidgetEntries
        .filter(([key]) => allowedWidgetIds.has(key))
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

        const queueBoardResolution = () => {
            if (cancelled || frame) {
                return
            }

            frame = requestAnimationFrame(() => {
                frame = null
                resolveBoardElement()
            })
        }

        const resolveBoardElement = () => {
            if (cancelled) {
                return
            }

            const nextBoardElement = globalThis.__?.ui?.widgetManager?.resolveWidgetsBoardBoundsContainer?.(VIDEO_WIDGETS_BOARD)
                                    ?? document.querySelector(`#${VIDEO_WIDGETS_BOARD}.defined`)
            setBoardElement(current => current === nextBoardElement ? current : nextBoardElement)

            if (nextBoardElement && frame) {
                cancelAnimationFrame(frame)
                frame = null
            }
            else if (!nextBoardElement) {
                queueBoardResolution()
            }
        }

        const observer = new MutationObserver(resolveBoardElement)
        observer.observe(document.body, {childList: true, subtree: true})
        resolveBoardElement()

        return () => {
            cancelled = true
            observer.disconnect()
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
        const timeline = lgs.stores.replay.preparationTimeline ?? lgs.theJourney?.replay?.videoTimeline
        const timelineWidgetIds = [
            ...(timeline?.widgetManifest ?? []),
            ...resolveReplayTimelineWidgetIds(timeline?.tracks),
        ]
        for (const widgetType of getReplayVideoWidgetTypes({basicReplay})) {
            const alreadyRegistered = registeredWidgetTypes.has(widgetType)
            if (!alreadyRegistered) {
                const widgetId = timelineWidgetIds.find(id => id.split('#')[0] === widgetType) ?? widgetType
                void renderer.renderWidget(MULTI_PURPOSE_WIDGETS, widgetId, {
                    widgetsBoard: VIDEO_WIDGETS_BOARD,
                    forceRefresh: true,
                }).catch(error => {
                    console.error(`[LGS1920][ReplayWidgets] Failed to mount ${widgetType}`, error)
                })
            }
        }
    }, [boardReady, hidden, basicReplay, widgetIds])

    useEffect(() => {
        if (!boardReady || hidden || !videoCaptureActive || !widgetIds) {
            return
        }

        // Keep mounted widget runtimes intact while refreshing persisted positions once per capture.
        if (_rehydrateKey.current) {
            return
        }
        _rehydrateKey.current = 'active'

        void __.ui.widgetManager.rehydrateWidgetsByBoard(VIDEO_WIDGETS_BOARD)
    }, [boardReady, hidden, videoCaptureActive, widgetIds])

    useEffect(() => {
        if (!videoCaptureActive) {
            _rehydrateKey.current = ''
        }
    }, [videoCaptureActive])

    if (hidden || typeof document === 'undefined' || widgetEntries.length === 0 || !boardElement || !boardReady) {
        return null
    }

    return createPortal(
        <WidgetPreviewContext.Provider value={previewOnly}>
            <div
            className={`video-scene-widgets-portal${previewOnly ? ' video-scene-widgets-portal-preview' : ''}${videoCaptureActive ? ' video-scene-widgets-portal-capture' : ''}${synchronizedRecording ? ' video-scene-widgets-portal-input-blocked' : ''}${cropperState.resizing ? ' video-scene-widgets-portal-resizing' : ''}`}
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
