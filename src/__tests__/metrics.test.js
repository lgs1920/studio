/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: metrics.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Journey }                              from '@Core/Journey'
import { Track }                                from '@Core/Track'
import { mkm, mpmile, UnitUtils }               from '@Utils/UnitUtils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const makeLineTrack = ({slug = 'track-1', coordinates, times, hasTime = true, activity = 'trek'}) => {
    return new Track(slug, {
        parent:      'journey#gpx',
        slug,
        name:        slug,
        activity,
        color:       '#ffffff',
        thickness:   2,
        hasTime,
        hasAltitude: true,
        content:     {
            type:       'Feature',
            properties: {
                name:                 slug,
                coordinateProperties: hasTime ? {times} : {},
            },
            geometry:   {
                type: 'LineString',
                coordinates,
            },
        },
    })
}

describe('journey metrics', () => {
    beforeEach(() => {
        const activitySettings = {
            default: 'trek',
            types:   [
                {
                    id:             'trek',
                    label:          'Trek',
                    minSegmentDuration: 2,
                    minSegmentDistance: 3,
                    maxSpeed:       3.0,
                    maxClimbRate:   1.5,
                    maxDescentRate: 2.5,
                    maxPace:        0,
                    maxSpeedDelta:  0,
                    stopDuration:   60,
                    stopSpeedLimit: 0.2,
                },
                {
                    id:             'bike',
                    label:          'Bike',
                    minSegmentDuration: 2,
                    minSegmentDistance: 5,
                    maxSpeed:       16.0,
                    maxClimbRate:   2.5,
                    maxDescentRate: 4.0,
                    maxPace:        0,
                    maxSpeedDelta:  0,
                    stopDuration:   45,
                    stopSpeedLimit: 0.6,
                },
            ],
        }

        vi.stubGlobal('lgs', {
            settings:           {
                getMetrics: {
                    minSlope:       2,
                    stopDuration:   60,
                    stopSpeedLimit: 0.2,
                },
                getJourney: {
                    activity: activitySettings,
                },
            },
            configuration:      {
                journey: {
                    activity: activitySettings,
                },
            },
            savedConfiguration: {
                journey: {
                    activity: activitySettings,
                },
            },
        })
    })

    it('falls back to saved configuration for activity catalog defaults', () => {
        delete globalThis.lgs.settings.getJourney
        globalThis.lgs.savedConfiguration.journey.activity = {
            default: 'ski',
            types:   [
                {
                    id:             'ski',
                    label:          'Ski',
                    maxSpeed:       7.2,
                    maxClimbRate:   1.7,
                    maxDescentRate: 5.4,
                    stopDuration:   75,
                    stopSpeedLimit: 0.35,
                },
            ],
        }
        globalThis.lgs.configuration.journey.activity = globalThis.lgs.savedConfiguration.journey.activity

        expect(Track.defaultActivity()).toBe('ski')
        expect(Track.activityProfiles()).toEqual(globalThis.lgs.savedConfiguration.journey.activity.types)
        expect(Track.activityProfile('ski')).toEqual(expect.objectContaining({
                                                                                 id:             'ski',
                                                                                 maxSpeed:       7.2,
                                                                                 maxClimbRate:   1.7,
                                                                                 maxDescentRate: 5.4,
                                                                                 stopDuration:   75,
                                                                                 stopSpeedLimit: 0.35,
                                                                             }))
    })

    it('computes weighted track speed, pace, altitude, and elevation metrics', () => {
        const track = makeLineTrack({
            coordinates: [
                [0, 0, 100],
                [0.001, 0, 110],
                [0.002, 0, 105],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:00Z',
                '2026-01-01T00:02:00Z',
            ],
        })

        track.extractMetrics()

        const metrics = track.metrics.global

        expect(track.metrics.points).toHaveLength(2)
        expect(metrics.duration).toBe(120)
        expect(metrics.idleTime).toBe(0)
        expect(metrics.distance).toBeGreaterThan(200)
        expect(metrics.averageSpeed).toBeCloseTo(metrics.distance / metrics.duration, 8)
        expect(metrics.averagePace).toBeCloseTo(metrics.duration / metrics.distance, 8)
        expect(metrics.minHeight).toBe(100)
        expect(metrics.maxHeight).toBe(110)
        expect(metrics.positive.elevation).toBe(10)
        expect(metrics.negative.elevation).toBe(-5)
        expect(metrics.maxSpeed).toBeGreaterThan(0)
        expect(metrics.minPace).toBeGreaterThan(0)
    })

    it('counts long stationary segments as idle time', () => {
        const track = makeLineTrack({
            coordinates: [
                [0, 0, 100],
                [0, 0, 100],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:02:00Z',
            ],
        })

        track.extractMetrics()

        expect(track.metrics.global.duration).toBe(120)
        expect(track.metrics.global.idleTime).toBe(120)
        expect(track.metrics.global.averageSpeedMoving).toBe(0)
    })

    it('ignores impossible segments for the selected activity profile', () => {
        const trek = makeLineTrack({
            activity:    'trek',
            coordinates: [
                [0, 0, 100],
                [0.007, 0, 100],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:40Z',
            ],
        })
        const bike = makeLineTrack({
            activity:    'bike',
            coordinates: [
                [0, 0, 100],
                [0.007, 0, 100],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:40Z',
            ],
        })

        trek.extractMetrics()
        bike.extractMetrics()

        expect(trek.metrics.points).toHaveLength(0)
        expect(trek.metrics.global.distance).toBe(0)
        expect(bike.metrics.points).toHaveLength(1)
        expect(bike.metrics.global.distance).toBeGreaterThan(700)
    })

    it('aggregates multi-track journey metrics from track points', () => {
        const track1 = makeLineTrack({
            slug:        'track-1',
            coordinates: [
                [0, 0, 100],
                [0.001, 0, 110],
                [0.002, 0, 105],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:00Z',
                '2026-01-01T00:02:00Z',
            ],
        })
        const track2 = makeLineTrack({
            slug:        'track-2',
            coordinates: [
                [0.003, 0, 90],
                [0.004, 0, 95],
            ],
            times:       [
                '2026-01-01T00:03:00Z',
                '2026-01-01T00:04:00Z',
            ],
        })
        const journey = new Journey('Journey', 'gpx', {
            allowRename: false,
            slug:        'journey#gpx',
            visible:     true,
            POIsVisible: true,
        })

        journey.tracks.set(track1.slug, track1)
        journey.tracks.set(track2.slug, track2)
        journey.hasTime = true
        journey.hasAltitude = true
        journey.metrics = {global: {}, user: {}, external: {}, points: []}

        journey.extractMetrics()

        const metrics = journey.metrics.global
        const expectedDistance = track1.metrics.global.distance + track2.metrics.global.distance
        const expectedDuration = track1.metrics.global.duration + track2.metrics.global.duration

        expect(journey.metrics.points).toHaveLength(3)
        expect(metrics.distance).toBeCloseTo(expectedDistance, 8)
        expect(metrics.duration).toBe(expectedDuration)
        expect(metrics.averageSpeed).toBeCloseTo(expectedDistance / expectedDuration, 8)
        expect(metrics.minHeight).toBe(90)
        expect(metrics.maxHeight).toBe(110)
        expect(metrics.positive.elevation).toBe(15)
        expect(metrics.negative.elevation).toBe(-5)
    })

    it('captures current activity thresholds on journey recalculation', () => {
        globalThis.lgs.settings.getJourney.activity.types[0].maxSpeed = 2.25

        const track = makeLineTrack({
            coordinates: [
                [0, 0, 100],
                [0.001, 0, 100],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:00Z',
            ],
        })
        const journey = new Journey('Journey', 'gpx', {
            allowRename: false,
            slug:        'journey#gpx',
            activity:    'trek',
        })

        journey.tracks.set(track.slug, track)
        journey.hasTime = true
        journey.hasAltitude = true
        journey.metrics = {global: {}, user: {}, external: {}, points: []}

        journey.extractMetrics()

        expect(journey.activitySettings.maxSpeed).toBe(2.25)
        expect(track.activitySettings.maxSpeed).toBe(2.25)
    })

    it('keeps short segments for distance while excluding them from speed extrema', () => {
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDuration = 2
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDistance = 3
        globalThis.lgs.settings.getJourney.activity.types[0].maxSpeed = 20

        const track = makeLineTrack({
            coordinates: [
                [0, 0, 100],
                [0.00002, 0, 100],
                [0.00102, 0, 100],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:01Z',
                '2026-01-01T00:01:01Z',
            ],
        })

        track.extractMetrics()

        expect(track.metrics.points).toHaveLength(2)
        expect(track.metrics.points[0].reliableMotion).toBe(false)
        expect(track.metrics.global.distance).toBeGreaterThan(100)
        expect(track.metrics.global.maxSpeed).toBeLessThan(5)
    })

    it('filters sudden speed spikes from speed and pace extrema', () => {
        globalThis.lgs.settings.getJourney.activity.types[0].maxSpeed = 20
        globalThis.lgs.settings.getJourney.activity.types[0].maxSpeedDelta = 2
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDuration = 1
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDistance = 1

        const track = makeLineTrack({
            coordinates: [
                [0, 0, 100],
                [0.0001, 0, 100],
                [0.0011, 0, 100],
                [0.0012, 0, 100],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:10Z',
                '2026-01-01T00:00:20Z',
                '2026-01-01T00:00:30Z',
            ],
        })

        track.extractMetrics()

        expect(track.metrics.points).toHaveLength(3)
        expect(track.metrics.points[1].reliableMotion).toBe(false)
        expect(track.metrics.global.maxSpeed).toBeLessThan(3)
        expect(track.metrics.global.minPace).toBeGreaterThan(0)
    })

    it('skips malformed coordinates instead of failing metrics calculation', () => {
        const track = makeLineTrack({
            coordinates: [
                [0, 0, 100],
                [null, 0, 105],
                [0.001, 0, 110],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:00Z',
                '2026-01-01T00:02:00Z',
            ],
        })

        expect(() => track.extractMetrics()).not.toThrow()
        expect(track.metrics.points).toHaveLength(1)
        expect(track.metrics.global.distance).toBeGreaterThan(100)
    })

    it('converts pace to metric and imperial display units', () => {
        const fiveMinutesPerKm = 300 / 1000

        expect(UnitUtils.convert(fiveMinutesPerKm).to(mkm)).toBeCloseTo(5, 4)
        expect(UnitUtils.convert(fiveMinutesPerKm).to(mpmile)).toBeCloseTo(8.0467, 4)
    })
})
