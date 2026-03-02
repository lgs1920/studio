/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Settings.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { snapshot } from 'valtio'

export class Settings {

    /** @type {Map} */
    #sections

    constructor() {

        if (Settings.instance) {
            return Settings.instance
        }

        this.#sections = new Map()
        Settings.instance = this
    }

    /**
     * Add a new section to Settings and define getter using the key
     *
     * @param {string} key
     * @param {object} section
     */
    add = (section) => {
        this.#sections.set(section.key, section)
        // key
        Object.defineProperty(this, section.key, {
            get: function () {
                return this.#sections.get(section.key).content
            },
            set: function (poi) {
                this.#sections.get(section.key).content = poi
            },
        })

        // snapKey
        Object.defineProperty(this, __.app.camelCase(`get-${section.key}`), {
            get: function () {
                return snapshot(this.#sections.get(section.key).content)
            },
        })
    }
}