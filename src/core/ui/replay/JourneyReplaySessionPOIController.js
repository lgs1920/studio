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
 * Last modified: 2026-11-05
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
    MAX_REPLAY_POI_DISPLAY_DURATION_SECONDS,
    normalizeJourneyReplayPOISettings,
    shouldAnimateReplayPOI,
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

const replayPOISyncRevisionByState = new WeakMap()

/**
 * Advance the Replay POI revision so older asynchronous updates cannot commit.
 * @param {object} state - Replay session internal state.
 * @returns {number} Current synchronization revision.
 */
const advanceReplayPOISyncRevision = state => {
    const revision = (replayPOISyncRevisionByState.get(state) ?? 0) + 1
    replayPOISyncRevisionByState.set(state, revision)
    return revision
}

/**
 * Check whether an asynchronous Replay POI update still belongs to the latest sample.
 * @param {object} state - Replay session internal state.
 * @param {number} revision - Revision captured by the asynchronous update.
 * @returns {boolean} Whether the update is still current.
 */
const isCurrentReplayPOISyncRevision = (state, revision) => replayPOISyncRevisionByState.get(state) === revision

/** Resolve the selected Journey's Start and Stop POIs for Replay presentation. */
const replayJourneyEndpoints = (journey, poiList) => {
    const journeyTracks = Array.from(journey?.tracks?.values?.() ?? [])
    const journeyStartReference = journeyTracks[0]?.flags?.start
    const journeyStartId = typeof journeyStartReference === 'object'
        ? journeyStartReference?.id
        : journeyStartReference
    const journeyStopReference = journeyTracks.at(-1)?.flags?.stop
    const journeyStopId = typeof journeyStopReference === 'object'
        ? journeyStopReference?.id
        : journeyStopReference
    const startPOI = poiList?.get?.(journeyStartId)
        ?? (typeof journeyStartReference === 'object' ? journeyStartReference : null)
    const stopPOI = poiList?.get?.(journeyStopId)
        ?? (typeof journeyStopReference === 'object' ? journeyStopReference : null)

    return {
        journeyStartId,
        journeyStopId,
        startPOI,
        stopPOI,
        coLocatedStartId: stopPOI?.tooClose === true ? journeyStartId : null,
    }
}

/** Prepare stable Replay passage distances and normalized progress for one POI. */
const prepareReplayPOIPassages = (entry, totalDistance, isEndpoint, includeArrival = false) => {
    const projectedPassages = Array.isArray(entry?.projectedPassages) ? entry.projectedPassages : []
    const distances = isEndpoint || projectedPassages.length === 0
        ? [{key: 'primary', index: 0, distance: finiteNumber(entry?.projectedAbscissa)}]
        : projectedPassages.map((passage, index) => ({
            key: index === 0 ? 'primary' : `repeat-${index}`,
            index,
            distance: finiteNumber(passage?.projectedAbscissa),
        }))
    const preparedPassages = distances
        .filter(passage => passage.distance !== null)
        .map(passage => ({
            ...passage,
            progress: totalDistance > 0 ? Math.max(0, Math.min(1, passage.distance / totalDistance)) : 0,
        }))

    if (includeArrival && totalDistance > 0) {
        preparedPassages.push({key: 'arrival', index: null, distance: totalDistance, progress: 1})
    }

    return preparedPassages
}

/** Find the first passage index whose normalized route progress is in range. */
const lowerBoundReplayPOIPassageProgress = (passages, minimumProgress) => {
    let lower = 0
    let upper = passages.length
    while (lower < upper) {
        const middle = Math.floor((lower + upper) / 2)
        if (passages[middle].progress < minimumProgress) {
            lower = middle + 1
        }
        else {
            upper = middle
        }
    }
    return lower
}

