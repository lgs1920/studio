/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayMode.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-17
 * Last modified: 2026-07-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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
    currentJourneyReplayPoiBehavior, currentJourneyReplaySample, finiteNumber, publishReplayClipFrameState,
    replayStore, resetRuntimeProgress, resolveJourneyReplayRuntimeClips,
} from './JourneyReplayRuntime'
import * as JourneyReplayCameraController from './JourneyReplayCameraController'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import * as JourneyReplayVisibilityController from './JourneyReplayVisibilityController'
import * as JourneyReplayClipController from './JourneyReplayClipController'
import * as JourneyReplaySessionPlaybackController from './JourneyReplaySessionPlaybackController'
import * as JourneyReplaySessionPOIController from './JourneyReplaySessionPOIController'
import * as JourneyReplaySessionSceneController from './JourneyReplaySessionSceneController'
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

const DEFAULT_DURATION = 60
const PROFILE_HOVER_RENDER_INTERVAL = 120
const METRIC_OVERLAY_TTL = 2000
const REPLAY_HEADING_TRANSITION_DURATION_SECONDS = 2
const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)

/**
 * Clone a replay camera state before exposing it to another rendering path.
 *
 * @param {Object|null} cameraState - Camera state captured at replay entry.
 * @returns {Object|null} An immutable-by-convention camera state snapshot.
 */
const cloneReplayCameraState = cameraState => {
    if (!cameraState || typeof cameraState !== 'object') {
        return null
    }

    return {
        destination: {
            ...cameraState.destination,
        },
        orientation: {
            ...cameraState.orientation,
        },
        altitude: cameraState.altitude,
    }
}

const CAMERA_GUIDE_MIN_STEPS = 512
const CAMERA_GUIDE_MAX_STEPS = 4096
const CAMERA_GUIDE_TARGET_SPACING_METERS = 12
const CAMERA_GUIDE_TURN_STEP_RADIANS = Math.PI / 18
const CARTESIAN_EPSILON = 1e-7
const CAMERA_HEADING_HYSTERESIS_RADIANS = CesiumMath.toRadians(12)
const CAMERA_HEADING_LOOKAHEAD_PROGRESS = 0.16
const CAMERA_HEADING_MIN_CHANGE_RADIANS = CesiumMath.toRadians(5)
const CAMERA_RASANT_PITCH_LIMIT_RADIANS = CesiumMath.toRadians(-5)
const CAMERA_RASANT_PITCH_RELEASE_RADIANS = CesiumMath.toRadians(-35)
const CAMERA_VIEW_POSITION_EPSILON_METERS = 0.5
const CAMERA_VIEW_ANGLE_EPSILON_RADIANS = CesiumMath.toRadians(0.25)
const CAMERA_TIMING_START_ANGLE_RADIANS = CesiumMath.toRadians(2)
const CAMERA_TIMING_SETTLE_ANGLE_RADIANS = CesiumMath.toRadians(0.75)
const CAMERA_DETERMINISTIC_FOLLOW_RESPONSE_SECONDS = 1.5
const CAMERA_UPDATE_MIN_PROGRESS_DELTA = 0.0005
const CAMERA_REDIRECT_MAX_TRANSITION_SECONDS = 1
const CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS = 120
const CAMERA_REDIRECT_TRACE_VISIBILITY_OFFSETS_METERS = Object.freeze([6, 12, 18, 24])
const CAMERA_REDIRECT_REQUIRED_TRACE_OFFSET_METERS = 12
const CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS = 11
const CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS = 3
const CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS = 8
const REPLAY_TOLERANCE_OUTER_INSET_RATIO = 0.05
const REPLAY_TOLERANCE_INNER_INSET_RATIO = 0.2
const REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS = 300
const REPLAY_TRACKING_NAVIGATION_ZONE_RATIO = 0.3
const REPLAY_TRACKING_NAVIGATION_NARROW_CROP_RATIO = 0.75
const REPLAY_TRACKING_NAVIGATION_NARROW_ZONE_RATIO = 0.22
const REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO = 0.75
const REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO = 0.3
// Dynamic recentering must lead the marker beyond the nominal easing duration:
// a closed pitch can keep the marker moving toward the crop edge while the
// camera is still interpolating.
const REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR = 1.35
const REPLAY_POI_TRIGGER_EPSILON_METERS = 0.001
const REPLAY_POI_TRIGGER_SCAN_MARGIN_METERS = 5
const CAMERA_ANGLE_PREVIEW_AXIS_LENGTH = 1800
const CAMERA_ANGLE_PREVIEW_OFFSET_LENGTH = 1800
const CAMERA_ANGLE_PREVIEW_ICON_SIZE = 24
export const REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT = 'lgs:replay:journey-toolbar-visibility'
export const REPLAY_EVENT_STOP_CLIPS_COMPLETE = 'replay/stop-clips-complete'

const CAMERA_REDIRECT_CANDIDATES = Object.freeze([
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -4},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -6},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -10},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -14},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -18},
                                                     {headingOffsetDeg: 8, pitchOffsetDeg: 0},
                                                     {headingOffsetDeg: -8, pitchOffsetDeg: 0},
                                                     {headingOffsetDeg: 16, pitchOffsetDeg: 0},
                                                     {headingOffsetDeg: -16, pitchOffsetDeg: 0},
                                                     {headingOffsetDeg: 8, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: -8, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: 16, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: -16, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: 24, pitchOffsetDeg: -10},
                                                     {headingOffsetDeg: -24, pitchOffsetDeg: -10},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -20},
                                                 ])

const isUsableCartesian3 = value => Boolean(value)
    && [value.x, value.y, value.z].every(component => Number.isFinite(component))
    && Cartesian3.magnitudeSquared(value) > CARTESIAN_EPSILON

const safeCartesian3Normalize = (value, fallback) => {
    if (isUsableCartesian3(value)) {
        return Cartesian3.normalize(value, new Cartesian3())
    }

    return isUsableCartesian3(fallback) ? Cartesian3.clone(fallback, new Cartesian3()) : null
}
const safeCartesian3Lerp = (left, right, ratio, result = new Cartesian3()) => {
    if (!isUsableCartesian3(left)) {
        return isUsableCartesian3(right) ? Cartesian3.clone(right, result) : null
    }
    if (!isUsableCartesian3(right)) {
        return Cartesian3.clone(left, result)
    }

    return Cartesian3.lerp(left, right, ratio, result)
}

