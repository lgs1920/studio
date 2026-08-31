/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-scrub-scheduler.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {afterEach, describe, expect, it, vi} from 'vitest'

import {createReplayScrubScheduler} from '@Core/ui/replay/ReplayScrubScheduler'

/**
 * Build a controllable animation-frame test harness.
 *
 * @returns {Object} Request, cancel, and flush helpers.
 */
const createFrameHarness = () => {
    let nextHandle = 0
    const callbacks = new Map()

    /**
     * Queue one animation-frame callback.
     *
     * @param {Function} callback - Callback to queue.
     * @returns {number} Frame handle.
     */
    const requestFrame = callback => {
        nextHandle += 1
        callbacks.set(nextHandle, callback)
        return nextHandle
    }

    /**
     * Cancel one queued animation-frame callback.
     *
     * @param {number} handle - Frame handle.
     * @returns {void}
     */
    const cancelFrame = handle => {
        callbacks.delete(handle)
    }

    /**
     * Run every currently queued callback once.
     *
     * @returns {void}
     */
    const flush = () => {
        const queued = [...callbacks.values()]
        callbacks.clear()
        queued.forEach(callback => callback())
    }

    return {requestFrame, cancelFrame, flush, callbacks}
}

describe('ReplayScrubScheduler', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('coalesces pointer input and applies only the latest progress', async () => {
        const frames = createFrameHarness()
        const apply = vi.fn()
        const scheduler = createReplayScrubScheduler({
            apply,
            requestFrame: frames.requestFrame,
            cancelFrame: frames.cancelFrame,
        })

        scheduler.request(0.1)
        scheduler.request(0.4)
        scheduler.request(0.75)

        expect(frames.callbacks.size).toBe(1)
        frames.flush()
        await Promise.resolve()

        expect(apply).toHaveBeenCalledTimes(1)
        expect(apply.mock.calls[0][0]).toMatchObject({
            progress: 0.75,
            requestId: 3,
            settled: false,
        })
    })

    it('cancels a queued request and applies the settled position immediately', async () => {
        const frames = createFrameHarness()
        const apply = vi.fn(({progress}) => progress)
        const scheduler = createReplayScrubScheduler({
            apply,
            requestFrame: frames.requestFrame,
            cancelFrame: frames.cancelFrame,
        })

        scheduler.request(0.2)
        const result = await scheduler.settle(0.6)

        expect(result).toBe(0.6)
        expect(frames.callbacks.size).toBe(0)
        expect(apply).toHaveBeenCalledTimes(1)
        expect(apply.mock.calls[0][0]).toMatchObject({
            progress: 0.6,
            requestId: 2,
            settled: true,
        })
    })

    it('throttles transient requests while keeping the latest position', async () => {
        vi.useFakeTimers()
        const frames = createFrameHarness()
        const apply = vi.fn()
        const scheduler = createReplayScrubScheduler({
            apply,
            requestFrame: frames.requestFrame,
            cancelFrame: frames.cancelFrame,
            throttleMillis: 100,
        })

        scheduler.request(0.1)
        frames.flush()
        await Promise.resolve()

        scheduler.request(0.2)
        scheduler.request(0.3)
        expect(frames.callbacks.size).toBe(0)

        vi.advanceTimersByTime(99)
        expect(frames.callbacks.size).toBe(0)

        vi.advanceTimersByTime(1)
        expect(frames.callbacks.size).toBe(1)
        frames.flush()
        await Promise.resolve()

        expect(apply).toHaveBeenCalledTimes(2)
        expect(apply.mock.calls[1][0]).toMatchObject({
            progress: 0.3,
            settled: false,
        })
    })

    it('aborts stale asynchronous work when a newer request arrives', async () => {
        const frames = createFrameHarness()
        const signals = []
        const apply = vi.fn(({signal}) => {
            signals.push(signal)
            return new Promise(() => {})
        })
        const scheduler = createReplayScrubScheduler({
            apply,
            requestFrame: frames.requestFrame,
            cancelFrame: frames.cancelFrame,
        })

        scheduler.request(0.25)
        frames.flush()
        await Promise.resolve()
        scheduler.request(0.5)

        expect(signals[0].aborted).toBe(true)
    })

    it('clamps progress and ignores requests after disposal', async () => {
        const frames = createFrameHarness()
        const apply = vi.fn()
        const scheduler = createReplayScrubScheduler({
            apply,
            requestFrame: frames.requestFrame,
            cancelFrame: frames.cancelFrame,
        })

        await scheduler.settle(3)
        scheduler.dispose()

        expect(apply.mock.calls[0][0].progress).toBe(1)
        expect(scheduler.request(0.4)).toBeNull()
        await expect(scheduler.settle(0.4)).resolves.toBeNull()
    })
})
