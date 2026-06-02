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

    static #managedStylesheetAttribute = 'data-lgs-managed-stylesheet'
    static #managedStylesheets = new Map()


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

    /**
     * Mounts a stylesheet link with reference counting.
     *
     * @param {string} id - Stable owner/key for this stylesheet
     * @param {string} href - Stylesheet URL
     * @param {Object} attributes - Optional link attributes
     * @returns {Function} Idempotent cleanup function
     */
    static mountStylesheet = (id, href, attributes = {}) => {
        if (typeof document === 'undefined' || !href) {
            return () => {}
        }

        const key = CSSUtils.#managedStylesheetKey(id, href)
        let entry = CSSUtils.#managedStylesheets.get(key)

        if (entry) {
            entry.count += 1
            return CSSUtils.#createManagedStylesheetCleanup(key)
        }

        const existingLink = CSSUtils.#findManagedStylesheetLink(key)
        const link = existingLink ?? document.createElement('link')

        if (!existingLink) {
            link.rel = 'stylesheet'
            link.setAttribute('href', href)
            link.setAttribute(CSSUtils.#managedStylesheetAttribute, key)
            CSSUtils.#applyStylesheetAttributes(link, attributes)
            document.head.appendChild(link)
        }

        entry = {
            count: 1,
            href,
            link,
        }
        CSSUtils.#managedStylesheets.set(key, entry)

        return CSSUtils.#createManagedStylesheetCleanup(key)
    }

    /**
     * Releases one stylesheet reference.
     *
     * @param {string} id - Stable owner/key used when mounting
     */
    static unmountStylesheet = (id) => {
        const entry = CSSUtils.#managedStylesheets.get(id)
        if (!entry) {
            return
        }

        entry.count = Math.max(0, entry.count - 1)
        if (entry.count > 0) {
            return
        }

        entry.link?.remove()
        CSSUtils.#managedStylesheets.delete(id)
    }

    /**
     * Clears all managed stylesheets. Mainly useful for tests and full teardown flows.
     */
    static clearManagedStylesheets = () => {
        CSSUtils.#managedStylesheets.forEach(entry => entry.link?.remove())
        CSSUtils.#managedStylesheets.clear()
    }

    static #managedStylesheetKey = (id, href) => id || href

    static #createManagedStylesheetCleanup = key => {
        let active = true

        return () => {
            if (!active) {
                return
            }

            active = false
            CSSUtils.unmountStylesheet(key)
        }
    }

    static #findManagedStylesheetLink = key => {
        const links = Array.from(document.head?.querySelectorAll(`link[${CSSUtils.#managedStylesheetAttribute}]`) ?? [])
        return links.find(link => link.getAttribute(CSSUtils.#managedStylesheetAttribute) === key) ?? null
    }

    static #applyStylesheetAttributes = (link, attributes) => {
        Object.entries(attributes).forEach(([name, value]) => {
            if (value === false || value === null || value === undefined) {
                return
            }

            if (value === true) {
                link.setAttribute(name, '')
                return
            }

            link.setAttribute(name, value)
        })
    }
}
