/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoFPSWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-09
 * Last modified: 2025-10-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VideoFPSToolbar } from '@Components/MainUI/video/toolbox/VideoFPSToolbar'
import { LGS_TOOLBAR }     from '@Core/constants'
import React, { useMemo }  from 'react'
import { Widget }          from '@Components/MainUI/Widget'
import { useSnapshot }     from 'valtio'
import { VideoQualityToolbar } from './VideoQualityToolbar'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const VideoFPSWidget = () => {

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const config = useMemo(() => {
        const myConfig = {
            top:      (__.device.isMobile && __.device.isPortrait) ? '15%' : '30%',
            opacity:  lgs.settings.ui.toolbars.opacity,
            left:     '50%',
            attachTo: 'top',
            type: LGS_TOOLBAR,
        }
        return myConfig
    }, [])

    return (
        <Widget isVisible={video.cropper.fpsEditor} config={config}>
            <VideoFPSToolbar/>
        </Widget>
    )
}