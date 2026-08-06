/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: metrics.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Journey }                              from '@Core/Journey'
import { Track }                                from '@Core/Track'
import { TrackUtils }                           from '@Utils/cesium/TrackUtils'
import { Utils }                                from '@Editor/Utils'
import { mkm, mpmile, UnitUtils }               from '@Utils/UnitUtils'
import { readFileSync }                         from 'fs'
import { gpx }                                  from '@tmcw/togeojson'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@Utils/UIToast', () => ({
    UIToast: {
        error:   vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
    },
}))

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
                    maxAltitudeJump: 10,
                    altitudeSmoothingWindow: 3,
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
                    maxAltitudeJump: 20,
                    altitudeSmoothingWindow: 3,
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
        expect(metrics.maxHeight).toBe(105)
        expect(metrics.positive.elevation).toBe(5)
        expect(metrics.negative.elevation).toBe(0)
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

    it('keeps geometric distance while excluding impossible segments from speed extrema', () => {
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

        expect(trek.metrics.points).toHaveLength(1)
        expect(trek.metrics.points[0].ignored).toBe('speed')
        expect(trek.metrics.global.distance).toBeCloseTo(bike.metrics.global.distance, 8)
        expect(trek.metrics.global.maxSpeed).toBe(0)
        expect(bike.metrics.points).toHaveLength(1)
        expect(bike.metrics.points[0].ignored).toBe(false)
        expect(bike.metrics.global.distance).toBeGreaterThan(700)
        expect(bike.metrics.global.maxSpeed).toBeGreaterThan(trek.metrics.global.maxSpeed)
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
        expect(metrics.maxHeight).toBe(105)
        expect(metrics.positive.elevation).toBe(10)
        expect(metrics.negative.elevation).toBe(0)
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

    it('smooths noisy altitude before slope and profile metrics', () => {
        globalThis.lgs.settings.getJourney.activity.types[0].altitudeSmoothingWindow = 3
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDuration = 1
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDistance = 1
        globalThis.lgs.settings.getJourney.activity.types[0].maxSpeed = 20

        const track = makeLineTrack({
            coordinates: [
                [0, 0, 100],
                [0.001, 0, 150],
                [0.002, 0, 101],
                [0.003, 0, 102],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:00Z',
                '2026-01-01T00:02:00Z',
                '2026-01-01T00:03:00Z',
            ],
        })

        track.extractMetrics()

        expect(track.metrics.points).toHaveLength(3)
        expect(track.metrics.points[0].altitude).toBe(101)
        expect(track.metrics.points[0].elevation).toBe(1)
        expect(track.metrics.points[0].rawAltitude).toBe(150)
        expect(track.metrics.global.maxHeight).toBe(102)
    })

    it('clips altitude spikes before smoothing', () => {
        globalThis.lgs.settings.getJourney.activity.types[0].maxAltitudeJump = 8
        globalThis.lgs.settings.getJourney.activity.types[0].altitudeSmoothingWindow = 3
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDuration = 1
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDistance = 1
        globalThis.lgs.settings.getJourney.activity.types[0].maxSpeed = 20

        const track = makeLineTrack({
            coordinates: [
                [0, 0, 100],
                [0.001, 0, 140],
                [0.002, 0, 101],
                [0.003, 0, 102],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:00Z',
                '2026-01-01T00:02:00Z',
                '2026-01-01T00:03:00Z',
            ],
        })

        track.extractMetrics()

        expect(track.metrics.points).toHaveLength(3)
        expect(track.metrics.points[0].rawAltitude).toBe(140)
        expect(track.metrics.points[0].altitude).toBe(101)
        expect(track.metrics.points[0].elevation).toBe(1)
        expect(track.metrics.global.maxHeight).toBe(102)
    })

    it('counts gentle uphill elevation even when the slope stays below the minimum slope threshold', () => {
        const track = makeLineTrack({
            hasTime: false,
            coordinates: [
                [0, 0, 100],
                [0.01, 0, 120],
                [0.02, 0, 140],
            ],
        })

        track.extractMetrics()

        expect(track.metrics.points).toHaveLength(2)
        expect(track.metrics.global.positive.elevation).toBe(40)
        expect(track.metrics.global.flat.elevation).toBe(0)
        expect(track.metrics.global.negative.elevation).toBe(0)
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

    it('recomputes all journeys that use the edited activity profile', async () => {
        globalThis.__ = {
            app: {
                deepClone:   value => JSON.parse(JSON.stringify(value)),
                setSlug:     ({content}) => content.join('#').toLowerCase(),
                singleTitle: title => title,
            },
            ui: {
                profiler: {
                    draw: vi.fn(),
                },
            },
            tools: {
                debounce: fn => fn,
            },
        }
        globalThis.lgs.db = {
            lgs1920: {
                put: vi.fn(async () => undefined),
            },
        }
        globalThis.lgs.stores = {
            journeyEditor: {},
            main: {
                components: {
                    journeyEditor: {
                        keys: {
                            journey: {
                                settings: 0,
                            },
                        },
                    },
                },
            },
        }
        globalThis.lgs.saveJourneyInContext = vi.fn((journey) => {
            globalThis.lgs.journeys.set(journey.slug, journey)
        })
        globalThis.lgs.getJourneyBySlug = slug => globalThis.lgs.journeys.get(slug)

        const trekTrack = makeLineTrack({
            slug:        'trek-track',
            activity:    'trek',
            coordinates: [
                [0, 0, 100],
                [0.001, 0, 110],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:00Z',
            ],
        })
        trekTrack.parent = 'trek#gpx'
        const trekSecondTrack = makeLineTrack({
            slug:        'trek-second-track',
            activity:    'trek',
            coordinates: [
                [0, 0, 100],
                [0.001, 0, 110],
            ],
            times:       [
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:01:00Z',
            ],
        })
        trekSecondTrack.parent = 'trek-second#gpx'
        const trekJourney = new Journey('Trek', 'gpx', {
            allowRename: false,
            slug:        'trek#gpx',
            activity:    'trek',
        })
        const trekSecondJourney = new Journey('Trek 2', 'gpx', {
            allowRename: false,
            slug:        'trek-second#gpx',
            activity:    'trek',
        })

        trekJourney.tracks.set(trekTrack.slug, trekTrack)
        trekJourney.hasTime = true
        trekJourney.hasAltitude = true
        trekJourney.metrics = {global: {}, user: {}, external: {}, points: []}

        trekSecondJourney.tracks.set(trekSecondTrack.slug, trekSecondTrack)
        trekSecondJourney.hasTime = true
        trekSecondJourney.hasAltitude = true
        trekSecondJourney.metrics = {global: {}, user: {}, external: {}, points: []}

        trekJourney.extractMetrics()
        trekSecondJourney.extractMetrics()

        globalThis.lgs.journeys = new Map([
            [trekJourney.slug, trekJourney],
            [trekSecondJourney.slug, trekSecondJourney],
        ])
        globalThis.lgs.theJourney = trekJourney
        globalThis.lgs.theJourneyEditorProxy = {
            journey: trekJourney,
            track:   trekTrack,
        }
        globalThis.lgs.settings.getJourney.activity.types[0].minSegmentDistance = 10000

        const secondExtractSpy = vi.spyOn(trekSecondJourney, 'extractMetrics')
        const profileVisibilitySpy = vi.spyOn(TrackUtils, 'setProfileVisibility').mockImplementation(() => {})

        await Utils.refreshJourneysStatistics('trek', {focus: false})

        expect(secondExtractSpy).toHaveBeenCalledTimes(1)
        expect(globalThis.lgs.saveJourneyInContext).toHaveBeenCalledWith(trekSecondJourney)
        expect(trekSecondJourney.metrics.points).toHaveLength(1)
        expect(trekSecondJourney.metrics.global.distance).toBeGreaterThan(100)
        expect(profileVisibilitySpy).toHaveBeenCalled()
    })

    it('matches the expected Mont Blanc journey statistics', () => {
        const document = new DOMParser().parseFromString(
            readFileSync('public/samples/journeys/Mont Blanc.gpx', 'utf8'),
            'text/xml',
        )
        const geoJson = gpx(document)
        const trackFeature = geoJson.features.find(feature => feature?.geometry?.type === 'LineString')
        const track = new Track('MB4806', {
            parent:    'mont-blanc#gpx',
            slug:      'mont-blanc#gpx',
            activity:  'trek',
            color:     '#ffffff',
            thickness: 2,
            hasTime:   true,
            hasAltitude: true,
            content:   trackFeature,
        })

        track.extractMetrics()
        expect(track.metrics.global.distance / 1000).toBeCloseTo(39.94, 2)
        expect(track.metrics.global.duration).toBe(66518)
        expect(track.metrics.global.averageSpeed * 3.6).toBeCloseTo(2.16, 2)
        expect(track.metrics.global.positive.distance).toBeGreaterThan(10000)
        expect(track.metrics.global.negative.distance).toBeGreaterThan(10000)
        expect(track.metrics.global.positive.elevation).toBeCloseTo(4275.33, 2)
        expect(track.metrics.global.negative.elevation).toBeCloseTo(-4210.33, 2)
        expect(track.metrics.global.flat.elevation).toBe(0)
        expect(track.metrics.global.positive.points).toBeGreaterThan(0)
    }, 60000)

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
