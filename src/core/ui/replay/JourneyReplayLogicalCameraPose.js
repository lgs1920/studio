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
        roll: 0,
        cameraSettings,
        markerSettings,
        cameraHeight,
        timeline: timeline ?? phase ?? null,
        logical: true,
    }
}

export const logicalHeadingForSample = sample => pathHeadingForSample(sample)
