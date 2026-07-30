/**
 * Replay camera Guide behavior.
 */


import {ArcType, Cartesian2, Cartesian3, Cartographic, CatmullRomSpline, Color, ExtrapolationType, JulianDate, EasingFunction, HeightReference, HorizontalOrigin, LinearApproximation, Matrix4, PolylineDashMaterialProperty, SampledPositionProperty, SceneTransforms, Transforms, VerticalOrigin, Math as CesiumMath} from 'cesium'
import {REPLAY_DRAWER} from '@Core/constants'
import {Journey} from '@Core/Journey'
import {CameraUtils} from '@Utils/cesium/CameraUtils'
import {POIUtils} from '@Utils/cesium/POIUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {faCamera} from '@fortawesome/pro-solid-svg-icons'
import {faPersonHiking} from '@fortawesome/pro-regular-svg-icons'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'
import {finiteNumber, replayStore} from './JourneyReplayRuntime'
import {
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForPositionMode, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
} from './JourneyReplayCameraMath'
import {
    resolveJourneyReplayLogicalCameraRoll,
} from './JourneyReplayLogicalCameraPose'
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
    CAMERA_ANGLE_PREVIEW_AXIS_LENGTH,
    CAMERA_ANGLE_PREVIEW_OFFSET_LENGTH,
    CAMERA_ANGLE_PREVIEW_ICON_SIZE,
    REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
    REPLAY_EVENT_STOP_CLIPS_COMPLETE,
    CAMERA_REDIRECT_CANDIDATES,
    isUsableCartesian3,
    safeCartesian3Normalize,
    safeCartesian3Lerp,
    makeFontAwesomeIconDataUri,
    resolveJourneyActivityIcon,
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
    cameraAnglePreviewEntityCollection,
    removeCameraAnglePreviewOverlay,
    cameraAnglePreviewPOIIds,
    cameraAnglePreviewPOIForId,
    hideCameraAnglePreviewPOIs,
    restoreCameraAnglePreviewPOIs,
    cameraAnglePreviewStartHeading,
    showCameraAnglePreviewOverlay,
    hideCameraAnglePreviewOverlay,
    videoCropRect,
    viewportRectForCesiumSurface,
    updateToleranceZoneOverlay,
} from './JourneyReplayCameraOverlay'
import {
    recenterCameraToSample,
    startCameraTransition,
    bindMarkerInteractions,
    bindCesiumCameraBridge,
    startCameraLiveSyncLoop,
    stopCameraLiveSyncLoop,
    updateCamera,
} from './JourneyReplayCameraBinding'
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
    const turnStrength = smoothstep(
        (Math.abs(turnAngleRadians) - CesiumMath.toRadians(4))
        / Math.max(CesiumMath.toRadians(50), Number.EPSILON),
    )
    const cornerSharpness = smoothstep(
        (Math.abs(turnAngleRadians) - CesiumMath.toRadians(18))
        / Math.max(CesiumMath.toRadians(42), Number.EPSILON),
    )
    const turnSign = Math.sign(turnAngleRadians) || 1
    return {
        turnAngleRadians,
        headingOffsetRadians: turnSign
                              * CesiumMath.toRadians(maxHeadingOffsetDeg)
                              * turnStrength
                              * lerp(0.85, 1.08, cornerSharpness),
        lateralOffsetMeters: turnSign
                             * Math.max(0, finiteNumber(maxLateralOffsetMeters) ?? 0)
                             * turnStrength
                             * lerp(1, 0.3, cornerSharpness),
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
 * @returns {{turnAngleRadians: number, headingOffsetRadians: number, lateralOffsetMeters: number}|null} Drift envelope.
 */
export const replayTurnDriftForGuideProgress = (guide, progress, {
    maxHeadingOffsetDeg = 10,
    maxLateralOffsetMeters = 60,
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
 * @returns {{turnAngleRadians: number, headingOffsetRadians: number, lateralOffsetMeters: number}|null} Drift envelope.
 */
export const replayTurnDriftForProgress = (mode, progress, {
    maxHeadingOffsetDeg = 10,
    maxLateralOffsetMeters = 60,
} = {}) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return replayTurnDriftForGuideProgress(call.buildCameraGuide(), progress, {
        maxHeadingOffsetDeg,
        maxLateralOffsetMeters,
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

export const headingFromPositionProperty =  (mode, progress) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const safeProgress = clamp(Number(progress) || 0, 0, 1)
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

export const cameraAltitudeForSample = (mode, sample, cameraSettings) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const longitude = sample?.longitude
        const latitude = sample?.latitude
        if (finiteNumber(longitude) === null || finiteNumber(latitude) === null) {
            return cameraSettings.altitude
        }
        const sampleHeight = finiteNumber(sample?.altitude ?? sample?.height) ?? finiteNumber(globalThis.lgs?.viewer?.camera?.positionCartographic?.height) ?? 0
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
                return sampleHeight + cameraSettings.altitude
            }
            return cameraSettings.altitude
        }
        const terrainHeight = call.terrainHeightForLonLat(longitude, latitude)
        const groundHeight = terrainHeight ?? sampleHeight

        if (cameraSettings.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET) {
            return groundHeight + cameraSettings.altitude
        }

        return cameraSettings.altitude
    }

export const cameraViewForSample = (mode, {
                                sample,
                                progress = sample?.progress ?? 0,
                                source = null,
                                cameraSettings,
                                markerSettings,
                                collision = false,
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
            const normalizedPitch = finiteNumber(cameraSettings?.pitch) ?? -65
            const pitch = source === 'drawer'
                          ? degreesToRadians(normalizedPitch)
                          : normalizedPitch <= -89
                            ? SAFE_TOP_DOWN_PITCH
                            : degreesToRadians(normalizedPitch)
            let desiredHeading
            if (collision && cameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
                desiredHeading = call.headingFromPositionProperty(progress)
            }
            else if (cameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
                if (Number.isFinite(cameraSettings?.heading)) {
                    desiredHeading = degreesToRadians(cameraSettings.heading)
                }
                else {
                    desiredHeading = finiteNumber(previousHeading)
                        ?? finiteNumber(globalThis.lgs?.viewer?.camera?.heading)
                        ?? 0
                }
            }
            else {
                desiredHeading = replayCameraHeadingForPositionMode({
                                                                        axisHeading:  call.headingFromPositionProperty(progress),
                                                                        positionMode: cameraSettings.positionMode,
                                                                        headingOffset: cameraSettings.headingOffset,
                                                                    })
            }
            const heading = source === 'drawer'
                            ? desiredHeading
                            : replayCameraHeadingWithHysteresis({
                                                                        previousHeading,
                                                                        nextHeading: desiredHeading,
                                                                        threshold:   cameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM
                                                                                     ? CAMERA_HEADING_HYSTERESIS_RADIANS
                                                                                     : CAMERA_HEADING_MIN_CHANGE_RADIANS,
                                                                    })
            const smoothHeading = source === 'drawer'
                                  ? heading
                                  : call.smoothRadians(
                    previousHeading,
                    heading,
                    call.timeNormalizedSmoothingFactor(
                        call.headingEasingFactor(cameraSettings, heading),
                        state.cameraSmoothingDeltaSeconds,
                    ),
                )
            const smoothPitch = source === 'drawer'
                                ? pitch
                                : call.smoothRadians(
                                    previousPitch,
                                    pitch,
                                    call.timeNormalizedSmoothingFactor(0.08, state.cameraSmoothingDeltaSeconds),
                                )
            const anchorSample = call.markerPositionForSample(sample, markerSettings)
            return {
                sample:       anchorSample,
                progress:     clamp(Number(progress) || 0, 0, 1),
                heading:      smoothHeading,
                pitch:        smoothPitch,
                roll:        resolveJourneyReplayLogicalCameraRoll({sample: anchorSample}),
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
