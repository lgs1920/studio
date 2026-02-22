/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CSSUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-22
 * Last modified: 2026-02-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export class CSSUtils {


    /**
     * Get the value of a CSS Variable
     *
     * @param variable {string} - The variable name (with or without --)
     * @param target {string|HTMLElement} - Optional: CSS selector or DOM element
     *
     * @return {string}
     */
    static getCSSVariable = (variable, target = document.documentElement) => {
        const name = variable.startsWith('--') ? variable : '--' + variable
        const element = typeof target === 'string'
                        ? document.querySelector(target)
                        : target
        const finalElement = element || document.documentElement

        return window.getComputedStyle(finalElement).getPropertyValue(name).trim()
    }

    /**
     * Set a CSS Variable
     *
     * @param variable {string} - The variable name (with or without --)
     * @param value {any}       - The value to assign
     * @param target {string|HTMLElement} - Optional: CSS selector or DOM element
     */
    static setCSSVariable = (variable, value, target = document.documentElement) => {
        const name = variable.startsWith('--') ? variable : '--' + variable

        const element = typeof target === 'string'
                        ? document.querySelector(target)
                        : target

        if (element) {
            element.style.setProperty(name, value)
        }
    }

    /**
     * Retrieves all CSS variables defined within classes of a specific element or globally.
     * @param {string} selector - Optional CSS selector to filter specific classes (e.g., '.lgs-compass')
     * @returns {Array<string>} List of unique CSS variable names
     */
    static getCSSVariablesFromClasses = (selector = '') => {
        const variables = new Set()
        const sheets = Array.from(document.styleSheets)

        sheets.forEach(($sheet) => {
            try {
                const rules = Array.from($sheet.cssRules || $sheet.rules)

                rules.forEach(($rule) => {
                    // Filter by selector if provided, otherwise check all classes
                    if (selector && !$rule.selectorText?.includes(selector)) {
                        return
                    }

                    if ($rule.style) {
                        // Iterate over all properties in the rule
                        for (let i = 0; i < $rule.style.length; i++) {
                            const prop = $rule.style[i]
                            // Check if the property is a CSS custom property (starts with --)
                            if (prop.startsWith('--')) {
                                variables.add(prop)
                            }
                        }
                    }
                })
            }
            catch (e) {
                // Avoid CORS issues with external stylesheets
                console.warn('Could not read stylesheet rules:', e)
            }
        })

        return Array.from(variables)
    }

    static rem2px = (remString, stringify = false) => {
        const root = document.documentElement
        const baseFontSize = parseFloat(getComputedStyle(root).fontSize)
        const remValue = parseFloat(remString)
        const pixelValue = remValue * baseFontSize
        return stringify ? `${pixelValue}px` : pixelValue
    }
}