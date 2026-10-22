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
 * Last modified: 2026-10-22
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
 * Evaluate one cubic Bezier point in the local camera path plane.
 * @param {{x: number, y: number}} start - First endpoint.
 * @param {{x: number, y: number}} firstControl - First Bezier handle.
 * @param {{x: number, y: number}} secondControl - Second Bezier handle.
 * @param {{x: number, y: number}} end - Second endpoint.
 * @param {number} ratio - Progress through the Bezier span.
 * @returns {{x: number, y: number}} Evaluated point.
 */
const cubicBezierPoint = (start, firstControl, secondControl, end, ratio) => {
    const inverse = 1 - ratio
    const inverseSquared = inverse * inverse
    const ratioSquared = ratio * ratio
    const startWeight = inverseSquared * inverse
    const firstWeight = 3 * inverseSquared * ratio
    const secondWeight = 3 * inverse * ratioSquared
    const endWeight = ratioSquared * ratio

    return {
        x: (start.x * startWeight)
            + (firstControl.x * firstWeight)
            + (secondControl.x * secondWeight)
            + (end.x * endWeight),
        y: (start.y * startWeight)
            + (firstControl.y * firstWeight)
            + (secondControl.y * secondWeight)
            + (end.y * endWeight),
    }
}

/**
 * Convert four uniform B-spline knots into the Bezier handles for their span.
 * @param {{x: number, y: number}} previous - Knot before the span.
 * @param {{x: number, y: number}} first - Span start knot.
 * @param {{x: number, y: number}} second - Span end knot.
 * @param {{x: number, y: number}} next - Knot after the span.
 * @returns {Array<{x: number, y: number}>} Cubic Bezier endpoints and handles.
 */
const uniformSplineBezierControls = (previous, first, second, next) => ([
    {
        x: (previous.x + (4 * first.x) + second.x) / 6,
        y: (previous.y + (4 * first.y) + second.y) / 6,
    },
    {
        x: ((4 * first.x) + (2 * second.x)) / 6,
        y: ((4 * first.y) + (2 * second.y)) / 6,
    },
    {
        x: ((2 * first.x) + (4 * second.x)) / 6,
        y: ((2 * first.y) + (4 * second.y)) / 6,
    },
    {
        x: (first.x + (4 * second.x) + next.x) / 6,
        y: (first.y + (4 * second.y) + next.y) / 6,
    },
])

/**
 * Resolve an extrapolated camera-path knot in the local plane of the current sample.
 * @param {object} options - Path samples and fixed spline grid.
 * @param {object} options.sample - Current unsmoothed route sample.
 * @param {number} options.knotIndex - Knot index, including endpoint extrapolation.
 * @param {number} options.spanCount - Number of spans in the active track segment.
 * @param {number} options.segmentStartDistance - Start of the active track segment.
 * @param {number} options.spanLength - Distance between spline knots.
 * @param {Function} options.sampleAtDistance - Original route sample resolver.
 * @param {Array<object>} options.cameraZigzagSections - Eligible camera-only chord sections.
 * @param {Function|null} options.cropZoneWidthMetersForSection - Crop width per route section.
 * @param {number} options.fallbackCropWidthMeters - Current projected crop width.
 * @returns {{x: number, y: number}|null} Local knot position.
 */
