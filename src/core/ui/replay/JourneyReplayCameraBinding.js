/**
 * Replay camera Binding behavior.
 */


import {Cartesian3} from 'cesium'
import {finiteNumber, isJourneyReplayCameraActive, replayStore} from './JourneyReplayRuntime'
import {
    REPLAY_MARKER_MODE_HYSTERESIS,
    getJourneyReplaySettings,
    normalizeJourneyReplayMarker,
} from './JourneyReplayProgressionStyle'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import {
    REPLAY_HEADING_TRANSITION_DURATION_SECONDS,
} from './JourneyReplayCameraShared'
import {
    buildCameraTransferPath,
    selectCameraTransferMode,
} from './JourneyReplayCameraPath'
import {
    buildReplayAntiCollisionBounds,
} from './JourneyReplayCameraCollision'

const CAMERA_TRANSFER_MIN_LIFT_METERS = 120
const CAMERA_TRANSFER_DISTANCE_LIFT_RATIO = 0.18

/**
 * Resolve the vertical clearance used by a long camera transfer.
 *
 * The clearance must account for both the travelled distance and an endpoint
 * that is higher than the current camera. A fixed lift leaves zoom-out clips
 * near the ground and makes the horizontal transfer look like a jump.
 *
 * @param {object} options - Transfer geometry inputs.
 * @param {number|null} [options.distanceMeters=null] - Camera travel distance.
 * @param {number|null} [options.startHeight=null] - Current camera height.
 * @param {number|null} [options.endHeight=null] - Requested endpoint height.
 * @param {number|null} [options.configuredLift=null] - Camera safety lift.
 * @returns {number} The resolved lift in meters.
 */
export const resolveCameraTransferLiftMeters = ({
    distanceMeters = null,
    startHeight = null,
    endHeight = null,
    configuredLift = null,
} = {}) => {
    const distanceLift = Math.max(0, finiteNumber(distanceMeters) ?? 0) * CAMERA_TRANSFER_DISTANCE_LIFT_RATIO
    const altitudeLift = Math.max(
        0,
        (finiteNumber(endHeight) ?? 0) - (finiteNumber(startHeight) ?? 0),
    )
    return Math.max(
        CAMERA_TRANSFER_MIN_LIFT_METERS,
        finiteNumber(configuredLift) ?? 0,
        distanceLift,
        altitudeLift,
    )
}

