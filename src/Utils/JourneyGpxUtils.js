/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyGpxUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-02
 * Last modified: 2026-05-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    APP_STUDIO, POI_FLAG_START, POI_FLAG_STOP, POI_STANDARD_TYPE, POI_STARTER_TYPE,
}                              from '@Core/constants'
import { decodeHTMLEntities } from '@Utils/TextUtils'

export const LGS_GPX_NAMESPACE = 'https://www.lgs1920.fr/gpx/1'
export const GPX_MIME_TYPE = 'application/gpx+xml;charset=utf-8'
export const GEOJSON_MIME_TYPE = 'application/geo+json;charset=utf-8'

export const JOURNEY_EXPORT_FORMATS = {
    GPX:     'gpx',
    GEOJSON: 'geojson',
}

export const JOURNEY_EXPORT_FORMAT_LABELS = {
    [JOURNEY_EXPORT_FORMATS.GPX]:     'GPX',
    [JOURNEY_EXPORT_FORMATS.GEOJSON]: 'GeoJSON',
}

export const JOURNEY_EXPORT_MIME_TYPES = {
    [JOURNEY_EXPORT_FORMATS.GPX]:     GPX_MIME_TYPE,
    [JOURNEY_EXPORT_FORMATS.GEOJSON]: GEOJSON_MIME_TYPE,
}

const GPX_NAMESPACE = 'http://www.topografix.com/GPX/1/1'
const GPX_SCHEMA = 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd'
const LGS_PROPERTY_PREFIX = 'lgs_'
const EXCLUDED_POI_TYPES = new Set([POI_FLAG_START, POI_FLAG_STOP, POI_STARTER_TYPE])
const EXPORT_EXTENSION_PATTERN = /\.(gpx|geojson|json)$/i

const finiteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return undefined
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

