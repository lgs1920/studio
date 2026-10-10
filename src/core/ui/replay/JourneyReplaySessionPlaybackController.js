/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplaySessionPlaybackController.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-22
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {captureReplayEntryCameraState, replayOwnedCameraFor} from './ReplayCameraOwnership'
import {replayCameraFor} from './ReplayRenderTarget'


/**
 * Playback lifecycle for journey replay.
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
import {currentReplayJourney, isJourneyReplayBasicMode}                                    from './ReplayUserModeConstants'
import {
    ArcType, Cartesian2, Cartesian3, Cartographic, CatmullRomSpline, Color, ExtrapolationType, JulianDate,
    EasingFunction, HeightReference, HorizontalOrigin, LinearApproximation, Math as CesiumMath, Matrix4,
    PolylineDashMaterialProperty, SampledPositionProperty, SceneTransforms, Transforms, VerticalOrigin,
}                                                                                          from 'cesium'
import {
    JourneyReplayCesiumRenderer,
}                                                                                          from './JourneyReplayCesiumRenderer'
import { REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP, normalizeJourneyReplayClips } from './JourneyReplayClips'
import {
    currentJourneyReplayCameraSettings, currentJourneyReplayPoiBehavior, currentJourneyReplaySample, finiteNumber,
    isJourneyReplayTraceActive, publishReplayClipFrameState, replayStore, resetRuntimeProgress,
    resolveJourneyReplayRuntimeClips,
} from './JourneyReplayRuntime'
import {createJourneyReplayLogicalFrame} from './JourneyReplayLogicalFrame'
import {replaySceneFrameQualifierFor} from './ReplaySceneFrameQualifier'
import {
    beginReplaySessionOwnership,
    releaseReplaySessionOwnership,
} from './ReplaySessionOwnership'
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
    DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS, normalizeJourneyReplayPOISettings,
}                                                                                          from './JourneyReplayPOISettings'
import {
    REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION,
    REPLAY_MARKER_MODE_TRACE, getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker,
    normalizeJourneyReplayProgressionStyle, normalizeJourneyReplayReadiness, normalizeJourneyReplaySmoothing, normalizeJourneyReplayTrace,
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
    REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT,
    REPLAY_EVENT_STOP_CLIPS_COMPLETE,
    CAMERA_REDIRECT_CANDIDATES,
    isUsableCartesian3,
    safeCartesian3Normalize,
    safeCartesian3Lerp,
} from './JourneyReplaySessionShared'

/**
 * Ensure Replay diagnostics are visible before playback or export starts.
 * Simple diagnostics do not require recording synchronization to be enabled.
 *
 * @param {object} mode - Replay mode.
 * @returns {boolean} Whether Replay diagnostics were enabled.
 */
const ensureReplayVideoDiagnosticsOverlay = mode => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!call.isReplayVideoLinked() && !isJourneyReplayBasicMode()) {
        return false
    }

    const replayCameraSettings = currentJourneyReplayCameraSettings()
    if (replayCameraSettings.debug !== true) {
        call.removeToleranceZoneOverlay()
        call.setToleranceZoneOverlayVisible(false)
        return false
    }
    call.setToleranceZoneOverlayVisible(true)
    call.updateToleranceZoneOverlay(replayCameraSettings.hysteresis)
    return true
}

export const configure = (mode, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const store = replayStore()
        const journey = options.journey ?? currentReplayJourney()

        if (!journey) {
            return null
        }

        const replay = getJourneyReplaySettings({journey})
        const simpleReplay = isJourneyReplayBasicMode()
        const includeHiddenTracks = simpleReplay
            ? false
            : options.includeHiddenTracks ?? false
        const scope = REPLAY_SCOPE_ALL_TRACKS
        const trackSlug = options.trackSlug ?? globalThis.lgs?.theTrack?.slug ?? store?.trackSlug
        const progression = options.progression ?? replay.progression
        const profileInfo = options.profileInfo ?? replay.profileInfo
        const trace = options.trace ?? replay.trace
        const smoothing = normalizeJourneyReplaySmoothing(options.smoothing ?? replay.smoothing)
        const marker = options.marker ?? replay.marker
        const camera = simpleReplay
            ? store?.simplePreparationActive === true
                ? currentJourneyReplayCameraSettings({journey})
                : replay.camera
            : options.camera ?? replay.camera
        const readiness = normalizeJourneyReplayReadiness(simpleReplay
            ? {...replay.readiness, enabled: false, prewarmEnabled: false}
            : options.readiness ?? replay.readiness)
        const samplerConfigKey = call.samplerConfigurationKey({
            journey,
            scope,
            trackSlug,
            includeHiddenTracks,
            smoothing,
        })
        const resolvedClips = resolveJourneyReplayRuntimeClips({
            clips:         options.clips,
            settingsClips: replay.clips,
            journey,
        })
        const clips = simpleReplay
            ? {...resolvedClips, start: [], stop: []}
            : resolvedClips

        if (state.samplerConfigKey !== samplerConfigKey || !state.sampler) {
            state.sampler = new JourneyReplayPathSampler({
                journey,
                scope,
                trackSlug,
                includeHiddenTracks,
                renderSmoothing: smoothing,
            })
            state.samplerConfigKey = samplerConfigKey
            state.replayPreparationSample = null
            call.resetCameraController({preserveConstrainedPath: false})
        }

        if (store) {
            store.journeySlug = journey.slug
            store.trackSlug = trackSlug ?? null
            store.scope = scope
            store.totalDistance = state.sampler.totalDistance
            store.progression = progression
            store.profileInfo = profileInfo
            store.trace = normalizeJourneyReplayTrace(trace)
            store.smoothing = smoothing
            store.marker = normalizeJourneyReplayMarker(marker)
            store.camera = normalizeJourneyReplayCamera(camera)
            store.readiness = readiness
            store.clips = clips
        }

        state.controller.configure({
            sampler:    state.sampler,
            duration:   options.duration ?? replay.duration ?? store?.duration ?? DEFAULT_DURATION,
            direction:  1,
            loop:       options.loop ?? replay.loop ?? store?.loop ?? false,
            progress:   options.progress ?? store?.progress ?? 0,
            clips,
            captureFps: options.captureFps ?? store?.captureFps ?? 30,
        })

        call.bindCesiumCameraBridge()

        return state.sampler
    }