/** Select nearby presentation candidates and currently open POIs for one Replay sample. */
const replayPOICandidatesForProgress = (state, progress, replayDurationSeconds, fallbackEntries) => {
    const entriesById = state.replayUniqueNearbyPOIById
    const passageIndex = state.replayPOIPassageProgressIndex
    if (!(entriesById instanceof Map) || !Array.isArray(passageIndex)) {
        return fallbackEntries
    }

    const progressRadius = Math.min(1, MAX_REPLAY_POI_DISPLAY_DURATION_SECONDS / replayDurationSeconds + 1e-9)
    const normalizedProgress = Math.max(0, Math.min(1, progress))
    const minimumProgress = Math.max(0, normalizedProgress - progressRadius)
    const maximumProgress = Math.min(1, normalizedProgress + progressRadius)
    const firstPassageIndex = lowerBoundReplayPOIPassageProgress(passageIndex, minimumProgress)
    const candidateIds = new Set(state.replayPoiTriggered)
    for (let index = firstPassageIndex; index < passageIndex.length; index += 1) {
        const passage = passageIndex[index]
        if (passage.progress > maximumProgress) {
            break
        }
        candidateIds.add(passage.poiId)
    }

    return Array.from(candidateIds, poiId => entriesById.get(poiId)).filter(Boolean)
}

/**
 * Project a POI into the active Replay view and check its crop bounds.
 * @param {object} mode - Replay session mode.
 * @param {object} poi - POI being checked.
 * @returns {boolean|null} Crop visibility, or null when no render target is available.
 */
export const isPOIInsideVideoCrop = (mode, poi) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const viewer = call.cesiumViewer?.()
    const scene = call.cesiumScene?.() ?? viewer?.scene
    const canvas = viewer?.canvas ?? scene?.canvas
    if (!scene || !canvas || typeof call.poiEntities !== 'function') {
        return null
    }

    const canvasBounds = canvas.getBoundingClientRect?.()
    const canvasWidth = finiteNumber(canvasBounds?.width)
        ?? finiteNumber(canvas.clientWidth)
        ?? finiteNumber(canvas.width)
    const canvasHeight = finiteNumber(canvasBounds?.height)
        ?? finiteNumber(canvas.clientHeight)
        ?? finiteNumber(canvas.height)
    if (canvasWidth === null || canvasHeight === null || canvasWidth <= 0 || canvasHeight <= 0) {
        return null
    }

    const isIsolatedTarget = viewer && viewer !== globalThis.lgs?.viewer
    const configuredCrop = isIsolatedTarget ? null : call.videoCropRect?.()
    const cropLeft = finiteNumber(configuredCrop?.left) ?? 0
    const cropTop = finiteNumber(configuredCrop?.top) ?? 0
    const cropWidth = finiteNumber(configuredCrop?.width) ?? canvasWidth
    const cropHeight = finiteNumber(configuredCrop?.height) ?? canvasHeight
    const right = cropLeft + cropWidth
    const bottom = cropTop + cropHeight
    if (cropWidth <= 0 || cropHeight <= 0) {
        return false
    }

    const camera = viewer?.camera ?? scene.camera
    const entities = call.poiEntities(poi)
    for (const entity of entities) {
        const position = entity.position?.getValue?.(JulianDate.now()) ?? entity.position
        if (!position || ![position.x, position.y, position.z].every(Number.isFinite)) {
            continue
        }

        if (camera?.positionWC && camera?.directionWC) {
            const toPOI = Cartesian3.subtract(position, camera.positionWC, new Cartesian3())
            if (Cartesian3.dot(toPOI, camera.directionWC) <= 0) {
                continue
            }
        }

        let windowPosition = null
        try {
            windowPosition = typeof scene.worldToWindowCoordinates === 'function'
                ? scene.worldToWindowCoordinates(position)
                : SceneTransforms.worldToWindowCoordinates(scene, position)
        }
        catch {
            windowPosition = null
        }
        if (!windowPosition) {
            windowPosition = scene.cartesianToCanvasCoordinates?.(position, new Cartesian2()) ?? null
        }

        if (windowPosition
            && windowPosition.x >= cropLeft
            && windowPosition.x <= right
            && windowPosition.y >= cropTop
            && windowPosition.y <= bottom) {
            return true
        }
    }

    return false
}

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

