/**
 * Cesium adapter for deterministic replay camera commands.
 */

import {Cartesian3, Cartographic, Math as CesiumMath, Matrix4, Transforms} from 'cesium'

import {createReplayCameraCommand, isReplayCameraCommand} from './ReplayCameraCommand'

export const REPLAY_CAMERA_TERRAIN_CLEARANCE_METERS = 3

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Resolve a camera destination that remains above the currently available terrain.
 *
 * @param {Object} options - Destination, Cesium scene, and clearance settings.
 * @param {Cartesian3|null} options.destination - Candidate camera destination.
 * @param {Object|null} options.scene - Cesium scene containing the globe.
 * @param {number} [options.clearanceMeters=3] - Minimum clearance above terrain.
 * @returns {Cartesian3|null} Safe destination or null when the input is invalid.
 */
export const replayCesiumCameraDestinationAboveTerrain = ({
    destination = null,
    scene = null,
    clearanceMeters = REPLAY_CAMERA_TERRAIN_CLEARANCE_METERS,
} = {}) => {
    if (!destination || !scene?.globe?.getHeight) {
        return destination
    }

    try {
        const cartographic = Cartographic.fromCartesian(destination)
        const terrainHeight = finiteNumber(scene.globe.getHeight(cartographic))
        if (terrainHeight === null) {
            return destination
        }

        const clearance = Math.max(
            0,
            finiteNumber(clearanceMeters) ?? REPLAY_CAMERA_TERRAIN_CLEARANCE_METERS,
        )
        const minimumHeight = terrainHeight + clearance
        if (cartographic.height >= minimumHeight) {
            return destination
        }

        cartographic.height = minimumHeight
        return Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            cartographic.height,
            undefined,
            new Cartesian3(),
        )
    }
    catch {
        return destination
    }
}

/**
 * Apply terrain clearance to a Cesium camera frame.
 *
 * @param {Object} options - Camera frame and terrain settings.
 * @param {Object|null} options.frame - Candidate Cesium camera frame.
 * @param {Object|null} options.scene - Cesium scene containing the globe.
 * @param {number} [options.clearanceMeters=3] - Minimum clearance above terrain.
 * @returns {Object|null} Terrain-safe camera frame.
 */
export const replayCesiumCameraFrameAboveTerrain = ({
    frame = null,
    scene = null,
    clearanceMeters = REPLAY_CAMERA_TERRAIN_CLEARANCE_METERS,
} = {}) => {
    if (!frame?.destination) {
        return frame
    }

    const destination = replayCesiumCameraDestinationAboveTerrain({
        destination: frame.destination,
        scene,
        clearanceMeters,
    })
    return destination === frame.destination
        ? frame
        : {...frame, destination}
}

/**
 * Apply terrain clearance to a Cesium camera view.
 *
 * @param {Object} options - Camera view and terrain settings.
 * @param {Object|null} options.view - Candidate Cesium camera view.
 * @param {Object|null} options.scene - Cesium scene containing the globe.
 * @param {number} [options.clearanceMeters=3] - Minimum clearance above terrain.
 * @returns {Object|null} Terrain-safe camera view.
 */
export const replayCesiumCameraViewAboveTerrain = ({
    view = null,
    scene = null,
    clearanceMeters = REPLAY_CAMERA_TERRAIN_CLEARANCE_METERS,
} = {}) => {
    if (!view?.destination) {
        return view
    }

    const destination = replayCesiumCameraDestinationAboveTerrain({
        destination: view.destination,
        scene,
        clearanceMeters,
    })
    return destination === view.destination
        ? view
        : {...view, destination}
}

/**
 * Correct a Cesium camera that is already below the currently available terrain.
 *
 * @param {Object} options - Cesium camera, scene, and clearance settings.
 * @param {Object|null} options.camera - Cesium camera to constrain.
 * @param {Object|null} options.scene - Cesium scene containing the globe.
 * @param {number} [options.clearanceMeters=3] - Minimum clearance above terrain.
 * @returns {boolean} Whether the camera was corrected.
 */
