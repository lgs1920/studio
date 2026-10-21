/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FixPathEditorGeometry.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-19
 * Last modified: 2026-10-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {FIX_PATH_EDITOR_WIDGET, LGS_TOOLBAR, SCENE_WIDGETS_BOARD, WIDGET_LAYER_START} from '@Core/constants'
import {
    createFixPathDistanceIndex,
    getFixPathSourceFingerprint,
    getFixPathSegmentDistanceMeters,
    mergeAdjacentFixPathCorrections,
    normalizeFixPathManualControlProgress,
} from '@Utils/cesium/fixPathCorrections'
import {Cartesian2, Cartesian3, Cartographic} from 'cesium'
import {SOURCE_VISIBILITY_CELL_SIZE} from './FixPathEditorConfig'

const correctionDistanceIndexes = new WeakMap()

/**
 * Reuse a source-distance profile while an immutable correction is displayed.
 * @param {object} content - Source track feature.
 * @param {object} correction - Correction section.
 * @returns {object|null} Cumulative source-distance lookup.
 */
const distanceIndexForCorrection = (content, correction) => {
    if (!correction || typeof correction !== 'object') return null
    const cached = correctionDistanceIndexes.get(correction)
    if (cached?.content === content) return cached.distanceIndex
    const distanceIndex = createFixPathDistanceIndex(
        content,
        correction.segmentIndex,
        correction.startIndex,
        correction.endIndex,
    )
    correctionDistanceIndexes.set(correction, {content, distanceIndex})
    return distanceIndex
}

/**
 * Resolve the scene-toolbar stacking layer used by the Fix Path overlay and widget.
 * @param {Map<string, Object>} widgetListSnapshot - Current widget-list snapshot.
 * @returns {number|string} A peer toolbar z-index or the standard widget-layer start.
 */
export const resolveFixPathWidgetZIndex = widgetListSnapshot => {
    const peerZIndexes = Array.from(widgetListSnapshot?.entries?.() ?? []).flatMap(([widgetId, entry]) => {
        if (widgetId === FIX_PATH_EDITOR_WIDGET) {
            return []
        }

        const widgetConfig = globalThis.__?.ui?.widgetManager?.getWidgetConfig?.(widgetId)
        const widgetsBoard = entry?.widgetsBoard ?? widgetConfig?.widgetsBoard ?? SCENE_WIDGETS_BOARD
        if (widgetsBoard !== SCENE_WIDGETS_BOARD || widgetConfig?.type !== LGS_TOOLBAR) {
            return []
        }

        const zIndex = entry?.zIndex ?? widgetConfig?.zIndex
        if (typeof zIndex === 'string' && zIndex.trim() && !Number.isFinite(Number(zIndex))) {
            return [zIndex]
        }

        const numericZIndex = Number(zIndex)
        return Number.isFinite(numericZIndex) ? [numericZIndex] : []
    })
    const numericZIndexes = peerZIndexes.filter(zIndex => typeof zIndex === 'number')

    if (numericZIndexes.length > 0) {
        return Math.max(...numericZIndexes)
    }

    return peerZIndexes[0] ?? WIDGET_LAYER_START
}

/**
 * Return the line geometry segments for a track.
 * @param {object} geometry - A GeoJSON geometry.
 * @returns {Array<Array<Array<number>>>} The track coordinate segments.
 */
export const getGeometrySegments = geometry => {
    if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        return [geometry.coordinates]
    }
    if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates
    }
    return []
}

/**
 * Find the closest position on a route geometry to a map coordinate.
 * @param {object} geometry - A GeoJSON LineString or MultiLineString geometry.
 * @param {Array<number>} coordinate - Longitude and latitude of the map position.
 * @returns {{segmentIndex: number, index: number, progress: number, distanceMeters: number, coordinate: Array<number>}|null} Nearest route position.
 */
