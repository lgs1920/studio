/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DynamicWidget.jsx
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

import { WidgetDynamicRenderer }         from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { WaSpinner } from '@web.awesome.me/webawesome-pro/dist/react'
import { Suspense, useEffect, useState } from 'react'


/**
 * Dynamically renders a registered widget using React Suspense for lazy loading.
 * Displays a spinner during load and returns false if the widget is not found in cache.
 *
 * @param {Object} props
 * @param {string} props.id - Unique widget identifier (key in __.ui.widgetCache)
 * @param {Object} [props.context] - Contextual data passed down to the widget
 * @param {Object} [props.props={}] - Additional props forwarded to the widget
 * @returns {JSX.Element|false} Suspense-wrapped widget or false if not registered
 */
export const DynamicWidget = ({id, context, props = {}}) => {
    const [LazyWidget, setLazyWidget] = useState(() => __.ui.widgetCache.get(id)?.component)

    useEffect(() => {
        let cancelled = false

        if (!LazyWidget) {
            ensureWidget(id, props)
                .then(widget => {
                    if (!cancelled) {
                        setLazyWidget(() => widget)
                    }
                })
                .catch(error => {
                    if (!cancelled) {
                        console.error(`[DynamicWidget] Failed to render widget "${id}":`, error)
                        setLazyWidget(null)
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
            <Component id={id} {...props} context={context || props}/>
        </Suspense>
    )
}

async function ensureWidget(id, props = {}) {
    const cache = __.ui.widgetCache.get(id)
    if (cache?.component) {
        return cache.component
    }

    const entity = lgs.stores.ui.widget.list.get(id) ?? {}
    const group = cache?.group ?? entity.group ?? props.group
    if (!group) {
        console.warn(`[DynamicWidget] Skipping widget "${id}" because cache metadata is missing.`)
        return null
    }

    const renderer = WidgetDynamicRenderer.instance
    const widgetsBoard = entity.widgetsBoard ?? props.widgetsBoard ?? cache?.widgetsBoard
    const zIndex = entity.zIndex ?? props.zIndex ?? cache?.zIndex
    const LazyWidget = await renderer.renderWidget(group, id, {widgetsBoard, forceRefresh: true, zIndex})
    if (LazyWidget) {
        __.ui.widgetCache.set(id, {
                                  component: LazyWidget,
            group,
            mounted: cache?.mounted,
                                  widgetsBoard,
            zIndex,
                              },
        )
    }
    return LazyWidget
}
