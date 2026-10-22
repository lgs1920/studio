/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: replay-sampler.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-10-22
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
import {cameraMotionAtProgress}                                          from '@Core/ui/replay/JourneyReplayCameraGuide'
import {smoothReplayCameraAnchorSample}                                  from '@Core/ui/replay/JourneyReplayCameraAnchorSmoothing'
import {
    replayCameraCropWidthMeters,
    replayCameraHeadingWindowMeters,
    replayCameraPositionSmoothingWindowMeters,
}                                                                      from '@Core/ui/replay/JourneyReplayCameraMotionSmoothing'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE}      from '@Core/ui/replay/JourneyReplayInternal'
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

    it('keeps a time-based Navigation lookahead below the old metric floor', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#navigation-time-lookahead',
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
            seconds:       2,
            minimumMeters: 0,
        })
        const distanceDelta = predicted.distanceFromStart - anchor.distanceFromStart

        expect(distanceDelta).toBeGreaterThan(0)
        expect(distanceDelta).toBeLessThan(32)
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

    it('moves the camera anchor along a chord when a zigzag is under half the crop width', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#camera-zigzag-chord',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0.0002, 0],
                    [0.002, 0, 0],
                    [0.003, 0.0002, 0],
                    [0.004, 0, 0],
                    [0.005, 0.0002, 0],
                    [0.006, 0, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const routeSample = sampler.atProgress(0.45)
        const cameraMotion = sampler.cameraMotionAtProgress(0.45, {cropZoneWidthMeters: 1000})

        expect(cameraMotion.zigzagSimplified).toBe(true)
        expect(cameraMotion.zigzagAmplitudeMeters).toBeLessThan(500)
        expect(Math.abs(cameraMotion.sample.latitude)).toBeLessThan(0.00001)
        expect(Math.abs(routeSample.latitude)).toBeGreaterThan(0.00001)
        expect(cameraMotion.heading).toBeCloseTo(Math.PI / 2, 1)
        expect(sampler.cameraMotionAtProgress(0.45, {
            cropZoneWidthMeters: cameraMotion.zigzagAmplitudeMeters * 2,
        }).zigzagSimplified).toBe(false)
    })

    it('keeps the anticipated heading when a camera anchor simplifies a local zigzag', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#zigzag-anchor-heading',
                coordinates: [
                    [0, 0, 0],
                    [0, 0.01, 0],
                    [0.001, 0.0102, 0],
                    [0.002, 0.0098, 0],
                    [0.003, 0.0102, 0],
                    [0.004, 0.0098, 0],
                    [0.005, 0.0102, 0],
                    [0.005, 0.02, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const progress = 0.5
        const options = {
            cropZoneWidthMeters: 10000,
            lookaheadSeconds:   4,
            windowSeconds:      4,
            minimumMeters:      5000,
            maximumMeters:      5000,
        }
        const motion = sampler.cameraMotionAtProgress(progress, options)
        const anticipatedHeading = sampler.headingAtProgress(progress, options)
        const routeOverallHeading = Math.atan2(0.005, 0.02)

        expect(motion.zigzagSimplified).toBe(true)
        expect(motion.heading).toBeCloseTo(anticipatedHeading, 8)
        expect(Math.abs(replayAngularDelta(motion.heading, routeOverallHeading))).toBeLessThan(0.25)
        expect(Math.abs(replayAngularDelta(motion.heading, Math.PI / 2))).toBeGreaterThan(0.7)
    })

    it('scales camera heading anticipation to the configured Replay duration', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#duration-aware-camera-heading',
                coordinates: [
                    [0, 0, 0],
                    [0.1, 0, 0],
                    [0.1, 0.01, 0],
                    [0.2, 0.01, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {
                sampler,
                controller: {duration: 10},
            },
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cesiumViewer: () => ({camera: {frustum: {aspectRatio: 1.33, fovy: Math.PI / 3}}}),
                constrainedReplayProjectionViewport: () => ({
                    width: 1000,
                    height: 750,
                    canvasWidth: 1000,
                    canvasHeight: 750,
                }),
            },
        }
        const cameraSettings = {
            altitude: 10000,
            altitudeMode: REPLAY_CAMERA_ALTITUDE_CONSTANT,
            pitch: -90,
            hysteresis: {easing: 0.3},
        }
        const progress = 0.475
        const lookaheadSeconds = 3.4
        const headingWindowMeters = replayCameraHeadingWindowMeters({
            totalDistanceMeters: sampler.totalDistance,
            durationSeconds: 10,
            lookaheadSeconds,
            minimumMeters: 400,
        })
        const positionSmoothingWindowMeters = replayCameraPositionSmoothingWindowMeters({
            totalDistanceMeters: sampler.totalDistance,
            durationSeconds: 10,
        })
        const expectedHeading = sampler.headingAtProgress(progress, {
            lookaheadSeconds,
            windowSeconds: lookaheadSeconds,
            minimumMeters: headingWindowMeters,
            maximumMeters: headingWindowMeters,
        })
        const motion = cameraMotionAtProgress(mode, {
            sample: sampler.atProgress(progress),
            progress,
            cameraSettings,
        })
        const startSample = sampler.atProgress(0)
        const startMotion = cameraMotionAtProgress(mode, {
            sample: startSample,
            progress: 0,
            cameraSettings,
        })
        const endSample = sampler.atProgress(1)
        const endMotion = cameraMotionAtProgress(mode, {
            sample: endSample,
            progress: 1,
            cameraSettings,
        })
        const routeSample = sampler.atProgress(progress)
        const anchorOffsetMeters = Math.hypot(
            (motion.sample.longitude - routeSample.longitude) * 111320 * Math.cos(routeSample.latitude * Math.PI / 180),
            (motion.sample.latitude - routeSample.latitude) * 111320,
        )
        const cropWidthMeters = replayCameraCropWidthMeters({
            cameraHeight: cameraSettings.altitude,
            targetHeight: routeSample.altitude,
            pitchRadians: -Math.PI / 2,
            verticalFovRadians: Math.PI / 3,
            aspectRatio: 1000 / 750,
            cropWidthRatio: 1,
        })

        expect(headingWindowMeters).toBeGreaterThan(400)
        expect(positionSmoothingWindowMeters).toBeGreaterThan(0)
        expect(motion.heading).toBeCloseTo(expectedHeading, 8)
        expect(motion.cameraAnchorAdjusted).toBe(true)
        expect(anchorOffsetMeters).toBeGreaterThan(1)
        expect(anchorOffsetMeters).toBeLessThanOrEqual((cropWidthMeters * 0.25) + 1)
        expect(motion.sample.altitude).toBeCloseTo(routeSample.altitude, 8)
        expect(startMotion.cameraAnchorAdjusted).toBe(false)
        expect(startMotion.sample.longitude).toBeCloseTo(startSample.longitude, 8)
        expect(endMotion.cameraAnchorAdjusted).toBe(false)
        expect(endMotion.sample.longitude).toBeCloseTo(endSample.longitude, 8)
        expect(sampler.atProgress(progress).longitude).toBeCloseTo(routeSample.longitude, 8)
    })

    it('keeps the cubic Bezier camera anchor continuous at a fixed route knot', () => {
        const sampleAtDistance = distance => {
            const eastMeters = Math.min(distance, 2000)
            const northMeters = Math.max(0, distance - 2000)

            return {
                longitude: eastMeters / 111320,
                latitude: northMeters / 111320,
                altitude: 120,
                distanceFromStart: distance,
            }
        }
        const smoothAtDistance = distance => {
            const sample = sampleAtDistance(distance)
            return smoothReplayCameraAnchorSample({
                sample,
                smoothingWindowMeters: 200,
                maximumOffsetMeters: 250,
                segmentStartDistance: 0,
                segmentEndDistance: 4000,
                cameraZigzagSections: [],
                sampleAtDistance,
                fallbackCropWidthMeters: 1000,
            }).sample
        }
        const beforeKnot = smoothAtDistance(1999.99)
        const afterKnot = smoothAtDistance(2000.01)
        const outputDistance = Math.hypot(
            (afterKnot.longitude - beforeKnot.longitude) * 111320,
            (afterKnot.latitude - beforeKnot.latitude) * 111320,
        )

        expect(outputDistance).toBeLessThan(1)
    })

    it('keeps Bezier camera spline samples within their source track segment', () => {
        const segmentStartDistance = 2000
        const segmentEndDistance = 4000
        const sampledDistances = []
        const sampleAtDistance = distance => {
            sampledDistances.push(distance)
            if (distance < segmentStartDistance || distance > segmentEndDistance) {
                throw new Error('Camera smoothing crossed a track segment boundary')
            }

            return {
                longitude: (distance - segmentStartDistance) / 111320,
                latitude: 1,
                altitude: 120,
                distanceFromStart: distance,
            }
        }

        smoothReplayCameraAnchorSample({
            sample: sampleAtDistance(3000),
            smoothingWindowMeters: 200,
            maximumOffsetMeters: 250,
            segmentStartDistance,
            segmentEndDistance,
            cameraZigzagSections: [],
            sampleAtDistance,
            fallbackCropWidthMeters: 1000,
        })

        expect(sampledDistances.length).toBeGreaterThan(0)
        expect(sampledDistances.every(distance => (
            distance >= segmentStartDistance && distance <= segmentEndDistance
        ))).toBe(true)
    })

    it('keeps a zigzag width decision stable across altitude changes within the section', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#camera-zigzag-stable-width',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0.0002, 1500],
                    [0.002, 0, 0],
                    [0.003, 0.0002, 1200],
                    [0.004, 0, 0],
                    [0.005, 0.0002, 1600],
                    [0.006, 0, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const sectionAltitudes = []
        const cameraMotions = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95].map(progress => {
            const sample = sampler.atProgress(progress)
            return sampler.cameraMotionAtProgress(progress, {
                cropZoneWidthMeters: sample.altitude > 500 ? 10 : 1000,
                cropZoneWidthMetersForSection: section => {
                    sectionAltitudes.push(section.maximumTargetAltitude)
                    return 1000
                },
            })
        })

        expect(cameraMotions.every(motion => motion.zigzagSimplified)).toBe(true)
        expect(sectionAltitudes.length).toBe(cameraMotions.length)
        expect(new Set(sectionAltitudes)).toEqual(new Set([1600]))
    })

    it('uses the narrowest camera crop width across a zigzag section', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#camera-zigzag-peak-width',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0.0002, 1500],
                    [0.002, 0, 0],
                    [0.003, 0.0002, 1200],
                    [0.004, 0, 0],
                    [0.005, 0.0002, 1600],
                    [0.006, 0, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const mode = {
            [JOURNEY_REPLAY_INTERNAL_STATE]: {sampler},
            [JOURNEY_REPLAY_INTERNAL_CALL]: {
                cesiumViewer: () => ({camera: {frustum: {aspectRatio: 1, fovy: Math.PI / 3}}}),
                constrainedReplayProjectionViewport: () => ({
                    width: 1000,
                    height: 800,
                    canvasWidth: 1000,
                    canvasHeight: 800,
                }),
            },
        }
        const cameraSettings = {
            altitude: 1620,
            altitudeMode: REPLAY_CAMERA_ALTITUDE_CONSTANT,
            pitch: -90,
            hysteresis: {easing: 0.3},
        }
        const cameraMotions = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95].map(progress => (
            cameraMotionAtProgress(mode, {
                sample: sampler.atProgress(progress),
                progress,
                cameraSettings,
            })
        ))

        expect(cameraMotions.every(motion => motion.zigzagSimplified === false)).toBe(true)
    })

    it('keeps zigzags that are at least half the crop width and keeps ordinary corners', () => {
        const zigzagJourney = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#wide-camera-zigzag',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0.0002, 0],
                    [0.002, 0, 0],
                    [0.003, 0.0002, 0],
                    [0.004, 0, 0],
                    [0.005, 0.0002, 0],
                    [0.006, 0, 0],
                ],
            }),
        ])
        const zigzagSampler = new JourneyReplayPathSampler({journey: zigzagJourney})
        const wideRouteSample = zigzagSampler.atProgress(0.45)
        const wideCameraMotion = zigzagSampler.cameraMotionAtProgress(0.45, {cropZoneWidthMeters: 20})

        expect(wideCameraMotion.zigzagSimplified).toBe(false)
        expect(wideCameraMotion.sample.latitude).toBeCloseTo(wideRouteSample.latitude, 8)

        const cornerJourney = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#single-camera-corner',
                coordinates: [
                    [0, 0, 0],
                    [0.001, 0, 0],
                    [0.001, 0.001, 0],
                    [0.001, 0.002, 0],
                ],
            }),
        ])
        const cornerSampler = new JourneyReplayPathSampler({journey: cornerJourney})
        const corner = cornerSampler.atProgress(0.5)
        const cornerMotion = cornerSampler.cameraMotionAtProgress(0.5, {cropZoneWidthMeters: 1000})

        expect(cornerMotion.zigzagSimplified).toBe(false)
        expect(cornerMotion.sample.longitude).toBeCloseTo(corner.longitude, 8)
        expect(cornerMotion.sample.latitude).toBeCloseTo(corner.latitude, 8)
    })

    it('anticipates a 90 degree turn from the compiled route without classifying it as a zigzag', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#camera-right-angle-anticipation',
                coordinates: [
                    [0, 0, 0],
                    [0.008, 0, 0],
                    [0.008, 0.004, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const routeSample = sampler.atProgress(0.5)
        const motion = sampler.cameraMotionAtProgress(0.5, {
            cropZoneWidthMeters: 10000,
            lookaheadSeconds:   4,
            windowSeconds:      4,
            minimumMeters:      400,
        })
        const eastHeading = Math.PI / 2
        const turnHeading = 0
        const anticipatedTurn = Math.abs(replayAngularDelta(motion.heading, eastHeading))

        expect(motion.zigzagSimplified).toBe(false)
        expect(motion.sample.longitude).toBeCloseTo(routeSample.longitude, 8)
        expect(motion.sample.latitude).toBeCloseTo(routeSample.latitude, 8)
        expect(anticipatedTurn).toBeGreaterThan(0.15)
        expect(anticipatedTurn).toBeLessThan(Math.PI / 2 - 0.15)
        expect(Math.abs(replayAngularDelta(motion.heading, turnHeading))).toBeLessThan(Math.PI / 2)
    })

    it('keeps turning through a 90 degree corner instead of holding the pre-turn heading', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#camera-right-angle-motion',
                coordinates: [
                    [0, 0, 0],
                    [0.008, 0, 0],
                    [0.008, 0.004, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const headings = [0.3, 0.4, 0.5, 0.6, 0.7].map(progress => sampler.cameraMotionAtProgress(progress, {
            cropZoneWidthMeters: 10000,
            lookaheadSeconds:   4,
            windowSeconds:      4,
            minimumMeters:      400,
        }).heading)

        expect(headings[0]).toBeGreaterThan(headings[1])
        expect(headings[1]).toBeGreaterThan(headings[2])
        expect(headings[2]).toBeGreaterThan(headings[3])
        expect(headings[3]).toBeGreaterThan(headings[4])
        expect(headings[0] - headings[4]).toBeGreaterThan(0.35)
    })

    it('keeps camera heading continuous when the anticipation window spans a closed loop', () => {
        const coordinates = Array.from({length: 121}, (_, index) => {
            const angle = (Math.PI * 2 * index) / 120
            return [
                0.001 * Math.cos(angle),
                0.001 * Math.sin(angle),
                0,
            ]
        })
        const sampler = new JourneyReplayPathSampler({
            journey: makeJourney([
                makeTrack({
                    slug: 'track#journey#gpx#closed-camera-loop',
                    coordinates,
                }),
            ]),
        })
        const headings = Array.from({length: 61}, (_, index) => sampler.cameraMotionAtProgress(
            0.2 + (index * 0.01),
            {
                cropZoneWidthMeters: 1,
                lookaheadSeconds:   3.4,
                windowSeconds:      3.4,
                minimumMeters:      400,
            },
        ).heading)
        const maximumHeadingStep = Math.max(...headings.slice(1).map((heading, index) => (
            Math.abs(replayAngularDelta(headings[index], heading))
        )))

        expect(maximumHeadingStep).toBeLessThan(0.1)
    })

    it('does not let a later compact zigzag delay anticipation of a sharp turn', () => {
        const journey = makeJourney([
            makeTrack({
                slug:        'track#journey#gpx#camera-turn-before-zigzag',
                coordinates: [
                    [0, 0, 0],
                    [0.004, 0, 0],
                    [0.004, 0.004, 0],
                    [0.0045, 0.004866, 0],
                    [0.0045, 0.005866, 0],
                    [0.005, 0.006732, 0],
                    [0.005, 0.007732, 0],
                    [0.0055, 0.008598, 0],
                ],
            }),
        ])
        const sampler = new JourneyReplayPathSampler({journey})
        const beforeCorner = sampler.cameraMotionAtProgress(0.5, {
            cropZoneWidthMeters: 10000,
            minimumMeters:      400,
        })
        const insideLaterZigzag = sampler.cameraMotionAtProgress(0.72, {
            cropZoneWidthMeters: 10000,
            minimumMeters:      400,
        })

        expect(beforeCorner.zigzagSimplified).toBe(false)
        expect(insideLaterZigzag.zigzagSimplified).toBe(true)
    })
})
