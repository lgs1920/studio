/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: fixPathScreenSelection.js
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

/** Normalize two screen points into a positive rectangular selection area. */
export const normalizeScreenSelectionArea = (first, second) => {
    const left = Math.min(first.x, second.x)
    const top = Math.min(first.y, second.y)
    return {
        left,
        top,
        right: Math.max(first.x, second.x),
        bottom: Math.max(first.y, second.y),
        width: Math.abs(second.x - first.x),
        height: Math.abs(second.y - first.y),
    }
}

/** Test whether one projected point falls inside a screen selection area. */
export const isScreenPointInsideArea = (point, area) => point.x >= area.left
    && point.x <= area.right
    && point.y >= area.top
    && point.y <= area.bottom

/** Test whether a projected point lies inside or on the edge of a screen polygon. */
export const isScreenPointInsidePolygon = (point, polygon) => {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)
        || !Array.isArray(polygon) || polygon.length < 3
        || polygon.some(vertex => !Number.isFinite(vertex?.x) || !Number.isFinite(vertex?.y))) {
        return false
    }

    let inside = false
    for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
        const current = polygon[index]
        const previous = polygon[previousIndex]
        const edgeX = current.x - previous.x
        const edgeY = current.y - previous.y
        const edgeLengthSquared = edgeX * edgeX + edgeY * edgeY
        const relativeX = point.x - previous.x
        const relativeY = point.y - previous.y

        if (edgeLengthSquared > 0) {
            const projection = (relativeX * edgeX + relativeY * edgeY) / edgeLengthSquared
            const crossProduct = relativeX * edgeY - relativeY * edgeX
            if (projection >= 0 && projection <= 1
                && Math.abs(crossProduct) <= 0.75 * Math.sqrt(edgeLengthSquared)) {
                return true
            }
        }

        const crossesRay = (current.y > point.y) !== (previous.y > point.y)
        if (crossesRay) {
            const intersectionX = current.x
                + ((point.y - current.y) * (previous.x - current.x)) / (previous.y - current.y)
            if (point.x < intersectionX) inside = !inside
        }
    }

    return inside
}

/** Append a screen vertex unless it duplicates the preceding point. */
export const appendScreenSelectionVertex = (vertices, point, minimumDistance = 3) => {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return vertices
    const previous = vertices.at(-1)
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < minimumDistance) {
        return vertices
    }
    return [...vertices, {x: point.x, y: point.y}]
}

/** Build one SVG path containing a square marker for every supplied point. */
export const buildSourcePointSvgPath = (points, size = 8) => {
    const halfSize = size / 2
    return points.map(point => `M${point.x - halfSize} ${point.y - halfSize}h${size}v${size}h-${size}Z`).join('')
}

/** Find the closest projected source point under a pointer. */
export const findClosestSourcePoint = (points, position, tolerance = 9) => {
    const maximumDistanceSquared = tolerance * tolerance
    let closestPoint = null
    let closestDistanceSquared = maximumDistanceSquared
    for (const point of points) {
        const distanceX = point.x - position.x
        const distanceY = point.y - position.y
        const distanceSquared = distanceX * distanceX + distanceY * distanceY
        if (distanceSquared <= closestDistanceSquared) {
            closestPoint = point
            closestDistanceSquared = distanceSquared
        }
    }
    return closestPoint
}
