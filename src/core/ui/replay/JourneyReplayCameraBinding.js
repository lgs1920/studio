/**
 * Replay camera Binding behavior.
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
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForPositionMode, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayFrameLeadSeconds, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
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

export const recenterCameraToSample = (mode, {
                                   sample,
                                   heading,
                                   pitch,
                                   cameraSettings,
                                   cameraHeight = null,
                                   instant = false,
                                   duration = 1.0,
                                   deterministic = false,
                                   logicalNow = null,
                                   force = false,
                               }) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = globalThis.lgs?.viewer
        const frame = call.cameraRecenterFrame({
            sample,
            heading,
            pitch,
            cameraSettings,
            cameraHeight,
        })
        if (!viewer || !frame) {
            return
        }

        const {destination, direction, correctedUp, safeHeading, safePitch} = frame
        const finishFlight = () => {
            state.cameraFlightActive = false
        }

        if (!force && !deterministic && call.cameraViewIsStable({anchor: sample, heading: safeHeading, pitch: safePitch})) {
            finishFlight()
            return Promise.resolve(true)
        }

        state.cameraAutoTrackingIgnoreUntil = call.now() + Math.max(180, duration * 1000 + 180)
        call.rememberCameraView({anchor: sample, heading: safeHeading, pitch: safePitch})
        if (deterministic && !instant && duration > 0) {
            finishFlight()
            return Promise.resolve(call.startDeterministicCameraTransition({
                sample,
                heading: safeHeading,
                pitch:   safePitch,
                endFrame: frame,
                duration,
                logicalNow,
            }))
        }
        if (instant || duration <= 0) {
            viewer.camera.setView?.({
                                        destination,
                                        orientation: {
                                            direction,
                                            up: correctedUp,
                                        },
                                    })
            finishFlight()
            return Promise.resolve()
        }
        return call.startCameraTransition({
            sample,
            heading:        safeHeading,
            pitch:          safePitch,
            cameraSettings,
            cameraHeight:   frame.currentHeight,
            duration,
            endFrame:       frame,
        })
    }

export const startCameraTransition = (mode, {
                                        sample,
                                        heading,
                                        pitch,
                                        cameraSettings,
                                        cameraHeight = null,
                                        endFrame = null,
                                        duration = REPLAY_HEADING_TRANSITION_DURATION_SECONDS,
                                    }) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = globalThis.lgs?.viewer
        if (!viewer?.camera) {
            return Promise.resolve(false)
        }

        const frame = endFrame ?? call.cameraRecenterFrame({
            sample,
            heading,
            pitch,
            cameraSettings,
            cameraHeight,
        })
        if (!frame) {
            return Promise.resolve(false)
        }

        call.cancelCameraBezierTransition(false)

        const endHeading = frame.safeHeading
        const endPitch = frame.safePitch
        const endPosition = frame.destination
        const endDirection = frame.direction
        const endUp = frame.correctedUp
        const startHeight = finiteNumber(globalThis.lgs?.viewer?.camera?.positionCartographic?.height)
                            ?? cameraHeight
                            ?? frame.currentHeight
        const maximumHeight = Math.max(
            finiteNumber(startHeight) ?? 0,
            finiteNumber(frame.currentHeight) ?? 0,
        )

        state.cameraFlightActive = true
        state.cameraApplyingView = true
        state.cameraAutoTrackingIgnoreUntil = call.now() + Math.max(180, Math.max(0, Number(duration) * 1000) + 180)

        return new Promise(resolve => {
            state.cameraBezierResolve = resolve
            const settle = (result) => {
                if (state.cameraBezierResolve === null) {
                    return
                }
                const done = state.cameraBezierResolve
                state.cameraBezierResolve = null
                state.cameraBezierFrame = null
                state.cameraApplyingView = false
                state.cameraFlightActive = false
                state.introHeadingTransition = null
                if (result) {
                    state.lastCameraHeading = endHeading
                    state.lastCameraPitch = endPitch
                }
                done(result)
            }

            // The live Draft recorder can render the Cesium scene without
            // running the normal camera flight lifecycle. In that situation
            // flyTo may never invoke complete/cancel, leaving the replay
            // permanently locked in #cameraApplyingView. Use the same frame
            // interpolation as HQ while a Draft is being captured.
            const videoStore = globalThis.lgs?.stores?.ui?.video
            // `recordingSync` is true for the Draft launched from the replay
            // progress bar as well. It must not route through flyTo: Draft
            // capture does not reliably deliver flyTo callbacks, which leaves
            // collision/recenter state locked after the first correction.
            const draftRecording = videoStore?.recording === true
            if (draftRecording) {
                const startFrame = call.currentCameraFrame(frame)
                if (!startFrame) {
                    state.cameraApplyingView = false
                    state.cameraFlightActive = false
                    settle(false)
                    return
                }
                const startedAt = call.now()
                const transitionDuration = Math.max(1, (Number(duration) || 0) * 1000)
                const tick = () => {
                    if (state.cameraBezierResolve === null) {
                        return
                    }

                    const ratio = clamp((call.now() - startedAt) / transitionDuration, 0, 1)
                    call.applyCameraFrame(call.interpolateCameraFrame(startFrame, {
                        destination: endPosition,
                        direction:   endDirection,
                        up:          endUp,
                    }, ratio))
                    if (ratio >= 1) {
                        settle(true)
                        return
                    }
                    state.cameraBezierFrame = globalThis.setTimeout?.(tick, 16) ?? null
                }
                tick()
                return
            }

            if (typeof viewer.camera.flyTo === 'function') {
                try {
                    viewer.camera.flyTo({
                        destination: endPosition,
                        orientation: {
                            direction: endDirection,
                            up:        endUp,
                        },
                        duration: Math.max(0, Number(duration) || 0),
                        maximumHeight,
                        easingFunction: EasingFunction.CUBIC_IN_OUT,
                        complete: () => settle(true),
                        cancel:   () => settle(false),
                    })
                    return
                }
                catch (error) {
                    console.error('[JourneyReplayMode] Camera flyTo transition failed.', error)
                }
            }

            try {
                viewer.camera.setView?.({
                    destination: endPosition,
                    orientation: {
                        direction: endDirection,
                        up:        endUp,
                    },
                })
                settle(true)
            }
            catch (error) {
                console.error('[JourneyReplayMode] Camera transition failed.', error)
                settle(false)
            }
        })
    }

export const bindMarkerInteractions = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = globalThis.lgs?.viewer?.camera
        const interactionTargets = [
            globalThis.lgs?.viewer?.canvas,
            globalThis.lgs?.viewer?.scene?.canvas,
            call.cesiumScene()?.canvas,
            globalThis.lgs?.canvas,
        ].filter((target, index, targets) => target && targets.indexOf(target) === index)
        if (!camera) {
            return
        }

        const cameraChanged = () => {
            // Keep live Cesium edits visible in the drawer during FT; only suppress echoes from our own writes.
            if (state.suppressPlaybackCameraSync) {
                return
            }
            if (state.cameraApplyingView || call.now() < state.cameraAutoTrackingIgnoreUntil) {
                return
            }
            if (!state.cameraUserAdjusting && !state.cameraPointerActive) {
                return
            }
            call.updateCameraFromCesiumControls()
        }
        const refreshToleranceCameraAfterManualMove = () => {
            const settings = getJourneyReplaySettings()
            const marker = normalizeJourneyReplayMarker(globalThis.lgs?.stores?.replay?.marker ?? settings.marker)
            if (marker.mode === REPLAY_MARKER_MODE_HYSTERESIS) {
                mode.refreshCamera({forceToleranceRecenter: true})
            }
        }
        const manualStart = ({pointer = false} = {}) => {
            if (state.suppressPlaybackCameraSync) {
                state.suppressPlaybackCameraSync = false
            }
            if (state.cameraFlightActive && !pointer) {
                return
            }
            if (pointer && state.cameraFlightActive) {
                call.cancelCameraBezierTransition(false)
            }
            // Allow pointer interactions to start even if a programmatic camera view was just applied.
            if (!pointer && (state.cameraApplyingView || call.now() < state.cameraAutoTrackingIgnoreUntil)) {
                return
            }
            if (state.cameraManualInteractionTimer !== null) {
                clearTimeout(state.cameraManualInteractionTimer)
                state.cameraManualInteractionTimer = null
            }
            state.cameraPointerActive = pointer || state.cameraPointerActive
            state.cameraUserAdjusting = true
            call.startCameraLiveSyncLoop()
        }
        const manualEnd = ({immediate = false} = {}) => {
            if (state.cameraFlightActive && !state.cameraPointerActive) {
                state.cameraUserAdjusting = false
                call.stopCameraLiveSyncLoop()
                return
            }
            if (!state.cameraPointerActive && (state.cameraApplyingView || call.now() < state.cameraAutoTrackingIgnoreUntil)) {
                state.cameraPointerActive = false
                state.cameraUserAdjusting = false
                return
            }
            state.cameraPointerActive = false
            if (state.cameraManualInteractionTimer !== null) {
                clearTimeout(state.cameraManualInteractionTimer)
            }
            const finish = () => {
                state.cameraManualInteractionTimer = null
                state.cameraUserAdjusting = false
                call.updateCameraFromCesiumControls()
                refreshToleranceCameraAfterManualMove()
                call.stopCameraLiveSyncLoop()
            }
            if (immediate) {
                finish()
                return
            }
            state.cameraManualInteractionTimer = setTimeout(finish, 120)
        }
        const moveStart = () => {
            manualStart()
        }
        const moveEnd = () => {
            if (state.cameraPointerActive) {
                return
            }
            manualEnd({immediate: true})
        }
        camera.moveStart.addEventListener(moveStart)
        camera.moveEnd.addEventListener(moveEnd)
        const pointerDown = () => manualStart({pointer: true})
        const pointerUp = () => manualEnd()
        const mouseDown = () => manualStart({pointer: true})
        const mouseUp = () => manualEnd()
        const wheel = () => {
            manualStart({pointer: true})
            manualEnd()
        }
        const listenerOptions = {passive: true, capture: true}
        camera.changed?.addEventListener?.(cameraChanged)
        interactionTargets.forEach(target => {
            target.addEventListener?.('pointerdown', pointerDown, listenerOptions)
            target.addEventListener?.('pointerup', pointerUp, listenerOptions)
            target.addEventListener?.('pointercancel', pointerUp, listenerOptions)
            target.addEventListener?.('touchstart', pointerDown, listenerOptions)
            target.addEventListener?.('touchend', pointerUp, listenerOptions)
            target.addEventListener?.('touchcancel', pointerUp, listenerOptions)
            target.addEventListener?.('mousedown', mouseDown, listenerOptions)
            target.addEventListener?.('mouseup', mouseUp, listenerOptions)
            target.addEventListener?.('mouseleave', mouseUp, listenerOptions)
            target.addEventListener?.('wheel', wheel, listenerOptions)
        })
        globalThis.window?.addEventListener?.('pointerup', pointerUp, listenerOptions)
        globalThis.window?.addEventListener?.('mouseup', mouseUp, listenerOptions)
        globalThis.window?.addEventListener?.('touchend', pointerUp, listenerOptions)
        state.unbind.push(() => {
            camera.changed?.removeEventListener?.(cameraChanged)
            camera.moveStart.removeEventListener(moveStart)
            camera.moveEnd.removeEventListener(moveEnd)
            call.stopCameraLiveSyncLoop()
            interactionTargets.forEach(target => {
                target.removeEventListener?.('pointerdown', pointerDown, listenerOptions)
                target.removeEventListener?.('pointerup', pointerUp, listenerOptions)
                target.removeEventListener?.('pointercancel', pointerUp, listenerOptions)
                target.removeEventListener?.('touchstart', pointerDown, listenerOptions)
                target.removeEventListener?.('touchend', pointerUp, listenerOptions)
                target.removeEventListener?.('touchcancel', pointerUp, listenerOptions)
                target.removeEventListener?.('mousedown', mouseDown, listenerOptions)
                target.removeEventListener?.('mouseup', mouseUp, listenerOptions)
                target.removeEventListener?.('mouseleave', mouseUp, listenerOptions)
                target.removeEventListener?.('wheel', wheel, listenerOptions)
            })
            globalThis.window?.removeEventListener?.('pointerup', pointerUp, listenerOptions)
            globalThis.window?.removeEventListener?.('mouseup', mouseUp, listenerOptions)
            globalThis.window?.removeEventListener?.('touchend', pointerUp, listenerOptions)
        })
    }

    /**
     * Bind the Cesium camera bridge once the viewer exists.
     * The replay drawer and the runtime settings rely on this bridge to stay in sync with live camera edits.
     */

