/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: journeyData.js
 *
 ******************************************************************************/

import {
    POI_FLAG_START,
    POI_FLAG_STOP,
} from '@Core/constants'
import {
    getExportableJourneyPOIs,
} from '@Utils/JourneyGpxUtils'
import { ELEVATION_UNITS } from '@Utils/UnitUtils'
import { COORDINATE_MATCH_TOLERANCE } from './constants'
import {
    finiteNumber,
    formatCoordinate,
    formatMetric,
    normalizeColor,
    parseCssColor,
    plainText,
} from './format'

export const REPORT_RENDER_TRACK_POINT_LIMIT = 5200

export const coordinateFromPOI = poi => {
    const longitude = finiteNumber(poi?.longitude)
    const latitude = finiteNumber(poi?.latitude)

    return longitude === null || latitude === null ? null : {longitude, latitude}
}

export const coordinatesMatch = (first, second) => {
    const firstPoint = coordinateFromPOI(first) ?? first
    const secondPoint = coordinateFromPOI(second) ?? second

    return Number.isFinite(firstPoint?.longitude)
           && Number.isFinite(firstPoint?.latitude)
           && Number.isFinite(secondPoint?.longitude)
           && Number.isFinite(secondPoint?.latitude)
           && Math.abs(firstPoint.longitude - secondPoint.longitude) <= COORDINATE_MATCH_TOLERANCE
           && Math.abs(firstPoint.latitude - secondPoint.latitude) <= COORDINATE_MATCH_TOLERANCE
}

export const coordinateFromArray = coordinates => {
    const longitude = finiteNumber(coordinates?.[0])
    const latitude = finiteNumber(coordinates?.[1])
    const altitude = finiteNumber(coordinates?.[2])
    if (longitude === null || latitude === null) {
        return null
    }

    return altitude === null ? {longitude, latitude} : {longitude, latitude, altitude}
}

export const segmentExtremaIndices = segment => {
    const extrema = {
        minLongitude: {value: Infinity, index: 0},
        maxLongitude: {value: -Infinity, index: 0},
        minLatitude:  {value: Infinity, index: 0},
        maxLatitude:  {value: -Infinity, index: 0},
    }

    segment.forEach((coordinates, index) => {
        const longitude = finiteNumber(coordinates?.[0])
        const latitude = finiteNumber(coordinates?.[1])
        if (longitude !== null) {
            if (longitude < extrema.minLongitude.value) {
                extrema.minLongitude = {value: longitude, index}
            }
            if (longitude > extrema.maxLongitude.value) {
                extrema.maxLongitude = {value: longitude, index}
            }
        }
        if (latitude !== null) {
            if (latitude < extrema.minLatitude.value) {
                extrema.minLatitude = {value: latitude, index}
            }
            if (latitude > extrema.maxLatitude.value) {
                extrema.maxLatitude = {value: latitude, index}
            }
        }
    })

    return Object.values(extrema).map(item => item.index)
}

export const sampledSegmentIndices = (segment, maxPoints = Infinity) => {
    const length = segment?.length ?? 0
    const pointLimit = Number.isFinite(maxPoints) ? Math.max(2, Math.floor(maxPoints)) : length
    if (length <= pointLimit) {
        return Array.from({length}, (_, index) => index)
    }

    const indices = new Set([0, length - 1])
    const step = (length - 1) / Math.max(pointLimit - 1, 1)
    for (let index = 1; index < pointLimit - 1; index++) {
        indices.add(Math.round(index * step))
    }
    segmentExtremaIndices(segment).forEach(index => indices.add(index))

    return Array.from(indices).sort((first, second) => first - second)
}

export const getTrackSegments = (track, {maxTotalPoints = Infinity} = {}) => {
    const geometry = track?.content?.geometry
    if (!geometry) {
        return []
    }

    const segments = geometry.type === 'LineString'
                     ? [geometry.coordinates]
                     : geometry.type === 'MultiLineString'
                       ? geometry.coordinates
                       : []
    const sourcePointCount = segments.reduce((count, segment) => count + (Array.isArray(segment) ? segment.length : 0), 0)
    const pointScale = Number.isFinite(maxTotalPoints) && maxTotalPoints > 0 && sourcePointCount > maxTotalPoints
                       ? maxTotalPoints / sourcePointCount
                       : 1

    return segments
        .map(segment => {
            if (!Array.isArray(segment)) {
                return []
            }

            const maxSegmentPoints = pointScale < 1 ? Math.ceil(segment.length * pointScale) : segment.length
            return sampledSegmentIndices(segment, maxSegmentPoints)
                .map(index => coordinateFromArray(segment[index]))
                .filter(Boolean)
        })
        .filter(segment => segment.length > 1)
}

export const getJourneyTrackDrawings = (journey, options = {}) => Array.from(journey?.tracks?.values?.() ?? [])
    .map(track => ({
        track,
        color:    parseCssColor(track?.renderStyle?.color ?? track?.color),
        segments: getTrackSegments(track, options),
    }))
    .filter(item => item.segments.length > 0)

