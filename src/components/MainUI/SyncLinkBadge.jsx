/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SyncLinkBadge.jsx
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
import { useCallback, useEffect }      from 'react'
import { useSnapshot }                 from 'valtio'

export const SyncLinkBadge = ({visible = true, className = ''} = {}) => {
    const video = useSnapshot(lgs.stores.ui.video)
    const replay = useSnapshot(lgs.stores.replay)
    const replaySettings = useSnapshot(lgs.settings.ui.replay)
    const isLinked = replay.recordingSync === true
    const isRecording = video.recording || video.preRecording || video.snapshot
    const buttonId = 'sync-link-toggle'

    const armSync = useCallback(() => {
        __.ui.replayVideoSync?.arm?.({
            autoStopRecording: true,
            resetToStart:      true,
        })
    }, [])

    const disarmSync = useCallback(() => {
        __.ui.replayVideoSync?.disarm?.()
    }, [])

    const toggleSync = useCallback(() => {
        if (isLinked) {
            disarmSync()
            return
        }

        armSync()
    }, [armSync, disarmSync, isLinked])

    useEffect(() => {
        const shouldBeLinked = replaySettings.recordingSync === true
        const isArmed = __.ui.replayVideoSync?.isArmed?.() === true

        if (shouldBeLinked) {
            if (!isArmed || !isLinked) {
                armSync()
            }
            return
        }

        if (isLinked || isArmed) {
            disarmSync()
        }
    }, [armSync, disarmSync, replaySettings.recordingSync, isLinked])

    if (!visible || isRecording) {
        return null
    }

    return (
        <>
            <WaTooltip for={buttonId} placement="top">
                {isLinked ? 'Unlink video and replay' : 'Link video and replay'}
            </WaTooltip>
            <WaButton
                className={`sync-link-badge ${className}`.trim()}
                id={buttonId}
                appearance={isLinked ? 'filled' : 'filled-outlined'}
                variant={isLinked ? 'brand' : 'warning'}
                size="s"
                aria-pressed={isLinked}
                aria-label={isLinked ? 'Unlink video and replay' : 'Link video and replay'}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation()
                    toggleSync()
                }}
            >
                <WaIcon name={isLinked ? 'link-simple' : 'link-simple-slash'} variant="regular"/>
            </WaButton>
        </>
    )
}
