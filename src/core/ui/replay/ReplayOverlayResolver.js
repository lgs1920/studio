/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayOverlayResolver.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified on: 2026-07-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const END_WIDGET_LEAD_MS = 2000
const VIDEO_STATS_WIDGET_MODES = Object.freeze({
    'dynamic-stats-widget': 'dynamic',
    'journey-stats-widget': 'journey',
})

const finiteNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

const defaultReplayStore = () => globalThis.lgs?.stores?.replay ?? null
const defaultReplayController = () => globalThis.__?.ui?.replay?.controller ?? null

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

export const isJourneyReplayLinked = () => globalThis.lgs?.stores?.replay?.recordingSync === true

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

    const liveSample = replayController?.currentSample?.() ?? null
    const controllerDuration = finiteNumber(replayController?.duration)
    const controllerProgress = finiteNumber(replayController?.progress)
    const controllerDirection = replayController ? (Number(replayController.direction) < 0 ? -1 : 1) : null
    const controllerPlaying = replayController ? Boolean(replayController.playing) : null
    const controllerPaused = replayController ? Boolean(replayController.paused) : null
    const controllerActive = replayController ? Boolean(replayController.running || replayController.paused) : null

    return {
        ...replayState,
        active:         controllerActive ?? Boolean(replayState?.active),
        playing:        controllerPlaying ?? Boolean(replayState?.playing),
        paused:         controllerPaused ?? Boolean(replayState?.paused),
        progress:       controllerProgress ?? replayState?.progress ?? null,
        direction:      controllerDirection ?? (Number(replayState?.direction) < 0 ? -1 : 1),
        sample:         liveSample ?? replayState?.sample ?? replayState?.liveSample ?? null,
        elapsedMillis:  finiteNumber(liveSample?.journeyElapsedMillis)
                        ?? finiteNumber(replayState?.elapsedMillis),
        durationMillis: finiteNumber(liveSample?.journeyDurationMillis)
                        ?? finiteNumber(replayController?.sampler?.durationMillis)
                        ?? (controllerDuration !== null ? controllerDuration * 1000 : null)
                        ?? finiteNumber(replayState?.durationMillis),
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
} = {}) => {
    if (includeEditorPhase && isVideoWidgetEditorPhase()) {
        return true
    }

    const replayState = resolveReplayVisibilityState({replay, controller})
    if (!isJourneyReplayLinked() || !replayState) {
        return false
    }

    if (mode === 'dynamic') {
        if (!(replayState.playing || replayState.paused)) {
            return false
        }

        if (!hasJourneyReplayStopClips()) {
            const remainingMillis = getJourneyReplayRemainingMillis(replayState)
            if (remainingMillis !== null && remainingMillis <= END_WIDGET_LEAD_MS) {
                return false
            }
        }

        return true
    }

    const remainingMillis = getJourneyReplayRemainingMillis(replayState)
    if (remainingMillis === null || remainingMillis > END_WIDGET_LEAD_MS) {
        return false
    }

    if (hasJourneyReplayStopClips()) {
        return true
    }

    return remainingMillis > 0
}

export const resolveReplayVideoStatsWidgetVisibility = ({
    mode = 'journey',
    replay = defaultReplayStore(),
    controller = undefined,
} = {}) => (
    resolveReplayStatsWidgetVisibility({
        mode,
        replay,
        controller,
        includeEditorPhase: true,
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
