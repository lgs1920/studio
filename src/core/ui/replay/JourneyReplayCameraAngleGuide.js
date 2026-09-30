/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraAngleGuide.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-27
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Replay camera angle guide for the interactive Cesium map.
 */

import {
    faVideo,
} from '@fortawesome/pro-solid-svg-icons'
import {
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    Cartographic,
    Color,
    Matrix4,
    Transforms,
} from 'cesium'
import {
    REPLAY_CAMERA_HEADING_OFFSET_MAX,
    REPLAY_CAMERA_HEADING_OFFSET_MIN,
    REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_POSITION_SYSTEM,
    replayCameraSettingsFromArrowKey,
} from './JourneyReplayProgressionStyle'

export {replayCameraSettingsFromArrowKey}

const CAMERA_ANGLE_GUIDE_CAMERA_LENGTH_METERS = 1200
const CAMERA_ANGLE_GUIDE_CONE_BASE_HALF_WIDTH_METERS = 240
const CAMERA_ANGLE_GUIDE_DEPARTURE_DISTANCE_METERS = 300
const EARTH_RADIUS_METERS = 6378137
const CAMERA_ANGLE_GUIDE_MAX_SCREEN_RATIO = 0.2
const CAMERA_ANGLE_GUIDE_INNER_HEIGHT_RATIO = 0.95
const CAMERA_ANGLE_GUIDE_INNER_ARC_FLATTENING = 0.32
const CAMERA_ANGLE_GUIDE_ICON_SIZE = 28
const CAMERA_ANGLE_GUIDE_ICON_GAP_PIXELS = 28
const CAMERA_ANGLE_GUIDE_ROUTE_STROKE_PIXELS = 3
const CAMERA_ANGLE_GUIDE_ROUTE_DASH_LENGTH_PIXELS = 16
const CAMERA_ANGLE_GUIDE_ROUTE_DASH_GAP_PIXELS = 4.8
const CAMERA_ANGLE_GUIDE_ACTIVITY_ICON_GAP_PIXELS = 4
const CAMERA_ANGLE_GUIDE_MAX_ROUTE_POINTS = 16
const CAMERA_ANGLE_GUIDE_ROUTE_WINDOW_METERS = 600
const CAMERA_ANGLE_GUIDE_LOOP_CLOSURE_DISTANCE_METERS = 100
const CAMERA_ANGLE_GUIDE_ANGLE_ARC_BASE_RATIO = 0.4
const CAMERA_ANGLE_GUIDE_ANGLE_ARC_SEGMENTS = 16
const CAMERA_ANGLE_GUIDE_ANGLE_ARC_EDGE_CLEARANCE_PIXELS = 6
const CAMERA_ANGLE_GUIDE_ANGLE_LABEL_OFFSET_PIXELS = 20
const CAMERA_ANGLE_GUIDE_MIN_CAMERA_ALTITUDE_METERS = 10
const CAMERA_ANGLE_GUIDE_MAX_CAMERA_ALTITUDE_METERS = 100000
const CAMERA_ANGLE_GUIDE_MIN_CONE_SCALE = 0.25
const CAMERA_ANGLE_GUIDE_MAX_CONE_SCALE = 3.5
const CAMERA_ANGLE_GUIDE_ELEVATION_OFFSET_METERS = 5
const CAMERA_ANGLE_GUIDE_PICK_HEIGHT_TOLERANCE_METERS = 12
const CAMERA_ANGLE_GUIDE_DEPTH_CLEARANCE_METERS = 8
const CAMERA_ANGLE_GUIDE_CONE_ALPHA = 0.32
const CAMERA_ANGLE_GUIDE_OVERLAY_CLASS = 'replay-camera-angle-guide-dom'
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const DEFAULT_CAMERA_ANGLE_GUIDE_COLOR = '#ff6a00'
const DEFAULT_CAMERA_ANGLE_GUIDE_HEADING_COLOR = '#facc15'
const CAMERA_ANGLE_GUIDE_LESS_LUMINOUS_FACTOR = 0.72
const cameraAngleGuideRecords = new WeakMap()
const journeyRouteCache = new WeakMap()
let cameraAngleGuideGradientCounter = 0
let cameraAngleGuideArrowCounter = 0
let cameraAngleGuideClipCounter = 0

/**
 * Build a key for the guide geometry that requires a new DOM overlay.
 *
 * @param {Object|null} guide - Resolved replay camera guide.
 * @returns {string} Stable geometry key.
 */
const guideGeometryKeyFrom = guide => `${[
    guide?.anchor?.longitude,
    guide?.anchor?.latitude,
    guide?.anchor?.height,
    guide?.directionPoint?.longitude,
    guide?.directionPoint?.latitude,
    guide?.directionPoint?.height,
    guide?.cameraGroundHeight,
    guide?.cameraAltitude,
    guide?.coneHeight,
    guide?.axisHeading,
].map(value => Number.isFinite(Number(value)) ? Number(value).toFixed(12) : '').join('|')}|${guide?.routePositionKey ?? ''}|${guide?.looped === true}`
/**
 * Convert a coordinate-like value into a finite map position.
 *
 * @param {Array|Object|null} value - GeoJSON array or longitude/latitude object.
 * @returns {{longitude: number, latitude: number, height: number}|null} Map position.
 */
const mapPositionFrom = value => {
    const longitude = Array.isArray(value) ? Number(value[0]) : Number(value?.longitude)
    const latitude = Array.isArray(value) ? Number(value[1]) : Number(value?.latitude)
    const height = Array.isArray(value) ? Number(value[2] ?? 0) : Number(value?.height ?? value?.altitude ?? 0)
    if (![longitude, latitude, height].every(Number.isFinite)) {
        return null
    }

    return {longitude, latitude, height}
}

/**
 * Resolve the first line segment of a track.
 *
 * @param {Object|null} track - Track containing GeoJSON content.
 * @returns {Array<Array>} First coordinate segment.
 */
const firstTrackSegment = track => {
    const geometry = track?.content?.geometry
    if (geometry?.type === 'LineString' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates
    }
    if (geometry?.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
        return geometry.coordinates.find(Array.isArray) ?? []
    }
    return []
}

/**
 * Resolve the geographic distance between two trace positions in metres.
 *
 * @param {Object} start - Start map position.
 * @param {Object} end - End map position.
 * @returns {number} Approximate surface distance in metres.
 */
const mapDistanceBetween = (start, end) => {
    const startLatitude = start.latitude * Math.PI / 180
    const endLatitude = end.latitude * Math.PI / 180
    const deltaLatitude = endLatitude - startLatitude
    const deltaLongitudeDegrees = end.longitude - start.longitude
    const deltaLongitude = Math.atan2(
        Math.sin(deltaLongitudeDegrees * Math.PI / 180),
        Math.cos(deltaLongitudeDegrees * Math.PI / 180),
    )
    const meanLatitude = (startLatitude + endLatitude) / 2
    return EARTH_RADIUS_METERS * Math.hypot(
        deltaLatitude,
        deltaLongitude * Math.cos(meanLatitude),
    )
}

/**
 * Interpolate the trace position at a requested distance from its start.
 *
 * @param {Array<Object>} points - Valid trace points in order.
 * @param {number} distanceMeters - Distance from the first point.
 * @returns {Object} Position at the requested distance, or the last point.
 */
const departurePointFrom = (points, distanceMeters = CAMERA_ANGLE_GUIDE_DEPARTURE_DISTANCE_METERS) => {
    let travelled = 0
    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1]
        const current = points[index]
        const segmentDistance = mapDistanceBetween(previous, current)
        if (segmentDistance <= 0) {
            continue
        }
        if (travelled + segmentDistance >= distanceMeters) {
            const ratio = Math.max(0, Math.min(1, (distanceMeters - travelled) / segmentDistance))
            return {
                height:    previous.height + ((current.height - previous.height) * ratio),
                latitude:  previous.latitude + ((current.latitude - previous.latitude) * ratio),
                longitude: previous.longitude + ((current.longitude - previous.longitude) * ratio),
            }
        }
        travelled += segmentDistance
    }
    return points[points.length - 1]
}

/**
 * Resolve the first valid coordinate and the point 300 metres into the trace.
 *
 * @param {Array<Array>} coordinates - Track coordinates.
 * @returns {{directionPoint: Object, points: Array<Object>, start: Object, next: Object}|null} Start and direction coordinates.
 */
const firstTrackDirection = coordinates => {
    const points = coordinates.map(mapPositionFrom).filter(Boolean)
    if (points.length < 2) {
        return null
    }
    return {
        directionPoint: departurePointFrom(points),
        next:          points[1],
        points,
        start:         points[0],
    }
}

/**
 * Resolve the first track from a journey map or iterable.
 *
 * @param {Object|null} journey - Journey containing tracks.
 * @returns {Object|null} First track.
 */
const firstTrackFrom = journey => Array.from(journey?.tracks?.values?.() ?? [])[0] ?? null

/**
 * Resolve coarse route sections immediately around the journey departure.
 *
 * @param {Object|null} journey - Journey containing tracks.
 * @returns {Array<Object>} Coarsely sampled departure and return sections.
 */
const journeyRouteSegmentsFrom = journey => {
    if (!journey || typeof journey !== 'object') {
        return []
    }
    const tracks = Array.from(journey.tracks?.values?.() ?? [])
    const sourceSegments = tracks.flatMap((track, trackIndex) => {
        const geometry = track?.content?.geometry
        const coordinates = geometry?.type === 'LineString'
            ? [geometry.coordinates]
            : geometry?.type === 'MultiLineString' ? geometry.coordinates : []
        return coordinates.filter(Array.isArray).map((source, segmentIndex) => ({
            source,
            trackIndex,
            trackSlug: track?.slug ?? null,
            segmentIndex,
        }))
    })
    const cached = journeyRouteCache.get(journey)
    if (cached
        && cached.sources.length === sourceSegments.length
        && cached.sources.every((source, index) => source === sourceSegments[index].source
            && cached.trackSlugs[index] === sourceSegments[index].trackSlug
            && cached.trackIndices[index] === sourceSegments[index].trackIndex
            && cached.segmentIndices[index] === sourceSegments[index].segmentIndex)) {
        return cached.segments
    }

    const firstSource = sourceSegments.find(segment => segment.source.length > 0)
    const lastSource = [...sourceSegments].reverse().find(segment => segment.source.length > 0)
    const selectedSegments = firstSource && lastSource && firstSource.source.length > 1
        ? [firstSource, lastSource]
        : firstSource ? [firstSource] : []
    const segments = selectedSegments.map((segment, index) => {
        const fromEnd = selectedSegments.length > 1 && index === selectedSegments.length - 1
        const ordered = fromEnd ? [...segment.source].reverse() : segment.source
        const validPoints = ordered.map(mapPositionFrom).filter(Boolean)
        const window = [validPoints[0]]
        let distance = 0
        for (let pointIndex = 1; pointIndex < validPoints.length; pointIndex += 1) {
            const previous = validPoints[pointIndex - 1]
            const point = validPoints[pointIndex]
            const segmentDistance = mapDistanceBetween(previous, point)
            if (distance + segmentDistance >= CAMERA_ANGLE_GUIDE_ROUTE_WINDOW_METERS) {
                const remainingRatio = (CAMERA_ANGLE_GUIDE_ROUTE_WINDOW_METERS - distance) / segmentDistance
                window.push({
                    height: previous.height + ((point.height - previous.height) * remainingRatio),
                    latitude: previous.latitude + ((point.latitude - previous.latitude) * remainingRatio),
                    longitude: previous.longitude + ((point.longitude - previous.longitude) * remainingRatio),
                })
                break
            }
            window.push(point)
            distance += segmentDistance
        }
        const pointCount = Math.min(window.length, CAMERA_ANGLE_GUIDE_MAX_ROUTE_POINTS)
        const sampled = pointCount <= 1
            ? window
            : Array.from({length: pointCount}, (_, pointIndex) => window[
                Math.round(pointIndex * (window.length - 1) / (pointCount - 1))
            ])
        const points = fromEnd ? sampled.reverse() : sampled
        return {
            points,
            segmentIndex: segment.segmentIndex,
            trackIndex: segment.trackIndex,
            trackSlug: segment.trackSlug,
        }
    }).filter(segment => segment.points.length > 0)
    journeyRouteCache.set(journey, {
        sources: sourceSegments.map(segment => segment.source),
        trackSlugs: sourceSegments.map(segment => segment.trackSlug),
        trackIndices: sourceSegments.map(segment => segment.trackIndex),
        segmentIndices: sourceSegments.map(segment => segment.segmentIndex),
        segments,
    })
    return segments
}

