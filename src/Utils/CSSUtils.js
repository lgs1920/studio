export class CSSUtils {


    /**
     * Get the value of the CSS Variable
     *
     * @param variable {string}   can start with -- or not
     *
     * @return {string}
     */
    static getCSSVariable = (variable) => {
        variable = (variable.startsWith('--') ? variable : '--' + variable)
        return window.getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
    }

    /**
     * set a CSS Variable
     *
     * @param variable {string}     can start with -- or not
     * @param value {any}           the value to assign
     *
     * @return {string}
     */
    static setCSSVariable = (variable, value) => {
        variable = (variable.startsWith('--') ? variable : '--' + variable)
        document.documentElement.style.setProperty(variable, value)
    }
}