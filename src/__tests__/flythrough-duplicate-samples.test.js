/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythrough-duplicate-samples.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-29
 * Last modified: 2026-06-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    FLYTHROUGH_SCOPE_VISIBLE_TRACKS,
    FlythroughPathSampler,
} from '@Core/ui/flythrough/FlythroughPathSampler'
import { FlythroughMode } from '@Core/ui/flythrough/FlythroughMode'
import { FlythroughPlaybackController } from '@Core/ui/flythrough/FlythroughPlaybackController'
import { defaultFlythroughSettings } from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { proxy } from 'valtio'
import { describe, expect, it } from 'vitest'

const makeTrack = ({
                       slug,
                       visible = true,
                       coordinates,
                       type = 'LineString',
                   }) => ({
    slug,
    visible,
    content: {
        type:     'Feature',
        geometry: {
            type,
            coordinates,
        },
    },
})

const makeJourney = tracks => ({
    slug:   'journey#duplicate-samples',
    tracks: new Map(tracks.map(track => [track.slug, track])),
})

describe('flythrough duplicate samples regression', () => {
    it('keeps duplicate coordinates as distinct flythrough samples', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#duplicate#main',
                coordinates: [
                    [2, 48, 120],
                    [2, 48, 120],
                    [2.001, 48.001, 130],
                ],
            }),
        ])

        const sampler = new FlythroughPathSampler({journey})

        expect(sampler.hasSamples).toBe(true)
        expect(sampler.samples).toHaveLength(3)
        expect(sampler.samples[0].distanceFromStart).toBe(0)
        expect(sampler.samples[1].distanceFromStart).toBe(0)
        expect(sampler.samples[2].distanceFromStart).toBeGreaterThan(0)
        expect(sampler.atProgress(1).longitude).toBeCloseTo(2.001, 6)
    })

    it('interpolates across duplicate coordinates without collapsing the path', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#duplicate#interpolation',
                coordinates: [
                    [2, 48, 120],
                    [2, 48, 120],
                    [2.001, 48.001, 130],
                ],
            }),
        ])

        const sampler = new FlythroughPathSampler({
            journey,
            scope: FLYTHROUGH_SCOPE_VISIBLE_TRACKS,
        })

        const sample = sampler.atProgress(0.5)

        expect(sample).toBeTruthy()
        expect(sample.interpolated).toBe(true)
        expect(sample.longitude).toBeGreaterThan(2)
        expect(sample.longitude).toBeLessThan(2.001)
        expect(sample.latitude).toBeGreaterThan(48)
        expect(sample.latitude).toBeLessThan(48.001)
        expect(sample.altitude).toBe(125)
        expect(sample.source.startPoint).toBeTruthy()
        expect(sample.source.endPoint).toBeTruthy()
    })

    it('preserves duplicate coordinates in the rendered completed segment', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#duplicate#completed',
                coordinates: [
                    [2, 48, 120],
                    [2, 48, 120],
                    [2.001, 48.001, 130],
                ],
            }),
        ])

        const sampler = new FlythroughPathSampler({
            journey,
            scope: FLYTHROUGH_SCOPE_VISIBLE_TRACKS,
        })

        const completed = sampler.completedSegmentsAt(1)

        expect(completed).toHaveLength(1)
        expect(completed[0].coordinates).toHaveLength(3)
        expect(completed[0].coordinates[0]).toEqual([2, 48, 120])
        expect(completed[0].coordinates[1]).toEqual([2, 48, 120])
        expect(completed[0].coordinates[2]).toEqual([2.001, 48.001, 130])
    })

    it('starts a flythrough without crashing on duplicated camera-guide points', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#duplicate#start',
                coordinates: [
                    [2, 48, 120],
                    [2, 48, 120],
                    [2.001, 48.001, 130],
                ],
            }),
        ])
        const previousLgs = globalThis.lgs
        const flythrough = defaultFlythroughSettings()
        const appCanvas = {
            clientWidth:         1000,
            clientHeight:        1000,
            addEventListener:    () => {},
            removeEventListener: () => {},
        }
        const renderer = {
            clear:  () => {},
            show:   () => {},
            update: () => {},
        }

        globalThis.lgs = {
            theJourney: journey,
            theTrack:   null,
            settings:   {
                ui: {
                    flythrough,
                    journeyToolbar: {show: true},
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
                    heading:              0.2,
                    pitch:                -Math.PI / 4,
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
                    flyTo:                () => {},
                    setView:              () => {},
                    lookAtTransform:      () => {},
                },
            },
            scene:      {
                canvas:                       appCanvas,
                requestRender:                () => {},
                cartesianToCanvasCoordinates: () => ({x: 500, y: 400}),
                globe:                        {getHeight: () => 120},
            },
        }

        try {
            const mode = new FlythroughMode({
                controller: new FlythroughPlaybackController({
                    requestFrame: () => 1,
                    cancelFrame:  () => {},
                    now:          () => 0,
                }),
                renderer,
            })

            expect(() => mode.start()).not.toThrow()
        }
        finally {
            globalThis.lgs = previousLgs
        }
    })
})
