/**
 * Replay progress helpers shared by live playback and Draft recording UI.
 */

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

const replayClipDurationMillis = clip => {
    const durationSeconds = finiteNumber(clip?.params?.duration)
                              ?? finiteNumber(clip?.values?.duration)
                              ?? finiteNumber(clip?.duration)
    return Math.max(0, durationSeconds ?? 0) * 1000
}

const replayClipsDurationMillis = clips => [...(clips?.start ?? []), ...(clips?.stop ?? [])]
    .filter(clip => clip?.enabled !== false)
    .reduce((total, clip) => total + replayClipDurationMillis(clip), 0)

/**
 * Clamp a replay progress value to the inclusive [0, 1] range.
 *
 * @param {*} value - Candidate progress value.
 * @returns {number} A normalized progress value.
 */
export const clampReplayProgress = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0
}

/**
 * Return the complete Draft timeline duration from the available replay data.
 *
 * The prepared video timeline includes Draft start and stop clips. The replay
 * duration plus enabled start and stop clips is retained as a fallback while
 * the deferred export plan is being prepared.
 *
 * @param {Object} options - Timeline duration candidates.
 * @param {*} options.videoTimelineDurationMillis - Full Draft video duration.
 * @param {*} options.replayDurationMillis - Journey replay playback duration.
 * @param {Object|null} options.clips - Optional Draft start and stop clips.
 * @returns {number|null} The usable duration, or null when none is available.
 */
export const resolveReplayTimelineDuration = ({
                                                  videoTimelineDurationMillis = null,
                                                  replayDurationMillis = null,
                                                  clips = null,
                                              } = {}) => {
    const videoDuration = finiteNumber(videoTimelineDurationMillis)
    if (videoDuration !== null && videoDuration > 0) {
        return videoDuration
    }

    const replayDuration = finiteNumber(replayDurationMillis)
    if (replayDuration === null || replayDuration <= 0) {
        return null
    }

    const clipsDuration = replayClipsDurationMillis(clips)
    return replayDuration + clipsDuration
}

/**
 * Resolve normalized progress from a frame timeline or elapsed timeline time.
 *
 * Frame progress is preferred because it represents the exact rendered frame.
 * Elapsed time is the canonical fallback for real-time Draft recording, where
 * the recorder owns the complete timeline including start and stop clips.
 *
 * @param {Object} options - Progress candidates.
 * @param {*} options.frameIndex - Zero-based rendered frame index.
 * @param {*} options.frameCount - Inclusive frame count for the timeline.
 * @param {*} options.elapsedMillis - Elapsed time on the timeline.
 * @param {*} options.durationMillis - Total duration of the timeline.
 * @param {*} options.fallback - Last-resort normalized progress value.
 * @returns {number|null} Normalized progress, or null when no timeline exists.
 */
export const resolveReplayTimelineProgress = ({
                                                  frameIndex = null,
                                                  frameCount = null,
                                                  elapsedMillis = null,
                                                  durationMillis = null,
                                                  fallback = null,
                                              } = {}) => {
    const safeFrameIndex = finiteNumber(frameIndex)
    const safeFrameCount = finiteNumber(frameCount)
    if (safeFrameIndex !== null && safeFrameCount !== null && safeFrameCount > 1) {
        return clampReplayProgress(safeFrameIndex / (safeFrameCount - 1))
    }

    const safeElapsedMillis = finiteNumber(elapsedMillis)
    const safeDurationMillis = finiteNumber(durationMillis)
    if (safeElapsedMillis !== null && safeDurationMillis !== null && safeDurationMillis > 0) {
        return clampReplayProgress(safeElapsedMillis / safeDurationMillis)
    }

    if (fallback === null || fallback === undefined) {
        return null
    }

    return clampReplayProgress(fallback)
}