const cameraSplineKnot = ({
    sample,
    knotIndex,
    spanCount,
    segmentStartDistance,
    spanLength,
    sampleAtDistance,
    cameraZigzagSections,
    cropZoneWidthMetersForSection,
    fallbackCropWidthMeters,
}) => {
    // Extrapolate virtual endpoint knots so the spline never samples a neighboring segment.
    const boundedIndex = Math.max(0, Math.min(spanCount, knotIndex))
    const boundedDistance = segmentStartDistance + (boundedIndex * spanLength)
    const boundedSample = cameraPathSampleAtDistance({
        distance: boundedDistance,
        cameraZigzagSections,
        sampleAtDistance,
        cropZoneWidthMetersForSection,
        fallbackCropWidthMeters,
    })
    const boundedPoint = projectToLocalMeters(sample, boundedSample)
    if (!boundedPoint || knotIndex === boundedIndex) {
        return boundedPoint
    }

    const adjacentIndex = knotIndex < 0 ? 1 : spanCount - 1
    const adjacentDistance = segmentStartDistance + (adjacentIndex * spanLength)
    const adjacentSample = cameraPathSampleAtDistance({
        distance: adjacentDistance,
        cameraZigzagSections,
        sampleAtDistance,
        cropZoneWidthMetersForSection,
        fallbackCropWidthMeters,
    })
    const adjacentPoint = projectToLocalMeters(sample, adjacentSample)
    if (!adjacentPoint) {
        return boundedPoint
    }

    return {
        x: boundedPoint.x + (boundedPoint.x - adjacentPoint.x),
        y: boundedPoint.y + (boundedPoint.y - adjacentPoint.y),
    }
}

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
 * Smooth a camera-only anchor along a fixed, cubic Bezier B-spline path.
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
    if (windowMeters <= 1 || maximumOffset <= 0 || !sample) {
        return {sample, adjusted: false}
    }

    const sampleDistance = Number(sample.distanceFromStart)
    const segmentStart = Number(segmentStartDistance)
    const segmentEnd = Number(segmentEndDistance)
    if (![sampleDistance, segmentStart, segmentEnd].every(Number.isFinite)
        || typeof sampleAtDistance !== 'function') {
        return {sample, adjusted: false}
    }

    const segmentLength = segmentEnd - segmentStart
    if (segmentLength <= 1 || sampleDistance < segmentStart || sampleDistance > segmentEnd) {
        return {sample, adjusted: false}
    }

    const targetSpanLength = windowMeters / 2
    const spanCount = Math.max(2, Math.ceil(segmentLength / targetSpanLength))
    const spanLength = segmentLength / spanCount
    const segmentProgress = (sampleDistance - segmentStart) / spanLength
    const spanIndex = Math.max(0, Math.min(spanCount - 1, Math.floor(segmentProgress)))
    const spanProgress = Math.max(0, Math.min(1, segmentProgress - spanIndex))
    const controlIndexes = [spanIndex - 1, spanIndex, spanIndex + 1, spanIndex + 2]
    const controls = controlIndexes.map(knotIndex => cameraSplineKnot({
        sample,
        knotIndex,
        spanCount,
        segmentStartDistance: segmentStart,
        spanLength,
        sampleAtDistance,
        cameraZigzagSections,
        cropZoneWidthMetersForSection,
        fallbackCropWidthMeters,
    }))
    if (controls.some(point => !point)) {
        return {sample, adjusted: false}
    }

    const bezierControls = uniformSplineBezierControls(...controls)
    const desiredOffset = cubicBezierPoint(...bezierControls, spanProgress)
    const offsetLength = Math.hypot(desiredOffset.x, desiredOffset.y)
    if (!Number.isFinite(offsetLength) || offsetLength <= 0.05) {
        return {sample, adjusted: false}
    }

    const offsetRatio = Math.min(1, maximumOffset / offsetLength)
    const radiansPerDegree = Math.PI / 180
    const earthRadiusMeters = 6_371_008.8
    const latitudeScale = Math.max(1e-6, Math.abs(Math.cos(Number(sample.latitude) * radiansPerDegree)))
    const longitude = Number(sample.longitude)
        + ((desiredOffset.x * offsetRatio) / (earthRadiusMeters * latitudeScale)) / radiansPerDegree
    const latitude = Number(sample.latitude)
        + ((desiredOffset.y * offsetRatio) / earthRadiusMeters) / radiansPerDegree
    return {
        sample: {
            ...sample,
            longitude,
            latitude: Math.max(-90, Math.min(90, latitude)),
        },
        adjusted: true,
    }
}
