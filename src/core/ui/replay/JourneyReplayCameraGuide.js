/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraGuide.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-10-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay camera Guide behavior.
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
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForAngle, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
} from './JourneyReplayCameraMath'
import {
    REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE,
    getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker,
} from './JourneyReplayProgressionStyle'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import {resolveJourneyReplayLogicalCameraRoll} from './JourneyReplayLogicalCameraPose'
import {
    replayCameraCropWidthMeters,
    replayCameraHeadingLookaheadSeconds,
    replayCameraHeadingWindowMeters,
    replayCameraPositionSmoothingWindowMeters,
    REPLAY_CAMERA_HEADING_MAX_PATH_RATIO,
} from './JourneyReplayCameraMotionSmoothing'

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
    CAMERA_NAVIGATION_HEADING_MIN_WINDOW_METERS,
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
    rememberNominalCameraView,
    resetCameraInterpolationState,
    cameraRedirectPitchLimits,
    cameraViewWithRedirectState,
    cameraLookaheadSample,
    cameraLineOfSightVisibleForFrame,
    cameraViewFrame,
    cameraTraceVisibilityTargets,
    sampleFromVisibilityTarget,
    renderedTargetVisible,
    renderedTraceVisibleForSample,
    cameraViewHasLineOfSight,
    cameraViewVisibilityForSample,
    cameraRedirectCandidateScore,
    findCameraRedirectState,
} from './JourneyReplayCameraVisibility'
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
import {
    memoizeReplayCameraUpdateCache,
    replayCameraUpdateCameraSettingsKey,
    replayCameraUpdateMarkerSettingsKey,
    replayCameraUpdateSampleKey,
} from './JourneyReplayCameraUpdateCache'

export const headingBetweenPoints = (mode, start, end) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!hasFiniteLonLat(start) || !hasFiniteLonLat(end)) {
            return 0
        }

        if (start.longitude === end.longitude && start.latitude === end.latitude) {
            return 0
        }

        const longitude1 = degreesToRadians(start.longitude)
        const longitude2 = degreesToRadians(end.longitude)
        const latitude1 = degreesToRadians(start.latitude)
        const latitude2 = degreesToRadians(end.latitude)
        if (longitude1 === null || longitude2 === null || latitude1 === null || latitude2 === null) {
            return 0
        }

        const y = Math.sin(longitude2 - longitude1) * Math.cos(latitude2)
        const x = Math.cos(latitude1) * Math.sin(latitude2)
            - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitude2 - longitude1)
        return Math.atan2(y, x)
    }

export const headingFromWindowPoints =  (mode, points) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!Array.isArray(points) || points.length < 2) {
            return 0
        }

        const origin = points[Math.floor(points.length / 2)]
        const localPoints = points
            .map(point => projectToLocalMeters(origin, point))
            .filter(Boolean)

        if (localPoints.length < 2) {
            return 0
        }

        let sumX = 0
        let sumY = 0
        localPoints.forEach(point => {
            sumX += point.x
            sumY += point.y
        })
        const meanX = sumX / localPoints.length
        const meanY = sumY / localPoints.length

        let covXX = 0
        let covXY = 0
        let covYY = 0
        localPoints.forEach(point => {
            const dx = point.x - meanX
            const dy = point.y - meanY
            covXX += dx * dx
            covXY += dx * dy
            covYY += dy * dy
        })

        const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY)
        return Number.isFinite(angle) ? replayHeadingFromLocalAxisAngle(angle) : 0
    }

export const orientedHeadingFromWindowPoints = (mode, points, current, future) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const axisHeading = call.headingFromWindowPoints(points)
        if (!Number.isFinite(axisHeading)) {
            return 0
        }

        const tangentHeading = call.headingBetweenPoints(current, future)
        const delta = replayAngularDelta(axisHeading, tangentHeading)
        if (delta === null) {
            return axisHeading
        }

        return Math.abs(delta) > (Math.PI / 2) ? axisHeading + Math.PI : axisHeading
    }

export const cameraGuideKey = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const journeySlug = state.sampler?.journey?.slug ?? 'journey'
        const points = state.sampler?.samples?.length ?? 0
        const distance = state.sampler?.totalDistance ?? 0
        return `${journeySlug}:${points}:${distance}`
    }

