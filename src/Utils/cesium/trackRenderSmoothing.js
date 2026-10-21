/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: trackRenderSmoothing.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {getCorrectedTrackContent, getFixPathSourceFingerprint} from './fixPathCorrections'

export const TRACK_RENDER_SMOOTHING_DEFAULT = Object.freeze({
    enabled: false,
    step:    1,
})

export const TRACK_RENDER_SMOOTHING_MIN_STEP = 1
export const TRACK_RENDER_SMOOTHING_MAX_STEP = 6

const LINE_STRING = 'LineString'
const MULTI_LINE_STRING = 'MultiLineString'
const renderedTrackContentCache = new WeakMap()
const MAX_SMOOTHED_SEGMENT_POINTS = 4096

/** Maximum coordinate count submitted to the Cesium rendering path. */
export const MAX_RENDER_POINTS = 4096

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return undefined
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

const normalizeBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') {
        return Boolean(fallback)
    }
    if (typeof value === 'boolean') {
        return value
    }

    return ['true', '1', 'yes', 'on'].includes(`${value}`.toLowerCase())
}

const normalizeStep = (value, fallback = TRACK_RENDER_SMOOTHING_DEFAULT.step) => {
    const number = finiteNumber(value) ?? finiteNumber(fallback) ?? TRACK_RENDER_SMOOTHING_DEFAULT.step

    return Math.min(
        TRACK_RENDER_SMOOTHING_MAX_STEP,
        Math.max(TRACK_RENDER_SMOOTHING_MIN_STEP, Math.round(number)),
    )
}

const cloneCoordinate = coordinate => Array.isArray(coordinate) ? [...coordinate] : coordinate

const deepClone = value => JSON.parse(JSON.stringify(value))

const getWeakMapBucket = (cache, key) => {
    if (!key || (typeof key !== 'object' && typeof key !== 'function')) {
        return null
    }

    let bucket = cache.get(key)
    if (!bucket) {
        bucket = new Map()
        cache.set(key, bucket)
    }

    return bucket
}

const interpolateCoordinate = (start, stop, ratio) => {
    const dimensions = Math.max(2, Math.min(start?.length ?? 0, stop?.length ?? 0))

    return Array.from({length: dimensions}, (_, index) => {
        const startValue = finiteNumber(start?.[index])
        const stopValue = finiteNumber(stop?.[index])

        if (startValue === undefined || stopValue === undefined) {
            return ratio < 0.5 ? start?.[index] : stop?.[index]
        }

        return startValue + ((stopValue - startValue) * ratio)
    })
}

const chaikinPass = segment => {
    if (!Array.isArray(segment) || segment.length < 3) {
        return Array.isArray(segment) ? segment.map(cloneCoordinate) : []
    }

    const result = [cloneCoordinate(segment[0])]

    for (let index = 0; index < segment.length - 1; index++) {
        const start = segment[index]
        const stop = segment[index + 1]

        result.push(interpolateCoordinate(start, stop, 0.25))
        result.push(interpolateCoordinate(start, stop, 0.75))
    }

    result.push(cloneCoordinate(segment[segment.length - 1]))

    return result
}

/**
 * Sample a coordinate sequence uniformly while preserving both endpoints.
 *
 * @param {Array<Array<number>>} coordinates - Coordinate sequence to sample.
 * @param {number} maxPoints - Maximum number of coordinates to retain.
 * @returns {Array<Array<number>>} The original or sampled coordinate sequence.
 */
const sampleCoordinates = (coordinates, maxPoints) => {
    if (!Array.isArray(coordinates) || coordinates.length <= maxPoints) {
        return coordinates
    }

    const lastIndex = coordinates.length - 1
    const step = lastIndex / (maxPoints - 1)

    return Array.from({length: maxPoints}, (_, index) => coordinates[Math.round(index * step)])
}

/**
 * Smooth the route around fixed points while leaving corrected Fix Path sections intact.
 * @param {Array<Array<number>>} coordinates - Corrected source coordinates.
 * @param {number} step - Number of Chaikin passes for each span.
 * @param {Set<number>} anchorIndexes - Source indexes that must remain on the rendered path.
 * @param {Array<{startIndex: number, endIndex: number}>} protectedRanges - Source ranges that must remain exact.
 * @returns {{coordinates: Array<Array<number>>, anchorIndexes: Set<number>}} Render coordinates and preserved vertices.
 */
