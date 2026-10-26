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
 * Last modified: 2026-10-26
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
import {currentReplayJourney} from './ReplayUserModeConstants'
import {
    currentJourneyReplayPoiBehavior, currentJourneyReplaySample, finiteNumber, publishReplayClipFrameState,
    replayStore, resetRuntimeProgress, resolveJourneyReplayRuntimeClips,
} from './JourneyReplayRuntime'
import * as JourneyReplayCameraController from './JourneyReplayCameraController'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import * as JourneyReplayVisibilityController from './JourneyReplayVisibilityController'
import * as JourneyReplayClipController from './JourneyReplayClipController'
import {
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForAngle, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
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
    isReplayPOIAnimationActiveAtProgress,
    isReplayPOIAnimationEndpoint,
    normalizeJourneyReplayPOISettings,
}                                                                                          from './JourneyReplayPOISettings'
import {projectReplayPOIsOnSampler} from './JourneyReplayPOIProjection'

import {
    REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
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
    REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
    REPLAY_EVENT_STOP_CLIPS_COMPLETE,
    CAMERA_REDIRECT_CANDIDATES,
    isUsableCartesian3,
    safeCartesian3Normalize,
    safeCartesian3Lerp,
} from './JourneyReplaySessionShared'

/** Publish animation ownership only when its observable ID set changes. */
const publishAnimatedPOIs = ids => {
    const store = replayStore()
    if (!store) {
        return
    }
    const current = store.animatedPOIIds ?? []
    if (current.length !== ids.size || current.some(id => !ids.has(id))) {
        store.animatedPOIIds = Array.from(ids)
    }
}

/** Let a POI-level opt-out override Replay-wide animation switches. */
const shouldAnimateReplayPOI = (behavior, settings) => {
    if (settings.animated === false) {
        return false
    }

    return behavior.basicMode
        ? behavior.animatePoisDuringJourneyReplay
        : behavior.animateAllPoisDuringJourneyReplay || settings.animated !== false
}

/** Refresh nearby POIs for the selected Replay journey. */
export const syncRuntimeNearbyPOIs = (_mode, journey = currentReplayJourney()) => {
    const store = replayStore()
    const poiManager = globalThis.__?.ui?.poiManager
    if (!journey?.slug || !store || !poiManager?.getJourneyReplayPOIsForJourney) {
        return []
    }

    const poiDistance = globalThis.lgs?.settings?.ui?.replay?.poiDistance ?? store.poiDistance ?? null
    const {poiVisibilityMode} = currentJourneyReplayPoiBehavior()
    const nearbyPois = poiManager.getJourneyReplayPOIsForJourney(journey, poiDistance, {
        includeHidden: poiVisibilityMode === 'yes',
    })
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
        const restoreEntries = Array.from(state.replayPoiExpandedState.entries())
        state.replayPoiExpandedState.clear()
        state.replayPoiTriggered.clear()
        publishAnimatedPOIs(state.replayPoiTriggered)
        state.sortedNearbyPois = []

        await Promise.all(restoreEntries.map(([poiId, expanded]) => call.updatePOIExpandedState(poiId, expanded === true)))
    }

export const closeJourneyReplayOpenedPOIsBeforeStopClips = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const openedPOIIds = Array.from(state.replayPoiTriggered)
        state.replayPoiTriggered.clear()
        publishAnimatedPOIs(state.replayPoiTriggered)
        try {
            call.applyJourneyReplayPOIVisibility?.()
        }
        catch (error) {
            console.error('[Replay POI] Failed to apply visibility before stop clips.', error)
        }
        if (openedPOIIds.length === 0) {
            return null
        }

        return Promise.all(openedPOIIds.map(async poiId => {
            try {
                return await call.updatePOIExpandedState(poiId, false)
            }
            catch (error) {
                // Closing an animated POI is cosmetic and must not abort video finalization.
                console.error(`[Replay POI] Failed to close POI ${poiId} before stop clips.`, error)
                return null
            }
        }))
    }

