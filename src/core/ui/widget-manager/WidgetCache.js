/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCache.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-15
 * Last modified: 2026-02-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * @typedef {Object} CacheEntry
 * @property {string} group - Group identifier
 * @property {React.LazyExoticComponent} component - Lazy-loaded component
 * @property {HTMLElement} [element] - Associated DOM element (optional)
 * @property {boolean} mounted - Indicates whether the widget is mounted for the current session
 * @property {string} widgetsBoard - The ID of the board containing the widget
 */

import { WIDGETS_STORE } from '@Core/constants'

/**
 * Utility class providing a clean, reactive API over the global Valtio proxy cache.
 */
export class WidgetCache {
    /** @type {WidgetCache|null} */
    static #instance = null

    /** @type {Map<string, CacheEntry>} */
    #cache

    constructor() {
        if (WidgetCache.#instance) {
            return WidgetCache.#instance
        }
        // References the global Valtio proxy store
        this.#cache = lgs.stores.ui.widget.cache
        WidgetCache.#instance = this
    }

    /**
     * Retrieves the lazy-loaded component for a given key.
     * @param {string} key - Unique widget instance ID
     * @returns {React.LazyExoticComponent|null}
     */
    getComponent = key => {
        const entry = this.#cache.get(key)
        return entry ? entry.component : null
    }

    /**
     * Retrieves the full cache entry.
     * @param {string} key
     * @returns {CacheEntry|null}
     */
    get = key => {
        return this.#cache.get(key)
    }