const smoothCoordinateSegmentAtAnchors = (coordinates, step, anchorIndexes, protectedRanges = []) => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return {coordinates: [], anchorIndexes: new Set()}
    }
    const lastIndex = coordinates.length - 1
    const anchors = new Set([...(anchorIndexes ?? [])].filter(index => (
        Number.isInteger(index) && index >= 0 && index <= lastIndex
    )))
    const ranges = protectedRanges.filter(range => Number.isInteger(range.startIndex)
        && Number.isInteger(range.endIndex)
        && range.startIndex >= 0
        && range.endIndex <= lastIndex
        && range.startIndex <= range.endIndex)
    if (anchors.size === 0 && ranges.length === 0) {
        return {coordinates: smoothCoordinateSegment(coordinates, step), anchorIndexes: new Set()}
    }
    if (coordinates.length === 1) {
        return {coordinates: coordinates.map(cloneCoordinate), anchorIndexes: new Set([0])}
    }

    const boundaries = [...new Set([
        0,
        lastIndex,
        ...anchors,
        ...ranges.flatMap(range => [range.startIndex, range.endIndex]),
    ])].sort((first, second) => first - second)
    const smoothedCoordinates = []
    const preservedIndexes = new Set()
    for (let index = 0; index < boundaries.length - 1; index += 1) {
        const startIndex = boundaries[index]
        const stopIndex = boundaries[index + 1]
        const isProtectedSpan = ranges.some(range => startIndex >= range.startIndex && stopIndex <= range.endIndex)
        const smoothedSpan = isProtectedSpan
            ? coordinates.slice(startIndex, stopIndex + 1).map(cloneCoordinate)
            : smoothCoordinateSegment(coordinates.slice(startIndex, stopIndex + 1), step)
        const outputStartIndex = smoothedCoordinates.length === 0 ? 0 : smoothedCoordinates.length - 1
        smoothedCoordinates.push(...(smoothedCoordinates.length === 0 ? smoothedSpan : smoothedSpan.slice(1)))
        if (isProtectedSpan) {
            for (let offset = 0; offset < smoothedSpan.length; offset += 1) {
                preservedIndexes.add(outputStartIndex + offset)
            }
        }
        if (anchors.has(startIndex)) preservedIndexes.add(outputStartIndex)
        if (anchors.has(stopIndex)) preservedIndexes.add(smoothedCoordinates.length - 1)
    }

    return {coordinates: smoothedCoordinates, anchorIndexes: preservedIndexes}
}

/**
 * Keep required vertices while sampling long rendered geometries.
 * @param {Array<Array<number>>} coordinates - Coordinates to sample.
 * @param {number} maxPoints - Target maximum coordinate count.
 * @param {Set<number>} preservedIndexes - Vertex indexes that must be retained.
 * @returns {Array<Array<number>>} Sampled coordinates containing every required vertex.
 */
const sampleCoordinatesPreservingIndexes = (coordinates, maxPoints, preservedIndexes = new Set()) => {
    if (!Array.isArray(coordinates) || coordinates.length <= maxPoints) {
        return coordinates
    }
    if (preservedIndexes.size === 0) {
        return sampleCoordinates(coordinates, maxPoints)
    }

    const lastIndex = coordinates.length - 1
    const required = new Set([0, lastIndex, ...preservedIndexes].filter(index => (
        Number.isInteger(index) && index >= 0 && index <= lastIndex
    )))
    const candidateCount = coordinates.length - required.size
    const sampleCount = Math.max(0, Math.max(maxPoints, required.size) - required.size)
    if (sampleCount > 0) {
        let sampledCount = 0
        let candidateIndex = 0
        let nextCandidateIndex = sampleCount === 1
            ? Math.floor((candidateCount - 1) / 2)
            : 0
        for (let index = 0; index < coordinates.length && sampledCount < sampleCount; index += 1) {
            if (required.has(index)) continue
            if (candidateIndex === nextCandidateIndex) {
                required.add(index)
                sampledCount += 1
                if (sampledCount < sampleCount) {
                    nextCandidateIndex = Math.round(sampledCount * (candidateCount - 1) / (sampleCount - 1))
                }
            }
            candidateIndex += 1
        }
    }

    return [...required].sort((first, second) => first - second).map(index => coordinates[index])
}

