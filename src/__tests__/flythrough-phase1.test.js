/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythrough-phase1.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-31
 * Last modified: 2026-05-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    flythroughAngularDelta, flythroughCameraHeadingForPositionMode, flythroughCameraHeadingWithHysteresis,
    flythroughCameraRangeFromPitch, flythroughCameraRecenterHeight, flythroughCameraRecenterHorizontalDistance,
    flythroughCameraRecenterDuration, flythroughHeadingEasingFactor, flythroughHeadingFromLocalAxisAngle,
    flythroughIsWindowPointOutsideToleranceZone, FlythroughMode, flythroughTargetSampleForEffect,
    flythroughToleranceZoneBounds,
}                                          from '@Core/ui/flythrough/FlythroughMode'
import {
    FLYTHROUGH_SCOPE_ALL_TRACKS, FLYTHROUGH_SCOPE_CURRENT_TRACK, FLYTHROUGH_SCOPE_VISIBLE_TRACKS, FlythroughPathSampler,
}                                          from '@Core/ui/flythrough/FlythroughPathSampler'
import {
    FLYTHROUGH_EVENT_END, FLYTHROUGH_EVENT_START, FLYTHROUGH_EVENT_UPDATE, FlythroughPlaybackController,
}                                          from '@Core/ui/flythrough/FlythroughPlaybackController'
import {
    defaultFlythroughSettings, FLYTHROUGH_CAMERA_POSITION_AHEAD, FLYTHROUGH_CAMERA_POSITION_BEHIND,
    FLYTHROUGH_CAMERA_POSITION_SYSTEM, FLYTHROUGH_CAMERA_PRESET_DEFAULT, FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH,
    FLYTHROUGH_MARKER_MODE_HYSTERESIS, FLYTHROUGH_MARKER_MODE_NAVIGATION, FLYTHROUGH_MARKER_MODE_TRACE,
    getFlythroughCameraPresetKey, normalizeFlythroughCamera, normalizeFlythroughMarker,
    normalizeFlythroughSettings,
}                                          from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { createFlythroughEffectInstance }  from '@Core/ui/flythrough/FlythroughEffects'
import { Cartesian3, Matrix4, Transforms } from 'cesium'
import { proxy }                           from 'valtio'
import { describe, expect, it, vi }        from 'vitest'

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
    slug: 'journey#gpx',
    tracks: new Map(tracks.map(track => [track.slug, track])),
})

describe('flythrough phase 1 sampler', () => {
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

        const sampler = new FlythroughPathSampler({journey})

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

        const sampler = new FlythroughPathSampler({journey, scope: FLYTHROUGH_SCOPE_ALL_TRACKS})
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

        const sampler = new FlythroughPathSampler({journey})
        const remaining = sampler.remainingSegmentsAt(0.5)

        expect(remaining).toHaveLength(1)
        expect(remaining[0].coordinates[0][0]).toBeCloseTo(0.001, 5)
        expect(remaining[0].coordinates.at(-1)[0]).toBeCloseTo(0.002, 5)
    })

    it('interpolates journey time on flythrough samples', () => {
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

        const sampler = new FlythroughPathSampler({journey})
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

        const sampler = new FlythroughPathSampler({journey})

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

        expect(new FlythroughPathSampler({journey, scope: FLYTHROUGH_SCOPE_VISIBLE_TRACKS}).samples[0].trackSlug)
            .toBe(visible.slug)
        expect(new FlythroughPathSampler({
            journey,
            scope: FLYTHROUGH_SCOPE_CURRENT_TRACK,
            trackSlug: hidden.slug,
        }).samples[0].trackSlug).toBe(hidden.slug)
    })
})

