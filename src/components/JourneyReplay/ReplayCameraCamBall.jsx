/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayCameraCamBall.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-29
 * Last modified: 2026-11-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Widget} from '@Components/MainUI/widgets/Widget'
import {LGS_WIDGET, SCENE_WIDGETS, SCENE_WIDGETS_BOARD} from '@Core/constants'
import {UI_ACTIONS} from '@Core/ui/metadata/uiActionCatalog'
import {getMainSceneCameraPivot} from '@Core/ui/MainSceneCameraPivot'
import {normalizeJourneyReplayCamera} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {currentJourneyReplayCameraSettings, isJourneyReplayCameraActive} from '@Core/ui/replay/JourneyReplayRuntime'
import {isCameraOwnedByReplay} from '@Core/ui/replay/ReplayCameraOwnership'
import {useOptionalSnapshot, useProxyValue} from '@Utils/ValtioUtils'
import {WaIcon} from '@awesome.me/webawesome/dist/react'
import {
    Cartesian2, Cartesian3, Math as CesiumMath, Matrix3, Matrix4, Quaternion, Ray, SceneMode,
} from 'cesium'
import {useCallback, useEffect, useRef, useState} from 'react'
import './replayCameraCamBall.css'

const CONFIG = {
    id: 'replay-camera-joystick-widget',
    type: LGS_WIDGET,
    widgetsBoard: SCENE_WIDGETS_BOARD,
    group: SCENE_WIDGETS,
    left: '90%',
    top: '55%',
    attachTo: 'right',
    margin: 24,
    draggable: true,
    shiftDragEnabled: false,
    canReduce: false,
    canLock: false,
    contextMenu: {canRemove: false},
    persist: false,
    transient: true,
    stopPropagation: true,
    resizable: false,
    scalable: false,
    rotatable: false,
    showControlBox: false,
    zIndex: 'var(--lgs-tools-ui-zindex)',
}

const MAIN_SCENE_CONFIG = {...CONFIG, id: 'main-camera-joystick-widget'}

/** Scale pointer-held CamBall gestures into a gentler Replay camera adjustment rate. */
const CAM_BALL_POINTER_SENSITIVITY = 0.7
const CAM_BALL_CAMERA_SPEED = 1.4
const CAM_BALL_PRECISION_FACTOR = 0.35

/** Limit full-deflection pitch adjustment to 22.5 degrees per second. */
const CAM_BALL_PITCH_DEGREES_PER_SECOND = 22.5
const CAM_BALL_HORIZON_MARGIN = CesiumMath.toRadians(1)
const CAM_BALL_MAX_VISUAL_TILT_DEGREES = 60
const CAM_BALL_FLAT_PERSPECTIVE = 560
const CAM_BALL_TILTED_PERSPECTIVE = 240
const CAM_BALL_LAYOUT_SIZE = 144

/** Match crown displacement to the visible map rotation in radians. */
const CROWN_SENSITIVITY = 1
const DOUBLE_TAP_INTERVAL = 320
const TAP_TRAVEL_LIMIT = 8
const CAM_BALL_ROTATION_SURFACE = '.replay-camera-cam-ball-grip-hit'
const CAM_BALL_CAMERA_SURFACE = `.replay-camera-cam-ball-dome-hit, ${CAM_BALL_ROTATION_SURFACE}`

/** Use a faster normal rate and a finer rate while Ctrl is held. */
const cameraAdjustmentSpeed = precision => CAM_BALL_CAMERA_SPEED * (precision ? CAM_BALL_PRECISION_FACTOR : 1)

/** Check the live preparation state before every camera write, including queued input frames. */
const canAdjustCamera = () => {
    const video = globalThis.lgs?.stores?.ui?.video
    return video?.editing === true && !video.preRecording && !video.exporting
        && !video.snapshot && !video.finalizing
        && !isJourneyReplayCameraActive(globalThis.lgs?.stores?.replay)
}

/** Resolve the main camera only while normal navigation is available. */
const mainCameraContext = ({allowOrbit = false} = {}) => {
    const studio = globalThis.lgs
    const ui = studio?.stores?.ui
    const video = ui?.video
    const scene = studio?.scene
    const camera = studio?.camera
    const controller = scene?.screenSpaceCameraController
    if (!camera || !controller || !controller.enableInputs || scene.mode === SceneMode.MORPHING
        || video?.editing || video?.preRecording || video?.exporting || video?.snapshot || video?.finalizing
        || (!allowOrbit && ui?.mainUI?.rotate?.running)
        || ui?.mainUI?.panorama?.active || ui?.mainUI?.cameraFlight?.running
        || isJourneyReplayCameraActive(studio.stores.replay) || isCameraOwnedByReplay(camera)) return null
    return {scene, camera, controller}
}

/** Hand normal camera control back to the user when a CamBall gesture starts. */
const beginMainCameraInput = () => {
    if (!mainCameraContext({allowOrbit: true})) return false
    if (globalThis.lgs.stores.ui.mainUI?.rotate?.running) {
        // The orbit stops synchronously before the manager saves its final view.
        const stopping = globalThis.__?.ui?.cameraManager?.stopRotate?.()
        stopping?.catch(error => console.warn('Could not finish stopping map rotation', error))
    }
    return Boolean(mainCameraContext())
}

