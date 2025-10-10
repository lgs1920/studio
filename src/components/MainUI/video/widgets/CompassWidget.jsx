/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CompassWidget.jsx
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

import { VideoFPSToolbar } from '@Components/MainUI/video/toolbox/VideoFPSToolbar'
import { LGS_TOOLBAR }     from '@Core/constants'
import React, { useMemo }  from 'react'
import { Widget }          from '@Components/MainUI/Widget'
import { useSnapshot }     from 'valtio'

/**
 * Component for selecting video quality with draggable toolbar
 * @component
 * @returns {JSX.Element} Draggable video quality selector UI
 */
export const CompassWidget = ({id}) => {

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const config = useMemo(() => {
        const myConfig = {
            top:      (__.device.isMobile && __.device.isPortrait) ? '15%' : '30%',
            opacity:  lgs.settings.ui.toolbars.opacity,
            left: '30%',
            attachTo: 'top',
            type: LGS_TOOLBAR,
            id:   id,
        }
        return myConfig
    }, [])

    return (
        <Widget isVisible={video.cropper.fpsEditor} config={config}>
            ######
        </Widget>
    )
}