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
    replayIsWindowPointOutsideToleranceZone, JourneyReplayMode, replayTargetSampleForClip,
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

const makeTrack = ({
                       slug,
                       visible = true,
                       coordinates,
                       type = 'LineString',
                       times,
                       metrics,
                   }) => ({
    slug,
    visible,
    hasTime: Boolean(times),
    metrics: metrics ?? {},
    content: {
        type:       'Feature',
        properties: times ? {
            coordinateProperties: {times},
        } : {},
        geometry:   {
            type,
            coordinates,
        },
    },
})

const makeJourney = tracks => ({
    slug:   'journey#gpx',
    tracks: new Map(tracks.map(track => [track.slug, track])),
})

describe('replay phase 1 sampler', () => {
    it('samples a GPX track that defines a line style width extension', () => {
        const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Visorando" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Styled track</name>
    <extensions>
      <line xmlns="http://www.topografix.com/GPX/gpx_style/0/2">
        <color>0000FF</color>
        <width>4</width>
      </line>
    </extensions>
    <trkseg>
      <trkpt lat="45.1" lon="6.1"><ele>100</ele><time>2026-05-05T10:00:00.000Z</time></trkpt>
      <trkpt lat="45.2" lon="6.2"><ele>120</ele><time>2026-05-05T10:10:00.000Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
        const document = new DOMParser().parseFromString(gpxContent, 'text/xml')
        const geoJson = gpx(document)
        applyGpxStyleExtensionProperties(geoJson, document)
        const feature = geoJson.features.find(item => item.geometry?.type === 'LineString')
        const trackMetadata = extractLgsTrackProperties(feature.properties)
        const track = {
            slug:        'track#journey#gpx#styled',
            visible:     true,
            renderStyle: trackMetadata.renderStyle,
            content:     feature,
        }
        const journey = makeJourney([track])

        const sampler = new JourneyReplayPathSampler({journey})

        expect(trackMetadata.renderStyle.widthUnit).toBe('pixels')
        expect(sampler.hasSamples).toBe(true)
        expect(sampler.samples).toHaveLength(2)
        expect(sampler.totalDistance).toBeGreaterThan(0)
        expect(sampler.durationMillis).toBe(10 * 60 * 1000)
    })

    it('samples a line by cumulative distance and includes the real first point', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [
                    [0, 0, 100],
                    [0.001, 0, 120],
                    [0.002, 0, 140],
                ],
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey})

        expect(sampler.samples).toHaveLength(3)
        expect(sampler.atProgress(0).longitude).toBe(0)
        expect(sampler.atProgress(0).altitude).toBe(100)
        expect(sampler.atProgress(1).longitude).toBe(0.002)
        expect(sampler.atProgress(1).remainingDistance).toBe(0)

        const middle = sampler.atProgress(0.5)
        expect(middle.longitude).toBeCloseTo(0.001, 5)
        expect(middle.altitude).toBeCloseTo(120, 1)
        expect(middle.distanceFromStart).toBeCloseTo(sampler.totalDistance / 2, 4)
        expect(() => JSON.stringify(middle)).not.toThrow()
        expect(middle.source.startPoint.source).toBeUndefined()
    })

    it('keeps track segments separated while using a global distance timeline', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#one',
                coordinates: [
                    [0, 0, 100],
                    [0.001, 0, 100],
                ],
            }),
            makeTrack({
                slug:        'track#journey#gpx#two',
                coordinates: [
                    [1, 1, 200],
                    [1.001, 1, 200],
                ],
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey, scope: REPLAY_SCOPE_ALL_TRACKS})
        const completed = sampler.completedSegmentsAt(0.75)

        expect(completed).toHaveLength(2)
        expect(completed[0].trackSlug).toBe('track#journey#gpx#one')
        expect(completed[0].coordinates).toHaveLength(2)
        expect(completed[1].trackSlug).toBe('track#journey#gpx#two')
        expect(completed[1].coordinates.at(-1)[0]).toBeGreaterThan(1)
        expect(completed[1].coordinates.at(-1)[0]).toBeLessThan(1.001)
    })

    it('returns only the not-yet-covered coordinates for remaining track rendering', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.002, 0, 0],
                ],
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey})
        const remaining = sampler.remainingSegmentsAt(0.5)

        expect(remaining).toHaveLength(1)
        expect(remaining[0].coordinates[0][0]).toBeCloseTo(0.001, 5)
        expect(remaining[0].coordinates.at(-1)[0]).toBeCloseTo(0.002, 5)
    })

    it('interpolates journey time on replay samples', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#timed',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.002, 0, 0],
                ],
                times: [
                    '2026-05-05T10:00:00.000Z',
                    '2026-05-05T10:10:00.000Z',
                    '2026-05-05T10:20:00.000Z',
                ],
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey})
        const middle = sampler.atProgress(0.5)

        expect(sampler.durationMillis).toBe(20 * 60 * 1000)
        expect(middle.time).toBe('2026-05-05T10:10:00.000Z')
        expect(middle.journeyElapsedMillis).toBe(10 * 60 * 1000)
        expect(middle.journeyDurationMillis).toBe(20 * 60 * 1000)
    })

    it('falls back to metric point times when coordinate times are missing', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#metric-time',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.002, 0, 0],
                ],
                metrics: {
                    points: [
                        {
                            longitude: 0.001,
                            latitude:  0,
                            altitude:  0,
                            distance:  100,
                            duration:  600,
                            time:      '2026-05-05T10:10:00.000Z',
                        },
                        {
                            longitude: 0.002,
                            latitude:  0,
                            altitude:  0,
                            distance:  100,
                            duration:  600,
                            time:      '2026-05-05T10:20:00.000Z',
                        },
                    ],
                },
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey})

        expect(sampler.durationMillis).toBe(20 * 60 * 1000)
        expect(sampler.atProgress(0.5).journeyElapsedMillis).toBe(10 * 60 * 1000)
    })

    it('filters visible and current tracks according to scope', () => {
        const visible = makeTrack({
            slug:        'track#journey#gpx#visible',
            coordinates: [[0, 0, 0], [0.001, 0, 0]],
        })
        const hidden = makeTrack({
            slug:        'track#journey#gpx#hidden',
            visible:     false,
            coordinates: [[1, 1, 0], [1.001, 1, 0]],
        })
        const journey = makeJourney([visible, hidden])

        expect(new JourneyReplayPathSampler({journey, scope: REPLAY_SCOPE_VISIBLE_TRACKS}).samples[0].trackSlug)
            .toBe(visible.slug)
        expect(new JourneyReplayPathSampler({
            journey,
            scope: REPLAY_SCOPE_CURRENT_TRACK,
            trackSlug: hidden.slug,
        }).samples[0].trackSlug).toBe(hidden.slug)
    })
})

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
        journey.focus = vi.fn(() => {
            source.show = true
            poiRestoredEntity.show = true
            poiRestoredEntity.billboard.show = true
            poiStillHiddenEntity.show = true
            poiStillHiddenEntity.billboard.show = true
            return focusPromise
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

            resolveFocus()
            await Promise.resolve()

            await vi.advanceTimersByTimeAsync(2000)
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
            expect(Number.parseFloat(overlay.style.left)).toBeCloseTo(85, 6)
            expect(Number.parseFloat(overlay.style.top)).toBeCloseTo(80, 6)
            expect(Number.parseFloat(overlay.style.width)).toBeCloseTo(850, 6)
            expect(Number.parseFloat(overlay.style.height)).toBeCloseTo(680, 6)
            expect(overlay.style.background).toContain('rgba(255, 0, 0')
            expect(overlay.firstElementChild?.className).toBe('replay-tolerance-zone-overlay-outer')
            expect(overlay.firstElementChild?.dataset.zone).toBe('z1')
            expect(overlay.lastElementChild?.className).toBe('replay-tolerance-zone-overlay-inner')
            expect(overlay.lastElementChild?.dataset.zone).toBe('z2')
            expect(overlay.lastElementChild?.style.border).toContain('dashed')
            expect(Number.parseFloat(overlay.lastElementChild.style.left)).toBeCloseTo(32.35294, 5)
            expect(Number.parseFloat(overlay.lastElementChild.style.width)).toBeCloseTo(35.29412, 5)

            mode.stop({emit: false})
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
            expect(Number.parseFloat(overlay.style.left)).toBeCloseTo(195, 6)
            expect(Number.parseFloat(overlay.style.top)).toBeCloseTo(120, 6)
            expect(Number.parseFloat(overlay.style.width)).toBeCloseTo(850, 6)
            expect(Number.parseFloat(overlay.style.height)).toBeCloseTo(680, 6)

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
        }
        finally {
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

    it('recenters on the current journey when stopping an active replay', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        journey.focus = vi.fn()
        journey.persistToDatabase = vi.fn(() => Promise.resolve())
        journey.visible = false
        const editorJourney = {visible: false}
        let cancelFlightCalls = 0

        globalThis.lgs = {
            theJourney: journey,
            theJourneyEditorProxy: {journey: editorJourney},
            theTrack:   null,
            settings:   {ui: {replay, journeyToolbar: {show: true}}},
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      orbitAllowed: true,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
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
                    lookAtTransform:      () => {
                    },
                    setView:              () => {
                    },
                },
            },
            scene:      {
                requestRender: () => {
                }, globe:      {getHeight: () => 120},
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
            expect(mode.isJourneyToolbarTemporarilyHidden()).toBe(true)
            expect(globalThis.lgs.settings.ui.journeyToolbar.show).toBe(true)
            expect(journey.visible).toBe(false)
            expect(editorJourney.visible).toBe(false)
            expect(globalThis.lgs.stores.replay.orbitAllowed).toBe(false)
            mode.stop()
            expect(mode.isJourneyToolbarTemporarilyHidden()).toBe(false)
            expect(globalThis.lgs.settings.ui.journeyToolbar.show).toBe(true)
            expect(journey.visible).toBe(true)
            expect(editorJourney.visible).toBe(true)
            expect(globalThis.lgs.stores.replay.orbitAllowed).toBe(true)
            expect(journey.persistToDatabase).toHaveBeenCalled()

            expect(cancelFlightCalls).toBeGreaterThan(0)
            expect(journey.focus).toHaveBeenCalledTimes(1)
            expect(journey.focus).toHaveBeenCalledWith(expect.objectContaining({
                                                                                  resetCamera: true,
                                                                                  rotate: false,
                                                                                  snapDistance: 50000,
                                                                              }))
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('clears the replay marker and trace when stop clips complete', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        journey.focus = vi.fn()
        const renderer = {
            clear:  vi.fn(),
            show:   vi.fn(),
            update: vi.fn(),
        }
        const frames = []
        let now = 0
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame:  () => {
            },
            now:          () => now,
        })

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        duration: 1,
                        clips: {
                            catalog: {},
                            start:   [],
                            stop:    [],
                        },
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips:  {
                                          catalog: {},
                                          start:   [],
                                          stop:    [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
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
                canvas:                       {getBoundingClientRect: () => ({left: 0, top: 0, width: 1000, height: 800})},
                requestRender:                () => {
                },
                cartesianToCanvasCoordinates:  () => ({x: 500, y: 400}),
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({controller, renderer})
            mode.start()

            expect(renderer.clear).toHaveBeenCalledTimes(1)

            now = 1000
            frames.shift()()

            expect(renderer.clear).toHaveBeenCalledTimes(2)
            expect(journey.focus).toHaveBeenCalled()
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('lands on the last replay sample, not on the live camera position', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const landingDefinition = {
            id:           'landing',
            label:        'Landing',
            slots:        ['stop'],
            maxInstances: 1,
            defaults:     {
                duration: 0,
            },
            fields:       [{
                key:     'duration',
                label:   'Duration (s)',
                type:    'number',
                min:     0,
                max:     60,
                step:    0.1,
                default: 0,
            }],
        }
        const landing = createJourneyReplayClipInstance(landingDefinition, 'stop', {
            params: {
                duration: 0,
            },
        })
        const currentCameraSample = {
            longitude: 9,
            latitude:  9,
            altitude:  999,
        }
        const runLanding = async endSample => {
            const setViewCalls = []
            const listeners = new Map()
            const sampler = {
                hasSamples: true,
                atProgress: progress => progress >= 1 ? endSample : {
                    longitude: 2,
                    latitude:  48,
                    altitude:  120,
                },
            }
            const controller = {
                configure: () => controller,
                on: (event, callback) => {
                    listeners.set(event, callback)
                    return () => listeners.delete(event)
                },
                start: () => {
                    listeners.get(REPLAY_EVENT_START)?.({
                                                                controller,
                                                                sampler,
                                                                sample:   sampler.atProgress(0),
                                                                progress: 0,
                                                            })
                    return sampler.atProgress(0)
                },
                pause: () => currentCameraSample,
                resume: () => currentCameraSample,
                stop: () => currentCameraSample,
                currentSample: () => currentCameraSample,
            }

            globalThis.lgs = {
                theJourney: journey,
                theTrack:   null,
                settings:   {
                    ui: {
                        replay: {
                            ...replay,
                            clips: {
                                catalog: {
                                    landing: landingDefinition,
                                },
                                start: [],
                                stop:  [landing],
                            },
                        },
                    },
                },
                stores:     {
                    replay: proxy({
                                          progress: 0,
                                          camera:   replay.camera,
                                          clips:  {
                                              catalog: {
                                                  landing: landingDefinition,
                                              },
                                              start: [],
                                              stop:  [landing],
                                          },
                                      }),
                },
                viewer:     {
                    trackedEntity: null,
                    camera:        {
                        heading:              0.4,
                        pitch:                -0.7,
                        roll:                 0,
                        positionCartographic: {longitude: 9, latitude: 9, height: 999},
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
                        setView:              options => setViewCalls.push(options),
                        lookAtTransform:      () => {
                        },
                    },
                },
                scene:      {
                    requestRender: () => {
                    },
                    globe:         {
                        getHeight: () => 120,
                    },
                },
            }

            const mode = new JourneyReplayMode({
                                                controller,
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
            listeners.get(REPLAY_EVENT_END)?.({
                                                      controller,
                                                      sampler,
                                                      sample:   currentCameraSample,
                                                      progress: 1,
                                                  })
            await Promise.resolve()
            await Promise.resolve()

            expect(setViewCalls).toHaveLength(1)
            return setViewCalls[0].destination
        }

        try {
            const destinationFromFinal = await runLanding({
                longitude: 2.001,
                latitude:  48.001,
                altitude:  130,
            })
            const destinationFromCamera = await runLanding(currentCameraSample)

            expect(Cartesian3.distance(destinationFromFinal, destinationFromCamera)).toBeGreaterThan(1000)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('hides other journeys during replay and restores them at the end', () => {
        const currentJourney = makeJourney([
                                               makeTrack({
                                                             slug:        'track#journey#gpx#main',
                                                             coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                         }),
                                           ])
        const otherJourney = makeJourney([
                                             makeTrack({
                                                           slug:        'track#journey#other#main',
                                                           coordinates: [[3, 47, 90], [3.001, 47.001, 100]],
                                                       }),
                                         ])
        currentJourney.slug = 'journey-current'
        otherJourney.slug = 'journey-other'
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const frames = []
        let now = 0
        currentJourney.visible = false
        otherJourney.visible = true
        currentJourney.focus = vi.fn()
        currentJourney.updateVisibility = vi.fn(visible => {
            currentJourney.visible = visible
        })
        otherJourney.updateVisibility = vi.fn(visible => {
            otherJourney.visible = visible
        })
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame:  () => {
            },
            now:          () => now,
        })

        globalThis.lgs = {
            theJourney: currentJourney,
            theTrack:   null,
            journeys:   new Map([
                [currentJourney.slug, currentJourney],
                [otherJourney.slug, otherJourney],
            ]),
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        hideOtherJourneys: true,
                        duration:          1,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      hideOtherJourneys: true,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
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
                requestRender: () => {
                },
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller,
                                                renderer: {
                                                    clear:  vi.fn(),
                                                    show:   vi.fn(),
                                                    update: vi.fn(),
                                                },
                                            })

            expect(otherJourney.visible).toBe(true)
            mode.start({duration: 1})
            expect(currentJourney.updateVisibility).toHaveBeenCalledWith(false)
            expect(currentJourney.visible).toBe(false)
            expect(otherJourney.updateVisibility).toHaveBeenCalledWith(false)
            expect(otherJourney.visible).toBe(false)

            now = 1000
            frames.shift()()

            expect(currentJourney.updateVisibility).toHaveBeenCalledWith(true)
            expect(currentJourney.visible).toBe(true)
            expect(otherJourney.updateVisibility).toHaveBeenCalledWith(true)
            expect(otherJourney.visible).toBe(true)
            expect(globalThis.lgs.stores.replay.hideOtherJourneys).toBe(true)
            expect(globalThis.lgs.settings.ui.replay.hideOtherJourneys).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('keeps current journey poi datasources visible while hiding current journey polylines', () => {
        const currentJourney = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        currentJourney.slug = 'journey-current'
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const frames = []
        let now = 0
        const currentSource = {
            name:     currentJourney.slug,
            show:     true,
            entities: {
                values: [
                    {
                        id:       'track-polyline',
                        polyline: {show: true},
                    },
                    {
                        id:   'poi-journey',
                        show: true,
                    },
                ],
                getById(id) {
                    return this.values.find(entity => entity.id === id)
                },
            },
        }
        const dataSources = {
            items: [currentSource],
            getByName(name) {
                return this.items.filter(source => source.name === name)
            },
            get(index) {
                return this.items[index]
            },
            get length() {
                return this.items.length
            },
        }
        const controller = new JourneyReplayPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame:  () => {},
            now:          () => now,
        })

        currentJourney.visible = true
        currentJourney.updateVisibility = vi.fn(visible => {
            currentJourney.visible = visible
            currentSource.show = visible
            currentSource.entities.values.forEach(entity => {
                if (entity.polyline) {
                    entity.polyline.show = visible
                }
            })
        })

        globalThis.lgs = {
            theJourney: currentJourney,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        duration: 1,
                    },
                    journeyToolbar: {show: true},
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
                dataSources,
                camera: {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 2, latitude: 48, height: 120},
                    moveStart:            {addEventListener: () => {}, removeEventListener: () => {}},
                    moveEnd:              {addEventListener: () => {}, removeEventListener: () => {}},
                    cancelFlight:         () => {},
                    flyTo:                () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  vi.fn(),
                    show:   vi.fn(),
                    update: vi.fn(),
                },
            })

            mode.start({duration: 1})

            expect(currentJourney.updateVisibility).toHaveBeenCalledWith(false)
            expect(currentSource.show).toBe(true)
            expect(currentSource.entities.getById('track-polyline').polyline.show).toBe(false)

            now = 1000
            frames.shift()()

            expect(currentJourney.updateVisibility).toHaveBeenCalledWith(true)
            expect(currentSource.entities.getById('track-polyline').polyline.show).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('reduces nearby pois, opens them on passage for 3 seconds, then restores their previous state on stop', async () => {
        vi.useFakeTimers()

        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        const previousLgs = globalThis.lgs
        const previous__ = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const listeners = new Map()
        const poiA = {id: 'poi-a', expanded: true}
        const poiB = {id: 'poi-b', expanded: false}
        const poiList = new Map([
            [poiA.id, poiA],
            [poiB.id, poiB],
        ])
        const sampler = {
            hasSamples: true,
            totalDistance: 100,
            atProgress: progress => ({
                longitude: 2,
                latitude:  48,
                altitude:  120,
                progress,
                distanceFromStart: progress * 100,
            }),
        }
        const controller = {
            progress:   0,
            running:    false,
            playing:    false,
            paused:     false,
            configure:  vi.fn(() => controller),
            currentSample: vi.fn(() => sampler.atProgress(controller.progress)),
            on:         (event, callback) => {
                listeners.set(event, callback)
                return () => listeners.delete(event)
            },
            start:      vi.fn(({progress = 0} = {}) => {
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
            pause:      vi.fn(),
            resume:     vi.fn(),
            stop:       vi.fn(),
        }
        const updatePOI = vi.fn(async (id, updates) => {
            const poi = poiList.get(id)
            Object.assign(poi, updates)
            poiList.set(id, poi)
            return poi
        })

        globalThis.__ = {
            ui: {
                poiManager: {
                    updatePOI,
                    getJourneyReplayPOIsForJourney: vi.fn(() => [
                        {poi: {id: 'poi-a'}, projectedAbscissa: 10},
                        {poi: {id: 'poi-b'}, projectedAbscissa: 60},
                    ]),
                },
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        poiDistance: 1000,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                main: {
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                },
                replay: proxy({
                    progress:    0,
                    duration:    60,
                    poiDistance: 1000,
                    camera:      replay.camera,
                    nearbyPois:  [],
                }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 2, latitude: 48, height: 120},
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
                requestRender: () => {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  vi.fn(),
                    show:   vi.fn(),
                    update: vi.fn(),
                },
            })

            mode.start()
            await Promise.resolve()
            await Promise.resolve()

            expect(updatePOI).toHaveBeenCalledWith('poi-a', {expanded: false}, expect.any(Object))
            expect(poiB.expanded).toBe(false)

            listeners.get(REPLAY_EVENT_UPDATE)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(0.15),
                progress: 0.15,
            })
            await Promise.resolve()

            expect(poiA.expanded).toBe(true)
            expect(poiB.expanded).toBe(false)

            await vi.advanceTimersByTimeAsync(3000)
            expect(poiA.expanded).toBe(false)

            listeners.get(REPLAY_EVENT_STOP)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(0.15),
                progress: 0.15,
            })
            await Promise.resolve()
            await Promise.resolve()

            expect(poiA.expanded).toBe(true)
            expect(poiB.expanded).toBe(false)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
            globalThis.__ = previous__
        }
    })

    it('closes POIs opened by replay before running stop clips', async () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
            }),
        ])
        const previousLgs = globalThis.lgs
        const previous__ = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const stopClips = {
            catalog: {
                focus: {
                    label: 'Focus',
                    slots: ['stop'],
                    defaults: {
                        duration: 0,
                    },
                },
            },
            start: [],
            stop:  [
                {
                    clipId: 'focus',
                    params: {duration: 0},
                },
            ],
        }
        const listeners = new Map()
        const poiA = {id: 'poi-a', expanded: true}
        const poiList = new Map([[poiA.id, poiA]])
        const focusClipPOIStates = []
        const sampler = {
            hasSamples: true,
            totalDistance: 100,
            atProgress: progress => ({
                longitude: 2,
                latitude:  48,
                altitude:  120,
                progress,
                distanceFromStart: progress * 100,
            }),
        }
        const controller = {
            progress:   0,
            running:    false,
            playing:    false,
            paused:     false,
            configure:  vi.fn(() => controller),
            currentSample: vi.fn(() => sampler.atProgress(controller.progress)),
            on:         (event, callback) => {
                listeners.set(event, callback)
                return () => listeners.delete(event)
            },
            start:      vi.fn(({progress = 0} = {}) => {
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
            pause:      vi.fn(),
            resume:     vi.fn(),
            stop:       vi.fn(),
        }
        const updatePOI = vi.fn(async (id, updates) => {
            const poi = poiList.get(id)
            Object.assign(poi, updates)
            poiList.set(id, poi)
            return poi
        })

        journey.focus = vi.fn((options = {}) => {
            if (options.rotate === true) {
                focusClipPOIStates.push(poiA.expanded)
            }
            options.callback?.()
            return Promise.resolve()
        })

        globalThis.__ = {
            ui: {
                poiManager: {
                    updatePOI,
                    getJourneyReplayPOIsForJourney: vi.fn(() => [
                        {poi: {id: 'poi-a'}, projectedAbscissa: 10},
                    ]),
                },
                cameraManager: {
                    stopRotate: vi.fn(async () => undefined),
                },
            },
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        poiDistance: 1000,
                        clips:       stopClips,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                main: {
                    components: {
                        pois: {
                            list: poiList,
                        },
                    },
                },
                replay: proxy({
                    progress:    0,
                    duration:    60,
                    poiDistance: 1000,
                    camera:      replay.camera,
                    nearbyPois:  [],
                    clips:       stopClips,
                }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 2, latitude: 48, height: 120},
                    moveStart:            {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    moveEnd:              {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    cancelFlight:         () => {},
                    flyTo:                () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                controller,
                renderer: {
                    clear:  vi.fn(),
                    show:   vi.fn(),
                    update: vi.fn(),
                },
            })

            mode.start({clips: stopClips})
            await Promise.resolve()
            await Promise.resolve()

            listeners.get(REPLAY_EVENT_UPDATE)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(0.15),
                progress: 0.15,
            })
            await Promise.resolve()

            expect(poiA.expanded).toBe(true)

            listeners.get(REPLAY_EVENT_END)?.({
                controller,
                sampler,
                sample:   sampler.atProgress(1),
                progress: 1,
            })
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(focusClipPOIStates).toEqual([false])

            await new Promise(resolve => setTimeout(resolve, 0))

            expect(poiA.expanded).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previous__
        }
    })

    it('starts the replay after the take-off start clip completes without extra delay', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const frames = []
        let now = 0
        const flyToCalls = []
        const setViewCalls = []
        const takeOffDefinition = {
            id:           'take-off',
            label:        'TakeOff',
            slots:        ['start'],
            maxInstances: 1,
            defaults:     {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
            fields:       [],
        }
        const takeOff = createJourneyReplayClipInstance(takeOffDefinition, 'start', {
            params: {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
        })
        journey.replay = {
            start: [takeOff],
            stop:  [],
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     {
                clientWidth:         1000,
                clientHeight:        1000,
                addEventListener:    () => {
                },
                removeEventListener: () => {
                },
            },
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        clips: {
                            catalog: {
                                'take-off': takeOffDefinition,
                            },
                            start: [],
                            stop:  [],
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips:  {
                                          catalog: {
                                              'take-off': takeOffDefinition,
                                          },
                                          start: [],
                                          stop:  [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        {
                    clientWidth:         1000,
                    clientHeight:        1000,
                    addEventListener:    () => {
                    },
                    removeEventListener: () => {
                    },
                },
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    roll:                 0,
                    positionCartographic: {
                        longitude: 2,
                        latitude:  48,
                        height:    1800,
                    },
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
                requestRender: () => {
                },
                globe:         {getHeight: () => 120},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: callback => {
                                                                                                     frames.push(callback)
                                                                                                     return frames.length
                                                                                                 },
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => now,
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
            const controllerStartSpy = vi.spyOn(mode.controller, 'start')

            mode.start({duration: 1})
            await Promise.resolve()
            expect(controllerStartSpy).not.toHaveBeenCalled()

            expect(flyToCalls).toHaveLength(1)
            flyToCalls[0].complete?.()
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(controllerStartSpy).toHaveBeenCalledTimes(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('starts the replay immediately after a zoom-in start clip finishes', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const flyToCalls = []
        const zoomInDefinition = {
            id:           'zoom-in',
            label:        'Zoom in',
            slots:        ['start'],
            maxInstances: 1,
            defaults:     {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
            fields:       [],
        }
        const zoomIn = createJourneyReplayClipInstance(zoomInDefinition, 'start', {
            params: {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
        })
        journey.replay = {
            start: [zoomIn],
            stop:  [],
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     {
                clientWidth:         1000,
                clientHeight:        1000,
                addEventListener:    () => {
                },
                removeEventListener: () => {
                },
            },
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        clips: {
                            catalog: {
                                'zoom-in': zoomInDefinition,
                            },
                            start: [],
                            stop:  [],
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips:    {
                                          catalog: {
                                              'zoom-in': zoomInDefinition,
                                          },
                                          start: [],
                                          stop:  [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        {
                    clientWidth:         1000,
                    clientHeight:        1000,
                    addEventListener:    () => {
                    },
                    removeEventListener: () => {
                    },
                },
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    roll:                 0,
                    positionCartographic: {
                        longitude: 2,
                        latitude:  48,
                        height:    1800,
                    },
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
            const controllerStartSpy = vi.spyOn(mode.controller, 'start')

            mode.start({duration: 1})
            await Promise.resolve()
            expect(controllerStartSpy).not.toHaveBeenCalled()
            expect(flyToCalls).toHaveLength(1)

            flyToCalls[0].complete?.()
            await new Promise(resolve => setTimeout(resolve, 0))

            expect(controllerStartSpy).toHaveBeenCalledTimes(1)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('resolves zoom-in on the journey start sample and zoom-out on the centroid', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const sample = {
            longitude: 2,
            latitude:  48,
            altitude:  120,
        }
        const sceneManager = {
            getJourneyCentroid: vi.fn(async () => ({
                longitude: 2.25,
                latitude:  48.25,
                height:    120,
            })),
        }

        const zoomInTarget = await replayTargetSampleForClip({
            sample,
            clipId: 'zoom-in',
            journey,
            sceneManager,
            markerHeightForSample: () => 120,
        })
        expect(zoomInTarget).toEqual(expect.objectContaining({
            longitude: 2,
            latitude:  48,
            altitude:  120,
        }))

        sceneManager.getJourneyCentroid.mockResolvedValueOnce({
            longitude: 2.75,
            latitude:  48.75,
            height:    120,
        })
        const zoomOutTarget = await replayTargetSampleForClip({
            sample,
            clipId: 'zoom-out',
            journey,
            sceneManager,
            markerHeightForSample: () => 120,
        })
        expect(zoomOutTarget).toEqual(expect.objectContaining({
            longitude: 2.75,
            latitude:  48.75,
            altitude:  120,
        }))
        expect(sceneManager.getJourneyCentroid).toHaveBeenCalledTimes(1)
    })

    it('zoomin starts high and descends to the replay altitude', async () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        journey.replay = {
            start: [],
            stop:  [],
        }
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const flyToCalls = []
        const setViewCalls = []
        const zoomInDefinition = {
            id:           'zoom-in',
            label:        'ZoomIn',
            slots:        ['start'],
            maxInstances: 1,
            defaults:     {
                duration: 1,
                altitude: 900,
                pitch:    -35,
            },
            fields:       [],
        }
        const zoomIn = createJourneyReplayClipInstance(zoomInDefinition, 'start', {
            params: {
                duration: 1,
                altitude: 900,
                pitch:    -35,
            },
        })
        journey.replay.start = [zoomIn]

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     {
                clientWidth:         1000,
                clientHeight:        1000,
                addEventListener:    () => {
                },
                removeEventListener: () => {
                },
            },
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        clips: {
                            catalog: {
                                'zoom-in': zoomInDefinition,
                            },
                            start: [],
                            stop:  [],
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      clips:  {
                                          catalog: {
                                              'zoom-in': zoomInDefinition,
                                          },
                                          start: [],
                                          stop:  [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                canvas:        {
                    clientWidth:         1000,
                    clientHeight:        1000,
                    addEventListener:    () => {
                    },
                    removeEventListener: () => {
                    },
                },
                camera:        {
                    heading:              0.8,
                    pitch:                -Math.PI / 4,
                    roll:                 0,
                    positionCartographic: {
                        longitude: 2,
                        latitude:  48,
                        height:    1800,
                    },
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

            mode.start({duration: 1})
            await Promise.resolve()
            await vi.advanceTimersByTimeAsync(3000)
            await Promise.resolve()

            const target = {
                longitude: 2,
                latitude:  48,
                altitude:  120,
            }
            const targetCartesian = Cartesian3.fromDegrees(target.longitude, target.latitude, target.altitude)
            const targetTransform = Transforms.eastNorthUpToFixedFrame(targetCartesian)
            const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
            const north = Matrix4.getColumn(targetTransform, 1, new Cartesian3())
            const delta = Cartesian3.subtract(flyToCalls[0].destination, targetCartesian, new Cartesian3())

            expect(flyToCalls).toHaveLength(1)
            expect(setViewCalls).toHaveLength(1)
            expect(flyToCalls[0].maximumHeight).toBe(1800)
            expect(Cartesian3.dot(delta, east)).toBeCloseTo(0, 6)
            expect(Cartesian3.dot(delta, north)).toBeLessThan(0)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('does not recenter the camera when pausing an active replay', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const replay = defaultJourneyReplaySettings()
        const flyToCalls = []

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            canvas:     {
                clientWidth:            1000, clientHeight: 1000, addEventListener: () => {
                }, removeEventListener: () => {
                },
            },
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
                canvas:        {clientWidth: 1000, clientHeight: 1000},
                camera:        {
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
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
                    flyTo:                options => flyToCalls.push(options),
                    setView:              () => {
                    },
                },
            },
            scene:      {
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
            mode.start()
            flyToCalls.length = 0
            mode.pause()

            expect(flyToCalls).toHaveLength(0)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('restores the captured camera altitude even when the start camera height is missing', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[0.1, 0.2, 120], [0.2, 0.3, 140]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        journey.visible = false
        journey.updateVisibility = vi.fn(visible => {
            journey.visible = visible
        })
        const setViewCalls = []
        const controller = new JourneyReplayPlaybackController({
            requestFrame: () => 1,
            cancelFrame:  () => {},
            now:          () => 0,
        })

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
            settings:   {
                ui: {
                    replay,
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
                    heading:              0.4,
                    pitch:                -0.7,
                    roll:                 0,
                    positionCartographic: {
                        longitude: 0.1,
                        latitude:  0.2,
                        height:    undefined,
                    },
                    moveStart:            {
                        addEventListener: () => {},
                        removeEventListener: () => {},
                    },
                    moveEnd:              {
                        addEventListener: () => {},
                        removeEventListener: () => {},
                    },
                    cancelFlight:         () => {},
                    flyTo:                () => {},
                    setView:              options => setViewCalls.push(options),
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
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

            mode.start({duration: 1})
            mode.stop({emit: false})

            expect(setViewCalls).toHaveLength(1)
            const restoredLongitude = (0.1 * 180) / Math.PI
            const restoredLatitude = (0.2 * 180) / Math.PI
            expect(Cartesian3.distance(
                setViewCalls[0].destination,
                Cartesian3.fromDegrees(restoredLongitude, restoredLatitude, 120),
            )).toBeLessThan(1)
            expect(journey.visible).toBe(true)
            expect(journey.updateVisibility).toHaveBeenCalledWith(true)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousDoubleUnderscore
        }
    })

    it('places the replay camera at the start sample when trace marker mode has no start clip', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const replay = defaultJourneyReplaySettings()
        const staleMarkerPosition = {
            longitude: 8,
            latitude:  9,
            altitude:  999,
        }
        const setViewCalls = []

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
            settings:   {
                ui: {
                    replay: {
                        ...replay,
                        marker: {
                            ...replay.marker,
                            mode: REPLAY_MARKER_MODE_TRACE,
                            position: staleMarkerPosition,
                        },
                        clips: {
                            ...replay.clips,
                            start: [],
                        },
                    },
                },
            },
            stores:     {
                replay: proxy({
                                      progress: 0,
                                      camera:   replay.camera,
                                      marker:   {
                                          ...replay.marker,
                                          mode: REPLAY_MARKER_MODE_TRACE,
                                          position: staleMarkerPosition,
                                      },
                                      clips:    {
                                          ...replay.clips,
                                          start: [],
                                      },
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              1.1,
                    pitch:                -0.2,
                    roll:                 0,
                    positionCartographic: {longitude: 0.1, latitude: 0.2, height: 3456},
                    moveStart:            {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    moveEnd:              {
                        addEventListener:    () => {},
                        removeEventListener: () => {},
                    },
                    cancelFlight:         () => {},
                    setView:              options => setViewCalls.push(options),
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                requestRender: () => {},
                globe:         {getHeight: () => 120},
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

            mode.start({duration: 1})

            expect(setViewCalls).toHaveLength(1)
            expect(setViewCalls[0]).toEqual(expect.objectContaining({
                destination: expect.any(Cartesian3),
                orientation: expect.objectContaining({
                    direction: expect.any(Cartesian3),
                    up:        expect.any(Cartesian3),
                }),
            }))
            const destination = Cartographic.fromCartesian(setViewCalls[0].destination)
            expect(CesiumMath.toDegrees(destination.longitude)).toBeCloseTo(2, 1)
            expect(CesiumMath.toDegrees(destination.latitude)).toBeCloseTo(48, 1)
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousDoubleUnderscore
        }
    })

    it('focuses the full journey when playback naturally ends', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const focusCalls = []
        const frames = []
        let now = 0
        const rendererUpdate = vi.fn()
        const replay = defaultJourneyReplaySettings()
        journey.visible = false
        journey.updateVisibility = vi.fn(visible => {
            journey.visible = visible
        })
        journey.focus = props => focusCalls.push(props)

        globalThis.__ = {ui: {}}
        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    camera: {start: {rotate: {journey: true}}},
                    replay,
                },
            },
            stores:     {
                replay: proxy({
                                      active:   false,
                                      playing:  false,
                                      paused:   false,
                                      progress: 0,
                                      camera:   replay.camera,
                                  }),
            },
            viewer:     {
                trackedEntity: null,
                camera:        {
                    heading:              0,
                    pitch:                -Math.PI / 4,
                    positionCartographic: {longitude: 0, latitude: 0, height: 1000},
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
                }, globe:      {},
            },
        }

        try {
            const mode = new JourneyReplayMode({
                                                controller: new JourneyReplayPlaybackController({
                                                                                                 requestFrame: callback => {
                                                                                                     frames.push(callback)
                                                                                                     return frames.length
                                                                                                 },
                                                                                                 cancelFrame:  () => {
                                                                                                 },
                                                                                                 now:          () => now,
                                                                                             }),
                                                renderer:   {
                                                    clear:  () => {
                                                    },
                                                    show:   () => {
                                                    },
                                                    update: rendererUpdate,
                                                },
                                            })
            mode.start({duration: 1})
            now = 1000
            frames.shift()()

            expect(focusCalls).toHaveLength(1)
            expect(journey.visible).toBe(true)
            expect(journey.updateVisibility).toHaveBeenCalledWith(true)
            expect(focusCalls[0]).toEqual(expect.objectContaining({
                                                                       resetCamera: true,
                                                                       rotate:      false,
                                                                       snapDistance: 50000,
                                                                   }))
            expect(rendererUpdate).toHaveBeenCalledWith(expect.objectContaining({
                freezeDynamic: true,
                hideCursor:    true,
            }))
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousDoubleUnderscore
        }
    })
})

describe('replay settings normalization', () => {
    it('maps the legacy centered marker mode to hysteresis', () => {
        expect(normalizeJourneyReplayMarker({mode: 'centered'}).mode).toBe(REPLAY_MARKER_MODE_HYSTERESIS)
    })

    it('keeps supported marker tracking modes', () => {
        expect(normalizeJourneyReplayMarker({mode: REPLAY_MARKER_MODE_TRACE}).mode).toBe(REPLAY_MARKER_MODE_TRACE)
        expect(normalizeJourneyReplayMarker({mode: REPLAY_MARKER_MODE_NAVIGATION}).mode).toBe(REPLAY_MARKER_MODE_NAVIGATION)
        expect(normalizeJourneyReplayMarker({mode: REPLAY_MARKER_MODE_HYSTERESIS}).mode).toBe(REPLAY_MARKER_MODE_HYSTERESIS)
    })

    it('preserves an editable marker position when normalizing marker settings', () => {
        const marker = normalizeJourneyReplayMarker({
            mode: REPLAY_MARKER_MODE_NAVIGATION,
            position: {
                longitude: '2.123456',
                latitude:  48.765432,
                altitude:  321,
            },
        })

        expect(marker.position).toEqual({
            longitude: 2.123456,
            latitude:  48.765432,
            altitude:  321,
        })
    })

    it('defaults camera position mode behind and accepts ahead', () => {
        expect(normalizeJourneyReplayCamera({}).positionMode).toBe(REPLAY_CAMERA_POSITION_SYSTEM)
        expect(normalizeJourneyReplayCamera({positionMode: REPLAY_CAMERA_POSITION_BEHIND}).positionMode)
            .toBe(REPLAY_CAMERA_POSITION_BEHIND)
        expect(normalizeJourneyReplayCamera({positionMode: REPLAY_CAMERA_POSITION_AHEAD}).positionMode)
            .toBe(REPLAY_CAMERA_POSITION_AHEAD)
    })

    it('keeps behind and ahead as distinct camera positions', () => {
        const camera = normalizeJourneyReplayCamera({positionMode: REPLAY_CAMERA_POSITION_BEHIND})
        expect(camera.positionMode).toBe(REPLAY_CAMERA_POSITION_BEHIND)
    })

    it('normalizes pitch and altitude settings while preserving the camera mode', () => {
        const camera = normalizeJourneyReplayCamera({
            altitudeMode: 'constant',
            altitude:     1500,
            headingOffset: 120,
            pitch:        -50,
            positionMode: REPLAY_CAMERA_POSITION_AHEAD,
        })

        expect(camera.altitude).toBe(1500)
        expect(camera.headingOffset).toBe(REPLAY_CAMERA_HEADING_OFFSET_MAX)
        expect(camera.pitch).toBe(-50)
        expect(camera.positionMode).toBe(REPLAY_CAMERA_POSITION_AHEAD)
    })

    it('normalizes camera altitude as a single persisted value', () => {
        const camera = normalizeJourneyReplayCamera({
            altitudeMode: 'ground-offset',
            altitude:     1500,
            groundOffset: 800,
        })

        expect(camera.altitude).toBe(1500)
        expect(camera.altitudeMode).toBe('ground-offset')
        expect(camera.groundOffset).toBeUndefined()
    })

    it('keeps a default tolerance zone aligned to the window and clamps custom rectangles', () => {
        const camera = normalizeJourneyReplayCamera({})
        expect(camera.hysteresis.zone).toEqual({
                                                   top:    0,
                                                   left:   0,
                                                   width:  1,
                                                   height: 1,
                                               })
        expect(camera.hysteresis.marginRatio).toBeCloseTo(0.4, 6)
        expect(camera.hysteresis.easing).toBeCloseTo(0.08, 6)
        expect(getJourneyReplayCameraPresetKey(camera)).toBe(REPLAY_CAMERA_PRESET_DEFAULT)

        const bounds = replayToleranceZoneBounds({
                                                         top:    0.15,
                                                         left:   0.1,
                                                         width:  0.5,
                                                         height: 0.3,
                                                     })
        expect(bounds.top).toBeCloseTo(0.15, 6)
        expect(bounds.left).toBeCloseTo(0.1, 6)
        expect(bounds.right).toBeCloseTo(0.6, 6)
        expect(bounds.bottom).toBeCloseTo(0.45, 6)
    })

    it('normalizes the hide other journeys switch as a boolean', () => {
        expect(defaultJourneyReplaySettings().hideOtherJourneys).toBe(false)
        expect(normalizeJourneyReplaySettings({hideOtherJourneys: true}).hideOtherJourneys).toBe(true)
        expect(normalizeJourneyReplaySettings({hideOtherJourneys: 0}).hideOtherJourneys).toBe(false)
    })

    it('normalizes the nearby poi distance and keeps a sane default', () => {
        expect(defaultJourneyReplaySettings().poiDistance).toBe(10000)
        expect(normalizeJourneyReplaySettings({poiDistance: 2500}).poiDistance).toBe(2500)
        expect(normalizeJourneyReplaySettings({poiDistance: 0}).poiDistance).toBe(1)
    })

    it('recognizes the ultra smooth camera preset and increases recenter duration with easing', () => {
        expect(getJourneyReplayCameraPresetKey({
            hysteresis: {
                marginRatio:   0.2,
                easing:        0.3,
            },
        })).toBe(REPLAY_CAMERA_PRESET_ULTRA_SMOOTH)

        expect(getJourneyReplayCameraPresetKey({
            hysteresis: {
                marginRatio:   0.2,
                easing:        0.31,
            },
        })).not.toBe(REPLAY_CAMERA_PRESET_ULTRA_SMOOTH)

        expect(replayCameraRecenterDuration(0.3)).toBeGreaterThan(replayCameraRecenterDuration(0.18))
    })

    it('detects tolerance exits from Cesium window coordinates', () => {
        const zone = {
            top:    0.25,
            left:   0.25,
            width:  0.5,
            height: 0.5,
        }
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 500, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(false)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 750, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 760, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  null,
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
    })

    it('builds runtime-only centered tracking zones for navigation and dynamic camera modes', () => {
        expect(replayCenteredZone(0.3, 0.3)).toEqual({
                                                         top:    0.35,
                                                         left:   0.35,
                                                         width:  0.3,
                                                         height: 0.3,
                                                     })

        const tracking = replayRuntimeTrackingSettings()
        expect(tracking.navigation.triggerZone).toEqual({
                                                            top:    0.35,
                                                            left:   0.35,
                                                            width:  0.3,
                                                            height: 0.3,
                                                        })
        expect(tracking.dynamic.triggerZone.top).toBeCloseTo(0.075, 6)
        expect(tracking.dynamic.triggerZone.left).toBeCloseTo(0.075, 6)
        expect(tracking.dynamic.triggerZone.width).toBeCloseTo(0.85, 6)
        expect(tracking.dynamic.triggerZone.height).toBeCloseTo(0.85, 6)
        expect(tracking.dynamic.targetZone).toEqual({
                                                       top:    0.35,
                                                       left:   0.35,
                                                       width:  0.3,
                                                       height: 0.3,
                                                   })
    })

    it('places dynamic target inside Z2 opposite to screen movement direction', () => {
        const target = replayDynamicTargetPointInZone({
                                                          currentPoint:   {x: 500, y: 500},
                                                          predictedPoint: {x: 700, y: 500},
                                                          viewportWidth:  1000,
                                                          viewportHeight: 1000,
                                                          zone:           replayCenteredZone(0.3, 0.3),
                                                      })

        expect(target.x).toBeLessThan(500)
        expect(target.x).toBeGreaterThanOrEqual(350)
        expect(target.y).toBeCloseTo(500, 6)
    })

    it('treats dynamic Z1 as the hard trigger zone instead of the inner safe zone', () => {
        const zone = replayCenteredZone(0.5, 0.5)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 400, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(false)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 100, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
    })

    it('keeps the camera farther from the anchor when pitch is not top-down', () => {
        expect(replayCameraRangeFromPitch(1200, -Math.PI / 2)).toBeCloseTo(1200, 6)
        expect(replayCameraRangeFromPitch(1200, -Math.PI / 4)).toBeCloseTo(1697.056, 3)
    })

    it('keeps the current camera height when recentering', () => {
        expect(replayCameraRecenterHeight(840, 1200)).toBe(840)
        expect(replayCameraRecenterHeight(null, 1200)).toBe(1200)
    })

    it('keeps the recentering pitch by moving horizontally instead of changing height', () => {
        expect(replayCameraRecenterHorizontalDistance({
                                                              cameraHeight: 1000,
                                                              targetHeight: 0,
                                                              pitchRadians: -Math.PI / 4,
                                                          })).toBeCloseTo(1000, 6)
        expect(replayCameraRecenterHorizontalDistance({
                                                              cameraHeight: 1000,
                                                              targetHeight: 500,
                                                              pitchRadians: -Math.PI / 4,
                                                          })).toBeCloseTo(500, 6)
        expect(replayCameraRecenterHorizontalDistance({
                                                              cameraHeight:  1000,
                                                              targetHeight:  0,
                                                              pitchRadians:  0,
                                                              fallbackRange: 750,
                                                          })).toBe(750)
    })

    it('converts local trace axis angles to Cesium headings', () => {
        expect(replayHeadingFromLocalAxisAngle(0)).toBeCloseTo(Math.PI / 2, 6)
        expect(replayHeadingFromLocalAxisAngle(Math.PI / 2)).toBeCloseTo(0, 6)
    })

    it('places behind on the trace heading and ahead on the opposite side', () => {
        expect(replayCameraHeadingForPositionMode({
            axisHeading:   0.75,
            positionMode: REPLAY_CAMERA_POSITION_BEHIND,
            headingOffset: 15,
        })).toBeCloseTo(0.75 + (Math.PI / 12), 6)
        expect(replayCameraHeadingForPositionMode({
            axisHeading:   0.75,
            positionMode: REPLAY_CAMERA_POSITION_AHEAD,
            headingOffset: -15,
        })).toBeCloseTo(0.75 + Math.PI - (Math.PI / 12), 6)
    })

    it('keeps the last heading when the requested change stays within hysteresis', () => {
        expect(replayAngularDelta(0, 0.01)).toBeCloseTo(0.01, 6)
        expect(replayAngularDelta(Math.PI - 0.01, -Math.PI + 0.01)).toBeCloseTo(0.02, 6)
        expect(replayCameraHeadingWithHysteresis({
            previousHeading: 0,
            nextHeading:     0.05,
            threshold:       0.1,
        })).toBeCloseTo(0, 6)
        expect(replayCameraHeadingWithHysteresis({
            previousHeading: 0,
            nextHeading:     0.2,
            threshold:       0.1,
        })).toBeCloseTo(0.2, 6)
    })

    it('eases large heading changes more than small ones', () => {
        const smallTurn = replayHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     0.08,
            easing:          0.14,
        })
        const largeTurn = replayHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI * 0.75,
            easing:          0.14,
        })

        expect(smallTurn).toBeGreaterThan(largeTurn)
        expect(largeTurn).toBeGreaterThanOrEqual(0.04)
        expect(smallTurn).toBeLessThanOrEqual(0.22)
    })

    it('reduces the heading response when easing increases', () => {
        const lowEasing = replayHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI / 2,
            easing:          0.05,
        })
        const highEasing = replayHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI / 2,
            easing:          0.45,
        })

        expect(highEasing).toBeLessThan(lowEasing)
    })
})
