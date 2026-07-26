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

import { Cartesian3 } from 'cesium'
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
    replayTurnDriftForProgress,
} from '@Core/ui/replay/JourneyReplayCameraGuide'
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
    interpolateCameraFrame,
    startDeterministicCameraTransition,
} from '@Core/ui/replay/JourneyReplayCameraTransition'
import {
    cancelCameraBezierTransition,
} from '@Core/ui/replay/JourneyReplayCameraState'
import {
    resetCameraInterpolationState,
} from '@Core/ui/replay/JourneyReplayCameraVisibility'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from '@Core/ui/replay/JourneyReplayInternal'

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
        applyDeterministicCameraTransition: vi.fn(() => true),
        applyCameraFrame: vi.fn(frame => frame),
        buildCameraGuide: vi.fn(() => []),
        replayTurnDriftForProgress: vi.fn(() => null),
        markerPositionForSample: vi.fn(sample => sample),
        cameraAltitudeForSample: vi.fn(() => 1000),
        headingFromPositionProperty: vi.fn(() => 0),
        smoothRadians: vi.fn((previous, next) => next),
        timeNormalizedSmoothingFactor: vi.fn(() => 1),
        headingEasingFactor: vi.fn(() => 1),
        liveCameraPitch: vi.fn(pitch => pitch),
        cameraRecenterFrame: vi.fn(() => ({
            destination: new Cartesian3(0, 0, 1000),
            direction:   new Cartesian3(0, 1, 0),
            correctedUp: new Cartesian3(0, 0, 1),
            safeHeading: 0,
            safePitch:   -1,
        })),
        cameraLineOfSightVisibleForFrame: vi.fn(() => true),
        renderedTraceVisibleForSample: vi.fn(() => true),
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
            sample:       {id: 'sample', progress: 0.5},
            heading:      0,
            pitch:        0,
            endFrame,
            duration:     1,
            logicalNow:   10,
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
                markerX: progress * 100,
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
        path.frames.forEach(entry => {
            const marker = new Cartesian3(entry.progress * 100, 100, 0)
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
            const marker = new Cartesian3(progress * 100, 100, 0)
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
        expect(path.frames.length).toBeLessThanOrEqual(257)
        expect(frameForSample).toHaveBeenCalledTimes(path.frames.length)
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
})
