/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayPreparationTimeline.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-29
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Read-only normalized timeline projection for linked video preparation.
 */

import {ReplayFrameTimeline} from './ReplayFrameTimeline'
import {
    buildReplayVideoTimeline,
    resolveReplayVideoFramePhase,
} from './ReplayVideoTimeline'
import {resolveReplayVideoStatsWidgetVisibility} from './ReplayOverlayResolver'

export const REPLAY_PREPARATION_TIMELINE_VERSION = 1
export const REPLAY_PREPARATION_TRACK_REPLAY = 'replay'
export const REPLAY_PREPARATION_ACTION_DYNAMIC_STATS = 'dynamic-stats-widget'
export const REPLAY_PREPARATION_ACTION_JOURNEY_STATS = 'journey-stats-widget'

const WEB_AWESOME_PALETTE_COLORS = new Set([
    'red',
    'orange',
    'yellow',
    'green',
    'cyan',
    'blue',
    'indigo',
    'purple',
    'pink',
    'gray',
])
const DEFAULT_TIMELINE_COLOR = 'blue'
const REPLAY_COLOR_CLASSES = Object.freeze(['wa-neutral', 'wa-neutral-blue'])

const WIDGET_MODES = Object.freeze([
    {
        id: REPLAY_PREPARATION_ACTION_DYNAMIC_STATS,
        mode: 'dynamic',
        label: 'Dynamic Stats',
        icon: 'route',
        timelineColor: 'blue',
    },
    {
        id: REPLAY_PREPARATION_ACTION_JOURNEY_STATS,
        mode: 'journey',
        label: 'Journey Stats',
        icon: 'route',
        timelineColor: 'green',
    },
])

const normalizeWidgetType = widgetId => String(widgetId ?? '').split('#')[0]

/**
 * Normalize a Web Awesome palette color name.
 *
 * @param {string} color - Requested palette color.
 * @returns {string} Supported Web Awesome palette color.
 */
const normalizeTimelineColor = color => {
    const normalized = String(color ?? '').trim().toLowerCase()
    return WEB_AWESOME_PALETTE_COLORS.has(normalized) ? normalized : DEFAULT_TIMELINE_COLOR
}

/**
 * Build Web Awesome neutral palette classes for a timeline element.
 *
 * @param {string} color - Web Awesome palette color name.
 * @returns {Array} CSS classes exposing fill, text, and border tokens.
 */
const timelineColorClasses = color => {
    const normalized = normalizeTimelineColor(color)
    return ['wa-neutral', `wa-neutral-${normalized}`]
}

/**
 * Resolve widget track definitions in stacking order.
 *
 * The widget manager exposes the stack from bottom to top. Keep that order in
 * the canonical projection so the editor adapter can reverse it for the
 * package's top-to-bottom row layout.
 *
 * @param {Array|undefined} widgetOrder - Widget instances ordered bottom to top.
 * @returns {Array} Widget track definitions.
 */
const resolveWidgetTrackDefinitions = widgetOrder => {
    if (!Array.isArray(widgetOrder)) {
        return WIDGET_MODES.map(mode => ({
            id: mode.id,
            type: mode.id,
            mode: mode.mode,
            label: mode.label,
            icon: mode.icon,
            colorClasses: timelineColorClasses(mode.timelineColor),
            timelineColor: normalizeTimelineColor(mode.timelineColor),
            canHide: true,
            visible: true,
            fixed: false,
        }))
    }

    const modeByType = new Map(WIDGET_MODES.map(mode => [mode.id, mode]))
    return widgetOrder.map((widget, index) => {
        const id = typeof widget === 'string' ? widget : widget?.id
        const type = normalizeWidgetType(id)
        const mode = modeByType.get(type)
        if (!id || type === REPLAY_PREPARATION_TRACK_REPLAY) {
            return null
        }

        return {
            id,
            type,
            mode: mode?.mode ?? null,
            label: typeof widget === 'object' && widget?.label
                ? widget.label
                : (mode?.label ?? type ?? `Widget ${index + 1}`),
            icon: typeof widget === 'object' && widget?.icon
                ? widget.icon
                : mode?.icon ?? 'puzzle-piece',
            colorClasses: timelineColorClasses(
                typeof widget === 'object' ? widget?.timelineColor : mode?.timelineColor,
            ),
            timelineColor: normalizeTimelineColor(
                typeof widget === 'object' ? widget?.timelineColor : mode?.timelineColor,
            ),
            canHide: typeof widget === 'object' && widget?.canHide === true,
            visible: !(typeof widget === 'object' && widget?.visible === false),
            fixed: typeof widget === 'object' && widget?.fixed === true,
        }
    }).filter(Boolean)
}

