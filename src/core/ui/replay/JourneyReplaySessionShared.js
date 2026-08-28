/**
 * Shared constants and helpers for replay session modules.
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
    currentJourneyReplayPoiBehavior, currentJourneyReplaySample, finiteNumber, publishReplayClipFrameState,
    replayStore, resetRuntimeProgress, resolveJourneyReplayRuntimeClips,
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


export const DEFAULT_DURATION = 60
export const PROFILE_HOVER_RENDER_INTERVAL = 120
export const METRIC_OVERLAY_TTL = 2000
export const REPLAY_HEADING_TRANSITION_DURATION_SECONDS = 2
export const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)
export const CAMERA_GUIDE_MIN_STEPS = 512
export const CAMERA_GUIDE_MAX_STEPS = 4096
export const CAMERA_GUIDE_TARGET_SPACING_METERS = 12
export const CAMERA_GUIDE_TURN_STEP_RADIANS = Math.PI / 18
export const CARTESIAN_EPSILON = 1e-7
export const CAMERA_HEADING_HYSTERESIS_RADIANS = CesiumMath.toRadians(12)
export const CAMERA_HEADING_LOOKAHEAD_PROGRESS = 0.16
export const CAMERA_HEADING_MIN_CHANGE_RADIANS = CesiumMath.toRadians(5)
export const CAMERA_RASANT_PITCH_LIMIT_RADIANS = CesiumMath.toRadians(-5)
export const CAMERA_RASANT_PITCH_RELEASE_RADIANS = CesiumMath.toRadians(-35)
export const CAMERA_VIEW_POSITION_EPSILON_METERS = 0.5
export const CAMERA_VIEW_ANGLE_EPSILON_RADIANS = CesiumMath.toRadians(0.25)
export const CAMERA_TIMING_START_ANGLE_RADIANS = CesiumMath.toRadians(2)
export const CAMERA_TIMING_SETTLE_ANGLE_RADIANS = CesiumMath.toRadians(0.75)
export const CAMERA_DETERMINISTIC_FOLLOW_RESPONSE_SECONDS = 1.5
export const CAMERA_UPDATE_MIN_PROGRESS_DELTA = 0.0005
export const CAMERA_REDIRECT_MAX_TRANSITION_SECONDS = 1
export const CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS = 120
export const CAMERA_REDIRECT_TRACE_VISIBILITY_OFFSETS_METERS = Object.freeze([6, 12, 18, 24])
export const CAMERA_REDIRECT_REQUIRED_TRACE_OFFSET_METERS = 12
export const CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS = 11
export const CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS = 3
export const CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS = 8
export const REPLAY_TOLERANCE_OUTER_INSET_RATIO = 0.05
export const REPLAY_TOLERANCE_INNER_INSET_RATIO = 0.2
export const REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS = 300
export const REPLAY_TRACKING_NAVIGATION_ZONE_RATIO = 0.3
export const REPLAY_TRACKING_NAVIGATION_NARROW_CROP_RATIO = 0.75
export const REPLAY_TRACKING_NAVIGATION_NARROW_ZONE_RATIO = 0.22
export const REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO = 0.75
export const REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO = 0.3
// Dynamic recentering must lead the marker beyond the nominal easing duration:
// a closed pitch can keep the marker moving toward the crop edge while the
// camera is still interpolating.
export const REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR = 1.35
export const REPLAY_POI_TRIGGER_EPSILON_METERS = 0.001
export const REPLAY_POI_TRIGGER_SCAN_MARGIN_METERS = 5
export const REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT = 'lgs:replay:journey-toolbar-visibility'
export const REPLAY_EVENT_STOP_CLIPS_COMPLETE = 'replay/stop-clips-complete'

export const CAMERA_REDIRECT_CANDIDATES = Object.freeze([
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

export const isUsableCartesian3 = value => Boolean(value)
    && [value.x, value.y, value.z].every(component => Number.isFinite(component))
    && Cartesian3.magnitudeSquared(value) > CARTESIAN_EPSILON

export const safeCartesian3Normalize = (value, fallback) => {
    if (isUsableCartesian3(value)) {
        return Cartesian3.normalize(value, new Cartesian3())
    }

    return isUsableCartesian3(fallback) ? Cartesian3.clone(fallback, new Cartesian3()) : null
}
export const safeCartesian3Lerp = (left, right, ratio, result = new Cartesian3()) => {
    if (!isUsableCartesian3(left)) {
        return isUsableCartesian3(right) ? Cartesian3.clone(right, result) : null
    }
    if (!isUsableCartesian3(right)) {
        return Cartesian3.clone(left, result)
    }

    return Cartesian3.lerp(left, right, ratio, result)
}

export {replayPitchLookaheadFactor} from './JourneyReplayCameraMath'
export * from './JourneyReplayCameraMath'
