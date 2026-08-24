/**
 * Coalesced latest-request-wins scheduler for interactive replay scrubbing.
 */

import {clampReplayProgress} from './ReplayProgress'

/**
 * Request one browser animation frame.
 *
 * @param {Function} callback - Frame callback.
 * @returns {number} Animation-frame handle.
 */
const requestBrowserFrame = callback => globalThis.requestAnimationFrame(callback)

/**
 * Cancel one browser animation frame.
 *
 * @param {number} handle - Animation-frame handle.
 * @returns {void}
 */
const cancelBrowserFrame = handle => globalThis.cancelAnimationFrame(handle)

/**
 * Ignore an optional scheduler error.
 *
 * @returns {void}
 */
const ignoreSchedulerError = () => {}

/**
 * Create a scheduler that applies at most one transient seek per animation frame.
 *
 * New requests abort the previous asynchronous application. A settled request,
 * typically emitted when the pointer is released, is applied immediately.
 *
 * @param {Object} options - Scheduler dependencies.
 * @param {Function} options.apply - Apply one normalized scrub request.
 * @param {Function} options.requestFrame - Animation-frame scheduler.
 * @param {Function} options.cancelFrame - Animation-frame cancellation function.
 * @param {Function} options.onError - Non-abort error observer.
 * @returns {Object} Scrub scheduler API.
 */
export const createReplayScrubScheduler = (options = {}) => {
    const apply = options.apply
    const requestFrame = typeof options.requestFrame === 'function' ? options.requestFrame : requestBrowserFrame
    const cancelFrame = typeof options.cancelFrame === 'function' ? options.cancelFrame : cancelBrowserFrame
    const onError = typeof options.onError === 'function' ? options.onError : ignoreSchedulerError

    if (typeof apply !== 'function') {
        throw new TypeError('Replay scrub scheduler requires an apply function')
    }

    let disposed = false
    let frameHandle = null
    let latestRequest = null
    let requestId = 0
    let activeAbortController = null

    /**
     * Abort the currently applying request without changing queued work.
     *
     * @returns {void}
     */
    const abortActiveRequest = () => {
        activeAbortController?.abort()
        activeAbortController = null
    }

    /**
     * Cancel the queued animation-frame callback.
     *
     * @returns {void}
     */
    const cancelQueuedFrame = () => {
        if (frameHandle === null) {
            return
        }

        cancelFrame(frameHandle)
        frameHandle = null
    }

    /**
     * Apply the latest queued request and ignore any request it superseded.
     *
     * @param {boolean} settled - Whether exact settled quality is requested.
     * @returns {Promise<*>} Application result or null after cancellation.
     */
    const applyLatestRequest = async settled => {
        const request = latestRequest
        latestRequest = null
        if (disposed || !request) {
            return null
        }

        abortActiveRequest()
        const abortController = new AbortController()
        activeAbortController = abortController

        try {
            return await apply({
                ...request,
                settled,
                signal: abortController.signal,
            })
        }
        catch (error) {
            if (abortController.signal.aborted || error?.name === 'AbortError') {
                return null
            }

            onError(error)
            return null
        }
        finally {
            if (activeAbortController === abortController) {
                activeAbortController = null
            }
        }
    }

    /**
     * Apply one coalesced transient request at the next animation frame.
     *
     * @returns {void}
     */
    const flushQueuedRequest = () => {
        frameHandle = null
        void applyLatestRequest(false)
    }

    /**
     * Queue a transient slider request, replacing any older pending request.
     *
     * @param {number} progress - Requested replay progress.
     * @returns {number|null} Request identity, or null after disposal.
     */
    const request = progress => {
        if (disposed) {
            return null
        }

        abortActiveRequest()
        requestId += 1
        latestRequest = {
            progress: clampReplayProgress(progress),
            requestId,
        }
        if (frameHandle === null) {
            frameHandle = requestFrame(flushQueuedRequest)
        }
        return requestId
    }

    /**
     * Apply the exact final slider position immediately.
     *
     * @param {number} progress - Final replay progress.
     * @returns {Promise<*>} Settled application result.
     */
    const settle = progress => {
        if (disposed) {
            return Promise.resolve(null)
        }

        cancelQueuedFrame()
        abortActiveRequest()
        requestId += 1
        latestRequest = {
            progress: clampReplayProgress(progress),
            requestId,
        }
        return applyLatestRequest(true)
    }

    /**
     * Cancel queued and active work while keeping the scheduler reusable.
     *
     * @returns {void}
     */
    const cancel = () => {
        cancelQueuedFrame()
        abortActiveRequest()
        latestRequest = null
    }

    /**
     * Permanently release scheduler work and reject future requests.
     *
     * @returns {void}
     */
    const dispose = () => {
        if (disposed) {
            return
        }

        disposed = true
        cancel()
    }

    return {
        request,
        settle,
        cancel,
        dispose,
    }
}
