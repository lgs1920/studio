/**
 * Execution result for one canonical replay frame intent.
 */

export const REPLAY_FRAME_RESULT_VERSION = 1
export const REPLAY_FRAME_RESULT_READY = 'ready'
export const REPLAY_FRAME_RESULT_DEGRADED = 'degraded'
export const REPLAY_FRAME_RESULT_FAILED = 'failed'
export const REPLAY_FRAME_RESULT_CANCELLED = 'cancelled'

const REPLAY_FRAME_RESULT_STATUSES = new Set([
    REPLAY_FRAME_RESULT_READY,
    REPLAY_FRAME_RESULT_DEGRADED,
    REPLAY_FRAME_RESULT_FAILED,
    REPLAY_FRAME_RESULT_CANCELLED,
])

/**
 * Convert a result metric to a finite number while preserving empty values.
 *
 * @param {*} value - Metric value to normalize.
 * @returns {number|null} Finite number or null.
 */
const optionalFiniteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Clone plain result data without retaining external resource ownership.
 *
 * @param {*} value - Plain value to clone.
 * @returns {*} Cloned value or null.
 */
const cloneReplayFrameResultValue = value => {
    if (value === null || value === undefined) {
        return value ?? null
    }

    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value)
        }
        catch {
            // Plain JSON diagnostics remain the compatibility fallback.
        }
    }

    const serialized = JSON.stringify(value)
    return serialized === undefined ? null : JSON.parse(serialized)
}

/**
 * Create an execution result linked to exactly one frame intent.
 *
 * @param {Object} options - Frame execution result inputs.
 * @returns {Object} Canonical replay frame result.
 */
export const createReplayFrameResult = ({
                                            intentId = null,
                                            status = REPLAY_FRAME_RESULT_READY,
                                            readiness = null,
                                            media = null,
                                            timings = null,
                                            encoded = false,
                                            error = null,
                                            completedAt = null,
                                        } = {}) => ({
    version: REPLAY_FRAME_RESULT_VERSION,
    intentId: intentId ?? null,
    status: REPLAY_FRAME_RESULT_STATUSES.has(status) ? status : REPLAY_FRAME_RESULT_FAILED,
    readiness: cloneReplayFrameResultValue(readiness),
    media: cloneReplayFrameResultValue(media),
    timings: cloneReplayFrameResultValue(timings),
    encoded: Boolean(encoded),
    error: error
           ? {
               name: `${error.name ?? 'Error'}`,
               message: `${error.message ?? error}`,
           }
           : null,
    completedAt: optionalFiniteNumber(completedAt)
                 ?? globalThis.performance?.now?.()
                 ?? Date.now(),
})
