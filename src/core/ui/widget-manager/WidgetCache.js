/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCache.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-15
 * Last modified: 2025-11-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * @typedef {Object} CacheEntry
 * @property {string} group - Group identifier
 * @property {Promise<React.Component>} component - Lazy-loaded component
 * @property {HTMLElement} [element] - Associated DOM element (optional)
 * @property {boolean} mountedForVideo - Indicates whether the widget is mounted for the current video
 */

/**
 * Utility class providing a clean, reactive API over the global Valtio proxy cache.
 * The proxy is stored in a private class field `#cache` for internal use.
 * All methods are arrow functions.
 */
export class WidgetCache {
    /** @type {WidgetCache|null} */
    static #instance = null

    /** @type {import('valtio').Proxy<Map<string, CacheEntry>>} */
    #cache

    constructor() {
        if (WidgetCache.#instance) {
            return WidgetCache.#instance
        }
        // Valtio proxy is a plain object with Map-like methods (get, set, has, delete, clear, entries, keys)
        this.#cache = lgs.stores.ui.widget.cache
        WidgetCache.#instance = this
    }

    /**
     * Retrieves the lazy-loaded component for a given key.
     * @param {string} key - Full widget key
     * @returns {Promise<React.Component>|null}
     */
    get = key => {
        const entry = this.#cache.get(key)
        return entry ? entry.component : null
    }

    /**
     * Stores or updates a cache entry.
     * @param {string} key - Key (`<key>` or `<key>#<uuid>`)
     * @param {string} group - Group identifier
     * @param {Promise<React.Component>} lazyComponent - Lazy component
     * @param {boolean} [mountedForVideo=false] - Initial mounted state for video
     */
    set = (key, group, lazyComponent, mountedForVideo = false) => {
        this.#cache.set(key, {
            group,
            component: lazyComponent,
            mountedForVideo,
        })
    }

    /**
     * Deletes an entry by its key.
     * @param {string} key - Full key
     */
    delete = key => this.#cache.delete(key)

    /**
     * Checks if a key exists in the cache.
     * @param {string} key - Full or base key
     * @param {boolean} [full=false] - If true, exact key match only
     * @returns {boolean}
     */
    has = (key, full = false) => {
        if (full) {
            return this.#cache.has(key)
        }
        return Array.from(this.#cache.keys()).some(k => k === key || k.startsWith(`${key}#`))
    }

    /**
     * Clears the entire cache.
     */
    clear = () => this.#cache.clear()

    /**
     * Clears all entries belonging to a specific group.
     * @param {string} group - Group identifier
     */
    clearByGroup = group => {
        for (const [key, value] of this.#cache) {
            if (value.group === group) {
                this.#cache.delete(key)
            }
        }
    }

    /**
     * Counts entries matching the specified criteria.
     * @param {string} [key] - Base key filter
     * @param {string|string[]} [groups] - Group(s) filter
     * @param {boolean} [full=false] - Exact key count
     * @returns {number}
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

    /**
     * Returns a read-only snapshot of the cache.
     * @returns {Map<string, CacheEntry>}
     */
    getAll = () => new Map(this.#cache)

    /**
     * Associates an HTMLElement with an existing entry.
     * @param {string} key - Widget key
     * @param {HTMLElement} element - DOM element
     */
    setElement = (key, element) => {
        const entry = this.#cache.get(key)
        if (entry) {
            entry.element = element
        }
    }

    /**
     * Updates the video-mounted state of an entry.
     * @param {string} key - Widget key
     * @param {boolean} mounted - New mounted state
     */
    setMountedForVideo = (key, mounted) => {
        const entry = this.#cache.get(key)
        if (entry) {
            entry.mountedForVideo = mounted
        }
    }

    /**
     * Gets the video-mounted state of an entry.
     * @param {string} key - Widget key
     * @returns {boolean|undefined}
     */
    isMountedForVideo = key => this.#cache.get(key)?.mountedForVideo
}