export const constrainReplayCesiumCameraAboveTerrain = ({
    camera = null,
    scene = null,
    clearanceMeters = REPLAY_CAMERA_TERRAIN_CLEARANCE_METERS,
} = {}) => {
    if (!camera?.setView) {
        return false
    }

    const currentDestination = camera.positionWC ?? camera.position
    const destination = replayCesiumCameraDestinationAboveTerrain({
        destination: currentDestination,
        scene,
        clearanceMeters,
    })
    if (!destination || destination === currentDestination) {
        return false
    }

    camera.setView({
        destination,
        orientation: {
            heading: camera.heading,
            pitch: camera.pitch,
            roll: camera.roll,
        },
    })
    return true
}

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
 * Convert one target-looking Cesium frame back into a canonical camera command.
 *
 * This adapter lets existing collision-qualified transfer paths cross the new
 * command seam without persisting Cesium vectors in replay definitions.
 *
 * @param {Object} options - Cesium frame, geographic target, and metadata.
 * @returns {Object|null} Canonical camera command.
 */
export const replayCameraCommandForCesiumFrame = ({
    frame = null,
    target = null,
    source = 'cesium-frame',
} = {}) => {
    const destination = frame?.destination
    if (!destination || !target) {
        return null
    }

    const rangeMeters = Cartesian3.distance(destination, target)
    if (!Number.isFinite(rangeMeters) || rangeMeters <= Number.EPSILON) {
        return null
    }

    const targetCartographic = Cartographic.fromCartesian(target)
    if (!targetCartographic) {
        return null
    }

    const transform = Transforms.eastNorthUpToFixedFrame(target)
    const east = Matrix4.getColumn(transform, 0, new Cartesian3())
    const north = Matrix4.getColumn(transform, 1, new Cartesian3())
    const localUp = Matrix4.getColumn(transform, 2, new Cartesian3())
    const direction = Cartesian3.normalize(
        Cartesian3.subtract(target, destination, new Cartesian3()),
        new Cartesian3(),
    )
    const heading = Math.atan2(
        Cartesian3.dot(direction, east),
        Cartesian3.dot(direction, north),
    )
    const pitch = Math.asin(CesiumMath.clamp(Cartesian3.dot(direction, localUp), -1, 1))
    const rightCandidate = Cartesian3.cross(direction, localUp, new Cartesian3())
    const hasRight = Cartesian3.magnitudeSquared(rightCandidate) > Number.EPSILON
    const right = hasRight
        ? Cartesian3.normalize(rightCandidate, rightCandidate)
        : east
    const correctedUp = Cartesian3.normalize(
        Cartesian3.cross(right, direction, new Cartesian3()),
        new Cartesian3(),
    )
    const frameUp = frame?.up ?? frame?.correctedUp
    const normalizedFrameUp = frameUp && Cartesian3.magnitudeSquared(frameUp) > Number.EPSILON
        ? Cartesian3.normalize(frameUp, new Cartesian3())
        : correctedUp
    const roll = Math.atan2(
        Cartesian3.dot(normalizedFrameUp, right),
        Cartesian3.dot(normalizedFrameUp, correctedUp),
    )

    return createReplayCameraCommand({
        pose: {
            target: {
                longitude: CesiumMath.toDegrees(targetCartographic.longitude),
                latitude: CesiumMath.toDegrees(targetCartographic.latitude),
                altitude: targetCartographic.height,
            },
            heading,
            pitch,
            roll,
            rangeMeters,
        },
        source,
    })
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
export const applyReplayCesiumCameraCommand = ({
    camera = null,
    command = null,
    scene = null,
    clearanceMeters = REPLAY_CAMERA_TERRAIN_CLEARANCE_METERS,
} = {}) => {
    if (!camera || typeof camera.setView !== 'function') {
        return null
    }

    const frame = replayCesiumCameraFrameForCommand(command)
    if (!frame) {
        return null
    }

    const safeFrame = replayCesiumCameraFrameAboveTerrain({
        frame,
        scene,
        clearanceMeters,
    })

    camera.lookAtTransform?.(Matrix4.IDENTITY)
    camera.setView({
        destination: safeFrame.destination,
        orientation: {
            direction: safeFrame.direction,
            up: safeFrame.up,
        },
    })
    return safeFrame
}
