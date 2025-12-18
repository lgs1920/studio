/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
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

import { DEFAULT_WIDGETS_LIST } from '@Core/constants'
import { lazy }                 from 'react'

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
        const {widgetsBoard, recreate} = props

        // 1. Determine final ID and check max instance limit
        const groupsMap = this.theGroups([group])
        if (!groupsMap.has(group)) {
            console.warn(`Group "${group}" not found in widget registry`)
            return
        }

        const theGroups = groupsMap.get(group)
        const theWidget = theGroups.widgets.get(key.split('#')[0])

        // Check if widget with this base key already exists by checking BOTH cache AND store list
        // The store list ($widget.list) is the source of truth for currently rendered widgets
        // The cache may contain widgets that are not currently rendered
        const existingInCache = __.ui.widgetCache.has(key, {group: group, full: false, widgetsBoard})
        const existingInList = Array.from($widget.list.keys()).find(id => id.startsWith(key))

        // Widget exists if it's in the list (rendered) OR in cache with matching group
        const alreadyExists = existingInList || existingInCache


        if (!alreadyExists || recreate) {
            const canAddWidget = !__.ui.widgetManager.isMaxWidgetsReached(group, key)
            if (!canAddWidget && !recreate) {
                return null
            }

            const widgetId = recreate ? (existingInList ?? key) : __.ui.widgetManager.defineElementId(group, key)
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
                __.ui.widgetCache.set(widgetId, {
                    group,
                    component:    LazyWidget,
                    widgetsBoard: props.widgetsBoard,
                })
                $widget.list.set(widgetId, props)
                // Register the instance in the renderer's internal map
                return LazyWidget
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
        lgs.stores.ui.widget.list.delete(widgetId)
        __.ui.widgetCache.delete(widgetId)
        return true
    }
}