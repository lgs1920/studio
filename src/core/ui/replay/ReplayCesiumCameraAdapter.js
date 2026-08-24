/**
 * Cesium adapter for deterministic replay camera commands.
 */

import {Cartesian3, Matrix4, Transforms} from 'cesium'

import {isReplayCameraCommand} from './ReplayCameraCommand'

/**
 * Apply a bounded roll to one camera up vector.
 *
 * @param {Object} options - Camera basis vectors and roll.
 * @returns {Cartesian3|null} Rolled normalized up vector.
 */
const replayCesiumRolledUp = ({direction, up, rollRadians = 0} = {}) => {
    if (!direction || !up) {
        return null
    }

    const rightCandidate = Cartesian3.cross(direction, up, new Cartesian3())
    if (Cartesian3.magnitudeSquared(rightCandidate) <= Number.EPSILON) {
        return Cartesian3.clone(up, new Cartesian3())
    }

    const right = Cartesian3.normalize(rightCandidate, rightCandidate)
    const rolled = Cartesian3.add(
        Cartesian3.multiplyByScalar(up, Math.cos(rollRadians), new Cartesian3()),
        Cartesian3.multiplyByScalar(right, Math.sin(rollRadians), new Cartesian3()),
        new Cartesian3(),
    )
    return Cartesian3.normalize(rolled, rolled)
}

/**
 * Convert one renderer-independent command into a Cesium camera frame.
 *
 * @param {Object|null} command - Replay camera command.
 * @returns {Object|null} Cesium destination, direction, and up vectors.
 */
export const replayCesiumCameraFrameForCommand = command => {
    if (!isReplayCameraCommand(command)) {
        return null
    }

    const target = Cartesian3.fromDegrees(
        command.target.longitude,
        command.target.latitude,
        command.target.altitude,
    )
    const transform = Transforms.eastNorthUpToFixedFrame(target)
    const east = Matrix4.getColumn(transform, 0, new Cartesian3())
    const north = Matrix4.getColumn(transform, 1, new Cartesian3())
    const up = Matrix4.getColumn(transform, 2, new Cartesian3())
    const heading = command.orientation.headingRadians
    const pitch = command.orientation.pitchRadians
    const forward = Cartesian3.normalize(
        Cartesian3.add(
            Cartesian3.multiplyByScalar(east, Math.sin(heading), new Cartesian3()),
            Cartesian3.multiplyByScalar(north, Math.cos(heading), new Cartesian3()),
            new Cartesian3(),
        ),
        new Cartesian3(),
    )
    const horizontalDistance = command.rangeMeters * Math.cos(pitch)
    const verticalDistance = command.rangeMeters * Math.sin(-pitch)
    const destination = Cartesian3.add(
        Cartesian3.subtract(
            target,
            Cartesian3.multiplyByScalar(forward, horizontalDistance, new Cartesian3()),
            new Cartesian3(),
        ),
        Cartesian3.multiplyByScalar(up, verticalDistance, new Cartesian3()),
        new Cartesian3(),
    )
    const direction = Cartesian3.normalize(
        Cartesian3.subtract(target, destination, new Cartesian3()),
        new Cartesian3(),
    )
    const right = Cartesian3.normalize(Cartesian3.cross(direction, up, new Cartesian3()), new Cartesian3())
    const correctedUp = Cartesian3.normalize(Cartesian3.cross(right, direction, new Cartesian3()), new Cartesian3())
    const rolledUp = replayCesiumRolledUp({
        direction,
        up: correctedUp,
        rollRadians: command.orientation.rollRadians,
    }) ?? correctedUp

    return {
        commandId: command.id,
        target,
        destination,
        direction,
        up: rolledUp,
    }
}

/**
 * Apply one replay command instantly to a Cesium camera.
 *
 * Any previous look-at transform is released before `setView` so the adapter
 * never leaves interactive navigation bound to a replay target.
 *
 * @param {Object} options - Cesium camera and replay command.
 * @returns {Object|null} Applied Cesium frame or null.
 */
export const applyReplayCesiumCameraCommand = ({camera = null, command = null} = {}) => {
    if (!camera || typeof camera.setView !== 'function') {
        return null
    }

    const frame = replayCesiumCameraFrameForCommand(command)
    if (!frame) {
        return null
    }

    camera.lookAtTransform?.(Matrix4.IDENTITY)
    camera.setView({
        destination: frame.destination,
        orientation: {
            direction: frame.direction,
            up: frame.up,
        },
    })
    return frame
}
