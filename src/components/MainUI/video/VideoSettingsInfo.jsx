/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoSettingsInfo.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-03
 * Last modified: 2025-10-03
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { VideoRecorder }       from '@Core/ui/video/recorder/VideoRecorder'
import { useEffect, useState } from 'react'
import { useSnapshot }         from 'valtio'

export const VideoSettingsInfo = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const [quality, setQuality] = useState($video.quality)
    const [fps, setFps] = useState($video.fps)
    const [ratio, setRatio] = useState($video.ratio)

    useEffect(() => {
        setFps(VideoRecorder.FPS[$video.fps])
    }, [video.fps])

    useEffect(() => {
        setQuality(VideoRecorder.QUALITY[video.quality])
    }, [video.quality])

    // Recompute current format when ratio changes and guard when not found
    useEffect(() => {
        const fmt = lgs.configuration.videoFormats.find(f => f.value === video.ratio)
        setRatio(fmt?.label ?? String(video.ratio))
    }, [video.ratio])

    return (
        <>
            <span>{`${fps} FPS`}</span><span>{quality?.name}</span><span>{ratio}</span>
        </>
    )
}