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
    FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET, FLYTHROUGH_CAMERA_POSITION_AHEAD, FLYTHROUGH_CAMERA_POSITION_SYSTEM,
    FLYTHROUGH_MARKER_MODE_HYSTERESIS, FLYTHROUGH_MARKER_MODE_NAVIGATION, FLYTHROUGH_MARKER_MODE_TRACE,
    getFlythroughSettings, normalizeFlythroughCamera,
    normalizeFlythroughMarker, normalizeFlythroughTrace,
}                                                             from './FlythroughProgressionStyle'

const DEFAULT_DURATION = 60
const PROFILE_HOVER_RENDER_INTERVAL = 120
const METRIC_OVERLAY_TTL = 2000
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
export const FLYTHROUGH_JOURNEY_TOOLBAR_VISIBILITY_EVENT = 'lgs:flythrough:journey-toolbar-visibility'

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
    #savedCameraState = null
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
    #cameraBridgeBound = false
    #cameraLiveSyncFrame = null

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

        void globalThis.__?.ui?.cameraManager?.stopRotate?.()
        this.#captureCameraState()
        const startSample = sampler.atProgress?.(options.progress ?? 0)
        if (startSample) {
            try {
                this.syncCameraFromCesiumControls({sample: startSample})
            }
            catch (error) {
                console.debug('[FlythroughMode] Failed to seed camera from Cesium on start.', error)
            }
        }

        return this.#controller.start({
            progress: options.progress ?? 0,
        })
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
        const sample = currentFlythroughSample(this.#controller)
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
        this.#cancelActiveCameraFlight()
        this.#stopCameraLiveSyncLoop()
        const sample = this.#controller.stop({
            ...options,
            clearProgress: options.clearProgress ?? true,
        })
        this.#renderer.clear()
        this.#setContinuousRender(false)
        this.#removeToleranceZoneOverlay()
        this.#resetCameraController({preserveSavedCameraState: true})
        this.#restoreJourneyToolbarVisibility()
        resetRuntimeProgress(flythroughStore())
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

    #cancelActiveCameraFlight = () => {
        const camera = globalThis.lgs?.viewer?.camera
        camera?.cancelFlight?.()
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

        this.#cameraFlightActive = false
        globalThis.lgs?.viewer?.camera?.cancelFlight?.()
        if (typeof journey.focus === 'function') {
            journey.focus({
                              resetCamera: true,
                              rotate: false,
                              snapDistance,
                          })
            return
        }

        globalThis.__?.ui?.sceneManager?.focusOnJourney?.({
                                                              journey,
                                                              target:      journey,
                                                              resetCamera: true,
                                                              rotate: false,
                                                              snapDistance,
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
        this.#lastToleranceRecenterAt = null
        this.#lastToleranceRecenterProgress = null
        if (!preserveSavedCameraState) {
            this.#savedCameraState = null
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

    #captureCameraState = () => {
        const camera = globalThis.lgs?.viewer?.camera
        const position = camera?.positionCartographic
        if (!camera || !position) {
            this.#savedCameraState = null
            return null
        }

        this.#savedCameraState = {
            destination: {
                longitude: CesiumMath.toDegrees(position.longitude),
                latitude:  CesiumMath.toDegrees(position.latitude),
                height:    position.height,
            },
            orientation: {
                heading: camera.heading,
                pitch:   camera.pitch,
                roll:    camera.roll,
            },
        }
        return this.#savedCameraState
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
                state.destination.height,
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
        this.#controller.stop({emit: false, clearProgress: false})
        this.#setContinuousRender(false)
        this.#renderer.clear()
        this.#resetCameraController({preserveSavedCameraState: true})
        this.#restoreJourneyToolbarVisibility()
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
        minFactor:       cameraSettings?.positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM ? 0.04 : 0.05,
        maxFactor:       cameraSettings?.positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM ? 0.18 : 0.22,
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
        void hysteresis
        this.#removeToleranceZoneOverlay()
    }

    #recenterCameraToSample = ({
                                   sample,
                                   heading,
                                   pitch,
                                   cameraSettings,
                                   duration = 1.0,
                               }) => {
        const viewer = globalThis.lgs?.viewer
        const targetHeight = this.#markerRenderHeightForSample(sample)
        const target = this.#markerRenderCartesianForSample(sample)
        const cameraPosition = viewer?.camera?.positionWC ?? viewer?.camera?.position
        const fallbackRange = cameraPosition && target
                              ? Cartesian3.distance(cameraPosition, target)
                              : flythroughCameraRangeFromPitch(this.#cameraAltitudeForSample(sample, cameraSettings), pitch)
        if (!viewer || !target) {
            return
        }
        if (this.#cameraFlightActive) {
            viewer.camera?.cancelFlight?.()
            this.#cameraFlightActive = false
        }

        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)
        const currentHeight = flythroughCameraRecenterHeight(
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
        const finishFlight = () => {
            this.#cameraFlightActive = false
        }

        this.#cameraFlightActive = true
        this.#cameraAutoTrackingIgnoreUntil = this.#now() + Math.max(180, duration * 1000 + 180)
        this.#rememberCameraView({anchor: sample, heading: safeHeading, pitch: safePitch})
        if (duration <= 0 || typeof viewer.camera.flyTo !== 'function') {
            viewer.camera.setView?.({
                                        destination,
                                        orientation: {
                                            direction,
                                            up: correctedUp,
                                        },
                                    })
            finishFlight()
            return
        }

        if (typeof viewer.camera.flyTo === 'function') {
            viewer.camera.flyTo({
                                    destination,
                                    orientation:       {
                                        direction,
                                        up: correctedUp,
                                    },
                                    duration,
                                    maximumHeight:     currentHeight,
                                    pitchAdjustHeight: Number.POSITIVE_INFINITY,
                                    complete:          finishFlight,
                                    cancel:            finishFlight,
                                })

        }
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
            this.syncCameraFromCesiumControls()
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
                     } = {}) => {
        const settings = getFlythroughSettings()
        const marker = normalizeFlythroughMarker(globalThis.lgs?.stores?.flythrough?.marker ?? settings.marker)
        if (!sample) {
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
        const pitch = normalizedPitch <= -89
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
        const heading = flythroughCameraHeadingWithHysteresis({
            previousHeading: this.#lastCameraHeading,
            nextHeading:     desiredHeading,
            threshold:       cameraSettings.positionMode === FLYTHROUGH_CAMERA_POSITION_SYSTEM
                              ? CAMERA_HEADING_HYSTERESIS_RADIANS
                              : CAMERA_HEADING_MIN_CHANGE_RADIANS,
        })
        const smoothHeading = this.#smoothRadians(
            this.#lastCameraHeading,
            heading,
            this.#headingEasingFactor(cameraSettings, heading),
        )
        const smoothPitch = this.#smoothRadians(this.#lastCameraPitch, pitch, 0.1)
        const anchorSample = this.#markerPositionForSample(sample, markerSettings)

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
                              : Math.max(0.25, 1.2 * (1 - cameraSettings.hysteresis.easing)),
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
                    // Sync live Cesium camera into settings so the flythrough starts with the current view
                    try {
                        this.syncCameraFromCesiumControls({sample: startSample})
                    }
                    catch (err) {
                        // Non-fatal - fall back to existing behavior
                        console.debug('[FlythroughMode] syncCameraFromCesiumControls failed on start', err)
                    }

                    this.#renderer.update({...detail, forceGeometry: true})
                    this.#updateCamera({
                                           ...detail,
                                           forceToleranceRecenter:     true,
                                           immediateToleranceRecenter: true,
                                       })
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
                this.#setContinuousRender(false)
                this.#renderer.clear()
                this.#restoreJourneyToolbarVisibility()
                resetRuntimeProgress(flythroughStore())
            }),
            this.#controller.on(FLYTHROUGH_EVENT_END, () => {
                this.#setContinuousRender(false)
                this.#renderer.clear()
                this.#restoreJourneyToolbarVisibility()
                resetRuntimeProgress(flythroughStore())
                this.#focusJourneyAfterPlayback()
            }),
        )
    }
}
