/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SportsLibJourneyImporter.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const FIT_SIGNATURE = [0x2E, 0x46, 0x49, 0x54]
const FIT_EXTENSION = 'fit'
const TCX_EXTENSION = 'tcx'
const TCX_ROOT_NAME = 'TrainingCenterDatabase'
const VALID_ACTIVITY_EXTENSIONS = new Set([FIT_EXTENSION, TCX_EXTENSION])

export class JourneyImportError extends Error {

    /**
     * Creates a typed journey-import error.
     * @param {string} code
     * @param {string} message
     * @param {object} options
     */
    constructor(code, message, options = {}) {
        super(message, options)
        this.name = 'JourneyImportError'
        this.code = code
    }
}

/** Determines whether a value is a finite number. */
const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value)

/** Converts a date-like value to an ISO string or null. */
const toIsoDate = value => {
    const date = value instanceof Date ? value : new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

/** Converts accepted binary input to an isolated ArrayBuffer. */
const toArrayBuffer = content => {
    if (content instanceof ArrayBuffer) {
        return content
    }
    if (ArrayBuffer.isView(content)) {
        return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength)
    }
    throw new JourneyImportError('invalid_fit_input', 'FIT import requires binary file content.')
}

/** Converts accepted binary input to a byte view. */
const toBytes = content => new Uint8Array(toArrayBuffer(content))

/** Validates the FIT container size, signature, and file CRC. */
const validateFitContainer = async content => {
    const bytes = toBytes(content)

    if (bytes.length < 14 || !FIT_SIGNATURE.every((value, index) => bytes[index + 8] === value)) {
        throw new JourneyImportError('invalid_fit_header', 'The file does not contain a valid FIT header and signature.')
    }

    const headerSize = bytes[0]
    if (headerSize !== 12 && headerSize !== 14) {
        throw new JourneyImportError('invalid_fit_header', `The FIT header size is invalid (${headerSize} bytes).`)
    }
    if (bytes.length < headerSize) {
        throw new JourneyImportError('invalid_fit_header', 'The FIT file is shorter than its declared header.')
    }

    const dataSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true)
    const expectedSize = headerSize + dataSize + 2
    if (bytes.length !== expectedSize) {
        throw new JourneyImportError(
            'invalid_fit_size',
            `The FIT file size (${bytes.length} bytes) does not match its declared size (${expectedSize} bytes).`,
        )
    }

    const {default: FitParser} = await import('fit-file-parser')
    try {
        await new FitParser({force: false, strict: false, mode: 'list'}).parseAsync(toArrayBuffer(content))
    }
    catch (error) {
        const reason = typeof error === 'string' ? error : error?.message ?? 'Unknown FIT validation error.'
        const code = /crc/i.test(reason) ? 'invalid_fit_crc' : 'invalid_fit_structure'
        throw new JourneyImportError(code, `FIT integrity validation failed: ${reason}`, {cause: error})
    }

    return toArrayBuffer(content)
}

/** Returns a stream's samples, or an empty list when the stream is unavailable. */
const getStreamValues = (activity, type) => {
    try {
        return activity.getStreamData(type)
    }
    catch {
        return []
    }
}

/** Collects every available stream into a JSON-compatible object. */
const getStreamData = activity => Object.fromEntries(
    (activity.getAllStreams?.() ?? [])
        .map(stream => [stream.type, stream.getData()])
        .filter(([, values]) => Array.isArray(values)),
)

/** Collects named statistics from a SportsLib event, activity, or route. */
const getStats = source => Object.fromEntries(
    (source?.getStatsAsArray?.() ?? [])
        .map(stat => [stat.getType?.(), stat.getValue?.()])
        .filter(([type, value]) => type && value !== undefined && value !== null),
)

/** Returns the first numeric value for any matching statistic name. */
const readNumeric = (stats, ...keys) => {
    for (const key of keys) {
        const value = stats[key]
        if (isFiniteNumber(value)) {
            return value
        }
    }
    return undefined
}

