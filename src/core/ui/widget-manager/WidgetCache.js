/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCache.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-07
 * Last modified: 2025-11-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

export class WidgetCache {
    static #instance = null
    #cache = new Map()

    constructor() {
        if (WidgetCache.#instance) {
            return WidgetCache.#instance
        }
        WidgetCache.#instance = this
    }

    get(key) {
        return this.#cache.get(key)
    }

    set(key, lazyComponent) {
        this.#cache.set(key, lazyComponent)
    }

    delete(key) {
        this.#cache.delete(key)
    }

    has(key) {
        return this.#cache.has(key)
    }

    clear() {
        this.#cache.clear()
    }
}