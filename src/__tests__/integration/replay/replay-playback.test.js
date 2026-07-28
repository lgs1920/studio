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
import { JSDOM }                                                       from 'jsdom'
import { applyGpxStyleExtensionProperties, extractLgsTrackProperties } from '@Utils/JourneyGpxUtils'
import { Cartesian3, Cartographic, Matrix4, Math as CesiumMath, Transforms } from 'cesium'
import { proxy }                                                       from 'valtio'
import { describe, expect, it, vi }                                    from 'vitest'

if (typeof globalThis.document === 'undefined') {
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.DOMParser = dom.window.DOMParser
    globalThis.HTMLElement = dom.window.HTMLElement
    globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement
    globalThis.CustomEvent = dom.window.CustomEvent
    globalThis.Node = dom.window.Node
}

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))


import {makeJourney, makeTrack} from '../../unit/replay/replay-phase1-fixtures'

describe('replay phase 1 playback controller', () => {
    it('advances from elapsed time rather than point count', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const frames = []
        let now = 0
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame: () => {},
            now:         () => now,
        })
        const updates = []

        controller.on(REPLAY_EVENT_UPDATE, detail => updates.push(detail.sample))
        controller.configure({sampler, duration: 10})
        controller.start()

        now = 5000
        frames.shift()()

        expect(controller.progress).toBeCloseTo(0.5, 4)
        expect(updates.at(-1).longitude).toBeCloseTo(0.001, 5)
    })

    it('publishes the shared frame contract fields in the live dynamic frame state', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const previousLgs = globalThis.lgs
        const frames = []

        globalThis.lgs = {
            events: {
                emit: () => {},
            },
            scene: {
                requestRender: () => {},
            },
            stores: {
                replay: proxy({
                    active:         false,
                    playing:        false,
                    paused:         false,
                    progress:       0,
                    elapsedMillis:   null,
                    durationMillis:  null,
                    sample:         null,
                    totalDistance:  0,
                    captureFps:     30,
                }),
            },
        }

        try {
            const controller = new JourneyReplayPlaybackController({
                requestFrame: callback => {
                    frames.push(callback)
                    return frames.length
                },
                cancelFrame: () => {},
                now:         () => 0,
            })

            controller.configure({sampler, duration: 10})
            controller.start()

            expect(globalThis.lgs.stores.replay.dynamicFrameState).toEqual(expect.objectContaining({
                active:          true,
                playing:         true,
                paused:          false,
                index:           0,
                frameIndex:      0,
                frameCount:      301,
                replayFrameIndex: 0,
                replayFrameCount: 301,
                frameTimeMs:     0,
                frameIntervalMs: 1000 / 30,
                source:          'controller',
                renderContract: expect.objectContaining({
                    renderMode: 'draft',
                    logicalFrame: expect.objectContaining({progress: 0}),
                    scheduling: {realtime: true, frameByFrame: false},
                }),
            }))
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('pauses and resumes without counting paused time', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const frames = []
        let now = 0
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame: () => {},
            now:         () => now,
        })

        controller.configure({sampler, duration: 10})
        controller.start()

        now = 4000
        frames.shift()()
        controller.pause()

        now = 9000
        controller.resume()
        now = 10000
        frames.shift()()

        expect(controller.progress).toBeCloseTo(0.5, 4)
    })

    it('applies loop changes while playback is running', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const frames = []
        const ends = []
        let now = 0
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame: () => {},
            now:         () => now,
        })

        controller.on(REPLAY_EVENT_END, detail => ends.push(detail))
        controller.configure({sampler, duration: 10, loop: true})
        controller.start()

        controller.setLoop(false)
        now = 10000
        frames.shift()()

        expect(controller.loop).toBe(false)
        expect(controller.running).toBe(false)
        expect(controller.progress).toBeCloseTo(1, 4)
        expect(ends).toHaveLength(1)
    })

    it('does not repopulate runtime progress after the end listener resets it', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.001, 0, 0]],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const previousLgs = globalThis.lgs
        const frames = []
        let now = 0

        globalThis.lgs = {
            events: {emit: () => {}},
            scene:  {requestRender: () => {}},
            stores: {
                replay: proxy({
                                      active: false,
                                      playing: false,
                                      paused: false,
                                      progress: 0,
                                      elapsedMillis: null,
                                      durationMillis: null,
                                      sample: null,
                                      totalDistance: 0,
                                  }),
            },
        }

        try {
            const controller = new JourneyReplayPlaybackController({
                requestFrame: callback => {
                    frames.push(callback)
                    return frames.length
                },
                cancelFrame: () => {},
                now:         () => now,
            })

            controller.on(REPLAY_EVENT_END, () => {
                const store = globalThis.lgs.stores.replay
                store.progress = 0
                store.elapsedMillis = null
                store.durationMillis = null
                store.sample = null
                store.totalDistance = 0
            })

            controller.configure({sampler, duration: 10})
            controller.start()

            now = 10000
            frames.shift()()

            expect(globalThis.lgs.stores.replay.progress).toBe(0)
            expect(globalThis.lgs.stores.replay.elapsedMillis).toBeNull()
            expect(globalThis.lgs.stores.replay.durationMillis).toBeNull()
            expect(globalThis.lgs.stores.replay.sample).toBeNull()
            expect(globalThis.lgs.stores.replay.totalDistance).toBe(0)
    }
    finally {
            globalThis.lgs = previousLgs
        }
    })

    it('syncs serializable samples into the Valtio replay runtime store', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const previousLgs = globalThis.lgs

        globalThis.lgs = {
            events: {emit: () => {}},
            scene:  {requestRender: () => {}},
            stores: {
                replay: proxy({
                                      active: false,
                                      playing: false,
                                      paused: false,
                                      progress: 0,
                                      elapsedMillis: null,
                                      durationMillis: null,
                                      sample: null,
                                  }),
            },
        }

        try {
            const controller = new JourneyReplayPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            })

            expect(() => controller.configure({sampler, duration: 10})).not.toThrow()
            expect(() => controller.start()).not.toThrow()
            expect(() => controller.seek(0.5)).not.toThrow()
            expect(globalThis.lgs.stores.replay.elapsedMillis).toBe(10 * 60 * 1000)
            expect(globalThis.lgs.stores.replay.durationMillis).toBe(20 * 60 * 1000)
            expect(() => JSON.stringify(globalThis.lgs.stores.replay.sample)).not.toThrow()
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('starts replay for styled GPX tracks with duplicate points', () => {
        const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Visorando" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Duplicate point styled track</name>
    <extensions>
      <line xmlns="http://www.topografix.com/GPX/gpx_style/0/2">
        <color>0000FF</color>
        <width>4</width>
      </line>
    </extensions>
    <trkseg>
      <trkpt lat="45.1" lon="6.1"><ele>100</ele><time>2026-05-05T10:00:00.000Z</time></trkpt>
      <trkpt lat="45.1" lon="6.1"><ele>100</ele><time>2026-05-05T10:01:00.000Z</time></trkpt>
      <trkpt lat="45.2" lon="6.2"><ele>120</ele><time>2026-05-05T10:10:00.000Z</time></trkpt>
      <trkpt lat="45.3" lon="6.3"><ele>140</ele><time>2026-05-05T10:20:00.000Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
        const document = new DOMParser().parseFromString(gpxContent, 'text/xml')
        const geoJson = gpx(document)
        applyGpxStyleExtensionProperties(geoJson, document)
        const feature = geoJson.features.find(item => item.geometry?.type === 'LineString')
        const trackMetadata = extractLgsTrackProperties(feature.properties)
        const track = {
            slug:        'track#journey#gpx#duplicate-styled',
            visible:     true,
            renderStyle: trackMetadata.renderStyle,
            content:     feature,
        }
        const journey = makeJourney([track])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        replay.camera = {
            ...replay.camera,
            positionMode: REPLAY_CAMERA_POSITION_AHEAD,
        }
        const renderer = {
            clear:  vi.fn(),
            show:   vi.fn(),
            update: vi.fn(),
        }

        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }
        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0,
                    pitch:                -Math.PI / 4,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 1800},
                    moveStart:            {
                        addEventListener:    () => {
                        },
                        removeEventListener: () => {
                        },
                    },
                    moveEnd:              {
                        addEventListener:    () => {
                        },
                        removeEventListener: () => {
                        },
                    },
                    changed:              {
                        addEventListener:    () => {
                        },
                        removeEventListener: () => {
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
                canvas:                       {
                    getBoundingClientRect: () => ({
                        left:   0,
                        top:    0,
                        width:  1000,
                        height: 800,
                    }),
                },
                requestRender:                () => {
                },
                cartesianToCanvasCoordinates: () => ({x: 500, y: 400}),
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
                                                renderer,
                                            })
            let result = null

            expect(() => {
                result = mode.start({duration: 1})
            }).not.toThrow()

            expect(trackMetadata.renderStyle.widthUnit).toBe('pixels')
            expect(result).toEqual(expect.objectContaining({longitude: 6.1, latitude: 45.1}))
            expect(globalThis.lgs.stores.replay.sample).toEqual(expect.objectContaining({
                                                                                                longitude: 6.1,
                                                                                                latitude:  45.1,
                                                                                            }))
            expect(globalThis.lgs.stores.replay.playing).toBe(true)
            expect(renderer.show).toHaveBeenCalledTimes(1)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('keeps store publication cadence while video-safe mode is enabled', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const previousLgs = globalThis.lgs
        const frames = []
        let now = 0

        globalThis.lgs = {
            events: {emit: () => {}},
            scene:  {requestRender: () => {}},
            stores: {
                replay: proxy({
                                      active: false,
                                      playing: false,
                                      paused: false,
                                      progress: 0,
                                      elapsedMillis: null,
                                      durationMillis: null,
                                      sample: null,
                                      totalDistance: 0,
                                  }),
            },
        }

        try {
            const controller = new JourneyReplayPlaybackController({
                requestFrame: callback => {
                    frames.push(callback)
                    return frames.length
                },
                cancelFrame: () => {},
                now:         () => now,
            })

            controller.setVideoSafeMode(true)
            controller.configure({sampler, duration: 10})
            controller.start()

            now = 100
            frames.shift()()
            expect(globalThis.lgs.stores.replay.progress).toBe(0)
            expect(controller.progress).toBeGreaterThan(0)

            now = 300
            frames.shift()()
            expect(globalThis.lgs.stores.replay.progress).toBeGreaterThan(0)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('syncs the live Cesium camera into runtime and persisted replay camera settings', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
        ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const stopRotate = vi.fn(async () => undefined)

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    positionCartographic: {height: 1840},
                    pitch:                -Math.PI / 4,
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
            globalThis.__ = {
                ui: {
                    cameraManager: {
                        stopRotate,
                    },
                },
            }
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

            const camera = mode.syncCameraFromCesiumControls()

            expect(camera.altitude).toBe(1840)
            expect(camera.pitch).toBeCloseTo(-45, 6)
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1840)
            expect(globalThis.lgs.stores.replay.camera.pitch).toBeCloseTo(-45, 6)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('does not rewrite replay camera settings from the live Cesium view when playback starts', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const stopRotate = vi.fn(async () => undefined)

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
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
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate,
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
            expect(stopRotate).toHaveBeenCalledTimes(1)

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(replay.camera.altitude)
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(replay.camera.pitch)
            expect(globalThis.lgs.settings.ui.replay.camera.heading).toBe(replay.camera.heading)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })


    it('restores the playback start camera settings after a replay without camera user action', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        replay.camera = {
            ...replay.camera,
            altitude: 1350,
            pitch:    -62,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 2400},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller: new JourneyReplayPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            globalThis.lgs.settings.ui.replay.camera = {
                ...globalThis.lgs.settings.ui.replay.camera,
                altitude: 9800,
                pitch:    -20,
            }
            globalThis.lgs.stores.replay.camera = globalThis.lgs.settings.ui.replay.camera

            mode.stop({emit: false})

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(1350)
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(-62)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(1350)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('keeps camera settings changed by a user camera action during playback', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        replay.camera = {
            ...replay.camera,
            altitude: 1350,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 2400},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller: new JourneyReplayPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            globalThis.lgs.settings.ui.replay.camera = {
                ...globalThis.lgs.settings.ui.replay.camera,
                altitude: 9800,
            }
            globalThis.lgs.stores.replay.camera = globalThis.lgs.settings.ui.replay.camera
            globalThis.lgs.stores.replay.cameraUserAdjusted = true

            mode.stop({emit: false})

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(9800)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(9800)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('restores the starting ground offset after playback even if the runtime changed it', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        replay.camera = {
            ...replay.camera,
            altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
            altitude:     2000,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 4300},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 2300},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller: new JourneyReplayPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            globalThis.lgs.settings.ui.replay.camera = {
                ...globalThis.lgs.settings.ui.replay.camera,
                altitude: 4300,
            }
            globalThis.lgs.stores.replay.camera = globalThis.lgs.settings.ui.replay.camera
            globalThis.lgs.stores.replay.cameraUserAdjusted = true

            mode.stop({emit: false})

            expect(globalThis.lgs.settings.ui.replay.camera.altitudeMode).toBe(REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET)
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2000)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(2000)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('restores the starting ground offset after the natural end even if the final focus rewrites it', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        replay.camera = {
            ...replay.camera,
            altitudeMode: REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
            altitude:     2000,
        }

        journey.focus = vi.fn(({callback} = {}) => {
            const camera = {
                ...globalThis.lgs.settings.ui.replay.camera,
                altitude: 4300,
            }
            globalThis.lgs.settings.ui.replay.camera = camera
            globalThis.lgs.stores.replay.camera = camera
            callback?.()
            return Promise.resolve()
        })

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 4300},
                    moveStart:            {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    moveEnd:              {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 2300},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        try {
            const listeners = new Map()
            const controller = {
                configure: vi.fn(),
                on:        (event, handler) => {
                    listeners.set(event, handler)
                    return () => listeners.delete(event)
                },
                start: vi.fn(() => replay.camera),
                stop:  vi.fn(() => replay.camera),
            }

            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            listeners.get(REPLAY_EVENT_END)?.({
                controller,
                sampler: {
                    atProgress: () => ({longitude: 2.001, latitude: 48.001, altitude: 130}),
                },
                sample:   {longitude: 2.001, latitude: 48.001, altitude: 130},
                progress: 1,
            })

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(journey.focus).toHaveBeenCalled()
            expect(globalThis.lgs.settings.ui.replay.camera.altitudeMode).toBe(REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET)
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2000)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(2000)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('restores the starting fixed altitude after the natural end even if the final focus rewrites it', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        replay.camera = {
            ...replay.camera,
            altitudeMode: REPLAY_CAMERA_ALTITUDE_CONSTANT,
            altitude:     2400,
        }

        journey.focus = vi.fn(({callback} = {}) => {
            const camera = {
                ...globalThis.lgs.settings.ui.replay.camera,
                altitude: 4300,
            }
            globalThis.lgs.settings.ui.replay.camera = camera
            globalThis.lgs.stores.replay.camera = camera
            callback?.()
            return Promise.resolve()
        })

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 4300},
                    moveStart:            {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    moveEnd:              {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 2300},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        try {
            const listeners = new Map()
            const controller = {
                configure: vi.fn(),
                on:        (event, handler) => {
                    listeners.set(event, handler)
                    return () => listeners.delete(event)
                },
                start: vi.fn(() => replay.camera),
                stop:  vi.fn(() => replay.camera),
            }

            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            listeners.get(REPLAY_EVENT_END)?.({
                controller,
                sampler: {
                    atProgress: () => ({longitude: 2.001, latitude: 48.001, altitude: 130}),
                },
                sample:   {longitude: 2.001, latitude: 48.001, altitude: 130},
                progress: 1,
            })

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(journey.focus).toHaveBeenCalled()
            expect(globalThis.lgs.settings.ui.replay.camera.altitudeMode).toBe(REPLAY_CAMERA_ALTITUDE_CONSTANT)
            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2400)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(2400)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('restores the playback camera baseline on stop when it was not user-adjusted', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        replay.camera = {
            ...replay.camera,
            altitude: 2400,
            heading:  40,
            pitch:    -22,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 2400},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller: new JourneyReplayPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            globalThis.lgs.settings.ui.replay.camera = {
                ...globalThis.lgs.settings.ui.replay.camera,
                altitude: 9800,
                heading:  -75,
                pitch:    -31,
            }
            globalThis.lgs.stores.replay.camera = globalThis.lgs.settings.ui.replay.camera

            mode.stop({emit: false})

            expect(globalThis.lgs.settings.ui.replay.camera.altitude).toBe(2400)
            expect(globalThis.lgs.settings.ui.replay.camera.heading).toBe(40)
            expect(globalThis.lgs.settings.ui.replay.camera.pitch).toBe(-22)
            expect(globalThis.lgs.stores.replay.camera.altitude).toBe(2400)
            expect(globalThis.lgs.stores.replay.camera.heading).toBe(40)
            expect(globalThis.lgs.stores.replay.camera.pitch).toBe(-22)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('closes the replay drawer on start and reopens it after stop clips complete', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const drawerManager = {
            isCurrent: vi.fn(() => true),
            close:     vi.fn(() => {
                globalThis.lgs.stores.ui.drawers.open = null
            }),
            open:      vi.fn((drawerId) => {
                globalThis.lgs.stores.ui.drawers.open = drawerId
            }),
        }
        const listeners = new Map()
        let sampler = null
        const controller = {
            progress: 0,
            running:  false,
            playing:  false,
            paused:   false,
            configure: vi.fn(options => {
                sampler = options.sampler
                return controller
            }),
            on: (event, callback) => {
                listeners.set(event, callback)
                return () => listeners.delete(event)
            },
            start: vi.fn(({progress = 0} = {}) => {
                controller.progress = progress
                controller.running = true
                controller.playing = true
                const sample = sampler.atProgress(progress)
                listeners.get(REPLAY_EVENT_START)?.({
                    controller,
                    sampler,
                    sample,
                    progress,
                })
                return sample
            }),
            stop: vi.fn(() => sampler?.atProgress?.(controller.progress) ?? null),
            currentSample: () => sampler?.atProgress?.(controller.progress) ?? null,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                ui: proxy({drawers: proxy({open: REPLAY_DRAWER})}),
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 2400},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
                drawerManager,
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            expect(drawerManager.close).toHaveBeenCalled()
            expect(globalThis.lgs.stores.ui.drawers.open).toBe(null)

            listeners.get(REPLAY_EVENT_END)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(1),
                progress: 1,
            })

            expect(drawerManager.open).toHaveBeenCalledWith(REPLAY_DRAWER)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('keeps replay-hidden POIs hidden when the current journey is hidden for playback', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const poiVisible = {id: 'poi-visible', visible: true, replay: {visible: true}}
        const poiHidden = {id: 'poi-hidden', visible: true, replay: {visible: false}}
        const poiGlobalHidden = {id: 'poi-global-hidden', visible: false, replay: {visible: true}}
        const poiGlobalJourneyReplayHidden = {id: 'poi-global-ft-hidden', visible: true, replay: {visible: false}}
        const poiList = new Map([
            [poiVisible.id, poiVisible],
            [poiHidden.id, poiHidden],
            [poiGlobalHidden.id, poiGlobalHidden],
            [poiGlobalJourneyReplayHidden.id, poiGlobalJourneyReplayHidden],
        ])
        const poiVisibleEntity = {id: 'poi-visible', billboard: {}, show: true}
        const poiHiddenEntity = {id: 'poi-hidden', billboard: {}, show: true}
        const poiGlobalHiddenEntity = {id: 'poi-global-hidden', billboard: {}, show: true}
        const poiGlobalJourneyReplayHiddenEntity = {id: 'poi-global-ft-hidden', billboard: {}, show: true}
        const polylineEntity = {id: 'track-line', polyline: {show: true}}
        const source = {
            name:     journey.slug,
            show:     true,
            entities: {
                values:  [poiVisibleEntity, poiHiddenEntity, polylineEntity],
                getById: id => ({
                    'poi-visible': poiVisibleEntity,
                    'poi-hidden':  poiHiddenEntity,
                    'track-line':   polylineEntity,
                }[id] ?? null),
            },
        }
        journey.updateVisibility = vi.fn(visible => {
            source.show = visible
            poiVisibleEntity.show = visible
            poiHiddenEntity.show = visible
            polylineEntity.polyline.show = visible
        })

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                main:       {
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                },
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                entities:      {
                    getById: id => ({
                        'poi-global-hidden':    poiGlobalHiddenEntity,
                        'poi-global-ft-hidden': poiGlobalJourneyReplayHiddenEntity,
                    }[id] ?? null),
                },
                dataSources:   {
                    length:    1,
                    get:       () => source,
                    getByName: name => name === journey.slug ? [source] : [],
                },
                camera:        {
                    heading:              0,
                    pitch:                -Math.PI / 4,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 1500},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
                poiManager: {
                    get: id => poiList.get(id),
                    list: poiList,
                    getJourneyReplayPOIsForJourney: () => [],
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller: new JourneyReplayPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            await Promise.resolve()
            await Promise.resolve()

            expect(source.show).toBe(true)
            expect(poiVisibleEntity.show).toBe(true)
            expect(poiHiddenEntity.show).toBe(false)
            expect(poiGlobalHiddenEntity.show).toBe(false)
            expect(poiGlobalJourneyReplayHiddenEntity.show).toBe(false)
            expect(polylineEntity.polyline.show).toBe(false)
        }
        finally {
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

    it('restores only initially visible replay-hidden POIs after stop clips complete', async () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const focusDefinition = {
            id:           'focus',
            label:        'Focus',
            slots:        ['stop'],
            maxInstances: 1,
            defaults:     {
                duration: 2,
            },
            fields:       [{
                key:     'duration',
                label:   'Duration',
                type:    'number',
                min:     0,
                max:     60,
                step:    0.1,
                default: 2,
            }],
        }
        const focusClip = createJourneyReplayClipInstance(focusDefinition, 'stop', {
            params: {
                duration: 2,
            },
        })
        const clips = {
            catalog: {
                focus: focusDefinition,
            },
            start: [],
            stop:  [focusClip],
        }
        const poiRestored = {id: 'poi-restore', visible: true, replay: {visible: false}}
        const poiStillHidden = {id: 'poi-still-hidden', visible: false, replay: {visible: false}}
        const poiList = new Map([
            [poiRestored.id, poiRestored],
            [poiStillHidden.id, poiStillHidden],
        ])
        const poiRestoredEntity = {id: 'poi-restore', billboard: {}, show: true}
        const poiStillHiddenEntity = {id: 'poi-still-hidden', billboard: {}, show: true}
        const source = {
            name:     journey.slug,
            show:     true,
            entities: {
                values:  [poiRestoredEntity],
                getById: id => id === 'poi-restore' ? poiRestoredEntity : null,
            },
        }
        let resolveFocus = null
        const focusPromise = new Promise(resolve => {
            resolveFocus = resolve
        })
        let focusCallCount = 0
        journey.focus = vi.fn(() => {
            focusCallCount += 1
            source.show = true
            poiRestoredEntity.show = true
            poiRestoredEntity.billboard.show = true
            poiStillHiddenEntity.show = true
            poiStillHiddenEntity.billboard.show = true
            return focusCallCount === 1 ? Promise.resolve() : focusPromise
        })
        const listeners = new Map()
        let sampler = null
        const controller = {
            progress:      0,
            running:       false,
            playing:       false,
            paused:        false,
            configure:     vi.fn(options => {
                sampler = options.sampler
                return controller
            }),
            on:            (event, callback) => {
                listeners.set(event, callback)
                return () => listeners.delete(event)
            },
            start:         vi.fn(({progress = 0} = {}) => {
                controller.progress = progress
                controller.running = true
                controller.playing = true
                const sample = sampler.atProgress(progress)
                listeners.get(REPLAY_EVENT_START)?.({
                    controller,
                    sampler,
                    sample,
                    progress,
                })
                return sample
            }),
            stop:          vi.fn(() => sampler?.atProgress?.(controller.progress) ?? null),
            currentSample: () => sampler?.atProgress?.(controller.progress) ?? null,
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        clips,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                main:       {
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                },
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                entities:      {
                    getById: id => id === 'poi-still-hidden' ? poiStillHiddenEntity : null,
                },
                dataSources:   {
                    length:    1,
                    get:       () => source,
                    getByName: name => name === journey.slug ? [source] : [],
                },
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 2400},
                    moveStart:            {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    moveEnd:              {
                        addEventListener:       () => {},
                        removeEventListener:    () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
            },
        }
        globalThis.__ = {
            ui: {
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
                poiManager: {
                    get: id => poiList.get(id),
                    list: poiList,
                    getJourneyReplayPOIsForJourney: () => [
                        {poi: {id: 'poi-restore'}, projectedAbscissa: 10},
                        {poi: {id: 'poi-still-hidden'}, projectedAbscissa: 20},
                    ],
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  () => {},
                    show:   () => {},
                    update: () => {},
                },
            })

            mode.start()
            await Promise.resolve()
            await Promise.resolve()

            expect(poiRestoredEntity.show).toBe(false)
            expect(poiRestoredEntity.billboard.show).toBe(false)
            expect(poiStillHiddenEntity.show).toBe(false)
            expect(poiStillHiddenEntity.billboard.show).toBe(false)

            listeners.get(REPLAY_EVENT_END)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(1),
                progress: 1,
            })
            await Promise.resolve()

            expect(poiRestoredEntity.show).toBe(false)
            expect(poiStillHiddenEntity.show).toBe(false)

            await vi.advanceTimersByTimeAsync(2000)

            expect(journey.focus).toHaveBeenCalled()

            resolveFocus()
            await Promise.resolve()

            await Promise.resolve()
            await Promise.resolve()

            expect(poiRestoredEntity.show).toBe(true)
            expect(poiStillHiddenEntity.show).toBe(false)
        }
        finally {
            vi.useRealTimers()
            globalThis.__ = previousDoubleUnderscore
            globalThis.lgs = previousLgs
        }
    })

})
