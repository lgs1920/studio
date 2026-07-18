/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayMode.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-17
 * Last modified: 2026-07-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { REPLAY_DRAWER }                                                               from '@Core/constants'
import {
    getJourneyReplayHideOtherJourneys,
}                                                                                          from '@Core/ui/JourneyVisibility'
import {
    CameraUtils,
}                                                                                          from '@Utils/cesium/CameraUtils'
import {
    POIUtils,
}                                                                                          from '@Utils/cesium/POIUtils'
import {
    TrackUtils,
}                                                                                          from '@Utils/cesium/TrackUtils'
import { Journey }                                                                         from '@Core/Journey'
import {
    ArcType, Cartesian2, Cartesian3, Cartographic, CatmullRomSpline, Color, ExtrapolationType, JulianDate,
    EasingFunction, HeightReference, HorizontalOrigin, LinearApproximation, Math as CesiumMath, Matrix4,
    PolylineDashMaterialProperty, SampledPositionProperty, SceneTransforms, Transforms, VerticalOrigin,
}                                                                                          from 'cesium'
import { faCamera }                                                                        from '@fortawesome/pro-solid-svg-icons'
import { faPersonHiking }                                                                  from '@fortawesome/pro-regular-svg-icons'
import {
    JourneyReplayCesiumRenderer,
}                                                                                          from './JourneyReplayCesiumRenderer'
import { REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP, normalizeJourneyReplayClips } from './JourneyReplayClips'
import {
    REPLAY_SCOPE_ALL_TRACKS, JourneyReplayPathSampler,
}                                                                                          from './JourneyReplayPathSampler'
import {
    REPLAY_EVENT_END, REPLAY_EVENT_PAUSE, REPLAY_EVENT_RESUME, REPLAY_EVENT_START,
    REPLAY_EVENT_STOP, REPLAY_EVENT_UPDATE, JourneyReplayPlaybackController,
}                                                                                          from './JourneyReplayPlaybackController'
import { replayVideoTraceDebug }                                                           from './ReplayVideoTraceDebug'
import {
    DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS, normalizeJourneyReplayPOISettings,
}                                                                                          from './JourneyReplayPOISettings'
import {
    REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET, REPLAY_CAMERA_POSITION_AHEAD,
    REPLAY_CAMERA_HEADING_OFFSET_MAX, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_POSITION_SYSTEM,
    REPLAY_MARKER_MODE_HYSTERESIS, REPLAY_MARKER_MODE_NAVIGATION,
    REPLAY_MARKER_MODE_TRACE, getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker,
    normalizeJourneyReplayProgressionStyle, normalizeJourneyReplaySmoothing, normalizeJourneyReplayTrace,
}                                                                                          from './JourneyReplayProgressionStyle'

const DEFAULT_DURATION = 60
const PROFILE_HOVER_RENDER_INTERVAL = 120
const METRIC_OVERLAY_TTL = 2000
const REPLAY_HEADING_TRANSITION_DURATION_SECONDS = 2
const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)
const CAMERA_GUIDE_MIN_STEPS = 512
const CAMERA_GUIDE_MAX_STEPS = 4096
const CAMERA_GUIDE_TARGET_SPACING_METERS = 12
const CAMERA_GUIDE_TURN_STEP_RADIANS = Math.PI / 18
const CARTESIAN_EPSILON = 1e-7
const CAMERA_HEADING_HYSTERESIS_RADIANS = CesiumMath.toRadians(12)
const CAMERA_HEADING_LOOKAHEAD_PROGRESS = 0.16
const CAMERA_HEADING_MIN_CHANGE_RADIANS = CesiumMath.toRadians(5)
const CAMERA_VIEW_POSITION_EPSILON_METERS = 0.5
const CAMERA_VIEW_ANGLE_EPSILON_RADIANS = CesiumMath.toRadians(0.25)
const CAMERA_UPDATE_MIN_PROGRESS_DELTA = 0.0005
const CAMERA_REDIRECT_MAX_TRANSITION_SECONDS = 1
const CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS = 120
const CAMERA_REDIRECT_TRACE_VISIBILITY_OFFSETS_METERS = Object.freeze([6, 12, 18, 24])
const CAMERA_REDIRECT_REQUIRED_TRACE_OFFSET_METERS = 12
const CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS = 11
const CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS = 3
const CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS = 8
const REPLAY_TOLERANCE_OUTER_INSET_RATIO = 0.05
const REPLAY_TOLERANCE_INNER_INSET_RATIO = 0.2
const REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS = 300
const REPLAY_TRACKING_NAVIGATION_ZONE_RATIO = 0.2
const REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO = 0.85
const REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO = 0.3
const REPLAY_POI_TRIGGER_EPSILON_METERS = 0.001
const REPLAY_POI_TRIGGER_SCAN_MARGIN_METERS = 5
const CAMERA_ANGLE_PREVIEW_AXIS_LENGTH = 1800
const CAMERA_ANGLE_PREVIEW_OFFSET_LENGTH = 1800
const CAMERA_ANGLE_PREVIEW_ICON_SIZE = 24
export const REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT = 'lgs:replay:journey-toolbar-visibility'
export const REPLAY_EVENT_STOP_CLIPS_COMPLETE = 'replay/stop-clips-complete'

