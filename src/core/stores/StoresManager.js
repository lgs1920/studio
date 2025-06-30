/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StoresManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-30
 * Last modified: 2025-06-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { proxy }            from 'valtio'
import { editorSettings }   from './editorSettings.js'
import { main }             from './main.js'
import { theJourneyEditor } from './theJourneyEditor.js'
import { ui }               from './ui.js'

/**
 * StoresManager provides centralized access to application stores:
 * - main: core application state
 * - ui: user interface state (drawers, modals, etc.)
 * - journeyEditor: editor-specific state
 * - editorSettings: user preferences and settings
 *
 * @class
 */
export class StoresManager {
    /** @type {StoresManager|null} Singleton instance */
    static #instance = null

    /** @type {Object} Main application state store */
    #main

    /** @type {Object} UI state store */
    #ui

    /** @type {Object} Journey editor state store */
    #journeyEditor

    /** @type {Object} Editor settings store */
    #editorSettings

    /**
     * Creates or returns existing StoresManager instance
     * Initializes proxy stores if instance doesn't exist
     * @constructor
     *
     * @returns {StoresManager} The singleton instance
     */
    constructor() {
        if (StoresManager.#instance) {
            return StoresManager.#instance
        }

        this.#main = proxy(main)
        this.#ui = proxy(ui)
        this.#journeyEditor = proxy(theJourneyEditor)
        this.#editorSettings = proxy(editorSettings)

        StoresManager.#instance = this
    }

    /**
     * Gets the main application state store
     * @returns {Object} Proxied main store
     */
    get main() {
        return this.#main
    }

    /**
     * Gets the UI state store
     * @returns {Object} UI store (drawers, modals, mainUI, etc.)
     */
    get ui() {
        return this.#ui
    }

    /**
     * Gets the journey editor state store
     * @returns {Object} Proxied journey editor store
     */
    get journeyEditor() {
        return this.#journeyEditor
    }

    /**
     * Gets the editor settings store
     * @returns {Object} Proxied editor settings store
     */
    get editorSettings() {
        return this.#editorSettings
    }
}