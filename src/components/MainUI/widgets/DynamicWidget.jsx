/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DynamicWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WidgetDynamicRenderer }         from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { WaSpinner } from '@web.awesome.me/webawesome-pro/dist/react'
import { Suspense, useEffect, useState } from 'react'

/**
 * Resolves the concrete widget instance associated with a requested widget key.
 *
 * @param {string} id - Requested base or concrete widget identifier.
 * @param {string|null} widgetsBoard - Optional widget board filter.
 * @returns {string} Concrete widget identifier when one exists.
 */
const resolveWidgetInstanceId = (id, widgetsBoard = null) => {
    const widgetList = lgs.stores.ui.widget.list
    const exactEntry = widgetList.get(id)
    if (exactEntry && (!widgetsBoard || exactEntry.widgetsBoard === widgetsBoard)) {
        return id
    }

    return Array.from(widgetList.entries()).find(([widgetId, entry]) => {
        return widgetId.startsWith(`${id}#`) && (!widgetsBoard || entry?.widgetsBoard === widgetsBoard)
    })?.[0] ?? id
}

/**
 * Dynamically renders a registered widget using React Suspense for lazy loading.
 * Displays a spinner during load and returns false if the widget is not found in cache.
 *
 * @param {Object} props
 * @param {string} props.id - Unique widget identifier (key in __.ui.widgetCache)
 * @param {Object} [props.context] - Contextual data passed down to the widget
 * @param {Object} [props.props={}] - Additional props forwarded to the widget
 * @returns {JSX.Element|null} Suspense-wrapped widget or null if not registered
 */
export const DynamicWidget = ({id, context, props = {}}) => {
    const [widgetState, setWidgetState] = useState(() => ({
        component: __.ui.widgetCache.get(id)?.component ?? null,
        widgetId:  resolveWidgetInstanceId(id, props.widgetsBoard),
    }))
    const LazyWidget = widgetState.component

    useEffect(() => {
        let cancelled = false

        if (!LazyWidget) {
            ensureWidget(id, props)
                .then(result => {
                    if (!cancelled) {
                        setWidgetState(result)
                    }
                })
                .catch(error => {
                    if (!cancelled) {
                        console.error(`[DynamicWidget] Failed to render widget "${id}":`, error)
                        setWidgetState({component: null, widgetId: id})
                    }
                })
        }

        return () => {
            cancelled = true
        }
    }, [id, LazyWidget, props])

    if (!LazyWidget) {
        return null
    }

    // Explicit component reference for clarity and potential future debugging/hooks
    const Component = LazyWidget

    return (
        <Suspense fallback={<WaSpinner style={{fontSize: '2rem'}}/>}>
            <Component id={widgetState.widgetId} {...props} context={context || props}/>
        </Suspense>
    )
}

/**
 * Loads a widget component and returns the concrete instance identifier selected by the renderer.
 *
 * @param {string} id - Requested widget identifier.
 * @param {Object} props - Widget rendering properties.
 * @returns {Promise<{component: Function|null, widgetId: string}>} Loaded widget state.
 */
async function ensureWidget(id, props = {}) {
    const cache = __.ui.widgetCache.get(id)
    if (cache?.component) {
        return {
            component: cache.component,
            widgetId:  resolveWidgetInstanceId(id, props.widgetsBoard),
        }
    }

    const entity = lgs.stores.ui.widget.list.get(id) ?? {}
    const group = cache?.group ?? entity.group ?? props.group
    if (!group) {
        // Some imperative widgets own their DOM through a regular Widget host
        // and only appear in the reactive list for selection or positioning.
        // They are not entries in the dynamic widget catalog.
        return {component: null, widgetId: id}
    }

    const renderer = WidgetDynamicRenderer.instance
    const widgetsBoard = entity.widgetsBoard ?? props.widgetsBoard ?? cache?.widgetsBoard
    const zIndex = entity.zIndex ?? props.zIndex ?? cache?.zIndex
    const LazyWidget = await renderer.renderWidget(group, id, {widgetsBoard, forceRefresh: true, zIndex})
    if (LazyWidget) {
        const widgetId = resolveWidgetInstanceId(id, widgetsBoard)
        __.ui.widgetCache.set(widgetId, {
            component: LazyWidget,
            group,
            mounted: cache?.mounted,
            widgetsBoard,
            zIndex,
        })
        return {component: LazyWidget, widgetId}
    }

    return {component: null, widgetId: id}
}
