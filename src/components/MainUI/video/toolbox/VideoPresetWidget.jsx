/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPresetWidget.jsx
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

import { VideoFPSToolbar }    from '@Components/MainUI/video/toolbox/VideoFPSToolbar'
import { VideoPresetToolbar } from '@Components/MainUI/video/toolbox/VideoPresetToolbar'
import { LGS_TOOLBAR, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import React, { useMemo }     from 'react'
import { Widget }             from '@Components/MainUI/widgets/Widget'
import { useSnapshot }        from 'valtio'
import { VideoQualityToolbar } from './VideoQualityToolbar'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const VideoPresetWidget = ({id}) => {

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const config = useMemo(() => {
        return {
            top:      (__.device.isMobile && __.device.isPortrait) ? '15%' : '30%',
            opacity:  lgs.settings.ui.toolbars.opacity,
            left:     '50%',
            attachTo: 'top',
            type: LGS_TOOLBAR,
            id: id,
            group: VIDEO_TOOLS_WIDGETS,
        }
    }, [])

    return (
        <Widget isVisible={video.cropper.presetEditor} config={config}>
            <VideoPresetToolbar/>
        </Widget>
    )
}