/**
 * Replay camera Visibility behavior.
 */


import {ArcType, Cartesian2, Cartesian3, Cartographic, CatmullRomSpline, Color, ExtrapolationType, JulianDate, EasingFunction, HeightReference, HorizontalOrigin, LinearApproximation, Matrix4, PolylineDashMaterialProperty, SampledPositionProperty, SceneTransforms, Transforms, VerticalOrigin, Math as CesiumMath} from 'cesium'
import {REPLAY_DRAWER} from '@Core/constants'
import {Journey} from '@Core/Journey'
import {CameraUtils} from '@Utils/cesium/CameraUtils'
import {POIUtils} from '@Utils/cesium/POIUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'
import {finiteNumber, replayStore} from './JourneyReplayRuntime'
import {
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForPositionMode, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
} from './JourneyReplayCameraMath'
import {
    REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET, REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE,
    getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker,
} from './JourneyReplayProgressionStyle'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'

import {
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
    CAMERA_VIEW_POSITION_EPSILON_METERS,
    CAMERA_VIEW_ANGLE_EPSILON_RADIANS,
    CAMERA_TIMING_START_ANGLE_RADIANS,
    CAMERA_TIMING_SETTLE_ANGLE_RADIANS,
    CAMERA_DETERMINISTIC_FOLLOW_RESPONSE_SECONDS,
    CAMERA_REDIRECT_MAX_TRANSITION_SECONDS,
    CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS,
    CAMERA_REDIRECT_TRACE_VISIBILITY_OFFSETS_METERS,
    CAMERA_REDIRECT_REQUIRED_TRACE_OFFSET_METERS,
    CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS,
    CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS,
    CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS,
    REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS,
    REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR,
    REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
    REPLAY_EVENT_STOP_CLIPS_COMPLETE,
    CAMERA_REDIRECT_CANDIDATES,
    isUsableCartesian3,
    safeCartesian3Normalize,
    safeCartesian3Lerp,
} from './JourneyReplayCameraShared'
import {
    headingBetweenPoints,
    headingFromWindowPoints,
    orientedHeadingFromWindowPoints,
    cameraGuideKey,
    turnAngleAt,
    cameraGuideProgresses,
    buildCameraGuide,
    smoothedGuide,
    guideTimeForProgress,
    cameraGuidePositionPropertyForGuide,
    guideSampleFromPositionProperty,
    headingFromPositionProperty,
    cameraAltitudeForSample,
    cameraViewForSample,
} from './JourneyReplayCameraGuide'
import {
    memoizeReplayCameraUpdateCache,
    replayCameraUpdateMarkerSettingsKey,
    replayCameraUpdateRedirectStateKey,
    replayCameraUpdateSampleKey,
    replayCameraUpdateViewKey,
    replayCameraUpdateCameraSettingsKey,
} from './JourneyReplayCameraUpdateCache'
import {
    applyCameraView,
    liveCameraPitch,
    markerPositionForSample,
    markerRenderHeightForSample,
    markerRenderCartesianForSample,
    windowPositionForSample,
    trackingWindowPositionForSample,
    cameraCollisionForSample,
    terrainHeightForLonLat,
    persistCameraSettings,
    updateCameraSettingsFromCesiumControls,
    updateCameraFromCesiumControls,
    syncCameraDrawerFromSettings,
    now,
    cesiumScene,
    smoothRadians,
    timeNormalizedSmoothingFactor,
    traceCameraTiming,
    traceCameraChangeTiming,
    cancelCameraBezierTransition,
} from './JourneyReplayCameraState'
import {
    currentCameraFrame,
    applyCameraFrame,
    interpolateCameraFrame,
    cameraTransitionVelocity,
    startDeterministicCameraTransition,
    applyDeterministicCameraTransition,
    applyDeterministicCameraFollower,
    cameraRecenterFrame,
    cameraViewDelta,
    cameraViewIsStable,
    rememberCameraView,
    headingEasingFactor,
} from './JourneyReplayCameraTransition'
import {
    removeToleranceZoneOverlay,
    setToleranceZoneOverlayVisible,
    videoCropRect,
    viewportRectForCesiumSurface,
    updateToleranceZoneOverlay,
} from './JourneyReplayCameraOverlay'
export const rememberNominalCameraView =  (mode, view) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        state.lastNominalCameraHeading = finiteNumber(view?.heading) ?? state.lastNominalCameraHeading
        state.lastNominalCameraPitch = finiteNumber(view?.pitch) ?? state.lastNominalCameraPitch
    }