const escapeXml = value => `${decodeHTMLEntities(value ?? '')}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const formatNumber = value => {
    const number = finiteNumber(value)
    if (number === undefined) {
        return undefined
    }
    return Number.parseFloat(number.toFixed(8)).toString()
}

const isSerializableObject = value => {
    return value && typeof value === 'object' && Object.keys(value).length > 0
}

const toJson = value => {
    if (!isSerializableObject(value)) {
        return undefined
    }
    return JSON.stringify(value)
}

const compactObject = object => Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ''),
)

const deepClone = value => JSON.parse(JSON.stringify(value))

const lgsProperties = object => compactObject(
    Object.fromEntries(
        Object.entries(object).map(([key, value]) => [`${LGS_PROPERTY_PREFIX}${key}`, value]),
    ),
)

const lgsElement = (name, value, indent = '      ') => {
    if (value === undefined || value === null || value === '') {
        return ''
    }
    return `${indent}<lgs:${name}>${escapeXml(value)}</lgs:${name}>`
}

const extensionsBlock = (elements, indent = '    ') => {
    const content = elements.filter(Boolean)
    if (content.length === 0) {
        return ''
    }

    return [
        `${indent}<extensions>`,
        ...content,
        `${indent}</extensions>`,
    ].join('\n')
}

const directChild = (node, localName) => {
    if (!node) {
        return null
    }

    return Array.from(node.childNodes ?? []).find(child => child.nodeType === 1 && child.localName === localName) ?? null
}

const directText = (node, localName) => directChild(node, localName)?.textContent?.trim()

const parseBoolean = value => {
    if (value === undefined || value === null || value === '') {
        return undefined
    }
    if (typeof value === 'boolean') {
        return value
    }
    return `${value}` === 'true'
}

const parseJson = value => {
    if (!value) {
        return undefined
    }
    if (typeof value === 'object') {
        return value
    }

    try {
        return JSON.parse(value)
    }
    catch {
        return undefined
    }
}

const parseStringArray = value => {
    if (Array.isArray(value)) {
        return value.map(item => `${item ?? ''}`.trim()).filter(Boolean)
    }

    const parsed = parseJson(value)
    if (Array.isArray(parsed)) {
        return parsed.map(item => `${item ?? ''}`.trim()).filter(Boolean)
    }

    if (!value) {
        return undefined
    }

    return `${value}`.split(',').map(item => item.trim()).filter(Boolean)
}

const lgsProperty = (properties = {}, name) => {
    return properties[`${LGS_PROPERTY_PREFIX}${name}`] ?? properties[`lgs:${name}`]
}

const readLgsExtensionFields = (extensionsNode) => {
    const fields = {}
    if (!extensionsNode) {
        return fields
    }

    Array.from(extensionsNode.childNodes ?? []).forEach(child => {
        if (child.nodeType !== 1) {
            return
        }
        if (child.namespaceURI !== LGS_GPX_NAMESPACE && child.prefix !== 'lgs') {
            return
        }
        fields[child.localName] = child.textContent?.trim() ?? ''
    })
    return fields
}

export const getJourneyGpxFileName = (journey) => {
    return getJourneyExportFileName(journey, JOURNEY_EXPORT_FORMATS.GPX)
}

export const getJourneyExportBaseName = (journey) => {
    const fallback = journey?.slug?.replaceAll('#', '-') || 'journey'
    const title = journey?.title || fallback
    const slugify = globalThis.__?.app?.slugify
    const name = slugify ? slugify(title) : `${title}`.toLowerCase().replace(/[^\w-]+/g, '-')

    return name || fallback
}

export const getJourneyExportFileName = (journey, format = JOURNEY_EXPORT_FORMATS.GPX) => {
    const extension = format === JOURNEY_EXPORT_FORMATS.GEOJSON ? JOURNEY_EXPORT_FORMATS.GEOJSON : JOURNEY_EXPORT_FORMATS.GPX

    return `${getJourneyExportBaseName(journey)}.${extension}`
}

export const normalizeJourneyExportBaseName = (fileName, journey = null) => {
    const fallback = getJourneyExportBaseName(journey)
    const candidate = `${fileName ?? ''}`.trim()
    const baseName = candidate.replace(EXPORT_EXTENSION_PATTERN, '')

    return baseName || fallback
}

export const normalizeJourneyExportFileName = (fileName, format = JOURNEY_EXPORT_FORMATS.GPX, journey = null) => {
    const extension = format === JOURNEY_EXPORT_FORMATS.GEOJSON ? JOURNEY_EXPORT_FORMATS.GEOJSON : JOURNEY_EXPORT_FORMATS.GPX
    const baseName = normalizeJourneyExportBaseName(fileName, journey)

    return `${baseName}.${extension}`
}

export const isExportableJourneyPOI = poi => {
    if (!poi) {
        return false
    }

    if (EXCLUDED_POI_TYPES.has(poi.type) || EXCLUDED_POI_TYPES.has(poi.category)) {
        return false
    }

    return finiteNumber(poi.longitude) !== undefined && finiteNumber(poi.latitude) !== undefined
}

export const getExportableJourneyPOIs = (journey, pois = undefined) => {
    if (!journey) {
        return []
    }

    const list = pois ?? globalThis.__?.ui?.poiManager?.list ?? globalThis.lgs?.stores?.main?.components?.pois?.list
    const values = list instanceof Map ? Array.from(list.values()) : Array.isArray(list) ? list : []
    const trackSlugs = new Set(Array.from(journey.tracks?.keys?.() ?? []))

    return values.filter(poi => {
        const parent = poi?.parent ?? null
        const associated = parent === journey.slug
                           || trackSlugs.has(parent)
                           || globalThis.lgs?.getJourneyByTrackSlug?.(parent)?.slug === journey.slug

        return associated && isExportableJourneyPOI(poi)
    })
}

const getTrackSegments = track => {
    const geometry = track?.content?.geometry
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

const getTrackTimes = (track, segmentIndex) => {
    const geometry = track?.content?.geometry
    const times = track?.content?.properties?.coordinateProperties?.times
    if (!times) {
        return []
    }

    return geometry?.type === 'MultiLineString' ? times[segmentIndex] ?? [] : times
}

const trackPointToGpx = (coordinate, time) => {
    const [lon, lat, height] = coordinate ?? []
    const lonValue = formatNumber(lon)
    const latValue = formatNumber(lat)
    if (lonValue === undefined || latValue === undefined) {
        return ''
    }

    const ele = finiteNumber(height)
    const lines = [`      <trkpt lat="${latValue}" lon="${lonValue}">`]
    if (ele !== undefined) {
        lines.push(`        <ele>${formatNumber(ele)}</ele>`)
    }
    if (time) {
        lines.push(`        <time>${escapeXml(time)}</time>`)
    }
    lines.push('      </trkpt>')

    return lines.join('\n')
}

const trackToGpx = track => {
    const segments = getTrackSegments(track)
        .map((segment, segmentIndex) => {
            const times = getTrackTimes(track, segmentIndex)
            const points = segment
                .map((coordinate, pointIndex) => trackPointToGpx(coordinate, times?.[pointIndex]))
                .filter(Boolean)

            if (points.length < 2) {
                return ''
            }

            return [
                '    <trkseg>',
                ...points,
                '    </trkseg>',
            ].join('\n')
        })
        .filter(Boolean)

    if (segments.length === 0) {
        return ''
    }

    const extensions = extensionsBlock([
        lgsElement('id', track.id),
        lgsElement('slug', track.slug),
        lgsElement('parent', track.parent),
        lgsElement('color', track.color),
        lgsElement('thickness', track.thickness),
        lgsElement('visible', track.visible),
    ])

    return [
        '  <trk>',
        `    <name>${escapeXml(track.title ?? track.content?.properties?.name ?? 'Track')}</name>`,
        track.description ? `    <desc>${escapeXml(track.description)}</desc>` : '',
        extensions,
        ...segments,
        '  </trk>',
    ].filter(Boolean).join('\n')
}

const getTrackLgsProperties = track => lgsProperties({
    id:        track.id,
    slug:      track.slug,
    parent:    track.parent,
    color:     track.color,
    thickness: track.thickness,
    visible:   track.visible,
})

const trackToGeoJsonFeature = track => {
    if (!track?.content) {
        return null
    }

    const feature = deepClone(track.content)
    feature.properties = compactObject({
        ...(feature.properties ?? {}),
        name: track.title ?? feature.properties?.name ?? 'Track',
        desc: track.description ?? feature.properties?.desc,
        ...getTrackLgsProperties(track),
    })

    return feature
}

const resolvePoiParentKind = (journey, poi) => {
    if (poi?.parent === journey?.slug) {
        return 'journey'
    }

    if (journey?.tracks?.has?.(poi?.parent)) {
        return 'track'
    }

    return 'journey'
}

const resolvePoiParentTrackTitle = (journey, poi) => {
    if (!journey?.tracks?.has?.(poi?.parent)) {
        return undefined
    }

    return journey.tracks.get(poi.parent)?.title
}

const poiToGpx = (journey, poi) => {
    if (!isExportableJourneyPOI(poi)) {
        return ''
    }

    const lon = formatNumber(poi.longitude)
    const lat = formatNumber(poi.latitude)
    const height = finiteNumber(poi.height) ?? finiteNumber(poi.simulatedHeight)
    const category = poi.category ?? POI_STANDARD_TYPE
    const type = poi.type ?? POI_STANDARD_TYPE
    const title = poi.title || poi.name || 'POI'
    const description = poi.description ?? ''

    const extensions = extensionsBlock([
        lgsElement('id', poi.id),
        lgsElement('parent', poi.parent),
        lgsElement('parentKind', resolvePoiParentKind(journey, poi)),
        lgsElement('parentTrackTitle', resolvePoiParentTrackTitle(journey, poi)),
        lgsElement('type', type),
        lgsElement('category', category),
        lgsElement('location', poi.location),
        lgsElement('country', poi.country),
        lgsElement('countryCode', poi.countryCode),
        lgsElement('color', poi.color),
        lgsElement('bgColor', poi.bgColor),
        lgsElement('visible', poi.visible),
        lgsElement('expanded', poi.expanded),
        lgsElement('animated', poi.animated),
        lgsElement('height', poi.height),
        lgsElement('simulatedHeight', poi.simulatedHeight),
        lgsElement('distance', poi.distance),
        lgsElement('cameraDistance', poi.cameraDistance),
        lgsElement('camera', toJson(poi.camera)),
    ])

    return [
        `  <wpt lat="${lat}" lon="${lon}">`,
        height !== undefined ? `    <ele>${formatNumber(height)}</ele>` : '',
        poi.time ? `    <time>${escapeXml(poi.time)}</time>` : '',
        `    <name>${escapeXml(title)}</name>`,
        description ? `    <desc>${escapeXml(description)}</desc>` : '',
        `    <sym>${escapeXml(category)}</sym>`,
        `    <type>${escapeXml(category)}</type>`,
        extensions,
        '  </wpt>',
    ].filter(Boolean).join('\n')
}

const getPoiEffectiveHeight = poi => finiteNumber(poi.height) ?? finiteNumber(poi.simulatedHeight)

const getPoiLgsProperties = (journey, poi) => lgsProperties({
    id:               poi.id,
    parent:           poi.parent,
    parentKind:       resolvePoiParentKind(journey, poi),
    parentTrackTitle: resolvePoiParentTrackTitle(journey, poi),
    type:             poi.type ?? POI_STANDARD_TYPE,
    category:         poi.category ?? POI_STANDARD_TYPE,
    location:         poi.location,
    country:          poi.country,
    countryCode:      poi.countryCode,
    color:            poi.color,
    bgColor:          poi.bgColor,
    visible:          poi.visible,
    expanded:         poi.expanded,
    animated:         poi.animated,
    height:           poi.height,
    simulatedHeight:  poi.simulatedHeight,
    distance:         poi.distance,
    cameraDistance:   poi.cameraDistance,
    camera:           isSerializableObject(poi.camera) ? poi.camera : undefined,
})

const poiToGeoJsonFeature = (journey, poi) => {
    if (!isExportableJourneyPOI(poi)) {
        return null
    }

    const height = getPoiEffectiveHeight(poi)
    const coordinates = [finiteNumber(poi.longitude), finiteNumber(poi.latitude)]
    if (height !== undefined) {
        coordinates.push(height)
    }

    const category = poi.category ?? POI_STANDARD_TYPE

    return {
        type:       'Feature',
        properties: compactObject({
            name: poi.title || poi.name || 'POI',
            desc: poi.description,
            type: category,
            sym:  category,
            time: poi.time,
            ...getPoiLgsProperties(journey, poi),
        }),
        geometry:   {
            type: 'Point',
            coordinates,
        },
    }
}

const getJourneyLgsProperties = journey => lgsProperties({
    slug:             journey?.slug,
    location:         journey?.location,
    country:          journey?.country,
    countryCode:      journey?.countryCode,
    countries:        journey?.countries,
    countryCodes:     journey?.countryCodes,
    activity:         journey?.activity,
    activitySettings: journey?.activitySettings,
    visible:          journey?.visible,
    POIsVisible:      journey?.POIsVisible,
    elevationServer:  journey?.elevationServer,
    camera:           isSerializableObject(journey?.camera) ? journey.camera : undefined,
    rotation:         isSerializableObject(journey?.rotation) ? journey.rotation : undefined,
    panorama:         isSerializableObject(journey?.panorama) ? journey.panorama : undefined,
})

export const exportJourneyToGPX = (journey, {pois = undefined, createdAt = new Date().toISOString()} = {}) => {
    const exportablePois = getExportableJourneyPOIs(journey, pois)
    const tracks = Array.from(journey?.tracks?.values?.() ?? [])
        .map(trackToGpx)
        .filter(Boolean)
    const waypoints = exportablePois
        .map(poi => poiToGpx(journey, poi))
        .filter(Boolean)

    const metadataExtensions = extensionsBlock([
        lgsElement('slug', journey?.slug),
        lgsElement('location', journey?.location),
        lgsElement('country', journey?.country),
        lgsElement('countryCode', journey?.countryCode),
        lgsElement('countries', toJson(journey?.countries)),
        lgsElement('countryCodes', toJson(journey?.countryCodes)),
        lgsElement('activity', journey?.activity),
        lgsElement('activitySettings', toJson(journey?.activitySettings)),
        lgsElement('visible', journey?.visible),
        lgsElement('POIsVisible', journey?.POIsVisible),
        lgsElement('elevationServer', journey?.elevationServer),
        lgsElement('camera', toJson(journey?.camera)),
        lgsElement('rotation', toJson(journey?.rotation)),
        lgsElement('panorama', toJson(journey?.panorama)),
    ], '    ')

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<gpx version="1.1" creator="${escapeXml(APP_STUDIO)}" xmlns="${GPX_NAMESPACE}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:lgs="${LGS_GPX_NAMESPACE}" xsi:schemaLocation="${GPX_SCHEMA}">`,
        '  <metadata>',
        `    <name>${escapeXml(journey?.title ?? 'Journey')}</name>`,
        journey?.description ? `    <desc>${escapeXml(journey.description)}</desc>` : '',
        `    <time>${escapeXml(createdAt)}</time>`,
        metadataExtensions,
        '  </metadata>',
        ...waypoints,
        ...tracks,
        '</gpx>',
        '',
    ].filter(line => line !== '').join('\n')
}

