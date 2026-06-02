/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poi-journey-association.test.js
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
    findNearestJourneyPointDistance, getJourneyReferencePoints,
}                                from '@Core/ui/POIManager'

const makeJourney = (coordinates, type = 'LineString') => ({
    slug:   'near#gpx',
    title:  'Near Journey',
    tracks: new Map([
        [
            'near#gpx#track',
            {
                slug:    'near#gpx#track',
                content: {
                    geometry: {
                        type,
                        coordinates,
                    },
                },
            },
        ],
    ]),
})

describe('POI journey association distance', () => {
    it('extracts reference points from line and multiline journeys', () => {
        const line = makeJourney([[6.1, 45.1], [6.2, 45.2]])
        const multiLine = makeJourney([[[6.1, 45.1]], [[6.3, 45.3]]], 'MultiLineString')

        expect(getJourneyReferencePoints(line)).toEqual([
            {longitude: 6.1, latitude: 45.1},
            {longitude: 6.2, latitude: 45.2},
        ])
        expect(getJourneyReferencePoints(multiLine)).toEqual([
            {longitude: 6.1, latitude: 45.1},
            {longitude: 6.3, latitude: 45.3},
        ])
    })

    it('accepts only journeys with at least one point inside the threshold', () => {
        const journey = makeJourney([[6.1, 45.1], [6.2, 45.2]])
        const nearPoi = {longitude: 6.102, latitude: 45.101}
        const farPoi = {longitude: 7.5, latitude: 46.5}

        const nearDistance = findNearestJourneyPointDistance({
                                                                 poi:               nearPoi,
                                                                 journey,
                                                                 maxDistanceMeters: 10_000,
                                                             })
        const farDistance = findNearestJourneyPointDistance({
                                                                poi:               farPoi,
                                                                journey,
                                                                maxDistanceMeters: 10_000,
                                                            })

        expect(nearDistance).toBeGreaterThan(0)
        expect(nearDistance).toBeLessThan(10_000)
        expect(farDistance).toBeNull()
    })
})
