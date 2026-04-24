/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SceneWidgetsRenderer.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { DynamicWidget } from '@Components/MainUI/widgets/DynamicWidget'
import { SCENE_WIDGETS_BOARD } from '@Core/constants'
import { useMemo } from 'react'
import { useSnapshot }   from 'valtio'

/**
 * Renders all global widgets (widgets with global: true).
 * These widgets are displayed outside of any Cropper container.
 */
export const SceneWidgetsRenderer = () => {
    const $widget = lgs.stores.ui.widget
    const $video = lgs.stores.ui.video
    const {list} = useSnapshot($widget)
    const video = useSnapshot($video)

    const isVideoSceneActive = video.editing || video.preRecording || video.recording || video.snapshot || video.finalizing

    const sceneWidgets = useMemo(() => {
        return Array.from(list.entries()).filter(([, props]) => props?.widgetsBoard === SCENE_WIDGETS_BOARD)
    }, [list])

    if (isVideoSceneActive) {
        return null
    }

    return (
        <>
            {sceneWidgets.map(([key, props]) => (
                <DynamicWidget key={key} id={key} props={props}/>
            ))}
        </>
    )
}
