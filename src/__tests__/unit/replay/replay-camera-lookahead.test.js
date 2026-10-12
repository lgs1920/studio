/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-lookahead.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-12
 * Last modified: 2026-10-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'
import {JourneyReplayPathSampler} from '@Core/ui/replay/JourneyReplayPathSampler'
import {cameraLookaheadSample} from '@Core/ui/replay/JourneyReplayCameraVisibility'
import {JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {makeJourney, makeTrack} from './replay-phase1-fixtures'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {notify: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn()},
    LGS_ERROR_TOAST: 'error', LGS_INFORMATION_TOAST: 'info',
    LGS_SUCCESS_TOAST: 'success', LGS_WARNING_TOAST: 'warning',
}))

/** Build a real route sampler whose recording time differs from Replay time. */
const createLookaheadMode = (duration, timed = false) => {
    const journey = makeJourney([makeTrack({
        slug: 'lookahead#gpx',
        coordinates: [[2, 48, 120], [2.1, 48, 120], [2.2, 48, 120]],
        times: timed ? ['2026-01-01T00:00:00Z', '2026-01-01T12:00:00Z', '2026-01-02T00:00:00Z'] : undefined,
    })])
    const sampler = new JourneyReplayPathSampler({journey})
    return {sampler, [JOURNEY_REPLAY_INTERNAL_STATE]: {sampler, controller: {duration}}}
}

describe('Replay camera anticipation clock', () => {
    it.each([false, true])('looks three Replay seconds ahead independently of GPX timestamps (timed: %s)', timed => {
        const mode = createLookaheadMode(10, timed)
        const predicted = cameraLookaheadSample(mode, mode.sampler.atProgress(0.2), {
            lookaheadSeconds: 3,
            minimumMeters: 0,
        })

        expect(predicted?.progress).toBeCloseTo(0.5, 8)
    })

    it('scales the same horizon with the chosen Replay duration', () => {
        const mode = createLookaheadMode(60)
        const predicted = cameraLookaheadSample(mode, mode.sampler.atProgress(0.2), {
            lookaheadSeconds: 3,
            minimumMeters: 0,
        })

        expect(predicted?.progress).toBeCloseTo(0.25, 8)
    })

    it('anticipates toward lower progress during reverse playback', () => {
        const mode = createLookaheadMode(10)
        mode[JOURNEY_REPLAY_INTERNAL_STATE].controller.direction = -1
        const predicted = cameraLookaheadSample(mode, mode.sampler.atProgress(0.8), {
            lookaheadSeconds: 3,
            minimumMeters: 0,
        })

        expect(predicted?.progress).toBeCloseTo(0.5, 8)
    })

    it('preserves the metric floor and clamps anticipation to the route end', () => {
        const mode = createLookaheadMode(10)
        const anchor = mode.sampler.atProgress(0.2)
        const metric = cameraLookaheadSample(mode, anchor, {lookaheadSeconds: 0, minimumMeters: 120})
        const end = cameraLookaheadSample(mode, mode.sampler.atProgress(0.9), {lookaheadSeconds: 3, minimumMeters: 0})

        expect(metric.distanceFromStart - anchor.distanceFromStart).toBeCloseTo(120, 6)
        expect(end?.progress).toBe(1)
        expect(cameraLookaheadSample(mode, end, {lookaheadSeconds: 3, minimumMeters: 0})).toBeNull()
    })
})
