/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-definition.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-10-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it, vi} from 'vitest'

import {
    createReplayCameraDefinition,
    replayCameraSettingsFromDefinition,
} from '@Core/ui/replay/ReplayCameraDefinition'
import {
    createReplayCameraPoseResolver,
    resolveReplayCameraPose,
} from '@Core/ui/replay/ReplayCameraEvaluator'
import {createReplayDefinition} from '@Core/ui/replay/ReplayDefinition'
import {ReplayFrameResolver} from '@Core/ui/replay/ReplayFrameResolver'
import {createReplayRenderPlan} from '@Core/ui/replay/ReplayRenderPlan'
import {buildReplayVideoTimeline} from '@Core/ui/replay/ReplayVideoTimeline'

/**
 * Build one camera definition used by canonical evaluator tests.
 *
 * @param {Object} overrides - Optional definition overrides.
 * @returns {Object} Canonical camera definition.
 */
const createCameraFixture = (overrides = {}) => createReplayCameraDefinition({
    cameraSettings: {
        cameraAngle: 30,
        altitudeMode: 'ground-offset',
        altitude: 300,
        pitch: -45,
        canRoll: false,
        ...overrides.cameraSettings,
    },
    markerSettings: overrides.markerSettings ?? {mode: 'trace'},
    startAnchor: overrides.startAnchor ?? {
        longitude: 2,
        latitude: 48,
        altitude: 120,
        progress: 0,
    },
})

describe('canonical replay camera definition', () => {
    it('normalizes persisted settings into radians and metric units', () => {
        const definition = createCameraFixture()

        expect(definition.anchor.start).toEqual({
            longitude: 2,
            latitude: 48,
            altitude: 120,
            progress: 0,
        })
        expect(definition.position.altitudeMeters).toBe(300)
        expect(definition.position.nominalRangeMeters).toBeCloseTo(300 / Math.sin(Math.PI / 4), 8)
        expect(definition.version).toBe(2)
        expect(definition.position.cameraAngleDegrees).toBe(30)
        expect(definition.orientation.pitchRadians).toBeCloseTo(-Math.PI / 4, 8)
        expect(definition.orientation.roll.enabled).toBe(false)
    })

    it('round-trips through the legacy settings adapter without changing framing settings', () => {
        const definition = createCameraFixture()
        const settings = replayCameraSettingsFromDefinition(definition)

        expect(settings).toEqual(expect.objectContaining({
            cameraAngle: 30,
            altitudeMode: 'ground-offset',
            altitude: 300,
            pitch: -45,
            canRoll: false,
        }))
    })

    it('migrates version-one camera definitions into the single-angle setting', () => {
        const settings = replayCameraSettingsFromDefinition({
            version: 1,
            position: {
                mode: 'behind',
                altitudeMode: 'constant',
                altitudeMeters: 1000,
            },
            orientation: {
                headingRadians: 0,
                headingOffsetRadians: Math.PI / 6,
                pitchRadians: -Math.PI / 3,
            },
            tracking: {},
            marker: {mode: 'trace'},
        })

        expect(settings.cameraAngle).toBe(-150)
        expect(settings.positionMode).toBeUndefined()
    })

    it('evaluates one target-relative pose with an effective metric range', () => {
        const definition = createCameraFixture()
        const sample = {
            progress: 0.5,
            longitude: 2,
            latitude: 48,
            altitude: 120,
            source: {
                endPoint: {longitude: 2.001, latitude: 48.001},
            },
        }
        const pose = resolveReplayCameraPose({definition, sample})

        expect(pose.definitionId).toBe(definition.id)
        expect(pose.target).toEqual({longitude: 2, latitude: 48, altitude: 120})
        expect(pose.cameraHeight).toBe(420)
        expect(pose.rangeMeters).toBeCloseTo(300 / Math.sin(Math.PI / 4), 8)
        expect(pose.roll).toBe(0)
        expect(pose.canonical).toBe(true)
    })

    it('resolves the sample once before evaluating the same camera for interactive playback and export', () => {
        const cameraDefinition = createCameraFixture()
        const timeline = buildReplayVideoTimeline({replayDurationMillis: 1000, fps: 10})
        const definition = createReplayDefinition({timeline, cameraDefinition})
        const plan = createReplayRenderPlan({definition})
        const sample = {
            progress: 0.4,
            longitude: 2,
            latitude: 48,
            altitude: 120,
            source: {
                endPoint: {longitude: 2.001, latitude: 48.001},
            },
        }
        const resolveSample = vi.fn(() => sample)
        const resolveCameraPose = vi.fn(createReplayCameraPoseResolver({
            definition: cameraDefinition,
        }))
        const resolver = new ReplayFrameResolver({plan, resolveSample, resolveCameraPose})

        const interactive = resolver.resolveAtTimeSync(400, {renderMode: 'interactive'})
        const exportFrame = resolver.resolveAtTimeSync(400, {renderMode: 'export'})

        expect(resolveSample).toHaveBeenCalledTimes(2)
        expect(resolveCameraPose).toHaveBeenCalledTimes(2)
        expect(resolveCameraPose.mock.calls[0][0].sample).toBe(sample)
        expect(interactive.scene.cameraPose).toEqual(exportFrame.scene.cameraPose)
        expect(interactive.scene.cameraCommand).toEqual(exportFrame.scene.cameraCommand)
        expect(interactive.scene.cameraCommand).toEqual(expect.objectContaining({
            type: 'set-target-view',
            rangeMeters: expect.any(Number),
        }))
        expect(interactive.resolved).toBe(false)
        expect(exportFrame.resolved).toBe(false)
    })
})