/** Apply pitch and distance-relative zoom in the main Cesium scene. */
const adjustMainCamera = (x, y, scale, gesture) => {
    const context = mainCameraContext()
    if (!context) return
    const {scene, camera, controller} = context
    let changed = false
    if (y && scene.mode === SceneMode.SCENE3D && controller.enableTilt) {
        const orbit = gesture
            ? (gesture.mainOrbit ??= resolveMainCameraOrbit(context))
            : resolveMainCameraOrbit(context)
        changed = orbit?.tilt(-y * CesiumMath.toRadians(CAM_BALL_PITCH_DEGREES_PER_SECOND) * scale, context) ?? false
    }
    if (x && controller.enableZoom) {
        const position = camera.positionCartographic
        const terrainHeight = scene.mode === SceneMode.SCENE3D ? scene.globe?.getHeight(position) ?? 0 : 0
        const distance = position.height - terrainHeight
        if (Number.isFinite(distance) && distance > 0) {
            const minimum = controller.minimumZoomDistance
            const maximum = controller.maximumZoomDistance
            const next = CesiumMath.clamp(distance * Math.exp(-x * scale),
                Math.min(distance, minimum), Math.max(distance, maximum))
            if (next !== distance) {
                camera.zoomIn(distance - next)
                changed = true
            }
        }
    }
    if (changed) scene.requestRender()
}

/** Resolve a geographic pivot once, using the same screen point throughout the gesture. */
const resolveMainCameraPivot = (scene, camera, screenPosition) => {
    const ray = camera.getPickRay(screenPosition)
    const ellipsoid = scene.globe?.ellipsoid ?? scene.ellipsoid
    const picked = (scene.pickPositionSupported ? scene.pickPosition(screenPosition) : undefined)
        ?? (ray ? scene.globe?.pick(ray, scene) : undefined)
        ?? camera.pickEllipsoid(screenPosition, ellipsoid)
    if (!picked || !ellipsoid) return null
    const distance = ray && Cartesian3.dot(
        Cartesian3.subtract(picked, ray.origin, new Cartesian3()),
        ray.direction,
    )
    return ray && distance > 0 ? Ray.getPoint(ray, distance) : picked
}

