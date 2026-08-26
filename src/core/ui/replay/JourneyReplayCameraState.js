/**
 * Replay camera State behavior.
 */


import {ArcType, Cartesian2, Cartesian3, Cartographic, CatmullRomSpline, Color, ExtrapolationType, JulianDate, EasingFunction, HeadingPitchRange, HeightReference, HorizontalOrigin, LinearApproximation, Matrix4, PolylineDashMaterialProperty, SampledPositionProperty, SceneTransforms, Transforms, VerticalOrigin, Math as CesiumMath} from 'cesium'
import {REPLAY_DRAWER} from '@Core/constants'
import {Journey} from '@Core/Journey'
import {CameraUtils} from '@Utils/cesium/CameraUtils'
import {POIUtils} from '@Utils/cesium/POIUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {faCamera} from '@fortawesome/pro-solid-svg-icons'
import {faPersonHiking} from '@fortawesome/pro-regular-svg-icons'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'
import {createReplayCameraCommand} from './ReplayCameraCommand'
import {applyReplayCesiumCameraCommand} from './ReplayCesiumCameraAdapter'
import {finiteNumber, replayStore} from './JourneyReplayRuntime'
import {
    clamp, lerp, hasFiniteLonLat, projectReplayTargetInCameraFrame, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
} from './JourneyReplayCameraMath'
import {
    REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET, REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_POSITION_BEHIND,
    REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION, REPLAY_MARKER_MODE_TRACE,
    getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker,
} from './JourneyReplayProgressionStyle'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import {replayCameraFor, replaySceneFor, replayViewerFor} from './ReplayRenderTarget'

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
    memoizeReplayCameraUpdateCache,
    replayCameraUpdateCameraSettingsKey,
    replayCameraUpdateSampleKey,
} from './JourneyReplayCameraUpdateCache'
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

/**
 * Lock the interactive Cesium camera to one replay anchor.
 *
 * @param {object} mode - Replay camera mode.
 * @param {object} options - Replay sample and camera pose.
 * @returns {boolean} Whether the camera was locked to the anchor.
 */
