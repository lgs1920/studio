/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ValtioUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { proxy, subscribe, useSnapshot }              from 'valtio'
import { unstable_getInternalStates } from 'valtio/vanilla'

const {proxyStateMap} = unstable_getInternalStates()
const EMPTY_FALLBACK = {}

/**
 * Safely reads a Valtio proxy when the source can also be undefined or a plain object.
 * This avoids passing a non-proxy object to useSnapshot.
 *
 * @param {Object|undefined|null} state - Source state, ideally a Valtio proxy
 * @param {Object} [fallback={}] - Stable fallback state shape
 * @returns {Object} Render-optimized snapshot
 */
export const useOptionalSnapshot = (state, fallback = EMPTY_FALLBACK) => {
    const fallbackProxy = useMemo(() => proxy({...fallback}), [fallback])

    const snapshotSource = useMemo(() => {
        if (!state || typeof state !== 'object') {
            return fallbackProxy
        }

        return proxyStateMap.has(state) ? state : proxy(state)
    }, [fallbackProxy, state])

    return useSnapshot(snapshotSource)
}

/**
 * Subscribe to a small derived value without creating a deep Valtio snapshot.
 *
 * @param {Object|undefined|null} state - Source Valtio proxy
 * @param {Function} selector - Function returning the value used by the component
 * @param {*} [fallback] - Value returned when the source or selector is absent
 * @returns {*} Selected reactive value
 */
export const useProxyValue = (state, selector, fallback = undefined) => {
    const subscribeToState = useCallback((onStoreChange) => {
        if (!state || typeof state !== 'object' || !proxyStateMap.has(state)) {
            return () => {}
        }

        return subscribe(state, onStoreChange)
    }, [state])

    const getValue = useCallback(() => {
        if (!state || typeof state !== 'object') {
            return fallback
        }

        const value = selector(state)
        return value === undefined ? fallback : value
    }, [fallback, selector, state])

    return useSyncExternalStore(subscribeToState, getValue, getValue)
}
