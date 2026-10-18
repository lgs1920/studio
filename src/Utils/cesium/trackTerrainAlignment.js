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
 * Last modified: 2026-10-18
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { Cartographic } from 'cesium'
import { TerrainUtils } from '@Utils/cesium/TerrainUtils'
import { applyAntiCliffCorrections, normalizeAntiCliffCorrectionData } from '@Utils/cesium/antiCliffCorrections'
import { normalizeTrackRenderStyle, TRACK_RENDER_WIDTH_UNITS } from '@Utils/cesium/trackRenderStyle'
import {
    addTerrainSectionCandidates, detectTerrainAlignmentSections,
    registerTerrainHeightReference, validateTerrainSectionCorrections,
} from './trackTerrainSections'

const EARTH_RADIUS_METERS = 6378137
const BORDER_ERROR_THRESHOLD_METERS = 20
const TERRAIN_MATCH_TOLERANCE_METERS = 5
const CLIFF_HEIGHT_JUMP_THRESHOLD_METERS = 20
const CLIFF_PROFILE_SPAN_METERS = 5
const CLIFF_PROFILE_HALF_SPAN_METERS = CLIFF_PROFILE_SPAN_METERS / 2
const CLIFF_PROFILE_SAMPLE_SPACING_METERS = 1
const CLIFF_PROFILE_SAMPLE_COUNT = Math.ceil(CLIFF_PROFILE_SPAN_METERS / CLIFF_PROFILE_SAMPLE_SPACING_METERS) + 1
const SEARCH_STEP_METERS = 1
const MAX_SEARCH_DISTANCE_METERS = 120
const ALTERNATE_CANDIDATE_SPACING_METERS = 10
const MAX_CANDIDATES_PER_DIRECTION = 8
const GEOMETRY_GRID_SPACING_METERS = 10
const MAX_GEOMETRY_TANGENT_SHIFT_METERS = 1
const GEOMETRY_SECTOR_COUNT = 8
const GEOMETRY_RADIAL_BANDS = 4
const MAX_GEOMETRY_CANDIDATES_PER_BAND = 2
const MAX_GEOMETRIC_SEGMENT_STRETCH_RATIO = 3
// Bound long-section detours relative to their along-track span, rather than by one global distance.
const MAX_SECTION_SHIFT_RATIO = 0.35
const MIN_SECTION_LENGTH_FOR_SHIFT_LIMIT_METERS = 50
const SEARCH_PRECISION_METERS = 0.5
const SEARCH_REFINEMENT_ITERATIONS = 5
const TERRAIN_SAMPLE_BATCH_SIZE = 512
const CANDIDATE_COST_TIE_TOLERANCE_METERS = 0.25
const UNRESOLVED_POINT_COST_METERS = 60
const CANDIDATE_OFFSET_COST_PER_METER = 1
const OFFSET_STEP_BREAK_RATIO = 2
const OFFSET_STEP_ADDED_DISTANCE_COST = 2
const OFFSET_STEP_EXCESS_CURVATURE_COST = 3
const SECTION_OFFSET_VARIATION_COST = 4
const FINAL_VALIDATION_ATTEMPTS = 24
const TERRAIN_SAMPLE_SPLIT_DEPTH = 2
const terrainAlignmentByTrack = new WeakMap()
const terrainAlignmentAnalysisByTrack = new WeakMap()
const persistedTerrainAlignmentByTrack = new WeakMap()
const terrainCorrectionPersistenceByJourney = new WeakMap()
const normalizedCorrectionDataByObject = new WeakMap()
const yieldToMainThread = () => new Promise(resolve => globalThis.setTimeout(resolve, 0))

/** Report bounded percentage updates without allowing a UI callback to affect terrain processing. */
const reportProgress = (onProgress, value) => {
    if (typeof onProgress !== 'function') {
        return
    }

    try {
        onProgress(Math.max(0, Math.min(100, value)))
    }
    catch {
        // Progress reporting is optional and must not interrupt a correction.
    }
}

/**
 * Report the route coordinate currently inspected without allowing UI errors to interrupt analysis.
 *
 * @param {Function|null} onLocation - Optional UI location callback.
 * @param {object|null|undefined} record - Route point record to report when available.
 * @returns {void} The callback is invoked when the record has a valid coordinate.
 */
const reportAlignmentLocation = (onLocation, record) => {
    if (typeof onLocation !== 'function' || !Array.isArray(record?.coordinate) || record.coordinate.length < 2) {
        return
    }

    try {
        onLocation([...record.coordinate], {
            segmentIndex:   record.segmentIndex,
            coordinateIndex: record.coordinateIndex,
        })
    }
    catch {
        // An optional map marker must not interrupt terrain analysis.
    }
}

/**
 * Resolve the owning Journey for a track from the active editor or context.
 *
 * @param {object} track - Track whose parent Journey is being resolved.
 * @returns {object|null} Owning Journey when it is available in the application context.
 */
const journeysForTrack = track => {
    const lgs = globalThis.lgs
    const parent = track?.parent
    if (!parent) {
        return []
    }

    const candidates = [
        lgs?.theJourneyEditorProxy?.journey,
        lgs?.theJourney,
        lgs?.getJourneyBySlug?.(parent),
        lgs?.journeys?.get?.(parent),
    ]
    return [...new Set(candidates.filter(journey => journey?.slug === parent))]
}

const journeyForTrack = track => journeysForTrack(track)[0] ?? null

const currentTerrainId = () => {
    const terrainId = globalThis.lgs?.settings?.layers?.terrain
    return terrainId === null || terrainId === undefined || terrainId === '' ? null : String(terrainId)
}

const normalizedCorrectionData = value => {
    if (!value || typeof value !== 'object') {
        return null
    }

    if (!normalizedCorrectionDataByObject.has(value)) {
        normalizedCorrectionDataByObject.set(value, normalizeAntiCliffCorrectionData(value))
    }
    return normalizedCorrectionDataByObject.get(value)
}

const persistTerrainCorrectionInvalidation = journey => {
    if (!journey || typeof journey !== 'object' || typeof journey.persistToDatabase !== 'function'
        || terrainCorrectionPersistenceByJourney.has(journey)) {
        return
    }

    const persistence = Promise.resolve()
        .then(() => journey.persistToDatabase())
        .catch(error => console.warn('[Terrain alignment] Failed to persist disabled correction state:', error))
        .finally(() => terrainCorrectionPersistenceByJourney.delete(journey))
    terrainCorrectionPersistenceByJourney.set(journey, persistence)
}

const disableTerrainCorrection = (track, {clearData = false} = {}) => {
    const journeys = journeysForTrack(track)
    for (const journey of journeys) {
        const changed = journey.antiCliffCorrection !== false || (clearData && journey.antiCliffCorrectionData !== null)
        journey.antiCliffCorrection = false
        if (clearData) {
            journey.antiCliffCorrectionData = null
        }
        if (changed) {
            persistTerrainCorrectionInvalidation(journey)
        }
    }
}

const persistedTerrainCorrectionForTrack = track => {
    const journey = journeyForTrack(track)
    const rawData = journey?.antiCliffCorrectionData
    const terrainId = currentTerrainId()
    const cached = track && typeof track === 'object' ? persistedTerrainAlignmentByTrack.get(track) : null
    if (cached?.journey === journey
        && cached.rawData === rawData
        && cached.sourceContent === track?.content
        && cached.terrainId === terrainId) {
        return cached.result
    }

    const data = normalizedCorrectionData(rawData)
    if (!data) {
        if (track && typeof track === 'object') {
            persistedTerrainAlignmentByTrack.delete(track)
        }
        return null
    }

    let result
    if (!terrainId) {
        result = {status: 'terrain-unavailable', content: track?.content ?? null, changed: false}
    }
    else if (data.terrainId !== terrainId) {
        disableTerrainCorrection(track)
        result = {status: 'terrain-mismatch', content: track?.content ?? null, changed: false}
    }
    else if (!Object.hasOwn(data.tracks, track?.slug)) {
        result = {status: 'not-processed', content: track?.content ?? null, changed: false}
    }
    else {
        const corrections = data.tracks[track.slug]
        const applied = applyAntiCliffCorrections(track?.content, corrections)
        if (!applied.valid) {
            disableTerrainCorrection(track, {clearData: true})
            result = {status: 'source-mismatch', content: track?.content ?? null, changed: false}
        }
        else {
            result = {
                status: 'matched',
                content: applied.content,
                changed: applied.changed,
                corrections,
                journey,
                terrainId,
            }
        }
    }

    if (track && typeof track === 'object') {
        persistedTerrainAlignmentByTrack.set(track, {
            journey,
            rawData,
            sourceContent: track.content,
            terrainId,
            result,
        })
    }

    return result
}

/**
 * Check whether the owning Journey explicitly enables terrain alignment.
 *
 * @param {object} track - Track whose Journey setting controls correction.
 * @returns {boolean} Whether terrain alignment is enabled for this Journey.
 */
export const isTrackTerrainAlignmentEnabled = track => {
    if (!track?.parent) {
        return false
    }

    const journey = journeyForTrack(track)
    if (journey?.antiCliffCorrection !== true) {
        return false
    }
    if (!currentTerrainId()) {
        return false
    }

    const persisted = persistedTerrainCorrectionForTrack(track)
    return journey.antiCliffCorrection === true
        && persisted?.status !== 'terrain-mismatch'
        && persisted?.status !== 'source-mismatch'
}

/**
 * Return a finite number or null when the input is not numeric.
 *
 * @param {*} value - Value to normalize.
 * @returns {number|null} Finite number or null.
 */
const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Return the usable line coordinate segments from a GeoJSON feature.
 *
 * @param {object} content - GeoJSON track feature.
 * @returns {Array<Array<Array<number>>>} Coordinate segments.
 */
const coordinateSegments = content => {
    const geometry = content?.geometry
    if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        return [geometry.coordinates]
    }
    if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates.filter(Array.isArray)
    }

    return []
}

/**
 * Measure a local east/north displacement between two longitude/latitude pairs.
 *
 * @param {Array<number>} origin - Origin longitude and latitude in degrees.
 * @param {Array<number>} destination - Destination longitude and latitude in degrees.
 * @returns {{east: number, north: number}} Local displacement in metres.
 */
const localOffsetMeters = (origin, destination) => {
    const originLatitude = Number(origin?.[1]) * (Math.PI / 180)
    const latitude = Number(destination?.[1]) * (Math.PI / 180)
    let longitudeDeltaDegrees = Number(destination?.[0]) - Number(origin?.[0])
    if (longitudeDeltaDegrees > 180) {
        longitudeDeltaDegrees -= 360
    }
    else if (longitudeDeltaDegrees < -180) {
        longitudeDeltaDegrees += 360
    }
    const longitudeDelta = longitudeDeltaDegrees * (Math.PI / 180)
    return {
        east:  longitudeDelta * Math.cos((originLatitude + latitude) / 2) * EARTH_RADIUS_METERS,
        north: (latitude - originLatitude) * EARTH_RADIUS_METERS,
    }
}