/**
 * Check whether the journey's hidden end stop closes back near its departure.
 * The stop POI's `tooClose` flag is authoritative; raw endpoints cover journeys
 * whose POI flags have not been loaded yet.
 *
 * @param {Object} journey - Journey containing track boundary POI references.
 * @param {Map|Object} pois - Main POI store or compatible lookup.
 * @param {Array<Object>} routeSegments - Coarsely sampled route segments.
 * @returns {boolean} Whether the route closes near its departure point.
 */
const journeyIsLooped = (journey, pois, routeSegments) => {
    const tracks = Array.from(journey?.tracks?.values?.() ?? [])
    const lastStopReference = tracks.at(-1)?.flags?.stop
    const stopPoi = lastStopReference && typeof lastStopReference === 'object'
        ? lastStopReference
        : pois?.get?.(lastStopReference) ?? pois?.[lastStopReference]
    if (stopPoi && typeof stopPoi.tooClose === 'boolean') {
        return stopPoi.tooClose
    }
    const first = routeSegments[0]?.points[0]
    const last = routeSegments.at(-1)?.points.at(-1)
    return Boolean(first && last && mapDistanceBetween(first, last) < CAMERA_ANGLE_GUIDE_LOOP_CLOSURE_DISTANCE_METERS)
}

/**
 * Calculate a clockwise bearing from north between two map positions.
 *
 * @param {Object} start - Start map position.
 * @param {Object} end - End map position.
 * @returns {number} Bearing in radians.
 */
const bearingBetween = (start, end) => {
    const startLongitude = start.longitude * Math.PI / 180
    const endLongitude = end.longitude * Math.PI / 180
    const startLatitude = start.latitude * Math.PI / 180
    const endLatitude = end.latitude * Math.PI / 180
    const deltaLongitude = endLongitude - startLongitude
    const x = Math.sin(deltaLongitude) * Math.cos(endLatitude)
    const y = Math.cos(startLatitude) * Math.sin(endLatitude)
        - Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(deltaLongitude)
    return Math.atan2(x, y)
}

/**
/**
 * Resolve the route section following the journey departure.
 *
 * @param {Array<Object>} segments - Coarsely sampled route segments.
 * @returns {Object} Route stroke following the departure point.
 */
const routePartsFrom = segments => {
    const firstSegment = segments[0]?.points ?? []
    const first = firstSegment[0] ?? null
    return {
        after: firstSegment.length > 1 ? [firstSegment] : [],
        positionKey: segments.map(segment => `${segment.trackSlug ?? ''}:${segment.segmentIndex}:${segment.points.length}`).join('|'),
        start: first,
    }
}

/**
 * Resolve a live direction from the source points surrounding the replay
 * sample. When no live sample is available, the departure bearing is resolved
 * over the first 300 metres of the trace.
 *
 * @param {Object} sample - Current replay sample.
 * @returns {{anchor: Object, axisHeading: number, cameraGroundHeight: number, directionPoint: Object}|null} Live guide direction.
 */
const directionFromReplaySample = sample => {
    const anchor = mapPositionFrom(sample)
    if (!anchor) {
        return null
    }

    const startPoint = mapPositionFrom(sample.source?.startPoint)
    const endPoint = mapPositionFrom(sample.source?.endPoint)
    const hasForwardPoint = endPoint && mapDistanceBetween(anchor, endPoint) > 1
    const hasPreviousPoint = startPoint && mapDistanceBetween(startPoint, anchor) > 1
    const axisHeading = hasForwardPoint
        ? bearingBetween(anchor, endPoint)
        : hasPreviousPoint ? bearingBetween(startPoint, anchor) : null
    if (!Number.isFinite(axisHeading)) {
        return null
    }

    const angularDistance = CAMERA_ANGLE_GUIDE_DEPARTURE_DISTANCE_METERS / EARTH_RADIUS_METERS
    const startLatitude = anchor.latitude * Math.PI / 180
    const startLongitude = anchor.longitude * Math.PI / 180
    const destinationLatitude = Math.asin(
        (Math.sin(startLatitude) * Math.cos(angularDistance))
        + (Math.cos(startLatitude) * Math.sin(angularDistance) * Math.cos(axisHeading)),
    )
    const destinationLongitude = startLongitude + Math.atan2(
        Math.sin(axisHeading) * Math.sin(angularDistance) * Math.cos(startLatitude),
        Math.cos(angularDistance) - (Math.sin(startLatitude) * Math.sin(destinationLatitude)),
    )
    const cameraGroundHeight = hasForwardPoint ? endPoint.height : anchor.height

    return {
        anchor,
        axisHeading,
        cameraGroundHeight,
        directionPoint: {
            height:    anchor.height,
            latitude:  destinationLatitude * 180 / Math.PI,
            longitude: destinationLongitude * 180 / Math.PI,
        },
    }
}

const departureHeadingFrom = points => bearingBetween(points[0], departurePointFrom(points))

/**
 * Clamp the user-facing angle while preserving the drawer sign convention.
 *
 * @param {number} value - Persisted replay heading offset.
 * @returns {number} Display angle in degrees.
 */
const displayAngleFrom = value => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
        return 0
    }
    const clampedValue = Math.max(REPLAY_CAMERA_HEADING_OFFSET_MIN, Math.min(REPLAY_CAMERA_HEADING_OFFSET_MAX, -numericValue))
    return Math.round(clampedValue)
}

/**
 * Resolve live map guide geometry from the replay sample, or the departure
 * geometry while Replay is being prepared.
 *
 * @param {Object} options - Guide options.
 * @param {Object|null} options.journey - Journey containing the route.
 * @param {Object} options.camera - Replay camera settings.
 * @param {Map|Object} [options.pois] - POI lookup for hidden loop-end stops.
 * @param {Object|null} [options.sample=null] - Current replay sample.
 * @returns {Object|null} Renderer-independent guide geometry.
 */
export const resolveJourneyReplayCameraAngleGuide = ({journey, camera, pois, sample = null} = {}) => {
    const positionMode = camera?.positionMode
    if (!journey || positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
        return null
    }

    const direction = directionFromReplaySample(sample)
        ?? firstTrackDirection(firstTrackSegment(firstTrackFrom(journey)))
    if (!direction) {
        return null
    }

    const anchor = direction.anchor ?? direction.start
    const axisHeading = direction.axisHeading ?? departureHeadingFrom(direction.points)
    const angleDegrees = displayAngleFrom(camera?.headingOffset)
    const routeSegments = journeyRouteSegmentsFrom(journey)
    const looped = journeyIsLooped(journey, pois, routeSegments)
    const routeParts = routePartsFrom(routeSegments)
    const baseHeading = positionMode === REPLAY_CAMERA_POSITION_AHEAD
        ? axisHeading + Math.PI
        : axisHeading
    const angleRadians = -angleDegrees * Math.PI / 180
    const cameraHeading = baseHeading + angleRadians

    return {
        anchor,
        angleDegrees,
        axisHeading,
        cameraGroundHeight: direction.cameraGroundHeight ?? direction.next.height,
        cameraAltitude: camera?.altitude,
        cameraHeading,
        coneHeading: cameraHeading + Math.PI,
        coneHeight: Math.max(anchor.height, direction.cameraGroundHeight ?? direction.next.height) + CAMERA_ANGLE_GUIDE_ELEVATION_OFFSET_METERS,
        directionPoint: direction.directionPoint,
        looped,
        mode: positionMode === REPLAY_CAMERA_POSITION_AHEAD ? 'Ahead' : 'Behind',
        offsetRadians: angleRadians,
        baseHeading,
        activityIcon: journey.activitySettings?.icon ?? 'person-hiking',
        routeAfter: routeParts.after,
        routePositionKey: routeParts.positionKey,
        routeStart: routeParts.start,
    }
}

/**
 * Build a local ENU position from a bearing and forward/lateral offsets.
 *
 * @param {Matrix4} transform - ENU transform at the guide anchor.
 * @param {number} heading - Bearing in radians.
 * @param {number} forward - Forward distance in metres.
 * @param {number} lateral - Lateral distance in metres.
 * @returns {Cartesian3} World position.
 */
const positionAtHeadingOffset = (transform, heading, forward, lateral = 0) => Matrix4.multiplyByPoint(
    transform,
    new Cartesian3(
        (Math.sin(heading) * forward) + (Math.cos(heading) * lateral),
        (Math.cos(heading) * forward) - (Math.sin(heading) * lateral),
        0,
    ),
    new Cartesian3(),
)

/**
 * Build a local ENU position from a bearing and forward distance.
 *
 * @param {Matrix4} transform - ENU transform at the guide anchor.
 * @param {number} heading - Bearing in radians.
 * @param {number} distance - Distance in metres.
 * @returns {Cartesian3} World position.
 */
const positionAtHeading = (transform, heading, distance) => positionAtHeadingOffset(transform, heading, distance)

/**
 * Resolve the world-space cone length allowed by the current map viewport.
 *
 * The initial length is capped to twenty percent of the smallest viewport
 * dimension. Once reduced by a closer zoom, the length is not increased by a
 * later zoom out, which prevents the guide from growing unexpectedly.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Cartesian3} anchor - Cone anchor in world coordinates.
 * @param {number} currentLength - Current guide length in metres.
 * @returns {number} Cone length in metres.
 */
const coneLengthFrom = (viewer, anchor, currentLength = CAMERA_ANGLE_GUIDE_CAMERA_LENGTH_METERS) => {
    const scene = viewer?.scene
    const camera = viewer?.camera
    const width = Number(scene?.drawingBufferWidth ?? viewer?.canvas?.clientWidth)
    const height = Number(scene?.drawingBufferHeight ?? viewer?.canvas?.clientHeight)
    const safeCurrentLength = Number.isFinite(currentLength) && currentLength > 0
        ? currentLength
        : CAMERA_ANGLE_GUIDE_CAMERA_LENGTH_METERS
    if (!camera?.getPixelSize || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return safeCurrentLength
    }

    try {
        const metersPerPixel = camera.getPixelSize(new BoundingSphere(anchor, 1), width, height)
        if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
            return safeCurrentLength
        }
        const viewportLimit = metersPerPixel * Math.min(width, height) * CAMERA_ANGLE_GUIDE_MAX_SCREEN_RATIO
        return Math.max(1, Math.min(safeCurrentLength, viewportLimit))
    }
    catch {
        return safeCurrentLength
    }
}

