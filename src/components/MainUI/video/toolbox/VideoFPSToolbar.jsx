/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoFPSToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-09-23
 * Last modified: 2026-09-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * File: VideoFPSToolbar.jsx
 ******************************************************************************/

import {REPLAY_VIDEO_FPS} from '@Core/ui/replay/ReplayVideoSettings'
import classNames         from 'classnames'
import { WaButton }                           from '@web.awesome.me/webawesome-pro/dist/react'
import { Fragment, memo, useMemo } from 'react'
import { useSnapshot }                        from 'valtio'

export const VideoFPSToolbar = memo(({choicesOnMap = false}) => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const fpsChoices = useMemo(
        () => [...REPLAY_VIDEO_FPS].sort((a, b) => a - b),
        [],
    )

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
                {fpsChoices.map((fps) => {
                    const index = REPLAY_VIDEO_FPS.indexOf(fps)
                    return (
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
                    )
                })}
            </div>
        </div>
    )
})