/** Maps device-reported statistics into Studio's external metrics shape. */
const mapExternalMetrics = stats => {
    const external = {}
    const set = (key, value) => {
        if (value !== undefined) {
            external[key] = value
        }
    }

    set('distance', readNumeric(stats, 'Distance'))
    set('duration', readNumeric(stats, 'Elapsed time', 'Duration', 'Timer time'))
    set('movingDuration', readNumeric(stats, 'Moving time'))
    set('idleTime', readNumeric(stats, 'Pause Time'))
    set('averageSpeed', readNumeric(stats, 'Average Speed'))
    set('minSpeed', readNumeric(stats, 'Minimum Speed'))
    set('maxSpeed', readNumeric(stats, 'Maximum Speed'))
    set('averagePace', readNumeric(stats, 'Average Pace'))
    set('minPace', readNumeric(stats, 'Minimum Pace'))
    set('maxPace', readNumeric(stats, 'Maximum Pace'))
    set('minHeight', readNumeric(stats, 'Minimum Altitude'))
    set('maxHeight', readNumeric(stats, 'Maximum Altitude'))
    set('averageHeartRate', readNumeric(stats, 'Average Heart Rate'))
    set('minHeartRate', readNumeric(stats, 'Minimum Heart Rate'))
    set('maxHeartRate', readNumeric(stats, 'Maximum Heart Rate'))
    set('averageCadence', readNumeric(stats, 'Average Cadence'))
    set('maxCadence', readNumeric(stats, 'Maximum Cadence'))
    set('averagePower', readNumeric(stats, 'Average Power'))
    set('maxPower', readNumeric(stats, 'Maximum Power'))
    set('energy', readNumeric(stats, 'Energy'))

    const ascent = readNumeric(stats, 'Ascent')
    const descent = readNumeric(stats, 'Descent')
    if (ascent !== undefined) {
        external.positive = {...external.positive, elevation: ascent}
    }
    if (descent !== undefined) {
        external.negative = {...external.negative, elevation: -descent}
    }

    return external
}

/** Reduces a SportsLib creator to stable device metadata. */
const simplifyCreator = creator => {
    if (!creator) {
        return null
    }

    return {
        name:         creator.name ?? null,
        manufacturer: creator.manufacturer ?? null,
        product:      creator.product ?? creator.productName ?? null,
        productId:    creator.productId ?? null,
        software:     creator.swInfo ?? null,
        hardware:     creator.hwInfo ?? null,
    }
}

/** Serializes activity lap metadata and its reported statistics. */
const getLapMetadata = activity => (activity.getLaps?.() ?? []).map((lap, index) => {
    const serialized = lap.toJSON?.(activity) ?? {}
    return {
        ...serialized,
        lapId:     serialized.lapId ?? lap.lapId ?? index + 1,
        startDate: toIsoDate(lap.startDate ?? serialized.startDate),
        endDate:   toIsoDate(lap.endDate ?? serialized.endDate),
        metrics:   getStats(lap),
    }
})

/** Builds warnings for missing sensor data and skipped activity points. */
const getSensorWarnings = (activity, format, skippedPoints = 0) => {
    const warnings = []
    const streams = activity.getAllStreams?.() ?? []
    const hasValues = type => streams.some(stream =>
        stream.type === type && stream.getData().some(value => isFiniteNumber(value)),
    )

    if (skippedPoints > 0) {
        warnings.push({
            code:    'invalid-trackpoints',
            message: `${skippedPoints} track point${skippedPoints === 1 ? '' : 's'} with invalid coordinates were skipped.`,
        })
    }
    if (!hasValues('Heart Rate')) {
        warnings.push({code: 'missing-heart-rate', message: 'Heart rate data is not present in this file.'})
    }
    if (!hasValues('Cadence')) {
        warnings.push({code: 'missing-cadence', message: 'Cadence data is not present in this file.'})
    }
    if (!hasValues('Power')) {
        warnings.push({code: 'missing-power', message: 'Power data is not present in this file.'})
    }
    if (format === TCX_EXTENSION && !hasValues('Distance')) {
        warnings.push({code: 'missing-recorded-distance', message: 'Recorded distance samples are not present in this TCX file.'})
    }

    return warnings
}

