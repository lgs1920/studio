/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayPOISettings.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-06-11
 * Last modified: 2026-07-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS = 3

const finiteNumber = value => {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const toIntegerSeconds = value => Math.max(0, Math.round(finiteNumber(value) ?? DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS))

export const defaultJourneyReplayPOISettings = () => ({
    displayDurationSeconds: DEFAULT_REPLAY_POI_DISPLAY_DURATION_SECONDS,
    visible:                true,
    animated:               true,
    hiddenFields:           {
        location:    false,
        category:    false,
        altitude:    false,
        coordinates: false,
    },
})

export const normalizeJourneyReplayPOISettings = (settings = {}) => {
    const defaults = defaultJourneyReplayPOISettings()
    return {
        displayDurationSeconds: toIntegerSeconds(
            clamp(
                finiteNumber(settings?.displayDurationSeconds) ?? defaults.displayDurationSeconds,
                0,
                60,
            ),
        ),
        visible:  settings?.visible !== false,
        animated: settings?.animated !== false,
        hiddenFields: {
            location:    settings?.hiddenFields?.location === true,
            category:    settings?.hiddenFields?.category === true,
            altitude:    settings?.hiddenFields?.altitude === true,
            coordinates: settings?.hiddenFields?.coordinates === true,
        },
    }
}
