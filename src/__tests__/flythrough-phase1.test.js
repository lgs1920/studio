/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythrough-phase1.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-04
 * Last modified: 2026-05-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import { proxy } from 'valtio'
import {
    FLYTHROUGH_EVENT_END, FLYTHROUGH_EVENT_UPDATE, FlythroughPlaybackController,
} from '@Core/ui/flythrough/FlythroughPlaybackController'
import {
    FlythroughPathSampler, FLYTHROUGH_SCOPE_ALL_TRACKS, FLYTHROUGH_SCOPE_CURRENT_TRACK, FLYTHROUGH_SCOPE_VISIBLE_TRACKS,
} from '@Core/ui/flythrough/FlythroughPathSampler'
import {
    FLYTHROUGH_MARKER_MODE_HYSTERESIS,
    FLYTHROUGH_MARKER_MODE_NAVIGATION,
    FLYTHROUGH_MARKER_MODE_TRACE,
    FLYTHROUGH_CAMERA_POSITION_AHEAD,
    FLYTHROUGH_CAMERA_POSITION_BEHIND,
    FLYTHROUGH_CAMERA_POSITION_SYSTEM,
    normalizeFlythroughMarker,
    normalizeFlythroughCamera,
} from '@Core/ui/flythrough/FlythroughProgressionStyle'
import {
    flythroughAngularDelta,
    flythroughCameraHeadingForPositionMode,
    flythroughCameraHeadingWithHysteresis,
    flythroughCameraRangeFromPitch,
    flythroughHeadingFromLocalAxisAngle,
} from '@Core/ui/flythrough/FlythroughMode'

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

    it('keeps the camera farther from the anchor when pitch is not top-down', () => {
        expect(flythroughCameraRangeFromPitch(1200, -Math.PI / 2)).toBeCloseTo(1200, 6)
        expect(flythroughCameraRangeFromPitch(1200, -Math.PI / 4)).toBeCloseTo(1697.056, 3)
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
})
