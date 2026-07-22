/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-phase1.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-01
 * Last modified: 2026-07-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { REPLAY_DRAWER }                                           from '@Core/constants'
import { createJourneyReplayClipInstance }                                from '@Core/ui/replay/JourneyReplayClips'
import {
    replayAngularDelta, replayCameraHeadingForPositionMode, replayCameraHeadingWithHysteresis,
    replayCameraRangeFromPitch, replayCameraRecenterDuration, replayCameraRecenterHeight,
    replayCameraRecenterHorizontalDistance, replayHeadingEasingFactor, replayHeadingFromLocalAxisAngle,
    replayIsWindowPointOutsideToleranceZone, replayPitchLookaheadFactor, JourneyReplayMode, replayTargetSampleForClip,
    replayToleranceZoneBounds, replayCenteredZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone,
}                                                                      from '@Core/ui/replay/JourneyReplayMode'
import {
    REPLAY_SCOPE_ALL_TRACKS, REPLAY_SCOPE_CURRENT_TRACK, REPLAY_SCOPE_VISIBLE_TRACKS, JourneyReplayPathSampler,
}                                                                      from '@Core/ui/replay/JourneyReplayPathSampler'
import {
    REPLAY_EVENT_END, REPLAY_EVENT_START, REPLAY_EVENT_STOP, REPLAY_EVENT_UPDATE,
    JourneyReplayPlaybackController,
}                                                                      from '@Core/ui/replay/JourneyReplayPlaybackController'
import {
    defaultJourneyReplaySettings, REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_POSITION_AHEAD, REPLAY_CAMERA_POSITION_BEHIND, REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_CAMERA_PRESET_DEFAULT, REPLAY_CAMERA_PRESET_ULTRA_SMOOTH,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE,
    getJourneyReplayCameraPresetKey, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker, normalizeJourneyReplaySettings,
}                                                                      from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { gpx }                                                         from '@tmcw/togeojson'
import { applyGpxStyleExtensionProperties, extractLgsTrackProperties } from '@Utils/JourneyGpxUtils'
import { Cartesian3, Cartographic, Matrix4, Math as CesiumMath, Transforms } from 'cesium'
import { proxy }                                                       from 'valtio'
import { describe, expect, it, vi }                                    from 'vitest'

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))


import {makeJourney, makeTrack} from '../../unit/replay/replay-phase1-fixtures'