export const turnAngleAt = (mode, points, index) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (index <= 0 || index >= points.length - 1) {
            return 0
        }

        const previous = points[index - 1]
        const current = points[index]
        const next = points[index + 1]
        if (!previous || !current || !next) {
            return 0
        }

        const incoming = Cartesian3.subtract(current, previous, new Cartesian3())
        const outgoing = Cartesian3.subtract(next, current, new Cartesian3())
        const incomingLength = Cartesian3.magnitude(incoming)
        const outgoingLength = Cartesian3.magnitude(outgoing)

        if (incomingLength <= CARTESIAN_EPSILON || outgoingLength <= CARTESIAN_EPSILON) {
            return 0
        }

        return Cartesian3.angleBetween(incoming, outgoing)
    }

export const cameraGuideProgresses = (mode, {times, points}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (times.length < 2 || points.length < 2) {
            return [0]
        }

        const progresses = [0]

        for (let index = 0; index < points.length - 1; index += 1) {
            const start = points[index]
            const end = points[index + 1]
            const startTime = times[index]
            const endTime = times[index + 1]
            const segmentTime = Math.max(0, endTime - startTime)
            const segmentDistance = Cartesian3.distance(start, end)
            const baseSubdivisions = Math.max(1, Math.ceil(segmentDistance / CAMERA_GUIDE_TARGET_SPACING_METERS))
            const turnAngle = Math.max(
                call.turnAngleAt(points, index),
                call.turnAngleAt(points, index + 1),
            )
            const turnSubdivisions = Math.ceil(turnAngle / CAMERA_GUIDE_TURN_STEP_RADIANS)
            const timeSubdivisions = Math.ceil(segmentTime * 8)
            const subdivisions = clamp(
                Math.max(baseSubdivisions, turnSubdivisions + 1, timeSubdivisions),
                1,
                256,
            )

            for (let step = 1; step <= subdivisions; step += 1) {
                const ratio = step / subdivisions
                progresses.push(lerp(startTime, endTime, ratio))
            }
        }

        if (progresses[progresses.length - 1] !== 1) {
            progresses[progresses.length - 1] = 1
        }

        if (progresses.length <= CAMERA_GUIDE_MAX_STEPS + 1) {
            return progresses
        }

        const reduced = []
        for (let step = 0; step <= CAMERA_GUIDE_MAX_STEPS; step += 1) {
            const scaledIndex = (step / CAMERA_GUIDE_MAX_STEPS) * (progresses.length - 1)
            reduced.push(progresses[Math.round(scaledIndex)])
        }
        reduced[0] = 0
        reduced[reduced.length - 1] = 1
        return reduced
    }

