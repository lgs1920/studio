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
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {lineString, point} from '@turf/helpers'
import nearestPointOnLine from '@turf/nearest-point-on-line'

/**
 * Project POI triggers onto the exact selected, corrected logical Replay path.
 * @param {Array<object>} entries - Nearby POIs from the association index.
 * @param {object|null} sampler - Canonical Replay path sampler.
 * @returns {Array<object>} Entries with abscissas measured on the active sampler.
 */
export const projectReplayPOIsOnSampler = (entries, sampler) => {
    const samples = sampler?.samples
    const segments = sampler?.segments
    if (!Array.isArray(samples) || !Array.isArray(segments)) {
        return entries
    }

    const paths = segments.flatMap(segment => {
        const coordinates = samples.slice(segment.startIndex, segment.endIndex + 1)
            .map(sample => [sample.longitude, sample.latitude])
        return coordinates.length >= 2 ? [{segment, path: lineString(coordinates)}] : []
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
                    projectedAbscissa: segment.startDistance + projection.properties.totalDistance,
                }
            }
        }
        return nearest ? [{...entry, projectedAbscissa: nearest.projectedAbscissa}] : []
    })
}
