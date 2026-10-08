/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayUserModeConstants.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-02-22
 * Last modified: 2026-10-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const REPLAY_USER_MODE_BASIC = 'basic'
export const REPLAY_USER_MODE_EXPERT = 'expert'

/**
 * Resolve the journey selected in the main store, falling back to the legacy
 * global reference while stores finish hydrating.
 *
 * @returns {Object|null} The active journey for Replay.
 */
export const currentReplayJourney = () => globalThis.lgs?.stores?.main?.theJourney
    ?? globalThis.lgs?.theJourney
    ?? null

/**
 * Resolve the selected Replay mode without allowing the runtime store's
 * initial Basic default to override an explicitly saved Expert preference.
 * A live Simple preparation remains authoritative until that preparation is
 * left.
 *
 * @param {Object} options - Optional settings and runtime state.
 * @param {Object|null} [options.settings] - Persisted Replay settings.
 * @param {Object|null} [options.replay] - Replay runtime state.
 * @returns {string} The effective Replay user mode.
 */
export const resolveJourneyReplayUserMode = ({
    settings = globalThis.lgs?.settings?.ui?.replay,
    replay = globalThis.lgs?.stores?.replay,
} = {}) => {
    if (replay?.simplePreparationActive === true) {
        return REPLAY_USER_MODE_BASIC
    }

    if (settings?.userMode === REPLAY_USER_MODE_BASIC || settings?.userMode === REPLAY_USER_MODE_EXPERT) {
        return settings.userMode
    }

    if (replay?.userMode === REPLAY_USER_MODE_BASIC || replay?.userMode === REPLAY_USER_MODE_EXPERT) {
        return replay.userMode
    }

    return REPLAY_USER_MODE_BASIC
}

export const isJourneyReplayBasicMode = options => resolveJourneyReplayUserMode(options) === REPLAY_USER_MODE_BASIC
