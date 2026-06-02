/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCache.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { JOURNEY_WIDGETS, SCENE_WIDGETS, WIDGET_LAYER_START, WIDGETS_STORE } from '@Core/constants'

/**
 * Utility class providing a clean, reactive API over the global Valtio proxy cache.
 */
export class WidgetCache {
    /** @type {WidgetCache|null} */
    static #instance = null

    /** @type {Map<string, CacheEntry>} */
    #cache
    #defaultBoard = 'scene'

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
        lgs.stores.ui.widget.list.delete(key)
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

    #getBaseWidgetId = id => String(id).split('#')[0]

    #resolveWidgetGroup = (id, position = {}) => {
        if (position.group) {
            return position.group
        }

        const baseId = this.#getBaseWidgetId(id)
        const candidateGroups = Array.from(__.widgets?.entries?.() ?? [])
            .filter(([, group]) => group?.widgets?.has(baseId))
            .map(([groupId]) => groupId)

        const widgetsBoard = position.widgetsBoard || this.#defaultBoard
        if (widgetsBoard === this.#defaultBoard && candidateGroups.includes(SCENE_WIDGETS)) {
            return SCENE_WIDGETS
        }
        if (widgetsBoard !== this.#defaultBoard && candidateGroups.includes(JOURNEY_WIDGETS)) {
            return JOURNEY_WIDGETS
        }

        return candidateGroups[0] ?? null
    }

    #normalizePersistedWidget = (id, position = null) => {
        if (!position) {
            return null
        }

        const group = this.#resolveWidgetGroup(id, position)
        if (!group) {
            return null
        }

        return {
            ...position,
            group,
            widgetsBoard: position.widgetsBoard || this.#defaultBoard,
            zIndex:       Number(position.zIndex) > 0 ? Number(position.zIndex) : WIDGET_LAYER_START,
        }
    }

    #needsPersistedWidgetRepair = (source, normalized) => {
        if (!source || !normalized) {
            return false
        }

        return source.group !== normalized.group ||
            (source.widgetsBoard || this.#defaultBoard) !== normalized.widgetsBoard ||
            Number(source.zIndex) !== normalized.zIndex
    }

    #resolveWidgetDefinition = (group, id) => {
        if (!group || !id) {
            return null
        }

        const baseId = this.#getBaseWidgetId(id)
        return __.widgets.get(group)?.widgets?.get(baseId) ?? null
    }

    async #loadPersistedWidgets() {
        const widgetIds = await lgs.db.lgs1920.keys(WIDGETS_STORE)
        const widgets = await Promise.all(widgetIds.map(async (id) => {
            const record = await lgs.db.lgs1920.get(id, WIDGETS_STORE, true)
            const source = record?.data ?? null
            const position = this.#normalizePersistedWidget(id, source)

            return {
                id,
                modifiedAt: record?._mt_ ?? record?._ct_ ?? 0,
                position,
                needsRepair: this.#needsPersistedWidgetRepair(source, position),
            }
        }))

        return widgets.filter(({position}) => Boolean(position?.group))
    }

    async #dedupePersistedSingletons(widgets) {
        const keepers = new Map()
        const duplicates = []

        for (const widget of widgets) {
            const definition = this.#resolveWidgetDefinition(widget.position.group, widget.id)
            if (!definition || (definition.max ?? 1) !== 1) {
                continue
            }

            const scopeKey = `${this.#getBaseWidgetId(widget.id)}:${widget.position.widgetsBoard || this.#defaultBoard}`
            const current = keepers.get(scopeKey)

            if (!current) {
                keepers.set(scopeKey, widget)
                continue
            }

            const shouldReplace =
                      widget.modifiedAt > current.modifiedAt ||
                      (widget.modifiedAt === current.modifiedAt && widget.id > current.id)

            if (shouldReplace) {
                duplicates.push(current.id)
                keepers.set(scopeKey, widget)
            }
            else {
                duplicates.push(widget.id)
            }
        }

        if (duplicates.length > 0) {
            await Promise.all(duplicates.map(id => this.delete(id)))
        }

        return widgets.filter(({id}) => !duplicates.includes(id))
    }

    /**
     * Performs initial hydration of the cache with meta-data from DB.
     */
    async readFromDB() {
        const $widget = lgs.stores.ui.widget
        try {
            const keys = await lgs.db.lgs1920.keys(WIDGETS_STORE)
            for (const widgetId of keys) {
                const widgetData = await lgs.db.lgs1920.get(widgetId, WIDGETS_STORE)
                const position = this.#normalizePersistedWidget(widgetId, widgetData)
                if (!position) {
                    continue
                }

                this.set(widgetId, {
                    group:        position.group,
                    component: null,
                    widgetsBoard: position.widgetsBoard,
                })

                $widget.list.set(widgetId, {
                    group:        position.group,
                    widgetsBoard: position.widgetsBoard,
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
        const widgets = await this.#loadPersistedWidgets()
        const dedupedWidgets = await this.#dedupePersistedSingletons(widgets)

        const initWidgets = dedupedWidgets.map(async ({id, position, needsRepair}) => {
            const zIndex = position?.zIndex// ?? 0
            // Update local cache
            this.set(id, {
                group:        position.group,
                widgetsBoard: position.widgetsBoard,
                zIndex:       zIndex,
            })
            // Create  global store
            const item = {
                group: position.group,
                widgetsBoard: position.widgetsBoard || this.#defaultBoard,
                zIndex,
            }

            lgs.stores.ui.widget.list.set(id, item)
            if (needsRepair) {
                await lgs.db.lgs1920.put(id, position, WIDGETS_STORE)
            }
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