export const exportJourneyToGeoJSON = (journey, {pois = undefined, createdAt = new Date().toISOString()} = {}) => {
    const exportablePois = getExportableJourneyPOIs(journey, pois)
    const features = [
        ...exportablePois.map(poi => poiToGeoJsonFeature(journey, poi)),
        ...Array.from(journey?.tracks?.values?.() ?? []).map(trackToGeoJsonFeature),
    ].filter(Boolean)

    return JSON.stringify({
        type:       'FeatureCollection',
        properties: compactObject({
            name:    journey?.title ?? 'Journey',
            desc:    journey?.description,
            creator: APP_STUDIO,
            time:    createdAt,
            ...getJourneyLgsProperties(journey),
        }),
        features,
    }, null, 2)
}

export const extractJourneyMetadataFromGpxDocument = (document) => {
    const root = document?.documentElement
    const metadataNode = directChild(root, 'metadata')
    const extensions = readLgsExtensionFields(directChild(metadataNode, 'extensions'))

    return {
        title:            directText(metadataNode, 'name'),
        description:      directText(metadataNode, 'desc'),
        location:         extensions.location,
        country:          extensions.country,
        countryCode:      extensions.countryCode,
        countries:        parseStringArray(extensions.countries),
        countryCodes:     parseStringArray(extensions.countryCodes),
        activity:         extensions.activity,
        activitySettings: parseJson(extensions.activitySettings),
        visible:          parseBoolean(extensions.visible),
        POIsVisible:      parseBoolean(extensions.POIsVisible),
        elevationServer:  extensions.elevationServer,
        camera:           parseJson(extensions.camera),
        rotation:         parseJson(extensions.rotation),
        panorama:         parseJson(extensions.panorama),
    }
}