/**
 * Resolve the world-space anchors and transforms used to draw a guide.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Object} guide - Renderer-independent guide geometry.
 * @param {number} currentConeLength - Current viewport-capped cone length.
 * @returns {Object} World-space overlay geometry.
 */
const worldGeometryFrom = (viewer, guide, currentConeLength = null) => {
    const groundAnchor = Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, guide.anchor.height)
    const guideHeight = Number.isFinite(guide.coneHeight) ? guide.coneHeight : guide.anchor.height
    let anchorTerrainHeight = null
    try {
        anchorTerrainHeight = viewer?.scene?.globe?.getHeight?.(Cartographic.fromCartesian(groundAnchor)) ?? null
    }
    catch {
        anchorTerrainHeight = null
    }
    const coneHeight = Math.max(
        guideHeight - CAMERA_ANGLE_GUIDE_ELEVATION_OFFSET_METERS,
        Number.isFinite(anchorTerrainHeight) ? anchorTerrainHeight : Number.NEGATIVE_INFINITY,
    ) + CAMERA_ANGLE_GUIDE_ELEVATION_OFFSET_METERS
    const anchor = Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, coneHeight)
    const visibilityAnchor = Cartesian3.fromDegrees(
        guide.anchor.longitude,
        guide.anchor.latitude,
        coneHeight,
    )
    const transform = Transforms.eastNorthUpToFixedFrame(anchor)
    const groundTransform = Transforms.eastNorthUpToFixedFrame(groundAnchor)
    const directionPosition = guide.directionPoint
        ? Cartesian3.fromDegrees(
            guide.directionPoint.longitude,
            guide.directionPoint.latitude,
            coneHeight,
        )
        : positionAtHeading(
            transform,
            guide.axisHeading,
            CAMERA_ANGLE_GUIDE_DEPARTURE_DISTANCE_METERS,
        )
    return {
        anchor,
        coneLength: coneLengthFrom(viewer, anchor, currentConeLength ?? CAMERA_ANGLE_GUIDE_CAMERA_LENGTH_METERS),
        directionPosition,
        groundAnchor,
        groundTransform,
        transform,
        visibilityAnchor,
    }
}

/**
 * Resolve a fixed height offset that places the journey route on the cone plane.
 *
 * @param {Cartesian3} anchor - Elevated cone anchor.
 * @param {Object} guide - Camera guide with route departure coordinates.
 * @returns {number} Height offset applied consistently to route points.
 */
const routeHeightOffsetFrom = (anchor, guide) => (
    (Cartographic.fromCartesian(anchor)?.height ?? guide.anchor.height)
    - (guide.routeStart?.height ?? guide.anchor.height)
)

/**
 * Resolve a small world-space gap corresponding to the icon separation.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Cartesian3} anchor - Reference position in world coordinates.
 * @returns {number} Gap in metres.
 */
const iconGapFrom = (viewer, anchor, pixelGap = CAMERA_ANGLE_GUIDE_ICON_GAP_PIXELS) => {
    const scene = viewer?.scene
    const camera = viewer?.camera
    // The returned value is in Cesium world metres. The pixel gap is expressed
    // in drawing-buffer pixels here and is converted by the camera projection.
    const width = Number(scene?.drawingBufferWidth ?? viewer?.canvas?.clientWidth)
    const height = Number(scene?.drawingBufferHeight ?? viewer?.canvas?.clientHeight)
    if (!camera?.getPixelSize || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return 20
    }

    try {
        const metersPerPixel = camera.getPixelSize(new BoundingSphere(anchor, 1), width, height)
        return Number.isFinite(metersPerPixel) && metersPerPixel > 0
            ? metersPerPixel * pixelGap
            : 20
    }
    catch {
        return 20
    }
}

/**
 * Set the ellipsoid height of a world position without changing its longitude or latitude.
 *
 * @param {Cartesian3} position - World position.
 * @param {number} height - Ellipsoid height in metres.
 * @returns {Cartesian3} Position at the requested height, or the original position.
 */
const positionAtHeight = (position, height) => {
    if (!position || !Number.isFinite(height)) {
        return position
    }

    const cartographic = Cartographic.fromCartesian(position)
    if (!cartographic) {
        return position
    }
    cartographic.height = height
    return Cartographic.toCartesian(cartographic)
}

/**
 * Resolve the cone vertices from the fixed anchor and tangent orientation.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Cartesian3} anchor - Cone anchor in world coordinates.
 * @param {Matrix4} transform - ENU transform at the elevated cone anchor.
 * @param {Matrix4} groundTransform - ENU transform at the trace ground anchor.
 * @param {Object} guide - Resolved guide geometry.
 * @param {number} coneHeading - Current cone heading in radians.
 * @param {number|null} coneLength - Optional viewport-capped cone length.
 * @returns {{cameraEnd: Cartesian3, cameraGroundPosition: Cartesian3, videoIconPosition: Cartesian3, inner: Array<Cartesian3>, innerBaseCenter: Cartesian3, outer: Array<Cartesian3>, outerBaseCenter: Cartesian3}} Cone vertices.
 */
const coneGeometryFrom = (viewer, anchor, transform, groundTransform, guide, coneHeading = guide.coneHeading, coneLength = null) => {
    const length = Number.isFinite(coneLength) && coneLength > 0
        ? coneLength
        : coneLengthFrom(viewer, anchor)
    const iconGap = iconGapFrom(viewer, anchor)
    const baseHalfWidth = Math.min(CAMERA_ANGLE_GUIDE_CONE_BASE_HALF_WIDTH_METERS, length * 0.32)
    const innerBaseHalfWidth = baseHalfWidth * CAMERA_ANGLE_GUIDE_INNER_HEIGHT_RATIO
    const outerBaseLeft = positionAtHeadingOffset(transform, coneHeading, 0, -baseHalfWidth)
    const outerBaseRight = positionAtHeadingOffset(transform, coneHeading, 0, baseHalfWidth)
    const outerTip = positionAtHeading(transform, coneHeading, length)
    const videoIconPosition = positionAtHeading(transform, coneHeading, length + iconGap)
    const innerBaseOffset = length * (1 - CAMERA_ANGLE_GUIDE_INNER_HEIGHT_RATIO)
    const innerBaseLeft = positionAtHeadingOffset(transform, coneHeading, innerBaseOffset, -innerBaseHalfWidth)
    const innerBaseRight = positionAtHeadingOffset(transform, coneHeading, innerBaseOffset, innerBaseHalfWidth)
    const innerBaseCenter = positionAtHeading(transform, coneHeading, innerBaseOffset)
    const cameraGroundPosition = positionAtHeight(
        positionAtHeading(groundTransform, coneHeading, length + iconGap),
        guide.cameraGroundHeight,
    )
    return {
        cameraEnd:             outerTip,
        cameraGroundPosition,
        videoIconPosition,
        inner:                 [innerBaseLeft, innerBaseRight, outerTip],
        innerBaseCenter,
        outer:                 [outerBaseLeft, outerBaseRight, outerTip],
        outerBaseCenter:       anchor,
    }
}

/**
 * Resolve a guide color safely.
 *
 * @param {string} value - CSS color.
 * @param {string} fallback - Fallback CSS color.
 * @returns {Color} Cesium color.
 */
const guideColorFrom = (value, fallback = DEFAULT_CAMERA_ANGLE_GUIDE_COLOR) => {
    try {
        return Color.fromCssColorString(value ?? fallback)
    }
    catch {
        return Color.fromCssColorString(fallback)
    }
}

/**
 * Resolve a CSS custom property from the active document theme.
 *
 * @param {string} propertyName - CSS custom property name.
 * @param {string} fallback - Fallback CSS color.
 * @returns {string} Resolved CSS color.
 */
const cssThemeColorFrom = (propertyName, fallback) => {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') {
        return fallback
    }
    const value = getComputedStyle(document.documentElement).getPropertyValue(propertyName).trim()
    const variableMatch = value.match(/^var\(\s*(--[\w-]+)\s*\)$/)
    if (variableMatch && variableMatch[1] !== propertyName) {
        return cssThemeColorFrom(variableMatch[1], fallback)
    }
    return value || fallback
}

/**
 * Reduce the luminosity of a Cesium color while keeping it opaque.
 *
 * @param {Color} color - Source color.
 * @returns {Color} Less luminous opaque color.
 */
const lessLuminousColorFrom = (color, factor = CAMERA_ANGLE_GUIDE_LESS_LUMINOUS_FACTOR) => new Color(
    color.red * factor,
    color.green * factor,
    color.blue * factor,
    1,
)

/**
 * Build a self-contained SVG data URL for a map billboard icon.
 *
 * @param {Object} definition - FontAwesome icon definition.
 * @param {Color} foreground - Icon foreground color.
 * @returns {string} SVG data URL.
 */
