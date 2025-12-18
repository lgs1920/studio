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
     * Checks if a widget can be rendered based on cache and limits
     * @param {string} group - Group ID
     * @param {string} key - Widget base key
     * @param {Object} props - Widget props containing widgetsBoard and forceRefresh
     * @returns {{canRender: boolean, widgetId: string|null, existingInList: string|null}}
     */
    canRenderWidget = (group, key, props = {}) => {
        const $widget = lgs.stores.ui.widget
        const {widgetsBoard, forceRefresh} = props

        const existingInCache = __.ui.widgetCache.has(key, {group, full: false, widgetsBoard})
        const existingInList = Array.from($widget.list.keys()).find(id => id.startsWith(key))

        // 1. If widget does not exist in list, we try to create it (ignoring forceRefresh)
        if (!existingInList) {
            const isMaxReached = __.ui.widgetManager.isMaxWidgetsReached(group, key)

            if (!isMaxReached) {
                const widgetId = __.ui.widgetManager.defineElementId(group, key)
                return {canRender: true, widgetId, existingInList: null}
            }

            // Quota reached, cannot create
            return {canRender: false, widgetId: null, existingInList: null}
        }

        // 2. If it exists, we only allow rendering if forceRefresh is explicitly true and it's in cache
        if (forceRefresh && existingInCache) {
            return {canRender: true, widgetId: existingInList, existingInList}
        }

        // Default: Already exists and no refresh requested
        return {canRender: false, widgetId: null, existingInList}
    }

    /**
     * Loads and registers a widget component
     * @param {string} group - Group ID
     * @param {string} key - Widget base key
     * @param {Object} [props={}] - Widget props
     * @returns {Promise<any|string|null>}
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
            console.warn(`Group "${group}" not found in widget registry`)
            return null
        }

        const theWidget = theGroups.widgets.get(key.split('#')[0])
        let LazyWidget = null

        if (theWidget?.component) {
            const resolvedPath = this.resolveAliasPath(theWidget.path ?? DEFAULT_WIDGETS_LIST)
            const componentPath = `${resolvedPath}/${theWidget.component}.jsx`

            LazyWidget = lazy(() =>
                                  import(/* @vite-ignore */ componentPath)
                                      .then(module => {
                                          if (module.default) {
                                              return module
                                          }
                                          if (module[theWidget.component]) {
                                              return {default: module[theWidget.component]}
                                          }
                                          throw new Error(`Component ${theWidget.component} missing in ${componentPath}`)
                                      })
                                      .catch(error => {
                                          __.ui.widgetCache.delete(widgetId)
                                          $widget.list.delete(widgetId)
                                          console.error(`Failed to load widget: ${theWidget.component}`, error)
                                          throw error
                                      }),
            )
        }

        __.ui.widgetCache.set(widgetId, {
            group,
            component:    LazyWidget,
            widgetsBoard: props.widgetsBoard,
        })

        $widget.list.set(widgetId, props)

        return LazyWidget ?? widgetId
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