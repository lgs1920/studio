/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-30
 * Last modified: 2025-09-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/


import { VideoSettingsInfo }                             from '@Components/MainUI/video/VideoSettingsInfo'
import { CropOverlay }                                   from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }                               from '@Components/ToolsUI/cropper/DefinedCropZone'
import classNames                                        from 'classnames'
import React, { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useSnapshot }                                   from 'valtio'

const toCssCrop = (crop, dpr) => ({
    x:      crop?.x == null ? 0 : Math.floor(crop.x / dpr),
    y:      crop?.y == null ? 0 : Math.floor(crop.y / dpr),
    width:  crop?.width == null ? 0 : Math.floor(crop.width / dpr),
    height: crop?.height == null ? 0 : Math.floor(crop.height / dpr),
})

export const VideoRecordingScreenArea = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const _cropZone = useRef(null)

    const cssCrop = useMemo(() => {
        const crop = video.cropper
        const dpr = __.device.dpr
        return toCssCrop(crop, dpr)
    }, [video.cropper?.x, video.cropper?.y, video.cropper?.width, video.cropper?.height, __.device?.dpr])

    useEffect(() => {
        // control animation from store flags
        if (_cropZone.current) {
            _cropZone.current.style.animationPlayState = video.paused ? 'paused' : 'running'
        }
    }, [video.paused])

    const isValid =
              Number.isFinite(cssCrop.x) &&
              Number.isFinite(cssCrop.y) &&
              Number.isFinite(cssCrop.width) &&
              Number.isFinite(cssCrop.height) &&
              cssCrop.width > 0 &&
              cssCrop.height > 0

    if (!isValid) {
        return null
    }

    const overlayStyle = {
        clipPath: `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%,
        0% ${cssCrop.y}px,
        ${cssCrop.x}px ${cssCrop.y}px,
        ${cssCrop.x}px ${cssCrop.y + cssCrop.height}px,
        ${cssCrop.x + cssCrop.width}px ${cssCrop.y + cssCrop.height}px,
        ${cssCrop.x + cssCrop.width}px ${cssCrop.y}px,
        0% ${cssCrop.y}px
    )`,
    }

    return (
        <>
            <CropOverlay style={overlayStyle}/>
            <DefinedCropZone
                cssCrop={cssCrop}
                className={classNames('video-recording-in-progress', {finalizing: video.finalizing})}
                infoComponent={<VideoSettingsInfo/>}
                ref={_cropZone}
            />
        </>
    )
}