/**
 * Convert canonical milliseconds to timeline-editor seconds.
 *
 * @param {number} millis - Millisecond value.
 * @returns {number} Seconds value.
 */
const toSeconds = millis => millis / 1000

/**
 * Resolve the canonical source timeline from caller inputs.
 *
 * @param {Object} options - Timeline inputs.
 * @returns {Object} Canonical video timeline.
 */
const normalizeTimelineOptions = options => {
    if (options?.videoTimeline?.phases) {
        if (!options?.clips) {
            return options.videoTimeline
        }

        const refreshedTimeline = buildReplayVideoTimeline({
            replayDurationMillis: options.replayDurationMillis
                                  ?? options.videoTimeline.replayDurationMillis
                                  ?? options.videoTimeline.durationMillis
                                  ?? 0,
            fps:                options.fps ?? options.videoTimeline.fps ?? 30,
            direction:          options.direction ?? options.videoTimeline.direction ?? 1,
            clips:              options.clips,
        })

        return refreshedTimeline.clipSignature === options.videoTimeline.clipSignature
            ? options.videoTimeline
            : refreshedTimeline
    }

    return buildReplayVideoTimeline({
        replayDurationMillis: options?.replayDurationMillis ?? options?.replayDuration ?? 0,
        fps: options?.fps ?? options?.captureFps ?? 30,
        direction: options?.direction ?? 1,
        clips: options?.clips ?? null,
    })
}

/**
 * Build one timeline action from a canonical millisecond range.
 *
 * @param {Object} options - Action inputs.
 * @returns {Object} Controlled timeline action.
 */
const actionFromRange = ({
    id,
    kind,
    widgetId = null,
    label,
    startMillis,
    endMillis,
    clip = null,
    icon = null,
    movable = true,
    timelineColor = DEFAULT_TIMELINE_COLOR,
    visible = true,
}) => ({
    id,
    kind,
    widgetId,
    type: kind,
    effectId: kind,
    label,
    start: toSeconds(startMillis),
    end: toSeconds(endMillis),
    duration: toSeconds(Math.max(0, endMillis - startMillis)),
    startMillis,
    endMillis,
    durationMillis: Math.max(0, endMillis - startMillis),
    clip,
    icon,
    colorClasses: timelineColorClasses(timelineColor),
    visible,
    locked: !movable,
    movable,
    flexible: false,
})

/**
 * Resolve a user-facing label for a replay phase.
 *
 * @param {Object} phase - Canonical phase.
 * @returns {string} Phase label.
 */
const phaseLabel = phase => phase.kind === 'start'
    ? 'Start'
    : phase.kind === 'stop'
      ? 'Stop'
      : 'Replay'

/**
 * Convert canonical phases into the Replay row actions.
 *
 * @param {Object} timeline - Canonical video timeline.
 * @returns {Array} Replay row actions.
 */
