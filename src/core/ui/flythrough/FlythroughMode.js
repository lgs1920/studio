/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughMode.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-11
 * Last modified: 2026-05-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    Cartesian3,
    Cartographic,
    CatmullRomSpline,
    ExtrapolationType,
    JulianDate,
    LinearApproximation,
    Math as CesiumMath,
    SampledPositionProperty,
    SceneTransforms,
} from 'cesium'
import { FlythroughCesiumRenderer }                           from './FlythroughCesiumRenderer'
import { isFlythroughDebugEnabled, recordFlythroughDebug }    from './FlythroughDebug'
import { FLYTHROUGH_SCOPE_ALL_TRACKS, FlythroughPathSampler } from './FlythroughPathSampler'
import {
    FLYTHROUGH_EVENT_END, FLYTHROUGH_EVENT_PAUSE, FLYTHROUGH_EVENT_RESUME, FLYTHROUGH_EVENT_START,
    FLYTHROUGH_EVENT_STOP, FLYTHROUGH_EVENT_UPDATE, FlythroughPlaybackController,
}                                                             from './FlythroughPlaybackController'
import {
    FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET,
    FLYTHROUGH_MARKER_MODE_HYSTERESIS,
    FLYTHROUGH_MARKER_MODE_NAVIGATION,
    FLYTHROUGH_MARKER_MODE_TRACE,
    getFlythroughSettings,
    normalizeFlythroughCamera,
    normalizeFlythroughMarker,
    normalizeFlythroughTrace,
}                                                             from './FlythroughProgressionStyle'

const DEFAULT_DURATION = 60
const PROFILE_HOVER_RENDER_INTERVAL = 120
const METRIC_OVERLAY_TTL = 2000
const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)
const CAMERA_GUIDE_MIN_STEPS = 512
const CAMERA_GUIDE_MAX_STEPS = 4096
const CAMERA_HEADING_DELTA = 0.002
const CAMERA_GUIDE_TARGET_SPACING_METERS = 12
const CAMERA_GUIDE_TURN_STEP_RADIANS = Math.PI / 18
const CARTESIAN_EPSILON = 1e-7

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

const lerp = (start, end, ratio) => start + ((end - start) * ratio)

const hasFiniteLonLat = point => finiteNumber(point?.longitude) !== null && finiteNumber(point?.latitude) !== null

