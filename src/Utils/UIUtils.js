import {icon}                from '@fortawesome/fontawesome-svg-core'
import {registerIconLibrary} from '@shoelace-style/shoelace/dist/utilities/icon-library'


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

    static icons = {}

    static init = () => {

        // use Font Awesome icons in Shoelace
        registerIconLibrary('far', {
            resolver: name => {
                console.log(name, icon(UIUtils.icons[name]).html[0])
                const blob = new Blob(icon(UIUtils.icons[name]).html, {type: 'image/svg+xml'})
                console.log(name, URL.createObjectURL(blob))
                return URL.createObjectURL(blob)
            },
            mutator: svg => {
                svg.setAttribute('fill', 'currentColor')
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
    static useIcon(iconFromReact) {
        console.log(iconFromReact)
        const name = `${iconFromReact.prefix}-${iconFromReact.iconName}`
        UIUtils.icons[name] = iconFromReact
        return name
    }

}


