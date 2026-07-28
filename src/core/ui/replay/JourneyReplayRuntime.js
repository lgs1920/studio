/**
 * Shared runtime helpers for Journey Replay.
 */

import {REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP, normalizeJourneyReplayClips} from './JourneyReplayClips'
import {createReplayRenderModeContract} from './ReplayRenderModeContract'
import {getJourneyReplaySettings} from './JourneyReplayProgressionStyle'

/**
 * Converts a value to a finite number.
 *
 * @param {*} value - Value to convert.
 * @returns {number|null} The finite number or null.
 */
export const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Converts a value to a finite number while preserving empty values as null.
 *
 * @param {*} value - Value to convert.
 * @returns {number|null} The finite number or null.
 */
const optionalFiniteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    return finiteNumber(value)
}

/**
 * Build a normalized replay frame payload shared by live playback, clip
 * playback, and HQ export.
 *
 * @param {object} options - Frame payload options.
 * @returns {object} Normalized frame payload.
 */
export const buildReplayFrameState = ({
    active = false,
    playing = false,
    paused = false,
    index = null,
    progress = 0,
    direction = 1,
    sample = null,
    elapsedMillis = null,
    durationMillis = null,
    frameId = null,
    frameCount = null,
    frameTimeMs = null,
    frameIntervalMs = null,
    replayFrameIndex = null,
    replayFrameCount = null,
    phase = null,
    source = null,
    updatedAt = null,
    renderMode = null,
    cameraPose = null,
    trackPath = null,
    initialCameraState = null,
    renderSpec = null,
    visibleOverlayIds = [],
    outputProfile = null,
} = {}) => {
    const safeIndex = optionalFiniteNumber(index)
    const safeFrameId = optionalFiniteNumber(frameId)
    const safeReplayFrameIndex = optionalFiniteNumber(replayFrameIndex)
    const safeFrameCount = optionalFiniteNumber(frameCount)
    const safeReplayFrameCount = optionalFiniteNumber(replayFrameCount)
    const resolvedIndex = safeIndex ?? safeReplayFrameIndex ?? safeFrameId ?? null
    const resolvedFrameCount = safeFrameCount ?? safeReplayFrameCount ?? null

    const renderContract = renderMode
                           ? createReplayRenderModeContract({
                               renderMode,
                               logicalFrame: {
                                   sample,
                                   progress:        optionalFiniteNumber(progress) ?? 0,
                                   elapsedMillis:   optionalFiniteNumber(elapsedMillis),
                                   durationMillis:  optionalFiniteNumber(durationMillis),
                                   frameTimeMs:     optionalFiniteNumber(frameTimeMs),
                                   frameIntervalMs: optionalFiniteNumber(frameIntervalMs),
                                   phase,
                                   source,
                               },
                               cameraPose,
                               trackPath,
                               initialCameraState,
                               renderSpec,
                               visibleOverlayIds,
                               outputProfile,
                           })
                           : null

    return {
        active:          Boolean(active),
        playing:         Boolean(playing),
        paused:          Boolean(paused),
        index:           resolvedIndex,
        frameIndex:      resolvedIndex,
        frameId:         safeFrameId,
        frameCount:      resolvedFrameCount,
        progress:        optionalFiniteNumber(progress) ?? 0,
        direction:       Number(direction) < 0 ? -1 : 1,
        sample:          sample ?? null,
        elapsedMillis:   optionalFiniteNumber(elapsedMillis),
        durationMillis:  optionalFiniteNumber(durationMillis),
        frameTimeMs:     optionalFiniteNumber(frameTimeMs),
        frameIntervalMs:  optionalFiniteNumber(frameIntervalMs),
        replayFrameIndex: safeReplayFrameIndex,
        replayFrameCount: safeReplayFrameCount,
        phase,
        source,
        updatedAt:       optionalFiniteNumber(updatedAt) ?? globalThis.performance?.now?.() ?? Date.now(),
        renderContract,
    }
}

/**
 * Returns the replay runtime store when it is available.
 *
 * @returns {Object|null} The replay store.
 */
export const replayStore = () => globalThis.lgs?.stores?.replay

/**
 * Returns whether the replay trace is currently being captured for video.
 *
 * @returns {boolean} Whether the video scene should display the replay trace.
 */
export const isJourneyReplayVideoCaptureActive = () => {
    const store = replayStore()
    const settings = globalThis.lgs?.settings?.ui?.replay
    return store?.recordingSync === true || settings?.recordingSync === true
}

