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
    const activeListeners = new Set()
    let activeSnapshot = []
    let pendingDrain = false
    let nextSequence = 0
    let consecutivePrioritizedSurfaces = 0
    let priorityRefreshCursor = 0

    /** Publish one stable snapshot after active surface ownership changes. */
    const notifyActiveSurfaces = () => {
        activeSnapshot = Array.from(activePOIs)
        activeListeners.forEach(listener => listener())
    }

    /** Notify only the component subscribed to one POI's surface state. */
    const notifyPOI = poiId => listenersByPOI.get(poiId)?.forEach(listener => listener())

    /** Choose the best current-view candidate while aging old requests fairly. */
    const selectNextPOI = () => {
        const pendingEntries = Array.from(pendingPOIs)
        if (pendingEntries.length > 0) {
            const refreshCount = Math.min(32, pendingEntries.length)
            for (let index = 0; index < refreshCount; index++) {
                const entryIndex = (priorityRefreshCursor + index) % pendingEntries.length
                const request = pendingEntries[entryIndex][1]
                if (request.getPriority) {
                    try {
                        const score = Number(request.getPriority())
                        request.score = Number.isFinite(score) ? score : 0
                    }
                    catch {
                        request.score = 0
                    }
                }
            }
            priorityRefreshCursor = (priorityRefreshCursor + refreshCount) % pendingEntries.length
        }

        let oldestPOIId
        let urgentPOIId
        let bestPOIId
        let bestScore = 0

        for (const [poiId, request] of pendingEntries) {
            if (oldestPOIId === undefined || request.sequence < pendingPOIs.get(oldestPOIId).sequence) {
                oldestPOIId = poiId
            }
            if (request.priority && urgentPOIId === undefined) {
                urgentPOIId = poiId
            }
            if (request.priority) {
                continue
            }

            const score = request.score ?? 0
            if (Number.isFinite(score) && score > bestScore) {
                bestScore = score
                bestPOIId = poiId
            }
        }

        const prioritizedPOIId = urgentPOIId
            ?? (consecutivePrioritizedSurfaces < 4 ? bestPOIId : undefined)
        if (prioritizedPOIId !== undefined) {
            const request = pendingPOIs.get(prioritizedPOIId)
            if (request.priority) {
                consecutivePrioritizedSurfaces = 0
            }
            else {
                consecutivePrioritizedSurfaces++
            }
            return prioritizedPOIId
        }

        consecutivePrioritizedSurfaces = 0
        return oldestPOIId
    }

    /** Promote queued POIs into the bounded active surface slots. */
    const drainQueue = () => {
        pendingDrain = false
        while (activePOIs.size - overflowPOIs.size < limit && pendingPOIs.size > 0) {
            const nextPOIId = selectNextPOI()
            if (nextPOIId === undefined) {
                return
            }
            pendingPOIs.delete(nextPOIId)
            activePOIs.add(nextPOIId)
            notifyPOI(nextPOIId)
            notifyActiveSurfaces()
        }

        if (activePOIs.size - overflowPOIs.size >= limit && overflowPOIs.size === 0 && pendingPOIs.size > 0) {
            for (const [poiId, request] of pendingPOIs) {
                if (request.allowOverflow) {
                    pendingPOIs.delete(poiId)
                    activePOIs.add(poiId)
                    overflowPOIs.add(poiId)
                    notifyPOI(poiId)
                    notifyActiveSurfaces()
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

    /** Read the active POI IDs for the single capture host. */
    const getActiveSnapshot = () => activeSnapshot

    /** Subscribe the capture host to bounded surface ownership changes. */
    const subscribeActive = listener => {
        if (typeof listener !== 'function') {
            return () => {}
        }
        activeListeners.add(listener)
        return () => activeListeners.delete(listener)
    }

    /** Batch routine requests so initial candidates can be ranked together. */
    const scheduleDrain = () => {
        if (pendingDrain) {
            return
        }
        pendingDrain = true
        queueMicrotask(drainQueue)
    }

    /** Request a capture surface, optionally moving the POI ahead of background requests. */
    const request = (poiId, {priority = false, allowOverflow = false, getPriority = null} = {}) => {
        if (!poiId || activePOIs.has(poiId)) {
            return
        }
        const previousRequest = pendingPOIs.get(poiId)
        pendingPOIs.set(poiId, {
            priority: priority || previousRequest?.priority === true,
            allowOverflow: allowOverflow || previousRequest?.allowOverflow === true,
            getPriority: getPriority ?? previousRequest?.getPriority ?? null,
            score: previousRequest?.score ?? 0,
            sequence: previousRequest?.sequence ?? nextSequence++,
        })
        if (priority) {
            drainQueue()
        }
        else {
            scheduleDrain()
        }
    }

    /** Release a completed capture surface unless an interaction currently retains it. */
    const release = poiId => {
        if (!poiId || retainedPOIs.has(poiId) || !activePOIs.delete(poiId)) {
            return
        }
        overflowPOIs.delete(poiId)
        notifyPOI(poiId)
        notifyActiveSurfaces()
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
            notifyActiveSurfaces()
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

    return {subscribe, getSnapshot, getActiveSnapshot, subscribeActive, request, release, cancel, retain}
}

/** Shared scheduler keeps one routine surface and one priority interaction overflow mounted. */
export const poiCaptureSurfaceStore = createPOICaptureSurfaceStore(1)

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

/** Subscribe the map host to the bounded set of mounted POI capture surfaces. */
export const useActivePOICaptureSurfaces = () => useSyncExternalStore(
    poiCaptureSurfaceStore.subscribeActive,
    poiCaptureSurfaceStore.getActiveSnapshot,
    () => [],
)
