/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayTimelinePreview.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-09-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay Timeline preview for linked video preparation.
 *
 * The application provides the initial widget and clip projection. Timeline
 * edits remain local to the timeline until an explicit output adapter is
 * introduced.
 */

import {forwardRef, useEffect, useImperativeHandle, useMemo, useRef} from 'react'
import {subscribe, useSnapshot} from 'valtio'
import {
    CREDITS_WIDGET,
    LOGO_WIDGET,
    REPLAY_RECORDING_MONITOR_WIDGET_ID,
    REPLAY_TIMELINE_WIDGET,
    VIDEO_WIDGETS_BOARD,
} from '@Core/constants'
import {REPLAY_TIMELINE_COLOR_SWATCHES, REPLAY_TIMELINE_UI} from './replayTimelineUtils'
import {VideoRecordingSettingsToolbar} from './toolbox/VideoRecordingSettingsToolbar'
import {
    buildReplayPreparationTimeline,
    toReplayTimelineEditorData,
} from '@Core/ui/replay/ReplayPreparationTimeline'
import {
    groupWidgetEntries,
} from '@Core/ui/widget-manager/WidgetGroupUtils'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import '../../../webcomponents/lgs1920-timeline/LGS1920Timeline.js'
import './replay-timeline-preview.css'

const DEFAULT_REPLAY_DURATION_MILLIS = 60_000
const REPLAY_CAPTURE_FPS = [30, 45, 60, 15]

const getReplayTimelineDebugStage = () => {
    if (typeof window !== 'undefined') {
        const parameters = new URLSearchParams(window.location.search)
        if (parameters.get('lgs-empty-timeline') === '1') return 'widget'
        const requestedStage = parameters.get('lgs-timeline-stage')
        if (['host', 'surface', 'track', 'clip', 'data', 'full'].includes(requestedStage)) return requestedStage
    }
    return 'full'
}

/**
 * Resolve the clip configuration used by the Replay runtime before playback.
 *
 * Journey-specific clip instances take precedence over the transient store,
 * while the settings catalogue remains the source of clip definitions.
 *
 * @param {Object} replay - Replay store snapshot.
 * @param {Object|null} journey - Current journey snapshot.
 * @param {Object} settingsClips - Reactive Replay clip settings snapshot.
 * @returns {Object} Clip configuration accepted by the shared timeline builder.
 */
const resolvePreparationClips = (replay, journey, settingsClips = {}) => {
    const replayClips = replay?.clips ?? {}
    const catalog = Object.keys(replayClips.catalog ?? {}).length > 0
        ? replayClips.catalog
        : settingsClips.catalog ?? {}
    const start = Array.isArray(journey?.replay?.start)
        ? journey.replay.start
        : (replayClips.start ?? settingsClips.start ?? [])
    const stop = Array.isArray(journey?.replay?.stop)
        ? journey.replay.stop
        : (replayClips.stop ?? settingsClips.stop ?? [])

    return {catalog, start, stop}
}

/**
 * Resolve the capture frame rate used to build the preparation projection.
 *
 * @param {Object} video - Video store snapshot.
 * @param {Object} replay - Replay store snapshot.
 * @returns {number} Positive capture frame rate.
 */
const resolveCaptureFps = (video, replay) => {
    const candidates = [
        replay?.captureFps,
        REPLAY_CAPTURE_FPS[video?.fps],
        30,
    ]
    return candidates.find(candidate => Number.isFinite(Number(candidate)) && Number(candidate) > 0) ?? 30
}

/**
 * Resolve the replay-only duration for preparation.
 *
 * @param {Object} replay - Replay store snapshot.
 * @param {Object} replaySettings - Reactive Replay settings snapshot.
 * @returns {number} Replay duration in milliseconds.
 */
const resolveReplayDurationMillis = (replay, replaySettings = {}) => {
    const candidates = [
        replay?.deferredExportPlan?.videoTimeline?.replayDurationMillis,
        Number(replay?.duration) * 1000,
        Number(replaySettings?.duration) * 1000,
        DEFAULT_REPLAY_DURATION_MILLIS,
    ]
    return candidates.find(candidate => Number.isFinite(Number(candidate)) && Number(candidate) > 0)
           ?? DEFAULT_REPLAY_DURATION_MILLIS
}

