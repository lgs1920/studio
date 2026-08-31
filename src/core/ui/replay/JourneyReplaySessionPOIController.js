/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplaySessionPOIController.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-08-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Nearby POI lifecycle for journey replay.
 */

import { REPLAY_DRAWER }                                                               from '@Core/constants'
import {
    getJourneyReplayHideOtherJourneys,
}                                                                                          from '@Core/ui/JourneyVisibility'
import {
    CameraUtils,
}                                                                                          from '@Utils/cesium/CameraUtils'
import {
    POIUtils,
}                                                                                          from '@Utils/cesium/POIUtils'
import {
    TrackUtils,
}                                                                                          from '@Utils/cesium/TrackUtils'
import { Journey }                                                                         from '@Core/Journey'
import {
    ArcType, Cartesian2, Cartesian3, Cartographic, CatmullRomSpline, Color, ExtrapolationType, JulianDate,
    EasingFunction, HeightReference, HorizontalOrigin, LinearApproximation, Math as CesiumMath, Matrix4,
    PolylineDashMaterialProperty, SampledPositionProperty, SceneTransforms, Transforms, VerticalOrigin,
}                                                                                          from 'cesium'
import {
    JourneyReplayCesiumRenderer,
}                                                                                          from './JourneyReplayCesiumRenderer'
import { REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP, normalizeJourneyReplayClips } from './JourneyReplayClips'
import {
    currentJourneyReplayPoiBehavior, currentJourneyReplaySample, finiteNumber, publishReplayClipFrameState,
    replayStore, resetRuntimeProgress, resolveJourneyReplayRuntimeClips,
} from './JourneyReplayRuntime'
import * as JourneyReplayCameraController from './JourneyReplayCameraController'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import * as JourneyReplayVisibilityController from './JourneyReplayVisibilityController'
import * as JourneyReplayClipController from './JourneyReplayClipController'
import {
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForPositionMode, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
} from './JourneyReplayCameraMath'
import {
    REPLAY_SCOPE_ALL_TRACKS, JourneyReplayPathSampler,
}                                                                                          from './JourneyReplayPathSampler'
import {
    REPLAY_EVENT_END, REPLAY_EVENT_PAUSE, REPLAY_EVENT_RESUME, REPLAY_EVENT_START,
    REPLAY_EVENT_STOP, REPLAY_EVENT_UPDATE, JourneyReplayPlaybackController,
}                                                                                          from './JourneyReplayPlaybackController'
import { replayVideoTraceDebug }                                                           from './ReplayVideoTraceDebug'
import {
    DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS, normalizeJourneyReplayPOISettings,
}                                                                                          from './JourneyReplayPOISettings'
import {
    REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET, REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION,
    REPLAY_MARKER_MODE_TRACE, getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker,
    normalizeJourneyReplayProgressionStyle, normalizeJourneyReplaySmoothing, normalizeJourneyReplayTrace,
}                                                                                          from './JourneyReplayProgressionStyle'


import {
    DEFAULT_DURATION,
    PROFILE_HOVER_RENDER_INTERVAL,
    METRIC_OVERLAY_TTL,
    REPLAY_HEADING_TRANSITION_DURATION_SECONDS,
    SAFE_TOP_DOWN_PITCH,
    CAMERA_GUIDE_MIN_STEPS,
    CAMERA_GUIDE_MAX_STEPS,
    CAMERA_GUIDE_TARGET_SPACING_METERS,
    CAMERA_GUIDE_TURN_STEP_RADIANS,
    CARTESIAN_EPSILON,
    CAMERA_HEADING_HYSTERESIS_RADIANS,
    CAMERA_HEADING_LOOKAHEAD_PROGRESS,
    CAMERA_HEADING_MIN_CHANGE_RADIANS,
    CAMERA_RASANT_PITCH_LIMIT_RADIANS,
    CAMERA_RASANT_PITCH_RELEASE_RADIANS,
    CAMERA_VIEW_POSITION_EPSILON_METERS,
    CAMERA_VIEW_ANGLE_EPSILON_RADIANS,
    CAMERA_TIMING_START_ANGLE_RADIANS,
    CAMERA_TIMING_SETTLE_ANGLE_RADIANS,
    CAMERA_DETERMINISTIC_FOLLOW_RESPONSE_SECONDS,
    CAMERA_UPDATE_MIN_PROGRESS_DELTA,
    CAMERA_REDIRECT_MAX_TRANSITION_SECONDS,
    CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS,
    CAMERA_REDIRECT_TRACE_VISIBILITY_OFFSETS_METERS,
    CAMERA_REDIRECT_REQUIRED_TRACE_OFFSET_METERS,
    CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS,
    CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS,
    CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS,
    REPLAY_TOLERANCE_OUTER_INSET_RATIO,
    REPLAY_TOLERANCE_INNER_INSET_RATIO,
    REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS,
    REPLAY_TRACKING_NAVIGATION_ZONE_RATIO,
    REPLAY_TRACKING_NAVIGATION_NARROW_CROP_RATIO,
    REPLAY_TRACKING_NAVIGATION_NARROW_ZONE_RATIO,
    REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO,
    REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO,
    REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR,
    REPLAY_POI_TRIGGER_EPSILON_METERS,
    REPLAY_POI_TRIGGER_SCAN_MARGIN_METERS,
    REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
    REPLAY_EVENT_STOP_CLIPS_COMPLETE,
    CAMERA_REDIRECT_CANDIDATES,
    isUsableCartesian3,
    safeCartesian3Normalize,
    safeCartesian3Lerp,
} from './JourneyReplaySessionShared'