const makeFontAwesomeIconDataUri = (definition, color, size = 24) => {
    const [width, height, , , pathData] = definition.icon
    const paths = (Array.isArray(pathData) ? pathData : [pathData]).filter(Boolean)
    const scale = Math.min((size * 0.78) / width, (size * 0.78) / height)
    const x = (size - width * scale) / 2
    const y = (size - height * scale) / 2
    const fill = `${color ?? '#ffffff'}`
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <g transform="translate(${x} ${y}) scale(${scale})">
                ${paths.map(path => `<path d="${path}" fill="${fill}"/>`).join('')}
            </g>
        </svg>
    `.trim()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const resolveJourneyActivityIcon = (journey = null) => {
    const activityIcon = Journey.activityProfile(journey?.activity, journey?.activitySettings)?.icon
    return activityIcon === 'person-hiking' ? faPersonHiking : faPersonHiking
}

export {replayPitchLookaheadFactor} from './JourneyReplayCameraMath'
export * from './JourneyReplayCameraMath'

export class JourneyReplaySessionController {
    #controller
    #renderer
    #sampler = null
    #samplerConfigKey = null
    #unbind = []
    #requestRenderMode = null
    #pendingProfileHoverSample = null
    #profileHoverTimeout = null
    #lastProfileHoverRender = 0
    #cameraGuide = null
    #cameraGuideSourceKey = null
    #cameraGuidePositionProperty = null
    #cameraGuidePositionPropertyKey = null
    #constrainedReplayCameraPath = null
    #cameraMode = null
    #cameraFlightActive = false
    #logicalCameraTrajectory = false
    #replayExportClipFrameState = null
    #renderingReplayExportFrame = false
    #cameraBezierFrame = null
    #cameraBezierResolve = null
    #deterministicCameraTransition = null
    #deterministicCameraFollowerAt = null
    #deterministicCameraFollowerActive = false
    #deterministicCameraFollowerVelocity = null
    #cameraSmoothingDeltaSeconds = null
    #lastCameraLogicalNow = null
    #lastCameraTimingLogicalNow = null
    #lastCameraTimingWallNow = null
    #cameraTimingChange = null
    #savedCameraState = null
    #replayEntryCameraState = null
    #playbackStartCameraSettings = null
    #cameraStateRestoredBeforeSceneCleanup = false
    #deferPlaybackCameraRestore = false
    #suppressPlaybackCameraSync = false
    #terrainHeightLookupBypass = false
    #terrainHeightLookupTrace = false
    #replayDrawerWasOpenBeforePlayback = false
    #lastCameraHeading = null
    #lastCameraPitch = null
    #lastNominalCameraHeading = null
    #lastNominalCameraPitch = null
    #lastAppliedCameraView = null
    #lastReplayLogicalFrame = null
    #cameraRedirectState = null
    #cameraUserAdjusting = false
    #cameraApplyingView = false
    #replayExportCameraActive = false
    #cameraPointerActive = false
    #cameraManualInteractionTimer = null
    #cameraAutoTrackingIgnoreUntil = 0
    #lastToleranceRecenterAt = null
    #lastToleranceRecenterProgress = null
    #lastNavigationRecenterAt = null
    #lastNavigationRecenterProgress = null
    #toleranceZoneOverlayCanvas = null
    #toleranceZoneOverlayCameraChangedRemove = null
    #lastDynamicTargetScreen = null
    #skipNextImmediateStartRecenter = false
    #toleranceZoneOverlay = null
    #toleranceZoneOverlayVisible = true
    #lastToleranceZoneHysteresis = null
    #cameraAnglePreviewEntities = null
    #cameraAnglePreviewPOIVisibilityState = new Map()
    #journeyToolbarWasVisible = null
    #journeyToolbarHidden = false
    #hiddenJourneyVisibility = new Map()
    #hiddenCurrentJourneyPolylines = new Map()
    #deferStartCameraRecenter = false
    #introHeadingTransition = null
    #cameraBridgeBound = false
    #cameraLiveSyncFrame = null
    #clipSequenceToken = 0
    #sceneRestoreDeferred = false
    #sceneRestorePromise = null
    #replayPoiExpandedState = new Map()
    #replayPoiCollapseTimers = new Map()
    #replayPoiTriggered = new Set()
    #replayPOIVisibilityState = new Map()
    #stopClipPOIMaskFrame = null
    #lastJourneyReplayPoiDistance = null
    #lastJourneyReplayPoiCursor = 0
    #lastPlaybackUpdateProgressKey = null
    #sortedNearbyPois = []

    constructor({
                    controller = new JourneyReplayPlaybackController(),
                    renderer = new JourneyReplayCesiumRenderer(),
                } = {}) {
        this[JOURNEY_REPLAY_INTERNAL_STATE] = {}
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'controller', {
            configurable: true,
            get: () => this.#controller,
            set: value => {
                this.#controller = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'renderer', {
            configurable: true,
            get: () => this.#renderer,
            set: value => {
                this.#renderer = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'sampler', {
            configurable: true,
            get: () => this.#sampler,
            set: value => {
                this.#sampler = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'samplerConfigKey', {
            configurable: true,
            get: () => this.#samplerConfigKey,
            set: value => {
                this.#samplerConfigKey = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'unbind', {
            configurable: true,
            get: () => this.#unbind,
            set: value => {
                this.#unbind = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'requestRenderMode', {
            configurable: true,
            get: () => this.#requestRenderMode,
            set: value => {
                this.#requestRenderMode = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'pendingProfileHoverSample', {
            configurable: true,
            get: () => this.#pendingProfileHoverSample,
            set: value => {
                this.#pendingProfileHoverSample = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'profileHoverTimeout', {
            configurable: true,
            get: () => this.#profileHoverTimeout,
            set: value => {
                this.#profileHoverTimeout = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastProfileHoverRender', {
            configurable: true,
            get: () => this.#lastProfileHoverRender,
            set: value => {
                this.#lastProfileHoverRender = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraGuide', {
            configurable: true,
            get: () => this.#cameraGuide,
            set: value => {
                this.#cameraGuide = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraGuideSourceKey', {
            configurable: true,
            get: () => this.#cameraGuideSourceKey,
            set: value => {
                this.#cameraGuideSourceKey = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraGuidePositionProperty', {
            configurable: true,
            get: () => this.#cameraGuidePositionProperty,
            set: value => {
                this.#cameraGuidePositionProperty = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraGuidePositionPropertyKey', {
            configurable: true,
            get: () => this.#cameraGuidePositionPropertyKey,
            set: value => {
                this.#cameraGuidePositionPropertyKey = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'constrainedReplayCameraPath', {
            configurable: true,
            get: () => this.#constrainedReplayCameraPath,
            set: value => {
                this.#constrainedReplayCameraPath = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraMode', {
            configurable: true,
            get: () => this.#cameraMode,
            set: value => {
                this.#cameraMode = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraFlightActive', {
            configurable: true,
            get: () => this.#cameraFlightActive,
            set: value => {
                this.#cameraFlightActive = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'logicalCameraTrajectory', {
            configurable: true,
            get: () => this.#logicalCameraTrajectory,
            set: value => {
                this.#logicalCameraTrajectory = value === true
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'replayExportClipFrameState', {
            configurable: true,
            get: () => this.#replayExportClipFrameState,
            set: value => {
                this.#replayExportClipFrameState = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'renderingReplayExportFrame', {
            configurable: true,
            get: () => this.#renderingReplayExportFrame,
            set: value => {
                this.#renderingReplayExportFrame = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraBezierFrame', {
            configurable: true,
            get: () => this.#cameraBezierFrame,
            set: value => {
                this.#cameraBezierFrame = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraBezierResolve', {
            configurable: true,
            get: () => this.#cameraBezierResolve,
            set: value => {
                this.#cameraBezierResolve = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'deterministicCameraTransition', {
            configurable: true,
            get: () => this.#deterministicCameraTransition,
            set: value => {
                this.#deterministicCameraTransition = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'deterministicCameraFollowerAt', {
            configurable: true,
            get: () => this.#deterministicCameraFollowerAt,
            set: value => {
                this.#deterministicCameraFollowerAt = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'deterministicCameraFollowerActive', {
            configurable: true,
            get: () => this.#deterministicCameraFollowerActive,
            set: value => {
                this.#deterministicCameraFollowerActive = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'deterministicCameraFollowerVelocity', {
            configurable: true,
            get: () => this.#deterministicCameraFollowerVelocity,
            set: value => {
                this.#deterministicCameraFollowerVelocity = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraSmoothingDeltaSeconds', {
            configurable: true,
            get: () => this.#cameraSmoothingDeltaSeconds,
            set: value => {
                this.#cameraSmoothingDeltaSeconds = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastCameraLogicalNow', {
            configurable: true,
            get: () => this.#lastCameraLogicalNow,
            set: value => {
                this.#lastCameraLogicalNow = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastCameraTimingLogicalNow', {
            configurable: true,
            get: () => this.#lastCameraTimingLogicalNow,
            set: value => {
                this.#lastCameraTimingLogicalNow = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastCameraTimingWallNow', {
            configurable: true,
            get: () => this.#lastCameraTimingWallNow,
            set: value => {
                this.#lastCameraTimingWallNow = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraTimingChange', {
            configurable: true,
            get: () => this.#cameraTimingChange,
            set: value => {
                this.#cameraTimingChange = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'savedCameraState', {
            configurable: true,
            get: () => this.#savedCameraState,
            set: value => {
                this.#savedCameraState = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'playbackStartCameraSettings', {
            configurable: true,
            get: () => this.#playbackStartCameraSettings,
            set: value => {
                this.#playbackStartCameraSettings = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraStateRestoredBeforeSceneCleanup', {
            configurable: true,
            get: () => this.#cameraStateRestoredBeforeSceneCleanup,
            set: value => {
                this.#cameraStateRestoredBeforeSceneCleanup = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'deferPlaybackCameraRestore', {
            configurable: true,
            get: () => this.#deferPlaybackCameraRestore,
            set: value => {
                this.#deferPlaybackCameraRestore = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'suppressPlaybackCameraSync', {
            configurable: true,
            get: () => this.#suppressPlaybackCameraSync,
            set: value => {
                this.#suppressPlaybackCameraSync = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'terrainHeightLookupBypass', {
            configurable: true,
            get: () => this.#terrainHeightLookupBypass,
            set: value => {
                this.#terrainHeightLookupBypass = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'terrainHeightLookupTrace', {
            configurable: true,
            get: () => this.#terrainHeightLookupTrace,
            set: value => {
                this.#terrainHeightLookupTrace = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'replayDrawerWasOpenBeforePlayback', {
            configurable: true,
            get: () => this.#replayDrawerWasOpenBeforePlayback,
            set: value => {
                this.#replayDrawerWasOpenBeforePlayback = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastCameraHeading', {
            configurable: true,
            get: () => this.#lastCameraHeading,
            set: value => {
                this.#lastCameraHeading = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastCameraPitch', {
            configurable: true,
            get: () => this.#lastCameraPitch,
            set: value => {
                this.#lastCameraPitch = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastNominalCameraHeading', {
            configurable: true,
            get: () => this.#lastNominalCameraHeading,
            set: value => {
                this.#lastNominalCameraHeading = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastNominalCameraPitch', {
            configurable: true,
            get: () => this.#lastNominalCameraPitch,
            set: value => {
                this.#lastNominalCameraPitch = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastAppliedCameraView', {
            configurable: true,
            get: () => this.#lastAppliedCameraView,
            set: value => {
                this.#lastAppliedCameraView = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastReplayLogicalFrame', {
            configurable: true,
            get: () => this.#lastReplayLogicalFrame,
            set: value => {
                this.#lastReplayLogicalFrame = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraRedirectState', {
            configurable: true,
            get: () => this.#cameraRedirectState,
            set: value => {
                this.#cameraRedirectState = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraUserAdjusting', {
            configurable: true,
            get: () => this.#cameraUserAdjusting,
            set: value => {
                this.#cameraUserAdjusting = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraApplyingView', {
            configurable: true,
            get: () => this.#cameraApplyingView,
            set: value => {
                this.#cameraApplyingView = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'replayExportCameraActive', {
            configurable: true,
            get: () => this.#replayExportCameraActive,
            set: value => {
                this.#replayExportCameraActive = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraPointerActive', {
            configurable: true,
            get: () => this.#cameraPointerActive,
            set: value => {
                this.#cameraPointerActive = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraManualInteractionTimer', {
            configurable: true,
            get: () => this.#cameraManualInteractionTimer,
            set: value => {
                this.#cameraManualInteractionTimer = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraAutoTrackingIgnoreUntil', {
            configurable: true,
            get: () => this.#cameraAutoTrackingIgnoreUntil,
            set: value => {
                this.#cameraAutoTrackingIgnoreUntil = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastToleranceRecenterAt', {
            configurable: true,
            get: () => this.#lastToleranceRecenterAt,
            set: value => {
                this.#lastToleranceRecenterAt = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastToleranceRecenterProgress', {
            configurable: true,
            get: () => this.#lastToleranceRecenterProgress,
            set: value => {
                this.#lastToleranceRecenterProgress = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastNavigationRecenterAt', {
            configurable: true,
            get: () => this.#lastNavigationRecenterAt,
            set: value => {
                this.#lastNavigationRecenterAt = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastNavigationRecenterProgress', {
            configurable: true,
            get: () => this.#lastNavigationRecenterProgress,
            set: value => {
                this.#lastNavigationRecenterProgress = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastDynamicTargetScreen', {
            configurable: true,
            get: () => this.#lastDynamicTargetScreen,
            set: value => {
                this.#lastDynamicTargetScreen = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'skipNextImmediateStartRecenter', {
            configurable: true,
            get: () => this.#skipNextImmediateStartRecenter,
            set: value => {
                this.#skipNextImmediateStartRecenter = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'toleranceZoneOverlay', {
            configurable: true,
            get: () => this.#toleranceZoneOverlay,
            set: value => {
                this.#toleranceZoneOverlay = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'toleranceZoneOverlayCanvas', {
            configurable: true,
            get: () => this.#toleranceZoneOverlayCanvas,
            set: value => {
                this.#toleranceZoneOverlayCanvas = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'toleranceZoneOverlayCameraChangedRemove', {
            configurable: true,
            get: () => this.#toleranceZoneOverlayCameraChangedRemove,
            set: value => {
                this.#toleranceZoneOverlayCameraChangedRemove = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'toleranceZoneOverlayVisible', {
            configurable: true,
            get: () => this.#toleranceZoneOverlayVisible,
            set: value => {
                this.#toleranceZoneOverlayVisible = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastToleranceZoneHysteresis', {
            configurable: true,
            get: () => this.#lastToleranceZoneHysteresis,
            set: value => {
                this.#lastToleranceZoneHysteresis = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraAnglePreviewEntities', {
            configurable: true,
            get: () => this.#cameraAnglePreviewEntities,
            set: value => {
                this.#cameraAnglePreviewEntities = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraAnglePreviewPOIVisibilityState', {
            configurable: true,
            get: () => this.#cameraAnglePreviewPOIVisibilityState,
            set: value => {
                this.#cameraAnglePreviewPOIVisibilityState = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'journeyToolbarWasVisible', {
            configurable: true,
            get: () => this.#journeyToolbarWasVisible,
            set: value => {
                this.#journeyToolbarWasVisible = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'journeyToolbarHidden', {
            configurable: true,
            get: () => this.#journeyToolbarHidden,
            set: value => {
                this.#journeyToolbarHidden = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'hiddenJourneyVisibility', {
            configurable: true,
            get: () => this.#hiddenJourneyVisibility,
            set: value => {
                this.#hiddenJourneyVisibility = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'hiddenCurrentJourneyPolylines', {
            configurable: true,
            get: () => this.#hiddenCurrentJourneyPolylines,
            set: value => {
                this.#hiddenCurrentJourneyPolylines = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'deferStartCameraRecenter', {
            configurable: true,
            get: () => this.#deferStartCameraRecenter,
            set: value => {
                this.#deferStartCameraRecenter = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'introHeadingTransition', {
            configurable: true,
            get: () => this.#introHeadingTransition,
            set: value => {
                this.#introHeadingTransition = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraBridgeBound', {
            configurable: true,
            get: () => this.#cameraBridgeBound,
            set: value => {
                this.#cameraBridgeBound = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'cameraLiveSyncFrame', {
            configurable: true,
            get: () => this.#cameraLiveSyncFrame,
            set: value => {
                this.#cameraLiveSyncFrame = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'clipSequenceToken', {
            configurable: true,
            get: () => this.#clipSequenceToken,
            set: value => {
                this.#clipSequenceToken = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'sceneRestoreDeferred', {
            configurable: true,
            get: () => this.#sceneRestoreDeferred,
            set: value => {
                this.#sceneRestoreDeferred = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'sceneRestorePromise', {
            configurable: true,
            get: () => this.#sceneRestorePromise,
            set: value => {
                this.#sceneRestorePromise = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'replayEntryCameraState', {
            configurable: true,
            get: () => this.#replayEntryCameraState,
            set: value => {
                this.#replayEntryCameraState = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'replayPoiExpandedState', {
            configurable: true,
            get: () => this.#replayPoiExpandedState,
            set: value => {
                this.#replayPoiExpandedState = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'replayPoiCollapseTimers', {
            configurable: true,
            get: () => this.#replayPoiCollapseTimers,
            set: value => {
                this.#replayPoiCollapseTimers = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'replayPoiTriggered', {
            configurable: true,
            get: () => this.#replayPoiTriggered,
            set: value => {
                this.#replayPoiTriggered = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'replayPOIVisibilityState', {
            configurable: true,
            get: () => this.#replayPOIVisibilityState,
            set: value => {
                this.#replayPOIVisibilityState = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'stopClipPOIMaskFrame', {
            configurable: true,
            get: () => this.#stopClipPOIMaskFrame,
            set: value => {
                this.#stopClipPOIMaskFrame = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastJourneyReplayPoiDistance', {
            configurable: true,
            get: () => this.#lastJourneyReplayPoiDistance,
            set: value => {
                this.#lastJourneyReplayPoiDistance = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastJourneyReplayPoiCursor', {
            configurable: true,
            get: () => this.#lastJourneyReplayPoiCursor,
            set: value => {
                this.#lastJourneyReplayPoiCursor = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'lastPlaybackUpdateProgressKey', {
            configurable: true,
            get: () => this.#lastPlaybackUpdateProgressKey,
            set: value => {
                this.#lastPlaybackUpdateProgressKey = value
            },
        })
        Object.defineProperty(this[JOURNEY_REPLAY_INTERNAL_STATE], 'sortedNearbyPois', {
            configurable: true,
            get: () => this.#sortedNearbyPois,
            set: value => {
                this.#sortedNearbyPois = value
            },
        })
        this[JOURNEY_REPLAY_INTERNAL_CALL] = {
            samplerConfigurationKey: (...args) => this.#samplerConfigurationKey(...args),
            configure: (...args) => JourneyReplaySessionPlaybackController.configure(this, ...args),
            hideOtherJourneysVisibility: (...args) => JourneyReplayVisibilityController.hideOtherJourneysVisibility(this, ...args),
            hideCurrentJourneyVisibility: (...args) => JourneyReplayVisibilityController.hideCurrentJourneyVisibility(this, ...args),
            persistCurrentJourneyVisibility: (...args) => JourneyReplayVisibilityController.persistCurrentJourneyVisibility(this, ...args),
            restoreCurrentJourneyVisibility: (...args) => JourneyReplayVisibilityController.restoreCurrentJourneyVisibility(this, ...args),
            poiEntities: (...args) => JourneyReplayVisibilityController.poiEntities(this, ...args),
            setPOIEntityVisibility: (...args) => JourneyReplayVisibilityController.setPOIEntityVisibility(this, ...args),
            resolveJourneyReplayPOI: (...args) => JourneyReplayVisibilityController.resolveJourneyReplayPOI(this, ...args),
            replayPOICandidates: (...args) => JourneyReplayVisibilityController.replayPOICandidates(this, ...args),
            isVisibleProperty: (...args) => JourneyReplayVisibilityController.isVisibleProperty(this, ...args),
            isPOIVisibleBeforePlayback: (...args) => JourneyReplayVisibilityController.isPOIVisibleBeforePlayback(this, ...args),
            applyJourneyReplayPOIVisibility: (...args) => JourneyReplayVisibilityController.applyJourneyReplayPOIVisibility(this, ...args),
            restoreJourneyReplayPOIVisibility: (...args) => JourneyReplayVisibilityController.restoreJourneyReplayPOIVisibility(this, ...args),
            hideGloballyHiddenPOIs: (...args) => JourneyReplayVisibilityController.hideGloballyHiddenPOIs(this, ...args),
            startStopClipPOIMaskLoop: (...args) => JourneyReplayVisibilityController.startStopClipPOIMaskLoop(this, ...args),
            stopStopClipPOIMaskLoop: (...args) => JourneyReplayVisibilityController.stopStopClipPOIMaskLoop(this, ...args),
            preserveCurrentJourneyPOIVisibility: (...args) => JourneyReplayVisibilityController.preserveCurrentJourneyPOIVisibility(this, ...args),
            restoreCurrentJourneyPolylineVisibility: (...args) => JourneyReplayVisibilityController.restoreCurrentJourneyPolylineVisibility(this, ...args),
            setJourneyReplayOrbitAllowed: (...args) => JourneyReplayVisibilityController.setJourneyReplayOrbitAllowed(this, ...args),
            restoreOtherJourneysVisibility: (...args) => JourneyReplayVisibilityController.restoreOtherJourneysVisibility(this, ...args),
            syncRuntimeNearbyPOIs: (...args) => JourneyReplaySessionPOIController.syncRuntimeNearbyPOIs(this, ...args),
            updatePOIExpandedState: (...args) => JourneyReplaySessionPOIController.updatePOIExpandedState(this, ...args),
            restoreNearbyPOIsAfterPlayback: (...args) => JourneyReplaySessionPOIController.restoreNearbyPOIsAfterPlayback(this, ...args),
            closeJourneyReplayOpenedPOIsBeforeStopClips: (...args) => JourneyReplaySessionPOIController.closeJourneyReplayOpenedPOIsBeforeStopClips(this, ...args),
            prepareNearbyPOIsForPlayback: (...args) => JourneyReplaySessionPOIController.prepareNearbyPOIsForPlayback(this, ...args),
            openNearbyPOIForPlayback: (...args) => JourneyReplaySessionPOIController.openNearbyPOIForPlayback(this, ...args),
            syncNearbyPOIsForSample: (...args) => JourneyReplaySessionPOIController.syncNearbyPOIsForSample(this, ...args),
            replayPoiCursorForDistance: (...args) => JourneyReplaySessionPOIController.replayPoiCursorForDistance(this, ...args),
            interpolateReplayExportSample: (...args) => JourneyReplayClipController.interpolateReplayExportSample(this, ...args),
            focusTargetSampleForReplayExport: (...args) => JourneyReplayClipController.focusTargetSampleForReplayExport(this, ...args),
            replayExportBaseView: (...args) => JourneyReplayClipController.replayExportBaseView(this, ...args),
            currentReplayClipCameraState: (...args) => JourneyReplayClipController.currentReplayClipCameraState(this, ...args),
            replayExportClipPhaseKey: (...args) => JourneyReplayClipController.replayExportClipPhaseKey(this, ...args),
            resolveJourneyReplayClipCameraPlan: (...args) => JourneyReplayClipController.resolveJourneyReplayClipCameraPlan(this, ...args),
            sampleJourneyReplayClipCameraPlan: (...args) => JourneyReplayClipController.sampleJourneyReplayClipCameraPlan(this, ...args),
            applyJourneyReplayClipCameraPlan: (...args) => JourneyReplayClipController.applyJourneyReplayClipCameraPlan(this, ...args),
            isReplayVideoLinked: (...args) => JourneyReplayClipController.isReplayVideoLinked(this, ...args),
            renderReplayExportClipFrame: (...args) => JourneyReplayClipController.renderReplayExportClipFrame(this, ...args),
            clipSettings: (...args) => JourneyReplayClipController.clipSettings(this, ...args),
            clipListForSlot: (...args) => JourneyReplayClipController.clipListForSlot(this, ...args),
            placeCameraAtPlaybackStart: (...args) => JourneyReplayClipController.placeCameraAtPlaybackStart(this, ...args),
            runClipDelay: (...args) => JourneyReplayClipController.runClipDelay(this, ...args),
            cameraSettingsForClip: (...args) => JourneyReplayClipController.cameraSettingsForClip(this, ...args),
            introHeadingForProgress: (...args) => JourneyReplayClipController.introHeadingForProgress(this, ...args),
            clipReplayHeadingForProgress: (...args) => JourneyReplayClipController.clipReplayHeadingForProgress(this, ...args),
            targetSampleForClip: (...args) => JourneyReplayClipController.targetSampleForClip(this, ...args),
            cameraClipFlight: (...args) => JourneyReplayClipController.cameraClipFlight(this, ...args),
            runJourneyReplayClip: (...args) => JourneyReplayClipController.runJourneyReplayClip(this, ...args),
            playJourneyReplayClips: (...args) => JourneyReplayClipController.playJourneyReplayClips(this, ...args),
            cancelActiveCameraFlight: (...args) => JourneyReplayClipController.cancelActiveCameraFlight(this, ...args),
            focusJourneyAfterPlayback: (...args) => JourneyReplayClipController.focusJourneyAfterPlayback(this, ...args),
            resetCameraController: (...args) => JourneyReplaySessionSceneController.resetCameraController(this, ...args),
            captureCameraState: (...args) => JourneyReplaySessionSceneController.captureCameraState(this, ...args),
            capturePlaybackCameraSettings: (...args) => JourneyReplaySessionSceneController.capturePlaybackCameraSettings(this, ...args),
            captureJourneyReplayDrawerStateBeforePlayback: (...args) => JourneyReplaySessionSceneController.captureJourneyReplayDrawerStateBeforePlayback(this, ...args),
            markPlaybackCameraUserAdjusted: (...args) => JourneyReplaySessionSceneController.markPlaybackCameraUserAdjusted(this, ...args),
            restorePlaybackCameraSettings: (...args) => JourneyReplaySessionSceneController.restorePlaybackCameraSettings(this, ...args),
            restoreJourneyReplayDrawerAfterPlayback: (...args) => JourneyReplaySessionSceneController.restoreJourneyReplayDrawerAfterPlayback(this, ...args),
            restorePlaybackScene: (...args) => JourneyReplaySessionSceneController.restorePlaybackSceneInternal(this, ...args),
            cancelPendingSceneRestore: (...args) => JourneyReplaySessionSceneController.cancelPendingSceneRestore(this, ...args),
            restoreCameraState: (...args) => JourneyReplaySessionSceneController.restoreCameraState(this, ...args),
            setContinuousRender: (...args) => JourneyReplaySessionSceneController.setContinuousRender(this, ...args),
            setTerrainHeightLookupBypass: (...args) => JourneyReplayCameraController.setTerrainHeightLookupBypass(this, ...args),
            setTerrainHeightLookupTrace: (...args) => JourneyReplayCameraController.setTerrainHeightLookupTrace(this, ...args),
            abortPlaybackAfterListenerError: (...args) => JourneyReplaySessionSceneController.abortPlaybackAfterListenerError(this, ...args),
            scheduleProfileHoverMarker: (...args) => JourneyReplaySessionSceneController.scheduleProfileHoverMarker(this, ...args),
            renderProfileHoverMarker: (...args) => JourneyReplaySessionSceneController.renderProfileHoverMarker(this, ...args),
            hideJourneyToolbarVisibility: (...args) => JourneyReplaySessionSceneController.hideJourneyToolbarVisibility(this, ...args),
            restoreJourneyToolbarVisibility: (...args) => JourneyReplaySessionSceneController.restoreJourneyToolbarVisibilityInternal(this, ...args),
            hideMainUI: (...args) => JourneyReplaySessionSceneController.hideMainUI(this, ...args),
            restoreMainUI: (...args) => JourneyReplaySessionSceneController.restoreMainUI(this, ...args),
            bindRenderer: (...args) => JourneyReplaySessionSceneController.bindRenderer(this, ...args),
            headingBetweenPoints: (...args) => JourneyReplayCameraController.headingBetweenPoints(this, ...args),
            headingFromWindowPoints: (...args) => JourneyReplayCameraController.headingFromWindowPoints(this, ...args),
            orientedHeadingFromWindowPoints: (...args) => JourneyReplayCameraController.orientedHeadingFromWindowPoints(this, ...args),
            cameraGuideKey: (...args) => JourneyReplayCameraController.cameraGuideKey(this, ...args),
            turnAngleAt: (...args) => JourneyReplayCameraController.turnAngleAt(this, ...args),
            cameraGuideProgresses: (...args) => JourneyReplayCameraController.cameraGuideProgresses(this, ...args),
            buildCameraGuide: (...args) => JourneyReplayCameraController.buildCameraGuide(this, ...args),
            smoothedGuide: (...args) => JourneyReplayCameraController.smoothedGuide(this, ...args),
            guideTimeForProgress: (...args) => JourneyReplayCameraController.guideTimeForProgress(this, ...args),
            cameraGuidePositionPropertyForGuide: (...args) => JourneyReplayCameraController.cameraGuidePositionPropertyForGuide(this, ...args),
            guideSampleFromPositionProperty: (...args) => JourneyReplayCameraController.guideSampleFromPositionProperty(this, ...args),
            headingFromPositionProperty: (...args) => JourneyReplayCameraController.headingFromPositionProperty(this, ...args),
            cameraAltitudeForSample: (...args) => JourneyReplayCameraController.cameraAltitudeForSample(this, ...args),
            cameraViewForSample: (...args) => JourneyReplayCameraController.cameraViewForSample(this, ...args),
            rememberNominalCameraView: (...args) => JourneyReplayCameraController.rememberNominalCameraView(this, ...args),
            resetCameraInterpolationState: (...args) => JourneyReplayCameraController.resetCameraInterpolationState(this, ...args),
            cameraRedirectPitchLimits: (...args) => JourneyReplayCameraController.cameraRedirectPitchLimits(this, ...args),
            cameraViewWithRedirectState: (...args) => JourneyReplayCameraController.cameraViewWithRedirectState(this, ...args),
            cameraLookaheadSample: (...args) => JourneyReplayCameraController.cameraLookaheadSample(this, ...args),
            cameraLineOfSightVisibleForFrame: (...args) => JourneyReplayCameraController.cameraLineOfSightVisibleForFrame(this, ...args),
            cameraViewFrame: (...args) => JourneyReplayCameraController.cameraViewFrame(this, ...args),
            cameraTraceVisibilityTargets: (...args) => JourneyReplayCameraController.cameraTraceVisibilityTargets(this, ...args),
            sampleFromVisibilityTarget: (...args) => JourneyReplayCameraController.sampleFromVisibilityTarget(this, ...args),
            renderedTargetVisible: (...args) => JourneyReplayCameraController.renderedTargetVisible(this, ...args),
            renderedTraceVisibleForSample: (...args) => JourneyReplayCameraController.renderedTraceVisibleForSample(this, ...args),
            cameraViewHasLineOfSight: (...args) => JourneyReplayCameraController.cameraViewHasLineOfSight(this, ...args),
            cameraViewVisibilityForSample: (...args) => JourneyReplayCameraController.cameraViewVisibilityForSample(this, ...args),
            cameraRedirectCandidateScore: (...args) => JourneyReplayCameraController.cameraRedirectCandidateScore(this, ...args),
            findCameraRedirectState: (...args) => JourneyReplayCameraController.findCameraRedirectState(this, ...args),
            applyCameraView: (...args) => JourneyReplayCameraController.applyCameraView(this, ...args),
            liveCameraPitch: (...args) => JourneyReplayCameraController.liveCameraPitch(this, ...args),
            markerPositionForSample: (...args) => JourneyReplayCameraController.markerPositionForSample(this, ...args),
            markerRenderHeightForSample: (...args) => JourneyReplayCameraController.markerRenderHeightForSample(this, ...args),
            markerRenderCartesianForSample: (...args) => JourneyReplayCameraController.markerRenderCartesianForSample(this, ...args),
            windowPositionForSample: (...args) => JourneyReplayCameraController.windowPositionForSample(this, ...args),
            trackingWindowPositionForSample: (...args) => JourneyReplayCameraController.trackingWindowPositionForSample(this, ...args),
            cameraCollisionForSample: (...args) => JourneyReplayCameraController.cameraCollisionForSample(this, ...args),
            cameraCollisionForFrame: (...args) => JourneyReplayCameraController.cameraCollisionForFrame(this, ...args),
            terrainHeightForLonLat: (...args) => JourneyReplayCameraController.terrainHeightForLonLat(this, ...args),
            persistCameraSettings: (...args) => JourneyReplayCameraController.persistCameraSettings(this, ...args),
            updateCameraSettingsFromCesiumControls: (...args) => JourneyReplayCameraController.updateCameraSettingsFromCesiumControls(this, ...args),
            updateCameraFromCesiumControls: (...args) => JourneyReplayCameraController.updateCameraFromCesiumControls(this, ...args),
            syncCameraDrawerFromSettings: (...args) => JourneyReplayCameraController.syncCameraDrawerFromSettings(this, ...args),
            now: (...args) => JourneyReplayCameraController.now(this, ...args),
            cesiumScene: (...args) => JourneyReplayCameraController.cesiumScene(this, ...args),
            smoothRadians: (...args) => JourneyReplayCameraController.smoothRadians(this, ...args),
            timeNormalizedSmoothingFactor: (...args) => JourneyReplayCameraController.timeNormalizedSmoothingFactor(this, ...args),
            traceCameraTiming: (...args) => JourneyReplayCameraController.traceCameraTiming(this, ...args),
            traceCameraChangeTiming: (...args) => JourneyReplayCameraController.traceCameraChangeTiming(this, ...args),
            cancelCameraBezierTransition: (...args) => JourneyReplayCameraController.cancelCameraBezierTransition(this, ...args),
            currentCameraFrame: (...args) => JourneyReplayCameraController.currentCameraFrame(this, ...args),
            applyCameraFrame: (...args) => JourneyReplayCameraController.applyCameraFrame(this, ...args),
            interpolateCameraFrame: (...args) => JourneyReplayCameraController.interpolateCameraFrame(this, ...args),
            cameraTransitionVelocity: (...args) => JourneyReplayCameraController.cameraTransitionVelocity(this, ...args),
            startDeterministicCameraTransition: (...args) => JourneyReplayCameraController.startDeterministicCameraTransition(this, ...args),
            applyDeterministicCameraTransition: (...args) => JourneyReplayCameraController.applyDeterministicCameraTransition(this, ...args),
            applyDeterministicCameraFollower: (...args) => JourneyReplayCameraController.applyDeterministicCameraFollower(this, ...args),
            cameraRecenterFrame: (...args) => JourneyReplayCameraController.cameraRecenterFrame(this, ...args),
            cameraViewDelta: (...args) => JourneyReplayCameraController.cameraViewDelta(this, ...args),
            cameraViewIsStable: (...args) => JourneyReplayCameraController.cameraViewIsStable(this, ...args),
            rememberCameraView: (...args) => JourneyReplayCameraController.rememberCameraView(this, ...args),
            headingEasingFactor: (...args) => JourneyReplayCameraController.headingEasingFactor(this, ...args),
            removeToleranceZoneOverlay: (...args) => JourneyReplayCameraController.removeToleranceZoneOverlay(this, ...args),
            setToleranceZoneOverlayVisible: (...args) => JourneyReplayCameraController.setToleranceZoneOverlayVisible(this, ...args),
            cameraAnglePreviewEntityCollection: (...args) => JourneyReplayCameraController.cameraAnglePreviewEntityCollection(this, ...args),
            removeCameraAnglePreviewOverlay: (...args) => JourneyReplayCameraController.removeCameraAnglePreviewOverlay(this, ...args),
            cameraAnglePreviewPOIIds: (...args) => JourneyReplayCameraController.cameraAnglePreviewPOIIds(this, ...args),
            cameraAnglePreviewPOIForId: (...args) => JourneyReplayCameraController.cameraAnglePreviewPOIForId(this, ...args),
            hideCameraAnglePreviewPOIs: (...args) => JourneyReplayCameraController.hideCameraAnglePreviewPOIs(this, ...args),
            restoreCameraAnglePreviewPOIs: (...args) => JourneyReplayCameraController.restoreCameraAnglePreviewPOIs(this, ...args),
            cameraAnglePreviewStartHeading: (...args) => JourneyReplayCameraController.cameraAnglePreviewStartHeading(this, ...args),
            showCameraAnglePreviewOverlay: (...args) => JourneyReplayCameraController.showCameraAnglePreviewOverlay(this, ...args),
            hideCameraAnglePreviewOverlay: (...args) => JourneyReplayCameraController.hideCameraAnglePreviewOverlay(this, ...args),
            videoCropRect: (...args) => JourneyReplayCameraController.videoCropRect(this, ...args),
            viewportRectForCesiumSurface: (...args) => JourneyReplayCameraController.viewportRectForCesiumSurface(this, ...args),
            updateToleranceZoneOverlay: (...args) => JourneyReplayCameraController.updateToleranceZoneOverlay(this, ...args),
            refreshReplayDiagnosticsOverlay: (...args) => JourneyReplayCameraController.refreshReplayDiagnosticsOverlay(this, ...args),
            constrainedReplayProjectionViewport: (...args) => JourneyReplayCameraController.constrainedReplayProjectionViewport(this, ...args),
            constrainedReplayCameraPathKey: (...args) => JourneyReplayCameraController.constrainedReplayCameraPathKey(this, ...args),
            recenterCameraToSample: (...args) => JourneyReplayCameraController.recenterCameraToSample(this, ...args),
            startCameraTransition: (...args) => JourneyReplayCameraController.startCameraTransition(this, ...args),
            bindMarkerInteractions: (...args) => JourneyReplayCameraController.bindMarkerInteractions(this, ...args),
            bindCesiumCameraBridge: (...args) => JourneyReplayCameraController.bindCesiumCameraBridge(this, ...args),
            startCameraLiveSyncLoop: (...args) => JourneyReplayCameraController.startCameraLiveSyncLoop(this, ...args),
            stopCameraLiveSyncLoop: (...args) => JourneyReplayCameraController.stopCameraLiveSyncLoop(this, ...args),
            updateCamera: (...args) => JourneyReplayCameraController.updateCamera(this, ...args),
            hideOtherJourneysVisibility: (...args) => JourneyReplayVisibilityController.hideOtherJourneysVisibility(this, ...args),
            hideCurrentJourneyVisibility: (...args) => JourneyReplayVisibilityController.hideCurrentJourneyVisibility(this, ...args),
            persistCurrentJourneyVisibility: (...args) => JourneyReplayVisibilityController.persistCurrentJourneyVisibility(this, ...args),
            restoreCurrentJourneyVisibility: (...args) => JourneyReplayVisibilityController.restoreCurrentJourneyVisibility(this, ...args),
            poiEntities: (...args) => JourneyReplayVisibilityController.poiEntities(this, ...args),
            setPOIEntityVisibility: (...args) => JourneyReplayVisibilityController.setPOIEntityVisibility(this, ...args),
            resolveJourneyReplayPOI: (...args) => JourneyReplayVisibilityController.resolveJourneyReplayPOI(this, ...args),
            replayPOICandidates: (...args) => JourneyReplayVisibilityController.replayPOICandidates(this, ...args),
            isVisibleProperty: (...args) => JourneyReplayVisibilityController.isVisibleProperty(this, ...args),
            applyJourneyReplayPOIVisibility: (...args) => JourneyReplayVisibilityController.applyJourneyReplayPOIVisibility(this, ...args),
            restoreJourneyReplayPOIVisibility: (...args) => JourneyReplayVisibilityController.restoreJourneyReplayPOIVisibility(this, ...args),
            hideGloballyHiddenPOIs: (...args) => JourneyReplayVisibilityController.hideGloballyHiddenPOIs(this, ...args),
            startStopClipPOIMaskLoop: (...args) => JourneyReplayVisibilityController.startStopClipPOIMaskLoop(this, ...args),
            stopStopClipPOIMaskLoop: (...args) => JourneyReplayVisibilityController.stopStopClipPOIMaskLoop(this, ...args),
            preserveCurrentJourneyPOIVisibility: (...args) => JourneyReplayVisibilityController.preserveCurrentJourneyPOIVisibility(this, ...args),
            restoreCurrentJourneyPolylineVisibility: (...args) => JourneyReplayVisibilityController.restoreCurrentJourneyPolylineVisibility(this, ...args),
            setJourneyReplayOrbitAllowed: (...args) => JourneyReplayVisibilityController.setJourneyReplayOrbitAllowed(this, ...args),
            restoreOtherJourneysVisibility: (...args) => JourneyReplayVisibilityController.restoreOtherJourneysVisibility(this, ...args),
            setHideOtherJourneys: (...args) => JourneyReplayVisibilityController.setHideOtherJourneys(this, ...args),
            setHideAllPoisDuringJourneyReplay: (...args) => JourneyReplayVisibilityController.setHideAllPoisDuringJourneyReplay(this, ...args),
            setAnimateAllPoisDuringJourneyReplay: (...args) => JourneyReplayVisibilityController.setAnimateAllPoisDuringJourneyReplay(this, ...args),
        }
        this.#controller = controller
        this.#renderer = renderer
        this[JOURNEY_REPLAY_INTERNAL_CALL].bindRenderer()
    }

    setToleranceZoneOverlayVisible = (...args) => this[JOURNEY_REPLAY_INTERNAL_CALL].setToleranceZoneOverlayVisible(...args)

    bindCesiumCameraBridge = (...args) => this[JOURNEY_REPLAY_INTERNAL_CALL].bindCesiumCameraBridge(...args)

    setHideOtherJourneys = (...args) => this[JOURNEY_REPLAY_INTERNAL_CALL].setHideOtherJourneys(...args)

    setHideAllPoisDuringJourneyReplay = (...args) => this[JOURNEY_REPLAY_INTERNAL_CALL].setHideAllPoisDuringJourneyReplay(...args)

    setAnimateAllPoisDuringJourneyReplay = (...args) => this[JOURNEY_REPLAY_INTERNAL_CALL].setAnimateAllPoisDuringJourneyReplay(...args)

    get controller() {
        return this.#controller
    }

    get sampler() {
        return this.#sampler
    }

    get running() {
        return this.#controller.running
    }

    get playing() {
        return this.#controller.playing
    }

    get paused() {
        return this.#controller.paused
    }

    get clipSequenceToken() {
        return this[JOURNEY_REPLAY_INTERNAL_STATE].clipSequenceToken
    }

    /**
     * Return the camera state captured before replay entry.
     *
     * @returns {Object|null} The pre-replay camera snapshot used for restoration and HQ preparation.
     */
    get savedCameraState() {
        return cloneReplayCameraState(this[JOURNEY_REPLAY_INTERNAL_STATE].savedCameraState)
    }

    /**
     * Return the camera state used to initialize replay rendering.
     *
     * @returns {Object|null} The replay-entry camera snapshot.
     */
    get replayEntryCameraState() {
        return cloneReplayCameraState(this[JOURNEY_REPLAY_INTERNAL_STATE].replayEntryCameraState)
    }

    /**
     * Return the latest renderer-independent replay frame passed to the camera adapter.
     *
     * @returns {Object|null} The latest logical replay frame.
     */
    get lastReplayLogicalFrame() {
        return this[JOURNEY_REPLAY_INTERNAL_STATE].lastReplayLogicalFrame
    }

    #samplerConfigurationKey = ({
                                    journey = null,
                                    scope = REPLAY_SCOPE_ALL_TRACKS,
                                    trackSlug = null,
                                    includeHiddenTracks = false,
                                    smoothing = null,
                                } = {}) => [
        journey?.slug ?? '',
        journey?.tracks?.size ?? 0,
        scope,
        trackSlug ?? '',
        includeHiddenTracks === true ? 1 : 0,
        smoothing?.enabled === true ? 1 : 0,
        smoothing?.step ?? 0,
    ].join('|')

    configure = (...args) => JourneyReplaySessionPlaybackController.configure(this, ...args)
    start = (...args) => JourneyReplaySessionPlaybackController.start(this, ...args)
    pause = (...args) => JourneyReplaySessionPlaybackController.pause(this, ...args)
    resume = (...args) => JourneyReplaySessionPlaybackController.resume(this, ...args)
    setLoop = (...args) => JourneyReplaySessionPlaybackController.setLoop(this, ...args)
    setVideoSafeMode = (...args) => JourneyReplaySessionPlaybackController.setVideoSafeMode(this, ...args)
    preparePlaybackSceneForExport = (...args) => JourneyReplaySessionPlaybackController.preparePlaybackSceneForExport(this, ...args)
    toggle = (...args) => JourneyReplaySessionPlaybackController.toggle(this, ...args)
    seek = (...args) => JourneyReplaySessionPlaybackController.seek(this, ...args)
    refresh = (...args) => JourneyReplaySessionPlaybackController.refresh(this, ...args)
    refreshCamera = (...args) => JourneyReplaySessionPlaybackController.refreshCamera(this, ...args)
    beginReplayCameraExport = (...args) => JourneyReplaySessionPlaybackController.beginReplayCameraExport(this, ...args)
    endReplayCameraExport = (...args) => JourneyReplaySessionPlaybackController.endReplayCameraExport(this, ...args)
    renderReplayExportFrame = (...args) => JourneyReplaySessionPlaybackController.renderReplayExportFrame(this, ...args)
    syncCameraFromCesiumControls = (...args) => JourneyReplaySessionSceneController.syncCameraFromCesiumControls(this, ...args)
    handleProfileHover = (...args) => JourneyReplaySessionSceneController.handleProfileHover(this, ...args)
    handleProfileLeave = (...args) => JourneyReplaySessionSceneController.handleProfileLeave(this, ...args)
    showCameraAnglePreview = (...args) => JourneyReplaySessionSceneController.showCameraAnglePreview(this, ...args)
    hideCameraAnglePreview = (...args) => JourneyReplaySessionSceneController.hideCameraAnglePreview(this, ...args)
    stop = (...args) => JourneyReplaySessionSceneController.stop(this, ...args)
    restorePlaybackScene = (...args) => JourneyReplaySessionSceneController.restorePlaybackScene(this, ...args)
    waitForSceneRestore = (...args) => JourneyReplaySessionSceneController.waitForSceneRestore(this, ...args)
    cancelPendingSceneRestore = (...args) => JourneyReplaySessionSceneController.cancelPendingSceneRestore(this, ...args)
    dispose = (...args) => JourneyReplaySessionSceneController.dispose(this, ...args)
    restoreJourneyToolbarVisibility = (...args) => JourneyReplaySessionSceneController.restoreJourneyToolbarVisibility(this, ...args)
    hideJourneyToolbarVisibility = (...args) => JourneyReplaySessionSceneController.hideJourneyToolbarVisibility(this, ...args)
    isJourneyToolbarTemporarilyHidden = (...args) => JourneyReplaySessionSceneController.isJourneyToolbarTemporarilyHidden(this, ...args)
}
