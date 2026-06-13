/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughMode.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-31
 * Last modified: 2026-05-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CameraUtils }                                        from '@Utils/cesium/CameraUtils'
import { POIUtils }                                           from '@Utils/cesium/POIUtils'
import { TrackUtils }                                         from '@Utils/cesium/TrackUtils'
import { FLYTHROUGH_DRAWER }                                  from '@Core/constants'
import {
    Cartesian2, Cartesian3, Cartographic, CatmullRomSpline, ExtrapolationType, JulianDate, LinearApproximation,
    Math as CesiumMath, Matrix4, SampledPositionProperty, SceneTransforms, Transforms,
}                                                             from 'cesium'
import { FlythroughCesiumRenderer }                           from './FlythroughCesiumRenderer'
import { FLYTHROUGH_SCOPE_ALL_TRACKS, FlythroughPathSampler } from './FlythroughPathSampler'
import {
    FLYTHROUGH_EVENT_END, FLYTHROUGH_EVENT_PAUSE, FLYTHROUGH_EVENT_RESUME, FLYTHROUGH_EVENT_START,
    FLYTHROUGH_EVENT_STOP, FLYTHROUGH_EVENT_UPDATE, FlythroughPlaybackController,
}                                                             from './FlythroughPlaybackController'
import {
    FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT, FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET, FLYTHROUGH_CAMERA_POSITION_AHEAD, FLYTHROUGH_CAMERA_POSITION_SYSTEM,
    FLYTHROUGH_MARKER_MODE_HYSTERESIS, FLYTHROUGH_MARKER_MODE_NAVIGATION, FLYTHROUGH_MARKER_MODE_TRACE,
    getFlythroughSettings, normalizeFlythroughCamera,
    normalizeFlythroughMarker, normalizeFlythroughTrace,
}                                                             from './FlythroughProgressionStyle'
import {
    FLYTHROUGH_CLIP_SLOT_START,
    FLYTHROUGH_CLIP_SLOT_STOP,
    normalizeFlythroughClips,
}                                                             from './FlythroughClips'
import {
    DEFAULT_FLYTHROUGH_POI_DISPLAY_DURATION_SECONDS,
    normalizeFlythroughPOISettings,
}                                                             from './FlythroughPOISettings'

const DEFAULT_DURATION = 60
const PROFILE_HOVER_RENDER_INTERVAL = 120
const METRIC_OVERLAY_TTL = 2000
const FLYTHROUGH_HEADING_TRANSITION_DURATION_SECONDS = 2
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
const FLYTHROUGH_TOLERANCE_OUTER_INSET_RATIO = 0.05
const FLYTHROUGH_TOLERANCE_INNER_INSET_RATIO = 0.2
const FLYTHROUGH_TOLERANCE_RECENTER_REPLACE_DELAY_MS = 300
const FLYTHROUGH_POI_TRIGGER_EPSILON_METERS = 0.001
export const FLYTHROUGH_JOURNEY_TOOLBAR_VISIBILITY_EVENT = 'lgs:flythrough:journey-toolbar-visibility'
export const FLYTHROUGH_EVENT_STOP_CLIPS_COMPLETE = 'flythrough/stop-clips-complete'

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const lerp = (start, end, ratio) => start + ((end - start) * ratio)

const hasFiniteLonLat = point => finiteNumber(point?.longitude) !== null && finiteNumber(point?.latitude) !== null

const sanitizeOrientationRadians = (value, fallback) => finiteNumber(value) ?? fallback

export const flythroughHeadingFromLocalAxisAngle = axisAngle => {
    const angle = finiteNumber(axisAngle)
    if (angle === null) {
        return 0
    }

    return Math.atan2(Math.cos(angle), Math.sin(angle))
}

export const flythroughCameraHeadingForPositionMode = ({axisHeading = 0, positionMode} = {}) => {
    const heading = finiteNumber(axisHeading) ?? 0
    return positionMode === FLYTHROUGH_CAMERA_POSITION_AHEAD ? heading + Math.PI : heading
}

