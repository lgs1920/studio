import {findIconDefinition, icon, library} from '@fortawesome/fontawesome-svg-core'
import {registerIconLibrary}               from '@shoelace-style/shoelace'
import * as Cesium                         from 'cesium'
import {Vt3DContext}                       from './Vt3DContext'

export const CONFIGURATION = '../config.json'

export class UIUtils {

    /**
     * Escape HTML  (frm https://shoelace.style/components/alert)
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
        window.vt3d = new Vt3DContext()
        window.vt3d.configuration = await import(/* @vite-ignore */ CONFIGURATION)

        // Cesium ION auth
        Cesium.Ion.defaultAccessToken = window.vt3d.configuration.ionToken
        const iconLibs = {
            fab: 'brands',
            fad: 'duotone',
            fal: 'light',
            far: 'regular',
            fasl: 'sharp-light',
            fasr: 'sharp-regular',
            fass: 'sharp-solid',
            fast: 'sharp-thin',
            fas: 'solid',
            fat: 'thin' //
        }

        Object?keys(iconLibs).forEach(icon => {
                UIUtils.registerReactFontAwesomeInShoeLaceLibrary(icon,iconLibs[icon])
            })

    }

    static registerReactFontAwesomeInShoeLaceLibrary = ( (library,directory)=> {
        // Register FontAwesome icons for ShoeLace components
        registerIconLibrary(library, {
            resolver: name => {
_

                // Weeeeekep the following incase eof ...


                // // extract prefix and iconName
                // const dashIndex = name.indexOf('-')
                // const prefix = name.slice(0, dashIndex)
                // const iconName = name.slice(dashIndex + 1)
                //
                // // Find the right icon
                // const faIcon = findIconDefinition({prefix: prefix, iconName: iconName})
                // const blob = new Blob(icon(faIcon).html, {type: 'text/html'})
                // return URL.createObjectURL(blob)
            },
            mutator: svg => {
                svg.setAttribute('fill', 'currentColor')
                svg.setAttribute('part', 'svg')
            },
        })
    }

    /**
     * Create svg tag from Font Awesome Icon
     *
     * It's an alias to icon function from fontawesome-svg-core
     *
     * @param iconFromReact
     * @return {string[]}
     */
    static faIconName = (iconFromReact) => {
        library.add(iconFromReact)
        return `${iconFromReact.prefix}-${iconFromReact.iconName}`
    }

    fontAwesomeResolver = () => []


}