export const findClosestRoutePosition = (geometry, coordinate) => {
    const longitude = Number(coordinate?.[0])
    const latitude = Number(coordinate?.[1])
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

    const latitudeRadians = latitude * Math.PI / 180
    const longitudeScale = Math.cos(latitudeRadians) * Math.PI / 180 * 6371008.8
    const latitudeScale = Math.PI / 180 * 6371008.8
    const segments = getGeometrySegments(geometry)
    let closest = null
    const coordinateAtProgress = (first, second, progress) => {
        let longitudeDelta = Number(second[0]) - Number(first[0])
        if (longitudeDelta > 180) longitudeDelta -= 360
        if (longitudeDelta < -180) longitudeDelta += 360
        const longitude = Number(first[0]) + longitudeDelta * progress
        const normalizedLongitude = ((longitude + 180) % 360 + 360) % 360 - 180
        const result = [normalizedLongitude, Number(first[1]) + (Number(second[1]) - Number(first[1])) * progress]
        const firstHeight = first[2] === null || first[2] === undefined ? Number.NaN : Number(first[2])
        const secondHeight = second[2] === null || second[2] === undefined ? Number.NaN : Number(second[2])
        if (Number.isFinite(firstHeight) && Number.isFinite(secondHeight)) {
            result.push(firstHeight + (secondHeight - firstHeight) * progress)
        }
        else if (Number.isFinite(firstHeight)) {
            result.push(firstHeight)
        }
        else if (Number.isFinite(secondHeight)) {
            result.push(secondHeight)
        }
        return result
    }
    const toLocal = point => {
        const pointLongitude = Number(point?.[0])
        const pointLatitude = Number(point?.[1])
        if (!Number.isFinite(pointLongitude) || !Number.isFinite(pointLatitude)) return null
        let longitudeDelta = pointLongitude - longitude
        if (longitudeDelta > 180) longitudeDelta -= 360
        if (longitudeDelta < -180) longitudeDelta += 360
        return [longitudeDelta * longitudeScale, (pointLatitude - latitude) * latitudeScale]
    }

    segments.forEach((segment, segmentIndex) => {
        if (!Array.isArray(segment) || segment.length === 0) return
        if (segment.length === 1) {
            const candidate = toLocal(segment[0])
            if (!candidate) return
            const distanceSquared = candidate[0] ** 2 + candidate[1] ** 2
            if (!closest || distanceSquared < closest.distanceSquared) {
                closest = {segmentIndex, index: 0, progress: 0, distanceSquared, coordinate: [...segment[0]]}
            }
            return
        }

        for (let index = 0; index < segment.length - 1; index += 1) {
            const first = toLocal(segment[index])
            const second = toLocal(segment[index + 1])
            if (!first || !second) continue
            const deltaX = second[0] - first[0]
            const deltaY = second[1] - first[1]
            const lengthSquared = deltaX ** 2 + deltaY ** 2
            const progress = lengthSquared > 0
                ? Math.min(1, Math.max(0, -(first[0] * deltaX + first[1] * deltaY) / lengthSquared))
                : 0
            const distanceX = first[0] + deltaX * progress
            const distanceY = first[1] + deltaY * progress
            const distanceSquared = distanceX ** 2 + distanceY ** 2
            if (!closest || distanceSquared < closest.distanceSquared) {
                closest = {
                    segmentIndex,
                    index,
                    progress,
                    distanceSquared,
                    coordinate: coordinateAtProgress(segment[index], segment[index + 1], progress),
                }
            }
        }
    })

    if (!closest) return null
    return {
        segmentIndex: closest.segmentIndex,
        index: closest.index,
        progress: closest.progress,
        distanceMeters: Math.sqrt(closest.distanceSquared),
        coordinate: closest.coordinate,
    }
}

/**
 * Create a unique identifier for a new correction point or section.
 * @returns {string} A unique identifier.
 */
export const makeId = () => globalThis.crypto?.randomUUID?.()
    ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)

/**
 * Clone stored correction records into an editable draft.
 * @param {Array<object>} corrections - Persisted corrections.
 * @returns {Array<object>} A detached correction list.
 */