/** Converts valid activity positions into timed GeoJSON line segments. */
const getPositionSegments = activity => {
    const latitudes = getStreamValues(activity, 'Latitude')
    const longitudes = getStreamValues(activity, 'Longitude')
    const altitudes = getStreamValues(activity, 'Altitude')
    const startTime = new Date(activity.startDate).getTime()
    const length = Math.max(latitudes.length, longitudes.length, altitudes.length)
    const segments = []
    let segment = []
    let skippedPoints = 0
    let validPointCount = 0

    const finishSegment = () => {
        if (segment.length >= 2) {
            segments.push(segment)
        }
        segment = []
    }

    for (let index = 0; index < length; index++) {
        const latitude = latitudes[index]
        const longitude = longitudes[index]
        const hasLatitude = isFiniteNumber(latitude)
        const hasLongitude = isFiniteNumber(longitude)

        if (!hasLatitude && !hasLongitude) {
            finishSegment()
            continue
        }
        if (!hasLatitude || !hasLongitude || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            skippedPoints++
            finishSegment()
            continue
        }

        const altitude = altitudes[index]
        const coordinates = isFiniteNumber(altitude)
            ? [longitude, latitude, altitude]
            : [longitude, latitude]
        const time = Number.isFinite(startTime) ? new Date(startTime + index * 1000).toISOString() : null
        segment.push({coordinates, time})
        validPointCount++
    }
    finishSegment()

    return {segments, skippedPoints, validPointCount}
}

/** Builds one GeoJSON feature from an imported FIT activity. */
const activityFeature = (activity, index, format) => {
    const {segments, skippedPoints, validPointCount} = getPositionSegments(activity)
    if (validPointCount < 2 || segments.length === 0) {
        return {feature: null, skippedPoints, validPointCount}
    }

    const coordinates = segments.map(segment => segment.map(point => point.coordinates))
    const times = segments.map(segment => segment.map(point => point.time))
    const stats = getStats(activity)
    const startTime = toIsoDate(activity.startDate)
    const metadata = {
        format,
        kind:        'activity',
        sport:       activity.type ?? null,
        activityName: activity.name ?? null,
        startTime,
        endTime:     toIsoDate(activity.endDate),
        creator:     simplifyCreator(activity.creator),
        lapCount:    activity.getLaps?.().length ?? 0,
        laps:        getLapMetadata(activity),
        reportedMetrics: stats,
    }

    return {
        feature: {
            type:       'Feature',
            properties: {
                name: activity.name || `${activity.type || 'Activity'} ${index + 1}`,
                sourceMetadata: metadata,
                externalMetrics: mapExternalMetrics(stats),
                observations: {
                    samplingIntervalMs: 1000,
                    startTime,
                    streams:          getStreamData(activity),
                },
                coordinateProperties: {
                    times: coordinates.length === 1 ? times[0] : times,
                },
            },
            geometry: {
                type:        coordinates.length === 1 ? 'LineString' : 'MultiLineString',
                coordinates: coordinates.length === 1 ? coordinates[0] : coordinates,
            },
        },
        skippedPoints,
        validPointCount,
        metadata,
        stats,
    }
}

/** Normalizes SportsLib activities and event metadata into a journey result. */
const buildActivityResult = ({event, format, fileName, contentHash = null, additionalWarnings = []}) => {
    const importedActivities = event.getActivities?.() ?? []
    const featureResults = importedActivities.map((activity, index) => activityFeature(activity, index, format))
    const features = featureResults.map(result => result.feature).filter(Boolean)
    const validPointCount = featureResults.reduce((sum, result) => sum + result.validPointCount, 0)

    if (validPointCount < 2 || features.length === 0) {
        throw new JourneyImportError('no_usable_gps', 'The file does not contain at least two valid GPS positions.')
    }

    const warnings = [...additionalWarnings]
    featureResults.forEach((result, index) => {
        if (!result.feature) {
            warnings.push({
                code:    'activity-without-gps',
                message: `Activity ${index + 1} has no usable GPS track and was skipped.`,
            })
            return
        }
        warnings.push(...getSensorWarnings(importedActivities[index], format, result.skippedPoints))
    })

    const eventStats = getStats(event)
    const creator = importedActivities.map(activity => simplifyCreator(activity.creator)).find(Boolean) ?? null

    return {
        geoJson: {
            type:     'FeatureCollection',
            features,
        },
        activity: mapSportToStudioActivity(importedActivities[0]?.type),
        metrics:  {external: mapExternalMetrics(eventStats)},
        sourceMetadata: {
            format,
            kind:             'activity',
            originalFileName: fileName ?? null,
            contentHash,
            creator,
            startTime:        toIsoDate(event.startDate ?? importedActivities[0]?.startDate),
            endTime:          toIsoDate(event.endDate ?? importedActivities.at(-1)?.endDate),
            activityCount:    importedActivities.length,
            lapCount:         importedActivities.reduce((sum, activity) => sum + (activity.getLaps?.().length ?? 0), 0),
            reportedMetrics:  eventStats,
            warnings,
        },
    }
}

