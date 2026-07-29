/**
 * Replay progress helpers shared by live playback and Draft recording UI.
 */

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
 * Return the first positive finite duration from the available replay timelines.
 *
 * The prepared video timeline includes Draft start and stop clips. The replay
 * duration is retained as a fallback while the deferred export plan is being
 * prepared or when a standalone replay has no video timeline.
 *
 * @param {Object} options - Timeline duration candidates.
 * @param {*} options.videoTimelineDurationMillis - Full Draft video duration.
 * @param {*} options.replayDurationMillis - Journey replay duration fallback.
 * @returns {number|null} The usable duration, or null when none is available.
 */
export const resolveReplayTimelineDuration = ({
                                                  videoTimelineDurationMillis = null,
                                                  replayDurationMillis = null,
                                              } = {}) => {
    const videoDuration = Number(videoTimelineDurationMillis)
    if (Number.isFinite(videoDuration) && videoDuration > 0) {
        return videoDuration
    }

    const replayDuration = Number(replayDurationMillis)
    return Number.isFinite(replayDuration) && replayDuration > 0 ? replayDuration : null
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
    const safeFrameIndex = Number(frameIndex)
    const safeFrameCount = Number(frameCount)
    if (Number.isFinite(safeFrameIndex) && Number.isFinite(safeFrameCount) && safeFrameCount > 1) {
        return clampReplayProgress(safeFrameIndex / (safeFrameCount - 1))
    }

    const safeElapsedMillis = Number(elapsedMillis)
    const safeDurationMillis = Number(durationMillis)
    if (Number.isFinite(safeElapsedMillis) && Number.isFinite(safeDurationMillis) && safeDurationMillis > 0) {
        return clampReplayProgress(safeElapsedMillis / safeDurationMillis)
    }

    if (fallback === null || fallback === undefined) {
        return null
    }

    return clampReplayProgress(fallback)
}
