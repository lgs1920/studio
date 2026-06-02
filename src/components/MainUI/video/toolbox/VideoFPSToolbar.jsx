/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoFPSToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * File: VideoFPSToolbar.jsx
 ******************************************************************************/

import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import classNames         from 'classnames'
import { WaButton }                           from '@web.awesome.me/webawesome-pro/dist/react'
import { Fragment, memo } from 'react'
import { useSnapshot }                        from 'valtio'

export const VideoFPSToolbar = memo(({choicesOnMap = false}) => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    /**
     * Updates FPS index in store and settings
     * @param {number} index
     */
    const handleChangeFPS = (index) => {
        $video.fps = index
        lgs.settings.ui.video.fps = index
    }

    return (
        <div className="video-fps-widget">
            <span>{'FPS'}</span>
            <div className={classNames('buttons-bar-on-map', {
                'video-choice-buttons video-choice-buttons-on-map': choicesOnMap,
            })}>
                {ScreenMediaRecorder.FPS.map((fps, index) => (
                    <Fragment key={index}>
                        <WaButton
                            className={classNames('video-choice-button', {'is-selected': index === video.fps})}
                            size="s"
                            variant="neutral"
                            appearance={index === video.fps ? 'outlined' : 'plain'}
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