/**
 * Resolve the route bearing at a coordinate using its adjacent valid points.
 *
 * @param {Array<Array<number>>} coordinates - Ordered coordinates for one segment.
 * @param {number} index - Coordinate index.
 * @returns {number|null} Bearing clockwise from north, in radians.
 */
const tangentBearing = (coordinates, index) => {
    const current = coordinates[index]
    if (!Array.isArray(current) || !Number.isFinite(Number(current[0])) || !Number.isFinite(Number(current[1]))) {
        return null
    }

    let previous = null
    let next = null
    let previousIndex = index - 1
    let nextIndex = index + 1
    while (previousIndex >= 0 && !previous) {
        const candidate = coordinates[previousIndex]
        if (Array.isArray(candidate) && Number.isFinite(Number(candidate[0])) && Number.isFinite(Number(candidate[1]))) {
            const displacement = localOffsetMeters(candidate, current)
            if (Math.hypot(displacement.east, displacement.north) >= 0.01) {
                previous = candidate
            }
        }
        previousIndex -= 1
    }
    while (nextIndex < coordinates.length && !next) {
        const candidate = coordinates[nextIndex]
        if (Array.isArray(candidate) && Number.isFinite(Number(candidate[0])) && Number.isFinite(Number(candidate[1]))) {
            const displacement = localOffsetMeters(current, candidate)
            if (Math.hypot(displacement.east, displacement.north) >= 0.01) {
                next = candidate
            }
        }
        nextIndex += 1
    }

    if (!previous && !next) {
        return null
    }

    const displacement = previous && next
        ? localOffsetMeters(previous, next)
        : previous
            ? localOffsetMeters(previous, current)
            : localOffsetMeters(current, next)
    if (Math.hypot(displacement.east, displacement.north) < 0.01) {
        return null
    }

    return Math.atan2(displacement.east, displacement.north)
}

/**
 * Offset a coordinate along the local route normal by a signed distance.
 *
 * @param {Array<number>} coordinate - Source GeoJSON coordinate.
 * @param {number} bearing - Route bearing clockwise from north, in radians.
 * @param {number} distance - Signed right-normal distance in metres.
 * @returns {Array<number>} Offset longitude and latitude.
 */
const offsetCoordinate = (coordinate, bearing, distance) => {
    const latitude = Number(coordinate[1])
    const latitudeRadians = latitude * (Math.PI / 180)
    const normalBearing = bearing + (Math.sign(distance || 1) * (Math.PI / 2))
    const absoluteDistance = Math.abs(distance)
    const east = Math.sin(normalBearing) * absoluteDistance
    const north = Math.cos(normalBearing) * absoluteDistance
    const longitudeScale = Math.max(0.01, Math.cos(latitudeRadians))

    return [
        Number(coordinate[0]) + (east / (EARTH_RADIUS_METERS * longitudeScale)) * (180 / Math.PI),
        latitude + (north / EARTH_RADIUS_METERS) * (180 / Math.PI),
    ]
}

/**
 * Convert an east/north offset relative to an origin into longitude and latitude.
 *
 * @param {Array<number>} origin - Origin longitude and latitude in degrees.
 * @param {number} east - East displacement in metres.
 * @param {number} north - North displacement in metres.
 * @returns {Array<number>} Longitude and latitude in degrees.
 */
const coordinateFromLocalOffset = (origin, east, north) => {
    const latitude = Number(origin[1])
    const longitudeScale = Math.max(0.01, Math.cos(latitude * (Math.PI / 180)))
    return [
        Number(origin[0]) + (east / (EARTH_RADIUS_METERS * longitudeScale)) * (180 / Math.PI),
        latitude + (north / EARTH_RADIUS_METERS) * (180 / Math.PI),
    ]
}

/**
 * Fit a two-dimensional rigid transformation between matching route anchors.
 *
 * @param {Array<Array<number>>} sourceCoordinates - Original anchor coordinates.
 * @param {Array<Array<number>>} targetCoordinates - Corrected anchor coordinates.
 * @returns {object|null} Local rigid transformation and maximum anchor residual.
 */
const fitRigidTransform = (sourceCoordinates, targetCoordinates) => {
    if (sourceCoordinates.length !== targetCoordinates.length || sourceCoordinates.length < 2) {
        return null
    }

    const origin = sourceCoordinates[0]
    const source = sourceCoordinates.map(coordinate => localOffsetMeters(origin, coordinate))
    const target = targetCoordinates.map(coordinate => localOffsetMeters(origin, coordinate))
    const sourceCenter = source.reduce((center, point) => ({
        east:  center.east + (point.east / source.length),
        north: center.north + (point.north / source.length),
    }), {east: 0, north: 0})
    const targetCenter = target.reduce((center, point) => ({
        east:  center.east + (point.east / target.length),
        north: center.north + (point.north / target.length),
    }), {east: 0, north: 0})

    let dot = 0
    let cross = 0
    source.forEach((point, index) => {
        const centeredSource = {
            east:  point.east - sourceCenter.east,
            north: point.north - sourceCenter.north,
        }
        const centeredTarget = {
            east:  target[index].east - targetCenter.east,
            north: target[index].north - targetCenter.north,
        }
        dot += (centeredSource.east * centeredTarget.east) + (centeredSource.north * centeredTarget.north)
        cross += (centeredSource.east * centeredTarget.north) - (centeredSource.north * centeredTarget.east)
    })
    if (Math.hypot(dot, cross) < 1e-6) {
        return null
    }

    const angle = Math.atan2(cross, dot)
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const translation = {
        east:  targetCenter.east - (sourceCenter.east * cosine) + (sourceCenter.north * sine),
        north: targetCenter.north - (sourceCenter.east * sine) - (sourceCenter.north * cosine),
    }
    const transform = {origin, cosine, sine, translation}
    const maximumResidualMeters = Math.max(...source.map((point, index) => {
        const transformed = applyRigidTransformToLocalPoint(point, transform)
        return Math.hypot(
            transformed.east - target[index].east,
            transformed.north - target[index].north,
        )
    }))

    return {...transform, maximumResidualMeters}
}

/**
 * Apply a fitted rigid transformation to a local east/north point.
 *
 * @param {{east: number, north: number}} point - Local point in metres.
 * @param {object} transform - Rigid transformation from fitRigidTransform.
 * @returns {{east: number, north: number}} Transformed local point.
 */
const applyRigidTransformToLocalPoint = (point, transform) => ({
    east:  (point.east * transform.cosine) - (point.north * transform.sine) + transform.translation.east,
    north: (point.east * transform.sine) + (point.north * transform.cosine) + transform.translation.north,
})

/**
 * Apply a fitted rigid transformation while retaining all non-horizontal ordinates.
 *
 * @param {Array<number>} coordinate - Source coordinate.
 * @param {object} transform - Rigid transformation from fitRigidTransform.
 * @returns {Array<number>} Shape-preserving transformed coordinate.
 */
const transformCoordinate = (coordinate, transform) => {
    const localPoint = localOffsetMeters(transform.origin, coordinate)
    const transformed = applyRigidTransformToLocalPoint(localPoint, transform)
    return [
        ...coordinateFromLocalOffset(transform.origin, transformed.east, transformed.north),
        ...coordinate.slice(2),
    ]
}

/**
 * Reconstruct a route section with the rigid 2D transform defined by its endpoint anchors.
 *
 * @param {Array<Array<number>>} sourceCoordinates - Original route section coordinates.
 * @param {Array<number>} targetStart - Corrected position for the first source coordinate.
 * @param {Array<number>} targetEnd - Corrected position for the last source coordinate.
 * @returns {{coordinates: Array<Array<number>>, transform: object}|null} Transformed route or null.
 */
export const transformTrackCoordinatesBetweenAnchors = (sourceCoordinates, targetStart, targetEnd) => {
    if (!Array.isArray(sourceCoordinates) || sourceCoordinates.length < 2) {
        return null
    }

    const transform = fitRigidTransform(
        [sourceCoordinates[0], sourceCoordinates.at(-1)],
        [targetStart, targetEnd],
    )
    if (!transform) {
        return null
    }

    return {
        coordinates: sourceCoordinates.map(coordinate => transformCoordinate(coordinate, transform)),
        transform,
    }
}

/**
 * Create point records while retaining source segment and coordinate indices.
 *
 * @param {Array<Array<Array<number>>>} segments - Track coordinate segments.
 * @param {number} halfWidthMeters - Half of the effective rendered track width.
 * @returns {Array<object>} Alignment records for every source coordinate.
 */
const createPointRecords = (segments, halfWidthMeters) => {
    let id = 0
    return segments.flatMap((segment, segmentIndex) => segment.map((coordinate, coordinateIndex) => ({
        id: id++,
        segmentIndex,
        coordinateIndex,
        coordinate,
        altitude: finiteNumber(coordinate?.[2]),
        bearing: tangentBearing(segment, coordinateIndex),
        halfWidthMeters,
        status: 'unchecked',
        candidateOptions: [],
        correctedCoordinate: null,
    })))
}

/**
 * Build unresolved-point diagnostics when terrain sampling fails unexpectedly.
 *
 * @param {object} content - Original GeoJSON track content.
 * @param {string} reason - Diagnostic reason.
 * @returns {Array<object>} Diagnostic records for altitude-bearing route points.
 */
const failureDiagnostics = (content, reason) => coordinateSegments(content).flatMap((segment, segmentIndex) => (
    segment.flatMap((coordinate, coordinateIndex) => {
        if (!Array.isArray(coordinate)
            || !Number.isFinite(Number(coordinate[0]))
            || !Number.isFinite(Number(coordinate[1]))
            || finiteNumber(coordinate[2]) === null) {
            return []
        }

        return [{
            segmentIndex,
            coordinateIndex,
            coordinate: [...coordinate],
            reason,
            borderErrorsMeters: null,
        }]
    })
))

/**
 * Attempt to sample one terrain batch without splitting a rejected request.
 *
 * @param {Array<Array<number>>} coordinates - Longitude/latitude positions in degrees.
 * @param {object} provider - Cesium terrain provider.
 * @returns {Promise<{succeeded: boolean, heights: Array<number|null>|null}>} Batch result.
 */
const sampleTerrainChunkOnce = async (coordinates, provider) => {
    const positions = coordinates.map(([longitude, latitude]) => Cartographic.fromDegrees(longitude, latitude))
    try {
        const sampled = await TerrainUtils.sampleTerrainHeights(positions, {provider})
        if (!Array.isArray(sampled) || sampled.length !== positions.length) {
            return {succeeded: false, heights: null}
        }

        return {
            succeeded: true,
            heights: sampled.map(position => finiteNumber(position?.height)),
        }
    }
    catch {
        return {succeeded: false, heights: null}
    }
}

