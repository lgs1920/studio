/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
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

import { WIDGET_LAYER_START } from '@Core/constants'
import { WidgetRegistry }     from '@Core/ui/widget-manager/registry/WidgetRegistry'

/**
 * Singleton class responsible for dynamically rendering and managing widgets.
 * Optimized to prevent "ghosting" and display delays.
 */
export class WidgetDynamicRenderer {
    /** @type {WidgetDynamicRenderer} */
    static #instance
    #registry = null

    // Memory cache for pre-resolved components
    #resolvedComponents = new Map()
    #pendingRenders = new Map()

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

    get registry() {
        if (!this.#registry) {
            this.#registry = new WidgetRegistry()
        }

        return this.#registry
    }

    set registry(registry) {
        this.#registry = registry
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

    #getBaseKey = key => key.split('#')[0]

    #resolveZIndex = value => Number(value) > 0 ? Number(value) : WIDGET_LAYER_START

    #isSingletonWidget(group, key) {
        return __.ui.widgetManager.maxWidgets(group, this.#getBaseKey(key)) === 1
    }

    #getPendingRenderKey(group, key, widgetsBoard) {
        if (!group || !key) {
            return null
        }

        if (this.#isSingletonWidget(group, key)) {
            return `${group}:${this.#getBaseKey(key)}:${widgetsBoard ?? ''}`
        }

        if (key.includes('#')) {
            return `${group}:${key}:${widgetsBoard ?? ''}`
        }

        return null
    }

    /**
     * Checks if a widget can be rendered.
     */
    canRenderWidget = (group, key, props = {}) => {
        const {widgetsBoard, forceRefresh} = props
        const baseKey = this.#getBaseKey(key)
        const isConcreteInstance = key.includes('#')
        const lookupKey = isConcreteInstance ? key : baseKey

        const isMaxReached = __.ui.widgetManager.isMaxWidgetsReached(group, baseKey, widgetsBoard)
        const existingInList = this.findExistingInList(lookupKey, widgetsBoard)
        if (existingInList && forceRefresh) {
            return {canRender: true, widgetId: existingInList, existingInList}
        }

        if (!isConcreteInstance && this.#isSingletonWidget(group, baseKey) && existingInList) {
            return {canRender: false, widgetId: null, existingInList}
        }

        if (!isMaxReached) {
            const widgetId = isConcreteInstance ? key : __.ui.widgetManager.defineElementId(group, baseKey)
            return {canRender: true, widgetId, existingInList: null}
        }

        return {canRender: false, widgetId: null, existingInList}
    }

    /**
     * Renders a widget. Ensures resolution is complete before store injection.
     */
    async renderWidget(group, key, props = {}) {
        const pendingRenderKey = this.#getPendingRenderKey(group, key, props.widgetsBoard)
        if (pendingRenderKey && this.#pendingRenders.has(pendingRenderKey)) {
            return this.#pendingRenders.get(pendingRenderKey)
        }

        const renderPromise = this.#renderWidget(group, key, props)

        if (!pendingRenderKey) {
            return renderPromise
        }

        this.#pendingRenders.set(pendingRenderKey, renderPromise)

        try {
            return await renderPromise
        }
        finally {
            if (this.#pendingRenders.get(pendingRenderKey) === renderPromise) {
                this.#pendingRenders.delete(pendingRenderKey)
            }
        }
    }

    async #renderWidget(group, key, props = {}) {
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
                const zIndex = this.#resolveZIndex(props.zIndex)

                // Registering in cache with the resolved reference
                __.ui.widgetCache.set(widgetId, {
                    group,
                    component:    ResolvedComponent,
                    widgetsBoard: props.widgetsBoard,
                    zIndex,
                })

                // Only update the Valtio store once everything is ready in cache
                $widget.list.set(widgetId, {
                    ...props,
                    group,
                    zIndex,
                })

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
