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
 * Last modified: 2026-09-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay Timeline preview for linked video preparation.
 */

import {forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react'
import {useSnapshot} from 'valtio'
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
    expandTimelineTrackOrder,
    groupWidgetEntries,
    resolveWidgetGroupLabelsFromTracks,
    resolveWidgetGroupUpdatesFromTracks,
} from '@Core/ui/widget-manager/WidgetGroupUtils'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import '../../../webcomponents/lgs1920-timeline/LGS1920Timeline.js'
import './replay-timeline-preview.css'

const DEFAULT_REPLAY_DURATION_MILLIS = 60_000
const REPLAY_CAPTURE_FPS = [30, 45, 60, 15]
const EMPTY_TIMELINE_EDITS = Object.freeze({})

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
 * Apply transient timeline edits to the canonical Replay projection.
 *
 * The projection remains the source of truth. These edits only bridge the
 * controlled Web Component until Replay publishes an updated preparation
 * snapshot, preventing a React rebuild from erasing an active edit.
 *
 * @param {Array} baseTracks - Canonical display tracks.
 * @param {Object} edits - Track edits keyed by track identifier.
 * @param {Array|null} [order=null] - Most recent rendered track order.
 * @returns {Array} Display tracks with local edits applied.
 */
const applyTimelineEdits = (baseTracks, edits, order = null) => {
    const baseById = new Map(baseTracks.map(track => [track.id, track]))
    const editedEntries = Object.entries(edits).filter(([trackId, edit]) => (
        baseById.has(trackId)
        || edit?.kind === 'track'
        || edit?.autoNumbered === true
    ))
    const editedIds = editedEntries.map(([trackId]) => trackId)
    const editedById = new Map(editedEntries)
    const availableIds = new Set([...baseById.keys(), ...editedById.keys()])
    const requestedOrder = Array.isArray(order) && order.length > 0
        ? order
        : [...baseTracks.map(track => track.id), ...editedIds]
    const merged = []
    const includedIds = new Set()
    requestedOrder.forEach(trackId => {
        if (!availableIds.has(trackId) || includedIds.has(trackId)) return
        const baseTrack = baseById.get(trackId)
        const editedTrack = editedById.get(trackId)
        merged.push(baseTrack && editedTrack ? {...baseTrack, ...editedTrack} : (editedTrack ?? baseTrack))
        includedIds.add(trackId)
    })
    baseTracks.forEach(track => {
        if (includedIds.has(track.id)) return
        merged.push(editedById.has(track.id) ? {...track, ...editedById.get(track.id)} : track)
        includedIds.add(track.id)
    })
    editedIds.forEach(trackId => {
        if (includedIds.has(trackId)) return
        merged.push(editedById.get(trackId))
        includedIds.add(trackId)
    })
    const fixedIds = new Set(baseTracks.filter(track => track.id === 'replay').map(track => track.id))
    if (fixedIds.size === 0) return merged
    const fixed = merged.filter(track => fixedIds.has(track.id))
    const movable = merged.filter(track => !fixedIds.has(track.id))
    return [...movable, ...fixed]
}

/**
 * Replay Timeline preview component.
 *
 * Replay remains the owner of preparation state and playback. The Web
 * Component exposes the local timeline interactions and emits their public
 * events; application controllers can be connected incrementally.
 *
 * @param {Object} props - Preview properties.
 * @param {boolean} [props.keyboardZoomActive=false] - Enables selected-widget keyboard zoom.
 * @returns {JSX.Element|null} Preview surface or null outside linked preparation.
 */
