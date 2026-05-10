/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyStatisticsSettings.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { Track } from '@Core/Track'
import { UPDATE_JOURNEY_SILENTLY } from '@Core/constants'
import { Utils } from '@Editor/Utils'
import {
    WaButton, WaCallout, WaDivider, WaIcon, WaInput, WaOption, WaSelect,
}                            from '@web.awesome.me/webawesome-pro/dist/react'
import { useMemo, useState } from 'react'
import { useSnapshot }                  from 'valtio/index'

const SPEED_FACTOR = 3.6

const THRESHOLDS = [
    {
        key:       'maxSpeed',
        label:     'Maximum speed',
        suffix:    'km/h',
        step:      0.1,
        precision: 1,
        toDisplay: value => value * SPEED_FACTOR,
        toStorage: value => value / SPEED_FACTOR,
        hint:      'Segments faster than this value are ignored as GPS spikes.',
    },
    {
        key:       'maxClimbRate',
        label:     'Maximum climb rate',
        suffix:    'm/s',
        step:      0.1,
        precision: 2,
        hint:      'Positive elevation changes above this vertical rate are treated as impossible.',
    },
    {
        key:       'maxDescentRate',
        label:     'Maximum descent rate',
        suffix:    'm/s',
        step:      0.1,
        precision: 2,
        hint:      'Negative elevation changes above this vertical rate are treated as impossible.',
    },
    {
        key:       'stopDuration',
        label:     'Stop duration',
        suffix:    's',
        step:      1,
        precision: 0,
        hint:      'A low-speed segment lasting at least this duration is counted as idle time.',
    },
    {
        key:       'stopSpeedLimit',
        label:     'Stop speed limit',
        suffix:    'km/h',
        step:      0.1,
        precision: 1,
        toDisplay: value => value * SPEED_FACTOR,
        toStorage: value => value / SPEED_FACTOR,
        hint:      'Segments below this speed can be considered stopped when they last long enough.',
    },
]

const roundValue = (value, precision = 2) => {
    if (!Number.isFinite(value)) {
        return ''
    }
    return Number.parseFloat(value.toFixed(precision))
}

const getStandardProfile = activityId => {
    return Track.DEFAULT_ACTIVITY_PROFILES.find(profile => profile.id === activityId)
           ?? Track.DEFAULT_ACTIVITY_PROFILES.find(profile => profile.id === Track.DEFAULT_ACTIVITY)
}

const setActivityThreshold = (activityId, key, value) => {
    const types = lgs.settings.journey.activity.types
    const index = types.findIndex(profile => profile.id === activityId)

    if (index >= 0) {
        types[index][key] = value
    }

    return index >= 0
}

const resetActivityThresholds = (activityId, standardProfile) => {
    const types = lgs.settings.journey.activity.types
    const index = types.findIndex(profile => profile.id === activityId)

    if (index < 0) {
        return false
    }

    THRESHOLDS.forEach(({key}) => {
        types[index][key] = standardProfile[key]
    })
    return true
}

const hasCustomThresholds = (profile, standardProfile) => {
    if (!profile || !standardProfile) {
        return false
    }

    return THRESHOLDS.some(({key}) => Number(profile[key]) !== Number(standardProfile[key]))
}