/**
 * Prepare the interactive camera for synchronized Replay recording.
 *
 * @param {object} mode - Replay mode.
 * @param {object} options - Preparation options.
 * @returns {Promise<boolean>} Whether the replay anchor was prepared.
 */
export const prepareReplayCamera = async (mode, {
                                               journey = currentReplayJourney(),
                                           } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!journey) {
        return false
    }
    // Flush a pending wheel/drag edit before capturing the preparation settings.
    call.updateCameraFromCesiumControls?.()
    const store = replayStore()
    const simplePreparation = isJourneyReplayBasicMode()
        && (store?.simplePreparationActive === true
            || globalThis.lgs?.stores?.ui?.video?.editing === true)
    // configure() rebuilds the sampler and also hydrates runtime settings. Keep
    // the camera that the user just prepared across that hydration boundary.
    const preparedSimpleCamera = simplePreparation && store?.camera
        ? normalizeJourneyReplayCamera(store.camera)
        : null
    const sampler = call.configure({journey, progress: 0})
    const sample = sampler?.atProgress?.(0) ?? null
    if (!sample) {
        return false
    }
    state.replayPreparationSample = sample

    const replaySettings = getJourneyReplaySettings({journey})
    const cameraSettings = preparedSimpleCamera ?? currentJourneyReplayCameraSettings({journey})
    if (preparedSimpleCamera && store) {
        store.camera = cameraSettings
    }
    if (isJourneyReplayBasicMode()) {
        const cameraSummary = camera => camera
            ? `H${camera.altitude}/P${camera.pitch}/A${camera.cameraAngle}/mode=${camera.altitudeMode}`
            : 'none'
        console.info(`[Replay camera] record preparation | basic=${isJourneyReplayBasicMode()} prep=${store?.simplePreparationActive === true} editing=${globalThis.lgs?.stores?.ui?.video?.editing === true} runtime=${cameraSummary(store?.camera)} user=${cameraSummary(globalThis.lgs?.settings?.ui?.replay?.simple?.camera)} journey=${cameraSummary(journey?.replay?.simple?.camera)} selected=${cameraSummary(cameraSettings)}`)
    }
    const markerSettings = normalizeJourneyReplayMarker(
        globalThis.lgs?.stores?.replay?.marker ?? replaySettings.marker,
    )
    const view = call.cameraViewForSample({
        sample,
        progress: 0,
        source: 'drawer',
        cameraSettings,
        markerSettings,
        previousHeading: null,
        previousPitch:   null,
    })
    if (!view) {
        return false
    }

    // A new preparation supersedes the settings baseline captured by an earlier
    // preview. Keep its normal-camera return snapshot, but never persist its old
    // Replay settings when recording cleanup restores that preview's scene.
    state.playbackStartCameraSettings = null
    // Commit the validated Simple preparation before capture changes UI phases.
    // Later configuration reads must resolve the same values after its runtime
    // preparation flag is released, rather than an older journey baseline.
    if (isJourneyReplayBasicMode()) {
        call.persistCameraSettings(cameraSettings)
    }
    // Preparation owns configuration and guides, never the normal map camera.
    state.replayCameraPrepared = true
    call.cesiumScene?.()?.requestRender?.()
    return true
}

/**
 * Return the Replay session to its canonical preparation state.
 *
 * @param {object} mode - Replay mode.
 * @param {object} options - Preparation transition options.
 * @param {object|null} [options.journey] - Journey used to rebuild the sampler.
 * @param {Function} [options.shouldApply] - Predicate guarding stale transitions.
 * @returns {Promise<boolean>} Whether the preparation state was applied.
 */
