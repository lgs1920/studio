/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraMotionSmoothing.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-11
 * Last modified: 2026-10-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Shared, deterministic tuning for Replay camera motion.
 */

/** Minimum camera Ease applied to Basic Replay playback. */
export const REPLAY_BASIC_CAMERA_MIN_EASING = 0.3
/** Shortest route-heading anticipation horizon, in seconds. */
export const REPLAY_CAMERA_HEADING_LOOKAHEAD_MIN_SECONDS = 2.5
/** Longest route-heading anticipation horizon, in seconds. */
export const REPLAY_CAMERA_HEADING_LOOKAHEAD_MAX_SECONDS = 4
/** Maximum fraction of a route used for one side of the camera heading window. */
export const REPLAY_CAMERA_HEADING_MAX_PATH_RATIO = 0.3
/** Route-time window used to soften camera-anchor movement through tight turns. */
export const REPLAY_CAMERA_POSITION_SMOOTHING_SECONDS = 0.5

/**
 * Convert an optional value to a finite number.
 *
 * @param {*} value - Candidate numeric value.
 * @returns {number|null} Finite number or null.
 */
const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Clamp a value to an inclusive numeric interval.
 *
 * @param {number} value - Value to clamp.
 * @param {number} min - Inclusive lower bound.
 * @param {number} max - Inclusive upper bound.
 * @returns {number} Clamped value.
 */
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

/**
 * Increase route-heading anticipation with the existing camera Ease value.
 * Expert already persists and exposes this value; Basic uses the smooth
 * floor above so both modes share the same camera path policy.
 *
 * @param {number} easing - Normalized camera Ease setting.
 * @returns {number} Heading lookahead in seconds.
 */
export const replayCameraHeadingLookaheadSeconds = easing => {
    const easingValue = finiteNumber(easing)
    const normalized = easingValue === null ? 0 : clamp(easingValue / 0.5, 0, 1)
    return REPLAY_CAMERA_HEADING_LOOKAHEAD_MIN_SECONDS
        + ((REPLAY_CAMERA_HEADING_LOOKAHEAD_MAX_SECONDS - REPLAY_CAMERA_HEADING_LOOKAHEAD_MIN_SECONDS) * normalized)
}

/**
 * Convert the Replay camera heading horizon into route distance. Playback moves
 * linearly through route progress, so GPX files without timestamps must use the
 * configured Replay duration instead of falling back to a fixed few hundred
 * metres. Cap the distance so very short replays do not use most of the route
 * as one heading sample.
 *
 * @param {object} options - Active path and Replay timing.
 * @param {number} options.totalDistanceMeters - Full route distance.
 * @param {number} options.durationSeconds - Configured route playback duration.
 * @param {number} options.lookaheadSeconds - Camera heading horizon.
 * @param {number} [options.minimumMeters=400] - Existing minimum heading distance.
 * @returns {number} Minimum route distance used to resolve the heading.
 */
export const replayCameraHeadingWindowMeters = ({
    totalDistanceMeters,
    durationSeconds,
    lookaheadSeconds,
    minimumMeters = 400,
} = {}) => {
    const totalDistance = Math.max(0, finiteNumber(totalDistanceMeters) ?? 0)
    const duration = Math.max(0, finiteNumber(durationSeconds) ?? 0)
    const lookahead = Math.max(0, finiteNumber(lookaheadSeconds) ?? 0)
    const minimum = Math.max(0, finiteNumber(minimumMeters) ?? 400)
    if (totalDistance <= 0) {
        return minimum
    }

    const maximumDistance = totalDistance * REPLAY_CAMERA_HEADING_MAX_PATH_RATIO
    const effectiveMinimum = Math.min(minimum, maximumDistance)
    if (duration <= 0 || lookahead <= 0) {
        return effectiveMinimum
    }

    const replayPaceDistance = (totalDistance / duration) * lookahead
    return Math.max(effectiveMinimum, Math.min(replayPaceDistance, maximumDistance))
}

/**
 * Convert a short camera-position smoothing horizon into route distance.
 * Playback speed is derived from the Replay duration so the same path receives
 * proportionate smoothing at different video durations.
 *
 * @param {object} options - Active path and Replay timing.
 * @param {number} options.totalDistanceMeters - Full route distance.
 * @param {number} options.durationSeconds - Configured route playback duration.
 * @param {number} [options.smoothingSeconds=REPLAY_CAMERA_POSITION_SMOOTHING_SECONDS] - Smoothing window in seconds.
 * @returns {number} Route distance covered in the smoothing window.
 */
export const replayCameraPositionSmoothingWindowMeters = ({
    totalDistanceMeters,
    durationSeconds,
    smoothingSeconds = REPLAY_CAMERA_POSITION_SMOOTHING_SECONDS,
} = {}) => {
    const totalDistance = Math.max(0, finiteNumber(totalDistanceMeters) ?? 0)
    const duration = Math.max(0, finiteNumber(durationSeconds) ?? 0)
    const smoothing = Math.max(0, finiteNumber(smoothingSeconds) ?? 0)
    if (totalDistance <= 0 || duration <= 0 || smoothing <= 0) {
        return 0
    }

    return Math.min(
        (totalDistance / duration) * smoothing,
        totalDistance * REPLAY_CAMERA_HEADING_MAX_PATH_RATIO,
    )
}

/**
 * Estimate how many ground metres are visible across the active crop at the
 * replay target's depth. This keeps camera-only route simplification relative
 * to the actual prepared framing.
 *
 * @param {object} options - Active camera and crop projection.
 * @returns {number} Crop width on the replay target plane, in metres.
 */
export const replayCameraCropWidthMeters = ({
    cameraHeight,
    targetHeight,
    pitchRadians,
    verticalFovRadians,
    aspectRatio,
    cropWidthRatio = 1,
} = {}) => {
    const cameraAltitude = finiteNumber(cameraHeight)
    const targetAltitude = finiteNumber(targetHeight)
    const pitch = finiteNumber(pitchRadians)
    const verticalFov = finiteNumber(verticalFovRadians)
    const aspect = finiteNumber(aspectRatio)
    const cropRatio = finiteNumber(cropWidthRatio)
    if ([cameraAltitude, targetAltitude, pitch, verticalFov, aspect, cropRatio].some(value => value === null)
        || aspect <= 0
        || cropRatio <= 0) {
        return 0
    }

    const heightAboveTarget = Math.max(0, cameraAltitude - targetAltitude)
    const verticalPitchFactor = Math.abs(Math.sin(pitch))
    if (heightAboveTarget <= 0 || verticalPitchFactor < 0.01) {
        return 0
    }

    const slantRange = heightAboveTarget / verticalPitchFactor
    const halfHorizontalFovTangent = Math.tan(clamp(verticalFov, 0.01, Math.PI - 0.01) / 2) * aspect
    const cropWidth = 2 * slantRange * halfHorizontalFovTangent * clamp(cropRatio, 0, 1)
    return Number.isFinite(cropWidth) ? Math.max(0, cropWidth) : 0
}