const sanitizeOrientationRadians = (value, fallback) => finiteNumber(value) ?? fallback

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

        return this.#sampler
    }

    start = (options = {}) => {
        this.#renderer.clear()
        const sampler = this.configure(options)
        if (!sampler?.hasSamples) {
            return null
        }

        return this.#controller.start({
            progress: options.progress ?? 0,
        })
    }

    pause = () => this.#controller.pause()

    resume = () => this.#controller.resume()

    setLoop = loop => {
        const enabled = this.#controller.setLoop(loop)
        const store = flythroughStore()
        if (store) {
            store.loop = enabled
        }
        return enabled
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

    refresh = () => {
        const sample = this.#controller.currentSample()
        if (sample && this.#sampler) {
            this.#renderer.update({
                sample,
                sampler: this.#sampler,
                forceGeometry: true,
            })
        }
        return sample
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
        const sample = this.#controller.stop({
            ...options,
            clearProgress: options.clearProgress ?? true,
        })
        this.#renderer.clear()
        this.#resetCameraController()
        resetRuntimeProgress(flythroughStore())
        return sample
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

    #resetCameraController = () => {
        this.#cameraGuide = null
        this.#cameraGuideSourceKey = null
        this.#cameraGuidePositionProperty = null
        this.#cameraGuidePositionPropertyKey = null
        this.#cameraMode = null
        this.#cameraFlightActive = false
        if (globalThis.lgs?.viewer) {
            globalThis.lgs.viewer.trackedEntity = undefined
            globalThis.lgs.viewer.camera?.cancelFlight?.()
        }
    }

    #setContinuousRender = (enabled) => {
        const scene = globalThis.lgs?.scene
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
        this.#resetCameraController()
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

    #sampleAtProgress = (progress) => this.#sampler?.atProgress?.(clamp(Number(progress) || 0, 0, 1)) ?? null

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
            })
        })

        this.#cameraGuide = guide
        this.#cameraGuideSourceKey = key
        return guide
    }

    #guideSampleAtProgress = (progress) => {
        const guide = this.#buildCameraGuide()
        if (!guide?.length) {
            return this.#sampleAtProgress(progress)
        }

        const safeProgress = clamp(Number(progress) || 0, 0, 1)
        if (guide.length === 1) {
            return guide[0]
        }

        let low = 0
        let high = guide.length - 1

        while (low < high) {
            const mid = Math.floor((low + high) / 2)
            if ((guide[mid]?.progress ?? 0) < safeProgress) {
                low = mid + 1
            }
            else {
                high = mid
            }
        }

        const rightIndex = Math.max(0, Math.min(guide.length - 1, low))
        const leftIndex = Math.max(0, rightIndex - 1)
        const left = guide[leftIndex]
        const right = guide[rightIndex]

        if (!left || !right) {
            return left ?? right ?? null
        }

        const progressSpan = Math.max(0, (right.progress ?? 0) - (left.progress ?? 0))
        const ratio = progressSpan > 0 ? (safeProgress - left.progress) / progressSpan : 0

        return {
            progress: safeProgress,
            longitude: lerp(left.longitude, right.longitude, ratio),
            latitude:  lerp(left.latitude, right.latitude, ratio),
            altitude:  lerp(left.altitude ?? 0, right.altitude ?? 0, ratio),
        }
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
        }
    }

    #headingFromPositionProperty = progress => {
        const current = this.#guideSampleFromPositionProperty(progress)
        const next = this.#guideSampleFromPositionProperty(Math.min(1, (Number(progress) || 0) + CAMERA_HEADING_DELTA))
            ?? this.#guideSampleFromPositionProperty(Math.max(0, (Number(progress) || 0) - CAMERA_HEADING_DELTA))
        if (!hasFiniteLonLat(current) || !hasFiniteLonLat(next)) {
            return 0
        }

        return this.#headingBetweenPoints(current, next)
    }

    #cameraAltitudeForSample = (sample, cameraSettings) => {
        const longitude = sample?.longitude
        const latitude = sample?.latitude
        if (finiteNumber(longitude) === null || finiteNumber(latitude) === null) {
            return cameraSettings.altitude
        }
        const terrainHeight = globalThis.lgs?.scene?.globe?.getHeight?.(
            Cartographic.fromDegrees(longitude, latitude),
        )
        const sampleHeight = finiteNumber(sample?.altitude ?? sample?.height) ?? 0
        const groundHeight = finiteNumber(terrainHeight) ?? sampleHeight

        if (cameraSettings.altitudeMode === FLYTHROUGH_CAMERA_ALTITUDE_GROUND_OFFSET) {
            return groundHeight + cameraSettings.groundOffset
        }

        return cameraSettings.altitude
    }

    #applyCameraView = ({anchor, heading, pitch, cameraSettings}) => {
        const destination = safeCartesianFromLonLat({
            ...anchor,
            altitude: this.#cameraAltitudeForSample(anchor, cameraSettings),
        })
        if (!destination) {
            return
        }

        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)

        globalThis.lgs?.viewer?.camera?.setView?.({
            destination,
            orientation: {
                heading: safeHeading,
                pitch:   safePitch,
                roll: 0,
            },
        })
    }

    #isSampleOutsideToleranceZone = (sample, marginRatio) => {
        const viewer = globalThis.lgs?.viewer
        const scene = globalThis.lgs?.scene
        const position = safeCartesianFromLonLat(sample)
        if (!viewer || !scene || !position) {
            return false
        }

        const windowPosition = SceneTransforms.worldToWindowCoordinates(
            scene,
            position,
        )
        if (!windowPosition) {
            return false
        }

        const marginX = viewer.canvas.clientWidth * marginRatio
        const marginY = viewer.canvas.clientHeight * marginRatio
        return windowPosition.x < marginX
            || windowPosition.x > viewer.canvas.clientWidth - marginX
            || windowPosition.y < marginY
            || windowPosition.y > viewer.canvas.clientHeight - marginY
    }

    #recenterCameraToSample = ({sample, heading, pitch, cameraSettings, duration = 1.0}) => {
        const viewer = globalThis.lgs?.viewer
        const destination = safeCartesianFromLonLat({
            ...sample,
            altitude: this.#cameraAltitudeForSample(sample, cameraSettings),
        })
        if (!viewer || !destination || this.#cameraFlightActive) {
            return
        }

        const safeHeading = sanitizeOrientationRadians(heading, 0)
        const safePitch = sanitizeOrientationRadians(pitch, SAFE_TOP_DOWN_PITCH)

        this.#cameraFlightActive = true
        viewer.camera.flyTo?.({
            destination,
            orientation: {
                heading: safeHeading,
                pitch:   safePitch,
                roll: 0,
            },
            duration,
            complete: () => {
                this.#cameraFlightActive = false
            },
            cancel: () => {
                this.#cameraFlightActive = false
            },
        })
    }

    #recordCameraDebug = ({
                              sample,
                              progress,
                              markerMode,
                              cameraSettings = null,
                              guideSample = null,
                              heading = null,
                              pitch = null,
                              action = null,
                              outsideTolerance = null,
                              trackedEntity = globalThis.lgs?.viewer?.trackedEntity,
                          } = {}) => {
        if (!isFlythroughDebugEnabled()) {
            return
        }

        recordFlythroughDebug('camera:update', {
            markerMode,
            cameraMode:       this.#cameraMode,
            action,
            progress,
            distance:         sample?.distanceFromStart,
            guideProgress:    guideSample?.progress,
            guideSize:        this.#cameraGuide?.length ?? null,
            trackedEntityId:  trackedEntity?.id ?? null,
            outsideTolerance,
            flightActive:     this.#cameraFlightActive,
            keepNorth:        cameraSettings?.keepNorth ?? null,
            headingDeg:       radiansToDegrees(heading),
            pitchDeg:         radiansToDegrees(pitch),
            cameraHeight:     globalThis.lgs?.viewer?.camera?.positionCartographic?.height ?? null,
        })
    }

    #updateCamera = ({sample, progress} = {}) => {
        const settings = getFlythroughSettings()
        const marker = normalizeFlythroughMarker(globalThis.lgs?.stores?.flythrough?.marker ?? settings.marker)
        if (!sample) {
            return
        }

        if (globalThis.lgs?.viewer) {
            globalThis.lgs.viewer.trackedEntity = undefined
        }

        if (marker.mode === FLYTHROUGH_MARKER_MODE_TRACE) {
            this.#cameraMode = marker.mode
            this.#cameraFlightActive = false
            this.#recordCameraDebug({
                sample,
                progress,
                markerMode: marker.mode,
                action:     'detached',
            })
            return
        }

        const cameraSettings = normalizeFlythroughCamera(globalThis.lgs?.stores?.flythrough?.camera ?? settings.camera)
        const guideSample = this.#guideSampleFromPositionProperty(progress) ?? this.#guideSampleAtProgress(progress) ?? sample
        const normalizedPitch = finiteNumber(cameraSettings?.pitch) ?? -65
        const pitch = normalizedPitch <= -89
                      ? SAFE_TOP_DOWN_PITCH
                      : degreesToRadians(normalizedPitch)
        const heading = cameraSettings.keepNorth ? 0 : this.#headingFromPositionProperty(progress)

        if (this.#cameraMode !== marker.mode) {
            this.#cameraMode = marker.mode
            this.#cameraFlightActive = false
        }

        if (marker.mode === FLYTHROUGH_MARKER_MODE_NAVIGATION) {
            this.#applyCameraView({
                anchor: guideSample,
                heading,
                pitch,
                cameraSettings,
            })
            this.#recordCameraDebug({
                sample,
                progress,
                markerMode: marker.mode,
                cameraSettings,
                guideSample,
                heading,
                pitch,
                action:     'setView',
            })
            return
        }

        if (marker.mode === FLYTHROUGH_MARKER_MODE_HYSTERESIS) {
            const marginRatio = cameraSettings.hysteresis.marginRatio
            const outsideTolerance = this.#isSampleOutsideToleranceZone(sample, marginRatio)
            if (outsideTolerance) {
                this.#recenterCameraToSample({
                    sample,
                    heading: cameraSettings.keepNorth ? 0 : heading,
                    pitch,
                    cameraSettings,
                    duration: Math.max(0.15, 1.5 * (1 - cameraSettings.hysteresis.easing)),
                })
            }
            this.#recordCameraDebug({
                sample,
                progress,
                markerMode: marker.mode,
                cameraSettings,
                guideSample,
                heading,
                pitch,
                action: outsideTolerance ? 'flyTo' : 'idle',
                outsideTolerance,
            })
        }
    }

    #bindRenderer = () => {
        this.#unbind.push(
            this.#controller.on(FLYTHROUGH_EVENT_START, detail => {
                try {
                    this.#setContinuousRender(true)
                    this.#renderer.show({
                        sampler: detail.sampler,
                        options: {smoothedGuide: this.#smoothedGuide()},
                    })
                    this.#renderer.update({...detail, forceGeometry: true})
                    this.#updateCamera(detail)
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
                    this.#updateCamera(detail)
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
                resetRuntimeProgress(flythroughStore())
            }),
            this.#controller.on(FLYTHROUGH_EVENT_END, () => {
                this.#setContinuousRender(false)
                this.#renderer.clear()
                resetRuntimeProgress(flythroughStore())
            }),
        )
    }
}
