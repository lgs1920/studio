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
 * Last modified: 2026-11-07
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaButton, WaColorPicker, WaIcon, WaRadio, WaRadioGroup, WaTooltip} from '@awesome.me/webawesome/dist/react'
import '@awesome.me/webawesome/dist/styles/utilities/visually-hidden.css'
import {
    BASIC_REPLAY_COLOR_MODE_NO_BORDER,
    BASIC_REPLAY_COLOR_MODE_SIDE_BY_SIDE,
    BASIC_REPLAY_COLOR_MODE_WITH_BORDER,
    REPLAY_MIN_TRACE_WIDTH,
    BASIC_REPLAY_SIZE_SCALES,
    resolveBasicReplayPresentation,
} from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {currentReplayJourney} from '@Core/ui/replay/ReplayUserModeConstants'
import {UI_ACTIONS} from '@Core/ui/metadata/uiActionCatalog'
import {LGS1920_ICON_LIBRARY} from '@Utils/useWebAwesomeKits'
import {getBasicReplaySettings, writeBasicReplaySettings} from '@Core/ui/replay/ReplayModeSettings'
import {
    resolveBasicReplaySettings,
    syncJourneyBasicReplayPresentation,
} from '@Core/ui/replay/ReplayUserModes'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useSnapshot} from 'valtio'

const BASIC_REPLAY_SIZE_LABELS = ['thin', 'small', 'medium', 'large']

