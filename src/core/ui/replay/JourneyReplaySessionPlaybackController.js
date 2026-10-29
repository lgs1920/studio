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
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {captureReplayEntryCameraState, replayOwnedCameraFor} from './ReplayCameraOwnership'
import {replayCameraFor} from './ReplayRenderTarget'
import {
    createBasicReplayTraceFocusClips,
    BASIC_REPLAY_TRACE_FOCUS_INSTANCE_ID,
} from './JourneyReplayBasicFocus'
import {getBasicReplaySettings} from './ReplayModeSettings'
import {fixPathRevisionKey} from '@Utils/cesium/fixPathCorrections'


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
    currentBasicReplaySettingsForJourney,
    flushJourneyReplayCameraPersistence,
    flushJourneyReplayStartPositionPersistence,
    journeyReplayStartPosition,
    syncJourneyReplayStartPosition,
}                                                                                          from './ReplayUserModes'
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
    isJourneyReplayCameraActive, isJourneyReplayTraceActive, publishReplayClipFrameState, replayStore, resetRuntimeProgress,
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
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForAngle, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, radiansToDegrees, safeCartesianFromLonLat, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
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
    REPLAY_INITIAL_CAMERA_ANGLE, REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION,
    REPLAY_MARKER_MODE_TRACE, getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker,
    normalizeJourneyReplayProgressionStyle, normalizeJourneyReplayReadiness, normalizeJourneyReplaySmoothing, normalizeJourneyReplayTrace,
}                                                                                          from './JourneyReplayProgressionStyle'

/**
 * Seed a journey's first Replay camera from the live Cesium pose.
 *
 * @param {Object} mode - Replay session mode.
 * @param {Object} journey - Journey whose Replay settings are initialized.
 * @returns {boolean} Whether the camera settings were seeded.
 */
const seedReplayCameraFromCesium = (mode, journey) => {
    const basicMode = isJourneyReplayBasicMode()
    const savedCamera = basicMode
        ? getBasicReplaySettings(journey?.replay)?.camera
        : journey?.replay?.expert?.camera ?? journey?.replay?.camera
    const hasSavedValue = key => {
        const value = key === 'altitude'
            ? savedCamera?.altitude ?? savedCamera?.groundOffset
            : savedCamera?.[key]
        return value !== null && value !== undefined && Number.isFinite(Number(value))
    }
    const hasSavedAngle = hasSavedValue('cameraAngle')
        || ['ahead', 'behind'].includes(savedCamera?.positionMode)
    const hasSavedCameraValue = key => key === 'cameraAngle' ? hasSavedAngle : hasSavedValue(key)
    if (['altitude', 'pitch', 'cameraAngle'].every(hasSavedCameraValue)) {
        return false
    }

    const camera = replayCameraFor(mode)
    const currentSettings = currentJourneyReplayCameraSettings({journey})
    const height = finiteNumber(camera?.positionCartographic?.height)
    const pitch = finiteNumber(camera?.pitch)
    const altitudeIsSaved = hasSavedValue('altitude')
    const pitchIsSaved = hasSavedValue('pitch')
    if (!altitudeIsSaved && height === null && !pitchIsSaved && pitch === null) {
        return false
    }

    const seededCamera = normalizeJourneyReplayCamera({
        ...currentSettings,
        altitude: altitudeIsSaved ? currentSettings.altitude : height ?? currentSettings.altitude,
        altitudeMode: altitudeIsSaved ? currentSettings.altitudeMode : REPLAY_CAMERA_ALTITUDE_CONSTANT,
        cameraAngle: hasSavedAngle
            ? currentSettings.cameraAngle
            : REPLAY_INITIAL_CAMERA_ANGLE,
        debug: basicMode ? false : currentSettings.debug,
        pitch: pitchIsSaved || pitch === null ? currentSettings.pitch : radiansToDegrees(pitch),
    })

    mode[JOURNEY_REPLAY_INTERNAL_CALL].persistCameraSettings(seededCamera, {journey})
    return true
}

/**
 * Save the current departure marker position as a fraction of the active crop.
 *
 * @param {Object} mode - Replay session.
 * @param {Object} journey - Journey receiving the saved position.
 * @param {Object} sample - Canonical departure sample.
 * @returns {{x: number, y: number}|null} Saved crop-relative position.
 */
