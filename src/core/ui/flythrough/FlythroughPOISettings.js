/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughPOISettings.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const DEFAULT_FLYTHROUGH_POI_DISPLAY_DURATION_SECONDS = 3
export const DEFAULT_FLYTHROUGH_POI_SCALE_PERCENT = 100

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export const defaultFlythroughPOISettings = () => ({
    displayDurationSeconds: DEFAULT_FLYTHROUGH_POI_DISPLAY_DURATION_SECONDS,
    scalePercent:           DEFAULT_FLYTHROUGH_POI_SCALE_PERCENT,
    hiddenFields:           {
        location:    false,
        category:    false,
        altitude:    false,
        coordinates: false,
    },
})

export const normalizeFlythroughPOISettings = (settings = {}) => {
    const defaults = defaultFlythroughPOISettings()
    return {
        displayDurationSeconds: clamp(
            finiteNumber(settings?.displayDurationSeconds) ?? defaults.displayDurationSeconds,
            0,
            60,
        ),
        scalePercent: clamp(
            finiteNumber(settings?.scalePercent) ?? defaults.scalePercent,
            10,
            200,
        ),
        hiddenFields: {
            location:    settings?.hiddenFields?.location === true,
            category:    settings?.hiddenFields?.category === true,
            altitude:    settings?.hiddenFields?.altitude === true,
            coordinates: settings?.hiddenFields?.coordinates === true,
        },
    }
}
