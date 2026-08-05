/**
 * Replay clips and export camera frames.
 */

import {Math as CesiumMath} from 'cesium'
import {CameraUtils} from '@Utils/cesium/CameraUtils'
import {TrackUtils} from '@Utils/cesium/TrackUtils'
import {REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP, normalizeJourneyReplayClips} from './JourneyReplayClips'
import {finiteNumber, replayStore, currentJourneyReplaySample} from './JourneyReplayRuntime'
import {
    clamp, lerp, hasFiniteLonLat, sanitizeOrientationRadians, replayHeadingFromLocalAxisAngle, replayPitchLookaheadFactor, replayCameraHeadingForPositionMode, replayAngularDelta, replayHeadingEasingFactor, replayCameraRecenterDuration, replayTargetSampleForClip, replayCameraRangeFromPitch, replayCameraRecenterHeight, replayCameraRecenterHorizontalDistance, replayToleranceZoneBounds, replayCenteredZone, replayCenteredSquareZone, replayNavigationZone, replayRuntimeTrackingSettings, replayDynamicTargetPointInZone, replayIsWindowPointOutsideToleranceZone, replayInnerToleranceZoneBounds, replayInsetBounds, replayWindowCollisionFromPoint, interpolateRadians, smoothClipProgress, replayCameraHeadingWithHysteresis, degreesToRadians, radiansToDegrees, safeCartographicFromCartesian, cameraGuideSampleFromRawSamples, projectToLocalMeters, cartographicToLonLat
} from './JourneyReplayCameraMath'
import {REPLAY_CAMERA_POSITION_SYSTEM, getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker} from './JourneyReplayProgressionStyle'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import {resolveJourneyReplayLogicalCameraPose} from './JourneyReplayLogicalCameraPose'

const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)

/**
 * Return whether replay clips should use the deterministic logical camera.
 *
 * @param {Object} state - Replay session state.
 * @param {Object} call - Replay session call bridge.
 * @returns {boolean} Whether the shared logical clip trajectory is active.
 */
const usesLogicalReplayClipTrajectory = (state, call) => Boolean(
    state.logicalCameraTrajectory === true
    || (state.videoReplayClipLogicalTrajectory === true && call.isReplayVideoLinked?.() === true),
)

