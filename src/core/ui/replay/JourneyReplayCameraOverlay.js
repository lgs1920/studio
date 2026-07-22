/**
 * Replay camera Overlay behavior.
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
    recenterCameraToSample,
    startCameraTransition,
    bindMarkerInteractions,
    bindCesiumCameraBridge,
    startCameraLiveSyncLoop,
    stopCameraLiveSyncLoop,
    updateCamera,
} from './JourneyReplayCameraBinding'

export const removeToleranceZoneOverlay = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        state.toleranceZoneOverlay?.remove?.()
        state.toleranceZoneOverlay = null
    }

    /**
     * Toggle the diagnostic Z1/Z2 overlay without changing the tracking
     * algorithm.
     */

export const setToleranceZoneOverlayVisible = (mode, visible = true) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        state.toleranceZoneOverlayVisible = visible === true
        if (!state.toleranceZoneOverlayVisible) {
            if (state.toleranceZoneOverlay) {
                state.toleranceZoneOverlay.hidden = true
                state.toleranceZoneOverlay.style.display = 'none'
            }
            return false
        }

        if (state.lastToleranceZoneHysteresis) {
            call.updateToleranceZoneOverlay(state.lastToleranceZoneHysteresis)
        }
        return true
    }

export const cameraAnglePreviewEntityCollection = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return globalThis.lgs?.viewer?.entities ?? null
}

export const removeCameraAnglePreviewOverlay = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const entities = state.cameraAnglePreviewEntities
        const collection = call.cameraAnglePreviewEntityCollection()
        if (entities && collection) {
            collection.remove?.(entities.axis)
            collection.remove?.(entities.axisEndIcon)
            collection.remove?.(entities.angle)
            collection.remove?.(entities.cameraIcon)
        }
        state.cameraAnglePreviewEntities = null
    }

export const cameraAnglePreviewPOIIds = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const journey = state.sampler?.journey ?? globalThis.lgs?.theJourney ?? null
        const tracks = Array.from(journey?.tracks?.values?.() ?? [])
        if (tracks.length === 0) {
            return []
        }

        const firstTrack = tracks[0]
        const lastTrack = tracks[tracks.length - 1]
        return Array.from(new Set([
            firstTrack?.flags?.start,
            lastTrack?.flags?.stop,
        ].filter(Boolean)))
    }

export const cameraAnglePreviewPOIForId = (mode, poiId) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
        ?? globalThis.__?.ui?.poiManager?.get?.(poiId)
        ?? null
}

export const hideCameraAnglePreviewPOIs = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        for (const poiId of call.cameraAnglePreviewPOIIds()) {
            const poi = call.cameraAnglePreviewPOIForId(poiId)
            if (!poi?.id) {
                continue
            }

            if (!state.cameraAnglePreviewPOIVisibilityState.has(poi.id)) {
                state.cameraAnglePreviewPOIVisibilityState.set(poi.id, {
                    visible: call.isPOIVisibleBeforePlayback(poi),
                })
            }

            poi.visible = false
            call.setPOIEntityVisibility(poi, false)
        }
    }

export const restoreCameraAnglePreviewPOIs = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        for (const [poiId, poiState] of state.cameraAnglePreviewPOIVisibilityState.entries()) {
            const poi = call.cameraAnglePreviewPOIForId(poiId)
            if (!poi?.id) {
                continue
            }

            poi.visible = poiState?.visible === true
            call.setPOIEntityVisibility(poi, poiState?.visible === true)
        }

        state.cameraAnglePreviewPOIVisibilityState.clear()
    }

export const cameraAnglePreviewStartHeading = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const sampler = state.sampler
        if (!sampler?.hasSamples) {
            return 0
        }

        const previewSamples = sampler?.samples?.slice?.(0, 6) ?? []
        if (previewSamples.length < 2) {
            return 0
        }

        const current = previewSamples[0]
        const future = previewSamples[previewSamples.length - 1]
        const heading = call.headingBetweenPoints(current, future)
        return Number.isFinite(heading) ? heading : 0
    }

