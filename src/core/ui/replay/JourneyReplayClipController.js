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
import {REPLAY_CAMERA_ALTITUDE_CONSTANT, REPLAY_CAMERA_POSITION_SYSTEM, getJourneyReplaySettings, normalizeJourneyReplayCamera, normalizeJourneyReplayMarker} from './JourneyReplayProgressionStyle'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'
import {JOURNEY_REPLAY_INTERNAL_CALL, JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'
import {resolveJourneyReplayLogicalCameraPose} from './JourneyReplayLogicalCameraPose'
import {createReplayCameraCommand} from './ReplayCameraCommand'

const SAFE_TOP_DOWN_PITCH = -(Math.PI / 2 - 0.0001)
const LANDING_CAMERA_GROUND_OFFSET_METERS = 20

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

export const focusTargetSampleForReplayExport = async (mode, sample, targetMode = 'centroid') => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (normalizeReplayFocusTarget(targetMode) === 'last-point') {
            return sample
        }

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
        roll: finiteNumber(view.roll) ?? 0,
        height: finiteNumber(view.height),
        cameraCommand: view.cameraCommand ? {...view.cameraCommand} : null,
        cameraSettings: view.cameraSettings ? {...view.cameraSettings} : null,
    }
}

/**
 * Force a camera settings object to use an absolute WGS84 camera altitude.
 *
 * @param {Object|null} cameraSettings - Camera settings to clone.
 * @returns {Object|null} Camera settings with absolute altitude semantics.
 */
const groundCameraSettings = cameraSettings => cameraSettings
    ? {
        ...cameraSettings,
        altitudeMode: REPLAY_CAMERA_ALTITUDE_CONSTANT,
    }
    : cameraSettings

/**
 * Normalize the focus target selected by a replay clip.
 *
 * @param {string|null} targetMode - Focus target value from clip parameters.
 * @returns {string} Canonical focus target identifier.
 */
const normalizeReplayFocusTarget = targetMode => {
    const normalized = `${targetMode ?? ''}`.trim().toLowerCase()
    return normalized === 'last'
        || normalized === 'last-point'
        || normalized === 'lastpoint'
        ? 'last-point'
        : 'centroid'
}

