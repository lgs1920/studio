import {icon} from '@fortawesome/fontawesome-svg-core'


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

    static init = () => {
    }

    /**
     * Create svg tag from Font Awesome Icon
     *
     * It's an alias to icon function from fontawesome-svg-core
     *
     * @param iconFromReact
     * @return {string[]}
     */

    static useFAIcon = (iconFromReact) => {
        const blob = new Blob(icon(iconFromReact).html, {type: 'image/svg+xml'})
        return URL.createObjectURL(blob)
    }

}


