/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: sliderUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-10
 * Last modified: 2026-04-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const sanitizeNumericControlValue = (rawValue, fallback, options = {}) => {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) {
        return fallback
    }

    const min = Number(options.min)
    const max = Number(options.max)
    let finalValue = numericValue

    if (Number.isFinite(min)) {
        finalValue = Math.max(min, finalValue)
    }

    if (Number.isFinite(max)) {
        finalValue = Math.min(max, finalValue)
    }

    return finalValue
}
