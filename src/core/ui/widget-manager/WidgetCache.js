/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCache.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-17
 * Last modified: 2026-02-17
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VIDEO_WIDGETS_BOARD, WIDGETS_STORE } from '@Core/constants'

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
     * @param {string} key
     * @returns {React.LazyExoticComponent|null}
     */
    getComponent = key => {
        const entry = this.#cache.get(key)
        return entry ? entry.component : null
    }

    get = key => {
        return this.#cache.get(key)
    }

    /**
     * Sets or updates a cache entry.
     * @param {string} key
     * @param {Object} options
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
     * @param {string} key
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

    clear = () => this.#cache.clear()

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

        if (widgetsBoard) {
            entries = entries.filter(([, v]) => v.widgetsBoard === widgetsBoard)
        }

        return entries.length
    }

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
            entry.element = null
            entry.mounted = mounted
        }
    }

    isMounted = key => this.#cache.get(key)?.mounted

    /**
     * Performs initial hydration of the cache with meta-data from DB.
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
            console.error('[WidgetCache] Failed to read from DB:', error)
        }
    }

    /**
     * Full initialization flow.
     * 1. Loads raw widget metadata from DB.
     * 2. Enriches cache and reactive store with real persistent positions/zIndex.
     */
    async init() {
        const widgets = await lgs.db.lgs1920.keys(WIDGETS_STORE)
        const initWidgets = widgets.map(async (id) => {
            // Retrieve persistent data through the manager
            const position = await __.ui.widgetManager.getWidgetPosition(id)
            const zIndex = position?.zIndex// ?? 0
            // Update local cache
            this.set(id, {
                group:        position.group,
                widgetsBoard: position.widgetsBoard,
                zIndex:       zIndex,
            })
            // Create  global store
            const item = {
                widgetsBoard: position.widgetsBoard || 'scene',
            }
            // Add zIndex for video widgets
            if (position.widgetsBoard === VIDEO_WIDGETS_BOARD) {
                item.zIndex = zIndex
            }

            lgs.stores.ui.widget.list.set(id, item)
        })

        await Promise.all(initWidgets)
    }

    /**
     * Board isolation and visibility methods.
     */
    getAllExceptBoards = excludedBoardIds => {
        const exclusions = Array.isArray(excludedBoardIds) ? excludedBoardIds : [excludedBoardIds]
        const filteredEntries = Array.from(this.#cache.entries()).filter(([, entry]) => {
            return entry.widgetsBoard && !exclusions.includes(entry.widgetsBoard)
        })
        return new Map(filteredEntries)
    }

    hideAllExceptBoards = excludeBoards => {
        const widgets = this.getAllExceptBoards(excludeBoards)
        const $restrictions = lgs.stores.ui.widget.restrictions

        widgets.forEach((value, id) => {
            const element = __.ui.widgetManager.getElementById(id)
            if (element && !$restrictions.has(id)) {
                $restrictions.set(id, {
                    top:   element.style.top,
                    left:  element.style.left,
                    board: value.widgetsBoard,
                })
                element.classList.add('lgs-widget-hidden')
            }
        })
    }

    restoreAllHiddenWidgetsExcept = (excludeBoards) => {
        const $restrictions = lgs.stores.ui.widget.restrictions
        const boardsToExclude = excludeBoards ? (Array.isArray(excludeBoards) ? excludeBoards : [excludeBoards]) : null
        const idsToRestore = []

        $restrictions.forEach((pos, id) => {
            if (boardsToExclude && pos.board && boardsToExclude.includes(pos.board)) {
                return
            }

            const element = __.ui.widgetManager.getElementById(id)
            if (element) {
                element.classList.remove('lgs-widget-hidden')
                if (pos.left) {
                    element.style.left = pos.left
                }
                if (pos.top) {
                    element.style.top = pos.top
                }
                idsToRestore.push(id)
            }
        })

        idsToRestore.forEach(id => $restrictions.delete(id))
        if (!boardsToExclude) {
            $restrictions.clear()
        }
    }

    restoreAllHiddenWidgets = (excludeBoards) => this.restoreAllHiddenWidgetsExcept(excludeBoards)
}