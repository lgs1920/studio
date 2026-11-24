/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: startupData.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-20
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const JOURNEY_BATCH_SIZE = 512
const GEOMETRY_BATCH_SIZE = 2048
const POI_BATCH_SIZE = 32

const isObject = value => value !== null && typeof value === 'object'

const decodeMap = value => {
    if (!Array.isArray(value) || !value.some(item => item?.__type === 'Map')) {
        return value
    }

    const map = new Map()
    value.forEach(item => {
        if (item && Object.prototype.hasOwnProperty.call(item, 'key')) {
            map.set(item.key, item.value)
        }
    })
    return map
}

const decodeValue = value => {
    if (Array.isArray(value)) {
        const decoded = decodeMap(value)
        if (decoded !== value) {
            for (const [key, item] of decoded) {
                decoded.set(key, decodeValue(item))
            }
            return decoded
        }
        return value.map(decodeValue)
    }
    if (!isObject(value)) {
        return value
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeValue(item)]))
}

export const decodeStartupJourney = value => decodeValue(value)

const chunk = (items, size) => {
    const result = []
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size))
    }
    return result
}

const trackEntries = (journey, preferredTrackKey = null) => {
    const tracks = journey?.tracks
    const entries = tracks instanceof Map
                    ? [...tracks.entries()]
                    : Array.isArray(tracks)
                      ? tracks
                            .filter(item => item && Object.prototype.hasOwnProperty.call(item, 'key'))
                            .map(item => [item.key, item.value])
                      : Object.entries(tracks ?? {})

    if (preferredTrackKey === null || preferredTrackKey === undefined) {
        return entries
    }

    const preferredIndex = entries.findIndex(([key]) => String(key) === String(preferredTrackKey))
    if (preferredIndex <= 0) {
        return entries
    }

    return [entries[preferredIndex], ...entries.slice(0, preferredIndex), ...entries.slice(preferredIndex + 1)]
}

const geometrySegments = content => {
    const geometry = content?.geometry
    if (!geometry) {
        return []
    }
    if (geometry.type === 'LineString') {
        return [geometry.coordinates ?? []]
    }
    if (geometry.type === 'MultiLineString') {
        return geometry.coordinates ?? []
    }
    return []
}

const journeySummaryProperties = [
    'activity', 'activitySettings', 'camera', 'cameraOrigin', 'country', 'countryCode', 'countries', 'countryCodes',
    'description', 'fixPathCorrectionData', 'fixPathEnabled', 'hasElevation', 'hasTime', 'location', 'panorama',
    'POIsVisible', 'replay', 'renderSmoothing', 'rotation', 'slug', 'title', 'type', 'visible',
]

const trackSummaryProperties = [
    'activity', 'activitySettings', 'color', 'description', 'hasAltitude', 'hasTime', 'id', 'name', 'parent',
    'renderSmoothing', 'renderStyle', 'segments', 'slug', 'thickness', 'title', 'visible',
]

const pickProperties = (value, properties) => properties.reduce((result, property) => {
    if (value?.[property] !== undefined) {
        result[property] = value[property]
    }
    return result
}, {})

const visitCoordinates = (coordinates, visitor) => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
        return
    }

    const longitude = Number(coordinates[0])
    const latitude = Number(coordinates[1])
    if (coordinates.length >= 2
        && Number.isFinite(longitude)
        && Number.isFinite(latitude)
        && !Array.isArray(coordinates[0])) {
        visitor(longitude, latitude)
        return
    }

    coordinates.forEach(item => visitCoordinates(item, visitor))
}

const journeySpatialSummary = journey => {
    let count = 0
    let longitudeSum = 0
    let latitudeSum = 0
    let west = Number.POSITIVE_INFINITY
    let south = Number.POSITIVE_INFINITY
    let east = Number.NEGATIVE_INFINITY
    let north = Number.NEGATIVE_INFINITY

    trackEntries(journey).forEach(([, track]) => {
        const geometry = track?.content?.geometry
        if (!geometry) {
            return
        }

        visitCoordinates(geometry.coordinates, (longitude, latitude) => {
            count++
            longitudeSum += longitude
            latitudeSum += latitude
            west = Math.min(west, longitude)
            south = Math.min(south, latitude)
            east = Math.max(east, longitude)
            north = Math.max(north, latitude)
        })
    })

    if (count === 0) {
        return null
    }

    return {
        bounds:   [west, south, east, north],
        centroid: {
            latitude:  latitudeSum / count,
            longitude: longitudeSum / count,
        },
    }
}

const createJourneySummary = journey => {
    const data = pickProperties(journey, journeySummaryProperties)
    const tracks = trackEntries(journey).map(([key, value]) => {
        const summary = pickProperties(value, trackSummaryProperties)
        summary.color ??= summary.renderStyle?.color
        summary.thickness ??= summary.renderStyle?.farPixelWidth
        return {key, value: summary}
    })
    data.tracks = [...tracks, {__type: 'Map'}]
    return data
}

