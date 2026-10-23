/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayModeSettings.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-17
 * Last modified: 2026-10-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Check whether a value can contain Replay settings. */
const isSettingsObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Named sample budgets and their toolbar glyphs for Basic Replay. */
export const REPLAY_SAMPLE_COUNT_OPTIONS = Object.freeze([
    {value: 512, label: 'Low', icon: 'square-l'},
    {value: 1024, label: 'Basic', icon: 'square-b'},
    {value: 2048, label: 'Medium', icon: 'square-m'},
    {value: 4096, label: 'High', icon: 'square-h'},
])

/** Default to the Basic route-rendering sample budget. */
export const DEFAULT_REPLAY_SAMPLE_COUNT = 1024

/**
 * Normalize a requested Replay render sample budget to one supported level.
 * @param {number|string} value - Requested number of sampled route points.
 * @returns {number} Supported point count, defaulting to Basic.
 */
export const normalizeReplaySampleCount = value => {
    const numericValue = Number(value)
    const option = REPLAY_SAMPLE_COUNT_OPTIONS.find(item => item.value === numericValue)
    return option?.value ?? DEFAULT_REPLAY_SAMPLE_COUNT
}

/**
 * Read the `basic` key first and use the legacy `simple` key only when `basic` is absent.
 *
 * @param {Object|null} replaySettings - Replay settings from storage or runtime.
 * @returns {Object|null} Basic Replay settings, or null when none are stored.
 */
export const getBasicReplaySettings = replaySettings => {
    if (isSettingsObject(replaySettings) && Object.prototype.hasOwnProperty.call(replaySettings, 'basic')) {
        return isSettingsObject(replaySettings.basic) ? replaySettings.basic : null
    }
    if (isSettingsObject(replaySettings?.simple)) {
        return replaySettings.simple
    }
    return null
}

/**
 * Store Basic Replay settings in place and remove the legacy `simple` key.
 *
 * @param {Object|null} replaySettings - Existing Replay settings.
 * @param {Object|null} basicSettings - Basic Replay settings to store.
 * @returns {Object} Replay settings containing only the current Basic key.
 */
export const writeBasicReplaySettings = (replaySettings, basicSettings) => {
    const nextSettings = isSettingsObject(replaySettings) ? replaySettings : {}
    delete nextSettings.simple
    nextSettings.basic = basicSettings
    return nextSettings
}

/**
 * Migrate stored Replay settings to the Basic key, preferring it when both keys exist.
 *
 * @param {Object|null} replaySettings - Persisted or runtime Replay settings.
 * @returns {{settings: Object|null, migrated: boolean}} Migrated settings and whether the legacy key was removed.
 */
export const migrateLegacyBasicReplaySettings = replaySettings => {
    if (!isSettingsObject(replaySettings) || !Object.prototype.hasOwnProperty.call(replaySettings, 'simple')) {
        return {settings: replaySettings, migrated: false}
    }

    return {
        settings: writeBasicReplaySettings(replaySettings, getBasicReplaySettings(replaySettings)),
        migrated: true,
    }
}
