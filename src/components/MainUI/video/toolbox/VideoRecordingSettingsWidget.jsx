/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsWidget.jsx
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

import { VideoRecordingSettingsToolbar }         from '@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar'
import { LGS_TOOLBAR, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import React, { useMemo }      from 'react'
import { Widget }              from '@Components/MainUI/widgets/Widget'
import { VideoQualityToolbar } from './VideoQualityToolbar'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const VideoRecordingSettingsWidget = ({id}) => {
    // Stabilize config with useMemo
    const config = useMemo(() => {
        lgs.stores.ui.drawers.open = null
        return {
            left: '50%',
            top: __.device.isMobile && __.device.isPortrait ? '90%' : '80%',
            attachTo: 'bottom',
            opacity:  lgs.settings.ui.toolbars.opacity,
            id:             id,
            persist: true,
            group: VIDEO_TOOLS_WIDGETS,
        }
    }, [])

    return (
        <Widget isVisible={true} config={config}>
            <VideoRecordingSettingsToolbar/>
        </Widget>
    )
}