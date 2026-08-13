/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: elevationCoordinateUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-05-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    FEATURE_LINE_STRING, FEATURE_MULTILINE_STRING, FEATURE_POINT,
} from '@Utils/cesium/TrackUtils'

const coordinatesOf = geometry => geometry?.coordinates

export const flattenFeatureGeometryCoordinates = geometry => {
    const coordinates = coordinatesOf(geometry)

    if (!Array.isArray(coordinates)) {
        return []
    }

    switch (geometry?.type) {
        case FEATURE_POINT:
            return [coordinates]
        case FEATURE_LINE_STRING:
            return coordinates
        case FEATURE_MULTILINE_STRING:
            return coordinates.flatMap(segment => Array.isArray(segment) ? segment : [])
        default:
            return []
    }
}

export const applyElevationCoordinatesToFeature = (feature, coordinates) => {
    const geometry = feature?.geometry
    if (!geometry || !Array.isArray(coordinates)) {
        return
    }

    switch (geometry.type) {
        case FEATURE_POINT:
            geometry.coordinates = coordinates[0] ?? geometry.coordinates
            break
        case FEATURE_MULTILINE_STRING: {
            let cursor = 0
            geometry.coordinates = geometry.coordinates.map(segment => {
                const length = Array.isArray(segment) ? segment.length : 0
                const nextSegment = coordinates.slice(cursor, cursor + length)
                cursor += length
                return nextSegment
            })
            break
        }
        case FEATURE_LINE_STRING:
            geometry.coordinates = coordinates
            break
    }
}

export const prepareJourneyElevationCoordinates = (journeyGeoJson, originGeoJson) => {
    const coordinates = []
    const origins = []
    const features = journeyGeoJson?.features ?? []
    const originFeatures = originGeoJson?.features ?? []

    features.forEach((feature, index) => {
        const featureCoordinates = flattenFeatureGeometryCoordinates(feature?.geometry)
        const originCoordinates = flattenFeatureGeometryCoordinates(originFeatures[index]?.geometry)

        coordinates.push(...featureCoordinates.map(([lon, lat]) => [lon, lat]))
        origins.push(...featureCoordinates.map((coordinate, pointIndex) => originCoordinates[pointIndex] ?? coordinate))
    })

    return {coordinates, origins}
}