const persistReplayStartPositionFromCamera = (mode, journey, sample) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const point = call.trackingWindowPositionForSample?.(sample)
    const viewport = call.viewportRectForCesiumSurface?.()
    if (!point || !(viewport?.width > 0) || !(viewport?.height > 0)) {
        return null
    }

    return syncJourneyReplayStartPosition({
        x: point.x / viewport.width,
        y: point.y / viewport.height,
    }, journey, isJourneyReplayBasicMode() ? 'basic' : 'expert')
}

/**
 * Trace configured zoom values against the physical camera pose at a boundary.
 *
 * @param {object} options - Replay boundary context.
 * @param {object} options.mode - Replay session mode.
 * @param {object|null} options.journey - Active journey.
 * @param {object|null} options.sample - Rendered marker sample.
 * @param {object|null} options.cameraSettings - Resolved Replay camera settings.
 * @param {string} options.boundary - Preparation, playback, or export boundary.
 * @returns {void} No return value.
 */
const traceReplayCameraTransfer = ({mode, journey, sample, cameraSettings, boundary}) => {
    const camera = replayCameraFor(mode)
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const target = sample ? call.markerRenderCartesianForSample?.(sample) : null
    const cameraPosition = camera?.positionWC ?? camera?.position
    const cameraTargetRange = cameraPosition && target
        ? Cartesian3.distance(cameraPosition, target)
        : null

    replayVideoTraceDebug('replay.camera.transfer', {
        boundary,
        journeySlug: journey?.slug ?? null,
        mode: isJourneyReplayBasicMode() ? 'basic' : 'expert',
        configured: {
            altitude: cameraSettings?.altitude ?? null,
            altitudeMode: cameraSettings?.altitudeMode ?? null,
            pitch: cameraSettings?.pitch ?? null,
            cameraAngle: cameraSettings?.cameraAngle ?? null,
        },
        cesium: {
            height: finiteNumber(camera?.positionCartographic?.height),
            pitch: camera?.pitch === undefined ? null : CesiumMath.toDegrees(camera.pitch),
            targetRangeMeters: cameraTargetRange,
        },
    })
}

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
 * Ensure enabled Replay diagnostics are visible before linked playback or
 * export starts.
 *
 * @param {object} mode - Replay mode.
 * @returns {boolean} Whether Replay diagnostics were enabled.
 */
