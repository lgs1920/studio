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
 * Last modified: 2026-10-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WIDGET_FONT_FAMILIES} from '@Core/constants'

export const POI_DISPLAY_MIN_WIDTH = 120
export const POI_DISPLAY_MAX_WIDTH = 400
export const POI_DISPLAY_DEFAULT_WIDTH = 200
export const POI_DISPLAY_WIDTH_STEP = 10
export const POI_DISPLAY_DEFAULT_FONT_FAMILY = 'System'
export const POI_DISPLAY_DEFAULT_FONT_SIZE = 13
export const POI_DISPLAY_DEFAULT_STICK_ANGLE = 'random'
export const POI_DISPLAY_DEFAULT_STICK_LENGTH = 16
export const POI_DISPLAY_DEFAULT_STICK_POSITION = 'below'
export const POI_DISPLAY_DEFAULT_STICK_HORIZONTAL_POSITION = 50
export const POI_DISPLAY_DEFAULT_STYLE = 'pill'
export const POI_DISPLAY_STICK_LENGTH_MAX = 200
export const POI_DISPLAY_STYLES = [
    'pill', 'side-accent', 'round-badge', 'underline', 'open-frame', 'slanted-banner', 'rounded', 'icon-frame',
]
export const POI_DISPLAY_STYLE_LABELS = Object.freeze({
    pill: 'Pill',
    'side-accent': 'Side accent',
    'round-badge': 'Round badge',
    underline: 'Underline',
    'open-frame': 'Open frame',
    'slanted-banner': 'Slanted banner',
    rounded: 'Rounded',
    'icon-frame': 'Icon frame',
})
/** Version of the persisted per-POI display settings shape. */
export const POI_DISPLAY_SETTINGS_SCHEMA_VERSION = 3

const DISPLAY_BOOLEAN_FIELDS = [
    'category',
    'titleCategoryIcon',
    'titleAltitude',
    'location',
    'altitude',
    'coordinates',
    'dateTime',
]

const LEGACY_DISPLAY_DEFAULTS = Object.freeze({
    category:          false,
    titleCategoryIcon: true,
    location:          false,
    altitude:          false,
    coordinates:       false,
    dateTime:          false,
})

/**
 * Identify complete POI display settings written before defaults moved to YAML.
 *
 * @param {Object|null|undefined} settings - Persisted display settings.
 * @returns {boolean} Whether the record uses the complete legacy shape.
 */
const hasLegacyDisplayShape = settings => Boolean(
    settings
    && typeof settings === 'object'
    && settings.schemaVersion === undefined
    && Object.prototype.hasOwnProperty.call(settings, 'maxWidth')
    && Object.keys(LEGACY_DISPLAY_DEFAULTS).every(field => (
        Object.prototype.hasOwnProperty.call(settings, field)
    )),
)

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
 * Normalize optional typography and connector settings without changing legacy POI defaults.
 *
 * @param {Object} source - Raw display settings.
 * @returns {Object} Supported optional settings explicitly present in the source.
 */
