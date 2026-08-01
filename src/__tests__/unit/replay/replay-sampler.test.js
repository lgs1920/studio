/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-phase1.test.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-01
 * Last modified: 2026-07-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { REPLAY_DRAWER }                                           from '@Core/constants'
import { createJourneyReplayClipInstance }                                from '@Core/ui/replay/JourneyReplayClips'
import {
    replayAngularDelta, replayCameraHeadingForPositionMode, replayCameraHeadingWithHysteresis,
    replayCameraRangeFromPitch, replayCameraRecenterDuration, replayCameraRecenterHeight,
    replayCameraRecenterHorizontalDistance, replayHeadingEasingFactor, replayHeadingFromLocalAxisAngle,
    replayIsWindowPointOutsideToleranceZone, replayPitchLookaheadFactor, JourneyReplayMode, replayTargetSampleForClip,
    replayToleranceZoneBounds, replayCenteredZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone,
}                                                                      from '@Core/ui/replay/JourneyReplayMode'
import {
    REPLAY_SCOPE_ALL_TRACKS, REPLAY_SCOPE_CURRENT_TRACK, REPLAY_SCOPE_VISIBLE_TRACKS, JourneyReplayPathSampler,
}                                                                      from '@Core/ui/replay/JourneyReplayPathSampler'
import {
    REPLAY_EVENT_END, REPLAY_EVENT_START, REPLAY_EVENT_STOP, REPLAY_EVENT_UPDATE,
    JourneyReplayPlaybackController,
}                                                                      from '@Core/ui/replay/JourneyReplayPlaybackController'
import {
    defaultJourneyReplaySettings, REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_POSITION_AHEAD, REPLAY_CAMERA_POSITION_BEHIND, REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_CAMERA_PRESET_DEFAULT, REPLAY_CAMERA_PRESET_ULTRA_SMOOTH,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE,
    getJourneyReplayCameraPresetKey, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker, normalizeJourneyReplaySettings,
}                                                                      from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { gpx }                                                         from '@tmcw/togeojson'
import { applyGpxStyleExtensionProperties, extractLgsTrackProperties } from '@Utils/JourneyGpxUtils'
import { Cartesian3, Cartographic, Matrix4, Math as CesiumMath, Transforms } from 'cesium'
import { proxy }                                                       from 'valtio'
import { describe, expect, it, vi }                                    from 'vitest'

vi.mock('@Components/Toast', () => ({
    LGS_ERROR_TOAST:       'danger',
    LGS_INFORMATION_TOAST: 'primary',
    LGS_SUCCESS_TOAST:     'success',
    LGS_TOAST_DURATION:    5000,
    LGS_WARNING_TOAST:     'warning',
    showToast:             vi.fn(),
}))


import {makeJourney, makeTrack} from './replay-phase1-fixtures'