export const extractJourneyMetadataFromGeoJson = (geoJson = {}) => {
    const properties = geoJson.properties ?? {}

    return {
        title:            properties.name,
        description:      properties.desc ?? properties.description,
        location:         lgsProperty(properties, 'location'),
        country:          lgsProperty(properties, 'country'),
        countryCode:      lgsProperty(properties, 'countryCode'),
        countries:        parseStringArray(lgsProperty(properties, 'countries')),
        countryCodes:     parseStringArray(lgsProperty(properties, 'countryCodes')),
        activity:         lgsProperty(properties, 'activity'),
        activitySettings: lgsProperty(properties, 'activitySettings'),
        visible:          parseBoolean(lgsProperty(properties, 'visible')),
        POIsVisible:      parseBoolean(lgsProperty(properties, 'POIsVisible')),
        elevationServer:  lgsProperty(properties, 'elevationServer'),
        camera:           lgsProperty(properties, 'camera'),
        rotation:         lgsProperty(properties, 'rotation'),
        panorama:         lgsProperty(properties, 'panorama'),
    }
}

export const extractLgsTrackProperties = (properties = {}) => ({
    id:        lgsProperty(properties, 'id'),
    slug:      lgsProperty(properties, 'slug'),
    parent:    lgsProperty(properties, 'parent'),
    color:     lgsProperty(properties, 'color') || properties.stroke,
    thickness: finiteNumber(lgsProperty(properties, 'thickness') ?? properties['stroke-width']),
    visible:   parseBoolean(lgsProperty(properties, 'visible')),
})

