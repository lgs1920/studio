/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UIUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
import { APP_GOOGLE_FONTS, COUNTRY_FLAGS_DIR, WIDGET_GOOGLE_FONTS } from '@Core/constants'
import { colord }                                 from 'colord'
import { DateTime }                               from 'luxon'

export class UIUtils {

    /**
     * Escape HTML  (from https://shoelace.style/components/alert)
     *
     * @param html {string} HTML to escape
     * @returns {string} escaped DHTML
     *
     * @type {function(*): string}
     */
    static escapeHTML = (html => {
        const div = document.createElement('div')
        div.textContent = html
        return div.innerHTML
    })

    /**
     * Transforms a hex color string to rgb() or rgba() format
     * Supports #RGB, #RRGGBB, and #RRGGBBAA
     * * @param {string} hex - Color in hex format
     * @param {'rgb' | 'rgba'} format - Output format
     * @param {number} intensity - Manual alpha override (0 to 1)
     * @returns {string} Functional CSS color string
     */
    static hexToRGBA = (hex, format = 'rgba', intensity = 1) => {
        let r, g, b, a
        let cleanHex = hex.replace(/^#/, '')

        // Handle short format #RGB or #RGBA
        if (cleanHex.length === 3 || cleanHex.length === 4) {
            cleanHex = cleanHex.split('').map(char => char + char).join('')
        }

        if (cleanHex.length === 6) {
            // Standard #RRGGBB
            const intValue = parseInt(cleanHex, 16)
            r = (intValue >> 16) & 0xff
            g = (intValue >> 8) & 0xff
            b = intValue & 0xff
            a = 1
        }
        else if (cleanHex.length === 8) {
            // #RRGGBBAA - Use unsigned right shift or separate parsing to avoid sign issues
            r = parseInt(cleanHex.slice(0, 2), 16)
            g = parseInt(cleanHex.slice(2, 4), 16)
            b = parseInt(cleanHex.slice(4, 6), 16)
            a = parseInt(cleanHex.slice(6, 8), 16) / 255
        }
        else {
            // Fallback for invalid formats
            return 'transparent'
        }

        // Override alpha if intensity is specifically provided and not default
        const alphaValue = (intensity !== 1) ? intensity : a

        if (format === 'rgb') {
            return `rgb(${r}, ${g}, ${b})`
        }

        // Format to fixed decimal to avoid long floating point strings
        return `rgba(${r}, ${g}, ${b}, ${parseFloat(alphaValue.toFixed(3))})`
    }
    static hsla2Hex = (h, s, l, a) => {
        s /= 100
        l /= 100
        const k = n => (n + h / 30) % 12
        const aValue = s * Math.min(l, 1 - l)
        const f = n =>
            l - aValue * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))

        const r = Math.round(f(0) * 255)
        const g = Math.round(f(8) * 255)
        const b = Math.round(f(4) * 255)

        const toHex = x => x.toString(16).padStart(2, '0')
        const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0')

