/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughProfileProgress.js
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

export const FLYTHROUGH_PROFILE_DISTANCE = 'FlythroughDistance'
export const FLYTHROUGH_PROFILE_TRACK_SLUG = 'FlythroughTrackSlug'
export const FLYTHROUGH_PROFILE_TRACK_INDEX = 'FlythroughTrackIndex'
export const FLYTHROUGH_PROFILE_POINT_INDEX = 'FlythroughPointIndex'

export const extendFlythroughProfileDimensions = dimensions => [
    ...(dimensions ?? []),
    FLYTHROUGH_PROFILE_DISTANCE,
    FLYTHROUGH_PROFILE_TRACK_SLUG,
    FLYTHROUGH_PROFILE_TRACK_INDEX,
    FLYTHROUGH_PROFILE_POINT_INDEX,
]

export const appendFlythroughProfileMetadata = (row, {
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

export const flythroughProfileDimensionIndexes = dimensions => ({
    distanceFromStart: dimensions?.indexOf?.(FLYTHROUGH_PROFILE_DISTANCE) ?? -1,
    trackSlug:         dimensions?.indexOf?.(FLYTHROUGH_PROFILE_TRACK_SLUG) ?? -1,
    trackIndex:        dimensions?.indexOf?.(FLYTHROUGH_PROFILE_TRACK_INDEX) ?? -1,
    pointIndex:        dimensions?.indexOf?.(FLYTHROUGH_PROFILE_POINT_INDEX) ?? -1,
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

export const createFlythroughProfileDatasetLookup = (dataset, dimensions) => {
    const indexes = flythroughProfileDimensionIndexes(dimensions)
    const source = Array.isArray(dataset?.source) ? dataset.source : []

    return {
        dataset,
        source,
        distances: source.map(row => finiteNumber(row?.[indexes.distanceFromStart])),
    }
}

export const convertFlythroughDistance = (distance, unitSystem = INTERNATIONAL) =>
    UnitUtils.convert(distance ?? 0).to(DISTANCE_UNITS[unitSystem] ?? DISTANCE_UNITS[INTERNATIONAL])

export const convertFlythroughElevation = (altitude, unitSystem = INTERNATIONAL) =>
    UnitUtils.convert(altitude ?? 0).to(ELEVATION_UNITS[unitSystem] ?? ELEVATION_UNITS[INTERNATIONAL])

export const flythroughProfileRowFromSample = (sample, {
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
    const indexes = flythroughProfileDimensionIndexes(dimensions)

    row[distanceIndex] = convertFlythroughDistance(sample.distanceFromStart, unitSystem)
    row[elevationIndex] = convertFlythroughElevation(sample.altitude ?? sample.height, unitSystem)
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

export const flythroughSampleFromProfileRow = (row, dimensions, sampler = null) => {
    if (!Array.isArray(row)) {
        return null
    }

    const indexes = flythroughProfileDimensionIndexes(dimensions)
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

export const buildFlythroughCompletedProfileSource = ({
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

    const indexes = flythroughProfileDimensionIndexes(dimensions)
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
            const sampleRow = flythroughProfileRowFromSample(sample, {dimensions, unitSystem})
            if (sampleRow) {
                source.push(sampleRow)
            }
        }
    }

    return source
}
