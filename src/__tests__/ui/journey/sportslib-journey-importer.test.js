/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: sportslib-journey-importer.test.js
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

import {importJourneyContent, mapSportToStudioActivity} from '@Utils/importers/SportsLibJourneyImporter'

const TCX_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<tcx:TrainingCenterDatabase xmlns:tcx="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
 xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
 xmlns:custom="urn:vendor:unknown">
  <tcx:Activities>
    <tcx:Activity Sport="Biking">
      <tcx:Id>2026-10-23T09:00:00Z</tcx:Id>
      <tcx:Lap StartTime="2026-10-23T09:00:00Z">
        <tcx:TotalTimeSeconds>20</tcx:TotalTimeSeconds><tcx:DistanceMeters>40</tcx:DistanceMeters>
        <tcx:Calories>4</tcx:Calories><tcx:Track>
          <tcx:Trackpoint><tcx:Time>2026-10-23T09:00:00Z</tcx:Time><tcx:Position><tcx:LatitudeDegrees>45</tcx:LatitudeDegrees><tcx:LongitudeDegrees>6</tcx:LongitudeDegrees></tcx:Position><tcx:AltitudeMeters>100</tcx:AltitudeMeters><tcx:DistanceMeters>0</tcx:DistanceMeters><tcx:HeartRateBpm><tcx:Value>120</tcx:Value></tcx:HeartRateBpm><tcx:Cadence>80</tcx:Cadence><tcx:Extensions><ns3:TPX><ns3:Watts>180</ns3:Watts><ns3:Speed>2</ns3:Speed></ns3:TPX><custom:Unknown>preserved by parser</custom:Unknown></tcx:Extensions></tcx:Trackpoint>
          <tcx:Trackpoint><tcx:Time>2026-10-23T09:00:01Z</tcx:Time><tcx:Position><tcx:LatitudeDegrees>45.001</tcx:LatitudeDegrees><tcx:LongitudeDegrees>6.001</tcx:LongitudeDegrees></tcx:Position><tcx:AltitudeMeters>101</tcx:AltitudeMeters><tcx:DistanceMeters>40</tcx:DistanceMeters><tcx:HeartRateBpm><tcx:Value>121</tcx:Value></tcx:HeartRateBpm><tcx:Cadence>81</tcx:Cadence><tcx:Extensions><ns3:TPX><ns3:Watts>190</ns3:Watts></ns3:TPX></tcx:Extensions></tcx:Trackpoint>
        </tcx:Track></tcx:Lap>
      <tcx:Lap StartTime="2026-10-23T09:05:00Z">
        <tcx:TotalTimeSeconds>20</tcx:TotalTimeSeconds><tcx:DistanceMeters>40</tcx:DistanceMeters>
        <tcx:Calories>4</tcx:Calories><tcx:Track>
          <tcx:Trackpoint><tcx:Time>2026-10-23T09:05:00Z</tcx:Time><tcx:Position><tcx:LatitudeDegrees>45.01</tcx:LatitudeDegrees><tcx:LongitudeDegrees>6.01</tcx:LongitudeDegrees></tcx:Position><tcx:AltitudeMeters>110</tcx:AltitudeMeters><tcx:DistanceMeters>0</tcx:DistanceMeters><tcx:HeartRateBpm><tcx:Value>122</tcx:Value></tcx:HeartRateBpm><tcx:Cadence>82</tcx:Cadence><tcx:Extensions><ns3:TPX><ns3:Watts>200</ns3:Watts></ns3:TPX></tcx:Extensions></tcx:Trackpoint>
          <tcx:Trackpoint><tcx:Time>2026-10-23T09:05:01Z</tcx:Time><tcx:Position><tcx:LatitudeDegrees>45.011</tcx:LatitudeDegrees><tcx:LongitudeDegrees>6.011</tcx:LongitudeDegrees></tcx:Position><tcx:AltitudeMeters>111</tcx:AltitudeMeters><tcx:DistanceMeters>40</tcx:DistanceMeters><tcx:HeartRateBpm><tcx:Value>123</tcx:Value></tcx:HeartRateBpm><tcx:Cadence>83</tcx:Cadence><tcx:Extensions><ns3:TPX><ns3:Watts>210</ns3:Watts></ns3:TPX></tcx:Extensions></tcx:Trackpoint>
        </tcx:Track></tcx:Lap>
    </tcx:Activity>
  </tcx:Activities>