export const cloneCorrectionList = (corrections, content = null) => {
    const normalized = Array.isArray(corrections) ? corrections.map(correction => {
    const existingPoints = (correction.controlPoints ?? []).map(point => {
        const sourcePoint = /^fix-point-(\d+)-(\d+)$/.exec(point.id ?? '')
        const coordinate = [...point.coordinate]
        if (coordinate.length >= 3 && coordinate[2] !== null && coordinate[2] !== undefined
            && Number.isFinite(Number(coordinate[2]))) {
            coordinate[2] = Math.round(Number(coordinate[2]))
        }
        return {
            ...point,
            ...(Number.isInteger(point.sourceIndex) ? {} : sourcePoint ? {sourceIndex: Number(sourcePoint[2])} : {}),
            fixed: typeof point.fixed === 'boolean' ? point.fixed : true,
            removed: point.removed === true,
            coordinate,
        }
    })
    const segment = getGeometrySegments(content?.geometry)[correction.segmentIndex]
    if (!Array.isArray(segment)
        || correction.startIndex < 0
        || correction.endIndex >= segment.length) {
        return {...correction, controlPoints: existingPoints}
    }

    const cumulativeDistance = [0]
    for (let index = correction.startIndex + 1; index <= correction.endIndex; index += 1) {
        cumulativeDistance.push(cumulativeDistance.at(-1)
            + coordinateDistanceMeters(segment[index - 1], segment[index]))
    }
    const totalDistance = cumulativeDistance.at(-1)
    const existingSourcePoints = new Map(existingPoints
        .filter(point => Number.isInteger(point.sourceIndex))
        .map(point => [point.sourceIndex, point]))
    if (existingPoints.length > 0 && existingSourcePoints.size === 0) {
        return {
            ...correction,
            controlPoints: existingPoints.sort((first, second) => first.progress - second.progress
                || first.id.localeCompare(second.id)),
        }
    }
    const sourcePoints = []
    for (let index = correction.startIndex; index <= correction.endIndex; index += 1) {
        const offset = index - correction.startIndex
        const progress = index === correction.startIndex
            ? 0
            : index === correction.endIndex
                ? 1
                : totalDistance > 0
                    ? cumulativeDistance[offset] / totalDistance
                    : offset / Math.max(1, correction.endIndex - correction.startIndex)
        const existing = existingSourcePoints.get(index)
        const sourceCoordinate = [...segment[index]]
        if (sourceCoordinate.length >= 3 && Number.isFinite(Number(sourceCoordinate[2]))) {
            sourceCoordinate[2] = Math.round(Number(sourceCoordinate[2]))
        }
        sourcePoints.push({
            ...existing,
            id: existing?.id ?? 'fix-point-' + correction.segmentIndex + '-' + index,
            sourceIndex: index,
            progress,
            coordinate: existing?.coordinate ?? sourceCoordinate,
            fixed: existing?.fixed ?? false,
            removed: existing?.removed === true,
        })
    }
    const sourceIndexes = new Set(sourcePoints.map(point => point.sourceIndex))
    const manualPoints = existingPoints.filter(point => !Number.isInteger(point.sourceIndex)
        || !sourceIndexes.has(point.sourceIndex))
    return {
        ...correction,
        controlPoints: [...sourcePoints, ...manualPoints].sort((first, second) => first.progress - second.progress
            || (first.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (second.sourceIndex ?? Number.MAX_SAFE_INTEGER)
            || first.id.localeCompare(second.id)),
    }
    }) : []
    if (!content) return normalized

    const merged = mergeAdjacentFixPathCorrections(content, normalized)
        .map(correction => normalizeFixPathManualControlProgress(content, correction))
    const claimedContextIndexes = new Set()
    return merged.map(correction => {
        const segment = getGeometrySegments(content.geometry)[correction.segmentIndex]
        const currentFingerprint = getFixPathSourceFingerprint(
            content,
            correction.segmentIndex,
            correction.startIndex,
            correction.endIndex,
        )
        if (!Array.isArray(segment) || correction.sourceFingerprint !== currentFingerprint) {
            return correction
        }

        const existingSourcePoints = new Map(correction.controlPoints
            .filter(point => Number.isInteger(point.sourceIndex))
            .map(point => [point.sourceIndex, point]))
        let startIndex = correction.startIndex
        let endIndex = correction.endIndex
        const contextKey = index => correction.segmentIndex + ':' + index
        const mayInclude = (nextStart, nextEnd, addedIndex) => {
            const distance = getFixPathSegmentDistanceMeters(content, correction.segmentIndex, nextStart, nextEnd)
            return !claimedContextIndexes.has(contextKey(addedIndex))
                && !merged.some(other => other !== correction
                    && other.segmentIndex === correction.segmentIndex
                    && addedIndex >= other.startIndex
                    && addedIndex <= other.endIndex)
                && Number.isFinite(distance)
        }

        const firstPoint = existingSourcePoints.get(startIndex)
        if (firstPoint?.fixed === true && firstPoint.removed !== true && startIndex > 0
            && mayInclude(startIndex - 1, endIndex, startIndex - 1)) {
            startIndex -= 1
            claimedContextIndexes.add(contextKey(startIndex))
        }
        const lastPoint = existingSourcePoints.get(endIndex)
        if (lastPoint?.fixed === true && lastPoint.removed !== true && endIndex < segment.length - 1
            && mayInclude(startIndex, endIndex + 1, endIndex + 1)) {
            endIndex += 1
            claimedContextIndexes.add(contextKey(endIndex))
        }
        if (startIndex === correction.startIndex && endIndex === correction.endIndex) {
            return correction
        }

        const previousDistance = getFixPathSegmentDistanceMeters(
            content,
            correction.segmentIndex,
            correction.startIndex,
            correction.endIndex,
        )
        const expandedDistance = getFixPathSegmentDistanceMeters(content, correction.segmentIndex, startIndex, endIndex)
        const distanceBeforePreviousStart = startIndex < correction.startIndex
            ? getFixPathSegmentDistanceMeters(content, correction.segmentIndex, startIndex, correction.startIndex)
            : 0
        const progressForManualPoint = point => {
            const oldProgress = Math.min(1, Math.max(0, Number(point.progress) || 0))
            if (Number.isFinite(previousDistance) && previousDistance > 0
                && Number.isFinite(expandedDistance) && expandedDistance > 0) {
                return Math.min(0.999999, Math.max(0.000001,
                    (distanceBeforePreviousStart + oldProgress * previousDistance) / expandedDistance))
            }
            const oldSpan = correction.endIndex - correction.startIndex
            const newSpan = endIndex - startIndex
            return newSpan > 0
                ? Math.min(0.999999, Math.max(0.000001,
                    (correction.startIndex - startIndex + oldProgress * oldSpan) / newSpan))
                : 0.5
        }

        const controlPoints = []
        for (let index = startIndex; index <= endIndex; index += 1) {
            const distance = getFixPathSegmentDistanceMeters(content, correction.segmentIndex, startIndex, index)
            const progress = index === startIndex
                ? 0
                : index === endIndex
                    ? 1
                    : Number.isFinite(expandedDistance) && expandedDistance > 0
                        ? distance / expandedDistance
                        : (index - startIndex) / Math.max(1, endIndex - startIndex)
            const existing = existingSourcePoints.get(index)
            const sourceCoordinate = [...segment[index]]
            if (sourceCoordinate.length >= 3 && Number.isFinite(Number(sourceCoordinate[2]))) {
                sourceCoordinate[2] = Math.round(Number(sourceCoordinate[2]))
            }
            controlPoints.push({
                ...existing,
                id: existing?.id ?? 'fix-point-' + correction.segmentIndex + '-' + index,
                sourceIndex: index,
                progress,
                coordinate: existing?.coordinate ?? sourceCoordinate,
                fixed: existing?.fixed ?? false,
                removed: existing?.removed === true,
            })
        }
        const sourceIndexes = new Set(controlPoints.map(point => point.sourceIndex))
        const manualPoints = correction.controlPoints
            .filter(point => !Number.isInteger(point.sourceIndex) || !sourceIndexes.has(point.sourceIndex))
            .map(point => ({...point, progress: progressForManualPoint(point)}))

        return {
            ...correction,
            startIndex,
            endIndex,
            sourceFingerprint: getFixPathSourceFingerprint(content, correction.segmentIndex, startIndex, endIndex),
            controlPoints: [...controlPoints, ...manualPoints].sort((first, second) => first.progress - second.progress
                || (first.sourceIndex ?? Number.MAX_SAFE_INTEGER) - (second.sourceIndex ?? Number.MAX_SAFE_INTEGER)
                || first.id.localeCompare(second.id)),
        }
    })
}

/**
 * Calculate horizontal distance between two longitude/latitude coordinates.
 * @param {Array<number>} first - The first coordinate.
 * @param {Array<number>} second - The second coordinate.
 * @returns {number} Distance in metres.
 */
export const coordinateDistanceMeters = (first, second) => {
    const latitude1 = Number(first?.[1]) * Math.PI / 180
    const latitude2 = Number(second?.[1]) * Math.PI / 180
    const latitudeDelta = latitude2 - latitude1
    let longitudeDelta = Number(second?.[0]) - Number(first?.[0])
    if (longitudeDelta > 180) longitudeDelta -= 360
    if (longitudeDelta < -180) longitudeDelta += 360
    longitudeDelta *= Math.PI / 180
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(Math.max(0, 1 - haversine)))
}

