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
}


