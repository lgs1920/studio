/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DynamicWidget.jsx
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

import { SlSpinner } from '@shoelace-style/shoelace/dist/react'
import { Suspense } from 'react'

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
    /**
     * Retrieve the lazy-loaded component from the global widget cache.
     * Cache entry expected format: { component: React.LazyExoticComponent<React.ComponentType<any>> }
     */
    const LazyWidget = __.ui.widgetCache.get(id)?.component

    // Widget not found in registry → render nothing to avoid unnecessary DOM nodes
    if (!LazyWidget) {
        return false
    }

    // Explicit component reference for clarity and potential future debugging/hooks
    const Component = LazyWidget

    // Merge context from both sources: props passed to DynamicWidget and props from store
    const finalContext = context || props

    return (
        <Suspense fallback={<SlSpinner style={{fontSize: '2rem'}}/>}>
            <Component id={id} {...props} context={finalContext}/>
        </Suspense>
    )
}