export const enterReplayPreparation = async (mode, {
                                                  journey = currentReplayJourney(),
                                                  shouldApply = null,
                                              } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const canApply = typeof shouldApply === 'function' ? shouldApply : () => true
    const preparationToken = (state.preparationTransitionToken ?? 0) + 1
    state.preparationTransitionToken = preparationToken
    const isCurrentTransition = () => preparationToken === state.preparationTransitionToken && canApply()
    // Stop the orbit immediately, before waiting for previous scene cleanup.
    // Its final position read must settle before presenting a static preparation.
    await globalThis.__?.ui?.cameraManager?.stopRotate?.()
    if (!isCurrentTransition()) {
        return false
    }
    const sceneRestorePromise = state.sceneRestorePromise

    if (sceneRestorePromise) {
        await Promise.resolve(sceneRestorePromise)
    }
    if (!isCurrentTransition()) {
        return false
    }

    const simplePreparation = isJourneyReplayBasicMode()
    if (simplePreparation) {
        call.hideOtherJourneysVisibility()
    }

    JourneyReplayVisibilityController.hideJourneyReplayPOIsForPreparation(mode)

    const prepared = await prepareReplayCamera(mode, {journey})
    const preparationSucceeded = prepared === true && isCurrentTransition()
    if (preparationSucceeded) {
        const camera = globalThis.lgs?.viewer?.camera ?? globalThis.lgs?.camera
        const cameraSettings = currentJourneyReplayCameraSettings({journey})
        // Entry is the single explicit framing boundary. Later guide refreshes
        // leave mouse navigation intact and never recenter the preparation view.
        const sample = state.replayPreparationSample
        const frame = call.cameraRecenterFrame?.({
            sample,
            heading: 0,
            pitch: degreesToRadians(cameraSettings.pitch),
            cameraSettings,
            cameraHeight: call.cameraAltitudeForSample?.(sample, cameraSettings),
        })
        if (frame && typeof camera?.setView === 'function') {
            state.cameraApplyingView = true
            try {
                camera.cancelFlight?.()
                camera.setView({destination: frame.destination, orientation: {direction: frame.direction, up: frame.correctedUp}})
                call.cesiumScene?.()?.requestRender?.()
            }
            finally {
                state.cameraApplyingView = false
            }
        }
    }
    return preparationSucceeded
}

/**
 * Leave transient Replay preparation and restore the main-scene camera state.
 *
 * @param {object} mode - Replay session mode.
 * @returns {boolean} Whether the pre-preparation camera state was restored.
 */
export const leaveReplayPreparation = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    state.preparationTransitionToken = (state.preparationTransitionToken ?? 0) + 1

    if (state.controller?.running || state.controller?.paused) {
        state.controller.stop({emit: false, clearProgress: true})
    }
    if (replayOwnedCameraFor(mode)) {
        call.cancelActiveCameraFlight?.()
    }
    call.stopCameraLiveSyncLoop?.()
    call.setContinuousRender?.(false)
    state.renderer?.clear?.()
    call.restoreOtherJourneysVisibility?.()
    call.restoreCurrentJourneyVisibility?.()
    call.setJourneyReplayOrbitAllowed?.(true)

    const restored = call.restoreCameraState?.() === true
    state.replayCameraPrepared = false
    state.replayPreparationSample = null
    state.replayEntryCameraState = null
    state.savedCameraState = null
    return restored
}

