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
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WaIcon, WaNumberInput, WaOption, WaSelect, WaSwitch, WaTooltip} from '@awesome.me/webawesome/dist/react'
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
        <div className="basic-replay-settings-row basic-replay-poi-settings" role="group" aria-label="Replay POIs">
            <div className="basic-replay-poi-settings__visibility">
                <WaIcon name="location-dot" variant="regular" label=""/>
                <span>{'Show POIs'}</span>
                <WaTooltip for="basic-replay-poi-visibility" placement="top">
                    {'View POIs'}
                </WaTooltip>
                <WaSelect
                    id="basic-replay-poi-visibility"
                    className="basic-replay-poi-settings__select"
                    aria-label="Show POIs"
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
            <div className="basic-replay-poi-settings__animation">
                <WaTooltip for="basic-replay-poi-animation" placement="top">
                    {'With animation'}
                </WaTooltip>
                <WaSwitch
                    id="basic-replay-poi-animation"
                    className="basic-replay-poi-settings__switch"
                    size="xs"
                    label-at-start width-auto
                    checked={behavior.animatePoisDuringJourneyReplay}
                    onInput={changeAnimation}
                >
                    {'animation'}
                </WaSwitch>
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
    )
}