/** Maps a normalized FIT or TCX sport label to a configured Studio activity profile. */
export const mapSportToStudioActivity = sport => {
    const normalized = `${sport ?? ''}`.toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (/\b(cycling|cycle|biking|bike)\b/.test(normalized)) {
        return 'bike'
    }
    if (/\b(ski touring|ski mountaineering|backcountry skiing|backcountry ski)\b/.test(normalized)) {
        return 'ski-touring'
    }
    if (/\b(cross country skiing|crosscountry skiing|classic skiing|skate skiing)\b/.test(normalized)) {
        return 'cross-country-skiing'
    }
    if (/\b(alpine skiing|downhill skiing)\b/.test(normalized)) {
        return 'alpine-skiing'
    }
    if (/\b(open water swimming)\b/.test(normalized)) {
        return 'open-water-swimming'
    }
    if (/\b(trail run|trail running)\b/.test(normalized)) {
        return 'trail'
    }
    if (/\b(run|running)\b/.test(normalized)) {
        return 'running'
    }
    if (/\b(trek|trekking|hike|hiking|walk|walking|snowshoe|snowshoeing|mountaineering)\b/.test(normalized)) {
        return 'trek'
    }
    return null
}

/** Reads reported route statistics. */
const getRouteStats = route => getStats(route)

/** Normalizes a FIT Course and its route waypoints into a journey result. */
const buildCourseResult = ({routeFile, fileName, contentHash = null}) => {
    const routes = routeFile.getRoutes?.() ?? []
    const features = []
    const warnings = []

    routes.forEach((route, index) => {
        const points = route.getPointData?.() ?? []
        const validPoints = points.filter(point =>
            isFiniteNumber(point?.longitudeDegrees) &&
            isFiniteNumber(point?.latitudeDegrees) &&
            point.longitudeDegrees >= -180 && point.longitudeDegrees <= 180 &&
            point.latitudeDegrees >= -90 && point.latitudeDegrees <= 90,
        )
        if (validPoints.length < 2) {
            warnings.push({code: 'route-without-gps', message: `Course route ${index + 1} has fewer than two valid GPS positions and was skipped.`})
            return
        }

        const stats = getRouteStats(route)
        const creator = simplifyCreator(route.creator ?? routeFile.creator)
        features.push({
            type:       'Feature',
            properties: {
                name: route.name || fileName || `FIT Course ${index + 1}`,
                externalMetrics: mapExternalMetrics(stats),
                sourceMetadata: {
                    format:          FIT_EXTENSION,
                    kind:            'course',
                    sport:           route.activityType ?? null,
                    creator,
                    createdAt:       toIsoDate(routeFile.createdAt),
                    waypointCount:   routeFile.getWaypoints?.().length ?? 0,
                    reportedMetrics: stats,
                },
                observations: {
                    samplingIntervalMs: null,
                    startTime:          null,
                    streams:            getStreamData(route),
                },
            },
            geometry: {
                type:        'LineString',
                coordinates: validPoints.map(point => isFiniteNumber(point.altitude)
                    ? [point.longitudeDegrees, point.latitudeDegrees, point.altitude]
                    : [point.longitudeDegrees, point.latitudeDegrees]),
            },
        })
    })

    for (const waypoint of routeFile.getWaypoints?.() ?? []) {
        if (!isFiniteNumber(waypoint?.longitudeDegrees) || !isFiniteNumber(waypoint?.latitudeDegrees)) {
            continue
        }
        features.push({
            type:       'Feature',
            properties: {
                name:        waypoint.name ?? 'Course point',
                description: waypoint.description ?? '',
                category:    waypoint.type ?? 'course-point',
                distance:    waypoint.distance,
                sourceMetadata: {
                    format: FIT_EXTENSION,
                    kind:   'course-point',
                },
            },
            geometry: {
                type:        'Point',
                coordinates: isFiniteNumber(waypoint.altitude)
                    ? [waypoint.longitudeDegrees, waypoint.latitudeDegrees, waypoint.altitude]
                    : [waypoint.longitudeDegrees, waypoint.latitudeDegrees],
            },
        })
    }

    if (features.every(feature => feature.geometry.type === 'Point')) {
        throw new JourneyImportError('no_usable_gps', 'The FIT Course does not contain at least two valid GPS positions.')
    }

    const courseStats = getStats(routeFile)
    return {
        geoJson: {
            type:     'FeatureCollection',
            features,
        },
        activity: mapSportToStudioActivity(routes[0]?.activityType),
        metrics:  {external: mapExternalMetrics(courseStats)},
        sourceMetadata: {
            format: FIT_EXTENSION,
            kind:   'course',
            originalFileName: fileName ?? null,
            contentHash,
            creator: simplifyCreator(routeFile.creator),
            createdAt: toIsoDate(routeFile.createdAt),
            routeCount: routes.length,
            waypointCount: routeFile.getWaypoints?.().length ?? 0,
            reportedMetrics: courseStats,
            warnings,
        },
    }
}

