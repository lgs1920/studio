/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
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

import { WidgetRegistry } from '@Core/ui/widget-manager/registry/WidgetRegistry'

/**
 * Singleton class responsible for dynamically rendering and managing widgets.
 * Optimized to prevent "ghosting" and display delays.
 */
export class WidgetDynamicRenderer {
    /** @type {WidgetDynamicRenderer} */
    static #instance
    registry = new WidgetRegistry()

    // Memory cache for pre-resolved components
    #resolvedComponents = new Map()

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

    /**
     * Pre-loads a widget component to ensure immediate display on first render.
     */
    async preloadWidget(group, key) {
        const groupsMap = this.theGroups([group])
        const theGroups = groupsMap.get(group)
        const theWidget = theGroups?.widgets.get(key.split('#')[0])

        if (theWidget?.component && !this.#resolvedComponents.has(theWidget.component)) {
            const component = await this.registry.getLazyComponent(theWidget.component)
            this.#resolvedComponents.set(theWidget.component, component)
            return component
        }
        return this.#resolvedComponents.get(theWidget?.component)
    }

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
     * Checks if a widget can be rendered.
     */
    canRenderWidget = (group, key, props = {}) => {
        const {widgetsBoard, forceRefresh} = props

        const isMaxReached = __.ui.widgetManager.isMaxWidgetsReached(group, key, widgetsBoard)
        const existingInList = this.findExistingInList(key, widgetsBoard)
        const existingInCache = __.ui.widgetCache.has(key, {group, full: false, widgetsBoard})

        if (!isMaxReached) {
            const widgetId = __.ui.widgetManager.defineElementId(group, key)
            return {canRender: true, widgetId, existingInList: null}
        }

        if (existingInList && forceRefresh && existingInCache) {
            return {canRender: true, widgetId: existingInList, existingInList}
        }

        return {canRender: false, widgetId: null, existingInList}
    }

    /**
     * Renders a widget. Ensures resolution is complete before store injection.
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
            return null
        }

        const theWidget = theGroups.widgets.get(key.split('#')[0])
        let ResolvedComponent = null

        if (theWidget?.component) {
            // CRITICAL: We wait for the component to be fully loaded into memory
            // This prevents React from seeing an 'undefined' component during the first render
            ResolvedComponent = await this.preloadWidget(group, key)
        }

        return new Promise((resolve) => {
            const commitUpdate = () => {
                // Registering in cache with the resolved reference
                __.ui.widgetCache.set(widgetId, {
                    group,
                    component:    ResolvedComponent,
                    widgetsBoard: props.widgetsBoard,
                    zIndex: props.zIndex,
                })

                // Only update the Valtio store once everything is ready in cache
                $widget.list.set(widgetId, props)

                resolve(ResolvedComponent ?? widgetId)
            }

            // High priority for the first render to avoid visual delay
            const isNew = !$widget.list.has(widgetId)

            if (isNew) {
                // Immediate execution for new widgets
                commitUpdate()
            }
            else {
                // Schedule updates to keep the main thread fluid
                if (window.requestIdleCallback) {
                    window.requestIdleCallback(() => commitUpdate(), {timeout: 100})
                }
                else {
                    setTimeout(commitUpdate, 0)
                }
            }
        })
    }

    findExistingInList(key, widgetsBoard) {
        const $list = lgs.stores.ui.widget.list
        return Array.from($list.keys()).find(id => {
            const entry = $list.get(id)
            return id.startsWith(key) && entry?.widgetsBoard === widgetsBoard
        }) || null
    }

    /**
     * Properly removes a widget from store and cache.
     */
    destroyWidget(widgetId) {
        const $widget = lgs.stores.ui.widget
        $widget.list.delete(widgetId)
        __.ui.widgetCache.delete(widgetId)
        return true
    }
}