/** Refresh nearby POIs for the selected Replay journey. */
export const syncRuntimeNearbyPOIs = (_mode, journey = currentReplayJourney()) => {
    const store = replayStore()
    const poiManager = globalThis.__?.ui?.poiManager
    if (!journey?.slug || !store || !poiManager?.getJourneyReplayPOIsForJourney) {
        return []
    }

    const poiDistance = globalThis.lgs?.settings?.ui?.replay?.poiDistance ?? store.poiDistance ?? null
    const {
        poiVisibilityMode,
        includeGlobalPois,
        globalPoiDistanceMeters,
    } = currentJourneyReplayPoiBehavior()
    const nearbyPois = poiManager.getJourneyReplayPOIsForJourney(journey, poiDistance, {
        includeHidden:            poiVisibilityMode === 'yes',
        includeGlobalPois,
        globalPoiDistanceMeters:   globalPoiDistanceMeters ?? poiDistance,
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

/** Restore the POI expansion and appearance state saved before Replay playback. */
export const restoreNearbyPOIsAfterPlayback = async (mode, {restoreExpanded = true} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        advanceReplayPOISyncRevision(state)
        const restoreEntries = restoreExpanded ? Array.from(state.replayPoiExpandedState.entries()) : []
        if (restoreExpanded) {
            state.replayPoiExpandedState.clear()
        }
        state.replayPoiTriggered.clear()
        state.replayPOIAppearanceState?.clear()
        state.lastReplayPOIProgress = null
        publishAnimatedPOIs(state.replayPoiTriggered)
        state.sortedNearbyPois = []
        state.replayUniqueNearbyPOIs = null
        state.replayUniqueNearbyPOIById = null
        state.replayPOIPassageProgressIndex = null
        state.replayStartPOI = null

        await Promise.all(restoreEntries.map(([poiId, expanded]) => call.updatePOIExpandedState(poiId, expanded === true)))
    }

export const closeJourneyReplayOpenedPOIsBeforeStopClips = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        advanceReplayPOISyncRevision(state)
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

/** Collapse replay-animated POIs and reset their crop-entry counters before playback. */
export const prepareNearbyPOIsForPlayback = async mode => {
        const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
        const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.replayPOIAppearanceState ??= new Map()
        const preparationPOIsWereApplied = state.replayPOIPreparationActive === true
        const {poiVisibilityMode: initialVisibilityMode} = currentJourneyReplayPoiBehavior()
        if (initialVisibilityMode === 'no') {
            state.replayPoiTriggered.clear()
            call.applyJourneyReplayPOIVisibility()
        }
        // Both the replay state reset and POI expansion restoration are applied
        // synchronously before the returned promise settles. Keep setup in this
        // same turn so the controller's immediate Start event cannot overtake it.
        const restorationPromise = call.restoreNearbyPOIsAfterPlayback({
            restoreExpanded: !preparationPOIsWereApplied,
        })
        state.replayPOIPreparationActive = true
        const replayRuntime = replayStore()
        if (replayRuntime) {
            replayRuntime.poiPresentationPreparationActive = true
        }
        state.replayPOIAnimationOccurred = false

        const journey = currentReplayJourney()
        const replayPOIBehavior = currentJourneyReplayPoiBehavior()
        const {poiVisibilityMode} = replayPOIBehavior
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
        const uniqueSourcePOIs = sortedNearbyPois.length > 0
            ? sortedNearbyPois
            : replayStore()?.nearbyPois ?? nearbyPois
        const uniqueNearbyPOIs = new Map()
        uniqueSourcePOIs.forEach(entry => {
            const poiId = entry?.poi?.id
            if (poiId && !uniqueNearbyPOIs.has(poiId)) {
                uniqueNearbyPOIs.set(poiId, entry)
            }
        })
        const endpointPOIs = replayJourneyEndpoints(
            journey,
            globalThis.lgs?.stores?.main?.components?.pois?.list,
        )
        const startPOI = endpointPOIs.startPOI
            ?? sortedNearbyPois.find(entry => entry?.poi?.type === 'start')?.poi
        state.replayStartPOI = startPOI ?? null
        if (startPOI?.id) {
            uniqueNearbyPOIs.set(startPOI.id, {
                poi: startPOI,
                projectedAbscissa: 0,
            })
        }
        const totalDistance = finiteNumber(state.sampler?.totalDistance) ?? 0
        state.replayUniqueNearbyPOIs = Array.from(uniqueNearbyPOIs.values()).map(entry => {
            const poi = entry?.poi
            return {
                ...entry,
                replayPassages: prepareReplayPOIPassages(
                    entry,
                    totalDistance,
                    ['start', 'stop'].includes(poi?.type),
                    poi?.type === 'start' && poi?.id === endpointPOIs.coLocatedStartId,
                ),
            }
        })
        state.replayUniqueNearbyPOIById = new Map(state.replayUniqueNearbyPOIs
            .filter(entry => entry?.poi?.id)
            .map(entry => [entry.poi.id, entry]))
        state.replayPOIPassageProgressIndex = state.replayUniqueNearbyPOIs
            .flatMap(entry => (entry?.replayPassages ?? []).map(passage => ({
                poiId: entry.poi.id,
                progress: passage.progress,
            })))
            .sort((left, right) => left.progress - right.progress)
        state.replayPOIAppearanceState.clear()
        state.lastReplayPOIProgress = null

        call.applyJourneyReplayPOIVisibility(sortedNearbyPois)
        state.replayPOIPreparationActive = false
        if (replayRuntime) {
            replayRuntime.poiPresentationPreparationActive = false
        }

        const poisToCollapse = poiVisibilityMode === 'yes'
            ? call.replayPOICandidates(sortedNearbyPois)
            : sortedNearbyPois.map(entry => entry?.poi).filter(Boolean)
        const collapsePromises = []
        for (const poi of poisToCollapse) {
            const poiId = poi?.id
            if (!poiId || !poi) {
                continue
            }

            const poiSettings = normalizeJourneyReplayPOISettings(poi.replay)
            const isStartOrStop = poi.type === 'start' || poi.type === 'stop'
            if ((isStartOrStop && !shouldAnimateReplayPOI(replayPOIBehavior, poiSettings))
                || poiSettings.animated === false) {
                continue
            }

            if (!state.replayPoiExpandedState.has(poiId)) {
                state.replayPoiExpandedState.set(poiId, poi.expanded === true)
            }
            collapsePromises.push(call.updatePOIExpandedState(poiId, false))
        }

        await Promise.all([restorationPromise, ...collapsePromises])

    }

/**
 * Open an authorized POI immediately and expose its entity during Replay.
 *
 * @param {object} mode - Replay session mode.
 * @param {string} poiId - POI identifier to open.
 * @returns {Promise<boolean>} Whether the POI was authorized for animation.
 */
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
    const hiddenEndpoint = (poi?.type === 'start' || poi?.type === 'stop') && settings.visible === false
    if (!poi || !shouldAnimate || hiddenEndpoint) {
        return false
    }
    state.replayPoiTriggered.add(poiId)
    publishAnimatedPOIs(state.replayPoiTriggered)
    state.replayPOIAnimationOccurred = true
    call.setPOIEntityVisibility(poi, true, {allowReplayAnimation: true})
    globalThis.lgs?.scene?.requestRender?.()
    await call.updatePOIExpandedState(poiId, true)
    return true
}

/**
 * Synchronize POI display windows and trigger the Start flag at Replay startup.
 *
 * @param {object} mode - Replay session mode.
 * @param {object|null} sample - Current Replay sample.
 * @param {object} options - Event context for the current sample.
 * @param {boolean} options.isReplayStart - Whether this sample is the Replay start event.
 * @param {object|null} options.phase - Canonical phase for the rendered frame.
 * @returns {Promise<void>} Completion of POI presentation updates.
 */
export const syncNearbyPOIsForSample = async (mode, sample = null, {isReplayStart = false, phase = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.replayPOIAppearanceState ??= new Map()
        const progress = finiteNumber(sample?.progress)
        if (progress === null) {
            advanceReplayPOISyncRevision(state)
            return
        }
        const syncRevision = advanceReplayPOISyncRevision(state)

        const nearbyPois = state.sortedNearbyPois.length > 0
            ? state.sortedNearbyPois
            : replayStore()?.nearbyPois ?? []
        const replayNearbyPois = Array.isArray(nearbyPois) ? nearbyPois : []
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

        const replay = replayStore()
        const direction = Number(state.controller?.direction ?? replay?.direction) < 0 ? -1 : 1
        const traversalProgress = direction < 0 ? 1 - progress : progress
        if (state.lastReplayPOIProgress !== null && traversalProgress < state.lastReplayPOIProgress) {
            state.replayPOIAppearanceState.clear()
        }
        state.lastReplayPOIProgress = traversalProgress
        const replayPhase = phase ?? replay?.replayFramePhase
        // POI display timers follow route time so playback slowdowns cannot expire them early.
        const currentReplaySeconds = Math.max(0, Math.min(1, traversalProgress)) * replayDurationSeconds
        const currentJourney = state.sampler?.journey ?? currentReplayJourney()
        const currentPOIList = globalThis.lgs?.stores?.main?.components?.pois?.list
        const endpointPOIs = replayJourneyEndpoints(currentJourney, currentPOIList)
        const {coLocatedStartId} = endpointPOIs
        const hasPreparedUniqueNearbyPOIs = Array.isArray(state.replayUniqueNearbyPOIs)
        const startPOI = endpointPOIs.startPOI
            ?? state.replayStartPOI
            ?? (!hasPreparedUniqueNearbyPOIs ? replayNearbyPois.find(entry => entry?.poi?.type === 'start')?.poi : null)

        if (shouldAnimatePOIs) {
            let uniqueNearbyPois = state.replayUniqueNearbyPOIs
            if (!hasPreparedUniqueNearbyPOIs) {
                const fallbackUniqueNearbyPOIs = new Map(replayNearbyPois
                    .map(entry => [entry?.poi?.id, entry])
                    .filter(([poiId]) => Boolean(poiId)))
                if (startPOI?.id) {
                    fallbackUniqueNearbyPOIs.set(startPOI.id, {poi: startPOI, projectedAbscissa: 0})
                }
                uniqueNearbyPois = Array.from(fallbackUniqueNearbyPOIs.values())
            }
            uniqueNearbyPois = replayPOICandidatesForProgress(
                state,
                progress,
                replayDurationSeconds,
                uniqueNearbyPois,
            )
            for (const entry of uniqueNearbyPois) {
                const poiId = entry?.poi?.id
                const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId) ?? entry?.poi
                if (!poiId || !poi) {
                    continue
                }

                const isEndpoint = poi.type === 'start' || poi.type === 'stop'
                const projectedPassages = Array.isArray(entry?.projectedPassages)
                    ? entry.projectedPassages
                    : []
                // Endpoint flags retain their established primary and arrival rules.
                const passages = Array.isArray(entry?.replayPassages)
                    ? entry.replayPassages
                    : prepareReplayPOIPassages(
                        entry,
                        totalDistance,
                        isEndpoint,
                        poi.type === 'start' && poiId === coLocatedStartId,
                    )
                const poiSettings = normalizeJourneyReplayPOISettings(poi.replay)
                const animateThisPOI = shouldAnimateReplayPOI({
                    basicMode,
                    animatePoisDuringJourneyReplay,
                    animateAllPoisDuringJourneyReplay,
                }, poiSettings)
                const visibleForReplay = isEndpoint
                    ? poiSettings.visible !== false
                    : poiVisibilityMode === 'no'
                        || poiVisibilityMode === 'yes'
                        || poiSettings.visible !== false
                if (!visibleForReplay || !animateThisPOI) {
                    for (const passage of passages) {
                        const appearanceKey = isEndpoint
                            ? `${poiId}:endpoint:${passage.key}`
                            : poiId
                        const appearance = state.replayPOIAppearanceState.get(appearanceKey)
                        if (appearance) {
                            appearance.insideCropByPassage ??= new Map()
                            appearance.insideCropByPassage.set(passage.key, false)
                        }
                    }
                    continue
                }

                const displayDurationSeconds = basicMode
                    ? poiAnimationDurationSeconds
                    : poiSettings.displayDurationSeconds
                for (const passage of passages) {
                    const startsAtReplayBoundary = (isReplayStart || progress === 0 || replayPhase?.endpointPause === 'start')
                        && poi.type === 'start'
                        && passage.key === 'primary'
                    // Endpoint holds own their presentation independently of passage timers.
                    // A zero-duration or expired passage must not hide the departure flag.
                    if (startsAtReplayBoundary) {
                        expandedIds.add(poiId)
                        continue
                    }
                    const traversalTargetProgress = direction < 0 ? 1 - passage.progress : passage.progress
                    const markerReachedPOI = traversalProgress >= traversalTargetProgress
                    const inPassageWindow = isReplayPOIAnimationActiveAtProgress({
                        progress,
                        poiDistance: passage.distance,
                        totalDistance,
                        replayDurationSeconds,
                        animationDurationSeconds: displayDurationSeconds,
                    })
                    const atTraversalEnd = isEndpoint
                        && displayDurationSeconds > 0
                        && traversalTargetProgress >= 1
                        && traversalProgress >= 1
                        && markerReachedPOI
                    const atEndpointEvent = startsAtReplayBoundary || atTraversalEnd
                    // Admit the exact arrival frame even when it equals the half-open window's end.
                    const nearPassage = startsAtReplayBoundary || inPassageWindow || atTraversalEnd
                    // A wide camera view can contain the whole route. Crop entry must
                    // not open distant POIs before their route-relative approach window.
                    const passageIndex = passage.index ?? 0
                    const passageCropVisibility = passage.key === 'arrival'
                        ? undefined
                        : replay?.poiCropPassageVisibility?.[poiId]?.[passageIndex]
                    // Prefer the route-projected crop decision when available. A live camera pose can
                    // change between runs and make the same passage animate inconsistently.
                    const hasAggregateCropDecision = passageCropVisibility === undefined
                        && (isEndpoint || projectedPassages.length <= 1)
                        && typeof replay?.poiCropVisibility?.[poiId] === 'boolean'
                    const projectedCropVisible = passageCropVisibility === true
                        || (hasAggregateCropDecision && replay.poiCropVisibility[poiId] === true)
                    const hasProjectedCropDecision = typeof passageCropVisibility === 'boolean'
                        || hasAggregateCropDecision
                    const cropVisible = hasProjectedCropDecision
                        ? projectedCropVisible
                        : isPOIInsideVideoCrop(mode, poi) !== false
                    const insideCrop = atEndpointEvent
                        || (nearPassage && cropVisible)
                    const appearanceKey = isEndpoint
                        ? `${poiId}:endpoint:${passage.key}`
                        : poiId
                    const appearance = state.replayPOIAppearanceState.get(appearanceKey) ?? {
                        insideCropByPassage: new Map(),
                        startTimesByPassage: new Map(),
                    }
                    appearance.insideCropByPassage ??= new Map()
                    appearance.startTimesByPassage ??= new Map(
                        (appearance.startTimes ?? []).map((startTime, index) => [
                            startTime.passageKey ?? (index === 0 ? 'primary' : `legacy-${index}`),
                            startTime,
                        ]),
                    )
                    delete appearance.startTimes
                    const wasInsideCrop = appearance.insideCropByPassage.get(passage.key) === true
                    let passageStartTime = appearance.startTimesByPassage.get(passage.key)
                    if (insideCrop && !wasInsideCrop && !passageStartTime) {
                        // Keep an early crop entry visible until the marker reaches the POI, then start its display timer.
                        passageStartTime = {
                            displayStartedAt: markerReachedPOI ? currentReplaySeconds : null,
                        }
                        appearance.startTimesByPassage.set(passage.key, passageStartTime)
                    }
                    appearance.insideCropByPassage.set(passage.key, insideCrop)
                    state.replayPOIAppearanceState.set(appearanceKey, appearance)

                    if (passageStartTime?.displayStartedAt === null && markerReachedPOI) {
                        passageStartTime.displayStartedAt = currentReplaySeconds
                    }
                    if (passageStartTime && (passageStartTime.displayStartedAt === null
                        || currentReplaySeconds < passageStartTime.displayStartedAt + displayDurationSeconds)) {
                        expandedIds.add(poiId)
                    }
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
        const newlyExpandedIds = Array.from(expandedIds).filter(poiId => {
            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            return !state.replayPoiTriggered.has(poiId) || poi?.expanded !== true
        })
        state.replayPoiTriggered = expandedIds
        publishAnimatedPOIs(expandedIds)
        if (newlyExpandedIds.length > 0) {
            state.replayPOIAnimationOccurred = true
        }
        await Promise.all([
            ...collapsedIds.map(poiId => call.updatePOIExpandedState(poiId, false)),
            ...newlyExpandedIds.map(poiId => call.updatePOIExpandedState(poiId, true)),
        ])
        if (!isCurrentReplayPOISyncRevision(state, syncRevision)) {
            return
        }
        for (const poiId of expandedIds) {
            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            if (poi) {
                call.setPOIEntityVisibility?.(poi, true, {allowReplayAnimation: true})
            }
        }
        if (collapsedIds.length > 0 || newlyExpandedIds.length > 0) {
            call.applyJourneyReplayPOIVisibility?.()
        }
    }

    /**
     * Pull the live Cesium camera state back into the replay settings/store.
     * This keeps the drawer and the Cesium viewport in lockstep while the FT is running.
     */
