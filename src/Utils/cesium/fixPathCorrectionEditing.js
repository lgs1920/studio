/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fixPathCorrectionEditing.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    getFixPathSegmentDistanceMeters,
    getFixPathSourceFingerprint,
    getMaxFixPathSegmentMeters,
} from '@Utils/cesium/fixPathCorrections'

const getLineSegments = geometry => {
    if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        return [geometry.coordinates]
    }
    if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates
    }
    return []
}

const makeId = () => globalThis.crypto?.randomUUID?.()
    ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)

const correctionAtPoint = (corrections, segmentIndex, index) => corrections.find(correction => (
    correction.segmentIndex === segmentIndex && index >= correction.startIndex && index <= correction.endIndex
))

const distanceBetweenIndices = (content, segmentIndex, firstIndex, secondIndex) => firstIndex === secondIndex
    ? 0
    : getFixPathSegmentDistanceMeters(content, segmentIndex, firstIndex, secondIndex)

const progressAtIndex = (content, segmentIndex, startIndex, endIndex, index) => {
    if (index <= startIndex) return 0
    if (index >= endIndex) return 1
    const totalDistance = distanceBetweenIndices(content, segmentIndex, startIndex, endIndex)
    if (!Number.isFinite(totalDistance) || totalDistance <= 0) {
        return (index - startIndex) / (endIndex - startIndex)
    }
    const partialDistance = distanceBetweenIndices(content, segmentIndex, startIndex, index)
    return Math.min(1, Math.max(0, partialDistance / totalDistance))
}

const normalizeControlCoordinate = coordinate => {
    if (!Array.isArray(coordinate)) {
        return coordinate
    }
    const normalized = [...coordinate]
    if (normalized.length >= 3 && normalized[2] !== null && normalized[2] !== undefined
        && Number.isFinite(Number(normalized[2]))) {
        normalized[2] = Math.round(Number(normalized[2]))
    }
    return normalized
}

const longitudeOffsetDegrees = offset => ((offset + 180) % 360 + 360) % 360 - 180

/**
 * Translate selected control points by the offset of the point being dragged.
 * @param {Array<object>} selectedPoints - Selected control points with coordinates.
 * @param {object} draggedPoint - Track and control point identifiers for the anchor.
 * @param {Array<number>} coordinate - New longitude, latitude, and height for the anchor.
 * @returns {Array<object>} Selected points with translated coordinates.
 */
export const translateFixPathControlPoints = (selectedPoints, draggedPoint, coordinate) => {
    const origin = selectedPoints.find(point => point.trackSlug === draggedPoint.trackSlug
        && point.controlPointId === draggedPoint.controlPointId)
    if (!origin) {
        return []
    }
    const longitudeOffset = longitudeOffsetDegrees(Number(coordinate[0]) - Number(origin.coordinate[0]))
    const latitudeOffset = Number(coordinate[1]) - Number(origin.coordinate[1])
    const heightOffset = Math.round(Number(coordinate[2] ?? 0) - Number(origin.coordinate[2] ?? 0))
    return selectedPoints.map(point => {
        const translated = normalizeControlCoordinate(point.coordinate) ?? [...point.coordinate]
        while (translated.length < 3) translated.push(0)
        translated[0] = longitudeOffsetDegrees(Number(translated[0]) + longitudeOffset)
        translated[1] = Math.max(-90, Math.min(90, Number(translated[1]) + latitudeOffset))
        translated[2] = Math.round(Number(translated[2]) + heightOffset)
        return {...point, coordinate: translated, fixed: true, removed: false}
    })
}

const sortCorrections = corrections => corrections.sort((first, second) => (
    first.segmentIndex - second.segmentIndex || first.startIndex - second.startIndex
))

const sourceIndexOf = point => {
    if (Number.isInteger(point?.sourceIndex)) return point.sourceIndex
    const match = /^fix-point-(\d+)-(\d+)$/.exec(point?.id ?? '')
    return match ? Number(match[2]) : null
}

const remapManualProgress = (content, segmentIndex, correction, point, startIndex, endIndex) => {
    const oldDistance = distanceBetweenIndices(content, segmentIndex, correction.startIndex, correction.endIndex)
    const beforeDistance = distanceBetweenIndices(content, segmentIndex, startIndex, correction.startIndex)
    const newDistance = distanceBetweenIndices(content, segmentIndex, startIndex, endIndex)
    const oldLength = correction.endIndex - correction.startIndex
    const newLength = endIndex - startIndex
    const offset = Number.isFinite(oldDistance) && oldDistance > 0
        ? beforeDistance + point.progress * oldDistance
        : correction.startIndex - startIndex + point.progress * oldLength
    const total = Number.isFinite(newDistance) && newDistance > 0 ? newDistance : newLength
    return total > 0 ? Math.min(0.999999, Math.max(0.000001, offset / total)) : 0.5
}

