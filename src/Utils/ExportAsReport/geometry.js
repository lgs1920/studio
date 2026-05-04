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

    const startLongitude = finiteNumber(start.longitude)
    const startLatitudeValue = finiteNumber(start.latitude)
    const stopLongitude = finiteNumber(stop.longitude)
    const stopLatitudeValue = finiteNumber(stop.latitude)
    if (startLongitude === null || startLatitudeValue === null || stopLongitude === null || stopLatitudeValue === null) {
        return 0
    }

    const radius = 6371008.8
    const startLatitude = startLatitudeValue * Math.PI / 180
    const stopLatitude = stopLatitudeValue * Math.PI / 180
    const deltaLatitude = (stopLatitudeValue - startLatitudeValue) * Math.PI / 180
    const deltaLongitude = (stopLongitude - startLongitude) * Math.PI / 180
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

export const pathWithColor = (path, color) => {
    path.color = color
    return path
}

export const projectedTrackPaths = (trackDrawings, project) => trackDrawings
    .flatMap(item => item.segments.map(segment => pathWithColor(segment
        .map(point => {
            const projected = project(point)
            const longitude = finiteNumber(point?.longitude)
            const latitude = finiteNumber(point?.latitude)
            return Number.isFinite(projected?.x) && Number.isFinite(projected?.y)
                   ? {
                           ...projected,
                           longitude,
                           latitude,
                       }
                   : null
        })
        .filter(Boolean), item.color)))
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
                    point: closest.point,
                    color: candidate.path.color,
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

export const pathAngleAroundSegment = (path, segmentIndex, fallback = 0) => {
    const start = path?.[segmentIndex - 1]
    const end = path?.[segmentIndex]
    const segmentAngle = screenAngle(start, end, fallback)
    const startIndex = Math.max(0, segmentIndex - 3)
    const endIndex = Math.min((path?.length ?? 1) - 1, segmentIndex + 2)

    return screenAngle(path?.[startIndex], path?.[endIndex], segmentAngle)
}

export const projectedPositionAngle = ({path, point, screenPathLength, geoPathLength, screenDistanceAt, geoDistanceAt}, span, fallback = 0) =>
    smoothedProjectedPathAngle({
                                   path,
                                   point,
                                   screenPathLength,
                                   geoPathLength,
                                   screenDistanceAt,
                                   geoDistanceAt,
                               }, span, fallback)

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

export const markerBounds = ({container, size, gap}) => ({
    minX: container.x + gap + size / 2,
    maxX: container.x + container.width - gap - size / 2,
    minY: container.y + gap + size / 2,
    maxY: container.y + container.height - gap - size / 2,
})

export const markerTopLeft = ({x, y}, {container, size, gap}) => {
    const bounds = markerBounds({container, size, gap})
    return {
        x: clamp(x, bounds.minX, bounds.maxX) - size / 2,
        y: clamp(y, bounds.minY, bounds.maxY) - size / 2,
    }
}

export const sideMarkerPositions = ({bounds, container, size, gap}) => {
    if (!validBounds(bounds)) {
        return []
    }

    const centerY = (bounds.minY + bounds.maxY) / 2

    return [
        markerTopLeft({x: bounds.minX - size / 2 - gap, y: centerY}, {container, size, gap}),
        markerTopLeft({x: bounds.maxX + size / 2 + gap, y: centerY}, {container, size, gap}),
    ]
}

export const pointAtRatio = (start, end, ratio) => ({
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
})

export const axisIntersectionSide = ({axis, point, center}) => {
    if (axis === 'vertical') {
        return point.y <= center.y ? 'top' : 'bottom'
    }

    return point.x <= center.x ? 'left' : 'right'
}

export const axisIntersectionDistance = ({axis, point, center}) => (
    axis === 'vertical'
    ? Math.abs(point.y - center.y)
    : Math.abs(point.x - center.x)
)

