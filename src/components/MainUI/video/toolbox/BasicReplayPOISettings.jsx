/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: BasicReplayPOISettings.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-11-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaIcon, WaNumberInput, WaOption, WaSelect, WaSwitch, WaTooltip} from '@awesome.me/webawesome/dist/react'
import {UI_ICONS} from '@Core/ui/metadata/uiActionCatalog'
import {normalizeReplayPOIBehavior, REPLAY_POI_VISIBILITY_MODES} from '@Core/ui/replay/JourneyReplayPOISettings'
import {getBasicReplaySettings, writeBasicReplaySettings} from '@Core/ui/replay/ReplayModeSettings'
import {currentReplayJourney} from '@Core/ui/replay/ReplayUserModeConstants'
import {resolveBasicReplaySettings, syncJourneyBasicReplayPOIBehavior} from '@Core/ui/replay/ReplayUserModes'
import {useOptionalSnapshot} from '@Utils/ValtioUtils'
import {useSnapshot} from 'valtio'

const VISIBILITY_MODE_LABELS = {
    yes:  'All',
    no:   'None',
    user: 'User choice',
}

/** Render and persist Basic Replay POI visibility and animation preferences. */
export const BasicReplayPOISettings = () => {
    const settings = useSnapshot(lgs.settings.ui.replay)
    const main = useOptionalSnapshot(lgs.stores.main)
    const journey = main?.theJourney ?? currentReplayJourney()
    const behavior = resolveBasicReplaySettings({
        user: getBasicReplaySettings(settings),
        journey: getBasicReplaySettings(journey?.replay),
    })

    /** Save a global Basic default and the active Journey's Replay override. */
    const saveBehavior = updates => {
        const userSettings = getBasicReplaySettings(lgs.settings.ui.replay) ?? {}
        const currentBehavior = resolveBasicReplaySettings({
            user: userSettings,
            journey: getBasicReplaySettings(currentReplayJourney()?.replay),
        })
        const nextBehavior = normalizeReplayPOIBehavior({...currentBehavior, ...updates})
        lgs.settings.ui.replay = writeBasicReplaySettings(lgs.settings.ui.replay, {
            ...userSettings,
            ...nextBehavior,
        })
        syncJourneyBasicReplayPOIBehavior(nextBehavior, currentReplayJourney())
        __.ui.replay?.refresh?.({camera: false})
    }

    /** Apply the global visibility policy to both preparation and active Replay. */
    const changeVisibilityMode = event => {
        const visibilityMode = event.currentTarget?.value ?? event.target?.value
        if (!REPLAY_POI_VISIBILITY_MODES.includes(visibilityMode)) {
            return
        }

        saveBehavior({poiVisibilityMode: visibilityMode})
    }

    /** Enable or disable centered POI expansion animation for the replay. */
    const changeAnimation = event => {
        const enabled = event.currentTarget?.checked ?? event.target?.checked
        saveBehavior({animatePoisDuringJourneyReplay: enabled === true})
    }

    /** Keep the duration inside the supported one to three second range. */
    const changeAnimationDuration = event => {
        const value = event.currentTarget?.value ?? event.target?.value
        if (`${value ?? ''}`.trim() === '') {
            return
        }

        const duration = normalizeReplayPOIBehavior({poiAnimationDurationSeconds: value})
            .poiAnimationDurationSeconds
        saveBehavior({poiAnimationDurationSeconds: duration})
    }

    return (
        <div className="basic-replay-poi-settings" role="group" aria-label="Replay POIs">
            <div className="basic-replay-settings-row basic-replay-settings-row--split" role="group" aria-label="Show at start">
                <div className="basic-replay-settings-row__legend">
                    <WaIcon {...UI_ICONS.pointOfInterest} label=""/>
                    <span>{'Show at start'}</span>
                </div>
                <div className="basic-replay-settings-row__value">
                    <WaTooltip for="basic-replay-poi-visibility" placement="top">
                        {'Choose which POIs are shown when Replay starts'}
                    </WaTooltip>
                    <WaSelect
                        id="basic-replay-poi-visibility"
                        className="basic-replay-poi-settings__select"
                        aria-label="Show at start"
                        size="s"
                        appearance="filled"
                        value={behavior.poiVisibilityMode}
                        onChange={changeVisibilityMode}
                    >
                        {REPLAY_POI_VISIBILITY_MODES.map(mode => (
                            <WaOption key={mode} value={mode}>
                                {VISIBILITY_MODE_LABELS[mode]}
                            </WaOption>
                        ))}
                    </WaSelect>
                </div>
            </div>
            <div className="basic-replay-settings-row basic-replay-settings-row--split" role="group" aria-label="Animation">
                <div className="basic-replay-settings-row__legend">
                    <span className="basic-replay-settings-row__legend-icon-spacer" aria-hidden="true"/>
                    <span>{'Animation'}</span>
                </div>
                <div className="basic-replay-settings-row__value basic-replay-settings-row__value--poi-animation">
                    <WaTooltip for="basic-replay-poi-animation" placement="top">
                        {'With animation'}
                    </WaTooltip>
                    <WaSwitch
                        id="basic-replay-poi-animation"
                        className="basic-replay-poi-settings__switch"
                        size="xs"
                        aria-label="Animation"
                        checked={behavior.animatePoisDuringJourneyReplay}
                        onInput={changeAnimation}
                    />
                </div>
            </div>
            <div className="basic-replay-settings-row basic-replay-settings-row--split" role="group" aria-label="Duration">
                <div className="basic-replay-settings-row__legend">
                    <span className="basic-replay-settings-row__legend-icon-spacer" aria-hidden="true"/>
                    <span>{'Duration'}</span>
                </div>
                <div className="basic-replay-settings-row__value">
                    <WaTooltip for="basic-replay-poi-duration" placement="top">
                        {'Duration'}
                    </WaTooltip>
                    <WaNumberInput
                        id="basic-replay-poi-duration"
                        className="basic-replay-poi-settings__duration lgs--short-input"
                        aria-label="Animation duration in seconds"
                        size="s"
                        appearance="filled"
                        min={1}
                        max={3}
                        step={1}
                        value={behavior.poiAnimationDurationSeconds}
                        disabled={!behavior.animatePoisDuringJourneyReplay}
                        onInput={changeAnimationDuration}
                    />
                </div>
            </div>
        </div>
    )
}
