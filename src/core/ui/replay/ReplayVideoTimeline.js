/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayVideoTimeline.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-01
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Shared replay timeline used by Draft playback and HQ export.
 *
 * The timeline is deliberately independent from a render owner. It describes
 * the ordered start, replay, and stop phases so every renderer can resolve the
 * same absolute frame clock and local phase clock.
 */

import {normalizeJourneyReplayClips, REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP} from './JourneyReplayClips'

const DEFAULT_FPS = 30

/**
 * Resolve the reduced Draft camera calculation cadence.
 *
 * @param {Object} options - Cadence options.
 * @param {number} options.durationMillis - Replay duration in milliseconds.
 * @param {number} options.captureFps - Capture frame rate.
 * @returns {Object} Capture and camera cadence metadata.
 */
export const resolveDraftReplayCameraCadence = ({
    durationMillis = 0,
    captureFps = DEFAULT_FPS,
} = {}) => {
    const safeDurationMillis = Math.max(0, finiteNumber(durationMillis, 0) ?? 0)
    const safeCaptureFps = safeFps(captureFps)
    const durationSeconds = safeDurationMillis / 1000
    const reductionFactor = durationSeconds >= 180
        ? 3
        : durationSeconds >= 60
          ? 2.5
          : durationSeconds >= 10
            ? 2
            : 1
    const cameraFps = Math.max(1, safeCaptureFps / reductionFactor)
    return {
        captureFps: safeCaptureFps,
        cameraFps,
        reductionFactor,
        frameIntervalMs: 1000 / cameraFps,
        progressStep: safeDurationMillis > 0
            ? 1000 / (cameraFps * safeDurationMillis)
            : 1,
    }
}

/**
 * Convert a value to a finite number.
 *
 * @param {*} value - Value to convert.
 * @param {number|null} fallback - Value returned for invalid input.
 * @returns {number|null} A finite number or the fallback.
 */