export const buildCameraGuide = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const key = call.cameraGuideKey()
        if (state.cameraGuide && state.cameraGuideSourceKey === key) {
            return state.cameraGuide
        }

        const rawSamples = (state.sampler?.samples ?? []).filter(hasFiniteLonLat)
        if (rawSamples.length < 3) {
            state.cameraGuide = rawSamples.map(sample => ({
                progress: sample.progress,
                longitude: sample.longitude,
                latitude: sample.latitude,
                altitude: sample.altitude ?? sample.height ?? 0,
                distanceFromStart: finiteNumber(sample?.distanceFromStart) ?? 0,
            }))
            state.cameraGuideSourceKey = key
            return state.cameraGuide
        }

        const points = rawSamples.map(safeCartesianFromLonLat).filter(Boolean)
        if (points.length < 3) {
            state.cameraGuide = rawSamples.map(sample => ({
                progress: sample.progress,
                longitude: sample.longitude,
                latitude: sample.latitude,
                altitude: sample.altitude ?? sample.height ?? 0,
            }))
            state.cameraGuideSourceKey = key
            return state.cameraGuide
        }
        const times = rawSamples.map((sample, index) => {
            if (index === 0) {
                return 0
            }

            const progress = finiteNumber(sample.progress)
            if (progress === null) {
                return index / (rawSamples.length - 1)
            }

            return clamp(progress, 0, 1)
        })
        const spline = new CatmullRomSpline({times, points})
        const guide = []
        const progresses = call.cameraGuideProgresses({times, points})
        const minimumSteps = Math.max(
            CAMERA_GUIDE_MIN_STEPS,
            rawSamples.length * 8,
            Math.ceil((state.sampler?.totalDistance ?? 0) / CAMERA_GUIDE_TARGET_SPACING_METERS),
        )
        const sampledProgresses = progresses.length >= minimumSteps
            ? progresses
            : Array.from({length: minimumSteps + 1}, (_, index) => index / minimumSteps)

        sampledProgresses.forEach(progress => {
            const cartographic = (() => {
                try {
                    return safeCartographicFromCartesian(spline.evaluate(progress))
                }
                catch {
                    return null
                }
            })()
            const fallbackPoint = cartographic
                                 ? null
                                 : cameraGuideSampleFromRawSamples({rawSamples, times, progress})
            const lonLat = cartographic
                ? cartographicToLonLat(cartographic)
                : fallbackPoint
                  ? {
                      longitude: fallbackPoint.longitude,
                      latitude:  fallbackPoint.latitude,
                      altitude:  fallbackPoint.altitude,
                  }
                  : null
            if (!lonLat) {
                return
            }

            guide.push({
                progress,
                ...lonLat,
                distanceFromStart: fallbackPoint?.distanceFromStart ?? (state.sampler?.totalDistance ?? 0) * progress,
            })
        })

        state.cameraGuide = guide
        state.cameraGuideSourceKey = key
        return guide
    }

const smoothstep = value => {
    const t = clamp(finiteNumber(value) ?? 0, 0, 1)
    return t * t * (3 - (2 * t))
}

/**
 * Locate the nearest guide point for a normalized replay progress.
 *
 * @param {object[]} guide - Sorted replay camera guide.
 * @param {number} progress - Normalized replay progress.
 * @returns {number} Lower guide index.
 */
const lowerCameraGuideIndex = (guide, progress) => {
    let low = 0
    let high = Math.max(0, guide.length - 1)
    while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        const middleProgress = finiteNumber(guide[middle]?.progress) ?? 0
        if (middleProgress <= progress) {
            low = middle
        }
        else {
            high = middle - 1
        }
    }
    return low
}

/**
 * Resolve the turn drift stored at one guide point.
 *
 * @param {object[]} guide - Sorted camera guide.
 * @param {number} index - Guide point index.
 * @param {object} options - Drift limits.
 * @returns {object} Drift values, using zeros when no turn is present.
 */
const replayTurnDriftAtGuideIndex = (guide, index, {
    maxHeadingOffsetDeg,
    maxLateralOffsetMeters,
    minTurnAngleDeg,
    sensitivity = 1,
}) => {
    const previous = guide[Math.max(0, index - 1)]
    const current = guide[index]
    const next = guide[Math.min(guide.length - 1, index + 1)]
    if (!previous || !current || !next) {
        return {
            turnAngleRadians:     0,
            headingOffsetRadians: 0,
            lateralOffsetMeters:  0,
        }
    }

    const incoming = projectToLocalMeters(previous, current)
    const outgoing = projectToLocalMeters(current, next)
    const incomingMagnitude = Math.hypot(incoming?.x ?? 0, incoming?.y ?? 0)
    const outgoingMagnitude = Math.hypot(outgoing?.x ?? 0, outgoing?.y ?? 0)
    if (
        !incoming
        || !outgoing
        || incomingMagnitude <= 1e-6
        || outgoingMagnitude <= 1e-6
    ) {
        return {
            turnAngleRadians:     0,
            headingOffsetRadians: 0,
            lateralOffsetMeters:  0,
        }
    }

    const dot = (incoming.x * outgoing.x) + (incoming.y * outgoing.y)
    const cross = (incoming.x * outgoing.y) - (incoming.y * outgoing.x)
    const turnAngleRadians = Math.atan2(cross, dot)
    const minimumTurnRadians = CesiumMath.toRadians(
        Math.max(0, finiteNumber(minTurnAngleDeg) ?? 4),
    )
    const turnStrength = smoothstep(
        (Math.abs(turnAngleRadians) - minimumTurnRadians)
        / Math.max(CesiumMath.toRadians(50), Number.EPSILON),
    )
    const cornerSharpness = smoothstep(
        (Math.abs(turnAngleRadians) - CesiumMath.toRadians(18))
        / Math.max(CesiumMath.toRadians(42), Number.EPSILON),
    )
    const turnSign = Math.sign(turnAngleRadians) || 1
    const normalizedSensitivity = clamp(finiteNumber(sensitivity) ?? 1, 0, 1)
    return {
        turnAngleRadians,
        headingOffsetRadians: turnSign
                              * CesiumMath.toRadians(maxHeadingOffsetDeg)
                              * turnStrength
                              * lerp(0.85, 1.08, cornerSharpness)
                              * normalizedSensitivity,
        lateralOffsetMeters: turnSign
                             * Math.max(0, finiteNumber(maxLateralOffsetMeters) ?? 0)
                             * turnStrength
                             * lerp(1, 0.3, cornerSharpness)
                             * normalizedSensitivity,
    }
}

