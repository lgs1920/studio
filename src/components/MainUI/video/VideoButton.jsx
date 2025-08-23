/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-23
 * Last modified: 2025-08-23
 *
 *
 * Copyright © 2025 LGS1920
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
            <SlTooltip hoist placement={props.tooltip} content="Make a new video">
                <SlButton size={'small'} className={'square-button'} id={'launch-the-video-editor'}
                          onClick={handleClick}>
                    <SlIcon slot="prefix" library="fa" name={FA2SL.set(faVideoPlus)}></SlIcon>
                </SlButton>
            </SlTooltip>
        </>
    )
}