/**
 * Limit line geometry coordinates before they are submitted to Cesium.
 *
 * @param {object} geometry - GeoJSON line geometry.
 * @param {number} maxPoints - Maximum number of coordinates to retain.
 * @returns {object} The original or limited geometry.
 */
const limitGeometryPoints = (geometry, maxPoints, preservedIndexesBySegment = new Map()) => {
    if (!geometry || !Array.isArray(geometry.coordinates)) {
        return geometry
    }

    if (geometry.type === LINE_STRING) {
        const coordinates = sampleCoordinatesPreservingIndexes(
            geometry.coordinates,
            maxPoints,
            preservedIndexesBySegment.get(0),
        )
        return coordinates === geometry.coordinates ? geometry : {...geometry, coordinates}
    }

    if (geometry.type !== MULTI_LINE_STRING) {
        return geometry
    }

    const totalPoints = geometry.coordinates.reduce((total, segment) => total + (segment?.length ?? 0), 0)
    if (totalPoints <= maxPoints) {
        return geometry
    }

    const coordinates = geometry.coordinates.map((segment, segmentIndex) => {
        const preservedIndexes = preservedIndexesBySegment.get(segmentIndex) ?? new Set()
        const segmentLimit = Math.max(
            2,
            preservedIndexes.size,
            Math.floor((maxPoints * (segment?.length ?? 0)) / totalPoints),
        )
        return sampleCoordinatesPreservingIndexes(segment, segmentLimit, preservedIndexes)
    })

    return {...geometry, coordinates}
}

export const normalizeTrackRenderSmoothing = (value, fallback = TRACK_RENDER_SMOOTHING_DEFAULT) => {
    const fallbackSettings = {
        ...TRACK_RENDER_SMOOTHING_DEFAULT,
        ...(fallback ?? {}),
    }
    const settings = value ?? fallbackSettings

    return {
        enabled: normalizeBoolean(settings.enabled, fallbackSettings.enabled),
        step:    normalizeStep(settings.step, fallbackSettings.step),
    }
}

export const defaultTrackRenderSmoothing = () => normalizeTrackRenderSmoothing(
    globalThis.lgs?.settings?.getJourney?.renderSmoothing,
    TRACK_RENDER_SMOOTHING_DEFAULT,
)

const getJourneyFromTrack = track => {
    const editorJourney = globalThis.lgs?.theJourneyEditorProxy?.journey
    if (editorJourney?.slug && editorJourney.slug === track?.parent) {
        return editorJourney
    }

    return globalThis.lgs?.getJourneyBySlug?.(track?.parent)
}

/**
 * Find valid corrected route ranges whose samples must stay visible in Cesium.
 * @param {object} track - Track whose corrected path is rendered.
 * @param {object} geometry - Corrected geometry currently being rendered.
 * @param {boolean} includeDraftCorrections - Whether an explicit display override is active.
 * @returns {Map<number, Array<{startIndex: number, endIndex: number}>>} Protected source ranges by segment.
 */
