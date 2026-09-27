/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoSettingsInfo.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-09-12
 * Last modified: 2026-09-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {REPLAY_VIDEO_FPS, REPLAY_VIDEO_QUALITY} from '@Core/ui/replay/ReplayVideoSettings'
import { useSnapshot }         from 'valtio'

export const VideoSettingsInfo = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const fps = REPLAY_VIDEO_FPS[video.fps]
    const quality = REPLAY_VIDEO_QUALITY[video.quality]
    const ratio = lgs.configuration.videoFormats.find(f => f.value === video.ratio)?.label ?? String(video.ratio)

    return (
        <div className="video-settings-info">
            <span><strong>FPS :</strong> {fps}</span>
            <span><strong>Qual :</strong> {quality?.name}</span>
            <span><strong>Format :</strong> {ratio}</span>
        </div>
    )
}
