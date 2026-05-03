/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journey-gpx.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-05-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { describe, expect, it } from 'vitest'
import { gpx }                  from '@tmcw/togeojson'
import {
    exportJourneyToGPX, extractJourneyMetadataFromGpxDocument, extractLgsPoiProperties, getExportableJourneyPOIs,
}                               from '@Utils/JourneyGpxUtils'

const trackSlug = 'track#round-trip#gpx#main-track'

const makeJourney = () => ({
    slug:             'round-trip#gpx',
    title:            'Round Trip',
    description:      'A & B',
    activity:         'bike',
    activitySettings: {
        id:       'bike',
        maxSpeed: 16,
    },
    visible:          true,
    POIsVisible:      false,
    camera:           {range: 1200},
    rotation:         {rpm: 0.3},
    panorama:         {},
    tracks:           new Map([
        [
            trackSlug,
            {
                id:          'track-id',
                slug:        trackSlug,
                parent:      'round-trip#gpx',
                title:       'Main Track',
                description: 'Track description',
                color:       '#ffcc00',
                thickness:   3,
                visible:     true,
                content:     {
                    type:       'Feature',
                    properties: {
                        name:                 'Main Track',
                        coordinateProperties: {
                            times: [
                                '2026-01-01T00:00:00Z',
                                '2026-01-01T00:05:00Z',
                            ],
                        },
                    },
                    geometry:   {
                        type:        'LineString',
                        coordinates: [
                            [6.1, 45.1, 100],
                            [6.2, 45.2, 120],
                        ],
                    },
                },
            },
        ],
    ]),
})

const makePois = () => [
    {
        id:              'poi-1',
        parent:          'round-trip#gpx',
        type:            'poi',
        category:        'summit',
        title:           'Summit & Cafe',
        description:     'Open & visible',
        longitude:       6.15,
        latitude:        45.15,
        height:          112,
        simulatedHeight: 113,
        color:           '#ffffff',
        bgColor:         '#111111',
        visible:         false,
    },
    {
        id:              'poi-2',
        parent:          trackSlug,
        type:            'poi',
        category:        'shelter',
        title:           'Shelter',
        description:     'Attached to track',
        longitude:       6.18,
        latitude:        45.18,
        simulatedHeight: 118,
        visible:         true,
    },
    {
        id:        'flag-start',
        parent:    trackSlug,
        type:      'start',
        title:     'Start',
        longitude: 6.1,
        latitude:  45.1,
    },
    {
        id:        'flag-end',
        parent:    trackSlug,
        type:      'stop',
        title:     'End',
        longitude: 6.2,
        latitude:  45.2,
    },
]

describe('journey GPX export', () => {
    it('exports a standard GPX track and waypoints without start/end POIs', () => {
        const journey = makeJourney()
        const pois = makePois()
        const gpxContent = exportJourneyToGPX(journey, {
            pois,
            createdAt: '2026-05-02T10:00:00.000Z',
        })

        expect(getExportableJourneyPOIs(journey, pois)).toHaveLength(2)
        expect(gpxContent).toContain('<trk>')
        expect(gpxContent).toContain('<trkpt lat="45.1" lon="6.1">')
        expect(gpxContent).toContain('<wpt lat="45.15" lon="6.15">')
        expect(gpxContent).toContain('<name>Summit &amp; Cafe</name>')
        expect(gpxContent).toContain('<lgs:id>poi-1</lgs:id>')
        expect(gpxContent).toContain('<lgs:parentKind>track</lgs:parentKind>')
        expect(gpxContent).not.toContain('<lgs:id>flag-start</lgs:id>')
        expect(gpxContent).not.toContain('<lgs:id>flag-end</lgs:id>')
    })

    it('keeps LGS metadata readable after GPX parsing', () => {
        const journey = makeJourney()
        const gpxContent = exportJourneyToGPX(journey, {
            pois:      makePois(),
            createdAt: '2026-05-02T10:00:00.000Z',
        })
        const document = new DOMParser().parseFromString(gpxContent, 'text/xml')
        const geoJson = gpx(document)
        const waypoint = geoJson.features.find(feature => feature.geometry.type === 'Point' && feature.properties.name === 'Summit & Cafe')
        const track = geoJson.features.find(feature => feature.geometry.type === 'LineString')
        const metadata = extractJourneyMetadataFromGpxDocument(document)
        const poiMetadata = extractLgsPoiProperties(waypoint.properties)

        expect(track.properties.name).toBe('Main Track')
        expect(track.geometry.coordinates[0]).toEqual([6.1, 45.1, 100])
        expect(metadata.activity).toBe('bike')
        expect(metadata.activitySettings.maxSpeed).toBe(16)
        expect(metadata.POIsVisible).toBe(false)
        expect(poiMetadata.id).toBe('poi-1')
        expect(poiMetadata.category).toBe('summit')
        expect(poiMetadata.visible).toBe(false)
        expect(poiMetadata.height).toBe(112)
    })
})
