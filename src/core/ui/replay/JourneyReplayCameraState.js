/**
 * Replay camera State behavior.
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

export const applyCameraView = (mode, {anchor, heading, pitch, cameraSettings}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const anchorHeight = finiteNumber(anchor?.altitude ?? anchor?.height) ?? 0
        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)
        if (call.cameraViewIsStable({anchor, heading: safeHeading, pitch: safePitch})) {
            return
        }

        const cameraHeight = call.cameraAltitudeForSample(anchor, cameraSettings)
        const target = safeCartesianFromLonLat({
            ...anchor,
            altitude: anchorHeight,
        })
        if (!target) {
            return
        }

        const viewer = globalThis.lgs?.viewer
        const camera = viewer?.camera
        const transform = Transforms.eastNorthUpToFixedFrame(target)
        const range = replayCameraRangeFromPitch(Math.max(1, cameraHeight - anchorHeight), safePitch)
        if (!camera) {
            return
        }

        state.cameraAutoTrackingIgnoreUntil = call.now() + 250
        state.cameraApplyingView = true
        try {
            camera.lookAtTransform?.(Matrix4.IDENTITY)
            const east = Matrix4.getColumn(transform, 0, new Cartesian3())
            const north = Matrix4.getColumn(transform, 1, new Cartesian3())
            const up = Matrix4.getColumn(transform, 2, new Cartesian3())
            const forward = Cartesian3.normalize(
                Cartesian3.add(
                    Cartesian3.multiplyByScalar(east, Math.sin(safeHeading), new Cartesian3()),
                    Cartesian3.multiplyByScalar(north, Math.cos(safeHeading), new Cartesian3()),
                    new Cartesian3(),
                ),
                new Cartesian3(),
            )
            const horizontalDistance = range * Math.cos(safePitch)
            const verticalDistance = range * Math.sin(-safePitch)
            const destination = Cartesian3.add(
                Cartesian3.subtract(target, Cartesian3.multiplyByScalar(forward, horizontalDistance, new Cartesian3()), new Cartesian3()),
                Cartesian3.multiplyByScalar(up, verticalDistance, new Cartesian3()),
                new Cartesian3(),
            )
            const direction = Cartesian3.normalize(Cartesian3.subtract(target, destination, new Cartesian3()), new Cartesian3())
            const right = Cartesian3.normalize(Cartesian3.cross(direction, up, new Cartesian3()), new Cartesian3())
            const correctedUp = Cartesian3.normalize(Cartesian3.cross(right, direction, new Cartesian3()), new Cartesian3())
            camera.setView?.({
                                 destination,
                                 orientation: {
                                     direction,
                                     up: correctedUp,
                                 },
                             })
            call.rememberCameraView({anchor, heading: safeHeading, pitch: safePitch})
        }
        finally {
            state.cameraApplyingView = false
        }
    }

export const liveCameraPitch =  (mode, fallback) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const cameraPitch = finiteNumber(globalThis.lgs?.viewer?.camera?.pitch)
        return cameraPitch ?? fallback
    }

export const markerPositionForSample = (mode, sample, markerSettings) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const override = markerSettings?.position
        if (!override) {
            return sample
        }

        return {
            ...sample,
            longitude: override.longitude,
            latitude:  override.latitude,
            altitude:  finiteNumber(override.altitude) ?? finiteNumber(sample?.altitude ?? sample?.height) ?? 0,
        }
    }

export const markerRenderHeightForSample =  (mode, sample) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const longitude = finiteNumber(sample?.longitude)
        const latitude = finiteNumber(sample?.latitude)
        if (longitude === null || latitude === null) {
            return 0
        }

        const terrainHeight = call.cesiumScene()?.globe?.getHeight?.(
            Cartographic.fromDegrees(longitude, latitude),
        )
        return finiteNumber(terrainHeight) ?? 0
    }

export const markerRenderCartesianForSample =  (mode, sample) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return safeCartesianFromLonLat({
                                                                            ...sample,
                                                                            altitude: call.markerRenderHeightForSample(sample),
                                                                        })
}

export const windowPositionForSample =  (mode, sample) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = globalThis.lgs?.viewer
        const scene = call.cesiumScene()
        const position = call.markerRenderCartesianForSample(sample)
        if (!viewer || !scene || !position) {
            return null
        }

        let windowPosition = null
        try {
            windowPosition = typeof scene.worldToWindowCoordinates === 'function'
                             ? scene.worldToWindowCoordinates(position)
                             : SceneTransforms.worldToWindowCoordinates(scene, position)
            if (windowPosition) {
                return {
                    x: windowPosition.x,
                    y: windowPosition.y,
                }
            }
        }
        catch {
            // Some test fixtures and partially initialized scenes do not expose the full Cesium projection state.
            // In that case, fall back to the canvas-space projection below instead of failing the whole FT loop.
        }

        const canvasPosition = scene.cartesianToCanvasCoordinates?.(position, new Cartesian2())
        if (canvasPosition) {
            return {
                x: canvasPosition.x,
                y: canvasPosition.y,
            }
        }

        return windowPosition ?? canvasPosition ?? null
    }

    /**
     * Converts Cesium window coordinates into the active crop-local coordinate space.
     *
     * @param {object} sample - Replay sample to project.
     * @returns {{x: number, y: number}|null} Crop-local screen position.
     */