export const syncRuntimeNearbyPOIs = (mode, journey = globalThis.lgs?.theJourney ?? null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const store = replayStore()
        const poiManager = globalThis.__?.ui?.poiManager
        if (!journey?.slug || !store || !poiManager?.getJourneyReplayPOIsForJourney) {
            return []
        }

        const poiDistance = globalThis.lgs?.settings?.ui?.replay?.poiDistance ?? store.poiDistance ?? null
        const nearbyPois = poiManager.getJourneyReplayPOIsForJourney(journey, poiDistance)
        store.nearbyPois = nearbyPois
        return nearbyPois
    }

export const updatePOIExpandedState = async (mode, poiId, expanded) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (!poiId) {
            return null
        }

        const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
        if (!poi || poi.expanded === expanded) {
            return poi ?? null
        }

        return globalThis.__?.ui?.poiManager?.updatePOI?.(poiId, {expanded}, {
            skipPersist:        true,
            immediate:          true,
            skipLocationUpdate: true,
        }) ?? null
    }

export const restoreNearbyPOIsAfterPlayback = async (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        for (const timerId of state.replayPoiCollapseTimers.values()) {
            globalThis.clearTimeout?.(timerId)
        }
        state.replayPoiCollapseTimers.clear()

        const restoreEntries = Array.from(state.replayPoiExpandedState.entries())
        state.replayPoiExpandedState.clear()
        state.replayPoiTriggered.clear()
        state.lastJourneyReplayPoiDistance = null
        state.lastJourneyReplayPoiCursor = 0
        state.sortedNearbyPois = []

        await Promise.all(restoreEntries.map(([poiId, expanded]) => call.updatePOIExpandedState(poiId, expanded === true)))
    }

export const closeJourneyReplayOpenedPOIsBeforeStopClips = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        for (const timerId of state.replayPoiCollapseTimers.values()) {
            globalThis.clearTimeout?.(timerId)
        }
        state.replayPoiCollapseTimers.clear()

        const openedPOIIds = Array.from(state.replayPoiTriggered)
        if (openedPOIIds.length === 0) {
            return null
        }

        return Promise.all(openedPOIIds.map(poiId => call.updatePOIExpandedState(poiId, false)))
    }

export const prepareNearbyPOIsForPlayback = async (mode, sample = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        await call.restoreNearbyPOIsAfterPlayback()

        const store = replayStore()
        const journey = globalThis.lgs?.theJourney ?? null
        const {hideAllPoisDuringJourneyReplay} = currentJourneyReplayPoiBehavior()
        const nearbyPois = Array.isArray(store?.nearbyPois) && store.nearbyPois.length > 0
            ? store.nearbyPois
            : call.syncRuntimeNearbyPOIs(journey)
        const sortedNearbyPois = [...nearbyPois].sort((left, right) => {
            const leftDistance = finiteNumber(left?.projectedAbscissa)
            const rightDistance = finiteNumber(right?.projectedAbscissa)
            if (leftDistance === null && rightDistance === null) {
                return 0
            }
            if (leftDistance === null) {
                return 1
            }
            if (rightDistance === null) {
                return -1
            }
            return leftDistance - rightDistance
        })

        state.sortedNearbyPois = sortedNearbyPois

        call.applyJourneyReplayPOIVisibility(sortedNearbyPois)

        for (const entry of sortedNearbyPois) {
            const poiId = entry?.poi?.id
            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            const settings = normalizeJourneyReplayPOISettings(poi?.replay)
            if (!poiId || !poi) {
                continue
            }

            if (!hideAllPoisDuringJourneyReplay && settings.visible === false) {
                continue
            }

            state.replayPoiExpandedState.set(poiId, poi.expanded === true)
            await call.updatePOIExpandedState(poiId, false)
        }

        const currentDistance = finiteNumber(sample?.distanceFromStart)
        state.lastJourneyReplayPoiDistance = currentDistance === null
            ? null
            : Math.max(0, currentDistance - REPLAY_POI_TRIGGER_EPSILON_METERS)
        state.lastJourneyReplayPoiCursor = currentDistance === null
            ? 0
            : call.replayPoiCursorForDistance(sortedNearbyPois, currentDistance)

        if (sample) {
            void call.syncNearbyPOIsForSample(sample)
        }
    }

