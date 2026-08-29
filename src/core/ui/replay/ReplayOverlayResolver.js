/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayOverlayResolver.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified on: 2026-07-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import {
    resolvePublishedReplayExportFrame,
    resolvePublishedReplayFrame,
} from '@Core/ui/replay/ReplayFramePublisher'

const VIDEO_STATS_WIDGET_MODES = Object.freeze({
    'dynamic-stats-widget': 'dynamic',
    'journey-stats-widget': 'journey',
})

const REPLAY_VIDEO_PHASE_REPLAY = 'replay'
const REPLAY_VIDEO_PHASE_START = 'start'
const REPLAY_VIDEO_PHASE_STOP = 'stop'
const LAST_REPLAY_FRAME_WINDOW = 2

const finiteNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

const defaultReplayStore = () => globalThis.lgs?.stores?.replay ?? null
const defaultReplayController = () => globalThis.__?.ui?.replay?.controller ?? null

const normalizeReplayFramePhase = phase => {
    if (!phase) {
        return null
    }

    const kind = `${phase.kind ?? phase.slot ?? REPLAY_VIDEO_PHASE_REPLAY}`
    const slot = `${phase.slot ?? kind}`
    return {
        ...phase,
        kind,
        slot,
    }
}

const resolveReplayCaptureFps = (replay = defaultReplayStore()) => {
    const candidates = [
        replay?.captureFps,
        replay?.fps,
        globalThis.lgs?.stores?.ui?.video?.captureFps,
        globalThis.lgs?.stores?.ui?.video?.currentFps,
        globalThis.lgs?.settings?.ui?.video?.captureFps,
        globalThis.lgs?.settings?.ui?.video?.fps,
        30,
    ]

    for (const candidate of candidates) {
        const fps = finiteNumber(candidate)
        if (fps !== null && fps > 0) {
            return fps
        }
    }

    return 30
}

const isReplayRuntimeActive = replayState => Boolean(
    replayState?.active
    || replayState?.playing
    || replayState?.paused
    || replayState?.clipSequenceActive,
)

const resolveReplayFrameWindow = replayState => {
    const phase = normalizeReplayFramePhase(replayState?.framePhase ?? replayState?.phase ?? null)
    if (phase && phase.slot !== REPLAY_VIDEO_PHASE_REPLAY && phase.kind !== REPLAY_VIDEO_PHASE_REPLAY) {
        return {
            phase,
            isLastReplayFrames: false,
        }
    }

    if (phase?.isLastTwoReplayFrames === true) {
        return {
            phase,
            isLastReplayFrames: true,
        }
    }

    const replayFrameIndex = finiteNumber(
        phase?.replayFrameIndex
        ?? replayState?.replayFrameIndex
        ?? replayState?.frameIndex
        ?? replayState?.index,
    )
    const replayFrameCount = finiteNumber(
        phase?.replayFrameCount
        ?? replayState?.replayFrameCount
        ?? replayState?.frameCount,
    )
    if (replayFrameIndex !== null && replayFrameCount !== null && replayFrameCount > 0) {
        return {
            phase,
            isLastReplayFrames: (replayFrameCount - replayFrameIndex) <= LAST_REPLAY_FRAME_WINDOW,
        }
    }

    const durationMillis = finiteNumber(replayState?.durationMillis)
    const progress = finiteNumber(replayState?.progress)
    if (durationMillis === null || progress === null || durationMillis <= 0) {
        return {
            phase,
            isLastReplayFrames: false,
        }
    }

    const fps = resolveReplayCaptureFps(replayState)
    const frameIntervalMillis = 1000 / fps
    const frameCount = Math.max(1, Math.ceil(durationMillis / frameIntervalMillis) + 1)
    const playbackProgress = Number(replayState?.direction) < 0 ? 1 - progress : progress
    const frameIndex = Math.min(
        frameCount - 1,
        Math.max(0, Math.round(Math.max(0, Math.min(1, playbackProgress)) * (frameCount - 1))),
    )

    return {
        phase,
        isLastReplayFrames: (frameCount - frameIndex) <= LAST_REPLAY_FRAME_WINDOW,
    }
}

/**
 * Return the deterministic frame currently rendered by the HQ exporter.
 *
 * This state wins over the live controller/store snapshot so dynamic widgets
 * can render the exact frame being encoded instead of the last live replay
 * position.
 */
export const resolveReplayExportFrameState = (replay = defaultReplayStore()) => {
    const frameState = resolvePublishedReplayExportFrame(replay)
    if (frameState?.active !== true) {
        return null
    }

    return frameState
}

/**
 * Return the active dynamic replay frame, regardless of its producer.
 *
 * Draft recording publishes `dynamicFrameState` from the playback controller.
 * HQ export publishes `runtime.frameState` from the deferred exporter.
 */
export const resolveReplayDynamicFrameState = (replay = defaultReplayStore()) => (
    resolveReplayExportFrameState(replay)
    ?? resolvePublishedReplayFrame(replay)
    ?? null
)