export const start = (mode, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const journey = options.journey ?? currentReplayJourney()
    if (!journey) {
        return null
    }
    const startStartedAt = globalThis.performance?.now?.() ?? Date.now()
    const traceStartStep = (step, extra = {}) => {
        replayVideoTraceDebug('interactive.replay.start.stage', {
            step,
            elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startStartedAt,
            ...extra,
        })
    }
    if (state.sceneRestorePromise) {
        call.cancelPendingSceneRestore()
    }
    const replaySessionLease = beginReplaySessionOwnership(mode, {source: 'interactive'})
    state.renderer.clear()
    call.bindCesiumCameraBridge()
    state.deferPlaybackCameraRestore = false
    state.suppressPlaybackCameraSync = false
    state.cameraStateRestoredBeforeSceneCleanup = false
    state.replayExportClipFrameState = null
    traceStartStep('configure.begin')
    const sampler = call.configure(options)
    traceStartStep('configure.end', {hasSampler: Boolean(sampler?.hasSamples)})
    if (!sampler?.hasSamples) {
        releaseReplaySessionOwnership(mode, replaySessionLease)
        return null
    }
    traceStartStep('reset-camera-interpolation-state.begin')
    call.resetCameraInterpolationState()
    traceStartStep('reset-camera-interpolation-state.end')

        const shouldHideOtherJourneys = isJourneyReplayBasicMode()
                                        || (options.hideOtherJourneys ?? getJourneyReplayHideOtherJourneys())
        const videoReplayLinked = call.isReplayVideoLinked()
        state.logicalCameraTrajectory = false
        state.videoReplayClipLogicalTrajectory = videoReplayLinked
        const startSample = sampler.atProgress?.(options.progress ?? 0)
        call.captureCameraState({sample: startSample})
        void globalThis.__?.ui?.cameraManager?.stopRotate?.()
        call.setJourneyReplayOrbitAllowed(false)
        call.restoreOtherJourneysVisibility()
        call.restoreJourneyReplayPOIVisibility()
        call.hideCurrentJourneyVisibility()
        if (shouldHideOtherJourneys) {
            call.hideOtherJourneysVisibility()
        }
        const initialCameraPlaced = call.placeCameraAtPlaybackStart(startSample, options.progress ?? 0) === true
        state.replayEntryCameraState = captureReplayEntryCameraState(replayCameraFor(mode))
        const preparedSettings = currentJourneyReplayCameraSettings()
        if (preparedSettings.debug) {
            console.info('[Replay camera] applied Replay entry', {
                configuredPitch: preparedSettings.pitch,
                configuredHeight: preparedSettings.altitude,
                configuredAngle: preparedSettings.cameraAngle,
                entry: state.replayEntryCameraState,
            })
        }
        state.replayCameraPrepared = false
        traceStartStep('capture-drawer-state.begin')
        call.captureJourneyReplayDrawerStateBeforePlayback()
        traceStartStep('capture-drawer-state.end')
        traceStartStep('capture-playback-camera-settings.begin')
        call.capturePlaybackCameraSettings()
        traceStartStep('capture-playback-camera-settings.end')
        // Preserve the canonical phase offset while skipping clips before a timeline start in Replay.
        const startList = options.skipStartClips === true
            ? []
            : call.clipListForSlot(REPLAY_CLIP_SLOT_START)
        state.deferStartCameraRecenter = startList.length > 0
        const introLeadSeconds = 1
        const introStartAt = call.now() + Math.max(
            0,
            (startList.reduce((total, clip) => total + Math.max(0, Number(clip?.params?.duration ?? call.cameraSettingsForClip(clip)?.duration ?? 0)), 0) - introLeadSeconds) * 1000,
        )
        const camera = globalThis.lgs?.viewer?.camera
        state.introHeadingTransition = startList.length > 0
                                       ? {
                startAt:       introStartAt,
                endAt:         introStartAt + (REPLAY_HEADING_TRANSITION_DURATION_SECONDS * 1000),
                height:        finiteNumber(camera?.positionCartographic?.height)
                                   ?? finiteNumber(startSample?.altitude ?? startSample?.height)
                                   ?? 0,
                fromPitch:     finiteNumber(camera?.pitch) ?? state.lastCameraPitch ?? SAFE_TOP_DOWN_PITCH,
                targetHeading: call.introHeadingForProgress(options.progress ?? 0),
                applied:       false,
            }
                                       : null
        const token = ++state.clipSequenceToken
        let startResult = startSample
        state.clipCameraContinuity = call.currentReplayClipCameraState({
            initial: true,
            sample: startSample,
        })
        void call.prepareNearbyPOIsForPlayback(startSample)
        const runtimeStore = replayStore()
        if (runtimeStore) {
            runtimeStore.toolbarVisible = true
            runtimeStore.mainUiHidden = videoReplayLinked
            runtimeStore.clipSequenceActive = true
        }
        if (videoReplayLinked) {
            call.hideMainUI()
            ensureReplayVideoDiagnosticsOverlay(mode)
        }

        if (startList.length > 0) {
            traceStartStep('start-clips.begin', {count: startList.length})
            const startPhase = state.controller.videoFramePhaseAtTime?.(0)
            const videoTimeline = state.controller.videoTimeline
            publishReplayClipFrameState({
                store: runtimeStore,
                slot: REPLAY_CLIP_SLOT_START,
                sample: startSample,
                progress: options.progress ?? 0,
                phase: startPhase,
                frameIndex: startPhase?.frameIndex,
                frameCount: videoTimeline?.frameCount,
                frameTimeMs: startPhase?.frameTimeMs,
                frameIntervalMs: videoTimeline?.frameIntervalMs,
                durationMillis: videoTimeline?.durationMillis,
                cameraPose: state.clipCameraContinuity,
                intentResolved: true,
            })
            call.refreshReplayDiagnosticsOverlay?.()
            call.setContinuousRender(true)
            call.hideJourneyToolbarVisibility()
            void (async () => {
                try {
                    if (startSample) {
                        await call.playJourneyReplayClips(REPLAY_CLIP_SLOT_START, {
                            sample: startSample,
                            token,
                            startCamera: state.clipCameraContinuity,
                            onFrame: ({phase, localMillis, sample: clipSample}) => {
                                const videoTimeline = state.controller.videoTimeline
                                const phaseTime = (phase?.startMillis ?? 0) + (Number(localMillis) || 0)
                                const resolvedPhase = state.controller.videoFramePhaseAtTime?.(phaseTime) ?? phase
                                publishReplayClipFrameState({
                                    store: runtimeStore,
                                    slot: REPLAY_CLIP_SLOT_START,
                                    sample: clipSample ?? startSample,
                                    progress: resolvedPhase?.progress ?? 0,
                                    phase: resolvedPhase,
                                    frameIndex: resolvedPhase?.frameIndex,
                                    frameCount: videoTimeline?.frameCount,
                                    frameTimeMs: resolvedPhase?.frameTimeMs,
                                    frameIntervalMs: videoTimeline?.frameIntervalMs,
                                    durationMillis: videoTimeline?.durationMillis,
                                    cameraPose: call.currentReplayClipCameraState({
                                        sample: clipSample ?? startSample,
                                    }),
                                    intentResolved: true,
                                })
                                call.refreshReplayDiagnosticsOverlay?.()
                            },
                        })
                    }

                    if (token !== state.clipSequenceToken) {
                        return
                    }

                    state.deferStartCameraRecenter = false
                    state.skipNextImmediateStartRecenter = true
                    // Do not compile the constrained camera path synchronously here.
                    // That bulk compilation freezes Interactive and Replay export startup.
                    traceStartStep('controller.start.begin', {phase: 'start-clips'})
                    startResult = state.controller.start({
                        progress: options.progress ?? 0,
                    })
                    traceStartStep('controller.start.end', {phase: 'start-clips'})
                }
                catch (error) {
                    state.deferStartCameraRecenter = false
                    call.stop({emit: false})
                }
            })()
        }
        else {
            state.deferStartCameraRecenter = false
            traceStartStep('place-camera-at-playback-start.begin')
            state.skipNextImmediateStartRecenter = initialCameraPlaced
            traceStartStep('place-camera-at-playback-start.end', {
                skipNextImmediateStartRecenter: state.skipNextImmediateStartRecenter,
            })
            // Do not compile the constrained camera path synchronously here.
            // That bulk compilation freezes Interactive and Replay export startup.
            traceStartStep('controller.start.begin', {phase: 'no-start-clips'})
            startResult = state.controller.start({
                progress: options.progress ?? 0,
            })
            traceStartStep('controller.start.end', {phase: 'no-start-clips'})
        }

        return startResult ?? startSample
    }

