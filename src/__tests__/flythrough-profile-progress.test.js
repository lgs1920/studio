/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: flythrough-profile-progress.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it, vi } from 'vitest'
import {
    appendFlythroughProfileMetadata,
    buildFlythroughCompletedProfileSource,
    createFlythroughProfileDatasetLookup,
    extendFlythroughProfileDimensions,
    flythroughProfileRowFromSample,
    flythroughSampleFromProfileRow,
} from '@Core/ui/flythrough/FlythroughProfileProgress'

vi.mock('@Utils/UnitUtils', () => ({
    DISTANCE_UNITS:  ['km', 'mi'],
    ELEVATION_UNITS: ['m', 'ft'],
    INTERNATIONAL:  0,
    UnitUtils:      {
        convert: value => ({
            to: unit => unit === 'km'
                        ? value / 1000
                        : unit === 'mi'
                          ? value / 1609.344
                          : unit === 'ft'
                            ? value * 3.28084
                            : value,
        }),
    },
}))

const dimensions = extendFlythroughProfileDimensions(['Distance', 'Elevation', 'Time', 'point'])

const row = (distanceFromStart, elevation = 100) => appendFlythroughProfileMetadata([
    distanceFromStart / 1000,
    elevation,
    null,
    {longitude: distanceFromStart / 1000, latitude: 0, altitude: elevation},
], {
    distanceFromStart,
    trackSlug: 'track-a',
    trackIndex: 0,
    pointIndex: distanceFromStart / 100,
})

describe('flythrough profile progress', () => {
    it('cuts a completed profile source by cumulative distance and appends the interpolated sample', () => {
        const dataset = {
            id:     'track-a',
            source: [
                row(0, 100),
                row(100, 110),
                row(200, 120),
            ],
        }
        const lookup = createFlythroughProfileDatasetLookup(dataset, dimensions)
        const source = buildFlythroughCompletedProfileSource({
            dataset,
            lookup,
            dimensions,
            sample: {
                distanceFromStart: 150,
                longitude:         0.0015,
                latitude:          0,
                altitude:          115,
                trackSlug:         'track-a',
                trackIndex:        0,
                pointIndex:        1,
            },
        })

        expect(source).toHaveLength(3)
        expect(source[0][0]).toBe(0)
        expect(source[1][0]).toBe(0.1)
        expect(source[2][0]).toBe(0.15)
        expect(source[2][1]).toBe(115)
    })

    it('maps samples and profile rows without losing flythrough metadata', () => {
        const sample = {
            distanceFromStart: 123,
            longitude:         1,
            latitude:          2,
            altitude:          456,
            trackSlug:         'track-a',
            trackIndex:        0,
            pointIndex:        3,
        }
        const profileRow = flythroughProfileRowFromSample(sample, {dimensions})
        const sampler = {atDistance: vi.fn(distance => ({...sample, distanceFromStart: distance}))}
        const restored = flythroughSampleFromProfileRow(profileRow, dimensions, sampler)

        expect(profileRow[0]).toBe(0.123)
        expect(profileRow[1]).toBe(456)
        expect(restored.distanceFromStart).toBe(123)
        expect(sampler.atDistance).toHaveBeenCalledWith(123)
    })
})
