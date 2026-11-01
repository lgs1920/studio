/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-canvas-render-queue.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-11
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'
import {proxy} from 'valtio'
import {createPOICanvasRenderQueue} from '@Components/MainUI/MapPOI/poiCanvasRenderQueue'

const queues = []

/** Create a queue with manually advanced idle callbacks and camera timers. */
const createScheduledQueue = ({isCameraMoving = () => false, replay = null} = {}) => {
    const idleCallbacks = new Map()
    const timers = new Map()
    let nextId = 0
    const enqueue = createPOICanvasRenderQueue(2, {
        getScene: () => null,
        getReplayStore: () => replay,
        isCameraMoving,
        requestIdleCallback: callback => {
            const id = nextId++
            idleCallbacks.set(id, callback)
            return id
        },
        cancelIdleCallback: id => idleCallbacks.delete(id),
        setTimeout: (callback, delay) => {
            const id = nextId++
            timers.set(id, {callback, delay})
            return id
        },
        clearTimeout: id => timers.delete(id),
    })
    queues.push(enqueue)
    return {enqueue, idleCallbacks, timers}
}

/** Run the oldest idle callback and flush the queue's promise boundary. */
const runIdle = async idleCallbacks => {
    const [id, callback] = idleCallbacks.entries().next().value ?? []
    expect(callback).toBeTypeOf('function')
    idleCallbacks.delete(id)
    callback()
    await Promise.resolve()
    await Promise.resolve()
}

/** Run the earliest scheduled camera pacing timer and flush its promise boundary. */
const runTimer = async timers => {
    const [id, timer] = timers.entries().next().value ?? []
    expect(timer).toBeDefined()
    timers.delete(id)
    timer.callback()
    await Promise.resolve()
    await Promise.resolve()
}

afterEach(() => {
    queues.splice(0).forEach(queue => queue.destroy())
    vi.restoreAllMocks()
})

describe('POI canvas render queue', () => {
    it('runs only one background capture per idle turn and drains every pending POI', async () => {
        const {enqueue, idleCallbacks} = createScheduledQueue()
        const started = []
        const resolvers = new Map()
        let active = 0
        let maxActive = 0

        for (let index = 0; index < 5; index++) {
            enqueue(index, () => {
                started.push(index)
                active++
                maxActive = Math.max(maxActive, active)
                return new Promise(resolve => {
                    resolvers.set(index, () => {
                        active--
                        resolve()
                    })
                })
            })
        }

        expect(started).toEqual([])
        await runIdle(idleCallbacks)
        expect(started).toEqual([0])
        expect(maxActive).toBe(1)

        for (let index = 0; index < 4; index++) {
            resolvers.get(index)()
            await vi.waitFor(() => expect(idleCallbacks.size).toBe(1))
            await runIdle(idleCallbacks)
            expect(started).toEqual(Array.from({length: index + 2}, (_, position) => position))
        }

        resolvers.get(4)()
        await vi.waitFor(() => expect(active).toBe(0))
        expect(started).toEqual([0, 1, 2, 3, 4])

        expect(maxActive).toBe(1)
    })

    it('keeps only the newest pending capture for a POI', async () => {
        const {enqueue, idleCallbacks} = createScheduledQueue()
        let releaseActive
        const activeCapture = new Promise(resolve => {
            releaseActive = resolve
        })
        const captureSuperseded = vi.fn()
        const captureLatest = vi.fn()

        enqueue('active', () => activeCapture)
        await runIdle(idleCallbacks)
        enqueue('queued-poi', captureSuperseded)
        enqueue('queued-poi', captureLatest)

        releaseActive()
        await vi.waitFor(() => expect(idleCallbacks.size).toBe(1))
        await runIdle(idleCallbacks)
        expect(captureLatest).toHaveBeenCalledOnce()
        expect(captureSuperseded).not.toHaveBeenCalled()
    })

    it('runs an interactive expansion before older queued POI captures', async () => {
        const {enqueue, idleCallbacks} = createScheduledQueue()
        let releaseActive
        const activeCapture = new Promise(resolve => {
            releaseActive = resolve
        })
        const started = []

        enqueue('active', () => {
            started.push('active')
            return activeCapture
        })
        await runIdle(idleCallbacks)
        expect(started).toEqual(['active'])
        enqueue('older', () => started.push('older'))
        enqueue('clicked', () => started.push('clicked'), {priority: true})

        await Promise.resolve()
        expect(started).toEqual(['active', 'clicked'])
        releaseActive()
        await vi.waitFor(() => expect(idleCallbacks.size).toBe(1))
        await runIdle(idleCallbacks)
        expect(started).toEqual(['active', 'clicked', 'older'])
    })

    it('continues one background capture at a time during indefinite camera movement', async () => {
        const {enqueue, timers} = createScheduledQueue({isCameraMoving: () => true})
        const started = []

        enqueue('first', () => started.push('first'))
        enqueue('second', () => started.push('second'))
        expect(timers.size).toBe(1)
        expect(timers.values().next().value.delay).toBe(64)

        await runTimer(timers)
        expect(started).toEqual(['first'])
        await vi.waitFor(() => expect(timers.size).toBe(1))
        await runTimer(timers)
        expect(started).toEqual(['first', 'second'])
    })

    it('keeps Replay background captures on the existing immediate concurrent path', async () => {
        const replay = proxy({active: true, playing: true, paused: false})
        const {enqueue, idleCallbacks, timers} = createScheduledQueue({replay})
        const started = []
        const release = new Map()
        let active = 0
        let maximumActive = 0

        for (const poiId of ['first', 'second', 'third']) {
            enqueue(poiId, () => {
                started.push(poiId)
                active++
                maximumActive = Math.max(maximumActive, active)
                return new Promise(resolve => release.set(poiId, () => {
                    active--
                    resolve()
                }))
            })
        }

        await vi.waitFor(() => expect(started).toHaveLength(2))
        expect(started).toEqual(['first', 'second'])
        expect(idleCallbacks.size).toBe(0)
        expect(timers.size).toBe(0)
        expect(maximumActive).toBe(2)

        release.get('first')()
        await vi.waitFor(() => expect(started).toHaveLength(3))
        release.get('second')()
        release.get('third')()
        await vi.waitFor(() => expect(active).toBe(0))
    })
})
