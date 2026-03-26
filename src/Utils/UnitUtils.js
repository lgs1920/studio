/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UnitUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-26
 * Last modified: 2026-03-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DAY, HOUR, LATITUDE_FORMAT, LONGITUDE_FORMAT, MILLIS, MINUTE } from '@Core/constants'
import { Duration }                                                     from 'luxon'

// Unit system constants
export const INTERNATIONAL = 0
export const IMPERIAL = 1

// Coordinates Units system
export const DD = 'dd'
export const DMS = 'dms'

// Byte unit constants
export const BYTE = 1
export const KB = 1024
export const MB = KB * 1024
export const GB = MB * 1024
export const TB = GB * 1024

/** Distance constants to convert from meter (International System) */
export const METER = 1
export const FOOT = 3.280839895             // foot
export const KM = 0.001                     // meters to km
export const KMH = 3.6                      // m/s to Km/h
export const MPH = 2.236936                 // m/s to MPH
export const MILE = 0.00062137119223        // meters to miles
export const YARD = 1.09361                 // meters to yards
export const INCHES = 39.3701               // meters to inches

export class UnitUtils {

    /**
     * Converter from international system unit (ie m, s, m/s) to UI unit.
     * @param {number} input - Value in metric-based unit
     * @return {Object}
     */
    static convert = (input) => {
        return {
            source: input,
            to: (unit) => {
                if (input === null || input === undefined) {
                    return 0
                }
                switch (unit) {
                    case km:
                        return input * KM
                    case mile:
                        return input * MILE
                    case kmh:
                        return input * KMH
                    case mph:
                        return input * MPH
                    case foot:
                        return input * FOOT
                    case yard:
                        return input * YARD
                    case inche:
                        return input * INCHES
                    case hour:
                        return Duration.fromMillis(input * MILLIS).toFormat('h:mm:ss')
                    case min:
                        return Duration.fromMillis(input * MILLIS).toFormat('m:ss')
                    case mkm:
                        return input / KM / MINUTE * MILLIS
                    case mpmile:
                        return input / MPH * MILE * HOUR
                    case dms: {
                        const degrees = Math.floor(input)
                        const minutesFloat = (input - degrees) * 60
                        const minutes = Math.floor(minutesFloat)
                        const seconds = Math.round((minutesFloat - minutes) * 60)
                        return `${degrees}° ${minutes}' ${seconds}"`
                    }
                    case dd:
                        return parseFloat(input).toFixed(5)
                    default:
                        return input
                }
            },

            toTime: (showSeconds = true) => {
                if (!input || isNaN(input) || input < 0) {
                    return '0s'
                }
                const duration = Duration.fromMillis(input)
                if (!duration.isValid) {
                    return '0s'
                }

                let format = ''
                let firstUnit = true

                if (input >= DAY) {
                    format += firstUnit ? 'd\'d\' ' : 'dd\'d\' '
                    firstUnit = false
                }
                if (input >= HOUR) {
                    format += firstUnit ? 'h\'h\' ' : 'hh\'h\' '
                    firstUnit = false
                }
                if (input >= MINUTE) {
                    format += firstUnit ? 'm\'m\' ' : 'mm\'m\' '
                    firstUnit = false
                }
                if (showSeconds && input < DAY) {
                    format += firstUnit ? 's\'s\'' : 'ss\'s\''
                }

                format = format.trim()
                return format ? duration.toFormat(format) : (showSeconds ? '0s' : '0m')
            },

            toBytesUnit: () => {
                if (!input || isNaN(input) || input < 0) {
                    return '0B'
                }
                const unitsArr = [
                    {threshold: TB, label: 'TB', decimals: 2},
                    {threshold: GB, label: 'GB', decimals: 2},
                    {threshold: MB, label: 'MB', decimals: 2},
                    {threshold: KB, label: 'KB', decimals: 1},
                    {threshold: BYTE, label: 'B', decimals: 0},
                ]
                const unit = unitsArr.find(u => input >= u.threshold) || unitsArr[unitsArr.length - 1]
                const value = input / unit.threshold
                const formattedValue = unit.decimals === 0
                                       ? Math.round(value)
                                       : value.toFixed(unit.decimals).replace(/^0+/, '')
                return `${formattedValue}${unit.label}`
            },
        }
    }