const getProtectedFixPathRangesBySegment = (track, geometry, includeDraftCorrections = false) => {
    const journey = track?.parent && typeof track.parent === 'object'
        ? track.parent
        : getJourneyFromTrack(track)
    if (journey?.fixPathEnabled !== true && !includeDraftCorrections) return new Map()

    const corrections = journey.fixPathCorrectionData?.tracks?.[track?.slug]
    if (!Array.isArray(corrections)) return new Map()
    const sourceGeometry = track?.content?.geometry
    const rangesBySegment = new Map()
    corrections.forEach(correction => {
        const {segmentIndex, startIndex, endIndex, controlPoints} = correction
        if (!Number.isInteger(segmentIndex)
            || !Number.isInteger(startIndex)
            || !Number.isInteger(endIndex)
            || startIndex < 0
            || endIndex < startIndex
            || !Array.isArray(controlPoints)
            || getFixPathSourceFingerprint(track?.content, segmentIndex, startIndex, endIndex)
                !== correction.sourceFingerprint) {
            return
        }

        const sourceSegment = sourceGeometry?.type === LINE_STRING
            ? sourceGeometry.coordinates
            : sourceGeometry?.type === MULTI_LINE_STRING
                ? sourceGeometry.coordinates?.[segmentIndex]
                : null
        const renderedSegment = geometry?.type === LINE_STRING
            ? geometry.coordinates
            : geometry?.type === MULTI_LINE_STRING
                ? geometry.coordinates?.[segmentIndex]
                : null
        if (!Array.isArray(sourceSegment)
            || !Array.isArray(renderedSegment)
            || endIndex >= sourceSegment.length
            || endIndex >= renderedSegment.length) {
            return
        }

        const hasEffectiveAnchor = controlPoints.some(point => {
            if (point.fixed === false || point.removed === true) return false
            const match = /^fix-point-(\d+)-(\d+)$/.exec(point.id ?? '')
            const sourceIndex = Number.isInteger(point.sourceIndex)
                ? point.sourceIndex
                : match && Number(match[1]) === segmentIndex
                    ? Number(match[2])
                    : null
            if (sourceIndex === null) return true
            const originalCoordinate = sourceSegment[sourceIndex]
            return Array.isArray(originalCoordinate)
                && Array.isArray(point.coordinate)
                && point.coordinate.slice(0, 3).some((value, coordinateIndex) => (
                    Number(value) !== Number(originalCoordinate[coordinateIndex])
                ))
        })
        if (!hasEffectiveAnchor) return

        const ranges = rangesBySegment.get(segmentIndex) ?? []
        ranges.push({startIndex, endIndex})
        rangesBySegment.set(segmentIndex, ranges)
    })

    rangesBySegment.forEach((ranges, segmentIndex) => {
        const mergedRanges = []
        ranges.sort((first, second) => first.startIndex - second.startIndex).forEach(range => {
            const previous = mergedRanges.at(-1)
            if (previous && range.startIndex <= previous.endIndex + 1) {
                previous.endIndex = Math.max(previous.endIndex, range.endIndex)
            }
            else {
                mergedRanges.push({...range})
            }
        })
        rangesBySegment.set(segmentIndex, mergedRanges)
    })

    return rangesBySegment
}

const addProtectedRangesToIndexes = (rangesBySegment, indexesBySegment) => {
    const result = new Map([...indexesBySegment].map(([segmentIndex, indexes]) => (
        [segmentIndex, new Set(indexes)]
    )))
    rangesBySegment.forEach((ranges, segmentIndex) => {
        const indexes = result.get(segmentIndex) ?? new Set()
        ranges.forEach(({startIndex, endIndex}) => {
            for (let index = startIndex; index <= endIndex; index += 1) {
                indexes.add(index)
            }
        })
        result.set(segmentIndex, indexes)
    })
    return result
}

/**
 * Find fixed source vertices in the active Journey corrections.
 * @param {object} track - Track whose corrected path is rendered.
 * @returns {Map<number, Set<number>>} Fixed source indexes keyed by geometry segment.
 */
