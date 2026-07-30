/**
 * Renderer-independent replay camera-pose resolution.
 */

const REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET = 'ground-offset'
const REPLAY_CAMERA_POSITION_AHEAD = 'ahead'
const REPLAY_CAMERA_POSITION_SYSTEM = 'system'
const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const degreesToRadians = value => {
    const number = finiteNumber(value)
    return number === null ? null : number * Math.PI / 180
}

const smoothstep = value => {
    const t = clamp(finiteNumber(value) ?? 0, 0, 1)
    return t * t * (3 - (2 * t))
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

const samplePointDistanceMeters = (start, end) => {
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
    const earthRadiusMeters = 6371008.8
    return Math.hypot(
        deltaLongitude * Math.cos(averageLatitude),
        deltaLatitude,
    ) * earthRadiusMeters
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

const headingBetweenSamples = (start, end) => {
    const startLongitude = degreesToRadians(start?.longitude)
    const startLatitude = degreesToRadians(start?.latitude)
    const endLongitude = degreesToRadians(end?.longitude)
    const endLatitude = degreesToRadians(end?.latitude)
    if ([startLongitude, startLatitude, endLongitude, endLatitude].some(value => value === null)) {
        return 0
    }

    const deltaLongitude = normalizeLongitudeDelta(endLongitude - startLongitude)
    const deltaLatitude = endLatitude - startLatitude
    const east = deltaLongitude * Math.cos((startLatitude + endLatitude) / 2)
    return Math.atan2(east, deltaLatitude)
}

const pathHeadingForSample = sample => {
    const next = sample?.source?.endPoint
               ?? sample?.endPoint
               ?? sample?.next
               ?? sample
    return headingBetweenSamples(sample, next)
}

/**
 * Resolve the renderer-independent roll for one replay sample.
 *
 * The result is driven by the local turn curvature and the local segment speed
 * so that faster turns bank more strongly, while straight or under-defined
 * segments remain level.
 *
 * @param {Object} options - Roll inputs.
 * @returns {number} Roll in radians, clamped to 45 degrees.
 */
export const resolveJourneyReplayLogicalCameraRoll = ({
                                                          sample = null,
                                                      } = {}) => {
    const start = sample?.source?.startPoint
             ?? sample?.previous
             ?? null
    const current = sample ?? null
    const end = sample?.source?.endPoint
           ?? sample?.next
           ?? null

    if (!start || !current || !end) {
        return 0
    }

    const incomingHeading = headingBetweenSamples(start, current)
    const outgoingHeading = headingBetweenSamples(current, end)
    const turnDelta = angularDelta(incomingHeading, outgoingHeading)
    if (turnDelta === null) {
        return 0
    }

    const turnMagnitude = Math.abs(turnDelta)
    if (turnMagnitude <= 1e-6) {
        return 0
    }

    const startTime = finiteNumber(start?.journeyElapsedMillis ?? start?.timeMillis)
    const endTime = finiteNumber(end?.journeyElapsedMillis ?? end?.timeMillis)
    const segmentDurationSeconds = startTime === null || endTime === null
                                   ? null
                                   : Math.abs(endTime - startTime) / 1000
    const segmentDistanceMeters = samplePointDistanceMeters(start, end)
    if (segmentDurationSeconds === null
        || segmentDurationSeconds <= 0
        || segmentDistanceMeters === null
        || segmentDistanceMeters <= 0) {
        return 0
    }

    const localSpeed = segmentDistanceMeters / segmentDurationSeconds
    const journeyDurationSeconds = finiteNumber(current?.journeyDurationMillis) !== null
                                   ? Math.max(0.1, finiteNumber(current?.journeyDurationMillis) / 1000)
                                   : null
    const progress = clamp(finiteNumber(current?.progress) ?? 0, 0, 1)
    const distanceFromStart = finiteNumber(current?.distanceFromStart)
    const remainingDistance = finiteNumber(current?.remainingDistance)
    const totalDistance = distanceFromStart !== null && remainingDistance !== null
                          ? distanceFromStart + remainingDistance
                          : (distanceFromStart !== null && progress > 0
                             ? distanceFromStart / progress
                             : (remainingDistance !== null && progress < 1
                                ? remainingDistance / Math.max(1e-6, 1 - progress)
                                : null))
    const averageSpeed = totalDistance !== null && journeyDurationSeconds !== null && journeyDurationSeconds > 0
                         ? totalDistance / journeyDurationSeconds
                         : localSpeed
    const speedRatio = averageSpeed > 0 ? localSpeed / averageSpeed : 0
    const speedFactor = clamp(speedRatio / 1.25, 0, 1)
    const turnFactor = smoothstep((turnMagnitude - (5 * Math.PI / 180)) / (50 * Math.PI / 180))
    const rollLimit = Math.PI / 4
    return clamp(Math.sign(turnDelta) * rollLimit * turnFactor * speedFactor, -rollLimit, rollLimit)
}

/**
 * Resolve the camera pose from replay data and settings without consulting a
 * renderer, terrain provider, Cesium camera, or camera flight callback.
 *
 * @param {Object} options - Logical pose inputs.
 * @returns {Object|null} A renderer-independent camera pose.
 */
export const resolveJourneyReplayLogicalCameraPose = ({
                                                           sample = null,
                                                           progress = sample?.progress ?? 0,
                                                           cameraSettings = null,
                                                           markerSettings = null,
                                                           phase = null,
                                                           timeline = null,
                                                       } = {}) => {
    if (!sample || !cameraSettings) {
        return null
    }

    const anchorSample = markerPositionForSample(sample, markerSettings)
    const axisHeading = pathHeadingForSample(sample)
    const positionMode = cameraSettings.positionMode ?? REPLAY_CAMERA_POSITION_SYSTEM
    const headingOffset = degreesToRadians(clamp(finiteNumber(cameraSettings.headingOffset) ?? 0, -180, 180)) ?? 0
    const desiredHeading = positionMode === REPLAY_CAMERA_POSITION_SYSTEM
                           ? degreesToRadians(cameraSettings.heading) ?? axisHeading
                           : (positionMode === REPLAY_CAMERA_POSITION_AHEAD ? axisHeading + Math.PI : axisHeading) + headingOffset
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
        roll: resolveJourneyReplayLogicalCameraRoll({sample}),
        cameraSettings,
        markerSettings,
        cameraHeight,
        timeline: timeline ?? phase ?? null,
        logical: true,
    }
}

export const logicalHeadingForSample = sample => pathHeadingForSample(sample)
