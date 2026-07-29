import {
    clampReplayProgress,
    resolveReplayTimelineDuration,
    resolveReplayTimelineProgress,
} from '@Core/ui/replay/ReplayProgress'
import { describe, expect, it } from 'vitest'

describe('replay progress helpers', () => {
    it('resolves frame progress across the inclusive timeline', () => {
        expect(resolveReplayTimelineProgress({frameIndex: 0, frameCount: 101})).toBe(0)
        expect(resolveReplayTimelineProgress({frameIndex: 50, frameCount: 101})).toBe(0.5)
        expect(resolveReplayTimelineProgress({frameIndex: 100, frameCount: 101})).toBe(1)
    })

    it('falls back to elapsed time when frame metadata is unavailable', () => {
        expect(resolveReplayTimelineProgress({elapsedMillis: 250, durationMillis: 1000})).toBe(0.25)
    })

    it('clamps progress at the timeline boundaries', () => {
        expect(resolveReplayTimelineProgress({elapsedMillis: -100, durationMillis: 1000})).toBe(0)
        expect(resolveReplayTimelineProgress({elapsedMillis: 1200, durationMillis: 1000})).toBe(1)
        expect(clampReplayProgress('invalid')).toBe(0)
    })

    it('prefers the complete Draft video timeline over journey duration', () => {
        expect(resolveReplayTimelineDuration({
            videoTimelineDurationMillis: 3000,
            replayDurationMillis:       1000,
        })).toBe(3000)
        expect(resolveReplayTimelineDuration({
            videoTimelineDurationMillis: null,
            replayDurationMillis:       1000,
        })).toBe(1000)
    })
})
