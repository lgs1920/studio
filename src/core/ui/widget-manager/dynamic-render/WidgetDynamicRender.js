/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-16
 * Last modified: 2025-12-16
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DEFAULT_WIDGETS_LIST, WIDGETS_STORE } from '@Core/constants'
import { lazy }                                from 'react'

/**
 * Singleton class responsible for dynamically rendering and managing widgets.
 * It handles checking max instance limits, loading components lazily,
 * and registering/adding/removing widgets from the store and cache.
 */
export class WidgetDynamicRenderer {
    /** Private static field to hold the single instance of the class (Singleton pattern).
     * @type {WidgetDynamicRenderer}
     * */
    static #instance

    /**
     * @type {Map<string, Object>} Internal map to store references to active widgets or their configurations
     * which are currently rendered or managed, keyed by the full widget ID.
     */
    #activeInstances = new Map()

    /**
     * Private constructor to enforce the singleton pattern.
     */
    constructor() {
        if (WidgetDynamicRenderer.#instance) {
            // eslint-disable-next-line no-constructor-return
            return WidgetDynamicRenderer.#instance
        }
        WidgetDynamicRenderer.#instance = this
    }

    /**
     * Gets the singleton instance of WidgetDynamicRenderer.
     * @returns {WidgetDynamicRenderer}
     */
    static get instance() {
        if (!WidgetDynamicRenderer.#instance) {
            WidgetDynamicRenderer.#instance = new WidgetDynamicRenderer()
        }
        return WidgetDynamicRenderer.#instance
    }

    /**
     * Resets the internal state of the Singleton, effectively clearing all tracked active widget data.
     */
    reset() {
        this.#activeInstances.clear()
        // Note: The caller must ensure that the cache (__.ui.widgetCache) and the store ($widget.list)
        // are also cleared externally if a full system reset is required.
    }

    /**
     * Resolves a Vite alias path (e.g., @Core/ui/widget-manager) into a relative path
     * that can be understood by the application's runtime or the bundler.
     *
     * @param {string} aliasPath - The path string containing a Vite alias.
     * @returns {string} The resolved relative path string.
     */
    resolveAliasPath(aliasPath) {
        if (aliasPath.startsWith('@Core')) {
            return aliasPath.replace('@Core', '/src/core')
        }
        if (aliasPath.startsWith('@Components')) {
            return aliasPath.replace('@Components', '/src/components')
        }
        return aliasPath
    }


    /**
     * Filters and returns only valid widget groups from the global registry.
     * @param {Iterable<string>} groups - Group IDs to check.
     * @returns {Map<string, Object>} A map of valid group IDs to their definitions.
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
     * Loads and registers a widget component, then adds it to the list
     * of active widgets if allowed (i.e., max instances not reached).
     *
     * @param {string} group - Group ID (e.g., SCENE_WIDGETS).
     * @param {string} key - Widget base key (e.g., 'profile-widget').
     * @param {Object} [props={}] - Optional props to pass to the widget instance (must include widgetsBoard).
     * @returns {Promise<void>}
     */
    async renderWidget(group, key, props = {}) {
        const $widget = lgs.stores.ui.widget
        const {widgetsBoard} = props
        console.log(widgetsBoard, 'widgetsBoard')

        // 1. Determine final ID and check max instance limit
        const groupsMap = this.theGroups([group])
        if (!groupsMap.has(group)) {
            console.error(`Group "${group}" not found in widget registry`)
            return
        }

        const theGroups = groupsMap.get(group)
        const theWidget = theGroups.widgets.get(key)

        // Check if widget with this base key already exists by checking BOTH cache AND store list
        // The store list ($widget.list) is the source of truth for currently rendered widgets
        // The cache may contain widgets that are not currently rendered
        const existingInList = Array.from($widget.list.keys()).find(id => id.startsWith(key))
        const existingInCache = __.ui.widgetCache.has(key, {group: group, full: false})

        // Widget exists if it's in the list (rendered) OR in cache with matching group
        const alreadyExists = existingInList || existingInCache
        const canAddWidget = !__.ui.widgetManager.isMaxWidgetsReached(group, key)

        // If widget already exists in cache/store or cannot be added, we skip creation.
        // We only proceed if it is not already cached AND we can add it (max instances not reached).
        if (!alreadyExists && canAddWidget) {
            // Determine the full unique ID for caching and store management
            const widgetId = __.ui.widgetManager.defineElementId(group, key)

            // Check if component path is defined
            if (theWidget?.component) {
                const resolvedPath = this.resolveAliasPath(theWidget?.path ?? DEFAULT_WIDGETS_LIST)
                const componentPath = `${resolvedPath}/${theWidget.component}.jsx`
                const LazyWidget = lazy(() =>
                                            // Use @vite-ignore to tell Vite not to try to statically bundle this
                                            // import, relying on the web server to resolve the path at runtime.
                                            import(/* @vite-ignore */ componentPath)
                                                .then(module => {
                                                    if (module.default) {
                                                        return module
                                                    }
                                                    if (module[theWidget.component]) {
                                                        return {default: module[theWidget.component]}
                                                    }
                                                    throw new Error(`Component ${theWidget.component} not found in ${componentPath}. Available exports: ${Object.keys(module).join(', ')}`)
                                                })
                                                .catch(error => {
                                                    // On failure, remove the potential entry from the cache and store
                                                    __.ui.widgetCache.delete(widgetId)
                                                    $widget.list.delete(widgetId)
                                                    console.error(`Failed to load widget component: ${theWidget.component} from ${componentPath}`, error)
                                                    throw error
                                                }),
                )
                // Cache the component and add the widget instance to the store list
                __.ui.widgetCache.set(widgetId, group, LazyWidget)
                $widget.list.set(widgetId, props)
                // Register the instance in the renderer's internal map
                this.#activeInstances.set(widgetId, {group, key, props})
            }

            return widgetId
        }

        return null
    }

    /**
     * Destroys and removes a specific widget instance, cleaning up all internal references
     * from the cache and the main store list.
     *
     * @param {string} widgetId - The unique ID of the widget instance to destroy (e.g., 'profile-widget-xyz').
     * @returns {boolean} True if the widget was successfully destroyed and removed, false otherwise.
     */
    destroyWidget(widgetId) {
        const $widget = lgs.stores.ui.widget

        if (this.#activeInstances.has(widgetId)) {
            this.#activeInstances.delete(widgetId)
            $widget.list.delete(widgetId)
            __.ui.widgetCache.delete(widgetId)
            return true
        }
        console.warn(`Attempted to destroy non-existent widget instance: ${widgetId}`)
        return false
    }

    /**
     * Restores nd renders persisted widgets from IndexedDB by recreating them with their components
     *
     */
    async renderFromDB() {
        try {
            const keys = await lgs.db.lgs1920.keys(WIDGETS_STORE)

            for (const widgetId of keys) {
                const widgetData = await lgs.db.lgs1920.get(widgetId, WIDGETS_STORE)
                if (!widgetData || !widgetData.group) {
                    continue
                }

                // Extract base key (before #)
                const baseKey = widgetId.split('#')[0]

                // Don't restore if already exists (shouldn't happen, but safety check)
                if (__.ui.widgetCache.has(widgetId, {
                    group:        widgetData.group,
                    widgetsBoard: widgetData.widgetsBoard || 'scene',
                })) {
                    continue
                }

                // This will load the lazy component and add to cache
                await this.renderWidget(widgetData.group, baseKey, {
                    widgetsBoard: widgetData.widgetsBoard || 'scene', // Default board
                })
            }
        }
        catch (error) {
            console.error('Failed to restore persisted widgets:', error)
        }
    }
}