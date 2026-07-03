/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayProfileProgress.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DISTANCE_UNITS, ELEVATION_UNITS, INTERNATIONAL, UnitUtils } from '@Utils/UnitUtils'

export const REPLAY_PROFILE_DISTANCE = 'JourneyReplayDistance'
export const REPLAY_PROFILE_TRACK_SLUG = 'JourneyReplayTrackSlug'
export const REPLAY_PROFILE_TRACK_INDEX = 'JourneyReplayTrackIndex'
export const REPLAY_PROFILE_POINT_INDEX = 'JourneyReplayPointIndex'

export const extendJourneyReplayProfileDimensions = dimensions => [
    ...(dimensions ?? []),
    REPLAY_PROFILE_DISTANCE,
    REPLAY_PROFILE_TRACK_SLUG,
    REPLAY_PROFILE_TRACK_INDEX,
    REPLAY_PROFILE_POINT_INDEX,
]

export const appendJourneyReplayProfileMetadata = (row, {
    distanceFromStart,
    trackSlug,
    trackIndex,
    pointIndex,
}) => [
    ...(row ?? []),
    distanceFromStart,
    trackSlug,
    trackIndex,
    pointIndex,
]

export const replayProfileDimensionIndexes = dimensions => ({
    distanceFromStart: dimensions?.indexOf?.(REPLAY_PROFILE_DISTANCE) ?? -1,
    trackSlug:         dimensions?.indexOf?.(REPLAY_PROFILE_TRACK_SLUG) ?? -1,
    trackIndex:        dimensions?.indexOf?.(REPLAY_PROFILE_TRACK_INDEX) ?? -1,
    pointIndex:        dimensions?.indexOf?.(REPLAY_PROFILE_POINT_INDEX) ?? -1,
})

const finiteNumber = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

const upperBoundDistance = (distances, targetDistance) => {
    let low = 0
    let high = distances.length

    while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if ((distances[mid] ?? Infinity) <= targetDistance) {
            low = mid + 1
        }
        else {
            high = mid
        }
    }

    return low
}

export const createJourneyReplayProfileDatasetLookup = (dataset, dimensions) => {
    const indexes = replayProfileDimensionIndexes(dimensions)
    const source = Array.isArray(dataset?.source) ? dataset.source : []

    return {
        dataset,
        source,
        distances: source.map(row => finiteNumber(row?.[indexes.distanceFromStart])),
    }
}

export const convertJourneyReplayDistance = (distance, unitSystem = INTERNATIONAL) =>
    UnitUtils.convert(distance ?? 0).to(DISTANCE_UNITS[unitSystem] ?? DISTANCE_UNITS[INTERNATIONAL])

export const convertJourneyReplayElevation = (altitude, unitSystem = INTERNATIONAL) =>
    UnitUtils.convert(altitude ?? 0).to(ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[INTERNATIONAL])

export const buildJourneyReplayProfileMetricSummary = (sample, {
    totalDistance = 0,
    direction = 1,
    unitSystem = INTERNATIONAL,
    distancePrecision = 1,
    elevationPrecision = 0,
} = {}) => {
    if (!sample) {
        return null
    }

    const normalizedDirection = Number(direction) < 0 ? -1 : 1
    const coveredDistance = normalizedDirection < 0
                            ? (sample.remainingDistance ?? Math.max(0, totalDistance - (sample.distanceFromStart ?? 0)))
                            : (sample.distanceFromStart ?? 0)
    const remainingDistance = Math.max(0, totalDistance - coveredDistance)

    return {
        coveredDistance,
        remainingDistance,
        altitude: sample.altitude ?? sample.height ?? 0,
        covered: UnitUtils.formatMetric(coveredDistance, {
            units:     DISTANCE_UNITS,
            unitSystem,
            precision: distancePrecision,
        }).full.trim(),
        altitudeLabel: UnitUtils.formatMetric(sample.altitude ?? sample.height ?? 0, {
            units:     ELEVATION_UNITS,
            unitSystem,
            precision: elevationPrecision,
        }).full.trim(),
        remaining: UnitUtils.formatMetric(remainingDistance, {
            units:     DISTANCE_UNITS,
            unitSystem,
            precision: distancePrecision,
        }).full.trim(),
    }
}