const CAMERA_REDIRECT_CANDIDATES = Object.freeze([
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -4},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -6},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -10},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -14},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -18},
                                                     {headingOffsetDeg: 8, pitchOffsetDeg: 0},
                                                     {headingOffsetDeg: -8, pitchOffsetDeg: 0},
                                                     {headingOffsetDeg: 16, pitchOffsetDeg: 0},
                                                     {headingOffsetDeg: -16, pitchOffsetDeg: 0},
                                                     {headingOffsetDeg: 8, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: -8, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: 16, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: -16, pitchOffsetDeg: -8},
                                                     {headingOffsetDeg: 24, pitchOffsetDeg: -10},
                                                     {headingOffsetDeg: -24, pitchOffsetDeg: -10},
                                                     {headingOffsetDeg: 0, pitchOffsetDeg: -20},
                                                 ])

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const makeFontAwesomeIconDataUri = (definition, color, size = 24) => {
    const [width, height, , , pathData] = definition.icon
    const paths = (Array.isArray(pathData) ? pathData : [pathData]).filter(Boolean)
    const scale = Math.min((size * 0.78) / width, (size * 0.78) / height)
    const x = (size - width * scale) / 2
    const y = (size - height * scale) / 2
    const fill = `${color ?? '#ffffff'}`
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <g transform="translate(${x} ${y}) scale(${scale})">
                ${paths.map(path => `<path d="${path}" fill="${fill}"/>`).join('')}
            </g>
        </svg>
    `.trim()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const resolveJourneyActivityIcon = (journey = null) => {
    const activityIcon = Journey.activityProfile(journey?.activity, journey?.activitySettings)?.icon
    return activityIcon === 'person-hiking' ? faPersonHiking : faPersonHiking
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const lerp = (start, end, ratio) => start + ((end - start) * ratio)

const hasFiniteLonLat = point => finiteNumber(point?.longitude) !== null && finiteNumber(point?.latitude) !== null

const sanitizeOrientationRadians = (value, fallback) => finiteNumber(value) ?? fallback

export const replayHeadingFromLocalAxisAngle = axisAngle => {
    const angle = finiteNumber(axisAngle)
    if (angle === null) {
        return 0
    }

    return Math.atan2(Math.cos(angle), Math.sin(angle))
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

export const replayRuntimeTrackingSettings = (settings = {}) => {
    const runtime = settings?.tracking ?? settings?.runtimeTracking ?? {}
    const navigation = runtime?.navigation ?? {}
    const dynamic = runtime?.dynamic ?? {}
    return {
        navigation: {
            triggerZone: navigation.triggerZone ?? replayCenteredZone(
                finiteNumber(navigation.zoneRatio) ?? finiteNumber(navigation.width) ?? REPLAY_TRACKING_NAVIGATION_ZONE_RATIO,
                finiteNumber(navigation.height) ?? finiteNumber(navigation.zoneRatio) ?? REPLAY_TRACKING_NAVIGATION_ZONE_RATIO,
            ),
        },
        dynamic:    {
            triggerZone: dynamic.triggerZone ?? replayCenteredZone(
                finiteNumber(dynamic.triggerRatio) ?? finiteNumber(dynamic.width) ?? REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO,
                finiteNumber(dynamic.height) ?? finiteNumber(dynamic.triggerRatio) ?? REPLAY_TRACKING_DYNAMIC_TRIGGER_ZONE_RATIO,
            ),
            targetZone:  dynamic.targetZone ?? replayCenteredZone(
                finiteNumber(dynamic.targetRatio) ?? finiteNumber(dynamic.targetWidth) ?? REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO,
                finiteNumber(dynamic.targetHeight) ?? finiteNumber(dynamic.targetRatio) ?? REPLAY_TRACKING_DYNAMIC_TARGET_ZONE_RATIO,
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

const replayInnerToleranceZoneBounds = (zone = {}, marginRatio = 0.1) => {
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

const replayInsetBounds = (bounds = {}, insetRatio = 0.1) => {
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

const replayWindowCollisionFromPoint = ({
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

const interpolateRadians = (from, to, ratio) => {
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

const smoothClipProgress = value => {
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

const degreesToRadians = value => {
    const number = finiteNumber(value)
    return number === null ? null : CesiumMath.toRadians(number)
}

const radiansToDegrees = value => {
    const number = finiteNumber(value)
    return number === null ? null : CesiumMath.toDegrees(number)
}

const safeCartesianFromLonLat = point => {
    const longitude = finiteNumber(point?.longitude)
    const latitude = finiteNumber(point?.latitude)
    if (longitude === null || latitude === null) {
        return null
    }

    return Cartesian3.fromDegrees(longitude, latitude, finiteNumber(point?.altitude ?? point?.height) ?? 0)
}

const safeCartographicFromCartesian = point => {
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

const cameraGuideSampleFromRawSamples = ({rawSamples, times, progress}) => {
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

const projectToLocalMeters = (origin, point) => {
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

const cartographicToLonLat = (cartographic) => {
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

const replayStore = () => globalThis.lgs?.stores?.replay

const resolveJourneyReplayRuntimeClips = ({clips = null, settingsClips = {}, journey = null} = {}) => {
    if (clips) {
        return normalizeJourneyReplayClips(clips)
    }

    return normalizeJourneyReplayClips({
        catalog: settingsClips?.catalog ?? settingsClips?.definitions ?? {},
        start:   Array.isArray(journey?.replay?.start)
                 ? journey.replay.start
                 : settingsClips?.start ?? [],
        stop:    Array.isArray(journey?.replay?.stop)
                 ? journey.replay.stop
                 : settingsClips?.stop ?? [],
    })
}

const currentJourneyReplaySample = controller => controller?.currentSample?.() ?? replayStore()?.sample ?? null

const currentJourneyReplayPoiBehavior = () => {
    const settings = getJourneyReplaySettings()
    const store = replayStore()
    return {
        hideAllPoisDuringJourneyReplay: settings.hideAllPoisDuringJourneyReplay === true || store?.hideAllPoisDuringJourneyReplay === true,
        animateAllPoisDuringJourneyReplay: settings.animateAllPoisDuringJourneyReplay === true || store?.animateAllPoisDuringJourneyReplay === true,
    }
}

const resetRuntimeProgress = (store) => {
    if (!store) {
        return
    }

    store.active = false
    store.playing = false
    store.paused = false
    store.progress = 0
    store.elapsedMillis = null
    store.durationMillis = null
    store.sample = null
    store.totalDistance = 0
    store.toolbarVisible = false
    store.mainUiHidden = false
    store.clipSequenceActive = false
    store.orbitAllowed = true
    store.cameraUserAdjusted = false
    store.cameraUpdateSource = null
    store.hoverSample = null
    store.replayFramePhase = null
    store.dynamicFrameState = null
    store.metricOverlay = {
        ...store.metricOverlay,
        visible:   false,
        source:    null,
        anchor:    null,
        sample:    null,
        expiresAt: 0,
    }
}

const publishReplayClipFrameState = ({
                                         store = replayStore(),
                                         slot = REPLAY_CLIP_SLOT_START,
                                         sample = null,
                                         progress = slot === REPLAY_CLIP_SLOT_STOP ? 1 : 0,
                                     } = {}) => {
    if (!store) {
        return null
    }

    const phase = {
        kind: slot,
        slot,
        progress,
        localProgress: slot === REPLAY_CLIP_SLOT_STOP ? 1 : 0,
        replayFrameIndex: null,
        replayFrameCount: null,
        isLastTwoReplayFrames: false,
    }
    const now = globalThis.performance?.now?.() ?? Date.now()
    store.clipSequenceActive = true
    store.replayFramePhase = phase
    store.dynamicFrameState = {
        active:        true,
        playing:       false,
        paused:        false,
        progress,
        direction:     Number(store.direction) < 0 ? -1 : 1,
        sample:        sample ?? store.sample ?? store.liveSample ?? null,
        elapsedMillis: finiteNumber(sample?.journeyElapsedMillis) ?? finiteNumber(store.elapsedMillis),
        durationMillis: finiteNumber(sample?.journeyDurationMillis)
                        ?? finiteNumber(store.durationMillis),
        replayFrameIndex: null,
        replayFrameCount: null,
        phase,
        source:        'clip',
        updatedAt:     now,
    }
    return phase
}

export class JourneyReplayMode {
    #controller
    #renderer
    #sampler = null
    #samplerConfigKey = null
    #unbind = []
    #requestRenderMode = null
    #pendingProfileHoverSample = null
    #profileHoverTimeout = null
    #lastProfileHoverRender = 0
    #cameraGuide = null
    #cameraGuideSourceKey = null
    #cameraGuidePositionProperty = null
    #cameraGuidePositionPropertyKey = null
    #cameraMode = null
    #cameraFlightActive = false
    #replayExportClipFrameState = null
    #cameraBezierFrame = null
    #cameraBezierResolve = null
    #deterministicCameraTransition = null
    #savedCameraState = null
    #playbackStartCameraSettings = null
    #deferPlaybackCameraRestore = false
    #suppressPlaybackCameraSync = false
    #replayDrawerWasOpenBeforePlayback = false
    #lastCameraHeading = null
    #lastCameraPitch = null
    #lastNominalCameraHeading = null
    #lastNominalCameraPitch = null
    #lastAppliedCameraView = null
    #cameraRedirectState = null
    #cameraUserAdjusting = false
    #cameraApplyingView = false
    #cameraPointerActive = false
    #cameraManualInteractionTimer = null
    #cameraAutoTrackingIgnoreUntil = 0
    #lastToleranceRecenterAt = null
    #lastToleranceRecenterProgress = null
    #lastNavigationRecenterAt = null
    #lastNavigationRecenterProgress = null
    #lastDynamicTargetScreen = null
    #skipNextImmediateStartRecenter = false
    #toleranceZoneOverlay = null
    #cameraAnglePreviewEntities = null
    #cameraAnglePreviewPOIVisibilityState = new Map()
    #journeyToolbarWasVisible = null
    #journeyToolbarHidden = false
    #hiddenJourneyVisibility = new Map()
    #hiddenCurrentJourneyPolylines = new Map()
    #deferStartCameraRecenter = false
    #introHeadingTransition = null
    #cameraBridgeBound = false
    #cameraLiveSyncFrame = null
    #clipSequenceToken = 0
    #sceneRestoreDeferred = false
    #replayPoiExpandedState = new Map()
    #replayPoiCollapseTimers = new Map()
    #replayPoiTriggered = new Set()
    #replayPOIVisibilityState = new Map()
    #stopClipPOIMaskFrame = null
    #lastJourneyReplayPoiDistance = null
    #lastJourneyReplayPoiCursor = 0
    #lastPlaybackUpdateProgressKey = null
    #sortedNearbyPois = []

    constructor({
                    controller = new JourneyReplayPlaybackController(),
                    renderer = new JourneyReplayCesiumRenderer(),
                } = {}) {
        this.#controller = controller
        this.#renderer = renderer
        this.#bindRenderer()
    }

    get controller() {
        return this.#controller
    }

    get sampler() {
        return this.#sampler
    }

    get running() {
        return this.#controller.running
    }

    get playing() {
        return this.#controller.playing
    }

    get paused() {
        return this.#controller.paused
    }

    #samplerConfigurationKey = ({
                                    journey = null,
                                    scope = REPLAY_SCOPE_ALL_TRACKS,
                                    trackSlug = null,
                                    includeHiddenTracks = false,
                                    smoothing = null,
                                } = {}) => [
        journey?.slug ?? '',
        journey?.tracks?.size ?? 0,
        scope,
        trackSlug ?? '',
        includeHiddenTracks === true ? 1 : 0,
        smoothing?.enabled === true ? 1 : 0,
        smoothing?.step ?? 0,
    ].join('|')

    configure = (options = {}) => {
        const store = replayStore()
        const journey = options.journey ?? globalThis.lgs?.theJourney

        if (!journey) {
            return null
        }

        const replay = getJourneyReplaySettings()
        const scope = REPLAY_SCOPE_ALL_TRACKS
        const trackSlug = options.trackSlug ?? globalThis.lgs?.theTrack?.slug ?? store?.trackSlug
        const progression = options.progression ?? replay.progression
        const profileInfo = options.profileInfo ?? replay.profileInfo
        const trace = options.trace ?? replay.trace
        const smoothing = normalizeJourneyReplaySmoothing(options.smoothing ?? replay.smoothing)
        const marker = options.marker ?? replay.marker
        const camera = options.camera ?? replay.camera
        const samplerConfigKey = this.#samplerConfigurationKey({
            journey,
            scope,
            trackSlug,
            includeHiddenTracks: options.includeHiddenTracks ?? false,
            smoothing,
        })
        const clips = resolveJourneyReplayRuntimeClips({
            clips:         options.clips,
            settingsClips: replay.clips,
            journey,
        })

        if (this.#samplerConfigKey !== samplerConfigKey || !this.#sampler) {
            this.#sampler = new JourneyReplayPathSampler({
                journey,
                scope,
                trackSlug,
                includeHiddenTracks: options.includeHiddenTracks ?? false,
                renderSmoothing: smoothing,
            })
            this.#samplerConfigKey = samplerConfigKey
            this.#resetCameraController()
        }

        if (store) {
            store.journeySlug = journey.slug
            store.trackSlug = trackSlug ?? null
            store.scope = scope
            store.totalDistance = this.#sampler.totalDistance
            store.progression = progression
            store.profileInfo = profileInfo
            store.trace = normalizeJourneyReplayTrace(trace)
            store.smoothing = smoothing
            store.marker = normalizeJourneyReplayMarker(marker)
            store.camera = normalizeJourneyReplayCamera(camera)
            store.clips = clips
        }

        this.#controller.configure({
            sampler:   this.#sampler,
            duration:  options.duration ?? replay.duration ?? store?.duration ?? DEFAULT_DURATION,
            direction: 1,
            loop:      options.loop ?? replay.loop ?? store?.loop ?? false,
            progress:  options.progress ?? store?.progress ?? 0,
        })

        this.bindCesiumCameraBridge()

        return this.#sampler
    }

    start = (options = {}) => {
        this.#renderer.clear()
        this.bindCesiumCameraBridge()
        this.#deferPlaybackCameraRestore = false
        this.#suppressPlaybackCameraSync = false
        this.#replayExportClipFrameState = null
        const sampler = this.configure(options)
        if (!sampler?.hasSamples) {
            return null
        }

        const shouldHideOtherJourneys = options.hideOtherJourneys
                                        ?? getJourneyReplayHideOtherJourneys()
        void globalThis.__?.ui?.cameraManager?.stopRotate?.()
        this.#setJourneyReplayOrbitAllowed(false)
        this.#restoreOtherJourneysVisibility()
        this.#hideCurrentJourneyVisibility()
        if (shouldHideOtherJourneys) {
            this.#hideOtherJourneysVisibility()
        }
        const startSample = sampler.atProgress?.(options.progress ?? 0)
        this.#captureCameraState({sample: startSample})
        this.#captureJourneyReplayDrawerStateBeforePlayback()
        this.#capturePlaybackCameraSettings()
        const startList = this.#clipListForSlot(REPLAY_CLIP_SLOT_START)
        this.#deferStartCameraRecenter = startList.length > 0
        const introLeadSeconds = 1
        const introStartAt = this.#now() + Math.max(
            0,
            (startList.reduce((total, clip) => total + Math.max(0, Number(clip?.params?.duration ?? this.#cameraSettingsForClip(clip)?.duration ?? 0)), 0) - introLeadSeconds) * 1000,
        )
        const camera = globalThis.lgs?.viewer?.camera
        this.#introHeadingTransition = startList.length > 0
                                       ? {
                startAt:       introStartAt,
                endAt:         introStartAt + (REPLAY_HEADING_TRANSITION_DURATION_SECONDS * 1000),
                height:        finiteNumber(camera?.positionCartographic?.height)
                                   ?? finiteNumber(startSample?.altitude ?? startSample?.height)
                                   ?? 0,
                fromPitch:     finiteNumber(camera?.pitch) ?? this.#lastCameraPitch ?? SAFE_TOP_DOWN_PITCH,
                targetHeading: this.#introHeadingForProgress(options.progress ?? 0),
                applied:       false,
            }
                                       : null
        const token = ++this.#clipSequenceToken
        let startResult = startSample
        void this.#prepareNearbyPOIsForPlayback(startSample)
        const runtimeStore = replayStore()
        if (runtimeStore) {
            runtimeStore.toolbarVisible = true
            runtimeStore.mainUiHidden = true
            runtimeStore.clipSequenceActive = true
        }
        this.#hideMainUI()

        if (startList.length > 0) {
            publishReplayClipFrameState({
                store: runtimeStore,
                slot: REPLAY_CLIP_SLOT_START,
                sample: startSample,
                progress: options.progress ?? 0,
            })
            this.#setContinuousRender(true)
            this.#hideJourneyToolbarVisibility()
            void (async () => {
                try {
                    if (startSample) {
                        await this.#playJourneyReplayClips(REPLAY_CLIP_SLOT_START, {
                            sample: startSample,
                            token,
                        })
                    }

                    if (token !== this.#clipSequenceToken) {
                        return
                    }

                    startResult = this.#controller.start({
                        progress: options.progress ?? 0,
                    })
                    this.#deferStartCameraRecenter = false
                }
                catch (error) {
                    console.error('[JourneyReplayMode] Failed to run replay start clips.', error)
                    this.#deferStartCameraRecenter = false
                    this.stop({emit: false})
                }
            })()
        }
        else {
            this.#deferStartCameraRecenter = false
            this.#skipNextImmediateStartRecenter = this.#placeCameraAtPlaybackStart(startSample, options.progress ?? 0) === true
            startResult = this.#controller.start({
                progress: options.progress ?? 0,
            })
        }

        return startResult ?? startSample
    }

    pause = () => {
        this.#cancelActiveCameraFlight()
        return this.#controller.pause()
    }

    resume = () => this.#controller.resume()

    setLoop = loop => {
        const enabled = this.#controller.setLoop(loop)
        const store = replayStore()
        if (store) {
            store.loop = enabled
        }
        return enabled
    }

    setVideoSafeMode = (enabled = true) => {
        return this.#controller.setVideoSafeMode?.(enabled) ?? null
    }

    preparePlaybackSceneForExport = async ({
                                               journey = globalThis.lgs?.theJourney ?? null,
                                               progress = this.#controller?.progress ?? 0,
                                               hideOtherJourneys = getJourneyReplayHideOtherJourneys(),
                                               hideReplayMarker = false,
                                           } = {}) => {
        this.bindCesiumCameraBridge()
        this.#deferPlaybackCameraRestore = false
        this.#suppressPlaybackCameraSync = false

        const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0))
        const sampler = this.configure({
            journey,
            progress: safeProgress,
        }) ?? this.#sampler
        const sample = sampler?.atProgress?.(safeProgress)
                       ?? this.#controller?.currentSample?.()
                       ?? null

        void globalThis.__?.ui?.cameraManager?.stopRotate?.()
        this.#captureCameraState({sample})
        this.#captureJourneyReplayDrawerStateBeforePlayback()
        this.#capturePlaybackCameraSettings()

        if (journey) {
            journey.visible = true
            journey.updateVisibility?.(true)
            const focusResult = typeof journey.focus === 'function'
                ? journey.focus({
                    resetCamera: true,
                    rotate:      false,
                    snapDistance: 50000,
                })
                : globalThis.__?.ui?.sceneManager?.focusOnJourney?.({
                    journey,
                    target:      journey,
                    resetCamera: true,
                    rotate:      false,
                    snapDistance: 50000,
                })
            await Promise.resolve(focusResult)
        }

        this.#setJourneyReplayOrbitAllowed(false)
        this.#restoreOtherJourneysVisibility()
        this.#hideCurrentJourneyVisibility()
        if (hideOtherJourneys) {
            this.#hideOtherJourneysVisibility()
        }
        if (sampler?.hasSamples) {
            this.#renderer.show({
                sampler,
                options: {smoothedGuide: this.#smoothedGuide()},
            })
        }
        void this.#prepareNearbyPOIsForPlayback(sample)
        if (hideReplayMarker) {
            this.#renderer.hideCursor?.()
        }
        this.#hideMainUI()
        globalThis.lgs?.scene?.requestRender?.()
        return true
    }

    #hideOtherJourneysVisibility = () => {
        const currentJourneySlug = globalThis.lgs?.theJourney?.slug ?? null
        const journeys = globalThis.lgs?.journeys
        if (!journeys?.values) {
            return
        }

        for (const journey of journeys.values()) {
            if (!journey || journey.slug === currentJourneySlug) {
                continue
            }

            if (!this.#hiddenJourneyVisibility.has(journey.slug)) {
                this.#hiddenJourneyVisibility.set(journey.slug, journey.visible !== false)
            }

            journey.visible = false
            journey.updateVisibility?.(false)
        }

        globalThis.lgs?.scene?.requestRender?.()
    }

    #hideCurrentJourneyVisibility = () => {
        const journey = globalThis.lgs?.theJourney
        if (!journey) {
            return
        }

        journey.visible = false
        journey.updateVisibility?.(false)
        this.#preserveCurrentJourneyPOIVisibility(journey)
        globalThis.lgs?.scene?.requestRender?.()
    }

    #restoreCurrentJourneyVisibility = ({restorePOIs = true} = {}) => {
        const journey = globalThis.lgs?.theJourney
        if (!journey) {
            return
        }

        const editorJourney = globalThis.lgs?.theJourneyEditorProxy?.journey ?? null
        this.#hiddenJourneyVisibility.delete(journey.slug)
        journey.visible = true
        if (editorJourney) {
            editorJourney.visible = true
        }
        journey.updateVisibility?.(true)
        this.#restoreCurrentJourneyPolylineVisibility()
        if (!restorePOIs) {
            this.#applyJourneyReplayPOIVisibility()
        }
        if (restorePOIs) {
            this.#restoreJourneyReplayPOIVisibility()
        }
        if (restorePOIs && globalThis.lgs?.viewer?.dataSources) {
            TrackUtils.updatePOIsVisibility(journey, true)
        }
        globalThis.lgs?.scene?.requestRender?.()
    }

    #poiEntities = poi => {
        if (!poi?.id || !globalThis.lgs?.viewer) {
            return []
        }

        const entities = []
        const addEntity = entity => {
            if (entity && !entities.includes(entity)) {
                entities.push(entity)
            }
        }

        addEntity(POIUtils.getEntityContainer(poi)?.getById?.(poi.id))
        addEntity(globalThis.lgs.viewer.entities?.getById?.(poi.id))

        const dataSources = globalThis.lgs.viewer.dataSources
        const length = Number(dataSources?.length) || 0
        for (let index = 0; index < length; index++) {
            addEntity(dataSources.get(index)?.entities?.getById?.(poi.id))
        }

        return entities
    }

    #setPOIEntityVisibility = (poi, visible) => {
        this.#poiEntities(poi).forEach(entity => {
            const effectiveVisibility = POIUtils.setPOIVisibility(poi, visible)
            entity.show = effectiveVisibility
            if (entity.billboard) {
                entity.billboard.show = effectiveVisibility
            }
        })
    }

    #resolveJourneyReplayPOI = entry => {
        const poiId = entry?.poi?.id
        if (!poiId) {
            return null
        }

        return globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            ?? globalThis.__?.ui?.poiManager?.get?.(poiId)
            ?? entry.poi
    }

    #replayPOICandidates = (nearbyPois = null) => {
        const candidates = new Map()
        const addPOI = poi => {
            if (poi?.id && !candidates.has(poi.id)) {
                candidates.set(poi.id, poi)
            }
        }
        const addList = list => {
            if (!list?.values) {
                return
            }

            for (const poi of list.values()) {
                addPOI(poi)
            }
        }
        const store = replayStore()
        const runtimeNearbyPois = Array.isArray(nearbyPois)
            ? nearbyPois
            : Array.isArray(store?.nearbyPois)
            ? store.nearbyPois
            : []

        runtimeNearbyPois.forEach(entry => addPOI(this.#resolveJourneyReplayPOI(entry)))
        addList(globalThis.lgs?.stores?.main?.components?.pois?.list)
        addList(globalThis.__?.ui?.poiManager?.list)
        return Array.from(candidates.values())
    }

    #isVisibleProperty = value => {
        if (typeof value?.getValue === 'function') {
            return value.getValue(JulianDate.now()) !== false
        }

        return value !== false
    }

    #isPOIVisibleBeforePlayback = poi => {
        if (poi?.visible === false) {
            return false
        }

        const entities = this.#poiEntities(poi)
        if (entities.length === 0) {
            return true
        }

        return entities.some(entity => this.#isVisibleProperty(entity?.show)
            && (!entity?.billboard || this.#isVisibleProperty(entity.billboard.show)))
    }

    #applyJourneyReplayPOIVisibility = (nearbyPois = null) => {
        const store = replayStore()
        const {hideAllPoisDuringJourneyReplay} = currentJourneyReplayPoiBehavior()
        const runtimeNearbyPois = Array.isArray(nearbyPois)
            ? nearbyPois
            : Array.isArray(store?.nearbyPois)
            ? store.nearbyPois
            : []
        const nearbyPOIIds = new Set(
            runtimeNearbyPois
                .map(entry => this.#resolveJourneyReplayPOI(entry)?.id)
                .filter(Boolean),
        )

        for (const poi of this.#replayPOICandidates(runtimeNearbyPois)) {
            if (!poi?.id) {
                continue
            }

            const settings = normalizeJourneyReplayPOISettings(poi.replay)
            const shouldApplyVisibility = nearbyPOIIds.has(poi.id)
                || hideAllPoisDuringJourneyReplay
                || settings.visible === false
                || poi.visible === false
            if (!shouldApplyVisibility) {
                continue
            }

            const visibleBeforePlayback = this.#replayPOIVisibilityState.get(poi.id)?.visible
                ?? this.#isPOIVisibleBeforePlayback(poi)
            const visibleDuringPlayback = visibleBeforePlayback
                && poi.visible !== false
                && !hideAllPoisDuringJourneyReplay
                && settings.visible !== false

            if ((hideAllPoisDuringJourneyReplay || settings.visible === false) && !this.#replayPOIVisibilityState.has(poi.id)) {
                this.#replayPOIVisibilityState.set(poi.id, {
                    visible: visibleBeforePlayback,
                })
            }

            this.#setPOIEntityVisibility(poi, visibleDuringPlayback)
        }
    }

    #restoreJourneyReplayPOIVisibility = () => {
        for (const [poiId, state] of this.#replayPOIVisibilityState.entries()) {
            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
                ?? globalThis.__?.ui?.poiManager?.get?.(poiId)
            if (!poi?.id) {
                continue
            }

            this.#setPOIEntityVisibility(poi, state?.visible === true && poi.visible !== false)
        }

        this.#replayPOIVisibilityState.clear()
    }

    #hideGloballyHiddenPOIs = () => {
        for (const poi of this.#replayPOICandidates()) {
            if (poi?.id && poi.visible === false) {
                this.#setPOIEntityVisibility(poi, false)
            }
        }
    }

    #startStopClipPOIMaskLoop = () => {
        if (this.#stopClipPOIMaskFrame !== null) {
            return
        }

        this.#applyJourneyReplayPOIVisibility()
        const tick = () => {
            this.#stopClipPOIMaskFrame = null
            this.#applyJourneyReplayPOIVisibility()
            this.#stopClipPOIMaskFrame = globalThis.__?.requestAnimationFrame?.(tick)
                ?? globalThis.requestAnimationFrame?.(tick)
                ?? null
        }

        this.#stopClipPOIMaskFrame = globalThis.__?.requestAnimationFrame?.(tick)
            ?? globalThis.requestAnimationFrame?.(tick)
            ?? null
    }

    #stopStopClipPOIMaskLoop = () => {
        if (this.#stopClipPOIMaskFrame === null) {
            return
        }

        globalThis.__?.cancelAnimationFrame?.(this.#stopClipPOIMaskFrame)
        globalThis.cancelAnimationFrame?.(this.#stopClipPOIMaskFrame)
        this.#stopClipPOIMaskFrame = null
    }

    #preserveCurrentJourneyPOIVisibility = journey => {
        if (!globalThis.lgs?.viewer?.dataSources) {
            return
        }

        const sources = TrackUtils.getDataSourcesByName(journey.slug)
        if (!Array.isArray(sources) || sources.length === 0) {
            return
        }

        this.#hiddenCurrentJourneyPolylines.clear()

        for (const source of sources) {
            if (!source) {
                continue
            }

            source.show = true

            for (const entity of source.entities?.values ?? []) {
                if (!entity?.id) {
                    continue
                }

                const poi = globalThis.__?.ui?.poiManager?.get?.(entity.id)
                if (poi?.id && entity.billboard) {
                    entity.show = poi.visible !== false
                    continue
                }

                if (!entity.polyline) {
                    continue
                }

                const previousVisibility = typeof entity.polyline.show?.getValue === 'function'
                    ? entity.polyline.show.getValue(JulianDate.now())
                    : entity.polyline.show

                this.#hiddenCurrentJourneyPolylines.set(entity.id, {
                    sourceName: source.name ?? journey.slug,
                    visible:    previousVisibility !== false,
                })
                TrackUtils.setPolylineVisibility(entity, false)
            }
        }
    }

    #restoreCurrentJourneyPolylineVisibility = () => {
        if (this.#hiddenCurrentJourneyPolylines.size === 0) {
            return
        }

        if (!globalThis.lgs?.viewer?.dataSources) {
            this.#hiddenCurrentJourneyPolylines.clear()
            return
        }

        for (const [entityId, state] of this.#hiddenCurrentJourneyPolylines.entries()) {
            const namedSource = state?.sourceName
                ? TrackUtils.getDataSourcesByName(state.sourceName, true)?.[0]
                : null
            const source = namedSource ?? TrackUtils.getDataSourceNameByEntityId(entityId)
            const entity = source?.entities?.getById?.(entityId)
            if (!entity) {
                continue
            }

            TrackUtils.setPolylineVisibility(entity, state?.visible !== false)
        }

        this.#hiddenCurrentJourneyPolylines.clear()
    }

    #setJourneyReplayOrbitAllowed = (allowed = true) => {
        const store = replayStore()
        if (store) {
            store.orbitAllowed = allowed === true
        }
    }

    #restoreOtherJourneysVisibility = () => {
        if (this.#hiddenJourneyVisibility.size === 0) {
            return
        }

        const currentJourneySlug = globalThis.lgs?.theJourney?.slug ?? null
        for (const [slug, visible] of this.#hiddenJourneyVisibility.entries()) {
            if (slug === currentJourneySlug) {
                this.#hiddenJourneyVisibility.delete(slug)
                continue
            }

            const journey = globalThis.lgs?.journeys?.get?.(slug)
            if (!journey) {
                continue
            }

            journey.visible = visible
            journey.updateVisibility?.(visible)
        }

        this.#hiddenJourneyVisibility.clear()
        globalThis.lgs?.scene?.requestRender?.()
    }

    setHideOtherJourneys = (enabled = true) => {
        const nextEnabled = enabled === true
        const replaySettings = globalThis.lgs?.settings?.ui?.replay
        if (replaySettings) {
            replaySettings.hideOtherJourneys = nextEnabled
        }

        const store = replayStore()
        if (store) {
            store.hideOtherJourneys = nextEnabled
        }

        if (nextEnabled) {
            if (this.#controller.running || this.#controller.playing || this.#controller.paused) {
                this.#hideOtherJourneysVisibility()
            }
        }
        else {
            this.#restoreOtherJourneysVisibility()
        }

        return nextEnabled
    }

    setHideAllPoisDuringJourneyReplay = (enabled = true) => {
        const nextEnabled = enabled === true
        const replaySettings = globalThis.lgs?.settings?.ui?.replay
        if (replaySettings) {
            replaySettings.hideAllPoisDuringJourneyReplay = nextEnabled
        }

        const store = replayStore()
        if (store) {
            store.hideAllPoisDuringJourneyReplay = nextEnabled
        }

        if (this.#controller.running || this.#controller.playing || this.#controller.paused) {
            if (nextEnabled) {
                this.#applyJourneyReplayPOIVisibility()
            }
            else {
                this.#restoreJourneyReplayPOIVisibility()
                this.#applyJourneyReplayPOIVisibility()
            }
        }

        return nextEnabled
    }

    setAnimateAllPoisDuringJourneyReplay = (enabled = true) => {
        const nextEnabled = enabled === true
        const replaySettings = globalThis.lgs?.settings?.ui?.replay
        if (replaySettings) {
            replaySettings.animateAllPoisDuringJourneyReplay = nextEnabled
        }

        const store = replayStore()
        if (store) {
            store.animateAllPoisDuringJourneyReplay = nextEnabled
        }

        return nextEnabled
    }

    toggle = () => {
        if (this.#controller.playing) {
            return this.pause()
        }

        if (this.#controller.paused) {
            return this.resume()
        }

        return this.start()
    }

    seek = progress => this.#controller.seek(progress)

    refresh = ({
                   camera = true,
                   suppressMoveEvents = camera === true,
                   rebuildSampler = false,
                   forceGeometry = true,
                   frameTimeMs = null,
                   exportMode = false,
               } = {}) => {
        let sample = this.#controller.currentSample()
        if (rebuildSampler) {
            const progress = finiteNumber(this.#controller.progress ?? sample?.progress) ?? 0
            this.configure({progress})
            sample = this.#controller.currentSample()
            if (sample && this.#sampler) {
                this.#renderer.show({
                    sampler: this.#sampler,
                    options: {smoothedGuide: this.#smoothedGuide()},
                })
            }
        }
        if (sample && this.#sampler) {
            this.#renderer.update({
                sample,
                sampler: this.#sampler,
                forceGeometry,
            })
            if (camera) {
                if (suppressMoveEvents) {
                    this.#cameraAutoTrackingIgnoreUntil = this.#now() + 180
                }
                this.#updateCamera({
                                       sample,
                                       progress: this.#controller.progress ?? sample.progress ?? 0,
                                       frameTimeMs,
                                       exportMode,
                                   })
            }
        }
        return sample
    }

    refreshCamera = (options = {}) => {
        const sample = options.sample
            ?? currentJourneyReplaySample(this.#controller)
            ?? globalThis.lgs?.stores?.replay?.sample
        if (!sample) {
            return null
        }

        if (options.suppressMoveEvents !== false) {
            this.#cameraAutoTrackingIgnoreUntil = this.#now() + 180
        }

        this.#updateCamera({
            sample,
            progress: this.#controller.progress ?? sample.progress ?? 0,
            source: 'refresh',
                               ...options,
        })
        return sample
    }

    renderReplayExportFrame = async ({phase = null, controller = this.#controller} = {}) => {
        const activeController = controller ?? this.#controller
        const replayPhase = phase?.kind === 'replay' || !phase?.clip
        const progress = clamp(finiteNumber(phase?.progress) ?? activeController?.progress ?? 0, 0, 1)
        const anchorProgress = clamp(finiteNumber(phase?.anchorProgress) ?? progress, 0, 1)

        if (replayPhase) {
            const sample = activeController?.seek?.(progress)
                           ?? this.#sampler?.atProgress?.(progress)
                           ?? activeController?.currentSample?.()
                           ?? null
            if (sample && this.#sampler) {
                this.#renderer.update({
                    sample,
                    sampler:       this.#sampler,
                    forceGeometry: false,
                })
                this.#cameraAutoTrackingIgnoreUntil = this.#now() + 180
                this.#updateCamera({
                    sample,
                    progress,
                    frameTimeMs: finiteNumber(phase?.frameTimeMs) ?? finiteNumber(phase?.localMillis),
                    exportMode:  true,
                })
            }
            return sample
        }

        const sample = activeController?.seek?.(anchorProgress)
                       ?? this.#sampler?.atProgress?.(anchorProgress)
                       ?? activeController?.currentSample?.()
                       ?? null
        const hideClipCursor = phase?.slot === REPLAY_CLIP_SLOT_START
                               || phase?.slot === REPLAY_CLIP_SLOT_STOP
        const staticCompletedTrace = phase?.slot === REPLAY_CLIP_SLOT_STOP
        if (staticCompletedTrace) {
            replayVideoTraceDebug('mode.export-frame.stop.begin', {
                clipId: phase?.clip?.clipId ?? null,
                progress,
                anchorProgress,
                localProgress: phase?.localProgress ?? null,
                localMillis: phase?.localMillis ?? null,
                hasSample: Boolean(sample),
                sampleProgress: sample?.progress ?? null,
                hasSampler: Boolean(this.#sampler),
            })
        }
        if (sample && this.#sampler) {
            this.#renderer.update({
                sample,
                sampler:               this.#sampler,
                forceGeometry:         true,
                freezeDynamic:         false,
                hideCursor:            hideClipCursor,
                hideRemainingTrace:    staticCompletedTrace,
                staticCompletedTrace:  false,
                completedTraceMode:    staticCompletedTrace ? 'stop-dynamic' : 'dynamic',
            })
        }
        const frameSample = await this.#renderReplayExportClipFrame({
            phase,
            clip: phase.clip,
            slot: phase.slot,
            sample,
            localProgress: phase.localProgress,
            localMillis: phase.localMillis,
        })
        if (staticCompletedTrace) {
            replayVideoTraceDebug('mode.export-frame.stop.after-camera', {
                clipId: phase?.clip?.clipId ?? null,
                localProgress: phase?.localProgress ?? null,
                sampleProgress: sample?.progress ?? null,
                cameraHeading: globalThis.lgs?.viewer?.camera?.heading ?? null,
                cameraPitch: globalThis.lgs?.viewer?.camera?.pitch ?? null,
            })
        }
        globalThis.lgs?.scene?.requestRender?.()
        return frameSample ?? sample
    }

    createReplayExportTraceOverlay = ({phase = null, cropRect = null, outputDpr = null, sourceCanvas = null} = {}) => {
        const slot = phase?.slot ?? 'unknown'
        replayVideoTraceDebug(`mode.overlay.${slot}.disabled`, {
            reason: 'trace-must-remain-cesium-terrain-clamped',
            cropRect,
            outputDpr,
            hasSourceCanvas: Boolean(sourceCanvas),
        })
        return null
    }

    #syncRuntimeNearbyPOIs = (journey = globalThis.lgs?.theJourney ?? null) => {
        const store = replayStore()
        const poiManager = globalThis.__?.ui?.poiManager
        if (!journey?.slug || !store || !poiManager?.getJourneyReplayPOIsForJourney) {
            return []
        }

        const poiDistance = globalThis.lgs?.settings?.ui?.replay?.poiDistance ?? store.poiDistance ?? null
        const nearbyPois = poiManager.getJourneyReplayPOIsForJourney(journey, poiDistance)
        store.nearbyPois = nearbyPois
        return nearbyPois
    }

    #updatePOIExpandedState = async (poiId, expanded) => {
        if (!poiId) {
            return null
        }

        const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
        if (!poi || poi.expanded === expanded) {
            return poi ?? null
        }

        return globalThis.__?.ui?.poiManager?.updatePOI?.(poiId, {expanded}, {
            skipPersist:        true,
            immediate:          true,
            skipLocationUpdate: true,
        }) ?? null
    }

    #restoreNearbyPOIsAfterPlayback = async () => {
        for (const timerId of this.#replayPoiCollapseTimers.values()) {
            globalThis.clearTimeout?.(timerId)
        }
        this.#replayPoiCollapseTimers.clear()

        const restoreEntries = Array.from(this.#replayPoiExpandedState.entries())
        this.#replayPoiExpandedState.clear()
        this.#replayPoiTriggered.clear()
        this.#lastJourneyReplayPoiDistance = null
        this.#lastJourneyReplayPoiCursor = 0
        this.#sortedNearbyPois = []

        await Promise.all(restoreEntries.map(([poiId, expanded]) => this.#updatePOIExpandedState(poiId, expanded === true)))
    }

    #closeJourneyReplayOpenedPOIsBeforeStopClips = () => {
        for (const timerId of this.#replayPoiCollapseTimers.values()) {
            globalThis.clearTimeout?.(timerId)
        }
        this.#replayPoiCollapseTimers.clear()

        const openedPOIIds = Array.from(this.#replayPoiTriggered)
        if (openedPOIIds.length === 0) {
            return null
        }

        return Promise.all(openedPOIIds.map(poiId => this.#updatePOIExpandedState(poiId, false)))
    }

    #prepareNearbyPOIsForPlayback = async (sample = null) => {
        await this.#restoreNearbyPOIsAfterPlayback()

        const store = replayStore()
        const journey = globalThis.lgs?.theJourney ?? null
        const {hideAllPoisDuringJourneyReplay} = currentJourneyReplayPoiBehavior()
        const nearbyPois = Array.isArray(store?.nearbyPois) && store.nearbyPois.length > 0
            ? store.nearbyPois
            : this.#syncRuntimeNearbyPOIs(journey)
        const sortedNearbyPois = [...nearbyPois].sort((left, right) => {
            const leftDistance = finiteNumber(left?.projectedAbscissa)
            const rightDistance = finiteNumber(right?.projectedAbscissa)
            if (leftDistance === null && rightDistance === null) {
                return 0
            }
            if (leftDistance === null) {
                return 1
            }
            if (rightDistance === null) {
                return -1
            }
            return leftDistance - rightDistance
        })

        this.#sortedNearbyPois = sortedNearbyPois

        this.#applyJourneyReplayPOIVisibility(sortedNearbyPois)

        for (const entry of sortedNearbyPois) {
            const poiId = entry?.poi?.id
            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            const settings = normalizeJourneyReplayPOISettings(poi?.replay)
            if (!poiId || !poi) {
                continue
            }

            if (!hideAllPoisDuringJourneyReplay && settings.visible === false) {
                continue
            }

            this.#replayPoiExpandedState.set(poiId, poi.expanded === true)
            await this.#updatePOIExpandedState(poiId, false)
        }

        const currentDistance = finiteNumber(sample?.distanceFromStart)
        this.#lastJourneyReplayPoiDistance = currentDistance === null
            ? null
            : Math.max(0, currentDistance - REPLAY_POI_TRIGGER_EPSILON_METERS)
        this.#lastJourneyReplayPoiCursor = currentDistance === null
            ? 0
            : this.#replayPoiCursorForDistance(sortedNearbyPois, currentDistance)

        if (sample) {
            void this.#syncNearbyPOIsForSample(sample)
        }
    }

    #openNearbyPOIForPlayback = async (poiId) => {
        if (!poiId) {
            return
        }

        const existingTimer = this.#replayPoiCollapseTimers.get(poiId)
        if (existingTimer) {
            globalThis.clearTimeout?.(existingTimer)
        }

        const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
        const settings = normalizeJourneyReplayPOISettings(poi?.replay)
        const {hideAllPoisDuringJourneyReplay, animateAllPoisDuringJourneyReplay} = currentJourneyReplayPoiBehavior()
        if (hideAllPoisDuringJourneyReplay || (!animateAllPoisDuringJourneyReplay && settings.animated === false)) {
            return
        }
        const durationSeconds = finiteNumber(settings.displayDurationSeconds) ?? DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS

        await this.#updatePOIExpandedState(poiId, true)

        const timeoutId = globalThis.setTimeout?.(() => {
            this.#replayPoiCollapseTimers.delete(poiId)
            void this.#updatePOIExpandedState(poiId, false)
        }, durationSeconds * 1000)

        if (timeoutId !== undefined) {
            this.#replayPoiCollapseTimers.set(poiId, timeoutId)
        }
    }

    #syncNearbyPOIsForSample = async (sample = null) => {
        const currentDistance = finiteNumber(sample?.distanceFromStart)
        if (currentDistance === null) {
            return
        }

        const nearbyPois = this.#sortedNearbyPois.length > 0
            ? this.#sortedNearbyPois
            : replayStore()?.nearbyPois ?? []
        const previousDistance = this.#lastJourneyReplayPoiDistance

        if (!Array.isArray(nearbyPois) || nearbyPois.length === 0) {
            this.#lastJourneyReplayPoiDistance = currentDistance
            return
        }

        const {hideAllPoisDuringJourneyReplay, animateAllPoisDuringJourneyReplay} = currentJourneyReplayPoiBehavior()
        if (hideAllPoisDuringJourneyReplay) {
            this.#lastJourneyReplayPoiDistance = currentDistance
            this.#lastJourneyReplayPoiCursor = this.#replayPoiCursorForDistance(nearbyPois, currentDistance)
            return
        }

        if (previousDistance !== null && currentDistance < previousDistance) {
            this.#lastJourneyReplayPoiCursor = this.#replayPoiCursorForDistance(nearbyPois, currentDistance)
            this.#lastJourneyReplayPoiDistance = currentDistance
            return
        }

        const thresholdStart = previousDistance ?? Math.max(
            0,
            currentDistance - Math.max(REPLAY_POI_TRIGGER_EPSILON_METERS, REPLAY_POI_TRIGGER_SCAN_MARGIN_METERS),
        )
        let cursor = Number.isInteger(this.#lastJourneyReplayPoiCursor)
                    ? Math.max(0, this.#lastJourneyReplayPoiCursor)
                    : this.#replayPoiCursorForDistance(nearbyPois, thresholdStart)
        const triggeredIds = []

        while (cursor < nearbyPois.length) {
            const entry = nearbyPois[cursor]
            const targetDistance = finiteNumber(entry?.projectedAbscissa)
            if (targetDistance === null) {
                cursor += 1
                continue
            }

            if (targetDistance < thresholdStart) {
                cursor += 1
                continue
            }

            if (targetDistance > currentDistance + REPLAY_POI_TRIGGER_EPSILON_METERS) {
                break
            }

            const poiId = entry?.poi?.id
            if (poiId && !this.#replayPoiTriggered.has(poiId)) {
                const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
                const settings = normalizeJourneyReplayPOISettings(poi?.replay)
                if (settings.visible !== false && (animateAllPoisDuringJourneyReplay || settings.animated !== false)) {
                    this.#replayPoiTriggered.add(poiId)
                    triggeredIds.push(poiId)
                }
            }

            cursor += 1
        }

        this.#lastJourneyReplayPoiCursor = cursor
        this.#lastJourneyReplayPoiDistance = currentDistance
        await Promise.all(triggeredIds.map(poiId => this.#openNearbyPOIForPlayback(poiId)))
    }

    #replayPoiCursorForDistance = (nearbyPois = [], distance = 0) => {
        if (!Array.isArray(nearbyPois) || nearbyPois.length === 0) {
            return 0
        }

        const targetDistance = finiteNumber(distance) ?? 0
        let low = 0
        let high = nearbyPois.length
        while (low < high) {
            const mid = Math.floor((low + high) / 2)
            const midDistance = finiteNumber(nearbyPois[mid]?.projectedAbscissa)
            if (midDistance === null || midDistance <= targetDistance) {
                low = mid + 1
            }
            else {
                high = mid
            }
        }

        return low
    }

    /**
     * Pull the live Cesium camera state back into the replay settings/store.
     * This keeps the drawer and the Cesium viewport in lockstep while the FT is running.
     */
    syncCameraFromCesiumControls = ({sample = null, altitudeMode = null} = {}) => {
        let resolvedSample = sample
            ?? currentJourneyReplaySample(this.#controller)
            ?? globalThis.lgs?.stores?.replay?.sample
            ?? this.#sampler?.atProgress?.(this.#controller.progress ?? 0)

        if (!resolvedSample) {
            const camera = globalThis.lgs?.viewer?.camera
            const position = camera?.positionCartographic
            if (camera && position) {
                resolvedSample = {
                    longitude: CesiumMath.toDegrees(position.longitude),
                    latitude:  CesiumMath.toDegrees(position.latitude),
                    altitude:  position.height,
                }
            }
        }

        const next = this.#updateCameraSettingsFromCesiumControls(resolvedSample, {altitudeMode})
        if (!next) {
            return null
        }

        const positionMode = next.positionMode
        this.#lastCameraHeading = positionMode === REPLAY_CAMERA_POSITION_SYSTEM
                                  ? finiteNumber(globalThis.lgs?.viewer?.camera?.heading)
                                  : null
        this.#lastCameraPitch = degreesToRadians(next.pitch)
        this.#syncCameraDrawerFromSettings()
        this.#cesiumScene()?.requestRender?.()
        return next
    }

    handleProfileHover = ({sample, source = 'profile'} = {}) => {
        if (!sample) {
            return null
        }

        const store = replayStore()
        if (store) {
            store.hoverSample = sample
            store.metricOverlay = {
                visible:   true,
                source,
                anchor:    {
                    longitude: sample.longitude,
                    latitude:  sample.latitude,
                    altitude:  sample.altitude ?? sample.height,
                },
                sample,
                expiresAt: Date.now() + METRIC_OVERLAY_TTL,
            }
        }

        this.#scheduleProfileHoverMarker(sample)
        return sample
    }

    handleProfileLeave = () => {
        const store = replayStore()
        if (store) {
            store.hoverSample = null
        }
    }

    showCameraAnglePreview = () => {}

    hideCameraAnglePreview = () => {
        this.#hideCameraAnglePreviewOverlay()
    }

    stop = (options = {}) => {
        this.#clipSequenceToken++
        this.#skipNextImmediateStartRecenter = false
        this.#stopStopClipPOIMaskLoop()
        this.#cancelActiveCameraFlight()
        this.#stopCameraLiveSyncLoop()
        this.#deferPlaybackCameraRestore = options.emit !== false
        const shouldDeferSceneRestore = options.deferSceneRestore === true || this.#sceneRestoreDeferred === true
        const sample = this.#controller.stop({
            ...options,
            clearProgress: options.clearProgress ?? true,
        })
        this.#renderer.clear()
        this.#setJourneyReplayOrbitAllowed(true)
        this.#setContinuousRender(false)
        this.#removeToleranceZoneOverlay()
        this.#hideCameraAnglePreviewOverlay()
        if (options.emit === false) {
            this.#restorePlaybackCameraSettings()
            this.#restoreCameraState()
        }
        if (shouldDeferSceneRestore) {
            this.#sceneRestoreDeferred = true
            resetRuntimeProgress(replayStore())
            return sample
        }

        this.#restorePlaybackScene()
        return sample
    }

    restorePlaybackScene = ({force = false} = {}) => {
        if (!force && !this.#sceneRestoreDeferred) {
            return false
        }

        this.#renderer.clear()
        this.#restorePlaybackScene()
        return true
    }

    #interpolateReplayExportSample = (start = null, end = null, ratio = 0) => {
        const safeRatio = clamp(Number(ratio) || 0, 0, 1)
        const source = start ?? end
        const target = end ?? start
        if (!source || !target) {
            return source ?? target ?? null
        }

        const startLon = finiteNumber(source.longitude)
        const startLat = finiteNumber(source.latitude)
        const endLon = finiteNumber(target.longitude)
        const endLat = finiteNumber(target.latitude)
        if ([startLon, startLat, endLon, endLat].some(value => value === null)) {
            return safeRatio < 1 ? source : target
        }

        const startAltitude = finiteNumber(source.altitude ?? source.height) ?? 0
        const endAltitude = finiteNumber(target.altitude ?? target.height) ?? startAltitude
        return {
            ...source,
            longitude: lerp(startLon, endLon, safeRatio),
            latitude:  lerp(startLat, endLat, safeRatio),
            altitude:  lerp(startAltitude, endAltitude, safeRatio),
        }
    }

    #focusTargetSampleForReplayExport = async sample => {
        const centroid = await globalThis.__?.ui?.sceneManager?.getJourneyCentroid?.(globalThis.lgs?.theJourney ?? null)
        if (!centroid) {
            return sample
        }

        return {
            ...sample,
            longitude: centroid.longitude,
            latitude:  centroid.latitude,
            altitude:  finiteNumber(centroid.height ?? centroid.altitude) ?? finiteNumber(sample?.altitude ?? sample?.height) ?? 0,
        }
    }

    #replayExportBaseView = ({sample, progress = 0, cameraSettings = null} = {}) => {
        const settings = getJourneyReplaySettings()
        const markerSettings = normalizeJourneyReplayMarker(globalThis.lgs?.stores?.replay?.marker ?? settings.marker)
        return this.#cameraViewForSample({
            sample,
            progress,
            source: 'drawer',
            cameraSettings: cameraSettings ?? normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? settings.camera),
            markerSettings,
            previousHeading: null,
            previousPitch:   null,
        })
    }

    #currentReplayClipCameraState = () => {
        const camera = globalThis.lgs?.viewer?.camera
        return {
            heading: finiteNumber(camera?.heading) ?? 0,
            pitch:   finiteNumber(camera?.pitch) ?? SAFE_TOP_DOWN_PITCH,
            height:  finiteNumber(camera?.positionCartographic?.height)
                     ?? finiteNumber(camera?.positionCartographic?.altitude)
                     ?? null,
        }
    }

    #replayExportClipPhaseKey = ({phase = null, slot = null, clip = null} = {}) => [
        slot ?? phase?.slot ?? 'clip',
        clip?.id ?? clip?.clipId ?? phase?.clip?.id ?? phase?.clip?.clipId ?? 'unknown',
        finiteNumber(phase?.startMillis) ?? '',
        finiteNumber(phase?.endMillis) ?? '',
    ].join('|')

    #resolveJourneyReplayClipCameraPlan = ({
                                               clip = null,
                                               slot = null,
                                               sample = null,
                                               startCamera = null,
                                           } = {}) => {
        if (!clip || !sample) {
            return null
        }

        const settings = getJourneyReplaySettings()
        const replayCamera = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? settings.camera)
        const clipCamera = this.#cameraSettingsForClip(clip)
        const duration = Math.max(0, Number(clip?.params?.duration ?? clipCamera?.duration ?? 0))
        const anchorProgress = slot === REPLAY_CLIP_SLOT_STOP ? 1 : 0
        const baseView = this.#replayExportBaseView({
            sample,
            progress: anchorProgress,
            cameraSettings: replayCamera,
        })
        if (!baseView) {
            return null
        }

        const currentCamera = startCamera ?? this.#currentReplayClipCameraState()
        const replayHeading = this.#clipReplayHeadingForProgress({
            progress: anchorProgress,
            cameraSettings: replayCamera,
            fallbackHeading: baseView.heading,
        })
        const clipPitch = degreesToRadians(finiteNumber(clip?.params?.pitch ?? clipCamera.pitch) ?? clipCamera.pitch)
                          ?? baseView.pitch
        const clipHeight = finiteNumber(clipCamera.altitude) ?? baseView.cameraHeight
        const baseStartView = {
            sample: baseView.sample,
            heading: baseView.heading,
            pitch: baseView.pitch,
            height: baseView.cameraHeight,
            cameraSettings: replayCamera,
        }
        const plan = {
            kind: 'camera',
            clip,
            clipId: clip.clipId,
            slot,
            duration,
            startView: baseStartView,
            endView: {...baseStartView},
            initialView: null,
            setupDestination: null,
            instant: false,
            stopRotate: false,
            rpm: 0,
            focusTarget: null,
        }
        const withTarget = (targetSource, buildPlan) => {
            const resolveTarget = target => buildPlan(target ?? sample)
            return typeof targetSource?.then === 'function'
                   ? targetSource.then(resolveTarget)
                   : resolveTarget(targetSource)
        }

        switch (clip.clipId) {
            case 'zoom-in': {
                return withTarget(this.#targetSampleForClip(sample, clip.clipId), target => {
                    const startAltitude = finiteNumber(clip?.params?.altitude ?? clipCamera.altitude) ?? clipHeight
                    const endAltitude = this.#cameraAltitudeForSample(target, replayCamera)
                    plan.initialView = {
                        ...baseStartView,
                        sample: target,
                        heading: replayHeading,
                        pitch:   clipPitch,
                        height:  Math.max(startAltitude, endAltitude),
                        cameraSettings: clipCamera,
                    }
                    plan.startView = plan.initialView
                    plan.endView = {
                        ...baseStartView,
                        sample: target,
                        heading: replayHeading,
                        pitch:   degreesToRadians(replayCamera.pitch) ?? baseView.pitch,
                        height:  Math.min(startAltitude, endAltitude),
                        cameraSettings: replayCamera,
                    }
                    return plan
                })
            }
            case 'take-off':
            case 'launch': {
                return withTarget(this.#targetSampleForClip(sample, clip.clipId), target => {
                    plan.setupDestination = safeCartesianFromLonLat({
                        longitude: target.longitude,
                        latitude:  target.latitude,
                        altitude:  finiteNumber(clipCamera.altitude) ?? 300,
                    })
                    plan.startView = {
                        ...baseStartView,
                        sample: target,
                        heading: currentCamera.heading,
                        pitch:   currentCamera.pitch,
                        height:  clipHeight,
                        cameraSettings: clipCamera,
                    }
                    plan.endView = {
                        ...baseStartView,
                        sample: target,
                        heading: replayHeading,
                        pitch:   clipPitch,
                        height:  clipHeight,
                        cameraSettings: clipCamera,
                    }
                    return plan
                })
            }
            case 'landing': {
                return withTarget(this.#targetSampleForClip(sample, clip.clipId), target => {
                    const landingTarget = target ?? {
                        ...sample,
                        altitude: this.#markerRenderHeightForSample(sample),
                    }
                    plan.stopRotate = true
                    plan.instant = true
                    plan.startView = {
                        ...baseStartView,
                        sample: landingTarget,
                        heading: currentCamera.heading,
                        pitch:   currentCamera.pitch,
                        height:  this.#markerRenderHeightForSample(landingTarget),
                        cameraSettings: clipCamera,
                    }
                    plan.endView = {...plan.startView}
                    return plan
                })
            }
            case 'zoom-out': {
                return withTarget(this.#targetSampleForClip(sample, clip.clipId), target => {
                    plan.startView = {
                        ...baseStartView,
                        heading: currentCamera.heading,
                        pitch:   currentCamera.pitch,
                        height:  currentCamera.height ?? baseStartView.height,
                    }
                    plan.endView = {
                        ...baseStartView,
                        sample: target,
                        heading: replayHeading,
                        pitch:   clipPitch,
                        height:  clipHeight,
                        cameraSettings: clipCamera,
                    }
                    return plan
                })
            }
            case 'focus': {
                return withTarget(this.#focusTargetSampleForReplayExport(baseView.sample), target => {
                    plan.kind = 'focus'
                    plan.focusTarget = target
                    plan.rpm = Number.isFinite(Number(clip?.params?.rpm)) ? Number(clip.params.rpm) : 0
                    plan.endView = {
                        ...baseStartView,
                        sample: target,
                        heading: baseView.heading,
                        pitch:   clipPitch,
                        height:  clipHeight,
                        cameraSettings: clipCamera,
                    }
                    return plan
                })
            }
            default:
                return null
        }
    }

    #sampleJourneyReplayClipCameraPlan = (plan = null, {localProgress = 0, localMillis = 0} = {}) => {
        if (!plan) {
            return null
        }

        const ratio = plan.instant === true
                      ? 1
                      : smoothClipProgress(localProgress)
        const viewSample = this.#interpolateReplayExportSample(plan.startView?.sample, plan.endView?.sample, ratio)
        const elapsedSeconds = Math.max(0, Number(localMillis) || 0) / 1000
        const heading = plan.kind === 'focus'
                        ? (finiteNumber(plan.endView?.heading) ?? 0) + (((finiteNumber(plan.rpm) ?? 0) / 60) * Math.PI * 2 * elapsedSeconds)
                        : interpolateRadians(plan.startView?.heading, plan.endView?.heading, ratio)
        return {
            sample: viewSample,
            heading,
            pitch: lerp(plan.startView?.pitch, plan.endView?.pitch, ratio),
            height: lerp(plan.startView?.height, plan.endView?.height, ratio),
            cameraSettings: plan.endView?.cameraSettings,
        }
    }

    #applyJourneyReplayClipCameraPlan = async (plan = null, {token = this.#clipSequenceToken} = {}) => {
        if (!plan) {
            return
        }

        if (plan.kind === 'focus') {
            const journey = globalThis.lgs?.theJourney
            this.#setContinuousRender(true)
            this.#hideJourneyToolbarVisibility()
            const focusResult = typeof journey?.focus === 'function'
                                ? journey.focus({
                                    resetCamera: true,
                                    rotate:      true,
                                    rpm:         plan.rpm === 0 ? undefined : plan.rpm,
                                    snapDistance: 25000,
                                })
                                : globalThis.__?.ui?.sceneManager?.focusOnJourney?.({
                                    journey,
                                    target:      journey,
                                    resetCamera: true,
                                    rotate:      true,
                                    rpm:         plan.rpm === 0 ? undefined : plan.rpm,
                                    snapDistance: 25000,
                                })
            this.#applyJourneyReplayPOIVisibility()
            await Promise.resolve(focusResult)
            await this.#runClipDelay(plan.duration)
            return
        }

        if (plan.setupDestination) {
            globalThis.lgs?.viewer?.camera?.setView?.({
                destination: plan.setupDestination,
            })
        }

        if (plan.initialView) {
            this.#recenterCameraToSample({
                sample:         plan.initialView.sample,
                heading:        plan.initialView.heading,
                pitch:          plan.initialView.pitch,
                cameraSettings: plan.initialView.cameraSettings,
                cameraHeight:   plan.initialView.height,
                instant:        true,
            })
        }

        if (token !== this.#clipSequenceToken) {
            return
        }

        if (plan.stopRotate) {
            await globalThis.__?.ui?.cameraManager?.stopRotate?.()
        }

        await this.#recenterCameraToSample({
            sample:         plan.endView.sample,
            heading:        plan.endView.heading,
            pitch:          plan.endView.pitch,
            cameraSettings: plan.endView.cameraSettings,
            cameraHeight:   plan.endView.height,
            instant:        plan.instant,
            duration:       plan.duration,
        })
    }

    #renderReplayExportClipFrame = async ({
                                              phase = null,
                                              clip = null,
                                              slot = null,
                                              sample = null,
                                              localProgress = 0,
                                              localMillis = 0,
                                          } = {}) => {
        const viewer = globalThis.lgs?.viewer
        if (!viewer?.camera || !clip || !sample) {
            return null
        }

        const phaseKey = this.#replayExportClipPhaseKey({phase, slot, clip})
        if (!this.#replayExportClipFrameState || this.#replayExportClipFrameState.key !== phaseKey) {
            this.#replayExportClipFrameState = {
                key:     phaseKey,
                ...this.#currentReplayClipCameraState(),
            }
        }
        const plan = await this.#resolveJourneyReplayClipCameraPlan({
            phase,
            clip,
            slot,
            sample,
            startCamera: this.#replayExportClipFrameState,
        })
        const frameView = this.#sampleJourneyReplayClipCameraPlan(plan, {localProgress, localMillis})
        if (!frameView) {
            return null
        }
        this.#recenterCameraToSample({
            sample:         frameView.sample,
            heading:        frameView.heading,
            pitch:          frameView.pitch,
            cameraSettings: frameView.cameraSettings,
            cameraHeight:   frameView.height,
            instant:        true,
            duration:       0,
            deterministic:  true,
            logicalNow:     finiteNumber(localMillis) ?? 0,
        })

        return frameView.sample
    }

    #clipSettings = () => normalizeJourneyReplayClips(globalThis.lgs?.stores?.replay?.clips ?? getJourneyReplaySettings()?.clips ?? {})

    #clipListForSlot = (slot) => {
        const clips = this.#clipSettings()
        return slot === REPLAY_CLIP_SLOT_STOP ? clips.stop : clips.start
    }

    #placeCameraAtPlaybackStart = (sample, progress = 0) => {
        if (!sample) {
            return false
        }

        const settings = getJourneyReplaySettings()
        const cameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? settings.camera)
        const markerSettings = normalizeJourneyReplayMarker({
            ...(globalThis.lgs?.stores?.replay?.marker ?? settings.marker),
            position: null,
        })
        const view = this.#cameraViewForSample({
            sample,
            progress,
            source: 'drawer',
            cameraSettings,
            markerSettings,
            previousHeading: null,
            previousPitch:   null,
        })
        if (!view) {
            return false
        }

        this.#recenterCameraToSample({
            sample:         view.sample,
            heading:        view.heading,
            pitch:          view.pitch,
            cameraSettings,
            cameraHeight:   view.cameraHeight,
            instant:        true,
            duration:       0,
        })
        this.#lastCameraHeading = view.heading
        this.#lastCameraPitch = view.pitch
        this.#rememberNominalCameraView(view)
        return true
    }

    #runClipDelay = (durationSeconds = 0) => new Promise(resolve => {
        const duration = Math.max(0, Number(durationSeconds) || 0)
        if (duration === 0) {
            resolve()
            return
        }
        setTimeout(resolve, duration * 1000)
    })

    #cameraSettingsForClip = (clip = {}) => {
        const current = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        const params = clip?.params ?? {}
        return normalizeJourneyReplayCamera({
            ...current,
            altitude: params.altitude ?? current.altitude,
            pitch:    params.pitch ?? current.pitch,
            hysteresis: {
                ...(current.hysteresis ?? {}),
            },
        })
    }

    #introHeadingForProgress = (progress = 0) => {
        const cameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        if (cameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            return degreesToRadians(cameraSettings.heading) ?? finiteNumber(globalThis.lgs?.viewer?.camera?.heading) ?? 0
        }

        return replayCameraHeadingForPositionMode({
            axisHeading: this.#headingFromPositionProperty(progress),
            positionMode: cameraSettings.positionMode,
            headingOffset: cameraSettings.headingOffset,
        })
    }

    #clipReplayHeadingForProgress = ({progress = 0, cameraSettings = null, fallbackHeading = 0} = {}) => {
        const settings = normalizeJourneyReplayCamera(cameraSettings ?? globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        if (settings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            return degreesToRadians(settings.heading) ?? finiteNumber(fallbackHeading) ?? 0
        }

        return replayCameraHeadingForPositionMode({
            axisHeading: this.#headingFromPositionProperty(progress),
            positionMode: settings.positionMode,
            headingOffset: settings.headingOffset,
        })
    }

    #targetSampleForClip = (sample, clipId) => replayTargetSampleForClip({
        sample,
        clipId,
        journey:               globalThis.lgs?.theJourney ?? null,
        sceneManager:          globalThis.__?.ui?.sceneManager ?? null,
        markerHeightForSample: this.#markerRenderHeightForSample,
    })

    #cameraClipFlight = async ({sample, clip, token}) => {
        if (!globalThis.lgs?.viewer?.camera || !sample) {
            return
        }

        const plan = await this.#resolveJourneyReplayClipCameraPlan({
            clip,
            sample,
        })
        await this.#applyJourneyReplayClipCameraPlan(plan, {token})
    }

    #runJourneyReplayClip = async (clip, {sample, token} = {}) => {
        if (!clip || token !== this.#clipSequenceToken) {
            return
        }

        switch (clip.clipId) {
            case 'take-off':
            case 'launch':
            case 'zoom-in':
            case 'zoom-out':
            case 'landing':
            case 'focus':
                await this.#cameraClipFlight({sample, clip, token})
                return
            default:
                return
        }
    }

    #playJourneyReplayClips = async (slot, {sample = null, token = this.#clipSequenceToken} = {}) => {
        const clips = this.#clipListForSlot(slot)
        for (const clip of clips) {
            if (token !== this.#clipSequenceToken) {
                return false
            }
            await this.#runJourneyReplayClip(clip, {sample, token})
        }
        return token === this.#clipSequenceToken
    }

    #cancelActiveCameraFlight = () => {
        const camera = globalThis.lgs?.viewer?.camera
        camera?.cancelFlight?.()
        this.#cancelCameraBezierTransition(false)
        this.#cameraFlightActive = false
    }

    /**
     * Recenter the current journey after the replay ends or is stopped.
     * The optional snapDistance keeps the transition instantaneous when the camera is already close.
     */
    #focusJourneyAfterPlayback = ({snapDistance = 50000} = {}) => {
        const journey = globalThis.lgs?.theJourney
        if (!journey) {
            return Promise.resolve()
        }

        journey.visible = true
        journey.updateVisibility?.(true)
        if (globalThis.lgs?.viewer?.dataSources) {
            TrackUtils.updatePOIsVisibility(journey, true)
        }
        this.#cameraFlightActive = false
        globalThis.lgs?.viewer?.camera?.cancelFlight?.()
        return new Promise(resolve => {
            let settled = false
        const finish = () => {
                if (settled) {
                    return
                }
                settled = true
                this.#hideGloballyHiddenPOIs()
                this.#restoreCurrentJourneyVisibility()
                resolve()
            }

            if (typeof journey.focus === 'function') {
                const focusResult = journey.focus({
                    resetCamera: true,
                    rotate:       false,
                    snapDistance,
                    callback:     finish,
                })
                if (focusResult !== undefined) {
                    void Promise.resolve(focusResult).finally(finish)
                }
                return
            }

            const focusResult = globalThis.__?.ui?.sceneManager?.focusOnJourney?.({
                journey,
                target:      journey,
                resetCamera: true,
                rotate:      false,
                snapDistance,
                callback:    finish,
            })
            if (focusResult !== undefined) {
                void Promise.resolve(focusResult).finally(finish)
                return
            }
            finish()
        })
    }

    dispose = () => {
        this.stop({emit: false})
        if (this.#profileHoverTimeout !== null) {
            clearTimeout(this.#profileHoverTimeout)
            this.#profileHoverTimeout = null
        }
        this.#unbind.forEach(unbind => unbind())
        this.#unbind = []
    }

    #resetCameraController = ({preserveSavedCameraState = false} = {}) => {
        this.#stopCameraLiveSyncLoop()
        this.#cameraGuide = null
        this.#cameraGuideSourceKey = null
        this.#cameraGuidePositionProperty = null
        this.#cameraGuidePositionPropertyKey = null
        this.#cameraMode = null
        this.#cameraFlightActive = false
        this.#cancelCameraBezierTransition(false)
        this.#lastToleranceRecenterAt = null
        this.#lastToleranceRecenterProgress = null
        this.#lastNavigationRecenterAt = null
        this.#lastNavigationRecenterProgress = null
        this.#skipNextImmediateStartRecenter = false
        this.#lastPlaybackUpdateProgressKey = null
        if (!preserveSavedCameraState) {
            this.#savedCameraState = null
            this.#playbackStartCameraSettings = null
        }
        this.#lastCameraHeading = null
        this.#lastCameraPitch = null
        this.#lastNominalCameraHeading = null
        this.#lastNominalCameraPitch = null
        this.#lastAppliedCameraView = null
        this.#cameraRedirectState = null
        this.#cameraUserAdjusting = false
        this.#cameraApplyingView = false
        this.#cameraPointerActive = false
        this.#cameraAutoTrackingIgnoreUntil = 0
        this.#journeyToolbarHidden = false
        this.#journeyToolbarWasVisible = null
        this.#introHeadingTransition = null
        this.#removeToleranceZoneOverlay()
        this.#hideCameraAnglePreviewOverlay()
        if (this.#cameraManualInteractionTimer !== null) {
            clearTimeout(this.#cameraManualInteractionTimer)
            this.#cameraManualInteractionTimer = null
        }
        if (globalThis.lgs?.viewer) {
            globalThis.lgs.viewer.trackedEntity = undefined
            globalThis.lgs.viewer.camera?.cancelFlight?.()
        }
    }

    #captureCameraState = ({sample = null} = {}) => {
        const camera = globalThis.lgs?.viewer?.camera
        const position = camera?.positionCartographic
        const sampleHeight = finiteNumber(sample?.altitude ?? sample?.height)
        if (!camera && sampleHeight === null) {
            this.#savedCameraState = null
            return null
        }

        this.#savedCameraState = {
            destination: {
                longitude: finiteNumber(position?.longitude) !== null ? CesiumMath.toDegrees(position.longitude) : finiteNumber(sample?.longitude) ?? 0,
                latitude:  finiteNumber(position?.latitude) !== null ? CesiumMath.toDegrees(position.latitude) : finiteNumber(sample?.latitude) ?? 0,
                height:    finiteNumber(position?.height) ?? sampleHeight ?? 0,
            },
            orientation: {
                heading: finiteNumber(camera?.heading) ?? this.#lastCameraHeading ?? 0,
                pitch:   finiteNumber(camera?.pitch) ?? this.#lastCameraPitch ?? SAFE_TOP_DOWN_PITCH,
                roll:    finiteNumber(camera?.roll) ?? 0,
            },
            altitude: finiteNumber(position?.height) ?? sampleHeight ?? 0,
        }
        return this.#savedCameraState
    }

    #capturePlaybackCameraSettings = () => {
        this.#playbackStartCameraSettings = normalizeJourneyReplayCamera(
            globalThis.lgs?.stores?.replay?.camera
            ?? getJourneyReplaySettings().camera,
        )
        if (globalThis.lgs?.stores?.replay) {
            globalThis.lgs.stores.replay.cameraUserAdjusted = false
        }
    }

    #captureJourneyReplayDrawerStateBeforePlayback = () => {
        const drawerManager = globalThis.__?.ui?.drawerManager ?? null
        this.#replayDrawerWasOpenBeforePlayback = drawerManager?.isCurrent?.(REPLAY_DRAWER) === true
                                                || globalThis.lgs?.stores?.ui?.drawers?.open === REPLAY_DRAWER
        if (this.#replayDrawerWasOpenBeforePlayback) {
            drawerManager?.close?.()
        }
    }

    #markPlaybackCameraUserAdjusted = () => {
        if (globalThis.lgs?.stores?.replay) {
            globalThis.lgs.stores.replay.cameraUserAdjusted = true
        }
    }

    #restorePlaybackCameraSettings = ({force = false} = {}) => {
        const store = replayStore()
        const initialCamera = this.#playbackStartCameraSettings
        const cameraUserAdjusted = store?.cameraUserAdjusted === true
        this.#playbackStartCameraSettings = null

        if (store) {
            store.cameraUserAdjusted = false
        }

        if (!initialCamera) {
            return null
        }

        if (initialCamera.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET) {
            return this.#persistCameraSettings(initialCamera)
        }

        if (force) {
            return this.#persistCameraSettings(initialCamera)
        }

        if (!cameraUserAdjusted) {
            return this.#persistCameraSettings(initialCamera)
        }

        return null
    }

    #restoreJourneyReplayDrawerAfterPlayback = () => {
        if (!this.#replayDrawerWasOpenBeforePlayback) {
            return
        }

        this.#replayDrawerWasOpenBeforePlayback = false
        globalThis.__?.ui?.drawerManager?.open?.(REPLAY_DRAWER)
    }

    #restorePlaybackScene = () => {
        this.#sceneRestoreDeferred = false
        this.#restoreOtherJourneysVisibility()
        this.#restoreCurrentJourneyVisibility({restorePOIs: false})
        this.#setJourneyReplayOrbitAllowed(true)
        this.#deferStartCameraRecenter = false
        this.#restoreJourneyToolbarVisibility()
        this.#restoreJourneyReplayDrawerAfterPlayback()
        this.#restoreMainUI()
        void this.#restoreNearbyPOIsAfterPlayback()
        resetRuntimeProgress(replayStore())
        this.#restoreCurrentJourneyVisibility()
        this.#resetCameraController({preserveSavedCameraState: true})
        this.#suppressPlaybackCameraSync = true
        void this.#focusJourneyAfterPlayback({
            snapDistance: 50000,
        }).finally(() => {
            this.#deferPlaybackCameraRestore = false
            this.#restorePlaybackCameraSettings({force: true})
        })
    }

    #restoreCameraState = () => {
        const camera = globalThis.lgs?.viewer?.camera
        const state = this.#savedCameraState
        this.#savedCameraState = null
        if (!camera || !state) {
            return
        }

        camera.cancelFlight?.()
        CameraUtils.unlock(camera)
        camera.setView?.({
            destination: Cartesian3.fromDegrees(
                state.destination.longitude,
                state.destination.latitude,
                finiteNumber(state.destination.height) ?? finiteNumber(state.altitude) ?? 0,
            ),
            orientation: state.orientation,
        })
    }

    #setContinuousRender = (enabled) => {
        const scene = this.#cesiumScene()
        if (!scene) {
            return
        }

        if (enabled) {
            if (this.#requestRenderMode === null) {
                this.#requestRenderMode = scene.requestRenderMode
            }
            scene.requestRenderMode = false
            scene.requestRender?.()
            return
        }

        if (this.#requestRenderMode !== null) {
            scene.requestRenderMode = this.#requestRenderMode
            this.#requestRenderMode = null
        }
        scene.requestRender?.()
    }

    #abortPlaybackAfterListenerError = (error) => {
        console.error('[JourneyReplayMode] Playback listener failed. JourneyReplay stopped.', error)
        this.#clipSequenceToken++
        this.#stopStopClipPOIMaskLoop()
        this.#controller.stop({emit: false, clearProgress: false})
        this.#setContinuousRender(false)
        this.#renderer.clear()
        this.#restoreOtherJourneysVisibility()
        this.#restoreCurrentJourneyVisibility({restorePOIs: false})
        this.#setJourneyReplayOrbitAllowed(true)
        this.#deferStartCameraRecenter = false
        this.#resetCameraController({preserveSavedCameraState: true})
        this.#restoreJourneyToolbarVisibility()
        this.#restoreMainUI()
        this.#restorePlaybackCameraSettings({force: true})
        resetRuntimeProgress(replayStore())
        this.#restoreCurrentJourneyVisibility()
        this.#restoreCameraState()
    }

    #scheduleProfileHoverMarker = (sample) => {
        this.#pendingProfileHoverSample = sample
        const now = performance.now()
        const elapsed = now - this.#lastProfileHoverRender

        if (elapsed >= PROFILE_HOVER_RENDER_INTERVAL) {
            this.#renderProfileHoverMarker()
            return
        }

        if (this.#profileHoverTimeout === null) {
            this.#profileHoverTimeout = setTimeout(
                this.#renderProfileHoverMarker,
                PROFILE_HOVER_RENDER_INTERVAL - elapsed,
            )
        }
    }

    #renderProfileHoverMarker = () => {
        this.#profileHoverTimeout = null
        this.#lastProfileHoverRender = performance.now()

        const sample = this.#pendingProfileHoverSample
        this.#pendingProfileHoverSample = null
        if (!sample) {
            return
        }

        globalThis.__?.ui?.profiler?.showSampleOnMap?.(sample)
    }

    /**
     * Hide the Journey Toolbar while a replay is running, and remember its previous visibility
     * so it can be restored when the replay ends.
     */
    #hideJourneyToolbarVisibility = () => {
        const toolbar = globalThis.lgs?.settings?.ui?.journeyToolbar
        if (toolbar && this.#journeyToolbarWasVisible === null) {
            this.#journeyToolbarWasVisible = toolbar.show === true
        }

        this.#journeyToolbarHidden = true
        globalThis.window?.dispatchEvent?.(new CustomEvent(REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT, {
            detail: {hidden: true},
        }))
    }

    /**
     * Restore the Journey Toolbar visibility to its pre-replay state.
     */
    #restoreJourneyToolbarVisibility = () => {
        this.#journeyToolbarHidden = false
        this.#journeyToolbarWasVisible = null
        globalThis.window?.dispatchEvent?.(new CustomEvent(REPLAY_JOURNEY_TOOLBAR_VISIBILITY_EVENT, {
            detail: {hidden: false},
        }))
    }

    #hideMainUI = () => {
        const store = replayStore()
        if (store) {
            store.mainUiHidden = true
        }
    }

    #restoreMainUI = () => {
        const store = replayStore()
        if (store) {
            store.mainUiHidden = false
        }
    }

    restoreJourneyToolbarVisibility = () => {
        this.#restoreJourneyToolbarVisibility()
    }

    isJourneyToolbarTemporarilyHidden = () => this.#journeyToolbarHidden === true

    #headingBetweenPoints = (start, end) => {
        if (!hasFiniteLonLat(start) || !hasFiniteLonLat(end)) {
            return 0
        }

        if (start.longitude === end.longitude && start.latitude === end.latitude) {
            return 0
        }

        const longitude1 = degreesToRadians(start.longitude)
        const longitude2 = degreesToRadians(end.longitude)
        const latitude1 = degreesToRadians(start.latitude)
        const latitude2 = degreesToRadians(end.latitude)
        if (longitude1 === null || longitude2 === null || latitude1 === null || latitude2 === null) {
            return 0
        }

        const y = Math.sin(longitude2 - longitude1) * Math.cos(latitude2)
        const x = Math.cos(latitude1) * Math.sin(latitude2)
            - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitude2 - longitude1)
        return Math.atan2(y, x)
    }

    #headingFromWindowPoints = points => {
        if (!Array.isArray(points) || points.length < 2) {
            return 0
        }

        const origin = points[Math.floor(points.length / 2)]
        const localPoints = points
            .map(point => projectToLocalMeters(origin, point))
            .filter(Boolean)

        if (localPoints.length < 2) {
            return 0
        }

        let sumX = 0
        let sumY = 0
        localPoints.forEach(point => {
            sumX += point.x
            sumY += point.y
        })
        const meanX = sumX / localPoints.length
        const meanY = sumY / localPoints.length

        let covXX = 0
        let covXY = 0
        let covYY = 0
        localPoints.forEach(point => {
            const dx = point.x - meanX
            const dy = point.y - meanY
            covXX += dx * dx
            covXY += dx * dy
            covYY += dy * dy
        })

        const angle = 0.5 * Math.atan2(2 * covXY, covXX - covYY)
        return Number.isFinite(angle) ? replayHeadingFromLocalAxisAngle(angle) : 0
    }

    #orientedHeadingFromWindowPoints = (points, current, future) => {
        const axisHeading = this.#headingFromWindowPoints(points)
        if (!Number.isFinite(axisHeading)) {
            return 0
        }

        const tangentHeading = this.#headingBetweenPoints(current, future)
        const delta = replayAngularDelta(axisHeading, tangentHeading)
        if (delta === null) {
            return axisHeading
        }

        return Math.abs(delta) > (Math.PI / 2) ? axisHeading + Math.PI : axisHeading
    }

    #cameraGuideKey = () => {
        const journeySlug = this.#sampler?.journey?.slug ?? 'journey'
        const points = this.#sampler?.samples?.length ?? 0
        const distance = this.#sampler?.totalDistance ?? 0
        return `${journeySlug}:${points}:${distance}`
    }

    #turnAngleAt = (points, index) => {
        if (index <= 0 || index >= points.length - 1) {
            return 0
        }

        const previous = points[index - 1]
        const current = points[index]
        const next = points[index + 1]
        if (!previous || !current || !next) {
            return 0
        }

        const incoming = Cartesian3.subtract(current, previous, new Cartesian3())
        const outgoing = Cartesian3.subtract(next, current, new Cartesian3())
        const incomingLength = Cartesian3.magnitude(incoming)
        const outgoingLength = Cartesian3.magnitude(outgoing)

        if (incomingLength <= CARTESIAN_EPSILON || outgoingLength <= CARTESIAN_EPSILON) {
            return 0
        }

        return Cartesian3.angleBetween(incoming, outgoing)
    }

    #cameraGuideProgresses = ({times, points}) => {
        if (times.length < 2 || points.length < 2) {
            return [0]
        }

        const progresses = [0]

        for (let index = 0; index < points.length - 1; index += 1) {
            const start = points[index]
            const end = points[index + 1]
            const startTime = times[index]
            const endTime = times[index + 1]
            const segmentTime = Math.max(0, endTime - startTime)
            const segmentDistance = Cartesian3.distance(start, end)
            const baseSubdivisions = Math.max(1, Math.ceil(segmentDistance / CAMERA_GUIDE_TARGET_SPACING_METERS))
            const turnAngle = Math.max(
                this.#turnAngleAt(points, index),
                this.#turnAngleAt(points, index + 1),
            )
            const turnSubdivisions = Math.ceil(turnAngle / CAMERA_GUIDE_TURN_STEP_RADIANS)
            const timeSubdivisions = Math.ceil(segmentTime * 8)
            const subdivisions = clamp(
                Math.max(baseSubdivisions, turnSubdivisions + 1, timeSubdivisions),
                1,
                256,
            )

            for (let step = 1; step <= subdivisions; step += 1) {
                const ratio = step / subdivisions
                progresses.push(lerp(startTime, endTime, ratio))
            }
        }

        if (progresses[progresses.length - 1] !== 1) {
            progresses[progresses.length - 1] = 1
        }

        if (progresses.length <= CAMERA_GUIDE_MAX_STEPS + 1) {
            return progresses
        }

        const reduced = []
        for (let step = 0; step <= CAMERA_GUIDE_MAX_STEPS; step += 1) {
            const scaledIndex = (step / CAMERA_GUIDE_MAX_STEPS) * (progresses.length - 1)
            reduced.push(progresses[Math.round(scaledIndex)])
        }
        reduced[0] = 0
        reduced[reduced.length - 1] = 1
        return reduced
    }

    #buildCameraGuide = () => {
        const key = this.#cameraGuideKey()
        if (this.#cameraGuide && this.#cameraGuideSourceKey === key) {
            return this.#cameraGuide
        }

        const rawSamples = (this.#sampler?.samples ?? []).filter(hasFiniteLonLat)
        if (rawSamples.length < 3) {
            this.#cameraGuide = rawSamples.map(sample => ({
                progress: sample.progress,
                longitude: sample.longitude,
                latitude: sample.latitude,
                altitude: sample.altitude ?? sample.height ?? 0,
                distanceFromStart: finiteNumber(sample?.distanceFromStart) ?? 0,
            }))
            this.#cameraGuideSourceKey = key
            return this.#cameraGuide
        }

        const points = rawSamples.map(safeCartesianFromLonLat).filter(Boolean)
        if (points.length < 3) {
            this.#cameraGuide = rawSamples.map(sample => ({
                progress: sample.progress,
                longitude: sample.longitude,
                latitude: sample.latitude,
                altitude: sample.altitude ?? sample.height ?? 0,
            }))
            this.#cameraGuideSourceKey = key
            return this.#cameraGuide
        }
        const times = rawSamples.map((sample, index) => {
            if (index === 0) {
                return 0
            }

            const progress = finiteNumber(sample.progress)
            if (progress === null) {
                return index / (rawSamples.length - 1)
            }

            return clamp(progress, 0, 1)
        })
        const spline = new CatmullRomSpline({times, points})
        const guide = []
        const progresses = this.#cameraGuideProgresses({times, points})
        const minimumSteps = Math.max(
            CAMERA_GUIDE_MIN_STEPS,
            rawSamples.length * 8,
            Math.ceil((this.#sampler?.totalDistance ?? 0) / CAMERA_GUIDE_TARGET_SPACING_METERS),
        )
        const sampledProgresses = progresses.length >= minimumSteps
            ? progresses
            : Array.from({length: minimumSteps + 1}, (_, index) => index / minimumSteps)

        sampledProgresses.forEach(progress => {
            const cartographic = (() => {
                try {
                    return safeCartographicFromCartesian(spline.evaluate(progress))
                }
                catch {
                    return null
                }
            })()
            const fallbackPoint = cartographic
                                 ? null
                                 : cameraGuideSampleFromRawSamples({rawSamples, times, progress})
            const lonLat = cartographic
                ? cartographicToLonLat(cartographic)
                : fallbackPoint
                  ? {
                      longitude: fallbackPoint.longitude,
                      latitude:  fallbackPoint.latitude,
                      altitude:  fallbackPoint.altitude,
                  }
                  : null
            if (!lonLat) {
                return
            }

            guide.push({
                progress,
                ...lonLat,
                distanceFromStart: fallbackPoint?.distanceFromStart ?? (this.#sampler?.totalDistance ?? 0) * progress,
            })
        })

        this.#cameraGuide = guide
        this.#cameraGuideSourceKey = key
        return guide
    }

    #smoothedGuide = () => (this.#buildCameraGuide() ?? []).map(point => ({
        progress: point.progress,
        longitude: point.longitude,
        latitude: point.latitude,
        altitude: point.altitude ?? 0,
    }))

    #guideTimeForProgress = progress => JulianDate.addSeconds(
        JulianDate.fromIso8601('2026-01-01T00:00:00Z'),
        clamp(Number(progress) || 0, 0, 1) * 1000,
        new JulianDate(),
    )

    #cameraGuidePositionPropertyForGuide = () => {
        const key = this.#cameraGuideKey()
        if (this.#cameraGuidePositionProperty && this.#cameraGuidePositionPropertyKey === key) {
            return this.#cameraGuidePositionProperty
        }

        const guide = this.#buildCameraGuide()
        if (!guide?.length) {
            this.#cameraGuidePositionProperty = null
            this.#cameraGuidePositionPropertyKey = key
            return null
        }

        const property = new SampledPositionProperty()
        guide.forEach(point => {
            const position = safeCartesianFromLonLat(point)
            if (!position) {
                return
            }

            property.addSample(
                this.#guideTimeForProgress(point.progress),
                position,
            )
        })
        property.setInterpolationOptions({
            interpolationDegree: 1,
            interpolationAlgorithm: LinearApproximation,
        })
        property.forwardExtrapolationType = ExtrapolationType.HOLD
        property.backwardExtrapolationType = ExtrapolationType.HOLD

        this.#cameraGuidePositionProperty = property
        this.#cameraGuidePositionPropertyKey = key
        return property
    }

    #guideSampleFromPositionProperty = progress => {
        const property = this.#cameraGuidePositionPropertyForGuide()
        if (!property) {
            return null
        }

        const position = property.getValue(this.#guideTimeForProgress(progress))
        if (!position) {
            return null
        }

        const cartographic = safeCartographicFromCartesian(position)
        const lonLat = cartographicToLonLat(cartographic)
        if (!lonLat) {
            return null
        }

        return {
            progress: clamp(Number(progress) || 0, 0, 1),
            ...lonLat,
            distanceFromStart: (this.#sampler?.totalDistance ?? 0) * clamp(Number(progress) || 0, 0, 1),
        }
    }

    #headingFromPositionProperty = progress => {
        const safeProgress = clamp(Number(progress) || 0, 0, 1)
        const guide = this.#buildCameraGuide()
        if (!guide?.length) {
            return 0
        }

        const current = this.#guideSampleFromPositionProperty(safeProgress)
        if (!hasFiniteLonLat(current)) {
            return 0
        }

        const baseDistance = finiteNumber(current.distanceFromStart) ?? 0
        const lookDistance = Math.max(400, (this.#sampler?.totalDistance ?? 0) * CAMERA_HEADING_LOOKAHEAD_PROGRESS)
        const futureDistance = baseDistance + lookDistance
        const pastDistance = Math.max(0, baseDistance - lookDistance)
        const future = guide.find(point => (finiteNumber(point?.distanceFromStart) ?? 0) >= futureDistance) ?? guide[guide.length - 1]
        const windowPoints = guide.filter(point => {
            const distance = finiteNumber(point?.distanceFromStart) ?? 0
            return distance >= pastDistance && distance <= futureDistance
        })

        if (windowPoints.length < 2) {
            return hasFiniteLonLat(future) ? this.#headingBetweenPoints(current, future) : 0
        }

        const localHeading = this.#orientedHeadingFromWindowPoints(windowPoints, current, future)
        if (!Number.isFinite(localHeading)) {
            return hasFiniteLonLat(future) ? this.#headingBetweenPoints(current, future) : 0
        }

        return localHeading
    }

    #cameraAltitudeForSample = (sample, cameraSettings) => {
        const longitude = sample?.longitude
        const latitude = sample?.latitude
        if (finiteNumber(longitude) === null || finiteNumber(latitude) === null) {
            return cameraSettings.altitude
        }
        const terrainHeight = this.#terrainHeightForLonLat(longitude, latitude)
        const groundHeight = terrainHeight ?? (finiteNumber(sample?.altitude ?? sample?.height) ?? 0)

        if (cameraSettings.altitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET) {
            return groundHeight + cameraSettings.altitude
        }

        return cameraSettings.altitude
    }

    #cameraViewForSample = ({
                                sample,
                                progress = sample?.progress ?? 0,
                                source = null,
                                cameraSettings,
                                markerSettings,
                                previousHeading = this.#lastNominalCameraHeading ?? this.#lastCameraHeading,
                                previousPitch = this.#lastNominalCameraPitch ?? this.#lastCameraPitch,
                            } = {}) => {
        if (!sample || !cameraSettings || !markerSettings) {
            return null
        }

        const normalizedPitch = finiteNumber(cameraSettings?.pitch) ?? -65
        const pitch = source === 'drawer'
                      ? degreesToRadians(normalizedPitch)
                      : normalizedPitch <= -89
                        ? SAFE_TOP_DOWN_PITCH
                        : degreesToRadians(normalizedPitch)
        let desiredHeading
        if (cameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            if (Number.isFinite(cameraSettings?.heading)) {
                desiredHeading = degreesToRadians(cameraSettings.heading)
            }
            else {
                desiredHeading = finiteNumber(previousHeading)
                    ?? finiteNumber(globalThis.lgs?.viewer?.camera?.heading)
                    ?? 0
            }
        }
        else {
                desiredHeading = replayCameraHeadingForPositionMode({
                                                                        axisHeading:  this.#headingFromPositionProperty(progress),
                                                                        positionMode: cameraSettings.positionMode,
                                                                        headingOffset: cameraSettings.headingOffset,
                                                                    })
        }
        const heading = source === 'drawer'
                        ? desiredHeading
                        : replayCameraHeadingWithHysteresis({
                                                                    previousHeading,
                                                                    nextHeading: desiredHeading,
                                                                    threshold:   cameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM
                                                                                 ? CAMERA_HEADING_HYSTERESIS_RADIANS
                                                                                 : CAMERA_HEADING_MIN_CHANGE_RADIANS,
                                                                })
        const smoothHeading = source === 'drawer'
                              ? heading
                              : this.#smoothRadians(
                previousHeading,
                heading,
                this.#headingEasingFactor(cameraSettings, heading),
            )
        const smoothPitch = source === 'drawer'
                            ? pitch
                            : this.#smoothRadians(previousPitch, pitch, 0.08)
        const anchorSample = this.#markerPositionForSample(sample, markerSettings)
        return {
            sample:       anchorSample,
            progress:     clamp(Number(progress) || 0, 0, 1),
            heading:      smoothHeading,
            pitch:        smoothPitch,
            cameraSettings,
            markerSettings,
            cameraHeight: this.#cameraAltitudeForSample(anchorSample, cameraSettings),
        }
    }

    #rememberNominalCameraView = view => {
        this.#lastNominalCameraHeading = finiteNumber(view?.heading) ?? this.#lastNominalCameraHeading
        this.#lastNominalCameraPitch = finiteNumber(view?.pitch) ?? this.#lastNominalCameraPitch
    }

    #cameraRedirectPitchLimits = () => ({
        min: SAFE_TOP_DOWN_PITCH,
        max: degreesToRadians(-5) ?? -0.08726646259971647,
    })

    #cameraViewWithRedirectState = (view, redirectState = null) => {
        if (!view) {
            return null
        }
        if (!redirectState) {
            return view
        }

        const {min, max} = this.#cameraRedirectPitchLimits()
        return {
            ...view,
            heading: (finiteNumber(view.heading) ?? 0) + (finiteNumber(redirectState.headingOffset) ?? 0),
            pitch:   clamp(
                (finiteNumber(view.pitch) ?? SAFE_TOP_DOWN_PITCH) + (finiteNumber(redirectState.pitchOffset) ?? 0),
                min,
                max,
            ),
        }
    }

    #cameraLookaheadSample = (sample, {lookaheadSeconds = null} = {}) => {
        const currentDistance = finiteNumber(sample?.distanceFromStart)
        if (currentDistance === null || !this.#sampler?.atDistance) {
            return null
        }

        const durationMillis = finiteNumber(this.#sampler?.durationMillis)
        const totalDistance = finiteNumber(this.#sampler?.totalDistance) ?? 0
        const seconds = finiteNumber(lookaheadSeconds)
        const timedDistance = seconds !== null && durationMillis !== null && durationMillis > 0
                              ? totalDistance * (seconds / (durationMillis / 1000))
                              : null
        const lookaheadDistance = Math.max(
            timedDistance ?? 0,
            CAMERA_REDIRECT_LOOKAHEAD_DISTANCE_METERS,
            totalDistance * 0.01,
        )
        const next = this.#sampler.atDistance(currentDistance + lookaheadDistance)
        if (!next || Math.abs((finiteNumber(next?.distanceFromStart) ?? 0) - currentDistance) <= 0.0001) {
            return null
        }
        return next
    }

    #cameraLineOfSightVisibleForFrame = frame => {
        const originCartographic = safeCartographicFromCartesian(frame?.destination)
        const targetSample = frame?.sample
        const targetHeight = finiteNumber(frame?.targetHeight) ?? finiteNumber(targetSample?.altitude ?? targetSample?.height) ?? 0
        const origin = cartographicToLonLat(originCartographic)
        const targetLongitude = finiteNumber(targetSample?.longitude)
        const targetLatitude = finiteNumber(targetSample?.latitude)
        if (!origin || targetLongitude === null || targetLatitude === null) {
            return false
        }

        for (let index = 1; index <= CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS; index += 1) {
            const ratio = index / (CAMERA_REDIRECT_TERRAIN_LINE_SEGMENTS + 1)
            const longitude = lerp(origin.longitude, targetLongitude, ratio)
            const latitude = lerp(origin.latitude, targetLatitude, ratio)
            const lineHeight = lerp(origin.altitude, targetHeight, ratio)
            const terrainHeight = this.#terrainHeightForLonLat(longitude, latitude)
            if (
                terrainHeight !== null
                && terrainHeight + CAMERA_REDIRECT_TERRAIN_CLEARANCE_METERS >= lineHeight
            ) {
                return false
            }
        }

        return true
    }

    #cameraViewFrame = view => this.#cameraRecenterFrame({
                                                             sample:         view?.sample,
                                                             heading:        view?.heading,
                                                             pitch:          view?.pitch,
                                                             cameraSettings: view?.cameraSettings,
                                                             cameraHeight:   view?.cameraHeight,
                                                         })

    #cameraTraceVisibilityTargets = (anchorSample) => {
        if (!anchorSample) {
            return []
        }

        const targets = [{sample: anchorSample, required: true}]
        const currentDistance = finiteNumber(anchorSample?.distanceFromStart)
        if (currentDistance === null || !this.#sampler?.atDistance) {
            return targets
        }

        const pushTarget = (sample, {required = false} = {}) => {
            const longitude = finiteNumber(sample?.longitude)
            const latitude = finiteNumber(sample?.latitude)
            if (longitude === null || latitude === null) {
                return
            }
            if (targets.some(entry =>
                                 Math.abs((finiteNumber(entry.sample?.longitude) ?? Number.POSITIVE_INFINITY) - longitude) <= 1e-8
                                 && Math.abs((finiteNumber(entry.sample?.latitude) ?? Number.POSITIVE_INFINITY) - latitude) <= 1e-8,
            )) {
                return
            }
            targets.push({sample, required})
        }

        CAMERA_REDIRECT_TRACE_VISIBILITY_OFFSETS_METERS.forEach(offset => {
            const trailingSample = this.#sampler.atDistance(Math.max(0, currentDistance - offset))
            if (trailingSample) {
                pushTarget(trailingSample, {required: offset <= CAMERA_REDIRECT_REQUIRED_TRACE_OFFSET_METERS})
            }
        })

        return targets
    }

    #sampleFromVisibilityTarget = target => ({
        ...target.sample,
        longitude: target.sample?.longitude,
        latitude:  target.sample?.latitude,
        altitude:  finiteNumber(target.sample?.altitude ?? target.sample?.height) ?? 0,
        height:    finiteNumber(target.sample?.height ?? target.sample?.altitude) ?? 0,
    })

    #renderedTargetVisible = sample => {
        const scene = this.#cesiumScene()
        const camera = globalThis.lgs?.viewer?.camera ?? scene?.camera
        const target = this.#markerRenderCartesianForSample(sample)
        const windowPosition = this.#windowPositionForSample(sample)
        if (!scene || !camera || !target || !windowPosition) {
            return null
        }

        const rect = this.#viewportRectForCesiumSurface()
        if (!rect.width || !rect.height) {
            return null
        }
        if (
            windowPosition.x < 0
            || windowPosition.y < 0
            || windowPosition.x > rect.width
            || windowPosition.y > rect.height
        ) {
            return false
        }

        const canvasPosition = new Cartesian2(windowPosition.x, windowPosition.y)
        let pickedPosition = null
        if (scene.pickPositionSupported !== false && typeof scene.pickPosition === 'function') {
            try {
                pickedPosition = scene.pickPosition(canvasPosition)
            }
            catch {
                pickedPosition = null
            }
        }
        if (!pickedPosition) {
            const pickRay = camera.getPickRay?.(canvasPosition)
            pickedPosition = pickRay ? scene.globe?.pick?.(pickRay, scene) : null
        }
        const cameraPosition = camera.positionWC ?? camera.position
        if (!pickedPosition || !cameraPosition) {
            return null
        }

        const targetDistance = Cartesian3.distance(cameraPosition, target)
        const pickedDistance = Cartesian3.distance(cameraPosition, pickedPosition)
        return pickedDistance + CAMERA_REDIRECT_RENDERED_DEPTH_CLEARANCE_METERS >= targetDistance
    }

    #renderedTraceVisibleForSample = sample => {
        const targets = this.#cameraTraceVisibilityTargets(sample)
        if (!targets.length) {
            return null
        }

        let hasRenderedResult = false
        for (const target of targets) {
            const visible = this.#renderedTargetVisible(this.#sampleFromVisibilityTarget(target))
            if (visible === null) {
                continue
            }
            hasRenderedResult = true
            if (!visible) {
                return false
            }
        }

        if (!hasRenderedResult) {
            return null
        }
        return true
    }

    #cameraViewHasLineOfSight = (view, anchorSample = view?.sample) => {
        const frame = this.#cameraViewFrame(view)
        if (!frame) {
            return false
        }

        const targets = this.#cameraTraceVisibilityTargets(anchorSample)
        let hasVisibleTarget = false
        for (const target of targets) {
            const sample = this.#sampleFromVisibilityTarget(target)
            const visible = this.#cameraLineOfSightVisibleForFrame({
                                                                       ...frame,
                                                                       sample,
                                                                       targetHeight: this.#markerRenderHeightForSample(sample),
                                                                   })
            if (!visible) {
                return false
            }
            hasVisibleTarget = true
        }

        return hasVisibleTarget
    }

    #cameraViewVisibilityForSample = ({
                                          nominalView,
                                          redirectState = null,
                                          futureSample = null,
                                          source = null,
                                          cameraSettings,
                                          markerSettings,
                                      } = {}) => {
        const currentView = this.#cameraViewWithRedirectState(nominalView, redirectState)
        if (!this.#cameraViewHasLineOfSight(currentView)) {
            return false
        }

        if (!futureSample) {
            return true
        }

        const futureNominalView = this.#cameraViewForSample({
                                                                sample:          futureSample,
                                                                progress:        futureSample.progress ?? nominalView?.progress ?? 0,
                                                                source,
                                                                cameraSettings,
                                                                markerSettings,
                                                                previousHeading: nominalView?.heading,
                                                                previousPitch:   nominalView?.pitch,
                                                            })
        const futureView = this.#cameraViewWithRedirectState(futureNominalView, redirectState)
        return this.#cameraViewHasLineOfSight(futureView)
    }

    #cameraRedirectCandidateScore = candidate => {
        const headingOffset = Math.abs(finiteNumber(candidate?.headingOffset) ?? 0)
        const pitchOffset = Math.abs(finiteNumber(candidate?.pitchOffset) ?? 0)
        return (pitchOffset * 2) + headingOffset
    }

    #findCameraRedirectState = ({
                                    nominalView,
                                    futureSample = null,
                                    source = null,
                                    cameraSettings,
                                    markerSettings,
                                    reuseCurrentIfVisible = true,
                                } = {}) => {
        if (reuseCurrentIfVisible && this.#cameraRedirectState) {
            const currentVisible = this.#cameraViewVisibilityForSample({
                                                                           nominalView,
                                                                           redirectState: this.#cameraRedirectState,
                                                                           futureSample:  null,
                                                                           source,
                                                                           cameraSettings,
                                                                           markerSettings,
                                                                       })
            if (currentVisible) {
                return this.#cameraRedirectState
            }
        }

        const candidates = []
        const pushCandidate = candidate => {
            if (!candidate) {
                return
            }
            const headingOffset = finiteNumber(candidate.headingOffset) ?? 0
            const pitchOffset = finiteNumber(candidate.pitchOffset) ?? 0
            if (candidates.some(entry =>
                                    Math.abs((finiteNumber(entry.headingOffset) ?? 0) - headingOffset) <= 1e-8
                                    && Math.abs((finiteNumber(entry.pitchOffset) ?? 0) - pitchOffset) <= 1e-8,
            )) {
                return
            }
            candidates.push({headingOffset, pitchOffset})
        }

        pushCandidate(this.#cameraRedirectState)
        CAMERA_REDIRECT_CANDIDATES.forEach(candidate => {
            pushCandidate({
                              headingOffset: degreesToRadians(candidate.headingOffsetDeg) ?? 0,
                              pitchOffset:   degreesToRadians(candidate.pitchOffsetDeg) ?? 0,
                          })
        })

        let bestCandidate = null
        let bestScore = Number.POSITIVE_INFINITY
        for (const candidate of candidates) {
            const visible = this.#cameraViewVisibilityForSample({
                                                                    nominalView,
                                                                    redirectState: candidate,
                                                                    futureSample,
                                                                    source,
                                                                    cameraSettings,
                                                                    markerSettings,
                                                                })
            if (!visible) {
                continue
            }

            const score = this.#cameraRedirectCandidateScore(candidate)
            if (score < bestScore) {
                bestCandidate = candidate
                bestScore = score
            }
        }

        return bestCandidate
    }

    #applyCameraView = ({anchor, heading, pitch, cameraSettings}) => {
        const anchorHeight = finiteNumber(anchor?.altitude ?? anchor?.height) ?? 0
        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)
        if (this.#cameraViewIsStable({anchor, heading: safeHeading, pitch: safePitch})) {
            return
        }

        const cameraHeight = this.#cameraAltitudeForSample(anchor, cameraSettings)
        const target = safeCartesianFromLonLat({
            ...anchor,
            altitude: anchorHeight,
        })
        if (!target) {
            return
        }

        const viewer = globalThis.lgs?.viewer
        const camera = viewer?.camera
        const transform = Transforms.eastNorthUpToFixedFrame(target)
        const range = replayCameraRangeFromPitch(Math.max(1, cameraHeight - anchorHeight), safePitch)
        if (!camera) {
            return
        }

        this.#cameraAutoTrackingIgnoreUntil = this.#now() + 250
        this.#cameraApplyingView = true
        try {
            camera.lookAtTransform?.(Matrix4.IDENTITY)
            const east = Matrix4.getColumn(transform, 0, new Cartesian3())
            const north = Matrix4.getColumn(transform, 1, new Cartesian3())
            const up = Matrix4.getColumn(transform, 2, new Cartesian3())
            const forward = Cartesian3.normalize(
                Cartesian3.add(
                    Cartesian3.multiplyByScalar(east, Math.sin(safeHeading), new Cartesian3()),
                    Cartesian3.multiplyByScalar(north, Math.cos(safeHeading), new Cartesian3()),
                    new Cartesian3(),
                ),
                new Cartesian3(),
            )
            const horizontalDistance = range * Math.cos(safePitch)
            const verticalDistance = range * Math.sin(-safePitch)
            const destination = Cartesian3.add(
                Cartesian3.subtract(target, Cartesian3.multiplyByScalar(forward, horizontalDistance, new Cartesian3()), new Cartesian3()),
                Cartesian3.multiplyByScalar(up, verticalDistance, new Cartesian3()),
                new Cartesian3(),
            )
            const direction = Cartesian3.normalize(Cartesian3.subtract(target, destination, new Cartesian3()), new Cartesian3())
            const right = Cartesian3.normalize(Cartesian3.cross(direction, up, new Cartesian3()), new Cartesian3())
            const correctedUp = Cartesian3.normalize(Cartesian3.cross(right, direction, new Cartesian3()), new Cartesian3())
            camera.setView?.({
                                 destination,
                                 orientation: {
                                     direction,
                                     up: correctedUp,
                                 },
                             })
            this.#rememberCameraView({anchor, heading: safeHeading, pitch: safePitch})
        }
        finally {
            this.#cameraApplyingView = false
        }
    }

    #liveCameraPitch = fallback => {
        const cameraPitch = finiteNumber(globalThis.lgs?.viewer?.camera?.pitch)
        return cameraPitch ?? fallback
    }

    #markerPositionForSample = (sample, markerSettings) => {
        const override = markerSettings?.position
        if (!override) {
            return sample
        }

        return {
            ...sample,
            longitude: override.longitude,
            latitude:  override.latitude,
            altitude:  finiteNumber(override.altitude) ?? finiteNumber(sample?.altitude ?? sample?.height) ?? 0,
        }
    }

    #markerRenderHeightForSample = sample => {
        const longitude = finiteNumber(sample?.longitude)
        const latitude = finiteNumber(sample?.latitude)
        if (longitude === null || latitude === null) {
            return 0
        }

        const terrainHeight = this.#cesiumScene()?.globe?.getHeight?.(
            Cartographic.fromDegrees(longitude, latitude),
        )
        return finiteNumber(terrainHeight) ?? 0
    }

    #markerRenderCartesianForSample = sample => safeCartesianFromLonLat({
                                                                            ...sample,
                                                                            altitude: this.#markerRenderHeightForSample(sample),
                                                                        })

    #windowPositionForSample = sample => {
        const viewer = globalThis.lgs?.viewer
        const scene = this.#cesiumScene()
        const position = this.#markerRenderCartesianForSample(sample)
        if (!viewer || !scene || !position) {
            return null
        }

        let windowPosition = null
        try {
            windowPosition = typeof scene.worldToWindowCoordinates === 'function'
                             ? scene.worldToWindowCoordinates(position)
                             : SceneTransforms.worldToWindowCoordinates(scene, position)
            if (windowPosition) {
                return {
                    x: windowPosition.x,
                    y: windowPosition.y,
                }
            }
        }
        catch {
            // Some test fixtures and partially initialized scenes do not expose the full Cesium projection state.
            // In that case, fall back to the canvas-space projection below instead of failing the whole FT loop.
        }

        const canvasPosition = scene.cartesianToCanvasCoordinates?.(position, new Cartesian2())
        if (canvasPosition) {
            return {
                x: canvasPosition.x,
                y: canvasPosition.y,
            }
        }

        return windowPosition ?? canvasPosition ?? null
    }

    #cameraCollisionForSample = (sample, cameraSettings) => {
        const viewer = globalThis.lgs?.viewer
        const scene = this.#cesiumScene()
        const windowPosition = this.#windowPositionForSample(sample)
        if (!viewer || !scene || !windowPosition) {
            const outerBounds = replayToleranceZoneBounds(cameraSettings?.hysteresis?.zone)
            const safeBounds = replayInnerToleranceZoneBounds(
                outerBounds,
                finiteNumber(cameraSettings?.hysteresis?.marginRatio) ?? 0.12,
            )
            return {
                side:       null,
                outer:      outerBounds,
                inner:      safeBounds,
                screen:     null,
                error:      1,
                hard:       true,
                shouldMove: true,
            }
        }

        const rect = this.#viewportRectForCesiumSurface()
        const cropRect = this.#videoCropRect()
        const point = cropRect
            ? {
                x: windowPosition.x - cropRect.left,
                y: windowPosition.y - cropRect.top,
            }
            : windowPosition
        const markerRadius = finiteNumber(globalThis.lgs?.stores?.replay?.markerRadius) ?? 35
        const overlayBounds = replayToleranceZoneBounds(cameraSettings?.hysteresis?.zone)
        const safeBounds = replayInnerToleranceZoneBounds(
            overlayBounds,
            finiteNumber(cameraSettings?.hysteresis?.marginRatio) ?? 0.12,
        )
        return replayWindowCollisionFromPoint({
                                                      point:        point,
                                                      width:        rect.width,
                                                      height:       rect.height,
                                                      outerBounds:  overlayBounds,
                                                      safeBounds,
                                                      markerRadius,
                                                  })
    }

    #terrainHeightForLonLat = (longitude, latitude) => {
        if (finiteNumber(longitude) === null || finiteNumber(latitude) === null) {
            return null
        }

        const globe = this.#cesiumScene()?.globe
        const height = globe?.getHeight?.(Cartographic.fromDegrees(longitude, latitude))
        if (height === null || height === undefined || height === '') {
            return null
        }
        return finiteNumber(height)
    }

    #persistCameraSettings = updates => {
        const current = getJourneyReplaySettings().camera
        const next = normalizeJourneyReplayCamera({
            ...current,
            ...updates,
            hysteresis: {
                ...(current?.hysteresis ?? {}),
                ...(updates?.hysteresis ?? {}),
            },
        })

        if (globalThis.lgs?.settings?.ui?.replay) {
            globalThis.lgs.settings.ui.replay.camera = next
        }
        if (globalThis.lgs?.stores?.replay) {
            globalThis.lgs.stores.replay.camera = next
        }

        return next
    }

    #updateCameraSettingsFromCesiumControls = (sample, {altitudeMode = null} = {}) => {
        const camera = globalThis.lgs?.viewer?.camera
        if (!camera || !sample) {
            return null
        }

        const terrainHeight = this.#terrainHeightForLonLat(sample?.longitude, sample?.latitude)
        const cameraHeight = finiteNumber(camera.positionCartographic?.height)
        const currentCameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        const currentAltitude = currentCameraSettings.altitude
        const next = {
            pitch: clamp(Math.round(CesiumMath.toDegrees(camera.pitch)), -89, -5),
        }

        const headingDeg = Number.isFinite(camera.heading)
            ? clamp(Math.round(CesiumMath.toDegrees(camera.heading)), -180, 180)
            : undefined
        if (headingDeg !== undefined && currentCameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            next.heading = headingDeg
        }

        const nextAltitudeMode = altitudeMode ?? currentCameraSettings.altitudeMode
        if (nextAltitudeMode === REPLAY_CAMERA_ALTITUDE_GROUND_OFFSET) {
            next.altitude = terrainHeight === null
                            ? currentAltitude
                            : clamp(Math.max(10, (cameraHeight ?? (currentAltitude + terrainHeight)) - terrainHeight), 10, 100000)
        }
        else {
            next.altitude = clamp(cameraHeight ?? currentAltitude, 10, 100000)
        }

        return this.#persistCameraSettings(next)
    }

    #updateCameraFromCesiumControls = () => {
        const store = replayStore()
        if (this.#suppressPlaybackCameraSync) {
            return
        }
        if (store?.cameraUpdateSource === 'drawer') {
            return
        }
        this.#markPlaybackCameraUserAdjusted()
        this.syncCameraFromCesiumControls()
    }

    #syncCameraDrawerFromSettings = () => {
        const camera = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        if (globalThis.lgs?.settings?.ui?.replay) {
            globalThis.lgs.settings.ui.replay.camera = camera
        }
        if (globalThis.lgs?.stores?.replay) {
            globalThis.lgs.stores.replay.camera = camera
        }
    }

    #now = () => globalThis.performance?.now?.() ?? Date.now()

    #cesiumScene = () => globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene

    #smoothRadians = (previous, next, factor = 0.12) => {
        const prev = finiteNumber(previous)
        const nextValue = finiteNumber(next)
        if (nextValue === null) {
            return prev ?? 0
        }
        if (prev === null) {
            return nextValue
        }

        const delta = replayAngularDelta(prev, nextValue)
        if (delta === null) {
            return nextValue
        }

        return prev + delta * clamp(factor, 0, 1)
    }

    #cancelCameraBezierTransition = (resolveValue = false) => {
        const hadActiveTransition = this.#cameraBezierFrame !== null
            || this.#cameraBezierResolve !== null
            || this.#cameraFlightActive
        if (this.#cameraBezierFrame !== null) {
            globalThis.clearTimeout?.(this.#cameraBezierFrame)
            this.#cameraBezierFrame = null
        }
        if (hadActiveTransition) {
            globalThis.lgs?.viewer?.camera?.cancelFlight?.()
        }
        if (this.#cameraBezierResolve !== null) {
            const resolve = this.#cameraBezierResolve
            this.#cameraBezierResolve = null
            resolve(resolveValue)
        }
        this.#cameraApplyingView = false
        this.#cameraFlightActive = false
        this.#deterministicCameraTransition = null
    }

    #currentCameraFrame = fallbackFrame => {
        const camera = globalThis.lgs?.viewer?.camera
        const destination = camera?.positionWC ?? camera?.position ?? fallbackFrame?.destination
        const direction = camera?.directionWC ?? camera?.direction ?? fallbackFrame?.direction
        const up = camera?.upWC ?? camera?.up ?? fallbackFrame?.correctedUp
        if (!destination || !direction || !up) {
            return null
        }

        return {
            destination: Cartesian3.clone(destination, new Cartesian3()),
            direction:   Cartesian3.clone(direction, new Cartesian3()),
            up:          Cartesian3.clone(up, new Cartesian3()),
        }
    }

    #applyCameraFrame = frame => {
        const camera = globalThis.lgs?.viewer?.camera
        if (!camera || !frame?.destination || !frame?.direction || !frame?.up) {
            return false
        }

        this.#cameraApplyingView = true
        try {
            camera.setView?.({
                destination: frame.destination,
                orientation: {
                    direction: frame.direction,
                    up:        frame.up,
                },
            })
            return true
        }
        finally {
            this.#cameraApplyingView = false
        }
    }

    #interpolateCameraFrame = (start, end, ratio = 1) => {
        const t = smoothClipProgress(ratio)
        return {
            destination: Cartesian3.lerp(start.destination, end.destination, t, new Cartesian3()),
            direction:   Cartesian3.normalize(
                Cartesian3.lerp(start.direction, end.direction, t, new Cartesian3()),
                new Cartesian3(),
            ),
            up:          Cartesian3.normalize(
                Cartesian3.lerp(start.up, end.up, t, new Cartesian3()),
                new Cartesian3(),
            ),
        }
    }

    #startDeterministicCameraTransition = ({
                                               sample,
                                               heading,
                                               pitch,
                                               endFrame,
                                               duration = 0,
                                               logicalNow = 0,
                                           } = {}) => {
        const startFrame = this.#currentCameraFrame(endFrame)
        if (!startFrame || !endFrame) {
            return false
        }

        const durationMs = Math.max(0, Math.round((finiteNumber(duration) ?? 0) * 1000))
        const end = {
            destination: Cartesian3.clone(endFrame.destination, new Cartesian3()),
            direction:   Cartesian3.clone(endFrame.direction, new Cartesian3()),
            up:          Cartesian3.clone(endFrame.correctedUp, new Cartesian3()),
        }
        this.#deterministicCameraTransition = {
            startAt: finiteNumber(logicalNow) ?? 0,
            endAt:   (finiteNumber(logicalNow) ?? 0) + durationMs,
            start:   startFrame,
            end,
            sample,
            heading,
            pitch,
        }

        return this.#applyDeterministicCameraTransition(logicalNow)
    }

    #applyDeterministicCameraTransition = logicalNow => {
        const transition = this.#deterministicCameraTransition
        if (!transition) {
            return false
        }

        const now = finiteNumber(logicalNow) ?? transition.endAt
        const span = Math.max(1, transition.endAt - transition.startAt)
        const ratio = clamp((now - transition.startAt) / span, 0, 1)
        const applied = this.#applyCameraFrame(this.#interpolateCameraFrame(transition.start, transition.end, ratio))
        if (ratio >= 1) {
            this.#deterministicCameraTransition = null
            this.#lastCameraHeading = finiteNumber(transition.heading) ?? this.#lastCameraHeading
            this.#lastCameraPitch = finiteNumber(transition.pitch) ?? this.#lastCameraPitch
        }
        return applied
    }

    #cameraRecenterFrame = ({
                                sample,
                                heading,
                                pitch,
                                cameraSettings,
                                cameraHeight = null,
                            } = {}) => {
        const viewer = globalThis.lgs?.viewer
        const targetHeight = this.#markerRenderHeightForSample(sample)
        const target = this.#markerRenderCartesianForSample(sample)
        const cameraPosition = viewer?.camera?.positionWC ?? viewer?.camera?.position
        const fallbackRange = cameraPosition && target
                              ? Cartesian3.distance(cameraPosition, target)
                              : replayCameraRangeFromPitch(this.#cameraAltitudeForSample(sample, cameraSettings), pitch)
        if (!viewer || !target) {
            return null
        }

        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)
        const currentHeight = cameraHeight !== null && cameraHeight !== undefined
                              ? Math.max(targetHeight, finiteNumber(cameraHeight) ?? targetHeight)
                              : replayCameraRecenterHeight(
                viewer.camera?.positionCartographic?.height,
                this.#cameraAltitudeForSample(sample, cameraSettings),
            )
        const horizontalDistance = replayCameraRecenterHorizontalDistance({
                                                                                  cameraHeight: currentHeight,
                                                                                  targetHeight,
                                                                                  pitchRadians: safePitch,
                                                                                  fallbackRange,
                                                                              })
        const heightDelta = currentHeight - targetHeight
        const targetTransform = Transforms.eastNorthUpToFixedFrame(target)
        const east = Matrix4.getColumn(targetTransform, 0, new Cartesian3())
        const north = Matrix4.getColumn(targetTransform, 1, new Cartesian3())
        const up = Matrix4.getColumn(targetTransform, 2, new Cartesian3())
        const headingAxis = Cartesian3.add(
            Cartesian3.multiplyByScalar(east, Math.sin(safeHeading), new Cartesian3()),
            Cartesian3.multiplyByScalar(north, Math.cos(safeHeading), new Cartesian3()),
            new Cartesian3(),
        )
        const destination = Cartesian3.add(
            Cartesian3.add(
                target,
                Cartesian3.multiplyByScalar(headingAxis, -horizontalDistance, new Cartesian3()),
                new Cartesian3(),
            ),
            Cartesian3.multiplyByScalar(up, heightDelta, new Cartesian3()),
            new Cartesian3(),
        )
        const direction = Cartesian3.normalize(
            Cartesian3.subtract(target, destination, new Cartesian3()),
            new Cartesian3(),
        )
        const rightCandidate = Cartesian3.cross(direction, up, new Cartesian3())
        const right = Cartesian3.magnitudeSquared(rightCandidate) > CARTESIAN_EPSILON
                      ? Cartesian3.normalize(rightCandidate, rightCandidate)
                      : Cartesian3.clone(east, new Cartesian3())
        const correctedUp = Cartesian3.normalize(
            Cartesian3.cross(right, direction, new Cartesian3()),
            new Cartesian3(),
        )
        return {
            sample,
            target,
            targetHeight,
            destination,
            direction,
            correctedUp,
            currentHeight,
            safeHeading,
            safePitch,
        }
    }

    #cameraViewDelta = ({anchor, heading, pitch} = {}) => {
        const last = this.#lastAppliedCameraView
        if (!last) {
            return null
        }

        const currentLongitude = finiteNumber(anchor?.longitude)
        const currentLatitude = finiteNumber(anchor?.latitude)
        const currentAltitude = finiteNumber(anchor?.altitude ?? anchor?.height) ?? 0
        const lastLongitude = finiteNumber(last.anchor?.longitude)
        const lastLatitude = finiteNumber(last.anchor?.latitude)
        const lastAltitude = finiteNumber(last.anchor?.altitude ?? last.anchor?.height) ?? 0
        if ([currentLongitude, currentLatitude, lastLongitude, lastLatitude].some(value => value === null)) {
            return null
        }

        const anchorDelta = projectToLocalMeters(
            {longitude: lastLongitude, latitude: lastLatitude},
            {longitude: currentLongitude, latitude: currentLatitude},
        )

        return {
            horizontalMeters: Math.hypot(anchorDelta?.x ?? Number.POSITIVE_INFINITY, anchorDelta?.y ?? Number.POSITIVE_INFINITY),
            altitudeMeters:   Math.abs(currentAltitude - lastAltitude),
            headingRadians:   Math.abs(replayAngularDelta(last.heading, heading) ?? Number.POSITIVE_INFINITY),
            pitchRadians:     Math.abs(replayAngularDelta(last.pitch, pitch) ?? Number.POSITIVE_INFINITY),
        }
    }

    #cameraViewIsStable = ({anchor, heading, pitch} = {}) => {
        const delta = this.#cameraViewDelta({anchor, heading, pitch})
        if (!delta) {
            return false
        }

        return delta.horizontalMeters <= CAMERA_VIEW_POSITION_EPSILON_METERS
            && delta.altitudeMeters <= CAMERA_VIEW_POSITION_EPSILON_METERS
            && delta.headingRadians <= CAMERA_VIEW_ANGLE_EPSILON_RADIANS
            && delta.pitchRadians <= CAMERA_VIEW_ANGLE_EPSILON_RADIANS
    }

    #rememberCameraView = ({anchor, heading, pitch} = {}) => {
        this.#lastAppliedCameraView = {
            anchor: {
                longitude: finiteNumber(anchor?.longitude) ?? 0,
                latitude:  finiteNumber(anchor?.latitude) ?? 0,
                altitude:  finiteNumber(anchor?.altitude ?? anchor?.height) ?? 0,
            },
            heading: finiteNumber(heading) ?? 0,
            pitch:   finiteNumber(pitch) ?? SAFE_TOP_DOWN_PITCH,
        }
    }

    #headingEasingFactor = (cameraSettings, targetHeading) => replayHeadingEasingFactor({
        previousHeading: this.#lastCameraHeading,
        nextHeading:     targetHeading,
        easing:          cameraSettings?.hysteresis?.easing,
        minFactor:       0.04,
        maxFactor:       0.18,
    })

    #removeToleranceZoneOverlay = () => {
        this.#toleranceZoneOverlay?.remove?.()
        this.#toleranceZoneOverlay = null
    }

    #cameraAnglePreviewEntityCollection = () => globalThis.lgs?.viewer?.entities ?? null

    #removeCameraAnglePreviewOverlay = () => {
        const entities = this.#cameraAnglePreviewEntities
        const collection = this.#cameraAnglePreviewEntityCollection()
        if (entities && collection) {
            collection.remove?.(entities.axis)
            collection.remove?.(entities.axisEndIcon)
            collection.remove?.(entities.angle)
            collection.remove?.(entities.cameraIcon)
        }
        this.#cameraAnglePreviewEntities = null
    }

    #cameraAnglePreviewPOIIds = () => {
        const journey = this.#sampler?.journey ?? globalThis.lgs?.theJourney ?? null
        const tracks = Array.from(journey?.tracks?.values?.() ?? [])
        if (tracks.length === 0) {
            return []
        }

        const firstTrack = tracks[0]
        const lastTrack = tracks[tracks.length - 1]
        return Array.from(new Set([
            firstTrack?.flags?.start,
            lastTrack?.flags?.stop,
        ].filter(Boolean)))
    }

    #cameraAnglePreviewPOIForId = (poiId) => globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
        ?? globalThis.__?.ui?.poiManager?.get?.(poiId)
        ?? null

    #hideCameraAnglePreviewPOIs = () => {
        for (const poiId of this.#cameraAnglePreviewPOIIds()) {
            const poi = this.#cameraAnglePreviewPOIForId(poiId)
            if (!poi?.id) {
                continue
            }

            if (!this.#cameraAnglePreviewPOIVisibilityState.has(poi.id)) {
                this.#cameraAnglePreviewPOIVisibilityState.set(poi.id, {
                    visible: this.#isPOIVisibleBeforePlayback(poi),
                })
            }

            poi.visible = false
            this.#setPOIEntityVisibility(poi, false)
        }
    }

    #restoreCameraAnglePreviewPOIs = () => {
        for (const [poiId, state] of this.#cameraAnglePreviewPOIVisibilityState.entries()) {
            const poi = this.#cameraAnglePreviewPOIForId(poiId)
            if (!poi?.id) {
                continue
            }

            poi.visible = state?.visible === true
            this.#setPOIEntityVisibility(poi, state?.visible === true)
        }

        this.#cameraAnglePreviewPOIVisibilityState.clear()
    }

    #cameraAnglePreviewStartHeading = () => {
        const sampler = this.#sampler
        if (!sampler?.hasSamples) {
            return 0
        }

        const previewSamples = sampler?.samples?.slice?.(0, 6) ?? []
        if (previewSamples.length < 2) {
            return 0
        }

        const current = previewSamples[0]
        const future = previewSamples[previewSamples.length - 1]
        const heading = this.#headingBetweenPoints(current, future)
        return Number.isFinite(heading) ? heading : 0
    }

    #showCameraAnglePreviewOverlay = ({
                                          displayOffset = 0,
                                          positionMode = REPLAY_CAMERA_POSITION_SYSTEM,
                                          fillColor = null,
                                          borderColor = null,
                                      } = {}) => {
        this.#removeCameraAnglePreviewOverlay()
        const viewer = globalThis.lgs?.viewer
        const sampler = this.#sampler
        const entities = viewer?.entities ?? null
        if (!viewer || !entities || positionMode === REPLAY_CAMERA_POSITION_SYSTEM || !sampler?.hasSamples) {
            return
        }

        const sample = sampler.atProgress?.(0)
        const anchor = safeCartesianFromLonLat(sample)
        if (!anchor) {
            return
        }

        const traceHeading = this.#cameraAnglePreviewStartHeading()
        const baseHeading = positionMode === REPLAY_CAMERA_POSITION_AHEAD
                            ? traceHeading
                            : traceHeading + Math.PI
        const localTransform = Transforms.eastNorthUpToFixedFrame(anchor)
        const offsetDegrees = clamp(finiteNumber(displayOffset) ?? 0, REPLAY_CAMERA_HEADING_OFFSET_MIN, REPLAY_CAMERA_HEADING_OFFSET_MAX)
        const offsetRadians = CesiumMath.toRadians(offsetDegrees)
        const axisHeading = baseHeading
        const angleHeading = baseHeading + (finiteNumber(offsetRadians) ?? 0)
        const axisEnd = Matrix4.multiplyByPoint(localTransform, new Cartesian3(
            Math.sin(axisHeading) * CAMERA_ANGLE_PREVIEW_AXIS_LENGTH,
            Math.cos(axisHeading) * CAMERA_ANGLE_PREVIEW_AXIS_LENGTH,
            0,
        ), new Cartesian3())
        const angleEnd = Matrix4.multiplyByPoint(localTransform, new Cartesian3(
            Math.sin(angleHeading) * CAMERA_ANGLE_PREVIEW_OFFSET_LENGTH,
            Math.cos(angleHeading) * CAMERA_ANGLE_PREVIEW_OFFSET_LENGTH,
            0,
        ), new Cartesian3())
        const followTerrain = true
        const markerColorCss = globalThis.lgs?.theTrack?.marker?.foregroundColor
                               ?? globalThis.lgs?.theTrack?.marker?.color
                               ?? normalizeJourneyReplayProgressionStyle(
                                   globalThis.lgs?.stores?.replay?.progression ?? getJourneyReplaySettings()?.progression,
                               ).fill.color
                               ?? fillColor
                               ?? borderColor
                               ?? '#4f7cff'
        const markerColor = Color.fromCssColorString(markerColorCss) ?? Color.WHITE
        const axis = entities.add({
            id:       `replay-camera-angle-preview-axis-${this.#sampler?.journey?.slug ?? 'current'}`,
            name:     'JourneyReplay camera angle axis',
            polyline: {
                positions:     [anchor, axisEnd],
                width:         4,
                material:      markerColor,
                clampToGround: followTerrain,
                arcType:       followTerrain ? ArcType.GEODESIC : ArcType.NONE,
            },
            show: true,
        })
        const axisEndIcon = entities.add({
            id:       `replay-camera-angle-preview-axis-end-${this.#sampler?.journey?.slug ?? 'current'}`,
            name:     'JourneyReplay journey axis end',
            position: axisEnd,
            billboard: {
                image:            makeFontAwesomeIconDataUri(resolveJourneyActivityIcon(this.#sampler?.journey), markerColorCss, CAMERA_ANGLE_PREVIEW_ICON_SIZE),
                width:            CAMERA_ANGLE_PREVIEW_ICON_SIZE,
                height:           CAMERA_ANGLE_PREVIEW_ICON_SIZE,
                horizontalOrigin: HorizontalOrigin.CENTER,
                verticalOrigin:   VerticalOrigin.CENTER,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                heightReference:  followTerrain ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE,
                pixelOffset:      new Cartesian2(18, 0),
            },
            show: true,
        })
        const angle = entities.add({
            id:       `replay-camera-angle-preview-angle-${this.#sampler?.journey?.slug ?? 'current'}`,
            name:     'JourneyReplay camera angle offset',
            polyline: {
                positions:     [anchor, angleEnd],
                width:         1.5,
                material:      new PolylineDashMaterialProperty({
                    color:       markerColor,
                    gapColor:    Color.TRANSPARENT,
                    dashLength:  18,
                    dashPattern: 255,
                }),
                clampToGround: followTerrain,
                arcType:       followTerrain ? ArcType.GEODESIC : ArcType.NONE,
            },
            show: true,
        })
        const cameraIcon = Math.abs(offsetDegrees) > 0.0001
            ? entities.add({
                id:       `replay-camera-angle-preview-camera-${this.#sampler?.journey?.slug ?? 'current'}`,
                name:     'JourneyReplay camera angle camera',
                position: angleEnd,
                billboard: {
                    image:            makeFontAwesomeIconDataUri(faCamera, markerColorCss, CAMERA_ANGLE_PREVIEW_ICON_SIZE),
                    width:            CAMERA_ANGLE_PREVIEW_ICON_SIZE,
                    height:           CAMERA_ANGLE_PREVIEW_ICON_SIZE,
                    horizontalOrigin: HorizontalOrigin.CENTER,
                    verticalOrigin:   VerticalOrigin.CENTER,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    heightReference: followTerrain ? HeightReference.CLAMP_TO_GROUND : HeightReference.NONE,
                    pixelOffset:      new Cartesian2(18, 0),
                },
                show: true,
            })
            : null
        this.#cameraAnglePreviewEntities = {
            axis,
            axisEndIcon,
            angle,
            cameraIcon,
        }
        globalThis.lgs?.scene?.requestRender?.()
        this.#hideCameraAnglePreviewPOIs()
    }

    #hideCameraAnglePreviewOverlay = () => {
        this.#removeCameraAnglePreviewOverlay()
        this.#restoreCameraAnglePreviewPOIs()
    }

    #videoCropRect = () => {
        const replayStore = globalThis.lgs?.stores?.replay
        const cropRect = replayStore.videoCropRect
        const left = finiteNumber(cropRect?.left)
        const top = finiteNumber(cropRect?.top)
        const width = finiteNumber(cropRect?.width)
        const height = finiteNumber(cropRect?.height)
        if (
            left === null
            || top === null
            || width === null
            || height === null
            || width <= 0
            || height <= 0
        ) {
            return null
        }

        return {
            left,
            top,
            width,
            height,
        }
    }

    #viewportRectForCesiumSurface = () => {
        const cropRect = this.#videoCropRect()
        if (cropRect) {
            return cropRect
        }

        const viewer = globalThis.lgs?.viewer
        const scene = this.#cesiumScene()
        const canvas = viewer?.canvas ?? scene?.canvas ?? globalThis.lgs?.canvas
        const rect = canvas?.getBoundingClientRect?.()
        return {
            left:   finiteNumber(rect?.left) ?? 0,
            top:    finiteNumber(rect?.top) ?? 0,
            width:  finiteNumber(rect?.width)
                    ?? finiteNumber(canvas?.clientWidth)
                    ?? finiteNumber(viewer?.container?.clientWidth)
                    ?? finiteNumber(globalThis.innerWidth)
                    ?? 0,
            height: finiteNumber(rect?.height)
                    ?? finiteNumber(canvas?.clientHeight)
                    ?? finiteNumber(viewer?.container?.clientHeight)
                    ?? finiteNumber(globalThis.innerHeight)
                    ?? 0,
        }
    }

    #updateToleranceZoneOverlay = hysteresis => {
        this.#removeToleranceZoneOverlay()
        const viewer = globalThis.lgs?.viewer
        const container = viewer?.container ?? globalThis.document?.body ?? null
        if (!viewer || !container || !hysteresis) {
            return
        }

        const replaySettings = getJourneyReplaySettings()
        // The application settings are the source of truth for the runtime-only
        // tracking mode. The store may still contain the previous persisted mode
        // while a Draft recording is being armed.
        const marker = normalizeJourneyReplayMarker(globalThis.lgs?.settings?.ui?.replay?.marker
                                                     ?? globalThis.lgs?.stores?.replay?.marker
                                                     ?? replaySettings.marker)
        const cameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.settings?.ui?.replay?.camera
                                                            ?? globalThis.lgs?.stores?.replay?.camera
                                                            ?? replaySettings.camera)
        const runtimeTracking = replayRuntimeTrackingSettings(globalThis.lgs?.settings?.ui?.replay?.camera ?? cameraSettings)
        const outerBounds = marker.mode === REPLAY_MARKER_MODE_NAVIGATION
                            ? replayToleranceZoneBounds(runtimeTracking.navigation.triggerZone)
                            : marker.mode === REPLAY_MARKER_MODE_HYSTERESIS
                              ? replayToleranceZoneBounds(runtimeTracking.dynamic.triggerZone)
                              : replayToleranceZoneBounds(hysteresis?.zone)
        const innerBounds = marker.mode === REPLAY_MARKER_MODE_HYSTERESIS
                            ? replayToleranceZoneBounds(runtimeTracking.dynamic.targetZone)
                            : null
        const rect = this.#viewportRectForCesiumSurface()
        if (!rect.width || !rect.height) {
            return
        }

        const overlay = globalThis.document.createElement('div')
        overlay.className = 'replay-tolerance-zone-overlay'
        overlay.dataset.mode = marker.mode
        overlay.style.position = 'absolute'
        overlay.style.pointerEvents = 'none'
        overlay.style.left = `${rect.left + (outerBounds.left * rect.width)}px`
        overlay.style.top = `${rect.top + (outerBounds.top * rect.height)}px`
        overlay.style.width = `${(outerBounds.right - outerBounds.left) * rect.width}px`
        overlay.style.height = `${(outerBounds.bottom - outerBounds.top) * rect.height}px`
        overlay.style.background = marker.mode === REPLAY_MARKER_MODE_NAVIGATION
                                   ? 'rgba(0, 128, 255, 0.08)'
                                   : 'rgba(255, 0, 0, 0.08)'

        const outer = globalThis.document.createElement('div')
        outer.className = 'replay-tolerance-zone-overlay-outer'
        outer.dataset.zone = 'z1'
        outer.style.position = 'absolute'
        outer.style.inset = '0'
        outer.style.border = '1px solid rgba(255, 255, 255, 0.7)'

        overlay.append(outer)
        if (innerBounds) {
            const inner = globalThis.document.createElement('div')
            inner.className = 'replay-tolerance-zone-overlay-inner'
            inner.dataset.zone = 'z2'
            inner.style.position = 'absolute'
            inner.style.left = `${((innerBounds.left - outerBounds.left) / (outerBounds.right - outerBounds.left)) * 100}%`
            inner.style.top = `${((innerBounds.top - outerBounds.top) / (outerBounds.bottom - outerBounds.top)) * 100}%`
            inner.style.width = `${((innerBounds.right - innerBounds.left) / (outerBounds.right - outerBounds.left)) * 100}%`
            inner.style.height = `${((innerBounds.bottom - innerBounds.top) / (outerBounds.bottom - outerBounds.top)) * 100}%`
            inner.style.border = '1px dashed rgba(255, 255, 255, 0.45)'
            overlay.append(inner)
        }
        container.appendChild(overlay)
        this.#toleranceZoneOverlay = overlay
    }

    #recenterCameraToSample = ({
                                   sample,
                                   heading,
                                   pitch,
                                   cameraSettings,
                                   cameraHeight = null,
                                   instant = false,
                                   duration = 1.0,
                                   deterministic = false,
                                   logicalNow = null,
                                   force = false,
                               }) => {
        const viewer = globalThis.lgs?.viewer
        const frame = this.#cameraRecenterFrame({
            sample,
            heading,
            pitch,
            cameraSettings,
            cameraHeight,
        })
        if (!viewer || !frame) {
            return
        }

        const {destination, direction, correctedUp, safeHeading, safePitch} = frame
        const finishFlight = () => {
            this.#cameraFlightActive = false
        }

        if (!force && !deterministic && this.#cameraViewIsStable({anchor: sample, heading: safeHeading, pitch: safePitch})) {
            finishFlight()
            return Promise.resolve(true)
        }

        this.#cameraAutoTrackingIgnoreUntil = this.#now() + Math.max(180, duration * 1000 + 180)
        this.#rememberCameraView({anchor: sample, heading: safeHeading, pitch: safePitch})
        if (deterministic && !instant && duration > 0) {
            finishFlight()
            return Promise.resolve(this.#startDeterministicCameraTransition({
                sample,
                heading: safeHeading,
                pitch:   safePitch,
                endFrame: frame,
                duration,
                logicalNow,
            }))
        }
        if (instant || duration <= 0) {
            viewer.camera.setView?.({
                                        destination,
                                        orientation: {
                                            direction,
                                            up: correctedUp,
                                        },
                                    })
            finishFlight()
            return Promise.resolve()
        }
        return this.#startCameraTransition({
            sample,
            heading:        safeHeading,
            pitch:          safePitch,
            cameraSettings,
            cameraHeight:   frame.currentHeight,
            duration,
            endFrame:       frame,
        })
    }

    #startCameraTransition = ({
                                        sample,
                                        heading,
                                        pitch,
                                        cameraSettings,
                                        cameraHeight = null,
                                        endFrame = null,
                                        duration = REPLAY_HEADING_TRANSITION_DURATION_SECONDS,
                                    }) => {
        const viewer = globalThis.lgs?.viewer
        if (!viewer?.camera) {
            return Promise.resolve(false)
        }

        const frame = endFrame ?? this.#cameraRecenterFrame({
            sample,
            heading,
            pitch,
            cameraSettings,
            cameraHeight,
        })
        if (!frame) {
            return Promise.resolve(false)
        }

        this.#cancelCameraBezierTransition(false)

        const endHeading = frame.safeHeading
        const endPitch = frame.safePitch
        const endPosition = frame.destination
        const endDirection = frame.direction
        const endUp = frame.correctedUp
        const startHeight = finiteNumber(globalThis.lgs?.viewer?.camera?.positionCartographic?.height)
                            ?? cameraHeight
                            ?? frame.currentHeight
        const maximumHeight = Math.max(
            finiteNumber(startHeight) ?? 0,
            finiteNumber(frame.currentHeight) ?? 0,
        )

        this.#cameraFlightActive = true
        this.#cameraApplyingView = true
        this.#cameraAutoTrackingIgnoreUntil = this.#now() + Math.max(180, Math.max(0, Number(duration) * 1000) + 180)

        return new Promise(resolve => {
            this.#cameraBezierResolve = resolve
            const settle = (result) => {
                if (this.#cameraBezierResolve === null) {
                    return
                }
                const done = this.#cameraBezierResolve
                this.#cameraBezierResolve = null
                this.#cameraBezierFrame = null
                this.#cameraApplyingView = false
                this.#cameraFlightActive = false
                this.#introHeadingTransition = null
                if (result) {
                    this.#lastCameraHeading = endHeading
                    this.#lastCameraPitch = endPitch
                }
                done(result)
            }

            if (typeof viewer.camera.flyTo === 'function') {
                try {
                    viewer.camera.flyTo({
                        destination: endPosition,
                        orientation: {
                            direction: endDirection,
                            up:        endUp,
                        },
                        duration: Math.max(0, Number(duration) || 0),
                        maximumHeight,
                        easingFunction: EasingFunction.CUBIC_IN_OUT,
                        complete: () => settle(true),
                        cancel:   () => settle(false),
                    })
                    return
                }
                catch (error) {
                    console.error('[JourneyReplayMode] Camera flyTo transition failed.', error)
                }
            }

            try {
                viewer.camera.setView?.({
                    destination: endPosition,
                    orientation: {
                        direction: endDirection,
                        up:        endUp,
                    },
                })
                settle(true)
            }
            catch (error) {
                console.error('[JourneyReplayMode] Camera transition failed.', error)
                settle(false)
            }
        })
    }

    #bindMarkerInteractions = () => {
        const camera = globalThis.lgs?.viewer?.camera
        const interactionTargets = [
            globalThis.lgs?.viewer?.canvas,
            globalThis.lgs?.viewer?.scene?.canvas,
            this.#cesiumScene()?.canvas,
            globalThis.lgs?.canvas,
        ].filter((target, index, targets) => target && targets.indexOf(target) === index)
        if (!camera) {
            return
        }

        const cameraChanged = () => {
            // Keep live Cesium edits visible in the drawer during FT; only suppress echoes from our own writes.
            if (this.#suppressPlaybackCameraSync) {
                return
            }
            if (this.#cameraApplyingView || this.#now() < this.#cameraAutoTrackingIgnoreUntil) {
                return
            }
            if (!this.#cameraUserAdjusting && !this.#cameraPointerActive) {
                return
            }
            this.#updateCameraFromCesiumControls()
        }
        const refreshToleranceCameraAfterManualMove = () => {
            const settings = getJourneyReplaySettings()
            const marker = normalizeJourneyReplayMarker(globalThis.lgs?.stores?.replay?.marker ?? settings.marker)
            if (marker.mode === REPLAY_MARKER_MODE_HYSTERESIS) {
                this.refreshCamera({forceToleranceRecenter: true})
            }
        }
        const manualStart = ({pointer = false} = {}) => {
            if (this.#suppressPlaybackCameraSync) {
                this.#suppressPlaybackCameraSync = false
            }
            if (this.#cameraFlightActive && !pointer) {
                return
            }
            if (pointer && this.#cameraFlightActive) {
                this.#cancelCameraBezierTransition(false)
            }
            // Allow pointer interactions to start even if a programmatic camera view was just applied.
            if (!pointer && (this.#cameraApplyingView || this.#now() < this.#cameraAutoTrackingIgnoreUntil)) {
                return
            }
            if (this.#cameraManualInteractionTimer !== null) {
                clearTimeout(this.#cameraManualInteractionTimer)
                this.#cameraManualInteractionTimer = null
            }
            this.#cameraPointerActive = pointer || this.#cameraPointerActive
            this.#cameraUserAdjusting = true
            this.#startCameraLiveSyncLoop()
        }
        const manualEnd = ({immediate = false} = {}) => {
            if (this.#cameraFlightActive && !this.#cameraPointerActive) {
                this.#cameraUserAdjusting = false
                this.#stopCameraLiveSyncLoop()
                return
            }
            if (!this.#cameraPointerActive && (this.#cameraApplyingView || this.#now() < this.#cameraAutoTrackingIgnoreUntil)) {
                this.#cameraPointerActive = false
                this.#cameraUserAdjusting = false
                return
            }
            this.#cameraPointerActive = false
            if (this.#cameraManualInteractionTimer !== null) {
                clearTimeout(this.#cameraManualInteractionTimer)
            }
            const finish = () => {
                this.#cameraManualInteractionTimer = null
                this.#cameraUserAdjusting = false
                this.#updateCameraFromCesiumControls()
                refreshToleranceCameraAfterManualMove()
                this.#stopCameraLiveSyncLoop()
            }
            if (immediate) {
                finish()
                return
            }
            this.#cameraManualInteractionTimer = setTimeout(finish, 120)
        }
        const moveStart = () => {
            manualStart()
        }
        const moveEnd = () => {
            if (this.#cameraPointerActive) {
                return
            }
            manualEnd({immediate: true})
        }
        camera.moveStart.addEventListener(moveStart)
        camera.moveEnd.addEventListener(moveEnd)
        const pointerDown = () => manualStart({pointer: true})
        const pointerUp = () => manualEnd()
        const mouseDown = () => manualStart({pointer: true})
        const mouseUp = () => manualEnd()
        const wheel = () => {
            manualStart({pointer: true})
            manualEnd()
        }
        const listenerOptions = {passive: true, capture: true}
        camera.changed?.addEventListener?.(cameraChanged)
        interactionTargets.forEach(target => {
            target.addEventListener?.('pointerdown', pointerDown, listenerOptions)
            target.addEventListener?.('pointerup', pointerUp, listenerOptions)
            target.addEventListener?.('pointercancel', pointerUp, listenerOptions)
            target.addEventListener?.('touchstart', pointerDown, listenerOptions)
            target.addEventListener?.('touchend', pointerUp, listenerOptions)
            target.addEventListener?.('touchcancel', pointerUp, listenerOptions)
            target.addEventListener?.('mousedown', mouseDown, listenerOptions)
            target.addEventListener?.('mouseup', mouseUp, listenerOptions)
            target.addEventListener?.('mouseleave', mouseUp, listenerOptions)
            target.addEventListener?.('wheel', wheel, listenerOptions)
        })
        globalThis.window?.addEventListener?.('pointerup', pointerUp, listenerOptions)
        globalThis.window?.addEventListener?.('mouseup', mouseUp, listenerOptions)
        globalThis.window?.addEventListener?.('touchend', pointerUp, listenerOptions)
        this.#unbind.push(() => {
            camera.changed?.removeEventListener?.(cameraChanged)
            camera.moveStart.removeEventListener(moveStart)
            camera.moveEnd.removeEventListener(moveEnd)
            this.#stopCameraLiveSyncLoop()
            interactionTargets.forEach(target => {
                target.removeEventListener?.('pointerdown', pointerDown, listenerOptions)
                target.removeEventListener?.('pointerup', pointerUp, listenerOptions)
                target.removeEventListener?.('pointercancel', pointerUp, listenerOptions)
                target.removeEventListener?.('touchstart', pointerDown, listenerOptions)
                target.removeEventListener?.('touchend', pointerUp, listenerOptions)
                target.removeEventListener?.('touchcancel', pointerUp, listenerOptions)
                target.removeEventListener?.('mousedown', mouseDown, listenerOptions)
                target.removeEventListener?.('mouseup', mouseUp, listenerOptions)
                target.removeEventListener?.('mouseleave', mouseUp, listenerOptions)
                target.removeEventListener?.('wheel', wheel, listenerOptions)
            })
            globalThis.window?.removeEventListener?.('pointerup', pointerUp, listenerOptions)
            globalThis.window?.removeEventListener?.('mouseup', mouseUp, listenerOptions)
            globalThis.window?.removeEventListener?.('touchend', pointerUp, listenerOptions)
        })
    }

    /**
     * Bind the Cesium camera bridge once the viewer exists.
     * The replay drawer and the runtime settings rely on this bridge to stay in sync with live camera edits.
     */
    bindCesiumCameraBridge = () => {
        if (this.#cameraBridgeBound) {
            return true
        }

        const camera = globalThis.lgs?.viewer?.camera
        if (!camera) {
            return false
        }

        this.#bindMarkerInteractions()
        this.#cameraBridgeBound = true
        return true
    }

    #startCameraLiveSyncLoop = () => {
        if (this.#cameraLiveSyncFrame !== null) {
            return
        }

        const tick = () => {
            this.#cameraLiveSyncFrame = null
            if (!this.#cameraUserAdjusting && !this.#cameraPointerActive) {
                return
            }
            this.#updateCameraFromCesiumControls()
            this.#cameraLiveSyncFrame = globalThis.__?.requestAnimationFrame?.(tick)
                ?? globalThis.requestAnimationFrame?.(tick)
                ?? null
        }

        this.#cameraLiveSyncFrame = globalThis.__?.requestAnimationFrame?.(tick)
            ?? globalThis.requestAnimationFrame?.(tick)
            ?? null
    }

    #stopCameraLiveSyncLoop = () => {
        if (this.#cameraLiveSyncFrame === null) {
            return
        }

        if (globalThis.__?.cancelAnimationFrame) {
            globalThis.__.cancelAnimationFrame(this.#cameraLiveSyncFrame)
        }
        else {
            globalThis.cancelAnimationFrame?.(this.#cameraLiveSyncFrame)
        }
        this.#cameraLiveSyncFrame = null
    }

    #updateCamera = ({
                         sample,
                         progress,
                         forceToleranceRecenter = false,
                         immediateToleranceRecenter = false,
                         source = null,
                         frameTimeMs = null,
                         exportMode = false,
                     } = {}) => {
        const settings = getJourneyReplaySettings()
        const marker = normalizeJourneyReplayMarker(globalThis.lgs?.settings?.ui?.replay?.marker
                                                    ?? globalThis.lgs?.stores?.replay?.marker
                                                    ?? settings.marker)
        if (!sample) {
            return
        }

        if (this.#cameraApplyingView) {
            return
        }

        if (this.#cameraUserAdjusting) {
            return
        }

        if (globalThis.lgs?.viewer) {
            globalThis.lgs.viewer.trackedEntity = undefined
        }

        if (marker.mode === REPLAY_MARKER_MODE_TRACE) {
            this.#cameraMode = marker.mode
            this.#cameraFlightActive = false
            this.#cameraRedirectState = null
            this.#removeToleranceZoneOverlay()
            return
        }

        const cameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.settings?.ui?.replay?.camera
                                                           ?? globalThis.lgs?.stores?.replay?.camera
                                                           ?? settings.camera)
        const markerSettings = normalizeJourneyReplayMarker(globalThis.lgs?.settings?.ui?.replay?.marker
                                                            ?? globalThis.lgs?.stores?.replay?.marker
                                                            ?? settings.marker)
        const nominalView = this.#cameraViewForSample({
                                                          sample,
                                                          progress,
                                                          source,
                                                          cameraSettings,
                                                          markerSettings,
                                                      })
        if (!nominalView) {
            return
        }
        this.#rememberNominalCameraView(nominalView)
        const anchorSample = nominalView.sample
        const smoothHeading = nominalView.heading
        const smoothPitch = nominalView.pitch
        const recenterDuration = replayCameraRecenterDuration(cameraSettings.hysteresis.easing)
        const futureSample = this.#cameraLookaheadSample(anchorSample, {lookaheadSeconds: recenterDuration})
        const predictedSample = futureSample ?? anchorSample
        const deterministicCamera = exportMode || globalThis.lgs?.stores?.replay?.recordingSync === true
        // Playback progress is not a reliable wall clock in Draft (it can be
        // quantized or remain unchanged between two render ticks). Use it only
        // for deterministic HQ frames; live transitions use monotonic time.
        const logicalNow = deterministicCamera
                           ? finiteNumber(frameTimeMs)
                             ?? finiteNumber(anchorSample?.journeyElapsedMillis)
                             ?? this.#now()
                           : this.#now()
        if (deterministicCamera && this.#deterministicCameraTransition) {
            this.#applyDeterministicCameraTransition(logicalNow)
        }

        const introTransition = this.#introHeadingTransition
        if (introTransition) {
            const now = logicalNow
            if (now < introTransition.startAt) {
                return
            }

            if (now < introTransition.endAt) {
                if (!introTransition.applied) {
                    introTransition.applied = true
                    const introCameraSettings = normalizeJourneyReplayCamera({
                        ...cameraSettings,
                        altitudeMode: REPLAY_CAMERA_ALTITUDE_CONSTANT,
                        altitude:     Math.max(10, introTransition.height),
                    })
                    this.#recenterCameraToSample({
                        sample:         anchorSample,
                                                     heading: introTransition.targetHeading ?? smoothHeading,
                        pitch:          introTransition.fromPitch,
                        cameraSettings: introCameraSettings,
                        cameraHeight:   Math.max(10, introTransition.height),
                        duration:       REPLAY_HEADING_TRANSITION_DURATION_SECONDS,
                        deterministic:  deterministicCamera,
                        logicalNow,
                    })
                }
                this.#lastCameraHeading = smoothHeading
                this.#lastCameraPitch = smoothPitch
                return
            }

            this.#introHeadingTransition = null
        }

        if (this.#cameraMode !== marker.mode) {
            this.#cameraMode = marker.mode
            this.#cameraFlightActive = false
            this.#lastToleranceRecenterAt = null
            this.#lastToleranceRecenterProgress = null
            this.#lastNavigationRecenterAt = null
            this.#lastNavigationRecenterProgress = null
            this.#deterministicCameraTransition = null
            this.#cameraRedirectState = null
        }

        this.#updateToleranceZoneOverlay(cameraSettings.hysteresis)

        if (marker.mode === REPLAY_MARKER_MODE_NAVIGATION) {
            const runtimeTracking = replayRuntimeTrackingSettings(globalThis.lgs?.settings?.ui?.replay?.camera ?? cameraSettings)
            const navigationCameraSettings = normalizeJourneyReplayCamera({
                ...cameraSettings,
                hysteresis: {
                    ...(cameraSettings.hysteresis ?? {}),
                    zone: runtimeTracking.navigation.triggerZone,
                },
            })
            // Test both positions. In Draft the Cesium projection is updated
            // asynchronously and the predicted sample can briefly project back
            // inside Z1 even though the rendered marker has already left it.
            const currentCollision = this.#cameraCollisionForSample(anchorSample, navigationCameraSettings)
            const predictedCollision = this.#cameraCollisionForSample(predictedSample, navigationCameraSettings)
            const outsideNavigationZone = Boolean(
                currentCollision?.hard
                || predictedCollision?.hard
                || forceToleranceRecenter,
            )
            const now = logicalNow
            const currentProgress = finiteNumber(progress)
            const navigationRecenterLockMs = Math.max(
                REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS,
                Math.ceil(recenterDuration * 1000) + 180,
            )
            const sameNavigationProgressRecenter = currentProgress !== null
                                                   && this.#lastNavigationRecenterProgress !== null
                                                   && this.#lastNavigationRecenterAt !== null
                                                   && Math.abs(currentProgress - this.#lastNavigationRecenterProgress) <= 0.000001
                                                   && now - this.#lastNavigationRecenterAt < 80
            const navigationRecenterStillRunning = this.#lastNavigationRecenterAt !== null
                                                   && now - this.#lastNavigationRecenterAt < navigationRecenterLockMs
            if ((forceToleranceRecenter || source === 'refresh') && !immediateToleranceRecenter && source !== 'playback' && !exportMode) {
                this.#applyCameraView({
                    anchor: anchorSample,
                    heading: smoothHeading,
                    pitch: smoothPitch,
                    cameraSettings,
                })
                this.#lastCameraHeading = smoothHeading
                this.#lastCameraPitch = smoothPitch
                return
            }
            if (
                !forceToleranceRecenter
                && !immediateToleranceRecenter
                && outsideNavigationZone
                && (sameNavigationProgressRecenter || navigationRecenterStillRunning)
            ) {
                this.#lastCameraHeading = smoothHeading
                this.#lastCameraPitch = smoothPitch
                return
            }
            if (outsideNavigationZone || forceToleranceRecenter || immediateToleranceRecenter) {
                const navigationTargetSample = !immediateToleranceRecenter && (source === 'playback' || exportMode)
                                               ? predictedSample
                                               : anchorSample
                if (immediateToleranceRecenter) {
                    this.#applyCameraView({
                        anchor: anchorSample,
                        heading: smoothHeading,
                        pitch:   smoothPitch,
                        cameraSettings,
                    })
                }
                else {
                    this.#recenterCameraToSample({
                        sample:         navigationTargetSample,
                        heading:        smoothHeading,
                        pitch:          smoothPitch,
                        cameraSettings,
                        duration:       recenterDuration,
                        deterministic:  deterministicCamera,
                        logicalNow,
                        force:          outsideNavigationZone || forceToleranceRecenter,
                    })
                }
                this.#lastNavigationRecenterProgress = currentProgress
                this.#lastNavigationRecenterAt = now
            }
            this.#lastCameraHeading = smoothHeading
            this.#lastCameraPitch = smoothPitch
            return
        }

        if (marker.mode === REPLAY_MARKER_MODE_HYSTERESIS) {
            const runtimeTracking = replayRuntimeTrackingSettings(globalThis.lgs?.settings?.ui?.replay?.camera ?? cameraSettings)
            const dynamicCameraSettings = normalizeJourneyReplayCamera({
                ...cameraSettings,
                hysteresis: {
                    ...(cameraSettings.hysteresis ?? {}),
                    zone: runtimeTracking.dynamic.triggerZone,
                },
            })
            const trackingSample = (source === 'playback' || exportMode) ? predictedSample : anchorSample
            const collision = this.#cameraCollisionForSample(trackingSample, dynamicCameraSettings)
            const outsideTolerance = collision?.hard ?? false
            const currentScreen = this.#windowPositionForSample(anchorSample)
            const predictedScreen = this.#windowPositionForSample(trackingSample)
            const rect = this.#viewportRectForCesiumSurface()
            const dynamicTargetScreen = replayDynamicTargetPointInZone({
                currentPoint:    currentScreen,
                predictedPoint:  predictedScreen,
                viewportWidth:   rect?.width,
                viewportHeight:  rect?.height,
                zone:            runtimeTracking.dynamic.targetZone,
            })
            const nominalCurrentVisible = this.#cameraViewVisibilityForSample({
                                                                                  nominalView,
                                                                                  futureSample: null,
                                                                                  source,
                                                                                  cameraSettings,
                                                                                  markerSettings,
                                                                              })
            const nominalPredictedVisible = futureSample
                                            ? this.#cameraViewVisibilityForSample({
                                                                                      nominalView,
                                                                                      futureSample,
                                                                                      source,
                                                                                      cameraSettings,
                                                                                      markerSettings,
                                                                                  })
                                            : nominalCurrentVisible
            const nominalVisible = nominalCurrentVisible && nominalPredictedVisible
            const redirectedCurrentVisible = this.#cameraRedirectState
                                             ? this.#cameraViewVisibilityForSample({
                                                                                       nominalView,
                                                                                       redirectState: this.#cameraRedirectState,
                                                                                       futureSample:  null,
                                                                                       source,
                                                                                       cameraSettings,
                                                                                       markerSettings,
                                                                                   })
                                             : false
            const redirectedVisible = this.#cameraRedirectState
                                      ? this.#cameraViewVisibilityForSample({
                                                                                nominalView,
                                                                                redirectState: this.#cameraRedirectState,
                                                                                futureSample,
                                                                                source,
                                                                                cameraSettings,
                                                                                markerSettings,
                                                                            })
                                      : false
            const renderedVisible = this.#renderedTraceVisibleForSample(anchorSample)
            const renderedOccluded = renderedVisible === false
            // Dynamic tracking is governed by Z1. Visibility corrections inside
            // Z1 were causing a new flight to be issued on almost every update,
            // especially in Draft where depth is noisier than in HQ export.
            const needsVisibilityCorrection = outsideTolerance && (
                renderedOccluded
                || (renderedVisible === null && !nominalCurrentVisible)
            )
            const now = logicalNow
            const currentProgress = finiteNumber(progress)
            const toleranceRecenterLockMs = Math.max(
                REPLAY_TOLERANCE_RECENTER_REPLACE_DELAY_MS,
                Math.ceil(recenterDuration * 1000) + 180,
            )
            const sameProgressRecenter = currentProgress !== null
                                         && this.#lastToleranceRecenterProgress !== null
                                         && this.#lastToleranceRecenterAt !== null
                                         && Math.abs(currentProgress - this.#lastToleranceRecenterProgress) <= 0.000001
                                         && now - this.#lastToleranceRecenterAt < 80
            const activeRecenterStillFresh = this.#lastToleranceRecenterAt !== null
                                            && now - this.#lastToleranceRecenterAt < toleranceRecenterLockMs
            if (
                !forceToleranceRecenter
                && !immediateToleranceRecenter
                && (sameProgressRecenter || activeRecenterStillFresh)
                && (outsideTolerance || needsVisibilityCorrection)
            ) {
                this.#lastCameraHeading = smoothHeading
                this.#lastCameraPitch = smoothPitch
                return
            }
            if (!outsideTolerance && !forceToleranceRecenter && !immediateToleranceRecenter) {
                this.#lastToleranceRecenterProgress = null
                if (!needsVisibilityCorrection) {
                    if (this.#cameraRedirectState && nominalVisible) {
                        this.#cameraRedirectState = null
                        this.#recenterCameraToSample({
                                                         sample:   anchorSample,
                                                         heading:  nominalView.heading,
                                                         pitch:    nominalView.pitch,
                                                         cameraSettings,
                                                         duration: CAMERA_REDIRECT_MAX_TRANSITION_SECONDS,
                                                         deterministic: deterministicCamera,
                                                         logicalNow,
                                                     })
                    }
                    this.#lastCameraHeading = smoothHeading
                    this.#lastCameraPitch = smoothPitch
                    return
                }

                let redirectView = redirectedVisible && this.#cameraRedirectState
                                   ? this.#cameraViewWithRedirectState(nominalView, this.#cameraRedirectState)
                                   : null
                if (!redirectView) {
                    this.#cameraRedirectState = this.#findCameraRedirectState({
                                                                                  nominalView,
                                                                                  futureSample,
                                                                                  source,
                                                                                  cameraSettings,
                                                                                  markerSettings,
                                                                                  reuseCurrentIfVisible: false,
                                                                              }) ?? this.#findCameraRedirectState({
                                                                                                                      nominalView,
                                                                                                                      futureSample:          null,
                                                                                                                      source,
                                                                                                                      cameraSettings,
                                                                                                                      markerSettings,
                                                                                                                      reuseCurrentIfVisible: false,
                                                                                                                  })
                    redirectView = this.#cameraRedirectState
                                   ? this.#cameraViewWithRedirectState(nominalView, this.#cameraRedirectState)
                                   : null
                }

                if (redirectView) {
                    if (redirectedCurrentVisible) {
                        this.#applyCameraView({
                                                  anchor:  redirectView.sample,
                                                  heading: redirectView.heading,
                                                  pitch:   redirectView.pitch,
                                                  cameraSettings,
                                              })
                    }
                    else {
                        this.#recenterCameraToSample({
                                                         sample:   redirectView.sample,
                                                         heading:  redirectView.heading,
                                                         pitch:    redirectView.pitch,
                                                         cameraSettings,
                                                         duration: CAMERA_REDIRECT_MAX_TRANSITION_SECONDS,
                                                         deterministic: deterministicCamera,
                                                         logicalNow,
                                                     })
                    }
                }
                this.#lastCameraHeading = smoothHeading
                this.#lastCameraPitch = smoothPitch
                return
            }
            if (
                !forceToleranceRecenter
                && !immediateToleranceRecenter
                && outsideTolerance
                && (sameProgressRecenter || activeRecenterStillFresh)
            ) {
                this.#lastCameraHeading = smoothHeading
                this.#lastCameraPitch = smoothPitch
                return
            }

            if (outsideTolerance || needsVisibilityCorrection || forceToleranceRecenter || immediateToleranceRecenter) {
                const canUseNominalView = !renderedOccluded && nominalCurrentVisible
                let targetView = canUseNominalView ? nominalView : null
                let nextRedirectState = canUseNominalView ? null : this.#cameraRedirectState

                if (!targetView && redirectedVisible && this.#cameraRedirectState) {
                    targetView = this.#cameraViewWithRedirectState(nominalView, this.#cameraRedirectState)
                }

                if (!targetView) {
                    nextRedirectState = this.#findCameraRedirectState({
                                                                          nominalView,
                                                                          futureSample,
                                                                          source,
                                                                          cameraSettings,
                                                                          markerSettings,
                                                                          reuseCurrentIfVisible: false,
                                                                      }) ?? this.#findCameraRedirectState({
                                                                                                              nominalView,
                                                                                                              futureSample:          null,
                                                                                                              source,
                                                                                                              cameraSettings,
                                                                                                              markerSettings,
                                                                                                              reuseCurrentIfVisible: false,
                                                                                                          })
                    if (nextRedirectState) {
                        targetView = this.#cameraViewWithRedirectState(nominalView, nextRedirectState)
                    }
                }

                if (!targetView) {
                    targetView = nominalView
                    nextRedirectState = null
                }

                const useRedirectTransition = nextRedirectState !== null
                this.#cameraRedirectState = nextRedirectState
                this.#recenterCameraToSample({
                                                 // Predictive target: when Z1 is
                                                 // crossed, place the future
                                                 // marker inside Z2 (the centre
                                                 // is a valid point in Z2) so
                                                 // the next few frames do not
                                                 // immediately trigger another
                                                 // correction.
                                                 sample:  outsideTolerance && !useRedirectTransition
                                                          ? trackingSample
                                                          : targetView.sample,
                                                 heading: targetView.heading,
                                                 pitch:   useRedirectTransition
                                                          ? targetView.pitch
                                                          : this.#liveCameraPitch(smoothPitch),
                    cameraSettings,
                    duration: immediateToleranceRecenter
                              ? 0
                              : useRedirectTransition
                                ? Math.min(
                                CAMERA_REDIRECT_MAX_TRANSITION_SECONDS,
                                replayCameraRecenterDuration(cameraSettings.hysteresis.easing),
                            )
                                : replayCameraRecenterDuration(cameraSettings.hysteresis.easing),
                    deterministic: deterministicCamera,
                    logicalNow,
                })
                this.#lastToleranceRecenterProgress = currentProgress
                this.#lastToleranceRecenterAt = now
                this.#lastDynamicTargetScreen = dynamicTargetScreen
            }
            this.#lastCameraHeading = smoothHeading
            this.#lastCameraPitch = smoothPitch
        }
    }

    #bindRenderer = () => {
        this.#unbind.push(
            this.#controller.on(REPLAY_EVENT_START, detail => {
                try {
                    this.#lastPlaybackUpdateProgressKey = null
                    this.#hideJourneyToolbarVisibility()
                    this.#setContinuousRender(true)
                    this.#renderer.show({
                        sampler: detail.sampler,
                        options: {smoothedGuide: this.#smoothedGuide()},
                    })
                    const startSample = detail.sample
                                        ?? detail.sampler?.atProgress?.(detail.progress ?? 0)
                                        ?? currentJourneyReplaySample(this.#controller)

                    this.#renderer.update({...detail, forceGeometry: true})
                    void this.#syncNearbyPOIsForSample(startSample ?? detail.sample ?? null)
                    if (!this.#deferStartCameraRecenter) {
                        if (this.#skipNextImmediateStartRecenter) {
                            this.#skipNextImmediateStartRecenter = false
                            const replaySettings = getJourneyReplaySettings()
                            const startCameraSettings = normalizeJourneyReplayCamera(
                                globalThis.lgs?.stores?.replay?.camera ?? replaySettings.camera,
                            )
                            this.#updateToleranceZoneOverlay(startCameraSettings.hysteresis)
                        }
                        else {
                            this.#updateCamera({
                                                   ...detail,
                                                   forceToleranceRecenter:     true,
                                                   immediateToleranceRecenter: true,
                                               })
                        }
                        const startProgress = finiteNumber(detail?.progress ?? startSample?.progress)
                        this.#lastPlaybackUpdateProgressKey = Math.round((startProgress ?? 0) / CAMERA_UPDATE_MIN_PROGRESS_DELTA)
                    }
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
            this.#controller.on(REPLAY_EVENT_UPDATE, detail => {
                try {
                    const playbackProgress = finiteNumber(detail?.progress ?? detail?.sample?.progress)
                    const playbackProgressKey = Math.round((playbackProgress ?? 0) / CAMERA_UPDATE_MIN_PROGRESS_DELTA)
                    this.#renderer.update({
                        ...detail,
                        sampler: this.#sampler,
                    })
                    void this.#syncNearbyPOIsForSample(detail.sample ?? null)
                    if (this.#lastPlaybackUpdateProgressKey === playbackProgressKey) {
                        return
                    }

                    this.#lastPlaybackUpdateProgressKey = playbackProgressKey
                    this.#updateCamera({
                        ...detail,
                        source: 'playback',
                    })
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
            this.#controller.on(REPLAY_EVENT_PAUSE, detail => {
                this.#lastPlaybackUpdateProgressKey = null
                this.#setContinuousRender(false)
                try {
                    this.#renderer.update({...detail, freezeDynamic: true})
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
            this.#controller.on(REPLAY_EVENT_RESUME, detail => {
                try {
                    this.#lastPlaybackUpdateProgressKey = null
                    this.#setContinuousRender(true)
                    this.#renderer.update({...detail, forceGeometry: true})
                    this.#updateCamera(detail)
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
            this.#controller.on(REPLAY_EVENT_STOP, () => {
                this.#lastPlaybackUpdateProgressKey = null
                this.#clipSequenceToken++
                this.#stopStopClipPOIMaskLoop()
                this.#setContinuousRender(false)
                this.#renderer.clear()
                this.#restoreOtherJourneysVisibility()
                this.#restoreCurrentJourneyVisibility({restorePOIs: false})
                this.#setJourneyReplayOrbitAllowed(true)
                this.#deferStartCameraRecenter = false
                this.#restoreJourneyToolbarVisibility()
                this.#restoreJourneyReplayDrawerAfterPlayback()
                this.#restoreMainUI()
                void this.#restoreNearbyPOIsAfterPlayback().finally(() => {
                    this.#restoreCurrentJourneyVisibility()
                })
                if (!this.#deferPlaybackCameraRestore) {
                    this.#restorePlaybackCameraSettings({force: true})
                }
                resetRuntimeProgress(replayStore())
                this.#restoreCurrentJourneyVisibility()
            }),
            this.#controller.on(REPLAY_EVENT_END, detail => {
                this.#lastPlaybackUpdateProgressKey = null
                this.#skipNextImmediateStartRecenter = false
                const token = this.#clipSequenceToken
                const sample = detail.sampler?.atProgress?.(1)
                              ?? detail.sample
                              ?? currentJourneyReplaySample(this.#controller)
                const stopList = this.#clipListForSlot(REPLAY_CLIP_SLOT_STOP)
                if (stopList.length > 0) {
                    publishReplayClipFrameState({
                        store: replayStore(),
                        slot: REPLAY_CLIP_SLOT_STOP,
                        sample,
                        progress: 1,
                    })
                }
                const notifyStopClipsComplete = () => {
                    globalThis.window?.dispatchEvent?.(new CustomEvent(REPLAY_EVENT_STOP_CLIPS_COMPLETE, {
                        detail: {
                            sample,
                            progress: detail.progress ?? null,
                        },
                    }))
                }
                const notifyStopClipsCompleteAfterFinalWidgetFrame = (afterFrame = null) => {
                    const raf = globalThis.requestAnimationFrame
                                ?? globalThis.window?.requestAnimationFrame?.bind(globalThis.window)
                                ?? (callback => setTimeout(callback, 0))

                    raf(() => {
                        raf(() => {
                            if (token === this.#clipSequenceToken) {
                                if (typeof afterFrame === 'function') {
                                    afterFrame()
                                }
                                notifyStopClipsComplete()
                            }
                        })
                    })
                }
                const finalize = () => {
                    if (token !== this.#clipSequenceToken) {
                        return
                    }

                    this.#stopStopClipPOIMaskLoop()
                    this.#setContinuousRender(false)
                    if (replayStore()?.recordingSync === true) {
                        this.#sceneRestoreDeferred = true
                        return
                    }

                    this.#renderer.clear()
                    this.#setJourneyReplayOrbitAllowed(true)
                    resetRuntimeProgress(replayStore())
                    this.#restorePlaybackScene()
                }

                try {
                    this.#renderer.update({
                        ...detail,
                        sampler:               this.#sampler,
                        forceGeometry:         true,
                        freezeDynamic:         false,
                        hideCursor:            true,
                        hideRemainingTrace:    true,
                        staticCompletedTrace:  true,
                    })
                    this.#startStopClipPOIMaskLoop()

                    const closeOpenedPOIs = this.#closeJourneyReplayOpenedPOIsBeforeStopClips()
                    if (!closeOpenedPOIs && stopList.length === 0) {
                        notifyStopClipsCompleteAfterFinalWidgetFrame(finalize)
                        return
                    }

                    void (async () => {
                        try {
                            await closeOpenedPOIs
                            if (token !== this.#clipSequenceToken) {
                                return
                            }

                            if (stopList.length === 0) {
                                notifyStopClipsCompleteAfterFinalWidgetFrame(finalize)
                                return
                            }

                            await this.#playJourneyReplayClips(REPLAY_CLIP_SLOT_STOP, {
                                sample,
                                token,
                            })
                            notifyStopClipsComplete()
                            finalize()
                        }
                        catch (error) {
                            this.#abortPlaybackAfterListenerError(error)
                        }
                    })()
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
        )
    }
}
