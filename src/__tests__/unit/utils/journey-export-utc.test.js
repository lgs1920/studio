/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-export-utc.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {describe, expect, it} from 'vitest'
import {exportJourneyToGeoJSON, exportJourneyToGPX} from '@Utils/JourneyGpxUtils'

const createJourney = () => {
    const track = {
        slug:    'track-1',
        title:   'Track',
        content: {
            type:       'Feature',
            properties: {
                name:                'Track',
                coordinateProperties: {
                    times: [
                        '2026-06-01T14:00:00+02:00',
                        '2026-06-01T15:00:00+02:00',
                    ],
                },
            },
            geometry: {
                type:        'LineString',
                coordinates: [[6.1, 45.1, 100], [6.2, 45.2, 110]],
            },
        },
    }
    const poi = {
        id:        'poi-1',
        parent:    'journey-1',
        title:     'POI',
        longitude: 6.15,
        latitude:  45.15,
        time:      '2026-06-01T16:00:00+02:00',
    }

    return {
        journey: {
            slug:   'journey-1',
            title:  'Journey',
            tracks: new Map([[track.slug, track]]),
        },
        track,
        poi,
    }
}

describe('journey export timestamps', () => {
    it('serializes GPX and GeoJSON timestamps in UTC without changing the Journey data', () => {
        const {journey, track, poi} = createJourney()
        const options = {
            pois:      [poi],
            createdAt: '2026-06-01T18:00:00+02:00',
        }

        const gpx = exportJourneyToGPX(journey, options)
        const geoJson = JSON.parse(exportJourneyToGeoJSON(journey, options))
        const exportedTrack = geoJson.features.find(feature => feature.geometry.type === 'LineString')
        const exportedPoi = geoJson.features.find(feature => feature.geometry.type === 'Point')

        expect(gpx).toContain('<time>2026-06-01T12:00:00.000Z</time>')
        expect(gpx).toContain('<time>2026-06-01T14:00:00.000Z</time>')
        expect(geoJson.properties.time).toBe('2026-06-01T16:00:00.000Z')
        expect(exportedTrack.properties.coordinateProperties.times).toEqual([
            '2026-06-01T12:00:00.000Z',
            '2026-06-01T13:00:00.000Z',
        ])
        expect(exportedPoi.properties.time).toBe('2026-06-01T14:00:00.000Z')
        expect(track.content.properties.coordinateProperties.times[0]).toBe('2026-06-01T14:00:00+02:00')
        expect(poi.time).toBe('2026-06-01T16:00:00+02:00')
    })
})