/**
 * Reset transient camera interpolation state.
 *
 * The compiled constrained path is preserved by default so Draft and HQ can
 * consume the exact same in-memory path. Sampler replacement explicitly
 * invalidates it through the full camera-controller reset.
 *
 * @param {object} mode - Replay camera mode.
 * @param {object} [options] - Reset options.
 * @param {boolean} [options.preserveConstrainedPath=true] - Preserve the compiled replay path.
 * @returns {void}
 */
export const resetCameraInterpolationState = (mode, {
    preserveConstrainedPath = true,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]

        state.lastCameraHeading = null
        state.lastCameraPitch = null
        state.lastNominalCameraHeading = null
        state.lastNominalCameraPitch = null
        state.lastAppliedCameraView = null
        state.navigationCameraView = null
        state.cameraPitchCorrectionState = null
        state.cameraRedirectState = null
        state.cameraNominalVisibilitySince = null
        if (!preserveConstrainedPath) {
            state.constrainedReplayCameraPath = null
        }
        state.deterministicCameraFollowerAt = null
        state.deterministicCameraFollowerActive = false
        state.deterministicCameraFollowerVelocity = null
        state.cameraSmoothingDeltaSeconds = null
        state.lastCameraLogicalNow = null
        state.lastCameraTimingLogicalNow = null
        state.lastCameraTimingWallNow = null
        state.cameraTimingChange = null
    }

export const cameraRedirectPitchLimits = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return ({
        min: SAFE_TOP_DOWN_PITCH,
        max: degreesToRadians(-5) ?? -0.08726646259971647,
    })
}

export const cameraViewWithRedirectState = (mode, view, redirectState = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!view) {
            return null
        }
        if (!redirectState) {
            return view
        }

        const {min, max} = call.cameraRedirectPitchLimits()
        return {
            ...view,
            heading: (finiteNumber(view.heading) ?? 0) + (finiteNumber(redirectState.headingOffset) ?? 0),
            pitch:   clamp(
                (finiteNumber(view.pitch) ?? SAFE_TOP_DOWN_PITCH) + (finiteNumber(redirectState.pitchOffset) ?? 0),
                min,
                max,
            ),
        }
    }

/**
 * Resolve a metric lookahead sample for replay camera tracking.
 *
 * @param {object} mode - Replay mode.
 * @param {object} sample - Current replay sample.
 * @param {object} [options] - Lookahead options.
 * @param {number|null} [options.lookaheadSeconds=null] - Time horizon.
 * @param {number} [options.minimumMeters=120] - Metric floor for the horizon.
 * @returns {object|null} Future replay sample or null when unavailable.
 */
export const cameraLookaheadSample = (mode, sample, {
    lookaheadSeconds = null,
    minimumMeters = CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const currentDistance = finiteNumber(sample?.distanceFromStart)
        if (currentDistance === null || !state.sampler?.atDistance) {
            return null
        }

        const seconds = finiteNumber(lookaheadSeconds)
        const metricFloor = Math.max(
            0,
            finiteNumber(minimumMeters) ?? CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS,
        )
        const next = typeof state.sampler.lookaheadAtProgress === 'function'
            ? state.sampler.lookaheadAtProgress(sample.progress, {
                seconds: seconds ?? 1,
                minimumMeters: metricFloor,
            })
            : state.sampler.atDistance(currentDistance + metricFloor)
        if (!next || Math.abs((finiteNumber(next?.distanceFromStart) ?? 0) - currentDistance) <= 0.0001) {
            return null
        }
        return next
    }

export const cameraLineOfSightVisibleForFrame =  (mode, frame) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const originCartographic = safeCartographicFromCartesian(frame?.destination)
        const targetSample = frame?.sample
        const targetHeight = finiteNumber(frame?.targetHeight) ?? finiteNumber(targetSample?.altitude ?? targetSample?.height) ?? 0
        const origin = cartographicToLonLat(originCartographic)
        const targetLongitude = finiteNumber(targetSample?.longitude)
        const targetLatitude = finiteNumber(targetSample?.latitude)
        if (!origin || targetLongitude === null || targetLatitude === null) {
            return false
        }

        for (let index = 1; index <= CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS; index += 1) {
            const ratio = index / (CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS + 1)
            const longitude = lerp(origin.longitude, targetLongitude, ratio)
            const latitude = lerp(origin.latitude, targetLatitude, ratio)
            const lineHeight = lerp(origin.altitude, targetHeight, ratio)
            const terrainHeight = call.terrainHeightForLonLat(longitude, latitude)
            if (
                terrainHeight !== null
                && terrainHeight + CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS >= lineHeight
            ) {
                return false
            }
        }

        return true
    }

