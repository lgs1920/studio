/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replayPOISelectorStore.js
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
import {subscribe} from 'valtio'

const EMPTY_ARRAY = []
const FIELDS = ['nearby', 'animated']
const listenersByField = Object.fromEntries(FIELDS.map(field => [field, new Map()]))
const idsByField = Object.fromEntries(FIELDS.map(field => [field, new Set()]))
const sourceArrayByField = Object.fromEntries(FIELDS.map(field => [field, undefined]))

let replayStore = null
let removeReplayStoreSubscription = null
let activeSubscriberCount = 0

/** Extract IDs from either Replay's nearby entries or active animation list. */
const indexPOIIds = (field, values) => {
    const ids = new Set()
    for (const value of values) {
        const poiId = field === 'nearby' ? value?.poi?.id : value
        if (poiId) {
            ids.add(poiId)
        }
    }
    return ids
}

/** Notify subscribers only for POI IDs whose selected Replay membership changed. */
const notifyMembershipChanges = (field, previousIds, nextIds) => {
    const poiIds = new Set([...previousIds, ...nextIds])
    const listenersByPOIId = listenersByField[field]
    for (const poiId of poiIds) {
        if (previousIds.has(poiId) === nextIds.has(poiId)) {
            continue
        }
        listenersByPOIId.get(poiId)?.forEach(listener => listener())
    }
}

/** Subscribe once to the active Replay proxy and rebuild only replaced ID arrays. */
const synchronizeReplaySelectors = (notifyChanges = true) => {
    const nextReplayStore = globalThis.lgs?.stores?.replay ?? null
    let replayStoreChanged = nextReplayStore !== replayStore
    if (replayStoreChanged) {
        removeReplayStoreSubscription?.()
        removeReplayStoreSubscription = null
        replayStore = nextReplayStore
        FIELDS.forEach(field => {
            sourceArrayByField[field] = undefined
        })
        if (activeSubscriberCount > 0 && replayStore) {
            removeReplayStoreSubscription = subscribe(replayStore, () => synchronizeReplaySelectors(), true)
        }
    }

    FIELDS.forEach(field => {
        const sourceArray = Array.isArray(replayStore?.[field === 'nearby' ? 'nearbyPois' : 'animatedPOIIds'])
            ? replayStore[field === 'nearby' ? 'nearbyPois' : 'animatedPOIIds']
            : EMPTY_ARRAY
        if (!replayStoreChanged && sourceArrayByField[field] === sourceArray) {
            return
        }

        const previousIds = idsByField[field]
        const nextIds = indexPOIIds(field, sourceArray)
        idsByField[field] = nextIds
        sourceArrayByField[field] = sourceArray
        if (notifyChanges) {
            notifyMembershipChanges(field, previousIds, nextIds)
        }
    })
}

/** Return the current membership flag for one POI without exposing shared arrays to React. */
export const getReplayPOISelectorSnapshot = (field, poiId) => {
    if (!listenersByField[field] || !poiId) {
        return false
    }
    synchronizeReplaySelectors(false)
    return idsByField[field].has(poiId)
}

/** Subscribe one POI to nearby or animated membership changes. */
export const subscribeToReplayPOISelector = (field, poiId, listener) => {
    if (!listenersByField[field] || !poiId || typeof listener !== 'function') {
        return () => {}
    }

    const listenersByPOIId = listenersByField[field]
    const listeners = listenersByPOIId.get(poiId) ?? new Set()
    listeners.add(listener)
    listenersByPOIId.set(poiId, listeners)
    activeSubscriberCount += 1
    if (activeSubscriberCount === 1 && replayStore && !removeReplayStoreSubscription) {
        removeReplayStoreSubscription = subscribe(replayStore, () => synchronizeReplaySelectors(), true)
    }
    synchronizeReplaySelectors()

    return () => {
        listeners.delete(listener)
        if (!listeners.size) {
            listenersByPOIId.delete(poiId)
        }
        activeSubscriberCount = Math.max(0, activeSubscriberCount - 1)
        if (activeSubscriberCount === 0) {
            removeReplayStoreSubscription?.()
            removeReplayStoreSubscription = null
            replayStore = null
            FIELDS.forEach(selectedField => {
                idsByField[selectedField] = new Set()
                sourceArrayByField[selectedField] = undefined
            })
        }
    }
}

/** Subscribe a React POI surface to one ID-scoped Replay membership flag. */
export const useReplayPOISelector = (field, poiId) => {
    const subscribeToSelector = useCallback(
        listener => subscribeToReplayPOISelector(field, poiId, listener),
        [field, poiId],
    )
    const getSelectorSnapshot = useCallback(
        () => getReplayPOISelectorSnapshot(field, poiId),
        [field, poiId],
    )

    return useSyncExternalStore(subscribeToSelector, getSelectorSnapshot, () => false)
}
