/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StoresManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-02-26
 * Last modified: 2025-02-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { proxy }            from 'valtio'
import { editorSettings }   from './editorSettings'
import { main }             from './main'
import { theJourneyEditor } from './theJourneyEditor'

/**
 * StoresManager provides centralized access to application stores:
 * - main: core application state
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