/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiCanvasRenderQueue.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-11
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Creates a queue that limits concurrent POI canvas captures and replaces
 * pending work for a POI when a newer render request arrives.
 *
 * @param {number} maxConcurrent - Maximum number of captures running at once.
 * @returns {Function} Queue callable with a cancel(key) method for pending work.
 */
export const createPOICanvasRenderQueue = (maxConcurrent = 2) => {
    const pendingRenders = new Map()
    const priorityRenders = new Map()
    const activeKeys = new Set()
    let activeRenders = 0
    let activeOverflowRenders = 0
    let backgroundYieldPending = false
    let scheduledDrain = null
    const concurrencyLimit = Number.isSafeInteger(maxConcurrent) && maxConcurrent > 0 ? maxConcurrent : 1

    const cancelScheduledDrain = () => {
        if (!scheduledDrain) {
            return
        }
        scheduledDrain.cancel()
        scheduledDrain = null
    }

    const runPendingRenders = () => {
        while (pendingRenders.size > 0 || priorityRenders.size > 0) {
            let nextQueue
            let nextKey
            let nextQueuedRender
            for (const [key, queuedRender] of priorityRenders) {
                if (!activeKeys.has(key)
                    && (activeRenders < concurrencyLimit
                        || (queuedRender.allowOverflow && activeOverflowRenders === 0))) {
                    nextQueue = priorityRenders
                    nextKey = key
                    nextQueuedRender = queuedRender
                    break
                }
            }
            if (!nextQueuedRender) {
                for (const [key, queuedRender] of pendingRenders) {
                    if (!activeKeys.has(key)
                        && (activeRenders < concurrencyLimit
                            || (queuedRender.allowOverflow && activeOverflowRenders === 0))) {
                        nextQueue = pendingRenders
                        nextKey = key
                        nextQueuedRender = queuedRender
                        break
                    }
                }
            }
            if (!nextQueuedRender) {
                return
            }

            nextQueue.delete(nextKey)
            const isOverflowRender = activeRenders >= concurrencyLimit
            activeRenders++
            activeKeys.add(nextKey)
            if (isOverflowRender) {
                // Reserve one extra slot for an interactive capture when background work fills the queue.
                activeOverflowRenders++
            }

            Promise.resolve()
                .then(nextQueuedRender.render)
                .catch(error => console.error('Queued POI canvas render failed:', error))
                .finally(() => {
                    backgroundYieldPending = true
                    try {
                        nextQueuedRender.onSettled?.()
                    }
                    catch (error) {
                        console.error('Queued POI canvas settlement failed:', error)
                    }
                    activeRenders--
                    activeKeys.delete(nextKey)
                    if (isOverflowRender) {
                        activeOverflowRenders--
                    }
                    if (priorityRenders.size > 0) {
                        cancelScheduledDrain()
                        backgroundYieldPending = false
                        runPendingRenders()
                    }
                    else if (pendingRenders.size > 0) {
                        schedulePendingRenders()
                    }
                    else {
                        backgroundYieldPending = false
                    }
                })
        }
    }

    const schedulePendingRenders = () => {
        if (scheduledDrain || (pendingRenders.size === 0 && priorityRenders.size === 0)) {
            return
        }

        const drain = () => {
            scheduledDrain = null
            backgroundYieldPending = false
            runPendingRenders()
        }

        if (typeof globalThis.requestIdleCallback === 'function') {
            const idleCallbackId = globalThis.requestIdleCallback(drain, {timeout: 160})
            scheduledDrain = {
                cancel: () => globalThis.cancelIdleCallback?.(idleCallbackId),
            }
            return
        }

        const timeoutId = globalThis.setTimeout(drain, 16)
        scheduledDrain = {cancel: () => globalThis.clearTimeout(timeoutId)}
    }

    const enqueue = (key, render, {
        priority = false,
        allowOverflow = false,
        onSettled = null,
        onSuperseded = null,
        onCancelled = null,
    } = {}) => {
        if (key === undefined || key === null || typeof render !== 'function') {
            return
        }

        const previousRender = priorityRenders.get(key) ?? pendingRenders.get(key)
        const isPriority = priority || previousRender?.priority === true
        const canOverflow = allowOverflow || previousRender?.allowOverflow === true
        if (previousRender) {
            try {
                previousRender.onSuperseded?.()
            }
            catch (error) {
                console.error('Queued POI canvas supersession callback failed:', error)
            }
        }
        pendingRenders.delete(key)
        priorityRenders.delete(key)
        const queuedRender = {render, priority: isPriority, allowOverflow: canOverflow, onSettled, onSuperseded, onCancelled}
        if (isPriority) {
            priorityRenders.set(key, queuedRender)
            cancelScheduledDrain()
            backgroundYieldPending = false
            runPendingRenders()
        }
        else {
            pendingRenders.set(key, queuedRender)
            if (!scheduledDrain && !backgroundYieldPending) {
                runPendingRenders()
            }
        }
    }

    enqueue.cancel = key => {
        const queuedRender = priorityRenders.get(key) ?? pendingRenders.get(key)
        if (!queuedRender) {
            return false
        }
        priorityRenders.delete(key)
        pendingRenders.delete(key)
        try {
            queuedRender.onCancelled?.()
        }
        catch (error) {
            console.error('Queued POI canvas cancellation callback failed:', error)
        }
        if (queuedRender.priority) {
            cancelScheduledDrain()
            backgroundYieldPending = false
            runPendingRenders()
        }
        else {
            schedulePendingRenders()
        }
        return true
    }

    return enqueue
}
