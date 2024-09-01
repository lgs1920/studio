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
    static hexToRGBA=(hex, format = 'rgba')=> {
        hex = hex.replace(/^#/, '');

        // Transform #RGB to #RRGGBB orRRRRRGBFF
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
            if (format === 'rgba') {
                hex +='FF'
            }
        }

        // Extract colors
        let bigint = parseInt(hex, 16);
        let r = (bigint >> 24) & 255;
        let g = (bigint >> 16) & 255;
        let b = (bigint >> 8) & 255;

        if (format === 'rgb') {
            return `rgb(${r},${g},${b})`;
        }
        // and alpha,if it exists
        if (hex.length === 8) {
            let a = (bigint & 255) / 255;
            return `rgba(${r},${g},${b},${a})`;
        }
    }


    static RGB2RGBA=(rgbString, alpha = 1) => {
        let rgbValues = rgbString.match(/\d+/g);
        let r = rgbValues[0];
        let g = rgbValues[1];
        let b = rgbValues[2];
        return `rgba(${r},${g},${b},${alpha})`;
    }

}