export const openNearbyPOIForPlayback = async (mode, poiId) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (!poiId) {
            return
        }

        const existingTimer = state.replayPoiCollapseTimers.get(poiId)
        if (existingTimer) {
            globalThis.clearTimeout?.(existingTimer)
        }

        const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
        const settings = normalizeJourneyReplayPOISettings(poi?.replay)
        const {hideAllPoisDuringJourneyReplay, animateAllPoisDuringJourneyReplay} = currentJourneyReplayPoiBehavior()
        if (hideAllPoisDuringJourneyReplay || (!animateAllPoisDuringJourneyReplay && settings.animated === false)) {
            return
        }
        const durationSeconds = finiteNumber(settings.displayDurationSeconds) ?? DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS

        await call.updatePOIExpandedState(poiId, true)

        const timeoutId = globalThis.setTimeout?.(() => {
            state.replayPoiCollapseTimers.delete(poiId)
            void call.updatePOIExpandedState(poiId, false)
        }, durationSeconds * 1000)

        if (timeoutId !== undefined) {
            state.replayPoiCollapseTimers.set(poiId, timeoutId)
        }
    }

export const syncNearbyPOIsForSample = async (mode, sample = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const currentDistance = finiteNumber(sample?.distanceFromStart)
        if (currentDistance === null) {
            return
        }

        const nearbyPois = state.sortedNearbyPois.length > 0
            ? state.sortedNearbyPois
            : replayStore()?.nearbyPois ?? []
        const previousDistance = state.lastJourneyReplayPoiDistance

        if (!Array.isArray(nearbyPois) || nearbyPois.length === 0) {
            state.lastJourneyReplayPoiDistance = currentDistance
            return
        }

        const {hideAllPoisDuringJourneyReplay, animateAllPoisDuringJourneyReplay} = currentJourneyReplayPoiBehavior()
        if (hideAllPoisDuringJourneyReplay) {
            state.lastJourneyReplayPoiDistance = currentDistance
            state.lastJourneyReplayPoiCursor = call.replayPoiCursorForDistance(nearbyPois, currentDistance)
            return
        }

        if (previousDistance !== null && currentDistance < previousDistance) {
            state.lastJourneyReplayPoiCursor = call.replayPoiCursorForDistance(nearbyPois, currentDistance)
            state.lastJourneyReplayPoiDistance = currentDistance
            return
        }

        const thresholdStart = previousDistance ?? Math.max(
            0,
            currentDistance - Math.max(REPLAY_POI_TRIGGER_EPSILON_METERS, REPLAY_POI_TRIGGER_SCAN_MARGIN_METERS),
        )
        let cursor = Number.isInteger(state.lastJourneyReplayPoiCursor)
                    ? Math.max(0, state.lastJourneyReplayPoiCursor)
                    : call.replayPoiCursorForDistance(nearbyPois, thresholdStart)
        const triggeredIds = []

        while (cursor < nearbyPois.length) {
            const entry = nearbyPois[cursor]
            const targetDistance = finiteNumber(entry?.projectedAbscissa)
            if (targetDistance === null) {
                cursor += 1
                continue
            }

            if (targetDistance < thresholdStart) {
                cursor += 1
                continue
            }

            if (targetDistance > currentDistance + REPLAY_POI_TRIGGER_EPSILON_METERS) {
                break
            }

            const poiId = entry?.poi?.id
            if (poiId && !state.replayPoiTriggered.has(poiId)) {
                const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
                const settings = normalizeJourneyReplayPOISettings(poi?.replay)
                if (settings.visible !== false && (animateAllPoisDuringJourneyReplay || settings.animated !== false)) {
                    state.replayPoiTriggered.add(poiId)
                    triggeredIds.push(poiId)
                }
            }

            cursor += 1
        }

        state.lastJourneyReplayPoiCursor = cursor
        state.lastJourneyReplayPoiDistance = currentDistance
        await Promise.all(triggeredIds.map(poiId => call.openNearbyPOIForPlayback(poiId)))
    }

export const replayPoiCursorForDistance = (mode, nearbyPois = [], distance = 0) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (!Array.isArray(nearbyPois) || nearbyPois.length === 0) {
            return 0
        }

        const targetDistance = finiteNumber(distance) ?? 0
        let low = 0
        let high = nearbyPois.length
        while (low < high) {
            const mid = Math.floor((low + high) / 2)
            const midDistance = finiteNumber(nearbyPois[mid]?.projectedAbscissa)
            if (midDistance === null || midDistance <= targetDistance) {
                low = mid + 1
            }
            else {
                high = mid
            }
        }

        return low
    }

    /**
     * Pull the live Cesium camera state back into the replay settings/store.
     * This keeps the drawer and the Cesium viewport in lockstep while the FT is running.
     */

