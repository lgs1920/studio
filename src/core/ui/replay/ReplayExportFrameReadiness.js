/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayExportFrameReadiness.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-07
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Wait for bounded Cesium frame readiness under an adaptive or strict policy.
 *
 * @param {Object} options - Readiness adapter and policy.
 * @param {Function} options.prepareForCapture - Bounded scene-readiness operation.
 * @param {'adaptive'|'strict'} [options.policy='adaptive'] - Timeout policy.
 * @param {number} [options.maxMillis=5000] - Per-attempt wait limit.
 * @param {number} [options.maxRetries=2] - Additional strict attempts after timeout.
 * @param {AbortSignal|null} [options.signal=null] - Export cancellation signal.
 * @returns {Promise<Object>} Readiness status, attempt count and optional error.
 */
export const qualifyReplayExportFrameReadiness = async ({
    prepareForCapture,
    policy = 'adaptive',
    maxMillis = 5000,
    maxRetries = 2,
    signal = null,
    settled = false,
    speedLevel = 'normal',
} = {}) => {
    const strict = policy === 'strict'
    const retryLimit = strict ? Math.max(0, Math.trunc(Number(maxRetries) || 0)) : 0
    let attempts = 0
    let timeouts = 0
    const cancellationError = () => {
        const error = new Error('Replay frame readiness was cancelled.')
        error.name = 'AbortError'
        return error
    }

    while (attempts <= retryLimit) {
        attempts += 1
        if (signal?.aborted) {
            return {status: 'cancelled', attempts, timeouts, error: signal.reason ?? cancellationError()}
        }

        try {
            const ready = await prepareForCapture?.({maxMillis, signal, settled, speedLevel})
            if (signal?.aborted) {
                return {status: 'cancelled', attempts, timeouts, error: signal.reason ?? cancellationError()}
            }
            if (ready === true) {
                return {status: 'ready', attempts, timeouts, error: null}
            }
            timeouts += 1
        }
        catch (error) {
            return {
                status: error?.name === 'AbortError' || signal?.aborted ? 'cancelled' : 'failed',
                attempts,
                timeouts,
                error: error ?? cancellationError(),
            }
        }
    }

    return {status: 'timeout', attempts, timeouts, error: null}
}
