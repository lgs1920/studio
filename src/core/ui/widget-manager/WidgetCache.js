/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCache.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-11
 * Last modified: 2025-11-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Singleton cache for widget components.
 * Keys can be `<key>` or `<key>#<uuid>`.
 * A single key can belong to multiple groups.
 * Stored entries: { group: string, component: Promise<React.Component> }
 */
export class WidgetCache {
    static #instance = null
    #cache = new Map()

    constructor() {
        if (WidgetCache.#instance) {
            return WidgetCache.#instance
        }
        WidgetCache.#instance = this
    }

    /**
     * Retrieves the component for a given key.
     * @param {string} key - The widget key (may include #uuid suffix)
     * @returns {Promise<React.Component>|null}
     */
    get = (key) => this.#cache.get(key)?.component ?? null

    /**
     * Stores a lazy-loaded component under a key and associates it with a group.
     * @param {string} key - Key (`<key>` or `<key>#<uuid>`)
     * @param {string} group - Group identifier
     * @param {Promise<React.Component>} lazyComponent - Lazy-loaded component
     */
    set = (key, group, lazyComponent) => this.#cache.set(key, {group, component: lazyComponent})

    /**
     * Deletes an entry by its key.
     * @param {string} key - Full key to delete
     */
    delete = (key) => this.#cache.delete(key)

    /**
     * Checks if a key exists in the cache.
     * @param {string} key - Full key or base key
     * @param {boolean} [full=false] - If true, checks exact full key match
     * @returns {boolean} True if key exists
     */
    has = (key, full = false) => {
        if (full) {
            return this.#cache.has(key)
        }
        return Array.from(this.#cache.keys()).some(k => k === key || k.startsWith(`${key}#`))
    }

    /**
     * Clears all entries from the cache.
     */
    clear = () => this.#cache.clear()

    /**
     * Clears all entries belonging to a specific group.
     * @param {string} group - Group identifier to clear
     */
    clearByGroup = (group) => {
        for (const [key, value] of this.#cache) {
            if (value.group === group) {
                this.#cache.delete(key)
            }
        }
    }

    /**
     * Counts entries matching the specified criteria.
     * @param {string} [key] - Base key to filter (optional)
     * @param {string|string[]} [groups] - Group(s) to filter (optional)
     * @param {boolean} [full=false] - If true, counts only exact key match
     * @returns {number} Number of matching entries
     */
    count = (key, groups, full = false) => {
        let entries = Array.from(this.#cache.entries())

        if (full && key) {
            return this.#cache.has(key) ? 1 : 0
        }

        if (key) {
            entries = entries.filter(([k]) => k === key || k.startsWith(`${key}#`))
        }

        if (groups) {
            const groupArray = Array.isArray(groups) ? groups : [groups]
            entries = entries.filter(([, v]) => groupArray.includes(v.group))
        }

        return entries.length
    }
}