/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCache.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-28
 * Last modified: 2025-11-28
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * @typedef {Object} CacheEntry
 * @property {string} group - Group identifier
 * @property {Promise<React.Component>} component - Lazy-loaded component
 * @property {HTMLElement} [element] - Associated DOM element (optional)
 * @property {boolean} mounted - Indicates whether the widget is mounted for the current video
 * @property {proxySet<string>} [synced] - proxySet of keys this entry must stay in sync with (added for mob store
 *     proxySet)
 */

import { proxySet } from 'valtio/utils'

/**
 * Utility class providing a clean, reactive API over the global Valtio proxy cache.
 * The proxy is stored in a private class field `#cache` for internal use.
 * All methods are arrow functions.
 *
 * Added getter/setter for `synced` to support the new `proxySet` in mob store.
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
    getComponent = key => {
        const entry = this.#cache.get(key)
        return entry ? entry.component : null
    }

    /**
     * Retrieves the cache element for a given key.
     * @param {string} key - Full widget key
     * @returns {Promise<React.Component>|null}
     */
    get = key => {
        return this.#cache.get(key)
    }

    /**
     * Stores or updates a cache entry.
     * @param {string} key - Key (`<key>` or `<key>#<uuid>`)
     * @param {string} group - Group identifier
     * @param {Promise<React.Component>} lazyComponent - Lazy component
     * @param {boolean} [mounted=false] - Initial mounted state for video
     * @param {proxySet<string>} [synced=new proxySet()] - Keys to sync with (for mob store proxySet)
     */
    set = (key, group, lazyComponent, mounted = false, synced = new proxySet()) => {
        this.#cache.set(key, {
            group,
            component: lazyComponent,
            mounted,
            synced,
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
     * Marks the widget as mounted
     * @param {string} key - Widget key
     * @param {function} callback - Called once the widget has veen mounted
     */
    mount = (key, callback = null) => {
        this.#setMounted(key, true)
        callback?.(key)
    }

    /**
     * Marks the widget as unmounted
     * @param {string} key - Widget key
     */
    unmount = key => {
        this.#setMounted(key, false)
    }

    /**
     * Updates the video-mounted state of an entry.
     * @param {string} key - Widget key
     * @param {boolean} mounted - New mounted state
     * @private
     */
    #setMounted = (key, mounted) => {
        const entry = this.#cache.get(key)
        if (entry) {
            entry.mounted = mounted
        }
    }

    /**
     * Gets the video-mounted state of an entry.
     * @param {string} key - Widget key
     * @returns {boolean|undefined}
     */
    isMounted = key => this.#cache.get(key)?.mounted

    /**
     * Gets the synced proxySet for a given key.
     * @param {string} key - Widget key
     * @returns {proxySet<string>|undefined}
     */
    getSynced = key => {
        const entry = this.#cache.get(key)
        return entry?.synced
    }

    /**
     * proxySets or replaces the synced proxySet for a given key.
     * @param {string} key - Widget key
     * @param {proxySet<string>} synced - New sync set
     */
    setSynced = (key, synced) => {
        const entry = this.#cache.get(key)
        if (entry) {
            entry.synced = synced
        }
    }

    /**
     * Adds one or more keys to the synced proxySet of an entry.
     * @param {string} key - Widget key
     * @param {string|string[]} keysToAdd - Key(s) to add to sync
     */
    addToSynced = (key, keysToAdd) => {
        const entry = this.#cache.get(key)
        if (!entry) {
            return
        }
        if (!entry.synced) {
            entry.synced = new proxySet()
        }
        const toAdd = Array.isArray(keysToAdd) ? keysToAdd : [keysToAdd]
        toAdd.forEach(k => entry.synced.add(k))
    }

    /**
     * Removes one or more keys from the synced proxySet of an entry.
     * @param {string} key - Widget key
     * @param {string|string[]} keysToRemove - Key(s) to remove from sync
     */
    removeFromSynced = (key, keysToRemove) => {
        const entry = this.#cache.get(key)
        if (!entry?.synced) {
            return
        }
        const toRemove = Array.isArray(keysToRemove) ? keysToRemove : [keysToRemove]
        toRemove.forEach(k => entry.synced.delete(k))
    }

    /**
     * Clears the synced proxySet for a given key.
     * @param {string} key - Widget key
     */
    clearSynced = key => {
        const entry = this.#cache.get(key)
        if (entry?.synced) {
            entry.synced.clear()
        }
    }
}