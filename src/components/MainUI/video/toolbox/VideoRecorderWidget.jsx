/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-04
 * Last modified: 2025-11-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VideoRecorderToolbar } from '@Components/MainUI/video/toolbox/VideoRecorderToolbar'
import { Widget }                                      from '@Components/MainUI/Widget'
import { LGS_TOOLBAR, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                 from 'valtio'

export const VideoRecorderWidget = ({id}) => {
    const $video = lgs.stores.ui.video
    const _toolbar = useRef(null)

    const config = useMemo(() => {
        return {
            left:           `${$video.position.left}px`,
            top:            `${$video.position.top}px`,
            attachTo:       'center',
            opacity:        lgs.settings.ui.toolbars.opacity,
            type:           LGS_TOOLBAR,
            id:             id,
            group: VIDEO_TOOLS_WIDGETS,
        }
    }, [$video.position])

    return (
        <>
            <Widget isVisible={true} config={config}>
                <VideoRecorderToolbar/>
            </Widget>
        </>
    )
}