/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-tile-prewarmer.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-11
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {ReplayFrameTimeline} from '@Core/ui/replay/ReplayFrameTimeline'
import {createReplayTilePrewarmer} from '@Core/ui/replay/ReplayTilePrewarmer'

describe('ReplayTilePrewarmer', () => {
    it('warms an initial prefix and refills a bounded window ahead of the current frame', async () => {
        const timeline = new ReplayFrameTimeline({durationMillis: 3000, fps: 10})
        const prewarmFrame = vi.fn(async () => true)
        const restoreFrame = vi.fn(async () => undefined)
        const prewarmer = createReplayTilePrewarmer({
            timeline,
            lookaheadMs: 1000,
            prewarmFrame,
            restoreFrame,
        })

        await expect(prewarmer.prewarmInitial()).resolves.toBe(true)
        expect(prewarmFrame.mock.calls.map(([frame]) => frame.frameTimeMs)).toEqual([300, 700, 1000])
        expect(restoreFrame.mock.calls.map(([frame]) => frame.frameTimeMs)).toEqual([0])

        await expect(prewarmer.prewarmBeforeFrame(timeline.frameAtTimeMs(500))).resolves.toBe(true)
        expect(prewarmFrame.mock.calls.slice(3).map(([frame]) => frame.frameTimeMs)).toEqual([1300, 1500])
        expect(restoreFrame.mock.calls.at(-1)?.[0].frameTimeMs).toBe(500)
        expect(prewarmer.getState()).toMatchObject({
            initialWindowCompleted: true,
            prewarmedThroughMs: 1500,
            refreshAtMs: 1000,
        })

        await expect(prewarmer.prewarmBeforeFrame(timeline.frameAtTimeMs(600))).resolves.toBe(false)
        await expect(prewarmer.prewarmBeforeFrame(timeline.frameAtTimeMs(1000))).resolves.toBe(true)
        expect(prewarmFrame.mock.calls.slice(5).map(([frame]) => frame.frameTimeMs)).toEqual([1800, 2000])
        expect(restoreFrame.mock.calls.at(-1)?.[0].frameTimeMs).toBe(1000)
    })

    it('clamps the initial window to the end of a short timeline', async () => {
        const timeline = new ReplayFrameTimeline({durationMillis: 500, fps: 10})
        const prewarmFrame = vi.fn(async () => true)
        const restoreFrame = vi.fn(async () => undefined)
        const prewarmer = createReplayTilePrewarmer({
            timeline,
            lookaheadMs: 1000,
            prewarmFrame,
            restoreFrame,
        })

        await expect(prewarmer.prewarmInitial()).resolves.toBe(true)
        expect(prewarmFrame.mock.calls.map(([frame]) => frame.frameTimeMs)).toEqual([300, 500])
        expect(restoreFrame.mock.calls).toHaveLength(1)
        await expect(prewarmer.prewarmBeforeFrame(timeline.frameAtIndex(5))).resolves.toBe(false)
    })

    it('restores the current frame when cancellation interrupts future view loading', async () => {
        const timeline = new ReplayFrameTimeline({durationMillis: 3000, fps: 10})
        const abortController = new AbortController()
        const restoreFrame = vi.fn(async () => undefined)
        const prewarmer = createReplayTilePrewarmer({
            timeline,
            lookaheadMs: 1000,
            signal: abortController.signal,
            prewarmFrame: async () => {
                abortController.abort()
            },
            restoreFrame,
        })

        await expect(prewarmer.prewarmInitial()).rejects.toMatchObject({name: 'AbortError'})
        expect(restoreFrame).toHaveBeenCalledOnce()
        expect(restoreFrame.mock.calls[0][0].frameTimeMs).toBe(0)
    })

    it('does not schedule work after disposal', async () => {
        const timeline = new ReplayFrameTimeline({durationMillis: 3000, fps: 10})
        const prewarmFrame = vi.fn(async () => true)
        const restoreFrame = vi.fn(async () => undefined)
        const prewarmer = createReplayTilePrewarmer({
            timeline,
            lookaheadMs: 1000,
            prewarmFrame,
            restoreFrame,
        })

        await prewarmer.prewarmInitial()
        prewarmer.dispose()

        await expect(prewarmer.prewarmBeforeFrame(timeline.frameAtTimeMs(500))).rejects.toMatchObject({name: 'AbortError'})
        expect(prewarmFrame).toHaveBeenCalledTimes(3)
        expect(prewarmer.getState().disposed).toBe(true)
    })
})