export const pause = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (replayOwnedCameraFor(mode)) {
            call.cancelActiveCameraFlight()
        }
        return state.controller.pause()
    }

/** Resume the session controller through its owned runtime state. */
export const resume = mode => mode[JOURNEY_REPLAY_INTERNAL_STATE].controller.resume()

export const setLoop = (mode, loop) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const enabled = state.controller.setLoop(loop)
        const store = replayStore()
        if (store) {
            store.loop = enabled
        }
        return enabled
    }

export const setVideoSafeMode = (mode, enabled = true) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        return state.controller.setVideoSafeMode?.(enabled) ?? null
    }

export const preparePlaybackSceneForExport = async (mode, {
                                               journey = globalThis.lgs?.theJourney ?? null,
                                               progress = mode[JOURNEY_REPLAY_INTERNAL_STATE].controller?.progress ?? 0,
                                               hideOtherJourneys = getJourneyReplayHideOtherJourneys(),
                                               hideReplayMarker = false,
                                               cameraState = null,
                                           } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        call.bindCesiumCameraBridge()
        state.deferPlaybackCameraRestore = false
        state.suppressPlaybackCameraSync = false
        state.replayExportClipFrameState = null
        state.clipCameraContinuity = null

        const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0))
        const sampler = call.configure({
            journey,
            progress: safeProgress,
        }) ?? state.sampler
        const sample = sampler?.atProgress?.(safeProgress)
                       ?? state.controller?.currentSample?.()
                       ?? null
        call.resetCameraInterpolationState()

        call.captureCameraState({sample})
        const targetCamera = replayCameraFor(mode)
        if (targetCamera === globalThis.lgs?.camera || targetCamera === globalThis.lgs?.viewer?.camera) {
            void globalThis.__?.ui?.cameraManager?.stopRotate?.()
        }
        const startClips = call.clipListForSlot(REPLAY_CLIP_SLOT_START)
        const providedCameraState = cameraState && typeof cameraState === 'object'
                                    ? {
                                        destination: {
                                            longitude: finiteNumber(cameraState?.destination?.longitude, null),
                                            latitude:  finiteNumber(cameraState?.destination?.latitude, null),
                                            height:    finiteNumber(cameraState?.destination?.height, null),
                                        },
                                        orientation: {
                                            heading: finiteNumber(cameraState?.orientation?.heading, null),
                                            pitch:   finiteNumber(cameraState?.orientation?.pitch, null),
                                            roll:    finiteNumber(cameraState?.orientation?.roll, null),
                                        },
                                        altitude: finiteNumber(cameraState?.altitude, null),
                                        pivot: cameraState?.pivot ? {...cameraState.pivot} : null,
                                    }
                                    : null
        call.captureCameraState({sample})
        state.replayEntryCameraState = providedCameraState
        if (providedCameraState) {
            call.restoreCameraState({clear: false, cameraState: providedCameraState})
        }
        else {
            call.placeCameraAtPlaybackStart(sample, safeProgress)
            state.replayEntryCameraState = captureReplayEntryCameraState(replayCameraFor(mode))
        }
        state.clipCameraContinuity = typeof call.currentReplayClipCameraState === 'function'
            ? call.currentReplayClipCameraState({
                initial: true,
                sample,
            })
            : null
        call.captureJourneyReplayDrawerStateBeforePlayback()
        call.capturePlaybackCameraSettings()

        if (journey) {
            journey.visible = true
            journey.updateVisibility?.(true)

            if (startClips.length === 0) {
                call.placeCameraAtPlaybackStart(sample, safeProgress)
            }
        }

        const preparedCamera = currentJourneyReplayCameraSettings()
        if (preparedCamera.debug) {
            console.info('[Replay camera] recording entry', {
                configuredPitch: preparedCamera.pitch,
                configuredHeight: preparedCamera.altitude,
                requestedCameraAltitude: sample ? call.cameraAltitudeForSample?.(sample, preparedCamera) ?? null : null,
                configuredAngle: preparedCamera.cameraAngle,
                altitudeMode: preparedCamera.altitudeMode,
                markerHeight: sample ? call.markerRenderHeightForSample?.(sample) ?? null : null,
                actualHeight: targetCamera?.positionCartographic?.height ?? null,
                actualPitch: targetCamera?.pitch === undefined ? null : CesiumMath.toDegrees(targetCamera.pitch),
                entry: state.replayEntryCameraState,
            })
        }

        // Do not compile the constrained camera path synchronously during export preparation.
        // Export preparation must return control to the fixed-frame renderer immediately.

        call.setJourneyReplayOrbitAllowed(false)
        call.restoreOtherJourneysVisibility()
        call.hideCurrentJourneyVisibility()
        if (isJourneyReplayBasicMode() || hideOtherJourneys) {
            call.hideOtherJourneysVisibility()
        }
        if (sampler?.hasSamples) {
            state.renderer.show({
                sampler,
                options: {smoothedGuide: call.smoothedGuide()},
            })
        }
        void call.prepareNearbyPOIsForPlayback(sample)
        if (hideReplayMarker) {
            state.renderer.hideCursor?.()
        }

        const runtimeStore = replayStore()
        if (runtimeStore) {
            runtimeStore.toolbarVisible = true
            runtimeStore.mainUiHidden = true
            runtimeStore.clipSequenceActive = true
        }
        call.hideMainUI()
        ensureReplayVideoDiagnosticsOverlay(mode)
        const renderScene = call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
        renderScene?.requestRender?.()
        return true

    }

