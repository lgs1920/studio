/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraConstraintBinding.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {finiteNumber} from './JourneyReplayRuntime'
import {replayTurnDriftForGuideProgress} from './JourneyReplayCameraGuide'
import {
    clamp,
    replayAngularDelta,
    replayHeadingEasingFactor,
} from './JourneyReplayCameraMath'
import {replayVideoTraceDebug} from './ReplayVideoTraceDebug'
import {REPLAY_MARKER_MODE_NAVIGATION} from './JourneyReplayProgressionStyle'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from './JourneyReplayInternal'
import {
    buildConstrainedReplayCameraPath,
    offsetConstrainedReplayFrame,
    projectReplayTargetInCameraFrame,
} from './JourneyReplayConstrainedCameraPath'

const TERRAIN_REDIRECT_ATTACK_SECONDS = 0.75
const TERRAIN_REDIRECT_HOLD_SECONDS = 0.75
const TERRAIN_REDIRECT_RELEASE_SECONDS = 1
const TERRAIN_REDIRECT_CYCLE_SECONDS = TERRAIN_REDIRECT_ATTACK_SECONDS
                                         + TERRAIN_REDIRECT_HOLD_SECONDS
                                         + TERRAIN_REDIRECT_RELEASE_SECONDS

/**
 * Apply smoothstep easing to a normalized value.
 *
 * @param {number} value - Normalized input.
 * @returns {number} Eased value.
 */
const smoothstep = value => {
    const safeValue = clamp(finiteNumber(value) ?? 0, 0, 1)
    return safeValue * safeValue * (3 - (2 * safeValue))
}

/**
 * Convert an optional value without treating null as numeric zero.
 *
 * @param {*} value - Optional numeric value.
 * @returns {number|null} Finite number or null.
 */
const optionalFiniteNumber = value => (
    value === null || value === undefined || value === ''
        ? null
        : finiteNumber(value)
)

/**
 * Rebase a 60 FPS smoothing factor on the compiled replay time step.
 *
 * @param {number} factor - Reference per-frame factor.
 * @param {number} deltaSeconds - Compiled sample delta.
 * @returns {number} Time-normalized factor.
 */
const constrainedReplaySmoothingFactor = (factor, deltaSeconds) => {
    const safeFactor = clamp(finiteNumber(factor) ?? 0, 0, 1)
    const safeDelta = Math.max(0, finiteNumber(deltaSeconds) ?? 0)
    if (safeDelta <= 0) {
        return safeFactor
    }

    return 1 - Math.pow(1 - safeFactor, safeDelta * 60)
}

/**
 * Smooth an angle through its shortest signed arc.
 *
 * @param {number|null} previous - Previous compiled angle.
 * @param {number} next - Desired angle.
 * @param {number} factor - Smoothing factor.
 * @returns {number} Smoothed angle.
 */
const smoothConstrainedReplayAngle = (previous, next, factor) => {
    const nextValue = optionalFiniteNumber(next)
    const previousValue = optionalFiniteNumber(previous)
    if (nextValue === null) {
        return previousValue ?? 0
    }
    if (previousValue === null) {
        return nextValue
    }

    const delta = replayAngularDelta(previousValue, nextValue)
    return delta === null
        ? nextValue
        : previousValue + (delta * clamp(finiteNumber(factor) ?? 0, 0, 1))
}

/**
 * Resolve the bounded weight of one terrain visibility correction.
 *
 * The correction eases in, remains active briefly, then always eases back to
 * zero. The replay-end envelope also guarantees the configured pitch at the
 * final frame.
 *
 * @param {object} options - Envelope inputs.
 * @param {number} options.elapsedSeconds - Time since the correction started.
 * @param {number} options.remainingSeconds - Time remaining in the replay.
 * @returns {number} Redirect weight from zero to one.
 */
export const constrainedReplayTerrainRedirectWeight = ({
    elapsedSeconds,
    remainingSeconds,
} = {}) => {
    const elapsed = Math.max(0, finiteNumber(elapsedSeconds) ?? 0)
    const remaining = Math.max(0, finiteNumber(remainingSeconds) ?? 0)
    const releaseStart = TERRAIN_REDIRECT_ATTACK_SECONDS + TERRAIN_REDIRECT_HOLD_SECONDS
    const cycleEnd = releaseStart + TERRAIN_REDIRECT_RELEASE_SECONDS
    let cycleWeight
    if (elapsed < TERRAIN_REDIRECT_ATTACK_SECONDS) {
        cycleWeight = smoothstep(elapsed / TERRAIN_REDIRECT_ATTACK_SECONDS)
    }
    else if (elapsed < releaseStart) {
        cycleWeight = 1
    }
    else if (elapsed < cycleEnd) {
        cycleWeight = 1 - smoothstep(
            (elapsed - releaseStart) / TERRAIN_REDIRECT_RELEASE_SECONDS,
        )
    }
    else {
        cycleWeight = 0
    }

    const replayEndWeight = smoothstep(
        remaining / TERRAIN_REDIRECT_RELEASE_SECONDS,
    )
    return clamp(cycleWeight * replayEndWeight, 0, 1)
}