export const addAxisIntersection = ({
    intersections,
    axis,
    point,
    center,
    path,
    segmentIndex,
    screenPathLength,
    geoPathLength,
    screenDistanceAt,
    geoDistanceAt,
    span,
    fallbackAngle,
}) => {
    const side = axisIntersectionSide({axis, point, center})
    intersections.push({
        axis,
        side,
        point,
        color:    path.color,
        distance: axisIntersectionDistance({axis, point, center}),
        angle:    projectedPositionAngle({
            path,
            point,
            screenPathLength,
            geoPathLength,
            screenDistanceAt,
            geoDistanceAt,
        }, span, pathAngleAroundSegment(path, segmentIndex, fallbackAngle)),
    })
}

export const collectAxisIntersections = (trackInfo) => {
    const paths = trackInfo?.paths ?? []
    const bounds = trackInfo?.bounds
    if (!validBounds(bounds) || paths.length === 0) {
        return []
    }

    const center = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
    }
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
    const intersections = []
    const epsilon = 0.000001

    paths.forEach(path => {
        const screenPathLength = projectedPathLength(path)
        const geoPathLength = projectedGeoPathLength(path)
        let screenDistance = 0
        let geoDistanceAtSegmentStart = 0

        for (let index = 1; index < path.length; index++) {
            const start = path[index - 1]
            const end = path[index]
            const dx = end.x - start.x
            const dy = end.y - start.y
            const screenSegmentLength = pointDistance(start, end)
            const geoSegmentLength = geoDistance(start, end)
            const fallbackAngle = screenAngle(start, end, finiteNumber(trackInfo?.angle) ?? 0)

            if (Math.abs(dx) > epsilon) {
                const ratio = (center.x - start.x) / dx
                if (ratio >= -epsilon && ratio <= 1 + epsilon) {
                    const clampedRatio = clamp(ratio, 0, 1)
                    addAxisIntersection({
                                            intersections,
                                            axis: 'vertical',
                                            point: pointAtRatio(start, end, clampedRatio),
                                            center,
                                            path,
                                            segmentIndex: index,
                                            screenPathLength,
                                            geoPathLength,
                                            screenDistanceAt: screenDistance + screenSegmentLength * clampedRatio,
                                            geoDistanceAt:    geoDistanceAtSegmentStart + geoSegmentLength * clampedRatio,
                                            span,
                                            fallbackAngle,
                                        })
                }
            }
            else if (Math.abs(start.x - center.x) <= epsilon && Math.abs(end.x - center.x) <= epsilon) {
                addAxisIntersection({
                                        intersections,
                                        axis: 'vertical',
                                        point: pointAtRatio(start, end, 0.5),
                                        center,
                                        path,
                                        segmentIndex: index,
                                        screenPathLength,
                                        geoPathLength,
                                        screenDistanceAt: screenDistance + screenSegmentLength * 0.5,
                                        geoDistanceAt:    geoDistanceAtSegmentStart + geoSegmentLength * 0.5,
                                        span,
                                        fallbackAngle,
                                    })
            }

            if (Math.abs(dy) > epsilon) {
                const ratio = (center.y - start.y) / dy
                if (ratio >= -epsilon && ratio <= 1 + epsilon) {
                    const clampedRatio = clamp(ratio, 0, 1)
                    addAxisIntersection({
                                            intersections,
                                            axis: 'horizontal',
                                            point: pointAtRatio(start, end, clampedRatio),
                                            center,
                                            path,
                                            segmentIndex: index,
                                            screenPathLength,
                                            geoPathLength,
                                            screenDistanceAt: screenDistance + screenSegmentLength * clampedRatio,
                                            geoDistanceAt:    geoDistanceAtSegmentStart + geoSegmentLength * clampedRatio,
                                            span,
                                            fallbackAngle,
                                        })
                }
            }
            else if (Math.abs(start.y - center.y) <= epsilon && Math.abs(end.y - center.y) <= epsilon) {
                addAxisIntersection({
                                        intersections,
                                        axis: 'horizontal',
                                        point: pointAtRatio(start, end, 0.5),
                                        center,
                                        path,
                                        segmentIndex: index,
                                        screenPathLength,
                                        geoPathLength,
                                        screenDistanceAt: screenDistance + screenSegmentLength * 0.5,
                                        geoDistanceAt:    geoDistanceAtSegmentStart + geoSegmentLength * 0.5,
                                        span,
                                        fallbackAngle,
                                    })
            }

            screenDistance += screenSegmentLength
            geoDistanceAtSegmentStart += geoSegmentLength
        }
    })

    return intersections
}

