/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-scene-frame-qualifier.test.js
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

import {describe, expect, it, vi} from 'vitest'

import {
    createReplaySceneFrameQualifier,
    REPLAY_SCENE_FRAME_READINESS_READY,
    REPLAY_SCENE_FRAME_READINESS_TIMEOUT,
    REPLAY_SCENE_FRAME_READINESS_TRANSIENT,
} from '@Core/ui/replay/ReplaySceneFrameQualifier'

/**
 * Build a minimal canonical intent for scene qualification tests.
 *
 * @param {string} id - Intent identity.
 * @returns {Object} Canonical intent fixture.
 */
const createIntent = (id = 'intent-a') => ({
    id,
    scene: {
        cameraCommand: {
            id: `command-${id}`,
            version: 1,
            type: 'set-target-view',
            target: {longitude: 2, latitude: 48, altitude: 100},
            orientation: {headingRadians: 0, pitchRadians: -0.8, rollRadians: 0},
            rangeMeters: 500,
        },
    },
})

describe('ReplaySceneFrameQualifier', () => {
    it('applies transient scrub commands without waiting for scene readiness', async () => {
        const applyCameraCommand = vi.fn(() => ({commandId: 'command-intent-a'}))
        const prepareForCapture = vi.fn()
        const scene = {camera: {}, requestRender: vi.fn()}
        const qualifier = createReplaySceneFrameQualifier({
            scene,
            applyCameraCommand,
            createReadinessCoordinator: () => ({prepareForCapture, dispose: vi.fn()}),
        })

        const qualification = await qualifier.qualify({intent: createIntent(), settled: false})

        expect(applyCameraCommand).toHaveBeenCalledOnce()
        expect(scene.requestRender).toHaveBeenCalledOnce()
        expect(prepareForCapture).not.toHaveBeenCalled()
        expect(qualification.result.status).toBe('ready')
        expect(qualification.result.readiness.status).toBe(REPLAY_SCENE_FRAME_READINESS_TRANSIENT)
    })

    it('waits for bounded terrain and 3D Tiles readiness on settled scrub', async () => {
        const prepareForCapture = vi.fn(() => true)
        const qualifier = createReplaySceneFrameQualifier({
            scene: {camera: {}, requestRender: vi.fn()},
            readiness: {settledTimeoutMs: 900},
            applyCameraCommand: vi.fn(() => ({commandId: 'command-intent-a'})),
            createReadinessCoordinator: () => ({prepareForCapture, dispose: vi.fn()}),
        })
        const abortController = new AbortController()

        const qualification = await qualifier.qualify({
            intent: createIntent(),
            settled: true,
            signal: abortController.signal,
        })

        expect(prepareForCapture).toHaveBeenCalledWith({
            maxMillis: 900,
            signal: abortController.signal,
            settled: true,
            speedLevel: 'jump',
        })
        expect(qualification.result.status).toBe('ready')
        expect(qualification.result.readiness.status).toBe(REPLAY_SCENE_FRAME_READINESS_READY)
    })

    it('reports a bounded readiness timeout as degraded instead of blocking', async () => {
        const qualifier = createReplaySceneFrameQualifier({
            scene: {camera: {}, requestRender: vi.fn()},
            applyCameraCommand: vi.fn(() => ({commandId: 'command-intent-a'})),
            createReadinessCoordinator: () => ({
                prepareForCapture: vi.fn(() => false),
                dispose: vi.fn(),
            }),
        })

        const qualification = await qualifier.qualify({intent: createIntent(), settled: true})

        expect(qualification.result.status).toBe('degraded')
        expect(qualification.result.readiness.status).toBe(REPLAY_SCENE_FRAME_READINESS_TIMEOUT)
    })

    it('rejects stale qualification after disposal and releases listeners', async () => {
        let releaseReadiness = null
        const readiness = new Promise(resolve => {
            releaseReadiness = resolve
        })
        const disposeReadiness = vi.fn()
        const qualifier = createReplaySceneFrameQualifier({
            scene: {camera: {}, requestRender: vi.fn()},
            applyCameraCommand: vi.fn(() => ({commandId: 'command-intent-a'})),
            createReadinessCoordinator: () => ({
                prepareForCapture: vi.fn(() => readiness),
                dispose: disposeReadiness,
            }),
        })
        const qualification = qualifier.qualify({intent: createIntent(), settled: true})

        qualifier.dispose()
        releaseReadiness(true)

        await expect(qualification).rejects.toMatchObject({name: 'AbortError'})
        expect(disposeReadiness).toHaveBeenCalledOnce()
    })
})