/** Resolve the selected geographic pivot or the current viewport center. */
const resolveMainCameraOrbit = (context = mainCameraContext()) => {
    if (!context || context.scene.mode !== SceneMode.SCENE3D) return null
    const {scene, camera} = context
    if (!scene.canvas) return null
    const center = new Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2)
    const ellipsoid = scene.globe?.ellipsoid ?? scene.ellipsoid
    const pivot = getMainSceneCameraPivot(scene, camera) ?? resolveMainCameraPivot(scene, camera, center)
    if (!pivot || !ellipsoid) return null
    const axis = ellipsoid.geodeticSurfaceNormal(pivot)
    const rotation = new Matrix3()
    const quaternion = new Quaternion()
    const offset = new Cartesian3()
    const destination = new Cartesian3()
    const direction = new Cartesian3()
    const up = new Cartesian3()
    const minimumPitch = -CesiumMath.PI_OVER_TWO + CesiumMath.toRadians(1)
    const maximumPitch = -CesiumMath.toRadians(1)
    let pitch = CesiumMath.clamp(
        CesiumMath.asinClamped(Cartesian3.dot(camera.directionWC, axis)),
        minimumPitch,
        maximumPitch,
    )

    /** Rotate the world pose around the pivot without changing the camera reference frame. */
    const rotatePose = (rotationAxis, delta, current, checkTerrain = false) => {
        if (current?.camera !== camera || current.scene !== scene || scene.mode !== SceneMode.SCENE3D) return false
        Matrix3.fromQuaternion(Quaternion.fromAxisAngle(rotationAxis, delta, quaternion), rotation)
        Cartesian3.subtract(camera.positionWC, pivot, offset)
        Matrix3.multiplyByVector(rotation, offset, destination)
        Cartesian3.add(pivot, destination, destination)
        if (checkTerrain && current.controller.enableCollisionDetection) {
            const position = ellipsoid.cartesianToCartographic(destination)
            if (!position) return false
            const terrainHeight = scene.globe?.getHeight?.(position) ?? 0
            if (position.height < terrainHeight + current.controller.minimumZoomDistance) return false
        }
        Matrix3.multiplyByVector(rotation, camera.directionWC, direction)
        Matrix3.multiplyByVector(rotation, camera.upWC, up)
        // Apply the orthonormal pose directly in the camera frame, without a heading/pitch/roll
        // round trip that loses precision when looking straight down.
        const inverseTransform = camera.inverseTransform
        Matrix4.multiplyByPoint(inverseTransform, destination, camera.position)
        Matrix4.multiplyByPointAsVector(inverseTransform, direction, camera.direction)
        Matrix4.multiplyByPointAsVector(inverseTransform, up, camera.up)
        Cartesian3.cross(camera.direction, camera.up, camera.right)
        return true
    }

    /** Orbit left or right around the local vertical. */
    const rotate = delta => {
        const current = mainCameraContext()
        if (!current?.controller.enableRotate || !rotatePose(axis, delta, current)) return false
        scene.requestRender()
        return true
    }

    /** Tilt around the camera's right axis through the pivot instead of looking up in place. */
    const tilt = (delta, current) => {
        if (current?.camera !== camera || current.scene !== scene || scene.mode !== SceneMode.SCENE3D) return false
        const right = camera.rightWC
        const nextPitch = CesiumMath.clamp(pitch + delta, minimumPitch, maximumPitch)
        let appliedDelta = nextPitch - pitch
        if (Math.abs(appliedDelta) <= 1e-8) return false
        const currentUp = ellipsoid.geodeticSurfaceNormal(camera.positionWC, new Cartesian3())
        const currentHorizonDot = Cartesian3.dot(camera.directionWC, currentUp)
        const maximumHorizonDot = -Math.sin(CAM_BALL_HORIZON_MARGIN)
        const candidateHorizonDot = angle => {
            Matrix3.fromQuaternion(Quaternion.fromAxisAngle(right, angle, quaternion), rotation)
            Cartesian3.subtract(camera.positionWC, pivot, offset)
            Matrix3.multiplyByVector(rotation, offset, destination)
            Cartesian3.add(pivot, destination, destination)
            Matrix3.multiplyByVector(rotation, camera.directionWC, direction)
            const candidateUp = ellipsoid.geodeticSurfaceNormal(destination, new Cartesian3())
            return Cartesian3.dot(direction, candidateUp)
        }
        let nextHorizonDot = candidateHorizonDot(appliedDelta)
        if (nextHorizonDot > maximumHorizonDot) {
            if (currentHorizonDot > maximumHorizonDot) {
                if (nextHorizonDot >= currentHorizonDot) return false
            }
            else {
                let allowedFraction = 0
                let blockedFraction = 1
                for (let index = 0; index < 24; index++) {
                    const fraction = (allowedFraction + blockedFraction) / 2
                    const candidateDot = candidateHorizonDot(appliedDelta * fraction)
                    if (candidateDot <= maximumHorizonDot) allowedFraction = fraction
                    else blockedFraction = fraction
                }
                appliedDelta *= allowedFraction
                if (Math.abs(appliedDelta) <= 1e-8) return false
            }
        }
        if (!rotatePose(right, appliedDelta, current, true)) return false
        pitch += appliedDelta
        return true
    }

    /** Resolve north in the pivot's tangent plane so the center ray stays fixed during reset. */
    const reset = () => {
        const east = Cartesian3.cross(Cartesian3.UNIT_Z, axis, new Cartesian3())
        if (Cartesian3.magnitudeSquared(east) < 1e-12) return false
        Cartesian3.normalize(east, east)
        const north = Cartesian3.cross(axis, east, new Cartesian3())
        const rightEast = Cartesian3.dot(camera.rightWC, east)
        const rightNorth = Cartesian3.dot(camera.rightWC, north)
        const upEast = Cartesian3.dot(camera.upWC, east)
        const upNorth = Cartesian3.dot(camera.upWC, north)
        let delta = Math.hypot(rightEast, rightNorth) > 1e-6
            ? Math.atan2(-rightNorth, rightEast)
            : Math.atan2(upEast, upNorth)
        // North can be on the vertical centerline above or below the pivot. Choose above.
        if (upEast * Math.sin(delta) + upNorth * Math.cos(delta) < -1e-6) delta += Math.PI
        delta = CesiumMath.negativePiToPi(delta)
        return Math.abs(delta) > 1e-6 && rotate(delta)
    }
    return {rotate, reset, tilt}
}

/** Apply azimuth relative to the Replay route while retaining the prepared camera range. */
const rotateReplayCamera = delta => {
    const update = globalThis.__?.ui?.replay?.updatePreparationCamera
    if (!canAdjustCamera() || !update) return false
    const current = currentJourneyReplayCameraSettings()
    const {cameraAngle} = normalizeJourneyReplayCamera({
        ...current, cameraAngle: current.cameraAngle - CesiumMath.toDegrees(delta),
    })
    return Boolean(globalThis.__.ui.replay.updatePreparationCamera({cameraAngle}, {preserveCameraRange: true}))
}

/** Undo the CSS perspective before measuring the pointer angle on the grip ring. */
const crownPointerAngle = (event, rect, projection) => {
    if (!(rect.width > 0 && rect.height > 0)) return null
    let localX = event.clientX - rect.left - rect.width / 2
    let localY = event.clientY - rect.top - rect.height / 2
    if (projection) {
        const {tiltRadians, perspective} = projection
        const depthSlope = Math.sin(tiltRadians) / perspective
        const denominator = Math.cos(tiltRadians) + localY * depthSlope
        if (denominator <= 0.000001) return null
        localY /= denominator
        localX *= 1 - localY * depthSlope
    }
    const x = localX / rect.width
    const y = (localY / rect.height - 0.04) * (41 / 39)
    return Number.isFinite(x + y) && Math.hypot(x, y) > 0.1 ? Math.atan2(y, x) : null
}

