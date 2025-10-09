/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderWidget.jsx
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

import { VideoQualityToolbar }  from '@Components/MainUI/video/toolbox/VideoQualityToolbar'
import { VideoRecorderToolbar } from '@Components/MainUI/video/toolbox/VideoRecorderToolbar'
import { LGS_TOOLBAR }                        from '@Core/constants'
import React, { useEffect, useRef, useState } from 'react'
import { Widget }                             from '@Components/MainUI/Widget'
import { useSnapshot }                        from 'valtio'

export const VideoRecorderWidget = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const [config, setConfig] = useState({})
    const _toolbar = useRef(null)

    useEffect(() => {
        setConfig({
                      left:     `${$video.position.left}px`,
                      top:      `${$video.position.top}px`,
                      attachTo: 'center',
                      opacity:  lgs.settings.ui.toolbars.opacity,
                      type:     LGS_TOOLBAR,
                  })
    }, [])

    return (
        <>
            <Widget isVisible={true} config={config}>
                <VideoRecorderToolbar/>
            </Widget>
        </>
    )
}