describe('replay phase 1 sampler', () => {
    it('samples a GPX track that defines a line style width extension', () => {
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
      <trkpt lat="45.1" lon="6.1"><ele>100</ele><time>2026-05-05T10:00:00.000Z</time></trkpt>
      <trkpt lat="45.2" lon="6.2"><ele>120</ele><time>2026-05-05T10:10:00.000Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
        const document = new DOMParser().parseFromString(gpxContent, 'text/xml')
        const geoJson = gpx(document)
        applyGpxStyleExtensionProperties(geoJson, document)
        const feature = geoJson.features.find(item => item.geometry?.type === 'LineString')
        const trackMetadata = extractLgsTrackProperties(feature.properties)
        const track = {
            slug:        'track#journey#gpx#styled',
            visible:     true,
            renderStyle: trackMetadata.renderStyle,
            content:     feature,
        }
        const journey = makeJourney([track])

        const sampler = new JourneyReplayPathSampler({journey})

        expect(trackMetadata.renderStyle.widthUnit).toBe('pixels')
        expect(sampler.hasSamples).toBe(true)
        expect(sampler.samples).toHaveLength(2)
        expect(sampler.totalDistance).toBeGreaterThan(0)
        expect(sampler.durationMillis).toBe(10 * 60 * 1000)
    })

    it('samples a line by cumulative distance and includes the real first point', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [
                    [0, 0, 100],
                    [0.001, 0, 120],
                    [0.002, 0, 140],
                ],
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey})

        expect(sampler.samples).toHaveLength(3)
        expect(sampler.atProgress(0).longitude).toBe(0)
        expect(sampler.atProgress(0).altitude).toBe(100)
        expect(sampler.atProgress(1).longitude).toBe(0.002)
        expect(sampler.atProgress(1).remainingDistance).toBe(0)

        const middle = sampler.atProgress(0.5)
        expect(middle.longitude).toBeCloseTo(0.001, 5)
        expect(middle.altitude).toBeCloseTo(120, 1)
        expect(middle.distanceFromStart).toBeCloseTo(sampler.totalDistance / 2, 4)
        expect(() => JSON.stringify(middle)).not.toThrow()
        expect(middle.source.startPoint.source).toBeUndefined()
    })

    it('keeps track segments separated while using a global distance timeline', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#one',
                coordinates: [
                    [0, 0, 100],
                    [0.001, 0, 100],
                ],
            }),
            makeTrack({
                slug:        'track#journey#gpx#two',
                coordinates: [
                    [1, 1, 200],
                    [1.001, 1, 200],
                ],
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey, scope: REPLAY_SCOPE_ALL_TRACKS})
        const completed = sampler.completedSegmentsAt(0.75)

        expect(completed).toHaveLength(2)
        expect(completed[0].trackSlug).toBe('track#journey#gpx#one')
        expect(completed[0].coordinates).toHaveLength(2)
        expect(completed[1].trackSlug).toBe('track#journey#gpx#two')
        expect(completed[1].coordinates.at(-1)[0]).toBeGreaterThan(1)
        expect(completed[1].coordinates.at(-1)[0]).toBeLessThan(1.001)
    })

    it('returns only the not-yet-covered coordinates for remaining track rendering', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#main',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.002, 0, 0],
                ],
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey})
        const remaining = sampler.remainingSegmentsAt(0.5)

        expect(remaining).toHaveLength(1)
        expect(remaining[0].coordinates[0][0]).toBeCloseTo(0.001, 5)
        expect(remaining[0].coordinates.at(-1)[0]).toBeCloseTo(0.002, 5)
    })

    it('interpolates journey time on replay samples', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#timed',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.002, 0, 0],
                ],
                times: [
                    '2026-05-05T10:00:00.000Z',
                    '2026-05-05T10:10:00.000Z',
                    '2026-05-05T10:20:00.000Z',
                ],
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey})
        const middle = sampler.atProgress(0.5)

        expect(sampler.durationMillis).toBe(20 * 60 * 1000)
        expect(middle.time).toBe('2026-05-05T10:10:00.000Z')
        expect(middle.journeyElapsedMillis).toBe(10 * 60 * 1000)
        expect(middle.journeyDurationMillis).toBe(20 * 60 * 1000)
    })

    it('falls back to metric point times when coordinate times are missing', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#metric-time',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.002, 0, 0],
                ],
                metrics: {
                    points: [
                        {
                            longitude: 0.001,
                            latitude:  0,
                            altitude:  0,
                            distance:  100,
                            duration:  600,
                            time:      '2026-05-05T10:10:00.000Z',
                        },
                        {
                            longitude: 0.002,
                            latitude:  0,
                            altitude:  0,
                            distance:  100,
                            duration:  600,
                            time:      '2026-05-05T10:20:00.000Z',
                        },
                    ],
                },
            }),
        ])

        const sampler = new JourneyReplayPathSampler({journey})

        expect(sampler.durationMillis).toBe(20 * 60 * 1000)
        expect(sampler.atProgress(0.5).journeyElapsedMillis).toBe(10 * 60 * 1000)
    })

    it('filters visible and current tracks according to scope', () => {
        const visible = makeTrack({
            slug:        'track#journey#gpx#visible',
            coordinates: [[0, 0, 0], [0.001, 0, 0]],
        })
        const hidden = makeTrack({
            slug:        'track#journey#gpx#hidden',
            visible:     false,
            coordinates: [[1, 1, 0], [1.001, 1, 0]],
        })
        const journey = makeJourney([visible, hidden])

        expect(new JourneyReplayPathSampler({journey, scope: REPLAY_SCOPE_VISIBLE_TRACKS}).samples[0].trackSlug)
            .toBe(visible.slug)
        expect(new JourneyReplayPathSampler({
            journey,
            scope: REPLAY_SCOPE_CURRENT_TRACK,
            trackSlug: hidden.slug,
        }).samples[0].trackSlug).toBe(hidden.slug)
    })

    it('uses local timed speed instead of a route-length percentage for lookahead', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#local-lookahead',
                coordinates: [
                    [0, 0, 0],
                    [0.1, 0, 0],
                    [0.2, 0, 0],
                ],
                times: [
                    '2026-05-05T10:00:00.000Z',
                    '2026-05-05T10:18:20.000Z',
                    '2026-05-05T10:36:40.000Z',
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const anchor = sampler.atProgress(0.25)
        const predicted = sampler.lookaheadAtProgress(0.25, {
            seconds:       5,
            minimumMeters: 0,
        })

        expect(predicted.distanceFromStart - anchor.distanceFromStart).toBeCloseTo(50, -1)
        expect(predicted.distanceFromStart - anchor.distanceFromStart).toBeLessThan(sampler.totalDistance * 0.01)
    })

    it('starts turning the heading before a sharp route corner', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#turn-lookahead',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.001, 0.001, 0],
                ],
                times: [
                    '2026-05-05T10:00:00.000Z',
                    '2026-05-05T10:00:10.000Z',
                    '2026-05-05T10:00:20.000Z',
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const currentHeading = sampler.headingAtProgress(0.35)
        const anticipatedHeading = sampler.headingAtProgress(0.35, {
            lookaheadSeconds: 5,
            windowSeconds:   2.5,
            minimumMeters:   10,
        })

        expect(Math.abs(anticipatedHeading - currentHeading)).toBeGreaterThan(0.2)
        expect(Math.abs(anticipatedHeading - currentHeading)).toBeLessThan(Math.PI / 2)
    })

    it('does not follow alternating small zigzags as camera heading changes', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#zigzag-heading-window',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0.00008, 0],
                    [0.002, 0, 0],
                    [0.003, 0.00008, 0],
                    [0.004, 0, 0],
                    [0.005, 0.00008, 0],
                    [0.006, 0, 0],
                    [0.007, 0.00008, 0],
                    [0.008, 0, 0],
                    [0.009, 0.00008, 0],
                    [0.01, 0, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const headings = [0.3, 0.4, 0.5, 0.6, 0.7].map(progress => sampler.headingAtProgress(progress, {
            lookaheadSeconds: 2.5,
            windowSeconds:   2.5,
            minimumMeters:   400,
        }))
        const eastHeading = Math.PI / 2
        const maximumDeviation = Math.max(
            ...headings.map(heading => Math.abs(replayAngularDelta(heading, eastHeading))),
        )

        expect(maximumDeviation).toBeLessThan(0.2)
    })
})
