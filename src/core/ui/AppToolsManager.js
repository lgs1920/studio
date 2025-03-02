/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppToolsManager.js
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

export class AppToolsManager {

    /**
     * Escape HTML  (from https://shoelace.style/components/alert)
     *
     * @param html {string} HTML to escape
     * @returns {string} escaped DHTML
     *
     * @type {function(*): string}
     */
    escapeHTML = (html => {
        const div = document.createElement('div')
        div.textContent = html
        return div.innerHTML
    })
    function

    constructor() {

        // Singleton
        if (AppToolsManager.instance) {
            return AppToolsManager.instance
        }

        window.addEventListener('resize', () => {
        })

        AppToolsManager.instance = this

    }

    /**
     * Transform a color in hexa to rgb() or rgba()
     *
     * @param hex {string}  #RRGGBBAA,#RGB ou #RRGGBB
     * @param format        output format (rgb | rgba), default rgba
     * @return {string}       rgb() or rgba()
     */
    hexToRGBA = (hex, format = 'rgba') => {
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
        // and alpha,if it exists
        if (alpha) {
            const a = (hex & 0xff) / 0xff
            return `rgba(${r},${g},${b},${a})`
        }
    }

    RGB2RGBA = (rgbString, alpha = 1) => {
        let rgbValues = rgbString.match(/\d+/g)
        let r = rgbValues[0]
        let g = rgbValues[1]
        let b = rgbValues[2]
        return `rgba(${r},${g},${b},${alpha})`
    }

    initDetailsGroup = (detailsGroupElement) => {

        // Close all other details when one is shown
        detailsGroupElement.addEventListener('sl-show', event => {
            if (event.target.localName === 'sl-details') {
                [...detailsGroupElement.querySelectorAll('sl-details')]
                    .map(details => (details.open = event.target === details))
            }
        })
    }

    rem2px = (remString, stringify = false) => {
        const root = document.documentElement
        const baseFontSize = parseFloat(getComputedStyle(root).fontSize)
        const remValue = parseFloat(remString)
        const pixelValue = remValue * baseFontSize
        return stringify ? `${pixelValue}px` : pixelValue
    }

    toDMS(coordinate) {
        const degrees = Math.floor(coordinate)
        const minutesFloat = (coordinate - degrees) * 60
        const minutes = Math.floor(minutesFloat)
        const secondsFloat = (minutesFloat - minutes) * 60
        const seconds = parseFloat(secondsFloat.toFixed(6))

        return `${degrees}° ${minutes}' ${seconds}"`
    }

    outOfViewport = (element, container = window) => {
        const rect = element.getBoundingClientRect()
        return (
            rect.top < 0
            || rect.left < 0
            || rect.bottom > (container.innerHeight || document.documentElement.clientHeight)
            || rect.right > (container.innerWidth || document.documentElement.clientWidth))
    }

}


