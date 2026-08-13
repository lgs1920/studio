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
import { useSnapshot } from 'valtio'

const VIDEO_RECORDER_TOOLBAR_ZINDEX = 'var(--lgs-video-recorder-toolbar-zindex)'

export const VideoRecorderWidget = ({id}) => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const position = video.toolbarPosition ?? video.position ?? {}
    const left = Number.isFinite(position.left) ? position.left : window.innerWidth / 2
    const top = Number.isFinite(position.top) ? position.top : window.innerHeight / 2
    const attachTo = position.attachTo ?? 'bottom'

    const config = useMemo(() => {
        return {
            left:           `${left}px`,
            top:            `${top}px`,
            attachTo,
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
    }, [attachTo, id, left, top])

    return (
        <>
            <Widget isVisible={true} config={config}>
                <VideoRecorderToolbar/>
            </Widget>
        </>
    )
}
