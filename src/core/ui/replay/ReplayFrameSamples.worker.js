/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayFrameSamples.worker.js
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
 * Return a finite numeric value or null.
 *
 * @param {*} value - Value to normalize.
 * @returns {number|null} Finite value or null.
 */
const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

/**
 * Clamp a value to the requested interval.
 *
 * @param {number} value - Value to clamp.
 * @param {number} minimum - Minimum value.
 * @param {number} maximum - Maximum value.
 * @returns {number} Clamped value.
 */
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value))

/**
 * Copy the plain sample fields used by Replay interpolation.
 *
 * @param {object|null} sample - Source route sample.
 * @returns {object|null} Plain sample reference.
 */
const sampleReference = sample => sample ? {
    progress: sample.progress,
    distanceFromStart: sample.distanceFromStart,
    remainingDistance: sample.remainingDistance,
    time: sample.time,
    timeMillis: sample.timeMillis,
    journeyElapsedMillis: sample.journeyElapsedMillis,
    journeyDurationMillis: sample.journeyDurationMillis,
    trackSlug: sample.trackSlug,
    trackIndex: sample.trackIndex,
    pointIndex: sample.pointIndex,
    segmentIndex: sample.segmentIndex,
    segmentRatio: sample.segmentRatio,
    longitude: sample.longitude,
    latitude: sample.latitude,
    altitude: sample.altitude,
    height: sample.height,
    interpolated: sample.interpolated,
} : null

/**
 * Clone a sampled route point using the canonical Replay sample shape.
 *
 * @param {object|null} sample - Source route sample.
 * @returns {object|null} Cloned route sample.
 */
const cloneSample = sample => sample ? {
    ...sampleReference(sample),
    source: sample.source ? {
        startPoint: sampleReference(sample.source.startPoint),
        endPoint: sampleReference(sample.source.endPoint),
    } : undefined,
} : null

/**
 * Interpolate nullable metrics with the same endpoint rules as the sampler.
 *
 * @param {*} start - Start metric.
 * @param {*} end - End metric.
 * @param {number} ratio - Segment ratio.
 * @returns {number|null} Interpolated metric.
 */
const interpolateNullableValue = (start, end, ratio) => {
    const startValue = finiteNumber(start)
    const endValue = finiteNumber(end)
    if (startValue === null || endValue === null) {
        return startValue ?? endValue
    }
    return startValue + ((endValue - startValue) * ratio)
}

/**
 * Interpolate a route sample at the supplied cumulative distance.
 *
 * @param {object} start - Start route sample.
 * @param {object} end - End route sample.
 * @param {number} targetDistance - Requested cumulative distance.
 * @param {number} totalDistance - Journey distance.
 * @returns {object} Interpolated Replay sample.
 */
const interpolateSample = (start, end, targetDistance, totalDistance) => {
    const distance = end.distanceFromStart - start.distanceFromStart
    const ratio = distance > 0 ? clamp((targetDistance - start.distanceFromStart) / distance, 0, 1) : 0
    const altitude = (start.altitude ?? 0) + (((end.altitude ?? 0) - (start.altitude ?? 0)) * ratio)
    const timeMillis = interpolateNullableValue(start.timeMillis, end.timeMillis, ratio)

    return {
        progress: totalDistance > 0 ? clamp(targetDistance / totalDistance, 0, 1) : 0,
        distanceFromStart: targetDistance,
        remainingDistance: Math.max(0, totalDistance - targetDistance),
        time: Number.isFinite(timeMillis) ? new Date(timeMillis).toISOString() : null,
        timeMillis,
        journeyElapsedMillis: interpolateNullableValue(start.journeyElapsedMillis, end.journeyElapsedMillis, ratio),
        journeyDurationMillis: start.journeyDurationMillis ?? end.journeyDurationMillis ?? null,
        trackSlug: end.trackSlug,
        trackIndex: end.trackIndex,
        pointIndex: end.pointIndex,
        segmentIndex: end.segmentIndex,
        segmentRatio: ratio,
        longitude: start.longitude + ((end.longitude - start.longitude) * ratio),
        latitude: start.latitude + ((end.latitude - start.latitude) * ratio),
        altitude,
        height: altitude,
        cumulativeElevationGain: interpolateNullableValue(
            start.cumulativeElevationGain,
            end.cumulativeElevationGain,
            ratio,
        ) ?? 0,
        interpolated: true,
        source: {
            startPoint: sampleReference(start),
            endPoint: sampleReference(end),
        },
    }
}

/**
 * Resolve one journey sample at normalized progress.
 *
 * @param {object[]} samples - Ordered journey samples.
 * @param {number} totalDistance - Journey distance.
 * @param {number} progress - Normalized progress.
 * @returns {object|null} Resolved route sample.
 */
const sampleAtProgress = (samples, totalDistance, progress) => {
    if (samples.length === 0) {
        return null
    }
    if (samples.length === 1 || totalDistance <= 0) {
        return cloneSample(samples[0])
    }

    const targetDistance = clamp(Number(progress) || 0, 0, 1) * totalDistance
    if (targetDistance <= 0) {
        return cloneSample(samples[0])
    }
    if (targetDistance >= totalDistance) {
        return cloneSample(samples[samples.length - 1])
    }

    let low = 0
    let high = samples.length - 1
    while (low < high) {
        const middle = Math.floor((low + high) / 2)
        if (samples[middle].distanceFromStart < targetDistance) {
            low = middle + 1
        }
        else {
            high = middle
        }
    }

    const end = samples[low]
    const start = samples[Math.max(0, low - 1)]
    if (!start || start === end || end.distanceFromStart === start.distanceFromStart) {
        return cloneSample(end)
    }
    return interpolateSample(start, end, targetDistance, totalDistance)
}

let routeSamples = []
let totalDistance = 0

/**
 * Prepare one requested batch of export frame samples.
 *
 * @param {MessageEvent} event - Worker request.
 * @returns {void}
 */
const prepareFrameSamples = event => {
    const {type, samples = [], totalDistance: distance = 0, startIndex = 0, progresses = []} = event.data ?? {}
    if (type === 'initialize') {
        routeSamples = samples
        totalDistance = distance
        return
    }
    if (type !== 'batch') {
        return
    }

    const startedAt = performance.now()
    const frameSamples = progresses.map(progress => sampleAtProgress(routeSamples, totalDistance, progress))
    globalThis.postMessage({
        type: 'batch',
        startIndex,
        samples: frameSamples,
        processingMillis: Math.max(0, performance.now() - startedAt),
    })
}

globalThis.addEventListener('message', prepareFrameSamples)