export const showCameraAnglePreviewOverlay = (mode, {
                                          displayOffset = 0,
                                          positionMode = REPLAY_CAMERA_POSITION_SYSTEM,
                                          fillColor = null,
                                          borderColor = null,
                                      } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        call.removeCameraAnglePreviewOverlay()
        const viewer = globalThis.lgs?.viewer
        const sampler = state.sampler
        const entities = viewer?.entities ?? null
        if (!viewer || !entities || positionMode === REPLAY_CAMERA_POSITION_SYSTEM || !sampler?.hasSamples) {
            return
        }

        const sample = sampler.atProgress?.(0)
        const anchor = safeCartesianFromLonLat(sample)
        if (!anchor) {
            return
        }

        const traceHeading = call.cameraAnglePreviewStartHeading()
        const baseHeading = positionMode === REPLAY_CAMERA_POSITION_AHEAD
                            ? traceHeading
                            : traceHeading + Math.PI
        const localTransform = Transforms.eastNorthUpToFixedFrame(anchor)
        const offsetDegrees = clamp(finiteNumber(displayOffset) ?? 0, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_HEADING_OFFSET_MAX)
        const offsetRadians = CesiumMath.toRadians(offsetDegrees)
        const axisHeading = baseHeading
        const angleHeading = baseHeading + (finiteNumber(offsetRadians) ?? 0)
        const axisEnd = Matrix4.multiplyByPoint(localTransform, new Cartesian3(
            Math.sin(axisHeading) * CAMERA_ANGLE_PREVIEW_AXIS_LENGTH,
            Math.cos(axisHeading) * CAMERA_ANGLE_PREVIEW_AXIS_LENGTH,
            0,
        ), new Cartesian3())
        const angleEnd = Matrix4.multiplyByPoint(localTransform, new Cartesian3(
            Math.sin(angleHeading) * CAMERA_ANGLE_PREVIEW_OFFSET_LENGTH,
            Math.cos(angleHeading) * CAMERA_ANGLE_PREVIEW_OFFSET_LENGTH,
            0,
        ), new Cartesian3())
        const followTerrain = true
        const markerColorCss = globalThis.lgs?.theTrack?.marker?.foregroundColor
                               ?? globalThis.lgs?.theTrack?.marker?.color
                               ?? normalizeJourneyReplayProgressionStyle(
                                   globalThis.lgs?.stores?.replay?.progression ?? getJourneyReplaySettings()?.progression,
                               ).fill.color
                               ?? fillColor
                               ?? borderColor
                               ?? '#4f7cff'
        const markerColor = Color.fromCssColorString(markerColorCss) ?? Color.WHITE
        const axis = entities.add({
            id:       `replay-camera-angle-preview-axis-${state.sampler?.journey?.slug ?? 'current'}`,
            name:     'JourneyReplay camera angle axis',
            polyline: {
                positions:     [anchor, axisEnd],
                width:         4,
                material:      markerColor,
                clampToGround: followTerrain,
                arcType:       followTerrain ? ArcType.GEODESIC : ArcType.NONE,
            },
            show: true,
        })
        const axisEndIcon = entities.add({
            id:       `replay-camera-angle-preview-axis-end-${state.sampler?.journey?.slug ?? 'current'}`,
            name:     'JourneyReplay journey axis end',
            position: axisEnd,
            billboard: {
                image:            makeFontAwesomeIconDataUri(resolveJourneyActivityIcon(state.sampler?.journey), markerColorCss, CAMERA_ANGLE_PREVIEW_ICON_SIZE),
                width:            CAMERA_ANGLE_PREVIEW_ICON_SIZE,
                height:           CAMERA_ANGLE_PREVIEW_ICON_SIZE,
                horizontalOrigin: HorizontalOrigin.CENTER,
                verticalOrigin:   VerticalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                heightReference:  followTerrain ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE,
                pixelOffset:      new Cartesian2(18, 0),
            },
            show: true,
        })
        const angle = entities.add({
            id:       `replay-camera-angle-preview-angle-${state.sampler?.journey?.slug ?? 'current'}`,
            name:     'JourneyReplay camera angle offset',
            polyline: {
                positions:     [anchor, angleEnd],
                width:         1.5,
                material:      new PolylineDashMaterialProperty({
                    color:       markerColor,
                    gapColor:    Color.TRANSPARENT,
                    dashLength:  18,
                    dashPattern: 255,
                }),
                clampToGround: followTerrain,
                arcType:       followTerrain ? ArcType.GEODESIC : ArcType.NONE,
            },
            show: true,
        })
        const cameraIcon = Math.abs(offsetDegrees) > 0.0001
            ? entities.add({
                id:       `replay-camera-angle-preview-camera-${state.sampler?.journey?.slug ?? 'current'}`,
                name:     'JourneyReplay camera angle camera',
                position: angleEnd,
                billboard: {
                    image:            makeFontAwesomeIconDataUri(faCamera, markerColorCss, CAMERA_ANGLE_PREVIEW_ICON_SIZE),
                    width:            CAMERA_ANGLE_PREVIEW_ICON_SIZE,
                    height:           CAMERA_ANGLE_PREVIEW_ICON_SIZE,
                    horizontalOrigin: HorizontalOrigin.CENTER,
                    verticalOrigin:   VerticalOrigin.CENTER,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: followTerrain ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE,
                    pixelOffset:      new Cartesian2(18, 0),
                },
                show: true,
            })
            : null
        state.cameraAnglePreviewEntities = {
            axis,
            axisEndIcon,
            angle,
            cameraIcon,
        }
        globalThis.lgs?.scene?.requestRender?.()
        call.hideCameraAnglePreviewPOIs()
    }

