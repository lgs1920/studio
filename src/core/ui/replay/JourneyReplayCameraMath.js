/**
 * Pure geometry, camera and projection helpers for Journey Replay.
 */

import {Cartesian3, Cartographic, Math as CesiumMath} from 'cesium'
import {finiteNumber} from './JourneyReplayRuntime'
import {
    REPLAY_CAMERA_POSITION_AHEAD, REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_HEADING_OFFSET_MIN,
} from './JourneyReplayProgressionStyle'

const CAMERA_HEADING_HYSTERESIS_RADIANS = CesiumMath.toRadians(12)
const CAMERA_HEADING_MIN_CHANGE_RADIANS = CesiumMath.toRadians(5)
const CAMERA_RASANT_PITCH_LIMIT_RADIANS = CesiumMath.toRadians(-5)
const CAMERA_RASANT_PITCH_RELEASE_RADIANS = CesiumMath.toRadians(-35)
const REPLAY_TRACKING_NAVIGATION_ZONE_RATIO = 0.3
const REPLAY_TRACKING_NAVIGATION_NARROW_CROP_RATIO = 0.75
const REPLAY_TRACKING_NAVIGATION_NARROW_ZONE_RATIO = 0.22
const REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO = 0.75
const REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO = 0.3
export const REPLAY_DRAFT_LOOKAHEAD_FPS = 15
export const REPLAY_HQ_LOOKAHEAD_FPS = 60

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export const lerp = (start, end, ratio) => start + ((end - start) * ratio)

export const hasFiniteLonLat = point => finiteNumber(point?.longitude) !== null && finiteNumber(point?.latitude) !== null

export const sanitizeOrientationRadians = (value, fallback) => finiteNumber(value) ?? fallback

export const replayHeadingFromLocalAxisAngle = axisAngle => {
    const angle = finiteNumber(axisAngle)
    if (angle === null) {
        return 0
    }

    return Math.atan2(Math.cos(angle), Math.sin(angle))
}

/**
 * Returns an anticipatory look-ahead multiplier for low-angle camera views.
 *
 * @param {number} pitch - Camera pitch in radians.
 * @returns {number} Look-ahead multiplier.
 */
export const replayPitchLookaheadFactor = pitch => {
    const safePitch = finiteNumber(pitch)
    if (safePitch === null) {
        return 1
    }

    const pitchMagnitude = Math.abs(safePitch)
    const rasanceSpan = Math.abs(CAMERA_RASANT_PITCH_RELEASE_RADIANS - CAMERA_RASANT_PITCH_LIMIT_RADIANS)
    const rasanceProgress = clamp(
        (pitchMagnitude - Math.abs(CAMERA_RASANT_PITCH_LIMIT_RADIANS)) / Math.max(rasanceSpan, Number.EPSILON),
        0,
        1,
    )
    return lerp(2.2, 1, rasanceProgress)
}

/**
 * Returns a pacing factor for long replays.
 *
 * Longer replays require a slightly more aggressive response so the marker
 * does not visually lag behind on extended trajectories. The returned factor
 * is always positive and grows smoothly with the replay duration and path
 * length.
 *
 * @param {number} durationSeconds - Full replay duration in seconds.
 * @param {number} [totalDistance=0] - Total replay distance in meters.
 * @returns {number} Pacing multiplier.
 */
export const replayDurationPaceFactor = (durationSeconds, totalDistance = 0) => {
    const safeDuration = Math.max(1, finiteNumber(durationSeconds) ?? 1)
    const safeDistance = Math.max(0, finiteNumber(totalDistance) ?? 0)
    const durationScale = clamp(Math.max(0, safeDuration - 120) / 240, 0, 1)
    const distanceScale = clamp(Math.max(0, safeDistance - 10000) / 15000, 0, 1)
    return 1 + (durationScale * 0.08) + (distanceScale * 0.04)
}

export const replayCameraHeadingForPositionMode = ({axisHeading = 0, positionMode, headingOffset = 0} = {}) => {
    const heading = finiteNumber(axisHeading) ?? 0
    const offset = degreesToRadians(clamp(finiteNumber(headingOffset) ?? 0, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_HEADING_OFFSET_MAX)) ?? 0
    return (positionMode === REPLAY_CAMERA_POSITION_AHEAD ? heading + Math.PI : heading) + offset
}

