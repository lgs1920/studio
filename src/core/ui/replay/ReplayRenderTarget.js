/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayRenderTarget.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Explicit Cesium render targets owned by replay sessions.
 *
 * Interactive playback and product export use Studio's viewer. Explicit
 * isolated render workflows install an owner-scoped target so camera and trace writes
 * remain separate from the visible map.
 */

import {JOURNEY_REPLAY_INTERNAL_STATE} from './JourneyReplayInternal'

const replayRenderTargets = new WeakMap()
let activeReplayRenderTargetOwner = null
let activeReplayRenderTarget = null

/**
 * Install an explicit render target for one replay owner.
 *
 * @param {Object} owner - Replay session owner.
 * @param {Object|null} target - Viewer, scene, and canvas target.
 * @returns {Object|null} Installed target.
 */
export const setReplayRenderTarget = (owner, target = null) => {
    if (!owner || (typeof owner !== 'object' && typeof owner !== 'function')) {
        return null
    }
    if (!target) {
        const current = replayRenderTargets.get(owner)
        replayRenderTargets.delete(owner)
        if (activeReplayRenderTargetOwner === owner && activeReplayRenderTarget === current) {
            activeReplayRenderTargetOwner = null
            activeReplayRenderTarget = null
        }
        return null
    }

    replayRenderTargets.set(owner, target)
    activeReplayRenderTargetOwner = owner
    activeReplayRenderTarget = target
    return target
}

/** Return the isolated target currently receiving Replay POI captures. */
export const activeReplayRenderTargetForPOICapture = () => activeReplayRenderTarget

/**
 * Return the explicit target currently owned by a replay session.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {Object|null} Active target.
 */
export const replayRenderTargetFor = owner => replayRenderTargets.get(owner) ?? null

/**
 * Return the logical viewport for an isolated renderer whose frustum already
 * applies the selected crop. Camera tracking must use the preview crop's CSS
 * dimensions even when the isolated drawing buffer is much larger.
 *
 * @param {Object|null} target - Explicit Cesium render target.
 * @returns {Object|null} Crop-local viewport in logical CSS pixels.
 */
export const replayRenderTargetCropViewport = target => {
    if (!target?.cropProjection) {
        return null
    }

    const width = Number(target.viewportDimensions?.width
        ?? target.cropProjection?.crop?.width)
    const height = Number(target.viewportDimensions?.height
        ?? target.cropProjection?.crop?.height)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return null
    }

    return {
        left: 0,
        top: 0,
        width,
        height,
        canvasWidth: width,
        canvasHeight: height,
        canvasLeft: 0,
        canvasTop: 0,
    }
}

/**
 * Convert isolated-scene window coordinates into the preview crop's logical
 * coordinate space. Cesium projects against canvas.clientWidth/clientHeight,
 * which are the physical output size in the off-screen host.
 *
 * @param {Object|null} target - Explicit Cesium render target.
 * @param {Object|null} position - Cesium window-coordinate position.
 * @returns {Object|null} Position in logical crop CSS pixels.
 */
export const replayRenderTargetWindowPosition = (target, position) => {
    const viewport = replayRenderTargetCropViewport(target)
    const x = Number(position?.x)
    const y = Number(position?.y)
    if (!viewport || !Number.isFinite(x) || !Number.isFinite(y)) {
        return position ?? null
    }

    const bounds = target.canvas?.getBoundingClientRect?.()
    const canvasWidth = Number(target.canvas?.clientWidth)
        || Number(bounds?.width)
        || Number(target.canvas?.width)
    const canvasHeight = Number(target.canvas?.clientHeight)
        || Number(bounds?.height)
        || Number(target.canvas?.height)
    if (!Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight)
        || canvasWidth <= 0 || canvasHeight <= 0) {
        return position
    }

    return {
        x: x * viewport.width / canvasWidth,
        y: y * viewport.height / canvasHeight,
    }
}

/** Resolve the renderer that owns geometry for the active replay target. */
export const replayRendererFor = owner => {
    const state = owner?.[JOURNEY_REPLAY_INTERNAL_STATE]
    return replayRenderTargetFor(owner)
        ? state?.exportRenderer ?? state?.renderer ?? null
        : state?.renderer ?? null
}

/**
 * Clear a replay render target without removing a newer replacement.
 *
 * @param {Object} owner - Replay session owner.
 * @param {Object|null} expectedTarget - Optional target identity guard.
 * @returns {boolean} Whether the target was cleared.
 */
export const clearReplayRenderTarget = (owner, expectedTarget = null) => {
    const current = replayRenderTargetFor(owner)
    if (!current || (expectedTarget && current !== expectedTarget)) {
        return false
    }

    replayRenderTargets.delete(owner)
    if (activeReplayRenderTargetOwner === owner && activeReplayRenderTarget === current) {
        activeReplayRenderTargetOwner = null
        activeReplayRenderTarget = null
    }
    return true
}

/**
 * Resolve the Cesium viewer-like object for one replay owner.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {Object|null} Explicit or interactive viewer.
 */
export const replayViewerFor = owner => replayRenderTargetFor(owner)?.viewer
    ?? globalThis.lgs?.viewer
    ?? null

/**
 * Resolve the camera used by a replay render target.
 *
 * Interactive replay writes to the canonical Studio camera. Replay export writes
 * to the isolated target camera and must not leak those writes to the map.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {Object|null} Active replay camera.
 */
export const replayCameraFor = owner => {
    const target = replayRenderTargetFor(owner)
    if (target) {
        return target.viewer?.camera ?? null
    }

    return globalThis.lgs?.camera
        ?? replayViewerFor(owner)?.camera
        ?? null
}

/**
 * Resolve the Cesium scene for one replay owner.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {Object|null} Explicit or interactive scene.
 */
export const replaySceneFor = owner => replayRenderTargetFor(owner)?.scene
    ?? replayViewerFor(owner)?.scene
    ?? globalThis.lgs?.scene
    ?? null

/**
 * Resolve the Cesium canvas for one replay owner.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {HTMLCanvasElement|null} Explicit or interactive canvas.
 */
export const replayCanvasFor = owner => replayRenderTargetFor(owner)?.canvas
    ?? replayViewerFor(owner)?.canvas
    ?? replaySceneFor(owner)?.canvas
    ?? globalThis.lgs?.canvas
    ?? null
