/**
 * Shared logical replay camera tracking for Draft and HQ rendering.
 */

import {finiteNumber} from './JourneyReplayRuntime'
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
    REPLAY_NAVIGATION_PREDICTIVE_CONFIRMATION_MILLIS,
    REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR,
} from './JourneyReplayCameraShared'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from './JourneyReplayInternal'
import {resolveJourneyReplayLogicalCameraPose} from './JourneyReplayLogicalCameraPose'
import {createReplayCameraUpdateCache} from './JourneyReplayCameraUpdateCache'
import {
    replayCameraPitchCorrectionSearchLimits,
    resetReplayCameraPitchCorrection,
    resolveReplayCameraPitchCorrection,
} from './JourneyReplayCameraPitchController'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'

const REPLAY_NAVIGATION_PREDICTIVE_TRANSITION_SECONDS = 2
const REPLAY_NAVIGATION_TARGET_LEAD_RATIO = 1

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
 * Draft/HQ timeline while still writing one complete target-locked pose.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} view - Resolved camera view.
 * @param {object} cameraSettings - Active camera settings.
 * @returns {boolean} Whether a live adapter was available.
 */
const applyLiveReplayCameraView = (mode, view, cameraSettings) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!view || typeof call.applyCameraView !== 'function') {
        return false
    }

    const applied = call.applyCameraView({
        anchor: view.sample,
        heading: view.heading,
        pitch: view.pitch,
        roll: view.roll,
        cameraSettings: view.cameraSettings ?? cameraSettings,
    })
    if (!applied) {
        return false
    }
    state.lastCameraHeading = view.heading
    state.lastCameraPitch = view.pitch
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
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!view) {
        return false
    }

    const recenterFrame = call.cameraRecenterFrame({
        sample:         view.sample,
        heading:        view.heading,
        pitch:          view.pitch,
        roll:           view.roll,
        cameraSettings: view.cameraSettings ?? cameraSettings,
        cameraHeight:   view.cameraHeight,
    })
    const frame = standardCameraFrame(recenterFrame)
    if (!frame || !call.applyCameraFrame(frame)) {
        return false
    }

    call.rememberCameraView?.({
        anchor:  view.sample,
        heading: recenterFrame.safeHeading ?? view.heading,
        pitch:   recenterFrame.safePitch ?? view.pitch,
        roll:    recenterFrame.roll ?? view.roll ?? 0,
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
 * Resolve a camera view for one tracking sample with one shared Draft/HQ
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
    const axisHeading = typeof call.headingFromPositionProperty === 'function'
        ? call.headingFromPositionProperty(progress)
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
            useAxisHeadingForSystem: markerSettings?.mode === REPLAY_MARKER_MODE_NAVIGATION,
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
 * Draft and HQ use this same resolver. Only the source of `logicalNow` and the
 * frame scheduling adapter differ between both render modes.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} [options] - Replay camera update options.
 * @returns {void}
 */
export const updateCamera = (mode, {
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
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (logicalFrame) {
        state.lastReplayLogicalFrame = logicalFrame
    }
    if (!sample || (!exportMode && state.replayExportCameraActive)) {
        return
    }

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
    const markerSettings = normalizeJourneyReplayMarker(
        globalThis.lgs?.settings?.ui?.replay?.marker
        ?? globalThis.lgs?.stores?.replay?.marker
        ?? settings.marker,
    )
    if (markerSettings.mode === REPLAY_MARKER_MODE_TRACE) {
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
    if (globalThis.lgs?.viewer) {
        globalThis.lgs.viewer.trackedEntity = undefined
    }

    const cameraSettings = normalizeJourneyReplayCamera(
        globalThis.lgs?.settings?.ui?.replay?.camera
        ?? globalThis.lgs?.stores?.replay?.camera
        ?? settings.camera,
    )
    if (cameraSettings.canFixHiddenMarker === false) {
        resetReplayCameraPitchCorrection(mode)
    }
    const deterministicCamera = exportMode || logicalCamera === true
    if (state.cameraApplyingView) {
        if (!deterministicCamera && source !== 'refresh') {
            return
        }
        call.cancelCameraBezierTransition(false)
    }
    const logicalNow = replayCameraLogicalNow(mode, {
        deterministicCamera,
        logicalFrame,
        frameTimeMs,
        sample,
    })
    const logicalDurationMillis = optionalReplayTimingNumber(logicalFrame?.durationMillis)
                                  ?? (optionalReplayTimingNumber(duration) === null
                                      ? optionalReplayTimingNumber(sample?.journeyDurationMillis)
                                      : optionalReplayTimingNumber(duration) * 1000)
    const logicalFrameTimeMillis = optionalReplayTimingNumber(logicalFrame?.frameTimeMs)
                                   ?? optionalReplayTimingNumber(frameTimeMs)
                                   ?? optionalReplayTimingNumber(sample?.journeyElapsedMillis)
    const logicalFrameIntervalMillis = optionalReplayTimingNumber(logicalFrame?.frameIntervalMs)
                                       ?? optionalReplayTimingNumber(frameIntervalMs)
    const isFinalLogicalFrame = isFinalFrame === true
                                || (finiteNumber(progress) ?? 0) >= 1 - 0.000001
                                || (logicalDurationMillis !== null
                                    && logicalFrameTimeMillis !== null
                                    && logicalFrameTimeMillis >= logicalDurationMillis - Math.max(
                                        1,
                                        logicalFrameIntervalMillis ?? 0,
                                    ))

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
    call.rememberNominalCameraView(nominalView)
    state.lastNominalCameraHeading = nominalView.heading
    state.lastNominalCameraPitch = nominalView.pitch
    if (logicalFrame) {
        logicalFrame.cameraPose = nominalView
    }

    if (exportMode || globalThis.lgs?.stores?.ui?.video?.recording === true) {
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

    call.updateToleranceZoneOverlay(cameraSettings.hysteresis)
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
        ? REPLAY_NAVIGATION_PREDICTIVE_TRANSITION_SECONDS
        : replayCameraRecenterDuration(cameraSettings.hysteresis.easing)
    const adaptiveTrackingTiming = replayAdaptiveTrackingTiming({
        durationSeconds:   logicalDurationMillis === null ? 60 : logicalDurationMillis / 1000,
        elapsedSeconds:    logicalFrameTimeMillis === null ? null : logicalFrameTimeMillis / 1000,
        transitionSeconds: baseTrackingTransitionSeconds,
        frameIntervalMs:   logicalFrameIntervalMillis,
        playbackRate,
    })
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

    if (!deterministicCamera && source === 'refresh' && !immediateToleranceRecenter) {
        call.cancelCameraBezierTransition(false)
        resetCameraTransportState(state)
        applyLiveReplayCameraView(
            mode,
            pitchCorrection.ownsCamera ? pitchCorrection.view : nominalView,
            cameraSettings,
        )
        return
    }

    if (pitchCorrection.ownsCamera && markerSettings.mode !== REPLAY_MARKER_MODE_NAVIGATION) {
        call.cancelCameraBezierTransition(false)
        resetCameraTransportState(state)
        applyResolvedReplayCameraView(mode, {
            view: pitchCorrection.view,
            cameraSettings,
            logicalFrame,
        })
        return
    }

    if (isFinalLogicalFrame) {
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

    if (!pitchCorrection.ownsCamera && state.deterministicCameraTransition) {
        if (call.applyDeterministicCameraTransition(logicalNow)) {
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
        const viewport = call.viewportRectForCesiumSurface()
        const runtimeTracking = replayRuntimeTrackingSettings(
            globalThis.lgs?.settings?.ui?.replay?.camera ?? cameraSettings,
            viewport,
            adaptiveTrackingTiming,
        )
        const navigationTransitionSeconds = runtimeTracking.timing?.minimumTransitionSeconds
                                            ?? REPLAY_NAVIGATION_PREDICTIVE_TRANSITION_SECONDS
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
            ? call.cameraLookaheadSample?.(nominalView.sample, {
                lookaheadSeconds: REPLAY_NAVIGATION_PREDICTIVE_CONFIRMATION_LOOKAHEAD_SECONDS,
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
                                       >= REPLAY_NAVIGATION_PREDICTIVE_CONFIRMATION_MILLIS
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
            if (!deterministicCamera && source !== 'playback') {
                state.navigationCameraView = nominalView
                applyLiveReplayCameraView(mode, nominalView, cameraSettings)
            }
            else if (!state.lastAppliedCameraView) {
                state.navigationCameraView = nominalView
                applyResolvedReplayCameraView(mode, {
                    view: nominalView,
                    cameraSettings,
                    logicalFrame,
                })
            }
            state.lastCameraHeading = nominalView.heading
            state.lastCameraPitch = nominalView.pitch
            return
        }

        const predictiveTarget = call.cameraLookaheadSample?.(nominalView.sample, {
            lookaheadSeconds: navigationTransitionSeconds * REPLAY_NAVIGATION_TARGET_LEAD_RATIO,
            minimumMeters: REPLAY_NAVIGATION_LOOKAHEAD_MINIMUM_METERS,
        }) ?? predictedSample
        const targetSample = currentViolation ? nominalView.sample : predictiveTarget
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
        if (currentViolation || source !== 'playback' || pitchCorrection.ownsCamera) {
            resetCameraTransportState(state)
            applyResolvedReplayCameraView(mode, {
                view: targetView,
                cameraSettings,
                logicalFrame,
            })
        }
        else {
            const frame = call.cameraRecenterFrame({
                sample:         targetView.sample,
                heading:        targetView.heading,
                pitch:          targetView.pitch,
                roll:           targetView.roll,
                cameraSettings,
                cameraHeight:   targetView.cameraHeight,
            })
            if (frame) {
                call.startDeterministicCameraTransition({
                    sample: targetView.sample,
                    heading: targetView.heading,
                    pitch: targetView.pitch,
                    endFrame: frame,
                    duration: navigationTransitionSeconds,
                    logicalNow,
                    trackingMode: markerSettings.mode,
                    cameraSettings,
                    viewport,
                })
            }
        }
        state.lastNavigationRecenterAt = logicalNow
        state.lastNavigationRecenterProgress = finiteNumber(progress)
        return
    }

    if (markerSettings.mode === REPLAY_MARKER_MODE_HYSTERESIS) {
        const viewport = call.viewportRectForCesiumSurface()
        const runtimeTracking = replayRuntimeTrackingSettings(
            globalThis.lgs?.settings?.ui?.replay?.camera ?? cameraSettings,
            viewport,
            adaptiveTrackingTiming,
        )
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
        const useExtendedLookahead = currentInsideTrigger && !currentInsideTarget
        const trackingSample = source === 'playback' || exportMode
            ? useExtendedLookahead
                ? call.cameraLookaheadSample?.(nominalView.sample, {
                    lookaheadSeconds: lookaheadSeconds * REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR,
                    minimumMeters: CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS,
                }) ?? predictedSample
                : predictedSample
            : nominalView.sample
        const trackingView = replayCameraViewForTrackingSample(mode, {
            sample: trackingSample,
            progress: trackingSample?.progress ?? progress,
            source,
            cameraSettings,
            markerSettings,
            logicalCamera: deterministicCamera,
            collision: !currentInsideTrigger,
            cache: updateCache,
        }) ?? nominalView
        const predictedScreen = call.trackingWindowPositionForSample(trackingSample)
        state.lastDynamicTargetScreen = replayDynamicTargetPointInZone({
            currentPoint: currentScreen,
            predictedPoint: predictedScreen,
            viewportWidth: viewport?.width,
            viewportHeight: viewport?.height,
            zone: runtimeTracking.dynamic.targetZone,
        })
        call.cancelCameraBezierTransition(false)
        resetCameraTransportState(state)
        if (!deterministicCamera && source !== 'playback') {
            applyLiveReplayCameraView(mode, trackingView, cameraSettings)
        }
        else {
            applyResolvedReplayCameraView(mode, {
                view: trackingView,
                cameraSettings,
                logicalFrame,
            })
        }
    }
}
