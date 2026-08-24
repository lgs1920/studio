/**
 * Renderer-independent command produced from one canonical replay camera pose.
 */

import {replayContractHash} from './ReplayDefinition'
import {resolveReplayCameraMetricRange} from './ReplayCameraDefinition'

export const REPLAY_CAMERA_COMMAND_VERSION = 1
export const REPLAY_CAMERA_COMMAND_SET_TARGET_VIEW = 'set-target-view'

/**
 * Convert a value to a finite number while preserving invalid input.
 *
 * @param {*} value - Value to normalize.
 * @returns {number|null} Finite number or null.
 */
const finiteReplayCameraCommandNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Clamp a numeric camera command value.
 *
 * @param {number} value - Numeric value.
 * @param {number} minimum - Inclusive minimum.
 * @param {number} maximum - Inclusive maximum.
 * @returns {number} Clamped value.
 */
const clampReplayCameraCommandNumber = (value, minimum, maximum) => Math.max(
    minimum,
    Math.min(maximum, value),
)

/**
 * Normalize a geographic target for one camera command.
 *
 * @param {Object|null} target - Geographic camera target.
 * @returns {Object|null} Compact target or null.
 */
const normalizeReplayCameraCommandTarget = target => {
    const longitude = finiteReplayCameraCommandNumber(target?.longitude)
    const latitude = finiteReplayCameraCommandNumber(target?.latitude)
    if (longitude === null || latitude === null) {
        return null
    }

    return {
        longitude: clampReplayCameraCommandNumber(longitude, -180, 180),
        latitude: clampReplayCameraCommandNumber(latitude, -90, 90),
        altitude: finiteReplayCameraCommandNumber(target?.altitude ?? target?.height) ?? 0,
    }
}

/**
 * Create one deterministic target-relative replay camera command.
 *
 * @param {Object} options - Canonical pose and command metadata.
 * @returns {Object|null} Plain camera command or null for an invalid pose.
 */
export const createReplayCameraCommand = ({
    id = null,
    pose = null,
    source = 'replay-camera',
} = {}) => {
    const target = normalizeReplayCameraCommandTarget(pose?.target ?? pose?.sample)
    const heading = finiteReplayCameraCommandNumber(pose?.heading)
    const pitch = finiteReplayCameraCommandNumber(pose?.pitch)
    const roll = finiteReplayCameraCommandNumber(pose?.roll) ?? 0
    const cameraHeight = finiteReplayCameraCommandNumber(pose?.cameraHeight ?? pose?.height)
    const explicitRangeMeters = finiteReplayCameraCommandNumber(pose?.rangeMeters)
    const rangeMeters = explicitRangeMeters
                        ?? (cameraHeight === null || !target
                            ? null
                            : resolveReplayCameraMetricRange(
                                Math.max(1, cameraHeight - target?.altitude),
                                pitch,
                            ))
    if (!target || heading === null || pitch === null || rangeMeters === null || rangeMeters <= 0) {
        return null
    }

    const orientation = {
        headingRadians: heading,
        pitchRadians: clampReplayCameraCommandNumber(
            pitch,
            -(Math.PI / 2 - 0.0001),
            Math.PI / 2 - 0.0001,
        ),
        rollRadians: clampReplayCameraCommandNumber(roll, -Math.PI / 4, Math.PI / 4),
    }
    const identity = {
        version: REPLAY_CAMERA_COMMAND_VERSION,
        definitionId: pose?.definitionId ?? null,
        target,
        orientation,
        rangeMeters,
    }

    return {
        version: REPLAY_CAMERA_COMMAND_VERSION,
        id: id ?? `replay-camera-command-${replayContractHash(identity)}`,
        type: REPLAY_CAMERA_COMMAND_SET_TARGET_VIEW,
        definitionId: pose?.definitionId ?? null,
        target,
        orientation,
        rangeMeters,
        source: source ?? 'replay-camera',
    }
}

/**
 * Return whether a value is a supported replay camera command.
 *
 * @param {*} command - Value to inspect.
 * @returns {boolean} True for a supported target-view command.
 */
export const isReplayCameraCommand = command => Boolean(
    command?.version === REPLAY_CAMERA_COMMAND_VERSION
    && command?.type === REPLAY_CAMERA_COMMAND_SET_TARGET_VIEW
    && command?.target
    && command?.orientation
    && Number(command?.rangeMeters) > 0,
)

/**
 * Resolve the explicit or pose-derived command from one frame intent.
 *
 * @param {Object|null} intent - Canonical frame intent.
 * @returns {Object|null} Replay camera command.
 */
export const replayCameraCommandFromIntent = intent => intent?.scene?.cameraCommand
    ?? createReplayCameraCommand({
        pose: intent?.scene?.cameraPose,
        source: intent?.source ?? 'replay-camera',
    })