export const lockReplayCameraToAnchor = (mode, {
    sample,
    heading,
    pitch,
    roll = 0,
    cameraSettings,
    cameraHeight = null,
    cameraPosition = null,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const camera = replayCameraFor(mode)
    const capturedPose = cameraPosition
        ? cameraPoseAroundReplayAnchor({positionWC: cameraPosition}, sample)
        : null
    // Keep the captured framing, but always orient the replay camera on the
    // departure tangent instead of inheriting an orbit heading.
    const effectiveHeading = heading
    const effectivePitch = capturedPose?.pitch ?? pitch
    const effectiveCameraHeight = capturedPose?.height ?? cameraHeight
    const effectiveCameraRange = capturedPose?.range ?? null
    const frame = call.cameraRecenterFrame?.({
        sample,
        heading: effectiveHeading,
        pitch: effectivePitch,
        roll,
        cameraSettings,
        cameraHeight: effectiveCameraHeight,
        cameraRange: effectiveCameraRange,
    })
    if (!camera || typeof camera.lookAtTransform !== 'function' || !frame?.target || !frame.destination) {
        return false
    }

    const range = Cartesian3.distance(frame.destination, frame.target)
    if (!Number.isFinite(range) || range <= 0) {
        return false
    }

    const targetCartographic = Cartographic.fromCartesian(frame.target)
    if (!targetCartographic) {
        return false
    }

    const orbitTransform = Transforms.eastNorthUpToFixedFrame(frame.target)
    state.cameraApplyingView = true
    try {
        CameraUtils.setOrbitTransform(camera, {
            longitude: CesiumMath.toDegrees(targetCartographic.longitude),
            latitude: CesiumMath.toDegrees(targetCartographic.latitude),
            height: targetCartographic.height,
        })
        camera.lookAtTransform(
            orbitTransform,
            new HeadingPitchRange(frame.safeHeading, frame.safePitch, range),
        )
        call.rememberCameraView?.({
            anchor: sample,
            heading: frame.safeHeading,
            pitch: frame.safePitch,
            roll: frame.roll,
        })
        call.refreshReplayDiagnosticsOverlay?.()
        return true
    }
    finally {
        state.cameraApplyingView = false
    }
}

/**
 * Resolve the live camera pose relative to a fixed replay anchor.
 *
 * @param {Object|null} camera - Interactive Cesium camera.
 * @param {Object|null} anchor - Replay anchor in geographic coordinates.
 * @returns {Object|null} Target-relative heading, pitch, range, and height.
 */
const cameraPoseAroundReplayAnchor = (camera, anchor) => {
    const position = camera?.positionWC ?? camera?.position
    const target = safeCartesianFromLonLat(anchor)
    if (!position || !target) {
        return null
    }

    try {
        const transform = Transforms.eastNorthUpToFixedFrame(target)
        const inverse = Matrix4.inverseTransformation(transform, new Matrix4())
        const localPosition = Matrix4.multiplyByPoint(inverse, position, new Cartesian3())
        const horizontalDistance = Math.hypot(localPosition.x, localPosition.y)
        const range = Cartesian3.magnitude(localPosition)
        if (!Number.isFinite(horizontalDistance)
            || !Number.isFinite(range)
            || horizontalDistance <= 0
            || range <= 0) {
            return null
        }

        const cartographic = Cartographic.fromCartesian(position)
        return {
            heading: Math.atan2(-localPosition.x, -localPosition.y),
            pitch: -Math.atan2(localPosition.z, horizontalDistance),
            range,
            height: Number.isFinite(cartographic?.height) ? cartographic.height : null,
        }
    }
    catch {
        return null
    }
}

/**
 * Return the interactive Studio camera used during recording preparation.
 *
 * @returns {Object|null} The live Studio Cesium camera.
 */
const interactiveReplayCamera = mode => replayCameraFor(mode)

/**
 * Resolve the closest Ahead/Behind representation for a live camera heading.
 *
 * The signed angle is limited to +/-90 degrees. Crossing that limit changes
 * the side of the trace instead of clamping the camera heading.
 *
 * @param {object} options - Heading and current position inputs.
 * @param {number|null} options.axisHeading - Trace tangent heading in radians.
 * @param {number|null} options.cameraHeading - Live camera heading in radians.
 * @param {string} options.positionMode - Current Ahead/Behind mode.
 * @returns {{positionMode: string, headingOffset: number}|null} Normalized representation.
 */
export const replayCameraPositionModeFromHeading = ({
    axisHeading,
    cameraHeading,
    positionMode,
} = {}) => {
    if (positionMode !== REPLAY_CAMERA_POSITION_AHEAD
        && positionMode !== REPLAY_CAMERA_POSITION_BEHIND) {
        return null
    }

    const resolvedAxisHeading = finiteNumber(axisHeading)
    const resolvedCameraHeading = finiteNumber(cameraHeading)
    if (resolvedAxisHeading === null || resolvedCameraHeading === null) {
        return null
    }

    const candidates = [
        {
            positionMode: REPLAY_CAMERA_POSITION_BEHIND,
            delta: replayAngularDelta(resolvedAxisHeading, resolvedCameraHeading),
        },
        {
            positionMode: REPLAY_CAMERA_POSITION_AHEAD,
            delta: replayAngularDelta(resolvedAxisHeading + Math.PI, resolvedCameraHeading),
        },
    ]
    const current = candidates.find(candidate => candidate.positionMode === positionMode)
    const alternate = candidates.find(candidate => candidate.positionMode !== positionMode)
    const selected = Math.abs(current?.delta ?? Math.PI) <= Math.PI / 2
        ? current
        : alternate
    if (!selected || selected.delta === null) {
        return null
    }

    return {
        positionMode: selected.positionMode,
        headingOffset: clamp(
            Math.round(CesiumMath.toDegrees(selected.delta)),
            REPLAY_CAMERA_HEADING_OFFSET_MIN,
            REPLAY_CAMERA_HEADING_OFFSET_MAX,
        ),
    }
}

export const applyCameraView = (mode, {anchor, heading, pitch, roll = 0, cameraSettings}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const startedAt = globalThis.performance?.now?.() ?? Date.now()
        replayVideoTraceDebug('camera.view.apply.start', {
            anchorLongitude: finiteNumber(anchor?.longitude),
            anchorLatitude: finiteNumber(anchor?.latitude),
            heading,
            pitch,
            roll,
            altitudeMode: cameraSettings?.altitudeMode ?? null,
            terrainHeightLookupBypass: state.terrainHeightLookupBypass === true,
        })
        const anchorHeight = finiteNumber(anchor?.altitude ?? anchor?.height) ?? 0
        const markerHeight = cameraSettings?.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
            ? finiteNumber(call.markerRenderHeightForSample?.(anchor)) ?? anchorHeight
            : anchorHeight
        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)
        const safeRoll = clamp(sanitizeOrientationRadians(roll, 0), -Math.PI / 4, Math.PI / 4)
        if (call.cameraViewIsStable({anchor, heading: safeHeading, pitch: safePitch, roll: safeRoll})) {
            replayVideoTraceDebug('camera.view.apply.end', {
                elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt,
                skipped: true,
                reason: 'stable',
            })
            return false
        }

        const cameraHeight = call.cameraAltitudeForSample(anchor, cameraSettings)
        const range = replayCameraRangeFromPitch(Math.max(1, cameraHeight - markerHeight), safePitch)
        const command = createReplayCameraCommand({
            pose: {
                target: {
                    longitude: anchor?.longitude,
                    latitude: anchor?.latitude,
                    altitude: markerHeight,
                },
                heading: safeHeading,
                pitch: safePitch,
                roll: safeRoll,
                rangeMeters: range,
            },
            source: 'live-replay',
        })
        if (!command) {
            replayVideoTraceDebug('camera.view.apply.end', {
                elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt,
                skipped: true,
                reason: 'no-target',
            })
            return false
        }

        const camera = replayCameraFor(mode)
        if (!camera || typeof camera.setView !== 'function') {
            replayVideoTraceDebug('camera.view.apply.end', {
                elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt,
                skipped: true,
                reason: 'no-camera',
            })
            return false
        }

        state.cameraAutoTrackingIgnoreUntil = call.now() + 250
        state.cameraApplyingView = true
        try {
            const appliedFrame = applyReplayCesiumCameraCommand({camera, command})
            if (!appliedFrame) {
                return false
            }
            call.rememberCameraView({anchor, heading: safeHeading, pitch: safePitch, roll: safeRoll})
            return true
        }
        finally {
            state.cameraApplyingView = false
            replayVideoTraceDebug('camera.view.apply.end', {
                elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startedAt,
                skipped: false,
            })
        }
    }

