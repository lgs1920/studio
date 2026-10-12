/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraAnchorSmoothing.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-12
 * Last modified: 2026-10-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Project a geographic sample into a local east/north metric frame.
 *
 * @param {object} origin - Projection origin.
 * @param {object} sample - Geographic sample to project.
 * @returns {{x: number, y: number}|null} Local metric coordinates.
 */
const projectToLocalMeters = (origin, sample) => {
    const originLongitude = Number(origin?.longitude)
    const originLatitude = Number(origin?.latitude)
    const longitude = Number(sample?.longitude)
    const latitude = Number(sample?.latitude)
    if ([originLongitude, originLatitude, longitude, latitude].some(value => !Number.isFinite(value))) {
        return null
    }

    const radians = Math.PI / 180
    const earthRadiusMeters = 6_371_008.8
    const latitudeScale = Math.cos(originLatitude * radians)
    return {
        x: (longitude - originLongitude) * radians * earthRadiusMeters * latitudeScale,
        y: (latitude - originLatitude) * radians * earthRadiusMeters,
    }
}

const interpolate = (start, end, ratio) => start + ((end - start) * ratio)

/**
 * Resolve the camera-only route path at a distance, including eligible zigzag chords.
 *
 * @param {object} options - Route and section resolvers.
 * @param {number} options.distance - Journey distance in metres.
 * @param {Array<object>} options.cameraZigzagSections - Precomputed camera-only sections.
 * @param {Function} options.sampleAtDistance - Original route sample resolver.
 * @param {Function|null} options.cropZoneWidthMetersForSection - Crop-width resolver per section.
 * @param {number} options.fallbackCropWidthMeters - Current projected crop width.
 * @returns {object|null} Original or chord-simplified camera path sample.
 */
export const cameraPathSampleAtDistance = ({
    distance,
    cameraZigzagSections,
    sampleAtDistance,
    cropZoneWidthMetersForSection,
    fallbackCropWidthMeters,
} = {}) => {
    const routeSample = sampleAtDistance?.(distance)
    if (!routeSample) {
        return null
    }

    const section = cameraZigzagSections.find(candidate => {
        if (candidate.trackSlug !== routeSample.trackSlug
            || candidate.trackIndex !== routeSample.trackIndex
            || candidate.segmentIndex !== routeSample.segmentIndex
            || distance < candidate.startDistance
            || distance > candidate.endDistance) {
            return false
        }

        const cropWidth = Math.max(
            0,
            Number(typeof cropZoneWidthMetersForSection === 'function'
                ? cropZoneWidthMetersForSection(candidate)
                : fallbackCropWidthMeters) || 0,
        )
        return candidate.amplitudeMeters < (cropWidth * 0.5)
    })
    if (!section) {
        return routeSample
    }

    const start = sampleAtDistance(section.startDistance)
    const end = sampleAtDistance(section.endDistance)
    const sectionDistance = Math.max(Number.EPSILON, section.endDistance - section.startDistance)
    const ratio = Math.max(0, Math.min(1, (distance - section.startDistance) / sectionDistance))
    const position = section.chordPath.positionAtDistance(section.chordPath.totalDistance * ratio)
    const altitude = interpolate(start.altitude ?? 0, end.altitude ?? 0, ratio)
    return {
        ...routeSample,
        longitude: position.longitude,
        latitude:  position.latitude,
        altitude,
        height: altitude,
    }
}

/**
 * Smooth a camera-only anchor over a spatial window, bounded by the visible crop.
 *
 * @param {object} options - Camera path and viewport bounds.
 * @param {object} options.sample - Unmodified route sample.
 * @param {number} options.smoothingWindowMeters - Route distance covered by the smoothing window.
 * @param {number} options.maximumOffsetMeters - Maximum allowed camera-only offset.
 * @param {number} options.segmentStartDistance - Current logical segment start.
 * @param {number} options.segmentEndDistance - Current logical segment end.
 * @param {Function} options.sampleAtDistance - Camera-path sample resolver.
 * @param {Array<object>} options.cameraZigzagSections - Precomputed camera-only sections.
 * @param {Function|null} options.cropZoneWidthMetersForSection - Crop-width resolver per section.
 * @param {number} options.fallbackCropWidthMeters - Current projected crop width.
 * @returns {{sample: object, adjusted: boolean}} Smoothed camera anchor and adjustment status.
 */
export const smoothReplayCameraAnchorSample = ({
    sample,
    smoothingWindowMeters,
    maximumOffsetMeters,
    segmentStartDistance,
    segmentEndDistance,
    cameraZigzagSections,
    sampleAtDistance,
    cropZoneWidthMetersForSection,
    fallbackCropWidthMeters,
} = {}) => {
    const windowMeters = Math.max(0, Number(smoothingWindowMeters) || 0)
    const maximumOffset = Math.max(0, Number(maximumOffsetMeters) || 0)
    if (windowMeters <= 0 || maximumOffset <= 0 || !sample) {
        return {sample, adjusted: false}
    }

    const sampleDistance = Number(sample.distanceFromStart)
    const segmentStart = Number(segmentStartDistance)
    const segmentEnd = Number(segmentEndDistance)
    if (![sampleDistance, segmentStart, segmentEnd].every(Number.isFinite)
        || typeof sampleAtDistance !== 'function') {
        return {sample, adjusted: false}
    }

    const halfWindow = windowMeters / 2
    if (sampleDistance - halfWindow < segmentStart || sampleDistance + halfWindow > segmentEnd) {
        return {sample, adjusted: false}
    }

    const windowStart = sampleDistance - halfWindow
    const windowEnd = sampleDistance + halfWindow
    if (windowEnd - windowStart <= 1) {
        return {sample, adjusted: false}
    }

    const sampleCount = 9
    const localOffsets = Array.from({length: sampleCount}, (_, index) => {
        const distance = windowStart + (((windowEnd - windowStart) * index) / (sampleCount - 1))
        return projectToLocalMeters(sample, cameraPathSampleAtDistance({
            distance,
            cameraZigzagSections,
            sampleAtDistance,
            cropZoneWidthMetersForSection,
            fallbackCropWidthMeters,
        }))
    }).filter(Boolean)
    if (localOffsets.length < 2) {
        return {sample, adjusted: false}
    }

    const desiredOffset = localOffsets.reduce((offset, point) => ({
        x: offset.x + point.x,
        y: offset.y + point.y,
    }), {x: 0, y: 0})
    desiredOffset.x /= localOffsets.length
    desiredOffset.y /= localOffsets.length
    const offsetLength = Math.hypot(desiredOffset.x, desiredOffset.y)
    if (!Number.isFinite(offsetLength) || offsetLength <= 1) {
        return {sample, adjusted: false}
    }

    const offsetRatio = Math.min(1, maximumOffset / offsetLength)
    const radiansPerDegree = Math.PI / 180
    const earthRadiusMeters = 6_371_008.8
    const latitudeScale = Math.max(1e-6, Math.abs(Math.cos(Number(sample.latitude) * radiansPerDegree)))
    return {
        sample: {
            ...sample,
            longitude: sample.longitude + ((desiredOffset.x * offsetRatio) / (earthRadiusMeters * latitudeScale)) / radiansPerDegree,
            latitude: sample.latitude + ((desiredOffset.y * offsetRatio) / earthRadiusMeters) / radiansPerDegree,
        },
        adjusted: true,
    }
}
