/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: geometry.js
 *
 ******************************************************************************/

import {
    clamp,
    finiteNumber,
} from './format'

export const geoDistance = (start, stop) => {
    if (!start || !stop) {
        return 0
    }

    const radius = 6371008.8
    const startLatitude = start.latitude * Math.PI / 180
    const stopLatitude = stop.latitude * Math.PI / 180
    const deltaLatitude = (stop.latitude - start.latitude) * Math.PI / 180
    const deltaLongitude = (stop.longitude - start.longitude) * Math.PI / 180
    const haversine = Math.sin(deltaLatitude / 2) ** 2
                      + Math.cos(startLatitude) * Math.cos(stopLatitude) * Math.sin(deltaLongitude / 2) ** 2

    return 2 * radius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export const fitImageToBox = (image, box) => {
    const ratio = Math.max((image?.width ?? 1) / (image?.height ?? 1), 0.000001)
    let width = box.width
    let height = width / ratio
    if (height > box.height) {
        height = box.height
        width = height * ratio
    }

    return {
        x:      box.x + (box.width - width) / 2,
        y:      box.y + (box.height - height) / 2,
        width,
        height,
    }
}

export const getBounds = points => points.reduce((bounds, point) => ({
    west:  Math.min(bounds.west, point.longitude),
    east:  Math.max(bounds.east, point.longitude),
    south: Math.min(bounds.south, point.latitude),
    north: Math.max(bounds.north, point.latitude),
}), {
    west:  Infinity,
    east:  -Infinity,
    south: Infinity,
    north: -Infinity,
})

export const rotatePoint = ({x, y}, degrees) => {
    const radians = degrees * Math.PI / 180
    const centeredX = x - 0.5
    const centeredY = y - 0.5
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)

    return {
        x: centeredX * cos - centeredY * sin,
        y: centeredX * sin + centeredY * cos,
    }
}

export const normalizedPoint = (point, bounds) => {
    const width = Math.max(bounds.east - bounds.west, 0.000001)
    const height = Math.max(bounds.north - bounds.south, 0.000001)

    return {
        x: (point.longitude - bounds.west) / width,
        y: 1 - (point.latitude - bounds.south) / height,
    }
}

export const createProjection = ({bounds, points, box, rotation}) => {
    const rotatedPoints = points.map(point => rotatePoint(normalizedPoint(point, bounds), rotation))
    const rotatedBounds = rotatedPoints.reduce((acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxY: Math.max(acc.maxY, point.y),
    }), {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
    })
    const rotatedWidth = Math.max(rotatedBounds.maxX - rotatedBounds.minX, 0.000001)
    const rotatedHeight = Math.max(rotatedBounds.maxY - rotatedBounds.minY, 0.000001)
    const padding = 5
    const drawableWidth = Math.max(box.width - padding * 2, 1)
    const drawableHeight = Math.max(box.height - padding * 2, 1)
    const scale = Math.min(drawableWidth / rotatedWidth, drawableHeight / rotatedHeight)
    const offsetX = box.x + box.width / 2 - (rotatedBounds.minX + rotatedWidth / 2) * scale
    const offsetY = box.y + box.height / 2 - (rotatedBounds.minY + rotatedHeight / 2) * scale

    return point => {
        const rotated = rotatePoint(normalizedPoint(point, bounds), rotation)
        return {
            x: offsetX + rotated.x * scale,
            y: offsetY + rotated.y * scale,
        }
    }
}


export const directionPoint = ({x, y}, angle, distance) => {
    const radians = angle * Math.PI / 180
    return {
        x: x + Math.sin(radians) * distance,
        y: y - Math.cos(radians) * distance,
    }
}

export const screenAngle = (from, to, fallback = 0) => {
    const fromX = finiteNumber(from?.x)
    const fromY = finiteNumber(from?.y)
    const toX = finiteNumber(to?.x)
    const toY = finiteNumber(to?.y)
    if (fromX === null || fromY === null || toX === null || toY === null) {
        return fallback
    }

    const dx = toX - fromX
    const dy = toY - fromY
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (Math.abs(dx) + Math.abs(dy)) < 0.000001) {
        return fallback
    }

    return Math.atan2(dx, -dy) * 180 / Math.PI
}

export const svgRotationFromScreenAngle = (angle, defaultScreenAngle = 0) => angle - defaultScreenAngle
export const pdfRotationFromScreenAngle = (angle, defaultScreenAngle = 0) => defaultScreenAngle - angle

export const projectedBounds = points => points
    .filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
    .reduce((bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxY: Math.max(bounds.maxY, point.y),
    }), {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
    })

