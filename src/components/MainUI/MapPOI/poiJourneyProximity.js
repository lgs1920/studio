/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiJourneyProximity.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { getCorrectedTrackContent } from '@Utils/cesium/fixPathCorrections'

const EARTH_RADIUS_METERS = 6371000
const DEGREES_TO_RADIANS = Math.PI / 180

/**
 * Converts a finite coordinate value while rejecting missing values.
 * @param {*} value
 * @returns {number|null}
 */
const finiteCoordinate = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Returns the coordinate lines for every effective track in a journey.
 * @param {object|null} journey
 * @returns {number[][][]}
 */
const journeyLinesFrom = journey => {
    const lines = []

    for (const track of journey?.tracks?.values?.() ?? []) {
        const geometry = getCorrectedTrackContent(track)?.geometry
        if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
            lines.push(geometry.coordinates)
        }
        else if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
            lines.push(...geometry.coordinates)
        }
    }

    return lines.filter(line => line.length > 0)
}

/**
 * Wraps a longitude difference to the shortest signed distance around the globe.
 * @param {number} degrees
 * @returns {number}
 */
const wrappedLongitudeDifference = degrees => ((degrees + 540) % 360) - 180

/**
 * Checks whether a geographic point lies within a radius of one journey line.
 * @param {{longitude: number, latitude: number}} point
 * @param {number[][]} coordinates
 * @param {number} radiusMeters
 * @returns {boolean}
 */
const pointNearLine = (point, coordinates, radiusMeters) => {
    const latitudeRadians = point.latitude * DEGREES_TO_RADIANS
    const longitudeScale = Math.cos(latitudeRadians)
    let previousX = 0
    let previousY = 0
    let hasPrevious = false

    for (const coordinate of coordinates) {
        const longitude = finiteCoordinate(coordinate?.[0])
        const latitude = finiteCoordinate(coordinate?.[1])
        if (longitude === null || latitude === null) {
            hasPrevious = false
            continue
        }

        const currentX = wrappedLongitudeDifference(longitude - point.longitude)
            * DEGREES_TO_RADIANS * EARTH_RADIUS_METERS * longitudeScale
        const currentY = (latitude - point.latitude) * DEGREES_TO_RADIANS * EARTH_RADIUS_METERS

        if (!hasPrevious) {
            if (Math.hypot(currentX, currentY) <= radiusMeters) {
                return true
            }
            previousX = currentX
            previousY = currentY
            hasPrevious = true
            continue
        }

        const deltaX = currentX - previousX
        const deltaY = currentY - previousY
        const lengthSquared = deltaX * deltaX + deltaY * deltaY

        // A local tangent plane keeps the short 500 m proximity check accurate and cheap.
        const projection = lengthSquared > 0
            ? Math.max(0, Math.min(1, -(previousX * deltaX + previousY * deltaY) / lengthSquared))
            : 0
        const nearestX = previousX + projection * deltaX
        const nearestY = previousY + projection * deltaY
        if (Math.hypot(nearestX, nearestY) <= radiusMeters) {
            return true
        }

        previousX = currentX
        previousY = currentY
    }

    return false
}

/**
 * Creates a proximity matcher for global POIs around a journey's effective tracks.
 * @param {object|null} journey
 * @param {number} [radiusMeters=500]
 * @returns {(poi: object) => boolean}
 */
export const createJourneyProximityMatcher = (journey, radiusMeters = 500) => {
    const lines = journeyLinesFrom(journey)

    return poi => {
        const longitude = finiteCoordinate(poi?.longitude)
        const latitude = finiteCoordinate(poi?.latitude)
        if (longitude === null || latitude === null) {
            return false
        }

        const point = {longitude, latitude}
        return lines.some(line => pointNearLine(point, line, radiusMeters))
    }
}
