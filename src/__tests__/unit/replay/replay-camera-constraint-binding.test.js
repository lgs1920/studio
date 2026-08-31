/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-camera-constraint-binding.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-08-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3} from 'cesium'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))

import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from '@Core/ui/replay/JourneyReplayInternal'
import {
    constrainedReplayTerrainRedirectWeight,
    resolveConstrainedReplayCameraPath,
} from '@Core/ui/replay/JourneyReplayCameraConstraintBinding'
import * as ConstrainedReplayCameraPath from '@Core/ui/replay/JourneyReplayConstrainedCameraPath'

const makeMode = () => {
    const state = {
        sampler: {
            atProgress: vi.fn(progress => ({
                distanceFromStart: progress * 1000,
                progress,
                longitude: 2,
                latitude: 48,
                altitude: 120,
                height: 120,
            })),
        },
        constrainedReplayCameraPath: null,
    }
    const call = {
        buildCameraGuide: vi.fn(() => []),
        cameraGuideKey: vi.fn(() => 'guide-key'),
        cameraLineOfSightVisibleForFrame: vi.fn(() => false),
        cameraRedirectPitchLimits: vi.fn(() => ({
            min: -1.3,
            max: -0.1,
        })),
        cameraRecenterFrame: vi.fn(({heading, pitch}) => ({
            destination: new Cartesian3(0, 0, 1000),
            direction:   new Cartesian3(0, 1, 0),
            up:          new Cartesian3(0, 0, 1),
            safeHeading: heading,
            safePitch:   pitch,
        })),
        cameraViewForSample: vi.fn(sample => ({
            sample,
            heading:      0.25,
            pitch:        -0.5,
            cameraHeight: 800,
        })),
        cameraViewVisibilityForSample: vi.fn(() => false),
        cameraViewWithRedirectState: vi.fn((view, redirectState) => ({
            ...view,
            heading: (view.heading ?? 0) + (redirectState.headingOffset ?? 0),
            pitch:   (view.pitch ?? -0.5) + (redirectState.pitchOffset ?? 0),
        })),
        constrainedReplayProjectionViewport: vi.fn(() => ({
            left:         0,
            top:          0,
            width:        100,
            height:       100,
            canvasWidth:  100,
            canvasHeight: 100,
        })),
        findCameraRedirectState: vi.fn()
            .mockImplementationOnce(() => ({
                headingOffset: 0.2,
                pitchOffset:   -0.1,
            }))
            .mockImplementation(() => ({
                headingOffset: 0.4,
                pitchOffset:   -0.3,
            })),
        markerPositionForSample: vi.fn(sample => sample),
        markerRenderHeightForSample: vi.fn(() => 120),
        markerRenderCartesianForSample: vi.fn(() => new Cartesian3(0, 0, 0)),
        renderedTraceVisibleForSample: vi.fn(() => false),
        replayTurnDriftForGuideProgress: vi.fn(() => null),
    }
    const mode = {
        [JOURNEY_REPLAY_INTERNAL_STATE]: state,
        [JOURNEY_REPLAY_INTERNAL_CALL]:  call,
    }

    return {mode, state, call}
}

