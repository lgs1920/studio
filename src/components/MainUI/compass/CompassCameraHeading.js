/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassCameraHeading.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Resolve the heading exposed by a published Replay frame.
 *
 * @param {Object} options - Heading resolution options.
 * @param {Object|null} [options.replayFrame=null] - Published interactive or export frame state.
 * @param {number|null} [options.fallbackHeading=null] - Live camera heading fallback.
 * @returns {number|null} Camera heading in radians.
 */
export const resolveCompassCameraHeading = ({replayFrame = null, fallbackHeading = null} = {}) => {
    const candidates = [
        replayFrame?.renderContract?.cameraPose?.heading,
        replayFrame?.renderContract?.logicalFrame?.cameraPose?.heading,
        replayFrame?.intent?.scene?.cameraPose?.heading,
        fallbackHeading,
    ]

    for (const candidate of candidates) {
        const heading = Number(candidate)
        if (Number.isFinite(heading)) {
            return heading
        }
    }

    return null
}

/**
 * Return whether a published Replay frame holds the map camera at a POI.
 *
 * @param {Object|null} frame - Published interactive or export frame.
 * @returns {boolean} Whether Replay is holding the camera at a POI.
 */
export const isReplayPOICameraFrozen = frame => {
    const logicalFrame = frame?.renderContract?.logicalFrame ?? frame?.logicalFrame
    const phase = logicalFrame?.phase ?? frame?.phase ?? frame?.intent?.timeline?.phase
    return logicalFrame?.poiCameraFreeze === true
        || frame?.poiCameraFreeze === true
        || phase?.poiCameraFreeze === true
}
