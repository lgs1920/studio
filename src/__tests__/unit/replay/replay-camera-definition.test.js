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
        positionMode: 'ahead',
        altitudeMode: 'ground-offset',
        altitude: 300,
        heading: 10,
        headingOffset: 30,
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
        expect(definition.orientation.headingRadians).toBeCloseTo(10 * Math.PI / 180, 8)
        expect(definition.orientation.headingOffsetRadians).toBeCloseTo(Math.PI / 6, 8)
        expect(definition.orientation.pitchRadians).toBeCloseTo(-Math.PI / 4, 8)
        expect(definition.orientation.roll.enabled).toBe(false)
    })

    it('round-trips through the legacy settings adapter without changing framing settings', () => {
        const definition = createCameraFixture()
        const settings = replayCameraSettingsFromDefinition(definition)

        expect(settings).toEqual(expect.objectContaining({
            positionMode: 'ahead',
            altitudeMode: 'ground-offset',
            altitude: 300,
            heading: 10,
            headingOffset: 30,
            pitch: -45,
            canRoll: false,
        }))
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

    it('resolves the sample once before evaluating the same camera for Draft and HQ', () => {
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

        const draft = resolver.resolveAtTimeSync(400, {renderMode: 'draft'})
        const hq = resolver.resolveAtTimeSync(400, {renderMode: 'hq'})

        expect(resolveSample).toHaveBeenCalledTimes(2)
        expect(resolveCameraPose).toHaveBeenCalledTimes(2)
        expect(resolveCameraPose.mock.calls[0][0].sample).toBe(sample)
        expect(draft.scene.cameraPose).toEqual(hq.scene.cameraPose)
        expect(draft.resolved).toBe(false)
        expect(hq.resolved).toBe(false)
    })
})
