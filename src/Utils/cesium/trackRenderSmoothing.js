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
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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
 * Limit line geometry coordinates before they are submitted to Cesium.
 *
 * @param {object} geometry - GeoJSON line geometry.
 * @param {number} maxPoints - Maximum number of coordinates to retain.
 * @returns {object} The original or limited geometry.
 */
const limitGeometryPoints = (geometry, maxPoints) => {
    if (!geometry || !Array.isArray(geometry.coordinates)) {
        return geometry
    }

    if (geometry.type === LINE_STRING) {
        const coordinates = sampleCoordinates(geometry.coordinates, maxPoints)
        return coordinates === geometry.coordinates ? geometry : {...geometry, coordinates}
    }

    if (geometry.type !== MULTI_LINE_STRING) {
        return geometry
    }

    const totalPoints = geometry.coordinates.reduce((total, segment) => total + (segment?.length ?? 0), 0)
    if (totalPoints <= maxPoints) {
        return geometry
    }

    const coordinates = geometry.coordinates.map(segment => {
        const segmentLimit = Math.max(2, Math.floor((maxPoints * (segment?.length ?? 0)) / totalPoints))
        return sampleCoordinates(segment, segmentLimit)
    })

    return {...geometry, coordinates}
}

export const normalizeTrackRenderSmoothing = (value = undefined, fallback = TRACK_RENDER_SMOOTHING_DEFAULT) => {
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

export const resolveTrackRenderSmoothing = track => {
    const defaults = defaultTrackRenderSmoothing()
    const journey = getJourneyFromTrack(track)
    const isMultiTrackJourney = (journey?.tracks?.size ?? 0) > 1
    const source = isMultiTrackJourney
                   ? track?.renderSmoothing
                   : (journey?.renderSmoothing ?? track?.renderSmoothing)

    return normalizeTrackRenderSmoothing(source, defaults)
}

const effectiveTrackRenderSmoothing = (track, {forceRenderSmoothing = false, renderSmoothing = undefined} = {}) => {
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
    const bucket = getWeakMapBucket(renderedTrackContentCache, track?.content)
    bucket?.set(`${trackRenderSmoothingKey(track, {renderSmoothing})}:full`, renderContent)
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
    const content = track?.content
    const geometry = content?.geometry
    const forRender = options.forRender === true
    const smoothing = effectiveTrackRenderSmoothing(track, options)

    if ((!smoothing.enabled && !forRender) || !geometry || ![LINE_STRING, MULTI_LINE_STRING].includes(geometry.type)) {
        return content
    }

    const smoothingKey = `${trackRenderSmoothingKey(track, options)}:${forRender ? 'render' : 'full'}`
    const cachedContent = getWeakMapBucket(renderedTrackContentCache, content)?.get(smoothingKey)
    if (cachedContent) {
        return cachedContent
    }

    let renderContent = content
    if (smoothing.enabled) {
        renderContent = deepClone(content)
        renderContent.geometry.coordinates = geometry.type === LINE_STRING
                                             ? smoothCoordinateSegment(geometry.coordinates, smoothing.step)
                                             : (geometry.coordinates ?? [])
                                                 .map(segment => smoothCoordinateSegment(segment, smoothing.step))
    }

    if (forRender) {
        const limitedGeometry = limitGeometryPoints(renderContent.geometry, MAX_RENDER_POINTS)
        if (limitedGeometry !== renderContent.geometry) {
            renderContent = {...renderContent, geometry: limitedGeometry}
        }
    }

    getWeakMapBucket(renderedTrackContentCache, content)?.set(smoothingKey, renderContent)

    return renderContent
}
