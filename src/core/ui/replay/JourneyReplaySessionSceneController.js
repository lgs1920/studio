/**
 * Scene, camera state and renderer binding for journey replay.
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
import { faCamera }                                                                        from '@fortawesome/pro-solid-svg-icons'
import { faPersonHiking }                                                                  from '@fortawesome/pro-regular-svg-icons'
import {
    JourneyReplayCesiumRenderer,
}                                                                                          from './JourneyReplayCesiumRenderer'
import { REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP, normalizeJourneyReplayClips } from './JourneyReplayClips'
import {
    currentJourneyReplayPoiBehavior, currentJourneyReplaySample, finiteNumber, isJourneyReplayTraceActive,
    isJourneyReplayVideoCaptureActive, publishReplayClipFrameState, replayStore, resetRuntimeProgress, resolveJourneyReplayRuntimeClips,
    updateReplayFrameRenderContract,
} from './JourneyReplayRuntime'
import * as JourneyReplayCameraController from './JourneyReplayCameraController'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import * as JourneyReplayVisibilityController from './JourneyReplayVisibilityController'
import * as JourneyReplayClipController from './JourneyReplayClipController'
import {
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForPositionMode, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
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
    DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS, normalizeJourneyReplayPOISettings,
}                                                                                          from './JourneyReplayPOISettings'
import {
    REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET, REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_POSITION_SYSTEM,
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
    REPLAY_POI_TRIGGER_EPSILON_METERS,
    REPLAY_POI_TRIGGER_SCAN_MARGIN_METERS,
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
} from './JourneyReplaySessionShared'

export const syncCameraFromCesiumControls = (mode, {sample = null, altitudeMode = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        let resolvedSample = sample
            ?? currentJourneyReplaySample(state.controller)
            ?? globalThis.lgs?.stores?.replay?.sample
            ?? state.sampler?.atProgress?.(state.controller.progress ?? 0)

        if (!resolvedSample) {
            const camera = globalThis.lgs?.viewer?.camera
            const position = camera?.positionCartographic
            if (camera && position) {
                resolvedSample = {
                    longitude: CesiumMath.toDegrees(position.longitude),
                    latitude:  CesiumMath.toDegrees(position.latitude),
                    altitude:  position.height,
                }
            }
        }

        const next = call.updateCameraSettingsFromCesiumControls(resolvedSample, {altitudeMode})
        if (!next) {
            return null
        }

        const positionMode = next.positionMode
        state.lastCameraHeading = positionMode === REPLAY_CAMERA_POSITION_SYSTEM
                                  ? finiteNumber(globalThis.lgs?.viewer?.camera?.heading)
                                  : null
        state.lastCameraPitch = degreesToRadians(next.pitch)
        call.syncCameraDrawerFromSettings()
        call.cesiumScene()?.requestRender?.()
        return next
    }

export const handleProfileHover = (mode, {sample, source = 'profile'} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (!sample) {
            return null
        }

        const store = replayStore()
        if (store) {
            store.hoverSample = sample
            store.metricOverlay = {
                visible:   true,
                source,
                anchor:    {
                    longitude: sample.longitude,
                    latitude:  sample.latitude,
                    altitude:  sample.altitude ?? sample.height,
                },
                sample,
                expiresAt: Date.now() + METRIC_OVERLAY_TTL,
            }
        }

        call.scheduleProfileHoverMarker(sample)
        return sample
    }

export const handleProfileLeave = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const store = replayStore()
        if (store) {
            store.hoverSample = null
        }
    }

export const showCameraAnglePreview = (mode, ) => {}

export const hideCameraAnglePreview = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        call.hideCameraAnglePreviewOverlay()
    }

export const stop = (mode, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.clipSequenceToken++
        state.skipNextImmediateStartRecenter = false
        call.stopStopClipPOIMaskLoop()
        call.cancelActiveCameraFlight()
        call.stopCameraLiveSyncLoop()
        state.deferPlaybackCameraRestore = options.emit !== false
        const shouldDeferSceneRestore = options.deferSceneRestore === true || state.sceneRestoreDeferred === true
        const sample = state.controller.stop({
            ...options,
            clearProgress: options.clearProgress ?? true,
        })
        call.setJourneyReplayOrbitAllowed(true)
        call.setContinuousRender(false)
        call.removeToleranceZoneOverlay()
        call.setToleranceZoneOverlayVisible(false)
        call.hideCameraAnglePreviewOverlay()
        if (options.emit === false) {
            call.restorePlaybackCameraSettings()
            state.cameraStateRestoredBeforeSceneCleanup = true
            call.restoreCameraState({clear: false})
        }
        if (shouldDeferSceneRestore) {
            state.sceneRestoreDeferred = true
            resetRuntimeProgress(replayStore())
            return sample
        }

        state.sceneRestorePromise = call.restorePlaybackScene()
        return sample
    }

export const restorePlaybackScene = (mode, {force = false} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (!force && !state.sceneRestoreDeferred) {
            return false
        }

        if (state.sceneRestorePromise) {
            return state.sceneRestorePromise
        }

        state.renderer.clear()
        // `restorePlaybackSceneInternal` owns the state promise and clears it
        // after focus and camera restoration have both completed. Keep that
        // identity intact so its finalizer cannot be skipped by this wrapper.
        return call.restorePlaybackScene().then(() => true)
    }

export const waitForSceneRestore = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
        return state.sceneRestorePromise ?? Promise.resolve()
    }

/**
 * Invalidates a pending scene restoration from a previous replay lifecycle.
 * @param {Object} mode - Replay session instance
 * @returns {boolean} Whether a pending restoration was invalidated
 */