/**
 * Retry a failed terrain batch in smaller pieces to isolate failed terrain requests.
 *
 * @param {Array<Array<number>>} coordinates - Longitude/latitude positions in degrees.
 * @param {object} provider - Cesium terrain provider.
 * @param {number} depth - Current split depth used to bound retries for provider-wide failures.
 * @returns {Promise<Array<number|null>>} Sampled heights, preserving the input order.
 */
const sampleTerrainChunk = async (coordinates, provider, depth = 0) => {
    const initial = await sampleTerrainChunkOnce(coordinates, provider)
    if (initial.succeeded) {
        return initial.heights
    }
    if (coordinates.length < 2) {
        return [null]
    }

    const middle = Math.ceil(coordinates.length / 2)
    const leftCoordinates = coordinates.slice(0, middle)
    const rightCoordinates = coordinates.slice(middle)
    const [left, right] = await Promise.all([
        sampleTerrainChunkOnce(leftCoordinates, provider),
        sampleTerrainChunkOnce(rightCoordinates, provider),
    ])
    if (left.succeeded && right.succeeded) {
        return [...left.heights, ...right.heights]
    }
    if (!left.succeeded && !right.succeeded && depth >= TERRAIN_SAMPLE_SPLIT_DEPTH) {
        return coordinates.map(() => null)
    }

    // Keep successful halves intact and retry only the rejected regions.
    const leftHeights = left.succeeded
        ? left.heights
        : await sampleTerrainChunk(leftCoordinates, provider, depth + 1)
    const rightHeights = right.succeeded
        ? right.heights
        : await sampleTerrainChunk(rightCoordinates, provider, depth + 1)

    return [...leftHeights, ...rightHeights]
}

/**
 * Sample terrain heights in bounded, fault-isolated batches for long GPX tracks.
 *
 * @param {Array<Array<number>>} coordinates - Longitude/latitude positions in degrees.
 * @param {object} provider - Cesium terrain provider.
 * @param {Function|null} [onProgress] - Receives the completed batch fraction from 0 through 1.
 * @returns {Promise<Array<number|null>>} Sampled heights.
 */
const sampleTerrainHeights = async (coordinates, provider, onProgress = null) => {
    const heights = []
    for (let start = 0; start < coordinates.length; start += TERRAIN_SAMPLE_BATCH_SIZE) {
        const chunk = coordinates.slice(start, start + TERRAIN_SAMPLE_BATCH_SIZE)
        heights.push(...await sampleTerrainChunk(chunk, provider))
        onProgress?.(Math.min(1, (start + chunk.length) / Math.max(1, coordinates.length)))
    }

    return heights
}

/**
 * Sample both trace borders at the current route positions.
 *
 * @param {Array<object>} records - Point alignment records.
 * @param {object} provider - Cesium terrain provider.
 * @param {Function|null} [onProgress] - Receives the completed batch fraction from 0 through 1.
 * @param {Function|null} [onLocation] - Receives the route coordinate represented by each completed batch.
 * @returns {Promise<void>} Resolves after border heights are assigned.
 */
const sampleInitialBorders = async (records, provider, onProgress = null, onLocation = null) => {
    const requests = []
    records.forEach((record) => {
        if (record.altitude === null || record.bearing === null) {
            return
        }

        for (const borderSide of [-1, 1]) {
            requests.push({
                record,
                borderSide,
                coordinate: offsetCoordinate(record.coordinate, record.bearing, borderSide * record.halfWidthMeters),
            })
        }
    })

    /**
     * Relay each completed terrain batch and its corresponding GPX coordinate.
     *
     * @param {number} ratio - Fraction of terrain requests completed.
     * @returns {void} Progress and optional route position are reported.
     */
    const reportBatchProgress = onLocation
        ? ratio => {
            onProgress?.(ratio)
            const completedRequestIndex = Math.min(requests.length - 1, Math.ceil(ratio * requests.length) - 1)
            reportAlignmentLocation(onLocation, requests[completedRequestIndex]?.record)
        }
        : onProgress
    const heights = await sampleTerrainHeights(requests.map(request => request.coordinate), provider, reportBatchProgress)
    requests.forEach((request, index) => {
        request.record.borderHeights ??= []
        request.record.borderHeights[request.borderSide < 0 ? 0 : 1] = heights[index]
    })
}

/**
 * Create terrain samples for both borders at a lateral trial offset.
 *
 * @param {object} record - Point alignment record.
 * @param {number} direction - Search direction along the right-normal axis.
 * @param {number} distance - Trial centerline offset in metres.
 * @returns {Array<Array<number>>} Left and right border coordinates.
 */
const trialBorderCoordinates = (record, direction, distance) => [-1, 1].map(borderSide => (
    offsetCoordinate(
        record.coordinate,
        record.bearing,
        (direction * distance) + (borderSide * record.halfWidthMeters),
    )
))

/**
 * Build one-metre terrain samples across a short profile on both trace borders.
 *
 * @param {object} record - Point alignment record.
 * @param {number} direction - Search direction along the right-normal axis.
 * @param {number} distance - Trial centerline offset in metres.
 * @returns {Array<object>} Tagged terrain profile coordinates for both borders.
 */
const trialCliffProfileCoordinates = (record, direction, distance) => [-1, 1].flatMap((borderSide, borderIndex) => {
    const borderOffset = (direction * distance) + (borderSide * record.halfWidthMeters)
    return Array.from({length: CLIFF_PROFILE_SAMPLE_COUNT}, (_, sampleIndex) => {
        const offset = borderOffset - CLIFF_PROFILE_HALF_SPAN_METERS
            + (sampleIndex * CLIFF_PROFILE_SAMPLE_SPACING_METERS)
        return {
            borderIndex,
            sampleIndex,
            coordinate: offsetCoordinate(record.coordinate, record.bearing, offset),
        }
    })
})

/**
 * Build altitude-match and cliff-profile requests for one lateral candidate.
 *
 * @param {object} record - Point alignment record.
 * @param {number} direction - Search direction along the right-normal axis.
 * @param {number} distance - Trial centerline offset in metres.
 * @returns {Array<object>} Terrain sample requests tagged by purpose and border.
 */
const candidateTerrainRequests = (record, direction, distance) => [
    ...trialBorderCoordinates(record, direction, distance).map((coordinate, index) => ({
        record,
        direction,
        kind: 'border',
        index,
        coordinate,
    })),
    ...trialCliffProfileCoordinates(record, direction, distance).map(sample => ({
        record,
        direction,
        kind: 'profile',
        index: sample.sampleIndex,
        borderIndex: sample.borderIndex,
        coordinate: sample.coordinate,
    })),
]

/**
 * Group candidate terrain samples and reject profiles crossing a steep cliff face.
 *
 * @param {Array<object>} requests - Tagged terrain sample requests.
 * @param {Array<number|null>} heights - Sampled terrain heights.
 * @returns {Map<number, Map<number, object>>} Match and cliff checks by point and direction.
 */
const groupTrialTerrainChecks = (requests, heights) => {
    const grouped = new Map()
    requests.forEach((request, index) => {
        const pointGroups = grouped.get(request.record.id) ?? new Map()
        const check = pointGroups.get(request.direction) ?? {
            record: request.record,
            borderHeights:  Array(2).fill(null),
            profileHeights: Array.from({length: 2}, () => Array(CLIFF_PROFILE_SAMPLE_COUNT).fill(null)),
        }
        const samples = request.kind === 'border'
            ? check.borderHeights
            : check.profileHeights[request.borderIndex]
        samples[request.index] = heights[index]
        pointGroups.set(request.direction, check)
        grouped.set(request.record.id, pointGroups)
    })

    grouped.forEach((directions) => {
        directions.forEach((check) => {
            check.errors = check.borderHeights.map(height => (
                Number.isFinite(height) ? height - (check.record.terrainReferenceAltitude ?? check.record.altitude) : null
            ))
            check.profileAvailable = check.profileHeights.every(profile => profile.every(Number.isFinite))
            check.cliffRanges = check.profileHeights.map(profile => Math.max(...profile) - Math.min(...profile))
            check.cliffSafe = check.profileAvailable
                && check.cliffRanges.every(range => range <= CLIFF_HEIGHT_JUMP_THRESHOLD_METERS)
        })
    })

    return grouped
}

/**
 * Check whether a pair of trial borders is close enough to the GPX elevation.
 *
 * @param {Array<number|null>} errors - Signed terrain-minus-GPX errors.
 * @returns {boolean} Whether both borders are acceptable and one matches closely.
 */
const isCompatibleBorderPair = errors => errors.length === 2
    && errors.every(error => Number.isFinite(error) && Math.abs(error) <= BORDER_ERROR_THRESHOLD_METERS + 1e-6)
    && Math.min(...errors.map(Math.abs)) <= TERRAIN_MATCH_TOLERANCE_METERS + 1e-6

/**
 * Build a candidate at a lateral offset where both rendered borders fit the GPX altitude.
 *
 * @param {object} record - Point alignment record.
 * @param {number} direction - Search direction along the right-normal axis.
 * @param {number} distance - Candidate centerline offset in metres.
 * @param {Array<number|null>} errors - Signed border errors at the candidate.
 * @returns {object} Lateral correction candidate.
 */
const candidateAt = (record, direction, distance, errors) => ({
    direction,
    offsetMeters: direction * distance,
    distanceMeters: distance,
    maxVerticalErrorMeters: Math.max(...errors.map(Math.abs)),
    correctedCoordinate: [
        ...offsetCoordinate(record.coordinate, record.bearing, direction * distance),
        ...record.coordinate.slice(2),
    ],
})

/** Sample independent lateral trials without merging different offsets for the same GPX point. */
const evaluateTerrainAlignmentTrials = async (trials, provider) => {
    const requests = trials.flatMap((trial, index) => trial.record.bearing === null ? [] : candidateTerrainRequests(
        {...trial.record, coordinate: trial.correctedCoordinate ?? trial.record.coordinate, id: index},
        Math.sign(trial.offsetMeters),
        Math.abs(trial.offsetMeters),
    ))
    const heights = await sampleTerrainHeights(requests.map(request => request.coordinate), provider)
    const checks = groupTrialTerrainChecks(requests, heights)
    return trials.map((trial, index) => {
        const direction = Math.sign(trial.offsetMeters)
        const check = checks.get(index)?.get(direction)
        if (!check) {
            return null
        }
        let candidate = check.cliffSafe && isCompatibleBorderPair(check.errors)
            ? candidateAt(trial.record, direction, Math.abs(trial.offsetMeters), check.errors)
            : null
        if (candidate && trial.correctedCoordinate) {
            const delta = localOffsetMeters(trial.record.coordinate, trial.correctedCoordinate)
            const offsetMeters = delta.east * Math.cos(trial.record.bearing) - delta.north * Math.sin(trial.record.bearing)
            candidate = {...candidate, offsetMeters, direction: Math.sign(offsetMeters), distanceMeters: Math.hypot(delta.east, delta.north), correctedCoordinate: trial.correctedCoordinate}
        }
        return {...check, candidate}
    })
}

