/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
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

import { WidgetRegistry } from '@Core/ui/widget-manager/registry/WidgetRegistry'

/**
 * Singleton class responsible for dynamically rendering and managing widgets.
 */
export class WidgetDynamicRenderer {
    /** @type {WidgetDynamicRenderer} */
    static #instance
    registry = new WidgetRegistry()

    constructor() {
        if (WidgetDynamicRenderer.#instance) {
            return WidgetDynamicRenderer.#instance
        }
        WidgetDynamicRenderer.#instance = this
    }

    static get instance() {
        if (!WidgetDynamicRenderer.#instance) {
            WidgetDynamicRenderer.#instance = new WidgetDynamicRenderer()
        }
        return WidgetDynamicRenderer.#instance
    }

    reset() {
    }

    /**
     * Filters and returns valid widget groups.
     * @param {Iterable<string>} groups
     * @returns {Map<string, Object>}
     */
    theGroups(groups) {
        const subGroups = new Map()
        for (const group of groups) {
            if (__.widgets.has(group)) {
                subGroups.set(group, __.widgets.get(group))
            }
        }
        return subGroups
    }

    /**
     * Finds an existing widget ID in the store based on key and board.
     * @param {string} key - The base widget key.
     * @param {string} widgetsBoard - The specific board ID.
     * @returns {string|null}
     */
    findExistingInList(key, widgetsBoard) {
        const $list = lgs.stores.ui.widget.list
        return Array.from($list.keys()).find(id => {
            const entry = $list.get(id)
            return id.startsWith(key) && entry?.widgetsBoard === widgetsBoard
        }) || null
    }

    /**
     * Checks if a widget can be rendered based on global registry limits and board quotas.
     * Supports multiple instances if max > 1.
     * @param {string} group - Group ID.
     * @param {string} key - Widget base key.
     * @param {Object} props - Widget props (including widgetsBoard).
     * @returns {{canRender: boolean, widgetId: string|null, existingInList: string|null}}
     */
    canRenderWidget = (group, key, props = {}) => {
        const {widgetsBoard, forceRefresh} = props

        const isMaxReached = __.ui.widgetManager.isMaxWidgetsReached(group, key, widgetsBoard)
        const existingInList = this.findExistingInList(key, widgetsBoard)
        const existingInCache = __.ui.widgetCache.has(key, {group, full: false, widgetsBoard})

        // Scenario 1: Slot available for a new instance
        if (!isMaxReached) {
            const widgetId = __.ui.widgetManager.defineElementId(group, key)
            return {canRender: true, widgetId, existingInList: null}
        }

        // Scenario 2: Max reached, but we want to force a refresh/re-render of an existing instance
        if (existingInList && forceRefresh && existingInCache) {
            return {canRender: true, widgetId: existingInList, existingInList}
        }

        // Scenario 3: Max reached and no bypass allowed
        return {canRender: false, widgetId: null, existingInList}
    }

    /**
     * Loads, registers, and updates the store for a widget component.
     */
    async renderWidget(group, key, props = {}) {
        const $widget = lgs.stores.ui.widget

        const {canRender, widgetId} = this.canRenderWidget(group, key, props)
        if (!canRender) {
            return null
        }

        const groupsMap = this.theGroups([group])
        const theGroups = groupsMap.get(group)
        if (!theGroups) {
            console.warn(`[WidgetDynamicRenderer] Group "${group}" not found`)
            return null
        }

        const theWidget = theGroups.widgets.get(key.split('#')[0])
        let LazyWidget = null

        if (theWidget?.component) {
            LazyWidget = this.registry.getLazyComponent(theWidget.component)

            if (!LazyWidget) {
                console.error(`[WidgetDynamicRenderer] Resolution failed for: ${theWidget.component}`)
                return null
            }
        }

        // registering in the local memory cache for instance persistence
        __.ui.widgetCache.set(widgetId, {
            group,
            component:    LazyWidget,
            widgetsBoard: props.widgetsBoard,
        })

        // push to Valtio store to trigger UI update
        $widget.list.set(widgetId, props)

        return LazyWidget ?? widgetId
    }

    /**
     * Destroys and removes a specific widget instance from memory and store.
     */
    destroyWidget(widgetId) {
        const $widget = lgs.stores.ui.widget
        $widget.list.delete(widgetId)
        __.ui.widgetCache.delete(widgetId)

        return true
    }
}