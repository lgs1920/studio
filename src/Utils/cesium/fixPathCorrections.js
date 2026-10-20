/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fixPathCorrections.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

const EARTH_RADIUS_METERS = 6371008.8
export const DEFAULT_FIX_PATH_SEGMENT_METERS = 500

const fixPathContentCache = new WeakMap()

const numericValue = value => value !== null
    && value !== undefined
    && !(typeof value === 'string' && value.trim() === '')
    && Number.isFinite(Number(value))

const coordinateIsValid = coordinate => Array.isArray(coordinate)
    && coordinate.length >= 2
    && numericValue(coordinate[0])
    && numericValue(coordinate[1])
    && Math.abs(Number(coordinate[0])) <= 180
    && Math.abs(Number(coordinate[1])) <= 90

/**
 * Read and bound the user's maximum correction section length.
 *
 * @returns {number} Maximum allowed source route length in metres.
 */
export const getMaxFixPathSegmentMeters = (settingValue = globalThis.lgs?.settings?.journey?.fixPathMaxSegmentMeters) => {
    const configured = Number(settingValue)
    if (!Number.isFinite(configured) || configured <= 0) {
        return DEFAULT_FIX_PATH_SEGMENT_METERS
    }
    return Math.min(5000, Math.max(50, configured))
}

/**
 * Normalize the identity of the section currently open in the Fix Path editor.
 *
 * @param {*} value - Persisted active-section identity.
 * @returns {{trackSlug: string, correctionId: string}|null} Valid identity or null.
 */
export const normalizeFixPathActiveSection = value => {
    const trackSlug = typeof value?.trackSlug === 'string' ? value.trackSlug.trim() : ''
    const correctionId = typeof value?.correctionId === 'string' ? value.correctionId.trim() : ''
    return trackSlug && correctionId ? {trackSlug, correctionId} : null
}

const normalizeCoordinate = coordinate => {
    if (!coordinateIsValid(coordinate)) {
        return null
    }
    const normalized = [Number(coordinate[0]), Number(coordinate[1])]
    if (coordinate.length >= 3 && numericValue(coordinate[2])) {
        normalized.push(Number(coordinate[2]))
    }
    return normalized
}

const getLineSegments = geometry => {
    if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        return [geometry.coordinates]
    }
    if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates
    }
    return null
}

const wrappedLongitudeDelta = (longitudeDelta) => {
    if (longitudeDelta > 180) {
        return longitudeDelta - 360
    }
    if (longitudeDelta < -180) {
        return longitudeDelta + 360
    }
    return longitudeDelta
}

const coordinateDistanceMeters = (first, second) => {
    if (!coordinateIsValid(first) || !coordinateIsValid(second)) {
        return Number.POSITIVE_INFINITY
    }

    const latitude1 = Number(first[1]) * Math.PI / 180
    const latitude2 = Number(second[1]) * Math.PI / 180
    const latitudeDelta = latitude2 - latitude1
    const longitudeDelta = wrappedLongitudeDelta(Number(second[0]) - Number(first[0])) * Math.PI / 180
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
    return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)))
}

