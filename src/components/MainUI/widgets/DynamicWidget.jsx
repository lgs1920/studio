/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DynamicWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-15
 * Last modified: 2025-11-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SlSpinner } from '@shoelace-style/shoelace/dist/react'
import { Suspense }  from 'react'

export const DynamicWidget = ({id, context, props = {}}) => {

    const LazyWidget = __.ui.widgetCache.get(id)

    if (!LazyWidget) {
        return false
    }

    // Extract the component properly
    const Component = LazyWidget

    return (
        <Suspense fallback={<SlSpinner style={{fontSize: '2rem'}}/>}>
            <Component id={id} {...props} context={context}/>
        </Suspense>
    )
}