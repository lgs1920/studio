/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UnitUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-13
 * Last modified: 2025-07-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DAY, HOUR, MILLIS, MINUTE } from '@Core/constants'
import { Duration }                  from 'luxon'

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

export class UnitUtils {
    altitudes

    /**
     * Converter from international system unit (ie m,s) to other.
     *
     * How to use: convert(myValue).to(KM) to convert myValue from meter to kilometers
     *
     * @param input always in metric-based unit
     *
     * @return {{source, to: data.to}}
     */
    static convert = (input) => {
        return {
            source: input,
            to: (unit) => {
                switch (unit) {
                    case km:
                        return input * KM
                    case mile:
                        return input * MILE
                    case kmh:
                        return input * KMH
                    case mkm:
                        return input / KM / MINUTE * MILLIS
                    case mph:
                        return input * MPH
                    case mpmile:
                        return input / MPH * MILE * HOUR
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
                    case dms: {
                        if (!input) {
                            return 'NaN'
                        }
                        const degrees = Math.floor(input)
                        const minutesFloat = (input - degrees) * 60
                        const minutes = Math.floor(minutesFloat)
                        const seconds = Math.round((minutesFloat - minutes) * 60)
                        return `${degrees}° ${minutes}' ${seconds}"`
                    }
                    case dd:
                        if (!input) {
                            return 'NaN'
                        }
                        return sprintf('%.5f', input)
                    default:
                        // metre, seconde
                        return input
                }
            },
            /**
             * Convert input (in milliseconds) to a formatted time string (e.g., '1h 05m 05s' or '5m 05s')
             * The first non-zero unit has no leading zero, while subsequent units have leading zeros.
             * @param {boolean} showSeconds - Whether to include seconds in the output
             * @returns {string} Formatted time string
             */
            toTime: (showSeconds = true) => {
                if (!input || isNaN(input) || input < 0) {
                    return '0s'
                }

                const duration = Duration.fromMillis(input)
                if (!duration.isValid) {
                    return '0s'
                }

                // Build format string based on the first non-zero unit
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

                // Remove trailing space and handle empty format
                format = format.trim()
                if (!format) {
                    return showSeconds ? '0s' : '0m'
                }

                return duration.toFormat(format)
            },
            /**
             * Convert input (in bytes) to a formatted size string with a single unit (e.g., '12B', '1.4MB')
             * Uses the largest appropriate unit (B, KB, MB, GB, TB) with no leading zero.
             * MB, GB, TB show one decimal place; B, KB show no decimal places.
             * @returns {string} Formatted size string
             */
            toSize: () => {
                if (!input || isNaN(input) || input < 0) {
                    return '0B'
                }

                const units = [
                    {threshold: TB, label: 'TB', decimals: 2},
                    {threshold: GB, label: 'GB', decimals: 2},
                    {threshold: MB, label: 'MB', decimals: 2},
                    {threshold: KB, label: 'KB', decimals: 1},
                    {threshold: BYTE, label: 'B', decimals: 0},
                ]

                // Find the largest unit where value >= 1
                const unit = units.find(u => input >= u.threshold) || units[units.length - 1]
                const value = input / unit.threshold

                // Format with no leading zero and appropriate decimals
                const formattedValue = unit.decimals === 0
                                       ? Math.round(value)
                                       : value.toFixed(unit.decimals).replace(/^0+/, '')

                return `${formattedValue}${unit.label}`
            },
        }
    }

    static convertFeetToMeters = feet => feet / FOOT
}

/** Units */
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

/** Distance constants to convert from meter */
export const METER = 1
export const FOOT = 3.280839895             // foot
export const KM = 0.001                     // meters
export const KMH = 3.6                      // m/s to Km/h
export const MPH = 2.236936                 // m/s to MPH
export const MILE = 0.00062137119223        // miles = MILE * kms
export const YARD = 1.09361                 // meters to yards
export const INCHES = 39.3701               // meters to inches

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
