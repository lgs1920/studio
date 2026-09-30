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
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const REPLAY_USER_MODE_BASIC = 'basic'
export const REPLAY_USER_MODE_EXPERT = 'expert'

export const isJourneyReplayBasicMode = () => globalThis.lgs?.settings?.ui?.replay?.userMode === REPLAY_USER_MODE_BASIC
    || globalThis.lgs?.stores?.replay?.userMode === REPLAY_USER_MODE_BASIC
    || globalThis.lgs?.stores?.replay?.simplePreparationActive === true
