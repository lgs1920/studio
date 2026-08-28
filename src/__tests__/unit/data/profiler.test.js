/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: profiler.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-09
 * Last modified: 2026-06-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Utils/UnitUtils', () => ({
    DISTANCE_UNITS:  ['km', 'mi'],
    ELEVATION_UNITS: ['m', 'ft'],
    INTERNATIONAL:   0,
    UnitUtils:       {
        convert: value => ({
            to: unit => unit === 'km'
                        ? value / 1000
                        : value,
        }),
    },
}))

vi.mock('@Utils/cesium/trackRenderStyle', () => ({
    normalizeTrackRenderStyle: (style, fallback) => ({
        color:     style?.color ?? fallback.color,
        farPixelWidth: fallback.thickness,
    }),
}))

vi.mock('@Utils/cesium/trackRenderSmoothing', () => ({
    TRACK_RENDER_SMOOTHING_MAX_STEP: 6,
    TRACK_RENDER_SMOOTHING_MIN_STEP: 1,
    getTrackRenderContent: track => track.__renderGeometry
                                   ? {geometry: track.__renderGeometry}
                                   : null,
}))

vi.mock('@Utils/Mobility', () => ({
    Mobility: {
        distance: (start, end) => Math.abs((end?.longitude ?? 0) - (start?.longitude ?? 0)) * 100,
    },
}))

import { Profiler } from '@Core/ui/Profiler'

describe('Profiler.prepareData', () => {
    beforeEach(() => {
        globalThis.__ = {
            convert: value => ({
                to: unit => unit === 'km'
                            ? value / 1000
                            : value,
            }),
        }

        globalThis.lgs = {
            theJourney: {
                tracks: new Map([
                    ['track-a', {
                        slug:        'track-a',
                        title:       'Track A',
                        color:       '#111111',
                        thickness:   2,
                        visible:     true,
                        renderStyle: {color: '#111111'},
                        metrics:     {
                            points: [
                                {distance: 100, altitude: 100},
                                {distance: 100, altitude: 110},
                            ],
                        },
                    }],
                    ['track-b', {
                        slug:        'track-b',
                        title:       'Track B',
                        color:       '#222222',
                        thickness:   2,
                        visible:     false,
                        renderStyle: {color: '#222222'},
                        metrics:     {
                            points: [
                                {distance: 100, altitude: 120},
                                {distance: 100, altitude: 130},
                            ],
                        },
                    }],
                    ['track-c', {
                        slug:        'track-c',
                        title:       'Track C',
                        color:       '#333333',
                        thickness:   2,
                        visible:     true,
                        renderStyle: {color: '#333333'},
                        metrics:     {
                            points: [
                                {distance: 100, altitude: 140},
                                {distance: 100, altitude: 150},
                            ],
                        },
                    }],
                ]),
            },
            settings:   {
                unitSystem: {
                    current: 0,
                },
            },
        }
    })

    afterEach(() => {
        Profiler.instance = null
        globalThis.__ = undefined
        globalThis.lgs = undefined
    })

    it('keeps cumulative distance across hidden tracks so later profile points stay aligned', () => {
        const profiler = new Profiler(globalThis.lgs)
        const data = profiler.prepareData()

        expect(data.dataset.map(dataset => dataset.id)).toEqual(['track-a', 'track-c'])
        expect(data.dataset[0].source[1][0]).toBeCloseTo(0.2, 6)
        expect(data.dataset[1].source[0][0]).toBeCloseTo(0.5, 6)
        expect(data.dataset[1].source[1][0]).toBeCloseTo(0.6, 6)
    })

    it('uses the rendered geometry distance when a track is smoothed', () => {
        globalThis.lgs.theJourney.tracks.set('track-d', {
            slug:        'track-d',
            title:       'Track D',
            color:       '#444444',
            thickness:   2,
            visible:     true,
            renderStyle: {color: '#444444'},
            __renderGeometry: {
                type:        'LineString',
                coordinates: [
                    [0, 0, 100],
                    [1, 0, 110],
                    [2, 0, 120],
                ],
            },
            metrics:     {
                points: [
                    {distance: 50, altitude: 100},
                    {distance: 50, altitude: 120},
                ],
            },
        })

        const profiler = new Profiler(globalThis.lgs)
        const data = profiler.prepareData()
        const dataset = data.dataset.find(item => item.id === 'track-d')

        expect(dataset.source).toHaveLength(3)
        expect(dataset.source[0][0]).toBeCloseTo(0.6, 6)
        expect(dataset.source[1][0]).toBeCloseTo(0.7, 6)
        expect(dataset.source[2][0]).toBeCloseTo(0.8, 6)
    })
})
