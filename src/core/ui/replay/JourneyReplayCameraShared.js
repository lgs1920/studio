/**
 * Shared Cesium helpers and constants for replay camera modules.
 */

/**
 * Camera, tracking and Cesium camera bridge for Journey Replay.
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

export const REPLAY_HEADING_TRANSITION_DURATION_SECONDS = 2
export const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)
export const CAMERA_GUIDE_MIN_STEPS = 512
export const CAMERA_GUIDE_MAX_STEPS = 4096
export const CAMERA_GUIDE_TARGET_SPACING_METERS = 12
export const CAMERA_GUIDE_TURN_STEP_RADIANS = Math.PI / 18
export const CARTESIAN_EPSILON = 1e-7
export const CAMERA_HEADING_HYSTERESIS_RADIANS = CesiumMath.toRadians(16)
export const CAMERA_HEADING_LOOKAHEAD_PROGRESS = 0.16
export const CAMERA_HEADING_MIN_CHANGE_RADIANS = CesiumMath.toRadians(8)
export const CAMERA_NAVIGATION_HEADING_LOOKAHEAD_SECONDS = 2.5
// beta.2 used the same metric horizon behind and ahead of the marker. A
// symmetric window prevents alternating route vertices from steering the
// camera before the bend is sustained by the path.
export const CAMERA_NAVIGATION_HEADING_WINDOW_SECONDS = 2.5
export const CAMERA_NAVIGATION_HEADING_MIN_WINDOW_METERS = 400
// beta.2 response envelope, applied after the wider spatial heading window.
export const CAMERA_HEADING_MIN_RESPONSE_FACTOR = 0.04
export const CAMERA_HEADING_MAX_RESPONSE_FACTOR = 0.18
export const CAMERA_VIEW_POSITION_EPSILON_METERS = 0.5
export const CAMERA_VIEW_ANGLE_EPSILON_RADIANS = CesiumMath.toRadians(0.25)
export const CAMERA_TIMING_START_ANGLE_RADIANS = CesiumMath.toRadians(2)
export const CAMERA_TIMING_SETTLE_ANGLE_RADIANS = CesiumMath.toRadians(0.75)
export const CAMERA_DETERMINISTIC_FOLLOW_RESPONSE_SECONDS = 2.2
export const REPLAY_NAVIGATION_MAX_HEADING_DRIFT_DEGREES = 6
export const REPLAY_NAVIGATION_MAX_LATERAL_DRIFT_METERS = 40
export const REPLAY_NAVIGATION_MIN_TURN_DRIFT_DEGREES = 12
export const CAMERA_REDIRECT_MAX_TRANSITION_SECONDS = 1
export const CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS = 120
export const CAMERA_REDIRECT_TRACE_VISIBILITY_OFFSETS_METERS = Object.freeze([6, 12, 18, 24])
export const CAMERA_REDIRECT_REQUIRED_TRACE_OFFSET_METERS = 12
export const CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS = 11
export const CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS = 3
export const CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS = 8
export const REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS = 300
export const REPLAY_TRACKING_DYNAMIC_LOOKAHEAD_FACTOR = 1.35
export const CAMERA_ANGLE_PREVIEW_AXIS_LENGTH = 1800
export const CAMERA_ANGLE_PREVIEW_OFFSET_LENGTH = 1800
export const CAMERA_ANGLE_PREVIEW_ICON_SIZE = 24
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

export const makeFontAwesomeIconDataUri = (definition, color, size = 24) => {
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

export const resolveJourneyActivityIcon = (journey = null) => {
    const activityIcon = Journey.activityProfile(journey?.activity, journey?.activitySettings)?.icon
    return activityIcon === 'person-hiking' ? faPersonHiking : faPersonHiking
}

export {replayPitchLookaheadFactor} from './JourneyReplayCameraMath'
