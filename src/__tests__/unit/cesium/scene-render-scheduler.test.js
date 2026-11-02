/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: scene-render-scheduler.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-02
 * Last modified: 2026-11-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {
    getOrCreateSceneRenderScheduler,
    requestSceneRender,
} from '@Utils/cesium/SceneRenderScheduler'

/** Create an observable Cesium-style event with removable listeners. */
const createEvent = () => {
    const listeners = new Set()
    return {
        addEventListener: listener => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
        get listenerCount() {
            return listeners.size
        },
        raise: (...args) => listeners.forEach(listener => listener(...args)),
    }
}

/** Create the minimal scene surface used by the scheduler tests. */
const createScene = ({requestRenderMode = true} = {}) => ({
    postUpdate: createEvent(),
    requestRender: vi.fn(),
    requestRenderMode,
})

describe('SceneRenderScheduler', () => {
    const scenes = new Set()

    afterEach(() => {
        scenes.forEach(scene => getOrCreateSceneRenderScheduler(scene)?.destroy())
        scenes.clear()
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('shares one listener and extends the consolidation window after invalidation', async () => {
        vi.useFakeTimers()
        const scene = createScene()
        scenes.add(scene)
        let monotonicTime = 0
        const scheduler = getOrCreateSceneRenderScheduler(scene, {now: () => monotonicTime})

        expect(getOrCreateSceneRenderScheduler(scene)).toBe(scheduler)
        expect(requestSceneRender(scene)).toBe(true)
        expect(scene.requestRender).toHaveBeenCalledOnce()
        expect(scene.postUpdate.listenerCount).toBe(1)

        scene.postUpdate.raise(scene)
        expect(scene.requestRender).toHaveBeenCalledTimes(2)

        await vi.advanceTimersByTimeAsync(150)
        monotonicTime = 150
        scheduler.invalidate()
        expect(scene.postUpdate.listenerCount).toBe(1)

        monotonicTime = 349
        await vi.advanceTimersByTimeAsync(199)
        scene.postUpdate.raise(scene)
        expect(scene.requestRender).toHaveBeenCalledTimes(4)
        expect(scene.postUpdate.listenerCount).toBe(1)

        monotonicTime = 350
        await vi.advanceTimersByTimeAsync(1)
        expect(scene.postUpdate.listenerCount).toBe(0)
        scene.postUpdate.raise(scene)
        expect(scene.requestRender).toHaveBeenCalledTimes(4)
    })

    it('cleans up the listener when scene updates stop before the deadline', async () => {
        vi.useFakeTimers()
        const scene = createScene()
        scenes.add(scene)
        const scheduler = getOrCreateSceneRenderScheduler(scene)

        scheduler.invalidate()
        expect(scene.postUpdate.listenerCount).toBe(1)

        await vi.advanceTimersByTimeAsync(200)

        expect(scene.postUpdate.listenerCount).toBe(0)
        expect(scene.requestRender).toHaveBeenCalledOnce()
    })

    it('keeps independent continuous consumers active until the final release', () => {
        const scene = createScene()
        scenes.add(scene)
        const scheduler = getOrCreateSceneRenderScheduler(scene)
        const releaseFirst = scheduler.acquireContinuous()
        const releaseSecond = scheduler.acquireContinuous()

        expect(scene.postUpdate.listenerCount).toBe(1)
        expect(scene.requestRender).toHaveBeenCalledTimes(2)

        releaseFirst()
        releaseFirst()
        scene.postUpdate.raise(scene)
        expect(scene.requestRender).toHaveBeenCalledTimes(3)
        expect(scene.postUpdate.listenerCount).toBe(1)

        releaseSecond()
        expect(scene.postUpdate.listenerCount).toBe(0)
        scene.postUpdate.raise(scene)
        expect(scene.requestRender).toHaveBeenCalledTimes(3)
    })

    it('does not add requests while an explicit continuous scene mode is active', () => {
        const scene = createScene({requestRenderMode: false})
        scenes.add(scene)
        const scheduler = getOrCreateSceneRenderScheduler(scene)

        scheduler.invalidate()
        scene.postUpdate.raise(scene)
        expect(scene.requestRender).toHaveBeenCalledOnce()

        scene.requestRenderMode = true
        scene.postUpdate.raise(scene)
        expect(scene.requestRender).toHaveBeenCalledTimes(2)
    })

    it('destroys its timer, listener, and continuous demands idempotently', async () => {
        vi.useFakeTimers()
        const scene = createScene()
        scenes.add(scene)
        const scheduler = getOrCreateSceneRenderScheduler(scene)
        const release = scheduler.acquireContinuous()
        scheduler.invalidate()

        expect(scene.postUpdate.listenerCount).toBe(1)
        expect(vi.getTimerCount()).toBe(1)

        scheduler.destroy()
        scheduler.destroy()
        release()

        expect(scheduler.destroyed).toBe(true)
        expect(scene.postUpdate.listenerCount).toBe(0)
        expect(vi.getTimerCount()).toBe(0)
        expect(scheduler.invalidate()).toBe(false)
        expect(scene.requestRender).toHaveBeenCalledTimes(2)

        await vi.runOnlyPendingTimersAsync()
        expect(scene.requestRender).toHaveBeenCalledTimes(2)
    })
})