export const cancelPendingSceneRestore = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!state.sceneRestorePromise) {
        return false
    }

    call.cancelActiveCameraFlight()
    state.sceneRestorePromise = null
    state.sceneRestoreDeferred = false
    state.deferPlaybackCameraRestore = false
    state.cameraStateRestoredBeforeSceneCleanup = true
    return true
}

export const dispose = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        call.stop({emit: false})
        state.replayEntryCameraState = null
        if (state.profileHoverTimeout !== null) {
            clearTimeout(state.profileHoverTimeout)
            state.profileHoverTimeout = null
        }
        state.unbind.forEach(unbind => unbind())
        state.unbind = []
    }

/**
 * Reset replay camera runtime state.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} [options] - Reset options.
 * @param {boolean} [options.preserveSavedCameraState=false] - Preserve the entry camera state.
 * @param {boolean} [options.preserveConstrainedPath=true] - Preserve the Draft/HQ shared path.
 * @returns {void}
 */
export const resetCameraController = (mode, {
    preserveSavedCameraState = false,
    preserveConstrainedPath = true,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        call.stopCameraLiveSyncLoop()
        state.cameraGuide = null
        state.cameraGuideSourceKey = null
        state.cameraGuidePositionProperty = null
        state.cameraGuidePositionPropertyKey = null
        state.clipCameraContinuity = null
        if (!preserveConstrainedPath) {
            state.constrainedReplayCameraPath = null
        }
        state.cameraMode = null
        state.cameraFlightActive = false
        call.cancelCameraBezierTransition(false)
        state.lastToleranceRecenterAt = null
        state.lastToleranceRecenterProgress = null
        state.lastNavigationRecenterAt = null
        state.lastNavigationRecenterProgress = null
        state.navigationCameraView = null
        state.navigationPredictiveViolationAt = null
        state.skipNextImmediateStartRecenter = false
        state.lastPlaybackUpdateProgressKey = null
        if (!preserveSavedCameraState) {
            state.savedCameraState = null
            state.replayEntryCameraState = null
            state.playbackStartCameraSettings = null
        }
        state.lastCameraHeading = null
        state.lastCameraPitch = null
        state.lastNominalCameraHeading = null
        state.lastNominalCameraPitch = null
        state.lastAppliedCameraView = null
        state.lastReplayLogicalFrame = null
        state.cameraRedirectState = null
        call.resetReplayCameraPitchCorrection()
        state.cameraUserAdjusting = false
        state.cameraApplyingView = false
        state.terrainHeightLookupBypass = false
        state.terrainHeightLookupTrace = false
        state.cameraPointerActive = false
        state.cameraAutoTrackingIgnoreUntil = 0
        state.journeyToolbarHidden = false
        state.journeyToolbarWasVisible = null
        state.introHeadingTransition = null
        call.removeToleranceZoneOverlay()
        call.hideCameraAnglePreviewOverlay()
        if (state.cameraManualInteractionTimer !== null) {
            clearTimeout(state.cameraManualInteractionTimer)
            state.cameraManualInteractionTimer = null
        }
        if (globalThis.lgs?.viewer) {
            globalThis.lgs.viewer.trackedEntity = undefined
            globalThis.lgs.viewer.camera?.cancelFlight?.()
        }
    }

export const captureCameraState = (mode, {sample = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const camera = globalThis.lgs?.viewer?.camera
        const position = camera?.positionCartographic
        const sampleHeight = finiteNumber(sample?.altitude ?? sample?.height)
        if (!camera && sampleHeight === null) {
            state.savedCameraState = null
            return null
        }

        state.savedCameraState = {
            destination: {
                longitude: finiteNumber(position?.longitude) !== null ? CesiumMath.toDegrees(position.longitude) : finiteNumber(sample?.longitude) ?? 0,
                latitude:  finiteNumber(position?.latitude) !== null ? CesiumMath.toDegrees(position.latitude) : finiteNumber(sample?.latitude) ?? 0,
                height:    finiteNumber(position?.height) ?? sampleHeight ?? 0,
            },
            orientation: {
                heading: finiteNumber(camera?.heading) ?? state.lastCameraHeading ?? 0,
                pitch:   finiteNumber(camera?.pitch) ?? state.lastCameraPitch ?? SAFE_TOP_DOWN_PITCH,
                roll:    finiteNumber(camera?.roll) ?? 0,
            },
            altitude: finiteNumber(position?.height) ?? sampleHeight ?? 0,
        }
        return state.savedCameraState
    }

export const capturePlaybackCameraSettings = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.playbackStartCameraSettings = normalizeJourneyReplayCamera(
            globalThis.lgs?.stores?.replay?.camera
            ?? getJourneyReplaySettings().camera,
        )
        if (globalThis.lgs?.stores?.replay) {
            globalThis.lgs.stores.replay.cameraUserAdjusted = false
        }
    }

export const captureJourneyReplayDrawerStateBeforePlayback = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const drawerManager = globalThis.__?.ui?.drawerManager ?? null
        state.replayDrawerWasOpenBeforePlayback = drawerManager?.isCurrent?.(REPLAY_DRAWER) === true
                                                || globalThis.lgs?.stores?.ui?.drawers?.open === REPLAY_DRAWER
        if (state.replayDrawerWasOpenBeforePlayback) {
            drawerManager?.close?.()
        }
    }

