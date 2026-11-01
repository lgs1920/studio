/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiCanvasImageCache.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-31
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const DEFAULT_MAX_ENTRIES = 128
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024

/** Create an LRU cache for reusable POI canvases with a strict byte budget. */
export const createPOICanvasImageCache = ({maxEntries = DEFAULT_MAX_ENTRIES, maxBytes = DEFAULT_MAX_BYTES} = {}) => {
    const entries = new Map()
    const pendingCaptures = new Map()
    const entryLimit = Number.isSafeInteger(maxEntries) && maxEntries > 0 ? maxEntries : 1
    const byteLimit = Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES
    let retainedBytes = 0

    /** Remove one entry and update the retained canvas estimate. */
    const remove = key => {
        const entry = entries.get(key)
        if (!entry) {
            return
        }
        retainedBytes -= entry.estimatedBytes
        entries.delete(key)
    }

    /** Read a cached canvas and promote it to most recently used. */
    const get = key => {
        const entry = entries.get(key)
        if (!entry) {
            return null
        }
        entries.delete(key)
        entries.set(key, entry)
        return entry
    }

    /** Store a rendered canvas unless it exceeds the cache's total memory budget. */
    const set = (key, value) => {
        const width = Number(value?.canvas?.width)
        const height = Number(value?.canvas?.height)
        const estimatedBytes = width * height * 4
        if (typeof key !== 'string' || !Number.isFinite(estimatedBytes)
            || width <= 0 || height <= 0 || estimatedBytes > byteLimit) {
            return false
        }

        remove(key)
        while (entries.size >= entryLimit || retainedBytes + estimatedBytes > byteLimit) {
            const leastRecentlyUsedKey = entries.keys().next().value
            if (leastRecentlyUsedKey === undefined) {
                return false
            }
            remove(leastRecentlyUsedKey)
        }

        entries.set(key, {...value, estimatedBytes})
        retainedBytes += estimatedBytes
        return true
    }

    /** Start one capture and publish it to callers that request the same visual key. */
    const createCapture = (key, create) => {
        const capture = Promise.resolve()
            .then(create)
            .then(entry => {
                if (entry) {
                    set(key, entry)
                }
                return entry
            })
            .finally(() => {
                if (pendingCaptures.get(key) === capture) {
                    pendingCaptures.delete(key)
                }
            })
        pendingCaptures.set(key, capture)
        return capture.then(entry => ({entry, source: 'capture'}))
    }

    /** Reuse a cached or in-flight canvas, retrying a cancelled capture at most once. */
    const getOrCreate = async (key, create) => {
        const cached = get(key)
        if (cached) {
            return {entry: cached, source: 'cache'}
        }

        const pending = pendingCaptures.get(key)
        if (pending) {
            const entry = await pending
            if (entry) {
                return {entry, source: 'inflight'}
            }

            const cachedAfterPending = get(key)
            if (cachedAfterPending) {
                return {entry: cachedAfterPending, source: 'cache'}
            }

            // Another caller may have started a replacement while this caller was waiting.
            const replacement = pendingCaptures.get(key)
            if (replacement) {
                const replacementEntry = await replacement
                return replacementEntry
                    ? {entry: replacementEntry, source: 'inflight'}
                    : {entry: null, source: 'cancelled'}
            }

            // A cancelled creator must not recursively retry itself forever. One replacement
            // capture lets a still-current waiter recover without unbounded stale SnapDOM work.
            return createCapture(key, create)
        }

        return createCapture(key, create)
    }

    /** Clear all shared canvas references. */
    const clear = () => {
        entries.clear()
        retainedBytes = 0
    }

    return {get, set, getOrCreate, clear}
}

/** Shared POI bitmap cache; Cesium entities continue to own their displayed image. */
export const poiCanvasImageCache = createPOICanvasImageCache()
