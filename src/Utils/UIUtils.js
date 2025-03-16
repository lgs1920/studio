/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: UIUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-28
 * Last modified: 2025-02-28
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

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
     * Transform a color in hexa to rgb() or rgba()
     *
     * @param hex {string}  #RRGGBBAA,#RGB ou #RRGGBB
     * @param format        output format (rgb | rgba), default rgba
     * @return {string}       rgb() or rgba()
     */
    static hexToRGBA = (hex, format = 'rgba', intensity = 1) => {
        hex = hex.replace(/^#/, '0x')

        // Transform #RGB to #RRGGBB orRRRRRGBFF
        if (hex.length === 5) {
            hex = hex.split('').map(char => char + char).join('')
            if (format === 'rgba') {
                hex += 'FF'
            }
        }

        const alpha = hex.length === 10

        // Extract colors
        const r = hex >> (alpha ? 24 : 16) & 0xff
        const g = hex >> (alpha ? 16 : 8) & 0xff
        const b = hex >> (alpha ? 8 : 0) & 0xff

        if (format === 'rgb') {
            return `rgb(${r},${g},${b})`
        }

        if (intensity && intensity !== 1) {
            return `rgba(${r},${g},${b},${intensity})`
        }

        // and alpha,if it exists
        if (alpha) {
            const a = (hex & 0xff) / 0xff
            return `rgba(${r},${g},${b},${a})`
        }


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
        let rgbValues = rgbString.match(/\d+/g)
        let r = rgbValues[0]
        let g = rgbValues[1]
        let b = rgbValues[2]
        return `rgba(${r},${g},${b},${alpha})`
    }

    static initDetailsGroup = (detailsGroupElement) => {

        // Close all other details when one is shown
        detailsGroupElement.addEventListener('sl-show', event => {
            if (event.target.localName === 'sl-details') {
                [...detailsGroupElement.querySelectorAll('sl-details')]
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
               ? '--lgs-dark-contrast-color' : '--lgs-light-contrast-color'
    }

}


