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
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    createFixPathDistanceIndex,
    getNearestFixPathSourcePosition,
    getFixPathSegmentDistanceMeters,
    getFixPathSourceFingerprint,
    normalizeFixPathManualControlProgress,
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

const progressAtIndex = (startIndex, endIndex, index, distanceIndex) => {
    if (index <= startIndex) return 0
    if (index >= endIndex) return 1
    return distanceIndex?.progressAtIndex(index)
        ?? (index - startIndex) / (endIndex - startIndex)
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
 * @param {Array<object>} selectedPoints - Selected control points with coordinates; removed points are ignored.
 * @param {object} draggedPoint - Track and control point identifiers for the anchor.
 * @param {Array<number>} coordinate - New longitude, latitude, and height for the anchor.
 * @returns {Array<object>} Selected points with translated coordinates.
 */
export const translateFixPathControlPoints = (selectedPoints, draggedPoint, coordinate) => {
    const movablePoints = selectedPoints.filter(point => point && point.removed !== true)
    const origin = movablePoints.find(point => point.trackSlug === draggedPoint.trackSlug
        && point.controlPointId === draggedPoint.controlPointId)
    if (!origin) {
        return []
    }
    const longitudeOffset = longitudeOffsetDegrees(Number(coordinate[0]) - Number(origin.coordinate[0]))
    const latitudeOffset = Number(coordinate[1]) - Number(origin.coordinate[1])
    const heightOffset = Math.round(Number(coordinate[2] ?? 0) - Number(origin.coordinate[2] ?? 0))
    return movablePoints.map(point => {
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

/**
 * Remove selected correction-point membership and split remaining source points at gaps.
 * @param {object} content - Source track feature.
 * @param {object} correction - Correction section to update.
 * @param {Set<string>} removedPointIds - Selected control-point identifiers.
 * @returns {Array<object>} Remaining contiguous correction sections.
 */
export const removeFixPathControlPointsFromSection = (content, correction, removedPointIds) => {
    const segment = getLineSegments(content?.geometry)[correction?.segmentIndex]
    if (!Array.isArray(segment) || !(removedPointIds instanceof Set)) {
        return []
    }

    const retainedSourcePoints = (correction.controlPoints ?? [])
        .filter(point => !removedPointIds.has(point.id))
        .map(point => ({point, sourceIndex: sourceIndexOf(point)}))
        .filter(({sourceIndex}) => Number.isInteger(sourceIndex)
            && sourceIndex >= correction.startIndex
            && sourceIndex <= correction.endIndex)
        .sort((first, second) => first.sourceIndex - second.sourceIndex)

    const erasedSourcePoints = (correction.controlPoints ?? [])
        .filter(point => removedPointIds.has(point.id))
        .map(point => ({point, sourceIndex: sourceIndexOf(point)}))
        .filter(({sourceIndex}) => Number.isInteger(sourceIndex)
            && sourceIndex >= correction.startIndex
            && sourceIndex <= correction.endIndex)
        .map(({point, sourceIndex}) => ({
            ...point,
            id: 'fix-point-' + correction.segmentIndex + '-' + sourceIndex,
            sourceIndex,
            fixed: false,
            removed: true,
            erased: true,
        }))

    const groups = []
    retainedSourcePoints.forEach(entry => {
        const group = groups.at(-1)
        if (!group || entry.sourceIndex !== group.at(-1).sourceIndex + 1) {
            groups.push([entry])
            return
        }
        group.push(entry)
    })
    const manualPoints = (correction.controlPoints ?? []).filter(point => (
        !removedPointIds.has(point.id) && sourceIndexOf(point) === null
    ))
    const sortControlPoints = points => points.sort((first, second) => first.progress - second.progress
        || (first.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (second.sourceIndex ?? Number.MAX_SAFE_INTEGER)
        || first.id.localeCompare(second.id))
    const pointProgressForSection = (sourceIndex, startIndex, endIndex) => startIndex === endIndex
        ? 0.5
        : Math.min(1, Math.max(0, (sourceIndex - startIndex) / (endIndex - startIndex)))

    if (groups.length === 0) {
        // An erased-only correction has no visible or editable points left. Drop
        // it instead of keeping a navigation entry made only of hidden tombstones.
        if (manualPoints.length === 0) {
            return []
        }
        return [{
            ...correction,
            controlPoints: sortControlPoints([
                ...manualPoints,
                ...erasedSourcePoints.map(point => ({
                    ...point,
                    progress: pointProgressForSection(point.sourceIndex, correction.startIndex, correction.endIndex),
                })),
            ]),
        }]
    }

    const cumulativeDistances = [0]
    for (let index = correction.startIndex + 1; index <= correction.endIndex; index += 1) {
        cumulativeDistances.push(cumulativeDistances.at(-1)
            + getFixPathSegmentDistanceMeters(content, correction.segmentIndex, index - 1, index))
    }
    const oldDistance = cumulativeDistances.at(-1)
    const distanceAtIndex = index => cumulativeDistances[index - correction.startIndex] ?? Number.POSITIVE_INFINITY
    const sourcePositionAtProgress = progress => {
        const targetDistance = Number(progress) * oldDistance
        if (!Number.isFinite(targetDistance) || !Number.isFinite(oldDistance) || oldDistance <= 0) {
            return correction.startIndex + Number(progress) * (correction.endIndex - correction.startIndex)
        }

        let low = 0
        let high = cumulativeDistances.length - 1
        while (low < high) {
            const middle = Math.floor((low + high) / 2)
            if (cumulativeDistances[middle] < targetDistance) low = middle + 1
            else high = middle
        }
        if (low === 0) return correction.startIndex
        const distanceBefore = cumulativeDistances[low - 1]
        const edgeDistance = cumulativeDistances[low] - distanceBefore
        const edgeProgress = edgeDistance > 0 ? (targetDistance - distanceBefore) / edgeDistance : 0
        return correction.startIndex + low - 1 + Math.min(1, Math.max(0, edgeProgress))
    }

    return groups.flatMap((group, groupIndex) => {
        const startIndex = group[0].sourceIndex
        const endIndex = group.at(-1).sourceIndex
        const sourceFingerprint = getFixPathSourceFingerprint(
            content,
            correction.segmentIndex,
            startIndex,
            endIndex,
        )
        if (!sourceFingerprint) {
            return []
        }

        const sectionDistance = distanceAtIndex(endIndex) - distanceAtIndex(startIndex)
        const progressForIndex = index => {
            if (startIndex === endIndex) return 0.5
            const distance = distanceAtIndex(index) - distanceAtIndex(startIndex)
            return Number.isFinite(sectionDistance) && sectionDistance > 0
                ? Math.min(1, Math.max(0, distance / sectionDistance))
                : (index - startIndex) / (endIndex - startIndex)
        }
        const points = group.map(({point, sourceIndex}) => ({...point, sourceIndex, progress: progressForIndex(sourceIndex)}))
        manualPoints.forEach(point => {
            const sourcePosition = sourcePositionAtProgress(point.progress)
            if (sourcePosition < startIndex || sourcePosition > endIndex) {
                return
            }
            const localIndex = Math.floor(sourcePosition)
            const fractionalDistance = sourcePosition - localIndex
            const wholeDistance = distanceAtIndex(localIndex) - distanceAtIndex(startIndex)
            const partialDistance = localIndex < endIndex
                ? fractionalDistance * (distanceAtIndex(localIndex + 1) - distanceAtIndex(localIndex))
                : 0
            const progress = Number.isFinite(sectionDistance) && sectionDistance > 0
                ? (wholeDistance + partialDistance) / sectionDistance
                : (sourcePosition - startIndex) / Math.max(1, endIndex - startIndex)
            points.push({...point, progress: Math.min(0.999999, Math.max(0.000001, progress))})
        })

        const erasedPointsForGroup = erasedSourcePoints.map(point => ({
            ...point,
            progress: pointProgressForSection(point.sourceIndex, startIndex, endIndex),
        }))

        return [{
            ...correction,
            id: groupIndex === 0 ? correction.id : makeId(),
            startIndex,
            endIndex,
            sourceFingerprint,
            controlPoints: sortControlPoints([...points, ...erasedPointsForGroup]),
        }]
    })
}

const remapManualProgress = (correction, point, startIndex, endIndex, oldDistance, beforeDistance, newDistance) => {
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

    const distanceIndex = createFixPathDistanceIndex(content, segmentIndex, mergedStart, mergedEnd)
    if (!Number.isFinite(distanceIndex?.totalDistance)) {
        return {corrections, error: 'The selected route section is no longer available.'}
    }
    const mergedDistance = distanceIndex.totalDistance

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
            progress: progressAtIndex(mergedStart, mergedEnd, index, distanceIndex),
            coordinate: normalizeControlCoordinate(segment[index]),
            fixed: false,
            removed: false,
        })
    }

    corrections.filter(correction => touchedIds.has(correction.id)).forEach(correction => {
        const oldDistance = distanceIndex.distanceBetween(correction.startIndex, correction.endIndex)
        const beforeDistance = distanceIndex.distanceBetween(mergedStart, correction.startIndex)
        correction.controlPoints.forEach(point => {
            const sourceIndex = sourceIndexOf(point)
            if (sourceIndex !== null && sourceIndex >= mergedStart && sourceIndex <= mergedEnd) {
                const id = 'fix-point-' + segmentIndex + '-' + sourceIndex
                pointsById.set(id, {
                    ...pointsById.get(id),
                    ...point,
                    id,
                    sourceIndex,
                    progress: progressAtIndex(mergedStart, mergedEnd, sourceIndex, distanceIndex),
                    coordinate: normalizeControlCoordinate(point.coordinate),
                    fixed: point.fixed !== false,
                    removed: point.removed === true,
                })
                return
            }

            const remapped = {
                ...point,
                sourceIndex: undefined,
                progress: remapManualProgress(
                    correction,
                    point,
                    mergedStart,
                    mergedEnd,
                    oldDistance,
                    beforeDistance,
                    mergedDistance,
                ),
                coordinate: normalizeControlCoordinate(point.coordinate),
                fixed: point.fixed !== false,
                removed: point.removed === true,
            }
            pointsById.set(point.id, remapped)
        })
    })

    const selectedDistance = distanceIndex.distanceBetween(startIndex, endIndex)
    const beforeSelectedDistance = distanceIndex.distanceBetween(mergedStart, startIndex)
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
                progress: progressAtIndex(mergedStart, mergedEnd, sourceIndex, distanceIndex),
                coordinate: normalizeControlCoordinate(point.coordinate),
                fixed: true,
                removed: false,
            })
            return
        }

        const inferredSourcePosition = getNearestFixPathSourcePosition(segment, point.coordinate, startIndex, endIndex)
        const sourcePosition = point.sourcePosition !== null && point.sourcePosition !== undefined
            && Number.isFinite(Number(point.sourcePosition))
            ? Number(point.sourcePosition)
            : inferredSourcePosition
        const boundedSourcePosition = Number.isFinite(sourcePosition)
            ? Math.min(endIndex, Math.max(startIndex, sourcePosition))
            : null
        const lowerIndex = boundedSourcePosition === null
            ? null
            : Math.min(endIndex, Math.floor(boundedSourcePosition))
        const sourceDistanceAtPoint = lowerIndex === null
            ? null
            : distanceIndex.distanceAtIndex(lowerIndex)
                + (lowerIndex < endIndex
                    ? (distanceIndex.distanceAtIndex(lowerIndex + 1) - distanceIndex.distanceAtIndex(lowerIndex))
                        * (boundedSourcePosition - lowerIndex)
                    : 0)
        const localProgress = Number.isFinite(sourceDistanceAtPoint) && selectedDistance > 0
            ? Math.min(1, Math.max(0, (sourceDistanceAtPoint - beforeSelectedDistance) / selectedDistance))
            : Math.min(1, Math.max(0, Number(point.progress) || 0.5))
        const offset = Number.isFinite(selectedDistance) && selectedDistance > 0
            ? beforeSelectedDistance + selectedDistance * localProgress
            : startIndex - mergedStart + (endIndex - startIndex) * localProgress
        const total = Number.isFinite(mergedDistance) && mergedDistance > 0
            ? mergedDistance
            : mergedEnd - mergedStart
        const pointData = {...point}
        delete pointData.sourcePosition
        pointsById.set(point.id, {
            ...pointData,
            ...(Number.isFinite(boundedSourcePosition) ? {sourcePosition: boundedSourcePosition} : {}),
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
    const correction = normalizeFixPathManualControlProgress(content, {
        id: firstTouched?.id ?? makeId(),
        segmentIndex,
        startIndex: mergedStart,
        endIndex: mergedEnd,
        sourceFingerprint,
        controlPoints,
    })
    const retained = corrections.filter(item => !touchedIds.has(item.id))
    return {corrections: sortCorrections([...retained, correction]), correction}
}

/**
 * Add one manually positioned control point to an existing section, or create a
 * one-point correction over the nearest source interval.
 * @param {object} content - Source track feature.
 * @param {Array<object>} corrections - Current track correction sections.
 * @param {number} segmentIndex - Geometry segment index.
 * @param {number} index - Start index of the route interval under the pointer.
 * @param {number} intervalProgress - Fraction along the route interval.
 * @param {Array<number>} coordinate - New longitude, latitude, and height.
 * @returns {{corrections: Array<object>, correction?: object, controlPointId?: string, error?: string}} Updated sections.
 */
export const buildFixPathControlPointAddition = (
    content,
    corrections,
    segmentIndex,
    index,
    intervalProgress,
    coordinate,
) => {
    const segment = getLineSegments(content?.geometry)?.[segmentIndex]
    if (!Array.isArray(segment) || segment.length === 0 || !Number.isInteger(index)
        || index < 0 || index >= segment.length || !Array.isArray(coordinate)
        || !Number.isFinite(Number(coordinate[0])) || !Number.isFinite(Number(coordinate[1]))) {
        return {corrections, error: 'The selected Journey position is no longer available.'}
    }

    const clampedProgress = Math.min(1, Math.max(0, Number(intervalProgress) || 0))
    const sourcePosition = Math.min(segment.length - 1, index + clampedProgress)
    const existing = corrections.find(correction => (
        correction.segmentIndex === segmentIndex
        && sourcePosition >= correction.startIndex
        && sourcePosition <= correction.endIndex
    )) ?? corrections.find(correction => (
        correction.segmentIndex === segmentIndex
        && index <= correction.endIndex
        && index + 1 >= correction.startIndex
    ))
    // A neighboring interval extends the section. Clamping it to the previous
    // bounds would insert the new coordinate before the wrong GPX vertex.
    const startIndex = Math.min(existing?.startIndex ?? index, Math.floor(sourcePosition))
    const endIndex = Math.max(
        existing?.endIndex ?? Math.min(index + 1, segment.length - 1),
        Math.ceil(sourcePosition),
    )
    const distanceIndex = createFixPathDistanceIndex(content, segmentIndex, startIndex, endIndex)
    if (!distanceIndex) {
        return {corrections, error: 'The selected Journey position is no longer available.'}
    }

    const boundedSourcePosition = Math.min(endIndex, Math.max(startIndex, sourcePosition))
    const lowerIndex = Math.min(endIndex, Math.max(startIndex, Math.floor(boundedSourcePosition)))
    const localIntervalProgress = boundedSourcePosition - lowerIndex
    const distanceBeforePoint = distanceIndex.distanceAtIndex(lowerIndex)
        + (lowerIndex < endIndex
            ? (distanceIndex.distanceAtIndex(lowerIndex + 1) - distanceIndex.distanceAtIndex(lowerIndex))
                * localIntervalProgress
            : 0)
    const progress = distanceIndex.totalDistance > 0
        ? distanceBeforePoint / distanceIndex.totalDistance
        : endIndex > startIndex ? (sourcePosition - startIndex) / (endIndex - startIndex) : 0.5
    const controlPointId = makeId()
    if (!existing) {
        if (endIndex <= startIndex) {
            return {corrections, error: 'The selected route needs two neighboring points.'}
        }

        const correction = {
            id: makeId(),
            segmentIndex,
            startIndex,
            endIndex,
            sourceFingerprint: getFixPathSourceFingerprint(content, segmentIndex, startIndex, endIndex),
            controlPoints: [{
                id: controlPointId,
                progress: Math.min(0.999999, Math.max(0.000001, progress)),
                sourcePosition,
                coordinate: normalizeControlCoordinate(coordinate),
                fixed: true,
                removed: false,
                inserted: true,
            }],
        }

        return {
            corrections: sortCorrections([...corrections, correction]),
            correction,
            controlPointId,
        }
    }

    const result = buildFixPathSection(content, corrections, segmentIndex, startIndex, endIndex, [{
        id: controlPointId,
        progress,
        sourcePosition,
        coordinate,
        inserted: true,
    }])
    return result.error
        ? result
        : {...result, controlPointId}
}

/**
 * Create or extend one continuous section for selected, non-removed source vertices.
 * @param {object} content - Track content.
 * @param {Array<object>} corrections - Existing track correction sections.
 * @param {number} segmentIndex - Geometry segment index.
 * @param {Iterable<number>} sourceIndexes - Selected source coordinate indexes.
 * @returns {{corrections: Array<object>, sections: Array<object>, errors: Array<string>}} Updated section.
 */
export const buildFixPathSectionsFromSourceIndexes = (content, corrections, segmentIndex, sourceIndexes) => {
    let nextCorrections = corrections
    const sectionsById = new Map()
    const errors = []
    const removedSourceIndexes = new Set()

    corrections.forEach(correction => {
        if (correction.segmentIndex !== segmentIndex) return
        correction.controlPoints?.forEach(point => {
            const sourceIndex = sourceIndexOf(point)
            if (point.removed === true && Number.isInteger(sourceIndex)) {
                removedSourceIndexes.add(sourceIndex)
            }
        })
    })

    const selectableSourceIndexes = Array.from(sourceIndexes ?? [])
        .filter(index => Number.isInteger(index) && index >= 0 && !removedSourceIndexes.has(index))
    const uniqueIndexes = [...new Set(selectableSourceIndexes)].sort((first, second) => first - second)
    if (uniqueIndexes.length === 0) {
        return {corrections: nextCorrections, sections: [], errors}
    }

    const selectedRuns = []
    uniqueIndexes.forEach(index => {
        const run = selectedRuns.at(-1)
        if (!run || index !== run.at(-1) + 1) {
            selectedRuns.push([index])
            return
        }
        run.push(index)
    })

    selectedRuns.forEach(run => {
        const result = buildFixPathSection(content, nextCorrections, segmentIndex, run[0], run.at(-1))
        if (result.error || !result.correction) {
            errors.push(result.error ?? 'The selected Journey points could not form a correction section.')
            return
        }
        nextCorrections = result.corrections
        sectionsById.set(result.correction.id, result.correction)
    })

    const sections = [...sectionsById.keys()]
        .map(id => nextCorrections.find(item => item.id === id))
        .filter(Boolean)
    return {corrections: nextCorrections, sections, errors}
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
        const distanceIndex = createFixPathDistanceIndex(content, segmentIndex, existing.startIndex, existing.endIndex)
        const progress = progressAtIndex(existing.startIndex, existing.endIndex, index, distanceIndex)
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
    return buildFixPathSection(content, corrections, segmentIndex, index, index, [{
        id: controlId,
        sourceIndex: index,
        coordinate: movedCoordinate,
    }])
}