describe('replay camera tracking', () => {

    it('keeps the fixed camera altitude when Cesium cannot provide a stable live height', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   {
                                          ...replay.camera,
                                          altitudeMode: 'constant',
                                          altitude:     1200,
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.9,
                    pitch:                -Math.PI / 6,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: undefined},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })

            mode.syncCameraFromCesiumControls({
                                                  altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
                                                  sample: {
                                                      longitude: 2,
                                                      latitude:  48,
                                                      altitude:  300,
                                                  },
                                              })

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1200)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1200)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('preserves the configured ground offset when terrain height is unavailable', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        camera: {
                            ...replay.camera,
                            altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
                            altitude:     2000,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   {
                                          ...replay.camera,
                                          altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
                                          altitude:     2000,
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.9,
                    pitch:                -Math.PI / 6,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 4200},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                },
                globe:         {
                    getHeight: () => null,
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })

            mode.syncCameraFromCesiumControls({
                                                  sample: {
                                                      longitude: 2,
                                                      latitude:  48,
                                                      altitude:  300,
                                                  },
                                              })

            expect(globalThis.lgs.settings.ui.replay.camera.altitudeMode).toBe(REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET)
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2000)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(2000)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('keeps the stored ground offset unchanged when Cesium height differs from the offset', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        camera: {
                            ...replay.camera,
                            altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
                            altitude:     2000,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   {
                                          ...replay.camera,
                                          altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
                                          altitude:     2000,
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.9,
                    pitch:                -Math.PI / 6,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 4300},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                },
                globe:         {
                    getHeight: () => 2300,
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })

            mode.syncCameraFromCesiumControls({
                                                  sample: {
                                                      longitude: 2,
                                                      latitude:  48,
                                                      altitude:  300,
                                                  },
                                              })

            expect(globalThis.lgs.settings.ui.replay.camera.altitudeMode).toBe(REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET)
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2000)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(2000)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('keeps the drawer in sync with live Cesium camera edits while an active replay is running', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        let cameraChanged = null
        let moveStart = null
        let moveEnd = null

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.9,
                    pitch:                -Math.PI / 6,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 2460},
                    changed:              {
                        addEventListener:    listener => {
                            cameraChanged = listener
                        },
                        removeEventListener: () => {
                        },
                    },
                    moveStart:            {
                        addEventListener:       listener => {
                            moveStart = listener
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       listener => {
                            moveEnd = listener
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    lookAtTransform:      () => {
                    },
                    setView:              () => {
                    },
                },
            },
            scene:      {
                canvas:                       {
                    getBoundingClientRect: () => ({left: 0, top: 0, width: 1000, height: 1000}),
                },
                cartesianToCanvasCoordinates: () => ({x: 100, y: 100}),
                globe:                        {getHeight: () => 120},
                requestRender:                () => {
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })

            mode.start()

            vi.advanceTimersByTime(250)
            moveStart?.()
            globalThis.lgs.viewer.camera.heading = 1.4
            globalThis.lgs.viewer.camera.pitch = -Math.PI / 4
            globalThis.lgs.viewer.camera.positionCartographic.height = 3000

            cameraChanged()
            moveEnd?.()

            expect(globalThis.lgs.settings.ui.replay.camera.heading).toBeCloseTo(80, 0)
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBeCloseTo(-45, 0)
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(3000)
            expect(globalThis.lgs.stores.replay.camera.heading).toBeCloseTo(80, 0)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('can refresh replay rendering without moving the camera', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        let setViewCalls = 0
        let renderUpdates = 0

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_NAVIGATION,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    moveStart:    {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:      {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight: () => {
                    },
                    setView:      () => {
                        setViewCalls += 1
                    },
                },
            },
            scene:      {
                requestRender: () => {
                }, globe:      {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                        renderUpdates += 1
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refresh({camera: false})

            expect(renderUpdates).toBe(1)
            expect(setViewCalls).toBe(0)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('keeps the manually adjusted Cesium heading in system camera mode', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const lookAtTransformCalls = []
        const setViewCalls = []

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_NAVIGATION,
                        },
                        camera: {
                            ...replay.camera,
                            positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              1.25,
                    pitch:                -Math.PI / 4,
                    positionCartographic: {height: 1840},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    lookAtTransform:      (...args) => lookAtTransformCalls.push(args),
                    setView:              options => setViewCalls.push(options),
                },
            },
            scene:      {
                requestRender: () => {
                },
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.syncCameraFromCesiumControls()
            mode.refreshCamera()
            mode.refreshCamera()

            expect(lookAtTransformCalls).toHaveLength(1)
            expect(setViewCalls).toHaveLength(1)
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBeCloseTo(-45, 6)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('lets Cesium pointer interactions override navigation camera pitch before tracking resumes', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const lookAtTransformCalls = []
        const setViewCalls = []
        const canvasListeners = new Map()
        const canvas = {
            addEventListener:    (type, listener) => canvasListeners.set(type, listener),
            removeEventListener: type => canvasListeners.delete(type),
        }
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            positionCartographic: {height: 1840},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            lookAtTransform:      (...args) => lookAtTransformCalls.push(args),
            setView:              options => setViewCalls.push(options),
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_NAVIGATION,
                        },
                        camera: {
                            ...replay.camera,
                            positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                canvas,
                trackedEntity: null,
                camera,
            },
            scene:      {
                canvas,
                requestRender: () => {
                },
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()

            canvasListeners.get('pointerdown')()
            camera.pitch = -Math.PI / 6
            camera.positionCartographic.height = 2200
            mode.refreshCamera()
            expect(lookAtTransformCalls).toHaveLength(0)

            canvasListeners.get('pointerup')()
            vi.advanceTimersByTime(130)
            mode.refreshCamera()

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2200)
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBeCloseTo(-30, 6)
            expect(lookAtTransformCalls).toHaveLength(1)
            expect(setViewCalls).toHaveLength(1)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('ignores Cesium move events emitted by navigation tracking itself', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const cameraSettings = {
            ...replay.camera,
            positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
            altitude:     3200,
            pitch:        -62,
        }
        let moveStart
        let moveEnd

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_NAVIGATION,
                        },
                        camera: cameraSettings,
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   cameraSettings,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.8,
                    pitch:                -0.096865,
                    positionCartographic: {height: 950},
                    moveStart:            {
                        addEventListener:    listener => {
                            moveStart = listener
                        },
                        removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:    listener => {
                            moveEnd = listener
                        },
                        removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                },
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera()
            moveStart()
            moveEnd()

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(3200)
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(-62)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('captures mouse wheel zoom in navigation even after a programmatic camera update', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvasListeners = new Map()
        const canvas = {
            addEventListener:    (type, listener) => canvasListeners.set(type, listener),
            removeEventListener: type => canvasListeners.delete(type),
        }
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            positionCartographic: {height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_NAVIGATION,
                        },
                        camera: {
                            ...replay.camera,
                            positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                canvas,
                trackedEntity: null,
                camera,
            },
            scene:      {
                canvas,
                requestRender: () => {
                },
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera()
            camera.positionCartographic.height = 2600
            canvasListeners.get('wheel')()
            vi.advanceTimersByTime(130)

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2600)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('rechecks tolerance zone after camera zoom and recenters when the marker is outside', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvasListeners = new Map()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    (type, listener) => canvasListeners.set(type, listener),
            removeEventListener: type => canvasListeners.delete(type),
        }
        const flyToCalls = []
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            positionCartographic: {height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 990, y: 990}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            camera.positionCartographic.height = 2600
            canvasListeners.get('wheel')()
            vi.advanceTimersByTime(130)

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2600)
            expect(flyToCalls).toHaveLength(1)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('recenters immediately on replay start when the first tolerance marker is outside the window', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        const setViewCalls = []
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            roll:                 0,
            positionCartographic: {longitude: 0.1, latitude: 0.2, height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            setView:              options => setViewCalls.push(options),
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: -120, y: 500}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.start()

            const target = Cartesian3.fromDegrees(2, 48, 120)
            const expectedDirection = Cartesian3.normalize(
                Cartesian3.subtract(target, setViewCalls[0].destination, new Cartesian3()),
                new Cartesian3(),
            )

            expect(flyToCalls).toHaveLength(0)
            expect(setViewCalls).toHaveLength(1)
            expect(setViewCalls[0].orientation.direction.x).toBeCloseTo(expectedDirection.x, 6)
            expect(setViewCalls[0].orientation.direction.y).toBeCloseTo(expectedDirection.y, 6)
            expect(setViewCalls[0].orientation.direction.z).toBeCloseTo(expectedDirection.z, 6)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('recenters immediately on replay start even when the first tolerance marker is already inside the zone', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        const setViewCalls = []

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 1800},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    flyTo:                options => flyToCalls.push(options),
                    setView:              options => setViewCalls.push(options),
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 500, y: 500}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.start()

            expect(flyToCalls).toHaveLength(0)
            expect(setViewCalls).toHaveLength(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('draws the tolerance zone overlay over the Cesium canvas', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvas = {
            clientWidth:           1000,
            clientHeight:          800,
            addEventListener:      () => {
            },
            removeEventListener:   () => {
            },
            getBoundingClientRect: () => ({
                left:   10,
                top:    20,
                width:  1000,
                height: 800,
            }),
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas,
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 1800},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    flyTo:                () => {
                    },
                    setView:              () => {
                    },
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                canvas,
                cartesianToCanvasCoordinates: () => ({x: 500, y: 400}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            document.querySelectorAll('.replay-tolerance-zone-overlay').forEach(element => element.remove())
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.start()

            const overlay = document.querySelector('.replay-tolerance-zone-overlay')
            expect(overlay).not.toBeNull()
            expect(overlay.hidden).toBe(false)
            expect(overlay.style.display).not.toBe('none')
            expect(Number.parseFloat(overlay.style.left)).toBeCloseTo(135, 6)
            expect(Number.parseFloat(overlay.style.top)).toBeCloseTo(120, 6)
            expect(Number.parseFloat(overlay.style.width)).toBeCloseTo(750, 6)
            expect(Number.parseFloat(overlay.style.height)).toBeCloseTo(600, 6)
            expect(overlay.style.background).toContain('rgba(255, 0, 0')
            expect(overlay.firstElementChild?.className).toBe('replay-tolerance-zone-overlay-outer')
            expect(overlay.firstElementChild?.dataset.zone).toBe('z1')
            expect(overlay.lastElementChild?.className).toBe('replay-tolerance-zone-overlay-inner')
            expect(overlay.lastElementChild?.dataset.zone).toBe('z2')
            expect(overlay.lastElementChild?.style.border).toContain('dashed')
            expect(Number.parseFloat(overlay.lastElementChild.style.left)).toBeCloseTo(225, 6)
            expect(Number.parseFloat(overlay.lastElementChild.style.top)).toBeCloseTo(180, 6)
            expect(Number.parseFloat(overlay.lastElementChild.style.width)).toBeCloseTo(300, 6)
            expect(Number.parseFloat(overlay.lastElementChild.style.height)).toBeCloseTo(240, 6)

            mode.stop({emit: false})
            expect(document.querySelector('.replay-tolerance-zone-overlay')).toBeNull()

            mode.start()
            expect(document.querySelector('.replay-tolerance-zone-overlay')).not.toBeNull()
        }
        finally {
            document.querySelector('.replay-tolerance-zone-overlay')?.remove()
            globalThis.lgs = previousLgs
        }
    })

    it('positions the tolerance zone overlay inside the video crop rect when recording sync is active', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvas = {
            clientWidth:           1000,
            clientHeight:          800,
            addEventListener:      () => {
            },
            removeEventListener:   () => {
            },
            getBoundingClientRect: () => ({
                left:   10,
                top:    20,
                width:  1000,
                height: 800,
            }),
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress:      0,
                                      camera:        replay.camera,
                                      recordingSync: true,
                                      videoCropRect: {
                                          left:   120,
                                          top:    60,
                                          width:  1000,
                                          height: 800,
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas,
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 1800},
                    moveStart:            {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:       () => {
                        }, removeEventListener: () => {
                        },
                    },
                    cancelFlight:         () => {
                    },
                    flyTo:                () => {
                    },
                    setView:              () => {
                    },
                    lookAtTransform:      () => {
                    },
                },
            },
            scene:      {
                canvas,
                cartesianToCanvasCoordinates: () => ({x: 500, y: 400}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            document.querySelectorAll('.replay-tolerance-zone-overlay').forEach(element => element.remove())
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.start()

            const overlay = document.querySelector('.replay-tolerance-zone-overlay')
            expect(overlay).not.toBeNull()
            expect(Number.parseFloat(overlay.style.left)).toBeCloseTo(245, 6)
            expect(Number.parseFloat(overlay.style.top)).toBeCloseTo(160, 6)
            expect(Number.parseFloat(overlay.style.width)).toBeCloseTo(750, 6)
            expect(Number.parseFloat(overlay.style.height)).toBeCloseTo(600, 6)

            mode.stop({emit: false})
        }
        finally {
            document.querySelector('.replay-tolerance-zone-overlay')?.remove()
            globalThis.lgs = previousLgs
        }
    })

    it('draws the navigation Z1 overlay as the central 30 percent viewport zone', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvas = {
            clientWidth:           1000,
            clientHeight:          800,
            addEventListener:      () => {},
            removeEventListener:   () => {},
            getBoundingClientRect: () => ({
                left:   10,
                top:    20,
                width:  1000,
                height: 800,
            }),
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_NAVIGATION,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas,
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 1800},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    flyTo:                () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                canvas,
                cartesianToCanvasCoordinates: () => ({x: 500, y: 400}),
                requestRender:                () => {},
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            document.querySelectorAll('.replay-tolerance-zone-overlay').forEach(element => element.remove())
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {},
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {},
                                                    show:   () => {},
                                                    update: () => {},
                                                },
                                            })
            mode.start()

            const overlay = document.querySelector('.replay-tolerance-zone-overlay')
            expect(overlay).not.toBeNull()
            expect(overlay.dataset.mode).toBe(REPLAY_MARKER_MODE_NAVIGATION)
            expect(Number.parseFloat(overlay.style.left)).toBeCloseTo(360, 6)
            expect(Number.parseFloat(overlay.style.top)).toBeCloseTo(270, 6)
            expect(Number.parseFloat(overlay.style.width)).toBeCloseTo(300, 6)
            expect(Number.parseFloat(overlay.style.height)).toBeCloseTo(300, 6)
            expect(overlay.querySelector('[data-zone="z1"]')).not.toBeNull()
            expect(overlay.querySelector('[data-zone="z2"]')).toBeNull()

            mode.stop({emit: false})
        }
        finally {
            document.querySelector('.replay-tolerance-zone-overlay')?.remove()
            globalThis.lgs = previousLgs
        }
    })

    it('recenters navigation playback toward the predicted sample when leaving Z1', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.01, 48, 120], [2.02, 48, 120]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {},
            removeEventListener: () => {},
        }
        const flyToCalls = []
        const cameraPosition = Cartesian3.fromDegrees(2, 47.99, 1800)
        const camera = {
            heading:              0,
            pitch:                -Math.PI / 4,
            position:             cameraPosition,
            positionWC:           cameraPosition,
            positionCartographic: {height: 1800},
            moveStart:            {
                addEventListener:    () => {},
                removeEventListener: () => {},
            },
            moveEnd:              {
                addEventListener:    () => {},
                removeEventListener: () => {},
            },
            cancelFlight:         () => {},
            flyTo:                options => flyToCalls.push(options),
            setView:              () => {},
            lookAtTransform:      () => {},
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_NAVIGATION,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas,
                camera,
            },
            scene:      {
                canvas,
                cartesianToCanvasCoordinates: () => ({x: 900, y: 500}),
                requestRender:                () => {},
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {},
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {},
                                                    show:   () => {},
                                                    update: () => {},
                                                },
            })
            mode.configure({duration: 10})
            mode.refreshCamera({
                sample:   mode.controller.sampler.atProgress(0),
                progress: 0,
                source:   'playback',
            })

            expect(flyToCalls).toHaveLength(1)
            expect(flyToCalls[0].duration).toBeGreaterThan(0)
            const targetCartesian = Cartesian3.fromDegrees(2.01, 48, 120)
            const targetTransform = Transforms.eastNorthUpToFixedFrame(targetCartesian)
            const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
            const delta = Cartesian3.subtract(flyToCalls[0].destination, targetCartesian, new Cartesian3())

            expect(Cartesian3.dot(delta, east)).toBeLessThan(-200)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('keeps navigation collision recentering live in a replay-synced Draft', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.01, 48, 120], [2.02, 48, 120]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {},
            removeEventListener: () => {},
        }
        const flyTo = vi.fn()
        const setView = vi.fn()
        const cameraPosition = Cartesian3.fromDegrees(2, 47.99, 1800)
        const camera = {
            heading:              0,
            pitch:                -Math.PI / 4,
            position:             cameraPosition,
            positionWC:           cameraPosition,
            positionCartographic: {height: 1800},
            moveStart:            {addEventListener: () => {}, removeEventListener: () => {}},
            moveEnd:              {addEventListener: () => {}, removeEventListener: () => {}},
            cancelFlight:         () => {},
            flyTo,
            setView,
            lookAtTransform:      () => {},
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        recordingSync: true,
                        marker:        {...replay.marker, mode: REPLAY_MARKER_MODE_NAVIGATION},
                    },
                },
            },
            stores:     {
                replay: proxy({progress: 0, camera: replay.camera, recordingSync: true}),
                ui:     {video: {recording: true}},
            },
            viewer:     {trackedEntity: null, canvas, camera},
            scene:      {
                canvas,
                cartesianToCanvasCoordinates: () => ({x: 900, y: 500}),
                requestRender:                () => {},
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                    controller: new JourneyReplayPlaybackController({
                                                                                                     requestFrame: () => 1,
                                                                                                     cancelFrame:  () => {},
                                                                                                     now:          () => performance.now(),
                                                                                                 }),
                                                    renderer:   {clear: () => {}, show: () => {}, update: () => {}},
                                                })
            mode.configure({duration: 10})
            mode.refreshCamera({
                                   sample:   mode.controller.sampler.atProgress(0),
                                   progress: 0,
                                   source:   'playback',
                               })

            expect(flyTo).not.toHaveBeenCalled()
            vi.advanceTimersByTime(3000)
            expect(setView).toHaveBeenCalled()
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('recenters tolerance tracking after a user zoom even when the marker was still inside the zone', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvasListeners = new Map()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    (type, listener) => canvasListeners.set(type, listener),
            removeEventListener: type => canvasListeners.delete(type),
        }
        const flyToCalls = []
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 6,
            positionCartographic: {height: 2600},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 500, y: 500}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            canvasListeners.get('wheel')()
            vi.advanceTimersByTime(130)

            const target = Cartesian3.fromDegrees(2, 48, 120)
            const up = Matrix4.getColumn(Transforms.eastNorthUpToFixedFrame(target), 2, new Cartesian3())
            const verticalComponent = Cartesian3.dot(flyToCalls[0].orientation.direction, up)

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2600)
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBeCloseTo(-30, 6)
            expect(flyToCalls).toHaveLength(1)
            expect(verticalComponent).toBeCloseTo(-0.5, 2)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('projects the marker in viewport coordinates so zoom scale does not desynchronize the overlay', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
            getBoundingClientRect: () => ({left: 300, top: 300, width: 1000, height: 1000}),
        }
        const flyToCalls = []
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            positionCartographic: {height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas,
                camera,
            },
            scene:      {
                canvas,
                worldToWindowCoordinates: () => ({x: 500, y: 500}),
                cartesianToCanvasCoordinates: () => ({x: 990, y: 990}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera()

            expect(flyToCalls).toHaveLength(0)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('recenters tolerance tracking on the rendered ground marker instead of the sample altitude', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            positionCartographic: {height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 990, y: 990}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 20},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera()

            const target = Cartesian3.fromDegrees(2, 48, 20)
            const expectedDirection = Cartesian3.normalize(
                Cartesian3.subtract(target, flyToCalls[0].destination, new Cartesian3()),
                new Cartesian3(),
            )

            expect(flyToCalls).toHaveLength(1)
            expect(flyToCalls[0].orientation.direction.x).toBeCloseTo(expectedDirection.x, 6)
            expect(flyToCalls[0].orientation.direction.y).toBeCloseTo(expectedDirection.y, 6)
            expect(flyToCalls[0].orientation.direction.z).toBeCloseTo(expectedDirection.z, 6)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('cancels an active tolerance recenter before applying a user zoom recenter', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const canvasListeners = new Map()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    (type, listener) => canvasListeners.set(type, listener),
            removeEventListener: type => canvasListeners.delete(type),
        }
        const flyToCalls = []
        let cancelFlightCalls = 0
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            positionCartographic: {height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
                cancelFlightCalls += 1
            },
            flyTo:                options => flyToCalls.push(options),
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 990, y: 990}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera()
            expect(flyToCalls).toHaveLength(1)

            camera.positionCartographic.height = 2600
            canvasListeners.get('wheel')()
            vi.advanceTimersByTime(130)

            expect(cancelFlightCalls).toBeGreaterThan(0)
            expect(flyToCalls).toHaveLength(2)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('keeps an active tolerance recenter while the moving marker remains outside the zone', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        let cancelFlightCalls = 0
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            positionCartographic: {height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
                cancelFlightCalls += 1
            },
            flyTo:                options => flyToCalls.push(options),
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 990, y: 990}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera()
            expect(flyToCalls).toHaveLength(1)

            vi.advanceTimersByTime(360)
            mode.refreshCamera()

            expect(cancelFlightCalls).toBe(1)
            expect(flyToCalls).toHaveLength(1)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('does not restart a fresh tolerance recenter on every progress update while still outside', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        let cancelFlightCalls = 0
        const camera = {
            heading:              0.8,
            pitch:                -Math.PI / 4,
            positionCartographic: {height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
                cancelFlightCalls += 1
            },
            flyTo:                options => flyToCalls.push(options),
            lookAtTransform:      () => {
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 990, y: 990}),
                requestRender:                () => {
                },
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            cancelFlightCalls = 0
            mode.refreshCamera()
            expect(flyToCalls).toHaveLength(1)

            vi.advanceTimersByTime(120)
            mode.seek(0.5)

            expect(cancelFlightCalls).toBe(0)
            expect(flyToCalls).toHaveLength(1)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('recenters with a lateral redirect when the nominal camera view cannot see the marker', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const baseJourneyReplay = defaultJourneyReplaySettings()
        const cameraSettings = normalizeJourneyReplayCamera({
                                                             ...baseJourneyReplay.camera,
                                                             positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
                                                             heading:      0,
                                                             pitch:        -45,
                                                             altitude:     1800,
                                                         })
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        const camera = {
            heading:              0,
            pitch:                -Math.PI / 4,
            roll:                 0,
            positionCartographic: {longitude: 2, latitude: 47.99, height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            setView:              () => {
            },
            lookAtTransform:      () => {
            },
        }
        const sample = {
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
            progress:          0,
            distanceFromStart: 0,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...baseJourneyReplay,
                        camera: cameraSettings,
                        marker: {
                            ...baseJourneyReplay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   cameraSettings,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 990, y: 990}),
                requestRender:                () => {
                },
                globe:                        {
                    getHeight: cartographic => {
                        const longitude = cartographic.longitude * 180 / Math.PI
                        const latitude = cartographic.latitude * 180 / Math.PI
                        if (latitude < 47.9997 && Math.abs(longitude - 2) < 0.0008) {
                            return 10000
                        }
                        return 120
                    },
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera({sample})

            const targetCartesian = Cartesian3.fromDegrees(2, 48, 120)
            const targetTransform = Transforms.eastNorthUpToFixedFrame(targetCartesian)
            const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
            const north = Matrix4.getColumn(targetTransform, 1, new Cartesian3())
            const delta = Cartesian3.subtract(flyToCalls[0].destination, targetCartesian, new Cartesian3())

            expect(flyToCalls).toHaveLength(1)
            expect(Math.abs(Cartesian3.dot(delta, east))).toBeGreaterThan(200)
            expect(Cartesian3.dot(delta, north)).toBeLessThan(0)
            expect(flyToCalls[0].duration).toBeLessThanOrEqual(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })


    it('recenters for visibility even when the marker is still inside the tolerance zone', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const baseJourneyReplay = defaultJourneyReplaySettings()
        const cameraSettings = normalizeJourneyReplayCamera({
                                                             ...baseJourneyReplay.camera,
                                                             positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
                                                             heading:      0,
                                                             pitch:        -45,
                                                             altitude:     1800,
                                                         })
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        const camera = {
            heading:              0,
            pitch:                -Math.PI / 4,
            roll:                 0,
            positionCartographic: {longitude: 2, latitude: 47.99, height: 1800},
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            setView:              () => {
            },
            lookAtTransform:      () => {
            },
        }
        const sample = {
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
            progress:          0,
            distanceFromStart: 0,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...baseJourneyReplay,
                        camera: cameraSettings,
                        marker: {
                            ...baseJourneyReplay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   cameraSettings,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 500, y: 500}),
                requestRender:                () => {
                },
                globe:                        {
                    getHeight: cartographic => {
                        const longitude = cartographic.longitude * 180 / Math.PI
                        const latitude = cartographic.latitude * 180 / Math.PI
                        if (latitude < 47.9997 && Math.abs(longitude - 2) < 0.0008) {
                            return 10000
                        }
                        return 120
                    },
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera({sample})

            const targetCartesian = Cartesian3.fromDegrees(2, 48, 120)
            const targetTransform = Transforms.eastNorthUpToFixedFrame(targetCartesian)
            const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
            const delta = Cartesian3.subtract(flyToCalls[0].destination, targetCartesian, new Cartesian3())

            expect(flyToCalls).toHaveLength(1)
            expect(Math.abs(Cartesian3.dot(delta, east))).toBeGreaterThan(200)
            expect(flyToCalls[0].duration).toBeLessThanOrEqual(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('uses rendered terrain picking to correct a marker hidden behind visible relief', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const baseJourneyReplay = defaultJourneyReplaySettings()
        const cameraSettings = normalizeJourneyReplayCamera({
                                                             ...baseJourneyReplay.camera,
                                                             positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
                                                             heading:      0,
                                                             pitch:        -45,
                                                             altitude:     1800,
                                                         })
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        const cameraPosition = Cartesian3.fromDegrees(2, 47.99, 1800)
        const camera = {
            heading:              0,
            pitch:                -Math.PI / 4,
            roll:                 0,
            position:             cameraPosition,
            positionWC:           cameraPosition,
            positionCartographic: {longitude: 2, latitude: 47.99, height: 1800},
            getPickRay:           () => ({}),
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            setView:              () => {
            },
            lookAtTransform:      () => {
            },
        }
        const sample = {
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
            progress:          0,
            distanceFromStart: 0,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...baseJourneyReplay,
                        camera: cameraSettings,
                        marker: {
                            ...baseJourneyReplay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   cameraSettings,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 500, y: 500}),
                requestRender:                () => {
                },
                globe:                        {
                    getHeight: () => 120,
                    pick:      () => Cartesian3.fromDegrees(2, 47.995, 120),
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera({sample})

            expect(flyToCalls).toHaveLength(1)
            expect(flyToCalls[0].duration).toBeLessThanOrEqual(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('uses rendered depth picking to correct a marker hidden by 3D tiles', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const baseJourneyReplay = defaultJourneyReplaySettings()
        const cameraSettings = normalizeJourneyReplayCamera({
                                                             ...baseJourneyReplay.camera,
                                                             positionMode: REPLAY_CAMERA_POSITION_SYSTEM,
                                                             heading:      0,
                                                             pitch:        -45,
                                                             altitude:     1800,
                                                         })
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {
            },
            removeEventListener: () => {
            },
        }
        const flyToCalls = []
        const cameraPosition = Cartesian3.fromDegrees(2, 47.99, 1800)
        const camera = {
            heading:              0,
            pitch:                -Math.PI / 4,
            roll:                 0,
            position:             cameraPosition,
            positionWC:           cameraPosition,
            positionCartographic: {longitude: 2, latitude: 47.99, height: 1800},
            getPickRay:           () => ({}),
            moveStart:            {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            moveEnd:              {
                addEventListener:       () => {
                }, removeEventListener: () => {
                },
            },
            cancelFlight:         () => {
            },
            flyTo:                options => flyToCalls.push(options),
            setView:              () => {
            },
            lookAtTransform:      () => {
            },
        }
        const sample = {
            longitude:         2,
            latitude:          48,
            altitude:          120,
            height:            120,
            progress:          0,
            distanceFromStart: 0,
        }
        let pickPositionCalls = 0
        let globePickCalls = 0

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     appCanvas,
            settings:   {
                ui: {
                    replay: {
                        ...baseJourneyReplay,
                        camera: cameraSettings,
                        marker: {
                            ...baseJourneyReplay.marker,
                            mode: REPLAY_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   cameraSettings,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        appCanvas,
                camera,
            },
            scene:      {
                canvas:                       appCanvas,
                cartesianToCanvasCoordinates: () => ({x: 500, y: 500}),
                pickPositionSupported:        true,
                pickPosition:                 () => {
                    pickPositionCalls += 1
                    return Cartesian3.fromDegrees(2, 47.995, 120)
                },
                requestRender:                () => {
                },
                globe:                        {
                    getHeight: () => 120,
                    pick:      () => {
                        globePickCalls += 1
                        return Cartesian3.fromDegrees(2, 48, 120)
                    },
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: () => 1,
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => 0,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: () => {
                                                    },
                                                },
                                            })
            mode.configure()
            mode.refreshCamera({sample})

            expect(pickPositionCalls).toBeGreaterThan(0)
            expect(globePickCalls).toBe(0)
            expect(flyToCalls).toHaveLength(1)
            expect(flyToCalls[0].duration).toBeLessThanOrEqual(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

})
