/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayExportRenderLoop.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-22
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Viewers whose normal render loop is temporarily owned by active exports. */
const exportRenderLoops = new WeakMap()

/**
 * Give fixed-frame capture exclusive control of a Cesium viewer's render loop.
 * Viewer.render updates the clock and data-source visualizers before drawing
 * the scene. Calling Scene.render alone leaves those entity updates to the
 * default animation loop and can capture a frame behind the requested sample.
 *
 * @param {Object} options - Active Replay render target.
 * @param {Object|null} [options.viewer=null] - Viewer or CesiumWidget to render.
 * @param {Object|null} [options.scene=viewer.scene] - Fallback scene for minimal targets.
 * @returns {{render: Function, release: Function}} Scoped render driver and idempotent cleanup.
 */
export const acquireReplayExportRenderLoop = ({viewer = null, scene = viewer?.scene ?? null} = {}) => {
    const canRenderViewer = typeof viewer?.render === 'function' && viewer.scene === scene
    let lease = null
    let released = false

    if (canRenderViewer && typeof viewer.useDefaultRenderLoop === 'boolean') {
        lease = exportRenderLoops.get(viewer)
        if (!lease) {
            lease = {previousDefaultLoop: viewer.useDefaultRenderLoop, owners: 0}
            viewer.useDefaultRenderLoop = false
            exportRenderLoops.set(viewer, lease)
        }
        lease.owners += 1
    }

    /** Update entities and draw the requested capture frame without a competing animation loop. */
    const render = () => {
        if (released || viewer?.isDestroyed?.() === true || scene?.isDestroyed?.() === true) {
            return
        }
        scene?.requestRender?.()
        if (canRenderViewer) {
            viewer.resize?.()
            viewer.render()
        }
        else {
            scene?.render?.()
        }
    }

    /** Restore the original loop only after every export borrowing this viewer has released it. */
    const release = () => {
        if (released) {
            return
        }
        released = true
        if (!lease || exportRenderLoops.get(viewer) !== lease) {
            return
        }
        lease.owners -= 1
        if (lease.owners > 0) {
            return
        }
        exportRenderLoops.delete(viewer)
        if (viewer.isDestroyed?.() !== true) {
            viewer.useDefaultRenderLoop = lease.previousDefaultLoop
        }
    }

    return {render, release}
}
