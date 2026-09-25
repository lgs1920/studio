/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayButton.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-05
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { REPLAY_DRAWER } from '@Core/constants'
import { REPLAY_LABEL } from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    defaultSimpleReplaySettings,
    hasExpertReplayConfiguration,
    initializeExpertReplayFromSimple,
    REPLAY_USER_MODE_BASIC,
    REPLAY_USER_MODE_EXPERT,
    resolveSimpleReplaySettings,
} from '@Core/ui/replay/ReplayUserModes'
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
        size,
        showOnlyWhenLinked = false,
        tooltipStyle = 'wa',
        selected,
        onClick = null,
        mode = null,
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
    const isBasicMode = mode === REPLAY_USER_MODE_BASIC
    const isBasicPreparationActive = isBasicMode && replay.simplePreparationActive === true
    const buttonAriaLabel = isBasicPreparationActive ? 'Start Basic Replay' : ariaLabel
    const buttonTooltipText = isBasicPreparationActive ? 'Start Basic Replay' : tooltipText
    const handleClick = useCallback(() => {
        console.error('[LGS1920][Diagnostics] replay button click', {
            mode,
            editing: lgs.stores.ui.video.editing,
            simplePreparationActive: lgs.stores.replay.simplePreparationActive,
        })
        if (typeof onClick === 'function') {
            onClick()
            return
        }
        if (mode === REPLAY_USER_MODE_BASIC) {
            const simple = {
                ...(lgs.settings.ui.replay.simple ?? defaultSimpleReplaySettings()),
                camera: {
                    ...(lgs.settings.ui.replay.simple?.camera ?? defaultSimpleReplaySettings().camera),
                    altitudeMode: 'constant',
                    heading: 0,
                    headingOffset: 0,
                    positionMode: 'system',
                },
            }
            lgs.settings.ui.replay.userMode = REPLAY_USER_MODE_BASIC
            lgs.settings.ui.replay.simple = simple
            lgs.stores.replay.camera = simple.camera
            lgs.stores.replay.simplePreparationActive = true
            if (lgs.stores.ui.video.cropper) {
                Object.assign(lgs.stores.ui.video.cropper, {
                    ratioEditor:  true,
                    widgetEditor: false,
                    draggable:    true,
                    resizable:    true,
                })
            }
            lgs.stores.ui.video.editing = true
            void Promise.resolve(__.ui.replay?.enterReplayPreparation?.({
                journey: lgs.theJourney,
                shouldApply: () => lgs.stores.replay.simplePreparationActive === true,
            })).catch(error => {
                console.error('[LGS1920][Diagnostics] simple replay preparation failed', error)
            })
            return
        }
        if (mode === REPLAY_USER_MODE_EXPERT) {
            lgs.stores.replay.simplePreparationActive = false
            lgs.settings.ui.replay.userMode = REPLAY_USER_MODE_EXPERT
            const journey = lgs.theJourney
            if (journey && !hasExpertReplayConfiguration(journey)) {
                const simple = resolveSimpleReplaySettings({
                    journey: journey.replay?.simple,
                    user: lgs.settings.ui.replay.simple,
                })
                const replay = initializeExpertReplayFromSimple(journey, simple)
                journey.replay = replay
                void journey.persistToDatabase?.()
                lgs.settings.ui.replay.camera = replay.expert.camera
                lgs.settings.ui.replay.progression = replay.expert.progression
                lgs.settings.ui.replay.profileInfo = replay.expert.profileInfo
                lgs.stores.replay.camera = replay.expert.camera
                lgs.stores.replay.progression = replay.expert.progression
                lgs.stores.replay.profileInfo = replay.expert.profileInfo
            }
        }
        __.ui.drawerManager.open(REPLAY_DRAWER)
    }, [mode, onClick])

    const button = (
        <WaButton
            className={buttonClassName}
            id={id}
            onClick={handleClick}
            variant={variant}
            appearance={appearance}
            size={size}
            aria-label={buttonAriaLabel}
            aria-pressed={isDrawerOpen}
        >
            <WaIcon name={isBasicMode ? 'video-down-to-line' : 'drone'} variant="regular"/>
        </WaButton>
    )

    return (
        <>
            {visible &&
                tooltipStyle === 'tunnel'
                    ? (
                        <TunnelTooltip
                            anchorId={id}
                            tooltip={buttonTooltipText}
                            icon={isBasicMode ? 'video-down-to-line' : 'drone'}
                            placement={tooltipPlacement}
                        >
                            {button}
                        </TunnelTooltip>
                    )
                    : (
                        <>
                            <WaTooltip for={id} placement={tooltipPlacement}>{buttonTooltipText}</WaTooltip>
                            {button}
                        </>
                    )
            }
        </>
    )
}
