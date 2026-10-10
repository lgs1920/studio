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
 * Last modified: 2026-10-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    DEFAULT_REPLAY_CAMERA,
    DEFAULT_REPLAY_PROGRESSION,
    DEFAULT_REPLAY_PROFILE_INFO,
    DEFAULT_SIMPLE_REPLAY_DURATION,
    REPLAY_MARKER_MODE_NAVIGATION,
    REPLAY_TRACE_MODE_PROGRESSIVE,
    defaultJourneyReplayCameraStyle,
    defaultJourneyReplayMarkerStyle,
    defaultJourneyReplayTraceStyle,
    normalizeJourneyReplayCamera,
    normalizeJourneyReplayMarker,
    normalizeJourneyReplayProgressionStyle,
    normalizeJourneyReplayProfileInfo,
    normalizeJourneyReplayTrace,
    normalizeSimpleReplayDuration,
} from './JourneyReplayProgressionStyle'

import {
    currentReplayJourney,
    REPLAY_USER_MODE_BASIC,
    REPLAY_USER_MODE_EXPERT,
    resolveJourneyReplayUserMode,
} from './ReplayUserModeConstants'

export {REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT}
export const DEFAULT_REPLAY_USER_MODE = REPLAY_USER_MODE_BASIC

const clone = value => JSON.parse(JSON.stringify(value))
const expertCameraPersistTimers = new WeakMap()
const expertProgressionPersistTimers = new WeakMap()
const simpleCameraPersistTimers = new WeakMap()
const simpleProgressionPersistTimers = new WeakMap()
const simpleTracePersistTimers = new WeakMap()
const simpleDurationPersistTimers = new WeakMap()
const EXPERT_CAMERA_PERSIST_DELAY_MS = 250

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
 * Normalize an Expert Replay camera using the shared route-relative angle.
 *
 * @param {Object} camera - Candidate Expert camera settings.
 * @returns {Object} Normalized Expert camera settings.
 */
export const normalizeExpertReplayCamera = camera => normalizeJourneyReplayCamera(camera ?? {})

/**
 * Synchronize an Expert camera edit with the current journey and persist it
 * after a short quiet period so slider movement does not write every frame.
 *
 * @param {Object} camera - Complete normalized camera settings.
 * @returns {Object|null} The synchronized camera, or null outside Expert mode.
 */
