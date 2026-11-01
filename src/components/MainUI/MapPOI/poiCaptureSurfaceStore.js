/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiCaptureSurfaceStore.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {useCallback, useSyncExternalStore} from 'react'

/** Create a bounded scheduler for rich POI DOM capture surfaces. */
export const createPOICaptureSurfaceStore = (maxConcurrent = 2) => {
    const limit = Number.isSafeInteger(maxConcurrent) && maxConcurrent > 0 ? maxConcurrent : 1
    const activePOIs = new Set()
    const overflowPOIs = new Set()
    const pendingPOIs = new Map()
    const retainedPOIs = new Set()
    const listenersByPOI = new Map()

    /** Notify only the component subscribed to one POI's surface state. */
    const notifyPOI = poiId => listenersByPOI.get(poiId)?.forEach(listener => listener())

    /** Promote queued POIs into the bounded active surface slots. */
    const drainQueue = () => {
        while (activePOIs.size - overflowPOIs.size < limit && pendingPOIs.size > 0) {
            let nextPOIId
            for (const [poiId, request] of pendingPOIs) {
                if (request.priority) {
                    nextPOIId = poiId
                    break
                }
                if (nextPOIId === undefined) {
                    nextPOIId = poiId
                }
            }
            if (nextPOIId === undefined) {
                return
            }
            pendingPOIs.delete(nextPOIId)
            activePOIs.add(nextPOIId)
            notifyPOI(nextPOIId)
        }

        if (activePOIs.size - overflowPOIs.size >= limit && overflowPOIs.size === 0 && pendingPOIs.size > 0) {
            for (const [poiId, request] of pendingPOIs) {
                if (request.allowOverflow) {
                    pendingPOIs.delete(poiId)
                    activePOIs.add(poiId)
                    overflowPOIs.add(poiId)
                    notifyPOI(poiId)
                    break
                }
            }
        }
    }

    /** Subscribe to whether one POI currently owns a mounted capture surface. */
    const subscribe = (poiId, listener) => {
        if (!poiId || typeof listener !== 'function') {
            return () => {}
        }
        const listeners = listenersByPOI.get(poiId) ?? new Set()
        listeners.add(listener)
        listenersByPOI.set(poiId, listeners)
        return () => {
            listeners.delete(listener)
            if (listeners.size === 0) {
                listenersByPOI.delete(poiId)
            }
        }
    }

    /** Read the active state for one POI without exposing the shared scheduler sets. */
    const getSnapshot = poiId => Boolean(poiId && activePOIs.has(poiId))

    /** Request a capture surface, optionally moving the POI ahead of background requests. */
    const request = (poiId, {priority = false, allowOverflow = false} = {}) => {
        if (!poiId || activePOIs.has(poiId)) {
            return
        }
        const previousRequest = pendingPOIs.get(poiId)
        pendingPOIs.set(poiId, {
            priority: priority || previousRequest?.priority === true,
            allowOverflow: allowOverflow || previousRequest?.allowOverflow === true,
        })
        drainQueue()
    }

    /** Release a completed capture surface unless an interaction currently retains it. */
    const release = poiId => {
        if (!poiId || retainedPOIs.has(poiId) || !activePOIs.delete(poiId)) {
            return
        }
        overflowPOIs.delete(poiId)
        notifyPOI(poiId)
        drainQueue()
    }

    /** Cancel queued or active work for a POI that has been removed or unmounted. */
    const cancel = poiId => {
        if (!poiId) {
            return
        }
        pendingPOIs.delete(poiId)
        retainedPOIs.delete(poiId)
        overflowPOIs.delete(poiId)
        if (activePOIs.delete(poiId)) {
            notifyPOI(poiId)
            drainQueue()
        }
    }

    /** Retain a high-priority surface for an active drag or other short interaction. */
    const retain = (poiId, {priority = true} = {}) => {
        if (!poiId) {
            return () => {}
        }
        retainedPOIs.add(poiId)
        request(poiId, {priority, allowOverflow: true})
        return () => {
            retainedPOIs.delete(poiId)
            release(poiId)
        }
    }

    return {subscribe, getSnapshot, request, release, cancel, retain}
}

/** Shared scheduler keeps two routine surfaces and one retained interaction surface mounted. */
export const poiCaptureSurfaceStore = createPOICaptureSurfaceStore(2)

/** Subscribe a React component to one POI's active capture surface state. */
export const usePOICaptureSurface = poiId => {
    const subscribeToPOI = useCallback(
        listener => poiCaptureSurfaceStore.subscribe(poiId, listener),
        [poiId],
    )
    const getPOISnapshot = useCallback(
        () => poiCaptureSurfaceStore.getSnapshot(poiId),
        [poiId],
    )
    return useSyncExternalStore(subscribeToPOI, getPOISnapshot, () => false)
}
