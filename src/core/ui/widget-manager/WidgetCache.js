/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCache.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-18
 * Last modified: 2025-12-18
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
 */

import { WIDGETS_STORE } from '@Core/constants'

/**
 * Utility class providing a clean, reactive API over the global Valtio proxy cache.
 * The proxy is stored in a private class field `#cache` for internal use.
 * All methods are arrow functions.
 */
export class WidgetCache {
    /** @type {WidgetCache|null} */
    static #instance = null

    /** @type {import('valtio').Proxy<Map<string, CacheEntry>>} */
    #cache = new Map()

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
     *
     * @param key
     * @param options
     */
    set = (key, options) => {
        const {group, component, mounted, widgetsBoard} = options

        this.#cache.set(key, {
            group:        group ?? null,
            component:    component ?? null,//__.app.pascalCase(widgetId.split('#')[0]),
            mounted:      mounted ?? false,
            widgetsBoard: widgetsBoard ?? null,
        })
    }

    /**
     * Deletes an entry by its key.
     * @param {string} key - Full key
     */
    delete = key => this.#cache.delete(key)

    /**
     * Checks if a key exists in the cache and validates against group and widgetsBoard criteria.
     * @param {string} key - Full or base key.
     * @param {Object} [options={}] - Options for the search.
     * @param {string} [options.group] - The group the cached item must belong to.
     * @param {boolean} [options.full=false] - If true, exact key match only.
     * @param {string} [options.widgetsBoard] - The widgetsBoard the cached item must belong to.
     * @returns {boolean}
     */
    has = (key, options = {}) => {
        const {group, full = false, widgetsBoard} = options

        /**
         * Internal validator for metadata constraints.
         * Ensures the cached entry aligns with the requested architectural scope.
         * @param {Object} value - The cached entry metadata.
         * @returns {boolean}
         */
        const isValidMatch = (value) => {
            const groupMatch = group === undefined || (value && value.group === group)
            const boardMatch = widgetsBoard === undefined || (value && value.widgetsBoard === widgetsBoard)

            return groupMatch && boardMatch
        }

        if (full) {
            if (this.#cache.has(key)) {
                const cachedValue = this.#cache.get(key)
                return isValidMatch(cachedValue)
            }
            return false
        }

        // Performance note: iteration over keys scales linearly with cache size
        return Array.from(this.#cache.keys()).some(k => {
            if (k.startsWith(key)) {
                const cachedValue = this.#cache.get(k)
                return isValidMatch(cachedValue)
            }
            return false
        })
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
     * Returns a filtered read-only snapshot of the cache using a configuration object
     * @param {Object} [filters={}] - Filter configuration
     * @param {string|string[]|null} [filters.groups=null] - Single group or array of groups
     * @param {string|null} [filters.widgetsBoard=null] - Specific widgets board identifier
     * @returns {Map<string, CacheEntry>}
     */
    getAll = ({groups = null, widgetsBoard = null} = {}) => {
        // Return early if no filters are applied
        if (!groups && !widgetsBoard) {
            return new Map(this.#cache)
        }
        // Normalize groups to an array to handle both string and string[]
        const groupsFilter = groups ? (Array.isArray(groups) ? groups : [groups]) : null

        const filteredEntries = Array.from(this.#cache).filter(([key, entry]) => {
            // Validate entry against groups array if filter is active
            const matchGroup = !groupsFilter || groupsFilter.includes(entry.group)
            // Validate entry against widgetsBoard if filter is active
            const matchBoard = !widgetsBoard || entry.widgetsBoard === widgetsBoard

            return matchGroup && matchBoard
        })

        return new Map(filteredEntries)
    }

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
     * Fill cache from DB
     *
     * @return {Promise<void>}
     */
    async readFromDB() {
        const $widget = lgs.stores.ui.widget
        try {
            const keys = await lgs.db.lgs1920.keys(WIDGETS_STORE)
            for (const widgetId of keys) {
                const widgetData = await lgs.db.lgs1920.get(widgetId, WIDGETS_STORE)
                if (!widgetData || !widgetData.group) {
                    continue
                }
                __.ui.widgetCache.set(widgetId, {
                    group:        widgetData.group,
                    component:    null, // __.app.pascalCase(widgetId.split('#')[0]),
                    widgetsBoard: widgetData.widgetsBoard,
                })

                $widget.list.set(widgetId, {widgetsBoard: widgetData.widgetsBoard || 'scene'})

            }
        }
        catch (error) {
            console.error('Failed to restore persisted widgets:', error)
        }
    }
}