describe('JourneyReplayCameraConstraintBinding', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        delete globalThis.lgs
        delete globalThis.__lgsReplayVideoTrace
    })

    it('returns a terrain redirect to the nominal pitch after a bounded cycle', () => {
        globalThis.lgs = {
            viewer: {
                camera: {
                    frustum: {
                        fovy:         Math.PI / 3,
                        aspectRatio:  1,
                    },
                },
            },
            stores: {
                replay: {
                    markerRadius: 35,
                },
            },
        }

        const buildSpy = vi.spyOn(ConstrainedReplayCameraPath, 'buildConstrainedReplayCameraPath')
            .mockImplementation(options => {
                const sampleA = {
                    distanceFromStart: 0,
                    progress:          0,
                    longitude:         2,
                    latitude:          48,
                    altitude:          120,
                    height:            120,
                }
                const sampleB = {
                    distanceFromStart: 100,
                    progress:          0.1,
                    longitude:         2,
                    latitude:          48,
                    altitude:          120,
                    height:            120,
                }

                options.frameForSample(sampleA, 0)
                options.frameForSample(sampleB, 0.1)
                options.frameForSample(sampleB, 0.2)
                options.frameForSample(sampleB, 0.3)
                options.frameForSample(sampleB, 0.4)
                return {frames: []}
            })

        const {mode, call} = makeMode()

        resolveConstrainedReplayCameraPath(mode, {
            trackingMode:    'navigation',
            cameraSettings:  {hysteresis: {}},
            markerSettings:  {},
            runtimeTracking: {
                navigation: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                },
                dynamic: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                    targetZone: {
                        top:    0.4,
                        left:   0.4,
                        width:  0.2,
                        height: 0.2,
                    },
                },
            },
            durationSeconds: 10,
            responseSeconds: 1,
            lookaheadSeconds: 1,
        })

        expect(buildSpy).toHaveBeenCalledOnce()
        expect(call.findCameraRedirectState).toHaveBeenCalledTimes(1)
        expect(call.cameraViewWithRedirectState).toHaveBeenCalledTimes(2)
        expect(call.cameraViewWithRedirectState.mock.calls.map(([, redirectState]) => redirectState.pitchOffset)).toEqual([
            -0.1,
            -0.05,
        ])
        expect(call.cameraRecenterFrame).toHaveBeenCalledTimes(7)
        expect(call.cameraRecenterFrame.mock.calls.map(([payload]) => payload.pitch)).toEqual([
            -0.5,
            -0.5,
            -0.6,
            -0.5,
            -0.55,
            -0.5,
            -0.5,
        ])
    })

    it('traces constrained path compilation timings', () => {
        globalThis.lgs = {
            viewer: {
                camera: {
                    frustum: {
                        fovy:        Math.PI / 3,
                        aspectRatio: 1,
                    },
                },
            },
            stores: {
                replay: {
                    markerRadius: 35,
                },
            },
        }

        const buildSpy = vi.spyOn(ConstrainedReplayCameraPath, 'buildConstrainedReplayCameraPath')
            .mockImplementation(options => {
                options.frameForSample({
                    distanceFromStart: 0,
                    progress:          0,
                    longitude:         2,
                    latitude:          48,
                    altitude:          120,
                    height:            120,
                }, 0)
                return {frames: []}
            })

        const {mode} = makeMode()

        resolveConstrainedReplayCameraPath(mode, {
            trackingMode:   'navigation',
            cameraSettings: {hysteresis: {}},
            markerSettings: {},
            runtimeTracking: {
                navigation: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                },
                dynamic: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                    targetZone: {
                        top:    0.4,
                        left:   0.4,
                        width:  0.2,
                        height: 0.2,
                    },
                },
            },
            durationSeconds: 10,
            responseSeconds: 1,
            lookaheadSeconds: 1,
        })

        expect(buildSpy).toHaveBeenCalledOnce()
        const traceEntries = globalThis.__lgsReplayVideoTrace ?? []
        const traceEvents = traceEntries.map(entry => entry.event)
        expect(traceEvents).toContain('camera.path.compile.start')
        expect(traceEvents).toContain('camera.path.compile.end')
        const compileEnd = traceEntries.find(entry => entry.event === 'camera.path.compile.end')
        expect(compileEnd?.data).toEqual(expect.objectContaining({
            compiled: true,
            frameCount: 0,
            constrainedSamples: 0,
            elapsedMs: expect.any(Number),
        }))
    })

    it('forces the terrain redirect weight to zero at the replay end', () => {
        expect(constrainedReplayTerrainRedirectWeight({
            elapsedSeconds:   1,
            remainingSeconds: 0,
        })).toBe(0)
        expect(constrainedReplayTerrainRedirectWeight({
            elapsedSeconds:   3,
            remainingSeconds: 10,
        })).toBe(0)
    })

    it('spreads a 90-degree heading turn over multiple compiled frames', () => {
        globalThis.lgs = {
            viewer: {
                camera: {
                    frustum: {
                        fovy:        Math.PI / 3,
                        aspectRatio: 1,
                    },
                },
            },
            stores: {
                replay: {
                    markerRadius: 35,
                },
            },
        }

        vi.spyOn(ConstrainedReplayCameraPath, 'buildConstrainedReplayCameraPath')
            .mockImplementation(options => {
                Array.from({length: 61}, (_, index) => index / 60)
                    .forEach(progress => {
                        options.frameForSample({progress}, progress)
                    })
                return {frames: []}
            })

        const {mode, call} = makeMode()
        call.cameraLineOfSightVisibleForFrame.mockReturnValue(true)
        call.cameraViewForSample.mockImplementation(({sample, progress}) => ({
            sample,
            heading: progress < 0.5 ? 0 : Math.PI / 2,
            pitch: -Math.PI / 4,
            cameraHeight: 800,
        }))

        resolveConstrainedReplayCameraPath(mode, {
            trackingMode:   'navigation',
            cameraSettings: {
                hysteresis: {
                    easing: 0.18,
                },
            },
            markerSettings: {},
            runtimeTracking: {
                navigation: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                },
                dynamic: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                    targetZone: {
                        top:    0.4,
                        left:   0.4,
                        width:  0.2,
                        height: 0.2,
                    },
                },
            },
            durationSeconds: 2,
            responseSeconds: 1,
            lookaheadSeconds: 1,
        })

        const headings = call.cameraRecenterFrame.mock.calls
            .map(([payload]) => payload.heading)
        const maximumStep = Math.max(...headings.slice(1).map((heading, index) =>
            Math.abs(heading - headings[index]),
        ))

        expect(maximumStep).toBeLessThan(Math.PI / 10)
        expect(headings.at(-1)).toBeGreaterThan(1.45)
    })

    it('returns a 45-degree pitch after a smooth 20-degree terrain redirect', () => {
        globalThis.lgs = {
            viewer: {
                camera: {
                    frustum: {
                        fovy:        Math.PI / 3,
                        aspectRatio: 1,
                    },
                },
            },
            stores: {
                replay: {
                    markerRadius: 35,
                },
            },
        }

        const compiledPitches = []
        const {mode, call} = makeMode()
        call.cameraViewForSample.mockImplementation(({sample, progress}) => ({
            sample,
            heading: progress < 0.3 ? 0 : Math.PI / 2,
            pitch: -Math.PI / 4,
            cameraHeight: 800,
        }))
        call.findCameraRedirectState
            .mockReset()
            .mockReturnValue({
                headingOffset: 0,
                pitchOffset:   -Math.PI / 9,
            })
        vi.spyOn(ConstrainedReplayCameraPath, 'buildConstrainedReplayCameraPath')
            .mockImplementation(options => {
                Array.from({length: 181}, (_, index) => index / 180)
                    .forEach(progress => {
                        options.frameForSample({progress}, progress)
                        compiledPitches.push(
                            call.cameraRecenterFrame.mock.calls.at(-1)[0].pitch,
                        )
                    })
                return {frames: []}
            })

        resolveConstrainedReplayCameraPath(mode, {
            trackingMode:   'navigation',
            cameraSettings: {
                hysteresis: {
                    easing: 0.18,
                },
            },
            markerSettings: {},
            runtimeTracking: {
                navigation: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                },
                dynamic: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                    targetZone: {
                        top:    0.4,
                        left:   0.4,
                        width:  0.2,
                        height: 0.2,
                    },
                },
            },
            durationSeconds: 6,
            responseSeconds: 1,
            lookaheadSeconds: 1,
        })

        const maximumStep = Math.max(...compiledPitches.slice(1).map((pitch, index) =>
            Math.abs(pitch - compiledPitches[index]),
        ))

        expect(compiledPitches[0]).toBeCloseTo(-Math.PI / 4, 6)
        expect(Math.min(...compiledPitches)).toBeLessThan(-1.1)
        expect(maximumStep).toBeLessThan(Math.PI / 30)
        expect(compiledPitches.at(-1)).toBeCloseTo(-Math.PI / 4, 6)
    })

    it('honours disabled hidden-marker correction and turn drift capabilities', () => {
        globalThis.lgs = {
            viewer: {
                camera: {
                    frustum: {
                        fovy:         Math.PI / 3,
                        aspectRatio:  1,
                    },
                },
            },
            stores: {
                replay: {
                    markerRadius: 35,
                },
            },
        }

        const buildSpy = vi.spyOn(ConstrainedReplayCameraPath, 'buildConstrainedReplayCameraPath')
            .mockImplementation(options => {
                options.frameForSample({
                    distanceFromStart: 0,
                    progress:          0,
                    longitude:         2,
                    latitude:          48,
                    altitude:          120,
                    height:            120,
                }, 0)
                return {frames: []}
            })

        const {mode, call} = makeMode()

        resolveConstrainedReplayCameraPath(mode, {
            trackingMode:   'navigation',
            cameraSettings: {
                canDrift:           false,
                canFixHiddenMarker: false,
                hysteresis:         {},
            },
            markerSettings: {},
            runtimeTracking: {
                navigation: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                },
                dynamic: {
                    triggerZone: {
                        top:    0.2,
                        left:   0.2,
                        width:  0.6,
                        height: 0.6,
                    },
                    targetZone: {
                        top:    0.4,
                        left:   0.4,
                        width:  0.2,
                        height: 0.2,
                    },
                },
            },
            durationSeconds: 10,
            responseSeconds: 1,
            lookaheadSeconds: 1,
        })

        expect(buildSpy).toHaveBeenCalledOnce()
        expect(call.findCameraRedirectState).not.toHaveBeenCalled()
        expect(call.replayTurnDriftForGuideProgress).not.toHaveBeenCalled()
    })
})
