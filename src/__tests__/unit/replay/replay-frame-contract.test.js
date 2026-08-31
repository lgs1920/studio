/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-frame-contract.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {
    createReplayFrameIntent,
    createReplayFrameIntentFromState,
    isResolvedReplayFrameIntent,
    REPLAY_FRAME_INTENT_VERSION,
} from '@Core/ui/replay/ReplayFrameIntent'
import {
    attachReplayFrameIntent,
    publishReplayFrameState,
    REPLAY_FRAME_PUBLICATION_TARGET_HQ,
    resolvePublishedReplayFrame,
} from '@Core/ui/replay/ReplayFramePublisher'
import {
    createReplayFrameResult,
    REPLAY_FRAME_RESULT_DEGRADED,
    REPLAY_FRAME_RESULT_VERSION,
} from '@Core/ui/replay/ReplayFrameResult'
import {createReplayRenderModeContract} from '@Core/ui/replay/ReplayRenderModeContract'

describe('ReplayFrameIntent', () => {
    it('captures one complete renderer-independent pixel intent', () => {
        const sample = {progress: 0.5, longitude: 2, latitude: 48}
        const cameraPose = {heading: 0.4, pitch: -0.8, cameraHeight: 1200}
        const intent = createReplayFrameIntent({
            planId: 'plan-a',
            resolved: true,
            renderMode: 'hq',
            source: 'exporter',
            frameId: 12,
            frameIndex: 10,
            frameCount: 30,
            timeMs: 500,
            durationMillis: 1500,
            frameIntervalMs: 50,
            progress: 0.5,
            sample,
            cameraPose,
            visibleOverlayIds: ['stats', 'profile', 'stats'],
        })

        sample.longitude = 9
        cameraPose.heading = 2

        expect(intent).toEqual(expect.objectContaining({
            version: REPLAY_FRAME_INTENT_VERSION,
            id: 'plan-a:hq:exporter:12:500',
            planId: 'plan-a',
            resolved: true,
            renderMode: 'hq',
        }))
        expect(intent.frame).toEqual(expect.objectContaining({
            id: 12,
            index: 10,
            count: 30,
            timeMs: 500,
            intervalMillis: 50,
        }))
        expect(intent.replay.sample.longitude).toBe(2)
        expect(intent.scene.cameraPose.heading).toBe(0.4)
        expect(intent.composition.visibleOverlayIds).toEqual(['profile', 'stats'])
        expect(isResolvedReplayFrameIntent(intent)).toBe(true)
    })

    it('builds a resolved intent from the completed logical camera frame', () => {
        const renderContract = createReplayRenderModeContract({
            renderMode: 'draft',
            logicalFrame: {
                sample: {progress: 0.25},
                progress: 0.25,
                frameTimeMs: 250,
            },
            cameraPose: {heading: 0.5, pitch: -0.75},
            trackPath: [[[2, 48, 100], [2.1, 48.1, 120]]],
        })
        const frameState = {
            frameId: 2,
            frameIndex: 1,
            frameCount: 4,
            progress: 0.25,
            direction: 1,
            sample: {progress: 0.25},
            frameTimeMs: 250,
            renderContract,
            source: 'controller',
        }

        const intent = createReplayFrameIntentFromState(frameState, {resolved: true})

        expect(intent.resolved).toBe(true)
        expect(intent.scene.cameraPose).toEqual({heading: 0.5, pitch: -0.75})
        expect(intent.scene.trackPath).toEqual([[[2, 48, 100], [2.1, 48.1, 120]]])
    })
})

describe('ReplayFramePublisher', () => {
    const frameState = {
        active: true,
        frameId: 1,
        frameIndex: 0,
        frameTimeMs: 0,
        progress: 0,
        direction: 1,
        source: 'controller',
    }

    it('keeps pending Draft state separate from the last resolved visual frame', () => {
        const replay = {}
        const pending = publishReplayFrameState({
            replay,
            frameState,
            intentOptions: {resolved: false},
        })

        expect(pending.intentResolved).toBe(false)
        expect(replay.dynamicFrameState).toBe(pending)
        expect(replay.resolvedFrameState).toBeUndefined()

        const resolved = publishReplayFrameState({
            replay,
            frameState,
            intentOptions: {resolved: true},
        })
        const nextPending = publishReplayFrameState({
            replay,
            frameState: {...frameState, frameId: 2, frameTimeMs: 16},
            intentOptions: {resolved: false},
        })

        expect(nextPending.intentResolved).toBe(false)
        expect(resolvePublishedReplayFrame(replay)).toBe(resolved)
    })

    it('publishes resolved HQ frames inside the active export plan', () => {
        const replay = {}
        const plan = {runtime: {status: 'exporting', contextKey: 'plan-hq'}}
        const published = publishReplayFrameState({
            replay,
            plan,
            target: REPLAY_FRAME_PUBLICATION_TARGET_HQ,
            frameState,
            intentOptions: {planId: 'plan-hq', resolved: true},
        })

        expect(plan.runtime.frameState).toBe(published)
        expect(plan.runtime.resolvedFrameState).toBe(published)
        expect(resolvePublishedReplayFrame({deferredExportPlan: plan})).toBe(published)
    })

    it('attaches compatibility metadata without mutating the source frame', () => {
        const source = {...frameState}
        const publication = attachReplayFrameIntent(source, {resolved: true})

        expect(publication).not.toBe(source)
        expect(source.intent).toBeUndefined()
        expect(publication.intentResolved).toBe(true)
    })
})

describe('ReplayFrameResult', () => {
    it('links readiness and diagnostics to one frame intent', () => {
        const result = createReplayFrameResult({
            intentId: 'plan-a:hq:exporter:12:500',
            status: REPLAY_FRAME_RESULT_DEGRADED,
            readiness: {status: 'timeout', waitedMillis: 250},
            encoded: true,
            completedAt: 750,
        })

        expect(result).toEqual(expect.objectContaining({
            version: REPLAY_FRAME_RESULT_VERSION,
            intentId: 'plan-a:hq:exporter:12:500',
            status: REPLAY_FRAME_RESULT_DEGRADED,
            encoded: true,
            completedAt: 750,
        }))
        expect(result.readiness).toEqual({status: 'timeout', waitedMillis: 250})
    })
})