export const trackingWindowPositionForSample =  (mode, sample) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const windowPosition = call.windowPositionForSample(sample)
        if (!windowPosition) {
            return null
        }

        const cropRect = call.videoCropRect()
        if (!cropRect) {
            return windowPosition
        }

        return {
            x: windowPosition.x - cropRect.left,
            y: windowPosition.y - cropRect.top,
        }
    }

export const cameraCollisionForSample = (mode, sample, cameraSettings) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = globalThis.lgs?.viewer
        const scene = call.cesiumScene()
        const windowPosition = call.trackingWindowPositionForSample(sample)
        if (!viewer || !scene || !windowPosition) {
            const outerBounds = replayToleranceZoneBounds(cameraSettings?.hysteresis?.zone)
            const safeBounds = replayInnerToleranceZoneBounds(
                outerBounds,
                finiteNumber(cameraSettings?.hysteresis?.marginRatio) ?? 0.12,
            )
            return {
                side:       null,
                outer:      outerBounds,
                inner:      safeBounds,
                screen:     null,
                error:      1,
                hard:       true,
                shouldMove: true,
            }
        }

        const rect = call.viewportRectForCesiumSurface()
        const markerRadius = finiteNumber(globalThis.lgs?.stores?.replay?.markerRadius) ?? 35
        const overlayBounds = replayToleranceZoneBounds(cameraSettings?.hysteresis?.zone)
        const safeBounds = replayInnerToleranceZoneBounds(
            overlayBounds,
            finiteNumber(cameraSettings?.hysteresis?.marginRatio) ?? 0.12,
        )
        return replayWindowCollisionFromPoint({
                                                      point:        windowPosition,
                                                      width:        rect.width,
                                                      height:       rect.height,
                                                      outerBounds:  overlayBounds,
                                                      safeBounds,
                                                      markerRadius,
                                                  })
    }

export const terrainHeightForLonLat = (mode, longitude, latitude) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (finiteNumber(longitude) === null || finiteNumber(latitude) === null) {
            return null
        }

        const globe = call.cesiumScene()?.globe
        const height = globe?.getHeight?.(Cartographic.fromDegrees(longitude, latitude))
        if (height === null || height === undefined || height === '') {
            return null
        }
        return finiteNumber(height)
    }