const normalizeFixPathCorrection = correction => {
    const segmentIndex = Number(correction?.segmentIndex)
    const startIndex = Number(correction?.startIndex)
    const endIndex = Number(correction?.endIndex)
    const id = typeof correction?.id === 'string' ? correction.id.trim() : ''
    const sourceFingerprint = typeof correction?.sourceFingerprint === 'string'
        ? correction.sourceFingerprint.trim()
        : ''
    if (!id || !sourceFingerprint
        || !Number.isInteger(segmentIndex) || segmentIndex < 0
        || !Number.isInteger(startIndex) || startIndex < 0
        || !Number.isInteger(endIndex) || endIndex < startIndex
        || !Array.isArray(correction?.controlPoints) || correction.controlPoints.length === 0) {
        return null
    }

    const controlPoints = []
    const seenIds = new Set()
    for (const rawPoint of correction.controlPoints) {
        const pointId = typeof rawPoint?.id === 'string' ? rawPoint.id.trim() : ''
        const progress = Number(rawPoint?.progress)
        const coordinate = normalizeCoordinate(rawPoint?.coordinate)
        const sourcePoint = /^fix-point-(\d+)-(\d+)$/.exec(pointId)
        const sourceIndex = rawPoint?.sourceIndex !== null && rawPoint?.sourceIndex !== undefined
            && Number.isInteger(Number(rawPoint.sourceIndex))
            ? Number(rawPoint.sourceIndex)
            : sourcePoint ? Number(sourcePoint[2]) : undefined
        if (!pointId || seenIds.has(pointId) || !Number.isFinite(progress) || progress < 0 || progress > 1 || !coordinate
            || (sourceIndex !== undefined && sourceIndex < 0)) {
            return null
        }
        seenIds.add(pointId)
        controlPoints.push({
            id: pointId,
            progress,
            coordinate,
            ...(sourceIndex === undefined ? {} : {sourceIndex}),
            fixed: typeof rawPoint.fixed === 'boolean' ? rawPoint.fixed : true,
            removed: rawPoint.removed === true,
            ...(rawPoint.erased === true ? {erased: true} : {}),
        })
    }
    controlPoints.sort((first, second) => first.progress - second.progress
        || (first.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (second.sourceIndex ?? Number.MAX_SAFE_INTEGER)
        || first.id.localeCompare(second.id))

    return {id, segmentIndex, startIndex, endIndex, sourceFingerprint, controlPoints}
}

/**
 * Normalize persisted path edits without changing their source coordinates.
 *
 * @param {*} value - Stored Journey path correction data.
 * @returns {{revision: number, tracks: object, currentSection?: {trackSlug: string, correctionId: string}}|null} Normalized data or null.
 */
export const normalizeFixPathCorrectionData = value => {
    if (!value || typeof value !== 'object' || !value.tracks || typeof value.tracks !== 'object' || Array.isArray(value.tracks)) {
        return null
    }

    const tracks = {}
    for (const [trackSlug, rawCorrections] of Object.entries(value.tracks)) {
        if (!trackSlug || !Array.isArray(rawCorrections)) {
            return null
        }
        const normalizedCorrections = rawCorrections.map(normalizeFixPathCorrection)
        if (normalizedCorrections.some(correction => !correction)) {
            return null
        }
        const corrections = normalizedCorrections
        corrections.sort((first, second) => first.segmentIndex - second.segmentIndex || first.startIndex - second.startIndex)
        if (corrections.some((correction, index) => {
            const previous = corrections[index - 1]
            return previous
                && previous.segmentIndex === correction.segmentIndex
                && previous.endIndex >= correction.startIndex
        })) {
            return null
        }
        tracks[trackSlug] = corrections
    }

    const currentSection = normalizeFixPathActiveSection(value.currentSection)
    const activeSectionExists = currentSection
        && tracks[currentSection.trackSlug]?.some(correction => correction.id === currentSection.correctionId)

    return {
        revision: Number.isInteger(Number(value.revision)) && Number(value.revision) >= 0 ? Number(value.revision) : 0,
        tracks,
        ...(activeSectionExists ? {currentSection} : {}),
    }
}

/**
 * Calculate the route distance covered by a source index interval.
 *
 * @param {object} content - Source track feature.
 * @param {number} segmentIndex - Geometry segment index.
 * @param {number} startIndex - First included coordinate index.
 * @param {number} endIndex - Last included coordinate index.
 * @returns {number} Distance in metres, or Infinity for invalid input.
 */
export const getFixPathSegmentDistanceMeters = (content, segmentIndex, startIndex, endIndex) => {
    const segments = getLineSegments(content?.geometry)
    const segment = segments?.[segmentIndex]
    if (!Array.isArray(segment) || !Number.isInteger(startIndex) || !Number.isInteger(endIndex)
        || startIndex < 0 || endIndex < startIndex || endIndex >= segment.length) {
        return Number.POSITIVE_INFINITY
    }

    let distance = 0
    for (let index = startIndex + 1; index <= endIndex; index += 1) {
        distance += coordinateDistanceMeters(segment[index - 1], segment[index])
    }
    return distance
}

const fingerprintCoordinates = coordinates => {
    const source = JSON.stringify(coordinates)
    let firstHash = 2166136261
    let secondHash = 5381
    for (let index = 0; index < source.length; index += 1) {
        const code = source.charCodeAt(index)
        firstHash = Math.imul(firstHash ^ code, 16777619)
        secondHash = Math.imul(secondHash, 33) ^ code
    }
    return `${coordinates.length}:${(firstHash >>> 0).toString(16)}:${(secondHash >>> 0).toString(16)}`
}

/**
 * Fingerprint the source coordinates covered by one edit.
 *
 * @param {object} content - Source track feature.
 * @param {number} segmentIndex - Geometry segment index.
 * @param {number} startIndex - First included coordinate index.
 * @param {number} endIndex - Last included coordinate index.
 * @returns {string|null} Stable fingerprint or null for invalid input.
 */
export const getFixPathSourceFingerprint = (content, segmentIndex, startIndex, endIndex) => {
    const segment = getLineSegments(content?.geometry)?.[segmentIndex]
    if (!Array.isArray(segment) || !Number.isInteger(startIndex) || !Number.isInteger(endIndex)
        || startIndex < 0 || endIndex < startIndex || endIndex >= segment.length) {
        return null
    }
    return fingerprintCoordinates(segment.slice(startIndex, endIndex + 1))
}

const correctionSourceIndex = (point, segmentIndex) => {
    if (Number.isInteger(point?.sourceIndex)) {
        return point.sourceIndex
    }
    const match = /^fix-point-(\d+)-(\d+)$/.exec(point?.id ?? '')
    return match && Number(match[1]) === segmentIndex ? Number(match[2]) : null
}

const correctionProgressAtIndex = (content, segmentIndex, startIndex, endIndex, index) => {
    if (index <= startIndex) return 0
    if (index >= endIndex) return 1
    const totalDistance = getFixPathSegmentDistanceMeters(content, segmentIndex, startIndex, endIndex)
    if (!Number.isFinite(totalDistance) || totalDistance <= 0) {
        return (index - startIndex) / (endIndex - startIndex)
    }
    const partialDistance = getFixPathSegmentDistanceMeters(content, segmentIndex, startIndex, index)
    return Math.min(1, Math.max(0, partialDistance / totalDistance))
}

/**
 * Merge correction sections whose source vertices are directly adjacent.
 * @param {object} content - Source track GeoJSON feature.
 * @param {Array<object>} corrections - Track correction sections.
 * @returns {Array<object>} Sections with contiguous neighbors merged.
 */
export const mergeAdjacentFixPathCorrections = (content, corrections = []) => {
    const segments = getLineSegments(content?.geometry)
    if (!Array.isArray(corrections) || corrections.length < 2 || !segments) {
        return corrections
    }

    const ordered = [...corrections].sort((first, second) => (
        first.segmentIndex - second.segmentIndex || first.startIndex - second.startIndex
    ))
    const merged = []

    for (const correction of ordered) {
        const previous = merged.at(-1)
        const isAdjacent = previous
            && previous.segmentIndex === correction.segmentIndex
            && correction.startIndex === previous.endIndex + 1
        const segment = segments[correction.segmentIndex]
        if (!isAdjacent
            || !Array.isArray(segment)
            || getFixPathSourceFingerprint(content, correction.segmentIndex, correction.startIndex, correction.endIndex)
                !== correction.sourceFingerprint
            || getFixPathSourceFingerprint(content, previous.segmentIndex, previous.startIndex, previous.endIndex)
                !== previous.sourceFingerprint) {
            merged.push(correction)
            continue
        }

        const startIndex = previous.startIndex
        const endIndex = correction.endIndex
        const totalDistance = getFixPathSegmentDistanceMeters(content, correction.segmentIndex, startIndex, endIndex)
        const sourcePoints = new Map()
        const manualPoints = []
        for (const section of [previous, correction]) {
            const sectionDistance = getFixPathSegmentDistanceMeters(
                content,
                correction.segmentIndex,
                section.startIndex,
                section.endIndex,
            )
            const distanceBeforeSection = getFixPathSegmentDistanceMeters(
                content,
                correction.segmentIndex,
                startIndex,
                section.startIndex,
            )
            for (const point of section.controlPoints ?? []) {
                const sourceIndex = correctionSourceIndex(point, correction.segmentIndex)
                if (sourceIndex !== null && sourceIndex >= startIndex && sourceIndex <= endIndex) {
                    sourcePoints.set(sourceIndex, point)
                    continue
                }

                const offset = Number.isFinite(totalDistance) && totalDistance > 0
                    ? distanceBeforeSection + Number(point.progress) * sectionDistance
                    : section.startIndex - startIndex + Number(point.progress) * (section.endIndex - section.startIndex)
                const fallbackDistance = endIndex - startIndex
                manualPoints.push({
                    ...point,
                    progress: Number.isFinite(totalDistance) && totalDistance > 0
                        ? Math.min(0.999999, Math.max(0.000001, offset / totalDistance))
                        : fallbackDistance > 0
                            ? Math.min(0.999999, Math.max(0.000001, offset / fallbackDistance))
                            : 0.5,
                })
            }
        }

        const members = []
        for (let index = startIndex; index <= endIndex; index += 1) {
            const existing = sourcePoints.get(index)
            members.push({
                ...existing,
                id: existing?.id ?? 'fix-point-' + correction.segmentIndex + '-' + index,
                sourceIndex: index,
                progress: correctionProgressAtIndex(content, correction.segmentIndex, startIndex, endIndex, index),
                coordinate: existing?.coordinate ?? segment[index],
                fixed: typeof existing?.fixed === 'boolean' ? existing.fixed : existing !== undefined,
                removed: existing?.removed === true,
            })
        }

        merged[merged.length - 1] = {
            ...previous,
            endIndex,
            sourceFingerprint: getFixPathSourceFingerprint(content, correction.segmentIndex, startIndex, endIndex),
            controlPoints: [...members, ...manualPoints].sort((first, second) => first.progress - second.progress
                || (first.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (second.sourceIndex ?? Number.MAX_SAFE_INTEGER)
                || first.id.localeCompare(second.id)),
        }
    }

    return merged
}

const localCoordinates = (coordinate, origin) => {
    const latitudeRadians = origin[1] * Math.PI / 180
    const longitudeDelta = wrappedLongitudeDelta(coordinate[0] - origin[0]) * Math.PI / 180
    return {
        x: longitudeDelta * EARTH_RADIUS_METERS * Math.cos(latitudeRadians),
        y: (coordinate[1] - origin[1]) * Math.PI / 180 * EARTH_RADIUS_METERS,
    }
}

const geographicCoordinates = (point, origin) => {
    const latitudeRadians = origin[1] * Math.PI / 180
    const cosine = Math.max(0.01, Math.cos(latitudeRadians))
    return [
        origin[0] + point.x / (EARTH_RADIUS_METERS * cosine) * 180 / Math.PI,
        origin[1] + point.y / EARTH_RADIUS_METERS * 180 / Math.PI,
    ]
}

const catmullRomPoint = (previous, first, second, next, progress) => {
    const tangentFirstX = (second.x - previous.x) / 2
    const tangentFirstY = (second.y - previous.y) / 2
    const tangentSecondX = (next.x - first.x) / 2
    const tangentSecondY = (next.y - first.y) / 2
    const t2 = progress * progress
    const t3 = t2 * progress
    return {
        x: (2 * t3 - 3 * t2 + 1) * first.x
            + (t3 - 2 * t2 + progress) * tangentFirstX
            + (-2 * t3 + 3 * t2) * second.x
            + (t3 - t2) * tangentSecondX,
        y: (2 * t3 - 3 * t2 + 1) * first.y
            + (t3 - 2 * t2 + progress) * tangentFirstY
            + (-2 * t3 + 3 * t2) * second.y
            + (t3 - t2) * tangentSecondY,
    }
}

const catmullRomScalar = (previous, first, second, next, progress) => {
    const tangentFirst = (second - previous) / 2
    const tangentSecond = (next - first) / 2
    const t2 = progress * progress
    const t3 = t2 * progress
    return (2 * t3 - 3 * t2 + 1) * first
        + (t3 - 2 * t2 + progress) * tangentFirst
        + (-2 * t3 + 3 * t2) * second
        + (t3 - t2) * tangentSecond
}

const applyCorrection = (sourceSegment, destinationSegment, correction, originCoordinate) => {
    const sourceCoordinates = sourceSegment.slice(correction.startIndex, correction.endIndex + 1)
    if (fingerprintCoordinates(sourceCoordinates) !== correction.sourceFingerprint) {
        return false
    }

    const sectionPoints = correction.controlPoints ?? []
    if (correction.startIndex === correction.endIndex) {
        const onlyPoint = sectionPoints.find(point => point.removed !== true)
        if (!onlyPoint || onlyPoint.fixed === false) {
            return null
        }
        destinationSegment[correction.startIndex] = [...onlyPoint.coordinate, ...sourceSegment[correction.startIndex].slice(3)]
        return true
    }

    const distance = getFixPathSegmentDistanceMeters(
        {geometry: {type: 'LineString', coordinates: sourceSegment}},
        0,
        correction.startIndex,
        correction.endIndex,
    )
    if (!Number.isFinite(distance) || distance > getMaxFixPathSegmentMeters()) {
        return false
    }

    const sourceDistanceAtIndex = [0]
    for (let index = correction.startIndex + 1; index <= correction.endIndex; index += 1) {
        sourceDistanceAtIndex.push(sourceDistanceAtIndex.at(-1)
            + coordinateDistanceMeters(sourceSegment[index - 1], sourceSegment[index]))
    }
    const sourceDistanceTotal = sourceDistanceAtIndex.at(-1)
    if (!Number.isFinite(sourceDistanceTotal) || sourceDistanceTotal <= 0) {
        return false
    }

    const sourceHeightAtProgress = progress => {
        const distance = progress * sourceDistanceTotal
        for (let offset = 1; offset < sourceDistanceAtIndex.length; offset += 1) {
            if (distance > sourceDistanceAtIndex[offset]) {
                continue
            }
            const rawFirstHeight = sourceSegment[correction.startIndex + offset - 1]?.[2]
            const rawSecondHeight = sourceSegment[correction.startIndex + offset]?.[2]
            const firstHeight = numericValue(rawFirstHeight) ? Number(rawFirstHeight) : Number.NaN
            const secondHeight = numericValue(rawSecondHeight) ? Number(rawSecondHeight) : Number.NaN
            const interval = sourceDistanceAtIndex[offset] - sourceDistanceAtIndex[offset - 1]
            const localProgress = interval > 0 ? (distance - sourceDistanceAtIndex[offset - 1]) / interval : 0
            if (Number.isFinite(firstHeight) && Number.isFinite(secondHeight)) {
                return firstHeight + (secondHeight - firstHeight) * localProgress
            }
            if (Number.isFinite(firstHeight)) return firstHeight
            if (Number.isFinite(secondHeight)) return secondHeight
            return null
        }
        const rawEndHeight = sourceSegment[correction.endIndex]?.[2]
        return numericValue(rawEndHeight) ? Number(rawEndHeight) : null
    }
    const startMember = sectionPoints.find(point => point.progress === 0 && point.removed !== true)
    const endMember = sectionPoints.find(point => point.progress === 1 && point.removed !== true)
    const fixedPoints = sectionPoints.filter(point => point.fixed !== false
        && point.removed !== true && point.progress > 0 && point.progress < 1)
    const movedStart = startMember?.fixed === true
        && startMember.coordinate.some((value, index) => value !== sourceSegment[correction.startIndex]?.[index])
    const movedEnd = endMember?.fixed === true
        && endMember.coordinate.some((value, index) => value !== sourceSegment[correction.endIndex]?.[index])
    if (fixedPoints.length === 0 && !movedStart && !movedEnd) {
        return null
    }
    const rawAnchors = [
        {
            progress: 0,
            coordinate: movedStart ? startMember.coordinate : sourceSegment[correction.startIndex],
        },
        ...fixedPoints,
        {
            progress: 1,
            coordinate: movedEnd ? endMember.coordinate : sourceSegment[correction.endIndex],
        },
    ].sort((first, second) => first.progress - second.progress)
    const uniqueAnchors = rawAnchors.reduce((result, anchor) => {
        const previous = result.at(-1)
        if (previous && Math.abs(previous.progress - anchor.progress) < 1e-9) {
            result[result.length - 1] = anchor
        }
        else {
            result.push(anchor)
        }
        return result
    }, [])
    const anchors = uniqueAnchors.map(anchor => {
        const rawCoordinateHeight = anchor.coordinate?.[2]
        const coordinateHeight = numericValue(rawCoordinateHeight) ? Number(rawCoordinateHeight) : Number.NaN
        const fallbackHeight = sourceHeightAtProgress(anchor.progress)
        return {
            progress: anchor.progress,
            point: localCoordinates(anchor.coordinate, originCoordinate),
            height: Number.isFinite(coordinateHeight) ? coordinateHeight : fallbackHeight,
        }
    })
    const anchorAt = progress => {
        let anchorIndex = anchors.findIndex((anchor, index) => index < anchors.length - 1
            && progress >= anchor.progress && progress <= anchors[index + 1].progress)
        if (anchorIndex < 0) {
            anchorIndex = anchors.length - 2
        }
        const first = anchors[anchorIndex]
        const second = anchors[anchorIndex + 1]
        const previous = anchors[Math.max(0, anchorIndex - 1)].point
        const next = anchors[Math.min(anchors.length - 1, anchorIndex + 2)].point
        const localProgress = (progress - first.progress) / (second.progress - first.progress)
        const point = catmullRomPoint(previous, first.point, second.point, next, localProgress)
        const previousHeight = anchors[Math.max(0, anchorIndex - 1)].height
        const nextHeight = anchors[Math.min(anchors.length - 1, anchorIndex + 2)].height
        const height = [previousHeight, first.height, second.height, nextHeight].every(Number.isFinite)
            ? catmullRomScalar(previousHeight, first.height, second.height, nextHeight, localProgress)
            : Number.isFinite(first.height) && Number.isFinite(second.height)
                ? first.height + (second.height - first.height) * localProgress
                : null
        return {point, height}
    }

    for (let index = correction.startIndex; index <= correction.endIndex; index += 1) {
        const distanceAtIndex = sourceDistanceAtIndex[index - correction.startIndex]
        const progress = sourceDistanceTotal > 0 ? distanceAtIndex / sourceDistanceTotal : 0
        const coordinate = sourceSegment[index]
        const corrected = anchorAt(progress)
        const correctedCoordinate = geographicCoordinates(corrected.point, originCoordinate)
        const member = sectionPoints.find(point => point.sourceIndex === index
            || point.id === 'fix-point-' + correction.segmentIndex + '-' + index)
        const fixedAtIndex = member?.fixed !== false && member?.removed !== true
        const outputCoordinate = fixedAtIndex && member ? member.coordinate : correctedCoordinate
        const rawOutputHeight = fixedAtIndex ? member?.coordinate?.[2] : corrected.height
        const outputHeight = numericValue(rawOutputHeight) ? Number(rawOutputHeight) : corrected.height
        destinationSegment[index] = Number.isFinite(outputHeight)
            ? [outputCoordinate[0], outputCoordinate[1], outputHeight, ...coordinate.slice(3)]
            : [outputCoordinate[0], outputCoordinate[1], ...coordinate.slice(2)]
    }
    return true
}

/**
 * Apply local Bezier-like path edits to position and, when available, altitude.
 *
 * @param {object} content - Source track GeoJSON feature.
 * @param {Array<object>} corrections - Corrections for one track.
 * @returns {{content: object, changed: boolean, skippedCorrectionIds: Array<string>}} Result.
 */
export const applyFixPathCorrections = (content, corrections = []) => {
    if (!Array.isArray(corrections) || corrections.length === 0) {
        return {content, changed: false, skippedCorrectionIds: []}
    }
    const sourceSegments = getLineSegments(content?.geometry)
    if (!sourceSegments) {
        return {content, changed: false, skippedCorrectionIds: corrections.map(correction => correction.id)}
    }

    const outputSegments = sourceSegments.slice()
    const copiedSegments = new Set()
    const skippedCorrectionIds = []
    let changed = false
    const effectiveCorrections = mergeAdjacentFixPathCorrections(content, corrections)
    for (const correction of effectiveCorrections) {
        const sourceSegment = sourceSegments[correction.segmentIndex]
        if (!Array.isArray(sourceSegment)
            || correction.startIndex < 0
            || correction.endIndex >= sourceSegment.length
            || !correction.controlPoints?.length
            || getFixPathSegmentDistanceMeters(content, correction.segmentIndex, correction.startIndex, correction.endIndex)
                > getMaxFixPathSegmentMeters()) {
            skippedCorrectionIds.push(correction.id)
            continue
        }

        if (!copiedSegments.has(correction.segmentIndex)) {
            outputSegments[correction.segmentIndex] = sourceSegment.slice()
            copiedSegments.add(correction.segmentIndex)
        }
        const destination = outputSegments[correction.segmentIndex]
        const originCoordinate = sourceSegment[correction.startIndex]
        const applied = applyCorrection(sourceSegment, destination, correction, originCoordinate)
        if (applied === false) {
            skippedCorrectionIds.push(correction.id)
            continue
        }
        changed = changed || applied === true
    }

    if (!changed) {
        return {content, changed: false, skippedCorrectionIds}
    }

    return {
        content: {
            ...content,
            geometry: {
                ...content.geometry,
                coordinates: content.geometry.type === 'LineString' ? outputSegments[0] : outputSegments,
            },
        },
        changed: true,
        skippedCorrectionIds,
    }
}

const journeyForTrack = track => {
    if (track?.parent && typeof track.parent === 'object') {
        return track.parent
    }
    return globalThis.lgs?.getJourneyBySlug?.(track?.parent)
        ?? globalThis.lgs?.journeys?.get?.(track?.parent)
        ?? null
}

/**
 * Return the effective track feature, applying the Journey's saved local edits when enabled.
 *
 * @param {object} track - Track whose effective GeoJSON is requested.
 * @returns {object|null} Corrected or source track content.
 */
export const getCorrectedTrackContent = track => {
    const journey = journeyForTrack(track)
    const data = journey?.fixPathCorrectionData
    const corrections = journey?.fixPathEnabled === true ? data?.tracks?.[track?.slug] : null
    if (!Array.isArray(corrections) || corrections.length === 0) {
        return track?.content ?? null
    }

    const cached = track && typeof track === 'object' ? fixPathContentCache.get(track) : null
    if (cached?.journey === journey
        && cached.data === data
        && cached.sourceContent === track?.content
        && cached.corrections === corrections) {
        return cached.content
    }

    const result = applyFixPathCorrections(track.content, corrections)
    if (track && typeof track === 'object') {
        fixPathContentCache.set(track, {
            journey,
            data,
            sourceContent: track.content,
            corrections,
            content: result.content,
        })
    }
    return result.content
}

/**
 * Return a compact change key for cached Replay samplers and rendered tracks.
 *
 * @param {object} journey - Journey containing the path edit state.
 * @returns {string} Stable key for its current correction revision and enabled state.
 */
export const fixPathRevisionKey = journey => (
    `${journey?.fixPathEnabled === true ? 1 : 0}:${Number(journey?.fixPathCorrectionData?.revision) || 0}`
)