export const hideCameraAnglePreviewOverlay = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        call.removeCameraAnglePreviewOverlay()
        call.restoreCameraAnglePreviewPOIs()
    }

export const videoCropRect = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const replayStore = globalThis.lgs?.stores?.replay
        const cropRect = replayStore.videoCropRect
        const left = finiteNumber(cropRect?.left)
        const top = finiteNumber(cropRect?.top)
        const width = finiteNumber(cropRect?.width)
        const height = finiteNumber(cropRect?.height)
        if (
            left === null
            || top === null
            || width === null
            || height === null
            || width <= 0
            || height <= 0
        ) {
            return null
        }

        return {
            left,
            top,
            width,
            height,
        }
    }

export const viewportRectForCesiumSurface = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const cropRect = call.videoCropRect()
        if (cropRect) {
            return cropRect
        }

        const viewer = globalThis.lgs?.viewer
        const scene = call.cesiumScene()
        const canvas = viewer?.canvas ?? scene?.canvas ?? globalThis.lgs?.canvas
        const rect = canvas?.getBoundingClientRect?.()
        return {
            left:   finiteNumber(rect?.left) ?? 0,
            top:    finiteNumber(rect?.top) ?? 0,
            width:  finiteNumber(rect?.width)
                    ?? finiteNumber(canvas?.clientWidth)
                    ?? finiteNumber(viewer?.container?.clientWidth)
                    ?? finiteNumber(globalThis.innerWidth)
                    ?? 0,
            height: finiteNumber(rect?.height)
                    ?? finiteNumber(canvas?.clientHeight)
                    ?? finiteNumber(viewer?.container?.clientHeight)
                    ?? finiteNumber(globalThis.innerHeight)
                    ?? 0,
        }
    }

