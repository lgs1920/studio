/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CSSUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-20
 * Last modified: 2026-02-20
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

    static rem2px = (remString, stringify = false) => {
        const root = document.documentElement
        const baseFontSize = parseFloat(getComputedStyle(root).fontSize)
        const remValue = parseFloat(remString)
        const pixelValue = remValue * baseFontSize
        return stringify ? `${pixelValue}px` : pixelValue
    }
}