const getFixedSourceIndexesBySegment = (track, geometry, includeDraftCorrections = false) => {
    const journey = track?.parent && typeof track.parent === 'object'
        ? track.parent
        : getJourneyFromTrack(track)
    if (journey?.fixPathEnabled !== true && !includeDraftCorrections) return new Map()

    const corrections = journey.fixPathCorrectionData?.tracks?.[track?.slug]
    if (!Array.isArray(corrections)) return new Map()
    const indexesBySegment = new Map()
    corrections.forEach(correction => {
        if (!Number.isInteger(correction.segmentIndex) || !Array.isArray(correction.controlPoints)) return
        correction.controlPoints.forEach(point => {
            if (point.fixed === false || point.removed === true) return
            const match = /^fix-point-(\d+)-(\d+)$/.exec(point.id ?? '')
            const sourceIndex = Number.isInteger(point.sourceIndex)
                ? point.sourceIndex
                : match && Number(match[1]) === correction.segmentIndex
                    ? Number(match[2])
                    : null
            const sourceSegment = geometry?.type === LINE_STRING
                ? geometry.coordinates
                : geometry?.coordinates?.[correction.segmentIndex]
            const renderedCoordinate = sourceSegment?.[sourceIndex]
            const sourceGeometry = track?.content?.geometry
            const sourceSegmentCoordinates = sourceGeometry?.type === LINE_STRING
                ? sourceGeometry.coordinates
                : sourceGeometry?.coordinates?.[correction.segmentIndex]
            const originalCoordinate = sourceSegmentCoordinates?.[sourceIndex]
            const pointCoordinate = point.coordinate
            const matchingDimensions = Array.isArray(pointCoordinate)
                ? Math.min(3, pointCoordinate.length)
                : 0
            if (!Number.isInteger(sourceIndex)
                || sourceIndex < correction.startIndex
                || sourceIndex > correction.endIndex
                || !Array.isArray(renderedCoordinate)
                || matchingDimensions < 2
                || !pointCoordinate.slice(0, matchingDimensions).every((value, coordinateIndex) => (
                    Number(value) === Number(renderedCoordinate[coordinateIndex])
                ))
                || !Array.isArray(originalCoordinate)
                || !pointCoordinate.slice(0, matchingDimensions).some((value, coordinateIndex) => (
                    Number(value) !== Number(originalCoordinate[coordinateIndex])
                ))) return
            const indexes = indexesBySegment.get(correction.segmentIndex) ?? new Set()
            indexes.add(sourceIndex)
            indexesBySegment.set(correction.segmentIndex, indexes)
        })
    })
    return indexesBySegment
}

/**
 * Create a stable cache suffix for fixed path vertices and their rendered coordinates.
 * @param {object} geometry - Track geometry used by the renderer.
 * @param {Map<number, Set<number>>} indexesBySegment - Preserved source indexes.
 * @returns {string} Stable anchor signature for rendered geometry caching.
 */
const fixedAnchorCacheKey = (geometry, indexesBySegment) => [...indexesBySegment.entries()]
    .map(([segmentIndex, indexes]) => {
        const coordinates = geometry?.type === LINE_STRING
            ? geometry.coordinates
            : geometry?.coordinates?.[segmentIndex]
        return segmentIndex + ':' + [...indexes]
            .sort((first, second) => first - second)
            .map(index => index + '=' + (coordinates?.[index] ?? []).join(','))
            .join(';')
    })
    .join('|')

/**
 * Build the cache key for rendered track content.
 * @param {object} track - Track whose render settings apply.
 * @param {object} options - Effective smoothing options.
 * @param {boolean} forRender - Whether point limits apply.
 * @param {object} geometry - Geometry used by the rendering path.
 * @param {Map<number, Set<number>>} indexesBySegment - Preserved source indexes.
 * @returns {string} Cache key for rendered content.
 */
const getRenderedContentCacheKey = (track, options, forRender, geometry, indexesBySegment) => {
    const baseKey = `${trackRenderSmoothingKey(track, options)}:${forRender ? 'render' : 'full'}`
    const anchorKey = fixedAnchorCacheKey(geometry, indexesBySegment)
    return anchorKey ? `${baseKey}:${anchorKey}` : baseKey
}

export const resolveTrackRenderSmoothing = track => {
    const defaults = defaultTrackRenderSmoothing()
    const journey = getJourneyFromTrack(track)
    const isMultiTrackJourney = (journey?.tracks?.size ?? 0) > 1
    const source = isMultiTrackJourney
                   ? track?.renderSmoothing
                   : (journey?.renderSmoothing ?? track?.renderSmoothing)

    return normalizeTrackRenderSmoothing(source, defaults)
}

