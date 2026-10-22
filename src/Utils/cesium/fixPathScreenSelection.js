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
 * Last modified: 2026-10-22
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

/** Prepare a reusable screen-polygon test with validated edges and fast bounds rejection. */
export const createScreenPolygonTester = polygon => {
    if (!Array.isArray(polygon) || polygon.length < 3
        || polygon.some(vertex => !Number.isFinite(vertex?.x) || !Number.isFinite(vertex?.y))) {
        return null
    }

    const bounds = polygon.reduce((result, vertex) => ({
        left: Math.min(result.left, vertex.x),
        top: Math.min(result.top, vertex.y),
        right: Math.max(result.right, vertex.x),
        bottom: Math.max(result.bottom, vertex.y),
    }), {left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity})
    const edges = polygon.map((current, index) => {
        const previous = polygon[(index - 1 + polygon.length) % polygon.length]
        const x = current.x - previous.x
        const y = current.y - previous.y
        return {
            current,
            previous,
            x,
            y,
            lengthSquared: x * x + y * y,
            length: Math.hypot(x, y),
        }
    })

    return point => {
        if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)
            || point.x < bounds.left || point.x > bounds.right
            || point.y < bounds.top || point.y > bounds.bottom) {
            return false
        }

        let inside = false
        for (const edge of edges) {
            const relativeX = point.x - edge.previous.x
            const relativeY = point.y - edge.previous.y

            if (edge.lengthSquared > 0) {
                const projection = (relativeX * edge.x + relativeY * edge.y) / edge.lengthSquared
                const crossProduct = relativeX * edge.y - relativeY * edge.x
                if (projection >= 0 && projection <= 1
                    && Math.abs(crossProduct) <= 0.75 * edge.length) {
                    return true
                }
            }

            const crossesRay = (edge.current.y > point.y) !== (edge.previous.y > point.y)
            if (crossesRay) {
                const intersectionX = edge.current.x
                    + ((point.y - edge.current.y) * (edge.previous.x - edge.current.x))
                        / (edge.previous.y - edge.current.y)
                if (point.x < intersectionX) inside = !inside
            }
        }

        return inside
    }
}

/** Test whether a projected point lies inside or on the edge of a screen polygon. */
export const isScreenPointInsidePolygon = (point, polygon) => createScreenPolygonTester(polygon)?.(point) ?? false

/** Create a yield clock that only pauses scans after they exceed a time slice. */
export const createScreenScanYieldClock = (timeBudgetMs = 8, now = () => performance.now()) => {
    const budget = Number.isFinite(timeBudgetMs) && timeBudgetMs > 0 ? timeBudgetMs : 8
    let sliceStartedAt = now()

    return {
        /** Return whether the current work slice has consumed its time budget. */
        shouldYield: () => now() - sliceStartedAt >= budget,
        /** Start a new work slice after yielding control to the browser. */
        reset: () => {
            sliceStartedAt = now()
        },
    }
}

/** Group lasso hits into route-contiguous intersection zones before visibility filtering. */
export const groupScreenSelectionPointsByRoute = points => {
    const zones = []
    for (const point of points ?? []) {
        const previousZone = zones.at(-1)
        const previousPoint = previousZone?.at(-1)
        if (!previousPoint
            || previousPoint.trackSlug !== point.trackSlug
            || previousPoint.segmentIndex !== point.segmentIndex
            || previousPoint.index + 1 !== point.index) {
            zones.push([point])
            continue
        }

        previousZone.push(point)
    }

    return zones
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
