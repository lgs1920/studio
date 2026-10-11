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
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Shared, deterministic tuning for Replay camera motion.
 */

/** Minimum camera Ease applied to Simple Replay playback. */
export const REPLAY_SIMPLE_CAMERA_MIN_EASING = 0.3
/** Shortest route-heading anticipation horizon, in seconds. */
export const REPLAY_CAMERA_HEADING_LOOKAHEAD_MIN_SECONDS = 2.5
/** Longest route-heading anticipation horizon, in seconds. */
export const REPLAY_CAMERA_HEADING_LOOKAHEAD_MAX_SECONDS = 4

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
 * Expert already persists and exposes this value; Simple uses the smooth
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
