/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-13
 * Last modified: 2025-10-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/


import { VideoRecorderWidget } from '@Components/MainUI/video/toolbox/VideoRecorderWidget'
import { VideoSettingsInfo }   from '@Components/MainUI/video/VideoSettingsInfo'
import { CropOverlay }         from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }                                                    from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import { CROP_TOOLS_WIDGET_GROUP, VIDEO_CROP_ZONE, VIDEO_TOOLS_WIDGET_GROUP } from '@Core/constants'
import classNames                                                             from 'classnames'
import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                             from 'valtio'

export const VideoRecordingScreenArea = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const _cropZone = useRef(null)
    const [crop, setCrop] = useState({x: 0, y: 0, width: 0, height: 0})

    useEffect(() => {
        const widget = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        setCrop(widget.cropDimensions)
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGET_GROUP, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGET_GROUP, false)
        }
    }, [])

    useEffect(() => {
        // control animation from store flags
        if (_cropZone.current) {
            _cropZone.current.style.animationPlayState = video.paused ? 'paused' : 'running'
        }
    }, [video.paused])

    const isValid =
              Number.isFinite(crop.left) &&
              Number.isFinite(crop.top) &&
              Number.isFinite(crop.width) &&
              Number.isFinite(crop.height) &&
              crop.width > 0 &&
              crop.height > 0

    if (!isValid) {
        return null
    }

    const overlayStyle = {
        clipPath: `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%,
        0% ${crop.top}px,
        ${crop.left}px ${crop.top}px,
        ${crop.left}px ${crop.top + crop.height}px,
        ${crop.left + crop.width}px ${crop.top + crop.height}px,
        ${crop.left + crop.width}px ${crop.top}px,
        0% ${crop.top}px
    )`,
    }

    return (
        <>
            <CropOverlay style={overlayStyle}/>
            <VideoRecorderWidget id="video-recorder-widget"/>
            <DefinedCropZone
                context={$video.cropper}
                className={classNames('video-recording-in-progress', {finalizing: video.finalizing})}
                infoComponent={<VideoSettingsInfo/>}
                ref={_cropZone}
            />
        </>
    )
}