</tcx:TrainingCenterDatabase>`

describe('SportsLibJourneyImporter', () => {
    it.each([
        ['Running', 'running'],
        ['Road Running', 'running'],
        ['Trail Running', 'trail'],
        ['Road Cycling', 'bike'],
        ['Mountain Biking', 'bike'],
        ['Hiking', 'trek'],
        ['Walking', 'trek'],
        ['Ski Touring', 'ski-touring'],
        ['Backcountry Skiing', 'ski-touring'],
        ['Alpine Skiing', 'alpine-skiing'],
        ['Crosscountry Skiing', 'cross-country-skiing'],
        ['Classic Crosscountry Skiing', 'cross-country-skiing'],
        ['Cross-country Skiing', 'cross-country-skiing'],
        ['Open Water Swimming', 'open-water-swimming'],
        ['Swimming', null],
        ['Other', null],
    ])('maps %s to Studio activity %s', (sport, expected) => {
        expect(mapSportToStudioActivity(sport)).toBe(expected)
    })

    it('normalizes prefixed TCX, preserves lap pauses and sensor observations', async () => {
        const imported = await importJourneyContent({
            format: 'tcx',
            content: TCX_SAMPLE,
            fileName: 'ride.tcx',
            contentHash: 'content-hash',
        })
        const feature = imported.geoJson.features[0]

        expect(feature.geometry.type).toBe('MultiLineString')
        expect(feature.geometry.coordinates).toHaveLength(2)
        expect(feature.geometry.coordinates[0][0]).toEqual([6, 45, 100])
        expect(feature.properties.coordinateProperties.times[1][0]).toBe('2026-10-23T09:05:00.000Z')
        expect(feature.properties.observations.streams['Heart Rate']).toEqual([120, 121, 122, 123])
        expect(feature.properties.observations.streams.Cadence).toEqual([80, 81, 82, 83])
        expect(feature.properties.observations.streams.Power).toEqual([180, 190, 200, 210])
        expect(imported.sourceMetadata.lapCount).toBe(2)
        expect(imported.sourceMetadata.originalFileName).toBe('ride.tcx')
        expect(imported.sourceMetadata.contentHash).toBe('content-hash')
        expect(feature.properties.sourceMetadata.sport).toBe('Biking')
        expect(imported.activity).toBe('bike')
        expect(imported.sourceMetadata.warnings).toEqual([])
    })

    it('maps a TCX running activity to the running profile', async () => {
        const imported = await importJourneyContent({
            format: 'tcx',
            content: TCX_SAMPLE.replace('Sport="Biking"', 'Sport="Running"'),
        })

        expect(imported.activity).toBe('running')
    })

    it('rejects TCX activities without two usable GPS positions', async () => {
        const noGps = TCX_SAMPLE.replace(/<tcx:Position>[\s\S]*?<\/tcx:Position>/g, '')

        await expect(importJourneyContent({format: 'tcx', content: noGps})).rejects.toMatchObject({code: 'no_usable_gps'})
    })

    it('rejects a FIT file with a corrupted file CRC using a specific error', async () => {
        const bytes = new Uint8Array(14)
        bytes[0] = 12
        bytes[1] = 0x20
        bytes.set([0x2E, 0x46, 0x49, 0x54], 8)
        const dataView = new DataView(bytes.buffer)
        dataView.setUint16(12, 0x1234, true)

        await expect(importJourneyContent({format: 'fit', content: bytes.buffer})).rejects.toMatchObject({code: 'invalid_fit_crc'})
    })
})