export const getPOIById = id => {
    if (!id) {
        return null
    }

    const poiList = globalThis.__?.ui?.poiManager?.list ?? globalThis.lgs?.stores?.main?.components?.pois?.list
    return poiList?.get?.(id) ?? null
}

export const valuesFromPOISource = source => {
    if (!source) {
        return []
    }
    if (Array.isArray(source)) {
        return source
    }
    if (typeof source.values === 'function') {
        return Array.from(source.values())
    }
    if (typeof source[Symbol.iterator] === 'function') {
        return Array.from(source).map(item => Array.isArray(item) && item.length > 1 ? item[1] : item)
    }

    return []
}

export const getPOIValues = pois => {
    const list = pois ?? globalThis.__?.ui?.poiManager?.list ?? globalThis.lgs?.stores?.main?.components?.pois?.list
    return valuesFromPOISource(list)
}

export const getAssociatedJourneyPOIs = (journey, pois = undefined) => {
    if (!journey) {
        return []
    }

    const trackSlugs = new Set(Array.from(journey.tracks?.keys?.() ?? []))
    return getPOIValues(pois).filter(poi => {
        const parent = poi?.parent ?? null
        const associated = parent === journey.slug
            || trackSlugs.has(parent)
            || (parent ? globalThis.lgs?.getJourneyByTrackSlug?.(parent)?.slug === journey.slug : false)

        return associated && coordinateFromPOI(poi)
    })
}

export const poiIdentity = poi => {
    if (poi?.id) {
        return `id:${poi.id}`
    }

    const point = coordinateFromPOI(poi)
    return point
           ? `coord:${poi?.type ?? poi?.category ?? 'poi'}:${point.latitude}:${point.longitude}`
           : null
}

export const poiRole = poi => {
    const type = poi?.type ?? poi?.category
    if (type === POI_FLAG_START || poi?.label === 'S') {
        return 'Start'
    }
    if (type === POI_FLAG_STOP || poi?.label === 'E') {
        return 'End'
    }
    return ''
}

export const formatPOIName = poi => {
    const role = poiRole(poi)
    const title = plainText(poi?.title || poi?.name || role || 'POI')
    if (role) {
        return title.toLowerCase() === role.toLowerCase() ? role : `${role} - ${title}`
    }

    return title
}

export const formatPOIBadge = poi => {
    if (poi?.label) {
        return poi.label
    }

    const role = poiRole(poi)
    if (role === 'Start') {
        return 'S'
    }
    if (role === 'End') {
        return 'E'
    }

    return poi?.pdfNumber ? `${poi.pdfNumber}` : ''
}

export const getPOIBadgeColor = poi => {
    const role = poiRole(poi)
    const fallback = role === 'Start'
                     ? parseCssColor(globalThis.lgs?.settings?.journey?.pois?.start?.color, [42, 136, 89])
                     : role === 'End'
                       ? parseCssColor(globalThis.lgs?.settings?.journey?.pois?.stop?.color, [200, 74, 58])
                       : [34, 91, 155]

    return normalizeColor(poi?.bgColor ?? poi?.color, fallback)
}

export const endpointCandidateScore = (poi, role) => {
    const candidateRole = poiRole(poi)
    const hasDescription = plainText(poi?.description).length > 0
    const hasTitle = plainText(poi?.title || poi?.name).length > 0

    return (hasDescription ? 40 : 0)
           + (!candidateRole ? 20 : 0)
           + (hasTitle ? 2 : 0)
           + (candidateRole === role ? 1 : 0)
}

