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
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Creates a queue that limits concurrent POI canvas captures and replaces
 * pending work for a POI when a newer render request arrives.
 *
 * @param {number} maxConcurrent - Maximum number of captures running at once.
 * @returns {(key: unknown, render: () => Promise<void>) => void}
 */
export const createPOICanvasRenderQueue = (maxConcurrent = 2) => {
    const pendingRenders = new Map()
    let activeRenders = 0
    const concurrencyLimit = Number.isSafeInteger(maxConcurrent) && maxConcurrent > 0 ? maxConcurrent : 1

    const runPendingRenders = () => {
        while (activeRenders < concurrencyLimit && pendingRenders.size > 0) {
            const [key, render] = pendingRenders.entries().next().value
            pendingRenders.delete(key)
            activeRenders++

            Promise.resolve()
                .then(render)
                .catch(error => console.error('Queued POI canvas render failed:', error))
                .finally(() => {
                    activeRenders--
                    runPendingRenders()
                })
        }
    }

    return (key, render) => {
        if (key === undefined || key === null || typeof render !== 'function') {
            return
        }

        pendingRenders.set(key, render)
        runPendingRenders()
    }
}
