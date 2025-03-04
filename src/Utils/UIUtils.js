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

}