describe('flythrough phase 1 playback controller', () => {
    it('advances from elapsed time rather than point count', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new FlythroughPathSampler({journey})
        const frames = []
        let now = 0
        const controller = new FlythroughPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame: () => {},
            now:         () => now,
        })
        const updates = []

        controller.on(FLYTHROUGH_EVENT_UPDATE, detail => updates.push(detail.sample))
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
        const sampler = new FlythroughPathSampler({journey})
        const frames = []
        let now = 0
        const controller = new FlythroughPlaybackController({
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
        const sampler = new FlythroughPathSampler({journey})
        const frames = []
        const ends = []
        let now = 0
        const controller = new FlythroughPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame: () => {},
            now:         () => now,
        })

        controller.on(FLYTHROUGH_EVENT_END, detail => ends.push(detail))
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
        const sampler = new FlythroughPathSampler({journey})
        const previousLgs = globalThis.lgs
        const frames = []
        let now = 0

        globalThis.lgs = {
            events: {emit: () => {}},
            scene:  {requestRender: () => {}},
            stores: {
                flythrough: proxy({
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
            const controller = new FlythroughPlaybackController({
                requestFrame: callback => {
                    frames.push(callback)
                    return frames.length
                },
                cancelFrame: () => {},
                now:         () => now,
            })

            controller.on(FLYTHROUGH_EVENT_END, () => {
                const store = globalThis.lgs.stores.flythrough
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

            expect(globalThis.lgs.stores.flythrough.progress).toBe(0)
            expect(globalThis.lgs.stores.flythrough.elapsedMillis).toBeNull()
            expect(globalThis.lgs.stores.flythrough.durationMillis).toBeNull()
            expect(globalThis.lgs.stores.flythrough.sample).toBeNull()
            expect(globalThis.lgs.stores.flythrough.totalDistance).toBe(0)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('syncs serializable samples into the Valtio flythrough runtime store', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new FlythroughPathSampler({journey})
        const previousLgs = globalThis.lgs

        globalThis.lgs = {
            events: {emit: () => {}},
            scene:  {requestRender: () => {}},
            stores: {
                flythrough: proxy({
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
            const controller = new FlythroughPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            })

            expect(() => controller.configure({sampler, duration: 10})).not.toThrow()
            expect(() => controller.start()).not.toThrow()
            expect(() => controller.seek(0.5)).not.toThrow()
            expect(globalThis.lgs.stores.flythrough.elapsedMillis).toBe(10 * 60 * 1000)
            expect(globalThis.lgs.stores.flythrough.durationMillis).toBe(20 * 60 * 1000)
            expect(() => JSON.stringify(globalThis.lgs.stores.flythrough.sample)).not.toThrow()
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('reduces publication cadence while video-safe mode is enabled', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
                times:       ['2026-05-05T10:00:00.000Z', '2026-05-05T10:20:00.000Z'],
            }),
        ])
        const sampler = new FlythroughPathSampler({journey})
        const previousLgs = globalThis.lgs
        const frames = []
        let now = 0

        globalThis.lgs = {
            events: {emit: () => {}},
            scene:  {requestRender: () => {}},
            stores: {
                flythrough: proxy({
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
            const controller = new FlythroughPlaybackController({
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
            expect(globalThis.lgs.stores.flythrough.progress).toBe(0)
            expect(controller.progress).toBeGreaterThan(0)

            now = 1100
            frames.shift()()
            expect(globalThis.lgs.stores.flythrough.progress).toBeGreaterThan(0)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('syncs the live Cesium camera into runtime and persisted flythrough camera settings', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
        ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
        const stopRotate = vi.fn(async () => undefined)

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {flythrough, journeyToolbar: {show: true}}},
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1840)
            expect(globalThis.lgs.stores.flythrough.camera.pitch).toBeCloseTo(-45, 6)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('seeds the flythrough camera from the live Cesium view before playback starts', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const previousDoubleUnderscore = globalThis.__
        const flythrough = defaultFlythroughSettings()
        const stopRotate = vi.fn(async () => undefined)

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {flythrough, journeyToolbar: {show: true}}},
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(2460)
            expect(globalThis.lgs.settings.ui.flythrough.camera.pitch).toBeCloseTo(-30, 6)
            expect(globalThis.lgs.settings.ui.flythrough.camera.heading).toBeCloseTo(52, 0)
        }
        finally {
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
        const flythrough = defaultFlythroughSettings()

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {flythrough}},
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   {
                                          ...flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(1200)
            expect(globalThis.lgs.stores.flythrough.camera.altitude).toBe(1200)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('keeps the drawer in sync with live Cesium camera edits while an active flythrough is running', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
        let cameraChanged = null
        let moveStart = null
        let moveEnd = null

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(globalThis.lgs.settings.ui.flythrough.camera.heading).toBeCloseTo(80, 0)
            expect(globalThis.lgs.settings.ui.flythrough.camera.pitch).toBeCloseTo(-45, 0)
            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(3000)
            expect(globalThis.lgs.stores.flythrough.camera.heading).toBeCloseTo(80, 0)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('can refresh flythrough rendering without moving the camera', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
        let setViewCalls = 0
        let renderUpdates = 0

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_NAVIGATION,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
        const flythrough = defaultFlythroughSettings()
        const lookAtTransformCalls = []
        const setViewCalls = []

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_NAVIGATION,
                        },
                        camera: {
                            ...flythrough.camera,
                            positionMode: FLYTHROUGH_CAMERA_POSITION_SYSTEM,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
            expect(globalThis.lgs.settings.ui.flythrough.camera.pitch).toBeCloseTo(-45, 6)
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_NAVIGATION,
                        },
                        camera: {
                            ...flythrough.camera,
                            positionMode: FLYTHROUGH_CAMERA_POSITION_SYSTEM,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(2200)
            expect(globalThis.lgs.settings.ui.flythrough.camera.pitch).toBeCloseTo(-30, 6)
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
        const flythrough = defaultFlythroughSettings()
        const cameraSettings = {
            ...flythrough.camera,
            positionMode: FLYTHROUGH_CAMERA_POSITION_SYSTEM,
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_NAVIGATION,
                        },
                        camera: cameraSettings,
                    },
                },
            },
            stores:     {
                flythrough: proxy({
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(3200)
            expect(globalThis.lgs.settings.ui.flythrough.camera.pitch).toBe(-62)
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_NAVIGATION,
                        },
                        camera: {
                            ...flythrough.camera,
                            positionMode: FLYTHROUGH_CAMERA_POSITION_SYSTEM,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(2600)
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(2600)
            expect(flyToCalls).toHaveLength(1)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('recenters immediately on flythrough start when the first tolerance marker is outside the window', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

    it('recenters immediately on flythrough start even when the first tolerance marker is already inside the zone', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            const overlay = document.querySelector('.flythrough-tolerance-zone-overlay')
            expect(overlay).not.toBeNull()
            expect(Number.parseFloat(overlay.style.left)).toBeCloseTo(50, 6)
            expect(Number.parseFloat(overlay.style.top)).toBeCloseTo(50, 6)
            expect(Number.parseFloat(overlay.style.width)).toBeCloseTo(900, 6)
            expect(Number.parseFloat(overlay.style.height)).toBeCloseTo(900, 6)
            expect(overlay.style.background).toContain('rgba(255, 0, 0')
            expect(overlay.firstElementChild?.className).toBe('flythrough-tolerance-zone-overlay-outer')
            expect(overlay.lastElementChild?.className).toBe('flythrough-tolerance-zone-overlay-inner')
            expect(overlay.lastElementChild?.style.border).toContain('dashed')

            mode.stop({emit: false})
        }
        finally {
            document.querySelector('.flythrough-tolerance-zone-overlay')?.remove()
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(globalThis.lgs.settings.ui.flythrough.camera.altitude).toBe(2600)
            expect(globalThis.lgs.settings.ui.flythrough.camera.pitch).toBeCloseTo(-30, 6)
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

    it('replaces a stale tolerance recenter when the moving marker remains outside the zone', () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            expect(cancelFlightCalls).toBe(2)
            expect(flyToCalls).toHaveLength(2)
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
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

    it('recenters on the current journey when stopping an active flythrough', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
        journey.focus = vi.fn()
        let cancelFlightCalls = 0

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {ui: {flythrough, journeyToolbar: {show: true}}},
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
            mode.stop()
            expect(mode.isJourneyToolbarTemporarilyHidden()).toBe(false)
            expect(globalThis.lgs.settings.ui.journeyToolbar.show).toBe(true)

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

    it('clears the flythrough marker and trace when stop effects complete', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
        journey.focus = vi.fn()
        const renderer = {
            clear:  vi.fn(),
            show:   vi.fn(),
            update: vi.fn(),
        }
        const frames = []
        let now = 0
        const controller = new FlythroughPlaybackController({
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
                    flythrough: {
                        ...flythrough,
                        duration: 1,
                        effects: {
                            catalog: {},
                            start:   [],
                            stop:    [],
                        },
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
                                      effects:  {
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
            const mode = new FlythroughMode({controller, renderer})
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

    it('lands on the last flythrough sample, not on the live camera position', async () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
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
        const landing = createFlythroughEffectInstance(landingDefinition, 'stop', {
            params: {
                duration: 0,
            },
        })
        const listeners = new Map()
        const setViewCalls = []
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
                    listeners.get(FLYTHROUGH_EVENT_START)?.({
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
                        flythrough: {
                            ...flythrough,
                            effects: {
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
                    flythrough: proxy({
                                          progress: 0,
                                          camera:   flythrough.camera,
                                          effects:  {
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

            const mode = new FlythroughMode({
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
            listeners.get(FLYTHROUGH_EVENT_END)?.({
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

    it('hides other journeys during flythrough and restores them at the end', () => {
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
        const flythrough = defaultFlythroughSettings()
        const frames = []
        let now = 0
        currentJourney.visible = true
        otherJourney.visible = true
        currentJourney.focus = vi.fn()
        currentJourney.updateVisibility = vi.fn(visible => {
            currentJourney.visible = visible
        })
        otherJourney.updateVisibility = vi.fn(visible => {
            otherJourney.visible = visible
        })
        const controller = new FlythroughPlaybackController({
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
                    flythrough: {
                        ...flythrough,
                        hideOtherJourneys: true,
                        duration:          1,
                    },
                    journeyToolbar: {show: true},
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller,
                                                renderer: {
                                                    clear:  vi.fn(),
                                                    show:   vi.fn(),
                                                    update: vi.fn(),
                                                },
                                            })

            expect(otherJourney.visible).toBe(true)
            mode.start({duration: 1})
            expect(otherJourney.updateVisibility).toHaveBeenCalledWith(false)
            expect(otherJourney.visible).toBe(false)

            now = 1000
            frames.shift()()

            expect(otherJourney.updateVisibility).toHaveBeenCalledWith(true)
            expect(otherJourney.visible).toBe(true)
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })

    it('plays the start launch effect before recentering the flythrough on the path', async () => {
        vi.useFakeTimers()
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
        const frames = []
        let now = 0
        const flyToCalls = []
        const setViewCalls = []
        const launchDefinition = {
            id:           'launch',
            label:        'Launch',
            slots:        ['start'],
            maxInstances: 1,
            defaults:     {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
            fields:       [],
        }
        const launch = createFlythroughEffectInstance(launchDefinition, 'start', {
            params: {
                duration: 0.1,
                altitude: 300,
                pitch:    -35,
            },
        })

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
                    flythrough: {
                        ...flythrough,
                        effects: {
                            catalog: {
                                launch: launchDefinition,
                            },
                            start: [launch],
                            stop:  [],
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
                                      effects:  {
                                          catalog: {
                                              launch: launchDefinition,
                                          },
                                          start: [launch],
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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

            mode.start({duration: 1})
            await Promise.resolve()
            await Promise.resolve()
            await Promise.resolve()

            expect(flyToCalls).toHaveLength(1)
            expect(flyToCalls[0].maximumHeight).toBeLessThan(600)

            now = 1500
            frames.shift()()
            vi.advanceTimersByTime(100)
            await Promise.resolve()
            await Promise.resolve()

            expect(setViewCalls.length + flyToCalls.length).toBeGreaterThan(0)
        }
        finally {
            vi.useRealTimers()
            globalThis.lgs = previousLgs
        }
    })

    it('resolves zoom-in and zoom-out on the journey centroid', async () => {
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

        const zoomInTarget = await flythroughTargetSampleForEffect({
            sample,
            effectId: 'zoom-in',
            journey,
            sceneManager,
            markerHeightForSample: () => 120,
        })
        expect(zoomInTarget).toEqual(expect.objectContaining({
            longitude: 2.25,
            latitude:  48.25,
            altitude:  120,
        }))

        sceneManager.getJourneyCentroid.mockResolvedValueOnce({
            longitude: 2.75,
            latitude:  48.75,
            height:    120,
        })
        const zoomOutTarget = await flythroughTargetSampleForEffect({
            sample,
            effectId: 'zoom-out',
            journey,
            sceneManager,
            markerHeightForSample: () => 120,
        })
        expect(zoomOutTarget).toEqual(expect.objectContaining({
            longitude: 2.75,
            latitude:  48.75,
            altitude:  120,
        }))
        expect(sceneManager.getJourneyCentroid).toHaveBeenCalledTimes(2)
    })

    it('does not recenter the camera when pausing an active flythrough', () => {
        const journey = makeJourney([
                                        makeTrack({
                                                      slug:        'track#journey#gpx#main',
                                                      coordinates: [[2, 48, 120], [2.001, 48.001, 130]],
                                                  }),
                                    ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
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
                    flythrough: {
                        ...flythrough,
                        marker: {
                            ...flythrough.marker,
                            mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS,
                        },
                    },
                },
            },
            stores:     {
                flythrough: proxy({
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
        const flythrough = defaultFlythroughSettings()
        journey.focus = props => focusCalls.push(props)

        globalThis.__ = {ui: {}}
        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    camera: {start: {rotate: {journey: true}}},
                    flythrough,
                },
            },
            stores:     {
                flythrough: proxy({
                                      active:   false,
                                      playing:  false,
                                      paused:   false,
                                      progress: 0,
                                      camera:   flythrough.camera,
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
            const mode = new FlythroughMode({
                                                controller: new FlythroughPlaybackController({
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
            mode.start({duration: 1})
            now = 1000
            frames.shift()()

            expect(focusCalls).toHaveLength(1)
            expect(focusCalls[0]).toEqual(expect.objectContaining({
                                                                       resetCamera: true,
                                                                       rotate:      false,
                                                                       snapDistance: 50000,
                                                                   }))
        }
        finally {
            globalThis.lgs = previousLgs
            globalThis.__ = previousDoubleUnderscore
        }
    })
})

describe('flythrough settings normalization', () => {
    it('maps the legacy centered marker mode to hysteresis', () => {
        expect(normalizeFlythroughMarker({mode: 'centered'}).mode).toBe(FLYTHROUGH_MARKER_MODE_HYSTERESIS)
    })

    it('keeps supported marker tracking modes', () => {
        expect(normalizeFlythroughMarker({mode: FLYTHROUGH_MARKER_MODE_TRACE}).mode).toBe(FLYTHROUGH_MARKER_MODE_TRACE)
        expect(normalizeFlythroughMarker({mode: FLYTHROUGH_MARKER_MODE_NAVIGATION}).mode).toBe(FLYTHROUGH_MARKER_MODE_NAVIGATION)
        expect(normalizeFlythroughMarker({mode: FLYTHROUGH_MARKER_MODE_HYSTERESIS}).mode).toBe(FLYTHROUGH_MARKER_MODE_HYSTERESIS)
    })

    it('preserves an editable marker position when normalizing marker settings', () => {
        const marker = normalizeFlythroughMarker({
            mode: FLYTHROUGH_MARKER_MODE_NAVIGATION,
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
        expect(normalizeFlythroughCamera({}).positionMode).toBe(FLYTHROUGH_CAMERA_POSITION_SYSTEM)
        expect(normalizeFlythroughCamera({positionMode: FLYTHROUGH_CAMERA_POSITION_BEHIND}).positionMode)
            .toBe(FLYTHROUGH_CAMERA_POSITION_BEHIND)
        expect(normalizeFlythroughCamera({positionMode: FLYTHROUGH_CAMERA_POSITION_AHEAD}).positionMode)
            .toBe(FLYTHROUGH_CAMERA_POSITION_AHEAD)
    })

    it('keeps behind and ahead as distinct camera positions', () => {
        const camera = normalizeFlythroughCamera({positionMode: FLYTHROUGH_CAMERA_POSITION_BEHIND})
        expect(camera.positionMode).toBe(FLYTHROUGH_CAMERA_POSITION_BEHIND)
    })

    it('normalizes pitch and altitude settings while preserving the camera mode', () => {
        const camera = normalizeFlythroughCamera({
            altitudeMode: 'constant',
            altitude:     1500,
            pitch:        -50,
            positionMode: FLYTHROUGH_CAMERA_POSITION_AHEAD,
        })

        expect(camera.altitude).toBe(1500)
        expect(camera.pitch).toBe(-50)
        expect(camera.positionMode).toBe(FLYTHROUGH_CAMERA_POSITION_AHEAD)
    })

    it('normalizes camera altitude as a single persisted value', () => {
        const camera = normalizeFlythroughCamera({
            altitudeMode: 'ground-offset',
            altitude:     1500,
            groundOffset: 800,
        })

        expect(camera.altitude).toBe(1500)
        expect(camera.altitudeMode).toBe('ground-offset')
        expect(camera.groundOffset).toBeUndefined()
    })

    it('keeps a default tolerance zone aligned to the window and clamps custom rectangles', () => {
        const camera = normalizeFlythroughCamera({})
        expect(camera.hysteresis.zone).toEqual({
                                                   top:    0,
                                                   left:   0,
                                                   width:  1,
                                                   height: 1,
                                               })
        expect(camera.hysteresis.marginRatio).toBeCloseTo(0.12, 6)
        expect(camera.hysteresis.easing).toBeCloseTo(0.18, 6)
        expect(getFlythroughCameraPresetKey(camera)).toBe(FLYTHROUGH_CAMERA_PRESET_DEFAULT)

        const bounds = flythroughToleranceZoneBounds({
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
        expect(defaultFlythroughSettings().hideOtherJourneys).toBe(false)
        expect(normalizeFlythroughSettings({hideOtherJourneys: true}).hideOtherJourneys).toBe(true)
        expect(normalizeFlythroughSettings({hideOtherJourneys: 0}).hideOtherJourneys).toBe(false)
    })

    it('recognizes the ultra smooth camera preset and increases recenter duration with easing', () => {
        expect(getFlythroughCameraPresetKey({
            hysteresis: {
                marginRatio:   0.2,
                easing:        0.3,
                stopThreshold: 0.000005,
            },
        })).toBe(FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH)

        expect(getFlythroughCameraPresetKey({
            hysteresis: {
                marginRatio:   0.2,
                easing:        0.3,
                stopThreshold: 0.00001,
            },
        })).not.toBe(FLYTHROUGH_CAMERA_PRESET_ULTRA_SMOOTH)

        expect(flythroughCameraRecenterDuration(0.3)).toBeGreaterThan(flythroughCameraRecenterDuration(0.18))
    })

    it('detects tolerance exits from Cesium window coordinates', () => {
        const zone = {
            top:    0.25,
            left:   0.25,
            width:  0.5,
            height: 0.5,
        }
        expect(flythroughIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 500, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(false)
        expect(flythroughIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 750, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
        expect(flythroughIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 760, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
        expect(flythroughIsWindowPointOutsideToleranceZone({
                                                               point:  null,
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
    })

    it('keeps the camera farther from the anchor when pitch is not top-down', () => {
        expect(flythroughCameraRangeFromPitch(1200, -Math.PI / 2)).toBeCloseTo(1200, 6)
        expect(flythroughCameraRangeFromPitch(1200, -Math.PI / 4)).toBeCloseTo(1697.056, 3)
    })

    it('keeps the current camera height when recentering', () => {
        expect(flythroughCameraRecenterHeight(840, 1200)).toBe(840)
        expect(flythroughCameraRecenterHeight(null, 1200)).toBe(1200)
    })

    it('keeps the recentering pitch by moving horizontally instead of changing height', () => {
        expect(flythroughCameraRecenterHorizontalDistance({
                                                              cameraHeight: 1000,
                                                              targetHeight: 0,
                                                              pitchRadians: -Math.PI / 4,
                                                          })).toBeCloseTo(1000, 6)
        expect(flythroughCameraRecenterHorizontalDistance({
                                                              cameraHeight: 1000,
                                                              targetHeight: 500,
                                                              pitchRadians: -Math.PI / 4,
                                                          })).toBeCloseTo(500, 6)
        expect(flythroughCameraRecenterHorizontalDistance({
                                                              cameraHeight:  1000,
                                                              targetHeight:  0,
                                                              pitchRadians:  0,
                                                              fallbackRange: 750,
                                                          })).toBe(750)
    })

    it('converts local trace axis angles to Cesium headings', () => {
        expect(flythroughHeadingFromLocalAxisAngle(0)).toBeCloseTo(Math.PI / 2, 6)
        expect(flythroughHeadingFromLocalAxisAngle(Math.PI / 2)).toBeCloseTo(0, 6)
    })

    it('places behind on the trace heading and ahead on the opposite side', () => {
        expect(flythroughCameraHeadingForPositionMode({
            axisHeading:   0.75,
            positionMode: FLYTHROUGH_CAMERA_POSITION_BEHIND,
        })).toBeCloseTo(0.75, 6)
        expect(flythroughCameraHeadingForPositionMode({
            axisHeading:   0.75,
            positionMode: FLYTHROUGH_CAMERA_POSITION_AHEAD,
        })).toBeCloseTo(0.75 + Math.PI, 6)
    })

    it('keeps the last heading when the requested change stays within hysteresis', () => {
        expect(flythroughAngularDelta(0, 0.01)).toBeCloseTo(0.01, 6)
        expect(flythroughAngularDelta(Math.PI - 0.01, -Math.PI + 0.01)).toBeCloseTo(0.02, 6)
        expect(flythroughCameraHeadingWithHysteresis({
            previousHeading: 0,
            nextHeading:     0.05,
            threshold:       0.1,
        })).toBeCloseTo(0, 6)
        expect(flythroughCameraHeadingWithHysteresis({
            previousHeading: 0,
            nextHeading:     0.2,
            threshold:       0.1,
        })).toBeCloseTo(0.2, 6)
    })

    it('eases large heading changes more than small ones', () => {
        const smallTurn = flythroughHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     0.08,
            easing:          0.14,
        })
        const largeTurn = flythroughHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI * 0.75,
            easing:          0.14,
        })

        expect(smallTurn).toBeGreaterThan(largeTurn)
        expect(largeTurn).toBeGreaterThanOrEqual(0.04)
        expect(smallTurn).toBeLessThanOrEqual(0.22)
    })

    it('reduces the heading response when easing increases', () => {
        const lowEasing = flythroughHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI / 2,
            easing:          0.05,
        })
        const highEasing = flythroughHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI / 2,
            easing:          0.45,
        })

        expect(highEasing).toBeLessThan(lowEasing)
    })
})