/** Copies an XML attribute while preserving its namespace. */
const copyAttribute = (target, attribute) => {
    if (attribute.namespaceURI) {
        target.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value)
    }
    else {
        target.setAttribute(attribute.name, attribute.value)
    }
}

/** Clones TCX XML while removing the TCX namespace from its element names. */
const cloneTcxNode = (sourceNode, targetDocument, tcxNamespace) => {
    if (sourceNode.nodeType === 1) {
        const isTcxElement = sourceNode.namespaceURI === tcxNamespace
        const element = isTcxElement
            ? targetDocument.createElement(sourceNode.localName)
            : sourceNode.namespaceURI
                ? targetDocument.createElementNS(sourceNode.namespaceURI, sourceNode.nodeName)
                : targetDocument.createElement(sourceNode.nodeName)

        Array.from(sourceNode.attributes ?? []).forEach(attribute => copyAttribute(element, attribute))
        Array.from(sourceNode.childNodes ?? []).forEach(child => {
            const clonedChild = cloneTcxNode(child, targetDocument, tcxNamespace)
            if (clonedChild) {
                element.appendChild(clonedChild)
            }
        })
        return element
    }

    if (sourceNode.nodeType === 3) {
        return targetDocument.createTextNode(sourceNode.nodeValue ?? '')
    }
    if (sourceNode.nodeType === 4) {
        return targetDocument.createCDATASection(sourceNode.nodeValue ?? '')
    }
    if (sourceNode.nodeType === 8) {
        return targetDocument.createComment(sourceNode.nodeValue ?? '')
    }
    return null
}

/** Normalizes standard TCX namespace prefixes for the SportsLib XML parser. */
const normalizeTcxNamespaces = document => {
    const root = document.documentElement
    if (!root || root.localName !== TCX_ROOT_NAME) {
        throw new JourneyImportError('invalid_tcx_document', 'The XML document is not a TCX TrainingCenterDatabase.')
    }

    if (!root.namespaceURI) {
        return document
    }

    const normalized = document.implementation.createDocument(null, root.localName)
    const clonedRoot = cloneTcxNode(root, normalized, root.namespaceURI)
    normalized.replaceChild(clonedRoot, normalized.documentElement)
    return normalized
}

/** Finds malformed or incomplete TCX trackpoint data before conversion. */
const getTcxWarnings = document => {
    const warnings = []
    const activities = Array.from(document.getElementsByTagName('Activity'))

    activities.forEach((activity, activityIndex) => {
        const trackPoints = Array.from(activity.getElementsByTagName('Trackpoint'))
        let previousTime = null
        let missingGpsPoints = 0
        let invalidTimes = 0
        let hasReorderedTimes = false

        trackPoints.forEach(point => {
            const timeText = point.getElementsByTagName('Time')[0]?.textContent
            const time = timeText ? new Date(timeText).getTime() : NaN
            if (!Number.isFinite(time)) {
                invalidTimes++
            }
            else {
                if (previousTime !== null && time < previousTime) {
                    hasReorderedTimes = true
                }
                previousTime = time
            }

            if (point.getElementsByTagName('Position').length === 0) {
                missingGpsPoints++
            }
        })

        if (missingGpsPoints > 0) {
            warnings.push({
                code:    'missing-gps-trackpoints',
                message: `${missingGpsPoints} track point${missingGpsPoints === 1 ? '' : 's'} in activity ${activityIndex + 1} have no GPS position.`,
            })
        }
        if (invalidTimes > 0) {
            warnings.push({
                code:    'invalid-trackpoint-times',
                message: `${invalidTimes} track point${invalidTimes === 1 ? '' : 's'} in activity ${activityIndex + 1} have no valid timestamp.`,
            })
        }
        if (hasReorderedTimes) {
            warnings.push({
                code:    'reordered-timestamps',
                message: `Activity ${activityIndex + 1} contains timestamps that are out of order.`,
            })
        }
    })

    return warnings
}