/**
 * Record the nearest cross-track distance where terrain became unavailable in one direction.
 *
 * @param {object} record - Triggered point record.
 * @param {number} direction - Search direction along the route normal.
 * @param {number} distance - Offset where a terrain sample was unavailable.
 * @returns {void} The record's uncertainty boundary is updated.
 */
const recordUnavailableTerrainDistance = (record, direction, distance) => {
    record.unavailableDistanceByDirection ??= new Map()
    const previous = record.unavailableDistanceByDirection.get(direction)
    if (!Number.isFinite(previous) || distance < previous) {
        record.unavailableDistanceByDirection.set(direction, distance)
    }
}

/**
 * Estimate the first compliant offset inside a coarse sample interval.
 *
 * @param {number} previousDistance - Previous cross-track offset in metres.
 * @param {number} distance - Current cross-track offset in metres.
 * @param {Array<number|null>} previousErrors - Previous border errors.
 * @param {Array<number|null>} errors - Current border errors.
 * @returns {number|null} Offset to sample against the actual terrain, if the interval may contain a match.
 */
const estimateCompatibleDistance = (previousDistance, distance, previousErrors, errors) => {
    /**
     * Estimate where one signed border error enters an inclusive tolerance range.
     *
     * @param {number|null} startValue - Error at the start of the interval.
     * @param {number|null} endValue - Error at the end of the interval.
     * @param {number} minimum - Inclusive lower bound.
     * @param {number} maximum - Inclusive upper bound.
     * @returns {Array<number>|null} Normalized interval or null when no crossing exists.
     */
    const intervalForRange = (startValue, endValue, minimum, maximum) => {
        if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
            return null
        }

        const delta = endValue - startValue
        if (Math.abs(delta) < 1e-9) {
            return startValue >= minimum && startValue <= maximum ? [0, 1] : null
        }

        const first = (minimum - startValue) / delta
        const second = (maximum - startValue) / delta
        const start = Math.max(0, Math.min(first, second))
        const end = Math.min(1, Math.max(first, second))
        return start <= end ? [start, end] : null
    }

    const acceptable = previousErrors.map((previousError, borderIndex) => (
        intervalForRange(previousError, errors[borderIndex], -BORDER_ERROR_THRESHOLD_METERS, BORDER_ERROR_THRESHOLD_METERS)
    ))
    if (acceptable.some(interval => !interval)) {
        return null
    }

    const acceptableStart = Math.max(...acceptable.map(interval => interval[0]))
    const acceptableEnd = Math.min(...acceptable.map(interval => interval[1]))
    if (acceptableStart > acceptableEnd) {
        return null
    }

    const matchingStarts = previousErrors.flatMap((previousError, borderIndex) => {
        const matching = intervalForRange(
            previousError,
            errors[borderIndex],
            -TERRAIN_MATCH_TOLERANCE_METERS,
            TERRAIN_MATCH_TOLERANCE_METERS,
        )
        if (!matching) {
            return []
        }

        const start = Math.max(acceptableStart, matching[0])
        return start <= Math.min(acceptableEnd, matching[1]) ? [start] : []
    })
    if (matchingStarts.length === 0) {
        return null
    }

    const ratio = Math.min(...matchingStarts)
    return previousDistance + ((distance - previousDistance) * ratio)
}

/**
 * Search both borders outward for compatible positions that can form a smooth path with nearby points.
 *
 * @param {Array<object>} records - Triggered point records.
 * @param {object} provider - Cesium terrain provider.
 * @param {Function|null} [onProgress] - Receives progress through the lateral candidate search from 0 through 100.
 * @returns {Promise<void>} Resolves after candidate options are assigned.
 */
const searchForCandidates = async (records, provider, onProgress = null) => {
    const activeDirections = new Set(records.flatMap(record => record.directions.map(direction => `${record.id}:${direction}`)))
    const searchState = new Map(records.map(record => [record.id, new Map(
        record.directions.map(direction => [direction, {
            previousDistance: 0,
            previousErrors: [...record.initialErrors],
            lastCandidateDistance: Number.NEGATIVE_INFINITY,
            candidateCount: 0,
        }]),
    )]))

    for (let distance = SEARCH_STEP_METERS; distance <= MAX_SEARCH_DISTANCE_METERS && activeDirections.size > 0; distance += SEARCH_STEP_METERS) {
        const active = records.filter(record => record.directions.some(direction => activeDirections.has(`${record.id}:${direction}`)))
        const requests = []
        active.forEach((record) => {
            for (const direction of record.directions) {
                if (!activeDirections.has(`${record.id}:${direction}`)) {
                    continue
                }
                requests.push(...candidateTerrainRequests(record, direction, distance))
            }
        })

        const reportDistanceProgress = ratio => onProgress?.(
            ((distance - 1 + ratio) / MAX_SEARCH_DISTANCE_METERS) * 100,
        )
        const heights = await sampleTerrainHeights(requests.map(request => request.coordinate), provider, reportDistanceProgress)
        const checksByPoint = groupTrialTerrainChecks(requests, heights)
        const probeTrials = []
        active.forEach((record) => {
            record.candidateOptions ??= []
            const pointChecks = checksByPoint.get(record.id)
            for (const direction of record.directions) {
                const directionKey = `${record.id}:${direction}`
                if (!activeDirections.has(directionKey)) {
                    continue
                }
                const state = searchState.get(record.id).get(direction)
                const check = pointChecks?.get(direction)
                if (!check) {
                    continue
                }
                const {errors} = check

                if (errors.some(error => !Number.isFinite(error)) || !check.profileAvailable) {
                    recordUnavailableTerrainDistance(record, direction, distance)
                    activeDirections.delete(directionKey)
                    continue
                }

                if (isCompatibleBorderPair(errors) && check.cliffSafe) {
                    if (distance - state.lastCandidateDistance >= ALTERNATE_CANDIDATE_SPACING_METERS) {
                        const candidate = candidateAt(record, direction, distance, errors)
                        if (state.candidateCount === 0) {
                            candidate.refinement = {
                                lowDistance: state.previousDistance,
                                highDistance: distance,
                                highErrors: [...errors],
                            }
                        }
                        record.candidateOptions.push(candidate)
                        state.lastCandidateDistance = distance
                        state.candidateCount += 1
                    }
                    state.previousDistance = distance
                    state.previousErrors = errors
                    if (state.candidateCount >= MAX_CANDIDATES_PER_DIRECTION) {
                        activeDirections.delete(directionKey)
                    }
                }
                else {
                    const pairMatchesAltitude = isCompatibleBorderPair(errors)
                    if (pairMatchesAltitude) {
                        record.cliffCandidateRejected = true
                    }
                    // Use interpolation only to choose a terrain query location, never as a terrain-height result.
                    const probeDistance = pairMatchesAltitude
                        ? null
                        : estimateCompatibleDistance(
                            state.previousDistance,
                            distance,
                            state.previousErrors,
                            errors,
                        )
                    if (Number.isFinite(probeDistance)
                        && probeDistance > state.previousDistance + 1e-3
                        && probeDistance < distance - 1e-3) {
                        probeTrials.push({
                            record,
                            direction,
                            lowDistance: state.previousDistance,
                            distance: probeDistance,
                        })
                    }
                    state.previousDistance = distance
                    state.previousErrors = errors
                }
            }
        })

        if (probeTrials.length > 0) {
            const probeRequests = probeTrials.flatMap(probe => (
                candidateTerrainRequests(probe.record, probe.direction, probe.distance)
            ))
            const probeHeights = await sampleTerrainHeights(probeRequests.map(request => request.coordinate), provider, reportDistanceProgress)
            const probeChecksByPoint = groupTrialTerrainChecks(probeRequests, probeHeights)
            probeTrials.forEach((probe) => {
                const check = probeChecksByPoint.get(probe.record.id)?.get(probe.direction)
                if (!check || check.errors.some(error => !Number.isFinite(error)) || !check.profileAvailable) {
                    recordUnavailableTerrainDistance(probe.record, probe.direction, probe.distance)
                    activeDirections.delete(`${probe.record.id}:${probe.direction}`)
                    return
                }
                if (!isCompatibleBorderPair(check.errors)) {
                    return
                }
                if (!check.cliffSafe) {
                    probe.record.cliffCandidateRejected = true
                    return
                }

                const state = searchState.get(probe.record.id).get(probe.direction)
                if (probe.distance - state.lastCandidateDistance < ALTERNATE_CANDIDATE_SPACING_METERS) {
                    return
                }
                const candidate = candidateAt(probe.record, probe.direction, probe.distance, check.errors)
                if (state.candidateCount === 0) {
                    candidate.refinement = {
                        lowDistance: probe.lowDistance,
                        highDistance: probe.distance,
                        highErrors: [...check.errors],
                    }
                }
                probe.record.candidateOptions.push(candidate)
                state.lastCandidateDistance = probe.distance
                state.candidateCount += 1
                if (state.candidateCount >= MAX_CANDIDATES_PER_DIRECTION) {
                    activeDirections.delete(`${probe.record.id}:${probe.direction}`)
                }
            })
        }
    }
}

/**
 * Search the two-dimensional terrain around a broken section and keep diverse, terrain-verified path choices.
 *
 * @param {Array<object>} records - Triggered point records.
 * @param {object} provider - Cesium terrain provider.
 * @param {Function|null} [onProgress] - Receives progress across geometry sections from 0 through 100.
 * @returns {Promise<void>} Resolves after geometric candidates are assigned.
 */
