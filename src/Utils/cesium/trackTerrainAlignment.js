/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: trackTerrainAlignment.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-15
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Cartographic } from 'cesium'
import { TerrainUtils } from '@Utils/cesium/TerrainUtils'

const EARTH_RADIUS_METERS = 6378137
const ALIGNMENT_SEARCH_DISTANCES_METERS = Object.freeze([5, 10, 15, 20])
const MINIMUM_CLIFF_RELIEF_METERS = 25
const MINIMUM_CLIFF_SLOPE = 1.5
const MINIMUM_TERRAIN_ERROR_METERS = 8
const MINIMUM_IMPROVEMENT_METERS = 5
const MAX_RENDER_POINTS = 4096
const MAX_TRACE_HALF_WIDTH_METERS = 15
const preparedContentCache = new WeakMap()

// Require a steep cross-track wall so ordinary altitude noise cannot move the route sideways.

/**
 * Return the median of finite numeric values.
 *
 * @param {number[]} values - Values to summarize.
 * @returns {number|undefined} Median value or undefined when no values are finite.
 */
const median = values => {
    const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
    if (sorted.length === 0) {
        return undefined
    }

    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/**
 * Read a coordinate altitude when one is present and finite.
 *
 * @param {Array<number>} coordinate - GeoJSON coordinate.
 * @returns {number|undefined} Finite altitude or undefined.
 */
const coordinateAltitude = coordinate => {
    const altitude = Number(coordinate?.[2])
    return Number.isFinite(altitude) ? altitude : undefined
}

/**
 * Return the local smoothed altitude for a coordinate sequence position.
 *
 * @param {Array<Array<number>>} coordinates - Route coordinate sequence.
 * @param {number} index - Coordinate index.
 * @returns {number|undefined} Median altitude from the local five-point window.
 */
const localAltitude = (coordinates, index) => median(
    coordinates.slice(Math.max(0, index - 2), Math.min(coordinates.length, index + 3))
        .map(coordinateAltitude),
)

/**
 * Calculate the local tangent angle measured clockwise from north.
 *
 * @param {Array<Array<number>>} coordinates - Route coordinate sequence.
 * @param {number} index - Coordinate index.
 * @returns {number|undefined} Tangent bearing in radians.
 */
const tangentBearing = (coordinates, index) => {
    const start = coordinates[Math.max(0, index - 1)]
    const stop = coordinates[Math.min(coordinates.length - 1, index + 1)]
    const latitude = (Number(start?.[1]) + Number(stop?.[1])) / 2
    const longitudeDelta = Number(stop?.[0]) - Number(start?.[0])
    const latitudeDelta = Number(stop?.[1]) - Number(start?.[1])
    if (![latitude, longitudeDelta, latitudeDelta].every(Number.isFinite)
        || (longitudeDelta === 0 && latitudeDelta === 0)) {
        return undefined
    }

    return Math.atan2(longitudeDelta * Math.cos(latitude * Math.PI / 180), latitudeDelta)
}

/**
 * Offset a coordinate perpendicular to the route by a distance in meters.
 *
 * @param {Array<number>} coordinate - Source route coordinate.
 * @param {number} bearing - Route tangent bearing in radians.
 * @param {number} side - Perpendicular side, either -1 or 1.
 * @param {number} distance - Offset distance in meters.
 * @returns {Array<number>} Offset longitude and latitude.
 */
const perpendicularCandidate = (coordinate, bearing, side, distance) => {
    const latitude = Number(coordinate[1])
    const longitudeScale = Math.max(0.01, Math.cos(latitude * Math.PI / 180))
    const perpendicularBearing = bearing + (side * Math.PI / 2)
    const northMeters = Math.cos(perpendicularBearing) * distance
    const eastMeters = Math.sin(perpendicularBearing) * distance

    return [
        Number(coordinate[0]) + (eastMeters / (EARTH_RADIUS_METERS * longitudeScale)) * (180 / Math.PI),
        latitude + (northMeters / EARTH_RADIUS_METERS) * (180 / Math.PI),
    ]
}

/**
 * Smooth render-only lateral corrections along one route segment.
 *
 * @param {Array<Array<number>>} coordinates - Source route coordinates.
 * @param {Array<Array<number>>} adjustedLocations - Candidate longitude and latitude values.
 * @returns {Array<Array<number>>} Coordinates with progressively blended corrections.
 */
const smoothLateralCorrections = (coordinates, adjustedLocations) => {
    const offsets = coordinates.map((coordinate, index) => {
        const adjusted = adjustedLocations[index]
        const latitude = Number(coordinate[1])
        const longitudeScale = Math.max(0.01, Math.cos(latitude * Math.PI / 180))
        return {
            east: (Number(adjusted[0]) - Number(coordinate[0])) * (Math.PI / 180) * EARTH_RADIUS_METERS * longitudeScale,
            north: (Number(adjusted[1]) - Number(coordinate[1])) * (Math.PI / 180) * EARTH_RADIUS_METERS,
        }
    })

    return coordinates.map((coordinate, index) => {
        const previous = offsets[Math.max(0, index - 1)]
        const current = offsets[index]
        const next = offsets[Math.min(offsets.length - 1, index + 1)]
        const east = (previous.east + (2 * current.east) + next.east) / 4
        const north = (previous.north + (2 * current.north) + next.north) / 4
        const latitude = Number(coordinate[1])
        const longitudeScale = Math.max(0.01, Math.cos(latitude * Math.PI / 180))

        return [
            Number(coordinate[0]) + (east / (EARTH_RADIUS_METERS * longitudeScale)) * (180 / Math.PI),
            latitude + (north / EARTH_RADIUS_METERS) * (180 / Math.PI),
            ...coordinate.slice(2),
        ]
    })
}

/**
 * Sample terrain heights for a list of longitude and latitude pairs.
 *
 * @param {Array<Array<number>>} coordinates - Coordinates to sample.
 * @returns {Promise<Array<number|undefined>>} Terrain heights in matching order.
 */
const sampleHeights = async (coordinates, provider) => {
    const cartographics = coordinates.map(([longitude, latitude]) => Cartographic.fromDegrees(longitude, latitude))
    const sampled = await TerrainUtils.sampleTerrainHeights(cartographics, {provider})
    return sampled.map(position => Number.isFinite(position?.height) ? position.height : undefined)
}

/**
 * Detect a cliff-like cross-track terrain wall from paired side samples.
 * @param {Array<object>} requests - Candidate samples for one source coordinate.
 * @param {Array<number|undefined>} heights - Sampled terrain heights.
 * @returns {boolean} Whether nearby terrain changes sharply across the route.
 */
const hasCliffCrossSection = (requests, heights) => {
    const heightsByDistance = new Map()
    requests.forEach((request, requestIndex) => {
        const height = heights[requestIndex]
        if (height === undefined) {
            return
        }

        const sides = heightsByDistance.get(request.distance) ?? new Map()
        sides.set(request.side, height)
        heightsByDistance.set(request.distance, sides)
    })

    return [...heightsByDistance].some(([distance, sides]) => {
        const negativeSide = sides.get(-1)
        const positiveSide = sides.get(1)
        if (negativeSide === undefined || positiveSide === undefined) {
            return false
        }

        const relief = Math.abs(positiveSide - negativeSide)
        return relief >= MINIMUM_CLIFF_RELIEF_METERS && relief / (distance * 2) >= MINIMUM_CLIFF_SLOPE
    })
}

/**
 * Align a render-only GeoJSON line copy with nearby terrain matching its GPX elevation profile.
 *
 * @param {object} content - Render-ready GeoJSON content.
 * @param {object} options - Terrain provider and rendered trace-width options.
 * @param {object} options.provider - Cesium terrain provider.
 * @param {number} options.traceHalfWidthMeters - Estimated half-width of the visible trace.
 * @returns {Promise<object>} Original content or an aligned render-only copy.
 */
const alignLineString = async (content, {provider, traceHalfWidthMeters = 0} = {}) => {
    const geometry = content?.geometry
    if (!geometry || !['LineString', 'MultiLineString'].includes(geometry.type)) {
        return content
    }

    const sourceSegments = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
    if (!Array.isArray(sourceSegments) || sourceSegments.length === 0) {
        return content
    }

    const segments = sourceSegments.map(segment => Array.isArray(segment) ? segment : [])
    const totalCount = segments.reduce((count, segment) => count + segment.length, 0)
    if (totalCount < 3 || totalCount > MAX_RENDER_POINTS || !segments.flat().some(coordinate => coordinateAltitude(coordinate) !== undefined)) {
        return content
    }

    const locations = segments.flat().map(coordinate => [Number(coordinate?.[0]), Number(coordinate?.[1])])
    if (locations.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude))) {
        return content
    }

    const originalHeights = await sampleHeights(locations, provider)
    const offset = median(segments.flatMap((segment, segmentIndex) => segment.map((coordinate, index) => {
        const flatIndex = segments.slice(0, segmentIndex).reduce((count, previous) => count + previous.length, 0) + index
        const altitude = coordinateAltitude(coordinate)
        const terrainHeight = originalHeights[flatIndex]
        return altitude === undefined || terrainHeight === undefined ? undefined : terrainHeight - altitude
    })))
    if (offset === undefined) {
        return content
    }

    const requests = []
    const halfWidth = Math.min(
        MAX_TRACE_HALF_WIDTH_METERS,
        Math.max(0, Number.isFinite(Number(traceHalfWidthMeters)) ? Number(traceHalfWidthMeters) : 0),
    )
    let flatIndex = 0
    segments.forEach((segment, segmentIndex) => {
        segment.forEach((coordinate, index) => {
            const currentHeight = originalHeights[flatIndex]
            const altitude = localAltitude(segment, index)
            const bearing = tangentBearing(segment, index)
            if (currentHeight !== undefined && altitude !== undefined && bearing !== undefined) {
                const targetHeight = altitude + offset
                const currentError = Math.abs(currentHeight - targetHeight)
                if (currentError >= MINIMUM_TERRAIN_ERROR_METERS) {
                    ALIGNMENT_SEARCH_DISTANCES_METERS.forEach(searchDistance => {
                        const distance = searchDistance + halfWidth
                        for (const side of [-1, 1]) {
                            const candidate = perpendicularCandidate(coordinate, bearing, side, distance)
                            requests.push({candidate, distance, flatIndex, searchDistance, segmentIndex, side, targetHeight})
                        }
                    })
                }
            }
            flatIndex++
        })
    })

    if (requests.length === 0) {
        return content
    }

    const candidateHeights = await sampleHeights(requests.map(request => request.candidate), provider)
    const adjustedLocations = locations.map(location => [...location])
    const bestScores = new Map()
    const requestsByPoint = new Map()
    requests.forEach((request, requestIndex) => {
        const pointRequests = requestsByPoint.get(request.flatIndex) ?? []
        pointRequests.push({request, requestIndex})
        requestsByPoint.set(request.flatIndex, pointRequests)
    })
    const cliffPoints = new Set([...requestsByPoint].flatMap(([flatIndex, pointRequests]) => (
        hasCliffCrossSection(
            pointRequests.map(({request}) => request),
            pointRequests.map(({requestIndex}) => candidateHeights[requestIndex]),
        ) ? [flatIndex] : []
    )))
    let changed = false
    requests.forEach((request, index) => {
        if (!cliffPoints.has(request.flatIndex)) {
            return
        }

        const candidateHeight = candidateHeights[index]
        const originalError = Math.abs(originalHeights[request.flatIndex] - request.targetHeight)
        const candidateError = candidateHeight === undefined ? Infinity : Math.abs(candidateHeight - request.targetHeight)
        const score = candidateError + (request.distance * 0.5)
        const currentRequest = bestScores.get(request.flatIndex)
        const currentScore = currentRequest?.score ?? Infinity
        if (candidateError <= originalError - MINIMUM_IMPROVEMENT_METERS && score < currentScore) {
            request.score = score
            bestScores.set(request.flatIndex, request)
            adjustedLocations[request.flatIndex] = request.candidate
            changed = true
        }
    })

    if (!changed) {
        return content
    }

    let coordinateIndex = 0
    const coordinates = segments.map(segment => {
        const segmentLocations = segment.map(() => adjustedLocations[coordinateIndex++])
        return smoothLateralCorrections(segment, segmentLocations)
    })
    return {
        ...content,
        geometry: {
            ...geometry,
            coordinates: geometry.type === 'LineString' ? coordinates[0] : coordinates,
        },
    }
}

