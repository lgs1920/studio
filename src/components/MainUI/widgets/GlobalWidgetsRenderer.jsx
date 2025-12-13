/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GlobalWidgetsRenderer.jsx
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

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { useSnapshot }   from 'valtio'

/**
 * Renders all global widgets (widgets with global: true).
 * These widgets are displayed outside of any Cropper container.
 */
export const GlobalWidgetsRenderer = () => {
    const $widget = lgs.stores.ui.widget
    const {list} = useSnapshot($widget)

    return (
        <>
            {Array.from(list.entries())
                .filter(([key, props]) => props?.global)
                .map(([key, props]) => (
                    <DynamicWidget key={key} id={key} props={props}/>
                ))}
        </>
    )
}