const normalizeOptionalPOIDisplaySettings = source => {
    const settings = {}
    /** Check whether an optional style setting was explicitly saved. */
    const hasOwn = field => Object.prototype.hasOwnProperty.call(source, field)

    if (hasOwn('fontFamily')) {
        settings.fontFamily = WIDGET_FONT_FAMILIES.includes(source.fontFamily)
            ? source.fontFamily
            : POI_DISPLAY_DEFAULT_FONT_FAMILY
    }

    if (hasOwn('fontSize')) {
        const fontSize = Number(source.fontSize)
        settings.fontSize = Number.isFinite(fontSize)
            ? Math.max(8, Math.min(48, fontSize))
            : POI_DISPLAY_DEFAULT_FONT_SIZE
    }

    for (const field of ['bold', 'italic']) {
        if (hasOwn(field)) {
            settings[field] = source[field] === true
        }
    }

    if (hasOwn('stickAngle')) {
        const angle = `${source.stickAngle}`
        settings.stickAngle = ['-45', 'vertical', '45', 'random'].includes(angle)
            ? angle
            : POI_DISPLAY_DEFAULT_STICK_ANGLE
    }

    if (hasOwn('stickPosition')) {
        settings.stickPosition = ['above', 'below'].includes(source.stickPosition)
            ? source.stickPosition
            : POI_DISPLAY_DEFAULT_STICK_POSITION
    }

    if (hasOwn('stickHorizontalPosition')) {
        const position = Number(source.stickHorizontalPosition)
        settings.stickHorizontalPosition = [20, 50, 80].includes(position)
            ? position
            : POI_DISPLAY_DEFAULT_STICK_HORIZONTAL_POSITION
    }

    if (hasOwn('style')) {
        const style = `${source.style}`
        settings.style = POI_DISPLAY_STYLES.includes(style) ? style : POI_DISPLAY_DEFAULT_STYLE
    }

    if (hasOwn('stickLength')) {
        const length = Number(source.stickLength)
        settings.stickLength = Number.isFinite(length)
            ? Math.round(Math.max(0, Math.min(POI_DISPLAY_STICK_LENGTH_MAX, length)))
            : POI_DISPLAY_DEFAULT_STICK_LENGTH
    }

    return settings
}

/** Resolve a POI stick angle, using a stable ID-derived direction for the random choice. */
export const resolvePOIStickAngle = (angle, poiId) => {
    if (angle === 'vertical') {
        return 0
    }

    if (angle === '-45' || angle === '45') {
        return Number(angle)
    }

    const id = `${poiId ?? ''}`
    const hash = [...id].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0)
    return [-45, 0, 45][hash % 3]
}

/**
 * Normalize persisted POI display choices and migrate untouched legacy defaults.
 *
 * @param {Object|null|undefined} settings - Persisted display settings.
 * @returns {{category: boolean, titleCategoryIcon: boolean, titleAltitude: boolean, location: boolean, altitude: boolean, coordinates: boolean, dateTime: boolean, maxWidth: number, fontFamily?: string, fontSize?: number, bold?: boolean, italic?: boolean, stickAngle?: string, stickPosition?: string, stickLength?: number, schemaVersion: number}}
 */
export const normalizePOIDisplaySettings = (settings = null) => {
    const source = settings && typeof settings === 'object' ? settings : {}
    const defaults = getDefaultPOIDisplaySettings()
    const legacyShape = hasLegacyDisplayShape(source)
    const maxWidth = source.maxWidth === null || source.maxWidth === undefined || source.maxWidth === ''
        ? Number.NaN
        : Number(source.maxWidth)
    const normalizedWidth = Number.isFinite(maxWidth)
        ? Math.min(
            POI_DISPLAY_MAX_WIDTH,
            Math.max(POI_DISPLAY_MIN_WIDTH, Math.round(maxWidth / POI_DISPLAY_WIDTH_STEP) * POI_DISPLAY_WIDTH_STEP),
        )
        : defaults.maxWidth

    const normalizedDisplay = DISPLAY_BOOLEAN_FIELDS.map(field => {
        const legacyDefault = legacyShape
            && Object.prototype.hasOwnProperty.call(LEGACY_DISPLAY_DEFAULTS, field)
            && source[field] === LEGACY_DISPLAY_DEFAULTS[field]

        return [
            field,
            typeof source[field] === 'boolean' && !legacyDefault ? source[field] : defaults[field],
        ]
    })

    return Object.fromEntries([
        ...normalizedDisplay,
        ['maxWidth', normalizedWidth],
        ...Object.entries(normalizeOptionalPOIDisplaySettings(source)),
        ['schemaVersion', POI_DISPLAY_SETTINGS_SCHEMA_VERSION],
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

    if (replayActive && field !== 'category' && field !== 'titleCategoryIcon' && field !== 'titleAltitude') {
        return false
    }

    return typeof normalizedSettings[field] === 'boolean' && normalizedSettings[field]
}
