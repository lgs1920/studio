/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayLogicalCameraPose.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-08-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Renderer-independent replay camera-pose resolution.
 */

const REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET = 'ground-offset'
const REPLAY_CAMERA_POSITION_AHEAD = 'ahead'
const REPLAY_CAMERA_POSITION_SYSTEM = 'system'
const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)
const MAX_REPLAY_CAMERA_ROLL = Math.PI / 4
const MIN_REPLAY_ROLL_SPEED_METERS_PER_SECOND = 0.5
const REPLAY_ROLL_PROBE_SECONDS = 1
const REPLAY_ROLL_MIN_PROBE_METERS = 20
const REPLAY_ROLL_MAX_PROBE_METERS = 220
const REPLAY_ROLL_TURN_START_RADIANS = 3 * Math.PI / 180
const REPLAY_ROLL_TURN_FULL_RADIANS = 90 * Math.PI / 180
const REPLAY_ROLL_MIN_CURVATURE = 0.00005
const REPLAY_ROLL_FULL_CURVATURE = 0.003

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const smoothstep = value => {
    const t = clamp(finiteNumber(value) ?? 0, 0, 1)
    return t * t * (3 - (2 * t))
}

const degreesToRadians = value => {
    const number = finiteNumber(value)
    return number === null ? null : number * Math.PI / 180
}

const normalizeLongitudeDelta = value => {
    let delta = value
    while (delta > Math.PI) {
        delta -= Math.PI * 2
    }
    while (delta < -Math.PI) {
        delta += Math.PI * 2
    }
    return delta
}