const buildReplayActions = timeline => timeline.phases
    .filter(phase => phase.endMillis > phase.startMillis || phase.kind === 'replay')
    .map((phase, index) => actionFromRange({
        id: `${phase.kind}-${phase.clip?.clipId ?? phase.clip?.id ?? index}`,
        kind: phase.kind,
        label: timeline.clips?.catalog?.[phase.clip?.clipId]?.label
            ?? phase.clip?.label
            ?? phaseLabel(phase),
        startMillis: phase.startMillis,
        endMillis: phase.endMillis,
        clip: phase.clip,
        icon: phase.kind === 'replay'
            ? 'route'
            : timeline.clips?.catalog?.[phase.clip?.clipId]?.icon
              ?? phase.clip?.icon
              ?? null,
        timelineColor: phase.kind === 'start'
            ? 'purple'
            : phase.kind === 'stop' ? 'orange' : DEFAULT_TIMELINE_COLOR,
    }))

/**
 * Resolve the first of the terminal replay frames.
 *
 * @param {Object} timeline - Canonical video timeline.
 * @param {ReplayFrameTimeline} frameTimeline - Canonical frame clock.
 * @returns {number|null} Terminal window start in milliseconds.
 */
const resolveTerminalReplayStartMillis = (timeline, frameTimeline) => {
    const replayPhase = timeline.replayPhase
    if (!replayPhase || replayPhase.durationMillis <= 0) {
        return null
    }

    const phaseAtStart = resolveReplayVideoFramePhase({
        timeline,
        frameTimeline,
        frameTimeMs: replayPhase.startMillis,
    })
    const replayFrameCount = Math.max(1, Number(phaseAtStart.replayFrameCount) || 1)
    const terminalFrameIndex = Math.max(0, replayFrameCount - 2)
    const terminalMillis = replayPhase.startMillis + (terminalFrameIndex * timeline.frameIntervalMs)
    return Math.max(
        replayPhase.startMillis,
        Math.min(replayPhase.endMillis, terminalMillis),
    )
}

/**
 * Build the synthetic state consumed by the shared overlay resolver.
 *
 * @param {Object} options - Frame state inputs.
 * @returns {Object} Replay frame state.
 */
const createFrameState = ({timeline, phase, frame}) => ({
    active: true,
    paused: true,
    playing: false,
    clipSequenceActive: phase.kind !== 'replay',
    recordingSync: true,
    progress: phase.progress,
    direction: timeline.direction,
    durationMillis: timeline.replayDurationMillis,
    elapsedMillis: phase.kind === 'replay'
        ? phase.localProgress * timeline.replayDurationMillis
        : phase.anchorProgress <= 0 ? 0 : timeline.replayDurationMillis,
    frameIndex: frame.index,
    frameCount: frame.frameCount,
    replayFrameIndex: phase.replayFrameIndex,
    replayFrameCount: phase.replayFrameCount,
    framePhase: phase,
    replayFramePhase: phase,
})

/**
 * Resolve one widget visibility value through the shared overlay authority.
 *
 * @param {Object} options - Resolution inputs.
 * @returns {boolean} Whether the widget is visible.
 */
const resolveWidgetVisibility = ({timeline, frameTimeline, timeMillis, mode}) => {
    const frame = frameTimeline.frameAtTimeMs(timeMillis)
    const phase = resolveReplayVideoFramePhase({
        timeline,
        frame,
        frameTimeMs: frame.frameTimeMs,
        isFinalSceneFrame: frame.isLast,
    })

    return resolveReplayVideoStatsWidgetVisibility({
        mode,
        replay: createFrameState({timeline, phase, frame}),
        includeEditorPhase: false,
        linked: true,
    })
}

/**
 * Merge adjacent ranges belonging to one widget action.
 *
 * @param {Array} ranges - Ranges to merge.
 * @returns {Array} Merged ranges.
 */
const mergeWidgetRanges = ranges => ranges.reduce((merged, range) => {
    const previous = merged.at(-1)
    if (previous && previous.endMillis === range.startMillis) {
        previous.endMillis = range.endMillis
        previous.durationMillis = range.endMillis - previous.startMillis
        previous.end = toSeconds(previous.endMillis)
        previous.duration = toSeconds(previous.durationMillis)
        return merged
    }

    merged.push({...range})
    return merged
}, [])