export const getControlPointCoordinate = (content, correction, point, correctedContent = null) => {
    const sourcePoint = /^fix-point-(\d+)-(\d+)$/.exec(point.id ?? '')
    const sourceIndex = Number.isInteger(point.sourceIndex)
        ? point.sourceIndex
        : sourcePoint ? Number(sourcePoint[2]) : Number.NaN
    let coordinate = [...point.coordinate]
    if (point.fixed === false && Number.isInteger(sourceIndex)) {
        const sourceSegment = getGeometrySegments(content?.geometry)[correction.segmentIndex]
        const sourceCoordinate = sourceSegment?.[sourceIndex]
        if (sourceCoordinate) {
            // Unmodified control points stay at their GPX coordinates, even when the corrected preview bends the route.
            coordinate = [...sourceCoordinate]
            if ((coordinate[2] === null || coordinate[2] === undefined)
                && point.coordinate?.[2] !== null && point.coordinate?.[2] !== undefined) {
                coordinate[2] = point.coordinate[2]
            }
        }
        else {
            const correctedSegment = getGeometrySegments(correctedContent?.geometry)[correction.segmentIndex]
            if (correctedSegment?.[sourceIndex]) {
                coordinate = [...correctedSegment[sourceIndex]]
            }
        }
    }
    const rawHeight = coordinate[2]
    const hasHeight = rawHeight !== null && rawHeight !== undefined
        && !(typeof rawHeight === 'string' && rawHeight.trim() === '')
        && Number.isFinite(Number(rawHeight))
    if (hasHeight) {
        coordinate[2] = Math.round(Number(rawHeight))
        return coordinate
    }

    const distanceIndex = distanceIndexForCorrection(content, correction)
    const totalDistance = distanceIndex?.totalDistance
    if (!distanceIndex || !Number.isFinite(totalDistance) || totalDistance <= 0) {
        coordinate[2] = 0
        return coordinate
    }

    const interval = distanceIndex.intervalAtDistance(Number(point.progress) * totalDistance)
    const firstRawHeight = distanceIndex.segment[interval?.firstIndex]?.[2]
    const secondRawHeight = distanceIndex.segment[interval?.secondIndex]?.[2]
    const firstHeight = firstRawHeight !== null && firstRawHeight !== undefined
        && !(typeof firstRawHeight === 'string' && firstRawHeight.trim() === '')
        && Number.isFinite(Number(firstRawHeight))
        ? Number(firstRawHeight)
        : Number.NaN
    const secondHeight = secondRawHeight !== null && secondRawHeight !== undefined
        && !(typeof secondRawHeight === 'string' && secondRawHeight.trim() === '')
        && Number.isFinite(Number(secondRawHeight))
        ? Number(secondRawHeight)
        : Number.NaN
    const firstValid = Number.isFinite(firstHeight)
    const secondValid = Number.isFinite(secondHeight)
    const sampledHeight = firstValid && secondValid
        ? firstHeight + (secondHeight - firstHeight) * (interval?.fraction ?? 0)
        : firstValid ? firstHeight : secondValid ? secondHeight : 0
    coordinate[2] = Math.round(sampledHeight)
    return coordinate
}

