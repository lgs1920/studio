/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayUserModes.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-25
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    DEFAULT_REPLAY_CAMERA,
    DEFAULT_REPLAY_PROGRESSION,
    DEFAULT_REPLAY_PROFILE_INFO,
    defaultJourneyReplayCameraStyle,
    normalizeJourneyReplayCamera,
    normalizeJourneyReplayProgressionStyle,
    normalizeJourneyReplayProfileInfo,
} from './JourneyReplayProgressionStyle'

import {REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT} from './ReplayUserModeConstants'

export {REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT}
export const DEFAULT_REPLAY_USER_MODE = REPLAY_USER_MODE_BASIC

const clone = value => JSON.parse(JSON.stringify(value))

/**
 * Normalize a persisted Replay user mode.
 *
 * @param {*} mode - Persisted mode value.
 * @returns {string} Supported Replay user mode.
 */
export const normalizeReplayUserMode = mode => mode === REPLAY_USER_MODE_EXPERT
    ? REPLAY_USER_MODE_EXPERT
    : REPLAY_USER_MODE_BASIC

/**
 * Return product defaults for the compact Simple Replay workflow.
 *
 * @returns {Object} Simple Replay defaults.
 */
export const defaultSimpleReplaySettings = () => ({
    camera: {
        ...defaultJourneyReplayCameraStyle(),
        positionMode: 'system',
        altitudeMode: 'constant',
        altitude: DEFAULT_REPLAY_CAMERA.altitude,
        heading: DEFAULT_REPLAY_CAMERA.heading,
        pitch: DEFAULT_REPLAY_CAMERA.pitch,
    },
    presentation: {
        progression: {
            ...clone(DEFAULT_REPLAY_PROGRESSION),
            fill: {
                ...clone(DEFAULT_REPLAY_PROGRESSION.fill),
                color: '#ff2525',
                width: DEFAULT_REPLAY_PROGRESSION.fill.width,
            },
            border: {
                ...clone(DEFAULT_REPLAY_PROGRESSION.border),
                color: '#ff2525',
                width: DEFAULT_REPLAY_PROGRESSION.border.width,
            },
        },
        profileInfo: {
            ...DEFAULT_REPLAY_PROFILE_INFO,
            color: '#ffffff',
        },
    },
})

/**
 * Normalize compact Simple Replay settings.
 *
 * @param {Object} settings - Candidate settings.
 * @returns {Object} Normalized settings.
 */
export const normalizeSimpleReplaySettings = (settings = {}) => {
    const defaults = defaultSimpleReplaySettings()
    const camera = normalizeJourneyReplayCamera({
        ...defaults.camera,
        ...(settings?.camera ?? {}),
        altitudeMode: 'constant',
    })
    const presentation = settings?.presentation ?? {}

    return {
        camera: {
            ...camera,
            altitudeMode: 'constant',
        },
        presentation: {
            progression: normalizeJourneyReplayProgressionStyle({
                ...defaults.presentation.progression,
                ...(presentation.progression ?? {}),
                fill: {
                    ...defaults.presentation.progression.fill,
                    ...(presentation.progression?.fill ?? {}),
                },
                border: {
                    ...defaults.presentation.progression.border,
                    ...(presentation.progression?.border ?? {}),
                },
            }),
            profileInfo: normalizeJourneyReplayProfileInfo({
                ...defaults.presentation.profileInfo,
                ...(presentation.profileInfo ?? {}),
            }),
        },
    }
}

/**
 * Resolve Simple Replay settings using journey, user, and product precedence.
 *
 * @param {Object} options - Resolution sources.
 * @returns {Object} Effective Simple Replay settings.
 */
export const resolveSimpleReplaySettings = ({journey, user, product} = {}) => normalizeSimpleReplaySettings({
    ...product,
    ...user,
    ...journey,
    camera: {
        ...(product?.camera ?? {}),
        ...(user?.camera ?? {}),
        ...(journey?.camera ?? {}),
    },
    presentation: {
        ...(product?.presentation ?? {}),
        ...(user?.presentation ?? {}),
        ...(journey?.presentation ?? {}),
    },
})

/**
 * Determine whether a journey contains an explicit Expert Replay definition.
 *
 * @param {Object} journey - Journey or serialized journey.
 * @returns {boolean} True when Expert settings exist.
 */
export const hasExpertReplayConfiguration = journey => Boolean(
    journey?.replay?.expert
    && typeof journey.replay.expert === 'object',
)

/**
 * Initialize Expert settings from Simple Replay without replacing existing data.
 *
 * @param {Object} journey - Journey data to update.
 * @param {Object} simple - Effective Simple Replay settings.
 * @returns {Object} Journey replay data.
 */
export const initializeExpertReplayFromSimple = (journey, simple) => {
    const replay = journey?.replay ?? {}
    if (hasExpertReplayConfiguration(journey)) {
        return replay
    }

    return {
        ...replay,
        expert: {
            camera: normalizeJourneyReplayCamera(simple?.camera),
            progression: normalizeJourneyReplayProgressionStyle(simple?.presentation?.progression),
            profileInfo: normalizeJourneyReplayProfileInfo(simple?.presentation?.profileInfo),
        },
    }
}

/**
 * Reset Expert camera and presentation settings from Simple Replay explicitly.
 *
 * @param {Object} journey - Journey data to update.
 * @param {Object} simple - Effective Simple Replay settings.
 * @returns {Object} Journey replay data.
 */
export const resetExpertReplayFromSimple = (journey, simple) => ({
    ...(journey?.replay ?? {}),
    expert: {
        ...journey?.replay?.expert,
        camera: normalizeJourneyReplayCamera(simple?.camera),
        progression: normalizeJourneyReplayProgressionStyle(simple?.presentation?.progression),
        profileInfo: normalizeJourneyReplayProfileInfo(simple?.presentation?.profileInfo),
    },
})