const resolveVideoOverlayRoot = (widgetEl = null) => {
    if (!widgetEl) {
        return null
    }

    return widgetEl.querySelector?.('[data-video-overlay-visible], [data-video-overlay-mode]')
           ?? widgetEl
}

const videoOverlayModeForWidgetId = (widgetId = '') => {
    const baseId = typeof widgetId === 'string' ? widgetId.split('#')[0] : ''
    return VIDEO_STATS_WIDGET_MODES[baseId] ?? null
}

export const isJourneyReplayLinked = (replay = defaultReplayStore()) => replay?.recordingSync === true
    || (replay === defaultReplayStore() && globalThis.lgs?.settings?.ui?.replay?.recordingSync === true)

/**
 * Return true when the journey has stop clips configured.
 *
 * Stop clips alter the end-of-replay visibility window, so the replay/video
 * pipeline needs this as a dedicated rule.
 */
export const hasJourneyReplayStopClips = () => {
    const stop = globalThis.lgs?.settings?.ui?.replay?.clips?.stop
    return Array.isArray(stop) && stop.length > 0
}

export const isVideoWidgetEditorPhase = () => {
    const video = globalThis.lgs?.stores?.ui?.video ?? null
    return Boolean(video?.editing || video?.preRecording)
           && !video?.recording
           && !video?.finalizing
           && !video?.snapshot
}

/**
 * Return whether a video-board widget must remain mounted for capture.
 *
 * @param {object} options - Widget render state.
 * @param {string} [options.widgetsBoard=''] - Board hosting the widget.
 * @param {boolean} [options.widgetEditor=false] - Whether the widget editor is active.
 * @param {object|null} [options.video=null] - Video recording state.
 * @param {object|null} [options.replay=null] - Replay state.
 * @returns {boolean} True when the widget must be rendered.
 */
export const shouldRenderVideoBoardWidget = ({
                                                  widgetsBoard = '',
                                                  widgetEditor = false,
                                                  video = null,
                                                  replay = null,
                                              } = {}) => {
    const isHqExporting = replay?.deferredExportPlan?.runtime?.status === 'exporting'
    const isVideoCaptureActive = video?.preRecording || video?.recording || isHqExporting

    return Boolean(widgetEditor || (widgetsBoard === VIDEO_WIDGETS_BOARD && isVideoCaptureActive))
}

/**
 * Resolve the live replay state as consumed by the video pipeline.
 *
 * The controller wins when available because it contains the freshest sample
 * and progress. The replay store remains the fallback snapshot.
 */
export const resolveReplayVisibilityState = ({
    replay = undefined,
    controller = undefined,
} = {}) => {
    const globalReplay = defaultReplayStore()
    const replayState = replay ?? globalReplay
    const replayController = controller === undefined
                             ? (replayState === globalReplay ? defaultReplayController() : null)
                             : controller

    if (!replayState && !replayController) {
        return null
    }

    const dynamicFrameState = resolveReplayDynamicFrameState(replayState)
    const framePhase = normalizeReplayFramePhase(
        dynamicFrameState?.phase
        ?? replayState?.replayFramePhase
        ?? replayState?.framePhase
        ?? null,
    )
    const liveSample = dynamicFrameState?.sample ?? replayController?.currentSample?.() ?? null
    const controllerDuration = finiteNumber(replayController?.duration)
    const controllerProgress = finiteNumber(dynamicFrameState?.progress) ?? finiteNumber(replayController?.progress)
    const controllerDirection = dynamicFrameState
                                ? (Number(dynamicFrameState.direction) < 0 ? -1 : 1)
                                : (replayController ? (Number(replayController.direction) < 0 ? -1 : 1) : null)
    const controllerPlaying = dynamicFrameState ? Boolean(dynamicFrameState.playing) : (replayController ? Boolean(replayController.playing) : null)
    const controllerPaused = dynamicFrameState ? Boolean(dynamicFrameState.paused) : (replayController ? Boolean(replayController.paused) : null)
    const controllerActive = dynamicFrameState ? Boolean(dynamicFrameState.active) : (replayController ? Boolean(replayController.running || replayController.paused) : null)

    return {
        ...replayState,
        active:         controllerActive ?? Boolean(replayState?.active),
        playing:        controllerPlaying ?? Boolean(replayState?.playing),
        paused:         controllerPaused ?? Boolean(replayState?.paused),
        progress:       controllerProgress ?? replayState?.progress ?? null,
        direction:      controllerDirection ?? (Number(replayState?.direction) < 0 ? -1 : 1),
        sample:         liveSample ?? replayState?.sample ?? replayState?.liveSample ?? null,
        elapsedMillis:  finiteNumber(dynamicFrameState?.elapsedMillis)
                        ?? finiteNumber(liveSample?.journeyElapsedMillis)
                        ?? finiteNumber(replayState?.elapsedMillis),
        durationMillis: finiteNumber(dynamicFrameState?.durationMillis)
                        ?? finiteNumber(liveSample?.journeyDurationMillis)
                        ?? finiteNumber(replayController?.sampler?.durationMillis)
                        ?? (controllerDuration !== null ? controllerDuration * 1000 : null)
                        ?? finiteNumber(replayState?.durationMillis),
        framePhase,
        phase:            framePhase,
        frameIndex:       finiteNumber(dynamicFrameState?.index ?? dynamicFrameState?.frameIndex ?? replayState?.frameIndex),
        frameCount:       finiteNumber(dynamicFrameState?.frameCount ?? replayState?.frameCount),
        replayFrameIndex: finiteNumber(dynamicFrameState?.replayFrameIndex ?? framePhase?.replayFrameIndex ?? replayState?.replayFrameIndex),
        replayFrameCount: finiteNumber(dynamicFrameState?.replayFrameCount ?? framePhase?.replayFrameCount ?? replayState?.replayFrameCount),
    }
}