/**
 * Interpolate scalar guide values with continuous velocity at every point.
 *
 * @param {number} previous - Previous control value.
 * @param {number} start - Interval start value.
 * @param {number} end - Interval end value.
 * @param {number} next - Next control value.
 * @param {number} ratio - Interval ratio.
 * @returns {number} Cubic Hermite value.
 */
const interpolateTurnDriftValue = (previous, start, end, next, ratio) => {
    const safeRatio = clamp(finiteNumber(ratio) ?? 0, 0, 1)
    const squared = safeRatio * safeRatio
    const cubed = squared * safeRatio
    const startVelocity = (end - previous) * 0.5
    const endVelocity = (next - start) * 0.5
    return (
        (((2 * cubed) - (3 * squared) + 1) * start)
        + ((cubed - (2 * squared) + safeRatio) * startVelocity)
        + (((-2 * cubed) + (3 * squared)) * end)
        + ((cubed - squared) * endVelocity)
    )
}

/**
 * Estimate turn drift from an already compiled camera guide.
 *
 * @param {object[]} guide - Sorted replay camera guide.
 * @param {number} progress - Normalized journey progress.
 * @param {object} [options] - Drift tuning options.
 * @param {number} [options.maxHeadingOffsetDeg=10] - Maximum horizontal heading drift in degrees.
 * @param {number} [options.maxLateralOffsetMeters=60] - Maximum lateral drift in meters.
 * @param {number} [options.minTurnAngleDeg=4] - Minimum sustained turn angle in degrees.
 * @param {number} [options.sensitivity=1] - Drift response multiplier.
 * @returns {{turnAngleRadians: number, headingOffsetRadians: number, lateralOffsetMeters: number}|null} Drift envelope.
 */
export const replayTurnDriftForGuideProgress = (guide, progress, {
    maxHeadingOffsetDeg = 10,
    maxLateralOffsetMeters = 60,
    minTurnAngleDeg = 4,
    sensitivity = 1,
} = {}) => {
    if (!Array.isArray(guide) || guide.length < 3) {
        return null
    }

    const safeProgress = clamp(Number(progress) || 0, 0, 1)
    const startIndex = lowerCameraGuideIndex(guide, safeProgress)
    const endIndex = Math.min(guide.length - 1, startIndex + 1)
    const previousIndex = Math.max(0, startIndex - 1)
    const nextIndex = Math.min(guide.length - 1, endIndex + 1)
    const startProgress = finiteNumber(guide[startIndex]?.progress) ?? safeProgress
    const endProgress = finiteNumber(guide[endIndex]?.progress) ?? startProgress
    const span = Math.max(Number.EPSILON, endProgress - startProgress)
    const ratio = startIndex === endIndex
                  ? 0
                  : (safeProgress - startProgress) / span
    const options = {
        maxHeadingOffsetDeg,
        maxLateralOffsetMeters,
        minTurnAngleDeg,
        sensitivity,
    }
    const previousDrift = replayTurnDriftAtGuideIndex(guide, previousIndex, options)
    const startDrift = replayTurnDriftAtGuideIndex(guide, startIndex, options)
    const endDrift = replayTurnDriftAtGuideIndex(guide, endIndex, options)
    const nextDrift = replayTurnDriftAtGuideIndex(guide, nextIndex, options)
    const interpolate = key => interpolateTurnDriftValue(
        previousDrift[key],
        startDrift[key],
        endDrift[key],
        nextDrift[key],
        ratio,
    )
    const drift = {
        turnAngleRadians:     interpolate('turnAngleRadians'),
        headingOffsetRadians: interpolate('headingOffsetRadians'),
        lateralOffsetMeters:  interpolate('lateralOffsetMeters'),
    }
    return Math.abs(drift.headingOffsetRadians) <= 1e-9
           && Math.abs(drift.lateralOffsetMeters) <= 1e-6
        ? null
        : drift
}