export const syncJourneyExpertReplayCamera = (camera) => {
    const lgs = globalThis.lgs
    const replaySettings = lgs?.settings?.ui?.replay
    const journey = currentReplayJourney()
    if (resolveJourneyReplayUserMode() !== REPLAY_USER_MODE_EXPERT || !journey || !replaySettings) {
        return null
    }

    const replay = journey.replay ?? {}
    const expert = replay.expert ?? {}
    const nextCamera = normalizeExpertReplayCamera(Object.assign(
        {},
        expert.camera,
        camera,
        {
            hysteresis: {
                ...(expert.camera?.hysteresis ?? {}),
                ...(camera?.hysteresis ?? {}),
            },
            playback: {
                ...(expert.camera?.playback ?? {}),
                ...(camera?.playback ?? {}),
            },
        },
    ))

    journey.replay = {
        ...replay,
        expert: {
            ...expert,
            camera: nextCamera,
        },
    }
    replaySettings.camera = nextCamera
    if (lgs?.stores?.replay) {
        lgs.stores.replay.camera = nextCamera
    }

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = expertCameraPersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        expertCameraPersistTimers.set(journey, setTimeout(() => {
            expertCameraPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextCamera
}

/**
 * Synchronize Expert progression edits with the journey configuration used by
 * Replay resolution and persist them after editing settles.
 *
 * @param {Object} progression - Complete normalized progression settings.
 * @returns {Object|null} The synchronized progression, or null outside Expert mode.
 */
export const syncJourneyExpertReplayProgression = progression => {
    const lgs = globalThis.lgs
    const replaySettings = lgs?.settings?.ui?.replay
    const journey = currentReplayJourney()
    if (resolveJourneyReplayUserMode() !== REPLAY_USER_MODE_EXPERT || !journey || !replaySettings) {
        return null
    }

    const replay = journey.replay ?? {}
    const expert = replay.expert ?? {}
    const nextProgression = normalizeJourneyReplayProgressionStyle(progression)
    journey.replay = {
        ...replay,
        expert: {
            ...expert,
            progression: nextProgression,
        },
    }
    replaySettings.progression = nextProgression
    if (lgs?.stores?.replay) {
        lgs.stores.replay.progression = nextProgression
    }

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = expertProgressionPersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        expertProgressionPersistTimers.set(journey, setTimeout(() => {
            expertProgressionPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextProgression
}

/**
 * Keep an explicitly configured journey Simple camera in sync with its live
 * preparation edits, then persist it after a short quiet period.
 *
 * @param {Object} camera - Complete normalized camera settings.
 * @returns {Object|null} The synchronized camera, or null without journey-level Simple settings.
 */
export const syncJourneySimpleReplayCamera = (camera) => {
    const journey = currentReplayJourney()
    const replay = journey?.replay
    const simple = replay?.simple
    if (!journey || !simple || typeof simple !== 'object') {
        return null
    }

    const nextCamera = normalizeJourneyReplayCamera(Object.assign({}, simple.camera, camera))
    journey.replay = {
        ...replay,
        simple: {
            ...simple,
            camera: nextCamera,
        },
    }

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = simpleCameraPersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        simpleCameraPersistTimers.set(journey, setTimeout(() => {
            simpleCameraPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextCamera
}

/**
 * Synchronize Simple Replay progression edits with explicit journey settings.
 *
 * @param {Object} progression - Complete normalized progression settings.
 * @returns {Object|null} The synchronized progression, or null without journey-level Simple settings.
 */
export const syncJourneySimpleReplayProgression = progression => {
    const journey = currentReplayJourney()
    const replay = journey?.replay
    const simple = replay?.simple
    if (!journey || !simple || typeof simple !== 'object') {
        return null
    }

    const nextProgression = normalizeJourneyReplayProgressionStyle(progression)
    journey.replay = {
        ...replay,
        simple: {
            ...simple,
            presentation: {
                ...(simple.presentation ?? {}),
                progression: nextProgression,
            },
        },
    }

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = simpleProgressionPersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        simpleProgressionPersistTimers.set(journey, setTimeout(() => {
            simpleProgressionPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextProgression
}

/**
 * Synchronize Simple Replay trace style edits with explicit journey settings.
 * The Simple mode keeps its supported progressive rendering policy.
 *
 * @param {Object} trace - Complete trace settings.
 * @returns {Object|null} The synchronized trace settings, or null without journey-level Simple settings.
 */
export const syncJourneySimpleReplayTrace = trace => {
    const journey = currentReplayJourney()
    const replay = journey?.replay
    const simple = replay?.simple
    if (!journey || !simple || typeof simple !== 'object') {
        return null
    }

    const nextTrace = normalizeJourneyReplayTrace({
        ...(simple.trace ?? {}),
        ...trace,
        mode: REPLAY_TRACE_MODE_PROGRESSIVE,
    })
    journey.replay = {
        ...replay,
        simple: {
            ...simple,
            trace: nextTrace,
        },
    }

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = simpleTracePersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        simpleTracePersistTimers.set(journey, setTimeout(() => {
            simpleTracePersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextTrace
}

/**
 * Synchronize an edited Simple Replay duration with an explicitly configured
 * journey and persist it after editing settles.
 *
 * @param {number} duration - Replay duration in seconds.
 * @returns {number|null} The synchronized duration, or null without journey-level Simple settings.
 */
export const syncJourneySimpleReplayDuration = duration => {
    const journey = currentReplayJourney()
    const replay = journey?.replay
    const simple = replay?.simple
    if (!journey || !simple || typeof simple !== 'object') {
        return null
    }

    const nextDuration = normalizeSimpleReplayDuration(duration)
    journey.replay = {
        ...replay,
        simple: {
            ...simple,
            duration: nextDuration,
        },
    }

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = simpleDurationPersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        simpleDurationPersistTimers.set(journey, setTimeout(() => {
            simpleDurationPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextDuration
}

/**
 * Return product defaults for the compact Simple Replay workflow.
 *
 * @returns {Object} Simple Replay defaults.
 */
export const defaultSimpleReplaySettings = () => ({
    duration: DEFAULT_SIMPLE_REPLAY_DURATION,
    camera: {
        ...defaultJourneyReplayCameraStyle(),
        altitudeMode: DEFAULT_REPLAY_CAMERA.altitudeMode,
        altitude: DEFAULT_REPLAY_CAMERA.altitude,
        cameraAngle: DEFAULT_REPLAY_CAMERA.cameraAngle,
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
    marker: {
        ...defaultJourneyReplayMarkerStyle(),
        mode: REPLAY_MARKER_MODE_NAVIGATION,
    },
    trace: {
        ...defaultJourneyReplayTraceStyle(),
        mode: REPLAY_TRACE_MODE_PROGRESSIVE,
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
    const cameraSettings = {
        ...defaults.camera,
        ...(settings?.camera ?? {}),
    }
    const savedCameraAngle = settings?.camera?.cameraAngle
    if (savedCameraAngle === null || savedCameraAngle === undefined || !Number.isFinite(Number(savedCameraAngle))) {
        cameraSettings.cameraAngle = undefined
    }
    const camera = normalizeJourneyReplayCamera(cameraSettings)
    const presentation = settings?.presentation ?? {}

    return {
        duration: normalizeSimpleReplayDuration(settings?.duration),
        camera,
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
        marker: normalizeJourneyReplayMarker({
            ...defaults.marker,
            ...(settings?.marker ?? {}),
            mode: REPLAY_MARKER_MODE_NAVIGATION,
        }),
        trace: normalizeJourneyReplayTrace({
            ...defaults.trace,
            ...(settings?.trace ?? {}),
            mode: REPLAY_TRACE_MODE_PROGRESSIVE,
        }),
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
    marker: {
        ...(product?.marker ?? {}),
        ...(user?.marker ?? {}),
        ...(journey?.marker ?? {}),
    },
    trace: {
        ...(product?.trace ?? {}),
        ...(user?.trace ?? {}),
        ...(journey?.trace ?? {}),
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
            camera: normalizeExpertReplayCamera(simple?.camera),
            progression: normalizeJourneyReplayProgressionStyle(simple?.presentation?.progression),
            profileInfo: normalizeJourneyReplayProfileInfo(simple?.presentation?.profileInfo),
        },
    }
}
