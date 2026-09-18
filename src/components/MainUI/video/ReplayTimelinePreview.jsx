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
 * Last modified: 2026-09-18
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

import {forwardRef, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {useSnapshot} from 'valtio'
import {subscribeKey} from 'valtio/utils'
import {WaButton, WaIcon, WaTooltip} from '@web.awesome.me/webawesome-pro/dist/react'
import {
    CREDITS_WIDGET,
    LOGO_WIDGET,
    REPLAY_RECORDING_MONITOR_WIDGET_ID,
    REPLAY_TIMELINE_WIDGET,
    VIDEO_CROP_ZONE,
    VIDEO_WIDGETS_BOARD,
} from '@Core/constants'
import {REPLAY_TIMELINE_COLOR_SWATCHES, REPLAY_TIMELINE_UI, REPLAY_TIMELINE_ZOOM, clampReplayTimelineZoom} from './replayTimelineUtils'
import {VideoRecordingSettingsToolbar} from './toolbox/VideoRecordingSettingsToolbar'
import {VideoRecordingSettingsMenus} from './toolbox/VideoRecordingSettingsMenus'
import {
    buildReplayPreparationTimeline,
} from '@Core/ui/replay/ReplayPreparationTimeline'
import {
    groupWidgetEntries,
} from '@Core/ui/widget-manager/WidgetGroupUtils'
import {createReplayScrubScheduler} from '@Core/ui/replay/ReplayScrubScheduler'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import '@lgs1920/timeline'
import './replay-timeline-preview.css'

const DEFAULT_REPLAY_DURATION_MILLIS = 60_000
const REPLAY_CAPTURE_FPS = [30, 45, 60, 15]
const REPLAY_TIMELINE_EDIT_EVENTS = [
    'add-track',
    'remove-track',
    'track-label-change',
    'add-clip',
    'remove-clip',
    'clip-change',
    'clip-visibility-change',
    'clip-enabled-change',
    'clip-extend',
    'clip-color-change',
    'track-visibility-change',
    'reorder',
    'range-change',
]

const useTimelineMountEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

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
 * Keep only journey fields that can change the preparation projection.
 *
 * @param {Object|null} journey - Reactive journey snapshot.
 * @returns {Object} Projection-specific journey inputs.
 */
const resolvePreparationJourney = journey => ({
    title: journey?.title ?? journey?.name ?? '',
    replay: {
        start: journey?.replay?.start,
        stop: journey?.replay?.stop,
    },
})

/**
 * Build a stable signature for the widget order consumed by the projection.
 *
 * @param {Array} widgetOrder - Resolved video widget order.
 * @returns {string} Stable widget order signature.
 */
const widgetOrderSignature = widgetOrder => JSON.stringify((widgetOrder ?? []).map(widget => ({
    id: widget.id,
    type: widget.type,
    label: widget.label,
    icon: widget.icon,
    timelineColor: widget.timelineColor,
    canHide: widget.canHide,
    visible: widget.visible,
    widgetGroup: widget.widgetGroup,
    widgetGroupLabel: widget.widgetGroupLabel,
    editable: widget.editable,
    widgetId: widget.widgetId,
    widgetIds: widget.widgetIds,
    members: widget.members?.map(member => ({
        id: member.id,
        type: member.type,
        label: member.label,
        icon: member.icon,
        timelineColor: member.timelineColor,
        canHide: member.canHide,
        visible: member.visible,
        editable: member.editable,
        widgetId: member.widgetId,
    })),
})))

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
 * Clone the serializable track state emitted by the timeline custom element.
 *
 * @param {Array} tracks - Public timeline tracks.
 * @returns {Array} Detached track snapshot.
 */
const cloneReplayTimelineTracks = tracks => (Array.isArray(tracks) ? tracks : []).map(track => ({
    ...track,
    clips: (Array.isArray(track?.clips) ? track.clips : []).map(clip => ({...clip})),
}))

/**
 * Build the shared Replay edit state from a Timeline event.
 *
 * The Web Component remains unaware of Replay, widgets, drawers, and PiP
 * windows. This adapter stores only the public serializable state required to
 * rehydrate another Timeline host.
 *
 * @param {CustomEvent} event - Timeline edit event.
 * @param {HTMLElement} element - Timeline custom element.
 * @param {string} sourceSignature - Base projection signature.
 * @returns {Object|null} Shared preparation state or null when no tracks exist.
 */
const buildReplayTimelineEditState = (event, element, sourceSignature) => {
    const detail = event?.detail ?? {}
    const dataTimeline = detail.data?.timeline ?? {}
    const currentTimeline = element?.timeline ?? {}
    const tracks = detail.tracks ?? detail.data?.tracks ?? element?.tracks
    if (!Array.isArray(tracks)) return null

    const durationMillis = Number(detail.durationMillis
        ?? dataTimeline.durationMillis
        ?? currentTimeline.durationMillis)
    const rangeStartMillis = Number(detail.rangeStartMillis
        ?? dataTimeline.rangeStartMillis
        ?? currentTimeline.rangeStartMillis)
    const rangeEndMillis = Number(detail.rangeEndMillis
        ?? dataTimeline.rangeEndMillis
        ?? currentTimeline.rangeEndMillis)

    return {
        sourceSignature,
        timeline: {
            durationMillis: Number.isFinite(durationMillis) ? durationMillis : currentTimeline.durationMillis,
            rangeStartMillis: Number.isFinite(rangeStartMillis) ? rangeStartMillis : 0,
            rangeEndMillis: Number.isFinite(rangeEndMillis) ? rangeEndMillis : currentTimeline.rangeEndMillis,
        },
        tracks: cloneReplayTimelineTracks(tracks),
    }
}

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
const toDisplayTracks = rows => [...(rows ?? [])].reverse().map(row => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    widgetGroup: row.widgetGroup ?? null,
    clipResizable: row.clipResizable === true,
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
        editable: action.editable !== false,
        selectable: action.selectable !== false,
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
 * @param {React.ReactNode} [props.headerActions=null] - Application actions assigned to the timeline header.
 * @returns {JSX.Element|null} Preview surface or null outside linked preparation.
 */
export const ReplayTimelinePreview = forwardRef(({
    keyboardZoomActive = false,
    detached = false,
    headerActions = null,
}, ref) => {
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const main = useSnapshot(lgs.stores.main)
    const widgetList = useSnapshot(lgs.stores.ui.widget.list)
    const widgetSettings = useOptionalSnapshot(lgs.settings?.widgets, {})
    const replaySettings = useOptionalSnapshot(lgs.settings?.ui?.replay, {})
    const _timeline = useRef(null)
    const videoSettingsButtonId = `replay-timeline-video-settings-${useId().replaceAll(':', '')}`
    const journey = main?.theJourney ?? lgs.theJourney
    const resolvedWidgetOrder = useMemo(() => resolveVideoWidgetOrder(widgetList, widgetSettings), [widgetList, widgetSettings])
    const widgetOrderRevision = useMemo(() => widgetOrderSignature(resolvedWidgetOrder), [resolvedWidgetOrder])
    // The revision intentionally controls when the projection input reference changes.
    // oxlint-disable-next-line react/exhaustive-deps
    const widgetOrder = useMemo(() => resolvedWidgetOrder, [widgetOrderRevision])

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
    const journeyTitle = journey?.title
    const journeyName = journey?.name
    const journeyReplayStart = journey?.replay?.start
    const journeyReplayStop = journey?.replay?.stop
    const projectionJourney = useMemo(() => resolvePreparationJourney({
        title: journeyTitle,
        name: journeyName,
        replay: {
            start: journeyReplayStart,
            stop: journeyReplayStop,
        },
    }), [journeyTitle, journeyName, journeyReplayStart, journeyReplayStop])
    const projection = useMemo(() => {
        const startedAt = globalThis.performance?.now?.() ?? Date.now()
        const nextProjection = buildReplayPreparationTimeline({
            videoTimeline: projectionReplay.deferredExportPlan?.videoTimeline ?? null,
            replayDurationMillis: resolveReplayDurationMillis(projectionReplay, projectionReplaySettings),
            fps: resolveCaptureFps({fps: video.fps}, projectionReplay),
            direction: projectionReplay.direction,
            clips: resolvePreparationClips(projectionReplay, projectionJourney, projectionReplaySettings.clips),
            journeyTitle: projectionJourney.title,
            widgetOrder,
        })
        console.log('[ReplayTimeline] projection built', {
            durationMs: Number(((globalThis.performance?.now?.() ?? Date.now()) - startedAt).toFixed(2)),
            tracks: nextProjection.tracks.length,
            actions: nextProjection.tracks.reduce((count, track) => count + track.actions.length, 0),
        })
        return nextProjection
    }, [projectionJourney, projectionReplay, projectionReplaySettings, video.fps, widgetOrder])
    const preparationTimeline = replay.preparationTimeline
    const preparedTimeline = preparationTimeline?.timeline ?? null
    const persistedTimelineView = replaySettings?.timeline ?? {}
    const persistedZoomPercent = Number(persistedTimelineView.zoomPercent)
    const hasPersistedZoom = Number.isFinite(persistedZoomPercent)
    const resolvedHorizontalZoomPercent = clampReplayTimelineZoom(
        hasPersistedZoom ? persistedZoomPercent : REPLAY_TIMELINE_ZOOM.defaultPercent,
    )
    const persistedVerticalScrollTop = Number(persistedTimelineView.verticalScrollTop)
    const initialVerticalScrollTop = Number.isFinite(persistedVerticalScrollTop)
        ? Math.max(0, persistedVerticalScrollTop)
        : 0
    const _verticalScrollTop = useRef(initialVerticalScrollTop)
    const [horizontalZoomPercent, setHorizontalZoomPercent] = useState(resolvedHorizontalZoomPercent)
    const timeline = useMemo(() => ({
        projectionRevision: projection.signature,
        durationMillis: Number(preparedTimeline?.durationMillis) > 0
            ? Number(preparedTimeline.durationMillis)
            : projection.durationMillis,
        fps: projection.fps,
        frameCount: projection.source.frameCount,
        frameIntervalMillis: projection.source.frameIntervalMs,
        visible: true,
        horizontalFit: !hasPersistedZoom,
        zoomPercent: hasPersistedZoom ? horizontalZoomPercent : undefined,
        showTimeSlider: true,
        showZoomSlider: true,
        showClipMenu: true,
        legendMinWidth: REPLAY_TIMELINE_UI.legendMinWidth,
        legendWidth: REPLAY_TIMELINE_UI.legendWidth,
        legendMaxWidth: REPLAY_TIMELINE_UI.legendMaxWidth,
        rangeStartMillis: Number.isFinite(Number(preparedTimeline?.rangeStartMillis))
            ? Number(preparedTimeline.rangeStartMillis)
            : 0,
        rangeEndMillis: Number.isFinite(Number(preparedTimeline?.rangeEndMillis))
            ? Number(preparedTimeline.rangeEndMillis)
            : projection.durationMillis,
        editable: true,
        interactive: true,
        collisionPolicy: 'prevent',
        resizeCollisionPolicy: 'ripple',
        snapThresholdPixels: 8,
        resizeExtendsDuration: true,
        durationPolicy: 'extend',
        keyboardZoomActive,
        showBuildingOverlay: false,
        swatches: REPLAY_TIMELINE_COLOR_SWATCHES,
        hostInteraction: 'selectable',
        hostNoDragClass: 'lgs-widget-no-drag',
    }), [horizontalZoomPercent, hasPersistedZoom, keyboardZoomActive, preparedTimeline, projection.signature, projection.durationMillis, projection.fps, projection.source.frameCount, projection.source.frameIntervalMs])
    const baseTracks = useMemo(() => toDisplayTracks(projection.tracks), [projection])
    const tracks = Array.isArray(preparationTimeline?.tracks)
        ? preparationTimeline.tracks
        : baseTracks
    const sliderMinMillis = Number.isFinite(Number(timeline.rangeStartMillis))
        ? Number(timeline.rangeStartMillis)
        : 0
    const sliderMaxMillis = Number.isFinite(Number(timeline.rangeEndMillis))
        ? Math.max(sliderMinMillis, Number(timeline.rangeEndMillis))
        : timeline.durationMillis
    // Keep the live frame out of render-time snapshot tracking. Playback updates
    // the slider imperatively through the subscription effect below.
    const persistedTimelineTimeMillis = Number(persistedTimelineView.currentTimeMillis)
    const initialTimelineTimeMillis = Number.isFinite(persistedTimelineTimeMillis)
        ? Math.max(sliderMinMillis, Math.min(sliderMaxMillis, persistedTimelineTimeMillis))
        : sliderMinMillis
    const _pendingPlayhead = useRef(null)
    const normalizeTimelineTime = useCallback(value => {
        const requestedTime = Number(value)
        const safeTime = Number.isFinite(requestedTime) ? requestedTime : sliderMinMillis
        return Math.max(sliderMinMillis, Math.min(sliderMaxMillis, safeTime))
    }, [sliderMaxMillis, sliderMinMillis])
    const persistTimelineView = useCallback(updates => {
        const settings = lgs.settings?.ui?.replay
        if (!settings) return
        settings.timeline ??= {}
        Object.assign(settings.timeline, updates)
    }, [])

    const persistVerticalScrollTop = useCallback(value => {
        const scrollTop = Number(value)
        if (!Number.isFinite(scrollTop)) return
        const normalizedScrollTop = Math.max(0, scrollTop)
        _verticalScrollTop.current = normalizedScrollTop
        persistTimelineView({verticalScrollTop: normalizedScrollTop})
    }, [persistTimelineView])

    const applyReplayScrub = useCallback(({progress, settled, signal, requestId}) => __.ui.replay?.seek?.(progress, {
        qualifyScene: true,
        settled,
        signal,
        requestId,
        source: 'timeline-scrub',
    }), [])
    const _scrubScheduler = useRef(null)
    /**
     * Apply a time to the timeline's lightweight playhead path.
     *
     * @param {HTMLElement} element - Timeline custom element.
     * @param {number} timeMillis - Requested time in milliseconds.
     * @returns {void}
     */
    const applyTimelinePlayheadTime = useCallback((element, timeMillis) => {
        if (typeof element?.setPlayheadTimeMillis === 'function') {
            element.setPlayheadTimeMillis(timeMillis)
            return
        }
        if (element) element.currentTimeMillis = timeMillis
    }, [])

    useEffect(() => {
        const scheduler = createReplayScrubScheduler({apply: applyReplayScrub})
        _scrubScheduler.current = scheduler

        return () => {
            scheduler.dispose()
            if (_scrubScheduler.current === scheduler) {
                _scrubScheduler.current = null
            }
        }
    }, [applyReplayScrub])

    const updateTimelineTime = useCallback((value, settled = false) => {
        const timeMillis = normalizeTimelineTime(value)
        const durationMillis = Number(timeline.durationMillis)
        const progress = durationMillis > 0 ? timeMillis / durationMillis : 0
        const pendingPlayhead = {timeMillis}
        _pendingPlayhead.current = pendingPlayhead
        persistTimelineView({currentTimeMillis: timeMillis})
        if (_timeline.current) {
            applyTimelinePlayheadTime(_timeline.current, timeMillis)
            if (_timeline.current.isCurrentTimeNearViewportEdge?.()) {
                _timeline.current.ensureCurrentTimeVisible?.()
            }
        }
        if (settled) {
            const settlePromise = _scrubScheduler.current?.settle(progress)
            if (settlePromise && typeof settlePromise.then === 'function') {
                void settlePromise.then(() => {
                    if (_pendingPlayhead.current !== pendingPlayhead) return
                    const replayStore = lgs.stores.replay
                    if (!hasPublishedReplayFrame(replayStore)
                        || resolveCurrentTimeMillis(replayStore, {durationMillis}) !== pendingPlayhead.timeMillis) return
                    _pendingPlayhead.current = null
                })
            }
        }
        else {
            _scrubScheduler.current?.request(progress)
        }
    }, [applyTimelinePlayheadTime, normalizeTimelineTime, persistTimelineView, timeline.durationMillis])

    const handleTimelineSeek = useCallback(event => {
        const detail = event?.detail ?? {}
        updateTimelineTime(detail.timeMillis, detail.settled === true)
    }, [updateTimelineTime])

    const handleTimelineZoomChange = useCallback(event => {
        persistVerticalScrollTop(_timeline.current?.verticalScrollTop)
        const zoomPercent = clampReplayTimelineZoom(event?.detail?.zoomPercent)
        setHorizontalZoomPercent(zoomPercent)
        persistTimelineView({zoomPercent})
    }, [persistTimelineView, persistVerticalScrollTop])

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

    useTimelineMountEffect(() => {
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
            const startedAt = globalThis.performance?.now?.() ?? Date.now()
            console.log('[ReplayTimeline] controlled state start', {debugStage})

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
                console.log('[ReplayTimeline] controlled state end', {
                    debugStage,
                    durationMs: Number(((globalThis.performance?.now?.() ?? Date.now()) - startedAt).toFixed(2)),
                })
                return
            }

            const replayStore = lgs.stores.replay
            const localTimeMillis = element.currentTimeMillis
            const pendingPlayhead = _pendingPlayhead.current
            const currentTimeMillis = pendingPlayhead !== null
                ? pendingPlayhead.timeMillis
                : hasPublishedReplayFrame(replayStore)
                    ? resolveCurrentTimeMillis(replayStore, {
                        durationMillis: timeline.durationMillis,
                    })
                    : Number.isFinite(persistedTimelineTimeMillis)
                        ? initialTimelineTimeMillis
                        : localTimeMillis
            const controlledState = {
                currentTimeMillis,
                playing: replayStore.playing === true,
                timeline,
                tracks,
            }
            if (typeof element.applyControlledState === 'function') {
                element.applyControlledState(controlledState)
            }
            else {
                element.timeline = timeline
                element.tracks = tracks
                element.playing = controlledState.playing
                element.currentTimeMillis = currentTimeMillis
            }
            element.ensureCurrentTimeVisible?.()
            element.verticalScrollTop = _verticalScrollTop.current
            console.log('[ReplayTimeline] controlled state end', {
                debugStage,
                durationMs: Number(((globalThis.performance?.now?.() ?? Date.now()) - startedAt).toFixed(2)),
            })
        }

        void applyControlledState()
        return () => {
            cancelled = true
        }
    }, [detached, initialTimelineTimeMillis, linkedPreparation, persistedTimelineTimeMillis, projection, timeline, tracks])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element || getReplayTimelineDebugStage() !== 'full') return undefined

        const persistTimelineEdit = event => {
            const editState = buildReplayTimelineEditState(event, element, projection.signature)
            if (editState) lgs.stores.replay.preparationTimeline = editState
        }
        const eventNames = REPLAY_TIMELINE_EDIT_EVENTS.map(name => `lgs1920-timeline-${name}`)
        eventNames.forEach(name => element.addEventListener(name, persistTimelineEdit))

        return () => {
            eventNames.forEach(name => element.removeEventListener(name, persistTimelineEdit))
        }
    }, [linkedPreparation, projection.signature])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element || getReplayTimelineDebugStage() !== 'full') return undefined

        const persistVerticalScroll = event => {
            persistVerticalScrollTop(event?.detail?.scrollTop)
        }

        element.addEventListener('lgs1920-timeline-vertical-scroll', persistVerticalScroll)
        return () => element.removeEventListener('lgs1920-timeline-vertical-scroll', persistVerticalScroll)
    }, [linkedPreparation, persistVerticalScrollTop])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element || getReplayTimelineDebugStage() !== 'full') return undefined

        element.addEventListener('lgs1920-timeline-seek', handleTimelineSeek)
        return () => element.removeEventListener('lgs1920-timeline-seek', handleTimelineSeek)
    }, [handleTimelineSeek, linkedPreparation])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element || getReplayTimelineDebugStage() !== 'full') return undefined

        element.addEventListener('lgs1920-timeline-zoom-change', handleTimelineZoomChange)
        return () => element.removeEventListener('lgs1920-timeline-zoom-change', handleTimelineZoomChange)
    }, [handleTimelineZoomChange, linkedPreparation])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element || getReplayTimelineDebugStage() !== 'full') return undefined
        const projectionDurationMillis = projection.durationMillis
        let playbackSyncScheduled = false
        let scheduledFrameId = null
        let scheduledWithAnimationFrame = false

        const syncPlayback = () => {
            const replayStore = lgs.stores.replay
            if (hasPublishedReplayFrame(replayStore)) {
                const publishedTimeMillis = resolveCurrentTimeMillis(replayStore, {
                    durationMillis: projectionDurationMillis,
                })
                const pendingPlayhead = _pendingPlayhead.current
                if (pendingPlayhead !== null
                    && publishedTimeMillis === pendingPlayhead.timeMillis) {
                    _pendingPlayhead.current = null
                }
                const currentTimeMillis = _pendingPlayhead.current?.timeMillis ?? publishedTimeMillis
                applyTimelinePlayheadTime(element, currentTimeMillis)
                if (element.isCurrentTimeNearViewportEdge?.()) {
                    element.ensureCurrentTimeVisible?.()
                }
            }
            element.playing = replayStore.playing === true
        }
        const runScheduledPlaybackSync = () => {
            playbackSyncScheduled = false
            scheduledFrameId = null
            syncPlayback()
        }
        const schedulePlaybackSync = () => {
            if (playbackSyncScheduled) return
            playbackSyncScheduled = true
            if (typeof globalThis.requestAnimationFrame === 'function') {
                scheduledWithAnimationFrame = true
                scheduledFrameId = globalThis.requestAnimationFrame(runScheduledPlaybackSync)
            }
            else {
                scheduledWithAnimationFrame = false
                scheduledFrameId = globalThis.setTimeout(runScheduledPlaybackSync, 0)
            }
        }

        syncPlayback()
        const replayStore = lgs.stores.replay
        const unsubscribers = [
            subscribeKey(replayStore, 'dynamicFrameState', schedulePlaybackSync),
            subscribeKey(replayStore, 'resolvedFrameState', schedulePlaybackSync),
            subscribeKey(replayStore, 'playing', schedulePlaybackSync),
        ]
        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe())
            if (scheduledFrameId !== null) {
                if (scheduledWithAnimationFrame) {
                    globalThis.cancelAnimationFrame?.(scheduledFrameId)
                }
                else {
                    globalThis.clearTimeout(scheduledFrameId)
                }
            }
            playbackSyncScheduled = false
            scheduledFrameId = null
        }
    }, [applyTimelinePlayheadTime, linkedPreparation, projection.durationMillis])

    useEffect(() => {
        if (linkedPreparation) return undefined
        _verticalScrollTop.current = initialVerticalScrollTop
        _pendingPlayhead.current = null
        return undefined
    }, [initialVerticalScrollTop, linkedPreparation])

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
                <lgs1920-timeline data-capture-exclude="true"
                                  data-replay-timeline-debug={getReplayTimelineDebugStage()}
                                  ref={_timeline}
                                  aria-label="Replay tracks">
                    {headerActions && (
                        <span slot="header-actions"
                              className="replay-timeline-preview__header-actions lgs-widget-no-drag"
                              data-widget-capture="exclude">
                            {headerActions}
                        </span>
                    )}
                    <span slot="custom-menu"
                          className="replay-timeline-preview__custom-menu lgs-widget-no-drag">
                        <WaButton appearance="plain"
                                  id={videoSettingsButtonId}
                                  aria-label="Video settings"
                                  data-additional-content-toggle=""
                                  size="s"
                                  variant="brand">
                            <WaIcon name="video" variant="regular" label=""/>
                        </WaButton>
                        <WaTooltip for={videoSettingsButtonId} placement="bottom">{'Video settings'}</WaTooltip>
                        <VideoRecordingSettingsToolbar mainTheme mode="actions"/>
                    </span>
                    <span slot="additional-content-label">Video settings</span>
                    <VideoRecordingSettingsMenus slot="additional-content"
                                                 className="replay-timeline-preview__additional-content lgs-widget-no-drag"
                                                 context={lgs.stores.ui.video.cropper}
                                                 cropzoneId={VIDEO_CROP_ZONE}
                                                 mainTheme/>
                </lgs1920-timeline>
            )}
        </section>
    )
})

ReplayTimelinePreview.displayName = 'ReplayTimelinePreview'