export const validBounds = bounds => Number.isFinite(bounds?.minX)
                              && Number.isFinite(bounds?.maxX)
                              && Number.isFinite(bounds?.minY)
                              && Number.isFinite(bounds?.maxY)

export const pointDistance = (first, second) => {
    const firstX = finiteNumber(first?.x)
    const firstY = finiteNumber(first?.y)
    const secondX = finiteNumber(second?.x)
    const secondY = finiteNumber(second?.y)
    if (firstX === null || firstY === null || secondX === null || secondY === null) {
        return 0
    }

    return Math.hypot(secondX - firstX, secondY - firstY)
}

export const projectedTrackPaths = (trackDrawings, project) => trackDrawings
    .flatMap(item => item.segments.map(segment => segment
        .map(point => {
            const projected = project(point)
            const longitude = finiteNumber(point?.longitude)
            const latitude = finiteNumber(point?.latitude)
            return Number.isFinite(projected?.x) && Number.isFinite(projected?.y) && longitude !== null && latitude !== null
                   ? {
                           ...projected,
                           longitude,
                           latitude,
                       }
                   : null
        })
        .filter(Boolean)))
    .filter(path => path.length > 1)

export const projectedPathLength = path => path.slice(1).reduce((length, point, index) => (
    length + pointDistance(path[index], point)
), 0)

export const projectedGeoPathLength = path => path.slice(1).reduce((length, point, index) => (
    length + geoDistance(path[index], point)
), 0)

export const sampleProjectedPathByScreenDistance = (path, targetDistance) => {
    if (!path?.length) {
        return null
    }

    if (targetDistance <= 0) {
        return path[0]
    }

    let distance = 0
    for (let index = 1; index < path.length; index++) {
        const start = path[index - 1]
        const end = path[index]
        const segmentLength = pointDistance(start, end)
        if (segmentLength <= 0) {
            continue
        }
        if (distance + segmentLength >= targetDistance) {
            const ratio = (targetDistance - distance) / segmentLength
            return {
                x: start.x + (end.x - start.x) * ratio,
                y: start.y + (end.y - start.y) * ratio,
            }
        }
        distance += segmentLength
    }

    return path[path.length - 1]
}

export const sampleProjectedPathByGeoDistance = (path, targetDistance) => {
    if (!path?.length) {
        return null
    }

    if (targetDistance <= 0) {
        return path[0]
    }

    let distance = 0
    for (let index = 1; index < path.length; index++) {
        const start = path[index - 1]
        const end = path[index]
        const segmentLength = geoDistance(start, end)
        if (segmentLength <= 0) {
            continue
        }
        if (distance + segmentLength >= targetDistance) {
            const ratio = (targetDistance - distance) / segmentLength
            return {
                x: start.x + (end.x - start.x) * ratio,
                y: start.y + (end.y - start.y) * ratio,
            }
        }
        distance += segmentLength
    }

    return path[path.length - 1]
}

export const closestPointOnSegment = (point, start, end) => {
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared > 0
              ? clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
              : 0
    const closest = {
        x: start.x + dx * t,
        y: start.y + dy * t,
    }

    return {
        t,
        point:           closest,
        distanceSquared: (point.x - closest.x) ** 2 + (point.y - closest.y) ** 2,
    }
}

export const closestProjectedPathPosition = (paths, anchor) => {
    const candidates = paths.map(path => ({
        path,
        screenLength: projectedPathLength(path),
        geoLength:    projectedGeoPathLength(path),
    })).filter(item => item.screenLength > 0)
    let best = null

    candidates.forEach(candidate => {
        let screenDistance = 0
        let geoDistanceAtSegmentStart = 0
        for (let index = 1; index < candidate.path.length; index++) {
            const start = candidate.path[index - 1]
            const end = candidate.path[index]
            const screenSegmentLength = pointDistance(start, end)
            const geoSegmentLength = geoDistance(start, end)
            if (screenSegmentLength <= 0) {
                geoDistanceAtSegmentStart += geoSegmentLength
                continue
            }

            const closest = closestPointOnSegment(anchor, start, end)
            const screenDistanceAt = screenDistance + screenSegmentLength * closest.t
            const geoDistanceAt = geoDistanceAtSegmentStart + geoSegmentLength * closest.t
            if (!best || closest.distanceSquared < best.distanceSquared) {
                best = {
                    path: candidate.path,
                    screenPathLength: candidate.screenLength,
                    geoPathLength:    candidate.geoLength,
                    screenDistanceAt,
                    geoDistanceAt,
                    distanceSquared: closest.distanceSquared,
                }
            }
            screenDistance += screenSegmentLength
            geoDistanceAtSegmentStart += geoSegmentLength
        }
    })

    return best
}

