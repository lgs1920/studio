/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: setup.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-28
 * Last modified: 2026-09-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

if (!Array.isArray(document.adoptedStyleSheets)) {
    Object.defineProperty(document, 'adoptedStyleSheets', {
        configurable: true,
        value: [],
        writable: true,
    })
}

/**
 * Define an ElementInternals method that is missing from the jsdom runtime.
 *
 * @param {string} name Method name.
 * @param {Function} implementation Compatibility implementation.
 * @returns {void}
 */
const defineMissingElementInternalsMethod = (name, implementation) => {
    const prototype = globalThis.ElementInternals?.prototype

    if (!prototype || typeof prototype[name] === 'function') return

    Object.defineProperty(prototype, name, {
        configurable: true,
        value: implementation,
        writable: true,
    })
}

/**
 * Complete the ElementInternals validation surface required by Web Awesome.
 *
 * @returns {void}
 */
const ensureElementInternalsValidation = () => {
    const prototype = globalThis.ElementInternals?.prototype

    if (!prototype) return

    defineMissingElementInternalsMethod('setValidity', () => {})
    defineMissingElementInternalsMethod('setFormValue', () => {})
    defineMissingElementInternalsMethod('checkValidity', () => true)
    defineMissingElementInternalsMethod('reportValidity', () => true)

    if (!Object.getOwnPropertyDescriptor(prototype, 'validity')) {
        Object.defineProperty(prototype, 'validity', {
            configurable: true,
            get: () => ({valid: true}),
        })
    }
}

ensureElementInternalsValidation()
