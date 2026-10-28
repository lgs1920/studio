/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraTrackingBinding.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-03
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Shared logical replay camera tracking for interactive playback and export rendering.
 */

import {Cartesian3, Cartographic, Ellipsoid} from 'cesium'
import {currentJourneyReplayCameraSettings, finiteNumber} from './JourneyReplayRuntime'
import {isJourneyReplayBasicMode} from './ReplayUserModeConstants'
import {
    replayAdaptiveTrackingTiming,
    replayCameraFrameLeadSeconds,
    replayCameraRecenterDuration,
    replayDynamicTargetPointInZone,
    replayIsWindowPointOutsideToleranceZone,
    replayRuntimeTrackingSettings,
} from './JourneyReplayCameraMath'
import {
    REPLAY_MARKER_MODE_HYSTERESIS,
    REPLAY_MARKER_MODE_NAVIGATION,
    REPLAY_MARKER_MODE_TRACE,
    REPLAY_EFFECT_NONE,
    REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
    getJourneyReplaySettings,
    normalizeJourneyReplayCamera,
    normalizeJourneyReplayMarker,
} from './JourneyReplayProgressionStyle'
import {
    CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS,
    REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
    REPLAY_NAVIGATION_MAX_HEADING_DRIFT_DEGREES,
    REPLAY_NAVIGATION_MAX_LATERAL_DRIFT_METERS,
    REPLAY_NAVIGATION_MIN_TURN_DRIFT_DEGREES,
    REPLAY_NAVIGATION_PREDICTIVE_CONFIRMATION_LOOKAHEAD_SECONDS,
    REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR,
    replayNavigationTransitionTiming,
} from './JourneyReplayCameraShared'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from './JourneyReplayInternal'
import {resolveJourneyReplayLogicalCameraPose} from './JourneyReplayLogicalCameraPose'
import {cameraMotionAtProgress} from './JourneyReplayCameraGuide'
import {createReplayCameraUpdateCache} from './JourneyReplayCameraUpdateCache'
import {
    replayCameraPitchCorrectionSearchLimits,
    resetReplayCameraPitchCorrection,
    resolveReplayCameraPitchCorrection,
} from './JourneyReplayCameraPitchController'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'
import {replayCameraFor} from './ReplayRenderTarget'
import {constrainReplayCameraFrameToCrop} from './JourneyReplayCameraCropConstraint'
import {replayCameraCropWidthMeters} from './JourneyReplayCameraMotionSmoothing'

const REPLAY_NAVIGATION_TARGET_LEAD_RATIO = 1
const REPLAY_CAMERA_LIVE_RECENTER_MIN_DURATION_SECONDS = 3
const REPLAY_NAVIGATION_IDLE_FOLLOW_RATIO = 0.12

/**
 * Resolve a softened duration for live Replay camera corrections.
 *
 * @param {number|null} easing - Configured camera easing value.
 * @returns {number} Live correction duration in seconds.
 */
const replayCameraLiveRecenterDuration = easing => Math.max(
    REPLAY_CAMERA_LIVE_RECENTER_MIN_DURATION_SECONDS,
    replayCameraRecenterDuration(easing),
)

/**
 * Replay effect polylines and marker layers can be returned by Cesium depth
 * picking. They are visual layers, not terrain obstructions for the camera.
 *
 * @returns {boolean} Whether replay effects are currently active.
 */
const replayEffectDepthPickingActive = () => {
    const settingsMode = getJourneyReplaySettings()?.progression?.effect?.mode
    const storeMode = globalThis.lgs?.stores?.replay?.progression?.effect?.mode
    return [settingsMode, storeMode].some(mode => mode && mode !== REPLAY_EFFECT_NONE)
}

/**
 * Convert an optional replay timing value without treating null as zero.
 *
 * @param {*} value - Optional numeric value.
 * @returns {number|null} Finite number or null.
 */
const optionalReplayTimingNumber = value => (
    value === null || value === undefined || value === ''
        ? null
        : finiteNumber(value)
)

/**
 * Reset deterministic transition and follower state.
 *
 * @param {object} state - Replay camera runtime state.
 * @returns {void}
 */
const resetCameraTransportState = state => {
    state.deterministicCameraTransition = null
    state.deterministicCameraFollowerAt = null
    state.deterministicCameraFollowerActive = false
    state.deterministicCameraFollowerVelocity = null
    state.navigationIdleFollowTarget = null
}

/**
 * Convert a recenter frame to the standard Cesium frame contract.
 *
 * @param {object|null} frame - Recenter frame.
 * @returns {object|null} Standard camera frame.
 */
const standardCameraFrame = frame => frame ? {
    destination: frame.destination,
    direction:   frame.direction,
    up:          frame.correctedUp ?? frame.up,
    roll:        frame.roll ?? 0,
} : null

/**
 * Apply a non-playback drawer refresh through the live Cesium adapter. This
 * keeps manual camera edits and transform reset behavior outside the logical
 * interactive/export timeline while still writing one complete target-locked pose.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} view - Resolved camera view.
 * @param {object} cameraSettings - Active camera settings.
 * @returns {boolean} Whether a live adapter was available.
 */
const applyLiveReplayCameraView = (mode, view, cameraSettings, {
    force = false,
    preferRecenter = false,
    allowRecenterWithoutWorldPosition = true,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!view || typeof call.applyCameraView !== 'function') {
        return false
    }

    const camera = replayCameraFor(mode)
    const hasCameraWorldPosition = Boolean(
        camera?.position
        || camera?.positionWC
        || (finiteNumber(camera?.positionCartographic?.longitude) !== null
            && finiteNumber(camera?.positionCartographic?.latitude) !== null),
    )
    const recenter = () => call.recenterCameraToSample({
        sample:         view.sample,
        cameraAnchorSample: view.cameraAnchorSample,
        heading:        view.heading,
        pitch:          view.pitch,
        roll:           view.roll,
        cameraSettings: view.cameraSettings ?? cameraSettings,
        cameraHeight:   view.cameraHeight,
        instant:        false,
        duration:        replayCameraLiveRecenterDuration(cameraSettings?.hysteresis?.easing),
        force,
    })
    if (preferRecenter
        && (hasCameraWorldPosition || allowRecenterWithoutWorldPosition)
        && typeof call.recenterCameraToSample === 'function') {
        void recenter()
        state.lastCameraHeading = view.heading
        state.lastCameraPitch = view.pitch
        return true
    }

    const applied = call.applyCameraView({
        anchor: view.cameraAnchorSample ?? view.sample,
        heading: view.heading,
        pitch: view.pitch,
        roll: view.roll,
        cameraSettings: view.cameraSettings ?? cameraSettings,
    })
    if (applied) {
        state.lastCameraHeading = view.heading
        state.lastCameraPitch = view.pitch
        return true
    }

    if (typeof camera?.setView === 'function' || typeof call.recenterCameraToSample !== 'function') {
        return false
    }

    if (!hasCameraWorldPosition) {
        return false
    }

    void recenter()
    state.lastCameraHeading = view.heading
    state.lastCameraPitch = view.pitch
    return true
}

