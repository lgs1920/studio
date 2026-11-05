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
 * Last modified: 2026-11-05
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
        if (candidate === null || candidate === undefined || candidate === '') {
            continue
        }
        const heading = Number(candidate)
        if (Number.isFinite(heading)) {
            return heading
        }
    }

    return null
}
