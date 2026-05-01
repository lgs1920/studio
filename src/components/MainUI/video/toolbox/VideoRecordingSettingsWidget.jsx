/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoRecordingSettingsToolbar }         from '@Components/MainUI/video/toolbox/VideoRecordingSettingsToolbar'
import { LGS_TOOLBAR, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import { useEffect, useMemo } from 'react'
import { Widget }              from '@Components/MainUI/widgets/Widget'

const VIDEO_RECORDING_SETTINGS_TOOLBAR_ZINDEX = 'var(--lgs-video-recording-settings-toolbar-zindex)'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const VideoRecordingSettingsWidget = ({id}) => {
    useEffect(() => {
        lgs.stores.ui.drawers.open = null
        const previous = lgs.stores.ui.widget.list.get(id) ?? {}
        lgs.stores.ui.widget.list.set(id, {
            ...previous,
            zIndex: VIDEO_RECORDING_SETTINGS_TOOLBAR_ZINDEX,
        })
    }, [id])

    // Stabilize config with useMemo
    const config = useMemo(() => {
        return {
            left: '50%',
            top: __.device.isMobile && __.device.isPortrait ? '90%' : '80%',
            attachTo: 'bottom',
            opacity:  lgs.settings.ui.toolbars.opacity,
            type:   LGS_TOOLBAR,
            zIndex:         VIDEO_RECORDING_SETTINGS_TOOLBAR_ZINDEX,
            id:             id,
            persist: true,
            showControlBox: false,
            group: VIDEO_TOOLS_WIDGETS,
        }
    }, [id])

    return (
        <Widget isVisible={true} config={config}>
            <VideoRecordingSettingsToolbar/>
        </Widget>
    )
}