export const toggle = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        if (state.controller.playing) {
            return call.pause()
        }

        if (state.controller.paused) {
            return call.resume()
        }

        return call.start()
    }

/**
 * Seek the live replay and optionally qualify the resulting canonical frame.
 *
 * Existing synchronous callers keep receiving the sample directly. Interactive
 * scrubbing opts into scene qualification and receives an asynchronous result.
 *
 * @param {Object} mode - Replay session mode.
 * @param {number} progress - Requested replay progress.
 * @param {Object} options - Optional scene qualification request.
 * @returns {Object|Promise<Object>} Sample or qualified scrub result.
 */
export const seek = (mode, progress, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const sample = state.controller.seek(progress)
    if (options.qualifyScene !== true) {
        return sample
    }

    const store = replayStore()
    const publishedIntent = store?.resolvedFrameState?.intent ?? null
    const intent = publishedIntent
                ?? state.controller.resolveFrameAtProgress?.(progress, {
                    source: 'scrub',
                    renderMode: 'interactive',
                    resolved: true,
                })
                ?? null
    const scene = globalThis.lgs?.viewer?.scene
               ?? globalThis.lgs?.scene
               ?? null
    const readiness = normalizeJourneyReplayReadiness(
        store?.readiness
        ?? globalThis.lgs?.settings?.ui?.replay?.readiness,
    )
    const qualifier = replaySceneFrameQualifierFor(mode, {scene, readiness})
    if (!qualifier) {
        return Promise.resolve({sample, intent, qualification: null})
    }

    return qualifier.qualify({
        intent,
        settled: options.settled === true,
        signal: options.signal ?? null,
        maxMillis: readiness.settledTimeoutMs,
        speedLevel: options.settled === true ? 'jump' : 'fast',
    }).then(qualification => ({sample, intent, qualification}))
}

