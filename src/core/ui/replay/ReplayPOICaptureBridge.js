/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayPOICaptureBridge.js
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

/** Synchronize the existing React POI capture with an isolated Replay renderer. */

import {POIUtils} from '@Utils/cesium/POIUtils'
import {activeReplayRenderTargetForPOICapture} from './ReplayRenderTarget'

const DEFAULT_CAPTURE_TIMEOUT_MS = 5000
const captureWaiters = new Set()

const settleWaiter = (waiter, error = null) => {
    if (waiter.settled) {
        return
    }
    waiter.settled = true
    clearTimeout(waiter.timeout)
    captureWaiters.delete(waiter)
    if (error) {
        waiter.reject(error)
    }
    else {
        waiter.resolve()
    }
}

/** Wait for the React POI surface to finish a capture for the requested state. */
export const waitForReplayPOITargetCapture = ({
    target,
    poiId,
    expanded,
    timeoutMs = DEFAULT_CAPTURE_TIMEOUT_MS,
} = {}) => new Promise((resolve, reject) => {
    if (!target || !poiId) {
        reject(new Error('Native HQ cannot wait for a Replay POI capture without its render target and ID.'))
        return
    }

    const waiter = {target, poiId, expanded: expanded === true, resolve, reject, settled: false, timeout: null}
    waiter.timeout = setTimeout(() => {
        settleWaiter(
            waiter,
            new Error(`Native HQ timed out waiting for the ${waiter.expanded ? 'expanded' : 'collapsed'} Replay POI capture for ${poiId}.`),
        )
    }, Math.max(1, Number(timeoutMs) || DEFAULT_CAPTURE_TIMEOUT_MS))
    captureWaiters.add(waiter)
})

/** Draw one React-captured POI bitmap into the active isolated renderer. */
export const syncCapturedReplayPOIToTarget = async ({
    poi,
    expanded,
    effectiveVisibility,
} = {}) => {
    const target = activeReplayRenderTargetForPOICapture()
    if (!target || !poi?.id) {
        return null
    }

    const matchingWaiters = Array.from(captureWaiters).filter(waiter => waiter.target === target
        && waiter.poiId === poi.id
        && waiter.expanded === (expanded === true))
    if (matchingWaiters.length === 0) {
        return null
    }

    try {
        const entity = await POIUtils.draw(poi, true, {
            renderTarget: target,
            skipDuplicateCleanup: true,
            effectiveVisibility: effectiveVisibility === true,
        })
        if (!entity) {
            throw new Error(`Native HQ has no isolated Cesium entity for Replay POI ${poi.id}.`)
        }

        matchingWaiters.forEach(waiter => settleWaiter(waiter))
        return entity
    }
    catch (error) {
        const captureError = new Error(`Native HQ could not update Replay POI ${poi.id}: ${error?.message ?? error}`)
        for (const waiter of Array.from(captureWaiters)) {
            if (waiter.target === target && waiter.poiId === poi.id) {
                settleWaiter(waiter, captureError)
            }
        }
        throw captureError
    }
}

/** Reject capture waiters when the expansion update itself fails. */
export const cancelReplayPOITargetCaptureWait = (target, poiId, error) => {
    for (const waiter of Array.from(captureWaiters)) {
        if (waiter.target === target && waiter.poiId === poiId) {
            settleWaiter(waiter, error)
        }
    }
}

/** Reject any remaining waiters when export releases its isolated renderer. */
export const cancelReplayPOITargetCaptures = (target, error = new Error('Native HQ Replay POI capture was cancelled.')) => {
    for (const waiter of Array.from(captureWaiters)) {
        if (waiter.target === target) {
            settleWaiter(waiter, error)
        }
    }
}
