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
 * Last modified: 2026-09-20
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

const trackEntries = journey => {
    const tracks = journey?.tracks
    if (tracks instanceof Map) {
        return [...tracks.entries()]
    }
    if (Array.isArray(tracks)) {
        return tracks
            .filter(item => item && Object.prototype.hasOwnProperty.call(item, 'key'))
            .map(item => [item.key, item.value])
    }
    return Object.entries(tracks ?? {})
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
    const entries = trackEntries(journey)
    const tracks = {...journey, tracks: undefined}
    delete tracks.tracks

    await emit({type: 'journey', data: tracks})
    for (const [key, rawTrack] of entries) {
        const track = decodeStartupJourney(rawTrack)
        const content = track?.content
        const trackWithoutContent = {...track}
        delete trackWithoutContent.content
        trackWithoutContent.contentProperties = content?.properties ?? {}
        trackWithoutContent.geometryType = content?.geometry?.type ?? 'LineString'
        await emit({type: 'track', key, data: trackWithoutContent})
        await streamStartupGeometry(content, emit, options)
        await emit({type: 'track-end', key})
    }
    await emit({type: 'journey-end'})
}

const isVisibleForRequest = (poi, request) => {
    if (!poi || poi.visible === false) {
        return false
    }
    if (poi.type === request.starterType) {
        return request.includeStarter !== false
    }
    if (!request.currentOnly) {
        return true
    }
    return request.parents?.has?.(poi.parent) ?? request.parents?.includes?.(poi.parent) ?? false
}

export const streamStartupPOIs = async (values, emit, request = {}) => {
    const parents = request.parents instanceof Set ? request.parents : new Set(request.parents ?? [])
    const excluded = request.excluded instanceof Set ? request.excluded : new Set(request.excluded ?? [])
    const records = []
    const source = values?.[Symbol.asyncIterator]
        ? values
        : (Array.isArray(values) ? [values] : [])

    for await (const valueBatch of source) {
        for (const value of valueBatch ?? []) {
            const poi = decodeStartupJourney(value)
            if (excluded.has(poi?.id)
                || !isVisibleForRequest(poi, {...request, parents, starterType: request.starterType ?? 'starter'})) {
                continue
            }
            records.push(poi)
            if (records.length >= (request.batchSize ?? POI_BATCH_SIZE)) {
                await emit({type: 'pois', items: records.splice(0)})
            }
        }
    }

    if (records.length > 0) {
        await emit({type: 'pois', items: records})
    }
}

export {JOURNEY_BATCH_SIZE, GEOMETRY_BATCH_SIZE, POI_BATCH_SIZE}