export const refresh = (mode, {
                   camera = true,
                   suppressMoveEvents = camera === true,
                   rebuildSampler = false,
                   forceGeometry = true,
                   frameTimeMs = null,
                   frameIntervalMs = null,
                   exportMode = false,
               } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        let sample = state.controller.currentSample()
        if (rebuildSampler) {
            const progress = finiteNumber(state.controller.progress ?? sample?.progress) ?? 0
            call.configure({progress})
            sample = state.controller.currentSample()
            if (sample && state.sampler) {
                state.renderer.show({
                    sampler: state.sampler,
                    options: {smoothedGuide: call.smoothedGuide()},
                })
            }
        }
        if (sample && state.sampler) {
            state.renderer.update({
                sample,
                sampler: state.sampler,
                forceGeometry,
                showTrace: exportMode || isJourneyReplayTraceActive(),
            })
            if (camera && replayOwnedCameraFor(mode)) {
                if (suppressMoveEvents) {
                    state.cameraAutoTrackingIgnoreUntil = call.now() + 180
                }
                call.updateCamera({
                                       sample,
                                       progress: state.controller.progress ?? sample.progress ?? 0,
                                       source: 'refresh',
                                       frameTimeMs,
                                       frameIntervalMs,
                                       exportMode,
                                   })
            }
        }
        return sample
    }

/**
 * Refresh the configured departure guide without moving the normal camera.
 *
 * @param {Object} mode - Replay session mode.
 * @param {Object} sample - Departure sample.
 * @param {Object} options - Camera refresh options.
 * @returns {boolean} Whether the preparation guide was refreshed.
 */
const refreshPreparationCamera = (mode, sample, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const replaySettings = getJourneyReplaySettings()
    const cameraSettings = currentJourneyReplayCameraSettings()
    const markerSettings = normalizeJourneyReplayMarker(
        globalThis.lgs?.stores?.replay?.marker ?? replaySettings.marker,
    )
    const view = call.cameraViewForSample?.({
        cameraSettings,
        markerSettings,
        previousHeading: null,
        previousPitch:   null,
        progress:        0,
        sample,
        source:          options.source ?? 'preparation',
    })
    if (!view) {
        return false
    }

    if (options.source === 'keyboard') {
        call.persistCameraSettings?.(cameraSettings)
    }
    call.cesiumScene?.()?.requestRender?.()
    return true
}

export const refreshCamera = (mode, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const journey = globalThis.lgs?.theJourney
            ?? globalThis.lgs?.stores?.main?.theJourney
        let sample = null
        if (options.preparation === true) {
            const sampler = state.sampler
                ?? (journey ? call.configure?.({journey, progress: 0}) : null)
            sample = state.replayPreparationSample
                ?? sampler?.atProgress?.(0)
                ?? null
            if (sample && !state.replayPreparationSample) {
                state.replayPreparationSample = sample
            }
        }
        if (!sample) {
            sample = options.sample
                ?? currentJourneyReplaySample(state.controller)
                ?? globalThis.lgs?.stores?.replay?.sample
        }
        if (!sample) {
            return null
        }

        if (options.preparation === true || !replayOwnedCameraFor(mode)) {
            refreshPreparationCamera(mode, sample, options)
            return sample
        }

        if (options.suppressMoveEvents !== false) {
            state.cameraAutoTrackingIgnoreUntil = call.now() + 180
        }

        call.updateCamera({
            sample,
            progress: state.controller.progress ?? sample.progress ?? 0,
            source: 'refresh',
                               ...options,
        })
        return sample
    }

export const beginReplayCameraExport = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        replayVideoTraceDebug('camera.export-ownership.start', {
            replayExportCameraActive: state.replayExportCameraActive === true,
            cameraUserAdjusting: state.cameraUserAdjusting === true,
            cameraPointerActive: state.cameraPointerActive === true,
            cameraManualInteractionTimer: state.cameraManualInteractionTimer !== null,
        })
        state.replayExportCameraActive = true
        state.logicalCameraTrajectory = true
        state.exportPathCompilationBypassTraced = false
        state.cameraUserAdjusting = false
        state.cameraPointerActive = false
        if (state.cameraManualInteractionTimer !== null) {
            globalThis.clearTimeout?.(state.cameraManualInteractionTimer)
            state.cameraManualInteractionTimer = null
        }
        call.cancelCameraBezierTransition(false)
    }

export const endReplayCameraExport = (mode, ) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        replayVideoTraceDebug('camera.export-ownership.end', {
            replayExportCameraActive: state.replayExportCameraActive === true,
            cameraUserAdjusting: state.cameraUserAdjusting === true,
            cameraPointerActive: state.cameraPointerActive === true,
            cameraManualInteractionTimer: state.cameraManualInteractionTimer !== null,
        })
        state.replayExportCameraActive = false
        state.logicalCameraTrajectory = false
    }

