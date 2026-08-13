/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-03
 * Last modified: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { REPLAY_DRAWER } from '@Core/constants'
import { REPLAY_LABEL } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import { TunnelTooltip } from '@Components/Tunnel/Tunnel'
import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback } from 'react'
import { useSnapshot } from 'valtio'

export const JourneyReplayButton = (props) => {
    const $video = lgs.stores.ui.video
    const replay = useSnapshot(lgs.stores.replay)
    const video = useSnapshot($video)
    const {
        id = 'launch-the-replay-editor',
        tooltip = 'right',
        className = 'square-button',
              tooltipText = `${REPLAY_LABEL} Settings`,
        tooltipPlacement = tooltip,
        variant = 'brand',
        appearance = 'Filled',
        size = undefined,
        showOnlyWhenLinked = false,
        tooltipStyle = 'wa',
        selected = undefined,
        onClick = null,
              ariaLabel   = `${REPLAY_LABEL} Settings`,
    } = props ?? {}
    const isLinked = replay.recordingSync === true
    const isDrawerOpen = selected !== undefined ? selected : __.ui.drawerManager?.isCurrent?.(REPLAY_DRAWER) === true
    const visible = lgs.theJourney
                  && !video.recording
                  && !video.preRecording
                  && !video.snapshot
                  && (!showOnlyWhenLinked || isLinked)
    const buttonClassName = isDrawerOpen ? `${className} is-selected`.trim() : className

    const handleClick = useCallback(() => {
        if (typeof onClick === 'function') {
            onClick()
            return
        }
        __.ui.drawerManager.open(REPLAY_DRAWER)
    }, [onClick])

    return (
        <>
            {visible &&
                tooltipStyle === 'tunnel'
                    ? (
                        <TunnelTooltip
                            anchorId={id}
                            tooltip={tooltipText}
                            icon="drone"
                            placement={tooltipPlacement}
                        >
                            <WaButton
                                className={buttonClassName}
                                id={id}
                                onClick={handleClick}
                                variant={variant}
                                appearance={appearance}
                                size={size}
                                aria-label={ariaLabel}
                                aria-pressed={isDrawerOpen}
                            >
                                <WaIcon name="drone" variant="regular"/>
                            </WaButton>
                        </TunnelTooltip>
                    )
                    : (
                        <>
                            <WaTooltip for={id} placement={tooltipPlacement}>{tooltipText}</WaTooltip>
                            <WaButton
                                className={buttonClassName}
                                id={id}
                                onClick={handleClick}
                                variant={variant}
                                appearance={appearance}
                                size={size}
                                aria-label={ariaLabel}
                                aria-pressed={isDrawerOpen}
                            >
                                <WaIcon name="drone" variant="regular"/>
                            </WaButton>
                        </>
                    )
            }
        </>
    )
}
