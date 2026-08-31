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
 * Last modified: 2026-08-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Resolve the heading exposed by a published HQ replay frame.
 *
 * @param {Object} options - Heading resolution options.
 * @param {Object|null} [options.hqFrame=null] - Published HQ frame state.
 * @param {number|null} [options.fallbackHeading=null] - Interactive camera fallback.
 * @returns {number|null} Camera heading in radians.
 */
export const resolveCompassCameraHeading = ({hqFrame = null, fallbackHeading = null} = {}) => {
    const candidates = [
        hqFrame?.renderContract?.cameraPose?.heading,
        hqFrame?.renderContract?.logicalFrame?.cameraPose?.heading,
        hqFrame?.intent?.scene?.cameraPose?.heading,
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
