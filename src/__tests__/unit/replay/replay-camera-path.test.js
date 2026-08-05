/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-path.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3, Matrix4, Transforms} from 'cesium'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        notify:  vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error:   vi.fn(),
    },
    LGS_ERROR_TOAST:       'error',
    LGS_INFORMATION_TOAST: 'info',
    LGS_SUCCESS_TOAST:     'success',
    LGS_WARNING_TOAST:     'warning',
}))

import {
    buildReplayTransferSafetyProfile,
} from '@Core/ui/replay/JourneyReplayCameraCollision'
import {
    updateCamera,
} from '@Core/ui/replay/JourneyReplayCameraBinding'
import {
    REPLAY_CAMERA_PITCH_PHASE_ATTACK,
    REPLAY_CAMERA_PITCH_PHASE_RELEASE,
    createReplayCameraPitchCorrectionState,
} from '@Core/ui/replay/JourneyReplayCameraPitchController'
import {
    replayTurnDriftForGuideProgress,
    replayTurnDriftForProgress,
    cameraAltitudeForSample,
    cameraViewForSample,
} from '@Core/ui/replay/JourneyReplayCameraGuide'
import {
    replayDurationPaceFactor,
} from '@Core/ui/replay/JourneyReplayCameraMath'
import {
    buildCameraTransferPath,
    selectCameraTransferMode,
} from '@Core/ui/replay/JourneyReplayCameraPath'
import * as CameraPath from '@Core/ui/replay/JourneyReplayCameraPath'
import {
    buildConstrainedReplayCameraPath,
    offsetConstrainedReplayFrame,
    projectReplayTargetInCameraFrame,
    sampleConstrainedReplayCameraPath,
} from '@Core/ui/replay/JourneyReplayConstrainedCameraPath'
import {
    applyDeterministicCameraTransition as applyResolvedDeterministicCameraTransition,
    interpolateCameraFrame,
    startDeterministicCameraTransition,
    cameraRecenterFrame as resolveCameraRecenterFrame,
} from '@Core/ui/replay/JourneyReplayCameraTransition'
import {
    cancelCameraBezierTransition,
    cameraCollisionForFrame,
    cameraCollisionForSample,
} from '@Core/ui/replay/JourneyReplayCameraState'
import {
    resetCameraInterpolationState,
    cameraViewHasLineOfSight,
    cameraViewWithRedirectState,
    cameraViewVisibilityForSample,
    cameraLookaheadSample,
    findCameraRedirectState,
} from '@Core/ui/replay/JourneyReplayCameraVisibility'
import {
    createReplayCameraUpdateCache,
} from '@Core/ui/replay/JourneyReplayCameraUpdateCache'
import {
    REPLAY_MARKER_MODE_NAVIGATION,
    REPLAY_MARKER_MODE_HYSTERESIS,
    REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_POSITION_BEHIND,
    REPLAY_EFFECT_GLOW,
    REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
    REPLAY_NAVIGATION_PREDICTIVE_CONFIRMATION_LOOKAHEAD_SECONDS,
} from '@Core/ui/replay/JourneyReplayCameraShared'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from '@Core/ui/replay/JourneyReplayInternal'
import {createJourneyReplayLogicalFrame} from '@Core/ui/replay/JourneyReplayLogicalFrame'

const makeMode = () => {
    const state = {
        deterministicCameraTransition: null,
        cameraBezierFrame:            null,
        cameraBezierResolve:          null,
        lastCameraHeading:            null,
        lastCameraPitch:              null,
    }
    const call = {
        currentCameraFrame: vi.fn(() => ({
            destination: new Cartesian3(1_000, 2_000, 3_000),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        })),
        cameraTransitionVelocity: vi.fn(() => null),
        startDeterministicCameraTransition: vi.fn(() => true),
        applyDeterministicCameraTransition: vi.fn(() => true),
        applyCameraFrame: vi.fn(frame => frame),
        rememberCameraView: vi.fn(() => null),
        rememberNominalCameraView: vi.fn(() => null),
        buildCameraGuide: vi.fn(() => []),
        replayTurnDriftForProgress: vi.fn(() => null),
        markerPositionForSample: vi.fn(sample => sample),
        now: vi.fn(() => 0),
        terrainHeightForLonLat: vi.fn(() => 123),
        cameraAltitudeForSample: vi.fn(() => 1000),
        headingFromPositionProperty: vi.fn(() => 0),
        smoothRadians: vi.fn((previous, next) => next),
        timeNormalizedSmoothingFactor: vi.fn(() => 1),
        headingEasingFactor: vi.fn(() => 1),
        liveCameraPitch: vi.fn(pitch => pitch),
        applyCameraView: vi.fn(() => null),
        applyDeterministicCameraFollower: vi.fn(() => null),
        cameraRecenterFrame: vi.fn(() => ({
            destination: new Cartesian3(0, 0, 1000),
            direction:   new Cartesian3(0, 1, 0),
            correctedUp: new Cartesian3(0, 0, 1),
            safeHeading: 0,
            safePitch:   -1,
        })),
        cameraRedirectPitchLimits: vi.fn(() => ({
            min: -Math.PI / 2,
            max: -0.08726646259971647,
        })),
        cameraLineOfSightVisibleForFrame: vi.fn(() => true),
        cancelCameraBezierTransition: vi.fn(() => null),
        removeToleranceZoneOverlay: vi.fn(() => null),
        renderedTraceVisibleForSample: vi.fn(() => true),
        resolveConstrainedReplayCameraPath: vi.fn(() => null),
        traceCameraTiming: vi.fn(() => null),
        traceCameraChangeTiming: vi.fn(() => null),
        trackingWindowPositionForSample: vi.fn(() => null),
        updateToleranceZoneOverlay: vi.fn(() => null),
        viewportRectForCesiumSurface: vi.fn(() => ({
            width:  1920,
            height: 1080,
        })),
    }
    const mode = {}
    mode[JOURNEY_REPLAY_INTERNAL_STATE] = state
    mode[JOURNEY_REPLAY_INTERNAL_CALL] = call
    return {mode, state, call}
}

const makeJourney = () => ({
    slug:   'journey-replay',
    tracks: new Map([
        ['track-a', {
            slug:    'track-a',
            content: {
                type:       'Feature',
                properties: {},
                geometry:   {
                    type:        'LineString',
                    coordinates: [[0, 0, 0], [0.2, 0.2, 0]],
                },
            },
        }],
    ]),
})

