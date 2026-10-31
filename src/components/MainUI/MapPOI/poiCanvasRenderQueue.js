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
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Creates a queue that limits concurrent POI canvas captures and replaces
 * pending work for a POI when a newer render request arrives.
 *
 * @param {number} maxConcurrent - Maximum number of captures running at once.
 * @returns {(key: unknown, render: () => Promise<void>, options?: {priority?: boolean, allowOverflow?: boolean}) => void}
 */
export const createPOICanvasRenderQueue = (maxConcurrent = 2) => {
    const pendingRenders = new Map()
    const priorityRenders = new Map()
    const activeKeys = new Set()
    let activeRenders = 0
    let activeOverflowRenders = 0
    const concurrencyLimit = Number.isSafeInteger(maxConcurrent) && maxConcurrent > 0 ? maxConcurrent : 1

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
                    activeRenders--
                    activeKeys.delete(nextKey)
                    if (isOverflowRender) {
                        activeOverflowRenders--
                    }
                    runPendingRenders()
                })
        }
    }

    return (key, render, {priority = false, allowOverflow = false} = {}) => {
        if (key === undefined || key === null || typeof render !== 'function') {
            return
        }

        const previousRender = priorityRenders.get(key) ?? pendingRenders.get(key)
        const isPriority = priority || previousRender?.priority === true
        const canOverflow = allowOverflow || previousRender?.allowOverflow === true
        pendingRenders.delete(key)
        priorityRenders.delete(key)
        const queuedRender = {render, priority: isPriority, allowOverflow: canOverflow}
        if (isPriority) {
            priorityRenders.set(key, queuedRender)
        }
        else {
            pendingRenders.set(key, queuedRender)
        }
        runPendingRenders()
    }
}
