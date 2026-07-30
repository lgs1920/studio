import {describe, expect, it} from 'vitest'
import {
    buildReplayVideoTimeline,
    resolveReplayVideoFramePhase,
} from '@Core/ui/replay/ReplayDeferredExporter'

describe('Replay deferred exporter timeline', () => {
    const clips = {
        start: [
            {
                clipId: 'take-off',
                params: {duration: 2},
            },
        ],
        stop: [
            {
                clipId: 'landing',
                params: {duration: 3},
            },
        ],
    }

    it('builds a single ordered clip timeline shared by Draft and HQ', () => {
        const timeline = buildReplayVideoTimeline({
            replayDurationMillis: 10_000,
            fps: 25,
            direction: 1,
            clips,
        })

        expect(timeline.clipSignature).toBeTruthy()
        expect(timeline.phases).toHaveLength(3)
        expect(timeline.phases.map(phase => phase.slot)).toEqual(['start', 'replay', 'stop'])
        expect(timeline.phases.map(phase => phase.startMillis)).toEqual([0, 2_000, 12_000])
        expect(timeline.phases.map(phase => phase.endMillis)).toEqual([2_000, 12_000, 15_000])
    })

    it('resolves replay frames to the correct clip phase and local progress', () => {
        const timeline = buildReplayVideoTimeline({
            replayDurationMillis: 10_000,
            fps: 25,
            direction: 1,
            clips,
        })

        expect(resolveReplayVideoFramePhase({
            timeline,
            frame: {frameTimeMs: 0, progress: 0},
        })).toEqual(expect.objectContaining({
            kind: 'start',
            slot: 'start',
            localProgress: 0,
            progress: 0,
            replayFrameIndex: null,
            replayFrameCount: null,
        }))

        expect(resolveReplayVideoFramePhase({
            timeline,
            frame: {frameTimeMs: 2_000, progress: 0.2},
        })).toEqual(expect.objectContaining({
            kind: 'replay',
            slot: 'replay',
            localProgress: 0,
            progress: 0,
            replayFrameIndex: 0,
            replayFrameCount: 250,
        }))

        expect(resolveReplayVideoFramePhase({
            timeline,
            frame: {frameTimeMs: 7_000, progress: 0.7},
        })).toEqual(expect.objectContaining({
            kind: 'replay',
            slot: 'replay',
            localProgress: 0.5,
            progress: 0.5,
            replayFrameIndex: 125,
            replayFrameCount: 250,
        }))

        expect(resolveReplayVideoFramePhase({
            timeline,
            frame: {frameTimeMs: 12_000, progress: 1},
        })).toEqual(expect.objectContaining({
            kind: 'stop',
            slot: 'stop',
            localProgress: 0,
            progress: 1,
            replayFrameIndex: null,
            replayFrameCount: null,
        }))
    })

    it('mirrors clip anchor progress for reverse playback', () => {
        const timeline = buildReplayVideoTimeline({
            replayDurationMillis: 10_000,
            fps: 25,
            direction: -1,
            clips,
        })

        const startPhase = resolveReplayVideoFramePhase({
            timeline,
            frame: {frameTimeMs: 0, progress: 1},
        })
        const stopPhase = resolveReplayVideoFramePhase({
            timeline,
            frame: {frameTimeMs: 14_999, progress: 0},
        })

        expect(startPhase.anchorProgress).toBe(1)
        expect(stopPhase.anchorProgress).toBe(0)
    })
})