/**
 * Resolve the current logical timeline time from the canonical published frame.
 *
 * @param {Object} replay - Replay store snapshot.
 * @param {Object} projection - Timeline projection.
 * @returns {number} Current logical time in milliseconds.
 */
const resolveCurrentTimeMillis = (replay, projection) => {
    const frame = replay?.dynamicFrameState ?? replay?.resolvedFrameState ?? null
    const timeMillis = Number(frame?.frameTimeMs ?? frame?.phase?.frameTimeMs ?? 0)
    return Math.max(0, Math.min(projection.durationMillis, Number.isFinite(timeMillis) ? timeMillis : 0))
}

/**
 * Check whether Replay has a published frame that can replace the local time.
 *
 * @param {Object} replay - Replay store.
 * @returns {boolean} Whether a canonical frame is available.
 */
const hasPublishedReplayFrame = replay => replay?.dynamicFrameState != null
    || replay?.resolvedFrameState != null

/**
 * Wait until a timeline element created in an external document has upgraded.
 *
 * React renders the PiP portal before the external window bootstrap module can
 * register the custom element. The element therefore needs one registry and
 * one animation frame from its owning document before controlled properties
 * are assigned.
 *
 * @param {HTMLElement} element - Timeline host to await.
 * @returns {Promise<void>} Promise resolved after the element is ready.
 */
const waitForTimelineElementReady = async element => {
    const view = element?.ownerDocument?.defaultView
    const registry = view?.customElements
    if (typeof registry?.whenDefined === 'function') {
        await registry.whenDefined('lgs1920-timeline')
    }
    await new Promise(resolve => {
        if (typeof view?.requestAnimationFrame === 'function') {
            view.requestAnimationFrame(resolve)
            return
        }
        resolve()
    })
}

/**
 * Resolve a widget definition from the loaded settings or registry.
 *
 * @param {string} type - Widget base type.
 * @param {Object} widgetSettings - Snapshot of widget catalogue settings.
 * @returns {Object|null} Widget definition.
 */
const resolveWidgetDefinition = (type, widgetSettings) => widgetSettings?.[type]
    ?? globalThis.__?.widgets?.get?.(type)
    ?? null

/**
 * Resolve the visible label for a widget instance.
 *
 * @param {string} id - Widget instance identifier.
 * @param {string} type - Widget base type.
 * @param {Object} definition - Widget catalog definition.
 * @returns {string} Widget label.
 */
const resolveWidgetLabel = (id, type, definition) => {
    const element = definition?.configuration?.elements?.[id]
        ?? definition?.configuration?.user
        ?? definition?.configuration?.default
    if (type === 'text-widget') {
        return String(element?.text?.content ?? '').trim() || definition?.name || type
    }
    return definition?.name ?? type
}

/**
 * Convert the video widget store into canonical bottom-to-top track order.
 *
 * @param {Map} widgetList - Reactive widget list snapshot.
 * @param {Object} widgetSettings - Snapshot of widget catalogue settings.
 * @returns {Array} Video widget track definitions.
 */