export const sideAnchor = ({bounds, side}) => {
    const center = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
    }

    return {
        top:    {x: center.x, y: bounds.minY},
        right:  {x: bounds.maxX, y: center.y},
        bottom: {x: center.x, y: bounds.maxY},
        left:   {x: bounds.minX, y: center.y},
    }[side]
}

export const closestSideIntersection = (trackInfo, side) => {
    const bounds = trackInfo?.bounds
    const paths = trackInfo?.paths ?? []
    if (!validBounds(bounds) || paths.length === 0) {
        return null
    }

    const anchor = sideAnchor({bounds, side})
    const closest = closestProjectedPathPosition(paths, anchor)
    if (!closest?.point) {
        return null
    }

    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1)
    return {
        side,
        point: closest.point,
        color: closest.color,
        angle: projectedPositionAngle(closest, span, finiteNumber(trackInfo?.angle) ?? 0),
    }
}

export const externalAxisIntersections = trackInfo => {
    const intersections = collectAxisIntersections(trackInfo)

    return ['top', 'right', 'bottom', 'left']
        .map(side => intersections
        .filter(intersection => intersection.side === side)
        .sort((first, second) => second.distance - first.distance)[0] ?? closestSideIntersection(trackInfo, side))
        .filter(Boolean)
}

export const markerFromAxisIntersection = (intersection, {container, size, gap}) => ({
    ...markerTopLeft(intersection.point, {container, size, gap}),
    angle: intersection.angle,
    color: intersection.color,
})

export const dedupeMarkerPlacements = (markers, threshold = 0.75) => markers.reduce((items, marker) => {
    const duplicate = items.some(item => Math.abs(item.x - marker.x) <= threshold && Math.abs(item.y - marker.y) <= threshold)
    return duplicate ? items : [...items, marker]
}, [])

export const progressMarkerPlacements = ({trackInfo, container, size, gap}) => {
    const axisMarkers = externalAxisIntersections(trackInfo)
        .map(intersection => markerFromAxisIntersection(intersection, {container, size, gap}))

    if (axisMarkers.length > 0) {
        return axisMarkers
    }

    return sideMarkerPositions({
                                  bounds: trackInfo?.bounds,
                                  container,
                                  size,
                                  gap,
                              })
        .map(position => ({
            ...position,
            ...(() => {
                const closest = closestProjectedPathPosition(trackInfo?.paths ?? [], {
                    x: position.x + size / 2,
                    y: position.y + size / 2,
                })
                const span = validBounds(trackInfo?.bounds)
                             ? Math.max(trackInfo.bounds.maxX - trackInfo.bounds.minX, trackInfo.bounds.maxY - trackInfo.bounds.minY, 1)
                             : 1

                return closest
                       ? {
                               angle: projectedPositionAngle(closest, span, finiteNumber(trackInfo?.angle) ?? 0),
                               color: closest.color,
                           }
                       : {
                               angle: projectedTrackAngleAt(trackInfo, {
                                   x: position.x + size / 2,
                                   y: position.y + size / 2,
                               }),
                           }
            })(),
        }))
}

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
        paths: trackInfo.paths?.map(path => pathWithColor(path.map(scalePoint), path.color)) ?? [],
        angle: trackInfo.angle,
    }
}

export const svgNumber = value => Number.parseFloat(Number(value).toFixed(2))
