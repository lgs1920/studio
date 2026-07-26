/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useSnapshot }                 from 'valtio'


export const VideoButton = (props) => {
    const $video = lgs.stores.ui.video
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot($video)
    const syncWithJourneyReplay = replay.recordingSync === true
    const {
        id = 'launch-the-video-editor',
        className = 'square-button',
        tooltip = 'right',
        tooltipText = 'Record a new video',
        variant = syncWithJourneyReplay ? 'warning' : 'brand',
        appearance = 'Filled',
    } = props ?? {}

    const handleClick = () => {
        $video.editing = !$video.editing
    }
    return (
        <>
            {!video.recording && !video.preRecording && !video.snapshot &&
                <>
                    <WaTooltip for={id}
                               placement={tooltip}>{tooltipText}</WaTooltip>
                    <WaButton className={className}
                              id={id}
                              onClick={handleClick}
                              variant={variant}
                              appearance={appearance}>
                        <WaIcon name="clapperboard-play" variant="regular"/>
                    </WaButton>
                </>
            }
        </>
    )
}
