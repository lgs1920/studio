/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayExportGpuBudget.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-11
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Temporarily reduce the visible viewer's render-buffer cost during isolated HQ export. */
export const acquireVisibleViewerExportGpuBudget = viewer => {
    const scene = viewer?.scene
    if (!viewer || !scene) {
        return null
    }

    const previousResolutionScale = Number(viewer.resolutionScale)
    const previousMsaaSamples = Number(scene.msaaSamples)
    let resolutionScaleChanged = false
    let msaaSamplesChanged = false

    try {
        if (Number.isFinite(previousResolutionScale) && previousResolutionScale > 1) {
            viewer.resolutionScale = 1
            resolutionScaleChanged = true
        }
        if (Number.isFinite(previousMsaaSamples) && previousMsaaSamples > 1) {
            scene.msaaSamples = 1
            msaaSamplesChanged = true
        }
        if (resolutionScaleChanged || msaaSamplesChanged) {
            viewer.resize?.()
            scene.requestRender?.()
        }
    }
    catch (error) {
        try {
            if (resolutionScaleChanged) {
                viewer.resolutionScale = previousResolutionScale
            }
            if (msaaSamplesChanged) {
                scene.msaaSamples = previousMsaaSamples
            }
            viewer.resize?.()
            scene.requestRender?.()
        }
        catch {
            // A failed optional optimization must not prevent the requested export from starting.
        }
        console.warn('[Replay video] Could not reduce visible viewer buffers for Native HQ export.', error)
        return null
    }

    if (!resolutionScaleChanged && !msaaSamplesChanged) {
        return null
    }

    let released = false
    return () => {
        if (released) {
            return
        }
        released = true
        if (viewer.isDestroyed?.() === true || scene.isDestroyed?.() === true) {
            return
        }
        if (resolutionScaleChanged) {
            viewer.resolutionScale = previousResolutionScale
        }
        if (msaaSamplesChanged) {
            scene.msaaSamples = previousMsaaSamples
        }
        viewer.resize?.()
        scene.requestRender?.()
    }
}
