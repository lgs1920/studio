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
 * Last modified: 2026-11-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { WidgetPreviewContext } from '@Components/MainUI/widgets/WidgetContexts'
import { MapOverlaySurface } from '@Components/MainUI/MapOverlaySurface'
import { WaSpinner } from '@awesome.me/webawesome/dist/react'
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { resolveWidgetCatalogGroup } from '@Core/ui/widget-manager/resolveWidgetCatalogGroup'
import {
    filterReplayVideoWidgetKeys,
    getBasicReplayWidgetVisibility,
    getReplayVideoWidgetRegistrationId,
    getReplayVideoWidgetTypes,
} from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import {isJourneyReplayBasicMode} from '@Core/ui/replay/ReplayUserModeConstants'
import {resolveReplayTimelineWidgetIds} from '@Core/ui/replay/ReplayTimelinePersistence'
import { useOptionalSnapshot } from '@Utils/ValtioUtils'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSnapshot } from 'valtio'

const VIDEO_WIDGETS_CONTEXT_FALLBACK = {resizing: false}

/** Roll the previous widget label away as the next loading widget arrives. */
const RollingWidgetName = ({current, previous, revision}) => (
    <span className="video-widget-loading-name-roller" aria-hidden="true">
        {previous !== null && (
            <span key={`previous-${revision}`}
                  className="video-widget-loading-name-roller__label video-widget-loading-name-roller__label-out">
                {previous}
            </span>
        )}
        <span key={`current-${revision}`}
              className="video-widget-loading-name-roller__label video-widget-loading-name-roller__label-in">
            {current}
        </span>
    </span>
)

export const VideoSceneWidgetsPortal = memo(({context, hidden = false}) => {
    const list = useSnapshot(lgs.stores.ui.widget.list)
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const main = useOptionalSnapshot(lgs.stores.main)
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
    const widgetVisibility = getBasicReplayWidgetVisibility(main?.theJourney)
    const showBasicCompass = widgetVisibility.showCompass
    const showBasicProfile = widgetVisibility.showProfile
    const previewOnly = videoCaptureActive || synchronizedRecording
    const _rehydrateKey = useRef('')
    const allWidgetEntries = Array.from(list.entries())
        .filter(([, props]) => props?.widgetsBoard === VIDEO_WIDGETS_BOARD)
        .sort(([, a], [, b]) => (b.zIndex || 0) - (a.zIndex || 0))
    const widgetIdsForPolicy = [...allWidgetEntries]
        .sort(([, a], [, b]) => (a.zIndex || 0) - (b.zIndex || 0))
        .map(([widgetId]) => widgetId)
    const allowedWidgetIds = new Set(filterReplayVideoWidgetKeys(
        widgetIdsForPolicy,
        {basicReplay, widgetVisibility: {showCompass: showBasicCompass, showProfile: showBasicProfile}},
    ))
    const widgetEntries = allWidgetEntries
        .filter(([key]) => allowedWidgetIds.has(key))
    const widgetIds = widgetEntries.map(([key]) => key).join('|')

    const [boardElement, setBoardElement] = useState(null)
    const [boardReady, setBoardReady] = useState(false)
    const [loadingState, setLoadingState] = useState(() => ({widgets: new Map(), current: null, previous: null, revision: 0}))
    const [boardCenter, setBoardCenter] = useState(null)
    /** Keep a single centered status while handing off between pending widgets. */
    const handleWidgetLoadingChange = useCallback((widgetId, widgetName) => {
        setLoadingState(current => {
            const widgets = new Map(current.widgets)
            widgets.delete(widgetId)
            if (widgetName) {
                widgets.set(widgetId, widgetName)
            }
            const nextName = Array.from(widgets.values()).at(-1) ?? null
            const changed = nextName !== current.current
            return {
                widgets,
                current: nextName,
                previous: changed ? current.current : current.previous,
                revision: changed ? current.revision + 1 : current.revision,
            }
        })
    }, [])
    const {widgets: pendingWidgetLoads, current: activeLoadingWidget, previous: previousLoadingWidget, revision: loadingRevision} = loadingState

    useEffect(() => {
        if (!boardElement || pendingWidgetLoads.size === 0) {
            return undefined
        }

        /** Keep the status overlay centered on the live crop bounds. */
        const updateBoardCenter = () => {
            const rect = boardElement.getBoundingClientRect?.()
            if (!rect || rect.width <= 0 || rect.height <= 0) {
                setBoardCenter(null)
                return
            }

            const nextCenter = {left: rect.left + rect.width / 2, top: rect.top + rect.height / 2}
            setBoardCenter(current => current?.left === nextCenter.left && current?.top === nextCenter.top
                ? current
                : nextCenter)
        }

        const initialFrame = requestAnimationFrame(updateBoardCenter)

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(updateBoardCenter)
            : null
        resizeObserver?.observe(boardElement)
        document.addEventListener('onCropUpdate', updateBoardCenter)
        window.addEventListener('resize', updateBoardCenter)
        window.addEventListener('scroll', updateBoardCenter, true)

        return () => {
            resizeObserver?.disconnect()
            cancelAnimationFrame(initialFrame)
            document.removeEventListener('onCropUpdate', updateBoardCenter)
            window.removeEventListener('resize', updateBoardCenter)
            window.removeEventListener('scroll', updateBoardCenter, true)
        }
    }, [boardElement, pendingWidgetLoads.size])

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
        for (const widgetType of getReplayVideoWidgetTypes({
            basicReplay,
            widgetVisibility: {showCompass: showBasicCompass, showProfile: showBasicProfile},
        })) {
            const alreadyRegistered = registeredWidgetTypes.has(widgetType)
            if (!alreadyRegistered) {
                const widgetId = timelineWidgetIds.find(id => id.split('#')[0] === widgetType)
                    ?? getReplayVideoWidgetRegistrationId(widgetType, {basicReplay})
                const group = resolveWidgetCatalogGroup(widgetId, {widgetsBoard: VIDEO_WIDGETS_BOARD})
                if (!group) {
                    console.error(`[LGS1920][ReplayWidgets] No catalogue group found for ${widgetId}`)
                    continue
                }
                void renderer.renderWidget(group, widgetId, {
                    widgetsBoard: VIDEO_WIDGETS_BOARD,
                    forceRefresh: true,
                }).catch(error => {
                    console.error(`[LGS1920][ReplayWidgets] Failed to mount ${widgetType}`, error)
                })
            }
        }
    }, [boardReady, hidden, basicReplay, showBasicCompass, showBasicProfile, widgetIds])

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
                        onLoadingChange={handleWidgetLoadingChange}
                    />
                </div>
            ))}
            {activeLoadingWidget && boardCenter && (
                <MapOverlaySurface className="video-widget-loading-indicator lgs-on-map-theme-vars"
                     style={{left: `${boardCenter.left}px`, top: `${boardCenter.top}px`}}
                     role="status"
                     aria-live="polite"
                     aria-busy="true"
                     aria-label={`Loading ${String(activeLoadingWidget)} ...`}>
                    <WaSpinner aria-hidden="true"/>
                    <span className="video-widget-loading-message" aria-hidden="true">
                        <span>{'Loading '}</span>
                        <RollingWidgetName current={String(activeLoadingWidget)}
                            previous={previousLoadingWidget}
                            revision={loadingRevision}/>
                        <span>{' ...'}</span>
                    </span>
                </MapOverlaySurface>
            )}
            </div>
        </WidgetPreviewContext.Provider>,
        document.body,
    )
})

VideoSceneWidgetsPortal.displayName = 'VideoSceneWidgetsPortal'