/** Returns direct child elements matching a local XML name. */
const childElements = (node, localName) => Array.from(node?.childNodes ?? [])
    .filter(child => child.nodeType === 1 && child.localName === localName)

/** Returns the first direct child element matching a local XML name. */
const firstChild = (node, localName) => childElements(node, localName)[0] ?? null

/** Reads a numeric direct child value from a TCX element. */
const readTcxNumber = (node, localName) => {
    const value = firstChild(node, localName)?.textContent?.trim()
    if (value === undefined || value === '') {
        return null
    }
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/** Finds the first descendant element matching a local XML name. */
const findDescendant = (node, localName) => {
    const stack = Array.from(node?.childNodes ?? []).filter(child => child.nodeType === 1)
    while (stack.length > 0) {
        const current = stack.shift()
        if (current.localName === localName) {
            return current
        }
        stack.unshift(...Array.from(current.childNodes ?? []).filter(child => child.nodeType === 1))
    }
    return null
}

/** Reads a TCX sensor value from either a direct field or extension. */
const readTcxExtensionNumber = (trackpoint, ...names) => {
    for (const name of names) {
        const directValue = readTcxNumber(trackpoint, name)
        const extension = findDescendant(firstChild(trackpoint, 'Extensions'), name)
        const extensionText = extension?.textContent?.trim()
        const extensionValue = extensionText ? Number(extensionText) : null
        const value = directValue ?? (Number.isFinite(extensionValue) ? extensionValue : null)
        if (value !== null) {
            return value
        }
    }
    return null
}

/** Extracts timestamped TCX samples while retaining lap and track boundaries. */
const getTcxTrackSamples = activityElement => {
    const samples = []
    const segments = []
    const warnings = []
    let skippedPoints = 0
    let validPointCount = 0
    let previousTime = null
    let hasReorderedTimes = false

    const activityLaps = childElements(activityElement, 'Lap')
    activityLaps.forEach(lap => {
        const tracks = childElements(lap, 'Track')
        tracks.forEach(track => {
            let segment = []
            const finishSegment = () => {
                if (segment.length >= 2) {
                    segments.push(segment)
                }
                else if (segment.length === 1) {
                    warnings.push({code: 'short-track-segment', message: 'A TCX track segment with fewer than two GPS positions was skipped.'})
                }
                segment = []
            }

            childElements(track, 'Trackpoint').forEach(trackpoint => {
                const timeText = firstChild(trackpoint, 'Time')?.textContent?.trim() ?? ''
                const timeValue = timeText ? new Date(timeText).getTime() : NaN
                const time = Number.isFinite(timeValue) ? new Date(timeValue).toISOString() : null
                if (time) {
                    if (previousTime !== null && timeValue < previousTime) {
                        hasReorderedTimes = true
                    }
                    previousTime = timeValue
                }

                const position = firstChild(trackpoint, 'Position')
                const latitude = readTcxNumber(position, 'LatitudeDegrees')
                const longitude = readTcxNumber(position, 'LongitudeDegrees')
                const altitude = readTcxNumber(trackpoint, 'AltitudeMeters')
                const sample = {
                    latitude,
                    longitude,
                    altitude,
                    time,
                    distance: readTcxNumber(trackpoint, 'DistanceMeters'),
                    heartRate: readTcxNumber(firstChild(trackpoint, 'HeartRateBpm'), 'Value'),
                    cadence: readTcxNumber(trackpoint, 'Cadence') ?? readTcxExtensionNumber(trackpoint, 'RunCadence'),
                    power: readTcxExtensionNumber(trackpoint, 'Watts'),
                    speed: readTcxExtensionNumber(trackpoint, 'Speed'),
                }
                samples.push(sample)

                if (latitude === null && longitude === null) {
                    finishSegment()
                    return
                }
                if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                    skippedPoints++
                    finishSegment()
                    return
                }

                const coordinates = altitude === null ? [longitude, latitude] : [longitude, latitude, altitude]
                segment.push({coordinates, time})
                validPointCount++
            })
            finishSegment()
        })
    })

    if (skippedPoints > 0) {
        warnings.push({code: 'invalid-trackpoints', message: `${skippedPoints} TCX trackpoint${skippedPoints === 1 ? '' : 's'} with invalid coordinates were skipped.`})
    }
    if (hasReorderedTimes) {
        warnings.push({code: 'reordered-timestamps', message: 'TCX timestamps are out of order; points remain in source order.'})
    }

    return {samples, segments, skippedPoints, validPointCount, warnings, lapCount: activityLaps.length}
}

