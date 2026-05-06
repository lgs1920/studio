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
