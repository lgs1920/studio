/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-video-render-session.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified on: 2026-07-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ReplayFrameTimeline } from '@Core/ui/replay/ReplayFrameTimeline'
import { ReplayVideoRenderSession } from '@Core/ui/replay/ReplayVideoRenderSession'
import { describe, expect, it, vi } from 'vitest'

describe('ReplayFrameTimeline', () => {
    it('generates inclusive frames from start to end', () => {
        const timeline = new ReplayFrameTimeline({durationMillis: 1000, fps: 10})

        expect(timeline.frameCount).toBe(11)
        expect(timeline.frameAtIndex(0).progress).toBe(0)
        expect(timeline.frameAtIndex(10).progress).toBe(1)
        expect(timeline.frameAtIndex(10).frameTimeMs).toBe(1000)
    })

    it('reverses progress when playing backward', () => {
        const timeline = new ReplayFrameTimeline({durationMillis: 1000, fps: 10, direction: -1})

        expect(timeline.frameAtIndex(0).progress).toBe(1)
        expect(timeline.frameAtIndex(10).progress).toBe(0)
    })
})

describe('ReplayVideoRenderSession', () => {
    it('seeks, renders, and records frames in order', async () => {
        const seek = vi.fn()
        const render = vi.fn(async ({frame, sample}) => ({frame, sample}))
        const beforeFrame = vi.fn(async () => undefined)
        const afterFrame = vi.fn(async () => undefined)
        const controller = {
            sampler: {
                atProgress: progress => ({progress, marker: Math.round(progress * 1000)}),
            },
            seek,
            currentSample: vi.fn(() => ({progress: -1})),
        }

        const session = new ReplayVideoRenderSession({
            controller,
            timeline: {durationMillis: 1000, fps: 10},
            render,
            beforeFrame,
            afterFrame,
        })

        const frames = await session.renderAll()

        expect(frames).toHaveLength(11)
        expect(seek).toHaveBeenCalledTimes(11)
        expect(render).toHaveBeenCalledTimes(11)
        expect(beforeFrame).toHaveBeenCalledTimes(11)
        expect(afterFrame).toHaveBeenCalledTimes(11)
        expect(frames[0].progress).toBe(0)
        expect(frames.at(-1).progress).toBe(1)
        expect(frames.at(-1).sample.marker).toBe(1000)
        expect(frames[0].renderContract).toEqual(expect.objectContaining({
            renderMode: 'hq',
            logicalFrame: expect.objectContaining({progress: 0}),
            scheduling: {realtime: false, frameByFrame: true},
        }))
    })

    it('can render a single frame deterministically', async () => {
        const seek = vi.fn()
        const render = vi.fn(async ({frame}) => frame.index)
        const session = new ReplayVideoRenderSession({
            controller: {
                sampler: {atProgress: progress => ({progress})},
                seek,
                currentSample: () => null,
            },
            timeline: {durationMillis: 500, fps: 5},
            render,
        })

        const rendered = await session.renderFrame(2)

        expect(seek).toHaveBeenCalledWith(0.8)
        expect(rendered.index).toBe(2)
        expect(rendered.progress).toBeCloseTo(0.8, 6)
        expect(rendered.renderResult).toBe(2)
    })

    it('supports async sample resolution', async () => {
        const seek = vi.fn()
        const resolveSample = vi.fn(async frame => ({frameIndex: frame.index, progress: frame.progress}))
        const session = new ReplayVideoRenderSession({
            controller: {
                seek,
                currentSample: () => null,
            },
            timeline: {durationMillis: 1000, fps: 10},
            resolveSample,
        })

        const rendered = await session.renderFrame(1)

        expect(resolveSample).toHaveBeenCalledTimes(1)
        expect(seek.mock.invocationCallOrder[0]).toBeLessThan(resolveSample.mock.invocationCallOrder[0])
        expect(rendered.sample.frameIndex).toBe(1)
        expect(rendered.sample.progress).toBeCloseTo(0.1, 6)
    })
})