export const JourneyStatisticsSettings = () => {
    const $activity = lgs.settings.journey.activity
    const activity = useSnapshot($activity)
    const refreshJourneyStatistics = useMemo(() => __.tools.debounce(async (activityId) => {
        const editorJourney = lgs.theJourneyEditorProxy?.journey
        if (!editorJourney?.slug || editorJourney.activity !== activityId) {
            return
        }

        const updated = await Utils.updateJourney(UPDATE_JOURNEY_SILENTLY, {focus: false})
        updated.addToContext()
        updated.addToEditor()

        const track = updated.tracks.get(lgs.theJourneyEditorProxy.track?.slug) ?? Array.from(updated.tracks.values())[0]
        track?.addToContext()
        track?.addToEditor()

        Utils.renderJourneySettings()
        __.ui.profiler?.draw()
    }, 350), [])

    const profiles = useMemo(() => {
        return Array.isArray(activity.types) && activity.types.length > 0
               ? activity.types
               : Track.DEFAULT_ACTIVITY_PROFILES
    }, [activity.types])

    const [selectedActivity, setSelectedActivity] = useState(activity.default ?? profiles[0]?.id ?? Track.DEFAULT_ACTIVITY)
    const selectedProfileId = profiles.some(profile => profile.id === selectedActivity)
                              ? selectedActivity
                              : activity.default ?? profiles[0]?.id ?? Track.DEFAULT_ACTIVITY
    const selectedProfile = profiles.find(profile => profile.id === selectedProfileId) ?? profiles[0]
    const standardProfile = getStandardProfile(selectedProfile?.id)
    const isModified = hasCustomThresholds(selectedProfile, standardProfile)

    const updateThreshold = (key, event) => {
        const input = Number.parseFloat(event.target.value)
        if (!Number.isFinite(input) || input < 0) {
            return
        }

        const field = THRESHOLDS.find(item => item.key === key)
        const value = field?.toStorage ? field.toStorage(input) : input

        if (setActivityThreshold(selectedProfile.id, key, roundValue(value, 4))) {
            refreshJourneyStatistics(selectedProfile.id)
        }
    }

    const isThresholdModified = (key) => {
        return Number(selectedProfile?.[key]) !== Number(standardProfile?.[key])
    }

    const resetThreshold = (key) => {
        if (!selectedProfile || !standardProfile) {
            return
        }

        if (setActivityThreshold(selectedProfile.id, key, standardProfile[key])) {
            refreshJourneyStatistics(selectedProfile.id)
        }
    }

    const resetProfile = () => {
        if (!selectedProfile || !standardProfile) {
            return
        }

        if (resetActivityThresholds(selectedProfile.id, standardProfile)) {
            refreshJourneyStatistics(selectedProfile.id)
        }
    }

    const displayValue = (field) => {
        const value = Number(selectedProfile?.[field.key])
        const display = field.toDisplay ? field.toDisplay(value) : value
        return roundValue(display, field.precision)
    }

    return (
        <>
            <span slot="summary">
                <WaIcon name="chart-line" variant="regular"/>
                {' Journey Statistics '}
            </span>
            <WaDivider/>
            <div className="journey-statistics-scroll-area">
                <LGSScrollbars>
                    <div id="journey-statistics-settings">
                        <WaCallout open variant="neutral">
                            <WaIcon slot="icon" name="circle-info" variant="regular"/>
                            {
                                'Choose the activity profile to tune here. The activity used by a journey is selected in the journey editor; these thresholds only define how statistics are cleaned for that activity.'
                            }
                        </WaCallout>

                        <div className="journey-statistics-settings-row">
                            <WaSelect
                                label="Activity profile"
                                size="s"
                                value={selectedProfileId}
                                onChange={(event) => setSelectedActivity(event.target.value)}
                            >
                                {profiles.map(profile => (
                                    <WaOption key={profile.id} value={profile.id}>
                                        {profile.icon && <WaIcon slot="start" name={profile.icon} variant="regular"/>}
                                        {profile.label}
                                    </WaOption>
                                ))}
                            </WaSelect>
                            <WaButton
                                size="s"
                                appearance="outlined"
                                variant="brand"
                                disabled={!isModified}
                                onClick={resetProfile}
                            >
                                <WaIcon name="arrow-rotate-left" variant="regular"/>
                            </WaButton>
                        </div>

                        <div className="journey-statistics-threshold-grid">
                            {THRESHOLDS.map(field => (
                                <div className="journey-statistics-threshold-row" key={field.key}>
                                    <div className="journey-statistics-threshold-field">
                                        <WaInput
                                            className="journey-statistics-threshold-input"
                                            label={field.label}
                                            size="s"
                                            type="number"
                                            min="0"
                                            step={field.step}
                                            value={displayValue(field)}
                                            onInput={(event) => updateThreshold(field.key, event)}
                                            withoutSpinButtons
                                        >
                                            <span slot="end">{field.suffix}</span>
                                        </WaInput>
                                        <span className="journey-statistics-threshold-hint">{field.hint}</span>
                                    </div>
                                    <WaButton
                                        className="journey-statistics-field-reset"
                                        size="s"
                                        appearance="plain"
                                        variant="brand"
                                        disabled={!isThresholdModified(field.key)}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            resetThreshold(field.key)
                                        }}
                                        aria-label={`Reset ${field.label}`}
                                        title={`Reset ${field.label}`}
                                    >
                                        <WaIcon name="arrow-rotate-left" variant="regular"/>
                                    </WaButton>
                                </div>
                            ))}
                        </div>
                    </div>
                </LGSScrollbars>
            </div>
        </>
    )
}