/**
 * Build the crop-local projection context used by the constrained path.
 *
 * @param {object} mode - Replay camera mode.
 * @returns {object|null} Projection viewport or null when dimensions are unavailable.
 */
export const constrainedReplayProjectionViewport = mode => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const viewer = globalThis.lgs?.viewer
    const scene = call.cesiumScene()
    const canvas = viewer?.canvas ?? scene?.canvas ?? globalThis.lgs?.canvas
    const crop = call.videoCropRect()
    const canvasRect = canvas?.getBoundingClientRect?.()
    const canvasWidth = finiteNumber(canvas?.clientWidth)
                        ?? finiteNumber(canvasRect?.width)
                        ?? finiteNumber(canvas?.width)
    const canvasHeight = finiteNumber(canvas?.clientHeight)
                         ?? finiteNumber(canvasRect?.height)
                         ?? finiteNumber(canvas?.height)
    if (canvasWidth === null || canvasHeight === null || canvasWidth <= 0 || canvasHeight <= 0) {
        return null
    }

    return {
        left:         crop ? finiteNumber(crop.left) ?? 0 : 0,
        top:          crop ? finiteNumber(crop.top) ?? 0 : 0,
        width:        crop ? finiteNumber(crop.width) ?? canvasWidth : canvasWidth,
        height:       crop ? finiteNumber(crop.height) ?? canvasHeight : canvasHeight,
        canvasWidth,
        canvasHeight,
    }
}

/**
 * Build a stable cache key for the in-memory constrained replay path.
 *
 * @param {object} mode - Replay camera mode.
 * @param {object} options - Path inputs.
 * @returns {string} Cache key.
 */
export const constrainedReplayCameraPathKey = (mode, {
    trackingMode,
    cameraSettings,
    markerSettings,
    runtimeTracking,
    viewport,
    durationSeconds,
    responseSeconds,
    lookaheadSeconds,
} = {}) => {
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const viewer = globalThis.lgs?.viewer
    const frustum = viewer?.camera?.frustum
    return JSON.stringify({
        guide: call.cameraGuideKey(),
        trackingMode,
        cameraSettings,
        markerSettings,
        runtimeTracking,
        viewport,
        durationSeconds,
        responseSeconds,
        lookaheadSeconds,
        fov: finiteNumber(frustum?.fovy) ?? finiteNumber(frustum?.fov),
        aspectRatio: finiteNumber(frustum?.aspectRatio),
        markerRadius: finiteNumber(globalThis.lgs?.stores?.replay?.markerRadius) ?? 35,
    })
}

/**
 * Resolve the single constrained path shared by Draft and HQ replay.
 *
 * @param {object} mode - Replay camera mode.
 * @param {object} options - Current replay settings.
 * @returns {object|null} Cached or newly compiled constrained path.
 */