/** Return whether a captured pointer is still inside the circular CamBall surface. */
const isPointerInsideCamBall = (event, rect) => {
    if (!rect || !(rect.width > 0) || !(rect.height > 0)
        || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return true
    const centerX = (Number.isFinite(rect.left) ? rect.left : 0) + rect.width / 2
    const centerY = (Number.isFinite(rect.top) ? rect.top : 0) + rect.height / 2
    const radius = Math.min(rect.width, rect.height) / 2
    return Math.hypot(event.clientX - centerX, event.clientY - centerY) <= radius
}

/** Project the visible hit areas into an ordinary two-dimensional SVG. */
const projectCamBallHits = ({tiltRadians, perspective}, layoutHeight) => {
    const sine = Math.sin(tiltRadians)
    const cosine = Math.cos(tiltRadians)
    const depthSlope = sine * layoutHeight / (100 * perspective)
    const ellipse = (centerY, radiusX, radiusY) => {
        let path = ''
        for (let index = 0; index < 64; index++) {
            const angle = index * Math.PI / 32
            const y = centerY - 50 + radiusY * Math.sin(angle)
            const projection = 1 / (1 - y * depthSlope)
            const x = 50 + radiusX * Math.cos(angle) * projection
            path += `${index ? 'L' : 'M'}${x.toFixed(2)} ${(50 + y * cosine * projection).toFixed(2)}`
        }
        return path + 'Z'
    }
    return {dome: ellipse(53, 25, 23.5), grip: ellipse(54, 32, 30) + ellipse(54, 25, 23)}
}

const FLAT_CAM_BALL_PROJECTION = {tiltRadians: 0, perspective: CAM_BALL_FLAT_PERSPECTIVE}
const FLAT_CAM_BALL_HITS = projectCamBallHits(FLAT_CAM_BALL_PROJECTION, CAM_BALL_LAYOUT_SIZE)

/** Consume CamBall input before the widget host or map handles it. */
const consumeInput = event => {
    event.preventDefault()
    event.stopPropagation()
}

/** Render the shared rolling-ball zoom and pitch control on the map or during Replay preparation. */
export const ReplayCameraCamBall = ({mainScene = false} = {}) => {
    const video = useOptionalSnapshot(lgs.stores.ui.video)
    const replay = useOptionalSnapshot(lgs.stores.replay)
    const journeySlug = useProxyValue(lgs.stores.main, main => main.theJourney?.slug ?? null, null)
    const uiSettings = useOptionalSnapshot(lgs.settings?.ui)
    const camBall = uiSettings.camBall
    const followPitch = camBall?.followPitch === true
    const _gesture = useRef(null)
    const _frame = useRef(null)
    const _surface = useRef(null)
    const _projection = useRef(FLAT_CAM_BALL_PROJECTION)
    const _pad = useRef(null)
    const _domeHit = useRef(null)
    const _gripHit = useRef(null)
    const _canvas = useRef(null)
    const _scene = useRef(null)
    const _crownMarks = useRef(null)
    const _northMark = useRef(null)
    const _gripMarks = useRef(null)
    const _crownAngle = useRef(0)
    const _lastTap = useRef(null)
    const _touchResetTime = useRef(-Infinity)
    const _visualPosition = useRef({x: 0, y: 0})
    const [stick, setStick] = useState({x: 0, y: 0})
    const [action, setAction] = useState({x: 0, y: 0})
    const [sceneReady, setSceneReady] = useState(false)
    const available = camBall?.visible !== false
        && (mainScene ? !video.editing : video.editing === true && Boolean(journeySlug))
        && !video.preRecording && !video.exporting
        && !video.snapshot && !video.finalizing && !isJourneyReplayCameraActive(replay)

    /** Check camera ownership before accepting or continuing an input gesture. */
    const canInteract = useCallback(() => mainScene ? Boolean(mainCameraContext()) : canAdjustCamera(), [mainScene])

    /** Begin direct input only after any normal map orbit has stopped. */
    const beginInteraction = useCallback(() => mainScene ? beginMainCameraInput() : canAdjustCamera(), [mainScene])

    /** Stop queued input and release capture without recentering the rolling ball. */
    const stop = useCallback(() => {
        const gesture = _gesture.current
        _gesture.current = null
        gesture?.cleanup?.()
        if (_frame.current !== null) cancelAnimationFrame(_frame.current)
        _frame.current = null
        if (gesture?.target.hasPointerCapture?.(gesture.pointerId)) {
            gesture.target.releasePointerCapture(gesture.pointerId)
        }
        setAction({x: 0, y: 0})
    }, [])

    /** Keep the Three.js dial and its fallback aligned with the same screen angle. */
    const placeCrown = useCallback(angle => {
        angle = CesiumMath.negativePiToPi(angle)
        if (Math.abs(angle - _crownAngle.current) < 1e-6) return
        _crownAngle.current = angle
        _crownMarks.current?.setAttribute('transform', `rotate(${CesiumMath.toDegrees(angle)})`)
        _northMark.current?.setAttribute('transform', `rotate(${CesiumMath.toDegrees(angle)})`)
        _gripMarks.current?.setAttribute('transform', `rotate(${CesiumMath.toDegrees(angle)})`)
        _scene.current?.setCrownAngle(angle)
    }, [])

    /** Face the chevron toward geographic north as the camera heading changes. */
    const syncCrownNorth = useCallback(() => {
        const heading = globalThis.lgs?.camera?.heading
        if (Number.isFinite(heading)) placeCrown(-heading)
    }, [placeCrown])

    /** Tilt the entire dial with the camera while keeping a usable hit surface at the horizon. */
    const syncCamBallView = useCallback(() => {
        syncCrownNorth()
        const livePitch = followPitch ? globalThis.lgs?.camera?.pitch : undefined
        const pitch = Number.isFinite(livePitch) ? livePitch : -CesiumMath.PI_OVER_TWO
        const progress = CesiumMath.clamp(1 + pitch / CesiumMath.PI_OVER_TWO, 0, 1)
        const tilt = Number((progress * CAM_BALL_MAX_VISUAL_TILT_DEGREES).toFixed(2))
        const perspective = Math.round(CesiumMath.lerp(CAM_BALL_FLAT_PERSPECTIVE, CAM_BALL_TILTED_PERSPECTIVE, progress))
        const style = _surface.current?.style
        if (style?.getPropertyValue('--lgs-cam-ball-view-tilt') !== tilt.toFixed(2) + 'deg') {
            style?.setProperty('--lgs-cam-ball-view-tilt', tilt.toFixed(2) + 'deg')
            style?.setProperty('--lgs-cam-ball-view-perspective', `${perspective}px`)
            _projection.current = {tiltRadians: CesiumMath.toRadians(tilt), perspective}
            const hits = projectCamBallHits(_projection.current, _pad.current?.clientHeight || CAM_BALL_LAYOUT_SIZE)
            _domeHit.current?.setAttribute('d', hits.dome)
            _gripHit.current?.setAttribute('d', hits.grip)
        }
    }, [followPitch, syncCrownNorth])

    /** Apply angular input and keep the fallback responsive without a Cesium camera. */
    const turnCrown = useCallback((delta, rotate) => {
        if (!Number.isFinite(delta) || Math.abs(delta) < 1e-6 || !rotate(delta)) return
        if (Number.isFinite(globalThis.lgs?.camera?.heading)) syncCrownNorth()
        else placeCrown(_crownAngle.current + delta)
    }, [placeCrown, syncCrownNorth])

    /** Restore geographic north while keeping Replay's persisted angle relative to the route. */
    const resetNorth = useCallback(() => {
        if (!beginInteraction()) return
        if (mainScene) {
            if (resolveMainCameraOrbit()?.reset()) syncCrownNorth()
        }
        else {
            const heading = globalThis.lgs?.camera?.heading
            if (!Number.isFinite(heading)) return
            turnCrown(CesiumMath.negativePiToPi(heading), rotateReplayCamera)
        }
    }, [beginInteraction, mainScene, syncCrownNorth, turnCrown])

    /** Handle mouse double clicks on either camera control. */
    const doubleClick = useCallback(event => {
        if (event.shiftKey || !event.target.closest?.(CAM_BALL_CAMERA_SURFACE)) return
        consumeInput(event)
        if (event.timeStamp - _touchResetTime.current > DOUBLE_TAP_INTERVAL) resetNorth()
    }, [resetNorth])

    /** Capture the grip ring and keep its angle as the gesture origin. */
    const startGrip = useCallback(event => {
        if (event.button !== 0 || _gesture.current) return
        if (event.shiftKey || (mainScene && event.ctrlKey)) {
            return
        }
        consumeInput(event)
        const rect = _pad.current.getBoundingClientRect()
        const projection = {
            ..._projection.current,
            perspective: _projection.current.perspective * rect.height / (_pad.current.clientHeight || rect.height || CAM_BALL_LAYOUT_SIZE),
        }
        const angle = crownPointerAngle(event, rect, projection)
        if (angle === null || !beginInteraction()) return
            const rotate = mainScene ? resolveMainCameraOrbit()?.rotate : rotateReplayCamera
        if (!rotate) return
        const target = event.currentTarget
        _gesture.current = {
            target, pointerId: event.pointerId, rect, projection, angle, rotate,
            pressX: event.clientX, pressY: event.clientY, pressTime: event.timeStamp,
        }
        target.setPointerCapture?.(event.pointerId)
    }, [beginInteraction, mainScene])

    /** Let focused keyboard users rotate the map in five degree steps. */
    const gripKeyDown = useCallback(event => {
        if (event.key === 'Escape') {
            consumeInput(event)
            stop()
            return
        }
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        consumeInput(event)
        if (_gesture.current || !beginInteraction()) return
        const rotate = mainScene ? resolveMainCameraOrbit()?.rotate : rotateReplayCamera
        if (rotate) turnCrown(CesiumMath.toRadians(event.key === 'ArrowRight' ? 5 : -5), rotate)
    }, [beginInteraction, mainScene, stop, turnCrown])

    /** Merge only height and pitch, preserving azimuth and the selected altitude mode. */
    const adjust = useCallback((x, y, scale = 1, gesture) => {
        if (mainScene) {
            adjustMainCamera(x, y, scale, gesture)
            return
        }
        if (!canAdjustCamera()) return
        const current = currentJourneyReplayCameraSettings()
        const altitude = Math.max(10, Math.min(100000, current.altitude * Math.exp(-x * scale)))
        const pitch = Math.max(-89, Math.min(-5, current.pitch - y * CAM_BALL_PITCH_DEGREES_PER_SECOND * scale))
        if (altitude !== current.altitude || pitch !== current.pitch) {
            globalThis.__?.ui?.replay?.updatePreparationCamera?.(
                {altitude, pitch},
                {preserveCameraRange: true},
            )
        }
    }, [mainScene])

    /** Apply held deflection at an elapsed-time rate until release or a lifecycle change. */
    const applyHeld = useCallback(timestamp => {
        if (_frame.current !== null) cancelAnimationFrame(_frame.current)
        _frame.current = null
        const gesture = _gesture.current
        if (!gesture) return
        if (!canInteract()) {
            stop()
            return
        }
        const x = gesture.axis === 'vertical' ? 0 : gesture.x
        const y = gesture.axis === 'horizontal' ? 0 : gesture.y
        if (x === 0 && y === 0) {
            gesture.lastFrameTime = null
            return
        }
        const currentTime = Number.isFinite(timestamp) ? timestamp : null
        // Bound a resumed frame so browser suspension cannot produce a camera jump.
        const elapsedSeconds = currentTime === null || gesture.lastFrameTime === null
            ? 1 / 60
            : Math.max(0, Math.min(0.1, (currentTime - gesture.lastFrameTime) / 1000))
        gesture.lastFrameTime = currentTime
        const speed = cameraAdjustmentSpeed(gesture.precision)
        adjust(x, y, elapsedSeconds * CAM_BALL_POINTER_SENSITIVITY * speed, gesture)
        if (_gesture.current === gesture) _frame.current = requestAnimationFrame(gesture.applyHeld)
    }, [adjust, canInteract, stop])

    /** Use the dome drag deflection as the held camera adjustment rate. */
    const move = useCallback(event => {
        const gesture = _gesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        consumeInput(event)
        if (!isPointerInsideCamBall(event, gesture.rect)) {
            stop()
            return
        }
        if (Math.hypot(event.clientX - gesture.pressX, event.clientY - gesture.pressY) > TAP_TRAVEL_LIMIT) gesture.dragged = true
        if (gesture.rotate) {
            if (!canInteract()) {
                stop()
                return
            }
            const angle = crownPointerAngle(event, gesture.rect, gesture.projection)
            if (angle !== null && gesture.angle !== null) {
                const delta = angle - gesture.angle
                turnCrown(Math.atan2(Math.sin(delta), Math.cos(delta)) * CROWN_SENSITIVITY, gesture.rotate)
            }
            gesture.angle = angle
            return
        }
        gesture.precision = event.ctrlKey
        const radius = Math.max(1, Math.min(gesture.rect.width, gesture.rect.height) * 0.2)
        let deltaClientX = event.clientX - gesture.originClientX
        let deltaClientY = event.clientY - gesture.originClientY
        let nextX
        let nextY
        if (event.ctrlKey) {
            if (!gesture.axis) {
                // Wait for a deliberate movement, then retain that axis until Ctrl is released.
                if (Math.max(Math.abs(deltaClientX), Math.abs(deltaClientY)) >= 3) {
                    gesture.axis = Math.abs(deltaClientX) >= Math.abs(deltaClientY) ? 'horizontal' : 'vertical'
                }
                else {
                    nextX = gesture.x
                    nextY = gesture.y
                }
            }
            if (gesture.axis === 'horizontal') {
                nextX = Math.max(-1, Math.min(1, gesture.originStickX + deltaClientX / radius))
                nextY = 0
            }
            else if (gesture.axis === 'vertical') {
                nextX = 0
                nextY = Math.max(-1, Math.min(1, gesture.originStickY + deltaClientY / radius))
            }
        }
        else {
            const movementX = event.clientX - gesture.lastClientX
            const movementY = event.clientY - gesture.lastClientY
            const movementMagnitude = Math.max(Math.abs(movementX), Math.abs(movementY))
            const movementAxis = Math.abs(movementX) >= Math.abs(movementY) ? 'horizontal' : 'vertical'
            if (movementMagnitude >= 3 && gesture.activeAxis && movementAxis !== gesture.activeAxis) {
                gesture.originClientX = gesture.lastClientX
                gesture.originClientY = gesture.lastClientY
                gesture.originStickX = 0
                gesture.originStickY = 0
                // Rebase the current sample too, so the previous axis stops contributing immediately.
                deltaClientX = event.clientX - gesture.originClientX
                deltaClientY = event.clientY - gesture.originClientY
            }
            if (gesture.axis) {
                gesture.originClientX = event.clientX
                gesture.originClientY = event.clientY
                gesture.originStickX = gesture.x
                gesture.originStickY = gesture.y
                gesture.axis = null
                deltaClientX = 0
                deltaClientY = 0
            }
            nextX = gesture.originStickX + deltaClientX / radius
            nextY = gesture.originStickY + deltaClientY / radius
            // Give each direction a 90-degree sector, with exact diagonals assigned to zoom.
            if (Math.abs(nextX) >= Math.abs(nextY)) {
                nextX = CesiumMath.clamp(nextX, -1, 1)
                nextY = 0
            }
            else {
                nextX = 0
                nextY = CesiumMath.clamp(nextY, -1, 1)
            }
            if (movementMagnitude >= 3) gesture.activeAxis = movementAxis
            else if (nextX !== 0 || nextY !== 0) gesture.activeAxis = Math.abs(nextX) >= Math.abs(nextY) ? 'horizontal' : 'vertical'
        }
        gesture.lastClientX = event.clientX
        gesture.lastClientY = event.clientY
        gesture.x = nextX
        gesture.y = nextY
        gesture.moved ||= nextX !== gesture.originStickX || nextY !== gesture.originStickY
        setStick({x: gesture.x, y: gesture.y})
        const x = gesture.axis === 'vertical' ? 0 : nextX
        const y = gesture.axis === 'horizontal' ? 0 : nextY
        setAction({x, y})
        if (x !== 0 || y !== 0) {
            if (_frame.current === null) _frame.current = requestAnimationFrame(gesture.applyHeld)
        }
        else {
            if (_frame.current !== null) cancelAnimationFrame(_frame.current)
            _frame.current = null
            gesture.lastFrameTime = null
        }
    }, [canInteract, stop, turnCrown])

    /** Capture input on the full dome surface. */
    const start = useCallback(event => {
        const target = event.target.closest?.('.replay-camera-cam-ball-dome-hit')
        if (event.button !== 0 || _gesture.current || !target) return
        if (event.shiftKey || (mainScene && event.ctrlKey)) return
        if (!beginInteraction()) return
        consumeInput(event)
        // Capture the selected map pivot before any held camera frame can run.
        const mainOrbit = mainScene ? resolveMainCameraOrbit() : null
        _gesture.current = {
            target, precision: event.ctrlKey, pointerId: event.pointerId, rect: event.currentTarget.getBoundingClientRect(),
            pressX: event.clientX, pressY: event.clientY, pressTime: event.timeStamp,
            x: stick.x, y: stick.y, lastFrameTime: null, applyHeld,
            mainOrbit,
            lastClientX: event.clientX, lastClientY: event.clientY,
            activeAxis: stick.x !== 0 || stick.y !== 0
                ? Math.abs(stick.x) >= Math.abs(stick.y) ? 'horizontal' : 'vertical'
                : null,
            originClientX: event.clientX, originClientY: event.clientY,
            originStickX: stick.x, originStickY: stick.y, axis: null,
        }
        target.setPointerCapture?.(event.pointerId)
    }, [applyHeld, beginInteraction, mainScene, stick.x, stick.y])

    /** End only the pointer gesture owned by this CamBall. */
    const end = useCallback(event => {
        const gesture = _gesture.current
        if (gesture?.pointerId !== event.pointerId) return
        consumeInput(event)
        const released = event.type === 'pointerup'
        const insideCamBall = isPointerInsideCamBall(event, gesture.rect)
        if (!insideCamBall) {
            stop()
            if (event.pointerType === 'touch') _lastTap.current = null
            return
        }
        if (released && gesture.moved && gesture.lastFrameTime === null) applyHeld()
        stop()
        if (event.pointerType !== 'touch') return
        const previous = _lastTap.current
        _lastTap.current = null
        if (!released || gesture.dragged || event.timeStamp - gesture.pressTime > DOUBLE_TAP_INTERVAL
            || Math.hypot(event.clientX - gesture.pressX, event.clientY - gesture.pressY) > TAP_TRAVEL_LIMIT) return
        if (previous?.target === gesture.target && event.timeStamp - previous.time <= DOUBLE_TAP_INTERVAL
            && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 2 * TAP_TRAVEL_LIMIT) {
            _touchResetTime.current = event.timeStamp
            resetNorth()
            return
        }
        _lastTap.current = {target: gesture.target, time: event.timeStamp, x: event.clientX, y: event.clientY}
    }, [applyHeld, resetNorth, stop])

    /** Keep focus-scoped keyboard axes available without visible direction buttons. */
    const keyDown = useCallback(event => {
        const direction = {
            ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        }[event.key]
        if (event.key === 'Escape') {
            consumeInput(event)
            stop()
            return
        }
        if (!direction || !beginInteraction()) return
        consumeInput(event)
        setStick({x: direction[0], y: direction[1]})
        setAction({x: direction[0], y: direction[1]})
        adjust(direction[0], direction[1], 0.1 * cameraAdjustmentSpeed(event.ctrlKey))
    }, [adjust, beginInteraction, stop])

    /** Clear transient keyboard feedback while keeping the ball at its rolled position. */
    const keyUp = useCallback(event => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
        consumeInput(event)
        setAction({x: 0, y: 0})
    }, [])

    /** Clear an earlier keyboard focus when the user returns to pointer input. */
    const clearPointerFocus = useCallback(event => {
        if (_gesture.current) return
        const activeElement = event.currentTarget.ownerDocument.activeElement
        if (event.currentTarget.contains(activeElement)) activeElement.blur()
    }, [])

    const handleSceneContextLost = useCallback(() => setSceneReady(false), [])
    const handleSceneContextRestored = useCallback(() => setSceneReady(true), [])

    useEffect(() => {
        /** Update held speed even when the pointer stays in the same displaced position. */
        const updatePrecision = event => {
            const gesture = _gesture.current
            if (event.key === 'Control' && gesture && !gesture.rotate) {
                gesture.precision = event.type === 'keydown'
            }
        }
        window.addEventListener('blur', stop)
        window.addEventListener('keydown', updatePrecision)
        window.addEventListener('keyup', updatePrecision)
        return () => {
            window.removeEventListener('blur', stop)
            window.removeEventListener('keydown', updatePrecision)
            window.removeEventListener('keyup', updatePrecision)
            _lastTap.current = null
            stop()
        }
    }, [available, mainScene, journeySlug, replay.userMode, stop])

    useEffect(() => {
        if (!available) return
        syncCamBallView()
        return globalThis.lgs?.scene?.postRender?.addEventListener(syncCamBallView)
    }, [available, syncCamBallView])

    useEffect(() => {
        const canvasElement = _canvas.current
        const padElement = _pad.current
        if (!available || !canvasElement || !padElement) return
        setSceneReady(false)
        let cancelled = false
        let camBallScene
        import('./ReplayCameraCamBallScene').then(({createReplayCameraCamBallScene}) => {
            if (cancelled) return
            try {
                camBallScene = createReplayCameraCamBallScene({
                    canvas: canvasElement,
                    padElement,
                    mapScene: globalThis.lgs?.scene,
                    onContextLost: handleSceneContextLost,
                    onContextRestored: handleSceneContextRestored,
                })
                _scene.current = camBallScene
                camBallScene.setPosition(_visualPosition.current)
                camBallScene.setCrownAngle(_crownAngle.current)
                setSceneReady(true)
            }
            catch (error) {
                console.warn('Replay CamBall could not initialize its Three.js surface', error)
            }
        }).catch(error => {
            if (!cancelled) console.warn('Replay CamBall could not load its Three.js surface', error)
        })
        return () => {
            cancelled = true
            camBallScene?.dispose()
            if (_scene.current === camBallScene) _scene.current = null
            setSceneReady(false)
        }
    }, [available, handleSceneContextLost, handleSceneContextRestored])

    useEffect(() => {
        _visualPosition.current = stick
        _scene.current?.setPosition(stick)
    }, [stick])

    if (!available) return null

    return (
        <Widget key={mainScene ? MAIN_SCENE_CONFIG.id : CONFIG.id} isVisible
                config={mainScene ? MAIN_SCENE_CONFIG : CONFIG} className="replay-camera-cam-ball-shell"
                containerClassName="replay-camera-cam-ball-layer">
            <div ref={_surface} className="replay-camera-cam-ball">
                <div ref={_pad} className={`replay-camera-cam-ball-pad lgs-card wa-theme-lgs1920-on-map${sceneReady ? ' is-threejs-ready' : ''}`}
                     role="group" tabIndex={0}
                     aria-label="Drag up or down to adjust pitch, and left or right to zoom" aria-roledescription="camera control"
                     onKeyDown={keyDown} onKeyUp={keyUp} onBlur={stop}
                     onPointerDownCapture={clearPointerFocus} onPointerDown={start} onPointerMove={move} onPointerUp={end}
                     onPointerCancel={end} onLostPointerCapture={stop} onContextMenu={consumeInput}
                     onDoubleClick={doubleClick} onWheel={consumeInput}>
                    <div className="replay-camera-cam-ball-visual" aria-hidden="true">
                        <canvas ref={_canvas} className="replay-camera-cam-ball-canvas"/>
                        <svg className="replay-camera-cam-ball-crown" viewBox="0 0 100 100">
                            <ellipse className="replay-camera-cam-ball-crown-fallback replay-camera-cam-ball-crown-band"
                                     cx="50" cy="54" rx="34" ry="32" aria-hidden="true"/>
                            <ellipse className="replay-camera-cam-ball-crown-fallback replay-camera-cam-ball-crown-band replay-camera-cam-ball-grip-band"
                                     cx="50" cy="54" rx="28.5" ry="26.5" aria-hidden="true"/>
                            <g className="replay-camera-cam-ball-crown-fallback replay-camera-cam-ball-compass-marks"
                               transform="translate(50 54) scale(0.83 0.78)" aria-hidden="true">
                                <path ref={_crownMarks}
                                      d="M27.8 -27.8 30.2 -30.2 M38 0 44 0 M27.8 27.8 30.2 30.2 M0 38 0 44 M-27.8 27.8 -30.2 30.2 M-38 0 -44 0 M-27.8 -27.8 -30.2 -30.2"/>
                                <path ref={_northMark} className="replay-camera-cam-ball-north-mark"
                                      d="M-3 -39 0 -44 3 -39 Z"/>
                            </g>
                            <g className="replay-camera-cam-ball-crown-fallback replay-camera-cam-ball-grip-marks"
                               transform="translate(50 54) scale(1 0.93)" aria-hidden="true">
                                <circle ref={_gripMarks} r="28.5"/>
                            </g>
                        </svg>
                        <span className="replay-camera-cam-ball-dome-fallback"/>
                    </div>
                    <svg className="replay-camera-cam-ball-touch-surface" viewBox="0 0 100 100">
                        <path ref={_gripHit} className="replay-camera-cam-ball-grip-hit lgs-widget-no-drag"
                              d={FLAT_CAM_BALL_HITS.grip} fillRule="evenodd" role="group" tabIndex={0}
                              aria-label={UI_ACTIONS.camBallGripRing.label}
                              onPointerDown={startGrip} onKeyDown={gripKeyDown}/>
                        <path ref={_domeHit} className="replay-camera-cam-ball-dome-hit lgs-widget-no-drag"
                              d={FLAT_CAM_BALL_HITS.dome} aria-hidden="true"/>
                    </svg>
                    {action.y !== 0 && <WaIcon className={`replay-camera-cam-ball-action ${action.y < 0 ? 'action-top' : 'action-bottom'}`}
                        name={action.y < 0 ? 'arrow-up' : 'arrow-down'} aria-hidden="true"/>}
                    {action.x !== 0 && <WaIcon className={`replay-camera-cam-ball-action ${action.x < 0 ? 'action-left' : 'action-right'}`}
                        name={action.x < 0 ? 'magnifying-glass-minus' : 'magnifying-glass-plus'} aria-hidden="true"/>}
                </div>
            </div>
        </Widget>
    )
}