/** Find the closest projected correction marker under a pointer. */
export const findClosestProjectedControlPoint = (points, position, preferredPoint, tolerance = 18) => {
    const maximumDistanceSquared = tolerance * tolerance
    let closestPoint = null
    let closestDistanceSquared = maximumDistanceSquared
    for (const point of points) {
        const distanceX = point.x - position.x
        const distanceY = point.y - position.y
        const distanceSquared = distanceX * distanceX + distanceY * distanceY
        if (distanceSquared < closestDistanceSquared) {
            closestPoint = point
            closestDistanceSquared = distanceSquared
        }
        else if (distanceSquared === closestDistanceSquared
            && point.trackSlug === preferredPoint?.trackSlug
            && point.correctionId === preferredPoint?.correctionId
            && point.controlPointId === preferredPoint?.controlPointId) {
            closestPoint = point
        }
    }
    return closestPoint
}

/**
 * Update one control point in a correction list.
 * @param {Array<object>} corrections - Correction list to update.
 * @param {string} correctionId - Correction identifier.
 * @param {string} controlPointId - Control point identifier.
 * @param {Array<number>|Function} coordinate - New coordinate or coordinate updater.
 * @returns {Array<object>} Updated correction list.
 */
export const updateControlCoordinate = (corrections, correctionId, controlPointId, coordinate) => corrections.map(correction => (
    correction.id !== correctionId
        ? correction
        : {
            ...correction,
            controlPoints: correction.controlPoints.map(point => (
                point.id === controlPointId
                    ? {
                        ...point,
                        coordinate: typeof coordinate === 'function' ? coordinate(point.coordinate) : coordinate,
                        fixed: true,
                        removed: false,
                    }
                    : point
            )),
        }
))

