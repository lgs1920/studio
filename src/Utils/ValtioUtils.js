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
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useMemo }                    from 'react'
import { proxy, useSnapshot }         from 'valtio'
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