export const recenterCameraToSample = (mode, {
                                   sample,
                                   heading,
                                   pitch,
                                   roll = 0,
                                   cameraSettings,
                                   cameraHeight = null,
                                   instant = false,
                                   duration = 1.0,
                                   deterministic = false,
                                   logicalNow = null,
                                   force = false,
                                   trackingMode = null,
                                   transitionGuard = null,
                               }) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = call.cesiumViewer?.() ?? globalThis.lgs?.viewer
        const frame = call.cameraRecenterFrame({
            sample,
            heading,
            pitch,
            roll,
            cameraSettings,
            cameraHeight,
        })
        if (!viewer || !frame) {
            return
        }

        const {destination, direction, correctedUp, safeHeading, safePitch, roll: safeRoll} = frame
        const finishFlight = () => {
            state.cameraFlightActive = false
        }

        if (!force && !deterministic && call.cameraViewIsStable({anchor: sample, heading: safeHeading, pitch: safePitch, roll: safeRoll})) {
            finishFlight()
            return Promise.resolve(true)
        }

        state.cameraAutoTrackingIgnoreUntil = call.now() + Math.max(180, duration * 1000 + 180)
        if (deterministic && !instant && duration > 0) {
            finishFlight()
            return Promise.resolve(call.startDeterministicCameraTransition({
                sample,
                heading: safeHeading,
                pitch:   safePitch,
                endFrame: frame,
                duration,
                                         logicalNow,
                                         trackingMode,
                                         cameraSettings,
                                         viewport: call.viewportRectForCesiumSurface?.() ?? null,
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
            call.refreshReplayDiagnosticsOverlay?.()
            call.rememberCameraView({anchor: sample, heading: safeHeading, pitch: safePitch, roll: safeRoll})
            finishFlight()
            return Promise.resolve()
        }
        return call.startCameraTransition({
            sample,
            heading:        safeHeading,
            pitch:          safePitch,
            cameraSettings,
            cameraHeight:   frame.currentHeight,
            duration,
            endFrame:       frame,
            transitionGuard,
        })
    }

export const startCameraTransition = (mode, {
                                        sample,
                                        heading,
                                        pitch,
                                        roll = 0,
                                        cameraSettings,
                                        cameraHeight = null,
                                        endFrame = null,
                                        duration = REPLAY_HEADING_TRANSITION_DURATION_SECONDS,
                                        transitionGuard = null,
                                    }) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = call.cesiumViewer?.() ?? globalThis.lgs?.viewer
        if (!viewer?.camera) {
            return Promise.resolve(false)
        }

        const frame = endFrame ?? call.cameraRecenterFrame({
            sample,
            heading,
            pitch,
            roll,
            cameraSettings,
            cameraHeight,
        })
        if (!frame) {
            return Promise.resolve(false)
        }

        call.cancelCameraBezierTransition(false)

        const endHeading = frame.safeHeading
        const endPitch = frame.safePitch
        const endPosition = frame.destination
        const endDirection = frame.direction
        const endUp = frame.correctedUp
        const currentHeight = finiteNumber(viewer.camera.positionCartographic?.height)
        state.cameraFlightActive = true
        state.cameraApplyingView = true
        state.cameraAutoTrackingIgnoreUntil = call.now() + Math.max(180, Math.max(0, Number(duration) * 1000) + 180)

        return new Promise(resolve => {
            state.cameraBezierResolve = resolve
            const settle = (result) => {
                if (state.cameraBezierResolve === null) {
                    return
                }
                const done = state.cameraBezierResolve
                state.cameraBezierResolve = null
                state.cameraBezierFrame = null
                state.cameraApplyingView = false
                state.cameraFlightActive = false
                state.introHeadingTransition = null
                if (result) {
                    state.lastCameraHeading = endHeading
                    state.lastCameraPitch = endPitch
                    call.rememberCameraView({
                        anchor: sample,
                        heading: endHeading,
                        pitch: endPitch,
                        roll: frame.roll,
                    })
                }
                done(result)
            }

            const transferThresholdKm = finiteNumber(globalThis.lgs?.settings?.camera?.transferDistanceThresholdKm) ?? 50
            const cameraWorldPosition = viewer.camera?.positionWC ?? viewer.camera?.position
            const transferDistance = cameraWorldPosition
                ? Cartesian3.distance(cameraWorldPosition, endPosition)
                : null
            const transferMode = selectCameraTransferMode(transferDistance, transferThresholdKm)
            const transferPath = cameraWorldPosition && transferMode !== 'direct'
                ? buildCameraTransferPath({
                    start:       cameraWorldPosition,
                    end:         endPosition,
                    mode:        transferMode,
                    sampleCount: transferMode === 'blur-jump-refocus' ? 64 : 48,
                    liftMeters:  resolveCameraTransferLiftMeters({
                        distanceMeters: transferDistance,
                        startHeight:    currentHeight,
                        endHeight:      frame.currentHeight,
                        configuredLift: finiteNumber(globalThis.lgs?.settings?.camera?.pitchAdjustHeight) ?? 500,
                    }),
                    antiCollisionBounds: buildReplayAntiCollisionBounds(globalThis.lgs?.theJourney, {
                        trackingMode:        getJourneyReplaySettings().marker.mode,
                        cameraSettings,
                        viewport:            call.viewportRectForCesiumSurface(),
                        clearanceMeters: Math.max(100, finiteNumber(globalThis.lgs?.settings?.camera?.pitchAdjustHeight) ?? 500),
                    }),
                    frameResolver: typeof transitionGuard === 'function'
                        ? ({frame, ratio}) => transitionGuard({frame, ratio}) ?? frame
                        : null,
                })
                : null

            const draftTiming = globalThis.lgs?.stores?.ui?.video?.recording === true
                                || globalThis.lgs?.stores?.ui?.video?.preRecording === true
            if (transferPath) {
                try {
                    const cancelTransition = transferPath.flyTo({
                        camera: viewer.camera,
                        target: frame.target,
                        duration: Math.max(0, Number(duration) || 0),
                        cadence: draftTiming ? 'time' : 'frame',
                        complete: () => settle(true),
                        cancel:   () => settle(false),
                    })
                    if (typeof cancelTransition === 'function') {
                        state.cameraBezierFrame = cancelTransition
                        return
                    }
                }
                catch {
                }
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
                        ...(currentHeight === null
                            ? {}
                            : {maximumHeight: Math.max(currentHeight, finiteNumber(frame.currentHeight) ?? currentHeight)}),
                        complete: () => settle(true),
                        cancel:   () => settle(false),
                    })
                    return
                }
                catch {
                }
            }

            if (typeof viewer.camera.setView === 'function') {
                try {
                    viewer.camera.setView({
                        destination: endPosition,
                        orientation: {
                            direction: endDirection,
                            up:        endUp,
                        },
                    })
                    call.refreshReplayDiagnosticsOverlay?.()
                    settle(true)
                    return
                }
                catch {
                }
            }

            try {
                settle(false)
            }
            catch {
                settle(false)
            }
        })
    }

