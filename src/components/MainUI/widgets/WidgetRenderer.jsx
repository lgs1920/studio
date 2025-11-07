/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetRenderer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-07
 * Last modified: 2025-11-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * @file WidgetRenderer – rendu simple et fiable.
 */
import { SlSpinner } from '@shoelace-style/shoelace/dist/react'
import { Suspense }  from 'react'

export const WidgetRenderer = ({id, context, props = {}}) => {
    const LazyWidget = __.ui.widgetCache?.get(id)


    if (!LazyWidget) {
        console.error(`[WidgetRenderer] Widget "${id}" not found in cache`)
    }

    // Extract the component properly
    const Component = LazyWidget

    return (
        <Suspense fallback={<SlSpinner style={{fontSize: '2rem'}}/>}>
            <Component id={id} {...props} context={context}/>
        </Suspense>
    )
}