export const updateControlPointCoordinates = (correctionsByTrack, pointUpdates) => {
    const next = {...correctionsByTrack}
    pointUpdates.forEach(point => {
        const corrections = next[point.trackSlug] ?? []
        const correction = corrections.find(item => item.controlPoints.some(controlPoint => (
            controlPoint.id === point.controlPointId
        )))
        if (correction) {
            next[point.trackSlug] = updateControlCoordinate(
                corrections,
                correction.id,
                point.controlPointId,
                point.coordinate,
            )
        }
    })
    return next
}

export const correctionAtPoint = (corrections, segmentIndex, index) => corrections.find(correction => (
    correction.segmentIndex === segmentIndex && index >= correction.startIndex && index <= correction.endIndex
))

/**
 * Create a world position for a correction coordinate, using loaded terrain height when available.
 * @param {object} scene - Cesium scene.
 * @param {Array<number>} coordinate - Longitude, latitude, and optional height.
 * @returns {Cartesian3|null} World position.
 */
export const worldPositionForCoordinate = (scene, coordinate) => {
    const longitude = Number(coordinate?.[0])
    const latitude = Number(coordinate?.[1])
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
    }
    const cartographic = Cartographic.fromDegrees(longitude, latitude)
    const terrainHeight = scene?.globe?.getHeight?.(cartographic)
    const fallbackHeight = Number.isFinite(Number(coordinate?.[2])) ? Number(coordinate[2]) : 0
    return Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        Number.isFinite(terrainHeight) ? terrainHeight + 0.5 : fallbackHeight,
    )
}

/**
 * Check whether a projected world position is in front of the visible terrain.
 * @param {object} scene - Cesium scene.
 * @param {object} camera - Cesium camera.
 * @param {Cartesian2} position - Drawing-buffer screen position.
 * @param {Cartesian3} worldPosition - Projected world position.
 * @returns {boolean} True if no nearer terrain surface occludes the position.
 */
export const isWorldPositionVisible = (scene, camera, position, worldPosition) => {
    if (!scene || !camera || !worldPosition || !position) {
        return true
    }
    const cameraPosition = camera.positionWC ?? camera.position
    if (!cameraPosition) {
        return true
    }
    let pickedPosition = null
    if (scene.pickPositionSupported === true && typeof scene.pickPosition === 'function') {
        try {
            pickedPosition = scene.pickPosition(position)
        }
        catch {
            pickedPosition = null
        }
    }
    if (!pickedPosition) {
        const ray = camera.getPickRay?.(position)
        pickedPosition = ray ? scene.globe?.pick?.(ray, scene) : null
    }
    if (!pickedPosition) {
        return true
    }
    const pickedDistance = Cartesian3.distance(cameraPosition, pickedPosition)
    const pointDistance = Cartesian3.distance(cameraPosition, worldPosition)
    return !Number.isFinite(pickedDistance) || !Number.isFinite(pointDistance) || pickedDistance + 4 >= pointDistance
}

/**
 * Check a nearby route coordinate at its own projected pixel, including terrain occlusion.
 * @param {object} scene - Cesium scene.
 * @param {object} camera - Active Cesium camera.
 * @param {{x: number, y: number}} pointerPosition - Pointer position in canvas pixels.
 * @param {Array<number>} coordinate - Candidate route coordinate.
 * @param {number} tolerance - Maximum pointer distance in canvas pixels.
 * @returns {boolean} Whether the visible route coordinate is close enough to the pointer.
 */
