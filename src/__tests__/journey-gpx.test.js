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
    applyGpxStyleExtensionProperties, exportJourneyToGeoJSON, exportJourneyToGPX, extractJourneyMetadataFromGeoJson, extractJourneyMetadataFromGpxDocument,
    extractLgsPoiProperties, extractLgsTrackProperties, getExportableJourneyPOIs, getJourneyExportBaseName,
    getJourneyExportFileName, normalizeJourneyExportBaseName, normalizeJourneyExportFileName,
}                               from '@Utils/JourneyGpxUtils'

const trackSlug = 'track#round-trip#gpx#main-track'

const makeJourney = () => ({
    slug:             'round-trip#gpx',
    title:            'Round Trip',
    description:      'A & B',
    location:         'Annecy - Aoste',
    country:          'France - Italy',
    countryCode:      'FR - IT',
    countries:        ['France', 'Italy'],
    countryCodes:     ['FR', 'IT'],
    activity:         'bike',
    activitySettings: {
        id:       'bike',
        maxSpeed: 16,
    },
    renderSmoothing:  {
        enabled: true,
        step:    2,
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
                renderSmoothing: {
                    enabled: true,
                    step:    1,
                },
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
        location:        'Annecy',
        country:         'France',
        countryCode:     'FR',
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
        expect(gpxContent).toContain('<lgs:location>Annecy</lgs:location>')
        expect(gpxContent).toContain('<lgs:countryCode>FR</lgs:countryCode>')
        expect(gpxContent).toContain('<lgs:countryCodes>[&quot;FR&quot;,&quot;IT&quot;]</lgs:countryCodes>')
        expect(gpxContent).toContain('<lgs:renderSmoothing>{&quot;enabled&quot;:true,&quot;step&quot;:2}</lgs:renderSmoothing>')
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
        const trackMetadata = extractLgsTrackProperties(track.properties)

        expect(track.properties.name).toBe('Main Track')
        expect(track.geometry.coordinates[0]).toEqual([6.1, 45.1, 100])
        expect(metadata.activity).toBe('bike')
        expect(metadata.location).toBe('Annecy - Aoste')
        expect(metadata.countryCode).toBe('FR - IT')
        expect(metadata.countries).toEqual(['France', 'Italy'])
        expect(metadata.countryCodes).toEqual(['FR', 'IT'])
        expect(metadata.activitySettings.maxSpeed).toBe(16)
        expect(metadata.renderSmoothing).toEqual({enabled: true, step: 2})
        expect(metadata.POIsVisible).toBe(false)
        expect(trackMetadata.renderSmoothing).toEqual({enabled: true, step: 1})
        expect(poiMetadata.id).toBe('poi-1')
        expect(poiMetadata.category).toBe('summit')
        expect(poiMetadata.location).toBe('Annecy')
        expect(poiMetadata.country).toBe('France')
        expect(poiMetadata.countryCode).toBe('FR')
        expect(poiMetadata.visible).toBe(false)
        expect(poiMetadata.height).toBe(112)
    })

    it('uses raw GPX line style width as pixel track width', () => {
        const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Visorando" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Styled track</name>
    <extensions>
      <line xmlns="http://www.topografix.com/GPX/gpx_style/0/2">
        <color>0000FF</color>
        <width>4</width>
      </line>
    </extensions>
    <trkseg>
      <trkpt lat="45.1" lon="6.1"/>
      <trkpt lat="45.2" lon="6.2"/>
    </trkseg>
  </trk>
</gpx>`
        const document = new DOMParser().parseFromString(gpxContent, 'text/xml')
        const geoJson = gpx(document)
        const track = geoJson.features.find(feature => feature.geometry.type === 'LineString')

        expect(track.properties['stroke-width']).toBeCloseTo(15.118110236220474)

        applyGpxStyleExtensionProperties(geoJson, document)
        const trackMetadata = extractLgsTrackProperties(track.properties)

        expect(track.properties.stroke).toBe('#0000FF')
        expect(track.properties['stroke-width']).toBe(4)
        expect(Object.keys(track.properties)).not.toContain('__lgsGpxStyleWidth')
        expect(trackMetadata.color).toBe('#0000FF')
        expect(trackMetadata.thickness).toBe(4)
        expect(trackMetadata.renderStyle).toEqual({
            widthUnit:     'pixels',
            farPixelWidth: 4,
            color:         '#0000FF',
        })
    })
})

describe('journey GeoJSON export', () => {
    it('exports tracks and associated POIs without start/end POIs', () => {
        const journey = makeJourney()
        const geoJson = JSON.parse(exportJourneyToGeoJSON(journey, {
            pois:      makePois(),
            createdAt: '2026-05-02T10:00:00.000Z',
        }))
        const pointFeatures = geoJson.features.filter(feature => feature.geometry.type === 'Point')
        const lineFeatures = geoJson.features.filter(feature => feature.geometry.type === 'LineString')
        const metadata = extractJourneyMetadataFromGeoJson(geoJson)

        expect(metadata.activity).toBe('bike')
        expect(metadata.countryCode).toBe('FR - IT')
        expect(metadata.countryCodes).toEqual(['FR', 'IT'])
        expect(metadata.activitySettings.maxSpeed).toBe(16)
        expect(metadata.renderSmoothing).toEqual({enabled: true, step: 2})
        expect(pointFeatures).toHaveLength(2)
        expect(lineFeatures).toHaveLength(1)
        expect(pointFeatures.map(feature => feature.properties.name)).toEqual(['Summit & Cafe', 'Shelter'])
        expect(pointFeatures.map(feature => feature.properties.lgs_id)).not.toContain('flag-start')
        expect(pointFeatures[0].properties.lgs_category).toBe('summit')
        expect(pointFeatures[0].properties.lgs_location).toBe('Annecy')
        expect(pointFeatures[0].properties.lgs_countryCode).toBe('FR')
        expect(geoJson.properties.lgs_countryCodes).toEqual(['FR', 'IT'])
        expect(pointFeatures[0].geometry.coordinates).toEqual([6.15, 45.15, 112])
        expect(lineFeatures[0].properties.lgs_color).toBe('#ffcc00')
        expect(lineFeatures[0].properties.lgs_renderSmoothing).toEqual({enabled: true, step: 1})
    })
})

describe('journey export file names', () => {
    it('uses a basename in the dialog field and adds the selected extension only for export', () => {
        const journey = makeJourney()

        expect(getJourneyExportBaseName(journey)).toBe('round-trip')
        expect(getJourneyExportFileName(journey, 'gpx')).toBe('round-trip.gpx')
        expect(getJourneyExportFileName(journey, 'geojson')).toBe('round-trip.geojson')
        expect(getJourneyExportFileName(journey, 'pdf')).toBe('round-trip.pdf')
        expect(getJourneyExportFileName(journey, 'zip')).toBe('round-trip.zip')
        expect(normalizeJourneyExportBaseName('custom.gpx', journey)).toBe('custom')
        expect(normalizeJourneyExportBaseName('custom.geojson', journey)).toBe('custom')
        expect(normalizeJourneyExportBaseName('custom.pdf', journey)).toBe('custom')
        expect(normalizeJourneyExportBaseName('custom.zip', journey)).toBe('custom')
        expect(normalizeJourneyExportFileName('custom', 'geojson', journey)).toBe('custom.geojson')
        expect(normalizeJourneyExportFileName('custom', 'pdf', journey)).toBe('custom.pdf')
        expect(normalizeJourneyExportFileName('custom', 'zip', journey)).toBe('custom.zip')
    })
})