export const resolveConstrainedReplayCameraPath = (mode, {
    trackingMode,
    cameraSettings,
    markerSettings,
    runtimeTracking,
    durationSeconds,
    responseSeconds,
    lookaheadSeconds,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const viewport = call.constrainedReplayProjectionViewport?.()
        ?? constrainedReplayProjectionViewport(mode)
    if (!viewport || !state.sampler?.atProgress) {
        return null
    }

    const pathKey = constrainedReplayCameraPathKey(mode, {
        trackingMode,
        cameraSettings,
        markerSettings,
        runtimeTracking,
        viewport,
        durationSeconds,
        responseSeconds,
        lookaheadSeconds,
    })
    if (state.constrainedReplayCameraPath?.key === pathKey) {
        return state.constrainedReplayCameraPath.path
    }

    const viewer = globalThis.lgs?.viewer
    const frustum = viewer?.camera?.frustum
    const verticalFovRadians = finiteNumber(frustum?.fovy)
                               ?? finiteNumber(frustum?.fov)
                               ?? (Math.PI / 3)
    const aspectRatio = finiteNumber(frustum?.aspectRatio)
                        ?? (viewport.canvasWidth / viewport.canvasHeight)
    const cameraGuide = call.buildCameraGuide() ?? []
    const guideProgresses = cameraGuide
        .map(point => finiteNumber(point?.progress))
        .filter(progress => progress !== null)
    const compileStartedAt = globalThis.performance?.now?.() ?? Date.now()
    replayVideoTraceDebug('camera.path.compile.start', {
        key: pathKey,
        trackingMode,
        durationSeconds,
        responseSeconds,
        lookaheadSeconds,
        guideProgressCount: guideProgresses.length,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
    })
    const normalizedTrackingMode = trackingMode === REPLAY_MARKER_MODE_NAVIGATION
                                   ? 'navigation'
                                   : 'dynamic'
    const triggerZone = normalizedTrackingMode === 'navigation'
                        ? runtimeTracking.navigation.triggerZone
                        : runtimeTracking.dynamic.triggerZone
    const targetZone = normalizedTrackingMode === 'dynamic'
                       ? runtimeTracking.dynamic.targetZone
                       : null
    const markerRadius = finiteNumber(globalThis.lgs?.stores?.replay?.markerRadius) ?? 35
    const turnDriftOptions = {
        enabled:               true,
        maxHeadingOffsetDeg:    10,
        maxLateralOffsetMeters: 60,
    }
    const compiledDurationSeconds = Math.max(
        1,
        finiteNumber(durationSeconds) ?? 60,
    )
    let previousHeading = null
    let previousPitch = null
    let previousProgress = null
    let terrainRedirectCycle = null
    let activeTerrainRedirect = null
    const terrainRedirects = []
    let terrainOcclusionHandled = false
    /**
     * Project a marker through a candidate compiled frame.
     *
     * @param {object} options - Candidate frame and marker target.
     * @returns {object|null} Crop-local point.
     */
    const projectTarget = ({frame, target}) => projectReplayTargetInCameraFrame({
        frame,
        target,
        viewport,
        verticalFovRadians,
        aspectRatio,
    })
    /**
     * Build the nominal or terrain-redirected frame for one journey sample.
     *
     * @param {object} sample - Journey sample.
     * @param {number} progress - Normalized replay progress.
     * @returns {object|null} Complete camera frame.
     */
    const frameForSample = (sample, progress) => {
        const rawView = call.cameraViewForSample({
            sample,
            progress,
            source: 'drawer',
            cameraSettings,
            markerSettings,
            collision: true,
            previousHeading: null,
            previousPitch: null,
        })
        if (!rawView) {
            return null
        }

        const safeProgress = clamp(finiteNumber(progress) ?? 0, 0, 1)
        const deltaSeconds = previousProgress === null
                             ? 0
                             : Math.max(
                0,
                (safeProgress - previousProgress) * compiledDurationSeconds,
            )
        const headingFactor = constrainedReplaySmoothingFactor(
            replayHeadingEasingFactor({
                previousHeading,
                nextHeading: rawView.heading,
                easing:      cameraSettings?.hysteresis?.easing,
                minFactor:   0.04,
                maxFactor:   0.18,
            }),
            deltaSeconds,
        )
        const pitchFactor = constrainedReplaySmoothingFactor(0.08, deltaSeconds)
        const view = {
            ...rawView,
            heading: smoothConstrainedReplayAngle(
                previousHeading,
                rawView.heading,
                headingFactor,
            ),
            pitch: smoothConstrainedReplayAngle(
                previousPitch,
                rawView.pitch,
                pitchFactor,
            ),
        }
        previousHeading = view.heading
        previousPitch = view.pitch
        previousProgress = safeProgress

        let frame = call.cameraRecenterFrame({
            sample: view.sample,
            heading: view.heading,
            pitch: view.pitch,
            cameraSettings,
            cameraHeight: view.cameraHeight,
        })
        const nominalLineOfSightVisible = frame
            ? call.cameraLineOfSightVisibleForFrame({
                ...frame,
                sample:       view.sample,
                targetHeight: call.markerRenderHeightForSample(view.sample),
            })
            : false
        const sampleTimeSeconds = safeProgress * compiledDurationSeconds
        if (nominalLineOfSightVisible) {
            terrainOcclusionHandled = false
        }
        else if (frame && !terrainRedirectCycle && !terrainOcclusionHandled) {
            const redirectState = call.findCameraRedirectState({
                nominalView: view,
                futureSample: null,
                source: 'playback',
                cameraSettings,
                markerSettings,
                reuseCurrentIfVisible: false,
            })
            terrainOcclusionHandled = true
            if (redirectState) {
                terrainRedirectCycle = {
                    redirectState,
                    startSeconds: sampleTimeSeconds,
                }
                activeTerrainRedirect = {
                    startProgress: safeProgress,
                    startSeconds:  sampleTimeSeconds,
                    redirectState: {...redirectState},
                    endProgress:    null,
                    endSeconds:     null,
                    durationSeconds: null,
                }
                terrainRedirects.push(activeTerrainRedirect)
            }
        }

        if (frame && terrainRedirectCycle) {
            const elapsedSeconds = Math.max(
                0,
                sampleTimeSeconds - terrainRedirectCycle.startSeconds,
            )
            const redirectWeight = constrainedReplayTerrainRedirectWeight({
                elapsedSeconds,
                remainingSeconds: compiledDurationSeconds - sampleTimeSeconds,
            })
            const weightedRedirectState = redirectWeight > Number.EPSILON
                ? {
                    headingOffset: (
                        finiteNumber(terrainRedirectCycle.redirectState?.headingOffset) ?? 0
                    ) * redirectWeight,
                    pitchOffset: (
                        finiteNumber(terrainRedirectCycle.redirectState?.pitchOffset) ?? 0
                    ) * redirectWeight,
                }
                : null
            const redirectedView = weightedRedirectState
                ? call.cameraViewWithRedirectState(view, weightedRedirectState)
                : null
            if (redirectedView) {
                frame = call.cameraRecenterFrame({
                    sample: redirectedView.sample,
                    heading: redirectedView.heading,
                    pitch: redirectedView.pitch,
                    cameraSettings,
                    cameraHeight: redirectedView.cameraHeight,
                }) ?? frame
            }
            if (elapsedSeconds >= TERRAIN_REDIRECT_CYCLE_SECONDS) {
                if (activeTerrainRedirect) {
                    activeTerrainRedirect.endProgress = safeProgress
                    activeTerrainRedirect.endSeconds = sampleTimeSeconds
                    activeTerrainRedirect.durationSeconds = Math.max(
                        0,
                        sampleTimeSeconds - activeTerrainRedirect.startSeconds,
                    )
                    activeTerrainRedirect = null
                }
                terrainRedirectCycle = null
            }
        }
        const standardFrame = frame ? {
            destination: frame.destination,
            direction:   frame.direction,
            up:          frame.correctedUp,
        } : null
        if (!standardFrame) {
            return null
        }

        const target = call.markerRenderCartesianForSample(view.sample)
        const drift = replayTurnDriftForGuideProgress(
            cameraGuide,
            progress,
            turnDriftOptions,
        )
        return drift?.lateralOffsetMeters && target
            ? offsetConstrainedReplayFrame(
                standardFrame,
                target,
                drift.lateralOffsetMeters,
            )
            : standardFrame
    }
    /**
     * Resolve the rendered marker Cartesian for one journey sample.
     *
     * @param {object} sample - Journey sample.
     * @returns {Cartesian3|null} Marker Cartesian.
     */
    const targetForSample = sample => {
        const markerSample = call.markerPositionForSample(sample, markerSettings)
        return call.markerRenderCartesianForSample(markerSample)
    }
    /**
     * Resolve one deterministic sample from replay progress.
     *
     * @param {number} progress - Normalized replay progress.
     * @returns {object|null} Journey sample.
     */
    const sampleAtProgress = progress => state.sampler.atProgress(progress)
    const path = buildConstrainedReplayCameraPath({
        progresses: guideProgresses,
        sampleAtProgress,
        frameForSample,
        targetForSample,
        projectTarget,
        trackingMode: normalizedTrackingMode,
        triggerZone,
        targetZone,
        viewport,
        markerRadius,
        durationSeconds,
        responseSeconds,
        lookaheadSeconds,
    })
    if (activeTerrainRedirect) {
        activeTerrainRedirect.endProgress = 1
        activeTerrainRedirect.endSeconds = compiledDurationSeconds
        activeTerrainRedirect.durationSeconds = Math.max(
            0,
            compiledDurationSeconds - activeTerrainRedirect.startSeconds,
        )
        activeTerrainRedirect = null
    }
    const compileEndedAt = globalThis.performance?.now?.() ?? Date.now()
    replayVideoTraceDebug('camera.path.compile.end', {
        key: pathKey,
        elapsedMs: compileEndedAt - compileStartedAt,
        compiled: path !== null,
        frameCount: path?.frames?.length ?? 0,
        constrainedSamples: path?.constrainedSamples ?? 0,
    })
    state.constrainedReplayCameraPath = path ? {
        key: pathKey,
        path: {
            ...path,
            terrainRedirects: terrainRedirects.map(entry => ({
                ...entry,
                redirectState: {...entry.redirectState},
            })),
        },
    } : null
    return path
}
