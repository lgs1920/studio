/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FlythroughButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-05
 * Last modified: 2026-06-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { FLYTHROUGH_DRAWER } from '@Core/constants'
import { FLYTHROUGH_LABEL } from '@Core/ui/flythrough/FlythroughProgressionStyle'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback } from 'react'
import { useSnapshot } from 'valtio'

export const FlythroughButton = (props) => {
    const $video = lgs.stores.ui.video
    const flythrough = useSnapshot(lgs.stores.flythrough)
    const video = useSnapshot($video)
    const {
        tooltip = 'right',
        className = 'square-button',
        variant = flythrough.recordingSync === true ? 'warning' : 'brand',
        appearance = 'Filled',
    } = props ?? {}

    const handleClick = useCallback(() => {
        __.ui.drawerManager.open(FLYTHROUGH_DRAWER)
    }, [])

    return (
        <>
            {lgs.theJourney && !video.recording && !video.preRecording && !video.snapshot &&
                <>
                    <WaTooltip for="launch-the-flythrough-editor" placement={tooltip}>{FLYTHROUGH_LABEL}</WaTooltip>
                    <WaButton
                        className={className}
                        id="launch-the-flythrough-editor"
                        onClick={handleClick}
                        variant={variant}
                        appearance={appearance}
                    >
                        <WaIcon name="video-arrow-up-right" variant="regular"/>
                    </WaButton>
                </>
            }
        </>
    )
}
