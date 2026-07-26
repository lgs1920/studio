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

const TERRAIN_REDIRECT_RETRY_SAMPLES = 4

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
    let terrainRedirectState = null
    let terrainRedirectRetryIndex = 0
    let compiledFrameIndex = 0
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
        const frameIndex = compiledFrameIndex
        compiledFrameIndex += 1
        const view = call.cameraViewForSample({
            sample,
            progress,
            source: 'drawer',
            cameraSettings,
            markerSettings,
            collision: true,
            previousHeading: null,
            previousPitch: null,
        })
        if (!view) {
            return null
        }

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
        if (frame && !nominalLineOfSightVisible) {
            const currentRedirectVisible = terrainRedirectState
                ? call.cameraViewVisibilityForSample({
                    nominalView: view,
                    redirectState: terrainRedirectState,
                    futureSample: null,
                    source: 'playback',
                    cameraSettings,
                    markerSettings,
                })
                : false
            const shouldSearchRedirect = currentRedirectVisible
                                         || terrainRedirectState !== null
                                         || frameIndex >= terrainRedirectRetryIndex
            const redirectState = currentRedirectVisible
                                  ? terrainRedirectState
                                  : shouldSearchRedirect
                                    ? call.findCameraRedirectState({
                    nominalView: view,
                    futureSample: null,
                    source: 'playback',
                    cameraSettings,
                    markerSettings,
                    reuseCurrentIfVisible: false,
                })
                                    : null
            terrainRedirectState = redirectState
            if (!redirectState) {
                terrainRedirectRetryIndex = frameIndex + TERRAIN_REDIRECT_RETRY_SAMPLES
            }
            const redirectedView = redirectState
                ? call.cameraViewWithRedirectState(view, redirectState)
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
        }
        else {
            terrainRedirectState = null
            terrainRedirectRetryIndex = frameIndex
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
    state.constrainedReplayCameraPath = path ? {
        key: pathKey,
        path,
    } : null
    return path
}