export const markPlaybackCameraUserAdjusted = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (globalThis.lgs?.stores?.replay) {
            globalThis.lgs.stores.replay.cameraUserAdjusted = true
        }
    }

export const restorePlaybackCameraSettings = (mode, {force = false} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const store = replayStore()
        const initialCamera = state.playbackStartCameraSettings
        const cameraUserAdjusted = store?.cameraUserAdjusted === true
        state.playbackStartCameraSettings = null

        if (store) {
            store.cameraUserAdjusted = false
        }

        if (!initialCamera) {
            return null
        }

        if (initialCamera.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET) {
            return call.persistCameraSettings(initialCamera)
        }

        if (force) {
            return call.persistCameraSettings(initialCamera)
        }

        if (!cameraUserAdjusted) {
            return call.persistCameraSettings(initialCamera)
        }

        return null
    }

export const restoreJourneyReplayDrawerAfterPlayback = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (!state.replayDrawerWasOpenBeforePlayback) {
            return
        }

        state.replayDrawerWasOpenBeforePlayback = false
        globalThis.__?.ui?.drawerManager?.open?.(REPLAY_DRAWER)
    }

export const restorePlaybackSceneInternal = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (state.sceneRestorePromise) {
            return state.sceneRestorePromise
        }

        // Clear the replay renderer before focus and visibility restoration so
        // normal completion and premature aborts cannot leave replay graphics visible.
        state.renderer.clear()
        state.sceneRestoreDeferred = false
        call.removeToleranceZoneOverlay()
        call.restoreOtherJourneysVisibility()
        call.restoreCurrentJourneyVisibility({restorePOIs: false})
        call.setJourneyReplayOrbitAllowed(true)
        state.deferStartCameraRecenter = false
        call.setToleranceZoneOverlayVisible(false)
        call.restoreJourneyToolbarVisibility()
        call.restoreJourneyReplayDrawerAfterPlayback()
        call.restoreMainUI()
        void call.restoreNearbyPOIsAfterPlayback()
        resetRuntimeProgress(replayStore())
        // Keep the captured POI visibility state until the focus operation has
        // completed. `journey.focus()` can make every entity visible again.
        call.restoreCurrentJourneyVisibility({restorePOIs: false})
        call.resetCameraController({preserveSavedCameraState: true})
        state.suppressPlaybackCameraSync = true
        const restoreClipSequenceToken = state.clipSequenceToken
        let restorePromise
        restorePromise = call.focusJourneyAfterPlayback({
            snapDistance: 50000,
        }).finally(() => {
            if (state.sceneRestorePromise !== restorePromise) {
                // A cancelled restoration may finish its Cesium focus flight later.
                // Reapply the current replay pose so stale focus cannot move the active replay.
                const replayActive = state.controller?.running === true
                                   || state.controller?.playing === true
                                   || state.controller?.paused === true
                const sample = replayActive
                             ? currentJourneyReplaySample(state.controller)
                             : null
                if (restoreClipSequenceToken !== state.clipSequenceToken
                    && replayActive
                    && sample
                    && typeof call.updateCamera === 'function') {
                    call.updateCamera({
                        sample,
                        progress:      finiteNumber(state.controller?.progress ?? sample.progress) ?? 0,
                        source:        'playback',
                        logicalCamera: state.logicalCameraTrajectory === true,
                        exportMode:    state.replayExportCameraActive === true,
                    })
                }
                return
            }
            state.deferPlaybackCameraRestore = false
            // Focus can rewrite journey and POI visibility. Reapply the
            // visibility captured before replay after focus has settled.
            call.restoreCurrentJourneyVisibility()
            // Restoring the journey focus above changes the live Cesium view.
            // Reapply the exact camera captured before Draft/HQ playback so a
            // subsequent export does not inherit the focus angle.
            if (!state.cameraStateRestoredBeforeSceneCleanup) {
                call.restoreCameraState()
            }
            else {
                state.savedCameraState = null
            }
            state.cameraStateRestoredBeforeSceneCleanup = false
            call.restorePlaybackCameraSettings({force: true})
            state.replayEntryCameraState = null
            state.sceneRestorePromise = null
        })
        state.sceneRestorePromise = restorePromise
        return restorePromise
    }

