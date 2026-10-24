/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIDisplaySettings.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const POI_DISPLAY_MIN_WIDTH = 120
export const POI_DISPLAY_MAX_WIDTH = 400
export const POI_DISPLAY_DEFAULT_WIDTH = 200
export const POI_DISPLAY_WIDTH_STEP = 10

/** @type {Readonly<{category: boolean, titleCategoryIcon: boolean, location: boolean, altitude: boolean, coordinates: boolean, dateTime: boolean, maxWidth: number}>} */
export const DEFAULT_POI_DISPLAY_SETTINGS = Object.freeze({
    category:          true,
    titleCategoryIcon: false,
    location:          false,
    altitude:          false,
    coordinates:       false,
    dateTime:          false,
    maxWidth:           POI_DISPLAY_DEFAULT_WIDTH,
})

/**
 * Normalize persisted POI display choices while preserving defaults for missing or invalid values.
 *
 * @param {Object|null|undefined} settings - Persisted display settings.
 * @returns {{category: boolean, titleCategoryIcon: boolean, location: boolean, altitude: boolean, coordinates: boolean, dateTime: boolean, maxWidth: number}}
 */
export const normalizePOIDisplaySettings = (settings = null) => {
    const source = settings && typeof settings === 'object' ? settings : {}
    const maxWidth = source.maxWidth === null || source.maxWidth === undefined || source.maxWidth === ''
        ? Number.NaN
        : Number(source.maxWidth)
    const normalizedWidth = Number.isFinite(maxWidth)
        ? Math.min(
            POI_DISPLAY_MAX_WIDTH,
            Math.max(POI_DISPLAY_MIN_WIDTH, Math.round(maxWidth / POI_DISPLAY_WIDTH_STEP) * POI_DISPLAY_WIDTH_STEP),
        )
        : DEFAULT_POI_DISPLAY_SETTINGS.maxWidth

    return {
        category:    typeof source.category === 'boolean' ? source.category : DEFAULT_POI_DISPLAY_SETTINGS.category,
        titleCategoryIcon: typeof source.titleCategoryIcon === 'boolean'
            ? source.titleCategoryIcon
            : DEFAULT_POI_DISPLAY_SETTINGS.titleCategoryIcon,
        location:    typeof source.location === 'boolean' ? source.location : DEFAULT_POI_DISPLAY_SETTINGS.location,
        altitude:    typeof source.altitude === 'boolean' ? source.altitude : DEFAULT_POI_DISPLAY_SETTINGS.altitude,
        coordinates: typeof source.coordinates === 'boolean' ? source.coordinates : DEFAULT_POI_DISPLAY_SETTINGS.coordinates,
        dateTime:    typeof source.dateTime === 'boolean' ? source.dateTime : DEFAULT_POI_DISPLAY_SETTINGS.dateTime,
        maxWidth:    normalizedWidth,
    }
}

/**
 * Determine whether a display-configurable POI field is allowed in the current presentation.
 *
 * @param {string} field - The POI display field to check.
 * @param {Object|null|undefined} settings - Persisted display settings.
 * @param {boolean} replayActive - Whether Replay is currently active.
 * @returns {boolean} Whether the field should be displayed.
 */
export const shouldDisplayPOIField = (field, settings, replayActive = false) => {
    const normalizedSettings = normalizePOIDisplaySettings(settings)

    if (!Object.prototype.hasOwnProperty.call(normalizedSettings, field)) {
        return false
    }

    if (replayActive && field !== 'category' && field !== 'titleCategoryIcon') {
        return false
    }

    return typeof normalizedSettings[field] === 'boolean' && normalizedSettings[field]
}
