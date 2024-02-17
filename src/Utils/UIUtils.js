import * as Cesium from 'cesium'
import {VT3D}      from '../VT3D'
import {FA2SL}     from './FA2SL'

export const CONFIGURATION = '../config.json'

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
    static icons

    static init = async () => {
        // Set Context
        window.vt3d = new VT3D()
        console.log(window.vt3d)
        window.vt3d.configuration = await import(/* @vite-ignore */ CONFIGURATION)

        // Cesium ION auth
        Cesium.Ion.defaultAccessToken = window.vt3d.configuration.ionToken

        // Register Font Awesome icons in ShoeLace
        FA2SL.useFontAwesomeInShoelace('fa')

    }

}