export const currentReplayClipCameraState = (mode, {initial = false, sample = null} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const camera = (call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera
        const saved = initial ? state.savedCameraState : null
        return {
            sample: sample ? {...sample} : null,
            heading: finiteNumber(saved?.orientation?.heading)
                     ?? finiteNumber(camera?.heading)
                     ?? 0,
            pitch:   finiteNumber(saved?.orientation?.pitch)
                     ?? finiteNumber(camera?.pitch)
                     ?? SAFE_TOP_DOWN_PITCH,
            roll:    finiteNumber(saved?.orientation?.roll)
                     ?? finiteNumber(camera?.roll)
                     ?? 0,
            height:  finiteNumber(saved?.destination?.height)
                     ?? finiteNumber(camera?.positionCartographic?.height)
                     ?? finiteNumber(camera?.positionCartographic?.altitude)
                     ?? null,
        }
    }

/**
 * Resolve the element that owns an adjacent replay boundary.
 *
 * The next replay phase owns the entry pose when it follows a clip. A
 * take-off owns its ground entry pose. The replay owns the exit pose before a
 * stop clip. All other boundaries are carried by the preceding element's
 * final pose and consumed by the next element as its start pose.
 *
 * @param {Object|null} previous - Previous clip or replay element.
 * @param {Object|null} next - Next clip or replay element.
 * @returns {'previous'|'next'} Boundary owner.
 */
export const replayElementBoundaryOwner = ({previous = null, next = null} = {}) => {
    const previousType = `${previous?.type ?? previous?.kind ?? previous?.clipId ?? ''}`
    const nextType = `${next?.type ?? next?.kind ?? next?.clipId ?? ''}`

    if (nextType === 'replay' || nextType === 'take-off' || nextType === 'launch') {
        return 'next'
    }
    if (previousType === 'replay') {
        return 'previous'
    }
    return 'previous'
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
                                               nextClip = null,
                                               nextElement = null,
                                           } = {}) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!clip || !sample) {
            return null
        }

        const settings = getJourneyReplaySettings()
        const replayCamera = normalizeJourneyReplayCamera(globalThis.lgs?.stores?.replay?.camera ?? settings.camera)
        const clipCamera = call.cameraSettingsForClip(clip)
        const duration = Math.max(0, Number(clip?.params?.duration ?? clipCamera?.duration ?? 0))
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
        const clipCameraHeightForSample = target => finiteNumber(
            call.cameraAltitudeForSample?.(target, clipCamera),
        ) ?? clipHeight
        const replayCameraHeightForSample = target => finiteNumber(
            call.cameraAltitudeForSample?.(target, replayCamera),
        ) ?? baseView.cameraHeight
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
            pathMode: null,
        }
        const boundaryNextElement = nextElement
            ?? (nextClip ? {type: 'clip', clip: nextClip, clipId: nextClip.clipId} : null)
        const applyOwnedNextBoundary = (candidatePlan, nextTarget = null) => {
            if (!boundaryNextElement
                || replayElementBoundaryOwner({
                    previous: {type: 'clip', clipId: clip.clipId},
                    next: boundaryNextElement,
                }) !== 'next') {
                return candidatePlan
            }

            const nextType = `${boundaryNextElement?.type ?? boundaryNextElement?.kind ?? boundaryNextElement?.clipId ?? ''}`
            if (nextType === 'replay') {
                candidatePlan.endView = {
                    ...baseStartView,
                    sample: baseView.sample,
                    heading: replayHeading,
                    pitch: degreesToRadians(replayCamera.pitch) ?? baseView.pitch,
                    height: replayCameraHeightForSample(baseView.sample),
                    cameraSettings: replayCamera,
                }
                return candidatePlan
            }

            if (nextType === 'take-off' || nextType === 'launch') {
                const nextClipCamera = call.cameraSettingsForClip(nextClip ?? boundaryNextElement)
                const target = nextTarget ?? sample
                const groundHeight = finiteNumber(call.markerRenderHeightForSample?.(target))
                                   ?? finiteNumber(target?.altitude ?? target?.height)
                                   ?? candidatePlan.endView.height
                candidatePlan.endView = {
                    ...candidatePlan.endView,
                    sample: target,
                    height: groundHeight,
                    cameraSettings: groundCameraSettings(nextClipCamera),
                }
            }

            return candidatePlan
        }
        const applyNextBoundary = (candidatePlan, nextTargetSource = null) => {
            if (!nextTargetSource || typeof nextTargetSource?.then !== 'function') {
                return applyOwnedNextBoundary(candidatePlan, nextTargetSource)
            }
            return nextTargetSource.then(nextTarget => applyOwnedNextBoundary(candidatePlan, nextTarget))
        }
        const withTarget = (targetSource, buildPlan) => {
            const resolveTarget = target => applyNextBoundary(buildPlan(target ?? sample),
                nextClip?.clipId === 'take-off' || nextClip?.clipId === 'launch'
                    ? call.targetSampleForClip(sample, nextClip.clipId)
                    : null,
            )
            return typeof targetSource?.then === 'function'
                   ? targetSource.then(resolveTarget)
                   : resolveTarget(targetSource)
        }

        switch (clip.clipId) {
            case 'zoom-in': {
                const buildZoomInPlan = (target, nextStartTarget = null) => {
                    const replayHeight = replayCameraHeightForSample(target)
                    const clipHeight = clipCameraHeightForSample(continuityStartView.sample ?? target)
                    const followsGroundStartClip = nextClip?.clipId === 'take-off' || nextClip?.clipId === 'launch'
                    const nextClipCamera = followsGroundStartClip
                        ? call.cameraSettingsForClip(nextClip)
                        : null
                    const nextGroundTarget = nextStartTarget ?? target
                    const nextGroundHeight = followsGroundStartClip
                        ? finiteNumber(call.markerRenderHeightForSample?.(nextGroundTarget))
                          ?? finiteNumber(nextGroundTarget?.altitude ?? nextGroundTarget?.height)
                          ?? replayHeight
                        : replayHeight
                    plan.initialView = continuityStartView
                    plan.startView = {
                        ...continuityStartView,
                        height: Math.max(
                            finiteNumber(continuityStartView.height) ?? 0,
                            clipHeight,
                            replayHeight,
                        ),
                        cameraSettings: clipCamera,
                    }
                    plan.endView = {
                        ...baseStartView,
                        sample: followsGroundStartClip ? nextGroundTarget : target,
                        heading: followsGroundStartClip ? continuityStartView.heading : replayHeading,
                        pitch: followsGroundStartClip
                            ? continuityStartView.pitch
                            : degreesToRadians(replayCamera.pitch) ?? baseView.pitch,
                        height: nextGroundHeight,
                        cameraSettings: followsGroundStartClip
                            ? groundCameraSettings(nextClipCamera)
                            : replayCamera,
                    }
                    plan.pathMode = clip?.params?.pathMode ?? clip?.params?.path ?? null
                    return plan
                }
                const nextStartTargetSource = nextClip?.clipId === 'take-off' || nextClip?.clipId === 'launch'
                    ? call.targetSampleForClip(sample, nextClip.clipId)
                    : null
                return withTarget(call.targetSampleForClip(sample, clip.clipId), target => {
                    if (typeof nextStartTargetSource?.then === 'function') {
                        return nextStartTargetSource.then(nextStartTarget => buildZoomInPlan(target, nextStartTarget))
                    }
                    return buildZoomInPlan(target, nextStartTargetSource)
                })
            }
            case 'take-off':
            case 'launch': {
                return withTarget(call.targetSampleForClip(sample, clip.clipId), target => {
                    const groundHeight = finiteNumber(call.markerRenderHeightForSample?.(target))
                                     ?? finiteNumber(target?.altitude ?? target?.height)
                                     ?? continuityStartView.height
                    plan.setupDestination = null
                    plan.startView = {
                        ...continuityStartView,
                        sample: target,
                        height: groundHeight,
                        cameraSettings: groundCameraSettings(clipCamera),
                    }
                    const requestedEndHeight = clipCameraHeightForSample(target)
                    plan.endView = {
                        ...baseStartView,
                        sample: target,
                        heading: replayHeading,
                        pitch:   clipPitch,
                        // A take-off must never end below its ground pose, even
                        // when an old persisted absolute altitude is invalid.
                        height:  Math.max(groundHeight, requestedEndHeight),
                        cameraSettings: groundCameraSettings(clipCamera),
                    }
                    plan.pathMode = clip?.params?.pathMode ?? clip?.params?.path ?? null
                    return plan
                })
            }
            case 'landing': {
                return withTarget(call.targetSampleForClip(sample, clip.clipId), target => {
                    const landingTarget = target ?? {
                        ...sample,
                        altitude: call.markerRenderHeightForSample(sample, {fallback: 0}),
                    }
                    plan.stopRotate = true
                    plan.startView = {
                        ...continuityStartView,
                    }
                    plan.endView = {
                        ...continuityStartView,
                        sample: landingTarget,
                        heading: replayHeading,
                        pitch: degreesToRadians(replayCamera.pitch) ?? baseView.pitch,
                        height: (finiteNumber(call.markerRenderHeightForSample(landingTarget, {fallback: 0})) ?? 0)
                            + LANDING_CAMERA_GROUND_OFFSET_METERS,
                        cameraSettings: groundCameraSettings(replayCamera),
                    }
                    plan.pathMode = clip?.params?.pathMode ?? clip?.params?.path ?? null
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
                        height:  clipCameraHeightForSample(target),
                        cameraSettings: clipCamera,
                    }
                    plan.pathMode = clip?.params?.pathMode ?? clip?.params?.path ?? null
                    return plan
                })
            }
            case 'focus': {
                return withTarget(call.focusTargetSampleForReplayExport(baseView.sample, clip?.params?.focusTarget), target => {
                    plan.kind = 'focus'
                    plan.focusTarget = target
                    plan.rpm = Number.isFinite(Number(clip?.params?.rpm)) ? Number(clip.params.rpm) : 0
                    plan.endView = {
                        ...baseStartView,
                        sample: target,
                        heading: baseView.heading,
                        pitch:   clipPitch,
                        height:  clipCameraHeightForSample(target),
                        cameraSettings: clipCamera,
                    }
                    plan.pathMode = clip?.params?.pathMode ?? clip?.params?.path ?? null
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
        const view = {
            sample: viewSample,
            heading,
            pitch: lerp(plan.startView?.pitch, plan.endView?.pitch, ratio),
            roll: interpolateRadians(plan.startView?.roll ?? 0, plan.endView?.roll ?? 0, ratio),
            height: lerp(plan.startView?.height, plan.endView?.height, ratio),
            cameraSettings: plan.endView?.cameraSettings,
        }
        return {
            ...view,
            cameraCommand: createReplayCameraCommand({
                pose: {
                    target: view.sample,
                    heading: view.heading,
                    pitch: view.pitch,
                    roll: view.roll,
                    cameraHeight: view.height,
                },
                source: 'replay-clip',
            }),
        }
    }

const replayClipEndView = (mode, plan) => {
    const durationMillis = Math.max(0, (finiteNumber(plan?.duration) ?? 0) * 1000)
    const frameView = sampleJourneyReplayClipCameraPlan(mode, plan, {
        localProgress: 1,
        localMillis:  durationMillis,
    })
    return cloneReplayClipCameraView({
        ...plan?.endView,
        ...frameView,
        sample:         plan?.endView?.sample,
        cameraSettings: plan?.endView?.cameraSettings,
    })
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
 * Play a clip from its deterministic camera path.
 *
 * Cesium receives each resolved pose as an output operation. It does not
 * provide the clock, interpolation, flight callback, or completion signal.
 */
const playJourneyReplayClipPath = (mode, plan, {token, state, call, onFrame = null} = {}) => {
    const durationMillis = Math.max(0, (finiteNumber(plan?.duration) ?? 0) * 1000)
    const startedAt = globalThis.performance?.now?.() ?? Date.now()
    const deterministicPathAvailable = typeof call.startDeterministicCameraTransition === 'function'
                                      && typeof call.applyDeterministicCameraTransition === 'function'
                                      && typeof call.cameraRecenterFrame === 'function'
    let deterministicPathStarted = false

    const finalView = sampleJourneyReplayClipCameraPlan(mode, plan, {
        localProgress: 1,
        localMillis:  durationMillis,
    })
    const endFrame = deterministicPathAvailable
        ? call.cameraRecenterFrame({
            sample:         plan.endView?.sample,
            heading:        finalView?.heading,
            pitch:          finalView?.pitch,
            cameraSettings: finalView?.cameraSettings,
            cameraHeight:   finalView?.height,
        })
        : null
    const startFrame = deterministicPathAvailable
        ? call.cameraRecenterFrame({
            sample:         plan.startView?.sample,
            heading:        plan.startView?.heading,
            pitch:          plan.startView?.pitch,
            cameraSettings: plan.startView?.cameraSettings,
            cameraHeight:   plan.startView?.height,
        })
        : null

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
                if (startFrame && endFrame && !deterministicPathStarted) {
                    try {
                        const started = call.startDeterministicCameraTransition({
                            sample:         plan.endView.sample,
                            heading:        finalView.heading,
                            pitch:          finalView.pitch,
                            startFrame,
                            endFrame,
                            pathMode:      plan.pathMode,
                            preserveCameraPath: plan.clipId === 'take-off' || plan.clipId === 'launch',
                            duration:       plan.instant === true ? 0 : durationMillis / 1000,
                            logicalNow:     plan.instant === true ? 0 : localMillis,
                            cameraSettings: finalView.cameraSettings,
                            viewport:       call.viewportRectForCesiumSurface?.() ?? null,
                        })
                        deterministicPathStarted = started !== false
                    }
                    catch {
                        deterministicPathStarted = false
                    }
                }

                if (deterministicPathStarted) {
                    call.applyDeterministicCameraTransition(localMillis)
                }
                else {
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
                }
                const renderScene = call.cesiumScene?.() ?? globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
                renderScene?.requestRender?.()
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

    // Every clip is evaluated by the same deterministic path runner.
    call.setContinuousRender?.(true)
    if (call.isReplayVideoLinked?.()) {
        call.hideJourneyToolbarVisibility?.()
    }
    if (plan.kind === 'focus') {
        call.applyJourneyReplayPOIVisibility?.()
    }

    const stopRotate = globalThis.__?.ui?.cameraManager?.stopRotate
    if (plan.stopRotate && typeof stopRotate === 'function') {
        await stopRotate()
    }

    await playJourneyReplayClipPath(mode, plan, {
        token: activeToken,
        state,
        call,
        onFrame,
    })
    return {endView: replayClipEndView(mode, plan)}
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
                                              nextClip = null,
                                              nextElement = null,
                                          } = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        const viewer = call.cesiumViewer?.() ?? globalThis.lgs?.viewer
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
        const phases = state.controller?.videoTimeline?.phases ?? []
        const phaseIndex = phases.findIndex(item => item === phase
            || (item?.startMillis === phase?.startMillis
                && item?.endMillis === phase?.endMillis
                && item?.kind === phase?.kind))
        const followingPhase = phaseIndex >= 0 ? phases[phaseIndex + 1] : null
        const resolvedNextClip = nextClip
            ?? (followingPhase?.kind === slot ? followingPhase.clip : null)
        const resolvedNextElement = nextElement
            ?? (followingPhase?.kind === 'replay'
                ? {type: 'replay'}
                : resolvedNextClip
                    ? {type: 'clip', clip: resolvedNextClip, clipId: resolvedNextClip.clipId}
                    : null)
        const plan = await call.resolveJourneyReplayClipCameraPlan({
            phase,
            clip,
            slot,
            sample,
            startCamera: state.replayExportClipFrameState,
            nextClip: resolvedNextClip,
            nextElement: resolvedNextElement,
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
                ...replayClipEndView(mode, plan),
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

        const liveHeight = finiteNumber((call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera?.positionCartographic?.height)
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
            return degreesToRadians(cameraSettings.heading) ?? finiteNumber((call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera?.heading) ?? 0
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
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    if (clipId === 'landing') {
        const groundHeight = finiteNumber(call.markerRenderHeightForSample?.(sample, {fallback: 0})) ?? 0
        return {
            ...sample,
            altitude: groundHeight,
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
    nextClip = null,
    nextElement = null,
    onFrame = null,
} = {}) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]

        if (!(call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera || !sample) {
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
            nextClip,
            nextElement,
        })
        return call.applyJourneyReplayClipCameraPlan(plan, {token, onFrame})
    }

export const runJourneyReplayClip = async (mode, clip, {
    sample,
    token,
    slot = null,
    phase = null,
    startCamera = null,
    nextClip = null,
    nextElement = null,
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
                return call.cameraClipFlight({sample, clip, token, slot, phase, startCamera, nextClip, nextElement, onFrame})
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
                nextClip: clips[clipIndex + 1] ?? null,
                nextElement: clips[clipIndex + 1]
                    ? {type: 'clip', clip: clips[clipIndex + 1], clipId: clips[clipIndex + 1].clipId}
                    : slot === REPLAY_CLIP_SLOT_START
                        ? {type: 'replay'}
                        : null,
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

        const camera = (call.cesiumViewer?.() ?? globalThis.lgs?.viewer)?.camera
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
        const viewer = call.cesiumViewer?.() ?? globalThis.lgs?.viewer
        viewer?.camera?.cancelFlight?.()
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