/**
 * Estimate a turn-based drift envelope for the current replay progress.
 *
 * The result is used to widen the replay camera angle and optionally its
 * lateral motion when the journey enters a bend.
 *
 * @param {object} mode - Replay mode.
 * @param {number} progress - Normalized journey progress.
 * @param {object} [options] - Drift tuning options.
 * @param {number} [options.maxHeadingOffsetDeg=10] - Maximum horizontal heading drift in degrees.
 * @param {number} [options.maxLateralOffsetMeters=60] - Maximum lateral drift in meters.
 * @param {number} [options.minTurnAngleDeg=4] - Minimum sustained turn angle in degrees.
 * @param {number} [options.sensitivity=1] - Drift response multiplier.
 * @returns {{turnAngleRadians: number, headingOffsetRadians: number, lateralOffsetMeters: number}|null} Drift envelope.
 */
export const replayTurnDriftForProgress = (mode, progress, {
    maxHeadingOffsetDeg = 10,
    maxLateralOffsetMeters = 60,
    minTurnAngleDeg = 4,
    sensitivity = 1,
} = {}) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return replayTurnDriftForGuideProgress(call.buildCameraGuide(), progress, {
        maxHeadingOffsetDeg,
        maxLateralOffsetMeters,
        minTurnAngleDeg,
        sensitivity,
    })
}

export const smoothedGuide = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return (call.buildCameraGuide() ?? []).map(point => ({
        progress: point.progress,
        longitude: point.longitude,
        latitude: point.latitude,
        altitude: point.altitude ?? 0,
    }))
}

const replayCameraHeadingDistanceOptions = (mode, lookaheadSeconds) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const sampler = state.sampler
    const minimumMeters = replayCameraHeadingWindowMeters({
        totalDistanceMeters: sampler?.totalDistance,
        durationSeconds: state.controller?.duration,
        lookaheadSeconds,
        minimumMeters: CAMERA_NAVIGATION_HEADING_MIN_WINDOW_METERS,
    })
    const maximumMeters = Math.max(
        0,
        (finiteNumber(sampler?.totalDistance) ?? 0) * REPLAY_CAMERA_HEADING_MAX_PATH_RATIO,
    )
    const positionSmoothingMeters = replayCameraPositionSmoothingWindowMeters({
        totalDistanceMeters: sampler?.totalDistance,
        durationSeconds: state.controller?.duration,
    })
    return {minimumMeters, maximumMeters, positionSmoothingMeters}
}

export const guideTimeForProgress =  (mode, progress) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return JulianDate.addSeconds(
        JulianDate.fromIso8601('2026-01-01T00:00:00Z'),
        clamp(Number(progress) || 0, 0, 1) * 1000,
        new JulianDate(),
    )
}

export const cameraGuidePositionPropertyForGuide = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const key = call.cameraGuideKey()
        if (state.cameraGuidePositionProperty && state.cameraGuidePositionPropertyKey === key) {
            return state.cameraGuidePositionProperty
        }

        const guide = call.buildCameraGuide()
        if (!guide?.length) {
            state.cameraGuidePositionProperty = null
            state.cameraGuidePositionPropertyKey = key
            return null
        }

        const property = new SampledPositionProperty()
        guide.forEach(point => {
            const position = safeCartesianFromLonLat(point)
            if (!position) {
                return
            }

            property.addSample(
                call.guideTimeForProgress(point.progress),
                position,
            )
        })
        property.setInterpolationOptions({
            interpolationDegree: 1,
            interpolationAlgorithm: LinearApproximation,
        })
        property.forwardExtrapolationType = ExtrapolationType.HOLD
        property.backwardExtrapolationType = ExtrapolationType.HOLD

        state.cameraGuidePositionProperty = property
        state.cameraGuidePositionPropertyKey = key
        return property
    }