describe('Journey replay camera paths', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('applies a temporary pitch correction for an automatic redirect', () => {
        const {mode, call} = makeMode()
        const nominalView = {
            heading: 0.25,
            pitch:   -0.75,
            roll:    0,
        }

        const redirectedView = cameraViewWithRedirectState(mode, nominalView, {
            headingOffset: 0.4,
            pitchOffset:   -0.3,
        })

        expect(redirectedView.heading).toBeCloseTo(0.65)
        expect(redirectedView.pitch).toBeCloseTo(-1.05)
        expect(call.cameraRedirectPitchLimits).toHaveBeenCalledOnce()
    })

    it('applies the exact configured pose on a post-replay refresh', () => {
        vi.stubGlobal('lgs', {
            viewer: {
                camera: {
                    heading: 0,
                },
            },
        })
        const {mode, call} = makeMode()
        call.smoothRadians = vi.fn(() => -0.88 * Math.PI / 180)
        const cameraSettings = {
            positionMode: 'system',
            heading:      35,
            pitch:        -11,
            altitude:     1000,
        }

        const view = cameraViewForSample(mode, {
            sample: {
                progress:  1,
                longitude: 2,
                latitude:  48,
                altitude:  120,
            },
            progress: 1,
            source: 'refresh',
            cameraSettings,
            markerSettings: {},
            previousHeading: 0,
            previousPitch:   0,
        })

        expect(view.heading).toBeCloseTo(35 * Math.PI / 180)
        expect(view.pitch).toBeCloseTo(-11 * Math.PI / 180)
        expect(call.smoothRadians).not.toHaveBeenCalled()
    })

    it('excludes heading-only redirects from temporary pitch correction', () => {
        const {mode, state, call} = makeMode()
        state.cameraRedirectState = {
            headingOffset: 8 * Math.PI / 180,
            pitchOffset:   0,
        }
        call.cameraViewVisibilityForSample = vi.fn(() => true)
        call.cameraRedirectCandidateScore = vi.fn(candidate => (
            (Math.abs(candidate.pitchOffset) * 3) + Math.abs(candidate.headingOffset)
        ))

        const selected = findCameraRedirectState(mode, {
            nominalView: {
                heading: 0.25,
                pitch:   -10 * Math.PI / 180,
            },
            markerSettings: {
                mode: REPLAY_MARKER_MODE_NAVIGATION,
            },
            maximumPitchOffset: 8 * Math.PI / 180,
            requirePitchOffset:  true,
        })

        expect(selected).toEqual({
            headingOffset: 0,
            pitchOffset:   expect.closeTo(-4 * Math.PI / 180),
        })
        expect(call.cameraViewVisibilityForSample).not.toHaveBeenCalledWith(expect.objectContaining({
            redirectState: expect.objectContaining({pitchOffset: 0}),
        }))
    })

    it('selects a transfer mode from the configured threshold', () => {
        expect(selectCameraTransferMode(1_000, 50)).toBe('direct')
        expect(selectCameraTransferMode(120_000, 50)).toBe('elevate-then-move')
        expect(selectCameraTransferMode(250_000, 50)).toBe('spiral-conical')
        expect(selectCameraTransferMode(600_000, 50)).toBe('blur-jump-refocus')
    })

    it('builds a 3D Bezier path that bends through the provided control points', () => {
        const path = buildCameraTransferPath({
            start:         new Cartesian3(0, 0, 0),
            end:           new Cartesian3(100, 0, 0),
            mode:          'bezier-3d',
            controlPoints: [
                new Cartesian3(25, 20, 30),
                new Cartesian3(75, 20, 30),
            ],
        })

        expect(path).not.toBeNull()
        expect(path.sampleCount).toBeGreaterThanOrEqual(16)
        expect(path.samples).toHaveLength(path.sampleCount)
        expect(path.sampleAt(0.5).z).toBeGreaterThan(20)
    })

    it('applies a fixed orientation when the transfer ends at the panorama pivot', async () => {
        vi.useFakeTimers()
        vi.stubGlobal('requestAnimationFrame', callback => globalThis.setTimeout(callback, 16))
        vi.stubGlobal('cancelAnimationFrame', handle => globalThis.clearTimeout(handle))

        try {
            const destination = Cartesian3.fromDegrees(1, 2, 1300)
            const orientation = {
                heading: 0.5,
                pitch:   -0.25,
                roll:    0,
            }
            const camera = {
                setView: vi.fn(),
            }
            const complete = vi.fn()
            const path = buildCameraTransferPath({
                start: new Cartesian3(destination.x + 100, destination.y, destination.z),
                end:   destination,
                mode:  'direct',
            })

            path.flyTo({
                camera,
                orientation,
                duration: 0.016,
                complete,
            })
            await vi.advanceTimersByTimeAsync(16)

            expect(complete).toHaveBeenCalledTimes(1)
            expect(camera.setView).toHaveBeenLastCalledWith({
                destination,
                orientation,
            })
        }
        finally {
            vi.useRealTimers()
        }
    })

    it('uses time cadence when requested for camera transfers', async () => {
        vi.useFakeTimers()
        const requestAnimationFrameSpy = vi.fn()
        vi.stubGlobal('requestAnimationFrame', requestAnimationFrameSpy)
        vi.stubGlobal('cancelAnimationFrame', handle => globalThis.clearTimeout(handle))

        try {
            const destination = Cartesian3.fromDegrees(1, 2, 1300)
            const orientation = {
                heading: 0.5,
                pitch:   -0.25,
                roll:    0,
            }
            const camera = {
                setView: vi.fn(),
            }
            const complete = vi.fn()
            const path = buildCameraTransferPath({
                start: new Cartesian3(destination.x + 100, destination.y, destination.z),
                end:   destination,
                mode:  'direct',
            })

            path.flyTo({
                camera,
                orientation,
                cadence: 'time',
                duration: 0.016,
                complete,
            })
            await vi.advanceTimersByTimeAsync(16)

            expect(requestAnimationFrameSpy).not.toHaveBeenCalled()
            expect(complete).toHaveBeenCalledTimes(1)
            expect(camera.setView).toHaveBeenLastCalledWith({
                destination,
                orientation,
            })
        }
        finally {
            vi.useRealTimers()
        }
    })

    it('invokes callable cancellation handles for camera transitions', () => {
        const mode = makeMode()
        const cancelHandle = vi.fn()
        const resolve = vi.fn()

        mode.state.cameraBezierFrame = cancelHandle
        mode.state.cameraBezierResolve = resolve
        mode.state.cameraFlightActive = true

        cancelCameraBezierTransition(mode.mode, false)

        expect(cancelHandle).toHaveBeenCalledTimes(1)
        expect(resolve).toHaveBeenCalledWith(false)
        expect(mode.state.cameraBezierFrame).toBeNull()
        expect(mode.state.cameraFlightActive).toBe(false)
    })

    it('adds turn drift on a sharp bend', () => {
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]:   {
                buildCameraGuide: vi.fn(() => [
                    {progress: 0, longitude: 0, latitude: 0},
                    {progress: 0.5, longitude: 1, latitude: 0},
                    {progress: 1, longitude: 1, latitude: 1},
                ]),
            },
        }

        const drift = replayTurnDriftForProgress(mode, 0.5, {
            maxHeadingOffsetDeg:    10,
            maxLateralOffsetMeters: 60,
        })

        expect(drift).not.toBeNull()
        expect(Math.abs(drift.headingOffsetRadians)).toBeGreaterThan(0)
        expect(Math.abs(drift.lateralOffsetMeters)).toBeGreaterThan(0)

        const reducedDrift = replayTurnDriftForProgress(mode, 0.5, {
            maxHeadingOffsetDeg:    10,
            maxLateralOffsetMeters: 60,
            sensitivity:             0.25,
        })

        expect(reducedDrift.headingOffsetRadians).toBeCloseTo(drift.headingOffsetRadians * 0.25, 6)
        expect(reducedDrift.lateralOffsetMeters).toBeCloseTo(drift.lateralOffsetMeters * 0.25, 6)
    })

    it('interpolates turn drift without a nearest-guide step', () => {
        const guide = [
            {progress: 0, longitude: 0, latitude: 0},
            {progress: 0.25, longitude: 1, latitude: 0},
            {progress: 0.5, longitude: 2, latitude: 0},
            {progress: 0.75, longitude: 2, latitude: 1},
            {progress: 1, longitude: 2, latitude: 2},
        ]
        const before = replayTurnDriftForGuideProgress(guide, 0.375 - 0.000001, {
            maxHeadingOffsetDeg:    10,
            maxLateralOffsetMeters: 60,
        })
        const after = replayTurnDriftForGuideProgress(guide, 0.375 + 0.000001, {
            maxHeadingOffsetDeg:    10,
            maxLateralOffsetMeters: 60,
        })

        expect(before).not.toBeNull()
        expect(after).not.toBeNull()
        expect(Math.abs(before.lateralOffsetMeters - after.lateralOffsetMeters))
            .toBeLessThan(0.01)
    })

    it('builds a stricter replay safety profile for dynamic tracking than navigation', () => {
        const journey = makeJourney()
        const cameraSettings = {
            hysteresis: {
                zone: {
                    top:    0.2,
                    left:   0.2,
                    width:  0.6,
                    height: 0.6,
                },
                marginRatio: 0.12,
                easing:      0.18,
            },
        }

        const navigation = buildReplayTransferSafetyProfile(journey, {
            trackingMode:   'navigation',
            cameraSettings,
            viewport:       {width: 1920, height: 1080},
            clearanceMeters: 500,
        })
        const dynamic = buildReplayTransferSafetyProfile(journey, {
            trackingMode:   'dynamic',
            cameraSettings,
            viewport:       {width: 1920, height: 1080},
            clearanceMeters: 500,
        })

        expect(navigation.mode).toBe('navigation')
        expect(dynamic.mode).toBe('dynamic')
        expect(dynamic.zoneScale).toBeGreaterThan(navigation.zoneScale)
        expect(dynamic.clearanceMeters).toBeGreaterThan(navigation.clearanceMeters)
        expect(dynamic.zones.dynamic.target).toEqual(expect.objectContaining({
            top:    expect.any(Number),
            left:   expect.any(Number),
            width:  expect.any(Number),
            height: expect.any(Number),
        }))
    })

    it('uses the supplied path sample when interpolating a camera frame', () => {
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {},
            [JOURNEY_REPLAY_INTERNAL_CALL]:   {},
        }
        const frame = interpolateCameraFrame(
            mode,
            {
                destination: new Cartesian3(1, 2, 3),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            },
            {
                destination: new Cartesian3(101, 2, 3),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            },
            0.5,
            {
                path: {
                    sampleAt: ratio => new Cartesian3(10 + (20 * ratio), 5, 7),
                },
            },
        )

        expect(frame.destination.x).toBeCloseTo(20, 6)
        expect(frame.destination.y).toBeCloseTo(5, 6)
        expect(frame.destination.z).toBeCloseTo(7, 6)
    })

    it('stores the same path plan inside deterministic replay transitions', () => {
        vi.stubGlobal('lgs', {
            theJourney: makeJourney(),
            settings: {
                camera: {
                    transferDistanceThresholdKm: 50,
                    pitchAdjustHeight:           600,
                },
            },
        })

        const {mode, state, call} = makeMode()
        const endFrame = {
            destination:  new Cartesian3(120_000, 0, 0),
            direction:    new Cartesian3(0, 1, 0),
            correctedUp:  new Cartesian3(0, 0, 1),
            safeHeading:  0,
            safePitch:    -1,
            currentHeight: 500,
        }

        startDeterministicCameraTransition(mode, {
            sample:    {id: 'sample'},
            heading:   0,
            pitch:     0,
            endFrame,
            duration:  1,
            logicalNow: 10,
        })

        expect(call.currentCameraFrame).toHaveBeenCalledTimes(1)
        expect(['elevate-then-move', 'spiral-conical', 'blur-jump-refocus']).toContain(
            state.deterministicCameraTransition.path.mode,
        )
        expect(state.deterministicCameraTransition.path.samples).toHaveLength(state.deterministicCameraTransition.path.sampleCount)
        expect(state.deterministicCameraTransition.path.antiCollisionBounds).toEqual(expect.objectContaining({
            west: expect.any(Number),
            south: expect.any(Number),
            east: expect.any(Number),
            north: expect.any(Number),
        }))
    })

    it('propagates the tracking mode into deterministic replay path safety', () => {
        vi.stubGlobal('lgs', {
            theJourney: makeJourney(),
            settings: {
                camera: {
                    transferDistanceThresholdKm: 50,
                    pitchAdjustHeight:           600,
                },
            },
        })

        const {mode, state} = makeMode()
        const endFrame = {
            destination:  new Cartesian3(120_000, 0, 0),
            direction:    new Cartesian3(0, 1, 0),
            correctedUp:  new Cartesian3(0, 0, 1),
            safeHeading:  0,
            safePitch:    -1,
            currentHeight: 500,
        }

        startDeterministicCameraTransition(mode, {
            sample:       {id: 'sample'},
            heading:      0,
            pitch:        0,
            endFrame,
            duration:     1,
            logicalNow:   10,
            trackingMode: 'dynamic',
            cameraSettings: {
                hysteresis: {
                    zone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                    marginRatio: 0.12,
                    easing:      0.18,
                },
            },
            viewport: {
                width:  1920,
                height: 1080,
            },
        })

        expect(state.deterministicCameraTransition.path.safetyProfile.mode).toBe('dynamic')
        expect(state.deterministicCameraTransition.path.safetyProfile.zoneScale).toBeGreaterThan(1)
    })

    it('banks the shared camera view more strongly for faster turns', () => {
        const {mode} = makeMode()
        const baseSample = {
            progress: 0.5,
            distanceFromStart: 5000,
            remainingDistance:  5000,
            journeyDurationMillis: 10000,
            longitude: 2.01,
            latitude:  48,
            altitude:  120,
            source: {
                startPoint: {
                    longitude: 2,
                    latitude:  48,
                    journeyElapsedMillis: 1000,
                    timeMillis: 1000,
                },
                endPoint: {
                    longitude: 2.01,
                    latitude:  48.01,
                    journeyElapsedMillis: 3000,
                    timeMillis: 3000,
                },
            },
        }

        const cameraSettings = {
            positionMode: 'system',
            heading:      0,
            pitch:        -45,
            altitude:     300,
        }
        const slowView = cameraViewForSample(mode, {
            sample: baseSample,
            progress: 0.5,
            source: 'drawer',
            cameraSettings,
            markerSettings: {},
        })
        const fastView = cameraViewForSample(mode, {
            sample: {
                ...baseSample,
                source: {
                    ...baseSample.source,
                    endPoint: {
                        ...baseSample.source.endPoint,
                        journeyElapsedMillis: 1500,
                        timeMillis:           1500,
                    },
                },
            },
            progress: 0.5,
            source: 'drawer',
            cameraSettings,
            markerSettings: {},
        })

        expect(Math.abs(fastView.roll)).toBeGreaterThan(Math.abs(slowView.roll))
        expect(Math.abs(slowView.roll)).toBeLessThanOrEqual(Math.PI / 4)
        expect(Math.abs(fastView.roll)).toBeLessThanOrEqual(Math.PI / 4)
    })

    it('keeps the nominal pitch when resolving a deterministic correction frame', () => {
        vi.stubGlobal('lgs', {
            theJourney: makeJourney(),
            settings: {
                camera: {
                    transferDistanceThresholdKm: 50,
                    pitchAdjustHeight:           600,
                },
            },
        })

        const {mode, state, call} = makeMode()
        call.liveCameraPitch = vi.fn(() => -1.5)
        call.markerRenderHeightForSample = vi.fn(() => 120)
        call.cameraViewForSample = vi.fn(() => ({
            heading:      0.25,
            pitch:        -0.5,
            cameraHeight: 800,
        }))
        call.cameraLineOfSightVisibleForFrame = vi.fn(() => false)
        call.renderedTraceVisibleForSample = vi.fn(() => false)

        const endFrame = {
            destination:  new Cartesian3(120_000, 0, 0),
            direction:    new Cartesian3(0, 1, 0),
            correctedUp:  new Cartesian3(0, 0, 1),
            safeHeading:  0,
            safePitch:    -1,
            currentHeight: 500,
        }

        startDeterministicCameraTransition(mode, {
            sample:         {id: 'sample', progress: 0.5},
            heading:        0,
            pitch:          0,
            endFrame,
            duration:       1,
            logicalNow:     10,
            cameraSettings: {
                hysteresis: {
                    zone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                    marginRatio: 0.12,
                    easing:      0.18,
                },
            },
        })

        const transition = state.deterministicCameraTransition
        expect(transition).not.toBeNull()
        transition.path.frameResolver({
            path:   transition.path,
            target: transition.target,
            ratio:  0.5,
            frame:  {
                destination: new Cartesian3(1, 2, 3),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            },
        })

        expect(call.cameraRecenterFrame).toHaveBeenCalledOnce()
        expect(call.cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({
            pitch: -0.5,
        }))
    })

    it('records a completed transition only after its final frame is applied', () => {
        const {mode, state, call} = makeMode()
        const frame = {
            destination: new Cartesian3(1, 2, 3),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        }
        state.deterministicCameraTransition = {
            startAt: 0,
            endAt:   1000,
            start:   frame,
            end:     frame,
            target:  new Cartesian3(2, 3, 4),
            sample:  {longitude: 2, latitude: 48, altitude: 120},
            heading: 0.4,
            pitch:   -0.6,
            path:    null,
        }
        call.interpolateCameraFrame = vi.fn(() => frame)
        call.applyCameraFrame = vi.fn(() => false)

        expect(applyResolvedDeterministicCameraTransition(mode, 1000)).toBe(false)
        expect(state.deterministicCameraTransition).not.toBeNull()
        expect(call.rememberCameraView).not.toHaveBeenCalled()

        call.applyCameraFrame.mockReturnValue(true)
        expect(applyResolvedDeterministicCameraTransition(mode, 1000)).toBe(true)
        expect(state.deterministicCameraTransition).toBeNull()
        expect(call.rememberCameraView).toHaveBeenCalledWith(expect.objectContaining({
            heading: 0.4,
            pitch:   -0.6,
        }))
    })

    it.each([-10, -18])('keeps target, direction, and up coherent at a shallow %d degree pitch', pitchDegrees => {
        const target = Cartesian3.fromDegrees(2, 48, 120)
        vi.stubGlobal('lgs', {
            viewer: {
                camera: {
                    positionCartographic: {height: 1000},
                },
            },
        })
        const {mode, call} = makeMode()
        call.markerRenderHeightForSample = vi.fn(() => 120)
        call.markerRenderCartesianForSample = vi.fn(() => target)
        call.cameraAltitudeForSample = vi.fn(() => 1000)
        const pitch = pitchDegrees * Math.PI / 180

        const frame = resolveCameraRecenterFrame(mode, {
            sample: {
                longitude: 2,
                latitude:  48,
                altitude:  120,
            },
            heading:      0.4,
            pitch,
            cameraHeight: 1000,
            cameraSettings: {
                altitudeMode: 'constant',
                altitude:     1000,
            },
        })

        const targetDirection = Cartesian3.normalize(
            Cartesian3.subtract(frame.target, frame.destination, new Cartesian3()),
            new Cartesian3(),
        )
        const localUp = Matrix4.getColumn(
            Transforms.eastNorthUpToFixedFrame(frame.target),
            2,
            new Cartesian3(),
        )
        expect(Cartesian3.dot(frame.direction, targetDirection)).toBeCloseTo(1, 10)
        expect(Cartesian3.dot(frame.direction, frame.correctedUp)).toBeCloseTo(0, 10)
        expect(Cartesian3.magnitude(frame.correctedUp)).toBeCloseTo(1, 10)
        expect(Cartesian3.dot(frame.direction, localUp)).toBeCloseTo(Math.sin(pitch), 10)
    })

    it('applies the resolved roll to the camera up vector while preserving orthogonality', () => {
        const target = Cartesian3.fromDegrees(2, 48, 120)
        vi.stubGlobal('lgs', {
            viewer: {
                camera: {
                    positionCartographic: {height: 1000},
                },
            },
        })
        const {mode, call} = makeMode()
        call.markerRenderHeightForSample = vi.fn(() => 120)
        call.markerRenderCartesianForSample = vi.fn(() => target)
        call.cameraAltitudeForSample = vi.fn(() => 1000)
        const options = {
            sample: {longitude: 2, latitude: 48, altitude: 120},
            heading: 0.4,
            pitch: -Math.PI / 4,
            cameraHeight: 1000,
            cameraSettings: {altitudeMode: 'constant', altitude: 1000},
        }
        const levelFrame = resolveCameraRecenterFrame(mode, {...options, roll: 0})
        const rolledFrame = resolveCameraRecenterFrame(mode, {...options, roll: Math.PI / 4})

        expect(rolledFrame.roll).toBeCloseTo(Math.PI / 4, 8)
        expect(Cartesian3.dot(rolledFrame.direction, rolledFrame.correctedUp)).toBeCloseTo(0, 10)
        expect(Cartesian3.dot(levelFrame.correctedUp, rolledFrame.correctedUp)).toBeLessThan(1)
    })

    it.each([REPLAY_CAMERA_POSITION_BEHIND, REPLAY_CAMERA_POSITION_AHEAD])(
        'resolves identical Draft and HQ Dynamic frames in %s position mode',
        positionMode => {
            vi.stubGlobal('lgs', {
                settings: {
                    ui: {
                        replay: {
                            camera: {
                                positionMode,
                                headingOffset: 12,
                                pitch:         -10,
                                altitude:      1000,
                                hysteresis:    {easing: 0.18},
                            },
                            marker: {mode: REPLAY_MARKER_MODE_HYSTERESIS},
                        },
                    },
                },
                stores: {
                    replay: {
                        camera: {
                            positionMode,
                            headingOffset: 12,
                            pitch:         -10,
                            altitude:      1000,
                        },
                    },
                },
                viewer: {camera: {}},
            })
            const sample = {
                progress:          0.5,
                distanceFromStart: 100,
                longitude:         2,
                latitude:          48,
                altitude:          120,
                height:            120,
            }
            const predictedSample = {
                ...sample,
                progress:          0.55,
                distanceFromStart: 120,
                longitude:         2.001,
            }
            const resolveFrame = exportMode => {
                const {mode, call} = makeMode()
                call.headingFromPositionProperty = vi.fn(() => 0.4)
                call.cameraLookaheadSample = vi.fn(() => predictedSample)
                call.cameraRecenterFrame = vi.fn(({sample: targetSample, heading, pitch, cameraHeight}) => ({
                    destination: new Cartesian3(targetSample.longitude, heading, cameraHeight),
                    direction:   new Cartesian3(Math.cos(pitch), 0, Math.sin(pitch)),
                    correctedUp: new Cartesian3(0, 1, 0),
                    safeHeading: heading,
                    safePitch:   pitch,
                }))
                const logicalFrame = createJourneyReplayLogicalFrame({
                    sample,
                    progress:       sample.progress,
                    durationMillis: 2000,
                    frameTimeMs:    1000,
                    frameIntervalMs: 1000 / 30,
                })

                updateCamera(mode, {
                    sample,
                    progress: sample.progress,
                    source: 'playback',
                    logicalCamera: true,
                    exportMode,
                    logicalFrame,
                    frameTimeMs: 1000,
                    frameIntervalMs: 1000 / 30,
                })

                return {
                    frame: call.applyCameraFrame.mock.calls[0]?.[0],
                    view:  call.cameraRecenterFrame.mock.calls[0]?.[0],
                }
            }

            const draft = resolveFrame(false)
            const hq = resolveFrame(true)
            expect(draft.frame).toEqual(hq.frame)
            expect(draft.view).toEqual(hq.view)
            expect(draft.view.sample).toEqual(predictedSample)
        },
    )

    it('does not retain pitch from predictive visibility when the current marker is visible', () => {
        vi.stubGlobal('lgs', {
            viewer: {},
            theJourney: makeJourney(),
            settings: {
                ui: {
                    replay: {
                        camera: {
                            hysteresis: {
                                easing:      0.18,
                                marginRatio: 0.12,
                                zone: {
                                    top:    0.2,
                                    left:   0.2,
                                    width:  0.6,
                                    height: 0.6,
                                },
                            },
                        },
                        marker: {
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
                camera: {
                    transferDistanceThresholdKm: 50,
                    pitchAdjustHeight:           600,
                },
            },
            stores: {
                replay: {
                    captureFps: 30,
                },
                ui: {
                    video: {
                        recording: false,
                    },
                },
            },
        })

        const {mode, state, call} = makeMode()
        state.cameraMode = REPLAY_MARKER_MODE_HYSTERESIS
        const nominalSample = {
            distanceFromStart: 100,
            progress:          0.4,
            longitude:         1,
            latitude:          2,
            altitude:          120,
            height:            120,
        }
        const nominalView = {
            sample:       nominalSample,
            heading:      0.35,
            pitch:        -0.55,
            cameraHeight:  800,
        }
        state.cameraRedirectState = {
            headingOffset: 0.25,
            pitchOffset:   -0.2,
        }
        state.lastAppliedCameraView = {
            pitch: nominalView.pitch - 0.2,
        }
        call.viewportRectForCesiumSurface = vi.fn(() => ({
            width:  1920,
            height: 1080,
        }))
        call.cameraViewForSample = vi.fn(() => nominalView)
        call.cameraLookaheadSample = vi.fn(() => ({
            distanceFromStart: 160,
            progress:          0.52,
            longitude:         1.1,
            latitude:          2.1,
            altitude:          120,
            height:            120,
        }))
        call.cameraCollisionForSample = vi.fn(() => ({
            hard: call.cameraCollisionForSample.mock.calls.length === 2,
        }))
        call.renderedTraceVisibleForSample = vi.fn(() => true)
        call.renderedTargetVisible = vi.fn(() => true)
        call.cameraViewVisibilityForSample = vi.fn(({futureSample}) => !futureSample)
        call.cameraViewWithRedirectState = vi.fn(view => view)
        call.findCameraRedirectState = vi.fn(() => null)
        call.recenterCameraToSample = vi.fn()
        call.rememberNominalCameraView = vi.fn()

        updateCamera(mode, {
            sample:   nominalSample,
            progress: nominalSample.progress,
            source:   'playback',
        })
        expect(call.resolveConstrainedReplayCameraPath).not.toHaveBeenCalled()
        expect(state.cameraRedirectState).toBeNull()
        expect(call.cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({
            pitch: nominalView.pitch,
        }))
        expect(call.applyCameraFrame).toHaveBeenCalled()
        const visibilityModes = call.cameraViewVisibilityForSample.mock.calls.map(([payload]) => (
            payload.futureSample === null ? 'current' : 'future'
        ))
        expect(visibilityModes).toEqual(['current'])
    })

    it('resets the HQ follower before restoring the nominal pitch', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            heading:      0,
                            pitch:        -45,
                            altitude:     1000,
                            hysteresis:   {easing: 0.18},
                        },
                        marker: {mode: REPLAY_MARKER_MODE_HYSTERESIS},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', heading: 0, pitch: -45, altitude: 1000},
                    captureFps: 60,
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        state.cameraMode = REPLAY_MARKER_MODE_HYSTERESIS
        state.cameraRedirectState = {
            headingOffset: 0.25,
            pitchOffset:   -0.2,
        }
        state.lastAppliedCameraView = {pitch: -1}
        state.deterministicCameraFollowerActive = true
        state.deterministicCameraFollowerAt = 100
        state.deterministicCameraFollowerVelocity = {
            destination: new Cartesian3(1, 0, 0),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        }
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         1,
            latitude:          2,
            altitude:          120,
            height:            120,
        }
        call.cameraLookaheadSample = vi.fn(() => ({...sample, progress: 0.6, distanceFromStart: 120}))
        call.cameraCollisionForSample = vi.fn(() => ({hard: false}))
        call.cameraViewVisibilityForSample = vi.fn(({futureSample}) => !futureSample)
        call.renderedTraceVisibleForSample = vi.fn(() => true)
        call.recenterCameraToSample = vi.fn()
        call.rememberNominalCameraView = vi.fn()

        updateCamera(mode, {
            sample,
            progress:     sample.progress,
            source:       'playback',
            exportMode:   true,
            logicalCamera: true,
        })

        expect(call.applyDeterministicCameraFollower).not.toHaveBeenCalled()
        expect(call.cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({
            pitch: expect.closeTo(-Math.PI / 4),
        }))
        expect(call.applyCameraFrame).toHaveBeenCalledOnce()
        expect(state.deterministicCameraFollowerActive).toBe(false)
        expect(state.deterministicCameraFollowerAt).toBeNull()
        expect(state.deterministicCameraFollowerVelocity).toBeNull()
    })

    it('finishes a Navigation release on the exact nominal pitch', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            heading:      0,
                            pitch:        -45,
                            altitude:     1000,
                            hysteresis:   {easing: 0.18},
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', heading: 0, pitch: -45, altitude: 1000},
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        state.cameraMode = REPLAY_MARKER_MODE_NAVIGATION
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         1,
            latitude:          2,
            altitude:          120,
            height:            120,
        }
        const nominalView = {
            sample,
            heading:      0.35,
            pitch:        -0.5,
            cameraHeight: 800,
        }
        state.lastAppliedCameraView = {
            pitch: -0.9,
        }
        state.cameraPitchCorrectionState = {
            ...createReplayCameraPitchCorrectionState(),
            phase: REPLAY_CAMERA_PITCH_PHASE_RELEASE,
            phaseStartedAt: 0,
            startWeight: 1,
            weight: 1,
            redirectState: {
                headingOffset: 0,
                pitchOffset: -0.4,
            },
        }
        call.now = vi.fn(() => 450)
        call.cameraViewForSample = vi.fn(() => nominalView)
        call.cameraCollisionForSample = vi.fn(() => ({hard: false}))
        call.cameraViewVisibilityForSample = vi.fn(() => true)
        call.renderedTargetVisible = vi.fn(() => true)
        call.recenterCameraToSample = vi.fn()
        call.rememberNominalCameraView = vi.fn()

        updateCamera(mode, {
            sample,
            progress: sample.progress,
            source:   'playback',
        })

        expect(call.cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({
            heading: nominalView.heading,
            pitch:   nominalView.pitch,
        }))
        expect(call.applyCameraFrame).toHaveBeenCalledOnce()
        expect(state.cameraRedirectState).toBeNull()
    })

    it('applies a temporary pitch redirect when navigation is hidden by terrain', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            heading:      0,
                            pitch:        -45,
                            altitude:     1000,
                            hysteresis:   {easing: 0.18},
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', heading: 0, pitch: -45, altitude: 1000},
                    captureFps: 30,
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        state.cameraMode = REPLAY_MARKER_MODE_NAVIGATION
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         1,
            latitude:          2,
            altitude:          120,
            height:            120,
        }
        const nominalView = {
            sample,
            heading:      0.35,
            pitch:        -0.5,
            cameraHeight: 800,
        }
        call.cameraViewForSample = vi.fn(() => nominalView)
        call.cameraLookaheadSample = vi.fn(() => ({
            ...sample,
            progress:          0.6,
            distanceFromStart: 120,
        }))
        call.cameraCollisionForSample = vi.fn(() => ({hard: false}))
        call.renderedTargetVisible = vi.fn(() => false)
        call.cameraViewVisibilityForSample = vi.fn(() => false)
        call.cameraViewWithRedirectState = vi.fn((view, redirectState) => ({
            ...view,
            pitch: view.pitch + redirectState.pitchOffset,
        }))
        call.findCameraRedirectState = vi.fn(() => ({
            headingOffset: 0,
            pitchOffset:   -0.2,
        }))
        call.recenterCameraToSample = vi.fn()
        call.rememberNominalCameraView = vi.fn()

        let logicalNow = 0
        call.now = vi.fn(() => logicalNow)
        for (const timestamp of [0, 250, 700, 1150]) {
            logicalNow = timestamp
            updateCamera(mode, {
                sample,
                progress: sample.progress,
                source:   'playback',
            })
        }

        expect(call.findCameraRedirectState).toHaveBeenCalled()
        expect(call.cameraRecenterFrame).toHaveBeenLastCalledWith(expect.objectContaining({
            sample,
            pitch:        -0.7,
        }))
        expect(call.applyCameraFrame).toHaveBeenCalled()
        expect(state.cameraRedirectState).toEqual({
            headingOffset: 0,
            pitchOffset:   -0.2,
        })
    })

    it('keeps the Navigation anchor stable during pitch correction and still recenters on a Z1 exit', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            heading:      0,
                            pitch:        -12,
                            altitude:     1000,
                            hysteresis:   {easing: 0.18},
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', heading: 0, pitch: -12, altitude: 1000},
                    captureFps: 30,
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        const navigationAnchor = {
            progress:          0.2,
            distanceFromStart: 40,
            longitude:         1,
            latitude:          2,
            altitude:          120,
            height:            120,
        }
        const currentSample = {
            ...navigationAnchor,
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         1.01,
        }
        const predictedSample = {
            ...currentSample,
            progress:          0.6,
            distanceFromStart: 120,
            longitude:         1.02,
        }
        const nominalView = {
            sample:       currentSample,
            heading:      0.35,
            pitch:        -12 * Math.PI / 180,
            cameraHeight: 800,
        }
        const navigationView = {
            ...nominalView,
            sample: navigationAnchor,
        }
        state.cameraMode = REPLAY_MARKER_MODE_NAVIGATION
        state.navigationCameraView = navigationView
        state.lastAppliedCameraView = {
            anchor:  navigationAnchor,
            heading: navigationView.heading,
            pitch:   navigationView.pitch,
        }
        state.cameraPitchCorrectionState = {
            ...createReplayCameraPitchCorrectionState(),
            phase:          REPLAY_CAMERA_PITCH_PHASE_ATTACK,
            phaseStartedAt: 0,
            redirectState: {
                headingOffset: 0,
                pitchOffset:   -0.2,
            },
        }
        call.now = vi.fn(() => 700)
        call.cameraViewForSample = vi.fn(() => nominalView)
        call.cameraLookaheadSample = vi.fn(() => predictedSample)
        call.cameraCollisionForSample = vi.fn(() => ({hard: false}))
        call.cameraViewVisibilityForSample = vi.fn(() => false)
        call.cameraViewWithRedirectState = vi.fn((view, redirectState) => ({
            ...view,
            pitch: view.pitch + redirectState.pitchOffset,
        }))
        call.findCameraRedirectState = vi.fn(() => ({
            headingOffset: 0,
            pitchOffset:   -0.2,
        }))

        updateCamera(mode, {
            sample:   currentSample,
            progress: currentSample.progress,
            source:   'playback',
        })

        expect(call.cameraCollisionForSample).toHaveBeenCalled()
        expect(call.cameraRecenterFrame).toHaveBeenLastCalledWith(expect.objectContaining({
            sample: navigationAnchor,
        }))

        call.cameraRecenterFrame.mockClear()
        call.applyCameraFrame.mockClear()
        call.cameraCollisionForSample.mockImplementation(sample => ({
            hard: sample === currentSample,
        }))
        call.now.mockReturnValue(800)

        updateCamera(mode, {
            sample:   currentSample,
            progress: currentSample.progress,
            source:   'playback',
        })

        expect(call.cameraRecenterFrame).toHaveBeenLastCalledWith(expect.objectContaining({
            sample: currentSample,
        }))
        expect(call.applyCameraFrame).toHaveBeenCalledOnce()
        expect(state.navigationCameraView).toEqual(nominalView)
    })

    it('widens a shallow pitch search when the gentle envelope cannot restore visibility', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            heading:      0,
                            pitch:        -10,
                            altitude:     1000,
                            hysteresis:   {easing: 0.18},
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', heading: 0, pitch: -10, altitude: 1000},
                    captureFps: 30,
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        state.cameraMode = REPLAY_MARKER_MODE_NAVIGATION
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         1,
            latitude:          2,
            altitude:          120,
            height:            120,
        }
        const nominalView = {
            sample,
            heading:      0.35,
            pitch:        -10 * Math.PI / 180,
            cameraHeight: 800,
        }
        const recoveryOffset = -14 * Math.PI / 180
        call.cameraViewForSample = vi.fn(() => nominalView)
        call.cameraLookaheadSample = vi.fn(() => sample)
        call.cameraCollisionForSample = vi.fn(() => ({hard: false}))
        call.renderedTargetVisible = vi.fn(() => false)
        call.cameraViewVisibilityForSample = vi.fn(() => false)
        call.cameraViewWithRedirectState = vi.fn((view, redirectState) => ({
            ...view,
            pitch: view.pitch + redirectState.pitchOffset,
        }))
        call.findCameraRedirectState = vi.fn(({maximumPitchOffset}) => (
            maximumPitchOffset > 8 * Math.PI / 180
                ? {headingOffset: 0, pitchOffset: recoveryOffset}
                : null
        ))

        let logicalNow = 0
        call.now = vi.fn(() => logicalNow)
        for (const timestamp of [0, 250, 700, 1150]) {
            logicalNow = timestamp
            updateCamera(mode, {
                sample,
                progress: sample.progress,
                source:   'playback',
            })
        }

        const searchLimits = call.findCameraRedirectState.mock.calls
            .slice(0, 2)
            .map(([options]) => options.maximumPitchOffset)
        expect(searchLimits[0]).toBeCloseTo(8 * Math.PI / 180)
        expect(searchLimits[1]).toBeCloseTo(20 * Math.PI / 180)
        expect(call.findCameraRedirectState).toHaveBeenCalledWith(expect.objectContaining({
            requirePitchOffset: true,
        }))
        expect(call.cameraRecenterFrame).toHaveBeenLastCalledWith(expect.objectContaining({
            pitch: expect.closeTo(-24 * Math.PI / 180),
        }))
        expect(state.cameraRedirectState).toEqual({
            headingOffset: 0,
            pitchOffset:   recoveryOffset,
        })
    })

    it.each([REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_HYSTERESIS])(
        'uses a marker-only recovery candidate in %s when trace visibility rejects every strict candidate',
        markerMode => {
            vi.stubGlobal('lgs', {
                settings: {
                    ui: {
                        replay: {
                            camera: {
                                positionMode: 'system',
                                heading:      0,
                                pitch:        -10,
                                altitude:     1000,
                                hysteresis:   {easing: 0.18},
                            },
                            marker: {mode: markerMode},
                        },
                    },
                },
                stores: {
                    replay: {
                        camera: {positionMode: 'system', heading: 0, pitch: -10, altitude: 1000},
                        captureFps: 30,
                    },
                },
                viewer: {camera: {}},
            })

            const {mode, state, call} = makeMode()
            state.cameraMode = markerMode
            const sample = {
                progress:          0.5,
                distanceFromStart: 100,
                longitude:         1,
                latitude:          2,
                altitude:          120,
                height:            120,
            }
            const nominalView = {
                sample,
                heading:      0.35,
                pitch:        -10 * Math.PI / 180,
                cameraHeight: 800,
            }
            const recoveryOffset = -14 * Math.PI / 180
            call.cameraViewForSample = vi.fn(() => nominalView)
            call.cameraLookaheadSample = vi.fn(() => sample)
            call.cameraCollisionForSample = vi.fn(() => ({hard: false}))
            call.trackingWindowPositionForSample = vi.fn(() => ({x: 960, y: 540}))
            call.renderedTargetVisible = vi.fn(() => false)
            call.cameraViewVisibilityForSample = vi.fn(() => false)
            call.cameraViewWithRedirectState = vi.fn((view, redirectState) => ({
                ...view,
                pitch: view.pitch + redirectState.pitchOffset,
            }))
            call.findCameraRedirectState = vi.fn(({markerOnly}) => (
                markerOnly
                    ? {headingOffset: 0, pitchOffset: recoveryOffset}
                    : null
            ))

            let logicalNow = 0
            call.now = vi.fn(() => logicalNow)
            for (const timestamp of [0, 250, 700, 1150]) {
                logicalNow = timestamp
                updateCamera(mode, {
                    sample,
                    progress: sample.progress,
                    source:   'playback',
                })
            }

            expect(call.findCameraRedirectState).toHaveBeenCalledWith(expect.objectContaining({
                markerOnly: true,
                requirePitchOffset: true,
            }))
            expect(call.cameraRecenterFrame).toHaveBeenLastCalledWith(expect.objectContaining({
                pitch: expect.closeTo(-24 * Math.PI / 180),
            }))
            expect(state.cameraRedirectState).toEqual({
                headingOffset: 0,
                pitchOffset:   recoveryOffset,
            })
        },
    )

    it.each([REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_HYSTERESIS])(
        'activates pitch correction in %s when the rendered near trace is hidden',
        markerMode => {
            vi.stubGlobal('lgs', {
                settings: {
                    ui: {
                        replay: {
                            camera: {
                                positionMode: 'system',
                                heading:      0,
                                pitch:        -10,
                                altitude:     1000,
                                hysteresis:   {easing: 0.18},
                            },
                            marker: {mode: markerMode},
                        },
                    },
                },
                stores: {
                    replay: {
                        camera: {positionMode: 'system', heading: 0, pitch: -10, altitude: 1000},
                        captureFps: 30,
                    },
                },
                viewer: {camera: {}},
            })

            const {mode, state, call} = makeMode()
            state.cameraMode = markerMode
            const sample = {
                progress:          0.5,
                distanceFromStart: 100,
                longitude:         1,
                latitude:          2,
                altitude:          120,
                height:            120,
            }
            const nominalView = {
                sample,
                heading:      0.35,
                pitch:        -10 * Math.PI / 180,
                cameraHeight: 800,
            }
            const recoveryOffset = -8 * Math.PI / 180
            call.cameraViewForSample = vi.fn(() => nominalView)
            call.cameraLookaheadSample = vi.fn(() => sample)
            call.cameraCollisionForSample = vi.fn(() => ({hard: false}))
            call.trackingWindowPositionForSample = vi.fn(() => ({x: 960, y: 540}))
            call.cameraViewVisibilityForSample = vi.fn(() => true)
            call.renderedTargetVisible = vi.fn(() => true)
            call.renderedTraceVisibleForSample = vi.fn(() => false)
            call.cameraViewWithRedirectState = vi.fn((view, redirectState) => ({
                ...view,
                pitch: view.pitch + redirectState.pitchOffset,
            }))
            call.findCameraRedirectState = vi.fn(() => ({
                headingOffset: 0,
                pitchOffset: recoveryOffset,
            }))

            let logicalNow = 0
            call.now = vi.fn(() => logicalNow)
            for (const timestamp of [0, 250, 700, 1150]) {
                logicalNow = timestamp
                updateCamera(mode, {
                    sample,
                    progress: sample.progress,
                    source:   'playback',
                })
            }

            expect(call.renderedTraceVisibleForSample).toHaveBeenCalled()
            expect(call.findCameraRedirectState).toHaveBeenCalledWith(expect.objectContaining({
                markerOnly: false,
                requirePitchOffset: true,
            }))
            expect(call.cameraRecenterFrame).toHaveBeenLastCalledWith(expect.objectContaining({
                pitch: expect.closeTo(-18 * Math.PI / 180),
            }))
        },
    )

    it('does not let replay effect depth trigger a camera pitch correction', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        progression: {effect: {mode: REPLAY_EFFECT_GLOW}},
                        camera: {
                            positionMode: 'system',
                            heading:      0,
                            pitch:        -65,
                            altitude:     1200,
                        },
                        marker: {mode: REPLAY_MARKER_MODE_HYSTERESIS},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', heading: 0, pitch: -65, altitude: 1200},
                    captureFps: 30,
                },
            },
            viewer: {camera: {}},
        })

        const {mode, call} = makeMode()
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         1,
            latitude:          2,
            altitude:          120,
        }
        call.cameraViewForSample = vi.fn(() => ({
            sample,
            heading:      0,
            pitch:        -65 * Math.PI / 180,
            cameraHeight: 1200,
        }))
        call.cameraLookaheadSample = vi.fn(() => sample)
        call.renderedTraceVisibleForSample = vi.fn(() => false)

        updateCamera(mode, {
            sample,
            progress: sample.progress,
            source:   'playback',
        })

        expect(call.renderedTraceVisibleForSample).not.toHaveBeenCalled()
        expect(call.cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({
            pitch: expect.closeTo(-65 * Math.PI / 180),
        }))
    })

    it('applies the logical camera pose without asking Cesium to build a path', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            pitch:        -60,
                            altitude:     1000,
                            hysteresis:   {easing: 0.18},
                        },
                        marker: {mode: REPLAY_MARKER_MODE_HYSTERESIS},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', pitch: -60, altitude: 1000},
                },
            },
            viewer: {
                camera: {},
            },
        })

        const {mode, state, call} = makeMode()
        const sample = {
            progress:   0.5,
            longitude:  2,
            latitude:   48,
            altitude:   120,
            height:     120,
        }
        const logicalFrame = createJourneyReplayLogicalFrame({
            sample,
            progress:       0.5,
            durationMillis: 1000,
            frameTimeMs:    500,
        })
        call.cameraViewForSample = vi.fn()
        call.rememberNominalCameraView = vi.fn()
        call.recenterCameraToSample = vi.fn()

        updateCamera(mode, {
            sample,
            progress: 0.5,
            source:   'playback',
            logicalFrame,
            logicalCamera: true,
        })

        expect(logicalFrame.cameraPose).toEqual(expect.objectContaining({
            sample,
            heading:      0,
            pitch:        expect.closeTo(-Math.PI / 3),
            cameraHeight: 1000,
        }))
        expect(call.cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({
            sample,
            heading:       0,
            pitch:         -Math.PI / 3,
        }))
        expect(call.applyCameraFrame).toHaveBeenCalledOnce()
        expect(call.applyDeterministicCameraFollower).not.toHaveBeenCalled()
        expect(call.startDeterministicCameraTransition).not.toHaveBeenCalled()
        expect(call.cameraViewForSample).not.toHaveBeenCalled()
        expect(state.deterministicCameraTransition).toBeNull()

        // Once the logical camera is initialized, a stable frame must let the
        // marker travel through Z1/Z2 instead of recentering it every frame.
        state.lastAppliedCameraView = {
            anchor:  sample,
            heading: 0,
            pitch:   -Math.PI / 3,
        }
        call.recenterCameraToSample.mockClear()
        call.applyCameraFrame.mockClear()
        updateCamera(mode, {
            sample: {...sample, progress: 0.6, longitude: 2.001},
            progress: 0.6,
            source: 'playback',
            logicalCamera: true,
        })
        expect(call.applyCameraFrame).toHaveBeenCalledOnce()

    })

    it('uses collision zones only for Navigation while both modes apply one coherent frame', () => {
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
        }
        const predictedSample = {
            ...sample,
            progress:          0.7,
            distanceFromStart: 140,
        }

        for (const markerMode of [REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_HYSTERESIS]) {
            vi.stubGlobal('lgs', {
                settings: {
                    ui: {
                        replay: {
                            camera: {
                                positionMode: 'system',
                                pitch:        -60,
                                altitude:     1000,
                                hysteresis:   {easing: 0.18},
                            },
                            marker: {mode: markerMode},
                        },
                    },
                },
                stores: {
                    replay: {
                        camera: {positionMode: 'system', pitch: -60, altitude: 1000},
                    },
                },
                viewer: {camera: {}},
            })

            const {mode, call} = makeMode()
            const nominalView = {
                sample,
                heading:      0,
                pitch:        -Math.PI / 3,
                cameraHeight: 1000,
            }
            call.cameraViewForSample = vi.fn(() => nominalView)
            call.cameraLookaheadSample = vi.fn(() => predictedSample)
            call.cameraCollisionForSample = vi.fn(() => ({hard: true}))
            call.rememberNominalCameraView = vi.fn()
            call.cameraViewVisibilityForSample = vi.fn(() => true)
            call.findCameraRedirectState = vi.fn(() => null)
            call.cameraViewWithRedirectState = vi.fn(view => view)
            call.trackingWindowPositionForSample = vi.fn(() => ({x: 1900, y: 1000}))

            updateCamera(mode, {
                sample,
                progress: 0.5,
                source: 'playback',
                logicalCamera: true,
            })

            if (markerMode === REPLAY_MARKER_MODE_NAVIGATION) {
                expect(call.cameraCollisionForSample).toHaveBeenCalled()
            }
            else {
                expect(call.cameraCollisionForSample).not.toHaveBeenCalled()
            }
            expect(call.applyCameraFrame).toHaveBeenCalledOnce()
            expect(call.applyDeterministicCameraFollower).not.toHaveBeenCalled()
        }
    })

    it('gives an active deterministic transition exclusive ownership of the camera frame', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            pitch:        -60,
                            altitude:     1000,
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', pitch: -60, altitude: 1000},
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
        }
        const nominalView = {
            sample,
            heading:      0,
            pitch:        -Math.PI / 3,
            cameraHeight: 1000,
        }

        state.cameraMode = REPLAY_MARKER_MODE_NAVIGATION
        state.deterministicCameraTransition = {
            startAt: 0,
            endAt:   1000,
        }
        call.cameraViewForSample = vi.fn(() => nominalView)
        call.cameraLookaheadSample = vi.fn(() => ({
            ...sample,
            progress:          0.7,
            distanceFromStart: 140,
        }))
        call.cameraCollisionForSample = vi.fn(() => ({hard: true}))
        call.rememberNominalCameraView = vi.fn()
        call.recenterCameraToSample = vi.fn()

        updateCamera(mode, {
            sample,
            progress: 0.5,
            source:   'playback',
            logicalCamera: true,
            frameTimeMs: 500,
        })

        expect(call.applyDeterministicCameraTransition).toHaveBeenCalledOnce()
        expect(call.cameraCollisionForSample).not.toHaveBeenCalled()
        expect(call.applyCameraFrame).not.toHaveBeenCalled()
    })

    it('targets the current marker when Navigation is already outside Z1', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            pitch:        -60,
                            altitude:     1000,
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', pitch: -60, altitude: 1000},
                },
            },
            viewer: {camera: {}},
        })

        const {mode, call} = makeMode()
        const anchorSample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
        }
        const futureSample = {
            ...anchorSample,
            progress:          0.6,
            distanceFromStart: 220,
        }
        call.cameraViewForSample = vi.fn(({sample}) => ({
            sample,
            heading:      0,
            pitch:        -Math.PI / 3,
            cameraHeight: 1000,
        }))
        call.cameraLookaheadSample = vi.fn(() => futureSample)
        call.cameraCollisionForSample = vi.fn(() => ({hard: true}))
        call.rememberNominalCameraView = vi.fn()
        call.recenterCameraToSample = vi.fn()

        updateCamera(mode, {
            sample:   anchorSample,
            progress: anchorSample.progress,
            source:   'playback',
        })

        expect(call.cameraRecenterFrame).toHaveBeenCalledWith(expect.objectContaining({
            sample: anchorSample,
        }))
        expect(call.applyCameraFrame).toHaveBeenCalledOnce()
        expect(call.recenterCameraToSample).not.toHaveBeenCalled()
    })

    it('keeps the predictive Navigation target aligned with the two-second transition', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            pitch:        -60,
                            altitude:     1000,
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', pitch: -60, altitude: 1000},
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        const anchorSample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
        }
        const futureSample = {
            ...anchorSample,
            progress:          0.6,
            distanceFromStart: 220,
        }
        state.cameraMode = REPLAY_MARKER_MODE_NAVIGATION
        state.navigationPredictiveViolationAt = 0
        call.now = vi.fn(() => 300)
        const lookaheadSeconds = []
        const lookaheadMinimumMeters = []
        call.cameraViewForSample = vi.fn(({sample}) => ({
            sample,
            heading:      0,
            pitch:        -Math.PI / 3,
            cameraHeight: 1000,
        }))
        call.cameraLookaheadSample = vi.fn((sample, {
            lookaheadSeconds: seconds,
            minimumMeters,
        } = {}) => {
            lookaheadSeconds.push(seconds)
            lookaheadMinimumMeters.push(minimumMeters)
            return futureSample
        })
        call.cameraCollisionForSample = vi.fn(sample => ({hard: sample === futureSample}))
        call.rememberNominalCameraView = vi.fn()
        call.recenterCameraToSample = vi.fn()

        updateCamera(mode, {
            sample:   anchorSample,
            progress: anchorSample.progress,
            source:   'playback',
        })

        expect(lookaheadSeconds).toEqual([
            2,
            REPLAY_NAVIGATION_PREDICTIVE_CONFIRMATION_LOOKAHEAD_SECONDS,
            2,
        ])
        expect(lookaheadMinimumMeters).toEqual([
            REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
            REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
            REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
        ])
        expect(REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS).toBe(0)
        expect(call.startDeterministicCameraTransition).toHaveBeenCalledWith(expect.objectContaining({
            sample: futureSample,
            duration: 2,
        }))
    })

    it('treats invalid Draft projections as hard camera collisions', () => {
        const {mode, call} = makeMode()
        const sample = {
            progress:   0.5,
            longitude:  2,
            latitude:   48,
            altitude:   120,
            height:     120,
        }
        call.markerRenderCartesianForSample = vi.fn(() => new Cartesian3(0, 0, 1))
        call.viewportRectForCesiumSurface = vi.fn(() => ({
            left:        0,
            top:         0,
            width:       1920,
            height:      1080,
            canvasWidth: 1920,
            canvasHeight: 1080,
        }))
        vi.stubGlobal('lgs', {
            viewer: {
                camera: {
                    frustum: {
                        fovy:         Math.PI / 3,
                        aspectRatio:  16 / 9,
                    },
                },
            },
        })

        const collision = cameraCollisionForFrame(mode, {
            frame: {
                destination: new Cartesian3(0, 0, 0),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            },
            sample,
            cameraSettings: {
                hysteresis: {
                    zone:        {top: 0.35, left: 0.35, width: 0.3, height: 0.3},
                    marginRatio: 0.12,
                },
            },
        })

        expect(collision).toEqual(expect.objectContaining({
            hard:       true,
            shouldMove: true,
        }))
    })

    it('treats a missing live Draft projection as a hard camera collision', () => {
        const {mode, call} = makeMode()
        call.cesiumScene = vi.fn(() => null)
        const collision = cameraCollisionForSample(mode, {
            progress:   0.5,
            longitude:  2,
            latitude:   48,
            altitude:   120,
            height:     120,
        }, {
            hysteresis: {
                zone:        {top: 0.35, left: 0.35, width: 0.3, height: 0.3},
                marginRatio: 0.12,
            },
        })

        expect(collision).toEqual(expect.objectContaining({
            hard:       true,
            shouldMove: true,
        }))
    })

    it('does not let tracking compete with an active live camera transition', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            pitch:        -60,
                            altitude:     1000,
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', pitch: -60, altitude: 1000},
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
        }
        state.cameraMode = REPLAY_MARKER_MODE_NAVIGATION
        state.cameraApplyingView = true
        state.cameraBezierFrame = vi.fn()
        state.lastNavigationRecenterAt = 0
        call.now = vi.fn(() => 100)
        call.cameraViewForSample = vi.fn(({sample: targetSample}) => ({
            sample:       targetSample,
            heading:      0,
            pitch:        -Math.PI / 3,
            cameraHeight: 1000,
        }))
        call.cameraLookaheadSample = vi.fn(() => ({
            ...sample,
            progress:          0.7,
            distanceFromStart: 140,
        }))
        let collisionCall = 0
        call.cameraCollisionForSample = vi.fn(() => {
            collisionCall += 1
            return {hard: collisionCall === 2}
        })
        call.rememberNominalCameraView = vi.fn()
        call.recenterCameraToSample = vi.fn()

        updateCamera(mode, {
            sample,
            progress: 0.5,
            source:   'playback',
        })

        expect(call.cameraCollisionForSample).not.toHaveBeenCalled()
        expect(call.recenterCameraToSample).not.toHaveBeenCalled()
        expect(call.applyCameraFrame).not.toHaveBeenCalled()
    })

    it('does not recenter for a transient predictive Navigation zigzag', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            pitch:        -60,
                            altitude:     1000,
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', pitch: -60, altitude: 1000},
                },
            },
            viewer: {camera: {}},
        })

        const {mode, call} = makeMode()
        let now = 0
        const anchorSample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
        }
        const nearSample = {
            ...anchorSample,
            progress:          0.53,
            distanceFromStart: 116,
        }
        const zigzagSample = {
            ...anchorSample,
            progress:          0.6,
            distanceFromStart: 220,
        }
        call.now = vi.fn(() => now)
        call.cameraViewForSample = vi.fn(({sample}) => ({
            sample,
            heading:      0,
            pitch:        -Math.PI / 3,
            cameraHeight: 1000,
        }))
        call.cameraLookaheadSample = vi.fn((sample, {lookaheadSeconds} = {}) => (
            lookaheadSeconds < 1 ? nearSample : zigzagSample
        ))
        call.cameraCollisionForSample = vi.fn(sample => ({
            hard: sample === zigzagSample,
        }))
        call.rememberNominalCameraView = vi.fn()
        call.recenterCameraToSample = vi.fn()

        updateCamera(mode, {
            sample:   anchorSample,
            progress: anchorSample.progress,
            source:   'playback',
        })

        now = 400
        updateCamera(mode, {
            sample:   anchorSample,
            progress: anchorSample.progress,
            source:   'playback',
        })

        expect(call.cameraLookaheadSample).toHaveBeenCalledWith(anchorSample, expect.objectContaining({
            lookaheadSeconds: REPLAY_NAVIGATION_PREDICTIVE_CONFIRMATION_LOOKAHEAD_SECONDS,
            minimumMeters:    REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
        }))
        expect(call.recenterCameraToSample).not.toHaveBeenCalled()
    })

    it('uses one deterministic transition for a predictive-only Navigation correction', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            pitch:        -60,
                            altitude:     1000,
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', pitch: -60, altitude: 1000},
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        const sample = {
            progress:          0.5,
            distanceFromStart: 100,
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
        }
        const predictedSample = {
            ...sample,
            progress:          0.6,
            distanceFromStart: 120,
        }
        const nominalView = {
            sample:       predictedSample,
            heading:      0.25,
            pitch:        -Math.PI / 3,
            cameraHeight: 1000,
        }
        state.cameraMode = REPLAY_MARKER_MODE_NAVIGATION
        state.navigationPredictiveViolationAt = 0
        let collisionCall = 0
        call.cameraCollisionForFrame = vi.fn(() => {
            collisionCall += 1
            return {hard: collisionCall === 2 || collisionCall === 3}
        })
        call.cameraCollisionForSample = vi.fn(() => ({hard: false}))
        call.cameraLookaheadSample = vi.fn(() => predictedSample)
        call.cameraViewForSample = vi.fn(({sample: targetSample}) => ({
            ...nominalView,
            sample: targetSample,
        }))
        call.rememberNominalCameraView = vi.fn()

        updateCamera(mode, {
            sample,
            progress:     sample.progress,
            source:       'playback',
            logicalCamera: true,
            frameTimeMs:  1000,
        })

        expect(call.cameraCollisionForFrame).toHaveBeenCalledTimes(3)
        expect(call.startDeterministicCameraTransition).toHaveBeenCalledOnce()
        expect(call.applyDeterministicCameraFollower).not.toHaveBeenCalled()
        expect(call.applyCameraFrame).not.toHaveBeenCalled()
    })

    it('does not let a prepared path bypass the shared runtime camera resolver', () => {
        vi.stubGlobal('lgs', {
            settings: {
                ui: {
                    replay: {
                        camera: {
                            positionMode: 'system',
                            heading:      0,
                            pitch:        -60,
                            altitude:     1000,
                        },
                        marker: {mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores: {
                replay: {
                    camera: {positionMode: 'system', heading: 0, pitch: -60, altitude: 1000},
                },
            },
            viewer: {camera: {}},
        })

        const {mode, state, call} = makeMode()
        const pathFrame = {
            destination: new Cartesian3(10, 20, 30),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        }
        state.constrainedReplayCameraPath = {
            path: {
                sampleAt: vi.fn(() => pathFrame),
            },
        }
        call.applyCameraFrame = vi.fn(() => true)
        call.cameraViewForSample = vi.fn(() => null)
        call.rememberNominalCameraView = vi.fn()
        const logicalFrame = createJourneyReplayLogicalFrame({
            sample: {
                progress: 0.5,
                longitude: 2,
                latitude:  48,
                altitude:  120,
                height:    120,
            },
            progress:     0.5,
            durationMillis: 1000,
            frameTimeMs:  500,
        })

        updateCamera(mode, {
            sample: logicalFrame.sample,
            progress: 0.5,
            source:   'playback',
            logicalFrame,
            logicalCamera: true,
        })

        expect(call.applyCameraFrame).toHaveBeenCalledOnce()
        expect(call.applyCameraFrame).not.toHaveBeenCalledWith(pathFrame)
        expect(logicalFrame.cameraFrame).not.toBe(pathFrame)
        expect(logicalFrame.cameraPose).toEqual(expect.objectContaining({
            logical: true,
            cameraHeight: 1000,
        }))
        expect(call.cameraViewForSample).not.toHaveBeenCalled()
    })

    it('reuses the replay camera cache for repeated visibility checks', () => {
        const {mode, call} = makeMode()
        const cache = createReplayCameraUpdateCache()
        const nominalView = {
            sample: {
                progress:          0.4,
                distanceFromStart: 100,
                longitude:         1,
                latitude:          2,
                altitude:          120,
                height:            120,
            },
            heading:     0.35,
            pitch:       -0.55,
            cameraHeight: 800,
        }
        const futureSample = {
            progress:          0.52,
            distanceFromStart: 160,
            longitude:         1.1,
            latitude:          2.1,
            altitude:          120,
            height:            120,
        }

        call.cameraViewWithRedirectState = vi.fn(view => view)
        call.cameraViewForSample = vi.fn(() => ({
            sample:       futureSample,
            heading:      0.2,
            pitch:        -0.4,
            cameraHeight: 700,
        }))
        call.cameraViewHasLineOfSight = vi.fn(() => true)

        const first = cameraViewVisibilityForSample(mode, {
            nominalView,
            futureSample,
            source:         'playback',
            cameraSettings:  {pitch: -60},
            markerSettings:  {mode: 'trace'},
            cache,
        })
        const second = cameraViewVisibilityForSample(mode, {
            nominalView,
            futureSample,
            source:         'playback',
            cameraSettings:  {pitch: -60},
            markerSettings:  {mode: 'trace'},
            cache,
        })

        expect(first).toBe(true)
        expect(second).toBe(true)
        expect(call.cameraViewForSample).toHaveBeenCalledTimes(1)
        expect(call.cameraViewHasLineOfSight).toHaveBeenCalledTimes(2)
        expect(call.cameraViewWithRedirectState).toHaveBeenCalledTimes(2)
    })

    it('does not reject a camera view only because an optional distant trace target is hidden', () => {
        const {mode, call} = makeMode()
        const requiredMarker = {id: 'marker'}
        const requiredTrace = {id: 'trace-12m'}
        const optionalTrace = {id: 'trace-24m'}
        call.cameraViewFrame = vi.fn(() => ({
            destination: new Cartesian3(0, 0, 1000),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        }))
        call.cameraTraceVisibilityTargets = vi.fn(() => [
            {sample: requiredMarker, required: true},
            {sample: requiredTrace, required: true},
            {sample: optionalTrace, required: false},
        ])
        call.sampleFromVisibilityTarget = vi.fn(target => target.sample)
        call.markerRenderHeightForSample = vi.fn(() => 120)
        call.cameraLineOfSightVisibleForFrame = vi.fn(({sample}) => sample !== optionalTrace)

        expect(cameraViewHasLineOfSight(mode, {
            sample: requiredMarker,
            heading: 0,
            pitch:   -0.4,
        })).toBe(true)

        call.cameraLineOfSightVisibleForFrame = vi.fn(({sample}) => sample !== requiredTrace)
        expect(cameraViewHasLineOfSight(mode, {
            sample: requiredMarker,
            heading: 0,
            pitch:   -0.4,
        })).toBe(false)
    })

    it('projects a replay marker from a candidate frame without using the live Cesium camera', () => {
        const point = projectReplayTargetInCameraFrame({
            frame: {
                destination: new Cartesian3(0, 0, 0),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            },
            target: new Cartesian3(0, 100, 0),
            viewport: {
                left:         0,
                top:          0,
                width:        200,
                height:       100,
                canvasWidth:  200,
                canvasHeight: 100,
            },
            verticalFovRadians: Math.PI / 2,
            aspectRatio:       2,
        })

        expect(point.x).toBeCloseTo(100, 6)
        expect(point.y).toBeCloseTo(50, 6)
        expect(point.depth).toBeCloseTo(100, 6)
    })

    it('preserves the marker target after applying lateral turn drift', () => {
        const target = new Cartesian3(0, 100, 0)
        const frame = offsetConstrainedReplayFrame({
            destination: new Cartesian3(0, 0, 0),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        }, target, 25)
        const expectedDirection = Cartesian3.normalize(
            Cartesian3.subtract(target, frame.destination, new Cartesian3()),
            new Cartesian3(),
        )

        expect(Cartesian3.distance(frame.destination, new Cartesian3(25, 0, 0))).toBeCloseTo(0, 6)
        expect(Cartesian3.distance(frame.direction, expectedDirection)).toBeCloseTo(0, 6)
        expect(Cartesian3.dot(frame.direction, frame.up)).toBeCloseTo(0, 6)
    })

    it('compiles a navigation path whose sampled marker remains inside Z1', () => {
        const viewport = {
            width:  100,
            height: 100,
        }
        const projectTarget = ({frame, target}) => ({
            x: 50 + target.x - frame.destination.x,
            y: 50,
        })
        const path = buildConstrainedReplayCameraPath({
            progresses: Array.from({length: 513}, (_, index) => index / 512),
            sampleAtProgress: progress => ({
                progress,
                markerX: progress * 400,
            }),
            frameForSample: sample => ({
                destination: new Cartesian3(sample.markerX, 0, 0),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            }),
            targetForSample: sample => new Cartesian3(sample.markerX, 100, 0),
            projectTarget,
            trackingMode: 'navigation',
            triggerZone: {
                left:   0.35,
                top:    0.35,
                width:  0.3,
                height: 0.3,
            },
            viewport,
            durationSeconds: 20,
            responseSeconds: 1,
            lookaheadSeconds: 1,
        })

        expect(path).not.toBeNull()
        expect(path.constrainedSamples).toBeGreaterThan(0)
        path.frames.forEach((entry, index) => {
            if (index > 0) {
                expect(entry.frame.destination.x)
                    .toBeGreaterThan(path.frames[index - 1].frame.destination.x)
            }
            const marker = new Cartesian3(entry.progress * 400, 100, 0)
            const point = projectTarget({
                frame: entry.frame,
                target: marker,
            })
            expect(point.x).toBeGreaterThanOrEqual(35)
            expect(point.x).toBeLessThanOrEqual(65)
            expect(point.y).toBeGreaterThanOrEqual(35)
            expect(point.y).toBeLessThanOrEqual(65)
        })
        Array.from({length: 1001}, (_, index) => index).forEach(index => {
            const progress = index / 1000
            const marker = new Cartesian3(progress * 400, 100, 0)
            const point = projectTarget({
                frame: path.sampleAt(progress),
                target: marker,
            })
            expect(point.x).toBeGreaterThanOrEqual(35)
            expect(point.x).toBeLessThanOrEqual(65)
        })
    })

    it('caps constrained path compilation work before Draft playback starts', () => {
        const frameForSample = vi.fn(sample => ({
            destination: new Cartesian3(sample.markerX, 0, 0),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
        }))
        const path = buildConstrainedReplayCameraPath({
            progresses: Array.from({length: 2049}, (_, index) => index / 2048),
            sampleAtProgress: progress => ({
                progress,
                markerX: progress * 100,
            }),
            frameForSample,
            targetForSample: sample => new Cartesian3(sample.markerX, 100, 0),
            projectTarget: ({frame, target}) => ({
                x: 50 + target.x - frame.destination.x,
                y: 50,
            }),
            trackingMode: 'navigation',
            triggerZone: {
                left:   0.2,
                top:    0.2,
                width:  0.6,
                height: 0.6,
            },
            viewport: {
                width:  100,
                height: 100,
            },
        })

        expect(path).not.toBeNull()
        expect(path.frames.length).toBeLessThanOrEqual(2049)
        expect(frameForSample).toHaveBeenCalledTimes(path.frames.length)
    })

    it('keeps camera velocity continuous across compiled path segments', () => {
        const frame = (progress, x, y) => ({
            progress,
            frame: {
                destination: new Cartesian3(x, y, 0),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            },
        })
        const path = {
            frames: [
                frame(0, 0, 0),
                frame(0.25, 1, 0),
                frame(0.5, 2, 0),
                frame(0.75, 2, 1),
                frame(1, 2, 2),
            ],
        }
        const epsilon = 0.0001
        const before = sampleConstrainedReplayCameraPath(path, 0.5 - epsilon)
        const center = sampleConstrainedReplayCameraPath(path, 0.5)
        const after = sampleConstrainedReplayCameraPath(path, 0.5 + epsilon)
        const incoming = Cartesian3.normalize(
            Cartesian3.subtract(center.destination, before.destination, new Cartesian3()),
            new Cartesian3(),
        )
        const outgoing = Cartesian3.normalize(
            Cartesian3.subtract(after.destination, center.destination, new Cartesian3()),
            new Cartesian3(),
        )

        expect(Cartesian3.angleBetween(incoming, outgoing)).toBeLessThan(0.01)
    })

    it('keeps advancing with the nominal journey while the marker remains inside Z1', () => {
        const path = buildConstrainedReplayCameraPath({
            sampleAtProgress: progress => ({
                progress,
                markerX: progress * 100,
            }),
            frameForSample: sample => ({
                destination: new Cartesian3(sample.markerX, 0, 0),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            }),
            targetForSample: sample => new Cartesian3(sample.markerX, 100, 0),
            projectTarget: () => ({
                x: 50,
                y: 50,
            }),
            trackingMode: 'navigation',
            triggerZone: {
                left:   0.2,
                top:    0.2,
                width:  0.6,
                height: 0.6,
            },
            viewport: {
                width:  100,
                height: 100,
            },
        })

        const destinations = path.frames.map(entry => entry.frame.destination.x)
        expect(destinations.at(-1)).toBeCloseTo(100, 6)
        destinations.slice(1).forEach((destination, index) => {
            expect(destination).toBeGreaterThan(destinations[index])
        })
    })

    it('increases the pacing factor for longer replays', () => {
        const shortReplayPace = replayDurationPaceFactor(20, 1000)
        const longReplayPace = replayDurationPaceFactor(240, 1000)

        expect(longReplayPace).toBeGreaterThan(shortReplayPace)
    })

    it('returns to the nominal pitch after a temporary compiled redirect', () => {
        const nominalDirection = new Cartesian3(1, 0, 0)
        const nominalUp = new Cartesian3(0, 0, 1)
        const redirectedNorthDirection = Cartesian3.normalize(
            new Cartesian3(0, 1, -1),
            new Cartesian3(),
        )
        const redirectedNorthUp = Cartesian3.normalize(
            new Cartesian3(0, 1, 1),
            new Cartesian3(),
        )
        const redirectedEastDirection = Cartesian3.normalize(
            new Cartesian3(1, 0, -1),
            new Cartesian3(),
        )
        const redirectedEastUp = Cartesian3.normalize(
            new Cartesian3(1, 0, 1),
            new Cartesian3(),
        )
        const path = buildConstrainedReplayCameraPath({
            sampleAtProgress: progress => ({progress}),
            frameForSample: sample => ({
                destination: new Cartesian3(sample.progress * 100, 0, 0),
                direction:   sample.progress < 0.25
                             ? redirectedNorthDirection
                             : sample.progress < 0.5
                               ? redirectedEastDirection
                               : nominalDirection,
                up:          sample.progress < 0.25
                             ? redirectedNorthUp
                             : sample.progress < 0.5
                               ? redirectedEastUp
                               : nominalUp,
            }),
            targetForSample: sample => new Cartesian3(sample.progress * 100, 100, 0),
            projectTarget: () => ({
                x: 50,
                y: 50,
            }),
            trackingMode: 'navigation',
            triggerZone: {
                left:   0.2,
                top:    0.2,
                width:  0.6,
                height: 0.6,
            },
            viewport: {
                width:  100,
                height: 100,
            },
        })
        const finalFrame = path.sampleAt(1)

        expect(Cartesian3.distance(finalFrame.direction, nominalDirection)).toBeCloseTo(0, 6)
        expect(Cartesian3.distance(finalFrame.up, nominalUp)).toBeCloseTo(0, 6)
    })

    it('checks the exact curved-journey marker between compiled path samples', () => {
        const viewport = {
            left:         0,
            top:          0,
            width:        100,
            height:       100,
            canvasWidth:  100,
            canvasHeight: 100,
        }
        const sampleAtProgress = progress => ({
            progress,
            markerX: Math.sin(progress * Math.PI * 256) * 100,
        })
        const targetForSample = sample => new Cartesian3(sample.markerX, 100, 0)
        const path = buildConstrainedReplayCameraPath({
            sampleAtProgress,
            frameForSample: sample => {
                const target = targetForSample(sample)
                return {
                    destination: new Cartesian3(0, 0, 0),
                    direction:   Cartesian3.normalize(target, new Cartesian3()),
                    up:          new Cartesian3(0, 0, 1),
                }
            },
            targetForSample,
            projectTarget: ({frame, target}) => projectReplayTargetInCameraFrame({
                frame,
                target,
                viewport,
                verticalFovRadians: Math.PI / 2,
                aspectRatio:       1,
            }),
            trackingMode: 'dynamic',
            triggerZone: {
                left:   0.35,
                top:    0.35,
                width:  0.3,
                height: 0.3,
            },
            targetZone: {
                left:   0.45,
                top:    0.45,
                width:  0.1,
                height: 0.1,
            },
            viewport,
        })
        const progress = 0.5 / 128
        const exactTarget = targetForSample(sampleAtProgress(progress))
        const point = projectReplayTargetInCameraFrame({
            frame: path.sampleAt(progress),
            target: exactTarget,
            viewport,
            verticalFovRadians: Math.PI / 2,
            aspectRatio:       1,
        })

        expect(point.x).toBeGreaterThanOrEqual(35)
        expect(point.x).toBeLessThanOrEqual(65)
        expect(point.y).toBeGreaterThanOrEqual(35)
        expect(point.y).toBeLessThanOrEqual(65)
    })

    it('returns the same constrained path frame for Draft and HQ progress', () => {
        const path = buildConstrainedReplayCameraPath({
            sampleAtProgress: progress => ({
                progress,
                markerX: progress * 40,
            }),
            frameForSample: sample => ({
                destination: new Cartesian3(sample.markerX, 0, 0),
                direction:   new Cartesian3(0, 1, 0),
                up:          new Cartesian3(0, 0, 1),
            }),
            targetForSample: sample => new Cartesian3(sample.markerX, 100, 0),
            projectTarget: ({frame, target}) => ({
                x: 50 + target.x - frame.destination.x,
                y: 50,
            }),
            trackingMode: 'dynamic',
            triggerZone: {
                left:   0.2,
                top:    0.2,
                width:  0.6,
                height: 0.6,
            },
            targetZone: {
                left:   0.4,
                top:    0.4,
                width:  0.2,
                height: 0.2,
            },
            viewport: {
                width:  100,
                height: 100,
            },
            durationSeconds: 20,
            responseSeconds: 1,
            lookaheadSeconds: 1,
        })

        const draftFrame = sampleConstrainedReplayCameraPath(path, 0.625)
        const hqFrame = sampleConstrainedReplayCameraPath(path, 0.625)

        expect(draftFrame.destination).toEqual(hqFrame.destination)
        expect(draftFrame.direction).toEqual(hqFrame.direction)
        expect(draftFrame.up).toEqual(hqFrame.up)
    })

    it('preserves the compiled path between Draft cleanup and HQ preparation', () => {
        const constrainedReplayCameraPath = {
            key:  'shared-draft-hq-path',
            path: {frames: []},
        }
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                constrainedReplayCameraPath,
                lastCameraHeading:                    1,
                lastCameraPitch:                      -1,
                lastNominalCameraHeading:             1,
                lastNominalCameraPitch:               -1,
                lastAppliedCameraView:                {},
                deterministicCameraFollowerAt:        1,
                deterministicCameraFollowerActive:    true,
                deterministicCameraFollowerVelocity: {},
                cameraSmoothingDeltaSeconds:          1,
                lastCameraLogicalNow:                 1,
                lastCameraTimingLogicalNow:           1,
                lastCameraTimingWallNow:              1,
                cameraTimingChange:                   {},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {},
        }

        resetCameraInterpolationState(mode)

        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].constrainedReplayCameraPath)
            .toBe(constrainedReplayCameraPath)

        resetCameraInterpolationState(mode, {preserveConstrainedPath: false})

        expect(mode[JOURNEY_REPLAY_INTERNAL_STATE].constrainedReplayCameraPath).toBeNull()
    })
    it('skips terrain lookups when the replay camera bypass is enabled', () => {
        const {mode, call, state} = makeMode()
        state.terrainHeightLookupBypass = true
        const sample = {
            longitude: 2,
            latitude:  48,
            altitude:  150,
            height:    150,
        }
        const cameraSettings = {
            altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
            altitude:     250,
        }

        const cameraHeight = cameraAltitudeForSample(mode, sample, cameraSettings)

        expect(call.terrainHeightForLonLat).not.toHaveBeenCalled()
        expect(cameraHeight).toBe(400)
    })

    it('anchors ground offset to the marker instead of the live camera terrain', () => {
        vi.stubGlobal('lgs', {
            viewer: {
                camera: {
                    positionCartographic: {
                        height: 9000,
                    },
                },
            },
        })

        const {mode, call} = makeMode()
        const sample = {
            longitude: 2,
            latitude:  48,
            altitude:  300,
            height:     300,
        }
        const markerHeight = 1200
        call.markerRenderHeightForSample = vi.fn(() => markerHeight)
        call.markerRenderCartesianForSample = vi.fn(() => Cartesian3.fromDegrees(
            sample.longitude,
            sample.latitude,
            markerHeight,
        ))
        call.cameraAltitudeForSample = vi.fn(() => markerHeight + 800)

        const frame = resolveCameraRecenterFrame(mode, {
            sample,
            heading:        0,
            pitch:          -Math.PI / 4,
            cameraSettings: {
                altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
                altitude:     800,
            },
        })
        expect(frame.targetHeight).toBe(markerHeight)
        expect(frame.currentHeight).toBe(markerHeight + 800)
        expect(frame.currentHeight).not.toBe(9000)
        expect(call.cameraAltitudeForSample).toHaveBeenCalledWith(sample, expect.objectContaining({
            altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
        }))
    })

    it('does not use the displaced camera height as a ground-offset fallback', () => {
        vi.stubGlobal('lgs', {
            viewer: {
                camera: {
                    positionCartographic: {
                        height: 9000,
                    },
                },
            },
        })

        const {mode, call} = makeMode()
        call.terrainHeightForLonLat = vi.fn(() => null)

        const cameraHeight = cameraAltitudeForSample(mode, {
            longitude: 2,
            latitude:  48,
            altitude:  300,
        }, {
            altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
            altitude:     800,
        })

        expect(cameraHeight).toBe(1100)
        expect(call.terrainHeightForLonLat).toHaveBeenCalledWith(2, 48)
    })
})