/**
 * Measure the nearest terrain obstruction along a camera-to-marker segment.
 *
 * @param {object} mode - Replay camera mode.
 * @param {object|null} frame - Camera frame to inspect.
 * @returns {number|null} Distance in meters to the nearest obstruction.
 */
export const cameraLineOfSightObstacleDistanceForFrame = (mode, frame) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const originCartographic = safeCartographicFromCartesian(frame?.destination)
    const targetSample = frame?.sample
    const targetHeight = finiteNumber(frame?.targetHeight)
        ?? finiteNumber(targetSample?.altitude ?? targetSample?.height)
        ?? 0
    const origin = cartographicToLonLat(originCartographic)
    const targetLongitude = finiteNumber(targetSample?.longitude)
    const targetLatitude = finiteNumber(targetSample?.latitude)
    const cameraPosition = frame?.destination
    if (!origin || targetLongitude === null || targetLatitude === null || !cameraPosition) {
        return null
    }

    let nearestDistance = null
    for (let index = 1; index <= CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS; index += 1) {
        const ratio = index / (CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS + 1)
        const longitude = lerp(origin.longitude, targetLongitude, ratio)
        const latitude = lerp(origin.latitude, targetLatitude, ratio)
        const lineHeight = lerp(origin.altitude, targetHeight, ratio)
        const terrainHeight = call.terrainHeightForLonLat(longitude, latitude)
        if (
            terrainHeight === null
            || terrainHeight + CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS < lineHeight
        ) {
            continue
        }
        const terrainCartesian = safeCartesianFromLonLat({
            longitude,
            latitude,
            altitude: terrainHeight,
        })
        if (!terrainCartesian) {
            continue
        }
        const distance = Cartesian3.distance(cameraPosition, terrainCartesian)
        nearestDistance = nearestDistance === null
            ? distance
            : Math.min(nearestDistance, distance)
    }

    return nearestDistance
}

export const cameraViewFrame =  (mode, view) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return call.cameraRecenterFrame({
                                                             sample:         view?.sample,
                                                             heading:        view?.heading,
                                                             pitch:          view?.pitch,
                                                             roll:           view?.roll,
                                                             cameraSettings: view?.cameraSettings,
                                                             cameraHeight:   view?.cameraHeight,
                                                         })
}

export const cameraTraceVisibilityTargets = (mode, anchorSample) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!anchorSample) {
            return []
        }

        const targets = [{sample: anchorSample, required: true}]
        const currentDistance = finiteNumber(anchorSample?.distanceFromStart)
        if (currentDistance === null || !state.sampler?.atDistance) {
            return targets
        }

        const pushTarget = (sample, {required = false} = {}) => {
            const longitude = finiteNumber(sample?.longitude)
            const latitude = finiteNumber(sample?.latitude)
            if (longitude === null || latitude === null) {
                return
            }
            if (targets.some(entry =>
                                 Math.abs((finiteNumber(entry.sample?.longitude) ?? Number.POSITIVE_INFINITY) - longitude) <= 1e-8
                                 && Math.abs((finiteNumber(entry.sample?.latitude) ?? Number.POSITIVE_INFINITY) - latitude) <= 1e-8,
            )) {
                return
            }
            targets.push({sample, required})
        }

        CAMERA_REDIRECT_TRACE_VISIBILITY_OFFSETS_METERS.forEach(offset => {
            const trailingSample = state.sampler.atDistance(Math.max(0, currentDistance - offset))
            if (trailingSample) {
                pushTarget(trailingSample, {required: offset <= CAMERA_REDIRECT_REQUIRED_TRACE_OFFSET_METERS})
            }
        })

        return targets
    }