export const persistCameraSettings =  (mode, updates) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const current = getJourneyReplaySettings().camera
        const next = normalizeJourneyReplayCamera({
            ...current,
            ...updates,
            hysteresis: {
                ...(current?.hysteresis ?? {}),
                ...(updates?.hysteresis ?? {}),
            },
        })

        if (globalThis.lgs?.settings?.ui?.replay) {
            globalThis.lgs.settings.ui.replay.camera = next
        }
        if (globalThis.lgs?.stores?.replay) {
            globalThis.lgs.stores.replay.camera = next
        }

        return next
    }

export const updateCameraSettingsFromCesiumControls = (mode, sample, {altitudeMode = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = globalThis.lgs?.viewer?.camera
        if (!camera || !sample) {
            return null
        }

        const terrainHeight = call.terrainHeightForLonLat(sample?.longitude, sample?.latitude)
        const cameraHeight = finiteNumber(camera.positionCartographic?.height)
        const currentCameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        const currentAltitude = currentCameraSettings.altitude
        const next = {
            pitch: clamp(Math.round(CesiumMath.toDegrees(camera.pitch)), -89, -5),
        }

        const headingDeg = Number.isFinite(camera.heading)
            ? clamp(Math.round(CesiumMath.toDegrees(camera.heading)), -180, 180)
            : undefined
        if (headingDeg !== undefined && currentCameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            next.heading = headingDeg
        }

        const nextAltitudeMode = altitudeMode ?? currentCameraSettings.altitudeMode
        if (nextAltitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET) {
            next.altitude = terrainHeight === null
                            ? currentAltitude
                            : clamp(Math.max(10, (cameraHeight ?? (currentAltitude + terrainHeight)) - terrainHeight), 10, 100000)
        }
        else {
            next.altitude = clamp(cameraHeight ?? currentAltitude, 10, 100000)
        }

        return call.persistCameraSettings(next)
    }

export const updateCameraFromCesiumControls = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const store = replayStore()
        if (state.suppressPlaybackCameraSync) {
            return
        }
        if (store?.cameraUpdateSource === 'drawer') {
            return
        }
        call.markPlaybackCameraUserAdjusted()
        mode.syncCameraFromCesiumControls()
    }

export const syncCameraDrawerFromSettings = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        if (globalThis.lgs?.settings?.ui?.replay) {
            globalThis.lgs.settings.ui.replay.camera = camera
        }
        if (globalThis.lgs?.stores?.replay) {
            globalThis.lgs.stores.replay.camera = camera
        }
    }

export const now = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return globalThis.performance?.now?.() ?? Date.now()
}

export const cesiumScene = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
}

export const smoothRadians = (mode, previous, next, factor = 0.12) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const prev = finiteNumber(previous)
        const nextValue = finiteNumber(next)
        if (nextValue === null) {
            return prev ?? 0
        }
        if (prev === null) {
            return nextValue
        }

        const delta = replayAngularDelta(prev, nextValue)
        if (delta === null) {
            return nextValue
        }

        return prev + delta * clamp(factor, 0, 1)
    }

export const timeNormalizedSmoothingFactor = (mode, factor, deltaSeconds = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const baseFactor = clamp(factor, 0, 1)
        const delta = finiteNumber(deltaSeconds)
        if (delta === null || delta <= 0) {
            return baseFactor
        }

        // Smoothing factors are calibrated for one 60 FPS update. Rebase them
        // on elapsed replay time so HQ at 30 FPS keeps the same video duration.
        const referenceFrameSeconds = 1 / 60
        return 1 - Math.pow(1 - baseFactor, delta / referenceFrameSeconds)
    }

export const traceCameraTiming = (mode, {logicalNow, exportMode, source, markerMode} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const wallNow = call.now()
        const logicalDelta = state.lastCameraTimingLogicalNow === null
                             ? null
                             : logicalNow - state.lastCameraTimingLogicalNow
        const wallDelta = state.lastCameraTimingWallNow === null
                          ? null
                          : wallNow - state.lastCameraTimingWallNow
        replayVideoTraceDebug('camera.timing', {
            clock:          exportMode ? 'video' : 'recording',
            logicalTimeMs:  logicalNow,
            wallTimeMs:     wallNow,
            logicalDeltaMs: logicalDelta,
            wallDeltaMs:    wallDelta,
            effectiveFps:   logicalDelta > 0 ? 1000 / logicalDelta : null,
            source,
            markerMode,
            exportMode,
        })
        state.lastCameraTimingLogicalNow = logicalNow
        state.lastCameraTimingWallNow = wallNow
    }

