/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropRatioEditorWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-26
 * Last modified: 2025-09-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { CropRatioEditorToolbar } from '@Components/ToolsUI/cropper/CropRatioEditorToolbar'
import React, { useMemo }         from 'react'
import { DraggableUIWidget }      from '@Components/MainUI/DraggableUIWidget'
import { useSnapshot }            from 'valtio'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const CropRatioEditorWidget = ({manager}) => {

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const config = useMemo(() => {
        const myConfig = {
            left:     __.device.isMobile && __.device.isPortrait ? '85%' : '70%',
            top:      '50%',
            attachTo: 'right',
            opacity:  lgs.settings.ui.toolbars.opacity,
        }
        return myConfig
    }, [])

    return (
        <DraggableUIWidget isVisible={video.cropper.ratioEditor} config={config}>
            <CropRatioEditorToolbar manager={manager}/>
        </DraggableUIWidget>
    )
}