/**
 * Build one widget visibility action set from canonical frame boundaries.
 *
 * @param {Object} timeline - Canonical video timeline.
 * @param {ReplayFrameTimeline} frameTimeline - Canonical frame clock.
 * @param {Object} modeDefinition - Widget mode metadata.
 * @returns {Array} Widget actions.
 */
const buildWidgetActions = (timeline, frameTimeline, modeDefinition) => {
    const terminalStartMillis = resolveTerminalReplayStartMillis(timeline, frameTimeline)
    const boundaries = new Set([0, timeline.durationMillis])

    timeline.phases.forEach(phase => {
        boundaries.add(phase.startMillis)
        boundaries.add(phase.endMillis)
    })
    if (terminalStartMillis !== null) {
        boundaries.add(terminalStartMillis)
    }

    const sortedBoundaries = [...boundaries].sort((left, right) => left - right)
    const ranges = []
    for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
        const startMillis = sortedBoundaries[index]
        const endMillis = sortedBoundaries[index + 1]
        if (endMillis <= startMillis || !resolveWidgetVisibility({
            timeline,
            frameTimeline,
            timeMillis: startMillis,
            mode: modeDefinition.mode,
        })) {
            continue
        }

        ranges.push(actionFromRange({
            id: `${modeDefinition.id}-${startMillis}`,
            kind: modeDefinition.id,
            widgetId: modeDefinition.widgetId,
            label: modeDefinition.label,
            startMillis,
            endMillis,
            icon: modeDefinition.icon,
            movable: modeDefinition.movable !== false,
            timelineColor: modeDefinition.timelineColor,
            visible: modeDefinition.visible,
        }))
    }

    return mergeWidgetRanges(ranges).map((range, index) => ({
        ...range,
        id: `${modeDefinition.id}-${index}`,
    }))
}

/**
 * Build a full-duration action for a static video widget.
 *
 * @param {Object} timeline - Canonical video timeline.
 * @param {Object} widgetDefinition - Widget track definition.
 * @returns {Array} Widget actions.
 */
const buildStaticWidgetActions = (timeline, widgetDefinition) => {
    if (timeline.durationMillis <= 0) {
        return []
    }

    return [actionFromRange({
        id: `${widgetDefinition.id}-0`,
        kind: widgetDefinition.type,
        widgetId: widgetDefinition.id,
        label: widgetDefinition.label,
        startMillis: 0,
        endMillis: timeline.durationMillis,
        icon: widgetDefinition.icon,
        timelineColor: widgetDefinition.timelineColor,
        movable: widgetDefinition.fixed !== true,
        visible: widgetDefinition.visible,
    })]
}

/**
 * Build a stable projection signature.
 *
 * @param {Object} options - Signature inputs.
 * @returns {string} Stable signature.
 */
const timelineSignature = ({timeline, tracks}) => JSON.stringify({
    version: REPLAY_PREPARATION_TIMELINE_VERSION,
    direction: timeline.direction,
    fps: timeline.fps,
    durationMillis: timeline.durationMillis,
    clipSignature: timeline.clipSignature,
    tracks: tracks.map(track => ({
        id: track.id,
        actions: track.actions.map(action => [action.id, action.startMillis, action.endMillis]),
    })),
})

/**
 * Build the controlled normalized Timeline projection used by linked video preparation.
 *
 * @param {Object} options - Replay timeline inputs.
 * @param {Object|null} options.videoTimeline - Existing canonical video timeline.
 * @param {number} options.replayDurationMillis - Replay-only duration when no timeline is supplied.
 * @param {number} options.fps - Capture frame rate when no timeline is supplied.
 * @param {number} options.direction - Replay direction when no timeline is supplied.
 * @param {Object|null} options.clips - Replay clip configuration when no timeline is supplied.
 * @param {Array} [options.widgetOrder] - Video widget instances ordered bottom to top.
 * @returns {Object} Normalized preparation timeline projection.
 */
