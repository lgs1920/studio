/**
 * Renderer-independent replay frame helpers.
 */

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

/**
 * Build the logical frame consumed by Draft and HQ replay rendering.
 *
 * @param {Object} options - Logical frame inputs.
 * @returns {Object} A renderer-independent replay frame.
 */
export const createJourneyReplayLogicalFrame = ({
                                                     sample = null,
                                                     progress = sample?.progress ?? 0,
                                                     durationMillis = sample?.journeyDurationMillis ?? null,
                                                     frameTimeMs = null,
                                                     frameIntervalMs = null,
                                                     cameraPose = null,
                                                     phase = null,
                                                     source = 'replay',
                                                 } = {}) => {
    const safeDurationMillis = finiteNumber(durationMillis)
    const safeProgress = clamp(finiteNumber(progress) ?? 0, 0, 1)
    const resolvedFrameTimeMs = finiteNumber(frameTimeMs)
                                ?? finiteNumber(sample?.journeyElapsedMillis)
                                ?? (safeDurationMillis === null ? 0 : safeProgress * safeDurationMillis)

    return {
        sample:          sample ?? null,
        progress:        safeProgress,
        elapsedMillis:   resolvedFrameTimeMs,
        durationMillis:  safeDurationMillis,
        frameTimeMs:     resolvedFrameTimeMs,
        frameIntervalMs: finiteNumber(frameIntervalMs),
        cameraPose:      cameraPose ?? null,
        phase:           phase ?? null,
        source,
    }
}
