/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoSettingsInfo.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-28
 * Last modified: 2026-04-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { useSnapshot }         from 'valtio'

export const VideoSettingsInfo = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const fps = ScreenMediaRecorder.FPS[video.fps]
    const quality = ScreenMediaRecorder.QUALITY[video.quality]
    const ratio = lgs.configuration.videoFormats.find(f => f.value === video.ratio)?.label ?? String(video.ratio)

    return (
        <>
            <span>{`${fps} FPS ${quality?.name}`}</span>
            <span>{ratio}</span>
        </>
    )
}
