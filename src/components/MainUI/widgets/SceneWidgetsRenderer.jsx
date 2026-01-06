/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneWidgetsRenderer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { SCENE_WIDGETS_BOARD } from '@Core/constants'
import React, { useMemo } from 'react' // <--- Ajout de useMemo
import { useSnapshot }   from 'valtio'

/**
 * Renders all global widgets (widgets with global: true).
 * These widgets are displayed outside of any Cropper container.
 */
export const SceneWidgetsRenderer = () => {
    const $widget = lgs.stores.ui.widget
    const {list} = useSnapshot($widget)

    const sceneWidgets = useMemo(() => {
        return Array.from(list.entries()).filter(([key, props]) => props?.widgetsBoard === SCENE_WIDGETS_BOARD)
    }, [list])

    return (
        <>
            {sceneWidgets.map(([key, props]) => (
                <DynamicWidget key={key} id={key} props={props}/>
            ))}
        </>
    )
}