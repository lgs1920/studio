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
    currentJourneyReplayPoiBehavior, currentJourneyReplaySample, finiteNumber, isJourneyReplayVideoCaptureActive,
    publishReplayClipFrameState, replayStore, resetRuntimeProgress, resolveJourneyReplayRuntimeClips,
} from './JourneyReplayRuntime'
import {createJourneyReplayLogicalFrame} from './JourneyReplayLogicalFrame'
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

/**
 * Ensure linked replay diagnostics are visible before either Draft or HQ
 * rendering starts.
 *
 * @param {object} mode - Replay mode.
 * @returns {boolean} Whether linked replay diagnostics were enabled.
 */
const ensureReplayVideoDiagnosticsOverlay = mode => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!call.isReplayVideoLinked()) {
        return false
    }

    const replaySettings = getJourneyReplaySettings()
    const runtimeStore = replayStore()
    const replayCameraSettings = normalizeJourneyReplayCamera(
        globalThis.lgs?.settings?.ui?.replay?.camera
        ?? runtimeStore?.camera
        ?? replaySettings.camera,
    )
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
        const journey = options.journey ?? globalThis.lgs?.theJourney

        if (!journey) {
            return null
        }

        const replay = getJourneyReplaySettings()
        const scope = REPLAY_SCOPE_ALL_TRACKS
        const trackSlug = options.trackSlug ?? globalThis.lgs?.theTrack?.slug ?? store?.trackSlug
        const progression = options.progression ?? replay.progression
        const profileInfo = options.profileInfo ?? replay.profileInfo
        const trace = options.trace ?? replay.trace
        const smoothing = normalizeJourneyReplaySmoothing(options.smoothing ?? replay.smoothing)
        const marker = options.marker ?? replay.marker
        const camera = options.camera ?? replay.camera
        const samplerConfigKey = call.samplerConfigurationKey({
            journey,
            scope,
            trackSlug,
            includeHiddenTracks: options.includeHiddenTracks ?? false,
            smoothing,
        })
        const clips = resolveJourneyReplayRuntimeClips({
            clips:         options.clips,
            settingsClips: replay.clips,
            journey,
        })

        if (state.samplerConfigKey !== samplerConfigKey || !state.sampler) {
            state.sampler = new JourneyReplayPathSampler({
                journey,
                scope,
                trackSlug,
                includeHiddenTracks: options.includeHiddenTracks ?? false,
                renderSmoothing: smoothing,
            })
            state.samplerConfigKey = samplerConfigKey
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
            store.clips = clips
        }

        state.controller.configure({
            sampler:   state.sampler,
            duration:  options.duration ?? replay.duration ?? store?.duration ?? DEFAULT_DURATION,
            direction: 1,
            loop:      options.loop ?? replay.loop ?? store?.loop ?? false,
            progress:  options.progress ?? store?.progress ?? 0,
        })

        call.bindCesiumCameraBridge()

        return state.sampler
    }

