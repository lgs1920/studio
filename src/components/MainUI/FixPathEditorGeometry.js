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
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {FIX_PATH_EDITOR_WIDGET, LGS_TOOLBAR, SCENE_WIDGETS_BOARD, WIDGET_LAYER_START} from '@Core/constants'
import {
    applyFixPathCorrections,
    getFixPathSegmentDistanceMeters,
    mergeAdjacentFixPathCorrections,
} from '@Utils/cesium/fixPathCorrections'
import {Cartesian2, Cartesian3, Cartographic} from 'cesium'

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
    return content ? mergeAdjacentFixPathCorrections(content, normalized) : normalized
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
    if (point.fixed === false && Number.isInteger(sourceIndex)) {
        const correctedSegment = getGeometrySegments(correctedContent?.geometry)[correction.segmentIndex]
        if (correctedSegment?.[sourceIndex]) {
            const correctedCoordinate = [...correctedSegment[sourceIndex]]
            if (Number.isFinite(Number(correctedCoordinate[2]))) {
                correctedCoordinate[2] = Math.round(Number(correctedCoordinate[2]))
            }
            return correctedCoordinate
        }
    }
    const coordinate = [...point.coordinate]
    const rawHeight = coordinate[2]
    const hasHeight = rawHeight !== null && rawHeight !== undefined
        && !(typeof rawHeight === 'string' && rawHeight.trim() === '')
        && Number.isFinite(Number(rawHeight))
    if (hasHeight) {
        coordinate[2] = Math.round(Number(rawHeight))
        return coordinate
    }

    const segment = getGeometrySegments(content?.geometry)[correction.segmentIndex]
    const totalDistance = getFixPathSegmentDistanceMeters(
        content,
        correction.segmentIndex,
        correction.startIndex,
        correction.endIndex,
    )
    if (!Array.isArray(segment) || !Number.isFinite(totalDistance) || totalDistance <= 0) {
        coordinate[2] = 0
        return coordinate
    }

    const targetDistance = point.progress * totalDistance
    let distanceAtPrevious = 0
    for (let index = correction.startIndex + 1; index <= correction.endIndex; index += 1) {
        const distanceAtCurrent = distanceAtPrevious + coordinateDistanceMeters(segment[index - 1], segment[index])
        if (targetDistance <= distanceAtCurrent) {
            const rawFirstHeight = segment[index - 1]?.[2]
            const rawSecondHeight = segment[index]?.[2]
            const firstHeight = rawFirstHeight !== null && rawFirstHeight !== undefined
                && !(typeof rawFirstHeight === 'string' && rawFirstHeight.trim() === '')
                && Number.isFinite(Number(rawFirstHeight))
                ? Number(rawFirstHeight)
                : Number.NaN
            const secondHeight = rawSecondHeight !== null && rawSecondHeight !== undefined
                && !(typeof rawSecondHeight === 'string' && rawSecondHeight.trim() === '')
                && Number.isFinite(Number(rawSecondHeight))
                ? Number(rawSecondHeight)
                : Number.NaN
            const interval = distanceAtCurrent - distanceAtPrevious
            const localProgress = interval > 0 ? (targetDistance - distanceAtPrevious) / interval : 0
            const sampledHeight = Number.isFinite(firstHeight) && Number.isFinite(secondHeight)
                ? firstHeight + (secondHeight - firstHeight) * localProgress
                : Number.isFinite(firstHeight) ? firstHeight : secondHeight
            coordinate[2] = Number.isFinite(sampledHeight) ? Math.round(sampledHeight) : 0
            return coordinate
        }
        distanceAtPrevious = distanceAtCurrent
    }

    const rawEndHeight = segment[correction.endIndex]?.[2]
    const endHeight = rawEndHeight !== null && rawEndHeight !== undefined
        && !(typeof rawEndHeight === 'string' && rawEndHeight.trim() === '')
        ? Number(rawEndHeight)
        : Number.NaN
    coordinate[2] = Number.isFinite(endHeight) ? Math.round(endHeight) : 0
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
 * @returns {object} Projected SVG geometry.
 */
export const projectEditOverlay = (viewer, overlay, selectedSourcePoints, tracks, correctionsByTrack, selection, activeCorrection) => {
    const scene = viewer?.scene
    const canvas = viewer?.canvas
    if (!scene || !canvas || !overlay) {
        return {width: 0, height: 0, sourcePoints: [], controlPoints: [], pendingControlPoints: [], previewLines: []}
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
        corrections.forEach(correction => correction.controlPoints.forEach(controlPoint => {
            const sourceIndex = Number.isInteger(controlPoint.sourceIndex)
                ? controlPoint.sourceIndex
                : Number(/^fix-point-(\d+)-(\d+)$/.exec(controlPoint.id)?.[2])
            if (!Number.isInteger(sourceIndex)) return
            const sourceKey = trackSlug + ':' + correction.segmentIndex + ':' + sourceIndex
            correctedSourcePoints.add(sourceKey)
            if (controlPoint.removed === true) removedSourcePoints.add(sourceKey)
        }))
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

    const controlPoints = []
    const previewLines = []
    Object.entries(correctionsByTrack).forEach(([trackSlug, corrections]) => {
        const track = trackBySlug.get(trackSlug)
        const content = track?.content
        if (!content) {
            return
        }
        corrections.forEach(correction => {
            const preview = applyFixPathCorrections(content, [correction]).content
            correction.controlPoints.forEach(point => {
                if (point.removed === true) return
                const coordinate = getControlPointCoordinate(content, correction, point, preview)
                const screen = toLocal(coordinate)
                if (screen && isWorldPositionVisible(
                    scene,
                    scene.camera,
                    new Cartesian2(screen.canvasX, screen.canvasY),
                    screen.worldPosition,
                )) {
                    controlPoints.push({
                        trackSlug,
                        correctionId: correction.id,
                        controlPointId: point.id,
                        sourceIndex: Number.isInteger(point.sourceIndex)
                            ? point.sourceIndex
                            : Number(/^fix-point-(\d+)-(\d+)$/.exec(point.id)?.[2]),
                        fixed: point.fixed !== false,
                        active: correction.id === activeCorrection?.id && trackSlug === activeCorrection?.trackSlug,
                        x: screen.x,
                        y: screen.y,
                    })
                }
            })

            const segment = getGeometrySegments(preview?.geometry)[correction.segmentIndex]
            const points = segment?.slice(correction.startIndex, correction.endIndex + 1) ?? []
            let visibleLine = []
            points.forEach(coordinate => {
                const screen = toLocal(coordinate)
                if (screen && isWorldPositionVisible(
                    scene,
                    scene.camera,
                    new Cartesian2(screen.canvasX, screen.canvasY),
                    screen.worldPosition,
                )) {
                    visibleLine.push(screen)
                }
                else {
                    if (visibleLine.length > 1) previewLines.push(visibleLine)
                    visibleLine = []
                }
            })
            if (visibleLine.length > 1) previewLines.push(visibleLine)
        })
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
    if (pendingControlPoints.length > 1) {
        previewLines.push(pendingControlPoints)
    }

    return {width, height, sourcePoints, controlPoints, pendingControlPoints, previewLines}
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