const effectiveTrackRenderSmoothing = (track, {forceRenderSmoothing = false, renderSmoothing} = {}) => {
    const smoothing = renderSmoothing === undefined
                      ? resolveTrackRenderSmoothing(track)
                      : normalizeTrackRenderSmoothing(renderSmoothing, resolveTrackRenderSmoothing(track))

    return forceRenderSmoothing === true
           ? {...smoothing, enabled: true}
           : smoothing
}

export const trackRenderSmoothingKey = (track, options = {}) => {
    const smoothing = effectiveTrackRenderSmoothing(track, options)

    return `${smoothing.enabled ? 1 : 0}:${smoothing.step}`
}

export const cachePreparedTrackRenderContent = (track, renderContent, renderSmoothing) => {
    const content = getCorrectedTrackContent(track)
    const bucket = getWeakMapBucket(renderedTrackContentCache, content)
    const indexesBySegment = getFixedSourceIndexesBySegment(track, content?.geometry)
    bucket?.set(getRenderedContentCacheKey(
        track,
        {renderSmoothing},
        false,
        content?.geometry,
        indexesBySegment,
    ), renderContent)
}

export const smoothCoordinateSegment = (coordinates, step) => {
    let result = Array.isArray(coordinates) ? coordinates.map(cloneCoordinate) : []

    for (let index = 0; index < step; index++) {
        const projectedLength = ((result.length - 1) * 2) + 1
        if (projectedLength > MAX_SMOOTHED_SEGMENT_POINTS) {
            break
        }
        result = chaikinPass(result)
    }

    return result
}

export const getTrackRenderContent = (track, options = {}) => {
    const content = options.content ?? getCorrectedTrackContent(track)
    const geometry = content?.geometry
    const forRender = options.forRender === true
    const smoothing = effectiveTrackRenderSmoothing(track, options)

    if ((!smoothing.enabled && !forRender) || !geometry || ![LINE_STRING, MULTI_LINE_STRING].includes(geometry.type)) {
        return content
    }

    const fixedIndexesBySegment = getFixedSourceIndexesBySegment(
        track,
        geometry,
        options.content !== undefined,
    )
    const protectedRangesBySegment = getProtectedFixPathRangesBySegment(
        track,
        geometry,
        options.content !== undefined,
    )
    const smoothingKey = getRenderedContentCacheKey(
        track,
        options,
        forRender,
        geometry,
        fixedIndexesBySegment,
    )
    const cachedContent = getWeakMapBucket(renderedTrackContentCache, content)?.get(smoothingKey)
    if (cachedContent) {
        return cachedContent
    }

    let renderContent = content
    let preservedIndexesBySegment = addProtectedRangesToIndexes(protectedRangesBySegment, fixedIndexesBySegment)
    if (smoothing.enabled) {
        renderContent = deepClone(content)
        if (geometry.type === LINE_STRING) {
            const smoothed = smoothCoordinateSegmentAtAnchors(
                geometry.coordinates,
                smoothing.step,
                fixedIndexesBySegment.get(0) ?? new Set(),
                protectedRangesBySegment.get(0) ?? [],
            )
            renderContent.geometry.coordinates = smoothed.coordinates
            preservedIndexesBySegment = new Map([[0, smoothed.anchorIndexes]])
        }
        else {
            preservedIndexesBySegment = new Map()
            renderContent.geometry.coordinates = (geometry.coordinates ?? []).map((segment, segmentIndex) => {
                const smoothed = smoothCoordinateSegmentAtAnchors(
                    segment,
                    smoothing.step,
                    fixedIndexesBySegment.get(segmentIndex) ?? new Set(),
                    protectedRangesBySegment.get(segmentIndex) ?? [],
                )
                preservedIndexesBySegment.set(segmentIndex, smoothed.anchorIndexes)
                return smoothed.coordinates
            })
        }
    }

    if (forRender) {
        const limitedGeometry = limitGeometryPoints(
            renderContent.geometry,
            MAX_RENDER_POINTS,
            preservedIndexesBySegment,
        )
        if (limitedGeometry !== renderContent.geometry) {
            renderContent = {...renderContent, geometry: limitedGeometry}
        }
    }

    getWeakMapBucket(renderedTrackContentCache, content)?.set(smoothingKey, renderContent)

    return renderContent
}