export const buildReplayPreparationTimeline = (options = {}) => {
    const timeline = normalizeTimelineOptions(options)
    const frameTimeline = new ReplayFrameTimeline({
        durationMillis: timeline.durationMillis,
        fps: timeline.fps,
        direction: timeline.direction,
    })
    const replayTrack = {
        id: REPLAY_PREPARATION_TRACK_REPLAY,
        kind: REPLAY_PREPARATION_TRACK_REPLAY,
        label: 'Replay',
        locked: true,
        actions: buildReplayActions(timeline),
        movable: false,
        fixed: true,
        icon: 'route',
        colorClasses: REPLAY_COLOR_CLASSES,
        timelineColor: DEFAULT_TIMELINE_COLOR,
    }
    const widgetTracks = resolveWidgetTrackDefinitions(options.widgetOrder).map(widget => ({
        id: widget.id,
        kind: widget.type,
        label: widget.label,
        locked: widget.fixed,
        movable: !widget.fixed,
        fixed: widget.fixed,
        canHide: widget.canHide,
        visible: widget.visible,
        icon: widget.icon,
        colorClasses: timelineColorClasses(widget.timelineColor),
        timelineColor: widget.timelineColor,
            actions: widget.mode
            ? buildWidgetActions(timeline, frameTimeline, {
                id: widget.type,
                widgetId: widget.id,
                mode: widget.mode,
                label: widget.label,
                icon: widget.icon,
                timelineColor: widget.timelineColor,
                visible: widget.visible,
                movable: !widget.fixed,
            })
            : buildStaticWidgetActions(timeline, widget),
    })).filter(track => track.actions.length > 0)
    const tracks = [replayTrack, ...widgetTracks]
    const signature = timelineSignature({timeline, tracks})
    const editorData = tracks.map(track => ({
        id: track.id,
        label: track.label,
        kind: track.kind,
        icon: track.icon,
        movable: track.movable,
        fixed: track.fixed,
        canHide: track.canHide,
        visible: track.visible,
        colorClasses: track.colorClasses,
        classNames: [
            `replay-timeline-row-${track.kind}`,
            ...(track.colorClasses ?? REPLAY_COLOR_CLASSES),
            ...(track.fixed ? ['replay-timeline-row-fixed'] : []),
        ],
        actions: track.actions.map(action => ({...action})),
    }))

    return {
        version: REPLAY_PREPARATION_TIMELINE_VERSION,
        signature,
        timeline,
        direction: timeline.direction,
        fps: timeline.fps,
        durationMillis: timeline.durationMillis,
        totalDurationMillis: timeline.durationMillis,
        durationSeconds: toSeconds(timeline.durationMillis),
        range: {
            startMillis: 0,
            endMillis: timeline.durationMillis,
            start: 0,
            end: toSeconds(timeline.durationMillis),
        },
        playhead: {
            startMillis: 0,
            endMillis: timeline.durationMillis,
            start: 0,
            end: toSeconds(timeline.durationMillis),
        },
        source: {
            clipSignature: timeline.clipSignature,
            replayDurationMillis: timeline.replayDurationMillis,
            frameCount: frameTimeline.frameCount,
            frameIntervalMs: frameTimeline.frameIntervalMs,
        },
        tracks,
        editorData,
    }
}

/**
 * Convert a preparation projection to the package-facing controlled rows.
 *
 * The product numbers tracks from the bottom of the editor: Track 1 is the
 * main Replay track. Keep the canonical projection order unchanged and adapt
 * only the visual row order for the Timeline package.
 *
 * @param {Object|null} projection - Normalized preparation projection.
 * @returns {Array} Timeline editor rows.
 */
export const toReplayTimelineEditorData = projection => [...(projection?.editorData ?? [])].reverse().map(row => ({
    ...row,
    actions: row.actions.map(action => ({...action})),
}))