export const prepareNearbyPOIsForPlayback = async (mode, sample = null) => {
        const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
        const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const {poiVisibilityMode: initialVisibilityMode} = currentJourneyReplayPoiBehavior()
        if (initialVisibilityMode === 'no') {
            state.replayPoiTriggered.clear()
            call.applyJourneyReplayPOIVisibility()
        }
        await call.restoreNearbyPOIsAfterPlayback()
        state.replayPOIAnimationOccurred = false

        const journey = currentReplayJourney()
        const {poiVisibilityMode} = currentJourneyReplayPoiBehavior()
        const nearbyPois = call.syncRuntimeNearbyPOIs(journey)
        const sortedNearbyPois = [...projectReplayPOIsOnSampler(nearbyPois, state.sampler)].sort((left, right) => {
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

        const poisToCollapse = poiVisibilityMode === 'yes'
            ? call.replayPOICandidates(sortedNearbyPois)
            : sortedNearbyPois.map(entry => entry?.poi).filter(Boolean)
        for (const poi of poisToCollapse) {
            const poiId = poi?.id
            if (!poiId || !poi) {
                continue
            }

            if (isReplayPOIAnimationEndpoint(poi)) {
                continue
            }

            if (normalizeJourneyReplayPOISettings(poi.replay).animated === false) {
                continue
            }

            state.replayPoiExpandedState.set(poiId, poi.expanded === true)
            await call.updatePOIExpandedState(poiId, false)
        }

        if (sample) {
            await call.syncNearbyPOIsForSample(sample)
        }
    }

export const openNearbyPOIForPlayback = async (mode, poiId) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
        const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (!poiId) {
            return
        }

        const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
        const settings = normalizeJourneyReplayPOISettings(poi?.replay)
        const behavior = currentJourneyReplayPoiBehavior()
        const shouldAnimate = shouldAnimateReplayPOI(behavior, settings)
        if (!poi || isReplayPOIAnimationEndpoint(poi) || !shouldAnimate) {
            return
        }
        await call.updatePOIExpandedState(poiId, true)
        state.replayPoiTriggered.add(poiId)
        publishAnimatedPOIs(state.replayPoiTriggered)
        state.replayPOIAnimationOccurred = true
        call.setPOIEntityVisibility(poi, true, {allowReplayAnimation: true})
    }

export const syncNearbyPOIsForSample = async (mode, sample = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const progress = finiteNumber(sample?.progress)
        if (progress === null) {
            return
        }

        const nearbyPois = state.sortedNearbyPois.length > 0
            ? state.sortedNearbyPois
            : replayStore()?.nearbyPois ?? []
        if (!Array.isArray(nearbyPois) || nearbyPois.length === 0) {
            const collapsedIds = Array.from(state.replayPoiTriggered).filter(poiId => {
                const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
                return normalizeJourneyReplayPOISettings(poi?.replay).animated !== false
            })
            state.replayPoiTriggered.clear()
            publishAnimatedPOIs(state.replayPoiTriggered)
            await Promise.all(collapsedIds.map(poiId => call.updatePOIExpandedState(poiId, false)))
            call.applyJourneyReplayPOIVisibility?.()
            return
        }

        const {
            basicMode,
            poiVisibilityMode,
            animatePoisDuringJourneyReplay,
            poiAnimationDurationSeconds,
            animateAllPoisDuringJourneyReplay,
        } = currentJourneyReplayPoiBehavior()
        const totalDistance = finiteNumber(state.sampler?.totalDistance)
            ?? finiteNumber(replayStore()?.totalDistance)
            ?? finiteNumber(sample?.distanceFromStart + sample?.remainingDistance)
        const replayDurationSeconds = finiteNumber(state.controller?.duration)
            ?? finiteNumber(replayStore()?.duration)
            ?? 0
        const shouldAnimatePOIs = replayDurationSeconds > 0 && totalDistance > 0
        const expandedIds = new Set()

        if (shouldAnimatePOIs) {
            for (const entry of nearbyPois) {
                const poiId = entry?.poi?.id
                const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId) ?? entry?.poi
                if (!poiId || !poi || isReplayPOIAnimationEndpoint(poi)) {
                    continue
                }

                const poiSettings = normalizeJourneyReplayPOISettings(poi.replay)
                const animateThisPOI = shouldAnimateReplayPOI({
                    basicMode,
                    animatePoisDuringJourneyReplay,
                    animateAllPoisDuringJourneyReplay,
                }, poiSettings)
                const visibleForReplay = poiVisibilityMode === 'no'
                    || poiVisibilityMode === 'yes'
                    || poiSettings.visible !== false
                if (!visibleForReplay || !animateThisPOI) {
                    continue
                }

                const displayDurationSeconds = basicMode
                    ? poiAnimationDurationSeconds
                    : poiSettings.displayDurationSeconds
                if (isReplayPOIAnimationActiveAtProgress({
                    progress,
                    poiDistance: entry.projectedAbscissa,
                    totalDistance,
                    replayDurationSeconds,
                    animationDurationSeconds: displayDurationSeconds,
                })) {
                    expandedIds.add(poiId)
                }
            }
        }

        const collapsedIds = Array.from(state.replayPoiTriggered).filter(poiId => {
            if (expandedIds.has(poiId)) {
                return false
            }

            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            return normalizeJourneyReplayPOISettings(poi?.replay).animated !== false
        })
        const newlyExpandedIds = Array.from(expandedIds).filter(poiId => !state.replayPoiTriggered.has(poiId))
        state.replayPoiTriggered = expandedIds
        publishAnimatedPOIs(expandedIds)
        if (newlyExpandedIds.length > 0) {
            state.replayPOIAnimationOccurred = true
        }
        await Promise.all([
            ...collapsedIds.map(poiId => call.updatePOIExpandedState(poiId, false)),
            ...newlyExpandedIds.map(poiId => call.updatePOIExpandedState(poiId, true)),
        ])
        if (collapsedIds.length > 0 || newlyExpandedIds.length > 0) {
            call.applyJourneyReplayPOIVisibility?.()
        }
    }

    /**
     * Pull the live Cesium camera state back into the replay settings/store.
     * This keeps the drawer and the Cesium viewport in lockstep while the FT is running.
     */