        return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`
    }

    static hslaString2Hex = (hslaString) => {

        const regex = /hsla\(\s*(\d+)\s*[,\s]\s*(\d+)%\s*[,\s]\s*(\d+)%\s*[,\s\/]\s*(\d*\.?\d+)\s*\)/i
        const match = hslaString.match(regex)
        if (match) {
            const [h, s, l, a] = match.slice(1).map(Number)
            return UIUtils.hsla2Hex(h, s, l, a)
        }
        return false
    }

    static RGB2RGBA = (rgbString, alpha = 1) => {
        if (rgbString === 'transparent') {
            return `rgba(255,255,255,${alpha})`
        }
        let rgbValues = rgbString.match(/\d+/g)
        let r = rgbValues[0]
        let g = rgbValues[1]
        let b = rgbValues[2]
        return `rgba(${r},${g},${b},${alpha})`
    }

    static initDetailsGroup = (detailsGroupElement) => {

        // Close all other details when one is shown
        detailsGroupElement.addEventListener('sl-after-show', event => {
            if (event.target.localName === 'wa-details') {
                [...detailsGroupElement.querySelectorAll('wa-details')]
                    .map(details => (details.open = event.target === details))
            }
        })
    }

    static toDMS(coordinate) {
        const degrees = Math.floor(coordinate)
        const minutesFloat = (coordinate - degrees) * 60
        const minutes = Math.floor(minutesFloat)
        const secondsFloat = (minutesFloat - minutes) * 60
        // Utilisation de toFixed pour plus de précision sur les secondes
        const seconds = parseFloat(secondsFloat.toFixed(6))

        return `${degrees}° ${minutes}' ${seconds}"`
    }

    static DMS2DD = (dms) => {
        const parts = dms.match(/(\d+)[° ]+(\d+)[' ]+([\d.]+)"?/)
        if (parts) {
            return parseFloat(parts[1]) + parseFloat(parts[2]) / 60 + parseFloat(parts[3]) / 3600
        }
        return 0
    }


    /**
     * Color contrast
     * https://gist.github.com/dcondrey/183971f17808e9277572?permalink_comment_id=4613640#gistcomment-4613640
     *
     * @returns light or dark color contrast
     */

    static colorContrast = (hex, factorAlpha = false) => {
        let [r, g, b, a] = hex.replace(/^#?(?:(?:(..)(..)(..)(..)?)|(?:(.)(.)(.)(.)?))$/, '$1$5$5$2$6$6$3$7$7$4$8$8').match(/(..)/g)
            .map(rgb => parseInt('0x' + rgb))
        return ((~~(r * 299) + ~~(g * 587) + ~~(b * 114)) / 1000) >= 128 || (!!(~(128 / a) + 1) && factorAlpha)
               ? '--lgs-dark-color' : '--lgs-light-color'
    }

    /**
     *
     * @param countryCode
     * @return {string}
     */
    static countryFlag(countryCode) {
        return `${COUNTRY_FLAGS_DIR}${countryCode.toLowerCase()}.svg`
    }

    static importFonts = () => {
        const linkId = 'google-fonts'
        const fontFamilies = [...new Set([...WIDGET_GOOGLE_FONTS, ...APP_GOOGLE_FONTS])]

        if (!document.getElementById(linkId)) {
            const link = document.createElement('link')
            link.id = linkId
            link.rel = 'stylesheet'
            link.href = `https://fonts.googleapis.com/css2?${fontFamilies.map(f => `family=${f.replace(/\s+/g, '+')}`).join('&')}&display=swap`
            document.head.appendChild(link)
        }
    }


    /**
     * Formats journey dates into one or two strings depending on whether
     * start and stop occur on the same day.
     * * @param {Object} data - Object containing start and stop ISO strings.
     * @returns {string[]} Array of formatted date/time strings.
     */
    static formatJourneyDurationDates = (data) => {
        if (!data?.start || !data?.stop) {
            return {}
        }

        const startDT = DateTime.fromISO(data.start)
        const stopDT = DateTime.fromISO(data.stop)

        const start = {
            date: startDT.toLocaleString(DateTime.DATE_FULL),
            time: startDT.toLocaleString(DateTime.TIME_SIMPLE),
        }
        const stop = {
            date: stopDT.toLocaleString(DateTime.DATE_FULL),
            time: stopDT.toLocaleString(DateTime.TIME_SIMPLE),
        }

        const sameDay = start.date === stop.date

        return {
            sameDay,
            start,
            stop,
            items:  [start, stop],
            prefix: sameDay ? start.date : `${start.date} ${start.time}`,
            sufix:  sameDay ? `${start.time} - ${stop.time}` : `${stop.date} ${stop.time}`,
        }

    }

    /**
     * Resolves a color string from a widget item, handling CSS variables,
     * hex/rgb formats, and optional alpha transparency.
     * * @param {Object} item - The item containing color and opacity properties.
     * @param {boolean} [includeAlpha=false] - Whether to apply the item's opacity to the result.
     * @returns {string} RGBA or RGB string, or transparent if invalid.
     */
    static resolveItemColor(item, includeAlpha = false) {
        if (!item || !item.color || typeof item.color !== 'string') {
            return '#ffffff'
        }

        // Resolve CSS variable if the color string starts with the double-dash prefix
        const raw = item.color.startsWith('--') ? __.ui.css.getCSSVariable(item.color) : item.color
        const c = colord(raw)

        // Return the color with applied alpha channel if requested and opacity exists
        return includeAlpha ? c.alpha(item.opacity ?? 1).toRgbString() : c.toRgbString()
    }
}
