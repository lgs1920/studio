/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: TimeZoneUtils.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DateTime } from 'luxon'

const COORDINATE_PRECISION = 6
const UTC_ZONE = 'UTC'

let finderPromise = null
let finderInstance = null
const coordinateZoneCache = new Map()

/**
 * Validates coordinate input and normalizes it to numeric longitude and latitude.
 * @param {*} coordinates - A coordinate pair or object.
 * @returns {{longitude: number, latitude: number}|null} Normalized coordinates when valid.
 */
export const normalizeCoordinates = coordinates => {
    if (Array.isArray(coordinates)) {
        coordinates = {longitude: coordinates[0], latitude: coordinates[1]}
    }

    const rawLongitude = coordinates?.longitude
    const rawLatitude = coordinates?.latitude
    /** Returns whether a value can represent a coordinate without accepting empty strings. */
    const isNumericValue = value => typeof value === 'number'
        || (typeof value === 'string' && value.trim() !== '')
    if (!isNumericValue(rawLongitude) || !isNumericValue(rawLatitude)) {
        return null
    }

    const longitude = Number(rawLongitude)
    const latitude = Number(rawLatitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
        || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return null
    }

    return {longitude, latitude}
}

/** Creates a stable key for caching coordinate-based time-zone lookups. */
const coordinateKey = ({longitude, latitude}) =>
    `${longitude.toFixed(COORDINATE_PRECISION)},${latitude.toFixed(COORDINATE_PRECISION)}`

/** Initializes and reuses the WebAssembly time-zone finder. */
const loadFinder = async () => {
    if (finderInstance) {
        return finderInstance
    }

    if (!finderPromise) {
        finderPromise = (async () => {
            const {default: initializeWasm, WasmFinder} = await import('tzf-wasm')
            await initializeWasm()
            finderInstance = new WasmFinder()
            return finderInstance
        })().catch(error => {
            finderPromise = null
            throw error
        })
    }

    return finderPromise
}

/**
 * Resolves the IANA time zone for coordinates and caches the result.
 * @param {*} coordinates - A coordinate pair or object.
 * @returns {Promise<string|null>} The IANA zone or null when lookup is unavailable.
 */
export const resolveTimeZone = async coordinates => {
    const normalized = normalizeCoordinates(coordinates)
    if (!normalized) {
        return null
    }

    const key = coordinateKey(normalized)
    if (coordinateZoneCache.has(key)) {
        return coordinateZoneCache.get(key)
    }

    try {
        const finder = await loadFinder()
        const timeZone = finder.get_tz_name(normalized.longitude, normalized.latitude)
        const resolvedTimeZone = typeof timeZone === 'string' && timeZone.trim() ? timeZone : null
        coordinateZoneCache.set(key, resolvedTimeZone)
        return resolvedTimeZone
    }
    catch {
        return null
    }
}

/**
 * Parses a timestamp as an absolute instant, treating offsetless values as UTC.
 * @param {*} value - An ISO timestamp or Luxon DateTime.
 * @returns {DateTime|null} The normalized instant or null when invalid.
 */
export const parseTimestampAsInstant = value => {
    if (!value) {
        return null
    }

    const dateTime = DateTime.isDateTime(value)
        ? value.toUTC()
        : DateTime.fromISO(value, {zone: UTC_ZONE, setZone: true}).toUTC()

    return dateTime.isValid ? dateTime : null
}

/**
 * Formats an absolute timestamp in a named zone, optionally including its zone label.
 * @param {*} value - An ISO timestamp or Luxon DateTime.
 * @param {string} timeZone - An IANA time-zone identifier.
 * @param {Object} options - Locale formats and zone-label settings.
 * @returns {Object|null} Formatted date, time, zone, and fallback metadata.
 */
export const formatTimestampInTimeZone = (
    value,
    timeZone = UTC_ZONE,
    {
        dateFormat = DateTime.DATE_FULL,
        timeFormat = DateTime.TIME_SIMPLE,
        timezoneFallback = false,
        includeTimeZone = false,
    } = {},
) => {
    const instant = parseTimestampAsInstant(value)
    if (!instant) {
        return null
    }

    let dateTime = instant.setZone(timeZone)
    if (!dateTime.isValid) {
        dateTime = instant.setZone(UTC_ZONE)
        timezoneFallback = true
    }

    return {
        date: dateTime.toLocaleString(dateFormat),
        time: `${dateTime.toLocaleString(timeFormat)}${timezoneFallback || includeTimeZone ? ` ${dateTime.zoneName ?? UTC_ZONE}` : ''}`,
        timeZone: dateTime.zoneName ?? UTC_ZONE,
        timezoneFallback,
    }
}

/**
 * Resolves a timestamp's local zone from its coordinates before formatting it.
 * @param {*} value - An ISO timestamp or Luxon DateTime.
 * @param {*} coordinates - A coordinate pair or object.
 * @param {Object} options - Locale date and time formats.
 * @returns {Promise<Object|null>} Formatted local date/time and zone metadata.
 */
export const formatTimestampAtCoordinates = async (
    value,
    coordinates,
    {dateFormat = DateTime.DATE_FULL, timeFormat = DateTime.TIME_SIMPLE} = {},
) => {
    const normalized = normalizeCoordinates(coordinates)
    if (!normalized) {
        return formatTimestampInTimeZone(value, UTC_ZONE, {dateFormat, timeFormat, timezoneFallback: true})
    }

    const timeZone = await resolveTimeZone(normalized)
    return formatTimestampInTimeZone(value, timeZone ?? UTC_ZONE, {
        dateFormat,
        timeFormat,
        timezoneFallback: !timeZone,
    })
}
