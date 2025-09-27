/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualityWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-27
 * Last modified: 2025-09-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_TOOLBAR } from '@Core/constants'
import React, { useMemo }      from 'react'
import { DraggableUIWidget } from '@Components/MainUI/DraggableUIWidget'
import { useSnapshot } from 'valtio'
import { VideoQualityToolbar } from './VideoQualityToolbar'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const VideoQualityWidget = () => {

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const config = useMemo(() => {
        const myConfig = {
            left:           __.device.isMobile && __.device.isPortrait ? '15%' : '30%',
            top:            '50%',
            attachTo:       'left',
            opacity:        lgs.settings.ui.toolbars.opacity,
            type: LGS_TOOLBAR,
        }
        return myConfig
    }, [])

    return (
        <DraggableUIWidget isVisible={video.cropper.qualityEditor} config={config}>
            <VideoQualityToolbar/>
        </DraggableUIWidget>
    )
}