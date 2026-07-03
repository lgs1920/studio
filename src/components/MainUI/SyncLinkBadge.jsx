/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: SyncLinkBadge.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified: 2026-06-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon, WaTooltip } from '@web.awesome.me/webawesome-pro/dist/react'
import { useCallback, useEffect }      from 'react'
import { useSnapshot }                 from 'valtio'

export const SyncLinkBadge = ({visible = true, className = ''} = {}) => {
    const video = useSnapshot(lgs.stores.ui.video)
    const flythrough = useSnapshot(lgs.stores.flythrough)
    const flythroughSettings = useSnapshot(lgs.settings.ui.flythrough)
    const isLinked = flythrough.recordingSync === true
    const isRecording = video.recording || video.preRecording || video.snapshot
    const buttonId = 'sync-link-toggle'

    const toggleSync = useCallback(() => {
        if (isLinked) {
            __.ui.flythroughVideoSync?.disarm?.()
            return
        }

        __.ui.flythroughVideoSync?.arm?.({
            autoStopRecording: true,
            resetToStart:      true,
        })
    }, [isLinked])

    useEffect(() => {
        const shouldBeLinked = flythroughSettings.recordingSync === true
        if (shouldBeLinked === isLinked) {
            return
        }

        if (shouldBeLinked) {
            __.ui.flythroughVideoSync?.arm?.({
                autoStopRecording: true,
                resetToStart:      true,
            })
            return
        }

        __.ui.flythroughVideoSync?.disarm?.()
    }, [flythroughSettings.recordingSync, isLinked])

    if (!visible || isRecording) {
        return null
    }

    return (
        <>
            <WaTooltip for={buttonId} placement="top">
                {isLinked ? 'Unlink video and flythrough' : 'Link video and flythrough'}
            </WaTooltip>
            <WaButton
                className={`sync-link-badge ${className}`.trim()}
                id={buttonId}
                appearance={isLinked ? 'filled' : 'filled-outlined'}
                variant={isLinked ? 'brand' : 'neutral'}
                size="s"
                aria-pressed={isLinked}
                aria-label={isLinked ? 'Unlink video and flythrough' : 'Link video and flythrough'}
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
