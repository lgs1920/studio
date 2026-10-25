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
 * Last modified: 2026-10-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const POI_DISPLAY_MIN_WIDTH = 120
export const POI_DISPLAY_MAX_WIDTH = 400
export const POI_DISPLAY_DEFAULT_WIDTH = 200
export const POI_DISPLAY_WIDTH_STEP = 10

const DISPLAY_BOOLEAN_FIELDS = [
    'category',
    'titleCategoryIcon',
    'titleAltitude',
    'location',
    'altitude',
    'coordinates',
    'dateTime',
]

/**
 * Read POI display defaults from the saved YAML configuration, with runtime configuration fallbacks.
 *
 * @returns {Object} YAML-defined defaults for POI display flags.
 */
export const getDefaultPOIDisplaySettings = () => {
    const defaults = globalThis.lgs?.savedConfiguration?.poi?.displayDefaults
                     ?? globalThis.lgs?.configuration?.poi?.displayDefaults
                     ?? globalThis.lgs?.settings?.poi?.displayDefaults
                     ?? {}

    return {
        ...Object.fromEntries(DISPLAY_BOOLEAN_FIELDS.map(field => [field, defaults[field]])),
        maxWidth: POI_DISPLAY_DEFAULT_WIDTH,
    }
}

/**
 * Normalize persisted POI display choices while preserving defaults for missing or invalid values.
 *
 * @param {Object|null|undefined} settings - Persisted display settings.
 * @returns {{category: boolean, titleCategoryIcon: boolean, titleAltitude: boolean, location: boolean, altitude: boolean, coordinates: boolean, dateTime: boolean, maxWidth: number}}
 */
export const normalizePOIDisplaySettings = (settings = null) => {
    const source = settings && typeof settings === 'object' ? settings : {}
    const defaults = getDefaultPOIDisplaySettings()
    const maxWidth = source.maxWidth === null || source.maxWidth === undefined || source.maxWidth === ''
        ? Number.NaN
        : Number(source.maxWidth)
    const normalizedWidth = Number.isFinite(maxWidth)
        ? Math.min(
            POI_DISPLAY_MAX_WIDTH,
            Math.max(POI_DISPLAY_MIN_WIDTH, Math.round(maxWidth / POI_DISPLAY_WIDTH_STEP) * POI_DISPLAY_WIDTH_STEP),
        )
        : defaults.maxWidth

    return Object.fromEntries([
        ...DISPLAY_BOOLEAN_FIELDS.map(field => [
            field,
            typeof source[field] === 'boolean' ? source[field] : defaults[field],
        ]),
        ['maxWidth', normalizedWidth],
    ])
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