export const ReplayTimelinePreview = forwardRef(({keyboardZoomActive = false}, ref) => {
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
    const [timelineState, setTimelineState] = useState(() => ({
        projectionSignature: projection.signature,
        durationMillis: projection.durationMillis,
        edits: {},
        trackOrder: null,
    }))
    const hasCurrentTimelineState = timelineState.projectionSignature === projection.signature
    const timelineDurationMillis = hasCurrentTimelineState
        ? timelineState.durationMillis
        : projection.durationMillis
    const timelineEdits = hasCurrentTimelineState ? timelineState.edits : EMPTY_TIMELINE_EDITS
    const timelineTrackOrder = hasCurrentTimelineState ? timelineState.trackOrder : null
    const timeline = useMemo(() => ({
        durationMillis: Math.max(projection.durationMillis, timelineDurationMillis),
        fps: projection.fps,
        frameCount: projection.source.frameCount,
        frameIntervalMillis: projection.source.frameIntervalMs,
        visible: true,
        zoomPercent: 0,
        legendMinWidth: REPLAY_TIMELINE_UI.legendMinWidth,
        legendWidth: REPLAY_TIMELINE_UI.legendWidth,
        legendMaxWidth: REPLAY_TIMELINE_UI.legendMaxWidth,
        rangeStartMillis: 0,
        rangeEndMillis: Math.max(projection.durationMillis, timelineDurationMillis),
        editable: true,
        interactive: true,
        collisionPolicy: 'prevent',
        resizeCollisionPolicy: 'ripple',
        resizeExtendsDuration: true,
        durationPolicy: 'extend',
        keyboardZoomActive,
        colorSwatches: REPLAY_TIMELINE_COLOR_SWATCHES,
        hostInteraction: 'selectable',
        hostNoDragClass: 'lgs-widget-no-drag',
    }), [keyboardZoomActive, projection.durationMillis, projection.fps, projection.source.frameCount, projection.source.frameIntervalMs, timelineDurationMillis])
    const baseTracks = useMemo(() => toDisplayTracks(editorData), [editorData])
    const tracks = useMemo(
        () => applyTimelineEdits(baseTracks, timelineEdits, timelineTrackOrder),
        [baseTracks, timelineEdits, timelineTrackOrder],
    )
    const currentTimeMillis = resolveCurrentTimeMillis(replay, projection)
    const publishedFrameTime = replay?.dynamicFrameState?.frameTimeMs
        ?? replay?.resolvedFrameState?.frameTimeMs
        ?? replay?.resolvedFrameState?.phase?.frameTimeMs
    const hasPublishedFrameTime = Number.isFinite(Number(publishedFrameTime))
    const [localTimelineTimeMillis, setLocalTimelineTimeMillis] = useState(() => currentTimeMillis)
    const stableCurrentTimeMillis = hasPublishedFrameTime
        ? currentTimeMillis
        : (localTimelineTimeMillis ?? currentTimeMillis)
    const isPlaying = replay.playing === true

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
        const element = _timeline.current
        if (!linkedPreparation || !element) {
            return
        }

        element.timeline = timeline
        element.tracks = tracks
        element.clipOptions = null
        __.ui.widgetManager?.updateWidgetGroupLabels?.(
            resolveWidgetGroupLabelsFromTracks(tracks),
        )
    }, [linkedPreparation, timeline, tracks])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element) {
            return
        }

        const handleTimelineTracksChange = event => {
            const changedTracks = event.detail?.tracks ?? []
            const changedDuration = Number(event.detail?.durationMillis)
            setTimelineState(previous => {
                const base = previous.projectionSignature === projection.signature
                    ? previous
                    : {
                        projectionSignature: projection.signature,
                        durationMillis: projection.durationMillis,
                        edits: {},
                        trackOrder: null,
                    }
                const next = {...base}
                if (Number.isFinite(changedDuration) && changedDuration > 0) {
                    next.durationMillis = Math.max(base.durationMillis, changedDuration)
                }
                if (changedTracks.length > 0 && event.detail?.committed !== false) {
                    next.trackOrder = changedTracks.map(track => track.id)
                    next.edits = {...base.edits}
                    changedTracks.forEach(track => {
                        next.edits[track.id] = {
                            ...track,
                            clips: track.clips ?? [],
                        }
                    })
                    if (event.type.endsWith('after-remove-track')) {
                        delete next.edits[event.detail?.trackId]
                    }
                }
                return next
            })
            const updates = resolveWidgetGroupUpdatesFromTracks(changedTracks, widgetList)
            const labels = resolveWidgetGroupLabelsFromTracks(changedTracks, updates)
            const widgetManager = __.ui.widgetManager
            if (updates.size > 0) {
                void Promise.resolve(widgetManager?.updateWidgetGroups?.(updates))
                    .then(() => widgetManager?.updateWidgetGroupLabels?.(labels))
                return
            }
            widgetManager?.updateWidgetGroupLabels?.(labels)
        }
        const handleTimelineReorder = event => {
            const trackIds = event.detail?.trackIds
            if (Array.isArray(trackIds) && trackIds.length > 0) {
                setTimelineState(previous => {
                    const base = previous.projectionSignature === projection.signature
                        ? previous
                        : {
                            projectionSignature: projection.signature,
                            durationMillis: projection.durationMillis,
                            edits: {},
                            trackOrder: null,
                        }
                    return {...base, trackOrder: trackIds}
                })
            }
            const orderedWidgetIds = expandTimelineTrackOrder(event.detail?.trackIds, widgetList)
            if (orderedWidgetIds.length > 0) {
                void __.ui.widgetManager?.reorderWidgets?.(orderedWidgetIds)
            }
        }
        element.addEventListener('lgs1920-timeline-add-track', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-clip-change', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-remove-clip', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-add-clip', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-clip-extend', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-clip-visibility-change', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-clip-color-change', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-add-track', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-remove-track', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-track-label-change', handleTimelineTracksChange)
        element.addEventListener('lgs1920-timeline-after-reorder', handleTimelineReorder)

        return () => {
            element.removeEventListener('lgs1920-timeline-add-track', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-clip-change', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-remove-clip', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-add-clip', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-clip-extend', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-clip-visibility-change', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-clip-color-change', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-add-track', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-remove-track', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-track-label-change', handleTimelineTracksChange)
            element.removeEventListener('lgs1920-timeline-after-reorder', handleTimelineReorder)
        }
    }, [linkedPreparation, projection, tracks, widgetList])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element) return
        element.currentTimeMillis = stableCurrentTimeMillis
    }, [linkedPreparation, stableCurrentTimeMillis])

    useEffect(() => {
        const element = _timeline.current
        if (!linkedPreparation || !element) return undefined
        const handleTimelineSeek = event => {
            const timeMillis = Number(event.detail?.timeMillis)
            if (Number.isFinite(timeMillis)) {
                setLocalTimelineTimeMillis(Math.max(0, Math.min(projection.durationMillis, timeMillis)))
            }
        }
        element.addEventListener('lgs1920-timeline-seek', handleTimelineSeek)
        return () => element.removeEventListener('lgs1920-timeline-seek', handleTimelineSeek)
    }, [linkedPreparation, projection.durationMillis])

    useEffect(() => {
        const element = _timeline.current
        if (linkedPreparation && element) element.playing = isPlaying
    }, [isPlaying, linkedPreparation])

    useEffect(() => {
        if (!linkedPreparation) {
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
            <lgs1920-timeline ref={_timeline}
                              aria-label="Replay tracks">
                <span slot="custom-menu"
                      className="replay-timeline-preview__custom-menu lgs-widget-no-drag">
                    <VideoRecordingSettingsToolbar mainTheme/>
                </span>
            </lgs1920-timeline>
        </section>
    )
})

ReplayTimelinePreview.displayName = 'ReplayTimelinePreview'