/**
 * Apply a captured replay camera state without replacing the saved pre-replay focus.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} [options] - Camera restore options.
 * @param {boolean} [options.clear=true] - Clear the saved pre-replay state after use.
 * @param {object|null} [options.cameraState=null] - Explicit camera state to apply.
 * @returns {boolean} Whether a camera state was applied.
 */
export const restoreCameraState = (mode, {clear = true, cameraState = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const camera = globalThis.lgs?.viewer?.camera
        const savedCameraState = cameraState ?? state.savedCameraState
        if (clear && cameraState === null) {
            state.savedCameraState = null
        }
        if (!camera || !savedCameraState) {
            return false
        }

        camera.cancelFlight?.()
        CameraUtils.unlock(camera)
        camera.setView?.({
            destination: Cartesian3.fromDegrees(
                savedCameraState.destination.longitude,
                savedCameraState.destination.latitude,
                finiteNumber(savedCameraState.destination.height) ?? finiteNumber(savedCameraState.altitude) ?? 0,
            ),
            orientation: savedCameraState.orientation,
        })
        return true
    }

export const setContinuousRender = (mode, enabled) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const scene = call.cesiumScene()
        if (!scene) {
            return
        }

        if (enabled) {
            if (state.requestRenderMode === null) {
                state.requestRenderMode = scene.requestRenderMode
            }
            scene.requestRenderMode = false
            scene.requestRender?.()
            return
        }

        if (state.requestRenderMode !== null) {
            scene.requestRenderMode = state.requestRenderMode
            state.requestRenderMode = null
        }
        scene.requestRender?.()
    }

export const abortPlaybackAfterListenerError = (mode, error) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.clipSequenceToken++
        call.stopStopClipPOIMaskLoop()
        call.cancelActiveCameraFlight()
        state.controller.stop({emit: false, clearProgress: false})
        call.setContinuousRender(false)
        state.renderer.clear()
        state.sceneRestoreDeferred = false
        state.sceneRestorePromise = null
        state.deferPlaybackCameraRestore = false
        state.cameraStateRestoredBeforeSceneCleanup = false
        state.replayExportCameraActive = false
        state.renderingReplayExportFrame = false
        state.logicalCameraTrajectory = false
        state.videoReplayClipLogicalTrajectory = false
        return call.restorePlaybackScene()
    }

