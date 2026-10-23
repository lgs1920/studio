/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BasicReplaySamplingSettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-23
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaIcon, WaOption, WaSelect, WaTooltip} from '@awesome.me/webawesome/dist/react'
import {getBasicReplaySettings, normalizeReplaySampleCount, REPLAY_SAMPLE_COUNT_OPTIONS, writeBasicReplaySettings} from '@Core/ui/replay/ReplayModeSettings'
import {currentReplayJourney} from '@Core/ui/replay/ReplayUserModeConstants'
import {resolveBasicReplaySettings, syncJourneyBasicReplaySampleCount} from '@Core/ui/replay/ReplayUserModes'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useSnapshot} from 'valtio'

/** Render Basic Replay's themed route-sampling selector and persist its choice. */
export const BasicReplaySamplingSettings = () => {
    const settings = useSnapshot(lgs.settings.ui.replay)
    const main = useOptionalSnapshot(lgs.stores.main)
    const journey = main?.theJourney ?? currentReplayJourney()
    const selection = resolveBasicReplaySettings({
        user: getBasicReplaySettings(settings),
        journey: getBasicReplaySettings(journey?.replay),
    }).sampleCount
    const selectedOption = REPLAY_SAMPLE_COUNT_OPTIONS.find(option => option.value === selection)
        ?? REPLAY_SAMPLE_COUNT_OPTIONS[1]

    /** Save the global preference and Journey override before refreshing the active Replay. */
    const changeSampleCount = event => {
        const sampleCount = normalizeReplaySampleCount(event.currentTarget.value)
        const basic = getBasicReplaySettings(lgs.settings.ui.replay) ?? {}
        const nextBasic = Object.assign({}, basic, {sampleCount})
        lgs.settings.ui.replay = writeBasicReplaySettings(lgs.settings.ui.replay, nextBasic)
        syncJourneyBasicReplaySampleCount(sampleCount)
        __.ui.replay?.refresh?.({camera: false})
        lgs.scene?.requestRender?.()
    }

    return (
        <div className="basic-replay-sampling-control half-width">
            <WaSelect className="basic-replay-sampling__select"
                      label="Sampling" label-at-start
                      size="s" appearance="filled"
                      value={String(selection)} onChange={changeSampleCount}>
                <WaIcon id="basic-replay-sampling-selected-icon"
                        slot="start" name={selectedOption.icon} variant="regular" label=""/>
                {REPLAY_SAMPLE_COUNT_OPTIONS.map(option => (
                    <WaOption key={option.value} value={String(option.value)}>
                        <WaIcon id={`basic-replay-sampling-option-${option.value}`}
                                slot="start" name={option.icon} variant="regular" label=""/>
                        {option.label}
                    </WaOption>
                ))}
            </WaSelect>
            <WaTooltip for="basic-replay-sampling-selected-icon">{`${selection} pts`}</WaTooltip>
            {REPLAY_SAMPLE_COUNT_OPTIONS.map(option => (
                <WaTooltip key={option.value} for={`basic-replay-sampling-option-${option.value}`}>
                    {`${option.value} pts`}
                </WaTooltip>
            ))}
        </div>
    )
}
