/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiProjectionScheduler.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-31
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Subscribe to scene renders, falling back to camera changes or animation frames. */
export const subscribeToPOIProjectionUpdates = ({scene, camera, requestFrame, cancelFrame, onUpdate}) => {
    if (typeof scene?.postRender?.addEventListener === 'function') {
        return scene.postRender.addEventListener(onUpdate)
    }

    if (typeof camera?.changed?.addEventListener === 'function') {
        return camera.changed.addEventListener(onUpdate)
    }

    let cancelled = false
    let frameId = null
    const schedule = () => {
        frameId = requestFrame(() => {
            onUpdate()
            if (!cancelled) {
                schedule()
            }
        })
    }
    schedule()

    return () => {
        cancelled = true
        if (frameId !== null) {
            cancelFrame(frameId)
        }
    }
}