    /**
     * Sets or updates a cache entry.
     * @param {string} key - Unique widget instance ID
     * @param {Object} options - Entry metadata
     */
    set = (key, options) => {
        const {group, component, mounted, widgetsBoard, zIndex} = options

        this.#cache.set(key, {
            group:        group ?? null,
            component: component ?? null,
            mounted:      mounted ?? false,
            widgetsBoard: widgetsBoard ?? null,
            zIndex: zIndex ?? 0,
        })
    }

    /**
     * Deletes an entry and its persistence in DB.
     * @param {string} key
     */
    delete = async key => {
        this.#cache.delete(key)
        await lgs.db.lgs1920.delete(key, WIDGETS_STORE)
    }

    /**
     * Validates if a widget exists based on key, group, and board.
     * @param {string} key - Base key or full ID
     * @param {Object} [options={}]
     * @returns {boolean}
     */
    has = (key, options = {}) => {
        const {group, full = false, widgetsBoard} = options

        const isValidMatch = (value) => {
            const groupMatch = group === undefined || (value && value.group === group)
            const boardMatch = widgetsBoard === undefined || (value && value.widgetsBoard === widgetsBoard)
            return groupMatch && boardMatch
        }

        if (full) {
            const cachedValue = this.#cache.get(key)
            return !!(cachedValue && isValidMatch(cachedValue))
        }

        return Array.from(this.#cache.keys()).some(k => {
            if (k.startsWith(key)) {
                const cachedValue = this.#cache.get(k)
                return isValidMatch(cachedValue)
            }
            return false
        })
    }

    /**
     * Clears all entries.
     */
    clear = () => this.#cache.clear()

    /**
     * Counts entries matching specific criteria.
     * Essential for board-scoped quota management.
     * @param {Object} filters
     * @param {string} [filters.key] - Base key filter
     * @param {string|string[]} [filters.groups] - Group filter
     * @param {string} [filters.widgetsBoard] - Board filter
     * @param {boolean} [filters.full=false] - Exact key match
     * @returns {number}
     */
    count = ({key, groups, widgetsBoard, full = false} = {}) => {
        let entries = Array.from(this.#cache.entries())

        if (full && key) {
            const entry = this.#cache.get(key)
            if (!entry) {
                return 0
            }
            const boardMatch = !widgetsBoard || entry.widgetsBoard === widgetsBoard
            return boardMatch ? 1 : 0
        }

        if (key) {
            entries = entries.filter(([k]) => k === key || k.startsWith(`${key}#`))
        }

        if (groups) {
            const groupArray = Array.isArray(groups) ? groups : [groups]
            entries = entries.filter(([, v]) => groupArray.includes(v.group))
        }

        // Filtering by board ID to allow scoped quota calculations
        if (widgetsBoard) {
            entries = entries.filter(([, v]) => v.widgetsBoard === widgetsBoard)
        }

        return entries.length
    }

    /**
     * Returns a snapshot of the cache based on filters.
     */
    getAll = ({groups = null, widgetsBoard = null} = {}) => {
        if (!groups && !widgetsBoard) {
            return new Map(this.#cache)
        }
        const groupsFilter = groups ? (Array.isArray(groups) ? groups : [groups]) : null

        const filteredEntries = Array.from(this.#cache).filter(([, entry]) => {
            const matchGroup = !groupsFilter || groupsFilter.includes(entry.group)
            const matchBoard = !widgetsBoard || entry.widgetsBoard === widgetsBoard
            return matchGroup && matchBoard
        })

        return new Map(filteredEntries)
    }

    /**
     * UI related methods for DOM and mounting state.
     */
    setElement = (key, element) => {
        const entry = this.#cache.get(key)
        if (entry) {
            entry.element = element
        }
    }

    mount = (key, callback = null) => {
        this.#setMounted(key, true)
        callback?.(key)
    }

    unmount = key => this.#setMounted(key, false)

    #setMounted = (key, mounted) => {
        const entry = this.#cache.get(key)
        if (entry) {
            entry.mounted = mounted
        }
    }

    isMounted = key => this.#cache.get(key)?.mounted

    /**
     * Hydrates the cache and the store list from the indexedDB persistence.
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

                this.set(widgetId, {
                    group:        widgetData.group,
                    component: null,
                    widgetsBoard: widgetData.widgetsBoard,
                })

                $widget.list.set(widgetId, {
                    widgetsBoard: widgetData.widgetsBoard || 'scene',
                })
            }
        }
        catch (error) {
            console.error('[WidgetCache] Failed to restore persisted widgets:', error)
        }
    }

    /**
     * Returns all widgets that have a defined widgetsBoard different from the excluded ones.
     * @param {string|string[]} excludedBoardIds - Single board ID or array of board IDs to exclude
     * @returns {Map<string, CacheEntry>}
     */
    getAllExceptBoards = excludedBoardIds => {
        const exclusions = Array.isArray(excludedBoardIds) ? excludedBoardIds : [excludedBoardIds]

        const filteredEntries = Array.from(this.#cache.entries()).filter(([, entry]) => {
            // Check if widgetsBoard is defined and not in the exclusion list
            return entry.widgetsBoard && !exclusions.includes(entry.widgetsBoard)
        })

        return new Map(filteredEntries)
    }

    /**
     * Hides all widgets that do not belong to the specified boards by moving them off-screen.
     * Original positions are preserved in the $restrictions proxy for later restoration.
     * Performance: Uses direct DOM manipulation to avoid unnecessary React re-renders.
     * @param {string|string[]} excludeBoards - Board ID(s) to be kept visible.
     */
    hideAllExceptBoards = excludeBoards => {
        const widgets = this.getAllExceptBoards(excludeBoards)
        const $restrictions = lgs.stores.ui.widget.restrictions

        widgets.forEach((value, id) => {
            const element = __.ui.widgetManager.getElementById(id)
            if (element && !$restrictions.has(id)) {
                // Save original state to Valtio proxy
                $restrictions.set(id, {
                    top:   element.style.top,
                    left:  element.style.left,
                    board: value.widgetsBoard,
                })

                // Add CSS class to hide widget with !important rules
                element.classList.add('lgs-widget-hidden')
            }
        })
    }

    /**
     * Restores all previously hidden widgets to their original positions.
     * @param {string|string[]} excludeBoards - Optional. If specified, restore widgets that are NOT on these boards
     *                                          (i.e., restore widgets that were hidden by hideAllExceptBoards with the
     *     same parameter). If not specified, restores ALL hidden widgets.
     */
    restoreAllHiddenWidgetsExcept = (excludeBoards) => {
        const $restrictions = lgs.stores.ui.widget.restrictions
        const boardsToExclude = excludeBoards ? (Array.isArray(excludeBoards) ? excludeBoards : [excludeBoards]) : null

        const idsToRestore = []

        $restrictions.forEach((pos, id) => {
            // If excludeBoards is specified, only restore widgets that are NOT on those boards
            // Use the board stored in restrictions for reliable filtering
            if (boardsToExclude) {
                if (!pos.board || boardsToExclude.includes(pos.board)) {
                    return // Skip widgets that ARE on the excluded boards
                }
            }

            const element = __.ui.widgetManager.getElementById(id)
            if (element) {
                // Remove CSS class that hides the widget
                element.classList.remove('lgs-widget-hidden')

                // Restore original positions if they were set
                if (pos.left) {
                    element.style.left = pos.left
                }
                if (pos.top) {
                    element.style.top = pos.top
                }

                idsToRestore.push(id)
            }
        })

        // Remove only the restored widgets from restrictions
        idsToRestore.forEach(id => $restrictions.delete(id))

        // If no board filter was specified, clear all restrictions
        if (!boardsToExclude) {
            $restrictions.clear()
        }
    }

    /**
     * Alias for backward compatibility
     * @deprecated Use restoreAllHiddenWidgetsExcept instead
     */
    restoreAllHiddenWidgets = (excludeBoards) => {
        return this.restoreAllHiddenWidgetsExcept(excludeBoards)
    }
}