export const interpolateReplayExportSample = (mode, start = null, end = null, ratio = 0) => {
        const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
        const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

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

export const focusTargetSampleForReplayExport = async (mode, sample) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

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

export const replayExportBaseView = (mode, {sample, progress = 0, cameraSettings = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const settings = getJourneyReplaySettings()
        const markerSettings = normalizeJourneyReplayMarker(globalThis.lgs?.stores?.replay?.marker ?? settings.marker)
        const resolvedCameraSettings = cameraSettings ?? normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? settings.camera)
        if (usesLogicalReplayClipTrajectory(state, call)) {
            return resolveJourneyReplayLogicalCameraPose({
                sample,
                sampler: state.sampler,
                progress,
                source: 'drawer',
                cameraSettings: resolvedCameraSettings,
                markerSettings,
            })
        }

        return call.cameraViewForSample({
            sample,
            progress,
            source: 'drawer',
            cameraSettings: resolvedCameraSettings,
            markerSettings,
            previousHeading: null,
            previousPitch:   null,
        })
    }

/**
 * Clone the camera view passed between adjacent replay clips.
 *
 * @param {Object|null} view - Camera view to clone.
 * @returns {Object|null} A detached camera view, or null when unavailable.
 */
const cloneReplayClipCameraView = view => {
    if (!view || typeof view !== 'object') {
        return null
    }

    return {
        sample: view.sample ? {...view.sample} : null,
        heading: finiteNumber(view.heading),
        pitch: finiteNumber(view.pitch),
        height: finiteNumber(view.height),
        cameraSettings: view.cameraSettings ? {...view.cameraSettings} : null,
    }
}

export const currentReplayClipCameraState = (mode, {initial = false, sample = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = globalThis.lgs?.viewer?.camera
        const saved = initial ? state.savedCameraState : null
        return {
            sample: sample ? {...sample} : null,
            heading: finiteNumber(saved?.orientation?.heading)
                     ?? finiteNumber(camera?.heading)
                     ?? 0,
            pitch:   finiteNumber(saved?.orientation?.pitch)
                     ?? finiteNumber(camera?.pitch)
                     ?? SAFE_TOP_DOWN_PITCH,
            height:  finiteNumber(saved?.destination?.height)
                     ?? finiteNumber(camera?.positionCartographic?.height)
                     ?? finiteNumber(camera?.positionCartographic?.altitude)
                     ?? null,
        }
    }

export const replayExportClipPhaseKey = (mode, {phase = null, slot = null, clip = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return [
        slot ?? phase?.slot ?? 'clip',
        clip?.id ?? clip?.clipId ?? phase?.clip?.id ?? phase?.clip?.clipId ?? 'unknown',
        finiteNumber(phase?.startMillis) ?? '',
        finiteNumber(phase?.endMillis) ?? '',
    ].join('|')
}

export const resolveJourneyReplayClipCameraPlan = (mode, {
                                               clip = null,
                                               slot = null,
                                               sample = null,
                                               startCamera = null,
                                           } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!clip || !sample) {
            return null
        }

        const settings = getJourneyReplaySettings()
        const replayCamera = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? settings.camera)
        const clipCamera = call.cameraSettingsForClip(clip)
        const duration = Math.max(0, Number(clip?.params?.duration ?? clipCamera?.duration ?? 0))
        const useLogicalCamera = usesLogicalReplayClipTrajectory(state, call)
        const anchorProgress = slot === REPLAY_CLIP_SLOT_STOP ? 1 : 0
        const baseView = call.replayExportBaseView({
            sample,
            progress: anchorProgress,
            cameraSettings: replayCamera,
        })
        if (!baseView) {
            return null
        }

        const currentCamera = startCamera
                             ?? call.currentReplayClipCameraState({
                                 initial: slot === REPLAY_CLIP_SLOT_START,
                                 sample,
                             })
        const replayHeading = call.clipReplayHeadingForProgress({
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
        const continuityStartView = {
            ...baseStartView,
            sample: currentCamera?.sample ?? baseStartView.sample,
            heading: finiteNumber(currentCamera?.heading) ?? baseStartView.heading,
            pitch: finiteNumber(currentCamera?.pitch) ?? baseStartView.pitch,
            height: finiteNumber(currentCamera?.height) ?? baseStartView.height,
            cameraSettings: currentCamera?.cameraSettings ?? baseStartView.cameraSettings,
        }
        const plan = {
            kind: 'camera',
            clip,
            clipId: clip.clipId,
            slot,
            duration,
            startView: continuityStartView,
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
                return withTarget(call.targetSampleForClip(sample, clip.clipId), target => {
                    const startAltitude = finiteNumber(clip?.params?.altitude ?? clipCamera.altitude) ?? clipHeight
                    const endAltitude = useLogicalCamera
                                       ? finiteNumber(replayCamera.altitude) ?? baseView.cameraHeight
                                       : call.cameraAltitudeForSample(target, replayCamera)
                    plan.initialView = continuityStartView
                    plan.startView = continuityStartView
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
                return withTarget(call.targetSampleForClip(sample, clip.clipId), target => {
                    plan.setupDestination = null
                    plan.startView = {
                        ...continuityStartView,
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
                return withTarget(call.targetSampleForClip(sample, clip.clipId), target => {
                    const landingTarget = target ?? {
                        ...sample,
                        altitude: call.markerRenderHeightForSample(sample),
                    }
                    plan.stopRotate = true
                    plan.instant = true
                    plan.startView = {
                        ...continuityStartView,
                    }
                    plan.endView = {
                        ...continuityStartView,
                        sample: landingTarget,
                        heading: replayHeading,
                        pitch: degreesToRadians(replayCamera.pitch) ?? baseView.pitch,
                        height: call.markerRenderHeightForSample(landingTarget),
                        cameraSettings: replayCamera,
                    }
                    return plan
                })
            }
            case 'zoom-out': {
                return withTarget(call.targetSampleForClip(sample, clip.clipId), target => {
                    plan.startView = {
                        ...continuityStartView,
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
                return withTarget(call.focusTargetSampleForReplayExport(baseView.sample), target => {
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

export const sampleJourneyReplayClipCameraPlan = (mode, plan = null, {localProgress = 0, localMillis = 0} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!plan) {
            return null
        }

        const ratio = plan.instant === true
                      ? 1
                      : smoothClipProgress(localProgress)
        const viewSample = call.interpolateReplayExportSample(plan.startView?.sample, plan.endView?.sample, ratio)
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

const requestLogicalCameraFrame = callback => {
    if (typeof globalThis.requestAnimationFrame === 'function') {
        return globalThis.requestAnimationFrame(callback)
    }
    if (typeof globalThis.window?.requestAnimationFrame === 'function') {
        return globalThis.window.requestAnimationFrame(callback)
    }

    return globalThis.setTimeout(() => {
        callback(globalThis.performance?.now?.() ?? Date.now())
    }, 16)
}

const cancelLogicalCameraFrame = handle => {
    globalThis.cancelAnimationFrame?.(handle)
    globalThis.clearTimeout?.(handle)
}

/**
 * Play a clip from its logical camera plan.
 *
 * Cesium receives each resolved pose as an output operation. It does not
 * provide the clock, interpolation, flight callback, or completion signal.
 */
const playLogicalJourneyReplayClip = (mode, plan, {token, state, call, onFrame = null} = {}) => {
    const durationMillis = Math.max(0, (finiteNumber(plan?.duration) ?? 0) * 1000)
    const startedAt = globalThis.performance?.now?.() ?? Date.now()

    return new Promise(resolve => {
        let frameHandle = null
        let settled = false
        const finish = result => {
            if (settled) {
                return
            }
            settled = true
            if (frameHandle !== null) {
                cancelLogicalCameraFrame(frameHandle)
            }
            resolve(result)
        }
        const tick = timestamp => {
            if (token !== state.clipSequenceToken) {
                finish(false)
                return
            }

            const now = finiteNumber(timestamp) ?? (globalThis.performance?.now?.() ?? Date.now())
            const localMillis = Math.max(0, Math.min(durationMillis, now - startedAt))
            const localProgress = durationMillis > 0 ? localMillis / durationMillis : 1
            const frameView = sampleJourneyReplayClipCameraPlan(mode, plan, {
                localProgress,
                localMillis,
            })

            if (frameView?.sample) {
                call.recenterCameraToSample({
                                             sample:         frameView.sample,
                                             heading:        frameView.heading,
                                             pitch:          frameView.pitch,
                                             cameraSettings: frameView.cameraSettings,
                                             cameraHeight:   frameView.height,
                                             instant:        true,
                                             duration:       0,
                                             deterministic:  true,
                                             logicalNow:     localMillis,
                                             force:          true,
                                         })
                globalThis.lgs?.scene?.requestRender?.()
            }
            onFrame?.({
                localProgress,
                localMillis,
                sample: frameView?.sample ?? null,
            })

            if (localMillis >= durationMillis) {
                finish(true)
                return
            }

            frameHandle = requestLogicalCameraFrame(tick)
        }

        tick(startedAt)
    })
}

export const applyJourneyReplayClipCameraPlan = async (mode, plan = null, {token = null, onFrame = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const activeToken = token ?? state.clipSequenceToken

        if (!plan) {
            return
        }

        const useLogicalCamera = usesLogicalReplayClipTrajectory(state, call)

        if (plan.kind === 'focus') {
            call.setContinuousRender(true)
            if (call.isReplayVideoLinked()) {
                call.hideJourneyToolbarVisibility()
            }
            if (useLogicalCamera) {
                call.applyJourneyReplayPOIVisibility()
                if (plan.stopRotate) {
                    await globalThis.__?.ui?.cameraManager?.stopRotate?.()
                }
                await playLogicalJourneyReplayClip(mode, plan, {
                    token: activeToken,
                    state,
                    call,
                    onFrame,
                })
                return {endView: cloneReplayClipCameraView(plan.endView)}
            }

            const journey = globalThis.lgs?.theJourney
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
            call.applyJourneyReplayPOIVisibility()
            await Promise.resolve(focusResult)
            await call.runClipDelay(plan.duration)
            return {endView: cloneReplayClipCameraView(plan.endView)}
        }

        if (useLogicalCamera) {
            if (plan.stopRotate) {
                await globalThis.__?.ui?.cameraManager?.stopRotate?.()
            }
            await playLogicalJourneyReplayClip(mode, plan, {
                token: activeToken,
                state,
                call,
                onFrame,
            })
            return {endView: cloneReplayClipCameraView(plan.endView)}
        }

        if (plan.setupDestination) {
            globalThis.lgs?.viewer?.camera?.setView?.({
                destination: plan.setupDestination,
            })
        }

        if (plan.initialView) {
            call.recenterCameraToSample({
                sample:         plan.initialView.sample,
                heading:        plan.initialView.heading,
                pitch:          plan.initialView.pitch,
                cameraSettings: plan.initialView.cameraSettings,
                cameraHeight:   plan.initialView.height,
                instant:        true,
            })
        }

        if (activeToken !== state.clipSequenceToken) {
            return
        }

        if (plan.stopRotate) {
            await globalThis.__?.ui?.cameraManager?.stopRotate?.()
        }

        await call.recenterCameraToSample({
            sample:         plan.endView.sample,
            heading:        plan.endView.heading,
            pitch:          plan.endView.pitch,
            cameraSettings: plan.endView.cameraSettings,
            cameraHeight:   plan.endView.height,
            instant:        plan.instant,
            duration:       plan.duration,
        })
        return {endView: cloneReplayClipCameraView(plan.endView)}
    }

export const isReplayVideoLinked = () => {
    const replay = globalThis.lgs?.stores?.replay
    const replaySetting = globalThis.lgs?.settings?.ui?.replay?.recordingSync
    return replay?.recordingSync === true || replaySetting === true
}

export const renderReplayExportClipFrame = async (mode, {
                                              phase = null,
                                              clip = null,
                                              slot = null,
                                              sample = null,
                                              localProgress = 0,
                                              localMillis = 0,
                                          } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = globalThis.lgs?.viewer
        if (!viewer?.camera || !clip || !sample) {
            return null
        }

        const phaseKey = call.replayExportClipPhaseKey({phase, slot, clip})
        if (!state.replayExportClipFrameState || state.replayExportClipFrameState.key !== phaseKey) {
            const continuityCamera = state.clipCameraContinuity
                                   ?? call.currentReplayClipCameraState({
                                       initial: slot === REPLAY_CLIP_SLOT_START,
                                       sample,
                                   })
            state.replayExportClipFrameState = {
                key:     phaseKey,
                ...cloneReplayClipCameraView(continuityCamera),
            }
        }
        const plan = await call.resolveJourneyReplayClipCameraPlan({
            phase,
            clip,
            slot,
            sample,
            startCamera: state.replayExportClipFrameState,
        })
        const frameView = call.sampleJourneyReplayClipCameraPlan(plan, {localProgress, localMillis})
        if (!frameView) {
            return null
        }
        call.recenterCameraToSample({
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

        if (localProgress >= 1) {
            state.clipCameraContinuity = {
                ...cloneReplayClipCameraView(frameView),
            }
        }

        return frameView.sample
    }

export const clipSettings = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return normalizeJourneyReplayClips(globalThis.lgs?.stores?.replay?.clips ?? getJourneyReplaySettings()?.clips ?? {})
}

export const clipListForSlot = (mode, slot) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const clips = call.clipSettings()
        return slot === REPLAY_CLIP_SLOT_STOP ? clips.stop : clips.start
    }

export const placeCameraAtPlaybackStart = (mode, sample, progress = 0) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!sample) {
            return false
        }

        const liveHeight = finiteNumber(globalThis.lgs?.viewer?.camera?.positionCartographic?.height)
        if (liveHeight === null) {
            return false
        }

        const settings = getJourneyReplaySettings()
        const cameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? settings.camera)
        const markerSettings = normalizeJourneyReplayMarker({
            ...(globalThis.lgs?.stores?.replay?.marker ?? settings.marker),
            position: null,
        })
        const view = call.cameraViewForSample({
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

        call.recenterCameraToSample({
            sample:         view.sample,
            heading:        view.heading,
            pitch:          view.pitch,
            cameraSettings,
            cameraHeight:   view.cameraHeight,
            instant:        true,
            duration:       0,
        })
        state.lastCameraHeading = view.heading
        state.lastCameraPitch = view.pitch
        call.rememberNominalCameraView(view)
        return true
    }

export const runClipDelay = (mode, durationSeconds = 0) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    return new Promise(resolve => {
        const duration = Math.max(0, Number(durationSeconds) || 0)
        if (duration === 0) {
            resolve()
            return
        }
        setTimeout(resolve, duration * 1000)
    })
}

export const cameraSettingsForClip = (mode, clip = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

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

export const introHeadingForProgress = (mode, progress = 0) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const cameraSettings = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        if (cameraSettings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            return degreesToRadians(cameraSettings.heading) ?? finiteNumber(globalThis.lgs?.viewer?.camera?.heading) ?? 0
        }

        return replayCameraHeadingForPositionMode({
            axisHeading: call.headingFromPositionProperty(progress),
            positionMode: cameraSettings.positionMode,
            headingOffset: cameraSettings.headingOffset,
        })
    }

export const clipReplayHeadingForProgress = (mode, {progress = 0, cameraSettings = null, fallbackHeading = 0} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const settings = normalizeJourneyReplayCamera(cameraSettings ?? globalThis.lgs?.stores?.replay?.camera ?? getJourneyReplaySettings().camera)
        if (settings.positionMode === REPLAY_CAMERA_POSITION_SYSTEM) {
            return degreesToRadians(settings.heading) ?? finiteNumber(fallbackHeading) ?? 0
        }

        return replayCameraHeadingForPositionMode({
            axisHeading: call.headingFromPositionProperty(progress),
            positionMode: settings.positionMode,
            headingOffset: settings.headingOffset,
        })
    }

export const targetSampleForClip = (mode, sample, clipId) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (state.logicalCameraTrajectory === true && clipId === 'landing') {
        return {
            ...sample,
            altitude: finiteNumber(sample?.altitude ?? sample?.height) ?? 0,
        }
    }

    return replayTargetSampleForClip({
        sample,
        clipId,
        journey:               globalThis.lgs?.theJourney ?? null,
        sceneManager:          globalThis.__?.ui?.sceneManager ?? null,
        markerHeightForSample: call.markerRenderHeightForSample,
    })
}

export const cameraClipFlight = async (mode, {
    sample,
    clip,
    token,
    slot = null,
    startCamera = null,
    onFrame = null,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!globalThis.lgs?.viewer?.camera || !sample) {
            return
        }

        const plan = await call.resolveJourneyReplayClipCameraPlan({
            clip,
            slot,
            sample,
            startCamera: startCamera
                         ?? call.currentReplayClipCameraState({
                             initial: slot === REPLAY_CLIP_SLOT_START,
                             sample,
                         }),
        })
        return call.applyJourneyReplayClipCameraPlan(plan, {token, onFrame})
    }

export const runJourneyReplayClip = async (mode, clip, {
    sample,
    token,
    slot = null,
    phase = null,
    startCamera = null,
    onFrame = null,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!clip || token !== state.clipSequenceToken) {
            return
        }

        switch (clip.clipId) {
            case 'take-off':
            case 'launch':
            case 'zoom-in':
            case 'zoom-out':
            case 'landing':
            case 'focus':
                return call.cameraClipFlight({sample, clip, token, slot, phase, startCamera, onFrame})
            default:
                return
        }
    }

export const playJourneyReplayClips = async (mode, slot, {
    sample = null,
    token = null,
    startCamera = null,
    onFrame = null,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const activeToken = token ?? state.clipSequenceToken
    let previousCamera = cloneReplayClipCameraView(
        startCamera
        ?? state.clipCameraContinuity
        ?? call.currentReplayClipCameraState({
            initial: slot === REPLAY_CLIP_SLOT_START,
            sample,
        }),
    )

        const clips = call.clipListForSlot(slot)
        const timelinePhases = state.controller?.videoTimeline?.phases
            ?.filter(phase => phase.kind === slot)
            ?? []
        for (const [clipIndex, clip] of clips.entries()) {
            if (activeToken !== state.clipSequenceToken) {
                return false
            }
            const result = await call.runJourneyReplayClip(clip, {
                sample,
                token: activeToken,
                slot,
                startCamera: previousCamera,
                phase: timelinePhases[clipIndex] ?? null,
                onFrame: onFrame
                          ? frame => onFrame({
                              ...frame,
                              clip,
                              slot,
                              phase: timelinePhases[clipIndex] ?? null,
                          })
                          : null,
            })
            previousCamera = cloneReplayClipCameraView(result?.endView ?? previousCamera)
            state.clipCameraContinuity = previousCamera
        }
        return activeToken === state.clipSequenceToken
    }

export const cancelActiveCameraFlight = (mode) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = globalThis.lgs?.viewer?.camera
        camera?.cancelFlight?.()
        call.cancelCameraBezierTransition(false)
        state.cameraFlightActive = false
    }

    /**
     * Recenter the current journey after the replay ends or is stopped.
     * The optional snapDistance keeps the transition instantaneous when the camera is already close.
     */

export const focusJourneyAfterPlayback = (mode, {snapDistance = 50000} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const journey = globalThis.lgs?.theJourney
        if (!journey) {
            return Promise.resolve()
        }

        journey.visible = true
        journey.updateVisibility?.(true)
        if (globalThis.lgs?.viewer?.dataSources) {
            TrackUtils.updatePOIsVisibility(journey, true)
        }
        state.cameraFlightActive = false
        globalThis.lgs?.viewer?.camera?.cancelFlight?.()
        return new Promise(resolve => {
            let settled = false
        const finish = () => {
                if (settled) {
                    return
                }
                settled = true
                call.hideGloballyHiddenPOIs()
                call.restoreCurrentJourneyVisibility()
                resolve()
            }

            if (typeof journey.focus === 'function') {
                const focusResult = journey.focus({
                    resetCamera: true,
                    rotate:       false,
                    snapDistance,
                    callback:     finish,
                })
                void Promise.resolve(focusResult).finally(finish)
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