export const isRouteCoordinateScreenHit = (scene, camera, pointerPosition, coordinate, tolerance = 18) => {
    if (!scene || !camera || !Number.isFinite(pointerPosition?.x) || !Number.isFinite(pointerPosition?.y)) return false
    const worldPosition = worldPositionForCoordinate(scene, coordinate)
    const projectedPosition = worldPosition && scene.cartesianToCanvasCoordinates?.(worldPosition)
    if (!Number.isFinite(projectedPosition?.x) || !Number.isFinite(projectedPosition?.y)) return false
    const distance = Math.hypot(
        projectedPosition.x - pointerPosition.x,
        projectedPosition.y - pointerPosition.y,
    )
    // A nearby pointer can lie over a different slope. Compare depth only
    // along the candidate's own sightline, after applying the hit tolerance.
    return distance <= tolerance && isWorldPositionVisible(scene, camera, projectedPosition, worldPosition)
}

/**
 * Project a world coordinate into the editor overlay.
 * @param {object} scene - Cesium scene.
 * @param {DOMRect} overlayRect - Overlay bounds.
 * @param {DOMRect} canvasRect - Cesium canvas bounds.
 * @param {HTMLCanvasElement} canvas - Cesium canvas.
 * @param {Array<number>} coordinate - Longitude, latitude, and optional height.
 * @param {Cartesian3|null} knownWorldPosition - Previously computed world position.
 * @returns {object|null} Local and drawing-buffer positions.
 */
export const projectCoordinate = (scene, overlayRect, canvasRect, canvas, coordinate, knownWorldPosition = null) => {
    const worldPosition = knownWorldPosition ?? worldPositionForCoordinate(scene, coordinate)
    if (!worldPosition) {
        return null
    }
    const canvasPosition = scene.cartesianToCanvasCoordinates?.(worldPosition)
    if (!canvasPosition || !Number.isFinite(canvasPosition.x) || !Number.isFinite(canvasPosition.y)) {
        return null
    }
    const x = canvasPosition.x * canvasRect.width / canvas.width + canvasRect.left - overlayRect.left
    const y = canvasPosition.y * canvasRect.height / canvas.height + canvasRect.top - overlayRect.top
    if (x < 0 || y < 0 || x > overlayRect.width || y > overlayRect.height) {
        return null
    }
    return {x, y, canvasX: canvasPosition.x, canvasY: canvasPosition.y, worldPosition}
}

/**
 * Project only selected Journey points and correction geometry for display.
 * @param {object} viewer - Cesium Viewer.
 * @param {HTMLElement} overlay - Overlay element.
 * @param {Array<object>} selectedSourcePoints - Points retained by screen-area selection.
 * @param {Array<object>} tracks - Current Journey tracks.
 * @param {object} correctionsByTrack - Draft corrections grouped by track slug.
 * @param {object} selection - Current section selection state.
 * @param {object|null} activeCorrection - Active section identity.
 * @param {Set<string>} hiddenCorrectionKeys - Correction identities hidden from the editing overlay.
 * @returns {object} Projected SVG geometry.
 */
