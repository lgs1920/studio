/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DynamicWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-09
 * Last modified: 2026-03-09
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
        if (!LazyWidget) {
            ensureWidget(id).then(setLazyWidget)
        }
    }, [id])

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

async function ensureWidget(id) {
    const cache = __.ui.widgetCache.get(id)
    if (cache?.component) {
        return cache.component
    }

    const renderer = new WidgetDynamicRenderer()
    const entity = lgs.stores.ui.widget.list.get(id)
    const widgetsBoard = entity?.widgetsBoard
    const forceRefresh = true
    const LazyWidget = await renderer.renderWidget(cache.group, id, {widgetsBoard, forceRefresh, zIndex: entity.zIndex})
    if (LazyWidget) {
        __.ui.widgetCache.set(id, {
                                  component: LazyWidget,
                                  group:     cache.group,
                                  mounted:   cache.mounted,
                                  widgetsBoard,
            zIndex: entity.zIndex,
                              },
        )
    }
    return LazyWidget
}
