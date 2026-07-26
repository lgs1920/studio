/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: elevation-coordinate-utils.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-05-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import {
    applyElevationCoordinatesToFeature, flattenFeatureGeometryCoordinates, prepareJourneyElevationCoordinates,
}                                from '@Utils/cesium/elevationCoordinateUtils'

describe('elevation coordinate utils', () => {
    it('counts feature points, not coordinate numbers', () => {
        expect(flattenFeatureGeometryCoordinates({
            type:        'LineString',
            coordinates: [[1, 2, 10], [3, 4, 20]],
        })).toHaveLength(2)

        expect(flattenFeatureGeometryCoordinates({
            type:        'MultiLineString',
            coordinates: [
                [[1, 2, 10], [3, 4, 20]],
                [[5, 6, 30]],
            ],
        })).toHaveLength(3)
    })

    it('restores multiline shape after an elevation calculation', () => {
        const feature = {
            geometry: {
                type:        'MultiLineString',
                coordinates: [
                    [[1, 2], [3, 4]],
                    [[5, 6]],
                ],
            },
        }

        applyElevationCoordinatesToFeature(feature, [[1, 2, 10], [3, 4, 20], [5, 6, 30]])

        expect(feature.geometry.coordinates).toEqual([
            [[1, 2, 10], [3, 4, 20]],
            [[5, 6, 30]],
        ])
    })

    it('keeps original elevation coordinates aligned with flattened journey coordinates', () => {
        const journeyGeoJson = {
            features: [
                {
                    geometry: {
                        type:        'LineString',
                        coordinates: [[1, 2, 100], [3, 4, 200]],
                    },
                },
            ],
        }
        const originGeoJson = {
            features: [
                {
                    geometry: {
                        type:        'LineString',
                        coordinates: [[1, 2, 10], [3, 4, 20]],
                    },
                },
            ],
        }

        expect(prepareJourneyElevationCoordinates(journeyGeoJson, originGeoJson)).toEqual({
            coordinates: [[1, 2], [3, 4]],
            origins:     [[1, 2, 10], [3, 4, 20]],
        })
    })
})