export const flythroughAngularDelta = (from, to) => {
    const start = finiteNumber(from)
    const end = finiteNumber(to)
    if (start === null || end === null) {
        return null
    }

    const fullTurn = Math.PI * 2
    const delta = ((end - start + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
    return delta === -Math.PI ? Math.PI : delta
}

export const flythroughHeadingEasingFactor = ({
                                                  previousHeading = null,
                                                  nextHeading = 0,
                                                  easing = 0.14,
                                                  minFactor = 0.04,
                                                  maxFactor = 0.22,
                                              } = {}) => {
    const delta = flythroughAngularDelta(previousHeading, nextHeading)
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

export const flythroughCameraRecenterDuration = (easing = 0.18) => {
    const safeEasing = clamp(finiteNumber(easing) ?? 0.18, 0.02, 0.5)
    return Math.max(0.5, 0.95 + (1.6 * safeEasing))
}

export const flythroughTargetSampleForClip = async ({
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
        const centroid = await sceneManager?.getJourneyCentroid?.(journey)
        if (centroid) {
            return {
                ...sample,
                longitude: centroid.longitude,
                latitude:  centroid.latitude,
                altitude:  finiteNumber(centroid.height ?? centroid.altitude) ?? sample.altitude,
            }
        }
    }

    return sample
}

export const flythroughCameraRangeFromPitch = (altitude, pitchRadians) => {
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

export const flythroughCameraRecenterHeight = (currentHeight, targetHeight) => {
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

export const flythroughCameraRecenterHorizontalDistance = ({
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

export const flythroughToleranceZoneBounds = (zone = {}) => {
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

export const flythroughIsWindowPointOutsideToleranceZone = ({
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

    const bounds = flythroughToleranceZoneBounds(zone)
    const left = bounds.left * canvasWidth
    const right = bounds.right * canvasWidth
    const top = bounds.top * canvasHeight
    const bottom = bounds.bottom * canvasHeight
    return x <= left || x >= right || y <= top || y >= bottom
}

const flythroughInnerToleranceZoneBounds = (zone = {}, marginRatio = 0.1) => {
    const outer = flythroughToleranceZoneBounds(zone)
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

const flythroughInsetBounds = (bounds = {}, insetRatio = 0.1) => {
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

const flythroughWindowCollisionFromPoint = ({
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

    const outer = outerBounds ?? flythroughToleranceZoneBounds()
    const inner = safeBounds ?? flythroughInnerToleranceZoneBounds()
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

export const flythroughCameraHeadingWithHysteresis = ({
                                                          previousHeading = null,
                                                          nextHeading = 0,
                                                          threshold = CAMERA_HEADING_HYSTERESIS_RADIANS,
                                                      } = {}) => {
    const desiredHeading = sanitizeOrientationRadians(nextHeading, 0)
    const stableHeading = finiteNumber(previousHeading)
    if (stableHeading === null) {
        return desiredHeading
    }

    const delta = flythroughAngularDelta(stableHeading, desiredHeading)
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

const flythroughStore = () => globalThis.lgs?.stores?.flythrough

const resolveFlythroughRuntimeClips = ({clips = null, settingsClips = {}, journey = null} = {}) => {
    if (clips) {
        return normalizeFlythroughClips(clips)
    }

    return normalizeFlythroughClips({
        catalog: settingsClips?.catalog ?? settingsClips?.definitions ?? {},
        start:   Array.isArray(journey?.flythrough?.start)
                 ? journey.flythrough.start
                 : settingsClips?.start ?? [],
        stop:    Array.isArray(journey?.flythrough?.stop)
                 ? journey.flythrough.stop
                 : settingsClips?.stop ?? [],
    })
}

const currentFlythroughSample = controller => controller?.currentSample?.() ?? flythroughStore()?.sample ?? null

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
    store.orbitAllowed = true
    store.cameraUserAdjusted = false
    store.cameraUpdateSource = null
    store.hoverSample = null
    store.metricOverlay = {
        ...store.metricOverlay,
        visible:   false,
        source:    null,
        anchor:    null,
        sample:    null,
        expiresAt: 0,
    }
}

export class FlythroughMode {
    #controller
    #renderer
    #sampler = null
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
    #cameraBezierFrame = null
    #cameraBezierResolve = null
    #savedCameraState = null
    #playbackStartCameraSettings = null
    #playbackCameraUserAdjusted = false
    #flythroughDrawerWasOpenBeforePlayback = false
    #lastCameraHeading = null
    #lastCameraPitch = null
    #lastAppliedCameraView = null
    #cameraUserAdjusting = false
    #cameraApplyingView = false
    #cameraPointerActive = false
    #cameraManualInteractionTimer = null
    #cameraAutoTrackingIgnoreUntil = 0
    #lastToleranceRecenterAt = null
    #lastToleranceRecenterProgress = null
    #toleranceZoneOverlay = null
    #journeyToolbarWasVisible = null
    #journeyToolbarHidden = false
    #hiddenJourneyVisibility = new Map()
    #hiddenCurrentJourneyPolylines = new Map()
    #deferStartCameraRecenter = false
    #introHeadingTransition = null
    #cameraBridgeBound = false
    #cameraLiveSyncFrame = null
    #clipSequenceToken = 0
    #flythroughPoiExpandedState = new Map()
    #flythroughPoiCollapseTimers = new Map()
    #flythroughPoiTriggered = new Set()
    #flythroughPOIVisibilityState = new Map()
    #stopClipPOIMaskFrame = null
    #lastFlythroughPoiDistance = null

    constructor({
                    controller = new FlythroughPlaybackController(),
                    renderer = new FlythroughCesiumRenderer(),
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

    configure = (options = {}) => {
        const store = flythroughStore()
        const journey = options.journey ?? globalThis.lgs?.theJourney

        if (!journey) {
            return null
        }

        const flythrough = getFlythroughSettings()
        const scope = FLYTHROUGH_SCOPE_ALL_TRACKS
        const trackSlug = options.trackSlug ?? globalThis.lgs?.theTrack?.slug ?? store?.trackSlug
        const progression = options.progression ?? flythrough.progression
        const profileInfo = options.profileInfo ?? flythrough.profileInfo
        const trace = options.trace ?? flythrough.trace
        const marker = options.marker ?? flythrough.marker
        const camera = options.camera ?? flythrough.camera
        const clips = resolveFlythroughRuntimeClips({
            clips:         options.clips,
            settingsClips: flythrough.clips,
            journey,
        })

        this.#sampler = new FlythroughPathSampler({
            journey,
            scope,
            trackSlug,
            includeHiddenTracks: options.includeHiddenTracks ?? false,
        })
        this.#resetCameraController()

        if (store) {
            store.journeySlug = journey.slug
            store.trackSlug = trackSlug ?? null
            store.scope = scope
            store.totalDistance = this.#sampler.totalDistance
            store.progression = progression
            store.profileInfo = profileInfo
            store.trace = normalizeFlythroughTrace(trace)
            store.marker = normalizeFlythroughMarker(marker)
            store.camera = normalizeFlythroughCamera(camera)
            store.clips = clips
        }

        this.#controller.configure({
            sampler:   this.#sampler,
            duration:  options.duration ?? flythrough.duration ?? store?.duration ?? DEFAULT_DURATION,
            direction: 1,
            loop:      options.loop ?? flythrough.loop ?? store?.loop ?? false,
            progress:  options.progress ?? store?.progress ?? 0,
        })

        this.bindCesiumCameraBridge()

        return this.#sampler
    }

    start = (options = {}) => {
        this.#renderer.clear()
        this.bindCesiumCameraBridge()
        const sampler = this.configure(options)
        if (!sampler?.hasSamples) {
            return null
        }

        const shouldHideOtherJourneys = options.hideOtherJourneys
                                        ?? flythroughStore()?.hideOtherJourneys
                                        ?? (getFlythroughSettings().hideOtherJourneys === true)
        void globalThis.__?.ui?.cameraManager?.stopRotate?.()
        this.#setFlythroughOrbitAllowed(false)
        this.#restoreOtherJourneysVisibility()
        this.#hideCurrentJourneyVisibility()
        if (shouldHideOtherJourneys) {
            this.#hideOtherJourneysVisibility()
        }
        const startSample = sampler.atProgress?.(options.progress ?? 0)
        this.#captureCameraState({sample: startSample})
        this.#captureFlythroughDrawerStateBeforePlayback()
        this.#capturePlaybackCameraSettings()
        const startList = this.#clipListForSlot(FLYTHROUGH_CLIP_SLOT_START)
        this.#deferStartCameraRecenter = startList.length > 0
        const introLeadSeconds = 1
        const introStartAt = this.#now() + Math.max(
            0,
            (startList.reduce((total, clip) => total + Math.max(0, Number(clip?.params?.duration ?? this.#cameraSettingsForClip(clip)?.duration ?? 0)), 0) - introLeadSeconds) * 1000,
        )
        const camera = globalThis.lgs?.viewer?.camera
        this.#introHeadingTransition = {
            startAt:       introStartAt,
            endAt:         introStartAt + (FLYTHROUGH_HEADING_TRANSITION_DURATION_SECONDS * 1000),
            height:        finiteNumber(camera?.positionCartographic?.height)
                           ?? finiteNumber(startSample?.altitude ?? startSample?.height)
                           ?? 0,
            fromPitch:     finiteNumber(camera?.pitch) ?? this.#lastCameraPitch ?? SAFE_TOP_DOWN_PITCH,
            targetHeading: this.#introHeadingForProgress(options.progress ?? 0),
            applied:       false,
        }
        const token = ++this.#clipSequenceToken
        let startResult = startSample
        void this.#prepareNearbyPOIsForPlayback(startSample)

        if (startList.length > 0) {
            this.#setContinuousRender(true)
            this.#hideJourneyToolbarVisibility()
            void (async () => {
                try {
                    if (startSample) {
                        await this.#playFlythroughClips(FLYTHROUGH_CLIP_SLOT_START, {
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
                    console.error('[FlythroughMode] Failed to run flythrough start clips.', error)
                    this.#deferStartCameraRecenter = false
                    this.stop({emit: false})
                }
            })()
        }
        else {
            this.#deferStartCameraRecenter = false
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
        const store = flythroughStore()
        if (store) {
            store.loop = enabled
        }
        return enabled
    }

    setVideoSafeMode = (enabled = true) => {
        return this.#controller.setVideoSafeMode?.(enabled) ?? null
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
            this.#applyFlythroughPOIVisibility()
        }
        if (restorePOIs) {
            this.#restoreFlythroughPOIVisibility()
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
            entity.show = visible
            if (entity.billboard) {
                entity.billboard.show = visible
            }
        })
    }

    #resolveFlythroughPOI = entry => {
        const poiId = entry?.poi?.id
        if (!poiId) {
            return null
        }

        return globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            ?? globalThis.__?.ui?.poiManager?.get?.(poiId)
            ?? entry.poi
    }

    #flythroughPOICandidates = (nearbyPois = null) => {
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
        const store = flythroughStore()
        const runtimeNearbyPois = Array.isArray(nearbyPois)
            ? nearbyPois
            : Array.isArray(store?.nearbyPois)
            ? store.nearbyPois
            : []

        runtimeNearbyPois.forEach(entry => addPOI(this.#resolveFlythroughPOI(entry)))
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

    #applyFlythroughPOIVisibility = (nearbyPois = null) => {
        const store = flythroughStore()
        const runtimeNearbyPois = Array.isArray(nearbyPois)
            ? nearbyPois
            : Array.isArray(store?.nearbyPois)
            ? store.nearbyPois
            : []
        const nearbyPOIIds = new Set(
            runtimeNearbyPois
                .map(entry => this.#resolveFlythroughPOI(entry)?.id)
                .filter(Boolean),
        )

        for (const poi of this.#flythroughPOICandidates(runtimeNearbyPois)) {
            if (!poi?.id) {
                continue
            }

            const settings = normalizeFlythroughPOISettings(poi.flythrough)
            const shouldApplyVisibility = nearbyPOIIds.has(poi.id)
                || settings.visible === false
                || poi.visible === false
            if (!shouldApplyVisibility) {
                continue
            }

            const visibleBeforePlayback = this.#flythroughPOIVisibilityState.get(poi.id)?.visible
                ?? this.#isPOIVisibleBeforePlayback(poi)
            const visibleDuringPlayback = visibleBeforePlayback
                && poi.visible !== false
                && settings.visible !== false

            if (settings.visible === false && !this.#flythroughPOIVisibilityState.has(poi.id)) {
                this.#flythroughPOIVisibilityState.set(poi.id, {
                    visible: visibleBeforePlayback,
                })
            }

            this.#setPOIEntityVisibility(poi, visibleDuringPlayback)
        }
    }

    #restoreFlythroughPOIVisibility = () => {
        for (const [poiId, state] of this.#flythroughPOIVisibilityState.entries()) {
            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
                ?? globalThis.__?.ui?.poiManager?.get?.(poiId)
            if (!poi?.id) {
                continue
            }

            this.#setPOIEntityVisibility(poi, state?.visible === true && poi.visible !== false)
        }

        this.#flythroughPOIVisibilityState.clear()
    }

    #hideGloballyHiddenPOIs = () => {
        for (const poi of this.#flythroughPOICandidates()) {
            if (poi?.id && poi.visible === false) {
                this.#setPOIEntityVisibility(poi, false)
            }
        }
    }

    #startStopClipPOIMaskLoop = () => {
        if (this.#stopClipPOIMaskFrame !== null) {
            return
        }

        this.#applyFlythroughPOIVisibility()
        const tick = () => {
            this.#stopClipPOIMaskFrame = null
            this.#applyFlythroughPOIVisibility()
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

    #setFlythroughOrbitAllowed = (allowed = true) => {
        const store = flythroughStore()
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
        const flythroughSettings = globalThis.lgs?.settings?.ui?.flythrough
        if (flythroughSettings) {
            flythroughSettings.hideOtherJourneys = nextEnabled
        }

        const store = flythroughStore()
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

    refresh = ({camera = true, suppressMoveEvents = camera === true} = {}) => {
        const sample = this.#controller.currentSample()
        if (sample && this.#sampler) {
            this.#renderer.update({
                sample,
                sampler: this.#sampler,
                forceGeometry: true,
            })
            if (camera) {
                if (suppressMoveEvents) {
                    this.#cameraAutoTrackingIgnoreUntil = this.#now() + 180
                }
                this.#updateCamera({
                                       sample,
                                       progress: this.#controller.progress ?? sample.progress ?? 0,
                                   })
            }
        }
        return sample
    }

    refreshCamera = (options = {}) => {
        const sample = options.sample
            ?? currentFlythroughSample(this.#controller)
            ?? globalThis.lgs?.stores?.flythrough?.sample
        if (!sample) {
            return null
        }

        if (options.suppressMoveEvents !== false) {
            this.#cameraAutoTrackingIgnoreUntil = this.#now() + 180
        }

        this.#updateCamera({
            sample,
            progress: this.#controller.progress ?? sample.progress ?? 0,
                               ...options,
        })
        return sample
    }

    #syncRuntimeNearbyPOIs = (journey = globalThis.lgs?.theJourney ?? null) => {
        const store = flythroughStore()
        const poiManager = globalThis.__?.ui?.poiManager
        if (!journey?.slug || !store || !poiManager?.getFlythroughPOIsForJourney) {
            return []
        }

        const poiDistance = globalThis.lgs?.settings?.ui?.flythrough?.poiDistance ?? store.poiDistance ?? null
        const nearbyPois = poiManager.getFlythroughPOIsForJourney(journey, poiDistance)
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
        for (const timerId of this.#flythroughPoiCollapseTimers.values()) {
            globalThis.clearTimeout?.(timerId)
        }
        this.#flythroughPoiCollapseTimers.clear()

        const restoreEntries = Array.from(this.#flythroughPoiExpandedState.entries())
        this.#flythroughPoiExpandedState.clear()
        this.#flythroughPoiTriggered.clear()
        this.#lastFlythroughPoiDistance = null

        await Promise.all(restoreEntries.map(([poiId, expanded]) => this.#updatePOIExpandedState(poiId, expanded === true)))
    }

    #prepareNearbyPOIsForPlayback = async (sample = null) => {
        await this.#restoreNearbyPOIsAfterPlayback()

        const store = flythroughStore()
        const journey = globalThis.lgs?.theJourney ?? null
        const nearbyPois = Array.isArray(store?.nearbyPois) && store.nearbyPois.length > 0
            ? store.nearbyPois
            : this.#syncRuntimeNearbyPOIs(journey)

        this.#applyFlythroughPOIVisibility(nearbyPois)

        for (const entry of nearbyPois) {
            const poiId = entry?.poi?.id
            const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
            const settings = normalizeFlythroughPOISettings(poi?.flythrough)
            if (!poiId || !poi) {
                continue
            }

            if (settings.visible === false) {
                continue
            }

            this.#flythroughPoiExpandedState.set(poiId, poi.expanded === true)
            await this.#updatePOIExpandedState(poiId, false)
        }

        const currentDistance = finiteNumber(sample?.distanceFromStart)
        this.#lastFlythroughPoiDistance = currentDistance === null
            ? null
            : Math.max(0, currentDistance - FLYTHROUGH_POI_TRIGGER_EPSILON_METERS)

        if (sample) {
            void this.#syncNearbyPOIsForSample(sample)
        }
    }

    #openNearbyPOIForPlayback = async (poiId) => {
        if (!poiId) {
            return
        }

        const existingTimer = this.#flythroughPoiCollapseTimers.get(poiId)
        if (existingTimer) {
            globalThis.clearTimeout?.(existingTimer)
        }

        const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
        const settings = normalizeFlythroughPOISettings(poi?.flythrough)
        if (settings.visible === false || settings.animated === false) {
            return
        }
        const durationSeconds = finiteNumber(settings.displayDurationSeconds) ?? DEFAULT_FLYTHROUGH_POI_DISPLAY_DURATION_SECONDS

        await this.#updatePOIExpandedState(poiId, true)

        const timeoutId = globalThis.setTimeout?.(() => {
            this.#flythroughPoiCollapseTimers.delete(poiId)
            void this.#updatePOIExpandedState(poiId, false)
        }, durationSeconds * 1000)

        if (timeoutId !== undefined) {
            this.#flythroughPoiCollapseTimers.set(poiId, timeoutId)
        }
    }

    #syncNearbyPOIsForSample = async (sample = null) => {
        const currentDistance = finiteNumber(sample?.distanceFromStart)
        if (currentDistance === null) {
            return
        }

        const nearbyPois = flythroughStore()?.nearbyPois ?? []
        const previousDistance = this.#lastFlythroughPoiDistance
        this.#lastFlythroughPoiDistance = currentDistance

        if (!Array.isArray(nearbyPois) || nearbyPois.length === 0) {
            return
        }

        if (previousDistance !== null && currentDistance < previousDistance) {
            return
        }

        const thresholdStart = previousDistance ?? Math.max(0, currentDistance - FLYTHROUGH_POI_TRIGGER_EPSILON_METERS)
        const triggeredIds = nearbyPois
            .filter(entry => {
                const poiId = entry?.poi?.id
                const targetDistance = finiteNumber(entry?.projectedAbscissa)
                const poi = globalThis.lgs?.stores?.main?.components?.pois?.list?.get?.(poiId)
                const settings = normalizeFlythroughPOISettings(poi?.flythrough)
                return Boolean(poiId)
                    && targetDistance !== null
                    && !this.#flythroughPoiTriggered.has(poiId)
                    && settings.visible !== false
                    && settings.animated !== false
                    && targetDistance > thresholdStart
                    && targetDistance <= currentDistance + FLYTHROUGH_POI_TRIGGER_EPSILON_METERS
            })
            .map(entry => entry.poi.id)

        triggeredIds.forEach(poiId => this.#flythroughPoiTriggered.add(poiId))
        await Promise.all(triggeredIds.map(poiId => this.#openNearbyPOIForPlayback(poiId)))
    }

    /**
     * Pull the live Cesium camera state back into the flythrough settings/store.
     * This keeps the drawer and the Cesium viewport in lockstep while the FT is running.
     */
    syncCameraFromCesiumControls = ({sample = null, altitudeMode = null} = {}) => {
        let resolvedSample = sample
            ?? currentFlythroughSample(this.#controller)
            ?? globalThis.lgs?.stores?.flythrough?.sample
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
        this.#lastCameraHeading = positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM
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

        const store = flythroughStore()
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
        const store = flythroughStore()
        if (store) {
            store.hoverSample = null
        }
    }

    stop = (options = {}) => {
        this.#clipSequenceToken++
        this.#stopStopClipPOIMaskLoop()
        this.#cancelActiveCameraFlight()
        this.#stopCameraLiveSyncLoop()
        const sample = this.#controller.stop({
            ...options,
            clearProgress: options.clearProgress ?? true,
        })
        this.#renderer.clear()
        this.#restoreOtherJourneysVisibility()
        this.#restoreCurrentJourneyVisibility({restorePOIs: false})
        this.#setFlythroughOrbitAllowed(true)
        this.#setContinuousRender(false)
        this.#removeToleranceZoneOverlay()
        this.#restorePlaybackCameraSettings()
        resetRuntimeProgress(flythroughStore())
        this.#restoreCurrentJourneyVisibility()
        this.#resetCameraController({preserveSavedCameraState: true})
        this.#restoreJourneyToolbarVisibility()
        if (options.emit !== false) {
            this.#focusJourneyAfterPlayback({
                snapDistance: 50000,
            })
        }
        else {
            this.#restoreCameraState()
        }
        return sample
    }

    #clipSettings = () => normalizeFlythroughClips(globalThis.lgs?.stores?.flythrough?.clips ?? getFlythroughSettings()?.clips ?? {})

    #clipListForSlot = (slot) => {
        const clips = this.#clipSettings()
        return slot === FLYTHROUGH_CLIP_SLOT_STOP ? clips.stop : clips.start
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
        const current = normalizeFlythroughCamera(globalThis.lgs?.stores?.flythrough?.camera ?? getFlythroughSettings().camera)
        const params = clip?.params ?? {}
        return normalizeFlythroughCamera({
            ...current,
            altitude: params.altitude ?? current.altitude,
            pitch:    params.pitch ?? current.pitch,
            hysteresis: {
                ...(current.hysteresis ?? {}),
            },
        })
    }

    #introHeadingForProgress = (progress = 0) => {
        const cameraSettings = normalizeFlythroughCamera(globalThis.lgs?.stores?.flythrough?.camera ?? getFlythroughSettings().camera)
        if (cameraSettings.positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM) {
            return degreesToRadians(cameraSettings.heading) ?? finiteNumber(globalThis.lgs?.viewer?.camera?.heading) ?? 0
        }

        return flythroughCameraHeadingForPositionMode({
            axisHeading: this.#headingFromPositionProperty(progress),
            positionMode: cameraSettings.positionMode,
        })
    }

    #targetSampleForClip = (sample, clipId) => flythroughTargetSampleForClip({
        sample,
        clipId,
        journey:               globalThis.lgs?.theJourney ?? null,
        sceneManager:          globalThis.__?.ui?.sceneManager ?? null,
        markerHeightForSample: this.#markerRenderHeightForSample,
    })

    #cameraClipFlight = async ({sample, clip, token}) => {
        const viewer = globalThis.lgs?.viewer
        if (!viewer?.camera || !sample) {
            return
        }

        const clipCamera = this.#cameraSettingsForClip(clip)
        const target = await this.#targetSampleForClip(sample, clip.clipId)
        const duration = Math.max(0, Number(clip?.params?.duration ?? clipCamera?.duration ?? 0))
        const northHeading = 0
        if (!target) {
            return
        }

        if (clip.clipId === 'zoom-in') {
            const flythroughCamera = normalizeFlythroughCamera(globalThis.lgs?.stores?.flythrough?.camera ?? getFlythroughSettings().camera)
            const startAltitude = finiteNumber(clip?.params?.altitude ?? clipCamera.altitude) ?? clipCamera.altitude
            const endAltitude = this.#cameraAltitudeForSample(target, flythroughCamera)
            const startHeight = Math.max(startAltitude, endAltitude)
            const endHeight = Math.min(startAltitude, endAltitude)
            const startHeading = northHeading
            const startPitch = degreesToRadians(finiteNumber(clip?.params?.pitch ?? clipCamera.pitch) ?? clipCamera.pitch)
                              ?? SAFE_TOP_DOWN_PITCH
            const endHeading = northHeading
            const endPitch = degreesToRadians(flythroughCamera.pitch) ?? SAFE_TOP_DOWN_PITCH

            this.#recenterCameraToSample({
                sample:         target,
                heading:        startHeading,
                pitch:          startPitch,
                cameraSettings: clipCamera,
                cameraHeight:   startHeight,
                instant:        true,
            })

            if (token !== this.#clipSequenceToken) {
                return
            }

            await this.#recenterCameraToSample({
                sample:         target,
                heading:        endHeading,
                pitch:          endPitch,
                cameraSettings: flythroughCamera,
                cameraHeight:   endHeight,
                duration,
            })

            return
        }

        if (clip.clipId === 'launch') {
            viewer.camera.setView?.({
                destination: safeCartesianFromLonLat({
                    longitude: target.longitude,
                    latitude:  target.latitude,
                    altitude:  finiteNumber(clipCamera.altitude) ?? 300,
                }),
            })
        }

        if (token !== this.#clipSequenceToken) {
            return
        }

        const landingFlight = clip.clipId === 'landing'
        const currentCamera = globalThis.lgs?.viewer?.camera
        const landingHeading = finiteNumber(currentCamera?.heading) ?? degreesToRadians(clipCamera.heading) ?? 0
        const landingPitch = finiteNumber(currentCamera?.pitch) ?? degreesToRadians(clipCamera.pitch) ?? SAFE_TOP_DOWN_PITCH
        if (landingFlight) {
            await globalThis.__?.ui?.cameraManager?.stopRotate?.()
        }
        await this.#recenterCameraToSample({
            sample:         target,
            heading:        landingFlight
                            ? landingHeading
                            : clip.clipId === 'zoom-out'
                            ? northHeading
                            : degreesToRadians(clipCamera.heading) ?? finiteNumber(currentCamera?.heading) ?? 0,
            pitch:          landingFlight
                            ? landingPitch
                            : degreesToRadians(clipCamera.pitch) ?? SAFE_TOP_DOWN_PITCH,
            cameraSettings: clipCamera,
            cameraHeight:   landingFlight
                            ? this.#markerRenderHeightForSample(target)
                            : finiteNumber(clipCamera.altitude) ?? null,
            instant:        landingFlight,
            duration,
        })
    }

    #runFlythroughClip = async (clip, {sample, token} = {}) => {
        if (!clip || token !== this.#clipSequenceToken) {
            return
        }

        switch (clip.clipId) {
            case 'launch':
            case 'zoom-in':
            case 'zoom-out':
            case 'landing':
                await this.#cameraClipFlight({sample, clip, token})
                return
            case 'focus': {
                const journey = globalThis.lgs?.theJourney
                const duration = Math.max(0, Number(clip?.params?.duration ?? 0))
                const rpm = Number.isFinite(Number(clip?.params?.rpm)) ? Number(clip.params.rpm) : undefined
                this.#setContinuousRender(true)
                this.#hideJourneyToolbarVisibility()
                const focusResult = typeof journey?.focus === 'function'
                    ? journey.focus({
                        resetCamera: true,
                        rotate:      true,
                        rpm,
                        snapDistance: 25000,
                    })
                    : globalThis.__?.ui?.sceneManager?.focusOnJourney?.({
                        journey,
                        target:      journey,
                        resetCamera: true,
                        rotate:      true,
                        rpm,
                        snapDistance: 25000,
                    })
                this.#applyFlythroughPOIVisibility()
                await Promise.resolve(focusResult)
                await this.#runClipDelay(duration)
                return
            }
            default:
                return
        }
    }

    #playFlythroughClips = async (slot, {sample = null, token = this.#clipSequenceToken} = {}) => {
        const clips = this.#clipListForSlot(slot)
        for (const clip of clips) {
            if (token !== this.#clipSequenceToken) {
                return false
            }
            await this.#runFlythroughClip(clip, {sample, token})
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
     * Recenter the current journey after the flythrough ends or is stopped.
     * The optional snapDistance keeps the transition instantaneous when the camera is already close.
     */
    #focusJourneyAfterPlayback = ({snapDistance = 50000} = {}) => {
        const journey = globalThis.lgs?.theJourney
        if (!journey) {
            return
        }

        journey.visible = true
        journey.updateVisibility?.(true)
        if (globalThis.lgs?.viewer?.dataSources) {
            TrackUtils.updatePOIsVisibility(journey, true)
        }
        this.#cameraFlightActive = false
        globalThis.lgs?.viewer?.camera?.cancelFlight?.()
        if (typeof journey.focus === 'function') {
            const focusResult = journey.focus({
                              resetCamera: true,
                              rotate: false,
                              snapDistance,
                          })
            Promise.resolve(focusResult).finally(() => this.#hideGloballyHiddenPOIs())
            return
        }

        const focusResult = globalThis.__?.ui?.sceneManager?.focusOnJourney?.({
                                                              journey,
                                                              target:      journey,
                                                              resetCamera: true,
                                                              rotate: false,
                                                              snapDistance,
                                                          })
        Promise.resolve(focusResult).finally(() => this.#hideGloballyHiddenPOIs())
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
        if (!preserveSavedCameraState) {
            this.#savedCameraState = null
            this.#playbackStartCameraSettings = null
            this.#playbackCameraUserAdjusted = false
        }
        this.#lastCameraHeading = null
        this.#lastCameraPitch = null
        this.#lastAppliedCameraView = null
        this.#cameraUserAdjusting = false
        this.#cameraApplyingView = false
        this.#cameraPointerActive = false
        this.#cameraAutoTrackingIgnoreUntil = 0
        this.#journeyToolbarHidden = false
        this.#journeyToolbarWasVisible = null
        this.#introHeadingTransition = null
        this.#removeToleranceZoneOverlay()
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
        this.#playbackStartCameraSettings = normalizeFlythroughCamera(
            globalThis.lgs?.stores?.flythrough?.camera
            ?? getFlythroughSettings().camera,
        )
        this.#playbackCameraUserAdjusted = false
        if (globalThis.lgs?.stores?.flythrough) {
            globalThis.lgs.stores.flythrough.cameraUserAdjusted = false
        }
    }

    #captureFlythroughDrawerStateBeforePlayback = () => {
        const drawerManager = globalThis.__?.ui?.drawerManager ?? null
        this.#flythroughDrawerWasOpenBeforePlayback = drawerManager?.isCurrent?.(FLYTHROUGH_DRAWER) === true
                                                || globalThis.lgs?.stores?.ui?.drawers?.open === FLYTHROUGH_DRAWER
        if (this.#flythroughDrawerWasOpenBeforePlayback) {
            drawerManager?.close?.()
        }
    }

    #markPlaybackCameraUserAdjusted = () => {
        this.#playbackCameraUserAdjusted = true
        if (globalThis.lgs?.stores?.flythrough) {
            globalThis.lgs.stores.flythrough.cameraUserAdjusted = true
        }
    }

    #restorePlaybackCameraSettings = () => {
        const store = flythroughStore()
        const initialCamera = this.#playbackStartCameraSettings
        const cameraUserAdjusted = this.#playbackCameraUserAdjusted || store?.cameraUserAdjusted === true
        this.#playbackStartCameraSettings = null
        this.#playbackCameraUserAdjusted = false

        if (store) {
            store.cameraUserAdjusted = false
        }

        if (!initialCamera || cameraUserAdjusted) {
            return null
        }

        return this.#persistCameraSettings(initialCamera)
    }

    #restoreFlythroughDrawerAfterPlayback = () => {
        if (!this.#flythroughDrawerWasOpenBeforePlayback) {
            return
        }

        this.#flythroughDrawerWasOpenBeforePlayback = false
        globalThis.__?.ui?.drawerManager?.open?.(FLYTHROUGH_DRAWER)
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
        console.error('[FlythroughMode] Playback listener failed. Flythrough stopped.', error)
        this.#clipSequenceToken++
        this.#stopStopClipPOIMaskLoop()
        this.#controller.stop({emit: false, clearProgress: false})
        this.#setContinuousRender(false)
        this.#renderer.clear()
        this.#restoreOtherJourneysVisibility()
        this.#restoreCurrentJourneyVisibility({restorePOIs: false})
        this.#setFlythroughOrbitAllowed(true)
        this.#deferStartCameraRecenter = false
        this.#resetCameraController({preserveSavedCameraState: true})
        this.#restoreJourneyToolbarVisibility()
        this.#restorePlaybackCameraSettings()
        resetRuntimeProgress(flythroughStore())
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
     * Hide the Journey Toolbar while a flythrough is running, and remember its previous visibility
     * so it can be restored when the flythrough ends.
     */
    #hideJourneyToolbarVisibility = () => {
        const toolbar = globalThis.lgs?.settings?.ui?.journeyToolbar
        if (toolbar && this.#journeyToolbarWasVisible === null) {
            this.#journeyToolbarWasVisible = toolbar.show === true
        }

        this.#journeyToolbarHidden = true
        globalThis.window?.dispatchEvent?.(new CustomEvent(FLYTHROUGH_JOURNEY_TOOLBAR_VISIBILITY_EVENT, {
            detail: {hidden: true},
        }))
    }

    /**
     * Restore the Journey Toolbar visibility to its pre-flythrough state.
     */
    #restoreJourneyToolbarVisibility = () => {
        this.#journeyToolbarHidden = false
        this.#journeyToolbarWasVisible = null
        globalThis.window?.dispatchEvent?.(new CustomEvent(FLYTHROUGH_JOURNEY_TOOLBAR_VISIBILITY_EVENT, {
            detail: {hidden: false},
        }))
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
        return Number.isFinite(angle) ? flythroughHeadingFromLocalAxisAngle(angle) : 0
    }

    #orientedHeadingFromWindowPoints = (points, current, future) => {
        const axisHeading = this.#headingFromWindowPoints(points)
        if (!Number.isFinite(axisHeading)) {
            return 0
        }

        const tangentHeading = this.#headingBetweenPoints(current, future)
        const delta = flythroughAngularDelta(axisHeading, tangentHeading)
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
            const point = spline.evaluate(progress)
            const cartographic = Cartographic.fromCartesian(point)
            const lonLat = cartographicToLonLat(cartographic)
            if (!lonLat) {
                return
            }

            guide.push({
                progress,
                ...lonLat,
                distanceFromStart: (this.#sampler?.totalDistance ?? 0) * progress,
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

        const cartographic = Cartographic.fromCartesian(position)
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

        if (cameraSettings.altitudeMode === FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET) {
            return groundHeight + cameraSettings.altitude
        }

        return cameraSettings.altitude
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
        const range = flythroughCameraRangeFromPitch(Math.max(1, cameraHeight - anchorHeight), safePitch)
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
            const outerBounds = flythroughInsetBounds(
                flythroughToleranceZoneBounds(cameraSettings?.hysteresis?.zone),
                FLYTHROUGH_TOLERANCE_OUTER_INSET_RATIO,
            )
            const safeBounds = flythroughInsetBounds(outerBounds, FLYTHROUGH_TOLERANCE_INNER_INSET_RATIO)
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
        const markerRadius = finiteNumber(globalThis.lgs?.stores?.flythrough?.markerRadius) ?? 35
        const overlayBounds = flythroughInsetBounds(
            flythroughToleranceZoneBounds(cameraSettings?.hysteresis?.zone),
            FLYTHROUGH_TOLERANCE_OUTER_INSET_RATIO,
        )
        const safeBounds = flythroughInsetBounds(overlayBounds, FLYTHROUGH_TOLERANCE_INNER_INSET_RATIO)
        return flythroughWindowCollisionFromPoint({
                                                      point:        point,
                                                      width:        rect.width,
                                                      height:       rect.height,
                                                      outerBounds:  overlayBounds,
                                                      safeBounds,
                                                      markerRadius,
                                                  })
    }

    #liveCameraPitch = fallback => {
        const cameraPitch = finiteNumber(globalThis.lgs?.viewer?.camera?.pitch)
        return cameraPitch ?? fallback
    }

    #terrainHeightForLonLat = (longitude, latitude) => {
        if (finiteNumber(longitude) === null || finiteNumber(latitude) === null) {
            return null
        }

        const globe = this.#cesiumScene()?.globe
        const height = globe?.getHeight?.(Cartographic.fromDegrees(longitude, latitude))
        return finiteNumber(height)
    }

    #persistCameraSettings = updates => {
        const current = getFlythroughSettings().camera
        const next = normalizeFlythroughCamera({
            ...current,
            ...updates,
            hysteresis: {
                ...(current?.hysteresis ?? {}),
                ...(updates?.hysteresis ?? {}),
            },
        })

        if (globalThis.lgs?.settings?.ui?.flythrough) {
            globalThis.lgs.settings.ui.flythrough.camera = next
        }
        if (globalThis.lgs?.stores?.flythrough) {
            globalThis.lgs.stores.flythrough.camera = next
        }

        return next
    }

    #updateCameraSettingsFromCesiumControls = (sample, {altitudeMode = null} = {}) => {
        const camera = globalThis.lgs?.viewer?.camera
        if (!camera || !sample) {
            return null
        }

        const sampleHeight = finiteNumber(sample?.altitude ?? sample?.height) ?? 0
        const terrainHeight = this.#terrainHeightForLonLat(sample?.longitude, sample?.latitude) ?? sampleHeight
        const cameraHeight = finiteNumber(camera.positionCartographic?.height)
        const currentAltitude = normalizeFlythroughCamera(globalThis.lgs?.stores?.flythrough?.camera ?? getFlythroughSettings().camera).altitude
        const currentCameraSettings = normalizeFlythroughCamera(globalThis.lgs?.stores?.flythrough?.camera ?? getFlythroughSettings().camera)
        const next = {
            pitch: clamp(Math.round(CesiumMath.toDegrees(camera.pitch)), -89, -5),
        }

        const headingDeg = Number.isFinite(camera.heading)
            ? clamp(Math.round(CesiumMath.toDegrees(camera.heading)), -180, 180)
            : undefined
        if (headingDeg !== undefined && currentCameraSettings.positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM) {
            next.heading = headingDeg
        }

        const nextAltitudeMode = altitudeMode ?? getFlythroughSettings().camera.altitudeMode
        if (nextAltitudeMode === FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET) {
            next.altitude = clamp(Math.max(10, (cameraHeight ?? (currentAltitude + terrainHeight)) - terrainHeight), 10, 100000)
        }
        else {
            next.altitude = clamp(cameraHeight ?? currentAltitude, 10, 100000)
        }

        return this.#persistCameraSettings(next)
    }

    #updateCameraFromCesiumControls = () => {
        const store = flythroughStore()
        if (store?.cameraUpdateSource === 'drawer') {
            return
        }
        this.#markPlaybackCameraUserAdjusted()
        this.syncCameraFromCesiumControls()
    }

    #syncCameraDrawerFromSettings = () => {
        const camera = normalizeFlythroughCamera(globalThis.lgs?.stores?.flythrough?.camera ?? getFlythroughSettings().camera)
        if (globalThis.lgs?.settings?.ui?.flythrough) {
            globalThis.lgs.settings.ui.flythrough.camera = camera
        }
        if (globalThis.lgs?.stores?.flythrough) {
            globalThis.lgs.stores.flythrough.camera = camera
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

        const delta = flythroughAngularDelta(prev, nextValue)
        if (delta === null) {
            return nextValue
        }

        return prev + delta * clamp(factor, 0, 1)
    }

    #lerpRadians = (start, end, ratio) => {
        const safeRatio = clamp(finiteNumber(ratio) ?? 0, 0, 1)
        const delta = flythroughAngularDelta(start, end)
        if (delta === null) {
            return finiteNumber(end) ?? finiteNumber(start) ?? 0
        }

        return (finiteNumber(start) ?? 0) + (delta * safeRatio)
    }

    #easeInOutCubic = value => {
        const t = clamp(finiteNumber(value) ?? 0, 0, 1)
        return t < 0.5
               ? 4 * t * t * t
               : 1 - Math.pow(-2 * t + 2, 3) / 2
    }

    #cubicBezierPoint = (p0, p1, p2, p3, t) => {
        const u = 1 - t
        const tt = t * t
        const uu = u * u
        const uuu = uu * u
        const ttt = tt * t
        return Cartesian3.add(
            Cartesian3.add(
                Cartesian3.add(
                    Cartesian3.multiplyByScalar(p0, uuu, new Cartesian3()),
                    Cartesian3.multiplyByScalar(p1, 3 * uu * t, new Cartesian3()),
                    new Cartesian3(),
                ),
                Cartesian3.multiplyByScalar(p2, 3 * u * tt, new Cartesian3()),
                new Cartesian3(),
            ),
            Cartesian3.multiplyByScalar(p3, ttt, new Cartesian3()),
            new Cartesian3(),
        )
    }

    #cancelCameraBezierTransition = (resolveValue = false) => {
        if (this.#cameraBezierFrame !== null) {
            globalThis.clearTimeout?.(this.#cameraBezierFrame)
            this.#cameraBezierFrame = null
        }
        if (this.#cameraBezierResolve !== null) {
            const resolve = this.#cameraBezierResolve
            this.#cameraBezierResolve = null
            resolve(resolveValue)
        }
        this.#cameraApplyingView = false
        this.#cameraFlightActive = false
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
                              : flythroughCameraRangeFromPitch(this.#cameraAltitudeForSample(sample, cameraSettings), pitch)
        if (!viewer || !target) {
            return null
        }

        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)
        const currentHeight = cameraHeight !== null && cameraHeight !== undefined
                              ? Math.max(targetHeight, finiteNumber(cameraHeight) ?? targetHeight)
                              : flythroughCameraRecenterHeight(
                viewer.camera?.positionCartographic?.height,
                this.#cameraAltitudeForSample(sample, cameraSettings),
            )
        const horizontalDistance = flythroughCameraRecenterHorizontalDistance({
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
            headingRadians:   Math.abs(flythroughAngularDelta(last.heading, heading) ?? Number.POSITIVE_INFINITY),
            pitchRadians:     Math.abs(flythroughAngularDelta(last.pitch, pitch) ?? Number.POSITIVE_INFINITY),
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

    #headingEasingFactor = (cameraSettings, targetHeading) => flythroughHeadingEasingFactor({
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

    #videoCropRect = () => {
        const flythroughStore = globalThis.lgs?.stores?.flythrough
        if (!flythroughStore?.recordingSync) {
            return null
        }

        const cropRect = flythroughStore.videoCropRect
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

        const outerBounds = flythroughInsetBounds(
            flythroughToleranceZoneBounds(hysteresis?.zone),
            FLYTHROUGH_TOLERANCE_OUTER_INSET_RATIO,
        )
        const innerBounds = flythroughInsetBounds(outerBounds, FLYTHROUGH_TOLERANCE_INNER_INSET_RATIO)
        const rect = this.#viewportRectForCesiumSurface()
        if (!rect.width || !rect.height) {
            return
        }

        const overlay = globalThis.document.createElement('div')
        overlay.className = 'flythrough-tolerance-zone-overlay'
        overlay.style.position = 'absolute'
        overlay.style.pointerEvents = 'none'
        overlay.style.left = `${outerBounds.left * rect.width}px`
        overlay.style.top = `${outerBounds.top * rect.height}px`
        overlay.style.width = `${(outerBounds.right - outerBounds.left) * rect.width}px`
        overlay.style.height = `${(outerBounds.bottom - outerBounds.top) * rect.height}px`
        overlay.style.background = 'rgba(255, 0, 0, 0.08)'

        const outer = globalThis.document.createElement('div')
        outer.className = 'flythrough-tolerance-zone-overlay-outer'
        outer.style.position = 'absolute'
        outer.style.inset = '0'
        outer.style.border = '1px solid rgba(255, 255, 255, 0.7)'

        const inner = globalThis.document.createElement('div')
        inner.className = 'flythrough-tolerance-zone-overlay-inner'
        inner.style.position = 'absolute'
        inner.style.left = `${((innerBounds.left - outerBounds.left) / (outerBounds.right - outerBounds.left)) * 100}%`
        inner.style.top = `${((innerBounds.top - outerBounds.top) / (outerBounds.bottom - outerBounds.top)) * 100}%`
        inner.style.width = `${((innerBounds.right - innerBounds.left) / (outerBounds.right - outerBounds.left)) * 100}%`
        inner.style.height = `${((innerBounds.bottom - innerBounds.top) / (outerBounds.bottom - outerBounds.top)) * 100}%`
        inner.style.border = '1px dashed rgba(255, 255, 255, 0.45)'

        overlay.append(outer, inner)
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

        this.#cameraFlightActive = true
        this.#cameraAutoTrackingIgnoreUntil = this.#now() + Math.max(180, duration * 1000 + 180)
        this.#rememberCameraView({anchor: sample, heading: safeHeading, pitch: safePitch})
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
        return this.#startCameraBezierTransition({
            sample,
            heading:        safeHeading,
            pitch:          safePitch,
            cameraSettings,
            cameraHeight:   frame.currentHeight,
            duration,
            endFrame:       frame,
        })
    }

    #startCameraBezierTransition = ({
                                        sample,
                                        heading,
                                        pitch,
                                        cameraSettings,
                                        cameraHeight = null,
                                        startDirection = null,
                                        endFrame = null,
                                        duration = FLYTHROUGH_HEADING_TRANSITION_DURATION_SECONDS,
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

        const startCamera = viewer.camera
        this.#cancelCameraBezierTransition(false)

        const startHeading = finiteNumber(startCamera.heading) ?? this.#lastCameraHeading ?? 0
        const startPitch = finiteNumber(startCamera.pitch) ?? this.#lastCameraPitch ?? SAFE_TOP_DOWN_PITCH
        const startHeight = finiteNumber(startCamera.positionCartographic?.height)
                            ?? cameraHeight
                            ?? frame.currentHeight
        const startFrame = this.#cameraRecenterFrame({
            sample,
            heading:        startHeading,
            pitch:          startPitch,
            cameraSettings,
            cameraHeight:   startHeight,
        })
        const endHeading = frame.safeHeading
        const endPitch = frame.safePitch
        const startTime = this.#now()
        const durationMillis = Math.max(1, Number(duration) * 1000)
        const endPosition = frame.destination
        const endDirection = frame.direction
        const startPosition = Cartesian3.clone(startCamera.positionWC ?? startCamera.position, new Cartesian3())
                              ?? startFrame?.destination
        const startDirectionVector = startDirection
                                     ?? Cartesian3.clone(
                                         startCamera.directionWC ?? startCamera.direction ?? startFrame?.direction,
                                         new Cartesian3(),
                                     )
        if (!startPosition) {
            return Promise.resolve(false)
        }

        const safeStartDirection = Cartesian3.magnitudeSquared(startDirectionVector) > CARTESIAN_EPSILON
                                   ? Cartesian3.normalize(startDirectionVector, startDirectionVector)
                                   : Cartesian3.subtract(endPosition, startPosition, new Cartesian3())
        const safeEndDirection = Cartesian3.magnitudeSquared(endDirection) > CARTESIAN_EPSILON
                                 ? Cartesian3.normalize(endDirection, endDirection)
                                 : Cartesian3.subtract(endPosition, startPosition, new Cartesian3())
        const delta = Cartesian3.subtract(endPosition, startPosition, new Cartesian3())
        const arcDistance = Math.max(
            25,
            Cartesian3.magnitude(delta) * 0.32,
            Math.abs((finiteNumber(startCamera.positionCartographic?.height) ?? 0) - frame.currentHeight) * 0.35,
        )
        const startUp = Cartesian3.normalize(startPosition, new Cartesian3())
        const endUp = Cartesian3.normalize(endPosition, new Cartesian3())
        const liftDirection = Cartesian3.normalize(
            Cartesian3.add(startUp, endUp, new Cartesian3()),
            new Cartesian3(),
        )
        const safeLiftDirection = Cartesian3.magnitudeSquared(liftDirection) > CARTESIAN_EPSILON
                                  ? liftDirection
                                  : Cartesian3.clone(endUp, new Cartesian3())
        const control1 = Cartesian3.add(
            startPosition,
            Cartesian3.add(
                Cartesian3.multiplyByScalar(safeStartDirection, arcDistance, new Cartesian3()),
                Cartesian3.multiplyByScalar(safeLiftDirection, arcDistance * 0.4, new Cartesian3()),
                new Cartesian3(),
            ),
            new Cartesian3(),
        )
        const control2 = Cartesian3.add(
            endPosition,
            Cartesian3.add(
                Cartesian3.multiplyByScalar(safeEndDirection, -arcDistance, new Cartesian3()),
                Cartesian3.multiplyByScalar(safeLiftDirection, arcDistance * 0.4, new Cartesian3()),
                new Cartesian3(),
            ),
            new Cartesian3(),
        )

        this.#cameraFlightActive = true
        this.#cameraApplyingView = true
        this.#cameraAutoTrackingIgnoreUntil = startTime + Math.max(180, durationMillis + 180)

        return new Promise(resolve => {
            this.#cameraBezierResolve = resolve

            const tick = () => {
                const now = this.#now()
                const ratio = clamp((now - startTime) / durationMillis, 0, 1)
                const t = this.#easeInOutCubic(ratio)
                const destination = this.#cubicBezierPoint(startPosition, control1, control2, endPosition, t)
                const headingNow = this.#lerpRadians(startHeading, endHeading, t)
                const pitchNow = this.#lerpRadians(startPitch, endPitch, t)

                try {
                    viewer.camera.setView?.({
                        destination,
                        orientation: {
                            heading: headingNow,
                            pitch:   pitchNow,
                            roll:    0,
                        },
                    })
                    this.#lastCameraHeading = headingNow
                    this.#lastCameraPitch = pitchNow
                }
                catch (error) {
                    console.error('[FlythroughMode] Bezier camera transition failed.', error)
                }

                if (ratio >= 1) {
                    this.#cameraBezierFrame = null
                    this.#cameraApplyingView = false
                    this.#cameraFlightActive = false
                    this.#cameraBezierResolve = null
                    this.#introHeadingTransition = null
                    this.#lastCameraHeading = endHeading
                    this.#lastCameraPitch = endPitch
                    resolve(true)
                    return
                }

                this.#cameraBezierFrame = globalThis.setTimeout?.(tick, 16) ?? null
            }

            tick()
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
            if (this.#cameraApplyingView || this.#now() < this.#cameraAutoTrackingIgnoreUntil) {
                return
            }
            if (!this.#cameraUserAdjusting && !this.#cameraPointerActive) {
                return
            }
            this.#updateCameraFromCesiumControls()
        }
        const refreshToleranceCameraAfterManualMove = () => {
            const settings = getFlythroughSettings()
            const marker = normalizeFlythroughMarker(globalThis.lgs?.stores?.flythrough?.marker ?? settings.marker)
            if (marker.mode === FLYTHROUGH_MARKER_MODE_HYSTERESIS) {
                this.refreshCamera({forceToleranceRecenter: true})
            }
        }
        const manualStart = ({pointer = false} = {}) => {
            if (this.#cameraFlightActive && !pointer) {
                return
            }
            if (pointer && this.#cameraFlightActive) {
                camera.cancelFlight?.()
                this.#cameraFlightActive = false
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
     * The flythrough drawer and the runtime settings rely on this bridge to stay in sync with live camera edits.
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
                     } = {}) => {
        const settings = getFlythroughSettings()
        const marker = normalizeFlythroughMarker(globalThis.lgs?.stores?.flythrough?.marker ?? settings.marker)
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

        if (marker.mode === FLYTHROUGH_MARKER_MODE_TRACE) {
            this.#cameraMode = marker.mode
            this.#cameraFlightActive = false
            this.#removeToleranceZoneOverlay()
            return
        }

        const cameraSettings = normalizeFlythroughCamera(globalThis.lgs?.stores?.flythrough?.camera ?? settings.camera)
        const markerSettings = normalizeFlythroughMarker(globalThis.lgs?.stores?.flythrough?.marker ?? settings.marker)
        const normalizedPitch = finiteNumber(cameraSettings?.pitch) ?? -65
        const pitch = source === 'drawer'
                      ? degreesToRadians(normalizedPitch)
                      : normalizedPitch <= -89
                        ? SAFE_TOP_DOWN_PITCH
                        : degreesToRadians(normalizedPitch)
        let desiredHeading
        if (cameraSettings.positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM) {
            if (Number.isFinite(cameraSettings?.heading)) {
                desiredHeading = degreesToRadians(cameraSettings.heading)
            }
            else {
                desiredHeading = (finiteNumber(this.#lastCameraHeading) ?? finiteNumber(globalThis.lgs?.viewer?.camera?.heading) ?? 0)
            }
        }
        else {
            desiredHeading = flythroughCameraHeadingForPositionMode({
                axisHeading: this.#headingFromPositionProperty(progress),
                positionMode: cameraSettings.positionMode,
            })
        }
        const heading = source === 'drawer'
                      ? desiredHeading
                      : flythroughCameraHeadingWithHysteresis({
                          previousHeading: this.#lastCameraHeading,
                          nextHeading:     desiredHeading,
                          threshold:       cameraSettings.positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM
                                            ? CAMERA_HEADING_HYSTERESIS_RADIANS
                                            : CAMERA_HEADING_MIN_CHANGE_RADIANS,
                      })
        const smoothHeading = source === 'drawer'
                              ? heading
                              : this.#smoothRadians(
                                  this.#lastCameraHeading,
                                  heading,
                                  this.#headingEasingFactor(cameraSettings, heading),
                              )
        const smoothPitch = source === 'drawer'
                            ? pitch
                            : this.#smoothRadians(this.#lastCameraPitch, pitch, 0.08)
        const anchorSample = this.#markerPositionForSample(sample, markerSettings)
        const introTransition = this.#introHeadingTransition
        if (introTransition) {
            const now = this.#now()
            if (now < introTransition.startAt) {
                return
            }

            if (now < introTransition.endAt) {
                if (!introTransition.applied) {
                    introTransition.applied = true
                    const introCameraSettings = normalizeFlythroughCamera({
                        ...cameraSettings,
                        altitudeMode: FLYTHROUGH_CAMERA_ALTITUDE_CONSTANT,
                        altitude:     Math.max(10, introTransition.height),
                    })
                    this.#recenterCameraToSample({
                        sample:         anchorSample,
                        heading:        introTransition.targetHeading ?? heading,
                        pitch:          introTransition.fromPitch,
                        cameraSettings: introCameraSettings,
                        cameraHeight:   Math.max(10, introTransition.height),
                        duration:       FLYTHROUGH_HEADING_TRANSITION_DURATION_SECONDS,
                    })
                }
                this.#lastCameraHeading = heading
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
        }

        if (marker.mode === FLYTHROUGH_MARKER_MODE_NAVIGATION) {
            this.#removeToleranceZoneOverlay()
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

        if (marker.mode === FLYTHROUGH_MARKER_MODE_HYSTERESIS) {
            this.#updateToleranceZoneOverlay(cameraSettings.hysteresis)
            const collision = this.#cameraCollisionForSample(anchorSample, cameraSettings)
            const outsideTolerance = collision?.shouldMove ?? false
            if (!outsideTolerance && !forceToleranceRecenter && !immediateToleranceRecenter) {
                this.#lastToleranceRecenterProgress = null
                this.#lastCameraHeading = smoothHeading
                this.#lastCameraPitch = smoothPitch
                return
            }

            const now = this.#now()
            const currentProgress = finiteNumber(progress)
            const sameProgressRecenter = currentProgress !== null
                                         && this.#lastToleranceRecenterProgress !== null
                                         && this.#lastToleranceRecenterAt !== null
                                         && Math.abs(currentProgress - this.#lastToleranceRecenterProgress) <= 0.000001
                                         && now - this.#lastToleranceRecenterAt < 80
            const activeRecenterStillFresh = this.#cameraFlightActive
                                            && this.#lastToleranceRecenterAt !== null
                                            && now - this.#lastToleranceRecenterAt < FLYTHROUGH_TOLERANCE_RECENTER_REPLACE_DELAY_MS
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

            if (outsideTolerance || forceToleranceRecenter || immediateToleranceRecenter) {
                this.#recenterCameraToSample({
                    sample: anchorSample,
                    heading: smoothHeading,
                    pitch:    this.#liveCameraPitch(smoothPitch),
                    cameraSettings,
                    duration: immediateToleranceRecenter
                              ? 0
                              : flythroughCameraRecenterDuration(cameraSettings.hysteresis.easing),
                })
                this.#lastToleranceRecenterProgress = currentProgress
                this.#lastToleranceRecenterAt = now
            }
            this.#lastCameraHeading = smoothHeading
            this.#lastCameraPitch = smoothPitch
        }
    }

    #bindRenderer = () => {
        this.#unbind.push(
            this.#controller.on(FLYTHROUGH_EVENT_START, detail => {
                try {
                    this.#hideJourneyToolbarVisibility()
                    this.#setContinuousRender(true)
                    this.#renderer.show({
                        sampler: detail.sampler,
                        options: {smoothedGuide: this.#smoothedGuide()},
                    })
                    const startSample = detail.sample
                                        ?? detail.sampler?.atProgress?.(detail.progress ?? 0)
                                        ?? currentFlythroughSample(this.#controller)

                    this.#renderer.update({...detail, forceGeometry: true})
                    void this.#syncNearbyPOIsForSample(startSample ?? detail.sample ?? null)
                    if (!this.#deferStartCameraRecenter) {
                        this.#updateCamera({
                                               ...detail,
                                               forceToleranceRecenter:     true,
                                               immediateToleranceRecenter: true,
                                           })
                    }
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
            this.#controller.on(FLYTHROUGH_EVENT_UPDATE, detail => {
                try {
                    this.#renderer.update({
                        ...detail,
                        sampler: this.#sampler,
                    })
                    void this.#syncNearbyPOIsForSample(detail.sample ?? null)
                    this.#updateCamera(detail)
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
            this.#controller.on(FLYTHROUGH_EVENT_PAUSE, detail => {
                this.#setContinuousRender(false)
                try {
                    this.#renderer.update({...detail, freezeDynamic: true})
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
            this.#controller.on(FLYTHROUGH_EVENT_RESUME, detail => {
                try {
                    this.#setContinuousRender(true)
                    this.#renderer.update({...detail, forceGeometry: true})
                    this.#updateCamera(detail)
                }
                catch (error) {
                    this.#abortPlaybackAfterListenerError(error)
                }
            }),
            this.#controller.on(FLYTHROUGH_EVENT_STOP, () => {
                this.#clipSequenceToken++
                this.#stopStopClipPOIMaskLoop()
                this.#setContinuousRender(false)
                this.#renderer.clear()
                this.#restoreOtherJourneysVisibility()
                this.#restoreCurrentJourneyVisibility({restorePOIs: false})
                this.#setFlythroughOrbitAllowed(true)
                this.#deferStartCameraRecenter = false
                this.#restoreJourneyToolbarVisibility()
                this.#restoreFlythroughDrawerAfterPlayback()
                void this.#restoreNearbyPOIsAfterPlayback()
                this.#restorePlaybackCameraSettings()
                resetRuntimeProgress(flythroughStore())
                this.#restoreCurrentJourneyVisibility()
            }),
            this.#controller.on(FLYTHROUGH_EVENT_END, detail => {
                const token = this.#clipSequenceToken
                const sample = detail.sampler?.atProgress?.(1)
                              ?? detail.sample
                              ?? currentFlythroughSample(this.#controller)
                const stopList = this.#clipListForSlot(FLYTHROUGH_CLIP_SLOT_STOP)
                const notifyStopClipsComplete = () => {
                    globalThis.window?.dispatchEvent?.(new CustomEvent(FLYTHROUGH_EVENT_STOP_CLIPS_COMPLETE, {
                        detail: {
                            sample,
                            progress: detail.progress ?? null,
                        },
                    }))
                }
                const finalize = () => {
                    if (token !== this.#clipSequenceToken) {
                        return
                    }

                    this.#stopStopClipPOIMaskLoop()
                    this.#setContinuousRender(false)
                    this.#renderer.clear()
                    this.#restoreOtherJourneysVisibility()
                    this.#restoreCurrentJourneyVisibility({restorePOIs: false})
                    this.#setFlythroughOrbitAllowed(true)
                    this.#deferStartCameraRecenter = false
                    this.#restoreJourneyToolbarVisibility()
                    this.#restoreFlythroughDrawerAfterPlayback()
                    void this.#restoreNearbyPOIsAfterPlayback()
                    this.#restorePlaybackCameraSettings()
                    resetRuntimeProgress(flythroughStore())
                    this.#restoreCurrentJourneyVisibility()
                    this.#focusJourneyAfterPlayback()
                }

                try {
                    this.#renderer.update({
                        ...detail,
                        sampler: this.#sampler,
                        forceGeometry: true,
                        freezeDynamic:  true,
                    })
                    this.#startStopClipPOIMaskLoop()

                    if (token !== this.#clipSequenceToken) {
                        return
                    }

                    if (stopList.length === 0) {
                        notifyStopClipsComplete()
                        finalize()
                        return
                    }

                    void (async () => {
                        try {
                            await this.#playFlythroughClips(FLYTHROUGH_CLIP_SLOT_STOP, {
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
