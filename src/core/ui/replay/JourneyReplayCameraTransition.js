/**
 * Replay camera Transition behavior.
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
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, rollCameraUp, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForPositionMode, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
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
    CAMERA_HEADING_MIN_RESPONSE_FACTOR,
    CAMERA_HEADING_MAX_RESPONSE_FACTOR,
    CAMERA_VIEW_POSITION_EPSILON_METERS,
    CAMERA_VIEW_ANGLE_EPSILON_RADIANS,
    CAMERA_TIMING_START_ANGLE_RADIANS,
    CAMERA_TIMING_SETTLE_ANGLE_RADIANS,
    CAMERA_DETERMINISTIC_FOLLOW_RESPONSE_SECONDS,
    REPLAY_NAVIGATION_MAX_HEADING_DRIFT_DEGREES,
    REPLAY_NAVIGATION_MAX_LATERAL_DRIFT_METERS,
    REPLAY_NAVIGATION_MIN_TURN_DRIFT_DEGREES,
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
    replayTurnDriftForProgress,
} from './JourneyReplayCameraGuide'
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
    buildCameraTransferPath,
    selectCameraTransferMode,
    cameraTransferFrameAt,
} from './JourneyReplayCameraPath'
import {
    buildReplayTransferSafetyProfile,
} from './JourneyReplayCameraCollision'
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
export const currentCameraFrame =  (mode, fallbackFrame) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = globalThis.lgs?.viewer?.camera
        const destination = [camera?.positionWC, camera?.position, fallbackFrame?.destination]
            .find(isUsableCartesian3)
        const direction = [camera?.directionWC, camera?.direction, fallbackFrame?.direction]
            .find(isUsableCartesian3)
        const up = [camera?.upWC, camera?.up, fallbackFrame?.correctedUp, fallbackFrame?.up]
            .find(isUsableCartesian3)
        if (!destination || !direction || !up) {
            return null
        }

        return {
            destination: Cartesian3.clone(destination, new Cartesian3()),
            direction:   Cartesian3.clone(direction, new Cartesian3()),
            up:          Cartesian3.clone(up, new Cartesian3()),
        }
    }

export const applyCameraFrame =  (mode, frame) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = globalThis.lgs?.viewer?.camera
        if (!camera
            || !isUsableCartesian3(frame?.destination)
            || !isUsableCartesian3(frame?.direction)
            || !isUsableCartesian3(frame?.up)) {
            return false
        }

        const logicalNow = finiteNumber(call.now?.()) ?? 0
        state.cameraAutoTrackingIgnoreUntil = Math.max(
            finiteNumber(state.cameraAutoTrackingIgnoreUntil) ?? 0,
            logicalNow + 250,
        )
        state.cameraApplyingView = true
        try {
            camera.setView?.({
                destination: frame.destination,
                orientation: {
                    direction: frame.direction,
                    up:        frame.up,
                },
            })
            return true
        }
        finally {
            state.cameraApplyingView = false
        }
    }

export const interpolateCameraFrame = (mode, 
        start,
        end,
        ratio = 1,
        {startVelocity = null, endVelocity = null, durationMs = 0, path = null, target = null} = {},
    ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!start
            || !end
            || !isUsableCartesian3(start.destination)
            || !isUsableCartesian3(start.direction)
            || !isUsableCartesian3(start.up)
            || !isUsableCartesian3(end.destination)
            || !isUsableCartesian3(end.direction)
            || !isUsableCartesian3(end.up)) {
            return null
        }
        const rawRatio = clamp(ratio, 0, 1)
        const easedRatio = smoothClipProgress(rawRatio)
        const hasVelocity = startVelocity || endVelocity
        if (!hasVelocity) {
            const sampledFrame = path ? cameraTransferFrameAt(path, target, easedRatio) : null
            return {
                destination: sampledFrame?.destination ?? path?.sampleAt?.(easedRatio) ?? safeCartesian3Lerp(start.destination, end.destination, easedRatio),
                direction:   sampledFrame?.direction ?? safeCartesian3Normalize(
                    safeCartesian3Lerp(start.direction, end.direction, easedRatio),
                    start.direction,
                ),
                up:          sampledFrame?.up ?? safeCartesian3Normalize(
                    safeCartesian3Lerp(start.up, end.up, easedRatio),
                    start.up,
                ),
            }
        }

        const t2 = rawRatio * rawRatio
        const t3 = t2 * rawRatio
        const h00 = (2 * t3) - (3 * t2) + 1
        const h10 = t3 - (2 * t2) + rawRatio
        const h01 = (-2 * t3) + (3 * t2)
        const h11 = t3 - t2
        const span = Math.max(1, finiteNumber(durationMs) ?? 0)
        const interpolate = (startValue, endValue, startSpeed, endSpeed) => {
            const result = new Cartesian3()
            Cartesian3.multiplyByScalar(startValue, h00, result)
            Cartesian3.add(
                result,
                Cartesian3.multiplyByScalar(startSpeed ?? Cartesian3.ZERO, h10 * span, new Cartesian3()),
                result,
            )
            Cartesian3.add(
                result,
                Cartesian3.multiplyByScalar(endValue, h01, new Cartesian3()),
                result,
            )
            Cartesian3.add(
                result,
                Cartesian3.multiplyByScalar(endSpeed ?? Cartesian3.ZERO, h11 * span, new Cartesian3()),
                result,
            )
            return result
        }

        const sampledFrame = path ? cameraTransferFrameAt(path, target, easedRatio) : null
        return {
            destination: sampledFrame?.destination ?? path?.sampleAt?.(easedRatio) ?? interpolate(
                start.destination,
                end.destination,
                startVelocity?.destination,
                endVelocity?.destination,
            ),
            direction: sampledFrame?.direction ?? safeCartesian3Normalize(interpolate(
                start.direction,
                end.direction,
                startVelocity?.direction,
                endVelocity?.direction,
            ), start.direction),
            up: sampledFrame?.up ?? safeCartesian3Normalize(interpolate(
                start.up,
                end.up,
                startVelocity?.up,
                endVelocity?.up,
            ), start.up),
        }
    }

export const cameraTransitionVelocity = (mode, transition, logicalNow) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!transition) {
            return null
        }

        const span = Math.max(1, transition.endAt - transition.startAt)
        const ratio = clamp(((finiteNumber(logicalNow) ?? transition.endAt) - transition.startAt) / span, 0, 1)
        const t2 = ratio * ratio

        let coefficients
        if (transition.startVelocity || transition.endVelocity) {
            coefficients = {
                start:   (6 * t2) - (6 * ratio),
                startV:  (3 * t2) - (4 * ratio) + 1,
                end:     (-6 * t2) + (6 * ratio),
                endV:    (3 * t2) - (2 * ratio),
            }
        }
        else {
            const factor = (6 * ratio * (1 - ratio)) / span
            return {
                destination: Cartesian3.multiplyByScalar(
                    Cartesian3.subtract(transition.end.destination, transition.start.destination, new Cartesian3()),
                    factor,
                    new Cartesian3(),
                ),
                direction: Cartesian3.multiplyByScalar(
                    Cartesian3.subtract(transition.end.direction, transition.start.direction, new Cartesian3()),
                    factor,
                    new Cartesian3(),
                ),
                up: Cartesian3.multiplyByScalar(
                    Cartesian3.subtract(transition.end.up, transition.start.up, new Cartesian3()),
                    factor,
                    new Cartesian3(),
                ),
            }
        }

        const velocity = (startValue, endValue, startSpeed, endSpeed) => {
            const result = new Cartesian3()
            Cartesian3.multiplyByScalar(startValue, coefficients.start, result)
            Cartesian3.add(result, Cartesian3.multiplyByScalar(
                startSpeed ?? Cartesian3.ZERO,
                coefficients.startV * span,
                new Cartesian3(),
            ), result)
            Cartesian3.add(result, Cartesian3.multiplyByScalar(endValue, coefficients.end, new Cartesian3()), result)
            Cartesian3.add(result, Cartesian3.multiplyByScalar(
                endSpeed ?? Cartesian3.ZERO,
                coefficients.endV * span,
                new Cartesian3(),
            ), result)
            Cartesian3.divideByScalar(result, span, result)
            return result
        }

        return {
            destination: velocity(
                transition.start.destination,
                transition.end.destination,
                transition.startVelocity?.destination,
                transition.endVelocity?.destination,
            ),
            direction: velocity(
                transition.start.direction,
                transition.end.direction,
                transition.startVelocity?.direction,
                transition.endVelocity?.direction,
            ),
            up: velocity(
                transition.start.up,
                transition.end.up,
                transition.startVelocity?.up,
                transition.endVelocity?.up,
            ),
        }
    }

export const startDeterministicCameraTransition = (mode, {
                                               sample,
                                               heading,
                                               pitch,
                                               endFrame,
                                               duration = 0,
                                               logicalNow = 0,
                                               trackingMode = REPLAY_MARKER_MODE_NAVIGATION,
                                               cameraSettings = null,
                                               viewport = null,
                                           } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const startFrame = call.currentCameraFrame(endFrame)
        if (!startFrame || !endFrame) {
            return false
        }

        const durationMs = Math.max(0, Math.round((finiteNumber(duration) ?? 0) * 1000))
        const transitionStartAt = finiteNumber(logicalNow) ?? 0
        const previousVelocity = call.cameraTransitionVelocity(
            state.deterministicCameraTransition,
            transitionStartAt,
        )
        const end = {
            destination: Cartesian3.clone(endFrame.destination, new Cartesian3()),
            direction:   Cartesian3.clone(endFrame.direction, new Cartesian3()),
            up:          Cartesian3.clone(endFrame.correctedUp, new Cartesian3()),
        }
        const target = call.markerRenderCartesianForSample?.(sample) ?? null
        const replayMotionProfile = {
            turnDrift: {
                enabled:               cameraSettings?.canDrift !== false,
                maxHeadingOffsetDeg:    trackingMode === REPLAY_MARKER_MODE_NAVIGATION
                    ? REPLAY_NAVIGATION_MAX_HEADING_DRIFT_DEGREES
                    : 10,
                maxLateralOffsetMeters: trackingMode === REPLAY_MARKER_MODE_NAVIGATION
                    ? REPLAY_NAVIGATION_MAX_LATERAL_DRIFT_METERS
                    : 60,
                minTurnAngleDeg:        trackingMode === REPLAY_MARKER_MODE_NAVIGATION
                    ? REPLAY_NAVIGATION_MIN_TURN_DRIFT_DEGREES
                    : 8,
                sensitivity:             cameraSettings?.driftSensitivity,
            },
        }
        const applyLocalFrameOffset = (frame, offsetTarget, focusTarget, {
            eastMeters = 0,
            northMeters = 0,
            upMeters = 0,
        } = {}) => {
            if (!frame || !offsetTarget) {
                return frame
            }

            const targetTransform = Transforms.eastNorthUpToFixedFrame(offsetTarget)
            const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
            const north = Matrix4.getColumn(targetTransform, 1, new Cartesian3())
            const up = Matrix4.getColumn(targetTransform, 2, new Cartesian3())
            const offset = Cartesian3.add(
                Cartesian3.add(
                    Cartesian3.multiplyByScalar(east, eastMeters, new Cartesian3()),
                    Cartesian3.multiplyByScalar(north, northMeters, new Cartesian3()),
                    new Cartesian3(),
                ),
                Cartesian3.multiplyByScalar(up, upMeters, new Cartesian3()),
                new Cartesian3(),
            )
            const destination = Cartesian3.add(frame.destination, offset, new Cartesian3())
            const lookAtTarget = focusTarget ?? offsetTarget
            if (!lookAtTarget) {
                return {
                    ...frame,
                    destination,
                }
            }
            const direction = Cartesian3.normalize(
                Cartesian3.subtract(lookAtTarget, destination, new Cartesian3()),
                new Cartesian3(),
            )
            const rightCandidate = Cartesian3.cross(direction, up, new Cartesian3())
            const right = Cartesian3.magnitudeSquared(rightCandidate) > CARTESIAN_EPSILON
                          ? Cartesian3.normalize(rightCandidate, rightCandidate)
                          : Cartesian3.clone(east, new Cartesian3())
            const correctedUp = Cartesian3.normalize(
                Cartesian3.cross(right, direction, new Cartesian3()),
                new Cartesian3(),
            )
            return {
                ...frame,
                destination,
                direction,
                up: correctedUp,
            }
        }
        const transferThresholdKm = finiteNumber(globalThis.lgs?.settings?.camera?.transferDistanceThresholdKm) ?? 50
        const transferDistance = Cartesian3.distance(startFrame.destination, end.destination)
        const transferSafetyProfile = buildReplayTransferSafetyProfile(globalThis.lgs?.theJourney, {
            trackingMode,
            cameraSettings,
            viewport: viewport ?? call.viewportRectForCesiumSurface?.() ?? null,
            clearanceMeters: Math.max(100, finiteNumber(globalThis.lgs?.settings?.camera?.pitchAdjustHeight) ?? 500),
        })
        const transferScale = Math.max(0.75, finiteNumber(transferSafetyProfile?.zoneScale) ?? 1)
        const transferMode = selectCameraTransferMode(transferDistance, transferThresholdKm / transferScale)
        const transferPath = buildCameraTransferPath({
            start:       startFrame.destination,
            end:         end.destination,
            mode:        transferMode,
            sampleCount: transferMode === 'direct'
                         ? 24
                         : Math.round((transferMode === 'elevate-then-move' ? 64 : 80) * transferScale),
            liftMeters:  Math.max(120, finiteNumber(globalThis.lgs?.settings?.camera?.pitchAdjustHeight) ?? 500),
            antiCollisionBounds: transferSafetyProfile,
            safetyProfile:       transferSafetyProfile,
            frameResolver: ({path, target: resolvedTarget, ratio, frame}) => {
                const replayCameraSettings = cameraSettings ?? globalThis.lgs?.settings?.ui?.replay?.camera ?? {}
                const replayMarkerSettings = normalizeJourneyReplayMarker(globalThis.lgs?.settings?.ui?.replay?.marker ?? {})
                if (replayCameraSettings.canFixHiddenMarker === false) {
                    return frame
                }

                const lineOfSightVisible = call.cameraLineOfSightVisibleForFrame({
                    destination: frame?.destination,
                    sample,
                    targetHeight: call.markerRenderHeightForSample(sample),
                })
                const renderedVisible = call.renderedTraceVisibleForSample(sample)
                if (lineOfSightVisible && renderedVisible !== false) {
                    return frame
                }

                const view = call.cameraViewForSample({
                    sample,
                    progress:       sample?.progress ?? ratio ?? 0,
                    source:         'playback',
                    cameraSettings:  replayCameraSettings,
                    markerSettings:  replayMarkerSettings,
                    motionProfile:   replayMotionProfile,
                    collision:      true,
                    previousHeading: endFrame?.safeHeading ?? heading,
                    previousPitch:   endFrame?.safePitch ?? pitch,
                })
                if (!view) {
                    return frame
                }

                const correctedFrame = call.cameraRecenterFrame({
                    sample,
                    heading:        view.heading,
                    pitch:          view.pitch ?? pitch,
                    roll:           view.roll,
                    cameraSettings:  replayCameraSettings,
                    cameraHeight:   view.cameraHeight,
                })

                const drift = replayMotionProfile.turnDrift.enabled
                    ? replayTurnDriftForProgress(mode, sample?.progress ?? ratio, replayMotionProfile.turnDrift)
                    : null
                const reliefHeight = Math.max(
                    80,
                    finiteNumber(globalThis.lgs?.settings?.camera?.pitchAdjustHeight) ?? 500,
                )
                return applyLocalFrameOffset(
                    correctedFrame ?? frame,
                    resolvedTarget ?? target,
                    target,
                    {
                        eastMeters: drift?.lateralOffsetMeters ? drift.lateralOffsetMeters * 0.2 : 0,
                        northMeters: 0,
                        upMeters:    reliefHeight * 0.35,
                    },
                )
            },
        })
        state.deterministicCameraTransition = {
            startAt: transitionStartAt,
            endAt:   transitionStartAt + durationMs,
            start:   startFrame,
            end,
            target,
            startVelocity: previousVelocity,
            endVelocity:   null,
            sample,
            heading,
            pitch,
            path: transferPath,
        }

        return call.applyDeterministicCameraTransition(logicalNow)
    }

export const applyDeterministicCameraTransition =  (mode, logicalNow) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const transition = state.deterministicCameraTransition
        if (!transition) {
            return false
        }

        const now = finiteNumber(logicalNow) ?? transition.endAt
        const span = Math.max(1, transition.endAt - transition.startAt)
        const ratio = clamp((now - transition.startAt) / span, 0, 1)
        const applied = call.applyCameraFrame(call.interpolateCameraFrame(
            transition.start,
            transition.end,
            ratio,
            {
                startVelocity: transition.startVelocity,
                endVelocity:   transition.endVelocity,
                durationMs:    span,
                path:          transition.path,
                target:        transition.target,
            },
        ))
        if (ratio >= 1 && applied) {
            state.deterministicCameraTransition = null
            state.lastCameraHeading = finiteNumber(transition.heading) ?? state.lastCameraHeading
            state.lastCameraPitch = finiteNumber(transition.pitch) ?? state.lastCameraPitch
            call.rememberCameraView?.({
                anchor: transition.sample,
                heading: transition.heading,
                pitch: transition.pitch,
            })
        }
        return applied
    }

export const applyDeterministicCameraFollower = (mode, {
                                             endFrame = null,
                                             logicalNow = 0,
                                             responseSeconds = CAMERA_DETERMINISTIC_FOLLOW_RESPONSE_SECONDS,
                                         } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const startFrame = call.currentCameraFrame(endFrame)
        const targetFrame = {
            destination: endFrame?.destination,
            direction:   endFrame?.direction,
            up:          endFrame?.correctedUp ?? endFrame?.up,
        }
        if (!startFrame
            || !isUsableCartesian3(targetFrame.destination)
            || !isUsableCartesian3(targetFrame.direction)
            || !isUsableCartesian3(targetFrame.up)) {
            return false
        }

        const now = finiteNumber(logicalNow) ?? 0
        const previousNow = finiteNumber(state.deterministicCameraFollowerAt)
        const deltaSeconds = previousNow === null
                             ? (1 / 30)
                             : clamp((now - previousNow) / 1000, 0, 0.25)
        const response = Math.max(
            0.1,
            finiteNumber(responseSeconds) ?? CAMERA_DETERMINISTIC_FOLLOW_RESPONSE_SECONDS,
        )
        const stiffness = 4 / (response * response)
        const damping = 4 / response
        const previousVelocity = state.deterministicCameraFollowerVelocity ?? {
            destination: new Cartesian3(),
            direction:   new Cartesian3(),
            up:          new Cartesian3(),
        }
        const integrate = (current, target, velocity) => {
            const acceleration = Cartesian3.subtract(target, current, new Cartesian3())
            Cartesian3.multiplyByScalar(acceleration, stiffness, acceleration)
            const dampedVelocity = Cartesian3.multiplyByScalar(velocity, damping, new Cartesian3())
            Cartesian3.subtract(acceleration, dampedVelocity, acceleration)
            const nextVelocity = Cartesian3.add(
                velocity,
                Cartesian3.multiplyByScalar(acceleration, deltaSeconds, new Cartesian3()),
                new Cartesian3(),
            )
            const nextValue = Cartesian3.add(
                current,
                Cartesian3.multiplyByScalar(nextVelocity, deltaSeconds, new Cartesian3()),
                new Cartesian3(),
            )
            return {nextValue, nextVelocity}
        }
        const destination = integrate(
            startFrame.destination,
            targetFrame.destination,
            previousVelocity.destination,
        )
        const direction = integrate(
            startFrame.direction,
            targetFrame.direction,
            previousVelocity.direction,
        )
        const up = integrate(
            startFrame.up,
            targetFrame.up,
            previousVelocity.up,
        )
        const frame = {
            destination: destination.nextValue,
            direction:   safeCartesian3Normalize(direction.nextValue, startFrame.direction),
            up:          safeCartesian3Normalize(up.nextValue, startFrame.up),
        }
        state.deterministicCameraFollowerVelocity = {
            destination: destination.nextVelocity,
            direction:   direction.nextVelocity,
            up:          up.nextVelocity,
        }
        state.deterministicCameraFollowerAt = now
        return call.applyCameraFrame(frame)
    }

export const cameraRecenterFrame = (mode, {
                                sample,
                                heading,
                                pitch,
                                roll = 0,
                                cameraSettings,
                                cameraHeight = null,
                            } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = globalThis.lgs?.viewer
        const targetHeight = finiteNumber(call.markerRenderHeightForSample(sample))
                            ?? finiteNumber(sample?.altitude ?? sample?.height)
                            ?? 0
        const target = call.markerRenderCartesianForSample(sample)
        const cameraPosition = viewer?.camera?.positionWC ?? viewer?.camera?.position
        const fallbackRange = cameraPosition && target
                              ? Cartesian3.distance(cameraPosition, target)
                              : replayCameraRangeFromPitch(call.cameraAltitudeForSample(sample, cameraSettings), pitch)
        if (!viewer || !target) {
            return null
        }

        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)
        const groundOffsetCameraHeight = cameraSettings?.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
                                         ? finiteNumber(call.cameraAltitudeForSample(sample, cameraSettings))
                                         : null
        const explicitCameraHeight = cameraHeight === null || cameraHeight === undefined || cameraHeight === ''
            ? null
            : finiteNumber(cameraHeight)
        // In ground-offset mode the marker-relative value is authoritative;
        // an explicit height may belong to a previous camera transition.
        const requestedCameraHeight = groundOffsetCameraHeight ?? explicitCameraHeight
        const currentHeight = requestedCameraHeight !== null
                              ? Math.max(targetHeight, requestedCameraHeight)
                              : replayCameraRecenterHeight(
                    viewer.camera?.positionCartographic?.height,
                    call.cameraAltitudeForSample(sample, cameraSettings),
                )
        const horizontalDistance = replayCameraRecenterHorizontalDistance({
                                                                                  cameraHeight: currentHeight,
                                                                                  targetHeight,
                                                                                  pitchRadians: safePitch,
                                                                                  fallbackRange,
                                                                              })
        const heightDelta = currentHeight - targetHeight
        const targetTransform = Transforms.eastNorthUpToFixedFrame(target)
        const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
        const north = Matrix4.getColumn(targetTransform, 1, new Cartesian3())
        const up = Matrix4.getColumn(targetTransform, 2, new Cartesian3())
        const headingAxis = Cartesian3.add(
            Cartesian3.multiplyByScalar(east, Math.sin(safeHeading), new Cartesian3()),
            Cartesian3.multiplyByScalar(north, Math.cos(safeHeading), new Cartesian3()),
            new Cartesian3(),
        )
        const destination = Cartesian3.add(
            Cartesian3.add(
                target,
                Cartesian3.multiplyByScalar(headingAxis, -horizontalDistance, new Cartesian3()),
                new Cartesian3(),
            ),
            Cartesian3.multiplyByScalar(up, heightDelta, new Cartesian3()),
            new Cartesian3(),
        )
        const direction = Cartesian3.normalize(
            Cartesian3.subtract(target, destination, new Cartesian3()),
            new Cartesian3(),
        )
        const rightCandidate = Cartesian3.cross(direction, up, new Cartesian3())
        const right = Cartesian3.magnitudeSquared(rightCandidate) > CARTESIAN_EPSILON
                      ? Cartesian3.normalize(rightCandidate, rightCandidate)
                      : Cartesian3.clone(east, new Cartesian3())
        const correctedUp = Cartesian3.normalize(
            Cartesian3.cross(right, direction, new Cartesian3()),
            new Cartesian3(),
        )
        const safeRoll = clamp(sanitizeOrientationRadians(roll, 0), -Math.PI / 4, Math.PI / 4)
        const rolledUp = rollCameraUp({direction, up: correctedUp, roll: safeRoll}) ?? correctedUp
        return {
            sample,
            target,
            targetHeight,
            destination,
            direction,
            correctedUp: rolledUp,
            roll: safeRoll,
            currentHeight,
            safeHeading,
            safePitch,
        }
    }

export const cameraViewDelta = (mode, {anchor, heading, pitch, roll = 0} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const last = state.lastAppliedCameraView
        if (!last) {
            return null
        }

        const currentLongitude = finiteNumber(anchor?.longitude)
        const currentLatitude = finiteNumber(anchor?.latitude)
        const currentAltitude = finiteNumber(anchor?.altitude ?? anchor?.height) ?? 0
        const lastLongitude = finiteNumber(last.anchor?.longitude)
        const lastLatitude = finiteNumber(last.anchor?.latitude)
        const lastAltitude = finiteNumber(last.anchor?.altitude ?? last.anchor?.height) ?? 0
        if ([currentLongitude, currentLatitude, lastLongitude, lastLatitude].some(value => value === null)) {
            return null
        }

        const anchorDelta = projectToLocalMeters(
            {longitude: lastLongitude, latitude: lastLatitude},
            {longitude: currentLongitude, latitude: currentLatitude},
        )

        return {
            horizontalMeters: Math.hypot(anchorDelta?.x ?? Number.POSITIVE_INFINITY, anchorDelta?.y ?? Number.POSITIVE_INFINITY),
            altitudeMeters:   Math.abs(currentAltitude - lastAltitude),
            headingRadians:   Math.abs(replayAngularDelta(last.heading, heading) ?? Number.POSITIVE_INFINITY),
            pitchRadians:     Math.abs(replayAngularDelta(last.pitch, pitch) ?? Number.POSITIVE_INFINITY),
            rollRadians:      Math.abs((finiteNumber(last.roll) ?? 0) - (finiteNumber(roll) ?? 0)),
        }
    }

export const cameraViewIsStable = (mode, {anchor, heading, pitch, roll = 0} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const delta = call.cameraViewDelta({anchor, heading, pitch, roll})
        if (!delta) {
            return false
        }

        return delta.horizontalMeters <= CAMERA_VIEW_POSITION_EPSILON_METERS
            && delta.altitudeMeters <= CAMERA_VIEW_POSITION_EPSILON_METERS
            && delta.headingRadians <= CAMERA_VIEW_ANGLE_EPSILON_RADIANS
            && delta.pitchRadians <= CAMERA_VIEW_ANGLE_EPSILON_RADIANS
            && delta.rollRadians <= CAMERA_VIEW_ANGLE_EPSILON_RADIANS
    }

export const rememberCameraView = (mode, {anchor, heading, pitch, roll = 0} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        state.lastAppliedCameraView = {
            anchor: {
                longitude: finiteNumber(anchor?.longitude) ?? 0,
                latitude:  finiteNumber(anchor?.latitude) ?? 0,
                altitude:  finiteNumber(anchor?.altitude ?? anchor?.height) ?? 0,
            },
            heading: finiteNumber(heading) ?? 0,
            pitch:   finiteNumber(pitch) ?? SAFE_TOP_DOWN_PITCH,
            roll:    finiteNumber(roll) ?? 0,
        }
    }

export const headingEasingFactor = (mode, cameraSettings, targetHeading) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return replayHeadingEasingFactor({
        previousHeading: state.lastCameraHeading,
        nextHeading:     targetHeading,
        easing:          cameraSettings?.hysteresis?.easing,
        minFactor:       CAMERA_HEADING_MIN_RESPONSE_FACTOR,
        maxFactor:       CAMERA_HEADING_MAX_RESPONSE_FACTOR,
    })
}
