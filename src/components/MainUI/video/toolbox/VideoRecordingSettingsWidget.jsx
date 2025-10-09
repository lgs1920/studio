/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsWidget.jsx
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

import { VideoRecordingSettingsToolbar } from '@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar'
import { LGS_TOOLBAR }                   from '@Core/constants'
import React, { useMemo }                from 'react'
import { Widget }                        from '@Components/MainUI/Widget'
import { VideoQualityToolbar }           from './VideoQualityToolbar'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const VideoRecordingSettingsWidget = () => {
    // Stabilize config with useMemo
    const config = useMemo(() => {
        const myConfig = {
            left: '50%',
            top:  __.device.isMobile && __.device.isPortrait ? '85%' : '70%',
            attachTo: 'bottom',
            opacity:  lgs.settings.ui.toolbars.opacity,
        }
        return myConfig
    }, [])

    return (
        <Widget isVisible={true} config={config}>
            <VideoRecordingSettingsToolbar/>
        </Widget>
    )
}