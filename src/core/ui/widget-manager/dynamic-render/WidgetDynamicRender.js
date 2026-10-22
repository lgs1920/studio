/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDynamicRender.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-12-11
 * Last modified: 2026-10-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WIDGET_LAYER_START } from '@Core/constants'
import { isWidgetAvailable } from '@Core/ui/widget-manager/widgetAvailability'
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
    #pendingInstanceReservations = new Map()

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

    /**
     * Resolve the shared reservation key for a widget type on one board.
     * @param {string} widgetId - Catalog widget ID or concrete instance ID.
     * @param {string|null|undefined} widgetsBoard - Target widget board.
     * @returns {string} Reservation key shared across catalog groups.
     */
    #instanceReservationKey = (widgetId, widgetsBoard) => `${this.#getBaseKey(widgetId)}:${widgetsBoard ?? ''}`

    /**
     * Count widget creations that have passed admission but are not registered yet.
     * @param {string} widgetId - Catalog widget ID or concrete instance ID.
     * @param {string|null|undefined} widgetsBoard - Target widget board.
     * @returns {number} Number of active reservations.
     */
    #pendingInstanceCount = (widgetId, widgetsBoard) => (
        this.#pendingInstanceReservations.get(this.#instanceReservationKey(widgetId, widgetsBoard)) ?? 0
    )

    /**
     * Reserve one instance slot while its component is loading.
     * @param {string} widgetId - Catalog widget ID or concrete instance ID.
     * @param {string|null|undefined} widgetsBoard - Target widget board.
     * @returns {string} Reservation key to release after registration.
     */
    #reserveWidgetInstance = (widgetId, widgetsBoard) => {
        const key = this.#instanceReservationKey(widgetId, widgetsBoard)
        this.#pendingInstanceReservations.set(key, this.#pendingInstanceCount(widgetId, widgetsBoard) + 1)
        return key
    }

    /**
     * Release a pending widget instance slot.
     * @param {string} reservationKey - Reservation key returned by the reserve method.
     */
    #releaseWidgetInstance = reservationKey => {
        const count = this.#pendingInstanceReservations.get(reservationKey) ?? 0
        if (count <= 1) {
            this.#pendingInstanceReservations.delete(reservationKey)
            return
        }
        this.#pendingInstanceReservations.set(reservationKey, count - 1)
    }

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
        const widgetDef = __.widgets.get(group)?.widgets?.get(baseKey)

        if (!isWidgetAvailable(widgetDef, {widgetsBoard})) {
            return {canRender: false, widgetId: null, existingInList: null}
        }

        const existingInList = this.findExistingInList(lookupKey, widgetsBoard)
        if (existingInList && forceRefresh) {
            return {canRender: true, widgetId: existingInList, existingInList}
        }

        const widgetManager = __.ui.widgetManager
        const isMaxReached = widgetManager.isMaxWidgetsReached(group, baseKey, widgetsBoard)
        const remainingSlots = widgetManager.remainingWidgets?.(group, baseKey, widgetsBoard)
        const pendingMaxReached = Number.isFinite(remainingSlots)
            && this.#pendingInstanceCount(baseKey, widgetsBoard) >= remainingSlots

        if (!isConcreteInstance && this.#isSingletonWidget(group, baseKey) && existingInList) {
            return {canRender: false, widgetId: null, existingInList}
        }

        if (!isMaxReached && !pendingMaxReached) {
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

        const admission = this.canRenderWidget(group, key, props)
        if (!admission.canRender) {
            return null
        }
        const reservationKey = admission.existingInList
            ? null
            : this.#reserveWidgetInstance(admission.widgetId, props.widgetsBoard)
        const renderPromise = this.#renderWidget(group, key, props, admission)

        if (!pendingRenderKey) {
            try {
                return await renderPromise
            }
            finally {
                if (reservationKey) {
                    this.#releaseWidgetInstance(reservationKey)
                }
            }
        }

        this.#pendingRenders.set(pendingRenderKey, renderPromise)

        try {
            return await renderPromise
        }
        finally {
            if (reservationKey) {
                this.#releaseWidgetInstance(reservationKey)
            }
            if (this.#pendingRenders.get(pendingRenderKey) === renderPromise) {
                this.#pendingRenders.delete(pendingRenderKey)
            }
        }
    }

    async #renderWidget(group, key, props = {}, admission = {}) {
        const $widget = lgs.stores.ui.widget

        const {canRender, widgetId} = admission
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
                const currentEntry = $widget.list.get(widgetId) ?? {}
                const cachedEntry = __.ui.widgetCache.get(widgetId)
                const zIndex = this.#resolveZIndex(props.zIndex ?? currentEntry.zIndex ?? cachedEntry?.zIndex)
                const widgetsBoard = props.widgetsBoard ?? currentEntry.widgetsBoard ?? cachedEntry?.widgetsBoard
                const sameRuntime = cachedEntry?.widgetsBoard === widgetsBoard

                // Refreshing registration must not revoke a live component's mount state.
                __.ui.widgetCache.set(widgetId, {
                    group,
                    widgetGroup:  props.widgetGroup ?? currentEntry.widgetGroup ?? null,
                    component:    ResolvedComponent,
                    mounted: sameRuntime && cachedEntry?.mounted === true,
                    widgetsBoard,
                    zIndex,
                })

                // Only update the Valtio store once everything is ready in cache
                const nextEntry = {
                    ...currentEntry,
                    ...props,
                    group,
                    widgetGroup: props.widgetGroup ?? currentEntry.widgetGroup ?? null,
                    widgetsBoard,
                    zIndex,
                }
                if (!$widget.list.has(widgetId)
                    || Object.keys(nextEntry).some(key => nextEntry[key] !== currentEntry[key])) {
                    $widget.list.set(widgetId, nextEntry)
                }

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