export const renderReplayExportFrame = async (mode, {phase = null, frame = null, controller = mode[JOURNEY_REPLAY_INTERNAL_STATE].controller} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const activeController = controller ?? state.controller
        const replayPhase = phase?.kind === 'replay' || !phase?.clip
        const progress = clamp(finiteNumber(phase?.progress) ?? activeController?.progress ?? 0, 0, 1)
        const anchorProgress = clamp(finiteNumber(phase?.anchorProgress) ?? progress, 0, 1)

        if (replayPhase) {
            state.renderingReplayExportFrame = true
            let sample = null
            try {
                sample = activeController?.seek?.(progress)
                         ?? state.sampler?.atProgress?.(progress)
                         ?? activeController?.currentSample?.()
                         ?? null
            }
            finally {
                state.renderingReplayExportFrame = false
            }
            if (sample && state.sampler) {
                state.renderer.update({
                    sample,
                    sampler:       state.sampler,
                    // Export frames are produced faster than wall-clock playback. Bypass the
                    // interactive renderer throttle so every encoded frame owns its trace.
                    forceGeometry: true,
                    syncCursorToTrace: true,
                    hideTrace:     phase?.slot === REPLAY_CLIP_SLOT_START,
                    showTrace:     true,
                })
                state.cameraAutoTrackingIgnoreUntil = call.now() + 180
                const durationSeconds = finiteNumber(activeController?.duration ?? state.controller?.duration)
                const logicalFrame = createJourneyReplayLogicalFrame({
                    sample,
                    progress,
                    durationMillis:  durationSeconds === null ? null : durationSeconds * 1000,
                    frameTimeMs:     finiteNumber(frame?.frameTimeMs)
                                     ?? finiteNumber(phase?.frameTimeMs)
                                     ?? 0,
                    frameIntervalMs: finiteNumber(frame?.frameIntervalMs)
                                     ?? finiteNumber(phase?.frameIntervalMs)
                                     ?? null,
                    phase,
                    source:          'replay-export',
                })
                call.updateCamera({
                    sample,
                    progress,
                    frameTimeMs: finiteNumber(frame?.frameTimeMs)
                                 ?? finiteNumber(phase?.frameTimeMs)
                                 ?? 0,
                    frameIntervalMs: finiteNumber(frame?.frameIntervalMs)
                                     ?? finiteNumber(phase?.frameIntervalMs)
                                     ?? null,
                    isFinalFrame: phase?.isFinalSceneFrame === true
                                  || phase?.isLastPhaseFrame === true
                                  || frame?.isLast === true,
                    exportMode:   true,
                    logicalCamera: true,
                    logicalFrame,
                })
                if (typeof call.currentReplayClipCameraState === 'function') {
                    state.clipCameraContinuity = call.currentReplayClipCameraState({
                        sample,
                    })
                }
            }
            return sample
        }

        state.renderingReplayExportFrame = true
        let sample = null
        try {
            sample = activeController?.seek?.(anchorProgress)
                     ?? state.sampler?.atProgress?.(anchorProgress)
                     ?? activeController?.currentSample?.()
                     ?? null
        }
        finally {
            state.renderingReplayExportFrame = false
        }
        const hideClipCursor = phase?.slot === REPLAY_CLIP_SLOT_START
                               || phase?.slot === REPLAY_CLIP_SLOT_STOP
        // The export must capture the final Cesium trace after the last scene render.
        // Freeze it as terrain-compatible geometry for that frame so a dynamic
        // CallbackProperty cannot leave the encoded frame one render behind.
        const isFinalExportFrame = phase?.isFinalSceneFrame === true
                                   || phase?.isLastPhaseFrame === true
        const stopClip = phase?.slot === REPLAY_CLIP_SLOT_STOP
        const staticCompletedTrace = (stopClip || replayPhase)
                                     && isFinalExportFrame
                                     && frame !== null
        if (staticCompletedTrace) {
            replayVideoTraceDebug('mode.export-frame.stop.begin', {
                clipId: phase?.clip?.clipId ?? null,
                progress,
                anchorProgress,
                localProgress: phase?.localProgress ?? null,
                localMillis: phase?.localMillis ?? null,
                hasSample: Boolean(sample),
                sampleProgress: sample?.progress ?? null,
                hasSampler: Boolean(state.sampler),
            })
        }
        if (sample && state.sampler) {
            state.renderer.update({
                sample,
                sampler:               state.sampler,
                forceGeometry:         true,
                freezeDynamic:         false,
                hideCursor:            hideClipCursor,
                hideTrace:              phase?.slot === REPLAY_CLIP_SLOT_START,
                showTrace:              true,
                hideRemainingTrace:    stopClip,
                staticCompletedTrace,
                completedTraceMode:    staticCompletedTrace ? 'static' : (stopClip ? 'stop-dynamic' : 'dynamic'),
            })
        }
        const frameSample = await call.renderReplayExportClipFrame({
            phase,
            clip: phase.clip,
            slot: phase.slot,
            sample,
            localProgress: phase.localProgress,
            localMillis: phase.localMillis,
        })
        if (staticCompletedTrace) {
            replayVideoTraceDebug('mode.export-frame.stop.after-camera', {
                clipId: phase?.clip?.clipId ?? null,
                localProgress: phase?.localProgress ?? null,
                sampleProgress: sample?.progress ?? null,
                cameraHeading: globalThis.lgs?.viewer?.camera?.heading ?? null,
                cameraPitch: globalThis.lgs?.viewer?.camera?.pitch ?? null,
            })
        }
        const renderScene = call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
        renderScene?.requestRender?.()
        return frameSample ?? sample
    }