export const sampleFromVisibilityTarget =  (mode, target) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return ({
        ...target.sample,
        longitude: target.sample?.longitude,
        latitude:  target.sample?.latitude,
        altitude:  finiteNumber(target.sample?.altitude ?? target.sample?.height) ?? 0,
        height:    finiteNumber(target.sample?.height ?? target.sample?.altitude) ?? 0,
    })
}

export const renderedTargetVisible =  (mode, sample, cache = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const computeVisibility = () => {
            const scene = call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
            const camera = (call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera ?? scene?.camera
            const target = call.markerRenderCartesianForSample(sample)
            const windowPosition = call.windowPositionForSample(sample)
            if (!scene || !camera || !target || !windowPosition) {
                return null
            }

            const rect = call.viewportRectForCesiumSurface()
            if (!rect.width || !rect.height) {
                return null
            }
            if (
                windowPosition.x < 0
                || windowPosition.y < 0
                || windowPosition.x > rect.width
                || windowPosition.y > rect.height
            ) {
                return false
            }

            const canvasPosition = new Cartesian2(windowPosition.x, windowPosition.y)
            let pickedPosition = null
            if (scene.pickPositionSupported !== false && typeof scene.pickPosition === 'function') {
                try {
                    pickedPosition = scene.pickPosition(canvasPosition)
                }
                catch {
                    pickedPosition = null
                }
            }
            if (!pickedPosition) {
                const pickRay = camera.getPickRay?.(canvasPosition)
                pickedPosition = pickRay ? scene.globe?.pick?.(pickRay, scene) : null
            }
            const cameraPosition = camera.positionWC ?? camera.position
            if (!pickedPosition || !cameraPosition) {
                return null
            }

            const targetDistance = Cartesian3.distance(cameraPosition, target)
            const pickedDistance = Cartesian3.distance(cameraPosition, pickedPosition)
            return pickedDistance + CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS >= targetDistance
        }

        const cacheKey = replayCameraUpdateSampleKey(sample)
        return memoizeReplayCameraUpdateCache(cache, 'renderedTargetVisible', cacheKey, computeVisibility)
    }

/**
 * Resolve the depth distance to a rendered obstruction hiding a marker.
 *
 * @param {object} mode - Replay camera mode.
 * @param {object} sample - Marker sample to inspect.
 * @param {object|null} [cache=null] - Per-update visibility cache.
 * @returns {number|null} Distance from the Cesium camera to the obstruction.
 */
export const renderedTargetObstructionDistanceForSample = (mode, sample, cache = null) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

    const computeDistance = () => {
        const scene = call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
        const camera = (call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera ?? scene?.camera
        const target = call.markerRenderCartesianForSample(sample)
        const windowPosition = call.windowPositionForSample(sample)
        if (!scene || !camera || !target || !windowPosition) {
            return null
        }

        const rect = call.viewportRectForCesiumSurface()
        if (!rect.width || !rect.height
            || windowPosition.x < 0
            || windowPosition.y < 0
            || windowPosition.x > rect.width
            || windowPosition.y > rect.height) {
            return null
        }

        const canvasPosition = new Cartesian2(windowPosition.x, windowPosition.y)
        let pickedPosition = null
        if (scene.pickPositionSupported !== false && typeof scene.pickPosition === 'function') {
            try {
                pickedPosition = scene.pickPosition(canvasPosition)
            }
            catch {
                pickedPosition = null
            }
        }
        if (!pickedPosition) {
            const pickRay = camera.getPickRay?.(canvasPosition)
            pickedPosition = pickRay ? scene.globe?.pick?.(pickRay, scene) : null
        }
        const cameraPosition = camera.positionWC ?? camera.position
        if (!pickedPosition || !cameraPosition) {
            return null
        }

        const targetDistance = Cartesian3.distance(cameraPosition, target)
        const pickedDistance = Cartesian3.distance(cameraPosition, pickedPosition)
        return pickedDistance + CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS >= targetDistance
            ? pickedDistance
            : null
    }

    const cacheKey = replayCameraUpdateSampleKey(sample)
    return memoizeReplayCameraUpdateCache(cache, 'renderedTargetObstructionDistanceForSample', cacheKey, computeDistance)
}

export const renderedTraceVisibleForSample =  (mode, sample, cache = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const computeVisibility = () => {
            const targets = call.cameraTraceVisibilityTargets(sample)
            if (!targets.length) {
                return null
            }

            let hasRenderedResult = false
            let requiredTargetHidden = false
            for (const target of targets) {
                const targetSample = call.sampleFromVisibilityTarget(target)
                const visible = call.renderedTargetVisible(targetSample, cache)
                if (visible === null) {
                    continue
                }
                hasRenderedResult = true
                if (!visible && target.required !== false) {
                    requiredTargetHidden = true
                }
            }

            return hasRenderedResult ? !requiredTargetHidden : null
        }

        const cacheKey = replayCameraUpdateSampleKey(sample)
        return memoizeReplayCameraUpdateCache(cache, 'renderedTraceVisibleForSample', cacheKey, computeVisibility)
    }

export const cameraViewHasLineOfSight = (
    mode,
    view,
    anchorSample = view?.sample,
    cache = null,
    {markerOnly = false} = {},
) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const computeVisibility = () => {
            const frame = call.cameraViewFrame(view)
            if (!frame) {
                return false
            }

            const visibilityTargets = call.cameraTraceVisibilityTargets(anchorSample)
            const targets = markerOnly ? visibilityTargets.slice(0, 1) : visibilityTargets
            let hasVisibleTarget = false
            for (const target of targets) {
                const sample = call.sampleFromVisibilityTarget(target)
                const visible = call.cameraLineOfSightVisibleForFrame({
                                                                           ...frame,
                                                                           sample,
                                                                           targetHeight: call.markerRenderHeightForSample(sample),
                                                                       })
                if (!visible && target.required !== false) {
                    return false
                }
                hasVisibleTarget ||= visible
            }

            return hasVisibleTarget
        }

        const cacheKey = [
            replayCameraUpdateViewKey(view),
            replayCameraUpdateSampleKey(anchorSample),
            markerOnly ? 'marker' : 'trace',
        ].join('|')
        return memoizeReplayCameraUpdateCache(cache, 'cameraViewHasLineOfSight', cacheKey, computeVisibility)
    }

