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
const CAMERA_ANGLE_GUIDE_ELEVATION_OFFSET_METERS = 5
const CAMERA_ANGLE_GUIDE_PICK_HEIGHT_TOLERANCE_METERS = 12
const CAMERA_ANGLE_GUIDE_DEPTH_CLEARANCE_METERS = 8
const CAMERA_ANGLE_GUIDE_CONE_ALPHA = 0.8
const CAMERA_ANGLE_GUIDE_OVERLAY_CLASS = 'replay-camera-angle-guide-dom'
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const DEFAULT_CAMERA_ANGLE_GUIDE_COLOR = '#ff6a00'
const DEFAULT_CAMERA_ANGLE_GUIDE_HEADING_COLOR = '#facc15'
const CAMERA_ANGLE_GUIDE_LESS_LUMINOUS_FACTOR = 0.72
const cameraAngleGuideRecords = new WeakMap()
let cameraAngleGuideGradientCounter = 0

/**
 * Build a key for the guide geometry that requires a new DOM overlay.
 *
 * @param {Object|null} guide - Resolved replay camera guide.
 * @returns {string} Stable geometry key.
 */
const guideGeometryKeyFrom = guide => [
    guide?.anchor?.longitude,
    guide?.anchor?.latitude,
    guide?.anchor?.height,
    guide?.directionPoint?.longitude,
    guide?.directionPoint?.latitude,
    guide?.directionPoint?.height,
    guide?.cameraGroundHeight,
    guide?.coneHeight,
    guide?.axisHeading,
].map(value => Number.isFinite(Number(value)) ? Number(value).toFixed(12) : '').join('|')
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
 * Resolve the departure bearing over the first 300 metres of the trace.
 * Using an interpolated real trace position avoids a point-count-dependent
 * angle when the source sampling density changes.
 *
 * @param {Array<Object>} points - Valid trace points in order.
 * @returns {number} Departure bearing in radians.
 */
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
    return Math.max(REPLAY_CAMERA_HEADING_OFFSET_MIN, Math.min(REPLAY_CAMERA_HEADING_OFFSET_MAX, -numericValue))
}

/**
 * Resolve the map guide geometry from the first coordinate of the first trace.
 *
 * @param {Object} options - Guide options.
 * @param {Object|null} options.journey - Journey containing the route.
 * @param {Object} options.camera - Replay camera settings.
 * @returns {Object|null} Renderer-independent guide geometry.
 */