/** Builds normalized GeoJSON and metadata for TCX activities. */
const buildTcxActivityResult = ({event, document, fileName, contentHash, additionalWarnings = []}) => {
    const eventActivities = event.getActivities?.() ?? []
    const activityElements = Array.from(document.getElementsByTagName('Activity'))
    const warnings = [...additionalWarnings]
    const features = []
    let validPointCount = 0

    activityElements.forEach((activityElement, index) => {
        const activity = eventActivities[index]
        const imported = getTcxTrackSamples(activityElement)
        validPointCount += imported.validPointCount
        warnings.push(...imported.warnings)
        if (imported.validPointCount < 2 || imported.segments.length === 0) {
            warnings.push({code: 'activity-without-gps', message: `Activity ${index + 1} has fewer than two usable GPS positions and was skipped.`})
            return
        }

        const coordinates = imported.segments.map(segment => segment.map(point => point.coordinates))
        const times = imported.segments.map(segment => segment.map(point => point.time))
        const streams = {
            Latitude:    imported.samples.map(sample => sample.latitude),
            Longitude:   imported.samples.map(sample => sample.longitude),
            Altitude:    imported.samples.map(sample => sample.altitude),
            Time:        imported.samples.map(sample => sample.time),
            Distance:    imported.samples.map(sample => sample.distance),
            'Heart Rate': imported.samples.map(sample => sample.heartRate),
            Cadence:     imported.samples.map(sample => sample.cadence),
            Power:       imported.samples.map(sample => sample.power),
            Speed:       imported.samples.map(sample => sample.speed),
        }
        const stats = getStats(activity)
        const name = activityElement.getAttribute('Sport') || activity?.type || `Activity ${index + 1}`
        const startTime = times.flat().find(Boolean) ?? toIsoDate(activity?.startDate)

        features.push({
            type:       'Feature',
            properties: {
                name: `${name} ${index + 1}`,
                sourceMetadata: {
                    format: TCX_EXTENSION,
                    kind: 'activity',
                    sport: name,
                    activityName: activity?.name ?? null,
                    startTime,
                    endTime: times.flat().filter(Boolean).at(-1) ?? toIsoDate(activity?.endDate),
                    creator: simplifyCreator(activity?.creator),
                    lapCount: imported.lapCount,
                    laps: getLapMetadata(activity),
                    reportedMetrics: stats,
                },
                externalMetrics: mapExternalMetrics(stats),
                observations: {
                    samplingIntervalMs: null,
                    startTime,
                    times: imported.samples.map(sample => sample.time),
                    streams,
                },
                coordinateProperties: {times: coordinates.length === 1 ? times[0] : times},
            },
            geometry: {
                type: coordinates.length === 1 ? 'LineString' : 'MultiLineString',
                coordinates: coordinates.length === 1 ? coordinates[0] : coordinates,
            },
        })

        const hasStream = key => streams[key]?.some(isFiniteNumber) ?? false
        if (!hasStream('Heart Rate')) {
            warnings.push({code: 'missing-heart-rate', message: `Heart rate data is not present in activity ${index + 1}.`})
        }
        if (!hasStream('Cadence')) {
            warnings.push({code: 'missing-cadence', message: `Cadence data is not present in activity ${index + 1}.`})
        }
        if (!hasStream('Power')) {
            warnings.push({code: 'missing-power', message: `Power data is not present in activity ${index + 1}.`})
        }
        if (!hasStream('Distance')) {
            warnings.push({code: 'missing-recorded-distance', message: `Recorded distance samples are not present in activity ${index + 1}.`})
        }
    })

    if (validPointCount < 2 || features.length === 0) {
        throw new JourneyImportError('no_usable_gps', 'The TCX file does not contain at least two valid GPS positions.')
    }

    const stats = getStats(event)
    const firstActivity = eventActivities[0]
    const creator = eventActivities.map(activity => simplifyCreator(activity.creator)).find(Boolean) ?? null
    return {
        geoJson: {type: 'FeatureCollection', features},
        activity: mapSportToStudioActivity(firstActivity?.type),
        metrics: {external: mapExternalMetrics(stats)},
        sourceMetadata: {
            format: TCX_EXTENSION,
            kind: 'activity',
            originalFileName: fileName ?? null,
            contentHash,
            creator,
            startTime: toIsoDate(event.startDate ?? firstActivity?.startDate),
            endTime: toIsoDate(event.endDate ?? eventActivities.at(-1)?.endDate),
            activityCount: eventActivities.length,
            lapCount: eventActivities.reduce((sum, activity) => sum + (activity.getLaps?.().length ?? 0), 0),
            reportedMetrics: stats,
            warnings,
        },
    }
}

