/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-projection-scheduler.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-31
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {subscribeToPOIProjectionUpdates} from '@Components/cesium/poiProjectionScheduler'

const createEvent = () => {
    const listeners = new Set()
    return {
        addEventListener: listener => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        raise: () => listeners.forEach(listener => listener()),
        listenerCount: () => listeners.size,
    }
}

describe('POI projection scheduler', () => {
    it('subscribes to Cesium postRender and removes the listener on cleanup', () => {
        const postRender = createEvent()
        const onUpdate = vi.fn()
        const requestFrame = vi.fn()
        const remove = subscribeToPOIProjectionUpdates({
            scene: {postRender},
            camera: {changed: createEvent()},
            requestFrame,
            cancelFrame: vi.fn(),
            onUpdate,
        })

        expect(postRender.listenerCount()).toBe(1)
        expect(requestFrame).not.toHaveBeenCalled()
        postRender.raise()
        expect(onUpdate).toHaveBeenCalledOnce()

        remove()
        expect(postRender.listenerCount()).toBe(0)
    })

    it('uses the camera change event when the scene has no postRender event', () => {
        const changed = createEvent()
        const onUpdate = vi.fn()
        const remove = subscribeToPOIProjectionUpdates({
            scene: {},
            camera: {changed},
            onUpdate,
            requestFrame: vi.fn(),
            cancelFrame: vi.fn(),
        })

        changed.raise()
        expect(onUpdate).toHaveBeenCalledOnce()
        remove()
        expect(changed.listenerCount()).toBe(0)
    })

    it('falls back to animation frames only when Cesium events are unavailable', () => {
        const callbacks = new Map()
        const requestFrame = vi.fn(callback => {
            callbacks.set(1, callback)
            return 1
        })
        const cancelFrame = vi.fn()
        const onUpdate = vi.fn()
        const remove = subscribeToPOIProjectionUpdates({
            scene: {},
            camera: {},
            requestFrame,
            cancelFrame,
            onUpdate,
        })

        expect(requestFrame).toHaveBeenCalledOnce()
        callbacks.get(1)()
        expect(onUpdate).toHaveBeenCalledOnce()
        remove()
        expect(cancelFrame).toHaveBeenCalledWith(1)
        expect(requestFrame).toHaveBeenCalledTimes(2)
    })
})