export const cameraViewVisibilityForSample = (mode, {
                                          nominalView,
                                          redirectState = null,
                                          futureSample = null,
                                          source = null,
                                          cameraSettings,
                                          markerSettings,
                                          markerOnly = false,
                                          cache = null,
                                      } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const computeVisibility = () => {
            const currentView = call.cameraViewWithRedirectState(nominalView, redirectState)
            if (!call.cameraViewHasLineOfSight(
                currentView,
                currentView?.sample,
                cache,
                {markerOnly},
            )) {
                return false
            }

            if (!futureSample) {
                return true
            }

            const futureNominalView = call.cameraViewForSample({
                                                                    sample:          futureSample,
                                                                    progress:        futureSample.progress ?? nominalView?.progress ?? 0,
                                                                    source,
                                                                    cameraSettings,
                                                                    markerSettings,
                                                                    previousHeading: nominalView?.heading,
                                                                    previousPitch:   nominalView?.pitch,
                                                                    cache,
                                                                })
            const futureView = call.cameraViewWithRedirectState(futureNominalView, redirectState)
            return call.cameraViewHasLineOfSight(
                futureView,
                futureView?.sample,
                cache,
                {markerOnly},
            )
        }

        const cacheKey = [
            replayCameraUpdateViewKey(nominalView),
            replayCameraUpdateRedirectStateKey(redirectState),
            futureSample ? replayCameraUpdateSampleKey(futureSample) : 'null',
            source ?? 'null',
            replayCameraUpdateCameraSettingsKey(cameraSettings),
            replayCameraUpdateMarkerSettingsKey(markerSettings),
            markerOnly ? 'marker' : 'trace',
        ].join('|')
        return memoizeReplayCameraUpdateCache(cache, 'cameraViewVisibilityForSample', cacheKey, computeVisibility)
    }

export const cameraRedirectCandidateScore =  (mode, candidate) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const headingOffset = Math.abs(finiteNumber(candidate?.headingOffset) ?? 0)
        const pitchOffset = Math.abs(finiteNumber(candidate?.pitchOffset) ?? 0)
        return (pitchOffset * 3) + headingOffset
    }