/**
 * Prepare terrain-aligned render geometry and reuse it for the same content and provider.
 *
 * @param {object} content - Render-ready GeoJSON content.
 * @param {object} options - Cesium terrain provider and rendered trace-width options.
 * @param {object} options.provider - Cesium terrain provider.
 * @param {number} options.traceHalfWidthMeters - Estimated half-width of the visible trace.
 * @returns {Promise<object>} Terrain-aligned render content.
 */
export const getTerrainAlignedTrackRenderContent = async (content, {
    provider = globalThis.lgs?.viewer?.terrainProvider,
    traceHalfWidthMeters = 0,
} = {}) => {
    if (!content || !provider || (typeof content !== 'object') || (typeof provider !== 'object')) {
        return content
    }

    let providers = preparedContentCache.get(content)
    if (!providers) {
        providers = new WeakMap()
        preparedContentCache.set(content, providers)
    }

    let widths = providers.get(provider)
    if (!widths) {
        widths = new Map()
        providers.set(provider, widths)
    }

    const halfWidth = Math.min(
        MAX_TRACE_HALF_WIDTH_METERS,
        Math.max(0, Number.isFinite(Number(traceHalfWidthMeters)) ? Number(traceHalfWidthMeters) : 0),
    )
    const cacheKey = halfWidth.toFixed(3)
    let prepared = widths.get(cacheKey)
    if (!prepared) {
        prepared = alignLineString(content, {provider, traceHalfWidthMeters: halfWidth}).catch(() => content)
        widths.set(cacheKey, prepared)
    }

    return prepared
}