const searchForTerrainGeometryCandidates = async (records, provider, onProgress = null) => {
    const sections = new Map()
    records.filter(record => record.status === 'triggered' && record.terrainSectionId).forEach((record) => {
        const section = sections.get(record.terrainSectionId) ?? []
        section.push(record)
        sections.set(record.terrainSectionId, section)
    })

    const sectionList = [...sections.values()]
    for (const [sectionIndex, section] of sectionList.entries()) {
        const reportSectionProgress = ratio => onProgress?.(
            ((sectionIndex + ratio) / Math.max(1, sectionList.length)) * 100,
        )
        if (section.length < 6) {
            reportSectionProgress(1)
            continue
        }

        const searchIds = new Set()
        resolveCandidateBlock(section, {lockEndpoints: false})
        section.forEach((record, index) => {
            if (!record.selectedCandidate || record.selectedCandidate.unchanged) {
                for (let neighbor = Math.max(0, index - 2); neighbor <= Math.min(section.length - 1, index + 2); neighbor += 1) {
                    searchIds.add(section[neighbor].id)
                }
            }
            if (index === 0) {
                return
            }
            const previous = section[index - 1]
            const previousCoordinate = previous.selectedCandidate?.correctedCoordinate ?? previous.coordinate
            const currentCoordinate = record.selectedCandidate?.correctedCoordinate ?? record.coordinate
            const sourceStep = localOffsetMeters(previous.coordinate, record.coordinate)
            const correctedStep = localOffsetMeters(previousCoordinate, currentCoordinate)
            const sourceDistance = Math.hypot(sourceStep.east, sourceStep.north)
            const correctedDistance = Math.hypot(correctedStep.east, correctedStep.north)
            if (sourceDistance > 0 && correctedDistance / sourceDistance > MAX_GEOMETRIC_SEGMENT_STRETCH_RATIO) {
                for (let neighbor = Math.max(0, index - 2); neighbor <= Math.min(section.length - 1, index + 1); neighbor += 1) {
                    searchIds.add(section[neighbor].id)
                }
            }
        })
        section.forEach(record => delete record.selectedCandidate)
        const searchRecords = section.filter(record => searchIds.has(record.id))
        if (searchRecords.length === 0) {
            continue
        }

        const sectionLength = Math.max(...section.map(record => record.alongTrackMeters))
            - Math.min(...section.map(record => record.alongTrackMeters))
        // Match the terrain scan radius to the section's allowable geometric shift, avoiding oversized grids.
        const searchRadius = Math.max(MAX_SEARCH_DISTANCE_METERS, sectionLength * MAX_SECTION_SHIFT_RATIO)
        const grid = []
        const gridRowsPerRecord = Math.floor((searchRadius * 2) / GEOMETRY_GRID_SPACING_METERS) + 1
        const totalGridRows = gridRowsPerRecord * searchRecords.length
        let processedGridRows = 0
        for (const record of searchRecords) {
            for (let east = -searchRadius; east <= searchRadius; east += GEOMETRY_GRID_SPACING_METERS) {
                for (let north = -searchRadius; north <= searchRadius; north += GEOMETRY_GRID_SPACING_METERS) {
                    // Pointwise probes stay cross-track; any longitudinal adjustment must move the section coherently.
                    const alongTrackShift = (east * Math.sin(record.bearing)) + (north * Math.cos(record.bearing))
                    const distance = Math.hypot(east, north)
                    if (distance > searchRadius || Math.abs(alongTrackShift) > MAX_GEOMETRY_TANGENT_SHIFT_METERS) {
                        continue
                    }
                    grid.push({
                        record,
                        coordinate: [
                            ...coordinateFromLocalOffset(record.coordinate, east, north),
                            ...record.coordinate.slice(2),
                        ],
                        east,
                        north,
                        distance,
                    })
                }

                processedGridRows += 1
                if (processedGridRows % 8 === 0) {
                    reportSectionProgress((processedGridRows / Math.max(1, totalGridRows)) * 0.12)
                    await yieldToMainThread()
                }
            }
        }
        if (processedGridRows % 8 !== 0) {
            await yieldToMainThread()
        }
        reportSectionProgress(0.12)
        const heights = await sampleTerrainHeights(
            grid.map(candidate => candidate.coordinate),
            provider,
            ratio => reportSectionProgress(0.12 + (ratio * 0.56)),
        )
        const gridByRecord = new Map(searchRecords.map(record => [record.id, []]))
        for (let index = 0; index < grid.length; index += 1) {
            if ((index + 1) % 10000 === 0) {
                reportSectionProgress(0.68 + (((index + 1) / Math.max(1, grid.length)) * 0.1))
                await yieldToMainThread()
            }
            const candidate = grid[index]
            const height = heights[index]
            const target = candidate.record.terrainReferenceAltitude ?? candidate.record.altitude
            if (!Number.isFinite(height) || !Number.isFinite(target)) {
                continue
            }
            const error = height - target
            if (Math.abs(error) > BORDER_ERROR_THRESHOLD_METERS + GEOMETRY_GRID_SPACING_METERS) {
                continue
            }
            const angle = (Math.atan2(candidate.north, candidate.east) + (Math.PI * 2)) % (Math.PI * 2)
            const sector = Math.floor(angle / (Math.PI * 2) * GEOMETRY_SECTOR_COUNT)
            const radialBand = Math.min(GEOMETRY_RADIAL_BANDS - 1, Math.floor(
                candidate.distance / (searchRadius / GEOMETRY_RADIAL_BANDS),
            ))
            const choices = gridByRecord.get(candidate.record.id)
            choices.push({...candidate, error, sector, radialBand})
        }
        reportSectionProgress(0.78)

        const trials = []
        for (const [recordIndex, record] of searchRecords.entries()) {
            const buckets = new Map()
            gridByRecord.get(record.id).forEach((candidate) => {
                const key = `${candidate.sector}:${candidate.radialBand}`
                const choices = buckets.get(key) ?? []
                choices.push(candidate)
                buckets.set(key, choices)
            })
            buckets.forEach((choices) => {
                choices.sort((first, second) => (
                    (first.distance + Math.abs(first.error) * 0.25)
                    - (second.distance + Math.abs(second.error) * 0.25)
                ))
                const selected = []
                for (const candidate of choices) {
                    if (selected.length >= MAX_GEOMETRY_CANDIDATES_PER_BAND) {
                        break
                    }
                    if (selected.every(previous => Math.hypot(
                        previous.east - candidate.east,
                        previous.north - candidate.north,
                    ) >= GEOMETRY_GRID_SPACING_METERS * 1.5)) {
                        selected.push(candidate)
                    }
                }
                selected.forEach(candidate => trials.push({
                    record,
                    offsetMeters: 0,
                    correctedCoordinate: candidate.coordinate,
                }))
            })
            reportSectionProgress(0.78 + (((recordIndex + 1) / searchRecords.length) * 0.1))
            await yieldToMainThread()
        }
        if (trials.length === 0) {
            reportSectionProgress(1)
            continue
        }

        reportSectionProgress(0.88)
        const checks = await evaluateTerrainAlignmentTrials(trials, provider)
        for (let index = 0; index < checks.length; index += 1) {
            const check = checks[index]
            if (check?.candidate) {
                const candidate = {...check.candidate, geometrySearch: true}
                const record = trials[index].record
                const duplicate = record.candidateOptions.some((existing) => {
                    const displacement = localOffsetMeters(existing.correctedCoordinate, candidate.correctedCoordinate)
                    return Math.hypot(displacement.east, displacement.north) < 1
                })
                if (!duplicate) {
                    record.candidateOptions.push(candidate)
                }
            }
            if ((index + 1) % 5000 === 0) {
                reportSectionProgress(0.88 + (((index + 1) / Math.max(1, checks.length)) * 0.12))
                await yieldToMainThread()
            }
        }
        reportSectionProgress(1)
    }
}

/**
 * Refine each coarse candidate against sampled terrain values near its first valid offset.
 *
 * @param {Array<object>} records - Triggered point records with coarse candidate options.
 * @param {object} provider - Cesium terrain provider.
 * @param {Function|null} [onProgress] - Receives refinement progress from 0 through 100.
 * @returns {Promise<void>} Candidate offsets are narrowed using actual terrain samples.
 */
const refineCandidateOptions = async (records, provider, onProgress = null) => {
    const refinements = records.flatMap(record => record.candidateOptions.filter(candidate => candidate.refinement).map(candidate => ({
        record,
        candidate,
        lowDistance: candidate.refinement.lowDistance,
        highDistance: candidate.refinement.highDistance,
        highErrors: candidate.refinement.highErrors,
    })))

    for (let iteration = 0; iteration < SEARCH_REFINEMENT_ITERATIONS; iteration += 1) {
        const active = refinements.filter(refinement => (
            !refinement.failed && refinement.highDistance - refinement.lowDistance > SEARCH_PRECISION_METERS
        ))
        if (active.length === 0) {
            break
        }

        const requests = active.flatMap((refinement) => {
            const distance = (refinement.lowDistance + refinement.highDistance) / 2
            return candidateTerrainRequests(refinement.record, refinement.candidate.direction, distance)
        })
        const heights = await sampleTerrainHeights(
            requests.map(request => request.coordinate),
            provider,
            ratio => onProgress?.(((iteration + ratio) / SEARCH_REFINEMENT_ITERATIONS) * 100),
        )
        const checksByPoint = groupTrialTerrainChecks(requests, heights)
        active.forEach((refinement) => {
            const check = checksByPoint.get(refinement.record.id)?.get(refinement.candidate.direction)
            if (!check || check.errors.some(error => !Number.isFinite(error)) || !check.profileAvailable) {
                recordUnavailableTerrainDistance(
                    refinement.record,
                    refinement.candidate.direction,
                    (refinement.lowDistance + refinement.highDistance) / 2,
                )
                refinement.failed = true
                return
            }

            const distance = (refinement.lowDistance + refinement.highDistance) / 2
            if (isCompatibleBorderPair(check.errors) && check.cliffSafe) {
                refinement.highDistance = distance
                refinement.highErrors = check.errors
            }
            else {
                if (isCompatibleBorderPair(check.errors)) {
                    refinement.record.cliffCandidateRejected = true
                }
                refinement.lowDistance = distance
            }
        })
    }

    refinements.forEach((refinement) => {
        const {candidate, highDistance, highErrors} = refinement
        candidate.distanceMeters = highDistance
        candidate.offsetMeters = candidate.direction * highDistance
        candidate.maxVerticalErrorMeters = Math.max(...highErrors.map(Math.abs))
        candidate.correctedCoordinate = [
            ...offsetCoordinate(refinement.record.coordinate, refinement.record.bearing, candidate.offsetMeters),
            ...refinement.record.coordinate.slice(2),
        ]
        delete candidate.refinement
    })
    onProgress?.(100)
}

/**
 * Return the local cost of using a lateral correction candidate.
 *
 * @param {object} candidate - Candidate correction.
 * @param {object} record - Source route point for this candidate.
 * @param {number} maxSectionShiftMeters - Geometry-relative displacement limit for the affected section.
 * @returns {number} Candidate cost in approximate metres.
 */
const candidateCost = (candidate, record, maxSectionShiftMeters) => {
    if (candidate.unchanged) {
        return candidate.unresolvedPenalty
    }

    const displacement = localOffsetMeters(record.coordinate, candidate.correctedCoordinate)
    const displacementMeters = Math.hypot(displacement.east, displacement.north)
    if (displacementMeters > maxSectionShiftMeters) {
        return Number.POSITIVE_INFINITY
    }

    // Keep every selected point as close to the cliff as its safe corridor allows. The transition
    // cost separately measures how much this point moves from the previous corrected point.
    return (candidate.distanceMeters * CANDIDATE_OFFSET_COST_PER_METER * (candidate.support ? 0.5 : 1))
        + (candidate.maxVerticalErrorMeters * 0.01)
}

/**
 * Return the transition cost between neighboring correction choices.
 *
 * @param {object} previousRecord - Previous point record.
 * @param {object} previous - Previous point's choice.
 * @param {object} currentRecord - Current point record.
 * @param {object} current - Current point's choice.
 * @returns {number} Cost for lateral offset changes across adjacent GPX points.
 */
