/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-13
 * Last modified: 2025-12-13
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
            return aliasPath.replace('@Core', '/src/core')
        }
        if (aliasPath.startsWith('@Components')) {
            return aliasPath.replace('@Components', '/src/components')
        }
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
        const canAddWidget = !__.ui.widgetManager.isMaxWidgetsReached(group, key)

        if (!__.ui.widgetCache.has(theId) && canAddWidget) {
            if (theWidget?.component) {
                const resolvedPath = this.resolveAliasPath(theWidget?.path ?? DEFAULT_WIDGETS_LIST)
                const componentPath = `${resolvedPath}/${theWidget.component}.jsx`

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
                                                    throw new Error(`Component ${theWidget.component} not found in ${componentPath}. Available exports: ${Object.keys(module).join(', ')}`)
                                                })
                                                .catch(error => {
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