export const findCameraRedirectState = (mode, {
                                    nominalView,
                                    futureSample = null,
                                    source = null,
                                    cameraSettings,
                                    markerSettings,
                                    reuseCurrentIfVisible = true,
                                    minimumCandidateScore = null,
                                    maximumPitchOffset = null,
                                    markerOnly = false,
                                    requirePitchOffset = false,
                                    cache = null,
                                } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (cameraSettings?.canFixHiddenMarker === false) {
        return null
    }

        const computeRedirectState = () => {
            const currentPitchOffset = finiteNumber(state.cameraRedirectState?.pitchOffset) ?? 0
            const currentRedirectHasRequiredPitch = !requirePitchOffset || Math.abs(currentPitchOffset) > 1e-8
            if (reuseCurrentIfVisible && state.cameraRedirectState && currentRedirectHasRequiredPitch) {
                const currentVisible = call.cameraViewVisibilityForSample({
                                                                               nominalView,
                                                                               redirectState: state.cameraRedirectState,
                                                                               futureSample:  null,
                                                                               source,
                                                                               cameraSettings,
                                                                               markerSettings,
                                                                               markerOnly,
                                                                               cache,
                                                                           })
                if (currentVisible) {
                    return state.cameraRedirectState
                }
            }

            const candidates = []
            const pitchLimit = finiteNumber(maximumPitchOffset)
            const pushCandidate = candidate => {
                if (!candidate) {
                    return
                }
                const headingOffset = finiteNumber(candidate.headingOffset) ?? 0
                const rawPitchOffset = finiteNumber(candidate.pitchOffset) ?? 0
                const pitchOffset = pitchLimit === null
                    ? rawPitchOffset
                    : clamp(rawPitchOffset, -Math.abs(pitchLimit), Math.abs(pitchLimit))
                if (requirePitchOffset && Math.abs(pitchOffset) <= 1e-8) {
                    return
                }
                if (candidates.some(entry =>
                                        Math.abs((finiteNumber(entry.headingOffset) ?? 0) - headingOffset) <= 1e-8
                                        && Math.abs((finiteNumber(entry.pitchOffset) ?? 0) - pitchOffset) <= 1e-8,
                )) {
                    return
                }
                candidates.push({headingOffset, pitchOffset})
            }

            pushCandidate(state.cameraRedirectState)
            CAMERA_REDIRECT_CANDIDATES.forEach(candidate => {
                pushCandidate({
                                  headingOffset: degreesToRadians(candidate.headingOffsetDeg) ?? 0,
                                  pitchOffset:   degreesToRadians(candidate.pitchOffsetDeg) ?? 0,
                              })
            })

            let bestCandidate = null
            let bestScore = Number.POSITIVE_INFINITY
            const minimumScore = finiteNumber(minimumCandidateScore)
            for (const candidate of candidates) {
                const visible = call.cameraViewVisibilityForSample({
                                                                        nominalView,
                                                                        redirectState: candidate,
                                                                        futureSample,
                                                                        source,
                                                                        cameraSettings,
                                                                        markerSettings,
                                                                        markerOnly,
                                                                        cache,
                })
                const score = visible ? call.cameraRedirectCandidateScore(candidate) : null
                if (!visible) {
                    continue
                }

                if (minimumScore !== null && score <= minimumScore) {
                    continue
                }
                if (score < bestScore) {
                    bestCandidate = candidate
                    bestScore = score
                }
            }

            return bestCandidate
        }

        const cacheKey = [
            replayCameraUpdateViewKey(nominalView),
            futureSample ? replayCameraUpdateSampleKey(futureSample) : 'null',
            source ?? 'null',
            replayCameraUpdateCameraSettingsKey(cameraSettings),
            replayCameraUpdateMarkerSettingsKey(markerSettings),
            reuseCurrentIfVisible === true ? '1' : '0',
            replayCameraUpdateRedirectStateKey(state.cameraRedirectState),
            finiteNumber(minimumCandidateScore) ?? 'null',
            finiteNumber(maximumPitchOffset) ?? 'null',
            markerOnly ? 'marker' : 'trace',
            requirePitchOffset ? 'pitch-required' : 'pitch-optional',
        ].join('|')
        return memoizeReplayCameraUpdateCache(cache, 'findCameraRedirectState', cacheKey, computeRedirectState)
    }