const candidateTransitionCost = (previousRecord, previous, currentRecord, current) => {
    const previousOffset = localOffsetMeters(previousRecord.coordinate, previous.correctedCoordinate ?? previousRecord.coordinate)
    const currentOffset = localOffsetMeters(currentRecord.coordinate, current.correctedCoordinate ?? currentRecord.coordinate)
    // The offset delta measures movement from the previous corrected point carried onto this GPX point.
    const offsetChange = Math.hypot(currentOffset.east - previousOffset.east, currentOffset.north - previousOffset.north)
    const sourceDistance = localOffsetMeters(previousRecord.coordinate, currentRecord.coordinate)
    const sourceDistanceMeters = Math.hypot(sourceDistance.east, sourceDistance.north)
    const previousCoordinate = previous.correctedCoordinate ?? previousRecord.coordinate
    const currentCoordinate = current.correctedCoordinate ?? currentRecord.coordinate
    const alignedDisplacement = localOffsetMeters(previousCoordinate, currentCoordinate)
    const alignedDistanceMeters = Math.hypot(alignedDisplacement.east, alignedDisplacement.north)
    const addedDistanceMeters = Math.max(0, alignedDistanceMeters - sourceDistanceMeters)
    const maximumSmoothOffsetChange = Math.max(3, sourceDistanceMeters * OFFSET_STEP_BREAK_RATIO)
    const excessOffsetChange = Math.max(0, offsetChange - maximumSmoothOffsetChange)
    const excessCurvatureCost = (excessOffsetChange ** 2 / Math.max(1, sourceDistanceMeters))
        * OFFSET_STEP_EXCESS_CURVATURE_COST

    const sectionWeight = previousRecord.status === 'triggered' && currentRecord.status === 'triggered'
        ? SECTION_OFFSET_VARIATION_COST
        : 1
    return (offsetChange * sectionWeight)
        + (addedDistanceMeters * OFFSET_STEP_ADDED_DISTANCE_COST)
        + excessCurvatureCost
}

/**
 * Build the unchanged choice used when terrain correction is unsafe or unavailable.
 *
 * @param {object} record - Point record that remains at its GPX coordinate.
 * @returns {object} Unchanged path choice and its unresolved-point cost.
 */
const unchangedChoiceFor = record => ({
    offsetMeters: 0,
    distanceMeters: 0,
    maxVerticalErrorMeters: 0,
    correctedCoordinate: record.coordinate,
    unchanged: true,
    unresolvedPenalty: record.status === 'triggered'
        ? UNRESOLVED_POINT_COST_METERS + Math.min(120, Math.max(...record.initialErrors.map(Math.abs)))
        : 0,
})

/**
 * Resolve candidate choices across a complete route segment with a path-level cost.
 *
 * @param {Array<object>} segmentRecords - Ordered point records for one route segment.
 * @param {{lockEndpoints?: boolean}} options - Whether to preserve this route segment's endpoints.
 * @returns {void} Triggered records receive a candidate only when the best path is unambiguous.
 */
const resolveCandidateBlock = (segmentRecords, {lockEndpoints = true} = {}) => {
    if (segmentRecords.length === 0) {
        return
    }

    const sectionSpans = new Map()
    segmentRecords.filter(record => (
        ['triggered', 'terrain-unavailable'].includes(record.status) && record.terrainSectionId
    )).forEach((record) => {
        const span = sectionSpans.get(record.terrainSectionId) ?? {first: record.alongTrackMeters, last: record.alongTrackMeters}
        span.first = Math.min(span.first, record.alongTrackMeters)
        span.last = Math.max(span.last, record.alongTrackMeters)
        sectionSpans.set(record.terrainSectionId, span)
    })
    const maxSectionShiftById = new Map([...sectionSpans].map(([sectionId, span]) => {
        const sectionLength = span.last - span.first
        return [
            sectionId,
            // Long sections scale their allowable correction with route length; short local repairs stay uncapped.
            sectionLength >= MIN_SECTION_LENGTH_FOR_SHIFT_LIMIT_METERS
                ? sectionLength * MAX_SECTION_SHIFT_RATIO
                : Number.POSITIVE_INFINITY,
        ]
    }))
    const choicesByPoint = segmentRecords.map((record) => {
        const unchangedChoice = unchangedChoiceFor(record)
        const isLockedEndpoint = lockEndpoints
            && (record === segmentRecords[0] || record === segmentRecords.at(-1))
            && record.status !== 'triggered'
        if (!isLockedEndpoint && ['triggered', 'support'].includes(record.status)) {
            return [...record.candidateOptions, unchangedChoice]
        }

        return [unchangedChoice]
    })
    const forwardCosts = []
    const predecessors = []
    choicesByPoint.forEach((choices, pointIndex) => {
        predecessors[pointIndex] = []
        forwardCosts[pointIndex] = choices.map((choice, choiceIndex) => {
            const localCost = candidateCost(
                choice,
                segmentRecords[pointIndex],
                maxSectionShiftById.get(segmentRecords[pointIndex].terrainSectionId) ?? Number.POSITIVE_INFINITY,
            )
            if (pointIndex === 0) {
                return localCost
            }

            const previousRecord = segmentRecords[pointIndex - 1]
            const currentRecord = segmentRecords[pointIndex]
            let bestCost = Number.POSITIVE_INFINITY
            let bestIndex = 0
            choicesByPoint[pointIndex - 1].forEach((previous, previousIndex) => {
                const cost = forwardCosts[pointIndex - 1][previousIndex]
                    + candidateTransitionCost(previousRecord, previous, currentRecord, choice)
                if (cost < bestCost) {
                    bestCost = cost
                    bestIndex = previousIndex
                }
            })
            predecessors[pointIndex][choiceIndex] = bestIndex
            return localCost + bestCost
        })
    })

    const backwardCosts = Array(segmentRecords.length)
    for (let pointIndex = segmentRecords.length - 1; pointIndex >= 0; pointIndex -= 1) {
        backwardCosts[pointIndex] = choicesByPoint[pointIndex].map((choice) => {
            const localCost = candidateCost(
                choice,
                segmentRecords[pointIndex],
                maxSectionShiftById.get(segmentRecords[pointIndex].terrainSectionId) ?? Number.POSITIVE_INFINITY,
            )
            if (pointIndex === segmentRecords.length - 1) {
                return localCost
            }

            const currentRecord = segmentRecords[pointIndex]
            const nextRecord = segmentRecords[pointIndex + 1]
            return localCost + Math.min(...choicesByPoint[pointIndex + 1].map((next, nextIndex) => (
                backwardCosts[pointIndex + 1][nextIndex]
                + candidateTransitionCost(currentRecord, choice, nextRecord, next)
            )))
        })
    }

    const bestPathCost = Math.min(...forwardCosts.at(-1))
    let selectedIndex = forwardCosts.at(-1).indexOf(bestPathCost)
    const selectedChoices = Array(segmentRecords.length)
    // Trace one complete optimal path. Independent marginal choices can leave holes in an otherwise valid route.
    for (let pointIndex = segmentRecords.length - 1; pointIndex >= 0; pointIndex -= 1) {
        selectedChoices[pointIndex] = choicesByPoint[pointIndex][selectedIndex]
        selectedIndex = predecessors[pointIndex][selectedIndex]
    }
    const ambiguousSections = new Set()
    segmentRecords.forEach((record, pointIndex) => {
        if (!['triggered', 'support'].includes(record.status)) {
            return
        }

        const selected = selectedChoices[pointIndex]
        record.selectedCandidate = selected
        const choices = choicesByPoint[pointIndex]
        const selectedOffset = localOffsetMeters(record.coordinate, selected.correctedCoordinate)
        const oppositeOptimalChoice = !selected.unchanged && choices.some((choice, choiceIndex) => {
            if (choice.unchanged) {
                return false
            }
            const pathCost = forwardCosts[pointIndex][choiceIndex]
                + backwardCosts[pointIndex][choiceIndex]
                - candidateCost(
                    choice,
                    record,
                    maxSectionShiftById.get(record.terrainSectionId) ?? Number.POSITIVE_INFINITY,
                )
            if (pathCost - bestPathCost > CANDIDATE_COST_TIE_TOLERANCE_METERS) {
                return false
            }
            const alternative = localOffsetMeters(record.coordinate, choice.correctedCoordinate)
            return Math.hypot(alternative.east - selectedOffset.east, alternative.north - selectedOffset.north) > 1
                && alternative.east * selectedOffset.east + alternative.north * selectedOffset.north < 0
        })
        if (oppositeOptimalChoice) {
            ambiguousSections.add(record.terrainSectionId ?? selected.sectionId)
        }
    })
    segmentRecords.forEach(record => {
        if (ambiguousSections.has(record.terrainSectionId) || ambiguousSections.has(record.selectedCandidate?.sectionId)) {
            delete record.selectedCandidate
        }
    })
    const correctionGroups = new Map()
    segmentRecords.filter(record => (
        ['triggered', 'terrain-unavailable'].includes(record.status) && record.terrainSectionId
    )).forEach((record) => {
        const section = correctionGroups.get(record.terrainSectionId) ?? []
        section.push(record)
        correctionGroups.set(record.terrainSectionId, section)
    })
    correctionGroups.forEach((section, sectionId) => {
        const hasUnavailablePoint = section.some(record => (
            record.status === 'terrain-unavailable' || record.candidateOptions.length === 0
        ))
        const hasPartialPath = section.some(record => !record.selectedCandidate || record.selectedCandidate.unchanged)
        if (!hasUnavailablePoint && hasPartialPath && !ambiguousSections.has(sectionId)) {
            // Reject a partial detour when every point has terrain, but no continuous corrected section exists.
            section.forEach(record => {
                record.selectedCandidate = unchangedChoiceFor(record)
            })
        }
    })
}

/**
 * Resolve candidate choices across each segment so neighboring points guide ambiguous corrections.
 *
 * @param {Array<object>} segmentRecords - Point records for one route segment.
 * @returns {void} Candidate choices are written to the point records.
 */
const resolveSegmentCandidates = segmentRecords => {
    resolveCandidateBlock(segmentRecords)
}

/**
 * Create the corrected GeoJSON content and diagnostic records from point decisions.
 *
 * @param {object} content - Original GeoJSON track content.
 * @param {Array<Array<Array<number>>>} segments - Original coordinate segments.
 * @param {Array<object>} records - Alignment records with final statuses.
 * @returns {{content: object, diagnostics: Array<object>, changed: boolean}} Alignment result.
 */