export const resolveJourneyReplayCameraAngleGuide = ({journey, camera} = {}) => {
    const positionMode = camera?.positionMode
    if (!journey || positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
        return null
    }

    const direction = firstTrackDirection(firstTrackSegment(firstTrackFrom(journey)))
    if (!direction) {
        return null
    }

    const anchor = direction.start
    const axisHeading = departureHeadingFrom(direction.points)
    const angleDegrees = displayAngleFrom(camera?.headingOffset)
    const baseHeading = positionMode === REPLAY_CAMERA_POSITION_AHEAD
        ? axisHeading + Math.PI
        : axisHeading
    const angleRadians = -angleDegrees * Math.PI / 180
    const cameraHeading = baseHeading + angleRadians

    return {
        anchor,
        angleDegrees,
        axisHeading,
        cameraGroundHeight: direction.next.height,
        cameraHeading,
        coneHeading: cameraHeading + Math.PI,
        coneHeight: Math.max(direction.start.height, direction.next.height) + CAMERA_ANGLE_GUIDE_ELEVATION_OFFSET_METERS,
        directionPoint: direction.directionPoint,
        mode: positionMode === REPLAY_CAMERA_POSITION_AHEAD ? 'Ahead' : 'Behind',
        offsetRadians: angleRadians,
        baseHeading,
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
        ? Math.min(CAMERA_ANGLE_GUIDE_CAMERA_LENGTH_METERS, currentLength)
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
 * Resolve a small world-space gap corresponding to the icon separation.
 *
 * @param {Object} viewer - Cesium viewer.
 * @param {Cartesian3} anchor - Reference position in world coordinates.
 * @returns {number} Gap in metres.
 */
const iconGapFrom = (viewer, anchor) => {
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
            ? metersPerPixel * CAMERA_ANGLE_GUIDE_ICON_GAP_PIXELS
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
const lessLuminousColorFrom = color => new Color(
    color.red * CAMERA_ANGLE_GUIDE_LESS_LUMINOUS_FACTOR,
    color.green * CAMERA_ANGLE_GUIDE_LESS_LUMINOUS_FACTOR,
    color.blue * CAMERA_ANGLE_GUIDE_LESS_LUMINOUS_FACTOR,
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
 * Rotate a projected point around a projected Cesium anchor.
 *
 * @param {{x: number, y: number}} point - Projected point in CSS pixels.
 * @param {{x: number, y: number}} center - Projected rotation center in CSS pixels.
 * @param {number} angle - Rotation angle in radians.
 * @returns {{x: number, y: number}} Rotated CSS pixel point.
 */
const rotateProjectedPoint = (point, center, angle) => {
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const x = point.x - center.x
    const y = point.y - center.y
    return {
        x: center.x + (x * cosine) - (y * sine),
        y: center.y + (x * sine) + (y * cosine),
    }
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
 * Interpolate a projected point along a segment.
 *
 * @param {{x: number, y: number}} start - Segment start.
 * @param {{x: number, y: number}} end - Segment end.
 * @param {number} ratio - Segment interpolation ratio.
 * @returns {{x: number, y: number}} Interpolated point.
 */
const interpolateProjectedPoint = (start, end, ratio) => ({
    x: start.x + ((end.x - start.x) * ratio),
    y: start.y + ((end.y - start.y) * ratio),
})

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
    const roundedValue = Math.round(value * 10) / 10
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
 * @param {HTMLImageElement} icon - DOM icon element.
 * @param {{x: number, y: number}|null} point - Projected position.
 * @param {number|null} heading - Projected DOM heading in radians.
 * @returns {void}
 */
const positionGuideIcon = (icon, point, heading = null) => {
    if (!point) {
        icon.style.display = 'none'
        return
    }
    icon.style.display = 'block'
    icon.style.left = `${point.x}px`
    icon.style.top = `${point.y}px`
    icon.style.transform = Number.isFinite(heading)
        ? `translate(-50%, -50%) rotate(${heading}rad)`
        : 'translate(-50%, -50%)'
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
    if (!isGuideWorldPositionVisible(viewer, overlay, record.visibilityAnchor, checkDepth)) {
        overlay.style.visibility = 'hidden'
        return 'hidden'
    }
    const coneHeading = record.guide.coneHeading
    record.coneLength = coneLengthFrom(viewer, record.anchor, record.coneLength)
    const geometry = coneGeometryFrom(
        viewer,
        record.anchor,
        record.transform,
        record.groundTransform,
        record.guide,
        coneHeading,
        record.coneLength,
    )
    const outer = geometry.outer.map(position => projectGuidePosition(viewer, overlay, position))
    const inner = geometry.inner.map(position => projectGuidePosition(viewer, overlay, position))
    const outerBaseCenter = projectGuidePosition(viewer, overlay, geometry.outerBaseCenter)
    const innerBaseCenter = projectGuidePosition(viewer, overlay, geometry.innerBaseCenter)
    const traceDirection = projectGuidePosition(viewer, overlay, record.directionPosition)
    const cameraGround = projectGuidePosition(viewer, overlay, geometry.cameraGroundPosition)
    const videoIcon = projectGuidePosition(viewer, overlay, geometry.videoIconPosition)

    if (outer.some(point => !point) || inner.some(point => !point)) {
        // Keep the last valid cone visible while Cesium temporarily has no
        // screen projection (camera flight, resize, or tile update).
        overlay.style.visibility = 'visible'
        return 'unprojected'
    }

    const rotationCenter = outerBaseCenter
    const currentConeAngle = rotationCenter ? domAngleFrom(rotationCenter, outer[2]) : null
    const traceAngle = rotationCenter && traceDirection
        ? domAngleFrom(rotationCenter, traceDirection)
        : null
    const desiredConeAngle = traceAngle === null
        ? null
        : traceAngle + (record.guide.mode === 'Ahead' ? 0 : Math.PI) + record.guide.offsetRadians
    const domRotation = currentConeAngle === null || desiredConeAngle === null
        ? 0
        : domAngleDeltaFrom(currentConeAngle, desiredConeAngle)
    const rotatedOuter = rotationCenter
        ? outer.map(point => rotateProjectedPoint(point, rotationCenter, domRotation))
        : outer
    const rotatedInner = rotationCenter
        ? inner.map(point => rotateProjectedPoint(point, rotationCenter, domRotation))
        : inner
    const rotatedInnerBaseCenter = rotationCenter && innerBaseCenter
        ? rotateProjectedPoint(innerBaseCenter, rotationCenter, domRotation)
        : innerBaseCenter
    const rotatedCameraGround = rotationCenter && cameraGround
        ? rotateProjectedPoint(cameraGround, rotationCenter, domRotation)
        : cameraGround
    const rotatedVideoIcon = rotationCenter && videoIcon
        ? rotateProjectedPoint(videoIcon, rotationCenter, domRotation)
        : videoIcon
    const [outerLeft, outerRight, tip] = rotatedOuter
    const [innerOuterLeft, innerOuterRight, innerTip] = rotatedInner
    const [left, right] = recenterProjectedBase(outerLeft, outerRight, outerBaseCenter)
    const [innerLeft, innerRight] = recenterProjectedBase(innerOuterLeft, innerOuterRight, rotatedInnerBaseCenter)
    const angleLabelPoint = rotatedInnerBaseCenter && innerTip
        ? interpolateProjectedPoint(rotatedInnerBaseCenter, innerTip, 0.24)
        : null
    const innerGradientAxis = svgGradientAxisFrom(innerTip, innerLeft, innerRight)
    elements.outer.setAttribute('d', svgConePathFrom(left, right, tip))
    elements.inner.setAttribute('d', svgConePathFrom(
        innerLeft,
        innerRight,
        innerTip,
        CAMERA_ANGLE_GUIDE_INNER_ARC_FLATTENING,
    ))
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
    if (angleLabelPoint) {
        elements.angleLabel.textContent = angleLabelFrom(record.guide.angleDegrees)
        elements.angleLabel.setAttribute('x', angleLabelPoint.x)
        elements.angleLabel.setAttribute('y', angleLabelPoint.y)
        const coneAngle = domAngleFrom(rotatedInnerBaseCenter, innerTip)
        const perpendicularAngle = coneAngle === null ? 270 : (coneAngle * 180 / Math.PI) + 270
        elements.angleLabel.setAttribute('transform', `rotate(${perpendicularAngle} ${angleLabelPoint.x} ${angleLabelPoint.y})`)
        elements.angleLabel.style.display = 'block'
    }
    else {
        elements.angleLabel.style.display = 'none'
    }
    if (rotatedCameraGround && rotatedVideoIcon) {
        elements.cameraElevation.setAttribute('x1', rotatedCameraGround.x)
        elements.cameraElevation.setAttribute('y1', rotatedCameraGround.y)
        elements.cameraElevation.setAttribute('x2', rotatedVideoIcon.x)
        elements.cameraElevation.setAttribute('y2', rotatedVideoIcon.y)
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
        rotatedVideoIcon,
        projectedConeHeading === null ? null : projectedConeHeading + Math.PI,
    )
    elements.svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    overlay.style.visibility = 'visible'
    return 'drawn'
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
const createGuideOverlay = ({viewer, headingColor, aheadColor}) => {
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
    Object.assign(svg.style, {
        height:       '100%',
        left:         '0',
        overflow:     'visible',
        pointerEvents: 'none',
        position:     'absolute',
        top:          '0',
        width:        '100%',
    })
    const outer = createSvgElement('path', {
        'data-part': 'outer',
        fill:       'none',
    })
    const inner = createSvgElement('path', {
        'data-part': 'inner',
        fill:        `url(#replay-camera-angle-guide-inner-gradient-${++cameraAngleGuideGradientCounter})`,
    })
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
    innerGradient.append(gradientStart, gradientEnd)
    definitions.append(innerGradient)
    const createLine = color => createSvgElement('line', svgStrokeAttributesFrom(color))
    const leftSide = createLine(aheadColor)
    const rightSide = createLine(aheadColor)
    const cameraElevation = createLine(aheadColor)
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
    angleLabel.style.pointerEvents = 'none'
    angleLabel.style.userSelect = 'none'
    svg.append(definitions, outer, inner, leftSide, rightSide, cameraElevation, angleLabel)

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
    overlay.append(svg, videoIcon)
    container.appendChild(overlay)
    return {
        elements: {
            angleLabel,
            cameraElevation,
            videoIcon,
            innerGradient,
            inner,
            leftSide,
            outer,
            rightSide,
            svg,
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
 * @returns {boolean} Whether the 3D guide was mounted.
 */
export const mountJourneyReplayCameraAngleGuide = (viewer, guide, colors = {}) => {
    if (!viewer?.scene?.canvas || !guide?.anchor) {
        return false
    }

    removeJourneyReplayCameraAngleGuide(viewer)
    const groundAnchor = Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, guide.anchor.height)
    const coneHeight = Number.isFinite(guide.coneHeight) ? guide.coneHeight : guide.anchor.height
    const anchor = Cartesian3.fromDegrees(guide.anchor.longitude, guide.anchor.latitude, coneHeight)
    const visibilityAnchor = Cartesian3.fromDegrees(
        guide.anchor.longitude,
        guide.anchor.latitude,
        guide.anchor.height + CAMERA_ANGLE_GUIDE_ELEVATION_OFFSET_METERS,
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
        headingColor: coneColor,
        viewer,
    })
    if (!overlayParts) {
        return false
    }

    const record = {
        anchor,
        ...overlayParts,
        groundAnchor,
        groundTransform,
        guide,
        depthProbePending: true,
        directionPosition,
        coneLength: coneLengthFrom(viewer, anchor),
        projectionRetryCount: 0,
        transform,
        visibilityAnchor,
    }
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
export const updateJourneyReplayCameraAngleGuide = (viewer, guide) => {
    const record = viewer ? cameraAngleGuideRecords.get(viewer) : null
    if (!record || !guide || guideGeometryKeyFrom(record.guide) !== guideGeometryKeyFrom(guide)) {
        return false
    }

    const angleChanged = record.guide.coneHeading !== guide.coneHeading
        || record.guide.angleDegrees !== guide.angleDegrees
    record.guide = guide
    if (angleChanged) {
        record.depthProbePending = true
    }
    updateGuideGeometry(viewer, record, false)
    viewer.scene?.requestRender?.()
    return true
}
