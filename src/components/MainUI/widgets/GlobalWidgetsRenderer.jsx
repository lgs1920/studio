/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: GlobalWidgetsRenderer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-14
 * Last modified: 2025-12-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { SCENE_WIDGETS_BOARD } from '@Core/constants'
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
                .filter(([key, props]) => props?.widgetsBoard === SCENE_WIDGETS_BOARD)
                .map(([key, props]) => (
                    <DynamicWidget key={key} id={key} props={props}/>
                ))}
        </>
    )
}
