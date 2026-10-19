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
 * Last modified: 2026-10-19
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