const buildAlignmentResult = (content, segments, records) => {
    let changed = false
    const coordinates = segments.map(segment => segment.map(coordinate => [...coordinate]))
    const diagnostics = []
    const corrections = []

    records.forEach((record) => {
        if (record.geometryReconstructionRejected) {
            record.status = 'correction-rejected-for-geometry'
        }
        else if (record.selectedCandidate && !record.selectedCandidate.unchanged) {
            record.status = 'corrected'
            record.correctedCoordinate = record.selectedCandidate.correctedCoordinate
            coordinates[record.segmentIndex][record.coordinateIndex] = record.correctedCoordinate
            corrections.push({
                segmentIndex: record.segmentIndex,
                coordinateIndex: record.coordinateIndex,
                sourceCoordinate: [...record.coordinate],
                correctedCoordinate: [...record.correctedCoordinate],
            })
            changed = true
            return
        }

        if (record.status === 'triggered') {
            record.status = record.candidateOptions.length === 0
                ? record.cliffCandidateRejected
                    ? 'cliff-candidate-rejected'
                    : 'no-matching-terrain'
                : record.selectedCandidate?.unchanged
                    ? 'correction-rejected-for-continuity'
                    : 'ambiguous'
        }
        if ([
            'ambiguous',
            'correction-rejected-for-continuity',
            'correction-rejected-for-geometry',
            'cliff-candidate-rejected',
            'no-matching-terrain',
            'terrain-unavailable',
        ].includes(record.status)) {
            diagnostics.push({
                segmentIndex: record.segmentIndex,
                coordinateIndex: record.coordinateIndex,
                coordinate: [...record.coordinate],
                reason: record.status,
                borderErrorsMeters: record.initialErrors ?? null,
                detectionReason: record.detectionReason ?? null,
                terrainBreakMeters: record.terrainBreakMeters ?? 0,
                heightReferenceOffsetMeters: record.heightReferenceOffsetMeters ?? 0,
            })
        }
    })

    const statistics = {
        points: records.length,
        detectedPoints: records.filter(record => record.detectionReason).length,
        correctedPoints: records.filter(record => record.status === 'corrected').length,
        correctedDetectedPoints: records.filter(record => record.detectionReason && record.status === 'corrected').length,
        unresolvedPoints: diagnostics.length,
        sections: new Set(records.filter(record => record.terrainSectionId).map(record => record.terrainSectionId)).size,
    }
    if (!changed) {
        return {content, diagnostics, changed, statistics, corrections}
    }

    const geometry = content.geometry
    const alignedContent = {
        ...content,
        geometry: {
            ...geometry,
            coordinates: geometry.type === 'LineString' ? coordinates[0] ?? [] : coordinates,
        },
    }

    return {content: alignedContent, diagnostics, changed, statistics, corrections}
}

/**
 * Sample track borders and detect problematic terrain sections without changing route geometry.
 *
 * @param {object} content - Original GeoJSON track feature.
 * @param {object} options - Terrain and trace-width settings.
 * @param {object} options.provider - Cesium terrain provider.
 * @param {number} options.traceWidthMeters - Effective full trace width in metres.
 * @param {Function|null} [options.onProgress] - Receives initial analysis progress from 0 through 100.
 * @param {Function|null} [options.onLocation] - Receives the current GPX coordinate during border sampling.
 * @returns {Promise<object>} Analysis records, detected sections, and terrain availability.
 */
const analyzeTrackContent = async (content, {provider, traceWidthMeters, onProgress = null, onLocation = null}) => {
    const segments = coordinateSegments(content)
    const pointCount = segments.reduce((count, segment) => count + segment.length, 0)
    if (!provider || pointCount < 2 || !segments.some(segment => segment.some(coordinate => finiteNumber(coordinate?.[2]) !== null))) {
        return {
            available: false,
            content,
            segments,
            records: [],
            recordsBySegment: [],
            triggeredRecords: [],
            verticalReference: null,
        }
    }

    const halfWidthMeters = Math.max(0, Number(traceWidthMeters) || 0) / 2
    const records = createPointRecords(segments, halfWidthMeters)
    reportProgress(onProgress, 1)
    await sampleInitialBorders(
        records,
        provider,
        ratio => reportProgress(onProgress, 1 + ratio * 9),
        onLocation,
    )
    const verticalReference = registerTerrainHeightReference(records)
    const recordsBySegment = segments.map((_, segmentIndex) => records.filter(record => record.segmentIndex === segmentIndex))
    recordsBySegment.forEach(segmentRecords => detectTerrainAlignmentSections(segmentRecords, {
        distanceBetween: (first, second) => {
            const displacement = localOffsetMeters(first, second)
            return Math.hypot(displacement.east, displacement.north)
        },
    }))
    const triggeredRecords = records.filter(record => record.status === 'triggered')
    const eligibleRecords = records.filter(record => record.altitude !== null && record.bearing !== null)
    const sampledRecords = eligibleRecords.filter(record => (
        record.borderHeights?.length === 2 && record.borderHeights.every(Number.isFinite)
    ))
    reportProgress(onProgress, 12)

    return {
        available: eligibleRecords.length > 0 && sampledRecords.length === eligibleRecords.length,
        content,
        segments,
        records,
        recordsBySegment,
        triggeredRecords,
        verticalReference,
    }
}

/**
 * Align GPX sections where either rendered border disagrees with elevation or breaks abruptly along the route.
 *
 * @param {object} content - Original GeoJSON track feature.
 * @param {object} options - Terrain and trace-width settings.
 * @param {object} options.provider - Cesium terrain provider.
 * @param {number} options.traceWidthMeters - Effective full trace width in metres.
 * @param {Function} [options.onProgress] - Receives best-effort correction progress from 0 through 100.
 * @param {object} [options.analysis] - Reusable border analysis produced by the check-only pass.
 * @returns {Promise<{content: object, diagnostics: Array<object>, changed: boolean}>} Alignment result.
 */
const alignTrackContent = async (content, {provider, traceWidthMeters, onProgress = null, analysis = null}) => {
    const terrainAnalysis = analysis ?? await analyzeTrackContent(content, {
        provider,
        traceWidthMeters,
        onProgress: value => reportProgress(onProgress, value),
    })
    if (!terrainAnalysis.available && terrainAnalysis.triggeredRecords.length === 0) {
        reportProgress(onProgress, 100)
        return {content, diagnostics: failureDiagnostics(content, 'terrain-unavailable'), changed: false}
    }

    const {segments, records, recordsBySegment, triggeredRecords, verticalReference} = terrainAnalysis
    reportProgress(onProgress, 12)
    if (triggeredRecords.length === 0) {
        reportProgress(onProgress, 100)
        return {...buildAlignmentResult(content, segments, records), verticalReference}
    }

    await searchForCandidates(triggeredRecords, provider, value => reportProgress(onProgress, 12 + value * 0.36))
    reportProgress(onProgress, 50)
    await refineCandidateOptions(triggeredRecords, provider, value => reportProgress(onProgress, 50 + value * 0.1))
    reportProgress(onProgress, 60)
    triggeredRecords.forEach((record) => {
        const unavailableDistances = [...(record.unavailableDistanceByDirection?.values() ?? [])]
        if (unavailableDistances.length === 0) {
            return
        }

        const nearestUnavailableDistance = Math.min(...unavailableDistances)
        record.candidateOptions = record.candidateOptions.filter(candidate => (
            candidate.distanceMeters < nearestUnavailableDistance - 1e-3
        ))
        if (record.candidateOptions.length === 0) {
            record.status = 'terrain-unavailable'
        }
    })
    await searchForTerrainGeometryCandidates(triggeredRecords, provider, value => reportProgress(onProgress, 60 + value * 0.12))
    reportProgress(onProgress, 73)
    let sectionTrialCount = 0
    await addTerrainSectionCandidates(records, {
        sampleTrials: async trials => {
            reportProgress(onProgress, Math.min(82, 73 + sectionTrialCount * 0.25))
            sectionTrialCount += 1
            const checks = await evaluateTerrainAlignmentTrials(trials, provider)
            reportProgress(onProgress, Math.min(82, 73 + sectionTrialCount * 0.25))
            return checks
        },
        displacementBetween: localOffsetMeters,
        translateCoordinate: (coordinate, delta) => [
            ...coordinateFromLocalOffset(coordinate, delta.east, delta.north),
            ...coordinate.slice(2),
        ],
    })
    let validationCalls = 0
    const maximumValidationCalls = Math.max(1, recordsBySegment.length * FINAL_VALIDATION_ATTEMPTS)
    for (const [segmentIndex, segmentRecords] of recordsBySegment.entries()) {
        let best = null
        // Final tangents couple neighboring choices. Remove failed choices and solve the constrained path again.
        for (let attempt = 0; attempt < FINAL_VALIDATION_ATTEMPTS; attempt += 1) {
            segmentRecords.forEach(record => {
                delete record.selectedCandidate
                delete record.geometryReconstructionRejected
            })
            resolveSegmentCandidates(segmentRecords)
            const rejected = await validateTerrainSectionCorrections(segmentRecords, {
                sampleTrials: async trials => {
                    validationCalls += 1
                    reportProgress(onProgress, 82 + Math.min(16, (validationCalls / maximumValidationCalls) * 16))
                    const checks = await evaluateTerrainAlignmentTrials(trials, provider)
                    reportProgress(onProgress, 82 + Math.min(16, (validationCalls / maximumValidationCalls) * 16))
                    return checks
                },
                bearingAt: tangentBearing,
                displacementBetween: localOffsetMeters,
                translateCoordinate: (coordinate, delta) => [
                    ...coordinateFromLocalOffset(coordinate, delta.east, delta.north),
                    ...coordinate.slice(2),
                ],
            })
            const corrected = segmentRecords.filter(record => record.status === 'triggered' && record.selectedCandidate && !record.selectedCandidate.unchanged).length
            const totalShift = segmentRecords.reduce((sum, record) => sum + (record.selectedCandidate?.distanceMeters ?? 0), 0)
            if (!best || corrected > best.corrected || (corrected === best.corrected && totalShift < best.totalShift)) {
                best = {
                    corrected,
                    totalShift,
                    choices: segmentRecords.map(record => ({candidate: record.selectedCandidate, rejected: record.geometryReconstructionRejected})),
                }
            }
            if (!rejected.length) {
                break
            }
            rejected.forEach(({record, candidate}) => {
                record.candidateOptions = record.candidateOptions.filter(option => option !== candidate)
            })
        }
        segmentRecords.forEach((record, index) => {
            record.selectedCandidate = best.choices[index].candidate
            record.geometryReconstructionRejected = best.choices[index].rejected
        })
        reportProgress(onProgress, 82 + (((segmentIndex + 1) / recordsBySegment.length) * 16))
    }

    const result = {...buildAlignmentResult(content, segments, records), verticalReference}
    reportProgress(onProgress, 100)
    return result
}

/**
 * Resolve a stable world-space corridor width from the stored track render style.
 *
 * @param {object} track - Track with a render style.
 * @param {object} options - Render-scale options.
 * @param {number} [options.pixelsPerMeter=0] - Current Cesium render scale for pixel-only styles.
 * @returns {number} Effective full width in metres, capped at the supported search width.
 */