export const bindCesiumCameraBridge = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (state.cameraBridgeBound) {
            return true
        }

        const camera = globalThis.lgs?.viewer?.camera
        if (!camera) {
            return false
        }

        call.bindMarkerInteractions()
        state.cameraBridgeBound = true
        return true
    }

export const startCameraLiveSyncLoop = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (state.cameraLiveSyncFrame !== null) {
            return
        }

        const tick = () => {
            state.cameraLiveSyncFrame = null
            if (!state.cameraUserAdjusting && !state.cameraPointerActive) {
                return
            }
            call.updateCameraFromCesiumControls()
            state.cameraLiveSyncFrame = globalThis.__?.requestAnimationFrame?.(tick)
                ?? globalThis.requestAnimationFrame?.(tick)
                ?? null
        }

        state.cameraLiveSyncFrame = globalThis.__?.requestAnimationFrame?.(tick)
            ?? globalThis.requestAnimationFrame?.(tick)
            ?? null
    }

export const stopCameraLiveSyncLoop = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (state.cameraLiveSyncFrame === null) {
            return
        }

        if (globalThis.__?.cancelAnimationFrame) {
            globalThis.__.cancelAnimationFrame(state.cameraLiveSyncFrame)
        }
        else {
            globalThis.cancelAnimationFrame?.(state.cameraLiveSyncFrame)
        }
        state.cameraLiveSyncFrame = null
    }

