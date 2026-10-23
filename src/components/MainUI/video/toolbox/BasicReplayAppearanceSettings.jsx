/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BasicReplayAppearanceSettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-14
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaButton, WaColorPicker, WaIcon, WaRadio, WaRadioGroup} from '@awesome.me/webawesome/dist/react'
import '@awesome.me/webawesome/dist/styles/utilities/visually-hidden.css'
import {
    REPLAY_MIN_TRACE_WIDTH,
    BASIC_REPLAY_SIZE_SCALES,
    resolveBasicReplayPresentation,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {currentReplayJourney} from '@Core/ui/replay/ReplayUserModeConstants'
import {getBasicReplaySettings, writeBasicReplaySettings} from '@Core/ui/replay/ReplayModeSettings'
import {
    resolveBasicReplaySettings,
    syncJourneyBasicReplayPresentation,
} from '@Core/ui/replay/ReplayUserModes'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useSnapshot} from 'valtio'

const BASIC_REPLAY_SIZE_LABELS = ['small', 'medium', 'large']

/** Render live color swatches and fixed-scale trace/marker choices for Basic Replay. */
export const BasicReplayAppearanceSettings = () => {
    const $settings = lgs.settings.ui.replay
    const settings = useSnapshot($settings)
    const main = useOptionalSnapshot(lgs.stores.main)
    const journey = main.theJourney ?? currentReplayJourney()
    const swatches = useOptionalSnapshot(lgs.settings.swatches).list?.join(';') ?? ''
    const presentation = resolveBasicReplaySettings({
        user: getBasicReplaySettings(settings),
        journey: getBasicReplaySettings(journey?.replay),
    }).presentation
    const factoryPresentation = resolveBasicReplayPresentation()
    const {fill, border} = presentation.progression

    /** Publish appearance before refreshing Replay so every consumer sees the same settings. */
    const updatePresentation = updates => {
        const nextPresentation = resolveBasicReplayPresentation({...presentation, ...updates})
        lgs.settings.ui.replay = writeBasicReplaySettings(lgs.settings.ui.replay, {
            ...(getBasicReplaySettings(lgs.settings.ui.replay) ?? {}),
            presentation: nextPresentation,
        })
        syncJourneyBasicReplayPresentation(nextPresentation)
        lgs.stores.replay.progression = nextPresentation.progression
        __.ui.replay?.refresh?.({camera: false})
        lgs.scene?.requestRender?.()
    }
    const baseFillWidth = Math.max(REPLAY_MIN_TRACE_WIDTH, fill.width)
    const baseBorderWidth = Math.max(0, border.width)
    // Keep the preview camera-independent and match the renderer's minimum projected marker diameter.
    const baseMarkerDiameter = 8

    return (
        <div className="basic-replay-settings-row basic-replay-appearance" role="group" aria-label="Trace and marker appearance">
            <WaIcon name="paintbrush" variant="regular" label=""/>
            <div className="basic-replay-appearance__colors">
                <WaColorPicker size="s" aria-label="Replay border color"
                               value={border.color} swatches={swatches}
                               onInput={event => updatePresentation({borderColor: event.currentTarget.value})}/>
                <WaColorPicker size="s" aria-label="Replay fill color"
                               value={fill.color} swatches={swatches}
                               onInput={event => updatePresentation({fillColor: event.currentTarget.value})}/>
            </div>
            <WaButton className="basic-replay-appearance__reset" size="s" appearance="plain"
                      aria-label="Reset Replay appearance to defaults" title="Reset Replay appearance to defaults"
                      onClick={() => updatePresentation({
                          fillColor: factoryPresentation.fillColor,
                          borderColor: factoryPresentation.borderColor,
                          sizeScale: factoryPresentation.sizeScale,
                      })}>
                <WaIcon name="arrow-rotate-left" variant="regular" label=""/>
            </WaButton>
            <WaRadioGroup className="basic-replay-appearance__sizes wa-visually-hidden-label"
                          label="Replay marker and line size" orientation="horizontal" size="s"
                          value={String(presentation.sizeScale)}
                          onChange={event => updatePresentation({sizeScale: event.currentTarget.value})}>
                {BASIC_REPLAY_SIZE_SCALES.map((scale, index) => {
                    const selected = presentation.sizeScale === scale
                    const fillWidth = baseFillWidth * scale
                    const borderWidth = baseBorderWidth * scale
                    const markerDiameter = baseMarkerDiameter * scale
                    const sizeLabel = BASIC_REPLAY_SIZE_LABELS[index]
                    return (
                        <WaRadio key={scale} value={String(scale)} appearance="button"
                                  className={`video-choice-button${selected ? ' is-selected' : ''}`}
                                  aria-label={`Replay size ${sizeLabel}`}>
                            <span className="basic-replay-appearance__choice">
                                <svg className="basic-replay-appearance__preview" width="36" height="24" viewBox="0 0 36 24" aria-hidden="true">
                                    <line x1="4" x2="32" y1="12" y2="12" stroke={border.color}
                                          strokeWidth={fillWidth + borderWidth * 2}/>
                                    <line x1="4" x2="32" y1="12" y2="12" stroke={fill.color} strokeWidth={fillWidth}/>
                                    <circle cx="18" cy="12" r={markerDiameter / 2}
                                            fill={fill.color} stroke={border.color} strokeWidth={borderWidth}/>
                                </svg>
                            </span>
                        </WaRadio>
                    )
                })}
            </WaRadioGroup>
        </div>
    )
}