const angularDelta = (from, to) => {
    const start = finiteNumber(from)
    const end = finiteNumber(to)
    if (start === null || end === null) {
        return null
    }

    const fullTurn = Math.PI * 2
    const delta = ((end - start + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
    return delta === -Math.PI ? Math.PI : delta
}

const distanceBetweenSamples = (start, end) => {
    const startLongitude = degreesToRadians(start?.longitude)
    const startLatitude = degreesToRadians(start?.latitude)
    const endLongitude = degreesToRadians(end?.longitude)
    const endLatitude = degreesToRadians(end?.latitude)
    if ([startLongitude, startLatitude, endLongitude, endLatitude].some(value => value === null)) {
        return null
    }

    const averageLatitude = (startLatitude + endLatitude) / 2
    const deltaLongitude = normalizeLongitudeDelta(endLongitude - startLongitude)
    const deltaLatitude = endLatitude - startLatitude
    return Math.hypot(
        deltaLongitude * Math.cos(averageLatitude),
        deltaLatitude,
    ) * 6371008.8
}

const headingBetweenSamples = (start, end) => {
    const distance = distanceBetweenSamples(start, end)
    if (distance === null || distance <= Number.EPSILON) {
        return null
    }

    const startLongitude = degreesToRadians(start?.longitude)
    const startLatitude = degreesToRadians(start?.latitude)
    const endLongitude = degreesToRadians(end?.longitude)
    const endLatitude = degreesToRadians(end?.latitude)
    const deltaLongitude = normalizeLongitudeDelta(endLongitude - startLongitude)
    const deltaLatitude = endLatitude - startLatitude
    return Math.atan2(
        deltaLongitude * Math.cos((startLatitude + endLatitude) / 2),
        deltaLatitude,
    )
}

const elapsedSecondsBetweenSamples = (start, end) => {
    const startTime = finiteNumber(start?.journeyElapsedMillis ?? start?.timeMillis)
    const endTime = finiteNumber(end?.journeyElapsedMillis ?? end?.timeMillis)
    if (startTime === null || endTime === null) {
        return null
    }

    return Math.abs(endTime - startTime) / 1000
}

const rollSamplesFor = ({sample, sampler}) => {
    const currentDistance = finiteNumber(sample?.distanceFromStart)
    if (sampler?.atDistance && currentDistance !== null) {
        const totalDistance = finiteNumber(sampler.totalDistance)
        const durationMillis = finiteNumber(sampler.durationMillis ?? sample?.journeyDurationMillis)
        const averageSpeed = totalDistance !== null && durationMillis !== null && durationMillis > 0
                            ? totalDistance / (durationMillis / 1000)
                            : null
        const probeDistance = clamp(
            Math.max(REPLAY_ROLL_MIN_PROBE_METERS, (averageSpeed ?? 0) * REPLAY_ROLL_PROBE_SECONDS),
            REPLAY_ROLL_MIN_PROBE_METERS,
            REPLAY_ROLL_MAX_PROBE_METERS,
        )
        return {
            current: sampler.atDistance(currentDistance),
            previous: sampler.atDistance(currentDistance - probeDistance),
            next: sampler.atDistance(currentDistance + probeDistance),
            averageSpeed,
        }
    }

    const totalDistance = finiteNumber(sample?.totalDistance)
                         ?? ((finiteNumber(sample?.distanceFromStart) ?? 0)
                             + (finiteNumber(sample?.remainingDistance) ?? 0))
    const durationMillis = finiteNumber(sample?.journeyDurationMillis)
    const averageSpeed = totalDistance > 0 && durationMillis > 0
                         ? totalDistance / (durationMillis / 1000)
                         : null
    return {
        current: sample,
        previous: sample?.source?.startPoint ?? sample?.previous ?? null,
        next: sample?.source?.endPoint ?? sample?.next ?? null,
        averageSpeed,
    }
}

const markerPositionForSample = (sample, markerSettings) => {
    const override = markerSettings?.position
    if (!override) {
        return sample
    }

    return {
        ...sample,
        longitude: override.longitude,
        latitude:  override.latitude,
        altitude:  finiteNumber(override.altitude) ?? finiteNumber(sample?.altitude ?? sample?.height) ?? 0,
    }
}

const pathHeadingForSample = sample => {
    const next = sample?.source?.endPoint
               ?? sample?.endPoint
               ?? sample?.next
               ?? sample
    return headingBetweenSamples(sample, next) ?? 0
}

/**
 * Resolve the deterministic banking response for a replay camera sample.
 *
 * The local turn is measured over a metric sampler window so Draft and HQ see
 * the same curvature. Speed is compared with the journey average, stationary
 * samples stay level, and the result is eased and clamped to 45 degrees.
 *
 * @param {Object} options - Roll inputs.
 * @param {Object|null} [options.sample=null] - Current logical replay sample.
 * @param {Object|null} [options.sampler=null] - Shared metric replay sampler.
 * @param {number} [options.sensitivity=1] - Roll response multiplier.
 * @returns {number} Roll in radians.
 */
export const resolveJourneyReplayLogicalCameraRoll = ({sample = null, sampler = null, sensitivity = 1} = {}) => {
    if (!sample) {
        return 0
    }

    const {current, previous, next, averageSpeed} = rollSamplesFor({sample, sampler})
    if (!current || !previous || !next) {
        return 0
    }

    const incomingHeading = headingBetweenSamples(previous, current)
    const outgoingHeading = headingBetweenSamples(current, next)
    const turnDelta = angularDelta(incomingHeading, outgoingHeading)
    if (turnDelta === null || Math.abs(turnDelta) <= REPLAY_ROLL_TURN_START_RADIANS) {
        return 0
    }

    const windowDistance = distanceBetweenSamples(previous, next)
    const elapsedSeconds = elapsedSecondsBetweenSamples(previous, next)
    if (windowDistance === null || elapsedSeconds === null || elapsedSeconds <= 0) {
        return 0
    }

    const localSpeed = windowDistance / elapsedSeconds
    if (!Number.isFinite(localSpeed) || localSpeed < MIN_REPLAY_ROLL_SPEED_METERS_PER_SECOND) {
        return 0
    }

    const turnMagnitude = Math.abs(turnDelta)
    const curvature = turnMagnitude / Math.max(windowDistance, 1)
    const turnFactor = smoothstep(
        (turnMagnitude - REPLAY_ROLL_TURN_START_RADIANS)
        / (REPLAY_ROLL_TURN_FULL_RADIANS - REPLAY_ROLL_TURN_START_RADIANS),
    )
    const curvatureFactor = smoothstep(
        (curvature - REPLAY_ROLL_MIN_CURVATURE)
        / (REPLAY_ROLL_FULL_CURVATURE - REPLAY_ROLL_MIN_CURVATURE),
    )
    const referenceSpeed = Math.max(
        MIN_REPLAY_ROLL_SPEED_METERS_PER_SECOND,
        averageSpeed ?? localSpeed,
    )
    const speedFactor = clamp(localSpeed / (referenceSpeed * 2.5), 0, 1)

    const normalizedSensitivity = clamp(finiteNumber(sensitivity) ?? 1, 0, 1)
    return clamp(
        Math.sign(turnDelta) * MAX_REPLAY_CAMERA_ROLL * turnFactor * curvatureFactor * speedFactor * normalizedSensitivity,
        -MAX_REPLAY_CAMERA_ROLL,
        MAX_REPLAY_CAMERA_ROLL,
    )
}

/**
 * Resolve the camera pose from replay data and settings without consulting a
 * renderer, terrain provider, Cesium camera, or camera flight callback.
 *
 * @param {Object} options - Logical pose inputs.
 * @param {number|null} [options.axisHeading] - Canonical path heading in radians.
 * @param {boolean} [options.useAxisHeadingForSystem=false] - Let Navigation use the path heading in system position mode.
 * @returns {Object|null} A renderer-independent camera pose.
 */
export const resolveJourneyReplayLogicalCameraPose = ({
                                                           sample = null,
                                                           sampler = null,
                                                           progress = sample?.progress ?? 0,
                                                           cameraSettings = null,
                                                           markerSettings = null,
                                                           axisHeading = null,
                                                           useAxisHeadingForSystem = false,
                                                       } = {}) => {
    if (!sample || !cameraSettings) {
        return null
    }

    const anchorSample = markerPositionForSample(sample, markerSettings)
    const resolvedAxisHeading = finiteNumber(axisHeading) ?? pathHeadingForSample(sample)
    const positionMode = cameraSettings.positionMode ?? REPLAY_CAMERA_POSITION_SYSTEM
    const headingOffset = degreesToRadians(clamp(finiteNumber(cameraSettings.headingOffset) ?? 0, -180, 180)) ?? 0
    const desiredHeading = positionMode === REPLAY_CAMERA_POSITION_SYSTEM
                           ? useAxisHeadingForSystem && finiteNumber(axisHeading) !== null
                               ? resolvedAxisHeading
                               : degreesToRadians(cameraSettings.heading) ?? resolvedAxisHeading
                           : (positionMode === REPLAY_CAMERA_POSITION_AHEAD ? resolvedAxisHeading + Math.PI : resolvedAxisHeading) + headingOffset
    const normalizedPitch = finiteNumber(cameraSettings.pitch) ?? -65
    const pitch = normalizedPitch <= -89
                  ? SAFE_TOP_DOWN_PITCH
                  : degreesToRadians(normalizedPitch) ?? SAFE_TOP_DOWN_PITCH
    const sampleHeight = finiteNumber(anchorSample?.altitude ?? anchorSample?.height) ?? 0
    const configuredAltitude = finiteNumber(cameraSettings.altitude)
    const cameraHeight = cameraSettings.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET
                         ? sampleHeight + (configuredAltitude ?? 0)
                         : configuredAltitude ?? sampleHeight

    return {
        sample: anchorSample,
        progress: clamp(Number(progress) || 0, 0, 1),
        heading: desiredHeading,
        pitch,
        roll: cameraSettings.canRoll === false
              ? 0
              : resolveJourneyReplayLogicalCameraRoll({
                  sample,
                  sampler,
                  sensitivity: cameraSettings.rollSensitivity,
              }),
        cameraSettings,
        markerSettings,
        cameraHeight,
        logical: true,
    }
}

export const logicalHeadingForSample = sample => pathHeadingForSample(sample)
