/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-23
 * Last modified: 2026-04-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                 from 'valtio'


export const VideoButton = (props) => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const handleClick = () => {
        $video.editing = !$video.editing
    }
    return (
        <>
            {!video.recording && !video.preRecording && !video.snapshot &&
                <>
                    <WaTooltip for={'launch-the-video-editor'}
                               placement={props.tooltip}>{'Record a new video'}</WaTooltip>
                    <WaButton className="square-button"
                              id={'launch-the-video-editor'}
                              onClick={handleClick}
                              variant={'brand'}
                              appearance="Filled">
                        <WaIcon name="clapperboard-play" variant="regular"/>
                    </WaButton>
                </>
            }
        </>
    )
}