export const bindMarkerInteractions = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = globalThis.lgs?.viewer
        const camera = viewer?.camera
        const interactionTargets = [
            viewer?.canvas,
            viewer?.scene?.canvas,
            call.cesiumScene?.()?.canvas,
            globalThis.lgs?.canvas,
        ].filter((target, index, targets) => target && targets.indexOf(target) === index)
        if (!camera) {
            return
        }

        const cameraChanged = () => {
            // Keep live Cesium edits visible in the drawer during FT; only suppress echoes from our own writes.
            if (state.suppressPlaybackCameraSync) {
                return
            }
            if (state.cameraApplyingView || call.now() < state.cameraAutoTrackingIgnoreUntil) {
                return
            }
            if (!state.cameraUserAdjusting && !state.cameraPointerActive) {
                return
            }
            call.updateCameraFromCesiumControls()
        }
        const refreshToleranceCameraAfterManualMove = () => {
            const replay = replayStore()
            if (!isJourneyReplayCameraActive(replay) && !state.sampler) {
                return
            }
            const settings = getJourneyReplaySettings()
            const marker = normalizeJourneyReplayMarker(globalThis.lgs?.stores?.replay?.marker ?? settings.marker)
            if (marker.mode === REPLAY_MARKER_MODE_HYSTERESIS) {
                mode.refreshCamera({forceToleranceRecenter: true})
            }
        }
        const manualStart = ({pointer = false} = {}) => {
            if (state.suppressPlaybackCameraSync) {
                if (!pointer) {
                    return
                }
                state.suppressPlaybackCameraSync = false
            }
            if (state.cameraFlightActive) {
                call.cancelCameraBezierTransition(false)
            }
            // Allow pointer interactions to start even if a programmatic camera view was just applied.
            if (!pointer && state.cameraApplyingView) {
                return
            }
            if (state.cameraManualInteractionTimer !== null) {
                clearTimeout(state.cameraManualInteractionTimer)
                state.cameraManualInteractionTimer = null
            }
            state.cameraPointerActive = pointer || state.cameraPointerActive
            state.cameraUserAdjusting = true
            call.startCameraLiveSyncLoop()
        }
        const manualEnd = ({immediate = false} = {}) => {
            if (!state.cameraPointerActive && !state.cameraUserAdjusting) {
                return
            }
            if (state.suppressPlaybackCameraSync && !state.cameraPointerActive) {
                return
            }
            if (state.cameraFlightActive && !state.cameraPointerActive) {
                state.cameraUserAdjusting = false
                call.stopCameraLiveSyncLoop()
                return
            }
            if (!state.cameraPointerActive && state.cameraApplyingView) {
                state.cameraPointerActive = false
                state.cameraUserAdjusting = false
                return
            }
            state.cameraPointerActive = false
            if (state.cameraManualInteractionTimer !== null) {
                clearTimeout(state.cameraManualInteractionTimer)
            }
            const finish = () => {
                state.cameraManualInteractionTimer = null
                state.cameraUserAdjusting = false
                call.updateCameraFromCesiumControls({userInteraction: true})
                refreshToleranceCameraAfterManualMove()
                call.stopCameraLiveSyncLoop()
            }
            if (immediate) {
                finish()
                return
            }
            state.cameraManualInteractionTimer = setTimeout(finish, 120)
        }
        const moveStart = () => {
            if (!state.cameraPointerActive && !state.cameraUserAdjusting) {
                return
            }
            manualStart()
        }
        const moveEnd = () => {
            if (state.cameraPointerActive) {
                return
            }
            const replay = replayStore()
            const replayCameraActive = isJourneyReplayCameraActive(replay) || state.sampler
            if (!state.suppressPlaybackCameraSync
                && replayCameraActive
                && !state.cameraUserAdjusting
                && !state.cameraApplyingView
                && call.now() >= state.cameraAutoTrackingIgnoreUntil) {
                state.cameraUserAdjusting = true
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
        state.unbind.push(() => {
            camera.changed?.removeEventListener?.(cameraChanged)
            camera.moveStart.removeEventListener(moveStart)
            camera.moveEnd.removeEventListener(moveEnd)
            call.stopCameraLiveSyncLoop()
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

export const bindCesiumCameraBridge = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (state.cameraBridgeBound) {
            return true
        }

        const camera = globalThis.lgs?.viewer?.camera
        if (!camera) {
            return false
        }

        call.bindMarkerInteractions()
        state.cameraBridgeBound = true
        return true
    }

export const startCameraLiveSyncLoop = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (state.cameraLiveSyncFrame !== null) {
            return
        }

        const tick = () => {
            state.cameraLiveSyncFrame = null
            if (!state.cameraUserAdjusting && !state.cameraPointerActive) {
                return
            }
            call.updateCameraFromCesiumControls()
            state.cameraLiveSyncFrame = globalThis.__?.requestAnimationFrame?.(tick)
                ?? globalThis.requestAnimationFrame?.(tick)
                ?? null
        }

        state.cameraLiveSyncFrame = globalThis.__?.requestAnimationFrame?.(tick)
            ?? globalThis.requestAnimationFrame?.(tick)
            ?? null
    }

export const stopCameraLiveSyncLoop = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]

        if (state.cameraLiveSyncFrame === null) {
            return
        }

        if (globalThis.__?.cancelAnimationFrame) {
            globalThis.__.cancelAnimationFrame(state.cameraLiveSyncFrame)
        }
        else {
            globalThis.cancelAnimationFrame?.(state.cameraLiveSyncFrame)
        }
        state.cameraLiveSyncFrame = null
    }


export {
    applyResolvedReplayCameraView,
    updateCamera,
} from './JourneyReplayCameraTrackingBinding'
