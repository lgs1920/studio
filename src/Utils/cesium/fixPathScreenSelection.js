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
 * Last modified: 2026-10-21
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

/** Build a closed centripetal Bezier lasso and matching sampled hit-test polygon. */
export const buildSmoothClosedScreenSelectionGeometry = (vertices, sampleCount = 8) => {
    const points = Array.isArray(vertices)
        ? vertices.filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
        : []
    if (points.length < 3) return {path: '', polygon: []}

    const steps = Number.isFinite(sampleCount) ? Math.max(4, Math.min(16, Math.round(sampleCount))) : 8
    /** Round a screen coordinate to the precision used by the SVG path. */
    const formatCoordinate = coordinate => Number(coordinate.toFixed(2))
    /** Calculate the centripetal parameter interval between two screen vertices. */
    const intervalBetween = (first, second) => Math.max(
        Math.sqrt(Math.hypot(second.x - first.x, second.y - first.y)),
        0.001,
    )
    /** Evaluate a cubic Bezier segment at a normalized progress value. */
    const evaluateBezier = (start, firstControl, secondControl, end, progress) => {
        const inverse = 1 - progress
        const inverseSquared = inverse * inverse
        const progressSquared = progress * progress
        return {
            x: inverseSquared * inverse * start.x
                + 3 * inverseSquared * progress * firstControl.x
                + 3 * inverse * progressSquared * secondControl.x
                + progressSquared * progress * end.x,
            y: inverseSquared * inverse * start.y
                + 3 * inverseSquared * progress * firstControl.y
                + 3 * inverse * progressSquared * secondControl.y
                + progressSquared * progress * end.y,
        }
    }

    const path = ['M' + formatCoordinate(points[0].x) + ' ' + formatCoordinate(points[0].y)]
    const polygon = [{x: points[0].x, y: points[0].y}]
    for (let index = 0; index < points.length; index += 1) {
        const previous = points[(index - 1 + points.length) % points.length]
        const start = points[index]
        const end = points[(index + 1) % points.length]
        const next = points[(index + 2) % points.length]
        const previousInterval = intervalBetween(previous, start)
        const currentInterval = intervalBetween(start, end)
        const nextInterval = intervalBetween(end, next)
        const firstControl = {
            x: start.x + currentInterval / 3 * (
                (start.x - previous.x) / previousInterval
                - (end.x - previous.x) / (previousInterval + currentInterval)
                + (end.x - start.x) / currentInterval
            ),
            y: start.y + currentInterval / 3 * (
                (start.y - previous.y) / previousInterval
                - (end.y - previous.y) / (previousInterval + currentInterval)
                + (end.y - start.y) / currentInterval
            ),
        }
        const secondControl = {
            x: end.x - currentInterval / 3 * (
                (end.x - start.x) / currentInterval
                - (next.x - start.x) / (currentInterval + nextInterval)
                + (next.x - end.x) / nextInterval
            ),
            y: end.y - currentInterval / 3 * (
                (end.y - start.y) / currentInterval
                - (next.y - start.y) / (currentInterval + nextInterval)
                + (next.y - end.y) / nextInterval
            ),
        }
        path.push(
            'C'
            + formatCoordinate(firstControl.x) + ' ' + formatCoordinate(firstControl.y) + ' '
            + formatCoordinate(secondControl.x) + ' ' + formatCoordinate(secondControl.y) + ' '
            + formatCoordinate(end.x) + ' ' + formatCoordinate(end.y),
        )

        for (let step = 1; step <= steps; step += 1) {
            if (index === points.length - 1 && step === steps) continue
            const progress = step / steps
            polygon.push(step === steps
                ? {x: end.x, y: end.y}
                : evaluateBezier(start, firstControl, secondControl, end, progress))
        }
    }

    return {path: path.join(' '), polygon}
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
