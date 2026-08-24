/**
 * Explicit Cesium render targets owned by replay sessions.
 *
 * Interactive replay falls back to Studio's viewer. HQ export installs an
 * isolated target for the lifetime of the export so camera and trace writes
 * cannot leak into the visible map.
 */

const replayRenderTargets = new WeakMap()

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
        replayRenderTargets.delete(owner)
        return null
    }

    replayRenderTargets.set(owner, target)
    return target
}

/**
 * Return the explicit target currently owned by a replay session.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {Object|null} Active target.
 */
export const replayRenderTargetFor = owner => replayRenderTargets.get(owner) ?? null

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