export const smoothedProjectedPathAngle = (position, span, fallback = 0) => {
    if (!position?.path) {
        return fallback
    }

    if (position.geoPathLength > 0) {
        const minWindow = Math.min(8, position.geoPathLength / 3)
        const maxWindow = Math.max(minWindow, Math.min(260, position.geoPathLength * 0.16))
        const window = clamp(position.geoPathLength * 0.03, minWindow, maxWindow)
        const start = sampleProjectedPathByGeoDistance(position.path, position.geoDistanceAt - window)
        const end = sampleProjectedPathByGeoDistance(position.path, position.geoDistanceAt + window)
        const angle = screenAngle(start, end, null)
        if (Number.isFinite(angle)) {
            return angle
        }
    }

    const maxWindow = Math.max(position.screenPathLength * 0.22, 1)
    const minWindow = Math.min(3, maxWindow)
    const window = clamp(span * 0.08, minWindow, maxWindow)
    const start = sampleProjectedPathByScreenDistance(position.path, position.screenDistanceAt - window)
    const end = sampleProjectedPathByScreenDistance(position.path, position.screenDistanceAt + window)

    return screenAngle(start, end, fallback)
}

export const fallbackProjectedTrackAngle = (paths, bounds) => {
    const longest = paths
        .map(path => ({
            path,
            screenPathLength: projectedPathLength(path),
            geoPathLength:    projectedGeoPathLength(path),
        }))
        .filter(item => item.screenPathLength > 0)
        .sort((first, second) => second.screenPathLength - first.screenPathLength)[0]

    if (!longest) {
        return 0
    }

    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
    return smoothedProjectedPathAngle({
        ...longest,
        screenDistanceAt: longest.screenPathLength / 2,
        geoDistanceAt:    longest.geoPathLength / 2,
    }, span, 0)
}

export const projectedTrackAngleAt = (trackInfo, anchor) => {
    const paths = trackInfo?.paths ?? []
    const bounds = trackInfo?.bounds
    if (!validBounds(bounds) || paths.length === 0) {
        return finiteNumber(trackInfo?.angle) ?? 0
    }

    const closest = closestProjectedPathPosition(paths, anchor)
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
    return closest
           ? smoothedProjectedPathAngle(closest, span, trackInfo.angle)
           : trackInfo.angle
}

export const getProjectedTrackInfo = (trackDrawings, project) => {
    const paths = projectedTrackPaths(trackDrawings, project)
    const bounds = projectedBounds(paths.flat())
    if (!validBounds(bounds)) {
        return null
    }

    return {
        bounds,
        paths,
        angle: fallbackProjectedTrackAngle(paths, bounds),
    }
}

export const sideMarkerPositions = ({bounds, container, size, gap}) => {
    if (!validBounds(bounds)) {
        return []
    }

    const centerY = (bounds.minY + bounds.maxY) / 2
    const top = clamp(centerY - size / 2, container.y + gap, container.y + container.height - size - gap)

    return [
        {
            x: clamp(bounds.minX - size - gap, container.x + gap, container.x + container.width - size - gap),
            y: top,
        },
        {
            x: clamp(bounds.maxX + gap, container.x + gap, container.x + container.width - size - gap),
            y: top,
        },
    ]
}

export const progressMarkerPlacements = ({trackInfo, container, size, gap}) => sideMarkerPositions({
                                                                                                bounds: trackInfo?.bounds,
                                                                                                container,
                                                                                                size,
                                                                                                gap,
                                                                                            })
    .map(position => ({
        ...position,
        angle: projectedTrackAngleAt(trackInfo, {
            x: position.x + size / 2,
            y: position.y + size / 2,
        }),
    }))

export const scaleTrackInfoToBox = (trackInfo, source, box) => {
    if (!trackInfo || !validBounds(trackInfo.bounds) || !source?.width || !source?.height) {
        return null
    }

    const scaleX = box.width / source.width
    const scaleY = box.height / source.height
    const scalePoint = point => ({
        x: box.x + point.x * scaleX,
        y: box.y + point.y * scaleY,
    })

    return {
        bounds: {
            minX: box.x + trackInfo.bounds.minX * scaleX,
            maxX: box.x + trackInfo.bounds.maxX * scaleX,
            minY: box.y + trackInfo.bounds.minY * scaleY,
            maxY: box.y + trackInfo.bounds.maxY * scaleY,
        },
        paths: trackInfo.paths?.map(path => path.map(scalePoint)) ?? [],
        angle: trackInfo.angle,
    }
}

export const svgNumber = value => Number.parseFloat(Number(value).toFixed(2))
