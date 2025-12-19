/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-19
 * Last modified: 2025-12-19
 *
 *
 * Copyright © 2025 LGS1920
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
     * Checks if a widget can be rendered based on cache and limits.
     */
    canRenderWidget = (group, key, props = {}) => {
        const $widget = lgs.stores.ui.widget
        const {widgetsBoard, forceRefresh} = props

        const existingInCache = __.ui.widgetCache.has(key, {group, full: false, widgetsBoard})
        const existingInList = Array.from($widget.list.keys()).find(id => id.startsWith(key))

        if (!existingInList) {
            const isMaxReached = __.ui.widgetManager.isMaxWidgetsReached(group, key)
            if (!isMaxReached) {
                const widgetId = __.ui.widgetManager.defineElementId(group, key)
                return {canRender: true, widgetId, existingInList: null}
            }
            return {canRender: false, widgetId: null, existingInList: null}
        }

        if (forceRefresh && existingInCache) {
            return {canRender: true, widgetId: existingInList, existingInList}
        }

        return {canRender: false, widgetId: null, existingInList}
    }

    /**
     * Loads and registers a widget component.
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
        let LazyWidget = null // Declare in function scope

        if (theWidget?.component) {
            // FIXED: Removed 'const' to avoid shadowing and update the outer variable
            LazyWidget = this.registry.getLazyComponent(theWidget.component)

            if (!LazyWidget) {
                console.error(`[WidgetDynamicRenderer] Resolution failed for: ${theWidget.component}`)
                return null
            }
        }

        // Registering in the local memory cache
        __.ui.widgetCache.set(widgetId, {
            group,
            component:    LazyWidget,
            widgetsBoard: props.widgetsBoard,
        })

        // Update the Valtio proxy store
        $widget.list.set(widgetId, props)

        return LazyWidget ?? widgetId
    }

    /**
     * Destroys and removes a specific widget instance.
     */
    destroyWidget(widgetId) {
        lgs.stores.ui.widget.list.delete(widgetId)
        __.ui.widgetCache.delete(widgetId)
        return true
    }
}