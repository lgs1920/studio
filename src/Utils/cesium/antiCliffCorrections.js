/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: antiCliffCorrections.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-18
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const validCoordinate = coordinate => Array.isArray(coordinate)
    && coordinate.length >= 2
    && coordinate.every(value => Number.isFinite(value))

const coordinatesMatch = (first, second) => Array.isArray(first)
    && Array.isArray(second)
    && first.length === second.length
    && first.every((value, index) => Number(value) === Number(second[index]))

const normalizeCorrection = correction => {
    const segmentIndex = Number(correction?.segmentIndex)
    const coordinateIndex = Number(correction?.coordinateIndex)
    const sourceCoordinate = correction?.sourceCoordinate
    const correctedCoordinate = correction?.correctedCoordinate
    if (!Number.isInteger(segmentIndex) || segmentIndex < 0
        || !Number.isInteger(coordinateIndex) || coordinateIndex < 0
        || !validCoordinate(sourceCoordinate) || !validCoordinate(correctedCoordinate)
        || sourceCoordinate.length !== correctedCoordinate.length) {
        return null
    }

    return {
        segmentIndex,
        coordinateIndex,
        sourceCoordinate: [...sourceCoordinate].map(Number),
        correctedCoordinate: [...correctedCoordinate].map(Number),
    }
}

/**
 * Validate the sparse, terrain-specific anti-cliff correction stored on a Journey.
 *
 * @param {*} value - Persisted correction data from a Journey.
 * @returns {object|null} Normalized correction object, or null for invalid data.
 */
export const normalizeAntiCliffCorrectionData = value => {
    const terrainId = typeof value?.terrainId === 'string' ? value.terrainId.trim() : ''
    if (!terrainId || !value?.tracks || typeof value.tracks !== 'object' || Array.isArray(value.tracks)) {
        return null
    }

    const tracks = {}
    for (const [trackSlug, rawCorrections] of Object.entries(value.tracks)) {
        if (!trackSlug || !Array.isArray(rawCorrections)) {
            return null
        }

        const corrections = []
        const seenCoordinates = new Set()
        for (const rawCorrection of rawCorrections) {
            const correction = normalizeCorrection(rawCorrection)
            if (!correction) {
                return null
            }
            if (coordinatesMatch(correction.sourceCoordinate, correction.correctedCoordinate)) {
                continue
            }
            const key = `${correction.segmentIndex}:${correction.coordinateIndex}`
            if (seenCoordinates.has(key)) {
                return null
            }
            seenCoordinates.add(key)
            corrections.push(correction)
        }
        tracks[trackSlug] = corrections
    }

    return {terrainId, tracks}
}

const getGeometrySegments = geometry => {
    if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        return [geometry.coordinates]
    }
    if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates
    }
    return null
}

/**
 * Apply sparse saved corrections without mutating the source GPX geometry.
 *
 * @param {object} content - Source track GeoJSON feature.
 * @param {Array<object>} corrections - Corrections for one track.
 * @returns {{valid: boolean, content: object, changed: boolean}} Applied or rejected content.
 */
export const applyAntiCliffCorrections = (content, corrections = []) => {
    if (!Array.isArray(corrections)) {
        return {valid: false, content, changed: false}
    }
    if (corrections.length === 0) {
        return {valid: true, content, changed: false}
    }

    const sourceSegments = getGeometrySegments(content?.geometry)
    if (!sourceSegments) {
        return {valid: false, content, changed: false}
    }

    const coordinates = sourceSegments.slice()
    const copiedSegments = new Set()
    let changed = false
    for (const correction of corrections) {
        const segment = sourceSegments[correction.segmentIndex]
        const sourceCoordinate = segment?.[correction.coordinateIndex]
        if (!sourceCoordinate) {
            return {valid: false, content, changed: false}
        }

        if (coordinatesMatch(sourceCoordinate, correction.correctedCoordinate)) {
            continue
        }
        if (!coordinatesMatch(sourceCoordinate, correction.sourceCoordinate)) {
            return {valid: false, content, changed: false}
        }

        const segmentIndex = correction.segmentIndex
        if (!copiedSegments.has(segmentIndex)) {
            coordinates[segmentIndex] = segment.slice()
            copiedSegments.add(segmentIndex)
        }
        coordinates[segmentIndex][correction.coordinateIndex] = [...correction.correctedCoordinate]
        changed = true
    }

    if (!changed) {
        return {valid: true, content, changed: false}
    }

    return {
        valid: true,
        content: {
            ...content,
            geometry: {
                ...content.geometry,
                coordinates: content.geometry.type === 'LineString' ? coordinates[0] : coordinates,
            },
        },
        changed: true,
    }
}
