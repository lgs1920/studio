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
import { Utils } from '@Editor/Utils'
import {
    WaButton, WaCallout, WaDivider, WaIcon, WaInput, WaOption, WaSelect,
}                            from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useMemo, useState } from 'react'
import { useSnapshot }                  from 'valtio/index'

const SPEED_FACTOR = 3.6
const PACE_FACTOR = 1000 / 60

const THRESHOLDS = [
    {
        key:       'minSegmentDuration',
        label:     'Minimum segment duration',
        suffix:    's',
        step:      1,
        precision: 0,
        default:   2,
        hint:      'Segments shorter than this duration do not contribute to speed and pace cleaning.',
    },
    {
        key:       'minSegmentDistance',
        label:     'Minimum segment distance',
        suffix:    'm',
        step:      1,
        precision: 0,
        default:   3,
        hint:      'Segments shorter than this distance do not contribute to speed and pace cleaning.',
    },
    {
        key:       'altitudeSmoothingWindow',
        label:     'Altitude smoothing window',
        suffix:    'pt',
        step:      1,
        precision: 0,
        default:   3,
        hint:      'A centered window used to smooth altitude before computing slope and profile statistics.',
    },
    {
        key:       'maxAltitudeJump',
        label:     'Maximum altitude jump',
        suffix:    'm',
        step:      1,
        precision: 0,
        default:   10,
        hint:      'Altitude changes above this value are clipped before smoothing to remove GNSS spikes.',
    },
    {
        key:       'maxSpeed',
        label:     'Maximum speed',
        suffix:    'km/h',
        step:      0.1,
        precision: 1,
        default:   0,
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
        default:   0,
        hint:      'Positive elevation changes above this vertical rate are treated as impossible.',
    },
    {
        key:       'maxDescentRate',
        label:     'Maximum descent rate',
        suffix:    'm/s',
        step:      0.1,
        precision: 2,
        default:   0,
        hint:      'Negative elevation changes above this vertical rate are treated as impossible.',
    },
    {
        key:       'maxPace',
        label:     'Maximum pace',
        suffix:    'min/km',
        step:      0.1,
        precision: 1,
        default:   0,
        toDisplay: value => value * PACE_FACTOR,
        toStorage: value => value / PACE_FACTOR,
        hint:      'Segments slower than this pace are treated as unreliable for speed and pace extrema.',
    },
    {
        key:       'maxSpeedDelta',
        label:     'Maximum speed delta',
        suffix:    'km/h',
        step:      0.1,
        precision: 1,
        default:   0,
        toDisplay: value => value * SPEED_FACTOR,
        toStorage: value => value / SPEED_FACTOR,
        hint:      'Abrupt speed jumps above this delta are excluded from speed and pace extrema.',
    },
    {
        key:       'stopDuration',
        label:     'Stop duration',
        suffix:    's',
        step:      1,
        precision: 0,
        default:   60,
        hint:      'A low-speed segment lasting at least this duration is counted as idle time.',
    },
    {
        key:       'stopSpeedLimit',
        label:     'Stop speed limit',
        suffix:    'km/h',
        step:      0.1,
        precision: 1,
        default:   0,
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
    const configured = globalThis.lgs?.savedConfiguration?.journey?.activity?.types
    if (Array.isArray(configured) && configured.length > 0) {
        return configured.find(profile => profile.id === activityId)
            ?? configured.find(profile => profile.id === (globalThis.lgs?.savedConfiguration?.journey?.activity?.default ?? Track.DEFAULT_ACTIVITY))
            ?? configured[0]
    }

    return undefined
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

    useEffect(() => {
        Track.ensureActivityCatalogPersistence()
    }, [])

    const refreshJourneyStatistics = useMemo(() => __.tools.debounce(async (activityId) => {
        await Utils.refreshJourneysStatistics(activityId, {focus: false})
    }, 350), [])

    const profiles = useMemo(() => {
        return Array.isArray(activity.types) && activity.types.length > 0
               ? activity.types
               : Track.activityDefaultProfiles()
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
        const fallback = Number.isFinite(Number(standardProfile?.[field.key]))
                          ? Number(standardProfile[field.key])
                          : field.default ?? 0
        const value = Number.isFinite(Number(selectedProfile?.[field.key]))
                      ? Number(selectedProfile[field.key])
                      : fallback
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
                            <WaSelect appearance="filled"
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
                                        <WaInput appearance="filled"
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