const finiteNumber = (value, fallback = null) => {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

/**
 * Clamp a progress value to the normalized replay range.
 *
 * @param {*} value - Progress value.
 * @returns {number} Progress in the [0, 1] range.
 */
const clampProgress = value => Math.max(0, Math.min(1, Number(value) || 0))

/**
 * Resolve a valid frame rate for the shared timeline.
 *
 * @param {*} fps - Requested frame rate.
 * @returns {number} Positive frame rate.
 */
const safeFps = fps => Math.max(1, finiteNumber(fps, DEFAULT_FPS) ?? DEFAULT_FPS)

/**
 * Resolve the clip duration used by both replay renderers.
 *
 * @param {Object|null} clip - Normalized replay clip.
 * @returns {number} Clip duration in milliseconds.
 */
export const replayClipDurationMillis = clip => Math.max(
    0,
    finiteNumber(clip?.params?.duration, 0) ?? 0,
) * 1000

/**
 * Build a stable signature for the ordered clip lists.
 *
 * @param {Object|null} clips - Normalized replay clip lists.
 * @returns {string} Stable clip signature.
 */
export const replayClipSignature = clips => JSON.stringify({
    start: (clips?.start ?? []).map(clip => ({
        clipId: clip.clipId,
        params: clip.params ?? {},
        enabled: clip.enabled !== false,
    })),
    stop:  (clips?.stop ?? []).map(clip => ({
        clipId: clip.clipId,
        params: clip.params ?? {},
        enabled: clip.enabled !== false,
    })),
})

/**
 * Build the canonical start/replay/stop timeline.
 *
 * @param {Object} options - Timeline options.
 * @param {number} options.replayDurationMillis - Replay-only duration.
 * @param {number} options.fps - Timeline frame rate.
 * @param {number} options.direction - Playback direction.
 * @param {Object|null} options.clips - Replay clip lists.
 * @returns {Object} Canonical replay video timeline.
 */
export const buildReplayVideoTimeline = ({
    replayDurationMillis = 0,
    fps = DEFAULT_FPS,
    direction = 1,
    clips = null,
} = {}) => {
    const normalizedClips = normalizeJourneyReplayClips(clips ?? {})
    const safeDirectionValue = Number(direction) < 0 ? -1 : 1
    const safeFpsValue = safeFps(fps)
    const frameIntervalMs = 1000 / safeFpsValue
    const phases = []
    let cursor = 0

    /**
     * Append a phase while preserving absolute timeline boundaries.
     *
     * @param {Object} phase - Phase metadata.
     * @returns {Object} Appended phase.
     */
    const pushPhase = phase => {
        const durationMillis = Math.max(0, finiteNumber(phase.durationMillis, 0) ?? 0)
        const nextPhase = {
            ...phase,
            durationMillis,
            startMillis: cursor,
            endMillis:   cursor + durationMillis,
        }
        phases.push(nextPhase)
        cursor += durationMillis
        return nextPhase
    }

    normalizedClips.start.forEach(clip => {
        if (clip?.enabled === false) {
            return
        }

        pushPhase({
            kind: REPLAY_CLIP_SLOT_START,
            slot: REPLAY_CLIP_SLOT_START,
            clip,
            anchorProgress: safeDirectionValue < 0 ? 1 : 0,
            durationMillis: replayClipDurationMillis(clip),
        })
    })

    const safeReplayDuration = Math.max(0, finiteNumber(replayDurationMillis, 0) ?? 0)
    const replayPhase = pushPhase({
        kind: 'replay',
        slot: 'replay',
        anchorProgress: safeDirectionValue < 0 ? 1 : 0,
        durationMillis: safeReplayDuration,
    })

    normalizedClips.stop.forEach(clip => {
        if (clip?.enabled === false) {
            return
        }

        pushPhase({
            kind: REPLAY_CLIP_SLOT_STOP,
            slot: REPLAY_CLIP_SLOT_STOP,
            clip,
            anchorProgress: safeDirectionValue < 0 ? 0 : 1,
            durationMillis: replayClipDurationMillis(clip),
        })
    })

    const durationMillis = cursor
    const frameCount = durationMillis > 0
                        ? Math.ceil(durationMillis / frameIntervalMs) + 1
                        : 1

    return {
        fps: safeFpsValue,
        frameIntervalMs,
        direction: safeDirectionValue,
        replayDurationMillis: safeReplayDuration,
        durationMillis,
        frameCount,
        phases,
        replayPhase,
        clips: normalizedClips,
        clipSignature: replayClipSignature(normalizedClips),
    }
}

/**
 * Resolve one phase and its frame metrics from an absolute timeline time.
 *
 * @param {Object} options - Resolution options.
 * @param {Object|null} options.timeline - Canonical timeline.
 * @param {Object|null} options.frame - Render frame metadata.
 * @param {number|null} options.frameTimeMs - Absolute timeline time.
 * @param {boolean} options.isFinalSceneFrame - Whether this is the final scene frame.
 * @returns {Object} Resolved phase metadata.
 */
export const resolveReplayVideoFramePhase = ({
    timeline = null,
    frame = null,
    frameTimeMs = null,
    isFinalSceneFrame = false,
} = {}) => {
    const frameIntervalMs = timeline?.frameIntervalMs
                           ?? (timeline?.fps > 0 ? (1000 / timeline.fps) : (1000 / DEFAULT_FPS))
    const resolvePhaseFrameMetrics = ({phase = null, localMillis = 0} = {}) => {
        if (!phase) {
            return {
                phaseFrameIndex: 0,
                phaseFrameCount: 1,
            }
        }

        const phaseIndex = timeline?.phases?.indexOf?.(phase) ?? -1
        const isLastTimelinePhase = phaseIndex >= 0 && phaseIndex === timeline.phases.length - 1
        const duration = Math.max(0, Number(phase.durationMillis) || 0)
        const baseFrameCount = Math.max(1, Math.ceil(duration / frameIntervalMs))
        const phaseFrameCount = isLastTimelinePhase && duration > 0
                                ? baseFrameCount + 1
                                : baseFrameCount
        const phaseFrameIndex = Math.min(
            Math.max(0, phaseFrameCount - 1),
            Math.max(0, Math.round(Math.max(0, Number(localMillis) || 0) / frameIntervalMs)),
        )

        return {
            phaseFrameIndex,
            phaseFrameCount,
        }
    }

    const fallbackProgress = clampProgress(frame?.progress)
    const fallback = {
        kind: 'replay',
        slot: 'replay',
        progress: fallbackProgress,
        localProgress: fallbackProgress,
        anchorProgress: Number(timeline?.direction) < 0 ? 1 : 0,
        clip: null,
        frameTimeMs: 0,
        localMillis: 0,
        replayFrameIndex: 0,
        replayFrameCount: 1,
        isFinalSceneFrame: Boolean(isFinalSceneFrame || frame?.isLast === true),
        isLastPhaseFrame: true,
        isLastTwoReplayFrames: true,
        ...resolvePhaseFrameMetrics(),
    }
    if (!timeline?.phases?.length) {
        return fallback
    }

    const requestedTime = frameTimeMs ?? frame?.frameTimeMs
    const timeMs = Math.max(0, finiteNumber(requestedTime, 0) ?? 0)
    const phase = timeline.phases.find(item => timeMs < item.endMillis)
                  ?? timeline.phases[timeline.phases.length - 1]
                  ?? null
    if (!phase) {
        return fallback
    }

    const localMillis = Math.max(0, Math.min(phase.durationMillis, timeMs - phase.startMillis))
    const localProgress = phase.durationMillis > 0 ? clampProgress(localMillis / phase.durationMillis) : 1
    const replayProgress = phase.kind === 'replay'
                           ? (timeline.direction < 0 ? 1 - localProgress : localProgress)
                           : phase.anchorProgress
    const metrics = resolvePhaseFrameMetrics({phase, localMillis})
    const replayFrameIndex = phase.kind === 'replay' ? metrics.phaseFrameIndex : null
    const replayFrameCount = phase.kind === 'replay' ? metrics.phaseFrameCount : null
    const finalFrame = Boolean(
        isFinalSceneFrame
        || frame?.isLast === true
        || (timeline.durationMillis > 0 && timeMs >= timeline.durationMillis),
    )
    const frameIndex = Math.min(
        Math.max(0, timeline.frameCount - 1),
        Math.max(0, Math.round(timeMs / frameIntervalMs)),
    )

    return {
        ...phase,
        // Keep the absolute export clock available to deterministic camera
        // transitions. `localMillis` resets at every clip/replay phase and
        // must not be used as the camera transition clock.
        frameTimeMs: timeMs,
        frameIndex,
        frameCount: timeline.frameCount,
        progress: replayProgress,
        localProgress,
        localMillis,
        ...metrics,
        replayFrameIndex,
        replayFrameCount,
        isFinalSceneFrame: finalFrame,
        isLastPhaseFrame: metrics.phaseFrameIndex >= (metrics.phaseFrameCount - 1),
        isLastTwoReplayFrames: phase.kind === 'replay'
                               && replayFrameCount !== null
                               && (replayFrameCount - replayFrameIndex) <= 2,
    }
}