export const extractLgsPoiProperties = (properties = {}) => ({
    id:               lgsProperty(properties, 'id'),
    parent:           lgsProperty(properties, 'parent'),
    parentKind:       lgsProperty(properties, 'parentKind'),
    parentTrackTitle: lgsProperty(properties, 'parentTrackTitle'),
    type:             lgsProperty(properties, 'type'),
    category:         lgsProperty(properties, 'category'),
    location:         lgsProperty(properties, 'location'),
    country:          lgsProperty(properties, 'country'),
    countryCode:      lgsProperty(properties, 'countryCode'),
    color:            lgsProperty(properties, 'color'),
    bgColor:          lgsProperty(properties, 'bgColor'),
    visible:          parseBoolean(lgsProperty(properties, 'visible')),
    expanded:         parseBoolean(lgsProperty(properties, 'expanded')),
    animated:         parseBoolean(lgsProperty(properties, 'animated')),
    height:           finiteNumber(lgsProperty(properties, 'height')),
    simulatedHeight:  finiteNumber(lgsProperty(properties, 'simulatedHeight')),
    distance:         finiteNumber(lgsProperty(properties, 'distance')),
    cameraDistance:   finiteNumber(lgsProperty(properties, 'cameraDistance')),
    camera:           parseJson(lgsProperty(properties, 'camera')),
})
