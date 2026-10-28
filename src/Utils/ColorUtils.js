/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ColorUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {colord} from 'colord'

/** Minimum alpha used by Cesium to consider a POI pixel available for picking. */
export const COLOR_PICK_ALPHA_THRESHOLD = 0.005

/**
 * Check whether a CSS color is opaque enough to remain visible and pickable.
 *
 * @param {string} value - CSS color value.
 * @returns {boolean} Whether the parsed color alpha exceeds the pick threshold.
 */
export const hasVisibleColorAlpha = value => {
    if (typeof value !== 'string') {
        return false
    }

    const color = colord(value)
    return color.isValid() && color.alpha() > COLOR_PICK_ALPHA_THRESHOLD
}