export const start = (mode, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const startStartedAt = globalThis.performance?.now?.() ?? Date.now()
    const traceStartStep = (step, extra = {}) => {
        replayVideoTraceDebug('draft.replay.start.stage', {
            step,
            elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - startStartedAt,
            ...extra,
        })
    }
    if (state.sceneRestorePromise) {
        const restoreToken = state.clipSequenceToken
        return state.sceneRestorePromise.then(() => {
            if (restoreToken !== state.clipSequenceToken) {
                return null
            }
            return start(mode, options)
        })
    }
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
        return null
    }
    traceStartStep('reset-camera-interpolation-state.begin')
    call.resetCameraInterpolationState()
    traceStartStep('reset-camera-interpolation-state.end')

        const shouldHideOtherJourneys = options.hideOtherJourneys
                                        ?? getJourneyReplayHideOtherJourneys()
        const videoReplayLinked = call.isReplayVideoLinked()
        state.logicalCameraTrajectory = false
        void globalThis.__?.ui?.cameraManager?.stopRotate?.()
        call.setJourneyReplayOrbitAllowed(!videoReplayLinked)
        call.restoreOtherJourneysVisibility()
        call.hideCurrentJourneyVisibility()
        if (shouldHideOtherJourneys) {
            call.hideOtherJourneysVisibility()
        }
        const startSample = sampler.atProgress?.(options.progress ?? 0)
        const hasReplayEntryCameraState = Boolean(state.replayEntryCameraState)
        if (!hasReplayEntryCameraState) {
            traceStartStep('capture-camera-state.begin')
            call.captureCameraState({sample: startSample})
            state.replayEntryCameraState = state.savedCameraState
                ? {
                    destination: {...state.savedCameraState.destination},
                    orientation: {...state.savedCameraState.orientation},
                    altitude: state.savedCameraState.altitude,
                }
                : null
            traceStartStep('capture-camera-state.end')
        }
        else {
            traceStartStep('restore-camera-state.begin')
            call.restoreCameraState({
                                       clear:       false,
                                       cameraState: state.replayEntryCameraState,
                                   })
            traceStartStep('restore-camera-state.end')
        }
        traceStartStep('capture-drawer-state.begin')
        call.captureJourneyReplayDrawerStateBeforePlayback()
        traceStartStep('capture-drawer-state.end')
        traceStartStep('capture-playback-camera-settings.begin')
        call.capturePlaybackCameraSettings()
        traceStartStep('capture-playback-camera-settings.end')
        const startList = call.clipListForSlot(REPLAY_CLIP_SLOT_START)
        if (!hasReplayEntryCameraState && startList.length > 0) {
            state.replayEntryCameraState = state.savedCameraState
                ? {
                    destination: {...state.savedCameraState.destination},
                    orientation: {...state.savedCameraState.orientation},
                    altitude: state.savedCameraState.altitude,
                }
                : null
        }
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
            publishReplayClipFrameState({
                store: runtimeStore,
                slot: REPLAY_CLIP_SLOT_START,
                sample: startSample,
                progress: options.progress ?? 0,
            })
            call.setContinuousRender(true)
            if (videoReplayLinked) {
                call.hideJourneyToolbarVisibility()
            }
            void (async () => {
                try {
                    if (startSample) {
                        await call.playJourneyReplayClips(REPLAY_CLIP_SLOT_START, {
                            sample: startSample,
                            token,
                        })
                    }

                    if (token !== state.clipSequenceToken) {
                        return
                    }

                    state.deferStartCameraRecenter = false
                    // Do not compile the constrained camera path synchronously here.
                    // That bulk compilation freezes Draft and HQ replay startup.
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
            state.skipNextImmediateStartRecenter = call.placeCameraAtPlaybackStart(startSample, options.progress ?? 0) === true
            traceStartStep('place-camera-at-playback-start.end', {
                skipNextImmediateStartRecenter: state.skipNextImmediateStartRecenter,
            })
            // Do not compile the constrained camera path synchronously here.
            // That bulk compilation freezes Draft and HQ replay startup.
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
        call.cancelActiveCameraFlight()
        return state.controller.pause()
    }

export const resume = (mode, ) => state.controller.resume()

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

        const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0))
        const sampler = call.configure({
            journey,
            progress: safeProgress,
        }) ?? state.sampler
        const sample = sampler?.atProgress?.(safeProgress)
                       ?? state.controller?.currentSample?.()
                       ?? null
        call.resetCameraInterpolationState()

        void globalThis.__?.ui?.cameraManager?.stopRotate?.()
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
                                    }
                                    : null
        if (providedCameraState) {
            state.savedCameraState = {
                destination: {...providedCameraState.destination},
                orientation: {...providedCameraState.orientation},
                altitude:    providedCameraState.altitude,
            }
            state.replayEntryCameraState = {
                destination: {...providedCameraState.destination},
                orientation: {...providedCameraState.orientation},
                altitude:    providedCameraState.altitude,
            }
        }
        const hasReplayEntryCameraState = Boolean(state.replayEntryCameraState)
        if (hasReplayEntryCameraState) {
            call.restoreCameraState({clear: false})
        }
        else {
            call.captureCameraState({sample})
            state.replayEntryCameraState = state.savedCameraState
                ? {
                    destination: {...state.savedCameraState.destination},
                    orientation: {...state.savedCameraState.orientation},
                    altitude: state.savedCameraState.altitude,
                }
                : null
        }
        call.captureJourneyReplayDrawerStateBeforePlayback()
        call.capturePlaybackCameraSettings()

        if (journey) {
            journey.visible = true
            journey.updateVisibility?.(true)

            if (startClips.length === 0) {
                call.placeCameraAtPlaybackStart(sample, safeProgress)
            }
        }

        // Do not compile the constrained camera path synchronously during HQ preparation.
        // Export preparation must return control to the fixed-frame renderer immediately.

        call.setJourneyReplayOrbitAllowed(false)
        call.restoreOtherJourneysVisibility()
        call.hideCurrentJourneyVisibility()
        if (hideOtherJourneys) {
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
        globalThis.lgs?.scene?.requestRender?.()
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

export const seek = (mode, progress) => mode[JOURNEY_REPLAY_INTERNAL_STATE].controller.seek(progress)

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
                showTrace: exportMode || isJourneyReplayVideoCaptureActive(),
            })
            if (camera) {
                if (suppressMoveEvents) {
                    state.cameraAutoTrackingIgnoreUntil = call.now() + 180
                }
                call.updateCamera({
                                       sample,
                                       progress: state.controller.progress ?? sample.progress ?? 0,
                                       frameTimeMs,
                                       frameIntervalMs,
                                       exportMode,
                                   })
            }
        }
        return sample
    }

export const refreshCamera = (mode, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const sample = options.sample
            ?? currentJourneyReplaySample(state.controller)
            ?? globalThis.lgs?.stores?.replay?.sample
        if (!sample) {
            return null
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
                    forceGeometry: false,
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
                    source:          'hq-export',
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
                    exportMode:   true,
                    logicalCamera: true,
                    logicalFrame,
                })
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
        // HQ must capture the final Cesium trace after the last scene render.
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
        globalThis.lgs?.scene?.requestRender?.()
        return frameSample ?? sample
    }