export const replayAngularDelta = (from, to) => {
    const start = finiteNumber(from)
    const end = finiteNumber(to)
    if (start === null || end === null) {
        return null
    }

    const fullTurn = Math.PI * 2
    const delta = ((end - start + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
    return delta === -Math.PI ? Math.PI : delta
}

export const replayHeadingEasingFactor = ({
                                                  previousHeading = null,
                                                  nextHeading = 0,
                                                  easing = 0.14,
                                                  minFactor = 0.04,
                                                  maxFactor = 0.22,
                                              } = {}) => {
    const delta = replayAngularDelta(previousHeading, nextHeading)
    const safeEasing = clamp(finiteNumber(easing) ?? 0.14, 0.02, 0.5)
    const normalizedEasing = safeEasing / 0.5
    const smallTurnFactor = lerp(0.22, 0.12, normalizedEasing)
    const largeTurnFactor = lerp(0.08, 0.04, normalizedEasing)

    if (delta === null) {
        return clamp(smallTurnFactor, minFactor, maxFactor)
    }

    const normalizedDelta = clamp(Math.abs(delta) / Math.PI, 0, 1)
    const turnEase = 1 - Math.pow(1 - normalizedDelta, 3)
    return clamp(
        lerp(smallTurnFactor, largeTurnFactor, turnEase),
        minFactor,
        maxFactor,
    )
}

export const replayCameraRecenterDuration = (easing = 0.18) => {
    const safeEasing = clamp(finiteNumber(easing) ?? 0.18, 0.02, 0.5)
    return Math.max(0.5, 0.95 + (1.6 * safeEasing))
}

/**
 * Resolve the temporal lead needed to cover one rendered frame.
 *
 * @param {{fps?: number|null, frameIntervalMs?: number|null}} options
 * @returns {number} Frame lead in seconds.
 */
export const replayFrameLeadSeconds = ({fps = 30, frameIntervalMs = null} = {}) => {
    const interval = finiteNumber(frameIntervalMs)
    if (interval !== null && interval > 0) {
        return interval / 1000
    }

    const safeFps = finiteNumber(fps)
    return 1 / (safeFps !== null && safeFps > 0 ? safeFps : 30)
}

/**
 * Resolve one output-frame lead using the active replay mode as fallback.
 *
 * @param {{renderMode?: string, fps?: number|null, frameIntervalMs?: number|null}} options - Replay timing inputs.
 * @returns {number} Frame lead in seconds.
 */
export const replayCameraFrameLeadSeconds = ({
                                                 renderMode = 'draft',
                                                 fps = null,
                                                 frameIntervalMs = null,
                                             } = {}) => {
    const configuredFps = fps === null || fps === undefined || fps === ''
                          ? null
                          : finiteNumber(fps)
    return replayFrameLeadSeconds({
        fps: configuredFps
              ?? (renderMode === 'hq' ? REPLAY_HQ_LOOKAHEAD_FPS : REPLAY_DRAFT_LOOKAHEAD_FPS),
        frameIntervalMs,
    })
}

export const replayTargetSampleForClip = ({
                                              sample,
                                              clipId,
                                              journey = globalThis.lgs?.theJourney ?? null,
                                              sceneManager = globalThis.__?.ui?.sceneManager ?? null,
                                              markerHeightForSample = () => 0,
                                          } = {}) => {
    if (!sample) {
        return null
    }

    if (clipId === 'landing') {
        const groundHeight = markerHeightForSample(sample)
        return {
            ...sample,
            altitude: groundHeight,
        }
    }

    if (clipId === 'zoom-in') {
        return sample
    }

    if (clipId === 'zoom-out') {
        const resolveCentroid = centroid => {
            if (centroid) {
                return {
                    ...sample,
                    longitude: centroid.longitude,
                    latitude:  centroid.latitude,
                    altitude:  finiteNumber(centroid.height ?? centroid.altitude) ?? sample.altitude,
                }
            }
            return sample
        }
        const centroid = sceneManager?.getJourneyCentroid?.(journey)
        return typeof centroid?.then === 'function'
               ? centroid.then(resolveCentroid)
               : resolveCentroid(centroid)
    }

    return sample
}

export const replayCameraRangeFromPitch = (altitude, pitchRadians) => {
    const height = Math.max(0, finiteNumber(altitude) ?? 0)
    const pitch = finiteNumber(pitchRadians)
    if (pitch === null) {
        return height
    }

    const verticalFactor = Math.abs(Math.sin(pitch))
    if (verticalFactor < 1e-6) {
        return height
    }

    return Math.max(1, height / verticalFactor)
}

export const replayCameraRecenterHeight = (currentHeight, targetHeight) => {
    const height = currentHeight === null || currentHeight === undefined || currentHeight === ''
                   ? null
                   : finiteNumber(currentHeight)
    if (height !== null) {
        return height
    }

    const fallbackHeight = targetHeight === null || targetHeight === undefined || targetHeight === ''
                           ? null
                           : finiteNumber(targetHeight)
    return fallbackHeight ?? 0
}

export const replayCameraRecenterHorizontalDistance = ({
                                                               cameraHeight,
                                                               targetHeight = 0,
                                                               pitchRadians,
                                                               fallbackRange = 1,
                                                           } = {}) => {
    const height = finiteNumber(cameraHeight)
    const target = finiteNumber(targetHeight) ?? 0
    const fallback = Math.max(1, finiteNumber(fallbackRange) ?? 1)
    if (height === null) {
        return fallback
    }

    const verticalDistance = Math.max(0, height - target)
    const pitch = finiteNumber(pitchRadians)
    const tangent = pitch === null ? 0 : Math.tan(Math.abs(pitch))
    if (verticalDistance <= 0 || tangent <= 1e-6) {
        return fallback
    }

    return Math.max(1, verticalDistance / tangent)
}

export const replayToleranceZoneBounds = (zone = {}) => {
    const top = clamp(finiteNumber(zone?.top) ?? 0, 0, 1)
    const left = clamp(finiteNumber(zone?.left) ?? 0, 0, 1)
    const width = clamp(finiteNumber(zone?.width) ?? 1, 0, 1 - left)
    const height = clamp(finiteNumber(zone?.height) ?? 1, 0, 1 - top)
    return {
        top,
        left,
        right:  left + width,
        bottom: top + height,
    }
}

export const replayCenteredZone = (widthRatio = 1, heightRatio = widthRatio) => {
    const width = clamp(finiteNumber(widthRatio) ?? 1, 0.01, 1)
    const height = clamp(finiteNumber(heightRatio) ?? width, 0.01, 1)
    return {
        top:    (1 - height) / 2,
        left:   (1 - width) / 2,
        width,
        height,
    }
}

export const replayCenteredSquareZone = (ratio, viewportWidth, viewportHeight) => {
    const width = finiteNumber(viewportWidth)
    const height = finiteNumber(viewportHeight)
    if (width === null || height === null || width <= 0 || height <= 0) {
        return replayCenteredZone(ratio, ratio)
    }

    // Keep the central safety zone square in screen pixels. This prevents a
    // narrow video crop from making the navigation/target zone too thin on
    // the short axis.
    const side = Math.min(Math.min(width, height), Math.max(width, height) * ratio)
    return replayCenteredZone(side / width, side / height)
}

export const replayNavigationZone = (ratio, viewportWidth, viewportHeight) => {
    const width = finiteNumber(viewportWidth)
    const height = finiteNumber(viewportHeight)
    if (width === null || height === null || width <= 0 || height <= 0) {
        return replayCenteredSquareZone(ratio, viewportWidth, viewportHeight)
    }

    const shortToLongRatio = Math.min(width, height) / Math.max(width, height)
    const navigationRatio = shortToLongRatio < REPLAY_TRACKING_NAVIGATION_NARROW_CROP_RATIO
        ? REPLAY_TRACKING_NAVIGATION_NARROW_ZONE_RATIO
        : ratio
    return replayCenteredZone(navigationRatio, navigationRatio)
}

export const replayRuntimeTrackingSettings = (settings = {}, viewport = {}) => {
    const runtime = settings?.tracking ?? settings?.runtimeTracking ?? {}
    const navigation = runtime?.navigation ?? {}
    const dynamic = runtime?.dynamic ?? {}
    return {
        navigation: {
            triggerZone: navigation.triggerZone ?? replayNavigationZone(
                finiteNumber(navigation.zoneRatio) ?? finiteNumber(navigation.width) ?? REPLAY_TRACKING_NAVIGATION_ZONE_RATIO,
                viewport.width,
                viewport.height,
            ),
        },
        dynamic:    {
            triggerZone: dynamic.triggerZone ?? replayCenteredZone(
                finiteNumber(dynamic.triggerRatio) ?? finiteNumber(dynamic.width) ?? REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO,
                finiteNumber(dynamic.height) ?? finiteNumber(dynamic.triggerRatio) ?? REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO,
            ),
            targetZone:  dynamic.targetZone ?? replayCenteredZone(
                finiteNumber(dynamic.targetWidth)
                    ?? finiteNumber(dynamic.targetRatio)
                    ?? REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO,
                finiteNumber(dynamic.targetHeight)
                    ?? finiteNumber(dynamic.targetRatio)
                    ?? finiteNumber(dynamic.targetWidth)
                    ?? REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO,
            ),
        },
    }
}

export const replayDynamicTargetPointInZone = ({
                                                   currentPoint,
                                                   predictedPoint,
                                                   viewportWidth,
                                                   viewportHeight,
                                                   zone,
                                                   leadRatio = 0.35,
                                               } = {}) => {
    const width = finiteNumber(viewportWidth)
    const height = finiteNumber(viewportHeight)
    if (width === null || height === null || width <= 0 || height <= 0) {
        return null
    }
    const bounds = replayToleranceZoneBounds(zone)
    const left = bounds.left * width
    const right = bounds.right * width
    const top = bounds.top * height
    const bottom = bounds.bottom * height
    const centerX = (left + right) / 2
    const centerY = (top + bottom) / 2
    const dx = (finiteNumber(predictedPoint?.x) ?? centerX) - (finiteNumber(currentPoint?.x) ?? centerX)
    const dy = (finiteNumber(predictedPoint?.y) ?? centerY) - (finiteNumber(currentPoint?.y) ?? centerY)
    const length = Math.hypot(dx, dy)
    if (length <= 0.001) {
        return {x: centerX, y: centerY}
    }
    const lead = clamp(finiteNumber(leadRatio) ?? 0.35, 0, 0.49)
    return {
        x: clamp(centerX - (dx / length) * (right - left) * lead, left, right),
        y: clamp(centerY - (dy / length) * (bottom - top) * lead, top, bottom),
    }
}

export const replayIsWindowPointOutsideToleranceZone = ({
                                                                point,
                                                                width,
                                                                height,
                                                                zone,
                                                            } = {}) => {
    const canvasWidth = finiteNumber(width)
    const canvasHeight = finiteNumber(height)
    if (canvasWidth === null || canvasHeight === null || canvasWidth <= 0 || canvasHeight <= 0) {
        return false
    }

    const x = finiteNumber(point?.x)
    const y = finiteNumber(point?.y)
    if (x === null || y === null) {
        return true
    }

    const bounds = replayToleranceZoneBounds(zone)
    const left = bounds.left * canvasWidth
    const right = bounds.right * canvasWidth
    const top = bounds.top * canvasHeight
    const bottom = bounds.bottom * canvasHeight
    return x <= left || x >= right || y <= top || y >= bottom
}

export const replayInnerToleranceZoneBounds = (zone = {}, marginRatio = 0.1) => {
    const outer = replayToleranceZoneBounds(zone)
    const margin = clamp(finiteNumber(marginRatio) ?? 0.1, 0.05, 0.45)
    const width = outer.right - outer.left
    const height = outer.bottom - outer.top
    const insetX = width * margin
    const insetY = height * margin

    return {
        left:   outer.left + insetX,
        right:  outer.right - insetX,
        top:    outer.top + insetY,
        bottom: outer.bottom - insetY,
    }
}

export const replayInsetBounds = (bounds = {}, insetRatio = 0.1) => {
    const left = finiteNumber(bounds?.left) ?? 0
    const top = finiteNumber(bounds?.top) ?? 0
    const right = finiteNumber(bounds?.right) ?? 1
    const bottom = finiteNumber(bounds?.bottom) ?? 1
    const width = Math.max(0, right - left)
    const height = Math.max(0, bottom - top)
    const inset = clamp(finiteNumber(insetRatio) ?? 0.1, 0, 0.45)
    const insetX = width * inset
    const insetY = height * inset
    return {
        left:   left + insetX,
        right:  right - insetX,
        top:    top + insetY,
        bottom: bottom - insetY,
    }
}

export const replayWindowCollisionFromPoint = ({
                                                point,
                                                width,
                                                height,
                                                outerBounds,
                                                safeBounds,
                                                markerRadius = 0,
                                            } = {}) => {
    const canvasWidth = finiteNumber(width)
    const canvasHeight = finiteNumber(height)
    const x = finiteNumber(point?.x)
    const y = finiteNumber(point?.y)
    if (canvasWidth === null || canvasHeight === null || canvasWidth <= 0 || canvasHeight <= 0 || x === null || y === null) {
        return null
    }

    const outer = outerBounds ?? replayToleranceZoneBounds()
    const inner = safeBounds ?? replayInnerToleranceZoneBounds()
    const marginX = Math.max(0, finiteNumber(markerRadius) ?? 0)
    const marginY = marginX
    const outerLeft = outer.left * canvasWidth
    const outerRight = outer.right * canvasWidth
    const outerTop = outer.top * canvasHeight
    const outerBottom = outer.bottom * canvasHeight
    const left = inner.left * canvasWidth + marginX
    const right = inner.right * canvasWidth - marginX
    const top = inner.top * canvasHeight + marginY
    const bottom = inner.bottom * canvasHeight - marginY

    if (x < outerLeft) {
        return {
            side:       'left',
            outer,
            inner,
            screen:     {x: outerLeft, y: clamp(y, outerTop, outerBottom)},
            error:      Math.max((outerLeft - x) / canvasWidth, 0),
            hard:       true,
            shouldMove: true,
        }
    }

    if (x > outerRight) {
        return {
            side:       'right',
            outer,
            inner,
            screen:     {x: outerRight, y: clamp(y, outerTop, outerBottom)},
            error:      Math.max((x - outerRight) / canvasWidth, 0),
            hard:       true,
            shouldMove: true,
        }
    }

    if (y < outerTop) {
        return {
            side:       'top',
            outer,
            inner,
            screen:     {x: clamp(x, outerLeft, outerRight), y: outerTop},
            error:      Math.max((outerTop - y) / canvasHeight, 0),
            hard:       true,
            shouldMove: true,
        }
    }

    if (y > outerBottom) {
        return {
            side:       'bottom',
            outer,
            inner,
            screen:     {x: clamp(x, outerLeft, outerRight), y: outerBottom},
            error:      Math.max((y - outerBottom) / canvasHeight, 0),
            hard:       true,
            shouldMove: true,
        }
    }

    if (x < left) {
        return {
            side:       'left',
            outer,
            inner,
            screen:     {x: left, y: clamp(y, top, bottom)},
            error:      Math.max((left - x) / canvasWidth, 0),
            hard:       false,
            shouldMove: true,
        }
    }

    if (x > right) {
        return {
            side:       'right',
            outer,
            inner,
            screen:     {x: right, y: clamp(y, top, bottom)},
            error:      Math.max((x - right) / canvasWidth, 0),
            hard:       false,
            shouldMove: true,
        }
    }

    if (y < top) {
        return {
            side:       'top',
            outer,
            inner,
            screen:     {x: clamp(x, left, right), y: top},
            error:      Math.max((top - y) / canvasHeight, 0),
            hard:       false,
            shouldMove: true,
        }
    }

    if (y > bottom) {
        return {
            side:       'bottom',
            outer,
            inner,
            screen:     {x: clamp(x, left, right), y: bottom},
            error:      Math.max((y - bottom) / canvasHeight, 0),
            hard:       false,
            shouldMove: true,
        }
    }

    return {
        side:       null,
        outer,
        inner,
        screen:     {x, y},
        error:      0,
        hard:       false,
        shouldMove: false,
    }
}

export const interpolateRadians = (from, to, ratio) => {
    const start = finiteNumber(from)
    const end = finiteNumber(to)
    if (start === null) {
        return end ?? 0
    }
    if (end === null) {
        return start
    }

    return start + ((replayAngularDelta(start, end) ?? (end - start)) * clamp(Number(ratio) || 0, 0, 1))
}

export const smoothClipProgress = value => {
    const ratio = clamp(Number(value) || 0, 0, 1)
    return ratio * ratio * (3 - (2 * ratio))
}

export const replayCameraHeadingWithHysteresis = ({
                                                          previousHeading = null,
                                                          nextHeading = 0,
                                                          threshold = CAMERA_HEADING_HYSTERESIS_RADIANS,
                                                      } = {}) => {
    const desiredHeading = sanitizeOrientationRadians(nextHeading, 0)
    const stableHeading = finiteNumber(previousHeading)
    if (stableHeading === null) {
        return desiredHeading
    }

    const delta = replayAngularDelta(stableHeading, desiredHeading)
    if (delta !== null && Math.abs(delta) < Math.max(CAMERA_HEADING_MIN_CHANGE_RADIANS, finiteNumber(threshold) ?? 0)) {
        return stableHeading
    }

    return desiredHeading
}

export const degreesToRadians = value => {
    const number = finiteNumber(value)
    return number === null ? null : CesiumMath.toRadians(number)
}

export const radiansToDegrees = value => {
    const number = finiteNumber(value)
    return number === null ? null : CesiumMath.toDegrees(number)
}

export const safeCartesianFromLonLat = point => {
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)
    if (longitude === null || latitude === null) {
        return null
    }

    return Cartesian3.fromDegrees(longitude, latitude, finiteNumber(point?.altitude ?? point?.height) ?? 0)
}

export const safeCartographicFromCartesian = point => {
    if (!point) {
        return null
    }

    try {
        return Cartographic.fromCartesian(point)
    }
    catch {
        return null
    }
}

export const cameraGuideSampleFromRawSamples = ({rawSamples, times, progress}) => {
    if (!Array.isArray(rawSamples) || rawSamples.length === 0) {
        return null
    }

    const safeProgress = clamp(Number(progress) || 0, 0, 1)
    if (rawSamples.length === 1) {
        const sample = rawSamples[0]
        return {
            progress: safeProgress,
            longitude: sample.longitude,
            latitude: sample.latitude,
            altitude: sample.altitude ?? sample.height ?? 0,
            distanceFromStart: finiteNumber(sample?.distanceFromStart) ?? 0,
        }
    }

    let rightIndex = times.findIndex(time => (finiteNumber(time) ?? Number.POSITIVE_INFINITY) >= safeProgress)
    if (rightIndex < 0) {
        rightIndex = rawSamples.length - 1
    }

    if (rightIndex <= 0) {
        const sample = rawSamples[0]
        return {
            progress: safeProgress,
            longitude: sample.longitude,
            latitude: sample.latitude,
            altitude: sample.altitude ?? sample.height ?? 0,
            distanceFromStart: finiteNumber(sample?.distanceFromStart) ?? 0,
        }
    }

    const leftIndex = rightIndex - 1
    const leftSample = rawSamples[leftIndex]
    const rightSample = rawSamples[rightIndex] ?? rawSamples[rawSamples.length - 1]
    const leftTime = finiteNumber(times[leftIndex]) ?? finiteNumber(leftSample?.progress) ?? 0
    const rightTime = finiteNumber(times[rightIndex]) ?? finiteNumber(rightSample?.progress) ?? leftTime
    const span = rightTime - leftTime
    const ratio = span > 0 ? clamp((safeProgress - leftTime) / span, 0, 1) : 0

    const leftAltitude = finiteNumber(leftSample?.altitude ?? leftSample?.height) ?? 0
    const rightAltitude = finiteNumber(rightSample?.altitude ?? rightSample?.height) ?? leftAltitude
    return {
        progress: safeProgress,
        longitude: lerp(leftSample.longitude, rightSample.longitude, ratio),
        latitude: lerp(leftSample.latitude, rightSample.latitude, ratio),
        altitude: lerp(leftAltitude, rightAltitude, ratio),
        distanceFromStart: lerp(
            finiteNumber(leftSample?.distanceFromStart) ?? 0,
            finiteNumber(rightSample?.distanceFromStart) ?? finiteNumber(leftSample?.distanceFromStart) ?? 0,
            ratio,
        ),
    }
}

export const projectToLocalMeters = (origin, point) => {
    const originLon = finiteNumber(origin?.longitude)
    const originLat = finiteNumber(origin?.latitude)
    const pointLon = finiteNumber(point?.longitude)
    const pointLat = finiteNumber(point?.latitude)
    if ([originLon, originLat, pointLon, pointLat].some(value => value === null)) {
        return null
    }

    const latRad = CesiumMath.toRadians(originLat)
    const metersPerDegreeLat = 111132.954 - 559.822 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad)
    const metersPerDegreeLon = 111132.954 * Math.cos(latRad)
    return {
        x: (pointLon - originLon) * metersPerDegreeLon,
        y: (pointLat - originLat) * metersPerDegreeLat,
    }
}

export const cartographicToLonLat = (cartographic) => {
    const longitudeRadians = finiteNumber(cartographic?.longitude)
    const latitudeRadians = finiteNumber(cartographic?.latitude)
    if (longitudeRadians === null || latitudeRadians === null) {
        return null
    }

    return {
        longitude: radiansToDegrees(longitudeRadians),
        latitude:  radiansToDegrees(latitudeRadians),
        altitude:  finiteNumber(cartographic?.height) ?? 0,
    }
}