const ensureReplayVideoDiagnosticsOverlay = mode => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!call.isReplayVideoLinked()) {
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
        const basicReplay = isJourneyReplayBasicMode()
        const includeHiddenTracks = basicReplay
            ? false
            : options.includeHiddenTracks ?? false
        const scope = REPLAY_SCOPE_ALL_TRACKS
        const trackSlug = options.trackSlug ?? globalThis.lgs?.theTrack?.slug ?? store?.trackSlug
        const progression = options.progression ?? replay.progression
        const profileInfo = options.profileInfo ?? replay.profileInfo
        const trace = options.trace ?? replay.trace
        const smoothing = normalizeJourneyReplaySmoothing(options.smoothing ?? replay.smoothing)
        const marker = options.marker ?? replay.marker
        const camera = basicReplay
            ? store?.basicPreparationActive === true
                ? currentJourneyReplayCameraSettings({journey})
                : replay.camera
            : options.camera ?? replay.camera
        const readiness = normalizeJourneyReplayReadiness(basicReplay
            ? {...replay.readiness, enabled: false, prewarmEnabled: false}
            : options.readiness ?? replay.readiness)
        const samplerConfigKey = [
            call.samplerConfigurationKey({
                journey,
                scope,
                trackSlug,
                includeHiddenTracks,
                smoothing,
            }),
            fixPathRevisionKey(journey),
        ].join('|')
        const resolvedClips = resolveJourneyReplayRuntimeClips({
            clips:         options.clips,
            settingsClips: replay.clips,
            journey,
        })
        const clips = basicReplay
            ? createBasicReplayTraceFocusClips(
                camera,
                currentBasicReplaySettingsForJourney(journey).endFocus,
            )
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

        if (basicReplay) {
            call.syncRuntimeNearbyPOIs(journey)
        }

        state.controller.configure({
            sampler:    state.sampler,
            duration:   options.duration ?? replay.duration ?? store?.duration ?? DEFAULT_DURATION,
            direction:  1,
            loop:       options.loop ?? replay.loop ?? store?.loop ?? false,
            progress:   options.progress ?? store?.progress ?? 0,
            clips,
            captureFps: options.captureFps ?? store?.captureFps ?? 30,
            replaySettings: replay,
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
    // Let Cesium finish a queued wheel gesture before reading its prepared pose.
    const pendingCameraGesture = state.preparationCameraGesturePromise
    if (pendingCameraGesture) {
        if (await pendingCameraGesture === false) {
            return false
        }
    }
    // A deferred export must not reuse the entry pose from an earlier playback.
    state.replayEntryCameraState = null
    call.updateCameraFromCesiumControls?.({journey})
    const store = replayStore()
    const basicPreparation = isJourneyReplayBasicMode()
        && (store?.basicPreparationActive === true
            || globalThis.lgs?.stores?.ui?.video?.editing === true)
    // configure() rebuilds the sampler and also hydrates runtime settings. Keep
    // the camera that the user just prepared across that hydration boundary.
    let preparedBasicCamera = basicPreparation && store?.camera
        ? normalizeJourneyReplayCamera(store.camera)
        : null
    const sampler = call.configure({journey, progress: 0})
    const sample = sampler?.atProgress?.(0) ?? null
    if (!sample) {
        return false
    }
    state.replayPreparationSample = sample

    const replayPreparationActive = store?.basicPreparationActive === true
        || globalThis.lgs?.stores?.ui?.video?.editing === true
    if (replayPreparationActive && seedReplayCameraFromCesium(mode, journey) && basicPreparation) {
        preparedBasicCamera = store?.camera
            ? normalizeJourneyReplayCamera(store.camera)
            : null
    }

    const replaySettings = getJourneyReplaySettings({journey})
    const cameraSettings = preparedBasicCamera ?? currentJourneyReplayCameraSettings({journey})
    if (preparedBasicCamera && store) {
        store.camera = cameraSettings
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
    // Commit the validated Basic preparation before capture changes UI phases.
    // Later configuration reads must resolve the same values after its runtime
    // preparation flag is released, rather than an older journey baseline.
    if (isJourneyReplayBasicMode()) {
        call.persistCameraSettings(cameraSettings, {journey})
    }
    await flushJourneyReplayCameraPersistence(journey)
    if (replayPreparationActive) {
        state.replayEntryCameraState = captureReplayEntryCameraState(replayCameraFor(mode))
        traceReplayCameraTransfer({
            mode,
            journey,
            sample,
            cameraSettings: currentJourneyReplayCameraSettings({journey}),
            boundary: 'preparation-ready',
        })
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

    const basicPreparation = isJourneyReplayBasicMode()
    if (basicPreparation) {
        call.hideOtherJourneysVisibility()
    }

    JourneyReplayVisibilityController.hideJourneyReplayPOIsForPreparation(mode)

    const prepared = await prepareReplayCamera(mode, {journey})
    const preparationSucceeded = prepared === true && isCurrentTransition()
    if (preparationSucceeded) {
        const camera = globalThis.lgs?.viewer?.camera ?? globalThis.lgs?.camera
        const sample = state.replayPreparationSample
        // Keep the original map pose for leaving preparation, then use the same
        // route-aligned view that playback applies at progress zero.
        if (sample && camera) {
            if (!state.preparationExitCameraState) {
                state.preparationExitCameraState = call.captureCameraSnapshot?.({camera}) ?? null
            }
            const replayMode = isJourneyReplayBasicMode() ? 'basic' : 'expert'
            const savedStartPosition = journeyReplayStartPosition(journey, replayMode)
            // Capture the departure's existing screen placement before the Replay
            // framing changes the live Cesium camera. Each Journey owns this value.
            const startPosition = savedStartPosition
                ?? persistReplayStartPositionFromCamera(mode, journey, sample)
            call.placeCameraAtPlaybackStart?.(sample, 0, {
                desiredPosition: startPosition,
                journey,
            })
            await flushJourneyReplayStartPositionPersistence(journey)
            state.replayEntryCameraState = captureReplayEntryCameraState(camera)
            traceReplayCameraTransfer({
                mode,
                journey,
                sample,
                cameraSettings: currentJourneyReplayCameraSettings({journey}),
                boundary: 'preparation-framed',
            })
            call.cesiumScene?.()?.requestRender?.()
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
    call.cancelPreparationCameraGesture?.()

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

    const preparationExitCameraState = state.preparationExitCameraState
    const ownedCamera = replayOwnedCameraFor(mode)
    const mainCamera = globalThis.lgs?.viewer?.camera ?? globalThis.lgs?.camera
    let restored = ownedCamera ? call.restoreCameraState?.() === true : false
    if (preparationExitCameraState) {
        restored = call.restoreCameraState?.({
            cameraState: preparationExitCameraState,
            targetCamera: mainCamera,
        }) === true || restored
    }
    else if (!ownedCamera) {
        restored = call.restoreCameraState?.() === true
    }
    call.stopReplayCameraAltitudeTracking?.()
    state.replayCameraPrepared = false
    state.replayPreparationSample = null
    state.replayEntryCameraState = null
    state.savedCameraState = null
    state.preparationExitCameraState = null
    return restored
}

/**
 * Start playback after any pending preparation zoom has settled and persisted.
 *
 * @param {Object} mode - Replay session.
 * @param {Object} options - Journey and playback options.
 * @returns {Object|Promise<Object|null>|null} First sample, or deferred startup for a pending gesture.
 */
export const start = (mode, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const journey = options.journey ?? currentReplayJourney()
    if (!journey) {
        return null
    }
    const pendingCameraGesture = state.preparationCameraGesturePromise
    if (pendingCameraGesture) {
        const token = ++state.clipSequenceToken
        const selectedJourney = currentReplayJourney()
        // Keep Cesium input alive until it settles. Stop/disposal invalidates
        // this request before a playback camera lease can be acquired.
        return pendingCameraGesture.then(settled => {
            if (settled === false || token !== state.clipSequenceToken
                || selectedJourney !== currentReplayJourney()) {
                return null
            }
            return call.start({...options, journey})
        })
    }
    call.updateCameraFromCesiumControls?.({journey})
    call.cancelPreparationCameraGesture?.()
    const preparedReplayCameraState = state.replayCameraPrepared
        ? captureReplayEntryCameraState(replayCameraFor(mode))
        : null
    if (preparedReplayCameraState) {
        traceReplayCameraTransfer({
            mode,
            journey,
            sample: state.replayPreparationSample ?? state.sampler?.atProgress?.(0) ?? null,
            cameraSettings: currentJourneyReplayCameraSettings({journey}),
            boundary: 'playback-start',
        })
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
    const preparedCameraStore = replayStore()
    const preserveBasicPreparationCamera = isJourneyReplayBasicMode()
        && (preparedCameraStore?.basicPreparationActive === true
            || globalThis.lgs?.stores?.ui?.video?.editing === true)
    const preparedBasicCamera = preserveBasicPreparationCamera && preparedCameraStore?.camera
        ? normalizeJourneyReplayCamera(preparedCameraStore.camera)
        : null
    traceStartStep('configure.begin')
    const sampler = call.configure(options)
    if (preparedBasicCamera) {
        preparedCameraStore.camera = preparedBasicCamera
    }
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
        const startProgress = clamp(finiteNumber(options.progress) ?? 0, 0, 1)
        const startSample = sampler.atProgress?.(startProgress)
        call.captureCameraState({sample: startSample})
        seedReplayCameraFromCesium(mode, journey)
        void globalThis.__?.ui?.cameraManager?.stopRotate?.()
        call.setJourneyReplayOrbitAllowed(false)
        call.restoreOtherJourneysVisibility({respectReplaySetting: false})
        call.restoreJourneyReplayPOIVisibility()
        call.hideCurrentJourneyVisibility()
        if (shouldHideOtherJourneys) {
            call.hideOtherJourneysVisibility()
        }
        const restoredPreparedCamera = preparedReplayCameraState
            && call.restoreCameraState({clear: false, cameraState: preparedReplayCameraState})
        if (restoredPreparedCamera) {
            // Preparation already owns the exact crop and zoom. Reconstructing
            // the frame here can translate the camera and change its range.
            state.preserveStartCameraComposition = true
            state.replayEntryCameraState = preparedReplayCameraState
            persistReplayStartPositionFromCamera(mode, journey, startSample)
        }
        else {
            call.placeCameraAtPlaybackStart(startSample, startProgress, {
                preserveScreenPosition: true,
                desiredPosition: journeyReplayStartPosition(journey, isJourneyReplayBasicMode() ? 'basic' : 'expert'),
                journey,
            })
            state.replayEntryCameraState = captureReplayEntryCameraState(replayCameraFor(mode))
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
                targetHeading: call.introHeadingForProgress(startProgress),
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
                progress: startProgress,
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
                    // Do not compile the constrained camera path synchronously here.
                    // That bulk compilation freezes Interactive and Replay export startup.
                    traceStartStep('controller.start.begin', {phase: 'start-clips'})
                    startResult = state.controller.start({
                        progress: startProgress,
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
            traceStartStep('place-camera-at-playback-start.end')
            // Do not compile the constrained camera path synchronously here.
            // That bulk compilation freezes Interactive and Replay export startup.
            traceStartStep('controller.start.begin', {phase: 'no-start-clips'})
            startResult = state.controller.start({
                progress: startProgress,
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
        const preparedCameraStore = replayStore()
        const preserveBasicPreparationCamera = isJourneyReplayBasicMode()
            && (preparedCameraStore?.basicPreparationActive === true
                || globalThis.lgs?.stores?.ui?.video?.editing === true)
        const preparedBasicCamera = preserveBasicPreparationCamera && preparedCameraStore?.camera
            ? normalizeJourneyReplayCamera(preparedCameraStore.camera)
            : null
        const sampler = call.configure({
            journey,
            progress: safeProgress,
        }) ?? state.sampler
        if (preparedBasicCamera) {
            preparedCameraStore.camera = preparedBasicCamera
        }
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
            call.placeCameraAtPlaybackStart(sample, safeProgress, {
                preserveScreenPosition: true,
                desiredPosition: journeyReplayStartPosition(journey, isJourneyReplayBasicMode() ? 'basic' : 'expert'),
                journey,
            })
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
                call.placeCameraAtPlaybackStart(sample, safeProgress, {
                    preserveScreenPosition: true,
                    desiredPosition: journeyReplayStartPosition(journey, isJourneyReplayBasicMode() ? 'basic' : 'expert'),
                    journey,
                })
            }
        }

        state.replayEntryCameraState = captureReplayEntryCameraState(replayCameraFor(mode))
        traceReplayCameraTransfer({
            mode,
            journey,
            sample,
            cameraSettings: currentJourneyReplayCameraSettings({journey}),
            boundary: 'export-entry',
        })
        call.startReplayCameraAltitudeTracking()

        // Do not compile the constrained camera path synchronously during export preparation.
        // Export preparation must return control to the fixed-frame renderer immediately.

        call.setJourneyReplayOrbitAllowed(false)
        call.restoreOtherJourneysVisibility({respectReplaySetting: false})
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
        if (hideReplayMarker) {
            state.renderer.hideCursor?.()
        }

        const runtimeStore = replayStore()
        if (runtimeStore) {
            runtimeStore.toolbarVisible = true
            runtimeStore.mainUiHidden = true
            runtimeStore.clipSequenceActive = true
        }
        // Complete POI preparation before the first fixed frame can choose its phase.
        await call.prepareNearbyPOIsForPlayback()
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
                syncCursorToTrace: true,
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
                call.recordReplayCameraAltitude?.()
            }
        }
        return sample
    }

/**
 * Refresh the configured departure guide and, when preparation is active, its camera.
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

    if (state.preparationExitCameraState
        && globalThis.lgs?.stores?.ui?.video?.editing === true
        && !replayOwnedCameraFor(mode)) {
        call.placeCameraAtPlaybackStart?.(sample, 0, {
            preserveScreenPosition: true,
            journey: currentReplayJourney(),
        })
    }

    if (options.source === 'keyboard') {
        call.persistCameraSettings?.(cameraSettings)
    }
    call.cesiumScene?.()?.requestRender?.()
    return true
}

/**
 * Apply explicit preparation controls through the session's persistence and camera boundary.
 *
 * @param {Object} mode - Replay session.
 * @param {Object} updates - Prepared camera settings to merge.
 * @returns {Object|null} Saved pose, or null outside idle video preparation.
 */
export const updatePreparationCamera = (mode, updates) => {
    const video = globalThis.lgs?.stores?.ui?.video
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (!state.preparationExitCameraState || video?.editing !== true
        || video.preRecording || video.exporting || video.snapshot || video.finalizing
        || isJourneyReplayCameraActive(globalThis.lgs?.stores?.replay)
        || replayOwnedCameraFor(mode)) {
        return null
    }

    call.cancelPreparationCameraGesture?.()
    const camera = call.persistCameraSettings?.(updates)
    if (camera) {
        refreshCamera(mode, {preparation: true, suppressMoveEvents: true, source: 'preparation-joystick'})
    }
    return camera ?? null
}

export const refreshCamera = (mode, options = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const journey = globalThis.lgs?.theJourney
            ?? globalThis.lgs?.stores?.main?.theJourney
        let sample = null
        const preparationCameraActive = state.preparationExitCameraState
            && globalThis.lgs?.stores?.ui?.video?.editing === true
            && !replayOwnedCameraFor(mode)
        if (options.preparation === true || preparationCameraActive) {
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
        call.cancelPreparationCameraGesture?.()
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

/**
 * Render one deterministic export frame while keeping the camera synchronized.
 * Dry runs keep every logical update but use the interactive trace geometry cadence.
 *
 * @param {object} mode - Replay session facade.
 * @param {object} options - Frame rendering inputs.
 * @param {object|null} options.phase - Resolved export phase.
 * @param {object|null} options.frame - Source timeline frame.
 * @param {object|null} options.controller - Active export controller.
 * @param {object} options.resolvedSample - Sample resolved for this frame.
 * @param {boolean} options.dryRun - Whether to throttle trace geometry updates.
 * @returns {Promise<object|null>} Resolved journey sample for the frame.
 */
export const renderReplayExportFrame = async (mode, {
    phase = null,
    frame = null,
    controller = mode[JOURNEY_REPLAY_INTERNAL_STATE].controller,
    resolvedSample = undefined,
    dryRun = false,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
        const activeController = controller ?? state.controller
        const replayPhase = phase?.kind === 'replay' || !phase?.clip
        const isDryRunBoundary = frame?.isFirst === true
                                 || frame?.isLast === true
                                 || phase?.isFinalSceneFrame === true
                                 || phase?.isLastPhaseFrame === true
        const forceTraceGeometry = dryRun !== true || isDryRunBoundary
        const progress = clamp(finiteNumber(phase?.progress) ?? activeController?.progress ?? 0, 0, 1)
        const anchorProgress = clamp(finiteNumber(phase?.anchorProgress) ?? progress, 0, 1)

        if (replayPhase) {
            state.renderingReplayExportFrame = true
            let sample = null
            try {
                sample = activeController?.seek?.(progress, resolvedSample)
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
                    // Dry runs preserve frame state while following the interactive geometry cadence.
                    forceGeometry: forceTraceGeometry,
                    allowPlaybackGeometryUpdate: dryRun === true,
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
                    source: 'replay-export',
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
                call.recordReplayCameraAltitude()
                await call.syncNearbyPOIsForSample(sample)
                if (typeof call.currentReplayClipCameraState === 'function') {
                    state.clipCameraContinuity = call.currentReplayClipCameraState({
                        sample,
                    })
                }
            }
            return sample
        }

        // Export phase changes do not emit the interactive end event that closes POIs.
        await call.closeJourneyReplayOpenedPOIsBeforeStopClips?.()
        call.applyJourneyReplayPOIVisibility?.()
        state.renderingReplayExportFrame = true
        let sample = null
        try {
            sample = activeController?.seek?.(anchorProgress, resolvedSample)
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
        if (phase?.clip?.id === BASIC_REPLAY_TRACE_FOCUS_INSTANCE_ID) {
            call.stopReplayCameraAltitudeTracking()
        }
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
                forceGeometry:         forceTraceGeometry,
                allowPlaybackGeometryUpdate: dryRun === true,
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