export const getJourneyReplayRemainingMillis = (replay = defaultReplayStore()) => {
    const durationMillis = finiteNumber(replay?.durationMillis)
    const progress = finiteNumber(replay?.progress)
    if (durationMillis === null || progress === null) {
        return null
    }

    const direction = Number(replay?.direction) < 0 ? -1 : 1
    const remainingProgress = direction < 0 ? progress : (1 - progress)
    return Math.max(0, durationMillis * Math.max(0, remainingProgress))
}

/**
 * Decide whether a replay stats widget should be visible on this frame.
 *
 * The same rule is used by both the React widget and the video overlay path,
 * which prevents the two from drifting apart.
 */
const resolveReplayStatsWidgetVisibility = ({
    mode = 'journey',
    replay = defaultReplayStore(),
    controller = undefined,
    includeEditorPhase = false,
    linked = undefined,
} = {}) => {
    if (includeEditorPhase && isVideoWidgetEditorPhase()) {
        return true
    }

    const replayState = resolveReplayVisibilityState({replay, controller})
    if (!(linked ?? isJourneyReplayLinked(replay)) || !replayState) {
        return false
    }

    const {phase, isLastReplayFrames} = resolveReplayFrameWindow(replayState)
    if (phase?.slot === REPLAY_VIDEO_PHASE_START || phase?.kind === REPLAY_VIDEO_PHASE_START) {
        return false
    }

    if (!isReplayRuntimeActive(replayState)) {
        return false
    }

    if (phase?.slot === REPLAY_VIDEO_PHASE_STOP || phase?.kind === REPLAY_VIDEO_PHASE_STOP) {
        return mode === 'journey'
    }

    return mode === 'dynamic'
           ? !isLastReplayFrames
           : isLastReplayFrames
}

export const resolveReplayVideoStatsWidgetVisibility = ({
    mode = 'journey',
    replay = defaultReplayStore(),
    controller = undefined,
    includeEditorPhase = true,
    linked = undefined,
} = {}) => (
    resolveReplayStatsWidgetVisibility({
        mode,
        replay,
        controller,
        includeEditorPhase,
        linked,
    })
)

export const shouldShowDynamicStatsWidget = (replay = defaultReplayStore()) => (
    resolveReplayStatsWidgetVisibility({mode: 'dynamic', replay})
)

export const shouldShowJourneyStatsWidget = (replay = defaultReplayStore()) => (
    resolveReplayStatsWidgetVisibility({mode: 'journey', replay})
)

export const shouldShowVideoStatsWidget = ({
    mode = 'journey',
    replay = defaultReplayStore(),
    controller = undefined,
} = {}) => (
    resolveReplayVideoStatsWidgetVisibility({mode, replay, controller})
)

/**
 * Resolve the final visibility of a widget or overlay for the video pipeline.
 *
 * This helper prefers explicit replay-aware widget modes, then falls back to
 * DOM hints so generic overlays still behave predictably.
 */
export const resolveVideoOverlayVisibility = ({
    widgetId = '',
    widgetEl = null,
    replay = undefined,
    controller = undefined,
} = {}) => {
    const overlayRoot = resolveVideoOverlayRoot(widgetEl)
    const mode = videoOverlayModeForWidgetId(widgetId)
                 ?? overlayRoot?.dataset?.videoOverlayMode
                 ?? null

    if (mode === 'dynamic' || mode === 'journey') {
        return resolveReplayVideoStatsWidgetVisibility({mode, replay, controller})
    }

    const explicitVisibility = overlayRoot?.dataset?.videoOverlayVisible
    if (explicitVisibility === 'true') {
        return true
    }
    if (explicitVisibility === 'false') {
        return false
    }

    if (overlayRoot?.getAttribute?.('aria-hidden') === 'true') {
        return false
    }

    const style = overlayRoot && globalThis.getComputedStyle ? globalThis.getComputedStyle(overlayRoot) : null
    if (style?.display === 'none' || style?.visibility === 'hidden') {
        return false
    }

    return true
}