export const liveCameraPitch =  (mode, fallback) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const cameraPitch = finiteNumber((call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera?.pitch)
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

export const markerRenderHeightForSample =  (mode, sample, {fallback = undefined} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const longitude = finiteNumber(sample?.longitude)
        const latitude = finiteNumber(sample?.latitude)
        const sampleHeight = finiteNumber(sample?.altitude ?? sample?.height) ?? 0
        const fallbackHeight = fallback === undefined ? sampleHeight : finiteNumber(fallback) ?? 0
        if (longitude === null || latitude === null) {
            return fallbackHeight
        }
        if (state.terrainHeightLookupBypass === true) {
            return fallbackHeight
        }

        const terrainHeight = (call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene)?.globe?.getHeight?.(
            Cartographic.fromDegrees(longitude, latitude),
        )
        return finiteNumber(terrainHeight) ?? fallbackHeight
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

        const viewer = call.cesiumViewer?.() ?? globalThis.lgs?.viewer
        const scene = call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
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

export const cameraCollisionForSample = (mode, sample, cameraSettings, cache = null) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const computeCollision = () => {
            const viewer = call.cesiumViewer?.() ?? globalThis.lgs?.viewer
            const scene = call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
            const windowPosition = call.trackingWindowPositionForSample(sample)
            const rect = call.viewportRectForCesiumSurface()
            const outerBounds = replayToleranceZoneBounds(cameraSettings?.hysteresis?.zone)
            const safeBounds = replayInnerToleranceZoneBounds(
                outerBounds,
                finiteNumber(cameraSettings?.hysteresis?.marginRatio) ?? 0.12,
            )
            if (!viewer || !scene || !windowPosition || !rect
                || (finiteNumber(rect.width) ?? 0) <= 0
                || (finiteNumber(rect.height) ?? 0) <= 0) {
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

            const markerRadius = finiteNumber(globalThis.lgs?.stores?.replay?.markerRadius) ?? 35
            const collision = replayWindowCollisionFromPoint({
                point:        windowPosition,
                width:        rect.width,
                height:       rect.height,
                outerBounds,
                safeBounds,
                markerRadius,
            })
            return collision ?? {
                side:       null,
                outer:      outerBounds,
                inner:      safeBounds,
                screen:     null,
                error:      1,
                hard:       true,
                shouldMove: true,
            }
        }

        const cacheKey = [
            replayCameraUpdateSampleKey(sample),
            replayCameraUpdateCameraSettingsKey(cameraSettings),
        ].join('|')
        return memoizeReplayCameraUpdateCache(cache, 'cameraCollisionForSample', cacheKey, computeCollision)
    }

/**
 * Evaluate a replay target against a candidate camera frame.
 *
 * @param {object} mode - Replay camera mode.
 * @param {object} options - Candidate frame and collision inputs.
 * @returns {object} Candidate-frame collision result.
 */
export const cameraCollisionForFrame = (mode, {
    frame,
    sample,
    cameraSettings,
    viewport = null,
} = {}) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const target = call.markerRenderCartesianForSample(sample)
    const rect = viewport ?? call.viewportRectForCesiumSurface()
    const frustum = (call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera?.frustum
    const verticalFovRadians = finiteNumber(frustum?.fovy) ?? finiteNumber(frustum?.fov) ?? (Math.PI / 3)
    const aspectRatio = finiteNumber(frustum?.aspectRatio)
                        ?? ((rect?.canvasWidth ?? rect?.width ?? 0) / Math.max(1, rect?.canvasHeight ?? rect?.height ?? 1))
    const point = projectReplayTargetInCameraFrame({
        frame,
        target,
        viewport: rect,
        verticalFovRadians,
        aspectRatio,
    })
    const outerBounds = replayToleranceZoneBounds(cameraSettings?.hysteresis?.zone)
    const safeBounds = replayInnerToleranceZoneBounds(
        outerBounds,
        finiteNumber(cameraSettings?.hysteresis?.marginRatio) ?? 0.12,
    )
    const markerRadius = finiteNumber(globalThis.lgs?.stores?.replay?.markerRadius) ?? 35
    const collision = replayWindowCollisionFromPoint({
        point,
        width:       rect?.width,
        height:      rect?.height,
        outerBounds,
        safeBounds,
        markerRadius,
    })
    return collision ?? {
        side:       null,
        outer:      outerBounds,
        inner:      safeBounds,
        screen:     null,
        error:      1,
        hard:       true,
        shouldMove: true,
    }
}

export const terrainHeightForLonLat = (mode, longitude, latitude) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (finiteNumber(longitude) === null || finiteNumber(latitude) === null) {
            return null
        }

        if (state.terrainHeightLookupBypass === true) {
            if (state.terrainHeightLookupTrace === true) {
                replayVideoTraceDebug('camera.terrain.lookup.bypass', {
                    longitude,
                    latitude,
                })
            }
            return null
        }

        const globe = (call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene)?.globe
        const height = globe?.getHeight?.(Cartographic.fromDegrees(longitude, latitude))
        if (height === null || height === undefined || height === '') {
            return null
        }
        if (state.terrainHeightLookupTrace === true) {
            replayVideoTraceDebug('camera.terrain.lookup.end', {
                longitude,
                latitude,
                height: finiteNumber(height),
            })
        }
        return finiteNumber(height)
    }

/**
 * Toggle terrain height lookup bypass for replay camera work.
 *
 * @param {object} mode - Replay camera mode.
 * @param {boolean} value - True to bypass terrain lookups.
 * @returns {boolean} Updated bypass state.
 */
export const setTerrainHeightLookupBypass = (mode, value) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]

        state.terrainHeightLookupBypass = value === true
        return state.terrainHeightLookupBypass
    }

