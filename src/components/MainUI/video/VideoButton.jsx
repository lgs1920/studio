/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faVideoPlus } from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlIcon, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                       from '@Utils/FA2SL.js'
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
                <SlTooltip hoist placement={props.tooltip} content="Make a new video">
                    <SlButton size={'small'} className={'square-button'} id={'launch-the-video-editor'}
                              onClick={handleClick}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faVideoPlus)}></SlIcon>
                    </SlButton>
                </SlTooltip>
            }
        </>
    )
}