const iconDataUriFrom = (definition, foreground) => {
    const [iconWidth, iconHeight, , , pathData] = definition.icon
    const size = CAMERA_ANGLE_GUIDE_ICON_SIZE
    const iconSize = size * 0.48
    const scale = Math.min(iconSize / iconWidth, iconSize / iconHeight)
    const x = (size - iconWidth * scale) / 2
    const y = (size - iconHeight * scale) / 2
    const paths = (Array.isArray(pathData) ? pathData : [pathData])
        .filter(Boolean)
        .map(path => `<path d="${path}" fill="${foreground.toCssColorString()}"/>`)
        .join('')
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" data-icon="${definition.iconName}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#ffffff" stroke="${foreground.toCssColorString()}" stroke-width="2"/>
            <g transform="translate(${x} ${y}) scale(${scale})">${paths}</g>
        </svg>
    `.trim()

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * Create an SVG element for the DOM guide.
 *
 * @param {string} name - SVG element name.
 * @param {Object} attributes - SVG attributes.
 * @returns {SVGElement} Created SVG element.
 */
const createSvgElement = (name, attributes = {}) => {
    const element = document.createElementNS(SVG_NAMESPACE, name)
    Object.entries(attributes).forEach(([attribute, value]) => element.setAttribute(attribute, String(value)))
    return element
}

/**
 * Convert a Cesium color into an opaque CSS RGB value.
 *
 * @param {Color} color - Cesium color.
 * @returns {string} CSS RGB value.
 */
const cssColorFrom = color => color.toCssColorString()

/**
 * Project a world position into both Cesium canvas and DOM overlay coordinates.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {HTMLElement} overlay - DOM overlay.
 * @param {Cartesian3} position - World position.
 * @returns {{canvas: {x: number, y: number}, dom: {x: number, y: number}}|null} Projected coordinates.
 */
const guideProjectionFrom = (viewer, overlay, position) => {
    const scene = viewer?.scene
    const canvas = scene?.canvas
    const projected = scene?.cartesianToCanvasCoordinates?.(position, new Cartesian2())
    if (!projected || !canvas || !overlay) {
        return null
    }

    const canvasRect = canvas.getBoundingClientRect?.() ?? {left: 0, top: 0}
    const overlayRect = overlay.getBoundingClientRect?.() ?? {left: 0, top: 0}
    const canvasWidth = Number(canvas.clientWidth) || Number(canvasRect.width) || 1
    const canvasHeight = Number(canvas.clientHeight) || Number(canvasRect.height) || 1
    const canvasScaleX = Number(canvasRect.width) > 0 ? canvasRect.width / canvasWidth : 1
    const canvasScaleY = Number(canvasRect.height) > 0 ? canvasRect.height / canvasHeight : 1
    return {
        canvas: {
            x: projected.x,
            y: projected.y,
        },
        dom: {
            x: (projected.x * canvasScaleX) + canvasRect.left - overlayRect.left,
            y: (projected.y * canvasScaleY) + canvasRect.top - overlayRect.top,
        },
    }
}

/**
 * Project a world position into the DOM overlay's local coordinates.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {HTMLElement} overlay - DOM overlay.
 * @param {Cartesian3} position - World position.
 * @returns {{x: number, y: number}|null} Overlay coordinates.
 */
const projectGuidePosition = (viewer, overlay, position) => guideProjectionFrom(viewer, overlay, position)?.dom ?? null

/**
 * Recenter projected base endpoints on their projected Cesium base center.
 *
 * Perspective projection can move the midpoint of two projected endpoints
 * away from the projection of their 3D midpoint. The guide must remain
 * centered on the actual elevated Cesium position, so the correction is made
 * in CSS pixels only after all world positions have been projected.
 *
 * @param {{x: number, y: number}} baseLeft - Projected left endpoint.
 * @param {{x: number, y: number}} baseRight - Projected right endpoint.
 * @param {{x: number, y: number}|null} baseCenter - Projected 3D base center.
 * @returns {Array<{x: number, y: number}>} Recentered endpoints.
 */
const recenterProjectedBase = (baseLeft, baseRight, baseCenter) => {
    if (!baseCenter) {
        return [baseLeft, baseRight]
    }

    const midpoint = {
        x: (baseLeft.x + baseRight.x) / 2,
        y: (baseLeft.y + baseRight.y) / 2,
    }
    const offset = {
        x: baseCenter.x - midpoint.x,
        y: baseCenter.y - midpoint.y,
    }
    return [
        {x: baseLeft.x + offset.x, y: baseLeft.y + offset.y},
        {x: baseRight.x + offset.x, y: baseRight.y + offset.y},
    ]
}

/**
 * Return the shortest signed angle from one DOM direction to another.
 *
 * @param {number} from - Current DOM angle in radians.
 * @param {number} to - Desired DOM angle in radians.
 * @returns {number} Signed angle delta in radians.
 */
const domAngleDeltaFrom = (from, to) => {
    const fullTurn = Math.PI * 2
    return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}

/**
 * Calculate a direction angle in the DOM coordinate system.
 *
 * @param {{x: number, y: number}} origin - Projected origin in CSS pixels.
 * @param {{x: number, y: number}} direction - Projected direction point in CSS pixels.
 * @returns {number|null} DOM angle in radians, or null for a zero vector.
 */
const domAngleFrom = (origin, direction) => {
    const deltaX = direction.x - origin.x
    const deltaY = direction.y - origin.y
    if (Math.hypot(deltaX, deltaY) <= 0) {
        return null
    }
    return Math.atan2(deltaY, deltaX)
}

/**
 * Resolve angle arc positions in the map's local tangent plane.
 *
 * @param {Matrix4} transform - ENU frame at the replay position.
 * @param {number} baselineHeading - Tangent-relative camera baseline.
 * @param {number} cameraHeading - Configured camera direction.
 * @param {number} radius - Arc radius in map metres.
 * @returns {{positions: Array<Cartesian3>}} World-space arc.
 */
const firstBezierPointAtRadiusFrom = (points, center, radius) => {
    if (points.length < 2) {
        return null
    }

    const first = points[0]
    const control = points[1]
    const end = points.length > 2
        ? {x: (points[1].x + points[2].x) / 2, y: (points[1].y + points[2].y) / 2}
        : points[1]
    const pointAt = ratio => points.length > 2
        ? {
            x: ((1 - ratio) ** 2 * first.x) + (2 * (1 - ratio) * ratio * control.x) + (ratio ** 2 * end.x),
            y: ((1 - ratio) ** 2 * first.y) + (2 * (1 - ratio) * ratio * control.y) + (ratio ** 2 * end.y),
        }
        : {
            x: first.x + ((end.x - first.x) * ratio),
            y: first.y + ((end.y - first.y) * ratio),
        }
    let previous = pointAt(0)
    let previousDistance = Math.hypot(previous.x - center.x, previous.y - center.y)
    let closest = previous
    let closestDifference = Math.abs(previousDistance - radius)
    for (let index = 1; index <= 100; index += 1) {
        const current = pointAt(index / 100)
        const currentDistance = Math.hypot(current.x - center.x, current.y - center.y)
        const difference = Math.abs(currentDistance - radius)
        if (difference < closestDifference) {
            closest = current
            closestDifference = difference
        }
        if (currentDistance >= radius && previousDistance <= radius && currentDistance > previousDistance) {
            const ratio = (radius - previousDistance) / (currentDistance - previousDistance)
            return {
                x: previous.x + ((current.x - previous.x) * ratio),
                y: previous.y + ((current.y - previous.y) * ratio),
            }
        }
        previous = current
        previousDistance = currentDistance
    }
    return closest
}

/**
 * Draw a smooth angle arc from the camera axis to the projected simulation point.
 *
 * @param {{x: number, y: number}} center - Projected simulation departure.
 * @param {{x: number, y: number}} simulationPoint - Point on the projected Bézier.
 * @param {{x: number, y: number}} cameraPoint - Projected camera direction.
 * @returns {Array<{x: number, y: number}>|null} Smooth arc points ending on the simulation trace.
 */
const angleArcPointsFrom = (center, simulationPoint, cameraPoint) => {
    const simulationHeading = domAngleFrom(center, simulationPoint)
    const cameraHeading = domAngleFrom(center, cameraPoint)
    if (simulationHeading === null || cameraHeading === null) {
        return null
    }

    const delta = domAngleDeltaFrom(cameraHeading, simulationHeading)
    const simulationRadius = Math.hypot(
        simulationPoint.x - center.x,
        simulationPoint.y - center.y,
    )
    if (!Number.isFinite(simulationRadius) || simulationRadius <= 0) {
        return null
    }
    const points = Array.from({length: CAMERA_ANGLE_GUIDE_ANGLE_ARC_SEGMENTS + 1}, (_, index) => {
        const heading = cameraHeading + (delta * index / CAMERA_ANGLE_GUIDE_ANGLE_ARC_SEGMENTS)
        return {
            x: center.x + (Math.cos(heading) * simulationRadius),
            y: center.y + (Math.sin(heading) * simulationRadius),
        }
    })
    points[points.length - 1] = simulationPoint
    return points
}

/**
 * Build a clip path inset from the cone sides and open beyond its base.
 *
 * @param {Array<{x: number, y: number}>} vertices - Projected cone vertices.
 * @param {number} inset - Required distance from the cone edges in CSS pixels.
 * @param {number} width - Overlay width in CSS pixels.
 * @param {number} height - Overlay height in CSS pixels.
 * @returns {string} Side-inset SVG clip path that does not constrain the base.
 */
const sideInsetClipPathFrom = (vertices, inset, width, height) => {
    const [first, second, third] = vertices
    const orientation = (
        ((second.x - first.x) * (third.y - first.y))
        - ((second.y - first.y) * (third.x - first.x))
    )
    const inwardSign = orientation >= 0 ? 1 : -1
    const offsetSide = (start, end) => {
        const deltaX = end.x - start.x
        const deltaY = end.y - start.y
        const length = Math.hypot(deltaX, deltaY)
        if (length <= 0) {
            return null
        }
        const offset = {
            x: (-deltaY * inwardSign * inset) / length,
            y: (deltaX * inwardSign * inset) / length,
        }
        return {
            start: {x: start.x + offset.x, y: start.y + offset.y},
            end: {x: end.x + offset.x, y: end.y + offset.y},
            direction: {x: deltaX / length, y: deltaY / length},
        }
    }
    const leftSide = offsetSide(first, second)
    const rightSide = offsetSide(second, third)
    if (!leftSide || !rightSide) {
        return ''
    }
    const denominator = (leftSide.direction.x * rightSide.direction.y)
        - (leftSide.direction.y * rightSide.direction.x)
    if (Math.abs(denominator) < 1e-8) {
        return ''
    }
    const offsetDeltaX = rightSide.start.x - leftSide.start.x
    const offsetDeltaY = rightSide.start.y - leftSide.start.y
    const intersectionRatio = (
        (offsetDeltaX * rightSide.direction.y) - (offsetDeltaY * rightSide.direction.x)
    ) / denominator
    const insetTip = {
        x: leftSide.start.x + (leftSide.direction.x * intersectionRatio),
        y: leftSide.start.y + (leftSide.direction.y * intersectionRatio),
    }
    const extension = Math.max(Math.hypot(width, height) * 2, 1000)
    const farRight = {
        x: rightSide.end.x + (rightSide.direction.x * extension),
        y: rightSide.end.y + (rightSide.direction.y * extension),
    }
    const farLeft = {
        x: leftSide.start.x - (leftSide.direction.x * extension),
        y: leftSide.start.y - (leftSide.direction.y * extension),
    }
    const clipVertices = [leftSide.start, insetTip, rightSide.end, farRight, farLeft]
    return `M ${clipVertices.map(point => `${point.x} ${point.y}`).join(' L ')} Z`
}

/**
 * Place the angle label on the base side of the arc along the camera axis.
 *
 * @param {{x: number, y: number}} center - Projected simulation departure.
 * @param {{x: number, y: number}} cameraPoint - Projected camera direction.
 * @param {number} arcRadius - Projected arc radius in CSS pixels.
 * @returns {{x: number, y: number}|null} Label position on the base side of the arc.
 */
const angleArcLabelFrom = (center, cameraPoint, arcRadius) => {
    const cameraHeading = domAngleFrom(center, cameraPoint)
    if (cameraHeading === null || arcRadius <= 0) {
        return null
    }
    const labelRadius = Math.max(4, arcRadius - CAMERA_ANGLE_GUIDE_ANGLE_LABEL_OFFSET_PIXELS)
    return {
        x: center.x + (Math.cos(cameraHeading) * labelRadius),
        y: center.y + (Math.sin(cameraHeading) * labelRadius),
    }
}

/**
 * Round route corners with short SVG quadratic curves.
 *
 * @param {Array<{x: number, y: number}>} points - Projected map-plane points.
 * @returns {string} SVG path data.
 */
const svgBezierPathFrom = points => {
    if (points.length < 2) {
        return ''
    }

    const [first] = points
    const commands = [`M ${first.x} ${first.y}`]
    for (let index = 1; index < points.length - 1; index += 1) {
        const point = points[index]
        const next = points[index + 1]
        const midpoint = {
            x: (point.x + next.x) / 2,
            y: (point.y + next.y) / 2,
        }
        commands.push(`Q ${point.x} ${point.y} ${midpoint.x} ${midpoint.y}`)
    }
    const last = points.at(-1)
    commands.push(`L ${last.x} ${last.y}`)
    return commands.join(' ')
}

/**
 * Convert projected points to a straight SVG path.
 *
 * @param {Array<{x: number, y: number}>} points - Projected map-plane points.
 * @returns {string} SVG path data.
 */
const svgPolylinePathFrom = points => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

/**
 * Convert projected route sections to one SVG path with separate subpaths.
 *
 * @param {Array<Array<{x: number, y: number}>>} sections - Projected route lines.
 * @returns {string} SVG path data.
 */
const svgRoutePathFrom = sections => sections
    .filter(section => section.length > 1)
    .map(section => svgBezierPathFrom(section))
    .join(' ')

/**
 * Project geographic route points into independent SVG polylines.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {HTMLElement} overlay - Guide overlay.
 * @param {Array<Array<Object>>} sections - Geographic route sections.
 * @returns {Array<Array<{x: number, y: number}>>} Projected visible route sections.
 */
const projectedRouteSectionsFrom = (viewer, overlay, sections, heightOffset = CAMERA_ANGLE_GUIDE_ELEVATION_OFFSET_METERS) => {
    const projectedSections = []
    sections.forEach(section => {
        let visiblePoints = []
        section.forEach(point => {
            const worldPosition = Cartesian3.fromDegrees(
                point.longitude,
                point.latitude,
                point.height + heightOffset,
            )
            const projectedPoint = projectGuidePosition(viewer, overlay, worldPosition)
            if (projectedPoint) {
                visiblePoints.push(projectedPoint)
            }
            else if (visiblePoints.length > 1) {
                projectedSections.push(visiblePoints)
                visiblePoints = []
            }
            else {
                visiblePoints = []
            }
        })
        if (visiblePoints.length > 1) {
            projectedSections.push(visiblePoints)
        }
    })
    return projectedSections
}

/**
 * Keep text aligned with the projected trace while preventing upside-down text.
 *
 * @param {number|null} angle - Projected trace direction in radians.
 * @returns {number} Readable SVG text rotation in degrees.
 */
const readableMapTextRotationFrom = angle => {
    if (!Number.isFinite(angle)) {
        return 0
    }
    const halfTurn = Math.PI
    const normalized = ((angle + (Math.PI / 2)) % halfTurn + halfTurn) % halfTurn - (Math.PI / 2)
    return normalized * 180 / Math.PI
}

/**
 * Format the configured camera angle for the guide label.
 *
 * @param {number} angleDegrees - Display angle in degrees.
 * @returns {string} Formatted angle label.
 */
const angleLabelFrom = angleDegrees => {
    const value = Number(angleDegrees)
    if (!Number.isFinite(value)) {
        return ''
    }
    const roundedValue = Math.round(value)
    return `${roundedValue > 0 ? '+' : ''}${roundedValue}°`
}

/**
 * Build the SVG arc command joining two points with an optionally flattened base.
 *
 * @param {{x: number, y: number}} baseLeft - Left base point.
 * @param {{x: number, y: number}} baseRight - Right base point.
 * @param {{x: number, y: number}} tip - Shared cone tip.
 * @param {number} flattening - Vertical radius multiplier for the base arc.
 * @returns {string} SVG arc command.
 */
const svgBaseArcCommandFrom = (baseLeft, baseRight, tip, flattening = 1) => {
    const baseVector = {
        x: baseRight.x - baseLeft.x,
        y: baseRight.y - baseLeft.y,
    }
    const baseRadius = Math.max(0.5, Math.hypot(baseVector.x, baseVector.y) / 2)
    const arcRadius = Math.max(0.5, baseRadius * flattening)
    const baseMiddle = {
        x: (baseLeft.x + baseRight.x) / 2,
        y: (baseLeft.y + baseRight.y) / 2,
    }
    const tipVector = {
        x: tip.x - baseMiddle.x,
        y: tip.y - baseMiddle.y,
    }
    const cross = (baseVector.x * tipVector.y) - (baseVector.y * tipVector.x)
    const sweep = cross < 0 ? 1 : 0
    const rotation = Math.atan2(baseVector.y, baseVector.x) * 180 / Math.PI
    return `A ${baseRadius} ${arcRadius} ${rotation} 0 ${sweep} ${baseLeft.x} ${baseLeft.y}`
}

/**
 * Build a filled SVG cone path with a curved base.
 *
 * @param {{x: number, y: number}} baseLeft - Left base point.
 * @param {{x: number, y: number}} baseRight - Right base point.
 * @param {{x: number, y: number}} tip - Shared cone tip.
 * @param {number} flattening - Vertical radius multiplier for the base arc.
 * @returns {string} SVG path data.
 */
const svgConePathFrom = (baseLeft, baseRight, tip, flattening = 1) => `M ${baseLeft.x} ${baseLeft.y} L ${tip.x} ${tip.y} L ${baseRight.x} ${baseRight.y} ${svgBaseArcCommandFrom(baseLeft, baseRight, tip, flattening)} Z`

/**
 * Resolve a gradient axis whose constant-opacity lines are parallel to the
 * rounded base. This keeps both cone sides at the same gradient position.
 *
 * @param {{x: number, y: number}} tip - Inner cone tip.
 * @param {{x: number, y: number}} baseLeft - Inner base left point.
 * @param {{x: number, y: number}} baseRight - Inner base right point.
 * @returns {{start: {x: number, y: number}, end: {x: number, y: number}}} Gradient axis.
 */
const svgGradientAxisFrom = (tip, baseLeft, baseRight) => {
    const baseVector = {
        x: baseRight.x - baseLeft.x,
        y: baseRight.y - baseLeft.y,
    }
    const baseLength = Math.hypot(baseVector.x, baseVector.y)
    if (baseLength <= 0) {
        return {end: tip, start: tip}
    }

    const baseMiddle = {
        x: (baseLeft.x + baseRight.x) / 2,
        y: (baseLeft.y + baseRight.y) / 2,
    }
    let normal = {
        x: -baseVector.y / baseLength,
        y: baseVector.x / baseLength,
    }
    let depth = ((baseMiddle.x - tip.x) * normal.x) + ((baseMiddle.y - tip.y) * normal.y)
    if (depth < 0) {
        normal = {x: -normal.x, y: -normal.y}
        depth = -depth
    }
    return {
        end: {
            x: tip.x + (normal.x * depth),
            y: tip.y + (normal.y * depth),
        },
        start: tip,
    }
}

/**
 * Create an SVG stroke path style.
 *
 * @param {Color} color - Stroke color.
 * @returns {Object} SVG attributes.
 */
const svgStrokeAttributesFrom = (color, width = 1) => ({
    'vector-effect':  'non-scaling-stroke',
    fill:             'none',
    stroke:           cssColorFrom(color),
    'stroke-linecap': 'butt',
    'stroke-width':   width,
})

/**
 * Position an HTML icon at projected map coordinates.
 *
 * @param {HTMLElement} icon - DOM icon element.
 * @param {{x: number, y: number}|null} point - Projected position.
 * @param {number|null} heading - Projected DOM heading in radians.
 * @returns {void}
 */
const positionGuideIcon = (icon, point, heading = null) => {
    if (!point) {
        icon.style.display = 'none'
        return
    }
    icon.style.display = icon.dataset.visibleDisplay ?? 'block'
    icon.style.left = `${point.x}px`
    icon.style.top = `${point.y}px`
    icon.style.transform = Number.isFinite(heading)
        ? `translate(-50%, -50%) rotate(${heading}rad)`
        : 'translate(-50%, -50%)'
}

/**
 * Move the activity icon behind the simulation start while keeping a small gap.
 *
 * @param {{x: number, y: number}|null} routeStart - Projected simulation start.
 * @param {{x: number, y: number}|null} routeNext - Next projected route point.
 * @returns {{x: number, y: number}|null} Icon center with its edge offset from the route.
 */
const activityIconPositionFrom = (routeStart, routeNext) => {
    if (!routeStart || !routeNext) {
        return null
    }
    const directionLength = Math.hypot(routeNext.x - routeStart.x, routeNext.y - routeStart.y)
    if (directionLength <= 0) {
        return routeStart
    }
    const offset = (CAMERA_ANGLE_GUIDE_ICON_SIZE / 2) + CAMERA_ANGLE_GUIDE_ACTIVITY_ICON_GAP_PIXELS
    return {
        x: routeStart.x - (((routeNext.x - routeStart.x) / directionLength) * offset),
        y: routeStart.y - (((routeNext.y - routeStart.y) / directionLength) * offset),
    }
}

/**
 * Check whether a Cesium Cartesian contains finite coordinates.
 *
 * @param {Cartesian3|null} position - Cartesian position.
 * @returns {boolean} Whether the position is usable.
 */
const isFiniteCartesianPosition = position => Boolean(
    position
    && [position.x, position.y, position.z].every(Number.isFinite),
)

/**
 * Check whether a depth pick projects back to the pixel that was queried.
 *
 * @param {Object} scene - Cesium scene.
 * @param {Cartesian3} position - Picked world position.
 * @param {{x: number, y: number}} expectedCanvasPoint - Queried canvas point.
 * @returns {boolean} Whether the pick is spatially consistent.
 */
const isGuidePickProjectionConsistent = (scene, position, expectedCanvasPoint) => {
    if (typeof scene?.cartesianToCanvasCoordinates !== 'function') {
        return true
    }
    try {
        const projectedPick = scene.cartesianToCanvasCoordinates(position, new Cartesian2())
        return Boolean(
            projectedPick
            && Number.isFinite(projectedPick.x)
            && Number.isFinite(projectedPick.y)
            && Math.hypot(projectedPick.x - expectedCanvasPoint.x, projectedPick.y - expectedCanvasPoint.y) <= 4,
        )
    }
    catch {
        return false
    }
}

/**
 * Check whether the elevated departure anchor is visible in the current map.
 * The pick altitude is allowed to differ from the simulated trace altitude;
 * only a pick clearly above the elevated guide can occlude it.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {HTMLElement} overlay - DOM overlay.
 * @param {Cartesian3} position - Elevated departure position.
 * @param {boolean} checkDepth - Whether the current rendered depth may be used.
 * @returns {boolean} Whether the departure point can currently be seen.
 */
const isGuideWorldPositionVisible = (viewer, overlay, position, checkDepth) => {
    const projection = guideProjectionFrom(viewer, overlay, position)
    if (!projection) {
        return true
    }

    const scene = viewer?.scene
    const camera = viewer?.camera ?? scene?.camera
    const cameraPosition = camera?.positionWC ?? camera?.position
    if (!scene || !camera || !isFiniteCartesianPosition(cameraPosition) || !checkDepth) {
        return true
    }

    const canvasPosition = new Cartesian2(projection.canvas.x, projection.canvas.y)
    let pickedPosition = null
    if (scene.pickPositionSupported === true && typeof scene.pickPosition === 'function') {
        try {
            pickedPosition = scene.pickPosition(canvasPosition)
        }
        catch {
            pickedPosition = null
        }
    }
    if (!isFiniteCartesianPosition(pickedPosition)) {
        const pickRay = camera.getPickRay?.(canvasPosition)
        pickedPosition = pickRay ? scene.globe?.pick?.(pickRay, scene) : null
    }
    if (!isFiniteCartesianPosition(pickedPosition)) {
        return true
    }
    if (!isGuidePickProjectionConsistent(scene, pickedPosition, projection.canvas)) {
        return true
    }

    try {
        const targetCartographic = Cartographic.fromCartesian(position)
        const pickedCartographic = Cartographic.fromCartesian(pickedPosition)
        if (targetCartographic && pickedCartographic
            && pickedCartographic.height <= targetCartographic.height + CAMERA_ANGLE_GUIDE_PICK_HEIGHT_TOLERANCE_METERS) {
            return true
        }
        const targetDistance = Cartesian3.distance(cameraPosition, position)
        const pickedDistance = Cartesian3.distance(cameraPosition, pickedPosition)
        return pickedDistance + CAMERA_ANGLE_GUIDE_DEPTH_CLEARANCE_METERS >= targetDistance
    }
    catch {
        return true
    }
}

/**
 * Update the DOM guide from the current Cesium camera projection.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Object} record - Mounted guide record.
 * @param {boolean} checkDepth - Whether the current rendered depth may be used.
 * @returns {'drawn'|'hidden'|'unprojected'} Guide update status.
 */
const updateGuideOverlay = (viewer, record, checkDepth = true) => {
    const {overlay, elements} = record
    const overlayRect = overlay.getBoundingClientRect?.() ?? {}
    const width = Number(overlayRect.width) || overlay.clientWidth || viewer.scene.canvas?.clientWidth || 1
    const height = Number(overlayRect.height) || overlay.clientHeight || viewer.scene.canvas?.clientHeight || 1
    if (!checkDepth) {
        // A camera event is a geometry update, not a visibility decision.
        // Restore the overlay immediately so a previous occlusion result cannot
        // leave the guide hidden while Cesium is between projections.
        overlay.style.visibility = 'visible'
    }
    updateRouteGuideOverlay(viewer, record, width, height)
    if (!isGuideWorldPositionVisible(viewer, overlay, record.visibilityAnchor, checkDepth)) {
        elements.svg.style.visibility = 'hidden'
        elements.videoIcon.style.display = 'none'
        overlay.style.visibility = 'visible'
        return 'hidden'
    }
    elements.svg.style.visibility = 'visible'
    const coneHeading = record.guide.coneHeading
    record.coneLength = coneLengthFrom(viewer, record.anchor, record.coneLength)
    const coneScale = Number.isFinite(record.guide.cameraAltitude)
        ? Math.max(
            CAMERA_ANGLE_GUIDE_MIN_CONE_SCALE,
            Math.min(CAMERA_ANGLE_GUIDE_MAX_CONE_SCALE, record.guide.cameraAltitude / CAMERA_ANGLE_GUIDE_CAMERA_LENGTH_METERS),
        )
        : 1
    const geometry = coneGeometryFrom(
        viewer,
        record.anchor,
        record.transform,
        record.groundTransform,
        record.guide,
        coneHeading,
        record.coneLength * coneScale,
    )
    const outer = geometry.outer.map(position => projectGuidePosition(viewer, overlay, position))
    const inner = geometry.inner.map(position => projectGuidePosition(viewer, overlay, position))
    const outerBaseCenter = projectGuidePosition(viewer, overlay, geometry.outerBaseCenter)
    const innerBaseCenter = projectGuidePosition(viewer, overlay, geometry.innerBaseCenter)
    const cameraGround = projectGuidePosition(viewer, overlay, geometry.cameraGroundPosition)
    const videoIcon = projectGuidePosition(viewer, overlay, geometry.videoIconPosition)

    if (outer.some(point => !point) || inner.some(point => !point)) {
        // Keep the last valid cone visible while Cesium temporarily has no
        // screen projection (camera flight, resize, or tile update).
        overlay.style.visibility = 'visible'
        return 'unprojected'
    }

    const rotationCenter = outerBaseCenter
    const [outerLeft, outerRight, tip] = outer
    const [innerOuterLeft, innerOuterRight, innerTip] = inner
    const [left, right] = recenterProjectedBase(outerLeft, outerRight, outerBaseCenter)
    const [innerLeft, innerRight] = recenterProjectedBase(innerOuterLeft, innerOuterRight, innerBaseCenter)
    const projectedRoute = projectedRouteSectionsFrom(
        viewer,
        overlay,
        record.guide.routeAfter ?? [],
        record.routeHeightOffset,
    )[0]
    const requestedArcRadius = Math.hypot(right.x - left.x, right.y - left.y) * CAMERA_ANGLE_GUIDE_ANGLE_ARC_BASE_RATIO
    const angleArcClipPath = sideInsetClipPathFrom(
        [left, tip, right],
        CAMERA_ANGLE_GUIDE_ANGLE_ARC_EDGE_CLEARANCE_PIXELS,
        width,
        height,
    )
    const simulationPoint = projectedRoute && angleArcClipPath
        ? firstBezierPointAtRadiusFrom(projectedRoute, rotationCenter, requestedArcRadius)
        : null
    const simulationArcRadius = simulationPoint
        ? Math.hypot(simulationPoint.x - rotationCenter.x, simulationPoint.y - rotationCenter.y)
        : requestedArcRadius
    const angleArcLabel = rotationCenter && tip
        ? angleArcLabelFrom(rotationCenter, tip, simulationArcRadius)
        : null
    const angleArcPoints = rotationCenter && simulationPoint && tip
        ? angleArcPointsFrom(rotationCenter, simulationPoint, tip)
        : null
    const angleArc = angleArcPoints && angleArcLabel
        ? {label: angleArcLabel, path: svgPolylinePathFrom(angleArcPoints)}
        : null
    const innerGradientAxis = svgGradientAxisFrom(innerTip, innerLeft, innerRight)
    const outerPath = svgConePathFrom(left, right, tip)
    elements.angleArcClipShape.setAttribute('d', angleArcClipPath)
    elements.interactionPath.setAttribute('d', outerPath)
    elements.tipDragTarget.setAttribute('cx', tip.x)
    elements.tipDragTarget.setAttribute('cy', tip.y)
    elements.outer.setAttribute('d', outerPath)
    elements.inner.setAttribute('d', svgConePathFrom(
        innerLeft,
        innerRight,
        innerTip,
        CAMERA_ANGLE_GUIDE_INNER_ARC_FLATTENING,
    ))
    elements.cameraAxis.setAttribute('x1', rotationCenter.x)
    elements.cameraAxis.setAttribute('y1', rotationCenter.y)
    elements.cameraAxis.setAttribute('x2', videoIcon?.x ?? tip.x)
    elements.cameraAxis.setAttribute('y2', videoIcon?.y ?? tip.y)
    elements.cameraAxis.style.display = 'block'
    if (angleArc) {
        elements.angleArc.setAttribute('d', angleArc.path)
        elements.angleArc.style.display = 'block'
    }
    else {
        elements.angleArc.style.display = 'none'
    }
    if (angleArcLabel) {
        elements.angleLabel.textContent = angleLabelFrom(record.guide.angleDegrees)
        elements.angleLabel.setAttribute('x', angleArcLabel.x)
        elements.angleLabel.setAttribute('y', angleArcLabel.y)
        const cameraAxisAngle = domAngleFrom(rotationCenter, tip)
        const textRotation = readableMapTextRotationFrom(
            Number.isFinite(cameraAxisAngle) ? cameraAxisAngle + (Math.PI / 2) : null,
        )
        elements.angleLabel.setAttribute('transform', `rotate(${textRotation} ${angleArcLabel.x} ${angleArcLabel.y})`)
        elements.angleLabel.style.display = 'block'
    }
    else {
        elements.angleLabel.style.display = 'none'
    }
    elements.innerGradient.setAttribute('x1', innerGradientAxis.start.x)
    elements.innerGradient.setAttribute('y1', innerGradientAxis.start.y)
    elements.innerGradient.setAttribute('x2', innerGradientAxis.end.x)
    elements.innerGradient.setAttribute('y2', innerGradientAxis.end.y)
    elements.leftSide.setAttribute('x1', left.x)
    elements.leftSide.setAttribute('y1', left.y)
    elements.leftSide.setAttribute('x2', tip.x)
    elements.leftSide.setAttribute('y2', tip.y)
    elements.rightSide.setAttribute('x1', right.x)
    elements.rightSide.setAttribute('y1', right.y)
    elements.rightSide.setAttribute('x2', tip.x)
    elements.rightSide.setAttribute('y2', tip.y)
    if (cameraGround && videoIcon) {
        elements.cameraElevation.setAttribute('x1', cameraGround.x)
        elements.cameraElevation.setAttribute('y1', cameraGround.y)
        elements.cameraElevation.setAttribute('x2', videoIcon.x)
        elements.cameraElevation.setAttribute('y2', videoIcon.y)
        elements.cameraElevation.style.display = 'block'
    }
    else {
        elements.cameraElevation.style.display = 'none'
    }
    const projectedConeHeading = rotationCenter && tip
        ? domAngleFrom(rotationCenter, tip)
        : null
    positionGuideIcon(
        elements.videoIcon,
        videoIcon,
        projectedConeHeading === null ? null : projectedConeHeading + Math.PI,
    )
    elements.svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    record.projectedAnchor = outerBaseCenter
    overlay.style.visibility = 'visible'
    return 'drawn'
}

/**
 * Draw the departure simulation independently of camera-cone projection.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Object} record - Mounted guide record.
 * @param {number} width - Overlay width in CSS pixels.
 * @param {number} height - Overlay height in CSS pixels.
 * @returns {void}
 */
const updateRouteGuideOverlay = (viewer, record, width, height) => {
    const {elements, overlay} = record
    const projectedRoute = projectedRouteSectionsFrom(
        viewer,
        overlay,
        record.guide.routeAfter ?? [],
        record.routeHeightOffset,
    )
    const routeAfterPath = svgRoutePathFrom(projectedRoute)
    elements.routeAfter.setAttribute('d', routeAfterPath)
    elements.routeAfter.setAttribute('stroke-dasharray', record.guide.looped
        ? `${CAMERA_ANGLE_GUIDE_ROUTE_DASH_LENGTH_PIXELS} ${CAMERA_ANGLE_GUIDE_ROUTE_DASH_GAP_PIXELS}`
        : 'none')
    elements.routeAfter.style.display = routeAfterPath ? 'block' : 'none'
    const routeStart = projectedRoute[0]?.[0] ?? null
    const routeNext = projectedRoute[0]?.[1] ?? null
    positionGuideIcon(elements.activityIcon, activityIconPositionFrom(routeStart, routeNext))
    elements.routeSvg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    elements.routeSvg.style.visibility = 'visible'
}

/**
 * Create the DOM overlay and its SVG guide elements.
 *
 * @param {Object} options - Overlay options.
 * @param {Object} options.viewer - Cesium viewer.
 * @param {Color} options.headingColor - Cone fill color.
 * @param {Color} options.aheadColor - Cone side and drone color.
 * @returns {{overlay: HTMLElement, elements: Object}|null} Created overlay.
 */
const createGuideOverlay = ({viewer, headingColor, aheadColor, activityIconName}) => {
    const container = viewer?.container ?? viewer?.scene?.canvas?.parentElement
    if (!container || typeof document === 'undefined') {
        return null
    }

    const overlay = document.createElement('div')
    overlay.className = CAMERA_ANGLE_GUIDE_OVERLAY_CLASS
    overlay.setAttribute('aria-hidden', 'true')
    Object.assign(overlay.style, {
        inset:        '0',
        overflow:     'hidden',
        pointerEvents: 'none',
        position:     'absolute',
        visibility:   'visible',
        width:        '100%',
        height:       '100%',
        zIndex:       '2',
    })

    const svg = createSvgElement('svg', {
        'aria-hidden': 'true',
        height:        '100%',
        preserveAspectRatio: 'none',
        width:         '100%',
    })
    const routeSvg = createSvgElement('svg', {
        'aria-hidden': 'true',
        height:        '100%',
        preserveAspectRatio: 'none',
        width:         '100%',
    })
    Object.assign(svg.style, {
        height:       '100%',
        left:         '0',
        overflow:     'visible',
        pointerEvents: 'none',
        position:     'absolute',
        top:          '0',
        touchAction:  'none',
        userSelect:   'none',
        width:        '100%',
    })
    Object.assign(routeSvg.style, {
        height:       '100%',
        left:         '0',
        overflow:     'visible',
        pointerEvents: 'none',
        position:     'absolute',
        top:          '0',
        userSelect:   'none',
        width:        '100%',
        zIndex:       '1',
    })
    svg.style.cursor = 'grab'
    const interactionPath = createSvgElement('path', {
        'data-part': 'cone-drag-target',
        fill: 'transparent',
        'pointer-events': 'fill',
    })
    interactionPath.style.cursor = 'grab'
    interactionPath.style.pointerEvents = 'fill'
    const tipDragTarget = createSvgElement('circle', {
        'data-part': 'cone-tip-drag-target',
        fill: 'transparent',
        'pointer-events': 'all',
        r: '10',
    })
    tipDragTarget.style.cursor = 'ns-resize'
    tipDragTarget.style.pointerEvents = 'all'
    const outer = createSvgElement('path', {
        'data-part': 'outer',
        fill:       'none',
    })
    const inner = createSvgElement('path', {
        'data-part': 'inner',
        fill:        `url(#replay-camera-angle-guide-inner-gradient-${++cameraAngleGuideGradientCounter})`,
    })
    inner.style.pointerEvents = 'fill'
    const innerGradientId = inner.getAttribute('fill').slice(5, -1)
    const innerGradient = createSvgElement('linearGradient', {
        id:            innerGradientId,
        gradientUnits: 'userSpaceOnUse',
        x1:            0,
        x2:            0,
        y1:            0,
        y2:            1,
    })
    const gradientStart = createSvgElement('stop', {
        'stop-color': headingColor.toCssColorString(),
        'stop-opacity': CAMERA_ANGLE_GUIDE_CONE_ALPHA,
        offset:        '0%',
    })
    const gradientEnd = createSvgElement('stop', {
        'stop-color': headingColor.toCssColorString(),
        'stop-opacity': 0,
        offset:        '100%',
    })
    const definitions = createSvgElement('defs')
    const angleArcClipId = `replay-camera-angle-guide-angle-clip-${++cameraAngleGuideClipCounter}`
    const angleArcClip = createSvgElement('clipPath', {
        id: angleArcClipId,
        clipPathUnits: 'userSpaceOnUse',
    })
    const angleArcClipShape = createSvgElement('path')
    angleArcClip.append(angleArcClipShape)
    innerGradient.append(gradientStart, gradientEnd)
    definitions.append(innerGradient, angleArcClip)
    const createLine = color => createSvgElement('line', svgStrokeAttributesFrom(color))
    const leftSide = createLine(aheadColor)
    const rightSide = createLine(aheadColor)
    const cameraElevation = createLine(aheadColor)
    const cameraAxis = createLine(aheadColor)
    cameraAxis.setAttribute('data-part', 'camera-position-axis')
    cameraAxis.setAttribute('stroke', cssColorFrom(headingColor))
    cameraAxis.setAttribute('stroke-width', '3')
    cameraAxis.setAttribute('stroke-dasharray', '6 5')
    cameraAxis.setAttribute('stroke-linecap', 'round')
    const angleArc = createSvgElement('path', {
        'data-part': 'camera-angle-arc',
        fill: 'none',
        stroke: cssColorFrom(headingColor),
        'stroke-dasharray': '6 5',
        'stroke-linecap': 'round',
        'stroke-width': '3',
    })
    angleArc.setAttribute('clip-path', `url(#${angleArcClipId})`)
    const createRoutePath = (part, dashed = false) => createSvgElement('path', {
        'data-part': part,
        fill: 'none',
        stroke: cssColorFrom(headingColor),
        'stroke-dasharray': dashed
            ? `${CAMERA_ANGLE_GUIDE_ROUTE_DASH_LENGTH_PIXELS} ${CAMERA_ANGLE_GUIDE_ROUTE_DASH_GAP_PIXELS}`
            : 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-width': CAMERA_ANGLE_GUIDE_ROUTE_STROKE_PIXELS,
    })
    const routeAfter = createRoutePath('journey-route-after')
    routeAfter.setAttribute('stroke-linecap', 'butt')
    const routeArrowMarkerId = `replay-camera-angle-guide-route-arrow-${++cameraAngleGuideArrowCounter}`
    const routeArrowMarker = createSvgElement('marker', {
        id: routeArrowMarkerId,
        markerHeight: '12',
        markerUnits: 'userSpaceOnUse',
        markerWidth: '16',
        orient: 'auto',
        refX: '14',
        refY: '6',
        viewBox: '0 0 16 12',
    })
    const routeArrowHead = createSvgElement('path', {
        d: 'M 0 0 L 16 6 L 0 12 z',
        fill: cssColorFrom(headingColor),
    })
    routeArrowMarker.append(routeArrowHead)
    routeAfter.setAttribute('marker-end', `url(#${routeArrowMarkerId})`)
    const routeDefinitions = createSvgElement('defs')
    routeDefinitions.append(routeArrowMarker)
    const angleLabel = createSvgElement('text', {
        'data-part':       'angle-label',
        'dominant-baseline': 'middle',
        fill:              cssColorFrom(headingColor),
        opacity:           1,
        'text-anchor':      'middle',
    })
    angleLabel.style.fontFamily = 'system-ui, sans-serif'
    angleLabel.style.fontSize = '14px'
    angleLabel.style.fontWeight = '700'
    angleLabel.style.paintOrder = 'stroke'
    angleLabel.style.pointerEvents = 'none'
    angleLabel.style.userSelect = 'none'
    angleLabel.setAttribute('stroke', 'rgba(0, 0, 0, 0.9)')
    angleLabel.setAttribute('stroke-width', '4')
    angleLabel.setAttribute('stroke-linejoin', 'round')
    svg.append(
        definitions,
        interactionPath,
        outer,
        inner,
        leftSide,
        rightSide,
        cameraAxis,
        cameraElevation,
        angleArc,
        angleLabel,
        tipDragTarget,
    )
    routeSvg.append(routeDefinitions, routeAfter)

    const createIcon = (image) => {
        const icon = document.createElement('img')
        icon.alt = ''
        icon.draggable = false
        icon.src = image
        Object.assign(icon.style, {
            display:     'none',
            height:      `${CAMERA_ANGLE_GUIDE_ICON_SIZE}px`,
            pointerEvents: 'none',
            position:    'absolute',
            transform:   'translate(-50%, -50%)',
            width:       `${CAMERA_ANGLE_GUIDE_ICON_SIZE}px`,
        })
        return icon
    }
    const videoIcon = createIcon(iconDataUriFrom(faVideo, aheadColor))
    videoIcon.style.pointerEvents = 'auto'
    videoIcon.style.cursor = 'grab'
    const activityIcon = document.createElement('div')
    activityIcon.setAttribute('data-part', 'trace-activity-icon')
    activityIcon.setAttribute('aria-hidden', 'true')
    activityIcon.dataset.visibleDisplay = 'flex'
    Object.assign(activityIcon.style, {
        alignItems:   'center',
        background:   '#ffffff',
        border:       `2px solid ${cssColorFrom(aheadColor)}`,
        borderRadius: '50%',
        boxSizing:    'border-box',
        display:      'none',
        height:       `${CAMERA_ANGLE_GUIDE_ICON_SIZE}px`,
        justifyContent: 'center',
        pointerEvents: 'none',
        position:     'absolute',
        width:        `${CAMERA_ANGLE_GUIDE_ICON_SIZE}px`,
    })
    const activityGlyph = document.createElement('wa-icon')
    activityGlyph.setAttribute('data-part', 'trace-activity-glyph')
    activityGlyph.setAttribute('aria-hidden', 'true')
    activityGlyph.setAttribute('name', activityIconName || 'person-hiking')
    activityGlyph.setAttribute('variant', 'solid')
    Object.assign(activityGlyph.style, {
        color:    cssColorFrom(aheadColor),
        fontSize: `${CAMERA_ANGLE_GUIDE_ICON_SIZE * 0.48}px`,
        height:   `${CAMERA_ANGLE_GUIDE_ICON_SIZE * 0.48}px`,
        width:    `${CAMERA_ANGLE_GUIDE_ICON_SIZE * 0.48}px`,
    })
    activityIcon.append(activityGlyph)
    overlay.append(routeSvg, svg, videoIcon, activityIcon)
    container.appendChild(overlay)
    return {
        elements: {
            angleLabel,
            angleArc,
            angleArcClipShape,
            cameraAxis,
            cameraElevation,
            interactionPath,
            tipDragTarget,
            videoIcon,
            innerGradient,
            inner,
            leftSide,
            outer,
            rightSide,
            svg,
            routeSvg,
            routeAfter,
            activityIcon,
            activityGlyph,
        },
        overlay,
    }
}