/**
 * Pan the Navigation camera gently with the route while it remains in its
 * trigger zone, preserving the prepared orientation and camera height.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - Current camera-follow inputs.
 * @param {object} options.view - Current nominal route view.
 * @param {object|null} [options.logicalFrame=null] - Active deterministic frame.
 * @returns {boolean} Whether the gentle route pan was applied.
 */
const applyNavigationIdleFollow = (mode, {
    view,
    logicalFrame = null,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const currentFrame = call.currentCameraFrame?.(null)
    const referenceTarget = call.markerRenderCartesianForSample?.(view.sample)
    if (!currentFrame || !referenceTarget || typeof call.applyCameraFrame !== 'function') {
        return false
    }

    const scene = call.cesiumScene?.()
    const ellipsoid = scene?.globe?.ellipsoid ?? Ellipsoid.WGS84
    const currentCartographic = Cartographic.fromCartesian(referenceTarget, ellipsoid, new Cartographic())
    if (!currentCartographic) {
        return false
    }
    currentCartographic.height = 0
    const currentSurfaceTarget = ellipsoid.cartographicToCartesian(currentCartographic, new Cartesian3())
    const previousSurfaceTarget = state.navigationIdleFollowTarget
    state.navigationIdleFollowTarget = Cartesian3.clone(currentSurfaceTarget, new Cartesian3())

    if (!previousSurfaceTarget) {
        return false
    }

    const targetDelta = Cartesian3.subtract(currentSurfaceTarget, previousSurfaceTarget, new Cartesian3())
    const surfaceDelta = Cartesian3.multiplyByScalar(targetDelta, REPLAY_NAVIGATION_IDLE_FOLLOW_RATIO, new Cartesian3())
    const destination = Cartesian3.add(currentFrame.destination, surfaceDelta, new Cartesian3())
    const targetFrame = {
        destination,
        direction: currentFrame.direction,
        up: currentFrame.up,
    }
    if (Cartesian3.magnitudeSquared(surfaceDelta) < 1e-8) {
        return false
    }
    if (!call.applyCameraFrame(targetFrame)) {
        return false
    }

    const appliedFrame = call.currentCameraFrame?.(targetFrame) ?? targetFrame
    state.lastCameraHeading = state.lastAppliedCameraView?.heading ?? view.heading
    state.lastCameraPitch = state.lastAppliedCameraView?.pitch ?? view.pitch
    call.rememberCameraView?.({
        anchor: view.sample,
        heading: state.lastCameraHeading,
        pitch: state.lastCameraPitch,
        roll: state.lastAppliedCameraView?.roll ?? view.roll ?? 0,
        rangeMeters: Cartesian3.distance(appliedFrame.destination, referenceTarget),
    })
    if (logicalFrame) {
        logicalFrame.cameraPose = view
        logicalFrame.cameraFrame = appliedFrame
    }
    return true
}

/**
 * Apply one complete target-locked camera view and record it only after the
 * Cesium camera write succeeds.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - Camera view options.
 * @param {object} options.view - Resolved camera view.
 * @param {object} options.cameraSettings - Active camera settings.
 * @param {object|null} [options.logicalFrame=null] - Active logical frame.
 * @returns {boolean} Whether the frame was applied.
 */
export const applyResolvedReplayCameraView = (mode, {
    view,
    cameraSettings,
    logicalFrame = null,
    liveRecenter = false,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!view) {
        return false
    }

    const recenterFrame = call.cameraRecenterFrame({
        sample:         view.sample,
        cameraAnchorSample: view.cameraAnchorSample,
        heading:        view.heading,
        pitch:          view.pitch,
        roll:           view.roll,
        cameraSettings: view.cameraSettings ?? cameraSettings,
        cameraHeight:   view.cameraHeight,
    })
    const camera = replayCameraFor(mode)
    if (liveRecenter
        && typeof camera?.flyTo === 'function'
        && typeof call.recenterCameraToSample === 'function') {
        void call.recenterCameraToSample({
            sample:         view.sample,
            cameraAnchorSample: view.cameraAnchorSample,
            heading:        view.heading,
            pitch:          view.pitch,
            roll:           view.roll,
            cameraSettings: view.cameraSettings ?? cameraSettings,
            cameraHeight:   view.cameraHeight,
            instant:        false,
            duration:        replayCameraLiveRecenterDuration(cameraSettings?.hysteresis?.easing),
            force:           true,
        })
        state.lastCameraHeading = view.heading
        state.lastCameraPitch = view.pitch
        return true
    }
    const frame = standardCameraFrame(recenterFrame)
    if (!frame || !call.applyCameraFrame(frame)) {
        return false
    }

    call.rememberCameraView?.({
        anchor:  view.cameraAnchorSample ?? view.sample,
        heading: recenterFrame.safeHeading ?? view.heading,
        pitch:   recenterFrame.safePitch ?? view.pitch,
        roll:    recenterFrame.roll ?? view.roll ?? 0,
        rangeMeters: recenterFrame.destination && recenterFrame.target
            ? Cartesian3.distance(recenterFrame.destination, recenterFrame.target)
            : null,
    })
    state.lastCameraHeading = recenterFrame.safeHeading ?? view.heading
    state.lastCameraPitch = recenterFrame.safePitch ?? view.pitch
    if (logicalFrame) {
        logicalFrame.cameraPose = view
        logicalFrame.cameraFrame = frame
    }
    return true
}

/**
 * Resolve a camera view for one tracking sample with one shared interactive/export
 * logical algorithm.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - View inputs.
 * @param {object} options.sample - Target journey sample.
 * @param {number} options.progress - Target progress.
 * @param {string|null} options.source - Replay update source.
 * @param {object} options.cameraSettings - Active camera settings.
 * @param {object} options.markerSettings - Active marker settings.
 * @param {boolean} options.logicalCamera - Whether logical camera resolution is active.
 * @param {boolean} [options.collision=false] - Whether this is a zone correction.
 * @param {object|null} [options.cache=null] - Per-update cache.
 * @returns {object|null} Resolved camera view.
 */
const replayCameraViewForTrackingSample = (mode, {
    sample,
    progress,
    source,
    cameraSettings,
    markerSettings,
    logicalCamera,
    collision = false,
    cache = null,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const cameraMotion = source === 'playback' || source === 'replay-export' || source === 'scrub'
        ? cameraMotionAtProgress(mode, {sample, progress, cameraSettings})
        : null
    const axisHeading = typeof call.headingFromPositionProperty === 'function'
        ? cameraMotion?.heading ?? call.headingFromPositionProperty(progress, {
            easing: cameraSettings?.hysteresis?.easing,
        })
        : null
    if (logicalCamera) {
        const pose = resolveJourneyReplayLogicalCameraPose({
            sample,
            sampler: state.sampler,
            progress,
            source,
            cameraSettings,
            markerSettings,
            axisHeading,
            cameraAnchorSample: cameraMotion?.cameraAnchorAdjusted ? cameraMotion.sample : null,
        })
        const drift = cameraSettings.canDrift !== false
            && typeof call.replayTurnDriftForProgress === 'function'
            ? call.replayTurnDriftForProgress(progress, {
                maxHeadingOffsetDeg:    REPLAY_NAVIGATION_MAX_HEADING_DRIFT_DEGREES,
                maxLateralOffsetMeters: REPLAY_NAVIGATION_MAX_LATERAL_DRIFT_METERS,
                minTurnAngleDeg:        REPLAY_NAVIGATION_MIN_TURN_DRIFT_DEGREES,
                sensitivity:             cameraSettings.driftSensitivity,
            })
            : null
        if (pose && drift) {
            pose.heading += finiteNumber(drift.headingOffsetRadians) ?? 0
        }
        return pose
    }

    return call.cameraViewForSample({
        sample,
        progress,
        source,
        cameraSettings,
        markerSettings,
        collision,
        cameraAnchorSample: cameraMotion?.cameraAnchorAdjusted ? cameraMotion.sample : null,
        axisHeading,
        motionProfile: {
            turnDrift: {
                enabled:                 cameraSettings.canDrift !== false,
                maxHeadingOffsetDeg:     REPLAY_NAVIGATION_MAX_HEADING_DRIFT_DEGREES,
                maxLateralOffsetMeters:  REPLAY_NAVIGATION_MAX_LATERAL_DRIFT_METERS,
                minTurnAngleDeg:         REPLAY_NAVIGATION_MIN_TURN_DRIFT_DEGREES,
                sensitivity:              cameraSettings.driftSensitivity,
            },
        },
        previousHeading: source === 'refresh'
            ? state.lastCameraHeading
            : state.lastNominalCameraHeading ?? state.lastCameraHeading,
        previousPitch: source === 'refresh'
            ? state.lastCameraPitch
            : state.lastNominalCameraPitch ?? state.lastCameraPitch,
        cache,
    })
}

/**
 * Evaluate current-marker visibility without using predictive samples to
 * retain a temporary pitch correction.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - Visibility inputs.
 * @returns {{nominalVisible: boolean, candidateRedirectState: object|null, geometricVisible: boolean, renderedVisible: boolean|null, renderedTraceVisible: boolean|null, obstructionDistanceMeters: number|null}}
 * Visibility observation and smallest proven-safe candidate.
 */
const replayCameraPitchVisibility = (mode, {
    nominalView,
    source,
    cameraSettings,
    markerSettings,
    cache,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (cameraSettings?.canFixHiddenMarker === false) {
        return {
            nominalVisible: true,
            candidateRedirectState: null,
            geometricVisible: true,
            renderedVisible: null,
            renderedTraceVisible: null,
            obstructionDistanceMeters: null,
        }
    }
    const geometricVisible = typeof call.cameraViewVisibilityForSample === 'function'
        ? call.cameraViewVisibilityForSample({
            nominalView,
            futureSample: null,
            source,
            cameraSettings,
            markerSettings,
            cache,
        })
        : true
    const renderedObservationAllowed = !state.deterministicCameraTransition
                                      && !replayEffectDepthPickingActive()
    const renderedVisible = renderedObservationAllowed
                            && typeof call.renderedTargetVisible === 'function'
        ? call.renderedTargetVisible(nominalView?.sample, cache)
        : null
    const renderedTraceVisible = renderedObservationAllowed
                                 && typeof call.renderedTraceVisibleForSample === 'function'
        ? call.renderedTraceVisibleForSample(nominalView?.sample, cache)
        : null
    const nominalVisible = geometricVisible !== false
                           && renderedVisible !== false
                           && renderedTraceVisible !== false
    const nominalFrame = !nominalVisible && typeof call.cameraViewFrame === 'function'
        ? call.cameraViewFrame(nominalView)
        : null
    const renderedObstructionDistanceMeters = !nominalVisible
        && typeof call.renderedTargetObstructionDistanceForSample === 'function'
        ? call.renderedTargetObstructionDistanceForSample(nominalView?.sample, cache)
        : null
    const terrainObstructionDistanceMeters = !nominalVisible
        && typeof call.cameraLineOfSightObstacleDistanceForFrame === 'function'
        ? call.cameraLineOfSightObstacleDistanceForFrame({
            ...nominalFrame,
            sample:       nominalView?.sample,
            targetHeight: typeof call.markerRenderHeightForSample === 'function'
                ? call.markerRenderHeightForSample(nominalView?.sample)
                : null,
        })
        : null
    const obstructionDistanceMeters = renderedObstructionDistanceMeters
                                    ?? terrainObstructionDistanceMeters
    if (nominalVisible || typeof call.findCameraRedirectState !== 'function') {
        return {
            nominalVisible,
            candidateRedirectState: null,
            geometricVisible,
            renderedVisible,
            renderedTraceVisible,
            obstructionDistanceMeters,
        }
    }

    const pitchSearchLimits = replayCameraPitchCorrectionSearchLimits(
        nominalView?.pitch,
        obstructionDistanceMeters,
    )
    /**
     * Find the first proven redirect inside the ordered pitch envelopes.
     *
     * @param {boolean} markerOnly - Ignore trailing trace targets for this fallback search.
     * @returns {object|null} First valid redirect or null.
     */
    const findCandidate = markerOnly => {
        for (const maximumPitchOffset of pitchSearchLimits) {
            const candidate = call.findCameraRedirectState({
                nominalView,
                futureSample: null,
                source,
                cameraSettings,
                markerSettings,
                reuseCurrentIfVisible: true,
                maximumPitchOffset,
                markerOnly,
                requirePitchOffset: true,
                cache,
            })
            if (candidate) {
                return candidate
            }
        }
        return null
    }
    const strictCandidate = findCandidate(false)
    const candidateRedirectState = strictCandidate
                                   ?? (renderedVisible === false ? findCandidate(true) : null)
    return {
        nominalVisible,
        candidateRedirectState,
        geometricVisible,
        renderedVisible,
        renderedTraceVisible,
        obstructionDistanceMeters,
    }
}

/**
 * Resolve the active replay logical timestamp.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - Timing inputs.
 * @returns {number} Logical timestamp in milliseconds.
 */
const replayCameraLogicalNow = (mode, {
    deterministicCamera,
    logicalFrame,
    frameTimeMs,
    sample,
} = {}) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return deterministicCamera
        ? finiteNumber(logicalFrame?.frameTimeMs)
          ?? finiteNumber(frameTimeMs)
          ?? finiteNumber(sample?.journeyElapsedMillis)
          ?? call.now()
        : call.now()
}

/**
 * Update the replay camera from one logical replay frame.
 *
 * Interactive playback and export use this same resolver. Only the source of `logicalNow` and the
 * frame scheduling adapter differ between both render modes.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} [options] - Replay camera update options.
 * @returns {void}
 */
const updateCameraTracking = (mode, {
    sample,
    progress,
    forceToleranceRecenter = false,
    immediateToleranceRecenter = false,
    source = null,
    duration = null,
    frameTimeMs = null,
    frameIntervalMs = null,
    playbackRate = null,
    isFinalFrame = false,
    logicalFrame = null,
    logicalCamera = false,
    exportMode = false,
    preserveCurrentFrame = false,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (logicalFrame) {
        state.lastReplayLogicalFrame = logicalFrame
    }
    if (!sample || (!exportMode && state.replayExportCameraActive)) {
        return
    }

    const poiCameraFreeze = logicalFrame?.poiCameraFreeze === true
        || logicalFrame?.phase?.poiCameraFreeze === true
    if (poiCameraFreeze) {
        if (!state.poiCameraFreezeFrame) {
            call.cancelCameraBezierTransition(false)
            state.poiCameraFreezeFrame = call.currentCameraFrame?.(null) ?? null
        }
        if (state.poiCameraFreezeFrame) {
            call.applyCameraFrame?.(state.poiCameraFreezeFrame)
            if (logicalFrame) {
                logicalFrame.cameraFrame = state.poiCameraFreezeFrame
            }
        }
        return
    }
    state.poiCameraFreezeFrame = null

    const updateStartedAt = globalThis.performance?.now?.() ?? Date.now()
    const updateCache = createReplayCameraUpdateCache()
    /**
     * Record one bounded camera-update diagnostic step.
     *
     * @param {string} step - Step identifier.
     * @param {object} [extra] - Additional diagnostic fields.
     * @returns {void}
     */
    const traceUpdateStep = (step, extra = {}) => {
        replayVideoTraceDebug('camera.update.step', {
            step,
            elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - updateStartedAt,
            logicalTimeMs: finiteNumber(frameTimeMs),
            source,
            exportMode,
            ...extra,
        })
    }

    const settings = getJourneyReplaySettings()
    // Basic playback retains its configured Navigation policy independently
    // from Expert marker-mode settings.
    const markerSettings = normalizeJourneyReplayMarker(
        isJourneyReplayBasicMode()
            ? settings.marker
            : globalThis.lgs?.settings?.ui?.replay?.marker
              ?? globalThis.lgs?.stores?.replay?.marker
              ?? settings.marker,
    )
    if (markerSettings.mode === REPLAY_MARKER_MODE_TRACE && source !== 'refresh' && source !== 'drawer') {
        state.cameraMode = markerSettings.mode
        state.cameraFlightActive = false
        state.navigationCameraView = null
        state.navigationPredictiveViolationAt = null
        resetCameraTransportState(state)
        resetReplayCameraPitchCorrection(mode)
        call.removeToleranceZoneOverlay()
        return
    }
    if (state.cameraUserAdjusting) {
        return
    }
    const viewer = call.cesiumViewer?.() ?? globalThis.lgs?.viewer
    if (viewer) {
        viewer.trackedEntity = undefined
    }

    const cameraSettings = currentJourneyReplayCameraSettings()
    if (cameraSettings.canFixHiddenMarker === false) {
        resetReplayCameraPitchCorrection(mode)
    }
    const deterministicCamera = exportMode || logicalCamera === true
    const camera = replayCameraFor(mode)
    const playbackUsesLiveCamera = source !== 'playback'
                                   || Boolean(camera)
                                      && !(
                                          globalThis.lgs?.settings?.ui?.replay?.recordingSync === true
                                          || globalThis.lgs?.stores?.replay?.recordingSync === true
                                          || globalThis.lgs?.stores?.ui?.video?.exporting === true
                                      )
    if (state.cameraApplyingView) {
        if (!deterministicCamera && source !== 'refresh' && source !== 'scrub') {
            return
        }
        if (deterministicCamera || source !== 'refresh') {
            call.cancelCameraBezierTransition(false)
        }
    }
    const logicalNow = replayCameraLogicalNow(mode, {
        deterministicCamera,
        logicalFrame,
        frameTimeMs,
        sample,
    })
    const replayDurationSeconds = optionalReplayTimingNumber(duration)
        ?? optionalReplayTimingNumber(state.controller?.duration)
    const logicalDurationMillis = replayDurationSeconds === null
        ? optionalReplayTimingNumber(logicalFrame?.durationMillis)
            ?? optionalReplayTimingNumber(sample?.journeyDurationMillis)
        : replayDurationSeconds * 1000
    const navigationTransitionTiming = replayNavigationTransitionTiming(
        replayDurationSeconds
        ?? (logicalDurationMillis === null ? null : logicalDurationMillis / 1000),
    )
    const logicalFrameTimeMillis = optionalReplayTimingNumber(logicalFrame?.frameTimeMs)
                                   ?? optionalReplayTimingNumber(frameTimeMs)
                                   ?? optionalReplayTimingNumber(sample?.journeyElapsedMillis)
    const logicalFrameIntervalMillis = optionalReplayTimingNumber(logicalFrame?.frameIntervalMs)
                                       ?? optionalReplayTimingNumber(frameIntervalMs)
    const playbackDirection = (finiteNumber(state.controller?.direction) ?? 1) < 0 ? -1 : 1
    const playbackProgress = playbackDirection < 0 ? 1 - (finiteNumber(progress) ?? 0) : finiteNumber(progress) ?? 0
    const isFinalLogicalFrame = isFinalFrame === true
                                || playbackProgress >= 1 - 0.000001
                                || (finiteNumber(progress) === null
                                    && logicalDurationMillis !== null
                                    && logicalFrameTimeMillis !== null
                                    && logicalFrameTimeMillis >= logicalDurationMillis)

    if (state.cameraMode !== markerSettings.mode) {
        state.cameraMode = markerSettings.mode
        state.cameraFlightActive = false
        state.lastToleranceRecenterAt = null
        state.lastToleranceRecenterProgress = null
        state.lastNavigationRecenterAt = null
        state.lastNavigationRecenterProgress = null
        state.navigationCameraView = null
        state.navigationPredictiveViolationAt = null
        resetCameraTransportState(state)
        resetReplayCameraPitchCorrection(mode)
    }

    const nominalView = replayCameraViewForTrackingSample(mode, {
        sample,
        progress,
        source: source === 'start' ? 'drawer' : source,
        cameraSettings,
        markerSettings,
        logicalCamera: deterministicCamera,
        cache: updateCache,
    })
    if (!nominalView) {
        return
    }

    if (source === 'start' && preserveCurrentFrame) {
        resetCameraTransportState(state)
        resetReplayCameraPitchCorrection(mode)
        state.lastNavigationRecenterAt = null
        state.lastNavigationRecenterProgress = null
        state.navigationPredictiveViolationAt = null
        if (markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION) {
            state.navigationCameraView = nominalView
        }
        call.rememberNominalCameraView(nominalView)
        state.lastNominalCameraHeading = nominalView.heading
        state.lastNominalCameraPitch = nominalView.pitch
        state.lastCameraHeading = nominalView.heading
        state.lastCameraPitch = nominalView.pitch
        if (logicalFrame) {
            logicalFrame.cameraPose = nominalView
            logicalFrame.cameraFrame = call.currentCameraFrame?.(null) ?? null
        }
        return
    }

    if (source === 'scrub') {
        // A seek applies its requested sample immediately. Playback lookahead
        // and unfinished transitions must not move a scrub to a future sample.
        call.cancelCameraBezierTransition(false)
        resetCameraTransportState(state)
        resetReplayCameraPitchCorrection(mode)
        state.lastNavigationRecenterAt = null
        state.lastNavigationRecenterProgress = null
        state.navigationPredictiveViolationAt = null
        state.navigationCameraView = nominalView
        applyResolvedReplayCameraView(mode, {view: nominalView, cameraSettings, logicalFrame})
        return
    }

    if (markerSettings.mode === REPLAY_MARKER_MODE_TRACE) {
        call.cancelCameraBezierTransition(false)
        resetCameraTransportState(state)
        applyResolvedReplayCameraView(mode, {
            view: nominalView,
            cameraSettings,
            logicalFrame,
        })
        return
    }
    call.rememberNominalCameraView(nominalView)
    state.lastNominalCameraHeading = nominalView.heading
    state.lastNominalCameraPitch = nominalView.pitch
    if (logicalFrame) {
        logicalFrame.cameraPose = nominalView
    }

    if (exportMode || globalThis.lgs?.stores?.ui?.video?.exporting === true) {
        call.traceCameraTiming({
            logicalNow,
            exportMode,
            source,
            markerMode: markerSettings.mode,
        })
        call.traceCameraChangeTiming({
            logicalNow,
            exportMode,
            source,
            markerMode:     markerSettings.mode,
            desiredHeading: nominalView.heading,
            desiredPitch:   nominalView.pitch,
        })
    }

    if (source === 'start' && immediateToleranceRecenter) {
        resetCameraTransportState(state)
        resetReplayCameraPitchCorrection(mode)
        if (markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION) {
            state.navigationCameraView = nominalView
        }
        applyResolvedReplayCameraView(mode, {
            view: nominalView,
            cameraSettings,
            logicalFrame,
        })
        return
    }

    const baseTrackingTransitionSeconds = markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION
        ? navigationTransitionTiming.transitionSeconds
        : replayCameraLiveRecenterDuration(cameraSettings.hysteresis.easing)
    const trackingViewport = call.viewportRectForCesiumSurface()
    const targetHeight = call.markerRenderHeightForSample?.(nominalView.sample)
        ?? nominalView.sample.altitude ?? 0
    const cropWidthMeters = replayCameraCropWidthMeters({
        cameraHeight: cameraSettings.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
            ? targetHeight + cameraSettings.altitude
            : cameraSettings.altitude,
        targetHeight,
        pitchRadians: cameraSettings.pitch * Math.PI / 180,
        verticalFovRadians: camera?.frustum?.fovy ?? camera?.frustum?.fov ?? Math.PI / 3,
        aspectRatio: camera?.frustum?.aspectRatio
            ?? (trackingViewport?.canvasWidth ?? trackingViewport?.width ?? 0)
               / Math.max(1, trackingViewport?.canvasHeight ?? trackingViewport?.height ?? 1),
        cropWidthRatio: (trackingViewport?.width ?? 0)
            / Math.max(1, trackingViewport?.canvasWidth ?? trackingViewport?.width ?? 1),
    })
    const adaptiveTrackingTiming = replayAdaptiveTrackingTiming({
        durationSeconds:   logicalDurationMillis === null ? 60 : logicalDurationMillis / 1000,
        elapsedSeconds:    replayDurationSeconds !== null
            ? playbackProgress * replayDurationSeconds
            : logicalFrameTimeMillis === null ? null : logicalFrameTimeMillis / 1000,
        transitionSeconds: baseTrackingTransitionSeconds,
        frameIntervalMs:   logicalFrameIntervalMillis,
        playbackRate,
        cropWidthMeters,
        distanceMeters: state.sampler?.totalDistance,
    })
    const runtimeTracking = replayRuntimeTrackingSettings(
        cameraSettings,
        trackingViewport,
        adaptiveTrackingTiming,
    )
    call.updateToleranceZoneOverlay(cameraSettings.hysteresis, runtimeTracking)
    const frameLeadSeconds = replayCameraFrameLeadSeconds({
        fps: globalThis.lgs?.stores?.replay?.captureFps,
        frameIntervalMs: logicalFrameIntervalMillis,
    })
    const lookaheadSeconds = markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION
        ? adaptiveTrackingTiming.minimumTransitionSeconds
        : (adaptiveTrackingTiming.minimumTransitionSeconds * 1.25) + frameLeadSeconds
    const minimumLookaheadMeters = markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION
        ? REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS
        : CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS
    const futureSample = typeof call.cameraLookaheadSample === 'function'
        ? call.cameraLookaheadSample(nominalView.sample, {
            lookaheadSeconds,
            minimumMeters: minimumLookaheadMeters,
        })
        : null
    const predictedSample = futureSample ?? nominalView.sample

    traceUpdateStep('pitch.visibility.begin')
    const pitchVisibility = replayCameraPitchVisibility(mode, {
        nominalView,
        source,
        cameraSettings,
        markerSettings,
        cache: updateCache,
    })
    const pitchCorrection = resolveReplayCameraPitchCorrection(mode, {
        nominalView,
        logicalNow,
        nominalVisible: pitchVisibility.nominalVisible,
        candidateRedirectState: pitchVisibility.candidateRedirectState,
        obstructionDistanceMeters: pitchVisibility.obstructionDistanceMeters,
        isFinalFrame: isFinalLogicalFrame,
        pitchSensitivity: cameraSettings.pitchCorrectionSensitivity,
    })
    traceUpdateStep('pitch.visibility.end', {
        nominalVisible: pitchVisibility.nominalVisible,
        renderedVisible: pitchVisibility.renderedVisible,
        renderedTraceVisible: pitchVisibility.renderedTraceVisible,
        phase: pitchCorrection.state.phase,
        weight: pitchCorrection.state.weight,
    })
    if (pitchCorrection.ownsCamera && markerSettings.mode !== REPLAY_MARKER_MODE_NAVIGATION) {
        if (deterministicCamera) {
            call.cancelCameraBezierTransition(false)
        }
        resetCameraTransportState(state)
        if (!deterministicCamera && source !== 'playback') {
            applyLiveReplayCameraView(mode, pitchCorrection.view, cameraSettings, {
                force:          true,
                preferRecenter: true,
            })
        }
        else {
            applyResolvedReplayCameraView(mode, {
                view: pitchCorrection.view,
                cameraSettings,
                logicalFrame,
                liveRecenter: !deterministicCamera && playbackUsesLiveCamera,
            })
        }
        return
    }

    if (isFinalLogicalFrame) {
        if (state.deterministicCameraTransition?.finishAtReplayEnd === true) {
            call.applyDeterministicCameraTransition(state.deterministicCameraTransition.endAt)
            return
        }
        call.cancelCameraBezierTransition(false)
        resetCameraTransportState(state)
        if (markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION) {
            state.navigationCameraView = nominalView
        }
        applyResolvedReplayCameraView(mode, {
            view: nominalView,
            cameraSettings,
            logicalFrame,
        })
        return
    }

    const playbackDurationSeconds = finiteNumber(state.controller?.duration)
        ?? (logicalDurationMillis === null ? null : logicalDurationMillis / 1000)
    const finalApproachProgress = playbackDurationSeconds > 0
        ? Math.max(0, 1 - navigationTransitionTiming.transitionSeconds / playbackDurationSeconds)
        : null
    const lastNavigationProgress = finiteNumber(state.lastNavigationRecenterProgress)
    const lastNavigationPlaybackProgress = lastNavigationProgress === null
        ? -1
        : playbackDirection < 0 ? 1 - lastNavigationProgress : lastNavigationProgress
    if (markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION
        && (source === 'playback' || source === 'replay-export')
        && finalApproachProgress !== null
        && playbackProgress >= finalApproachProgress
        && lastNavigationPlaybackProgress < finalApproachProgress) {
        // Reserve one duration-scaled transition for reaching the exact endpoint.
        // Snapping an unfinished correction to the nominal final frame otherwise
        // creates a visible rotation regardless of the correction duration.
        const endProgress = playbackDirection < 0 ? 0 : 1
        const endSample = state.sampler?.atProgress?.(endProgress) ?? nominalView.sample
        const endView = replayCameraViewForTrackingSample(mode, {
            sample: endSample,
            progress: endProgress,
            source,
            cameraSettings,
            markerSettings,
            logicalCamera: deterministicCamera,
            collision: true,
            cache: updateCache,
        }) ?? nominalView
        const endFrame = call.cameraRecenterFrame({...endView, cameraSettings})
        if (endFrame) {
            call.cancelCameraBezierTransition(false)
            call.startDeterministicCameraTransition({
                sample: endView.sample,
                heading: endView.heading,
                pitch: endView.pitch,
                endFrame,
                pathMode: 'direct',
                preserveCameraPath: true,
                interpolateOrientation: true,
                finishAtReplayEnd: true,
                duration: Math.max(0, (1 - playbackProgress) * playbackDurationSeconds),
                logicalNow,
                trackingMode: markerSettings.mode,
                cameraSettings,
                viewport: call.viewportRectForCesiumSurface(),
            })
            state.navigationCameraView = endView
            state.lastNavigationRecenterAt = logicalNow
            state.lastNavigationRecenterProgress = progress
            return
        }
    }

    if (state.deterministicCameraTransition
        && (markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION || !pitchCorrection.ownsCamera)) {
        if (call.applyDeterministicCameraTransition(logicalNow)) {
            state.navigationIdleFollowTarget = null
            return
        }
    }

    if (markerSettings.mode === REPLAY_MARKER_MODE_NAVIGATION) {
        state.navigationCameraView ??= nominalView
        const navigationCameraView = state.navigationCameraView
        const correctedNavigationCameraView = pitchCorrection.weightedRedirectState
            ? call.cameraViewWithRedirectState(
                navigationCameraView,
                pitchCorrection.weightedRedirectState,
            )
            : navigationCameraView
        const viewport = trackingViewport
        const navigationTransitionSeconds = Math.max(
            navigationTransitionTiming.transitionSeconds,
            runtimeTracking.timing?.minimumTransitionSeconds
                ?? navigationTransitionTiming.transitionSeconds,
        )
        const navigationCameraSettings = normalizeJourneyReplayCamera({
            ...cameraSettings,
            hysteresis: {
                ...(cameraSettings.hysteresis ?? {}),
                zone: runtimeTracking.navigation.triggerZone,
            },
        })
        const currentFrame = call.currentCameraFrame?.(null)
        /**
         * Resolve one Navigation collision against the current candidate frame.
         *
         * @param {object} collisionSample - Journey sample to project.
         * @returns {object|null} Collision result.
         */
        const collisionForSample = collisionSample => currentFrame
                                                      && typeof call.cameraCollisionForFrame === 'function'
            ? call.cameraCollisionForFrame({
                frame: currentFrame,
                sample: collisionSample,
                cameraSettings: navigationCameraSettings,
                viewport,
            })
            : call.cameraCollisionForSample?.(collisionSample, navigationCameraSettings, updateCache) ?? null
        const currentCollision = collisionForSample(nominalView.sample)
        const predictedCollision = collisionForSample(predictedSample)
        const confirmationSample = predictedCollision?.hard === true && currentCollision?.hard !== true
            ? call.cameraLookaheadSample?.(predictedSample, {
                lookaheadSeconds: navigationTransitionTiming.confirmationLookaheadSeconds,
                minimumMeters: REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
            }) ?? predictedSample
            : null
        const confirmationCollision = confirmationSample
            ? collisionForSample(confirmationSample)
            : null
        const predictiveCandidate = currentCollision?.hard !== true
                                    && predictedCollision?.hard === true
                                    && confirmationCollision?.hard === true
        if (predictiveCandidate && !forceToleranceRecenter && !immediateToleranceRecenter) {
            state.navigationPredictiveViolationAt ??= logicalNow
        }
        else {
            state.navigationPredictiveViolationAt = null
        }
        const predictiveConfirmed = predictiveCandidate
                                    && finiteNumber(state.navigationPredictiveViolationAt) !== null
                                    && logicalNow - state.navigationPredictiveViolationAt
                                       >= navigationTransitionTiming.confirmationMillis
        const currentViolation = currentCollision?.hard === true
                                 || forceToleranceRecenter
                                 || immediateToleranceRecenter
        const correctionRequired = currentViolation || predictiveConfirmed
        if (!correctionRequired) {
            if (pitchCorrection.ownsCamera) {
                call.cancelCameraBezierTransition(false)
                resetCameraTransportState(state)
                applyResolvedReplayCameraView(mode, {
                    view: correctedNavigationCameraView,
                    cameraSettings,
                    logicalFrame,
                })
                return
            }
            if (deterministicCamera || source === 'playback') {
                const idleFollowActive = (finiteNumber(progress) ?? 0) > 0.02
                                          && Boolean(state.lastAppliedCameraView)
                const hasIdleFollowBaseline = Boolean(state.navigationIdleFollowTarget)
                const followed = idleFollowActive && applyNavigationIdleFollow(mode, {
                    view: nominalView,
                    logicalFrame,
                })
                if (!followed
                    && (deterministicCamera || !state.lastAppliedCameraView)
                    && (!idleFollowActive || !hasIdleFollowBaseline)) {
                    applyResolvedReplayCameraView(mode, {
                        view: navigationCameraView,
                        cameraSettings,
                        logicalFrame,
                    })
                }
            }
            else if (!deterministicCamera && source !== 'playback') {
                state.navigationCameraView = nominalView
                applyLiveReplayCameraView(mode, nominalView, cameraSettings)
            }
            state.lastCameraHeading = state.navigationCameraView?.heading ?? navigationCameraView.heading
            state.lastCameraPitch = state.navigationCameraView?.pitch ?? navigationCameraView.pitch
            return
        }

        state.navigationIdleFollowTarget = null

        const predictiveTarget = call.cameraLookaheadSample?.(nominalView.sample, {
            lookaheadSeconds: navigationTransitionSeconds * REPLAY_NAVIGATION_TARGET_LEAD_RATIO,
            minimumMeters: REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
        }) ?? predictedSample
        // Hard collisions are already visible when reported. Aim the correction
        // at where the route will be after its duration-scaled transition instead
        // of recentering on the sample that will be stale when the flight ends.
        const targetSample = forceToleranceRecenter ? nominalView.sample : predictiveTarget
        const targetNominalView = replayCameraViewForTrackingSample(mode, {
            sample: targetSample,
            progress: targetSample?.progress ?? progress,
            source,
            cameraSettings,
            markerSettings,
            logicalCamera: deterministicCamera,
            collision: true,
            cache: updateCache,
        }) ?? nominalView
        const targetView = pitchCorrection.weightedRedirectState
            ? call.cameraViewWithRedirectState(
                targetNominalView,
                pitchCorrection.weightedRedirectState,
            )
            : targetNominalView
        state.navigationCameraView = targetNominalView

        /**
         * Start a camera correction on the replay clock so video capture and
         * interactive playback use the same eased transition instead of
         * applying a hard collision frame with setView.
         *
         * @returns {boolean} Whether the transition was started.
         */
        const startNavigationTransition = () => {
            const frame = call.cameraRecenterFrame({
                sample:             targetView.sample,
                cameraAnchorSample: targetView.cameraAnchorSample,
                heading:            targetView.heading,
                pitch:              targetView.pitch,
                roll:               targetView.roll,
                cameraSettings,
                cameraHeight:       targetView.cameraHeight,
            })
            if (!frame) {
                return false
            }

            return call.startDeterministicCameraTransition({
                sample: targetView.sample,
                heading: targetView.heading,
                pitch: targetView.pitch,
                endFrame: frame,
                pathMode: 'direct',
                preserveCameraPath: true,
                interpolateOrientation: true,
                duration: navigationTransitionSeconds,
                logicalNow,
                trackingMode: markerSettings.mode,
                cameraSettings,
                viewport,
            })
        }

        const replayClockOwnsCamera = deterministicCamera
                                     || source === 'playback' && !playbackUsesLiveCamera
        if (replayClockOwnsCamera) {
            resetCameraTransportState(state)
            startNavigationTransition()
        }
        else if (currentViolation || source !== 'playback' || pitchCorrection.ownsCamera) {
            resetCameraTransportState(state)
            if (source !== 'playback') {
                applyLiveReplayCameraView(mode, targetView, cameraSettings, {
                    force:          true,
                    preferRecenter: true,
                    allowRecenterWithoutWorldPosition: false,
                })
            }
            else {
                applyResolvedReplayCameraView(mode, {
                    view: targetView,
                    cameraSettings,
                    logicalFrame,
                    liveRecenter: playbackUsesLiveCamera,
                })
            }
        }
        else {
            startNavigationTransition()
        }
        state.lastNavigationRecenterAt = logicalNow
        state.lastNavigationRecenterProgress = finiteNumber(progress)
        return
    }

    if (markerSettings.mode === REPLAY_MARKER_MODE_HYSTERESIS) {
        const viewport = trackingViewport
        const currentScreen = call.trackingWindowPositionForSample(nominalView.sample)
        const hasViewport = (viewport?.width ?? 0) > 0 && (viewport?.height ?? 0) > 0
        const currentInsideTrigger = hasViewport
                                     && !replayIsWindowPointOutsideToleranceZone({
                                         point: currentScreen,
                                         width: viewport.width,
                                         height: viewport.height,
                                         zone: runtimeTracking.dynamic.triggerZone,
                                     })
        const currentInsideTarget = hasViewport
                                    && !replayIsWindowPointOutsideToleranceZone({
                                        point: currentScreen,
                                        width: viewport.width,
                                        height: viewport.height,
                                        zone: runtimeTracking.dynamic.targetZone,
                                    })
        if (!deterministicCamera && source === 'refresh' && state.cameraFlightActive) {
            return
        }
        const useExtendedLookahead = currentInsideTrigger && !currentInsideTarget
        const extendedLookaheadSample = useExtendedLookahead
                                          && (source === 'playback' || exportMode)
            ? call.cameraLookaheadSample?.(nominalView.sample, {
                lookaheadSeconds: lookaheadSeconds * REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR,
                minimumMeters: CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS,
            }) ?? predictedSample
            : predictedSample
        const regularTrackingSample = source === 'playback' || exportMode
            ? useExtendedLookahead
                ? extendedLookaheadSample
                : predictedSample
            : nominalView.sample
        const anticipationScreen = hasViewport
            ? call.trackingWindowPositionForSample(predictedSample)
            : null
        const predictedOutsideTrigger = Boolean(anticipationScreen)
            && replayIsWindowPointOutsideToleranceZone({
                point: anticipationScreen,
                width: viewport.width,
                height: viewport.height,
                zone: runtimeTracking.dynamic.triggerZone,
            })
        const confirmationSample = currentInsideTrigger && predictedOutsideTrigger
            ? call.cameraLookaheadSample?.(predictedSample, {
                lookaheadSeconds: REPLAY_NAVIGATION_PREDICTIVE_CONFIRMATION_LOOKAHEAD_SECONDS,
                minimumMeters: 0,
            }) ?? null
            : null
        const confirmationScreen = confirmationSample
            ? call.trackingWindowPositionForSample(confirmationSample)
            : null
        const confirmationOutsideTrigger = Boolean(confirmationScreen)
            && replayIsWindowPointOutsideToleranceZone({
                point: confirmationScreen,
                width: viewport.width,
                height: viewport.height,
                zone: runtimeTracking.dynamic.triggerZone,
            })
        const anticipatoryCorrection = currentInsideTrigger
                                       && predictedOutsideTrigger
                                       && confirmationOutsideTrigger
        const trackingSample = anticipatoryCorrection && source !== 'playback' && !exportMode
            ? predictedSample
            : regularTrackingSample
        const trackingView = replayCameraViewForTrackingSample(mode, {
            sample: trackingSample,
            progress: trackingSample?.progress ?? progress,
            source,
            cameraSettings,
            markerSettings,
            logicalCamera: deterministicCamera,
            collision: !currentInsideTrigger
                       || anticipatoryCorrection
                       || pitchVisibility.nominalVisible === false,
            cache: updateCache,
        }) ?? nominalView
        const visibilityRedirectView = !pitchVisibility.nominalVisible
            && pitchVisibility.candidateRedirectState
            && typeof call.cameraViewWithRedirectState === 'function'
            ? call.cameraViewWithRedirectState(nominalView, pitchVisibility.candidateRedirectState)
            : null
        const resolvedTrackingView = visibilityRedirectView ?? trackingView
        const liveTrackingCorrection = !currentInsideTrigger
                                      || anticipatoryCorrection
                                      || forceToleranceRecenter
                                      || pitchCorrection.ownsCamera === true
                                      || pitchVisibility.nominalVisible === false
        const predictedScreen = call.trackingWindowPositionForSample(trackingSample)
        state.lastDynamicTargetScreen = replayDynamicTargetPointInZone({
            currentPoint: currentScreen,
            predictedPoint: predictedScreen,
            viewportWidth: viewport?.width,
            viewportHeight: viewport?.height,
            zone: runtimeTracking.dynamic.targetZone,
        })
        if (deterministicCamera || source === 'playback') {
            call.cancelCameraBezierTransition(false)
        }
        resetCameraTransportState(state)
        if (!deterministicCamera && source !== 'playback') {
            applyLiveReplayCameraView(mode, resolvedTrackingView, cameraSettings, {
                force:          !currentInsideTrigger
                                || anticipatoryCorrection
                                || forceToleranceRecenter
                                || pitchCorrection.ownsCamera === true
                                || pitchVisibility.nominalVisible === false,
                preferRecenter: liveTrackingCorrection,
            })
        }
        else {
            applyResolvedReplayCameraView(mode, {
                view: trackingView,
                cameraSettings,
                logicalFrame,
                liveRecenter: !deterministicCamera && playbackUsesLiveCamera,
            })
        }
    }
}

/**
 * Apply tracking and qualify the current marker after every Navigation update,
 * including active transitions and held poses. Anticipation never substitutes
 * its future sample for this final crop check.
 *
 * @param {Object} mode - Replay session mode.
 * @param {Object} [options] - Shared live/export tracking inputs.
 * @returns {void} Nothing.
 */
export const updateCamera = (mode, options = {}) => {
    updateCameraTracking(mode, options)
    if (options.logicalFrame?.poiCameraFreeze === true
        || options.logicalFrame?.phase?.poiCameraFreeze === true) {
        return
    }
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!options.sample || state.cameraUserAdjusting || state.cameraApplyingView
        || state.cameraMode !== REPLAY_MARKER_MODE_NAVIGATION
        || (!options.exportMode && state.replayExportCameraActive)
        || !(options.exportMode || options.source === 'playback' || options.source === 'replay-export')) {
        return
    }
    const camera = replayCameraFor(mode)
    const frame = call.currentCameraFrame?.(null)
    const target = call.markerRenderCartesianForSample?.(options.sample)
    const viewport = call.viewportRectForCesiumSurface?.()
    if (!camera || !frame || !target || !viewport) {
        return
    }
    const corrected = constrainReplayCameraFrameToCrop({
        frame,
        target,
        viewport,
        verticalFovRadians: camera.frustum?.fovy ?? camera.frustum?.fov ?? Math.PI / 3,
        aspectRatio: camera.frustum?.aspectRatio ?? null,
        markerRadius: finiteNumber(globalThis.lgs?.stores?.replay?.markerRadius) ?? 35,
    })
    if (corrected !== frame && call.applyReplayCameraTransitionFrame?.(corrected, target, {preserveOrientation: true})) {
        if (options.logicalFrame) {
            options.logicalFrame.cameraFrame = corrected
        }
    }
}
