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
 * Last modified: 2026-10-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaButton, WaColorPicker, WaIcon, WaRadio, WaRadioGroup, WaTooltip} from '@awesome.me/webawesome/dist/react'
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
import {hasVisibleColorAlpha} from '@Utils/ColorUtils'
import {LGS1920_ICON_LIBRARY} from '@Utils/useWebAwesomeKits'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useId} from 'react'
import {useSnapshot} from 'valtio'

const BASIC_REPLAY_SIZE_LABELS = ['thin', 'small', 'medium', 'large']

/** Render live color swatches and fixed-scale trace/marker choices for Basic Replay. */
export const BasicReplayAppearanceSettings = () => {
    const rawTooltipId = useId()
    const swapTooltipId = `basic-replay-swap-colors-${rawTooltipId.replace(/:/g, '')}`
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
    const borderEnabled = presentation.borderEnabled

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
    const canSwapColors = hasVisibleColorAlpha(fill.color) && hasVisibleColorAlpha(border.color)
    /** Swap the trace fill and border colors when both have a visible alpha. */
    const handleSwapColors = () => {
        if (canSwapColors) {
            updatePresentation({fillColor: border.color, borderColor: fill.color})
        }
    }
    const baseFillWidth = Math.max(REPLAY_MIN_TRACE_WIDTH, fill.width)
    const baseBorderWidth = Math.max(0, border.width)
    // Keep the preview camera-independent and match the renderer's minimum projected marker diameter.
    const baseMarkerDiameter = 8

    return (
        <div className="basic-replay-settings-row basic-replay-appearance" role="group" aria-label="Trace and marker appearance">
            <WaIcon name="paintbrush" variant="regular" label=""/>
            <div className="basic-replay-appearance__colors">
                <WaColorPicker id="basic-replay-border-color" size="s" aria-label="Replay border color"
                               value={border.color} swatches={swatches} disabled={!borderEnabled}
                               onInput={event => updatePresentation({borderColor: event.currentTarget.value})}/>
                <WaColorPicker id="basic-replay-fill-color" size="s" aria-label="Replay fill color"
                               value={fill.color} swatches={swatches}
                               onInput={event => updatePresentation({fillColor: event.currentTarget.value})}/>
                {canSwapColors && (
                    <>
                        <WaButton className="square-button small basic-replay-appearance__swap" size="s" appearance="plain"
                                  id={swapTooltipId} aria-label="Swap Replay fill and border colors"
                                  onClick={handleSwapColors}>
                            <WaIcon name="arrow-right-arrow-left" variant="regular" library={LGS1920_ICON_LIBRARY} size="s" aria-hidden="true"/>
                        </WaButton>
                        <WaTooltip for={swapTooltipId} placement="top">{'Swap Replay fill and border colors'}</WaTooltip>
                    </>
                )}
            </div>
            <WaRadioGroup className="basic-replay-appearance__border-mode wa-visually-hidden-label"
                          label="Replay trace border" orientation="horizontal" size="s"
                          value={borderEnabled ? 'bordered' : 'filled'}
                          onChange={event => updatePresentation({borderEnabled: event.currentTarget.value === 'bordered'})}>
                <WaRadio key="bordered" id="basic-replay-with-border" value="bordered" appearance="button"
                         className={`video-choice-button${borderEnabled ? ' is-selected' : ''}`}
                         aria-label="Trace with border">
                    <span className="basic-replay-appearance__choice">
                        <svg className="basic-replay-appearance__marker" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="8" fill={fill.color} stroke={border.color} strokeWidth="2"/>
                        </svg>
                    </span>
                </WaRadio>
                <WaRadio key="filled" id="basic-replay-without-border" value="filled" appearance="button"
                         className={`video-choice-button${!borderEnabled ? ' is-selected' : ''}`}
                         aria-label="Trace without border">
                    <span className="basic-replay-appearance__choice">
                        <svg className="basic-replay-appearance__marker" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="7" fill={fill.color}/>
                        </svg>
                    </span>
                </WaRadio>
            </WaRadioGroup>
            <WaButton id="basic-replay-appearance-reset" className="basic-replay-appearance__reset" size="s" appearance="plain"
                      aria-label="Reset Replay appearance to defaults"
                      onClick={() => updatePresentation({
                          fillColor: factoryPresentation.fillColor,
                          borderColor: factoryPresentation.borderColor,
                          sizeScale: factoryPresentation.sizeScale,
                          markerSizeScale: factoryPresentation.markerSizeScale,
                          borderEnabled: factoryPresentation.borderEnabled,
                      })}>
                <WaIcon name="arrow-rotate-left" variant="regular" label=""/>
            </WaButton>
            <WaRadioGroup className="basic-replay-appearance__sizes wa-visually-hidden-label"
                          label="Replay marker and line size" orientation="horizontal" size="s"
                          value={String(presentation.sizeScale)}
                          onChange={event => {
                              const scale = Number(event.currentTarget.value)
                              updatePresentation({sizeScale: scale, markerSizeScale: scale === 0.65 ? 1 : scale})
                          }}>
                {BASIC_REPLAY_SIZE_SCALES.map((scale, index) => {
                    const selected = presentation.sizeScale === scale
                    const fillWidth = baseFillWidth * scale
                    const borderWidth = baseBorderWidth * scale
                    const markerScale = scale === 0.65 ? 1 : scale
                    const markerDiameter = baseMarkerDiameter * markerScale
                    const sizeLabel = BASIC_REPLAY_SIZE_LABELS[index]
                    return (
                        <WaRadio key={scale} id={`basic-replay-size-${sizeLabel}`} value={String(scale)} appearance="button"
                                  className={`video-choice-button${selected ? ' is-selected' : ''}`}
                                  aria-label={`Replay size ${sizeLabel}`}>
                            <span className="basic-replay-appearance__choice">
                                <svg className="basic-replay-appearance__preview" width="36" height="24" viewBox="0 0 36 24" aria-hidden="true">
                                    {borderEnabled && <line x1="4" x2="32" y1="12" y2="12" stroke={border.color}
                                                           strokeWidth={fillWidth + borderWidth * 2}/>}
                                    <line x1="4" x2="32" y1="12" y2="12" stroke={fill.color} strokeWidth={fillWidth}/>
                                    <circle cx="18" cy="12" r={markerDiameter / 2}
                                            fill={fill.color} stroke={borderEnabled ? border.color : 'none'}
                                            strokeWidth={borderEnabled ? baseBorderWidth * markerScale : 0}/>
                                </svg>
                            </span>
                        </WaRadio>
                    )
                })}
            </WaRadioGroup>
            <WaTooltip for="basic-replay-border-color" placement="top">Border color</WaTooltip>
            <WaTooltip for="basic-replay-fill-color" placement="top">Fill color</WaTooltip>
            <WaTooltip for="basic-replay-with-border" placement="top">With border</WaTooltip>
            <WaTooltip for="basic-replay-without-border" placement="top">No border</WaTooltip>
            <WaTooltip for="basic-replay-appearance-reset" placement="top">Reset</WaTooltip>
            {BASIC_REPLAY_SIZE_LABELS.map(sizeLabel => (
                <WaTooltip key={sizeLabel} for={`basic-replay-size-${sizeLabel}`} placement="top">
                    {sizeLabel[0].toUpperCase() + sizeLabel.slice(1)}
                </WaTooltip>
            ))}
        </div>
    )
}