/**
 * Build or extend one correction section and retain each source point in its bounds.
 * Sections crossed by the selected interval or directly adjacent to it are merged.
 * @param {object} content - Track content.
 * @param {Array<object>} corrections - Existing correction sections.
 * @param {number} segmentIndex - Geometry segment index.
 * @param {number} startIndex - First selected source point.
 * @param {number} endIndex - Last selected source point.
 * @param {Array<object>} addedPoints - New manually placed or dragged points.
 * @returns {{corrections: Array<object>, correction?: object, error?: string}} Updated sections.
 */
export const buildFixPathSection = (content, corrections, segmentIndex, startIndex, endIndex, addedPoints = []) => {
    const segments = getLineSegments(content?.geometry)
    const segment = segments[segmentIndex]
    if (!Array.isArray(segment) || startIndex < 0 || endIndex < startIndex || endIndex >= segment.length) {
        return {corrections, error: 'The selected route section is no longer available.'}
    }

    let mergedStart = startIndex
    let mergedEnd = endIndex
    const touchedIds = new Set()
    let expanded = true
    while (expanded) {
        expanded = false
        corrections.forEach(correction => {
            const overlapsSelection = correction.startIndex <= mergedEnd && correction.endIndex >= mergedStart
            const isAdjacent = correction.endIndex === mergedStart - 1 || correction.startIndex === mergedEnd + 1
            const hasCurrentFingerprint = getFixPathSourceFingerprint(
                content,
                correction.segmentIndex,
                correction.startIndex,
                correction.endIndex,
            ) === correction.sourceFingerprint
            if (correction.segmentIndex !== segmentIndex || touchedIds.has(correction.id)
                || (!overlapsSelection && !(isAdjacent && hasCurrentFingerprint))) {
                return
            }
            touchedIds.add(correction.id)
            mergedStart = Math.min(mergedStart, correction.startIndex)
            mergedEnd = Math.max(mergedEnd, correction.endIndex)
            expanded = true
        })
    }

    const distance = getFixPathSegmentDistanceMeters(content, segmentIndex, mergedStart, mergedEnd)
    if (!Number.isFinite(distance) || distance > getMaxFixPathSegmentMeters()) {
        return {
            corrections,
            error: 'This edit spans ' + Math.round(distance) + ' m. Increase the Fix Path limit in application settings or use a denser nearby section.',
        }
    }

    const sourceFingerprint = getFixPathSourceFingerprint(content, segmentIndex, mergedStart, mergedEnd)
    if (!sourceFingerprint) {
        return {corrections, error: 'The selected route section is no longer available.'}
    }

    const pointsById = new Map()
    for (let index = mergedStart; index <= mergedEnd; index += 1) {
        const id = 'fix-point-' + segmentIndex + '-' + index
        pointsById.set(id, {
            id,
            sourceIndex: index,
            progress: progressAtIndex(content, segmentIndex, mergedStart, mergedEnd, index),
            coordinate: normalizeControlCoordinate(segment[index]),
            fixed: false,
            removed: false,
        })
    }

    corrections.filter(correction => touchedIds.has(correction.id)).forEach(correction => {
        correction.controlPoints.forEach(point => {
            const sourceIndex = sourceIndexOf(point)
            if (sourceIndex !== null && sourceIndex >= mergedStart && sourceIndex <= mergedEnd) {
                const id = 'fix-point-' + segmentIndex + '-' + sourceIndex
                pointsById.set(id, {
                    ...pointsById.get(id),
                    ...point,
                    id,
                    sourceIndex,
                    progress: progressAtIndex(content, segmentIndex, mergedStart, mergedEnd, sourceIndex),
                    coordinate: normalizeControlCoordinate(point.coordinate),
                    fixed: point.fixed !== false,
                    removed: point.removed === true,
                })
                return
            }

            const remapped = {
                ...point,
                sourceIndex: undefined,
                progress: remapManualProgress(content, segmentIndex, correction, point, mergedStart, mergedEnd),
                coordinate: normalizeControlCoordinate(point.coordinate),
                fixed: point.fixed !== false,
                removed: point.removed === true,
            }
            pointsById.set(point.id, remapped)
        })
    })

    const selectedDistance = distanceBetweenIndices(content, segmentIndex, startIndex, endIndex)
    const beforeSelectedDistance = distanceBetweenIndices(content, segmentIndex, mergedStart, startIndex)
    const mergedDistance = distanceBetweenIndices(content, segmentIndex, mergedStart, mergedEnd)
    addedPoints.forEach(point => {
        const sourceIndex = sourceIndexOf(point)
        if (sourceIndex !== null && sourceIndex >= mergedStart && sourceIndex <= mergedEnd) {
            const id = 'fix-point-' + segmentIndex + '-' + sourceIndex
            const previous = pointsById.get(id)
            pointsById.set(id, {
                ...previous,
                ...point,
                id,
                sourceIndex,
                progress: progressAtIndex(content, segmentIndex, mergedStart, mergedEnd, sourceIndex),
                coordinate: normalizeControlCoordinate(point.coordinate),
                fixed: true,
                removed: false,
            })
            return
        }

        const localProgress = Math.min(1, Math.max(0, Number(point.progress) || 0.5))
        const offset = Number.isFinite(selectedDistance) && selectedDistance > 0
            ? beforeSelectedDistance + selectedDistance * localProgress
            : startIndex - mergedStart + (endIndex - startIndex) * localProgress
        const total = Number.isFinite(mergedDistance) && mergedDistance > 0
            ? mergedDistance
            : mergedEnd - mergedStart
        pointsById.set(point.id, {
            ...point,
            progress: total > 0 ? Math.min(0.999999, Math.max(0.000001, offset / total)) : 0.5,
            coordinate: normalizeControlCoordinate(point.coordinate),
            fixed: true,
            removed: false,
        })
    })

    const controlPoints = Array.from(pointsById.values()).sort((first, second) => first.progress - second.progress
        || (first.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (second.sourceIndex ?? Number.MAX_SAFE_INTEGER)
        || first.id.localeCompare(second.id))
    const firstTouched = corrections.find(correction => touchedIds.has(correction.id))
    const correction = {
        id: firstTouched?.id ?? makeId(),
        segmentIndex,
        startIndex: mergedStart,
        endIndex: mergedEnd,
        sourceFingerprint,
        controlPoints,
    }
    const retained = corrections.filter(item => !touchedIds.has(item.id))
    return {corrections: sortCorrections([...retained, correction]), correction}
}

/**
 * Add a moved route vertex to its section or create a small section around it.
 * @param {object} content - Track content.
 * @param {Array<object>} corrections - Track correction list.
 * @param {number} segmentIndex - Geometry segment index.
 * @param {number} index - Source vertex index.
 * @param {Array<number>} coordinate - New longitude, latitude, and height.
 * @returns {{corrections: Array<object>, error?: string}} Updated sections.
 */
export const buildDraggedPointCorrections = (content, corrections, segmentIndex, index, coordinate) => {
    const movedCoordinate = normalizeControlCoordinate(coordinate)
    const existing = correctionAtPoint(corrections, segmentIndex, index)
    const controlId = 'fix-point-' + segmentIndex + '-' + index
    if (existing) {
        const progress = progressAtIndex(content, segmentIndex, existing.startIndex, existing.endIndex, index)
        const found = existing.controlPoints.some(point => sourceIndexOf(point) === index)
        const controlPoints = found
            ? existing.controlPoints.map(point => sourceIndexOf(point) === index
                ? {...point, id: controlId, sourceIndex: index, progress, coordinate: movedCoordinate, fixed: true, removed: false}
                : point)
            : [...existing.controlPoints, {
                id: controlId,
                sourceIndex: index,
                progress,
                coordinate: movedCoordinate,
                fixed: true,
                removed: false,
            }]
        return {
            corrections: corrections.map(correction => correction.id === existing.id
                ? {...correction, controlPoints: controlPoints.sort((first, second) => first.progress - second.progress)}
                : correction),
        }
    }

    const segment = getLineSegments(content?.geometry)[segmentIndex]
    if (!Array.isArray(segment) || index < 0 || index >= segment.length) {
        return {corrections, error: 'The selected route point is no longer available.'}
    }
    const startIndex = Math.max(0, index - 1)
    const endIndex = Math.min(segment.length - 1, index + 1)
    return buildFixPathSection(content, corrections, segmentIndex, startIndex, endIndex, [{
        id: controlId,
        sourceIndex: index,
        coordinate: movedCoordinate,
    }])
}