export const scheduleProfileHoverMarker = (mode, sample) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.pendingProfileHoverSample = sample
        const now = performance.now()
        const elapsed = now - state.lastProfileHoverRender

        if (elapsed >= PROFILE_HOVER_RENDER_INTERVAL) {
            call.renderProfileHoverMarker()
            return
        }

        if (state.profileHoverTimeout === null) {
            state.profileHoverTimeout = setTimeout(
                call.renderProfileHoverMarker,
                PROFILE_HOVER_RENDER_INTERVAL - elapsed,
            )
        }
    }

export const renderProfileHoverMarker = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.profileHoverTimeout = null
        state.lastProfileHoverRender = performance.now()

        const sample = state.pendingProfileHoverSample
        state.pendingProfileHoverSample = null
        if (!sample) {
            return
        }

        globalThis.__?.ui?.profiler?.showSampleOnMap?.(sample)
    }

    /**
     * Hide the Journey Toolbar while a replay is running, and remember its previous visibility
     * so it can be restored when the replay ends.
     */
export const hideJourneyToolbarVisibility = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const toolbar = globalThis.lgs?.settings?.ui?.journeyToolbar
        if (toolbar && state.journeyToolbarWasVisible === null) {
            state.journeyToolbarWasVisible = toolbar.show === true
        }

        state.journeyToolbarHidden = true
        globalThis.window?.dispatchEvent?.(new CustomEvent(REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT, {
            detail: {hidden: true},
        }))
    }

    /**
     * Restore the Journey Toolbar visibility to its pre-replay state.
     */
export const restoreJourneyToolbarVisibilityInternal = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.journeyToolbarHidden = false
        state.journeyToolbarWasVisible = null
        globalThis.window?.dispatchEvent?.(new CustomEvent(REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT, {
            detail: {hidden: false},
        }))
    }

export const hideMainUI = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const store = replayStore()
        if (store) {
            store.mainUiHidden = true
        }
    }

export const restoreMainUI = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const store = replayStore()
        if (store) {
            store.mainUiHidden = false
        }
    }

export const restoreJourneyToolbarVisibility = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        call.restoreJourneyToolbarVisibility()
    }

export const isJourneyToolbarTemporarilyHidden = mode => mode[JOURNEY_REPLAY_INTERNAL_STATE].journeyToolbarHidden === true