export const guideSampleFromPositionProperty =  (mode, progress) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const property = call.cameraGuidePositionPropertyForGuide()
        if (!property) {
            return null
        }

        const position = property.getValue(call.guideTimeForProgress(progress))
        if (!position) {
            return null
        }

        const cartographic = safeCartographicFromCartesian(position)
        const lonLat = cartographicToLonLat(cartographic)
        if (!lonLat) {
            return null
        }

        return {
            progress: clamp(Number(progress) || 0, 0, 1),
            ...lonLat,
            distanceFromStart: (state.sampler?.totalDistance ?? 0) * clamp(Number(progress) || 0, 0, 1),
        }
    }

/**
 * Resolve a route heading with the configured Replay camera anticipation.
 *
 * @param {object} mode - Replay session mode.
 * @param {number} progress - Normalized route progress.
 * @param {object} options - Heading anticipation settings.
 * @param {number|null} [options.easing=null] - Camera Ease setting.
 * @returns {number} Heading in radians.
 */
export const headingFromPositionProperty =  (mode, progress, {
    easing = null,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const safeProgress = clamp(Number(progress) || 0, 0, 1)
        if (typeof state.sampler?.headingAtProgress === 'function') {
            const lookaheadSeconds = replayCameraHeadingLookaheadSeconds(easing)
            const headingDistance = replayCameraHeadingDistanceOptions(mode, lookaheadSeconds)
            return state.sampler.headingAtProgress(safeProgress, {
                lookaheadSeconds,
                windowSeconds:   lookaheadSeconds,
                ...headingDistance,
            })
        }
        const guide = call.buildCameraGuide()
        if (!guide?.length) {
            return 0
        }

        const current = call.guideSampleFromPositionProperty(safeProgress)
        if (!hasFiniteLonLat(current)) {
            return 0
        }

        const baseDistance = finiteNumber(current.distanceFromStart) ?? 0
        const lookDistance = Math.max(400, (state.sampler?.totalDistance ?? 0) * CAMERA_HEADING_LOOKAHEAD_PROGRESS)
        const futureDistance = baseDistance + lookDistance
        const pastDistance = Math.max(0, baseDistance - lookDistance)
        const future = guide.find(point => (finiteNumber(point?.distanceFromStart) ?? 0) >= futureDistance) ?? guide[guide.length - 1]
        const windowPoints = guide.filter(point => {
            const distance = finiteNumber(point?.distanceFromStart) ?? 0
            return distance >= pastDistance && distance <= futureDistance
        })

        if (windowPoints.length < 2) {
            return hasFiniteLonLat(future) ? call.headingBetweenPoints(current, future) : 0
        }

        const localHeading = call.orientedHeadingFromWindowPoints(windowPoints, current, future)
        if (!Number.isFinite(localHeading)) {
            return hasFiniteLonLat(future) ? call.headingBetweenPoints(current, future) : 0
        }

        return localHeading
    }

/**
 * Resolve a Replay-only smoothed camera anchor and route heading. The route
 * sample itself remains untouched for trace, marker, and crop constraints.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - Replay sample and camera settings.
 * @returns {object|null} Camera path sample and heading.
 */
export const cameraMotionAtProgress = (mode, {
    sample,
    progress = sample?.progress ?? 0,
    cameraSettings,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const sampler = state.sampler
    if (!sampler?.cameraMotionAtProgress || !sample || !cameraSettings) {
        return null
    }

    const viewer = call.cesiumViewer?.() ?? globalThis.lgs?.viewer
    const frustum = viewer?.camera?.frustum
    const viewport = call.constrainedReplayProjectionViewport?.()
        ?? call.viewportRectForCesiumSurface?.()
    const aspectRatio = finiteNumber(frustum?.aspectRatio)
        ?? ((viewport?.canvasHeight ?? viewport?.height) > 0
            ? (viewport?.canvasWidth ?? viewport?.width) / (viewport?.canvasHeight ?? viewport?.height)
            : null)
    const fov = finiteNumber(frustum?.fovy) ?? finiteNumber(frustum?.fov)
    const verticalFovRadians = fov !== null && aspectRatio !== null && aspectRatio > 1 && !Number.isFinite(frustum?.fovy)
        ? 2 * Math.atan(Math.tan(fov / 2) / aspectRatio)
        : fov
    const viewportWidth = finiteNumber(viewport?.canvasWidth) ?? finiteNumber(viewport?.width)
    const cropWidth = finiteNumber(viewport?.width)
    const cropWidthRatio = viewportWidth > 0 && cropWidth > 0 ? cropWidth / viewportWidth : 1
    const targetHeight = finiteNumber(call.markerRenderHeightForSample?.(sample))
        ?? finiteNumber(sample.altitude ?? sample.height) ?? 0
    const configuredHeight = finiteNumber(cameraSettings.altitude)
    const pitchRadians = degreesToRadians(cameraSettings.pitch)
    const cropZoneWidthAtTargetHeight = referenceTargetHeight => replayCameraCropWidthMeters({
        cameraHeight: cameraSettings.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
            ? referenceTargetHeight + (configuredHeight ?? 0)
            : configuredHeight ?? referenceTargetHeight,
        targetHeight: referenceTargetHeight,
        pitchRadians,
        verticalFovRadians,
        aspectRatio,
        cropWidthRatio,
    })
    const cropZoneWidthMeters = cropZoneWidthAtTargetHeight(targetHeight)
    const lookaheadSeconds = replayCameraHeadingLookaheadSeconds(cameraSettings?.hysteresis?.easing)
    const headingDistance = replayCameraHeadingDistanceOptions(mode, lookaheadSeconds)
    return sampler.cameraMotionAtProgress(progress, {
        cropZoneWidthMeters,
        cropZoneWidthMetersForSection: section => cropZoneWidthAtTargetHeight(
            finiteNumber(section.maximumTargetAltitude) ?? targetHeight,
        ),
        lookaheadSeconds,
        windowSeconds: lookaheadSeconds,
        ...headingDistance,
    })
}

export const cameraAltitudeForSample = (mode, sample, cameraSettings) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const sampleHeight = finiteNumber(sample?.altitude ?? sample?.height) ?? 0
        const configuredAltitude = finiteNumber(cameraSettings?.altitude) ?? 0
        const longitude = sample?.longitude
        const latitude = sample?.latitude
        if (finiteNumber(longitude) === null || finiteNumber(latitude) === null) {
            return cameraSettings.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
                ? sampleHeight + configuredAltitude
                : cameraSettings.altitude
        }

        // Ground offset is relative to the replay marker, never to the live
        // camera's current terrain. The camera can be horizontally displaced
        // over a different relief, especially during a recenter transition.
        if (state.terrainHeightLookupBypass === true) {
            if (state.terrainHeightLookupTrace === true) {
                replayVideoTraceDebug('camera.altitude.lookup.bypass', {
                    longitude,
                    latitude,
                    sampleHeight,
                    altitudeMode: cameraSettings.altitudeMode ?? null,
                })
            }
            if (cameraSettings.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET) {
                return sampleHeight + configuredAltitude
            }
            return cameraSettings.altitude
        }
        const terrainHeight = call.terrainHeightForLonLat(longitude, latitude)
        const groundHeight = terrainHeight ?? sampleHeight

        if (cameraSettings.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET) {
            return groundHeight + configuredAltitude
        }

        return cameraSettings.altitude
    }

/**
 * Resolve a camera view while keeping its camera-only path anchor separate
 * from the true route sample used by the marker and visibility checks.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - Camera view inputs.
 * @param {object} options.sample - True route sample.
 * @param {object|null} [options.cameraAnchorSample=null] - Smoothed camera-only route sample.
 * @param {number|null} [options.axisHeading=null] - Anticipated route heading in radians.
 * @returns {object|null} Resolved camera view or null.
 */
export const cameraViewForSample = (mode, {
                                sample,
                                progress = sample?.progress ?? 0,
                                source = null,
                                cameraSettings,
                                markerSettings,
                                collision = false,
                                cameraAnchorSample = null,
                                axisHeading = null,
                                motionProfile = null,
                                previousHeading = mode[JOURNEY_REPLAY_INTERNAL_STATE].lastNominalCameraHeading ?? mode[JOURNEY_REPLAY_INTERNAL_STATE].lastCameraHeading,
                                previousPitch = mode[JOURNEY_REPLAY_INTERNAL_STATE].lastNominalCameraPitch ?? mode[JOURNEY_REPLAY_INTERNAL_STATE].lastCameraPitch,
                                cache = null,
                            } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!sample || !cameraSettings || !markerSettings) {
            return null
        }

        const computeView = () => {
            const immediateSource = source === 'drawer'
                                    || source === 'keyboard'
                                    || source === 'preparation'
                                    || source === 'refresh'
            const normalizedPitch = finiteNumber(cameraSettings?.pitch) ?? -65
            const pitch = immediateSource
                          ? degreesToRadians(normalizedPitch)
                          : normalizedPitch <= -90
                            ? SAFE_TOP_DOWN_PITCH
                            : degreesToRadians(normalizedPitch)
            const configuredAxisHeading = axisHeading === null || axisHeading === undefined
                ? null
                : finiteNumber(axisHeading)
            const desiredHeading = replayCameraHeadingForAngle({
                axisHeading: configuredAxisHeading ?? call.headingFromPositionProperty(progress, {
                    easing: cameraSettings?.hysteresis?.easing,
                }),
                cameraAngle: cameraSettings.cameraAngle,
            })
            const heading = immediateSource
                            ? desiredHeading
                            : replayCameraHeadingWithHysteresis({
                                                                        previousHeading,
                                                                        nextHeading: desiredHeading,
                                                                        threshold:   CAMERA_HEADING_MIN_CHANGE_RADIANS,
                                                                    })
            const smoothHeading = immediateSource
                                  ? heading
                                  : call.smoothRadians(
                    previousHeading,
                    heading,
                    call.timeNormalizedSmoothingFactor(
                        call.headingEasingFactor(cameraSettings, heading),
                        state.cameraSmoothingDeltaSeconds,
                    ),
                )
            const smoothPitch = immediateSource
                                ? pitch
                                : call.smoothRadians(
                                    previousPitch,
                                    pitch,
                                    call.timeNormalizedSmoothingFactor(0.08, state.cameraSmoothingDeltaSeconds),
                                )
            const anchorSample = call.markerPositionForSample(sample, markerSettings)
            const cameraAnchor = cameraAnchorSample
                ? call.markerPositionForSample(cameraAnchorSample, markerSettings)
                : null
            return {
                sample:       anchorSample,
                ...(cameraAnchor ? {cameraAnchorSample: cameraAnchor} : {}),
                progress:     clamp(Number(progress) || 0, 0, 1),
                heading:      smoothHeading,
                pitch:        smoothPitch,
                roll:        cameraSettings.canRoll === false
                            ? 0
                            : resolveJourneyReplayLogicalCameraRoll({
                                sample,
                                sampler: state.sampler,
                                sensitivity: cameraSettings.rollSensitivity,
                            }),
                cameraSettings,
                markerSettings,
                cameraHeight: call.cameraAltitudeForSample(anchorSample, cameraSettings),
            }
        }

        if (cache) {
            const cacheKey = [
                replayCameraUpdateSampleKey({
                    ...sample,
                    progress,
                }),
                replayCameraUpdateCameraSettingsKey(cameraSettings),
                replayCameraUpdateMarkerSettingsKey(markerSettings),
                replayCameraUpdateSampleKey(cameraAnchorSample ?? {}),
                finiteNumber(axisHeading) ?? 'null',
                source ?? 'null',
                collision === true ? '1' : '0',
                JSON.stringify(motionProfile ?? null),
                finiteNumber(previousHeading) ?? 'null',
                finiteNumber(previousPitch) ?? 'null',
            ].join('|')
            return memoizeReplayCameraUpdateCache(cache, 'cameraViewForSample', cacheKey, computeView)
        }

        return computeView()
    }