export const projectEditOverlay = (
    viewer,
    overlay,
    selectedSourcePoints,
    tracks,
    correctionsByTrack,
    selection,
    activeCorrection,
    hiddenCorrectionKeys = new Set(),
) => {
    const scene = viewer?.scene
    const canvas = viewer?.canvas
    if (!scene || !canvas || !overlay) {
        return {width: 0, height: 0, sourcePoints: [], controlPoints: [], pendingControlPoints: []}
    }
    const overlayRect = overlay.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()
    const width = overlayRect.width
    const height = overlayRect.height
    const toLocal = (coordinate, knownWorldPosition) => projectCoordinate(
        scene,
        overlayRect,
        canvasRect,
        canvas,
        coordinate,
        knownWorldPosition,
    )
    const trackBySlug = new Map(tracks.map(track => [track.slug, track]))
    const correctedSourcePoints = new Set()
    const removedSourcePoints = new Set()
    Object.entries(correctionsByTrack).forEach(([trackSlug, corrections]) => {
        corrections.forEach(correction => {
            correction.controlPoints.forEach(controlPoint => {
                const sourceIndex = Number.isInteger(controlPoint.sourceIndex)
                    ? controlPoint.sourceIndex
                    : Number(/^fix-point-(\d+)-(\d+)$/.exec(controlPoint.id)?.[2])
                if (!Number.isInteger(sourceIndex)) return
                const sourceKey = trackSlug + ':' + correction.segmentIndex + ':' + sourceIndex
                correctedSourcePoints.add(sourceKey)
                if (controlPoint.removed === true) removedSourcePoints.add(sourceKey)
            })
        })
    })
    const sourcePoints = selectedSourcePoints.flatMap(point => {
        const sourceKey = point.trackSlug + ':' + point.segmentIndex + ':' + point.index
        if (correctedSourcePoints.has(sourceKey) || removedSourcePoints.has(sourceKey)) {
            return []
        }
        const screen = toLocal(point.coordinate, point.worldPosition)
        return screen ? [{
            ...point,
            x: screen.x,
            y: screen.y,
            canvasX: screen.canvasX,
            canvasY: screen.canvasY,
        }] : []
    })

    const controlCandidates = []
    Object.entries(correctionsByTrack).forEach(([trackSlug, corrections]) => {
        const track = trackBySlug.get(trackSlug)
        const content = track?.content
        if (!content) {
            return
        }
        corrections.forEach(correction => {
            if (hiddenCorrectionKeys.has(trackSlug + ':' + correction.id)) return
            const active = correction.id === activeCorrection?.id && trackSlug === activeCorrection?.trackSlug
            correction.controlPoints.forEach(point => {
                if (point.removed === true) return
                const coordinate = getControlPointCoordinate(content, correction, point)
                const screen = toLocal(coordinate)
                if (screen) {
                    controlCandidates.push({
                        trackSlug,
                        correctionId: correction.id,
                        controlPointId: point.id,
                        sourceIndex: Number.isInteger(point.sourceIndex)
                            ? point.sourceIndex
                            : Number(/^fix-point-(\d+)-(\d+)$/.exec(point.id)?.[2]),
                        fixed: point.fixed !== false,
                        active,
                        x: screen.x,
                        y: screen.y,
                        canvasX: screen.canvasX,
                        canvasY: screen.canvasY,
                        worldPosition: screen.worldPosition,
                    })
                }
            })

        })
    })

    const visibilityCells = new Map()
    controlCandidates.forEach(point => {
        const cell = Math.floor(point.x / SOURCE_VISIBILITY_CELL_SIZE)
            + ':' + Math.floor(point.y / SOURCE_VISIBILITY_CELL_SIZE)
        const group = visibilityCells.get(cell) ?? []
        group.push(point)
        visibilityCells.set(cell, group)
    })
    const controlPoints = []
    visibilityCells.forEach(group => {
        const cameraPosition = scene.camera?.positionWC ?? scene.camera?.position
        const point = cameraPosition
            ? group.reduce((closest, candidate) => (
                Cartesian3.distance(cameraPosition, candidate.worldPosition)
                    < Cartesian3.distance(cameraPosition, closest.worldPosition)
                    ? candidate
                    : closest
            ))
            : group[0]
        if (isWorldPositionVisible(
            scene,
            scene.camera,
            new Cartesian2(point.canvasX, point.canvasY),
            point.worldPosition,
        )) {
            group.forEach(({canvasX: _canvasX, canvasY: _canvasY, worldPosition: _worldPosition, ...controlPoint}) => {
                controlPoints.push(controlPoint)
            })
        }
    })

    const pendingControlPoints = []
    if (selection?.phase === 'add-points' && selection.startPoint) {
        const track = trackBySlug.get(selection.startPoint.trackSlug)
        const segment = getGeometrySegments(track?.content?.geometry)[selection.startPoint.segmentIndex]
        const start = segment?.[selection.startPoint.index]
        if (start) {
            const screen = toLocal(start)
            if (screen && isWorldPositionVisible(
                scene,
                scene.camera,
                new Cartesian2(screen.canvasX, screen.canvasY),
                screen.worldPosition,
            )) {
                pendingControlPoints.push({x: screen.x, y: screen.y})
            }
        }
        const pendingCoordinates = selection.controlPoints ?? []
        pendingCoordinates.forEach(point => {
            const screen = toLocal(point.coordinate)
            if (screen && isWorldPositionVisible(
                scene,
                scene.camera,
                new Cartesian2(screen.canvasX, screen.canvasY),
                screen.worldPosition,
            )) {
                pendingControlPoints.push({x: screen.x, y: screen.y})
            }
        })
    }
    return {width, height, sourcePoints, controlPoints, pendingControlPoints}
}

/**
 * Yield one browser frame so long Journey scans do not block map interaction or painting.
 * @returns {Promise<void>} Resolves on the next animation frame.
 */
export const nextAnimationFrame = () => new Promise(resolve => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => resolve())
        return
    }
    globalThis.setTimeout(resolve, 0)
})