/** Parses TCX XML, rejects parser errors, and normalizes namespace prefixes. */
const parseTcxDocument = content => {
    const document = new DOMParser().parseFromString(`${content ?? ''}`, 'application/xml')
    const root = document.documentElement
    if (!root || root.localName === 'parsererror' || document.getElementsByTagName('parsererror').length > 0) {
        const detail = root?.textContent?.trim() || 'The XML parser rejected the file.'
        throw new JourneyImportError('invalid_tcx_xml', `TCX XML parsing failed: ${detail}`)
    }
    return normalizeTcxNamespaces(document)
}

/** Imports a validated FIT activity or FIT Course using SportsLib. */
const importFit = async ({content, fileName, contentHash}) => {
    const arrayBuffer = await validateFitContainer(content)
    const {SportsLib} = await import('@sports-alliance/sports-lib')
    let activityError

    try {
        const event = await SportsLib.importFromFit(arrayBuffer)
        return buildActivityResult({event, format: FIT_EXTENSION, fileName, contentHash})
    }
    catch (error) {
        activityError = error
    }

    try {
        const routeFile = await SportsLib.importRoutesFromFit(arrayBuffer)
        return buildCourseResult({routeFile, fileName, contentHash})
    }
    catch (routeError) {
        if (activityError instanceof JourneyImportError) {
            throw activityError
        }
        const reason = routeError?.message ?? activityError?.message ?? 'Unknown FIT import error.'
        throw new JourneyImportError('unsupported_fit_content', `The FIT file could not be imported as an activity or course: ${reason}`, {cause: routeError})
    }
}

/** Imports TCX activities using SportsLib and preserves source Trackpoint data. */
const importTcx = async ({content, fileName, contentHash}) => {
    const document = parseTcxDocument(content)
    const additionalWarnings = getTcxWarnings(document)
    const {SportsLib} = await import('@sports-alliance/sports-lib')

    try {
        const event = await SportsLib.importFromTCX(document)
        return buildTcxActivityResult({event, document, fileName, contentHash, additionalWarnings})
    }
    catch (error) {
        if (error instanceof JourneyImportError) {
            throw error
        }
        throw new JourneyImportError('invalid_tcx_activity', `TCX activity import failed: ${error?.message ?? 'Unknown parser error.'}`, {cause: error})
    }
}

/** Calculates a stable SHA-256 hash for supported binary activity formats. */
export const getJourneyContentHash = async (content, format) => {
    if (!VALID_ACTIVITY_EXTENSIONS.has(`${format ?? ''}`.toLowerCase())) {
        return null
    }

    const bytes = typeof content === 'string'
        ? new TextEncoder().encode(content)
        : toBytes(content)
    if (!globalThis.crypto?.subtle?.digest) {
        return null
    }

    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))
    return Array.from(digest, value => value.toString(16).padStart(2, '0')).join('')
}

/** Dispatches FIT and TCX content to the shared activity import adapters. */
export const importJourneyContent = async ({format, content, fileName, contentHash = null}) => {
    const extension = `${format ?? ''}`.toLowerCase()
    if (extension === FIT_EXTENSION) {
        return importFit({content, fileName, contentHash})
    }
    if (extension === TCX_EXTENSION) {
        return importTcx({content, fileName, contentHash})
    }

    throw new JourneyImportError('unsupported_import_format', `Unsupported importer format: ${extension || 'unknown'}.`)
}
