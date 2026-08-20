/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderWidget.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoRecorderToolbar } from '@Components/MainUI/video/toolbox/VideoRecorderToolbar'
import { Widget } from '@Components/MainUI/widgets/Widget'
import { LGS_TOOLBAR, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import { useMemo }     from 'react'

const VIDEO_RECORDER_TOOLBAR_ZINDEX = 'var(--lgs-video-recorder-toolbar-zindex)'

export const VideoRecorderWidget = ({id}) => {
    const config = useMemo(() => {
        return {
            left:           '50%',
            top:            '90%',
            attachTo:       'bottom',
            canLock:        false,
            canReduce:      false,
            margin:         lgs.gutter?.s ?? 8,
            opacity:        lgs.settings.ui.toolbars.opacity,
            type:           LGS_TOOLBAR,
            id:             id,
            group:          VIDEO_TOOLS_WIDGETS,
            persist:        false,
            showControlBox: false,
            transient:      true,
            zIndex:         VIDEO_RECORDER_TOOLBAR_ZINDEX,
        }
    }, [id])

    return (
        <>
            <Widget isVisible={true} className="video-recorder-widget-shell" config={config}>
                <VideoRecorderToolbar/>
            </Widget>
        </>
    )
}