export const bindRenderer = (mode, ) => {
        const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
        const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        state.unbind.push(
            state.controller.on(REPLAY_EVENT_START, detail => {
                const startListenerStartedAt = globalThis.performance?.now?.() ?? Date.now()
                let listenerError = null
                replayVideoTraceDebug('draft.replay.start.listener.begin', {
                    progress: detail?.progress ?? null,
                    hasSampler: Boolean(detail?.sampler),
                })
                try {
                    const traceStep = (step, extra = {}) => {
                        replayVideoTraceDebug('draft.replay.start.listener.step', {
                            step,
                            elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startListenerStartedAt,
                            progress: detail?.progress ?? null,
                            hasSampler: Boolean(detail?.sampler),
                            ...extra,
                        })
                    }
                    state.lastPlaybackUpdateProgressKey = null
                    traceStep('set-tolerance-zone-visible.begin')
                    call.setToleranceZoneOverlayVisible(true)
                    const replaySettings = getJourneyReplaySettings()
                    const startCameraSettings = normalizeJourneyReplayCamera(
                        globalThis.lgs?.stores?.replay?.camera
                        ?? globalThis.lgs?.settings?.ui?.replay?.camera
                        ?? replaySettings.camera,
                    )
                    call.updateToleranceZoneOverlay(startCameraSettings.hysteresis)
                    traceStep('set-tolerance-zone-visible.end')
                    traceStep('hide-journey-toolbar.begin')
                    call.hideJourneyToolbarVisibility()
                    traceStep('hide-journey-toolbar.end')
                    traceStep('set-continuous-render.begin')
                    call.setContinuousRender(true)
                    traceStep('set-continuous-render.end')
                    traceStep('renderer.show.begin')
                    state.renderer.show({
                        sampler: detail.sampler,
                        options: {smoothedGuide: call.smoothedGuide()},
                    })
                    traceStep('renderer.show.end')
                    const startSample = detail.sample
                                        ?? detail.sampler?.atProgress?.(detail.progress ?? 0)
                                        ?? currentJourneyReplaySample(state.controller)

                    traceStep('renderer.update.begin')
                    state.renderer.update({
                        ...detail,
                        forceGeometry: true,
                        hideTrace: true,
                        showTrace: isJourneyReplayTraceActive(),
                    })
                    traceStep('renderer.update.end')
                    traceStep('sync-nearby-pois.begin')
                    void call.syncNearbyPOIsForSample(startSample ?? detail.sample ?? null)
                    traceStep('sync-nearby-pois.end')
                    if (!state.deferStartCameraRecenter) {
                        if (state.skipNextImmediateStartRecenter) {
                            state.skipNextImmediateStartRecenter = false
                            const replaySettings = getJourneyReplaySettings()
                            const startCameraSettings = normalizeJourneyReplayCamera(
                                globalThis.lgs?.stores?.replay?.camera ?? replaySettings.camera,
                            )
                            traceStep('update-tolerance-zone-overlay.begin')
                            call.updateToleranceZoneOverlay(startCameraSettings.hysteresis)
                            traceStep('update-tolerance-zone-overlay.end')
                        }
                        else {
                            traceStep('update-camera.begin')
                            call.updateCamera({
                                                   ...detail,
                                                   source:                    'start',
                                                   forceToleranceRecenter:     true,
                                                   immediateToleranceRecenter: true,
                                                   logicalCamera:             isJourneyReplayVideoCaptureActive(),
                                               })
                            updateReplayFrameRenderContract({
                                logicalFrame: detail?.logicalFrame,
                            })
                            traceStep('update-camera.end')
                        }
                        const startProgress = finiteNumber(detail?.progress ?? startSample?.progress)
                        state.lastPlaybackUpdateProgressKey = Math.round((startProgress ?? 0) / CAMERA_UPDATE_MIN_PROGRESS_DELTA)
                    }
                }
                catch (error) {
                    listenerError = error
                    call.abortPlaybackAfterListenerError(error)
                }
                finally {
                    replayVideoTraceDebug('draft.replay.start.listener.end', {
                        elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startListenerStartedAt,
                        progress: detail?.progress ?? null,
                        hasSampler: Boolean(detail?.sampler),
                        errored: listenerError !== null,
                    })
                }
            }),
            state.controller.on(REPLAY_EVENT_UPDATE, detail => {
                const updateListenerStartedAt = globalThis.performance?.now?.() ?? Date.now()
                try {
                    const traceUpdateStep = (step, extra = {}) => {
                        replayVideoTraceDebug('draft.replay.update.listener.step', {
                            step,
                            elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - updateListenerStartedAt,
                            progress: detail?.progress ?? null,
                            hasSampler: Boolean(detail?.sampler),
                            ...extra,
                        })
                    }
                    // `seek()` is also used to publish each deterministic HQ
                    // frame. The export renderer applies that frame below;
                    // running the live listener here would update the camera a
                    // second time with a different clock and create jitter.
                    if (state.renderingReplayExportFrame) {
                        return
                    }
                    const videoCaptureActive = isJourneyReplayVideoCaptureActive()
                    const playbackProgress = finiteNumber(detail?.progress ?? detail?.sample?.progress)
                    const playbackProgressKey = Math.round((playbackProgress ?? 0) / CAMERA_UPDATE_MIN_PROGRESS_DELTA)
                    traceUpdateStep('renderer.update.begin', {
                        videoCaptureActive,
                        playbackProgress,
                        playbackProgressKey,
                    })
                    state.renderer.update({
                        ...detail,
                        sampler: state.sampler,
                        showTrace: isJourneyReplayTraceActive(),
                    })
                    traceUpdateStep('renderer.update.end')
                    traceUpdateStep('sync-nearby-pois.begin')
                    void call.syncNearbyPOIsForSample(detail.sample ?? null)
                    traceUpdateStep('sync-nearby-pois.end')
                    if (!videoCaptureActive && state.lastPlaybackUpdateProgressKey === playbackProgressKey) {
                        traceUpdateStep('update-camera.skip', {
                            reason: 'duplicate-progress-key',
                            playbackProgressKey,
                        })
                        return
                    }

                    state.lastPlaybackUpdateProgressKey = playbackProgressKey
                    traceUpdateStep('update-camera.begin', {
                        playbackProgressKey,
                    })
                    call.updateCamera({
                        ...detail,
                        source:        'playback',
                        logicalCamera: videoCaptureActive,
                    })
                    updateReplayFrameRenderContract({
                        logicalFrame: detail?.logicalFrame,
                    })
                    traceUpdateStep('update-camera.end')
                }
                catch (error) {
                    call.abortPlaybackAfterListenerError(error)
                }
                finally {
                    replayVideoTraceDebug('draft.replay.update.listener.end', {
                        elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - updateListenerStartedAt,
                        progress: detail?.progress ?? null,
                        hasSampler: Boolean(detail?.sampler),
                    })
                }
            }),
            state.controller.on(REPLAY_EVENT_PAUSE, detail => {
                state.lastPlaybackUpdateProgressKey = null
                call.setContinuousRender(false)
                try {
                    state.renderer.update({...detail, freezeDynamic: true, showTrace: isJourneyReplayTraceActive()})
                }
                catch (error) {
                    call.abortPlaybackAfterListenerError(error)
                }
            }),
            state.controller.on(REPLAY_EVENT_RESUME, detail => {
                try {
                    state.lastPlaybackUpdateProgressKey = null
                    call.setContinuousRender(true)
                    state.renderer.update({...detail, forceGeometry: true, showTrace: isJourneyReplayTraceActive()})
                    call.updateCamera({
                        ...detail,
                        logicalCamera: isJourneyReplayVideoCaptureActive(),
                    })
                    updateReplayFrameRenderContract({
                        logicalFrame: detail?.logicalFrame,
                    })
                }
                catch (error) {
                    call.abortPlaybackAfterListenerError(error)
                }
            }),
            state.controller.on(REPLAY_EVENT_STOP, () => {
                state.lastPlaybackUpdateProgressKey = null
                state.clipSequenceToken++
                call.stopStopClipPOIMaskLoop()
                call.setContinuousRender(false)
                state.renderer.clear()
                call.restoreOtherJourneysVisibility()
                call.restoreCurrentJourneyVisibility({restorePOIs: false})
                call.setJourneyReplayOrbitAllowed(true)
                state.deferStartCameraRecenter = false
                call.restoreJourneyToolbarVisibility()
                call.restoreJourneyReplayDrawerAfterPlayback()
                call.restoreMainUI()
                state.videoReplayClipLogicalTrajectory = false
                void call.restoreNearbyPOIsAfterPlayback().finally(() => {
                    call.restoreCurrentJourneyVisibility()
                })
                if (!state.deferPlaybackCameraRestore) {
                    call.restorePlaybackCameraSettings({force: true})
                }
                resetRuntimeProgress(replayStore())
                call.restoreCurrentJourneyVisibility()
            }),
            state.controller.on(REPLAY_EVENT_END, detail => {
                state.lastPlaybackUpdateProgressKey = null
                state.skipNextImmediateStartRecenter = false
                const token = state.clipSequenceToken
                const sample = detail.sampler?.atProgress?.(1)
                              ?? detail.sample
                              ?? currentJourneyReplaySample(state.controller)
                state.clipCameraContinuity = call.currentReplayClipCameraState({
                    sample,
                })
                const stopList = call.clipListForSlot(REPLAY_CLIP_SLOT_STOP)
                if (stopList.length > 0) {
                    const videoTimeline = state.controller.videoTimeline
                    const stopPhaseTime = videoTimeline?.replayPhase?.endMillis
                                               ?? (state.controller.duration * 1000)
                    const stopPhase = state.controller.videoFramePhaseAtTime?.(stopPhaseTime)
                    publishReplayClipFrameState({
                        store: replayStore(),
                        slot: REPLAY_CLIP_SLOT_STOP,
                        sample,
                        progress: 1,
                        phase: stopPhase,
                        frameIndex: stopPhase?.frameIndex,
                        frameCount: videoTimeline?.frameCount,
                        frameTimeMs: stopPhase?.frameTimeMs,
                        frameIntervalMs: videoTimeline?.frameIntervalMs,
                        durationMillis: videoTimeline?.durationMillis,
                    })
                }
                const notifyStopClipsComplete = () => {
                    globalThis.window?.dispatchEvent?.(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE, {
                        detail: {
                            sample,
                            progress: detail.progress ?? null,
                            clipSequenceToken: token,
                        },
                    }))
                }
                const notifyStopClipsCompleteAfterFinalWidgetFrame = (afterFrame = null) => {
                    const recorder = globalThis.__?.recorder ?? null
                    const recordingSync = replayStore()?.recordingSync === true || recorder?.isRecording?.() === true
                    if (recordingSync) {
                        if (token === state.clipSequenceToken) {
                            // The draft recorder captures the final Cesium frame
                            // asynchronously from this notification. Keep the
                            // completed trace rendered while that capture runs.
                            notifyStopClipsComplete()
                            if (typeof afterFrame === 'function') {
                                afterFrame()
                            }
                        }
                        return
                    }

                    // Without an active recorder there is no media frame to
                    // protect with animation-frame delays. Finish immediately
                    // so replay cleanup and journey restoration are observable
                    // on the same exit path as Draft and HQ.
                    if (token === state.clipSequenceToken) {
                        notifyStopClipsComplete()
                        if (typeof afterFrame === 'function') {
                            afterFrame()
                        }
                    }
                    return
                }
                const finalize = () => {
                    if (token !== state.clipSequenceToken) {
                        return
                    }

                    call.stopStopClipPOIMaskLoop()
                    call.removeToleranceZoneOverlay()
                    call.setToleranceZoneOverlayVisible(false)
                    call.setContinuousRender(false)
                    const recorder = globalThis.__?.recorder ?? null
                    if (replayStore()?.recordingSync === true || recorder?.isRecording?.() === true) {
                        // The recorder still needs the Cesium source canvas for
                        // its asynchronous final-frame capture. Do not clear
                        // the replay trace while recording is still active.
                        state.sceneRestoreDeferred = true
                        return
                    }

                    call.setJourneyReplayOrbitAllowed(true)
                    resetRuntimeProgress(replayStore())
                    state.sceneRestorePromise = call.restorePlaybackScene()
                }

                try {
                    state.renderer.update({
                        ...detail,
                        sampler:               state.sampler,
                        forceGeometry:         true,
                        freezeDynamic:         true,
                        hideCursor:            true,
                        hideRemainingTrace:    true,
                        staticCompletedTrace:  true,
                        showTrace:              isJourneyReplayTraceActive(),
                    })
                    call.startStopClipPOIMaskLoop()

                    const closeOpenedPOIs = call.closeJourneyReplayOpenedPOIsBeforeStopClips()
                    if (!closeOpenedPOIs && stopList.length === 0) {
                        notifyStopClipsCompleteAfterFinalWidgetFrame(finalize)
                        return
                    }

                    void (async () => {
                        try {
                            await closeOpenedPOIs
                            if (token !== state.clipSequenceToken) {
                                return
                            }

                            if (stopList.length === 0) {
                                notifyStopClipsCompleteAfterFinalWidgetFrame(finalize)
                                return
                            }

                            await call.playJourneyReplayClips(REPLAY_CLIP_SLOT_STOP, {
                                sample,
                                token,
                                startCamera: state.clipCameraContinuity,
                                onFrame: ({phase, localMillis, sample: clipSample}) => {
                                    const videoTimeline = state.controller.videoTimeline
                                    const phaseTime = (phase?.startMillis ?? 0) + (Number(localMillis) || 0)
                                    const resolvedPhase = state.controller.videoFramePhaseAtTime?.(phaseTime) ?? phase
                                    publishReplayClipFrameState({
                                        store: replayStore(),
                                        slot: REPLAY_CLIP_SLOT_STOP,
                                        sample: clipSample ?? sample,
                                        progress: resolvedPhase?.progress ?? 1,
                                        phase: resolvedPhase,
                                        frameIndex: resolvedPhase?.frameIndex,
                                        frameCount: videoTimeline?.frameCount,
                                        frameTimeMs: resolvedPhase?.frameTimeMs,
                                        frameIntervalMs: videoTimeline?.frameIntervalMs,
                                        durationMillis: videoTimeline?.durationMillis,
                                    })
                                },
                            })
                            const videoTimeline = state.controller.videoTimeline
                            const finalStopPhase = state.controller.videoFramePhaseAtTime?.(
                                videoTimeline?.durationMillis ?? 0,
                                {isFinalSceneFrame: true},
                            )
                            publishReplayClipFrameState({
                                store: replayStore(),
                                slot: REPLAY_CLIP_SLOT_STOP,
                                sample,
                                progress: 1,
                                phase: finalStopPhase,
                                frameIndex: finalStopPhase?.frameIndex,
                                frameCount: videoTimeline?.frameCount,
                                frameTimeMs: finalStopPhase?.frameTimeMs,
                                frameIntervalMs: videoTimeline?.frameIntervalMs,
                                durationMillis: videoTimeline?.durationMillis,
                            })
                            notifyStopClipsComplete()
                            finalize()
                        }
                        catch (error) {
                            call.abortPlaybackAfterListenerError(error)
                        }
                    })()
                }
                catch (error) {
                    call.abortPlaybackAfterListenerError(error)
                }
            }),
        )
    }
