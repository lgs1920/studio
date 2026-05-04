/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: wander-phase1.test.js
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
import { WanderPlaybackController, WANDER_EVENT_UPDATE } from '@Core/ui/wander/WanderPlaybackController'
import {
    WanderPathSampler, WANDER_SCOPE_ALL_TRACKS, WANDER_SCOPE_CURRENT_TRACK, WANDER_SCOPE_VISIBLE_TRACKS,
} from '@Core/ui/wander/WanderPathSampler'

const makeTrack = ({
                       slug,
                       visible = true,
                       coordinates,
                       type = 'LineString',
                   }) => ({
    slug,
    visible,
    content: {
        type:       'Feature',
        properties: {},
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

describe('wander phase 1 sampler', () => {
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

        const sampler = new WanderPathSampler({journey})

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

        const sampler = new WanderPathSampler({journey, scope: WANDER_SCOPE_ALL_TRACKS})
        const completed = sampler.completedSegmentsAt(0.75)

        expect(completed).toHaveLength(2)
        expect(completed[0].trackSlug).toBe('track#journey#gpx#one')
        expect(completed[0].coordinates).toHaveLength(2)
        expect(completed[1].trackSlug).toBe('track#journey#gpx#two')
        expect(completed[1].coordinates.at(-1)[0]).toBeGreaterThan(1)
        expect(completed[1].coordinates.at(-1)[0]).toBeLessThan(1.001)
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

        expect(new WanderPathSampler({journey, scope: WANDER_SCOPE_VISIBLE_TRACKS}).samples[0].trackSlug)
            .toBe(visible.slug)
        expect(new WanderPathSampler({
            journey,
            scope: WANDER_SCOPE_CURRENT_TRACK,
            trackSlug: hidden.slug,
        }).samples[0].trackSlug).toBe(hidden.slug)
    })
})

describe('wander phase 1 playback controller', () => {
    it('advances from elapsed time rather than point count', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
            }),
        ])
        const sampler = new WanderPathSampler({journey})
        const frames = []
        let now = 0
        const controller = new WanderPlaybackController({
            requestFrame: callback => {
                frames.push(callback)
                return frames.length
            },
            cancelFrame: () => {},
            now:         () => now,
        })
        const updates = []

        controller.on(WANDER_EVENT_UPDATE, detail => updates.push(detail.sample))
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
            }),
        ])
        const sampler = new WanderPathSampler({journey})
        const frames = []
        let now = 0
        const controller = new WanderPlaybackController({
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

    it('syncs serializable samples into the Valtio UI store', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [[0, 0, 0], [0.002, 0, 0]],
            }),
        ])
        const sampler = new WanderPathSampler({journey})
        const previousLgs = globalThis.lgs

        globalThis.lgs = {
            events: {emit: () => {}},
            scene:  {requestRender: () => {}},
            stores: {
                ui: {
                    mainUI: {
                        wander: proxy({
                                          active: false,
                                          playing: false,
                                          paused: false,
                                          progress: 0,
                                          sample: null,
                                      }),
                    },
                },
            },
        }

        try {
            const controller = new WanderPlaybackController({
                requestFrame: () => 1,
                cancelFrame:  () => {},
                now:          () => 0,
            })

            expect(() => controller.configure({sampler, duration: 10})).not.toThrow()
            expect(() => controller.start()).not.toThrow()
            expect(() => JSON.stringify(globalThis.lgs.stores.ui.mainUI.wander.sample)).not.toThrow()
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })
})
