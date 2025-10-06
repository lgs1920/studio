/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-05
 * Last modified: 2025-10-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VideoRecorderToolbar }     from '@Components/MainUI/video/VideoRecorderToolbar'
import { VideoRecordingScreenArea } from '@Components/ToolsUI/cropper/VideoRecordingScreenArea'
import { LGS_TOOLBAR }              from '@Core/constants'
import React, { useMemo } from 'react'
import { Widget }         from '@Components/MainUI/Widget'
import { useSnapshot }    from 'valtio'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const VideoRecorderWidget = () => {

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const config = useMemo(() => {
        const myConfig = {
            left:     `${$video.position.left}px`,
            top:      `${$video.position.top}px`,
            attachTo: 'center',
            opacity:  lgs.settings.ui.toolbars.opacity,
            type:     LGS_TOOLBAR,
            // Use toolbar default when null/undefined; otherwise honor explicit boolean
            animationWhenDragging:
                $video.animationWhenDragging != null ? $video.animationWhenDragging : undefined,
        }
        return myConfig
    }, [])

    return (
        <>
            <VideoRecordingScreenArea/>
            <Widget isVisible={true} config={config}>
                <VideoRecorderToolbar/>
            </Widget>
        </>
    )
}