const resolveVideoWidgetOrder = (widgetList, widgetSettings) => {
    const definitions = Array.from(widgetList ?? [])
    .filter(([id, entry]) => {
        const widgetType = id.split('#')[0]
        return entry?.widgetsBoard === VIDEO_WIDGETS_BOARD
            && widgetType !== REPLAY_TIMELINE_WIDGET
            && widgetType !== REPLAY_RECORDING_MONITOR_WIDGET_ID
            && Boolean(resolveWidgetDefinition(widgetType, widgetSettings))
    })
    .sort(([leftId, left], [rightId, right]) => {
        const leftType = leftId.split('#')[0]
        const rightType = rightId.split('#')[0]
        const leftFixed = leftType === CREDITS_WIDGET || leftType === LOGO_WIDGET
        const rightFixed = rightType === CREDITS_WIDGET || rightType === LOGO_WIDGET
        if (leftFixed !== rightFixed) {
            return leftFixed ? 1 : -1
        }
        const leftZ = Number(left?.zIndex)
        const rightZ = Number(right?.zIndex)
        if (Number.isFinite(leftZ) && Number.isFinite(rightZ) && leftZ !== rightZ) {
            return leftZ - rightZ
        }
        if (Number.isFinite(leftZ) !== Number.isFinite(rightZ)) {
            return Number.isFinite(leftZ) ? -1 : 1
        }
        return leftId.localeCompare(rightId)
    })
    .map(([id, entry]) => {
        const widgetType = id.split('#')[0]
        const definition = resolveWidgetDefinition(widgetType, widgetSettings)
        const runtimeConfig = globalThis.__?.ui?.widgetManager?.getWidgetConfig?.(id)
        return {
            id,
            type: widgetType,
            label: resolveWidgetLabel(id, widgetType, definition),
            icon: definition?.icon ?? 'puzzle-piece',
            timelineColor: definition?.timelineColor,
            canHide: (definition?.canHide === true || runtimeConfig?.canHide === true)
                     && definition?.mandatory !== true
                     && runtimeConfig?.mandatory !== true,
            visible: entry?.visible !== false && runtimeConfig?.visible !== false,
            widgetGroup: entry?.widgetGroup ?? null,
            widgetGroupLabel: entry?.widgetGroupLabel ?? null,
            editable: widgetType !== CREDITS_WIDGET
                && widgetType !== LOGO_WIDGET
                && entry?.editable !== false
                && runtimeConfig?.editable !== false,
            widgetId: id,
        }
    })

    return groupWidgetEntries(definitions).map(widget => {
        if (!widget.isGroup) {
            return widget
        }

        const firstMember = widget.members[0]
        return {
            ...widget,
            type: 'widget-group',
            label: widget.label ?? firstMember?.label ?? 'Widget',
            icon: 'layer-group',
            timelineColor: firstMember?.timelineColor,
            canHide: widget.members.some(member => member.canHide),
            visible: widget.members.every(member => member.visible !== false),
            editable: widget.members.every(member => member.editable !== false),
            widgetIds: widget.members.map(member => member.id),
        }
    })
}

/**
 * Convert existing Replay editor rows to the public Web Component model.
 *
 * The source projection remains owned by Replay. Replay's mandatory track
 * remains the controlled source for the projected widget tracks.
 *
 * @param {Array} rows - Existing Replay timeline rows.
 * @returns {Array} Public Web Component track definitions.
 */
const toDisplayTracks = rows => rows.map(row => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    widgetGroup: row.widgetGroup ?? null,
    widgetId: row.widgetId ?? (row.isGroup ? null : row.id),
    widgetIds: row.widgetIds ?? (row.isGroup ? [] : [row.id]),
    colorClasses: row.colorClasses,
    visible: row.visible,
    editable: row.editable !== false,
    canHide: row.canHide === true,
    droppable: row.droppable !== false,
    clips: (row.actions ?? []).map(action => ({
        id: action.id,
        kind: action.kind,
        label: action.label,
        icon: action.icon,
        colorClasses: action.colorClasses,
        visible: action.visible,
        editable: row.editable !== false && action.editable !== false,
        start: action.start,
        end: action.end,
        resizable: action.resizable !== false,
        metadata: {
            clip: action.clip,
            widgetId: action.widgetId,
        },
    })),
}))

/**
 * Replay Timeline preview component.
 *
 * Replay remains the owner of preparation state and playback. The Web
 * Component exposes the local timeline interactions and emits their public
 * events; application controllers can be connected incrementally.
 *
 * @param {Object} props - Preview properties.
 * @param {boolean} [props.keyboardZoomActive=false] - Enables selected-widget keyboard zoom.
 * @param {boolean} [props.detached=false] - Waits for the external custom-element registry before applying state.
 * @returns {JSX.Element|null} Preview surface or null outside linked preparation.
 */