export const resolveTrackTerrainAlignmentWidthMeters = (track, {pixelsPerMeter = 0} = {}) => {
    const style = normalizeTrackRenderStyle(track?.renderStyle, {
        color:     track?.color,
        thickness: track?.thickness,
    })
    const underlayWidth = style.underlay.enabled
        ? (style.widthUnit === TRACK_RENDER_WIDTH_UNITS.METERS ? style.underlay.meterWidth : style.underlay.pixelWidth)
        : 0
    const configuredWidth = Math.max(
        style.widthUnit === TRACK_RENDER_WIDTH_UNITS.METERS ? style.meterWidth : style.farPixelWidth,
        underlayWidth,
    )
    const widthMeters = style.widthUnit === TRACK_RENDER_WIDTH_UNITS.METERS
        ? configuredWidth
        : (Number(pixelsPerMeter) > 0 ? configuredWidth / Number(pixelsPerMeter) : style.meterWidth)

    return Math.min(30, Math.max(0, Number.isFinite(widthMeters) ? widthMeters : 0))
}

/**
 * Reuse or create one non-mutating terrain check for a track's current source geometry.
 *
 * @param {object} track - Track containing source geometry.
 * @param {object} options - Terrain and width settings.
 * @param {object} options.provider - Cesium terrain provider.
 * @param {number} options.traceWidthMeters - Effective full trace width in metres.
 * @param {Function|null} [options.onProgress] - Receives best-effort initial analysis progress.
 * @param {Function|null} [options.onLocation] - Receives the current GPX coordinate during border sampling.
 * @returns {Promise<object>} Cached terrain analysis.
 */
const getTrackTerrainAnalysis = async (track, {provider, traceWidthMeters, onProgress = null, onLocation = null}) => {
    const width = Math.min(30, Math.max(0, Number(traceWidthMeters) || 0))
    const existing = track && typeof track === 'object' ? terrainAlignmentAnalysisByTrack.get(track) : null
    if (existing?.sourceContent === track?.content && existing.provider === provider && existing.traceWidthMeters === width) {
        return existing.promise ?? existing.analysis
    }

    const promise = analyzeTrackContent(track?.content, {
        provider,
        traceWidthMeters: width,
        onProgress: value => reportProgress(onProgress, value),
        onLocation,
    })
        .catch(() => ({
            available: false,
            content: track?.content,
            segments: [],
            records: [],
            recordsBySegment: [],
            triggeredRecords: [],
            verticalReference: null,
        }))
    const record = {sourceContent: track?.content, provider, traceWidthMeters: width, analysis: null, promise}
    if (track && typeof track === 'object') {
        terrainAlignmentAnalysisByTrack.set(track, record)
    }

    const analysis = await promise
    record.analysis = analysis
    record.promise = null
    return analysis
}

/**
 * Check whether the visible borders of one GPX track contain a confirmed terrain discrepancy.
 * This pass samples the route only; it never searches for a correction or changes geometry.
 *
 * @param {object} track - Track containing source GeoJSON content.
 * @param {object} options - Terrain provider and trace-width options.
 * @param {object} [options.provider] - Cesium terrain provider.
 * @param {number} [options.traceWidthMeters] - Effective full trace width in metres.
 * @param {Function|null} [options.onProgress] - Receives analysis progress from 0 through 100.
 * @param {Function|null} [options.onLocation] - Receives route coordinates during sampling and the first detected point at completion.
 * @returns {Promise<{status: 'needs-correction'|'clean'|'unavailable', detectedPoints: number}>} Check result.
 */
export const checkTrackTerrainAlignment = async (track, {
    provider = globalThis.lgs?.viewer?.terrainProvider ?? globalThis.lgs?.scene?.globe?.terrainProvider,
    traceWidthMeters = resolveTrackTerrainAlignmentWidthMeters(track),
    onProgress = null,
    onLocation = null,
} = {}) => {
    const journey = journeyForTrack(track)
    if (!track?.parent || journey?.antiCliffCorrection !== true) {
        return {status: 'disabled', detectedPoints: 0}
    }
    if (!currentTerrainId()) {
        return {status: 'unavailable', detectedPoints: 0}
    }
    if (!isTrackTerrainAlignmentEnabled(track)) {
        return {status: 'disabled', detectedPoints: 0}
    }

    const analysis = await getTrackTerrainAnalysis(track, {
        provider,
        traceWidthMeters,
        onProgress: value => reportProgress(onProgress, value / 12 * 100),
        onLocation,
    })
    reportAlignmentLocation(onLocation, analysis.triggeredRecords[0] ?? analysis.records.at(-1))
    reportProgress(onProgress, 100)
    const detectedPoints = analysis.triggeredRecords.length
    if (detectedPoints > 0) {
        return {status: 'needs-correction', detectedPoints}
    }
    if (!analysis.available) {
        return {status: 'unavailable', detectedPoints: 0}
    }

    return {status: 'clean', detectedPoints: 0}
}

/**
 * Return a saved or already prepared terrain-alignment result without performing terrain analysis.
 *
 * @param {object} track - Track whose aligned content is requested.
 * @param {object} options - Terrain provider override.
 * @param {object} [options.provider] - Cesium terrain provider.
 * @param {number} [options.traceWidthMeters] - Effective full trace width in metres.
 * @returns {{content: object, diagnostics: Array<object>, enabled: boolean}} Saved, cached, or source geometry.
 */
export const getCachedTerrainAlignmentResult = (track, {
    provider = globalThis.lgs?.viewer?.terrainProvider ?? globalThis.lgs?.scene?.globe?.terrainProvider,
    traceWidthMeters = resolveTrackTerrainAlignmentWidthMeters(track),
} = {}) => {
    if (!isTrackTerrainAlignmentEnabled(track)) {
        return {
            content: track?.content ?? null,
            diagnostics: [],
            statistics: null,
            verticalReference: null,
            enabled: false,
        }
    }

    const persisted = persistedTerrainCorrectionForTrack(track)
    if (persisted?.status === 'matched') {
        return {
            content: persisted.content,
            diagnostics: [],
            statistics: null,
            verticalReference: null,
            corrections: persisted.corrections,
            changed: persisted.changed,
            persisted: true,
            enabled: true,
        }
    }
    if (persisted?.status === 'terrain-mismatch' || persisted?.status === 'source-mismatch') {
        return {
            content: track?.content ?? null,
            diagnostics: [],
            statistics: null,
            verticalReference: null,
            enabled: false,
        }
    }

    const record = track && typeof track === 'object' ? terrainAlignmentByTrack.get(track) : null
    const width = Math.min(30, Math.max(0, Number(traceWidthMeters) || 0))
    if (record?.sourceContent === track?.content
        && record.provider === provider
        && record.traceWidthMeters === width
        && record.result) {
        return {...record.result, enabled: true}
    }

    return {
        content: track?.content ?? null,
        diagnostics: [],
        statistics: null,
        verticalReference: null,
        enabled: true,
    }
}

/** Return saved or already prepared geometry without starting terrain analysis. */
export const getTerrainAlignedTrackContent = (track, options = {}) => {
    return getCachedTerrainAlignmentResult(track, options).content
}

/**
 * Prepare and cache terrain-aligned geometry plus failure diagnostics for a track.
 *
 * @param {object} track - Track containing source GeoJSON content.
 * @param {object} options - Terrain provider and width options.
 * @param {object} [options.provider] - Cesium terrain provider.
 * @param {number} [options.traceWidthMeters] - Effective full trace width in metres.
 * @param {Function} [options.onProgress] - Receives best-effort correction progress from 0 through 100.
 * @returns {Promise<{content: object, diagnostics: Array<object>, changed: boolean, cacheKey: string}>} Alignment result.
 */
export const prepareTerrainAlignedTrackContent = async (track, {
    provider = globalThis.lgs?.viewer?.terrainProvider ?? globalThis.lgs?.scene?.globe?.terrainProvider,
    traceWidthMeters = resolveTrackTerrainAlignmentWidthMeters(track),
    onProgress = null,
} = {}) => {
    const content = track?.content
    const width = Math.min(30, Math.max(0, Number(traceWidthMeters) || 0))
    const journey = journeyForTrack(track)
    if (!track?.parent || journey?.antiCliffCorrection !== true) {
        return {
            content,
            diagnostics: [],
            changed: false,
            corrections: [],
            statistics: null,
            cacheKey: `${width.toFixed(3)}`,
            persisted: false,
            skipped: 'disabled',
        }
    }
    if (!currentTerrainId()) {
        return {
            content,
            diagnostics: [],
            changed: false,
            corrections: [],
            statistics: null,
            cacheKey: `${width.toFixed(3)}`,
            persisted: false,
            skipped: 'terrain-unavailable',
        }
    }

    const persisted = persistedTerrainCorrectionForTrack(track)
    if (persisted?.status === 'matched') {
        const result = {
            content: persisted.content,
            diagnostics: [],
            changed: persisted.changed,
            corrections: persisted.corrections,
            statistics: null,
            cacheKey: `${width.toFixed(3)}`,
            persisted: true,
        }
        if (track && typeof track === 'object') {
            terrainAlignmentByTrack.set(track, {
                sourceContent: content,
                provider,
                traceWidthMeters: width,
                result,
                promise: null,
            })
        }
        return result
    }

    if (persisted?.status === 'terrain-mismatch' || persisted?.status === 'source-mismatch') {
        return {
            content,
            diagnostics: [],
            changed: false,
            corrections: [],
            statistics: null,
            cacheKey: `${width.toFixed(3)}`,
            persisted: false,
        }
    }

    const existing = track && typeof track === 'object' ? terrainAlignmentByTrack.get(track) : null
    if (existing?.sourceContent === content && existing.provider === provider && existing.traceWidthMeters === width) {
        return existing.promise ?? existing.result
    }

    const analysisRecord = track && typeof track === 'object' ? terrainAlignmentAnalysisByTrack.get(track) : null
    const analysis = analysisRecord?.sourceContent === content
        && analysisRecord.provider === provider
        && analysisRecord.traceWidthMeters === width
        ? (analysisRecord.promise ?? analysisRecord.analysis)
        : getTrackTerrainAnalysis(track, {provider, traceWidthMeters: width, onProgress})
    const promise = Promise.resolve(analysis)
        .then(value => alignTrackContent(content, {provider, traceWidthMeters: width, onProgress, analysis: value}))
        .catch(() => ({
            content,
            diagnostics: failureDiagnostics(content, 'terrain-unavailable'),
            changed: false,
        }))
        .then(result => ({...result, cacheKey: `${width.toFixed(3)}`}))
    const record = {sourceContent: content, provider, traceWidthMeters: width, result: null, promise}
    if (track && typeof track === 'object') {
        terrainAlignmentByTrack.set(track, record)
    }

    const result = await promise
    record.result = result
    record.promise = null
    return result
}
