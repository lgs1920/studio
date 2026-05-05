/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WanderButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-05-05
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WANDER_DRAWER } from '@Core/constants'
import { WANDER_LABEL } from '@Core/ui/wander/WanderProgressionStyle'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback } from 'react'
import { useSnapshot } from 'valtio'

export const WanderButton = (props) => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const handleClick = useCallback(() => {
        __.ui.drawerManager.open(WANDER_DRAWER)
    }, [])

    return (
        <>
            {!video.recording && !video.preRecording && !video.snapshot &&
                <>
                    <WaTooltip for="launch-the-wander-editor" placement={props.tooltip}>{WANDER_LABEL}</WaTooltip>
                    <WaButton
                        className="square-button"
                        id="launch-the-wander-editor"
                        onClick={handleClick}
                        variant="brand"
                        appearance="Filled"
                    >
                        <WaIcon name="person-walking" variant="regular"/>
                    </WaButton>
                </>
            }
        </>
    )
}