export const findEndpointPOI = ({point, role, associatedPois}) => {
    if (!point) {
        return null
    }

    return associatedPois
        .filter(poi => coordinatesMatch(poi, point))
        .map((poi, index) => ({
            poi,
            index,
            score: endpointCandidateScore(poi, role),
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.poi ?? null
}

export const isPOIRepresentedByEndpoint = (poi, endpointMarkers) => endpointMarkers.some(marker => (
    marker.__pdfEndpointMatched && coordinatesMatch(poi, marker)
))

export const formatPOICoordinates = poi => {
    const point = coordinateFromPOI(poi)
    return point ? `${formatCoordinate(point.latitude)}, ${formatCoordinate(point.longitude)}` : ''
}

export const formatPOIAltitude = poi => {
    const altitude = finiteNumber(poi?.height) ?? finiteNumber(poi?.simulatedHeight)
    return altitude === null ? '' : formatMetric(altitude, {units: ELEVATION_UNITS, format: '%d'})
}

export const getFirstPoint = trackDrawing => trackDrawing?.segments?.[0]?.[0] ?? null

export const getLastPoint = trackDrawing => {
    const segments = trackDrawing?.segments ?? []
    const lastSegment = segments[segments.length - 1]
    return lastSegment?.[lastSegment.length - 1] ?? null
}

export const getJourneyEndpointMarkers = (journey, trackDrawings, associatedPois = []) => {
    const firstDrawing = trackDrawings[0]
    const lastDrawing = trackDrawings[trackDrawings.length - 1]
    const startPOI = getPOIById(firstDrawing?.track?.flags?.start)
    const stopPOI = getPOIById(lastDrawing?.track?.flags?.stop)
    const startPoint = coordinateFromPOI(startPOI) ?? getFirstPoint(firstDrawing)
    const stopPoint = coordinateFromPOI(stopPOI) ?? getLastPoint(lastDrawing)
    const startMatch = findEndpointPOI({point: startPoint, role: 'Start', associatedPois}) ?? startPOI
    const stopMatch = findEndpointPOI({point: stopPoint, role: 'End', associatedPois}) ?? stopPOI
    const startColor = parseCssColor(
        startPOI?.bgColor ?? startPOI?.color ?? globalThis.lgs?.settings?.journey?.pois?.start?.color,
        [42, 136, 89],
    )
    const stopColor = parseCssColor(
        stopPOI?.bgColor ?? stopPOI?.color ?? globalThis.lgs?.settings?.journey?.pois?.stop?.color,
        [200, 74, 58],
    )

    return [
        startPoint
        ? {
                ...(startMatch ?? {}),
                ...startPoint,
                id:                   startMatch?.id ?? `${firstDrawing?.track?.slug ?? journey?.slug ?? 'journey'}:start`,
                type:                 POI_FLAG_START,
                label:                'S',
                title:                startMatch?.title || startMatch?.name || 'Start',
                color:                startColor,
                bgColor:              undefined,
                __pdfEndpointMatched: Boolean(startMatch),
            }
        : null,
        stopPoint
        ? {
                ...(stopMatch ?? {}),
                ...stopPoint,
                id:                   stopMatch?.id ?? `${lastDrawing?.track?.slug ?? journey?.slug ?? 'journey'}:end`,
                type:                 POI_FLAG_STOP,
                label:                'E',
                title:                stopMatch?.title || stopMatch?.name || 'End',
                color:                stopColor,
                bgColor:              undefined,
                __pdfEndpointMatched: Boolean(stopMatch),
            }
        : null,
    ].filter(Boolean)
}

export const getNumberedPOIs = pois => pois
    .map((poi, index) => ({
        ...poi,
        pdfNumber: index + 1,
    }))
    .filter(poi => coordinateFromPOI(poi))

export const getListedJourneyPOIs = ({associatedPois, endpointMarkers, exportablePois}) => {
    const numberByIdentity = new Map(
        exportablePois.map(poi => [poiIdentity(poi), poi.pdfNumber]).filter(([identity]) => identity),
    )
    const byIdentity = new Map()
    const addPOI = poi => {
        const identity = poiIdentity(poi)
        if (!identity || !coordinateFromPOI(poi)) {
            return
        }

        const existing = byIdentity.get(identity)
        byIdentity.set(identity, existing ? {
            ...poi,
            ...existing,
            label:       existing.label ?? poi.label,
            description: existing.description ?? poi.description,
            location:    existing.location ?? poi.location,
        } : poi)
    }

    associatedPois
        .filter(poi => !isPOIRepresentedByEndpoint(poi, endpointMarkers))
        .forEach(addPOI)
    endpointMarkers.forEach(addPOI)

    return Array.from(byIdentity.entries())
        .map(([identity, poi], index) => ({
            ...poi,
            pdfNumber: numberByIdentity.get(identity),
            pdfOrder:  index,
        }))
        .sort((a, b) => {
            const roleRank = role => role === 'Start' ? 0 : role === 'End' ? 2 : 1
            const rank = roleRank(poiRole(a)) - roleRank(poiRole(b))
            if (rank !== 0) {
                return rank
            }

            return (a.pdfNumber ?? a.pdfOrder) - (b.pdfNumber ?? b.pdfOrder)
        })
}

export const getReferencePoints = (trackDrawings, pois, endpointMarkers) => [
    ...trackDrawings.flatMap(item => item.segments.flat()),
    ...pois.map(poi => ({
        longitude: finiteNumber(poi.longitude),
        latitude:  finiteNumber(poi.latitude),
    })).filter(point => point.longitude !== null && point.latitude !== null),
    ...endpointMarkers.map(marker => ({
        longitude: finiteNumber(marker.longitude),
        latitude:  finiteNumber(marker.latitude),
    })).filter(point => point.longitude !== null && point.latitude !== null),
]

export const getJourneyExportContent = (journey, pois = undefined, {trackDrawingOptions = {}} = {}) => {
    const trackDrawings = getJourneyTrackDrawings(journey, trackDrawingOptions)
    const associatedPois = getAssociatedJourneyPOIs(journey, pois)
    const endpointMarkers = getJourneyEndpointMarkers(journey, trackDrawings, associatedPois)
    const exportablePois = getNumberedPOIs(
        getExportableJourneyPOIs(journey, associatedPois)
            .filter(poi => !isPOIRepresentedByEndpoint(poi, endpointMarkers)),
    )
    const listedPois = getListedJourneyPOIs({
                                                associatedPois,
                                                endpointMarkers,
                                                exportablePois,
                                            })

    return {
        trackDrawings,
        endpointMarkers,
        exportablePois,
        listedPois,
    }
}