export const updateToleranceZoneOverlay =  (mode, hysteresis) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        state.lastToleranceZoneHysteresis = hysteresis
        call.removeToleranceZoneOverlay()
        const viewer = globalThis.lgs?.viewer
        const container = viewer?.container ?? globalThis.document?.body ?? null
        if (!viewer || !container || !hysteresis) {
            return
        }

        const replaySettings = getJourneyReplaySettings()
        // The application settings are the source of truth for the runtime-only
        // tracking mode. The store may still contain the previous persisted mode
        // while a Draft recording is being armed.
        const marker = normalizeJourneyReplayMarker(globalThis.lgs?.settings?.ui?.replay?.marker
                                                     ?? globalThis.lgs?.stores?.replay?.marker
                                                     ?? replaySettings.marker)
        const cameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.settings?.ui?.replay?.camera
                                                            ?? globalThis.lgs?.stores?.replay?.camera
                                                            ?? replaySettings.camera)
        const rect = call.viewportRectForCesiumSurface()
        const runtimeTracking = replayRuntimeTrackingSettings(globalThis.lgs?.settings?.ui?.replay?.camera ?? cameraSettings, rect)
        const outerBounds = marker.mode === REPLAY_MARKER_MODE_NAVIGATION
                            ? replayToleranceZoneBounds(runtimeTracking.navigation.triggerZone)
                            : marker.mode === REPLAY_MARKER_MODE_HYSTERESIS
                              ? replayToleranceZoneBounds(runtimeTracking.dynamic.triggerZone)
                              : replayToleranceZoneBounds(hysteresis?.zone)
        const innerBounds = marker.mode === REPLAY_MARKER_MODE_HYSTERESIS
                            ? replayToleranceZoneBounds(runtimeTracking.dynamic.targetZone)
                            : null
        if (!rect.width || !rect.height) {
            return
        }

        const overlay = globalThis.document.createElement('div')
        overlay.className = 'replay-tolerance-zone-overlay'
        overlay.hidden = !state.toleranceZoneOverlayVisible
        overlay.dataset.mode = marker.mode
        overlay.style.position = 'absolute'
        overlay.style.pointerEvents = 'none'
        overlay.style.display = state.toleranceZoneOverlayVisible ? '' : 'none'
        overlay.style.left = `${rect.left + (outerBounds.left * rect.width)}px`
        overlay.style.top = `${rect.top + (outerBounds.top * rect.height)}px`
        overlay.style.width = `${(outerBounds.right - outerBounds.left) * rect.width}px`
        overlay.style.height = `${(outerBounds.bottom - outerBounds.top) * rect.height}px`
        overlay.style.background = marker.mode === REPLAY_MARKER_MODE_NAVIGATION
                                   ? 'rgba(0, 128, 255, 0.08)'
                                   : 'rgba(255, 0, 0, 0.08)'

        const outer = globalThis.document.createElement('div')
        outer.className = 'replay-tolerance-zone-overlay-outer'
        outer.dataset.zone = 'z1'
        outer.style.position = 'absolute'
        outer.style.inset = '0'
        outer.style.border = '1px solid rgba(255, 255, 255, 0.7)'

        overlay.append(outer)
        if (innerBounds) {
            const inner = globalThis.document.createElement('div')
            inner.className = 'replay-tolerance-zone-overlay-inner'
            inner.dataset.zone = 'z2'
            inner.style.position = 'absolute'
            inner.style.left = `${((innerBounds.left - outerBounds.left) / (outerBounds.right - outerBounds.left)) * 100}%`
            inner.style.top = `${((innerBounds.top - outerBounds.top) / (outerBounds.bottom - outerBounds.top)) * 100}%`
            inner.style.width = `${((innerBounds.right - innerBounds.left) / (outerBounds.right - outerBounds.left)) * 100}%`
            inner.style.height = `${((innerBounds.bottom - innerBounds.top) / (outerBounds.bottom - outerBounds.top)) * 100}%`
            inner.style.border = '1px dashed rgba(255, 255, 255, 0.45)'
            overlay.append(inner)
        }
        container.appendChild(overlay)
        state.toleranceZoneOverlay = overlay
    }