    /**
     * Revert from UI unit back to international system (m, s, m/s).
     * Prevents the "climbing numbers" bug by ensuring store storage is always metric.
     * @param {number|string} input - The value from the UI input
     * @param {string} unit - The unit label used for display
     * @returns {number} The raw value in metric system
     */
    static revert = (input, unit) => {
        if (input === null || input === undefined || input === '') {
            return 0
        }

        // Clean input: replace comma, remove non-numeric chars except dot and minus
        const cleanInput = typeof input === 'string'
                           ? input.replace(',', '.').replace(/[^\d.-]/g, '')
                           : input

        const val = parseFloat(cleanInput)
        if (isNaN(val)) {
            return 0
        }

        // Prevent division by zero for inverse units (Pace)
        const safeVal = Math.abs(val) < 0.000001 ? 0.000001 : val

        switch (unit) {
            case km:
                return val / KM
            case mile:
                return val / MILE
            case kmh:
                return val / KMH
            case mph:
                return val / MPH
            case foot:
                return val / FOOT
            case yard:
                return val / YARD
            case inche:
                return val / INCHES
            // PACE (min/km -> m/s): 1 / (min * 60 * 0.001)
            case mkm:
                return (1 / (safeVal * 60)) / KM
            case mpmile:
                return (1 / (safeVal * 60)) / MILE
            default:
                return val
        }
    }

    static formatMetric = (value, {
        units: unitsArgs = ['', ''],
        format = '%\' .1f',
        precision,
        callback,
    } = {}) => {
        let toShow = (typeof value === 'string') ? value : (Number(value) ?? null)
        let unitsValues = Array.isArray(unitsArgs)
                          ? (unitsArgs.length === 1 ? [unitsArgs[0], unitsArgs[0]] : unitsArgs)
                          : [unitsArgs, unitsArgs]

        const currentSystem = lgs.settings.unitSystem.current
        const unitText = unitsValues[currentSystem] ?? ''

        if (typeof toShow === 'number' && units.includes(unitsValues[0])) {
            toShow = UnitUtils.convert(toShow).to(unitText)
        }

        if (toShow !== null && callback) {
            toShow = callback(toShow)
        }
        else if (typeof toShow === 'number') {
            const formatStr = (precision !== null && precision !== undefined)
                              ? `%' .${precision}f`
                              : format
            toShow = sprintf(formatStr, toShow)
        }

        return {
            value: toShow,
            unit:  unitText,
            full:  `${toShow}${unitText ? ' ' + unitText : ''}`,
        }
    }

    /**
     * Convert Latitude or Longitude string (DD or DMS) to decimal float
     * @param {string} value - The input coordinate string
     * @param {boolean} isLatitude - True for latitude, false for longitude
     * @returns {number|null} The coordinate in DD format or null if invalid
     */
    static convertToDD = (value, isLatitude = true) => {
        if (!value) {
            return null
        }

        const $regex = new RegExp(isLatitude ? LATITUDE_FORMAT : LONGITUDE_FORMAT, 'i')
        const $match = value.trim().match($regex)

        if (!$match) {
            return null
        }

        // Case 1: Already in DD format (Match group 1 or 3 for Lat, 1 or 3-5 for Lng)
        // If the DMS specific groups are undefined, it's DD
        if ($match[4] === undefined && $match[7] === undefined) {
            return parseFloat(value.replace(',', '.'))
        }

        // Case 2: DMS format
        // Groups for DMS start after the DD alternatives in the regex
        const $offset = isLatitude ? 4 : 7
        const $deg = parseFloat($match[$offset]) || 0
        const $min = parseFloat($match[$offset + 1]) || 0
        const $sec = parseFloat($match[$offset + 2]) || 0
        const $hemisphere = value.slice(-1).toUpperCase()

        let $dd = $deg + ($min / 60) + ($sec / 3600)

        // Apply negative sign for South, West or if the string starts with '-'
        if ($hemisphere === 'S' || $hemisphere === 'W' || value.startsWith('-')) {
            $dd = $dd * -1
        }

        // Return fixed to 6 decimals as requested
        return parseFloat($dd.toFixed(6))
    }

