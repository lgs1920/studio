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

describe('replay settings normalization', () => {
    it('maps the legacy centered marker mode to hysteresis', () => {
        expect(normalizeJourneyReplayMarker({mode: 'centered'}).mode).toBe(REPLAY_MARKER_MODE_HYSTERESIS)
    })

    it('keeps supported marker tracking modes', () => {
        expect(normalizeJourneyReplayMarker({mode: REPLAY_MARKER_MODE_TRACE}).mode).toBe(REPLAY_MARKER_MODE_TRACE)
        expect(normalizeJourneyReplayMarker({mode: REPLAY_MARKER_MODE_NAVIGATION}).mode).toBe(REPLAY_MARKER_MODE_NAVIGATION)
        expect(normalizeJourneyReplayMarker({mode: REPLAY_MARKER_MODE_HYSTERESIS}).mode).toBe(REPLAY_MARKER_MODE_HYSTERESIS)
    })

    it('preserves an editable marker position when normalizing marker settings', () => {
        const marker = normalizeJourneyReplayMarker({
            mode: REPLAY_MARKER_MODE_NAVIGATION,
            position: {
                longitude: '2.123456',
                latitude:  48.765432,
                altitude:  321,
            },
        })

        expect(marker.position).toEqual({
            longitude: 2.123456,
            latitude:  48.765432,
            altitude:  321,
        })
    })

    it('defaults camera position mode behind and accepts ahead', () => {
        expect(normalizeJourneyReplayCamera({}).positionMode).toBe(REPLAY_CAMERA_POSITION_SYSTEM)
        expect(normalizeJourneyReplayCamera({positionMode: REPLAY_CAMERA_POSITION_BEHIND}).positionMode)
            .toBe(REPLAY_CAMERA_POSITION_BEHIND)
        expect(normalizeJourneyReplayCamera({positionMode: REPLAY_CAMERA_POSITION_AHEAD}).positionMode)
            .toBe(REPLAY_CAMERA_POSITION_AHEAD)
    })

    it('keeps behind and ahead as distinct camera positions', () => {
        const camera = normalizeJourneyReplayCamera({positionMode: REPLAY_CAMERA_POSITION_BEHIND})
        expect(camera.positionMode).toBe(REPLAY_CAMERA_POSITION_BEHIND)
    })

    it('normalizes pitch and altitude settings while preserving the camera mode', () => {
        const camera = normalizeJourneyReplayCamera({
            altitudeMode: 'constant',
            altitude:     1500,
            headingOffset: 120,
            pitch:        -50,
            positionMode: REPLAY_CAMERA_POSITION_AHEAD,
        })

        expect(camera.altitude).toBe(1500)
        expect(camera.headingOffset).toBe(REPLAY_CAMERA_HEADING_OFFSET_MAX)
        expect(camera.pitch).toBe(-50)
        expect(camera.positionMode).toBe(REPLAY_CAMERA_POSITION_AHEAD)
    })

    it('normalizes camera altitude as a single persisted value', () => {
        const camera = normalizeJourneyReplayCamera({
            altitudeMode: 'ground-offset',
            altitude:     1500,
            groundOffset: 800,
        })

        expect(camera.altitude).toBe(1500)
        expect(camera.altitudeMode).toBe('ground-offset')
        expect(camera.groundOffset).toBeUndefined()
    })

    it('keeps a default tolerance zone aligned to the window and clamps custom rectangles', () => {
        const camera = normalizeJourneyReplayCamera({})
        expect(camera.hysteresis.zone).toEqual({
                                                   top:    0,
                                                   left:   0,
                                                   width:  1,
                                                   height: 1,
                                               })
        expect(camera.hysteresis.marginRatio).toBeCloseTo(0.4, 6)
        expect(camera.hysteresis.easing).toBeCloseTo(0.08, 6)
        expect(getJourneyReplayCameraPresetKey(camera)).toBe(REPLAY_CAMERA_PRESET_DEFAULT)

        const bounds = replayToleranceZoneBounds({
                                                         top:    0.15,
                                                         left:   0.1,
                                                         width:  0.5,
                                                         height: 0.3,
                                                     })
        expect(bounds.top).toBeCloseTo(0.15, 6)
        expect(bounds.left).toBeCloseTo(0.1, 6)
        expect(bounds.right).toBeCloseTo(0.6, 6)
        expect(bounds.bottom).toBeCloseTo(0.45, 6)
    })

    it('normalizes the hide other journeys switch as a boolean', () => {
        expect(defaultJourneyReplaySettings().hideOtherJourneys).toBe(false)
        expect(normalizeJourneyReplaySettings({hideOtherJourneys: true}).hideOtherJourneys).toBe(true)
        expect(normalizeJourneyReplaySettings({hideOtherJourneys: 0}).hideOtherJourneys).toBe(false)
    })

    it('normalizes the nearby poi distance and keeps a sane default', () => {
        expect(defaultJourneyReplaySettings().poiDistance).toBe(10000)
        expect(normalizeJourneyReplaySettings({poiDistance: 2500}).poiDistance).toBe(2500)
        expect(normalizeJourneyReplaySettings({poiDistance: 0}).poiDistance).toBe(1)
    })

    it('recognizes the ultra smooth camera preset and increases recenter duration with easing', () => {
        expect(getJourneyReplayCameraPresetKey({
            hysteresis: {
                marginRatio:   0.2,
                easing:        0.3,
            },
        })).toBe(REPLAY_CAMERA_PRESET_ULTRA_SMOOTH)

        expect(getJourneyReplayCameraPresetKey({
            hysteresis: {
                marginRatio:   0.2,
                easing:        0.31,
            },
        })).not.toBe(REPLAY_CAMERA_PRESET_ULTRA_SMOOTH)

        expect(replayCameraRecenterDuration(0.3)).toBeGreaterThan(replayCameraRecenterDuration(0.18))
    })

    it('detects tolerance exits from Cesium window coordinates', () => {
        const zone = {
            top:    0.25,
            left:   0.25,
            width:  0.5,
            height: 0.5,
        }
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 500, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(false)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 750, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 760, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  null,
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
    })

    it('builds runtime-only centered tracking zones for navigation and dynamic camera modes', () => {
        expect(replayCenteredZone(0.3, 0.3)).toEqual({
                                                         top:    0.35,
                                                         left:   0.35,
                                                         width:  0.3,
                                                         height: 0.3,
                                                     })

        const tracking = replayRuntimeTrackingSettings()
        expect(tracking.navigation.triggerZone).toEqual({
                                                            top:    0.35,
                                                            left:   0.35,
                                                            width:  0.3,
                                                            height: 0.3,
                                                        })
        expect(tracking.dynamic.triggerZone.top).toBeCloseTo(0.075, 6)
        expect(tracking.dynamic.triggerZone.left).toBeCloseTo(0.075, 6)
        expect(tracking.dynamic.triggerZone.width).toBeCloseTo(0.85, 6)
        expect(tracking.dynamic.triggerZone.height).toBeCloseTo(0.85, 6)
        expect(tracking.dynamic.targetZone).toEqual({
                                                       top:    0.35,
                                                       left:   0.35,
                                                       width:  0.3,
                                                       height: 0.3,
                                                   })
    })

    it('reduces the navigation ratio from 30 to 22 percent on narrow crops', () => {
        const horizontalZone = replayRuntimeTrackingSettings({}, {width: 1920, height: 1080}).navigation.triggerZone
        expect(horizontalZone.width).toBeCloseTo(0.22, 6)

        const verticalZone = replayRuntimeTrackingSettings({}, {width: 1080, height: 1920}).navigation.triggerZone
        expect(verticalZone.height).toBeCloseTo(0.22, 6)
    })

    it('increases look-ahead for grazing camera pitches', () => {
        expect(replayPitchLookaheadFactor(CesiumMath.toRadians(-5))).toBeCloseTo(2.2, 6)
        expect(replayPitchLookaheadFactor(CesiumMath.toRadians(-35))).toBeCloseTo(1, 6)
        expect(replayPitchLookaheadFactor(CesiumMath.toRadians(-65))).toBeCloseTo(1, 6)
    })

    it('places dynamic target inside Z2 opposite to screen movement direction', () => {
        const target = replayDynamicTargetPointInZone({
                                                          currentPoint:   {x: 500, y: 500},
                                                          predictedPoint: {x: 700, y: 500},
                                                          viewportWidth:  1000,
                                                          viewportHeight: 1000,
                                                          zone:           replayCenteredZone(0.3, 0.3),
                                                      })

        expect(target.x).toBeLessThan(500)
        expect(target.x).toBeGreaterThanOrEqual(350)
        expect(target.y).toBeCloseTo(500, 6)
    })

    it('treats dynamic Z1 as the hard trigger zone instead of the inner safe zone', () => {
        const zone = replayCenteredZone(0.5, 0.5)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 400, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(false)
        expect(replayIsWindowPointOutsideToleranceZone({
                                                               point:  {x: 100, y: 500},
                                                               width:  1000,
                                                               height: 1000,
                                                               zone,
                                                           })).toBe(true)
    })

    it('keeps the camera farther from the anchor when pitch is not top-down', () => {
        expect(replayCameraRangeFromPitch(1200, -Math.PI / 2)).toBeCloseTo(1200, 6)
        expect(replayCameraRangeFromPitch(1200, -Math.PI / 4)).toBeCloseTo(1697.056, 3)
    })

    it('keeps the current camera height when recentering', () => {
        expect(replayCameraRecenterHeight(840, 1200)).toBe(840)
        expect(replayCameraRecenterHeight(null, 1200)).toBe(1200)
    })

    it('keeps the recentering pitch by moving horizontally instead of changing height', () => {
        expect(replayCameraRecenterHorizontalDistance({
                                                              cameraHeight: 1000,
                                                              targetHeight: 0,
                                                              pitchRadians: -Math.PI / 4,
                                                          })).toBeCloseTo(1000, 6)
        expect(replayCameraRecenterHorizontalDistance({
                                                              cameraHeight: 1000,
                                                              targetHeight: 500,
                                                              pitchRadians: -Math.PI / 4,
                                                          })).toBeCloseTo(500, 6)
        expect(replayCameraRecenterHorizontalDistance({
                                                              cameraHeight:  1000,
                                                              targetHeight:  0,
                                                              pitchRadians:  0,
                                                              fallbackRange: 750,
                                                          })).toBe(750)
    })

    it('converts local trace axis angles to Cesium headings', () => {
        expect(replayHeadingFromLocalAxisAngle(0)).toBeCloseTo(Math.PI / 2, 6)
        expect(replayHeadingFromLocalAxisAngle(Math.PI / 2)).toBeCloseTo(0, 6)
    })

    it('places behind on the trace heading and ahead on the opposite side', () => {
        expect(replayCameraHeadingForPositionMode({
            axisHeading:   0.75,
            positionMode: REPLAY_CAMERA_POSITION_BEHIND,
            headingOffset: 15,
        })).toBeCloseTo(0.75 + (Math.PI / 12), 6)
        expect(replayCameraHeadingForPositionMode({
            axisHeading:   0.75,
            positionMode: REPLAY_CAMERA_POSITION_AHEAD,
            headingOffset: -15,
        })).toBeCloseTo(0.75 + Math.PI - (Math.PI / 12), 6)
    })

    it('keeps the last heading when the requested change stays within hysteresis', () => {
        expect(replayAngularDelta(0, 0.01)).toBeCloseTo(0.01, 6)
        expect(replayAngularDelta(Math.PI - 0.01, -Math.PI + 0.01)).toBeCloseTo(0.02, 6)
        expect(replayCameraHeadingWithHysteresis({
            previousHeading: 0,
            nextHeading:     0.05,
            threshold:       0.1,
        })).toBeCloseTo(0, 6)
        expect(replayCameraHeadingWithHysteresis({
            previousHeading: 0,
            nextHeading:     0.2,
            threshold:       0.1,
        })).toBeCloseTo(0.2, 6)
    })

    it('eases large heading changes more than small ones', () => {
        const smallTurn = replayHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     0.08,
            easing:          0.14,
        })
        const largeTurn = replayHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI * 0.75,
            easing:          0.14,
        })

        expect(smallTurn).toBeGreaterThan(largeTurn)
        expect(largeTurn).toBeGreaterThanOrEqual(0.04)
        expect(smallTurn).toBeLessThanOrEqual(0.22)
    })

    it('reduces the heading response when easing increases', () => {
        const lowEasing = replayHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI / 2,
            easing:          0.05,
        })
        const highEasing = replayHeadingEasingFactor({
            previousHeading: 0,
            nextHeading:     Math.PI / 2,
            easing:          0.45,
        })

        expect(highEasing).toBeLessThan(lowEasing)
    })
})