/**
 * Keep the DOM guide synchronized with camera movement and map resizing.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Object} record - Mounted guide record.
 * @param {boolean} checkDepth - Whether the current rendered depth may be used.
 * @returns {'drawn'|'hidden'|'unprojected'} Guide update status.
 */
const updateGuideGeometry = (viewer, record, checkDepth = true) => {
    const status = updateGuideOverlay(viewer, record, checkDepth)
    if (status === 'drawn') {
        record.projectionRetryCount = 0
    }
    else if (status === 'unprojected' && record.projectionRetryCount < 4) {
        record.projectionRetryCount += 1
        viewer.scene?.requestRender?.()
    }
    return status
}

/**
 * Bind pointer dragging to camera-angle adjustments on the cone hit area.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Object} record - Mounted guide record.
 * @returns {void}
 */
const bindGuideDragInteractions = (viewer, record) => {
    const hitArea = record.elements.svg
    /**
     * Convert pointer coordinates to overlay-local pixels.
     *
     * @param {PointerEvent} event - Pointer event.
     * @returns {{x: number, y: number}} Overlay-local point.
     */
    const pointerPositionFrom = event => {
        const rect = record.overlay.getBoundingClientRect()
        return {x: event.clientX - rect.left, y: event.clientY - rect.top}
    }

    /**
     * Resolve the trace-relative bearing under a pointer from the map surface.
     *
     * @param {PointerEvent} event - Pointer event.
     * @returns {number|null} Map-plane bearing in radians.
     */
    const mapBearingFromPointer = event => {
        const scene = viewer.scene
        const canvas = scene?.canvas
        const rect = canvas?.getBoundingClientRect?.()
        const width = Number(scene?.drawingBufferWidth ?? canvas?.width)
        const height = Number(scene?.drawingBufferHeight ?? canvas?.height)
        if (!rect || rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) {
            return null
        }
        const canvasPoint = new Cartesian2(
            (event.clientX - rect.left) * width / rect.width,
            (event.clientY - rect.top) * height / rect.height,
        )
        let worldPosition = null
        try {
            const ray = viewer.camera?.getPickRay?.(canvasPoint)
            worldPosition = ray ? scene.globe?.pick?.(ray, scene) : null
            if (!isFiniteCartesianPosition(worldPosition) && scene.pickPositionSupported === true) {
                worldPosition = scene.pickPosition?.(canvasPoint) ?? null
            }
        }
        catch {
            worldPosition = null
        }
        if (!isFiniteCartesianPosition(worldPosition)) {
            return null
        }
        const pickedPosition = Cartographic.fromCartesian(worldPosition)
        if (!pickedPosition) {
            return null
        }
        return bearingBetween(record.guide.anchor, {
            latitude: pickedPosition.latitude * 180 / Math.PI,
            longitude: pickedPosition.longitude * 180 / Math.PI,
        })
    }

    /**
     * Begin rotating the camera by dragging the cone.
     *
     * @param {PointerEvent} event - Pointer event.
     * @returns {void}
     */
    const pointerDownListener = event => {
        if (event.button !== 0 || !record.projectedAnchor || typeof record.onCameraChange !== 'function') {
            return
        }
        const point = pointerPositionFrom(event)
        const deltaX = point.x - record.projectedAnchor.x
        const deltaY = point.y - record.projectedAnchor.y
        if (Math.hypot(deltaX, deltaY) < 1) {
            return
        }
        const cameraController = viewer.scene?.screenSpaceCameraController
        const tipAltitudeOnly = event.target === record.elements.tipDragTarget
        record.dragState = {
            pointerId: event.pointerId,
            altitudeDraggable: true,
            angleDraggable: !tipAltitudeOnly,
            startAngle: Math.atan2(deltaY, deltaX),
            startAltitude: record.guide.cameraAltitude ?? CAMERA_ANGLE_GUIDE_CAMERA_LENGTH_METERS,
            startRadius: Math.hypot(deltaX, deltaY),
            startOffset: record.guide.offsetRadians,
            startMapAngle: tipAltitudeOnly ? null : mapBearingFromPointer(event),
            cameraController,
            previousRotateEnabled: cameraController?.enableRotate,
        }
        if (cameraController && typeof cameraController.enableRotate === 'boolean') {
            cameraController.enableRotate = false
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        hitArea.style.cursor = 'grabbing'
        record.elements.videoIcon.style.cursor = 'grabbing'
        record.elements.tipDragTarget.style.cursor = 'grabbing'
        record.elements.interactionPath.style.cursor = 'grabbing'
        record.elements.inner.style.cursor = 'grabbing'
        hitArea.setPointerCapture?.(event.pointerId)
        globalThis.addEventListener?.('pointermove', pointerMoveListener, true)
        globalThis.addEventListener?.('pointerup', pointerUpListener, true)
        globalThis.addEventListener?.('pointercancel', pointerUpListener, true)
        record.dragState.removePointerListeners = () => {
            globalThis.removeEventListener?.('pointermove', pointerMoveListener, true)
            globalThis.removeEventListener?.('pointerup', pointerUpListener, true)
            globalThis.removeEventListener?.('pointercancel', pointerUpListener, true)
        }
    }

    /**
     * Recalculate the camera heading from the current drag direction.
     *
     * @param {PointerEvent} event - Pointer event.
     * @returns {void}
     */
    const pointerMoveListener = event => {
        const dragState = record.dragState
        if (!dragState || (dragState.pointerId !== undefined && event.pointerId !== dragState.pointerId)) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        const point = pointerPositionFrom(event)
        const deltaX = point.x - record.projectedAnchor.x
        const deltaY = point.y - record.projectedAnchor.y
        if (Math.hypot(deltaX, deltaY) < 1) {
            return
        }
        const mapAngle = dragState.angleDraggable ? mapBearingFromPointer(event) : null
        const angle = Math.atan2(deltaY, deltaX)
        const angleDelta = dragState.angleDraggable
            ? Number.isFinite(dragState.startMapAngle) && Number.isFinite(mapAngle)
                ? domAngleDeltaFrom(dragState.startMapAngle, mapAngle)
                : domAngleDeltaFrom(dragState.startAngle, angle)
            : 0
        const offset = dragState.startOffset + angleDelta
        const rawDegrees = offset * 180 / Math.PI
        const headingOffset = ((rawDegrees + 180) % 360 + 360) % 360 - 180
        const altitude = dragState.altitudeDraggable
            ? Math.max(
                CAMERA_ANGLE_GUIDE_MIN_CAMERA_ALTITUDE_METERS,
                Math.min(
                    CAMERA_ANGLE_GUIDE_MAX_CAMERA_ALTITUDE_METERS,
                    dragState.startAltitude * Math.hypot(deltaX, deltaY) / dragState.startRadius,
                ),
            )
            : dragState.startAltitude
        const offsetRadians = headingOffset * Math.PI / 180
        record.guide = {
            ...record.guide,
            angleDegrees: displayAngleFrom(headingOffset),
            cameraAltitude: altitude,
            cameraHeading: record.guide.baseHeading + offsetRadians,
            coneHeading: record.guide.baseHeading + offsetRadians + Math.PI,
            offsetRadians,
        }
        updateGuideGeometry(viewer, record, false)
        dragState.pendingUpdates = {
            altitude,
            headingOffset,
        }
    }

    /**
     * Finish a drag and restore Cesium's map rotation control.
     *
     * @param {Object|null} [event] - Pointer event ending the drag.
     * @returns {void}
     */
    const finishDrag = (event = null) => {
        const dragState = record.dragState
        if (!dragState || (event?.pointerId !== undefined && event.pointerId !== dragState.pointerId)) {
            return
        }
        record.dragState = null
        dragState.removePointerListeners?.()
        if (dragState.cameraController && typeof dragState.previousRotateEnabled === 'boolean') {
            dragState.cameraController.enableRotate = dragState.previousRotateEnabled
        }
        hitArea.style.cursor = 'grab'
        record.elements.videoIcon.style.cursor = 'grab'
        record.elements.tipDragTarget.style.cursor = 'ns-resize'
        record.elements.interactionPath.style.cursor = 'grab'
        record.elements.inner.style.cursor = 'grab'
        if (event && hitArea.hasPointerCapture?.(event.pointerId)) {
            hitArea.releasePointerCapture(event.pointerId)
        }
        if (event && dragState.pendingUpdates) {
            record.onCameraChange?.(dragState.pendingUpdates)
        }
    }

    /**
     * End the active cone drag and release pointer capture.
     *
     * @param {PointerEvent} event - Pointer event.
     * @returns {void}
     */
    const pointerUpListener = event => {
        if (!record.dragState || (record.dragState.pointerId !== undefined && event.pointerId !== record.dragState.pointerId)) {
            return
        }
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation?.()
        finishDrag(event)
    }

    hitArea.addEventListener('pointerdown', pointerDownListener)
    record.elements.videoIcon.addEventListener('pointerdown', pointerDownListener)
    record.removeDragListeners = () => {
        finishDrag()
        hitArea.removeEventListener('pointerdown', pointerDownListener)
        record.elements.videoIcon.removeEventListener('pointerdown', pointerDownListener)
    }
}

/**
 * Remove the currently mounted map guide for a viewer.
 *
 * @param {Object|null} viewer - Cesium viewer.
 * @returns {boolean} Whether a guide was removed.
 */
export const removeJourneyReplayCameraAngleGuide = viewer => {
    const record = viewer ? cameraAngleGuideRecords.get(viewer) : null
    if (!record || !viewer) {
        return false
    }

    cameraAngleGuideRecords.delete(viewer)
    record.removeCameraChangedListener?.()
    record.removePostRenderListener?.()
    record.removeCameraMoveStartListener?.()
    record.removeDragListeners?.()
    if (record.canvasWheelListener) {
        viewer.scene?.canvas?.removeEventListener?.('wheel', record.canvasWheelListener, true)
    }
    globalThis.removeEventListener?.('resize', record.resizeListener)
    record.overlay?.remove()
    return true
}

/**
 * Mount the camera angle cone in the viewer's owned Cesium scene.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Object} guide - Resolved guide geometry.
 * @param {Object|string} colors - Heading and ahead colors, or one legacy color.
 * @param {Object} callbacks - Optional camera interaction callbacks.
 * @returns {boolean} Whether the 3D guide was mounted.
 */
export const mountJourneyReplayCameraAngleGuide = (viewer, guide, colors = {}, callbacks = {}) => {
    if (!viewer?.scene?.canvas || !guide?.anchor) {
        return false
    }

    removeJourneyReplayCameraAngleGuide(viewer)
    const worldGeometry = worldGeometryFrom(viewer, guide)
    const brandColorValue = typeof colors === 'string'
        ? colors
        : colors?.brandColor ?? colors?.headingColor
    const headingColor = guideColorFrom(
        brandColorValue ?? cssThemeColorFrom('--wa-color-brand', DEFAULT_CAMERA_ANGLE_GUIDE_HEADING_COLOR),
        DEFAULT_CAMERA_ANGLE_GUIDE_HEADING_COLOR,
    )
    const aheadColor = guideColorFrom(
        typeof colors === 'string' ? null : colors?.aheadColor,
        lessLuminousColorFrom(headingColor).toCssColorString(),
    )
    const coneColor = guide.mode === 'Ahead' ? aheadColor : headingColor
    const overlayParts = createGuideOverlay({
        aheadColor,
        activityIconName: guide.activityIcon,
        headingColor: coneColor,
        viewer,
    })
    if (!overlayParts) {
        return false
    }

    const record = Object.assign({}, worldGeometry, overlayParts, {
        guide,
        routeHeightOffset: routeHeightOffsetFrom(worldGeometry.anchor, guide),
        onCameraChange: callbacks.onCameraChange,
        depthProbePending: true,
        projectionRetryCount: 0,
    })
    cameraAngleGuideRecords.set(viewer, record)
    record.removeCameraChangedListener = viewer.camera?.changed?.addEventListener?.(() => {
        record.depthProbePending = true
        updateGuideGeometry(viewer, record, false)
        viewer.scene?.requestRender?.()
    })
    record.removeCameraMoveStartListener = viewer.camera?.moveStart?.addEventListener?.(() => {
        record.depthProbePending = true
    })
    record.removePostRenderListener = viewer.scene?.postRender?.addEventListener?.(() => {
        if (!record.depthProbePending) {
            return
        }
        record.depthProbePending = false
        updateGuideGeometry(viewer, record, true)
    })
    record.resizeListener = () => {
        record.depthProbePending = true
        updateGuideGeometry(viewer, record, false)
        viewer.scene?.requestRender?.()
    }
    record.canvasWheelListener = () => {
        record.depthProbePending = true
    }
    viewer.scene.canvas.addEventListener?.('wheel', record.canvasWheelListener, true)
    globalThis.addEventListener?.('resize', record.resizeListener)
    bindGuideDragInteractions(viewer, record)
    updateGuideGeometry(viewer, record, false)
    viewer.scene?.requestRender?.()
    return true
}

/**
 * Update a mounted guide without replacing its DOM overlay.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Object|null} guide - New resolved replay camera guide.
 * @returns {boolean} Whether the mounted guide was updated.
 */
export const updateJourneyReplayCameraAngleGuide = (viewer, guide, callbacks = {}) => {
    const record = viewer ? cameraAngleGuideRecords.get(viewer) : null
    if (!record || !guide || record.guide.mode !== guide.mode) {
        return false
    }
    if (typeof callbacks.onCameraChange === 'function') {
        record.onCameraChange = callbacks.onCameraChange
    }

    const geometryChanged = guideGeometryKeyFrom(record.guide) !== guideGeometryKeyFrom(guide)
    const routeGeometryChanged = record.guide.routePositionKey !== guide.routePositionKey
    const angleChanged = record.guide.coneHeading !== guide.coneHeading
        || record.guide.angleDegrees !== guide.angleDegrees
    if (record.guide.activityIcon !== guide.activityIcon) {
        record.elements.activityGlyph.setAttribute('name', guide.activityIcon || 'person-hiking')
    }
    if (geometryChanged) {
        Object.assign(record, worldGeometryFrom(viewer, guide, record.coneLength))
    }
    if (routeGeometryChanged) {
        record.routeHeightOffset = routeHeightOffsetFrom(record.anchor, guide)
    }
    record.guide = guide
    if (geometryChanged || angleChanged) {
        record.depthProbePending = true
    }
    updateGuideGeometry(viewer, record, false)
    viewer.scene?.requestRender?.()
    return true
}