    /**
     * Validate coordinate input while typing and detect when it is fully valid.
     * This is designed for live handlers (onInput).
     *
     * @param {string} rawValue
     * @param {boolean} isLatitude
     * @returns {{
     *  accepted: boolean,
     *  completeValid: boolean,
     *  decimalValue: number|null,
     *  typedFormat: string|null
     * }}
     */
    static parseCoordinateInput = (rawValue, isLatitude = true) => {
        const value = `${rawValue ?? ''}`
        const trimmedValue = value.trim()

        const allowedChars = /^[0-9+\-.,\sNSEWnsew°'"]*$/
        if (!allowedChars.test(value)) {
            return {accepted: false, completeValid: false, decimalValue: null, typedFormat: null}
        }

        const hemisphereMatches = value.toUpperCase().match(/[NSEW]/g) ?? []
        const invalidHemisphere = hemisphereMatches.some((hemisphere) => {
            if (isLatitude) {
                return hemisphere === 'E' || hemisphere === 'W'
            }
            return hemisphere === 'N' || hemisphere === 'S'
        })
        if (invalidHemisphere || hemisphereMatches.length > 1) {
            return {accepted: false, completeValid: false, decimalValue: null, typedFormat: null}
        }
        if (hemisphereMatches.length === 1 && trimmedValue) {
            const hemisphere = hemisphereMatches[0]
            if (!new RegExp(`${hemisphere}\\s*$`, 'i').test(trimmedValue)) {
                return {accepted: false, completeValid: false, decimalValue: null, typedFormat: null}
            }
        }

        const signMatches = trimmedValue.match(/[+-]/g) ?? []
        if (signMatches.length > 1 || (signMatches.length === 1 && !/^[+-]/.test(trimmedValue))) {
            return {accepted: false, completeValid: false, decimalValue: null, typedFormat: null}
        }

        if (/\s{2,}/.test(value)) {
            return {accepted: false, completeValid: false, decimalValue: null, typedFormat: null}
        }

        const numericPart = trimmedValue.replace(/[^\d.,]/g, '')
        const separators = numericPart.match(/[.,]/g) ?? []
        if ((numericPart.includes('.') && numericPart.includes(',')) || separators.length > 1) {
            return {accepted: false, completeValid: false, decimalValue: null, typedFormat: null}
        }

        if (!trimmedValue) {
            return {accepted: true, completeValid: false, decimalValue: null, typedFormat: null}
        }

        const format = isLatitude ? LATITUDE_FORMAT : LONGITUDE_FORMAT
        const regex = new RegExp(format, 'i')
        if (!regex.test(trimmedValue)) {
            return {accepted: true, completeValid: false, decimalValue: null, typedFormat: null}
        }

        const val = UnitUtils.convertToDD(trimmedValue, isLatitude)
        if (!Number.isFinite(val)) {
            return {accepted: false, completeValid: false, decimalValue: null, typedFormat: null}
        }

        return {
            accepted:      true,
            completeValid: true,
            decimalValue:  val,
            typedFormat:   /[NSEWnsew°'"]/.test(trimmedValue) ? DMS : DD,
        }
    }

    static formatCoordinate = (ddValue, targetFormat = DD) => {
        if (!Number.isFinite(ddValue)) {
            return '0'
        }
        const safeTargetFormat = targetFormat === DMS ? DMS : DD
        return `${UnitUtils.convert(ddValue).to(safeTargetFormat)}`
    }
}

/** Units Export */
export const km = 'km'
export const mile = 'mi'
export const kmh = 'km/h'
export const hkm = 'h/km'
export const mkm = 'min/km'
export const mpmile = 'min/mile'
export const ms = 'm/s'
export const mph = 'mph'
export const foot = 'ft'
export const yard = 'yd'
export const inche = 'in'
export const hour = 'hr'
export const min = 'mn'
export const sec = 's'
export const meter = 'm'
export const dd = DD
export const dms = DMS
export const units = [km, mile, kmh, hkm, mkm, mpmile, ms, mph, meter, foot, yard, inche, hour, min, sec, dd, dms]

export const ELEVATION_UNITS = [meter, foot]
export const DISTANCE_UNITS = [km, mile]
export const SPEED_UNITS = [kmh, mph]
export const PACE_UNITS = [mkm, mpmile]

export const byte = 'B'
export const kb = 'KB'
export const mb = 'MB'
export const gb = 'GB'
export const tb = 'TB'
export const BYTE_UNITS = [byte, kb, mb, gb, tb]
