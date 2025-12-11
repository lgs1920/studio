/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-11
 * Last modified: 2025-12-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DEFAULT_WIDGETS_LIST } from '@Core/constants'
import { lazy }                 from 'react'

/**
 * Singleton class responsible for dynamically rendering and managing widgets.
 * It handles checking max instance limits, loading components lazily,
 * and registering/adding widgets to the store and cache.
 */
export class WidgetDynamicRenderer {
    /** * Private static field to hold the single instance of the class (Singleton pattern).
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
     * Resolves a Vite alias path (e.g., @Core/ui/widget-manager) into a relative path
     * that can be understood by the application's runtime or the bundler.
     *
     * IMPORTANT: This uses hardcoded prefixes corresponding to the Vite configuration.
     *
     * @param {string} aliasPath - The path string containing a Vite alias.
     * @returns {string} The resolved relative path string.
     */
    resolveAliasPath(aliasPath) {
        if (aliasPath.startsWith('@Core')) {
            // Replaces '@Core' with the expected path from the project root 'src/core'
            // Assumes the application entry point is at the project root level
            return aliasPath.replace('@Core', '/src/core')
        }
        if (aliasPath.startsWith('@Components')) {
            return aliasPath.replace('@Components', '/src/components')
        }
        if (aliasPath.startsWith('@Utils')) {
            return aliasPath.replace('@Utils', '/src/Utils')
        }
        // Add other aliases (like @Editor, @Stores, @Locales) as needed
        // If no alias is matched, return the path as is (assuming it's relative or static)
        return aliasPath
    }


    /**
     * Filters and returns only valid groups from the global registry
     * @param {Iterable<string>} groups - Group IDs to check
     * @returns {Map<string, Object>} A map of valid group IDs to their definitions
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
     * Checks if a widget has reached its maximum allowed instances.
     *
     * @param {string} groupKey - Group ID.
     * @param {string} widgetKey - Widget ID (can include instance suffix, e.g., 'myWidget#1').
     * @returns {boolean} True if the max is reached, false otherwise.
     */
    isMaxReached(groupKey, widgetKey) {
        const $widget = lgs.stores.ui.widget
        const group = __.widgets.get(groupKey)
        const baseKey = widgetKey.split('#')[0]
        const widgetDef = group?.widgets?.get(baseKey)

        // Count instances of the base widget key currently in the store
        const count = [...$widget.list.keys()]
            .map(k => k.split('#')[0])
            .filter(k => k === baseKey).length

        const max = widgetDef?.max ?? 1
        return count >= max
    }

    /**
     * Loads and registers a widget component, then adds it to the list
     * of active widgets if allowed (i.e., max instances not reached).
     *
     * @param {string} group - Group ID.
     * @param {string} id - Widget ID (base key or full key with instance suffix).
     * @param {Object} [extraProps={}] - Optional props to pass to the widget instance.
     * @returns {Promise<void>}
     */
    async renderWidget(group, id, extraProps = {}) {
        const $widget = lgs.stores.ui.widget
        const groupsMap = this.theGroups([group])

        if (!groupsMap.has(group)) {
            return
        }

        const key = id.split('#')[0]
        const theGroups = groupsMap.get(group)
        const theWidget = theGroups.widgets.get(key)

        // Generate a unique ID for the instance if the provided ID is the base key
        const theId = (key === id) ? __.ui.widgetManager.defineElementId(group, key) : id

        // Check if we can add a new instance
        const count = [...$widget.list.keys()]
            .map(k => k.split('#')[0])
            .filter(k => k === key).length

        const max = theWidget?.max ?? 1
        const canAddWidget = count < max

        if (!__.ui.widgetCache.has(theId) && canAddWidget) {
            if (theWidget?.component) {
                // 1. Resolve the alias path provided in the widget definition
                const resolvedPath = this.resolveAliasPath(theWidget?.path ?? DEFAULT_WIDGETS_LIST)

                // 2. Construct the final path using the resolved string
                const componentPath = `${resolvedPath}/${theWidget.component}.jsx`

                // Lazily load the component file
                const LazyWidget = lazy(() =>
                                            // Use @vite-ignore to tell Vite not to try to statically bundle this
                                            // import, relying on the web server to resolve the resolved path
                                            // (/src/...) at runtime.
                                            import(/* @vite-ignore */ componentPath)
                                                .then(module => {
                                                    if (module.default) {
                                                        return module
                                                    }
                                                    if (module[theWidget.component]) {
                                                        return {default: module[theWidget.component]}
                                                    }
                                                    throw new Error(`Component ${theWidget.component} not found in ${componentPath}`)
                                                })
                                                .catch(error => {
                                                    // Log the error for debugging
                                                    console.error(`Failed to load widget component: ${theWidget.component} from ${componentPath}`, error)
                                                    throw error
                                                }),
                )

                // Cache the component and add the widget instance to the store list
                __.ui.widgetCache.set(theId, group, LazyWidget)
                $widget.list.set(theId, extraProps)
            }
        }
    }
}