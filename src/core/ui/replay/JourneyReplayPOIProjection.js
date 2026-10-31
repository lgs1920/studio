/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayPOIProjection.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {lineString, point} from '@turf/helpers'
import turfDistance from '@turf/distance'
import nearestPointOnLine from '@turf/nearest-point-on-line'

// Accept small GPS offsets between outbound and return traces of the same road.
const REPLAY_POI_PASSAGE_DISTANCE_TOLERANCE_METERS = 25
const REPLAY_POI_DISTANCE_PLATEAU_EPSILON_METERS = 0.01
const REPLAY_POI_PASSAGE_ABSCISSA_EPSILON_METERS = 1
/** Find every distinct local route passage near a POI, collapsing adjacent samples. */
const projectPOIPassages = (position, paths, nearest) => {
    const passages = []
    paths.forEach(({segment, samples}) => {
        const distances = samples.map(sample => turfDistance(
            position,
            point([sample.longitude, sample.latitude]),
            {units: 'meters'},
        ))

        let index = 0
        while (index < distances.length) {
            const plateauStart = index
            let plateauEnd = index
            while (plateauEnd + 1 < distances.length
                && Math.abs(distances[plateauEnd + 1] - distances[plateauStart])
                    <= REPLAY_POI_DISTANCE_PLATEAU_EPSILON_METERS) {
                plateauEnd += 1
            }

            const distance = distances[plateauStart]
            const previousDistance = distances[plateauStart - 1] ?? Number.POSITIVE_INFINITY
            const nextDistance = distances[plateauEnd + 1] ?? Number.POSITIVE_INFINITY
            const isLocalMinimum = distance <= previousDistance + REPLAY_POI_DISTANCE_PLATEAU_EPSILON_METERS
                && distance <= nextDistance + REPLAY_POI_DISTANCE_PLATEAU_EPSILON_METERS
                && (distance < previousDistance - REPLAY_POI_DISTANCE_PLATEAU_EPSILON_METERS
                    || distance < nextDistance - REPLAY_POI_DISTANCE_PLATEAU_EPSILON_METERS
                    || plateauStart === 0
                    || plateauEnd === distances.length - 1)
            if (!isLocalMinimum) {
                index = plateauEnd + 1
                continue
            }

            const localStartIndex = Math.max(0, plateauStart - 1)
            const localEndIndex = Math.min(samples.length - 1, plateauEnd + 1)
            const localSamples = samples.slice(localStartIndex, localEndIndex + 1)
            if (localSamples.length < 2) {
                index = plateauEnd + 1
                continue
            }
            const localPath = lineString(localSamples.map(sample => [sample.longitude, sample.latitude]))
            const projection = nearestPointOnLine(localPath, position, {units: 'meters'})
            const segmentStartDistance = Number.isFinite(samples[localStartIndex]?.distanceFromStart)
                ? samples[localStartIndex].distanceFromStart
                : segment.startDistance
            passages.push({
                distanceToPOIMeters: projection.properties.pointDistance,
                projectedAbscissa: segmentStartDistance + projection.properties.totalDistance,
                projectedPoint: projection.geometry.coordinates,
            })
            index = plateauEnd + 1
        }
    })

    if (passages.length === 0 && nearest) {
        return [{
            distanceToPOIMeters: nearest.distance,
            projectedAbscissa: nearest.projectedAbscissa,
            projectedPoint: nearest.projectedPoint,
        }]
    }

    if (nearest && !passages.some(passage => (
        Math.abs(passage.projectedAbscissa - nearest.projectedAbscissa) <= REPLAY_POI_PASSAGE_ABSCISSA_EPSILON_METERS
    ))) {
        passages.push({
            distanceToPOIMeters: nearest.distance,
            projectedAbscissa: nearest.projectedAbscissa,
            projectedPoint: nearest.projectedPoint,
        })
    }

    const nearestDistance = passages.reduce(
        (minimum, passage) => Math.min(minimum, passage.distanceToPOIMeters),
        Number.POSITIVE_INFINITY,
    )
    const distinctPassages = passages
        .filter(passage => passage.distanceToPOIMeters <= nearestDistance + REPLAY_POI_PASSAGE_DISTANCE_TOLERANCE_METERS)
        .sort((left, right) => left.projectedAbscissa - right.projectedAbscissa)
        .filter((passage, index, ordered) => index === 0
            || passage.projectedAbscissa - ordered[index - 1].projectedAbscissa > REPLAY_POI_PASSAGE_ABSCISSA_EPSILON_METERS)

    return distinctPassages
}

/**
 * Project POI triggers onto the exact selected, corrected logical Replay path.
 * @param {Array<object>} entries - Nearby POIs from the association index.
 * @param {object|null} sampler - Canonical Replay path sampler.
 * @returns {Array<object>} Entries with nearest and repeated passage abscissas on the active sampler.
 */
export const projectReplayPOIsOnSampler = (entries, sampler) => {
    const samples = sampler?.samples
    const segments = sampler?.segments
    if (!Array.isArray(samples) || !Array.isArray(segments)) {
        return entries
    }

    const paths = segments.flatMap(segment => {
        const segmentSamples = samples.slice(segment.startIndex, segment.endIndex + 1)
        const coordinates = segmentSamples
            .map(sample => [sample.longitude, sample.latitude])
        return coordinates.length >= 2 ? [{segment, samples: segmentSamples, path: lineString(coordinates)}] : []
    })

    return entries.flatMap(entry => {
        const longitude = Number(entry?.poi?.longitude)
        const latitude = Number(entry?.poi?.latitude)
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
            return []
        }
        const position = point([longitude, latitude])
        let nearest = null
        for (const {segment, path} of paths) {
            const projection = nearestPointOnLine(path, position, {units: 'meters'})
            const distance = projection.properties.pointDistance
            if (!nearest || distance < nearest.distance) {
                nearest = {
                    distance,
                    distanceToJourneyMeters: distance,
                    projectedAbscissa: segment.startDistance + projection.properties.totalDistance,
                }
            }
        }
        if (!nearest) {
            return []
        }
        return [{
            ...entry,
            ...nearest,
            projectedPassages: projectPOIPassages(position, paths, nearest),
        }]
    })
}