export const ReplayTimelinePreview = forwardRef(({keyboardZoomActive = false, detached = false}, ref) => {
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const main = useSnapshot(lgs.stores.main)
    const widgetList = useSnapshot(lgs.stores.ui.widget.list)
    const widgetSettings = useOptionalSnapshot(lgs.settings?.widgets, {})
    const replaySettings = useOptionalSnapshot(lgs.settings?.ui?.replay, {})
    const _timeline = useRef(null)
    const journey = main?.theJourney ?? lgs.theJourney
    const widgetOrder = useMemo(() => resolveVideoWidgetOrder(widgetList, widgetSettings), [widgetList, widgetSettings])

    const linkedPreparation = video.editing === true
                               && video.timelinePreviewActive === true
                               && replay.recordingSync === true
                               && !video.preRecording
                               && !video.recording
                               && !video.recordingHQ
                               && !video.finalizing

    const projectionReplay = useMemo(() => ({
        deferredExportPlan: replay.deferredExportPlan,
        duration: replay.duration,
        captureFps: replay.captureFps,
        direction: replay.direction,
        clips: replay.clips,
    }), [replay.deferredExportPlan, replay.duration, replay.captureFps, replay.direction, replay.clips])
    const projectionReplaySettings = useMemo(() => ({
        clips: replaySettings.clips,
        duration: replaySettings.duration,
    }), [replaySettings.clips, replaySettings.duration])

    const projection = useMemo(() => buildReplayPreparationTimeline({
        videoTimeline: projectionReplay.deferredExportPlan?.videoTimeline ?? null,
        replayDurationMillis: resolveReplayDurationMillis(projectionReplay, projectionReplaySettings),
        fps: resolveCaptureFps({fps: video.fps}, projectionReplay),
        direction: projectionReplay.direction,
        clips: resolvePreparationClips(projectionReplay, journey, projectionReplaySettings.clips),
        widgetOrder,
    }), [journey, projectionReplay, projectionReplaySettings, video.fps, widgetOrder])
    const editorData = useMemo(() => toReplayTimelineEditorData(projection), [projection])
    const timeline = useMemo(() => ({
        durationMillis: projection.durationMillis,
        fps: projection.fps,
        frameCount: projection.source.frameCount,
        frameIntervalMillis: projection.source.frameIntervalMs,
        visible: true,
        horizontalFit: true,
        legendMinWidth: REPLAY_TIMELINE_UI.legendMinWidth,
        legendWidth: REPLAY_TIMELINE_UI.legendWidth,
        legendMaxWidth: REPLAY_TIMELINE_UI.legendMaxWidth,
        rangeStartMillis: 0,
        rangeEndMillis: projection.durationMillis,
        editable: true,
        interactive: true,
        collisionPolicy: 'prevent',
        resizeCollisionPolicy: 'ripple',
        snapThresholdPixels: 8,
        resizeExtendsDuration: true,
        durationPolicy: 'extend',
        keyboardZoomActive,
        showBuildingOverlay: true,
        swatches: REPLAY_TIMELINE_COLOR_SWATCHES,
        hostInteraction: 'selectable',
        hostNoDragClass: 'lgs-widget-no-drag',
    }), [detached, keyboardZoomActive, projection.durationMillis, projection.fps, projection.source.frameCount, projection.source.frameIntervalMs])
    const baseTracks = useMemo(() => toDisplayTracks(editorData), [editorData])
    const tracks = baseTracks

    useImperativeHandle(ref, () => ({
        handleResize: () => {
            _timeline.current?.setExternalInteractionActive?.(true)
            _timeline.current?.handleResize?.()
        },
        onDragStart: () => _timeline.current?.setExternalInteractionActive?.(true),
        handleDrag: () => _timeline.current?.setExternalInteractionActive?.(true),
        onDragEnd: () => _timeline.current?.setExternalInteractionActive?.(false),
        onResizeStart: () => _timeline.current?.setExternalInteractionActive?.(true),
        onResize: () => _timeline.current?.setExternalInteractionActive?.(true),
        onResizeEnd: () => _timeline.current?.setExternalInteractionActive?.(false),
    }), [])

    useEffect(() => {
        const debugStage = getReplayTimelineDebugStage()
        if (!linkedPreparation || !['surface', 'track', 'clip', 'data', 'full'].includes(debugStage)) return undefined
        let cancelled = false

        /**
         * Apply the controlled projection after the host custom element is ready.
         *
         * @returns {Promise<void>} Promise resolved after state application.
         */
        const applyControlledState = async () => {
            const initialElement = _timeline.current
            if (!initialElement) return
            if (detached && !initialElement.hasAttribute('data-ready')) {
                await waitForTimelineElementReady(initialElement)
            }
            if (cancelled) return
            const element = _timeline.current
            if (!element || !element.isConnected) return

            if (['surface', 'track', 'clip', 'data'].includes(debugStage)) {
                element.timeline = {...timeline, showBuildingOverlay: true}
                element.tracks = debugStage === 'data'
                    ? tracks
                    : debugStage === 'surface'
                        ? []
                        : [{
                            id:       'debug-track',
                            label:    'Debug track',
                            editable: true,
                            clips:    debugStage === 'clip'
                                ? [{id: 'debug-clip', kind: 'video', label: 'Debug clip', start: 0, end: 2}]
                                : [],
                        }]
                element.currentTimeMillis = 0
                return
            }

            const replayStore = lgs.stores.replay
            const localTimeMillis = element.currentTimeMillis
            element.timeline = timeline
            element.tracks = tracks
            element.playing = replayStore.playing === true
            if (hasPublishedReplayFrame(replayStore)) {
                element.currentTimeMillis = resolveCurrentTimeMillis(replayStore, projection)
            } else {
                element.currentTimeMillis = localTimeMillis
            }
        }

        void applyControlledState()
        return () => {
            cancelled = true
        }
    }, [detached, linkedPreparation, projection, timeline, tracks])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element || getReplayTimelineDebugStage() !== 'full') return undefined
        const projectionDurationMillis = projection.durationMillis

        const syncPlayback = () => {
            const replayStore = lgs.stores.replay
            if (hasPublishedReplayFrame(replayStore)) {
                element.currentTimeMillis = resolveCurrentTimeMillis(replayStore, {
                    durationMillis: projectionDurationMillis,
                })
            }
            element.playing = replayStore.playing === true
        }

        syncPlayback()
        return subscribe(lgs.stores.replay, syncPlayback)
    }, [linkedPreparation, projection.durationMillis])

    useEffect(() => {
        if (!linkedPreparation || getReplayTimelineDebugStage() !== 'full') {
            return
        }

        void __.ui.replay?.enterReplayPreparation?.({
            journey: lgs.theJourney,
            shouldApply: () => lgs.stores.ui.video.timelinePreviewActive === true
                           && lgs.stores.replay.recordingSync === true,
        })
    }, [linkedPreparation, projection.signature])

    if (!linkedPreparation) {
        return null
    }

    return (
        <section className="replay-timeline-preview wa-theme-lgs1920"
                 data-testid="replay-timeline-preview"
                 data-widget-capture="exclude"
                 aria-label="Replay tracks"
                 style={{
                     '--lgs-replay-timeline-min-width':        `${REPLAY_TIMELINE_UI.minWidth}px`,
                     '--lgs-replay-timeline-min-height':       `${REPLAY_TIMELINE_UI.minHeight}px`,
                     '--lgs-replay-timeline-layout-min-height': `${REPLAY_TIMELINE_UI.layoutMinHeight}px`,
                 }}>
            {getReplayTimelineDebugStage() === 'widget' ? (
                <div className="replay-timeline-preview__empty-debug"
                     data-testid="replay-timeline-empty-debug"
                     aria-hidden="true"/>
            ) : (
                <lgs1920-timeline data-widget-selectable=""
                                  data-replay-timeline-debug={getReplayTimelineDebugStage()}
                                  ref={_timeline}
                                  aria-label="Replay tracks">
                    <span slot="custom-menu"
                          className="replay-timeline-preview__custom-menu lgs-widget-no-drag">
                        <VideoRecordingSettingsToolbar mainTheme/>
                    </span>
                </lgs1920-timeline>
            )}
        </section>
    )
})

ReplayTimelinePreview.displayName = 'ReplayTimelinePreview'