export const traceCameraChangeTiming = (mode, {logicalNow, exportMode, source, markerMode, desiredHeading, desiredPitch} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = globalThis.lgs?.viewer?.camera
        const currentHeading = finiteNumber(camera?.heading)
        const currentPitch = finiteNumber(camera?.pitch)
        const headingError = currentHeading === null || finiteNumber(desiredHeading) === null
                            ? 0
                            : Math.abs(replayAngularDelta(currentHeading, desiredHeading) ?? 0)
        const pitchError = currentPitch === null || finiteNumber(desiredPitch) === null
                          ? 0
                          : Math.abs(currentPitch - desiredPitch)
        const wallNow = call.now()
        const isChanging = headingError >= CAMERA_TIMING_START_ANGLE_RADIANS
                           || pitchError >= CAMERA_TIMING_START_ANGLE_RADIANS
        const isSettled = headingError <= CAMERA_TIMING_SETTLE_ANGLE_RADIANS
                          && pitchError <= CAMERA_TIMING_SETTLE_ANGLE_RADIANS

        if (!state.cameraTimingChange && isChanging) {
            state.cameraTimingChange = {
                logicalStart: logicalNow,
                wallStart:    wallNow,
            }
            replayVideoTraceDebug('camera.change.start', {
                clock: exportMode ? 'video' : 'recording',
                logicalTimeMs: logicalNow,
                wallTimeMs: wallNow,
                headingErrorRadians: headingError,
                pitchErrorRadians: pitchError,
                source,
                markerMode,
            })
        }

        if (state.cameraTimingChange && isSettled) {
            const change = state.cameraTimingChange
            replayVideoTraceDebug('camera.change.end', {
                clock: exportMode ? 'video' : 'recording',
                logicalTimeMs: logicalNow,
                wallTimeMs: wallNow,
                durationVideoMs: logicalNow - change.logicalStart,
                durationWallMs: wallNow - change.wallStart,
                headingErrorRadians: headingError,
                pitchErrorRadians: pitchError,
                source,
                markerMode,
            })
            state.cameraTimingChange = null
        }
    }

export const cancelCameraBezierTransition = (mode, resolveValue = false) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const hadActiveTransition = state.cameraBezierFrame !== null
            || state.cameraBezierResolve !== null
            || state.cameraFlightActive
        if (typeof state.cameraBezierFrame === 'function') {
            try {
                state.cameraBezierFrame()
            }
            catch {
                // Transition cancellation is best-effort.
            }
            state.cameraBezierFrame = null
        }
        else if (state.cameraBezierFrame !== null) {
            globalThis.cancelAnimationFrame?.(state.cameraBezierFrame)
            globalThis.clearTimeout?.(state.cameraBezierFrame)
            state.cameraBezierFrame = null
        }
        if (hadActiveTransition) {
            globalThis.lgs?.viewer?.camera?.cancelFlight?.()
        }
        if (state.cameraBezierResolve !== null) {
            const resolve = state.cameraBezierResolve
            state.cameraBezierResolve = null
            resolve(resolveValue)
        }
        state.cameraApplyingView = false
        state.cameraFlightActive = false
        state.deterministicCameraTransition = null
        state.deterministicCameraFollowerAt = null
        state.deterministicCameraFollowerActive = false
        state.deterministicCameraFollowerVelocity = null
        state.cameraSmoothingDeltaSeconds = null
        state.lastCameraLogicalNow = null
        state.lastCameraTimingLogicalNow = null
        state.lastCameraTimingWallNow = null
        state.cameraTimingChange = null
    }