export const updateCamera = (mode, {
                         sample,
                         progress,
                         forceToleranceRecenter = false,
                         immediateToleranceRecenter = false,
                         source = null,
                         frameTimeMs = null,
                         frameIntervalMs = null,
                         exportMode = false,
                     } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!exportMode && state.replayExportCameraActive) {
            replayVideoTraceDebug('camera.update-skip', {
                reason:        'live-update-during-export',
                logicalTimeMs: null,
                source,
            })
            return
        }
        const settings = getJourneyReplaySettings()
        const viewportRect = call.viewportRectForCesiumSurface()
        const marker = normalizeJourneyReplayMarker(globalThis.lgs?.settings?.ui?.replay?.marker
                                                    ?? globalThis.lgs?.stores?.replay?.marker
                                                    ?? settings.marker)
        if (!sample) {
            if (exportMode) {
                replayVideoTraceDebug('camera.update-skip', {
                    reason:        'no-sample',
                    logicalTimeMs: finiteNumber(frameTimeMs),
                    source,
                })
            }
            return
        }

        if (state.cameraApplyingView) {
            // HQ owns the camera at each export timestamp. A live Cesium
            // flyTo left over from playback must not block subsequent video
            // frames while its wall-clock callback is pending.
            if (exportMode) {
                call.cancelCameraBezierTransition(false)
                replayVideoTraceDebug('camera.update-skip', {
                    reason:        'camera-applying-view-cancelled',
                    logicalTimeMs: finiteNumber(frameTimeMs),
                    source,
                })
            }
            else {
                return
            }
        }

        if (state.cameraUserAdjusting) {
            if (exportMode) {
                replayVideoTraceDebug('camera.update-skip', {
                    reason:        'camera-user-adjusting',
                    logicalTimeMs: finiteNumber(frameTimeMs),
                    source,
                })
            }
            return
        }

        if (globalThis.lgs?.viewer) {
            globalThis.lgs.viewer.trackedEntity = undefined
        }

        if (marker.mode === REPLAY_MARKER_MODE_TRACE) {
            state.cameraMode = marker.mode
            state.cameraFlightActive = false
            state.cameraRedirectState = null
            state.deterministicCameraFollowerAt = null
            state.deterministicCameraFollowerActive = false
            state.deterministicCameraFollowerVelocity = null
            call.removeToleranceZoneOverlay()
            return
        }

        const cameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.settings?.ui?.replay?.camera
                                                           ?? globalThis.lgs?.stores?.replay?.camera
                                                           ?? settings.camera)
        const markerSettings = normalizeJourneyReplayMarker(globalThis.lgs?.settings?.ui?.replay?.marker
                                                            ?? globalThis.lgs?.stores?.replay?.marker
                                                            ?? settings.marker)
        const deterministicCamera = exportMode
        // Use the export timeline as the smoothing clock. Camera orientation
        // must not advance once per callback independently of video time.
        const logicalNow = deterministicCamera
                           ? finiteNumber(frameTimeMs)
                             ?? finiteNumber(sample?.journeyElapsedMillis)
                             ?? call.now()
                           : call.now()
        state.cameraSmoothingDeltaSeconds = deterministicCamera
                                            ? state.lastCameraLogicalNow === null
                                              ? (1 / 30)
                                              : clamp((logicalNow - state.lastCameraLogicalNow) / 1000, 0, 0.25)
                                            : null
        state.lastCameraLogicalNow = deterministicCamera ? logicalNow : null
        if (exportMode || globalThis.lgs?.stores?.ui?.video?.recording === true) {
            call.traceCameraTiming({
                logicalNow,
                exportMode,
                source,
                markerMode: marker.mode,
            })
        }
        const nominalView = call.cameraViewForSample({
                                                          sample,
                                                          progress,
                                                          source: source === 'start' ? 'drawer' : source,
                                                          cameraSettings,
                                                          markerSettings,
                                                      })
        if (!nominalView) {
            return
        }
        if (exportMode || globalThis.lgs?.stores?.ui?.video?.recording === true) {
            call.traceCameraChangeTiming({
                logicalNow,
                exportMode,
                source,
                markerMode:     marker.mode,
                desiredHeading: nominalView.heading,
                desiredPitch:   nominalView.pitch,
            })
        }
        call.rememberNominalCameraView(nominalView)
        const anchorSample = nominalView.sample
        const smoothHeading = nominalView.heading
        const smoothPitch = nominalView.pitch
        const recenterDuration = replayCameraRecenterDuration(cameraSettings.hysteresis.easing)
                                 * (exportMode ? 1.8 : 1)
        const frameLeadSeconds = replayFrameLeadSeconds({
            fps:             globalThis.lgs?.stores?.replay?.captureFps,
            frameIntervalMs,
        })
        const lookaheadSeconds = recenterDuration + frameLeadSeconds
        const futureSample = call.cameraLookaheadSample(anchorSample, {lookaheadSeconds})
        const predictedSample = futureSample ?? anchorSample
        if (deterministicCamera && state.deterministicCameraTransition) {
            call.applyDeterministicCameraTransition(logicalNow)
        }

        const introTransition = state.introHeadingTransition
        if (introTransition) {
            const now = logicalNow
            if (now < introTransition.startAt) {
                return
            }

            if (now < introTransition.endAt) {
                if (!introTransition.applied) {
                    introTransition.applied = true
                    const introCameraSettings = normalizeJourneyReplayCamera({
                        ...cameraSettings,
                        altitudeMode: REPLAY_CAMERA_ALTITUDE_CONSTANT,
                        altitude:     Math.max(10, introTransition.height),
                    })
                    call.recenterCameraToSample({
                        sample:         anchorSample,
                                                     heading: introTransition.targetHeading ?? smoothHeading,
                        pitch:          introTransition.fromPitch,
                        cameraSettings: introCameraSettings,
                        cameraHeight:   Math.max(10, introTransition.height),
                        duration:       REPLAY_HEADING_TRANSITION_DURATION_SECONDS,
                        deterministic:  deterministicCamera,
                        logicalNow,
                    })
                }
                state.lastCameraHeading = smoothHeading
                state.lastCameraPitch = smoothPitch
                return
            }

            state.introHeadingTransition = null
        }

        if (state.cameraMode !== marker.mode) {
            state.cameraMode = marker.mode
            state.cameraFlightActive = false
            state.lastToleranceRecenterAt = null
            state.lastToleranceRecenterProgress = null
            state.lastNavigationRecenterAt = null
            state.lastNavigationRecenterProgress = null
            state.deterministicCameraTransition = null
            state.deterministicCameraFollowerAt = null
            state.deterministicCameraFollowerActive = false
            state.deterministicCameraFollowerVelocity = null
            state.cameraRedirectState = null
        }

        call.updateToleranceZoneOverlay(cameraSettings.hysteresis)

        if (source === 'start' && immediateToleranceRecenter) {
            state.cameraRedirectState = null
            call.applyCameraView({
                anchor: anchorSample,
                heading: smoothHeading,
                pitch:   smoothPitch,
                cameraSettings,
            })
            state.lastCameraHeading = smoothHeading
            state.lastCameraPitch = smoothPitch
            return
        }

        if (marker.mode === REPLAY_MARKER_MODE_NAVIGATION) {
            const runtimeTracking = replayRuntimeTrackingSettings(globalThis.lgs?.settings?.ui?.replay?.camera ?? cameraSettings, viewportRect)
            const navigationCameraSettings = normalizeJourneyReplayCamera({
                ...cameraSettings,
                hysteresis: {
                    ...(cameraSettings.hysteresis ?? {}),
                    zone: runtimeTracking.navigation.triggerZone,
                },
            })
            // Test both positions. In Draft the Cesium projection is updated
            // asynchronously and the predicted sample can briefly project back
            // inside Z1 even though the rendered marker has already left it.
            const currentCollision = call.cameraCollisionForSample(anchorSample, navigationCameraSettings)
            const predictedCollision = call.cameraCollisionForSample(predictedSample, navigationCameraSettings)
            const outsideNavigationZone = Boolean(
                currentCollision?.hard
                || predictedCollision?.hard
                || forceToleranceRecenter,
            )
            const now = logicalNow
            const currentProgress = finiteNumber(progress)
            const navigationRecenterLockMs = Math.max(
                REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS,
                Math.ceil(recenterDuration * 1000) + 180,
            )
            const sameNavigationProgressRecenter = currentProgress !== null
                                                   && state.lastNavigationRecenterProgress !== null
                                                   && state.lastNavigationRecenterAt !== null
                                                   && Math.abs(currentProgress - state.lastNavigationRecenterProgress) <= 0.000001
                                                   && now - state.lastNavigationRecenterAt < 80
            const navigationRecenterStillRunning = state.lastNavigationRecenterAt !== null
                                                   && now - state.lastNavigationRecenterAt < navigationRecenterLockMs
            if ((forceToleranceRecenter || source === 'refresh') && !immediateToleranceRecenter && source !== 'playback' && !exportMode) {
                call.applyCameraView({
                    anchor: anchorSample,
                    heading: smoothHeading,
                    pitch: smoothPitch,
                    cameraSettings,
                })
                state.lastCameraHeading = smoothHeading
                state.lastCameraPitch = smoothPitch
                return
            }
            if (
                !forceToleranceRecenter
                && !immediateToleranceRecenter
                && outsideNavigationZone
                && (sameNavigationProgressRecenter || navigationRecenterStillRunning)
                && !deterministicCamera
            ) {
                state.lastCameraHeading = smoothHeading
                state.lastCameraPitch = smoothPitch
                return
            }
            const navigationFollowerActive = deterministicCamera && state.deterministicCameraFollowerActive
            if (outsideNavigationZone || forceToleranceRecenter || immediateToleranceRecenter || navigationFollowerActive) {
                const navigationTargetSample = !immediateToleranceRecenter && (source === 'playback' || exportMode)
                                               ? predictedSample
                                               : anchorSample
                const navigationTargetView = !immediateToleranceRecenter && navigationTargetSample
                                             ? call.cameraViewForSample({
                                                 sample:         navigationTargetSample,
                                                 progress:       navigationTargetSample.progress ?? progress,
                                                 source,
                                                 cameraSettings,
                                                 markerSettings,
                                                 collision:      true,
                                                 previousHeading: smoothHeading,
                                                 previousPitch:   smoothPitch,
                                             })
                                             : null
                if (immediateToleranceRecenter) {
                    call.applyCameraView({
                        anchor: anchorSample,
                        heading: smoothHeading,
                        pitch:   smoothPitch,
                        cameraSettings,
                    })
                }
                else if (deterministicCamera) {
                    const frame = call.cameraRecenterFrame({
                        sample:         navigationTargetSample,
                        heading:        navigationTargetView?.heading ?? smoothHeading,
                        pitch:          call.liveCameraPitch(navigationTargetView?.pitch ?? smoothPitch),
                        cameraSettings,
                    })
                    if (frame) {
                        state.deterministicCameraTransition = null
                        state.deterministicCameraFollowerActive = true
                        call.applyDeterministicCameraFollower({
                            endFrame:       frame,
                            logicalNow,
                        })
                    }
                }
                else {
                    call.recenterCameraToSample({
                        sample:         navigationTargetSample,
                        heading:        navigationTargetView?.heading ?? smoothHeading,
                        pitch:          call.liveCameraPitch(navigationTargetView?.pitch ?? smoothPitch),
                        cameraSettings,
                        duration:       recenterDuration,
                        deterministic:  deterministicCamera,
                        logicalNow,
                        force:          outsideNavigationZone || forceToleranceRecenter,
                    })
                }
                state.lastNavigationRecenterProgress = currentProgress
                state.lastNavigationRecenterAt = now
            }
            state.lastCameraHeading = smoothHeading
            state.lastCameraPitch = smoothPitch
            return
        }

        if (marker.mode === REPLAY_MARKER_MODE_HYSTERESIS) {
            const runtimeTracking = replayRuntimeTrackingSettings(globalThis.lgs?.settings?.ui?.replay?.camera ?? cameraSettings, viewportRect)
            const dynamicCameraSettings = normalizeJourneyReplayCamera({
                ...cameraSettings,
                hysteresis: {
                    ...(cameraSettings.hysteresis ?? {}),
                    zone: runtimeTracking.dynamic.triggerZone,
                },
            })
            const rect = call.viewportRectForCesiumSurface()
            const currentScreen = call.trackingWindowPositionForSample(anchorSample)
            const hasViewport = (rect?.width ?? 0) > 0 && (rect?.height ?? 0) > 0
            const currentInsideDynamicTriggerZone = hasViewport
                                                    && !replayIsWindowPointOutsideToleranceZone({
                                                                                                    point:  currentScreen,
                                                                                                    width:  rect?.width,
                                                                                                    height: rect?.height,
                                                                                                    zone:   runtimeTracking.dynamic.triggerZone,
                                                                                                })
            const currentInsideDynamicTargetZone = hasViewport
                                                   && !replayIsWindowPointOutsideToleranceZone({
                                                                                                  point:  currentScreen,
                                                                                                  width:  rect?.width,
                                                                                                  height: rect?.height,
                                                                                                  zone:   runtimeTracking.dynamic.targetZone,
                                                                                              })
            // The extended look-ahead is only needed in the ring between Z1
            // and Z2. It protects tight camera angles near the crop edge, but
            // must not perturb a marker that is already safely inside Z2.
            const useExtendedDynamicLookahead = currentInsideDynamicTriggerZone
                                                && !currentInsideDynamicTargetZone
            const dynamicPredictedSample = (source === 'playback' || exportMode)
                                           ? useExtendedDynamicLookahead
                                             ? call.cameraLookaheadSample(anchorSample, {
                                                 lookaheadSeconds: lookaheadSeconds * REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR,
                                             }) ?? predictedSample
                                             : predictedSample ?? anchorSample
                                           : anchorSample
            const trackingSample = dynamicPredictedSample
            const dynamicFollowerActive = deterministicCamera
                                         && state.deterministicCameraFollowerActive
                                         && !state.cameraRedirectState
            if (dynamicFollowerActive) {
                const dynamicTargetView = call.cameraViewForSample({
                    sample:         trackingSample,
                    progress:       trackingSample?.progress ?? progress,
                    source,
                    cameraSettings,
                    markerSettings,
                    previousHeading: smoothHeading,
                    previousPitch:   smoothPitch,
                })
                const frame = call.cameraRecenterFrame({
                    sample:         trackingSample,
                    heading:        dynamicTargetView?.heading ?? smoothHeading,
                    pitch:          call.liveCameraPitch(dynamicTargetView?.pitch ?? smoothPitch),
                    cameraSettings,
                })
                call.applyDeterministicCameraFollower({
                    endFrame:       frame,
                    logicalNow,
                })
            }
            const currentCollision = call.cameraCollisionForSample(anchorSample, dynamicCameraSettings)
            const predictedCollision = call.cameraCollisionForSample(trackingSample, dynamicCameraSettings)
            const outsideTolerance = Boolean(currentCollision?.hard || predictedCollision?.hard)
            const dynamicTargetCameraSettings = normalizeJourneyReplayCamera({
                ...cameraSettings,
                hysteresis: {
                    ...(cameraSettings.hysteresis ?? {}),
                    zone: runtimeTracking.dynamic.targetZone,
                },
            })
            const targetCollision = call.cameraCollisionForSample(trackingSample, dynamicTargetCameraSettings)
            const outsideDynamicTargetZone = Boolean(targetCollision?.hard)
            const predictedScreen = call.trackingWindowPositionForSample(trackingSample)
            const dynamicTargetScreen = replayDynamicTargetPointInZone({
                currentPoint:    currentScreen,
                predictedPoint:  predictedScreen,
                viewportWidth:   rect?.width,
                viewportHeight:  rect?.height,
                zone:            runtimeTracking.dynamic.targetZone,
            })
            const nominalCurrentVisible = call.cameraViewVisibilityForSample({
                                                                                  nominalView,
                                                                                  futureSample: null,
                                                                                  source,
                                                                                  cameraSettings,
                                                                                  markerSettings,
                                                                              })
            const nominalPredictedVisible = futureSample
                                            ? call.cameraViewVisibilityForSample({
                                                                                      nominalView,
                                                                                      futureSample,
                                                                                      source,
                                                                                      cameraSettings,
                                                                                      markerSettings,
                                                                                  })
                                            : nominalCurrentVisible
            const nominalVisible = nominalCurrentVisible && nominalPredictedVisible
            const redirectedCurrentVisible = state.cameraRedirectState
                                             ? call.cameraViewVisibilityForSample({
                                                                                       nominalView,
                                                                                       redirectState: state.cameraRedirectState,
                                                                                       futureSample:  null,
                                                                                       source,
                                                                                       cameraSettings,
                                                                                       markerSettings,
                                                                                   })
                                             : false
            const redirectedVisible = state.cameraRedirectState
                                      ? call.cameraViewVisibilityForSample({
                                                                                nominalView,
                                                                                redirectState: state.cameraRedirectState,
                                                                                futureSample,
                                                                                source,
                                                                                cameraSettings,
                                                                                markerSettings,
                                                                            })
                                      : false
            const renderedVisible = call.renderedTraceVisibleForSample(anchorSample)
            const renderedOccluded = renderedVisible === false
            // Dynamic tracking is governed by Z1. Visibility corrections inside
            // Z1 were causing a new flight to be issued on almost every update,
            // especially in Draft where depth is noisier than in HQ export.
            const needsVisibilityCorrection = outsideTolerance && (
                renderedOccluded
                || (renderedVisible === null && !nominalCurrentVisible)
            )
            const now = logicalNow
            const currentProgress = finiteNumber(progress)
            const toleranceRecenterLockMs = Math.max(
                REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS,
                Math.ceil(recenterDuration * 1000) + 180,
            )
            const sameProgressRecenter = currentProgress !== null
                                         && state.lastToleranceRecenterProgress !== null
                                         && state.lastToleranceRecenterAt !== null
                                         && Math.abs(currentProgress - state.lastToleranceRecenterProgress) <= 0.000001
                                         && now - state.lastToleranceRecenterAt < 80
            const activeRecenterStillFresh = state.lastToleranceRecenterAt !== null
                                            && now - state.lastToleranceRecenterAt < toleranceRecenterLockMs
            // Once the previous easing has completed, also validate the
            // promised Z2 landing zone. This catches the closed-pitch case
            // where the marker continues to the crop edge during the flight.
            const targetCorrectionDue = outsideDynamicTargetZone
                                        && state.lastToleranceRecenterAt !== null
                                        && now - state.lastToleranceRecenterAt >= Math.ceil(recenterDuration * 1000)
            if (
                !forceToleranceRecenter
                && !immediateToleranceRecenter
                && (sameProgressRecenter || activeRecenterStillFresh)
                && (outsideTolerance || needsVisibilityCorrection)
                && !targetCorrectionDue
                && !deterministicCamera
            ) {
                state.lastCameraHeading = smoothHeading
                state.lastCameraPitch = smoothPitch
                return
            }
            if (!outsideTolerance && !targetCorrectionDue && !forceToleranceRecenter && !immediateToleranceRecenter) {
                state.lastToleranceRecenterProgress = null
                if (!needsVisibilityCorrection) {
                    if (state.cameraRedirectState && nominalVisible) {
                        state.cameraRedirectState = null
                        if (deterministicCamera) {
                            const frame = call.cameraRecenterFrame({
                                sample:         anchorSample,
                                heading:        nominalView.heading,
                                pitch:          nominalView.pitch,
                                cameraSettings,
                            })
                            state.deterministicCameraFollowerActive = true
                            call.applyDeterministicCameraFollower({
                                endFrame:       frame,
                                logicalNow,
                            })
                        }
                        else {
                            call.recenterCameraToSample({
                                                             sample:   anchorSample,
                                                             heading:  nominalView.heading,
                                                             pitch:    nominalView.pitch,
                                                             cameraSettings,
                                                             duration: CAMERA_REDIRECT_MAX_TRANSITION_SECONDS,
                                                             deterministic: deterministicCamera,
                                                             logicalNow,
                                                         })
                        }
                    }
                    state.lastCameraHeading = smoothHeading
                    state.lastCameraPitch = smoothPitch
                    return
                }

                let redirectView = redirectedVisible && state.cameraRedirectState
                                   ? call.cameraViewWithRedirectState(nominalView, state.cameraRedirectState)
                                   : null
                if (!redirectView) {
                    state.cameraRedirectState = call.findCameraRedirectState({
                                                                                  nominalView,
                                                                                  futureSample,
                                                                                  source,
                                                                                  cameraSettings,
                                                                                  markerSettings,
                                                                                  reuseCurrentIfVisible: false,
                                                                              }) ?? call.findCameraRedirectState({
                                                                                                                      nominalView,
                                                                                                                      futureSample:          null,
                                                                                                                      source,
                                                                                                                      cameraSettings,
                                                                                                                      markerSettings,
                                                                                                                      reuseCurrentIfVisible: false,
                                                                                                                  })
                    redirectView = state.cameraRedirectState
                                   ? call.cameraViewWithRedirectState(nominalView, state.cameraRedirectState)
                                   : null
                }

                if (redirectView) {
                    if (redirectedCurrentVisible) {
                        call.applyCameraView({
                                                  anchor:  redirectView.sample,
                                                  heading: redirectView.heading,
                                                  pitch:   redirectView.pitch,
                                                  cameraSettings,
                                              })
                    }
                    else {
                        call.recenterCameraToSample({
                                                         sample:   redirectView.sample,
                                                         heading:  redirectView.heading,
                                                         pitch:    redirectView.pitch,
                                                         cameraSettings,
                                                         duration: CAMERA_REDIRECT_MAX_TRANSITION_SECONDS,
                                                         deterministic: deterministicCamera,
                                                         logicalNow,
                                                     })
                    }
                }
                state.lastCameraHeading = smoothHeading
                state.lastCameraPitch = smoothPitch
                return
            }
            if (
                !forceToleranceRecenter
                && !immediateToleranceRecenter
                && outsideTolerance
                && (sameProgressRecenter || activeRecenterStillFresh)
            ) {
                state.lastCameraHeading = smoothHeading
                state.lastCameraPitch = smoothPitch
                return
            }

            if (outsideTolerance || targetCorrectionDue || needsVisibilityCorrection || forceToleranceRecenter || immediateToleranceRecenter) {
                const canUseNominalView = !renderedOccluded && nominalCurrentVisible
                let targetView = canUseNominalView ? nominalView : null
                let nextRedirectState = canUseNominalView ? null : state.cameraRedirectState

                if (!targetView && redirectedVisible && state.cameraRedirectState) {
                    targetView = call.cameraViewWithRedirectState(nominalView, state.cameraRedirectState)
                }

                if (!targetView) {
                    nextRedirectState = call.findCameraRedirectState({
                                                                          nominalView,
                                                                          futureSample,
                                                                          source,
                                                                          cameraSettings,
                                                                          markerSettings,
                                                                          reuseCurrentIfVisible: false,
                                                                      }) ?? call.findCameraRedirectState({
                                                                                                              nominalView,
                                                                                                              futureSample:          null,
                                                                                                              source,
                                                                                                              cameraSettings,
                                                                                                              markerSettings,
                                                                                                              reuseCurrentIfVisible: false,
                                                                                                          })
                    if (nextRedirectState) {
                        targetView = call.cameraViewWithRedirectState(nominalView, nextRedirectState)
                    }
                }

                if (!targetView) {
                    targetView = nominalView
                    nextRedirectState = null
                }

                const useRedirectTransition = nextRedirectState !== null
                state.cameraRedirectState = nextRedirectState
                const targetSample = (outsideTolerance || targetCorrectionDue) && !useRedirectTransition
                                     ? trackingSample
                                     : targetView.sample
                const targetNominalView = !useRedirectTransition
                                          ? call.cameraViewForSample({
                                              sample:         targetSample,
                                              progress:       targetSample?.progress ?? progress,
                                              source,
                                              cameraSettings,
                                              markerSettings,
                                              collision:      outsideTolerance || targetCorrectionDue,
                                              previousHeading: smoothHeading,
                                              previousPitch:   smoothPitch,
                                          })
                                          : null
                const targetHeading = useRedirectTransition
                                      ? targetView.heading
                                      : targetNominalView?.heading ?? targetView.heading
                const targetPitch = useRedirectTransition
                                    ? targetView.pitch
                                    : call.liveCameraPitch(targetNominalView?.pitch ?? smoothPitch)
                if (deterministicCamera && !useRedirectTransition && !immediateToleranceRecenter) {
                    const frame = call.cameraRecenterFrame({
                        sample:         targetSample,
                        heading:        targetHeading,
                        pitch:          targetPitch,
                        cameraSettings,
                    })
                    state.deterministicCameraTransition = null
                    state.deterministicCameraFollowerActive = true
                    call.applyDeterministicCameraFollower({
                        endFrame:       frame,
                        logicalNow,
                    })
                }
                else {
                    if (useRedirectTransition) {
                        state.deterministicCameraFollowerActive = false
                        state.deterministicCameraFollowerAt = null
                        state.deterministicCameraFollowerVelocity = null
                    }
                    call.recenterCameraToSample({
                                                 // Predictive target: when Z1 is
                                                 // crossed, place the future
                                                 // marker inside Z2 (the centre
                                                 // is a valid point in Z2) so
                                                 // the next few frames do not
                                                 // immediately trigger another
                                                 // correction.
                                                 sample:  targetSample,
                                                 heading: targetView.heading,
                                                 pitch:   targetPitch,
                    cameraSettings,
                    duration: immediateToleranceRecenter
                              ? 0
                              : useRedirectTransition
                                ? Math.min(
                                CAMERA_REDIRECT_MAX_TRANSITION_SECONDS,
                                replayCameraRecenterDuration(cameraSettings.hysteresis.easing),
                            )
                                : replayCameraRecenterDuration(cameraSettings.hysteresis.easing),
                    deterministic: deterministicCamera,
                    logicalNow,
                    })
                }
                state.lastToleranceRecenterProgress = currentProgress
                state.lastToleranceRecenterAt = now
                state.lastDynamicTargetScreen = dynamicTargetScreen
            }
            state.lastCameraHeading = smoothHeading
            state.lastCameraPitch = smoothPitch
        }
    }
