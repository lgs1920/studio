/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-progress.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-29
 * Last modified: 2026-07-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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
        expect(resolveReplayTimelineProgress({
            frameIndex:    null,
            frameCount:    101,
            elapsedMillis: 250,
            durationMillis: 1000,
        })).toBe(0.25)
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
        expect(resolveReplayTimelineDuration({
            replayDurationMillis: 1000,
            clips: {
                start: [{params: {duration: 2}, enabled: true}],
                stop:  [{params: {duration: 3}, enabled: true}],
            },
        })).toBe(6000)
        expect(resolveReplayTimelineDuration({
            replayDurationMillis: 1000,
            clips: {
                start: [{params: {duration: 2}, enabled: false}],
            },
        })).toBe(1000)
    })
})
