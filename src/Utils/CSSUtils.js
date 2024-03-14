export class CSSUtils {

    /**
     * Get value of a CSSUtils variable
     *
     * @param variable (with or without --)
     */
    static getCSSVariable = (variable) => {
        if (!variable.startsWith('--')) {
            variable = `--${variable}`
        }
        return getComputedStyle(document.documentElement)
            .getPropertyValue(variable)
    }

    /**
     * Set a CSSUtils variable
     *
     * @param variable   (with or without --)
     * @param value
     */
    static setCSSVariable = (variable, value) => {
        if (!variable.startsWith('--')) {
            variable = `--${variable}`
        }
        gdocument.documentElement.style
            .setProperty(variable, value)
    }
}