/** Render one labeled appearance setting and its controls. */
const AppearanceSettingRow = ({label, icon, children, valueClassName = ''}) => (
    <div className="basic-replay-settings-row basic-replay-settings-row--split basic-replay-appearance__row" role="group" aria-label={label}>
        <div className="basic-replay-settings-row__legend">
            <WaIcon name={icon} variant="regular" label=""/>
            <span>{label}</span>
        </div>
        <div className={`basic-replay-settings-row__value${valueClassName ? ` ${valueClassName}` : ''}`}>
            {children}
        </div>
    </div>
)

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
    const borderEnabled = presentation.borderEnabled
    const colorMode = presentation.colorMode
    const sideBySide = colorMode === BASIC_REPLAY_COLOR_MODE_SIDE_BY_SIDE
    const canSwapColors = borderEnabled && !sideBySide

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
        <div className="basic-replay-appearance" role="group" aria-label="Replay appearance">
            <AppearanceSettingRow label="Colour" icon="paintbrush" valueClassName="basic-replay-appearance__color-value">
                <div className="basic-replay-appearance__control-row">
                    <div className="basic-replay-appearance__colors">
                        <WaColorPicker id="basic-replay-border-color" size="s"
                                       aria-label={sideBySide ? 'Replay first color' : 'Replay border color'}
                                       value={border.color} swatches={swatches} disabled={!borderEnabled}
                                       onInput={event => updatePresentation({borderColor: event.currentTarget.value})}/>
                        {canSwapColors && (
                            <>
                                <WaButton id="basic-replay-appearance-swap-colors"
                                          className="square-button small basic-replay-appearance__swap"
                                          size="s"
                                          appearance="plain"
                                          aria-label="Swap border and fill colors"
                                          onClick={() => updatePresentation({borderColor: fill.color, fillColor: border.color})}>
                                    <WaIcon name="arrow-right-arrow-left"
                                            variant="regular"
                                            library={LGS1920_ICON_LIBRARY}
                                            size="s"
                                            label=""/>
                                </WaButton>
                                <WaTooltip for="basic-replay-appearance-swap-colors" placement="top">{'Swap colors'}</WaTooltip>
                            </>
                        )}
                        <WaColorPicker id="basic-replay-fill-color" size="s"
                                       aria-label={sideBySide ? 'Replay second color' : 'Replay fill color'}
                                       value={fill.color} swatches={swatches}
                                       onInput={event => updatePresentation({fillColor: event.currentTarget.value})}/>
                        <WaTooltip for="basic-replay-border-color" placement="top">
                            {sideBySide ? '1st Color' : 'Border Color'}
                        </WaTooltip>
                        <WaTooltip for="basic-replay-fill-color" placement="top">
                            {sideBySide ? '2nd Color' : 'Fill Color'}
                        </WaTooltip>
                    </div>
                    <WaButton id="basic-replay-appearance-reset" className="basic-replay-appearance__reset" size="s" appearance="plain"
                              aria-label={UI_ACTIONS.resetReplayAppearance.label}
                              onClick={() => updatePresentation({
                                  fillColor: factoryPresentation.fillColor,
                                  borderColor: factoryPresentation.borderColor,
                                  sizeScale: factoryPresentation.sizeScale,
                                  markerSizeScale: factoryPresentation.markerSizeScale,
                                  borderEnabled: factoryPresentation.borderEnabled,
                                  colorMode: factoryPresentation.colorMode,
                              })}>
                        <WaIcon {...UI_ACTIONS.resetReplayAppearance.icon} label=""/>
                    </WaButton>
                    <WaTooltip for="basic-replay-appearance-reset" placement="top">
                        {UI_ACTIONS.resetReplayAppearance.label}
                    </WaTooltip>
                </div>
            </AppearanceSettingRow>
            <AppearanceSettingRow label="Type" icon="sliders" valueClassName="basic-replay-appearance__choice-value">
                <WaRadioGroup className="basic-replay-appearance__border-mode wa-visually-hidden-label"
                              label="Replay trace color style" orientation="horizontal" size="s"
                              value={colorMode}
                              onChange={event => updatePresentation({colorMode: event.currentTarget.value})}>
                    <WaRadio key="with-border" id="basic-replay-with-border" value={BASIC_REPLAY_COLOR_MODE_WITH_BORDER} appearance="button"
                             className={`video-choice-button${colorMode === BASIC_REPLAY_COLOR_MODE_WITH_BORDER ? ' is-selected' : ''}`}
                             aria-label="Trace with border">
                        <span className="basic-replay-appearance__choice">
                            <svg className="basic-replay-appearance__color-mode-preview" viewBox="0 0 36 24" aria-hidden="true">
                                <rect x="6" y="6" width="24" height="3" fill={border.color}/>
                                <rect x="4" y="9" width="28" height="6" fill={fill.color}/>
                                <rect x="6" y="15" width="24" height="3" fill={border.color}/>
                            </svg>
                        </span>
                    </WaRadio>
                    <WaRadio key="no-border" id="basic-replay-without-border" value={BASIC_REPLAY_COLOR_MODE_NO_BORDER} appearance="button"
                             className={`video-choice-button${colorMode === BASIC_REPLAY_COLOR_MODE_NO_BORDER ? ' is-selected' : ''}`}
                             aria-label="Trace without border">
                        <span className="basic-replay-appearance__choice">
                            <svg className="basic-replay-appearance__color-mode-preview" viewBox="0 0 36 24" aria-hidden="true">
                                <rect x="4" y="6" width="28" height="12" fill={fill.color}/>
                            </svg>
                        </span>
                    </WaRadio>
                    <WaRadio key="side-by-side" id="basic-replay-side-by-side" value={BASIC_REPLAY_COLOR_MODE_SIDE_BY_SIDE} appearance="button"
                             className={`video-choice-button${sideBySide ? ' is-selected' : ''}`}
                             aria-label="Trace side by side">
                        <span className="basic-replay-appearance__choice">
                            <svg className="basic-replay-appearance__side-by-side-preview" viewBox="0 0 36 24" aria-hidden="true">
                                <rect x="6" y="6" width="24" height="6" fill={border.color}/>
                                <rect x="4" y="12" width="28" height="6" fill={fill.color}/>
                            </svg>
                        </span>
                    </WaRadio>
                </WaRadioGroup>
                <WaTooltip for="basic-replay-with-border" placement="top">With border</WaTooltip>
                <WaTooltip for="basic-replay-without-border" placement="top">No border</WaTooltip>
                <WaTooltip for="basic-replay-side-by-side" placement="top">Side by side</WaTooltip>
            </AppearanceSettingRow>
            <AppearanceSettingRow label="Size" icon="ruler-vertical" valueClassName="basic-replay-appearance__choice-value">
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
                        const sideBySideWidth = fillWidth + borderWidth * 2
                        const markerScale = scale === 0.65 ? 1 : scale
                        const markerDiameter = baseMarkerDiameter * markerScale
                        const sizeLabel = BASIC_REPLAY_SIZE_LABELS[index]
                        return (
                            <WaRadio key={scale} id={`basic-replay-size-${sizeLabel}`} value={String(scale)} appearance="button"
                                      className={`video-choice-button${selected ? ' is-selected' : ''}`}
                                      aria-label={`Replay size ${sizeLabel}`}>
                                <span className="basic-replay-appearance__choice">
                                    <svg className="basic-replay-appearance__preview" width="36" height="24" viewBox="0 0 36 24" aria-hidden="true">
                                        {sideBySide ? (
                                            <>
                                                <rect x="4" y={12 - sideBySideWidth / 2} width="28" height={sideBySideWidth / 2} fill={border.color}/>
                                                <rect x="4" y="12" width="28" height={sideBySideWidth / 2} fill={fill.color}/>
                                                <circle cx="18" cy="12" r={markerDiameter / 2}
                                                        fill={fill.color} stroke={border.color}
                                                        strokeWidth={baseBorderWidth * markerScale}/>
                                            </>
                                        ) : (
                                            <>
                                                {borderEnabled && <line x1="4" x2="32" y1="12" y2="12" stroke={border.color}
                                                                       strokeWidth={fillWidth + borderWidth * 2}/>}
                                                <line x1="4" x2="32" y1="12" y2="12" stroke={fill.color} strokeWidth={fillWidth}/>
                                                <circle cx="18" cy="12" r={markerDiameter / 2}
                                                        fill={fill.color} stroke={borderEnabled ? border.color : 'none'}
                                                        strokeWidth={borderEnabled ? baseBorderWidth * markerScale : 0}/>
                                            </>
                                        )}
                                    </svg>
                                </span>
                            </WaRadio>
                        )
                    })}
                </WaRadioGroup>
                {BASIC_REPLAY_SIZE_LABELS.map(sizeLabel => (
                    <WaTooltip key={sizeLabel} for={`basic-replay-size-${sizeLabel}`} placement="top">
                        {sizeLabel[0].toUpperCase() + sizeLabel.slice(1)}
                    </WaTooltip>
                ))}
            </AppearanceSettingRow>
        </div>
    )
}
