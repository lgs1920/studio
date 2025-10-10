/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualityWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-10
 * Last modified: 2025-10-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_TOOLBAR } from '@Core/constants'
import React, { useMemo } from 'react'
import { Widget }         from '@Components/MainUI/Widget'
import { useSnapshot }    from 'valtio'
import { VideoQualityToolbar } from './VideoQualityToolbar'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const VideoQualityWidget = ({id}) => {

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const config = useMemo(() => {
        return {
            left:           __.device.isMobile && __.device.isPortrait ? '15%' : '30%',
            top:            '50%',
            attachTo:       'left',
            opacity:        lgs.settings.ui.toolbars.opacity,
            type: LGS_TOOLBAR,
            id: id,
        }
    }, [])

    return (
        <Widget isVisible={video.cropper.qualityEditor} config={config}>
            <VideoQualityToolbar/>
        </Widget>
    )
}