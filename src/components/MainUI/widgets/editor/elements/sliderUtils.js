/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: sliderUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-10
 * Last modified: 2026-04-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const sanitizeNumericControlValue = (rawValue, fallback = 0, options = {}) => {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    const numericValue = Number(value)
    const fallbackValue = Number(fallback)

    if (!Number.isFinite(numericValue)) {
        if (Number.isFinite(fallbackValue)) {
            return fallbackValue
        }

        const min = Number(options.min)
        return Number.isFinite(min) ? min : 0
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

export const formatSliderPercent = (value) => {
    const numericValue = sanitizeNumericControlValue(value, 0, {min: 0, max: 1})
    return `${Math.round(numericValue * 100)}%`
}

export const formatSliderPixels = (value) => {
    const numericValue = sanitizeNumericControlValue(value, 0)
    return `${Math.round(numericValue)}px`
}