export const replayProfileRowFromSample = (sample, {
    dimensions,
    unitSystem = INTERNATIONAL,
    distanceLabel = 'Distance',
    elevationLabel = 'Elevation',
    timeLabel = 'Time',
    pointLabel = 'point',
} = {}) => {
    if (!sample) {
        return null
    }

    const row = new Array(Math.max(Array.isArray(dimensions) ? dimensions.length : 0, 4)).fill(null)
    const distanceIndex = dimensions?.indexOf?.(distanceLabel) ?? 0
    const elevationIndex = dimensions?.indexOf?.(elevationLabel) ?? 1
    const timeIndex = dimensions?.indexOf?.(timeLabel) ?? 2
    const pointIndex = dimensions?.indexOf?.(pointLabel) ?? 3
    const indexes = replayProfileDimensionIndexes(dimensions)

    row[distanceIndex] = convertJourneyReplayDistance(sample.distanceFromStart, unitSystem)
    row[elevationIndex] = convertJourneyReplayElevation(sample.altitude ?? sample.height, unitSystem)
    row[timeIndex] = sample.time ?? null
    row[pointIndex] = sample

    if (indexes.distanceFromStart >= 0) {
        row[indexes.distanceFromStart] = sample.distanceFromStart
    }
    if (indexes.trackSlug >= 0) {
        row[indexes.trackSlug] = sample.trackSlug
    }
    if (indexes.trackIndex >= 0) {
        row[indexes.trackIndex] = sample.trackIndex
    }
    if (indexes.pointIndex >= 0) {
        row[indexes.pointIndex] = sample.pointIndex
    }

    return row
}

export const replaySampleFromProfileRow = (row, dimensions, sampler = null) => {
    if (!Array.isArray(row)) {
        return null
    }

    const indexes = replayProfileDimensionIndexes(dimensions)
    const distanceFromStart = finiteNumber(row[indexes.distanceFromStart])
    if (distanceFromStart !== null && sampler?.atDistance) {
        return sampler.atDistance(distanceFromStart)
    }

    const point = row[dimensions?.indexOf?.('point') ?? 3]
    if (!point) {
        return null
    }

    return {
        ...point,
        altitude: point.altitude ?? point.height,
        height: point.height ?? point.altitude,
        distanceFromStart,
        remainingDistance: null,
        trackSlug: row[indexes.trackSlug],
        trackIndex: row[indexes.trackIndex],
        pointIndex: row[indexes.pointIndex],
        progress: null,
        interpolated: false,
    }
}

export const buildJourneyReplayCompletedProfileSource = ({
    dataset,
    lookup,
    dimensions,
    sample,
    unitSystem = INTERNATIONAL,
}) => {
    const sourceRows = lookup?.source ?? dataset?.source
    if (!dataset || !sample || !Array.isArray(sourceRows)) {
        return []
    }

    const indexes = replayProfileDimensionIndexes(dimensions)
    const targetDistance = finiteNumber(sample.distanceFromStart)
    if (indexes.distanceFromStart < 0 || targetDistance === null) {
        return []
    }

    const source = lookup?.distances
                   ? sourceRows.slice(0, upperBoundDistance(lookup.distances, targetDistance))
                   : sourceRows.filter(row => {
                       const rowDistance = finiteNumber(row?.[indexes.distanceFromStart])
                       return rowDistance !== null && rowDistance <= targetDistance
                   })

    if (sample.trackSlug === dataset.id) {
        const lastDistance = finiteNumber(source.at(-1)?.[indexes.distanceFromStart])
        if (lastDistance === null || Math.abs(lastDistance - targetDistance) > 0.01) {
            const sampleRow = replayProfileRowFromSample(sample, {dimensions, unitSystem})
            if (sampleRow) {
                source.push(sampleRow)
            }
        }
    }

    return source
}
