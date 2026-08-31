/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayLogicalTrackPath.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-07-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Renderer-independent track-path preparation for replay.
 */

export const TRACK_LOGICAL_SMOOTHING_DEFAULT = Object.freeze({
    enabled: false,
    step:    1,
})

const LINE_STRING = 'LineString'
const MULTI_LINE_STRING = 'MultiLineString'
const MAX_SMOOTHED_SEGMENT_POINTS = 4096
const logicalTrackContentCache = new WeakMap()

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

const normalizeStep = (value, fallback = TRACK_LOGICAL_SMOOTHING_DEFAULT.step) => {
    const number = finiteNumber(value) ?? finiteNumber(fallback) ?? TRACK_LOGICAL_SMOOTHING_DEFAULT.step
    return Math.min(6, Math.max(1, Math.round(number)))
}

const cloneCoordinate = coordinate => Array.isArray(coordinate) ? [...coordinate] : coordinate

const deepClone = value => JSON.parse(JSON.stringify(value))

const journeyForTrack = track => {
    const editorJourney = globalThis.lgs?.theJourneyEditorProxy?.journey
    if (editorJourney?.slug && editorJourney.slug === track?.parent) {
        return editorJourney
    }

    return globalThis.lgs?.getJourneyBySlug?.(track?.parent)
}

const resolveSmoothing = (track, options = {}) => {
    const journey = journeyForTrack(track)
    const defaults = {
        ...TRACK_LOGICAL_SMOOTHING_DEFAULT,
        ...(globalThis.lgs?.settings?.getJourney?.renderSmoothing ?? {}),
    }
    const isMultiTrackJourney = (journey?.tracks?.size ?? 0) > 1
    const source = isMultiTrackJourney
                   ? track?.renderSmoothing
                   : (journey?.renderSmoothing ?? track?.renderSmoothing)
    const configured = options.renderSmoothing ?? source ?? defaults
    const smoothing = {
        enabled: normalizeBoolean(configured?.enabled, defaults.enabled),
        step:    normalizeStep(configured?.step, defaults.step),
    }

    return options.forceRenderSmoothing === true
           ? {...smoothing, enabled: true}
           : smoothing
}

const smoothingKey = (track, options = {}) => {
    const smoothing = resolveSmoothing(track, options)
    return `${smoothing.enabled ? 1 : 0}:${smoothing.step}`
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

const smoothCoordinateSegment = (coordinates, step) => {
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

const rawGeometry = track => track?.content?.geometry

const geometrySegments = geometry => {
    if (geometry?.type === LINE_STRING && Array.isArray(geometry.coordinates)) {
        return [geometry.coordinates]
    }
    if (geometry?.type === MULTI_LINE_STRING && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates.filter(Array.isArray)
    }
    return []
}

/**
 * Resolve logical coordinates without using Cesium render content.
 *
 * @param {Object} track - Track containing GeoJSON geometry.
 * @param {Object} options - Optional logical smoothing settings.
 * @returns {Array<Array>} Logical coordinate segments.
 */
export const logicalCoordinateSegmentsFromTrack = (track, options = {}) => {
    const geometry = rawGeometry(track)
    const segments = geometrySegments(geometry)
    if (segments.length === 0) {
        return []
    }

    const smoothing = resolveSmoothing(track, options)
    if (!smoothing.enabled) {
        return segments
    }

    const cacheKey = smoothingKey(track, options)
    const content = track?.content
    let cache = content ? logicalTrackContentCache.get(content) : null
    if (!cache && content) {
        cache = new Map()
        logicalTrackContentCache.set(content, cache)
    }
    const cached = cache?.get(cacheKey)
    if (cached) {
        return cached
    }

    const smoothed = segments.map(segment => smoothCoordinateSegment(segment, smoothing.step))
    cache?.set(cacheKey, smoothed)
    return smoothed
}

/**
 * Return a cloned logical track content object for consumers that need a
 * geometry payload while remaining independent from renderer adapters.
 *
 * @param {Object} track - Track containing GeoJSON geometry.
 * @param {Object} options - Optional logical smoothing settings.
 * @returns {Object|null} Logical track content.
 */
export const logicalTrackContent = (track, options = {}) => {
    const content = track?.content
    const geometry = rawGeometry(track)
    if (!content || !geometry) {
        return content ?? null
    }

    const segments = logicalCoordinateSegmentsFromTrack(track, options)
    const cloned = deepClone(content)
    cloned.geometry.coordinates = geometry.type === LINE_STRING
                                   ? segments[0] ?? []
                                   : segments
    return cloned
}

/**
 * Resolve the renderer-independent path for the selected journey tracks.
 *
 * @param {Object|null} journey - Journey containing track definitions.
 * @param {Object} options - Track selection and smoothing options.
 * @returns {Array<Object>} Logical track path entries.
 */
export const logicalTrackPathFromJourney = (journey, {
                                                scope = 'all-tracks',
                                                trackSlug = null,
                                                includeHiddenTracks = false,
                                                ...options
                                            } = {}) => {
    const tracks = Array.from(journey?.tracks?.values?.() ?? [])
        .map((track, trackIndex) => ({track, trackIndex}))
        .filter(({track}) => {
            if (scope === 'current-track') {
                return track?.slug === (trackSlug ?? globalThis.lgs?.theTrack?.slug)
            }

            return scope === 'all-tracks' || includeHiddenTracks || track?.visible !== false
        })

    return tracks.map(({track, trackIndex}) => ({
        trackSlug: track?.slug ?? null,
        trackIndex,
        segments: logicalCoordinateSegmentsFromTrack(track, options),
    }))
}
