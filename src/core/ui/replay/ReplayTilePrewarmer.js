/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayTilePrewarmer.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-11
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const DEFAULT_PREWARM_STEP_MS = 333
const DEFAULT_PREWARM_MAX_SAMPLES = 3

/** Create the abort error used when a Replay tile-prewarm window is cancelled. */
const createReplayTilePrewarmAbortError = () => {
    if (typeof DOMException === 'function') {
        return new DOMException('The Replay tile-prewarm window was aborted.', 'AbortError')
    }

    const error = new Error('The Replay tile-prewarm window was aborted.')
    error.name = 'AbortError'
    return error
}

/**
 * Create a cancellable, bounded lookahead scheduler for a deterministic Replay timeline.
 *
 * Future views are rendered on the active target to start Cesium tile requests. Each
 * window restores its anchor frame before returning so the caller can render/capture it.
 *
 * @param {object} options - Timeline, render callbacks, and scheduling bounds.
 * @param {object|null} [options.timeline=null] - Replay frame timeline.
 * @param {number} [options.lookaheadMs=0] - Maximum future timeline span to warm.
 * @param {number} [options.stepMs=333] - Target time between warmed views.
 * @param {number} [options.maxSamples=3] - Maximum views warmed per window.
 * @param {Function|null} [options.prewarmFrame=null] - Render and qualify one future frame.
 * @param {Function|null} [options.restoreFrame=null] - Restore the current frame after a window.
 * @param {AbortSignal|null} [options.signal=null] - Optional export cancellation signal.
 * @param {Function|null} [options.onError=null] - Report non-cancellation warmup errors.
 * @returns {object|null} Prewarm lifecycle methods, or null when disabled or incomplete.
 */
export const createReplayTilePrewarmer = ({
    timeline = null,
    lookaheadMs = 0,
    stepMs = DEFAULT_PREWARM_STEP_MS,
    maxSamples = DEFAULT_PREWARM_MAX_SAMPLES,
    prewarmFrame = null,
    restoreFrame = null,
    signal = null,
    onError = null,
} = {}) => {
    const durationMs = Math.max(0, Number(timeline?.durationMillis) || 0)
    const safeLookaheadMs = Math.max(0, Number(lookaheadMs) || 0)
    const safeStepMs = Math.max(1, Number(stepMs) || DEFAULT_PREWARM_STEP_MS)
    const safeMaxSamples = Math.max(1, Math.trunc(Number(maxSamples) || DEFAULT_PREWARM_MAX_SAMPLES))
    if (!timeline?.frameAtIndex || !timeline?.frameAtTimeMs
        || durationMs <= 0 || safeLookaheadMs <= 0
        || typeof prewarmFrame !== 'function' || typeof restoreFrame !== 'function') {
        return null
    }

    let disposed = false
    let initialWindowCompleted = false
    let prewarmedThroughMs = 0
    let refreshAtMs = Math.max(0, safeLookaheadMs / 2)

    /** Reject work after disposal or export cancellation. */
    const throwIfCancelled = () => {
        if (disposed || signal?.aborted) {
            throw signal?.reason ?? createReplayTilePrewarmAbortError()
        }
    }

    /** Render bounded future samples, then restore the requested anchor frame. */
    const warmWindow = async ({startMs, endMs, anchorFrame}) => {
        const windowDurationMs = Math.max(0, endMs - startMs)
        const sampleCount = Math.min(
            safeMaxSamples,
            Math.max(1, Math.ceil(windowDurationMs / safeStepMs)),
        )
        let processedSamples = 0

        try {
            for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
                throwIfCancelled()
                const sampleTimeMs = startMs + (windowDurationMs * sampleIndex / sampleCount)
                const futureFrame = timeline.frameAtTimeMs(sampleTimeMs)
                if (!futureFrame || Number(futureFrame.frameTimeMs) <= Number(anchorFrame.frameTimeMs)) {
                    continue
                }

                await prewarmFrame(futureFrame)
                processedSamples += 1
                throwIfCancelled()
            }
        }
        catch (error) {
            if (signal?.aborted || disposed || error?.name === 'AbortError') {
                throw error?.name === 'AbortError' ? error : createReplayTilePrewarmAbortError()
            }

            onError?.(error, {startMs, endMs, processedSamples})
        }
        finally {
            await restoreFrame(anchorFrame)
        }

        return processedSamples
    }

    /** Warm the timeline prefix before the first output frame. */
    const prewarmInitial = async () => {
        throwIfCancelled()
        if (initialWindowCompleted) {
            return false
        }

        const anchorFrame = timeline.frameAtIndex(0)
        const endMs = Math.min(durationMs, safeLookaheadMs)
        const processedSamples = await warmWindow({startMs: 0, endMs, anchorFrame})
        prewarmedThroughMs = endMs
        refreshAtMs = Math.max(0, endMs - (safeLookaheadMs / 2))
        initialWindowCompleted = true
        return processedSamples > 0
    }

    /** Refill the future tile window when the current frame approaches its edge. */
    const prewarmBeforeFrame = async anchorFrame => {
        throwIfCancelled()
        if (!initialWindowCompleted || !anchorFrame) {
            return false
        }

        const anchorTimeMs = Math.max(0, Number(anchorFrame.frameTimeMs) || 0)
        if (anchorTimeMs < refreshAtMs || prewarmedThroughMs >= durationMs) {
            return false
        }

        const startMs = Math.max(anchorTimeMs, prewarmedThroughMs)
        const endMs = Math.min(durationMs, anchorTimeMs + safeLookaheadMs)
        if (endMs <= startMs) {
            return false
        }

        await warmWindow({startMs, endMs, anchorFrame})
        prewarmedThroughMs = endMs
        refreshAtMs = Math.max(anchorTimeMs, endMs - (safeLookaheadMs / 2))
        return true
    }

    /** Dispose the scheduler so no further future camera frames are rendered. */
    const dispose = () => {
        disposed = true
    }

    /** Read bounded scheduler state for diagnostics and regression tests. */
    const getState = () => ({
        disposed,
        initialWindowCompleted,
        prewarmedThroughMs,
        refreshAtMs,
    })

    return {
        prewarmInitial,
        prewarmBeforeFrame,
        dispose,
        getState,
    }
}