export const streamStartupObject = async (value, emit, options = {}) => {
    const batchSize = options.batchSize ?? JOURNEY_BATCH_SIZE
    const items = Array.isArray(value) ? value : [value]
    for (const batch of chunk(items, batchSize)) {
        await emit({type: 'array', items: batch})
    }
}

export const streamStartupGeometry = async (content, emit, options = {}) => {
    const batchSize = options.batchSize ?? GEOMETRY_BATCH_SIZE
    const segments = geometrySegments(content)
    if (segments.length === 0 && content?.geometry) {
        await emit({type: 'geometry', geometry: content.geometry})
        return
    }

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex] ?? []
        for (const points of chunk(segment, batchSize)) {
            await emit({
                type:       'geometry',
                segment:    segmentIndex,
                coordinates: points,
            })
        }
    }
}

export const streamStartupJourney = async (value, emit, options = {}) => {
    const journey = decodeStartupJourney(value)
    const entries = trackEntries(journey, options.preferredTrackKey)
    const tracks = {...journey, tracks: undefined}
    delete tracks.tracks

    await emit({
        data:      tracks,
        spatial:   journeySpatialSummary(journey),
        trackKeys: entries.map(([key]) => key),
        type:      'journey',
    })
    for (let index = 0; index < entries.length; index++) {
        const [key, rawTrack] = entries[index]
        const track = decodeStartupJourney(rawTrack)
        const content = track?.content
        const trackWithoutContent = {...track}
        delete trackWithoutContent.content
        const contentMetadata = {...(content ?? {})}
        delete contentMetadata.geometry
        trackWithoutContent.contentMetadata = contentMetadata
        trackWithoutContent.contentProperties = content?.properties ?? {}
        trackWithoutContent.geometryType = content?.geometry?.type ?? 'LineString'
        await emit({type: 'track', key, data: trackWithoutContent})
        await streamStartupGeometry(content, emit, options)
        await emit({type: 'track-end', key})
        await options.onTrackEnd?.({
                                    firstTrack: index === 0,
                                    key,
                                    trackCount: entries.length,
                                })
    }
    await emit({type: 'journey-end'})
}

/**
 * Stream metadata needed to render the journey catalog without transferring route geometry.
 * @param {AsyncIterable<Array<Object>>} values - Journey records read from IndexedDB.
 * @param {Function} emit - Packet emitter.
 * @returns {Promise<void>} Resolves after all summaries have been emitted.
 */
export const streamStartupJourneyCatalog = async (values, emit) => {
    for await (const valueBatch of values) {
        for (const value of valueBatch ?? []) {
            if (!value) {
                continue
            }

            const journey = decodeStartupJourney(value)
            if (!journey?.slug) {
                continue
            }

            await emit({
                data:    createJourneySummary(journey),
                spatial: journeySpatialSummary(journey),
                type:    'journey-summary',
            })
        }
    }
}

/**
 * Match worker POI batches to the selected journey or complete startup inventory.
 * @param {Object|null|undefined} poi - POI record from the startup database.
 * @param {Object} request - Current-journey and worker filtering options.
 * @returns {boolean} Whether the POI belongs in the emitted startup batches.
 */
const shouldIncludePOIForRequest = (poi, request) => {
    if (!poi) {
        return false
    }
    if (!request.currentOnly) {
        return true
    }
    if (poi.type === request.starterType) {
        return request.includeStarter !== false && poi.visible !== false
    }
    if (!poi.parent || poi.parent === request.globalParent) {
        return true
    }
    if (poi.visible === false) {
        return false
    }
    return request.parents?.has?.(poi.parent) ?? request.parents?.includes?.(poi.parent) ?? false
}

export const streamStartupPOIs = async (values, emit, request = {}) => {
    const parents = request.parents instanceof Set ? request.parents : new Set(request.parents ?? [])
    const excluded = request.excluded instanceof Set ? request.excluded : new Set(request.excluded ?? [])
    const poiRequest = {...request, parents, starterType: request.starterType ?? 'starter'}
    const records = []
    const source = values?.[Symbol.asyncIterator]
        ? values
        : (Array.isArray(values) ? [values] : [])

    for await (const valueBatch of source) {
        for (const value of valueBatch ?? []) {
            const poi = decodeStartupJourney(value)
            if (excluded.has(poi?.id)
                || !shouldIncludePOIForRequest(poi, poiRequest)) {
                continue
            }
            records.push(poi)
            if (records.length >= (request.batchSize ?? POI_BATCH_SIZE)) {
                const items = records.splice(0)
                await emit({type: 'pois', items})
                await request.onBatch?.(items)
            }
        }
    }

    if (records.length > 0) {
        const items = records.splice(0)
        await emit({type: 'pois', items})
        await request.onBatch?.(items)
    }

    await request.onComplete?.()
}

export {JOURNEY_BATCH_SIZE, GEOMETRY_BATCH_SIZE, POI_BATCH_SIZE}