/**
 * Toggle terrain height lookup tracing for replay camera work.
 *
 * @param {object} mode - Replay camera mode.
 * @param {boolean} value - True to trace terrain lookups.
 * @returns {boolean} Updated trace state.
 */
export const setTerrainHeightLookupTrace = (mode, value) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]

        state.terrainHeightLookupTrace = value === true
        return state.terrainHeightLookupTrace
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

        const camera = interactiveReplayCamera(mode)
        if (!camera || !sample) {
            return null
        }

        const terrainHeight = call.terrainHeightForLonLat(sample?.longitude, sample?.latitude)
        const anchoredPose = cameraPoseAroundReplayAnchor(camera, sample)
        const cameraHeight = anchoredPose?.height ?? finiteNumber(camera.positionCartographic?.height)
        const currentCameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        const currentAltitude = currentCameraSettings.altitude
        const pitchRadians = anchoredPose?.pitch ?? finiteNumber(camera.pitch)
        const headingRadians = anchoredPose?.heading ?? finiteNumber(camera.heading)
        const next = {
            pitch: pitchRadians === null || pitchRadians === undefined
                ? currentCameraSettings.pitch
                : clamp(Math.round(CesiumMath.toDegrees(pitchRadians)), -89, -5),
        }

        const headingDeg = headingRadians !== null && headingRadians !== undefined
            ? clamp(Math.round(CesiumMath.toDegrees(headingRadians)), -180, 180)
            : undefined
        if (headingDeg !== undefined && currentCameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            next.heading = headingDeg
        }
        if (headingRadians !== null
            && headingRadians !== undefined
            && currentCameraSettings.positionMode !== REPLAY_CAMERA_POSITION_SYSTEM) {
            const axisHeading = call.headingFromPositionProperty?.(sample?.progress ?? state.controller?.progress ?? 0)
            const positionAndOffset = replayCameraPositionModeFromHeading({
                axisHeading,
                cameraHeading: headingRadians,
                positionMode: currentCameraSettings.positionMode,
            })
            if (positionAndOffset) {
                next.positionMode = positionAndOffset.positionMode
                next.headingOffset = positionAndOffset.headingOffset
            }
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

/**
 * Persist a Cesium camera change only when it represents an authorized user
 * interaction rather than feedback from an automatic replay frame.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - Synchronization options.
 * @param {boolean} [options.userInteraction=false] - Whether a completed user interaction authorized this synchronization.
 * @returns {void}
 */
export const updateCameraFromCesiumControls = (mode, {userInteraction = false} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const store = replayStore()
        if (state.suppressPlaybackCameraSync) {
            return
        }
        if (store?.cameraUpdateSource === 'drawer') {
            return
        }
        if (state.cameraApplyingView) {
            return
        }
        const authorizedUserInteraction = userInteraction
                                          || state.cameraPointerActive === true
                                          || state.cameraUserAdjusting === true
        if (!authorizedUserInteraction) {
            return
        }
        const logicalNow = finiteNumber(call.now?.()) ?? 0
        if (!userInteraction
            && !state.cameraPointerActive
            && logicalNow < (finiteNumber(state.cameraAutoTrackingIgnoreUntil) ?? 0)) {
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
    return replaySceneFor(mode)
}

/**
 * Resolve the active Cesium viewer for this replay session.
 *
 * @param {Object} mode - Replay session mode.
 * @returns {Object|null} Explicit HQ target or Studio viewer.
 */
export const cesiumViewer = mode => replayViewerFor(mode)

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

        const camera = (call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera
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
            replayCameraFor(mode)?.cancelFlight?.()
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