/**
 * Resolves the clips that should be used by the current replay.
 *
 * @param {Object} options - Clip resolution options.
 * @returns {Object} Normalized replay clips.
 */
export const resolveJourneyReplayRuntimeClips = ({clips = null, settingsClips = {}, journey = null} = {}) => {
    if (clips) {
        return normalizeJourneyReplayClips(clips)
    }

    return normalizeJourneyReplayClips({
        catalog: settingsClips?.catalog ?? settingsClips?.definitions ?? {},
        start:   Array.isArray(journey?.replay?.start)
                 ? journey.replay.start
                 : settingsClips?.start ?? [],
        stop:    Array.isArray(journey?.replay?.stop)
                 ? journey.replay.stop
                 : settingsClips?.stop ?? [],
    })
}

/**
 * Returns the latest sample known by the replay runtime.
 *
 * @param {Object|null} controller - Playback controller.
 * @returns {Object|null} Current replay sample.
 */
export const currentJourneyReplaySample = controller => controller?.currentSample?.() ?? replayStore()?.sample ?? null

/**
 * Returns the configured POI behavior for the current replay.
 *
 * @returns {Object} POI behavior settings.
 */
export const currentJourneyReplayPoiBehavior = () => {
    const settings = getJourneyReplaySettings()
    const store = replayStore()
    return {
        hideAllPoisDuringJourneyReplay: settings.hideAllPoisDuringJourneyReplay === true || store?.hideAllPoisDuringJourneyReplay === true,
        animateAllPoisDuringJourneyReplay: settings.animateAllPoisDuringJourneyReplay === true || store?.animateAllPoisDuringJourneyReplay === true,
    }
}

/**
 * Resets transient replay progress in the runtime store.
 *
 * @param {Object|null} store - Replay runtime store.
 * @returns {void}
 */
export const resetRuntimeProgress = store => {
    if (!store) {
        return
    }

    store.active = false
    store.playing = false
    store.paused = false
    store.progress = 0
    store.elapsedMillis = null
    store.durationMillis = null
    store.sample = null
    store.totalDistance = 0
    store.toolbarVisible = false
    store.mainUiHidden = false
    store.clipSequenceActive = false
    store.orbitAllowed = true
    store.cameraUserAdjusted = false
    store.cameraUpdateSource = null
    store.hoverSample = null
    store.replayFramePhase = null
    store.dynamicFrameState = null
    store.metricOverlay = {
        ...store.metricOverlay,
        visible:   false,
        source:    null,
        anchor:    null,
        sample:    null,
        expiresAt: 0,
    }
}

/**
 * Publishes the state of a replay clip frame for dynamic widgets and capture.
 *
 * @param {Object} options - Clip frame state.
 * @returns {Object|null} Published clip phase.
 */
export const publishReplayClipFrameState = ({
                                                 store = replayStore(),
                                                 slot = REPLAY_CLIP_SLOT_START,
                                                 sample = null,
                                                 progress = slot === REPLAY_CLIP_SLOT_STOP ? 1 : 0,
                                             } = {}) => {
    if (!store) {
        return null
    }

    const phase = {
        kind: slot,
        slot,
        progress,
        localProgress: slot === REPLAY_CLIP_SLOT_STOP ? 1 : 0,
        replayFrameIndex: null,
        replayFrameCount: null,
        isLastTwoReplayFrames: false,
    }
    const now = globalThis.performance?.now?.() ?? Date.now()
    store.clipSequenceActive = true
    store.replayFramePhase = phase
    store.dynamicFrameState = buildReplayFrameState({
        active:         true,
        playing:        false,
        paused:         false,
        progress,
        direction:      Number(store.direction) < 0 ? -1 : 1,
        sample:         sample ?? store.sample ?? store.liveSample ?? null,
        elapsedMillis:   optionalFiniteNumber(sample?.journeyElapsedMillis)
                         ?? optionalFiniteNumber(store.elapsedMillis),
        durationMillis:  optionalFiniteNumber(sample?.journeyDurationMillis)
                         ?? optionalFiniteNumber(store.durationMillis),
        index:          null,
        frameCount:     null,
        frameTimeMs:    null,
        frameIntervalMs: null,
        frameId:        null,
        replayFrameIndex: null,
        replayFrameCount: null,
        phase,
        source:         'clip',
        updatedAt:      now,
    })
    return phase
}
