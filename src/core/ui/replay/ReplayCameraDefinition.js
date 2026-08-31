/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayCameraDefinition.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Canonical renderer-independent replay camera definition.
 */

import {replayContractHash} from './ReplayDefinition'
import {
    normalizeJourneyReplayCamera,
    normalizeJourneyReplayMarker,
} from './JourneyReplayProgressionStyle'

export const REPLAY_CAMERA_DEFINITION_VERSION = 1
export const REPLAY_CAMERA_ANCHOR_SAMPLE = 'sample'
export const REPLAY_CAMERA_RANGE_DERIVED_FROM_ALTITUDE = 'derived-from-altitude'

/**
 * Convert a finite degree value to radians.
 *
 * @param {*} value - Degree value.
 * @returns {number} Angle in radians.
 */
const replayCameraRadians = value => Number(value) * Math.PI / 180

/**
 * Convert a finite radian value to degrees.
 *
 * @param {*} value - Radian value.
 * @returns {number} Angle in degrees.
 */
const replayCameraDegrees = value => {
    const degrees = Number(value) * 180 / Math.PI
    return Math.round(degrees * 1e12) / 1e12
}

/**
 * Normalize one compact geographic replay camera anchor.
 *
 * @param {Object|null} anchor - Source replay sample or anchor.
 * @returns {Object|null} Plain compact anchor.
 */
const normalizeReplayCameraAnchor = anchor => {
    const longitude = Number(anchor?.longitude)
    const latitude = Number(anchor?.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
    }

    const altitude = Number(anchor?.altitude ?? anchor?.height)
    const progress = Number(anchor?.progress)
    return {
        longitude,
        latitude,
        altitude: Number.isFinite(altitude) ? altitude : 0,
        progress: Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null,
    }
}

/**
 * Resolve a metric camera range from a vertical distance and pitch.
 *
 * @param {number} verticalDistanceMeters - Vertical distance from the anchor.
 * @param {number} pitchRadians - Camera pitch in radians.
 * @returns {number} Slant range in meters.
 */
export const resolveReplayCameraMetricRange = (verticalDistanceMeters, pitchRadians) => {
    const verticalDistance = Math.max(0, Number(verticalDistanceMeters) || 0)
    const pitch = Number(pitchRadians)
    if (!Number.isFinite(pitch)) {
        return Math.max(1, verticalDistance)
    }

    const verticalFactor = Math.abs(Math.sin(pitch))
    if (verticalFactor < 1e-6) {
        return Math.max(1, verticalDistance)
    }
    return Math.max(1, verticalDistance / verticalFactor)
}

/**
 * Create one versioned camera definition from persisted replay settings.
 *
 * The current altitude setting remains the compatibility source of truth. Its
 * nominal metric range is made explicit so the future isolated render host can
 * use a target-relative camera command without changing current framing.
 *
 * @param {Object} options - Persisted camera and marker inputs.
 * @returns {Object} Canonical plain-data replay camera definition.
 */
export const createReplayCameraDefinition = ({
    id = null,
    cameraSettings = null,
    markerSettings = null,
    startAnchor = null,
} = {}) => {
    const camera = normalizeJourneyReplayCamera(cameraSettings ?? {})
    const marker = normalizeJourneyReplayMarker(markerSettings ?? {})
    const pitchRadians = replayCameraRadians(camera.pitch)
    const normalizedAnchor = normalizeReplayCameraAnchor(startAnchor)
    const identity = {
        version: REPLAY_CAMERA_DEFINITION_VERSION,
        startAnchor: normalizedAnchor,
        camera,
        marker,
    }

    return {
        version: REPLAY_CAMERA_DEFINITION_VERSION,
        id: id ?? `replay-camera-${replayContractHash(identity)}`,
        anchor: {
            mode: REPLAY_CAMERA_ANCHOR_SAMPLE,
            start: normalizedAnchor,
        },
        position: {
            mode: camera.positionMode,
            altitudeMode: camera.altitudeMode,
            altitudeMeters: camera.altitude,
            rangeMode: REPLAY_CAMERA_RANGE_DERIVED_FROM_ALTITUDE,
            nominalRangeMeters: resolveReplayCameraMetricRange(camera.altitude, pitchRadians),
        },
        orientation: {
            headingRadians: replayCameraRadians(camera.heading),
            headingOffsetRadians: replayCameraRadians(camera.headingOffset),
            pitchRadians,
            roll: {
                enabled: camera.canRoll,
                sensitivity: camera.rollSensitivity,
            },
        },
        tracking: {
            driftEnabled: camera.canDrift,
            hiddenMarkerCorrectionEnabled: camera.canFixHiddenMarker,
            driftSensitivity: camera.driftSensitivity,
            pitchCorrectionSensitivity: camera.pitchCorrectionSensitivity,
            hysteresis: camera.hysteresis,
        },
        playback: camera.playback,
        marker,
    }
}

/**
 * Return whether a value is a current canonical camera definition.
 *
 * @param {*} definition - Value to inspect.
 * @returns {boolean} True for a supported camera definition.
 */
export const isReplayCameraDefinition = definition => Boolean(
    definition?.version === REPLAY_CAMERA_DEFINITION_VERSION
    && definition?.position
    && definition?.orientation,
)

/**
 * Project a canonical camera definition back to legacy replay settings.
 *
 * This adapter keeps the current camera math operational while the drawer and
 * Cesium runtime are migrated to consume the canonical contract directly.
 *
 * @param {Object} definition - Canonical camera definition.
 * @returns {Object} Normalized legacy camera settings.
 */
export const replayCameraSettingsFromDefinition = definition => {
    if (!isReplayCameraDefinition(definition)) {
        throw new TypeError('A versioned replay camera definition is required')
    }

    return normalizeJourneyReplayCamera({
        positionMode: definition.position.mode,
        altitudeMode: definition.position.altitudeMode,
        altitude: definition.position.altitudeMeters,
        heading: replayCameraDegrees(definition.orientation.headingRadians),
        headingOffset: replayCameraDegrees(definition.orientation.headingOffsetRadians),
        pitch: replayCameraDegrees(definition.orientation.pitchRadians),
        canDrift: definition.tracking?.driftEnabled,
        canFixHiddenMarker: definition.tracking?.hiddenMarkerCorrectionEnabled,
        canRoll: definition.orientation.roll?.enabled,
        driftSensitivity: definition.tracking?.driftSensitivity,
        rollSensitivity: definition.orientation.roll?.sensitivity,
        pitchCorrectionSensitivity: definition.tracking?.pitchCorrectionSensitivity,
        hysteresis: definition.tracking?.hysteresis,
        playback: definition.playback,
    })
}
