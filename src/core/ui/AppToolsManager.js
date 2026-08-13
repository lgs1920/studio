/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: AppToolsManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-03-08
 * Last modified: 2026-03-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/
import { encodeSync } from 'png-chunk-itxt'
import encode         from 'png-chunks-encode'
import extract        from 'png-chunks-extract'

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
        if (rgbString === 'transparent') {
            return `rgba(255,255,255,${alpha})`
        }
        let rgbValues = rgbString.match(/\d+/g)
        let r = rgbValues[0]
        let g = rgbValues[1]
        let b = rgbValues[2]
        return `rgba(${r},${g},${b},${alpha})`
    }

    initDetailsGroup = (detailsGroupElement) => {

        // Close all other details when one is shown
        detailsGroupElement.addEventListener('wa-show', event => {
            if (event.target.localName === 'wa-details') {
                [...detailsGroupElement.querySelectorAll('wa-details')]
                    .map(details => (details.open = event.target === details))
            }
        })
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
    /**
     * Enhanced debounce that supports cancellation.
     * Safe for legacy use as it returns a callable function.
     * * @param {Function} func - The function to debounce
     * @param {number} wait - Time to wait in ms
     * @returns {Function} - Debounced function with a .cancel() method
     */
    debounce = (func, wait = 300) => {
        let timeout

        // The actual function returned to the caller
        const debounced = (...args) => {
            clearTimeout(timeout)
            timeout = setTimeout(() => {
                func.apply(this, args)
            }, wait)
        }

        // Attach the cancel method to the function object
        debounced.cancel = () => {
            clearTimeout(timeout)
        }

        return debounced
    }

    base64ToBlob = (base64) => {
        const parts = base64.split(',')
        const mime = parts[0].match(/:(.*?);/)[1]
        const bstr = atob(parts[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
        }
        return new Blob([u8arr], {type: mime})
    }


    /**
     * Inject UTF-8 metadata into a PNG blob using iTXt chunks
     * @param {Blob} blob - original PNG blob
     * @param {Object} data - key/value metadata
     * @param {string} type - MIME type
     * @returns {Promise<Blob>} - new PNG blob with UTF-8 metadata
     */
    addChunksToPng = async (blob, data, type = 'image/png') => {
        const addChunksToPng = async (blob, data, type = 'image/png') => {
            const buffer = await blob.arrayBuffer()
            const uint8 = new Uint8Array(buffer)

            // Decode existing PNG chunks
            const chunks = extract(uint8)

            // Insert iTXt chunks before IEND
            Object.entries(data).forEach(([key, value]) => {
                chunks.splice(-1, 0, encodeSync(key, value, 'utf-8', false, ''))
            })

            // Re-encode PNG → Uint8Array
            const newPng = encode(chunks)

            // Return as a Blob
            return new Blob([newPng], {type})
        }
    }

    /**
     * Read and list all chunks from a PNG Blob
     * @param {Blob} blob - PNG blob
     * @returns {Promise<Array>} - array of chunks { name, data }
     */

    readPngChunks = async (blob) => {
        // Convert Blob → ArrayBuffer → Uint8Array
        const buffer = await blob.arrayBuffer()
        const uint8 = new Uint8Array(buffer)

        // Decode PNG chunks
        return extract(uint8)
    }

}


