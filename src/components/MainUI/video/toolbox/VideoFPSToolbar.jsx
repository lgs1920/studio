/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoFPSToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * File: VideoFPSToolbar.jsx
 ******************************************************************************/

import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WaButton }                           from '@web.awesome.me/webawesome-pro/dist/react'
import React, { Fragment, memo, useCallback } from 'react'
import { useSnapshot }                        from 'valtio'

export const VideoFPSToolbar = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    /**
     * Updates FPS index in store and settings
     * @param {number} index
     */
    const handleChangeFPS = useCallback((index) => {
        $video.fps = index
        lgs.settings.ui.video.fps = index
    }, [$video])

    return (
        <div className="video-fps-widget">
            <span>{'FPS'}</span>
            <div className="buttons-bar-on-map">
                {ScreenMediaRecorder.FPS.map((fps, index) => (
                    <Fragment key={index}>
                        <WaButton
                            size="small"
                            appearance={index === video.fps ? 'accent' : 'outlined'}
                            onClick={() => handleChangeFPS(index)}
                        >
                            {fps}
                        </WaButton>
                    </Fragment>
                ))}
            </div>
        </div>
    )
})
