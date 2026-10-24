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
 * Last modified: 2026-10-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    DEFAULT_REPLAY_CAMERA,
    REPLAY_INITIAL_CAMERA_ANGLE,
    defaultJourneyReplayBasicSettings,
    normalizeJourneyReplayCamera,
    normalizeJourneyReplayMarker,
    normalizeJourneyReplayProgressionStyle,
    normalizeJourneyReplayProfileInfo,
    normalizeJourneyReplayTrace,
    normalizeBasicReplayDuration,
    resolveBasicReplayPresentation,
    toGlobalReplayCameraSettings,
} from './JourneyReplayProgressionStyle'

import {
    currentReplayJourney,
    REPLAY_USER_MODE_BASIC,
    REPLAY_USER_MODE_EXPERT,
    resolveJourneyReplayUserMode,
} from './ReplayUserModeConstants'
import {
    DEFAULT_REPLAY_SAMPLE_COUNT,
    getBasicReplaySettings,
    normalizeBasicReplayEndFocus,
    normalizeReplaySampleCount,
    writeBasicReplaySettings,
} from './ReplayModeSettings'
import {normalizeReplayPOIBehavior} from './JourneyReplayPOISettings'

export {REPLAY_USER_MODE_BASIC, REPLAY_USER_MODE_EXPERT}
export const DEFAULT_REPLAY_USER_MODE = REPLAY_USER_MODE_BASIC

const hasFiniteCameraValue = value => value !== null && value !== undefined && Number.isFinite(Number(value))
const journeyReplayCameraAngle = camera => {
    if (hasFiniteCameraValue(camera?.cameraAngle)) {
        return Number(camera.cameraAngle)
    }
    if (camera?.positionMode === 'ahead' || camera?.positionMode === 'behind') {
        return normalizeJourneyReplayCamera(camera).cameraAngle
    }
    return REPLAY_INITIAL_CAMERA_ANGLE
}
const expertCameraPersistTimers = new WeakMap()
const expertProgressionPersistTimers = new WeakMap()
const basicCameraPersistTimers = new WeakMap()
const basicTracePersistTimers = new WeakMap()
const basicDurationPersistTimers = new WeakMap()
const basicSampleCountPersistTimers = new WeakMap()
const basicEndFocusPersistTimers = new WeakMap()
const basicPresentationPersistTimers = new WeakMap()
const basicPOIBehaviorPersistTimers = new WeakMap()
const journeyReplayStartPositionPersistPromises = new WeakMap()
const EXPERT_CAMERA_PERSIST_DELAY_MS = 250

/**
 * Normalize a Replay departure marker position as a fraction of the crop.
 *
 * @param {Object} position - Candidate crop-relative coordinates.
 * @returns {{x: number, y: number}|null} Normalized position or null when invalid.
 */
export const normalizeJourneyReplayStartPosition = position => {
    const x = Number(position?.x)
    const y = Number(position?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null
    }

    return {
        x: Math.min(1, Math.max(0, x)),
        y: Math.min(1, Math.max(0, y)),
    }
}

/**
 * Read the saved departure position for the active Replay mode.
 *
 * @param {Object|null} journey - Journey supplying Replay configuration.
 * @param {string} mode - Replay mode, either `basic` or `expert`.
 * @returns {{x: number, y: number}|null} Saved crop-relative position.
 */
export const journeyReplayStartPosition = (journey, mode) => {
    const settings = mode === REPLAY_USER_MODE_EXPERT
        ? journey?.replay?.expert
        : getBasicReplaySettings(journey?.replay)
    return normalizeJourneyReplayStartPosition(settings?.startPosition)
}

/**
 * Persist the departure marker's crop-relative position on its Journey.
 *
 * @param {Object} position - Crop-relative coordinates in the range 0 to 1.
 * @param {Object|null} journey - Journey receiving the position.
 * @param {string} mode - Replay mode, either `basic` or `expert`.
 * @returns {{x: number, y: number}|null} Persisted position or null when invalid.
 */
export const syncJourneyReplayStartPosition = (position, journey, mode) => {
    const normalized = normalizeJourneyReplayStartPosition(position)
    if (!journey || !normalized) {
        return null
    }

    const replay = journey.replay ?? {}
    if (mode === REPLAY_USER_MODE_EXPERT) {
        journey.replay = {
            ...replay,
            expert: {
                ...(replay.expert ?? {}),
                startPosition: normalized,
            },
        }
    }
    else {
        journey.replay = writeBasicReplaySettings(replay, {
            ...(getBasicReplaySettings(replay) ?? {}),
            startPosition: normalized,
        })
    }
    if (typeof journey.persistToDatabase === 'function') {
        const previousPersistence = journeyReplayStartPositionPersistPromises.get(journey)
        const persistence = previousPersistence
            ? previousPersistence.catch(() => {}).then(() => journey.persistToDatabase())
            : Promise.resolve().then(() => journey.persistToDatabase())
        journeyReplayStartPositionPersistPromises.set(journey, persistence)
        void persistence.catch(error => {
            console.error(`[Replay persistence] Failed to save the start position for ${journey.slug ?? 'a Journey'}.`, error)
        })
    }
    return normalized
}

/**
 * Wait for queued departure-position writes before Replay consumes the prepared pose.
 *
 * @param {Object|null} journey - Journey whose departure position was updated.
 * @returns {Promise<boolean>} Whether a queued write was flushed.
 */
export const flushJourneyReplayStartPositionPersistence = async journey => {
    if (!journey) {
        return false
    }

    const persistence = journeyReplayStartPositionPersistPromises.get(journey)
    if (!persistence) {
        return false
    }

    await persistence
    if (journeyReplayStartPositionPersistPromises.get(journey) === persistence) {
        journeyReplayStartPositionPersistPromises.delete(journey)
    }
    return true
}

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
 * @param {Object|null} [journeyOverride=null] - Journey receiving the settings.
 * @returns {Object|null} The synchronized camera, or null outside Expert mode.
 */
export const syncJourneyExpertReplayCamera = (camera, journeyOverride = null) => {
    const lgs = globalThis.lgs
    const replaySettings = lgs?.settings?.ui?.replay
    const journey = journeyOverride ?? currentReplayJourney()
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
    replaySettings.camera = toGlobalReplayCameraSettings(nextCamera)
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
 * Keep the current journey's Basic camera in sync with its live edits, then
 * persist it after a short quiet period.
 *
 * @param {Object} camera - Complete normalized camera settings.
 * @param {Object|null} [journeyOverride=null] - Journey receiving the settings.
 * @returns {Object|null} The synchronized camera, or null without a journey.
 */
export const syncJourneyBasicReplayCamera = (camera, journeyOverride = null) => {
    const journey = journeyOverride ?? currentReplayJourney()
    if (!journey) {
        return null
    }

    const replay = journey.replay ?? {}
    const basic = getBasicReplaySettings(replay) ?? {}
    const nextCamera = normalizeJourneyReplayCamera(Object.assign({}, basic.camera, camera, {debug: false}))
    journey.replay = writeBasicReplaySettings(replay, {
        ...basic,
        camera: nextCamera,
    })

    const replaySettings = globalThis.lgs?.settings?.ui?.replay
    if (replaySettings) {
        replaySettings.camera = toGlobalReplayCameraSettings(nextCamera)
        const basicSettings = getBasicReplaySettings(replaySettings)
        if (basicSettings?.camera && typeof basicSettings.camera === 'object') {
            globalThis.lgs.settings.ui.replay = writeBasicReplaySettings(replaySettings, {
                ...basicSettings,
                camera: toGlobalReplayCameraSettings(nextCamera),
            })
        }
    }

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = basicCameraPersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        basicCameraPersistTimers.set(journey, setTimeout(() => {
            basicCameraPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextCamera
}

/**
 * Persist a pending Basic or Expert camera edit before Replay recording starts.
 *
 * @param {Object|null} journey - Journey whose camera settings are being committed.
 * @returns {Promise<boolean>} Whether a pending camera edit was persisted.
 */
export const flushJourneyReplayCameraPersistence = async journey => {
    if (!journey || typeof journey.persistToDatabase !== 'function') {
        return false
    }

    let pending = false
    for (const timers of [basicCameraPersistTimers, expertCameraPersistTimers]) {
        const timer = timers.get(journey)
        if (timer === undefined) {
            continue
        }
        clearTimeout(timer)
        timers.delete(journey)
        pending = true
    }
    if (!pending) {
        return false
    }

    await journey.persistToDatabase()
    return true
}

/**
 * Synchronize Basic Replay trace style edits with explicit journey settings.
 *
 * @param {Object} trace - Complete trace settings.
 * @returns {Object|null} The synchronized trace settings, or null without journey-level Basic settings.
 */
export const syncJourneyBasicReplayTrace = trace => {
    const journey = currentReplayJourney()
    const replay = journey?.replay
    const basic = getBasicReplaySettings(replay)
    if (!journey || !basic) {
        return null
    }

    const nextTrace = normalizeJourneyReplayTrace({
        ...(basic.trace ?? {}),
        ...trace,
    })
    journey.replay = writeBasicReplaySettings(replay, {
        ...basic,
        trace: nextTrace,
    })

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = basicTracePersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        basicTracePersistTimers.set(journey, setTimeout(() => {
            basicTracePersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextTrace
}

/**
 * Synchronize an edited Basic Replay duration with an explicitly configured
 * journey and persist it after editing settles.
 *
 * @param {number} duration - Replay duration in seconds.
 * @returns {number|null} The synchronized duration, or null without journey-level Basic settings.
 */
export const syncJourneyBasicReplayDuration = duration => {
    const journey = currentReplayJourney()
    const replay = journey?.replay
    const basic = getBasicReplaySettings(replay)
    if (!journey || !basic) {
        return null
    }

    const nextDuration = normalizeBasicReplayDuration(duration)
    journey.replay = writeBasicReplaySettings(replay, {
        ...basic,
        duration: nextDuration,
    })

    if (typeof journey.persistToDatabase === 'function') {
        const pendingTimer = basicDurationPersistTimers.get(journey)
        if (pendingTimer !== undefined) {
            clearTimeout(pendingTimer)
        }
        basicDurationPersistTimers.set(journey, setTimeout(() => {
            basicDurationPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextDuration
}

/**
 * Persist the selected Basic Replay sample budget on the current Journey.
 * @param {number|string} sampleCount - Requested number of route samples.
 * @param {Object|null} [journeyOverride=null] - Journey receiving the setting.
 * @returns {number|null} Saved sample count, or null without a Journey.
 */
export const syncJourneyBasicReplaySampleCount = (sampleCount, journeyOverride = null) => {
    const journey = journeyOverride ?? currentReplayJourney()
    if (!journey) {
        return null
    }

    const replay = journey.replay ?? {}
    const basic = getBasicReplaySettings(replay) ?? {}
    const nextSampleCount = normalizeReplaySampleCount(sampleCount ?? DEFAULT_REPLAY_SAMPLE_COUNT)
    journey.replay = writeBasicReplaySettings(replay, Object.assign({}, basic, {sampleCount: nextSampleCount}))

    if (typeof journey.persistToDatabase === 'function') {
        clearTimeout(basicSampleCountPersistTimers.get(journey))
        basicSampleCountPersistTimers.set(journey, setTimeout(() => {
            basicSampleCountPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextSampleCount
}

/**
 * Persist the Basic Replay end-focus switch and duration on the current Journey.
 * @param {Object} endFocus - End-focus settings to save.
 * @param {Object|null} [journeyOverride=null] - Journey receiving the setting.
 * @returns {Object|null} Saved settings, or null without a Journey.
 */
export const syncJourneyBasicReplayEndFocus = (endFocus, journeyOverride = null) => {
    const journey = journeyOverride ?? currentReplayJourney()
    if (!journey) {
        return null
    }

    const replay = journey.replay ?? {}
    const basic = getBasicReplaySettings(replay) ?? {}
    const nextEndFocus = normalizeBasicReplayEndFocus(endFocus)
    journey.replay = writeBasicReplaySettings(replay, Object.assign({}, basic, {endFocus: nextEndFocus}))

    if (typeof journey.persistToDatabase === 'function') {
        clearTimeout(basicEndFocusPersistTimers.get(journey))
        basicEndFocusPersistTimers.set(journey, setTimeout(() => {
            basicEndFocusPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return nextEndFocus
}

/**
 * Return product defaults for the compact Basic Replay workflow.
 *
 * @returns {Object} Basic Replay defaults.
 */
export const defaultBasicReplaySettings = () => {
    const defaults = defaultJourneyReplayBasicSettings()
    const camera = {...defaults.camera}
    delete camera.altitude
    delete camera.pitch
    delete camera.groundOffset

    return {
        ...defaults,
        camera,
        dryRun: false,
    }
}

/** Persist Basic Replay POI behavior on the active Journey after edits settle. */
export const syncJourneyBasicReplayPOIBehavior = (behavior, journey = currentReplayJourney()) => {
    if (!journey) {
        return null
    }

    const normalizedBehavior = normalizeReplayPOIBehavior(behavior)
    const replay = journey.replay ?? {}
    journey.replay = writeBasicReplaySettings(replay, {
        ...(getBasicReplaySettings(replay) ?? {}),
        ...normalizedBehavior,
    })
    if (typeof journey.persistToDatabase === 'function') {
        clearTimeout(basicPOIBehaviorPersistTimers.get(journey))
        basicPOIBehaviorPersistTimers.set(journey, setTimeout(() => {
            basicPOIBehaviorPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }

    return normalizedBehavior
}

/**
 * Persist compact Basic appearance edits on the active journey after input settles.
 * @param {Object} presentation - Complete normalized Basic presentation.
 * @returns {Object|null} Saved presentation, or null without an active journey.
 */
export const syncJourneyBasicReplayPresentation = presentation => {
    const journey = currentReplayJourney()
    if (!journey) {
        return null
    }
    const replay = journey.replay ?? {}
    journey.replay = writeBasicReplaySettings(replay, {
        ...(getBasicReplaySettings(replay) ?? {}),
        presentation,
    })
    if (typeof journey.persistToDatabase === 'function') {
        clearTimeout(basicPresentationPersistTimers.get(journey))
        basicPresentationPersistTimers.set(journey, setTimeout(() => {
            basicPresentationPersistTimers.delete(journey)
            void journey.persistToDatabase()
        }, EXPERT_CAMERA_PERSIST_DELAY_MS))
    }
    return presentation
}

/**
 * Normalize compact Basic Replay settings.
 *
 * @param {Object} settings - Candidate settings.
 * @returns {Object} Normalized settings.
 */
export const normalizeBasicReplaySettings = (settings = {}) => {
    const defaults = defaultBasicReplaySettings()
    const cameraSettings = {
        ...defaults.camera,
        ...(settings?.camera ?? {}),
    }
    const savedCameraAngle = settings?.camera?.cameraAngle
    cameraSettings.cameraAngle = hasFiniteCameraValue(savedCameraAngle)
        ? savedCameraAngle
        : REPLAY_INITIAL_CAMERA_ANGLE
    const camera = normalizeJourneyReplayCamera({
        ...cameraSettings,
        debug: false,
    })
    return {
        ...normalizeReplayPOIBehavior(settings),
        duration: normalizeBasicReplayDuration(settings?.duration ?? defaults.duration),
        endFocus: normalizeBasicReplayEndFocus(settings?.endFocus ?? defaults.endFocus),
        sampleCount: normalizeReplaySampleCount(
            settings?.sampleCount ?? defaults.sampleCount ?? DEFAULT_REPLAY_SAMPLE_COUNT,
        ),
        dryRun: settings?.dryRun === true,
        camera,
        presentation: resolveBasicReplayPresentation(settings?.presentation, defaults.presentation),
        marker: normalizeJourneyReplayMarker({
            ...defaults.marker,
            ...(settings?.marker ?? {}),
        }),
        trace: normalizeJourneyReplayTrace({
            ...defaults.trace,
            ...(settings?.trace ?? {}),
        }),
    }
}

/**
 * Resolve Basic Replay settings using journey, user, and product precedence.
 *
 * @param {Object} options - Resolution sources.
 * @returns {Object} Effective Basic Replay settings.
 */
export const resolveBasicReplaySettings = ({journey, user, product} = {}) => normalizeBasicReplaySettings({
    ...product,
    ...user,
    ...journey,
    // Dry run is an application preference, not a Journey-owned Replay setting.
    dryRun: user?.dryRun === true,
    camera: {
        ...(product?.camera ?? {}),
        ...(user?.camera ?? {}),
        ...(journey?.camera ?? {}),
        altitude: journey?.camera?.altitude ?? journey?.camera?.groundOffset
            ?? product?.camera?.altitude ?? DEFAULT_REPLAY_CAMERA.altitude,
        pitch: journey?.camera?.pitch ?? product?.camera?.pitch ?? DEFAULT_REPLAY_CAMERA.pitch,
        cameraAngle: journeyReplayCameraAngle(journey?.camera),
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
    endFocus: {
        ...(product?.endFocus ?? {}),
        ...(user?.endFocus ?? {}),
        ...(journey?.endFocus ?? {}),
    },
})

/**
 * Resolve Basic Replay preferences for a Journey, including global defaults.
 * @param {Object|null} [journey=currentReplayJourney()] - Journey to resolve.
 * @returns {Object} Effective Basic Replay settings.
 */
export const currentBasicReplaySettingsForJourney = (journey = currentReplayJourney()) => resolveBasicReplaySettings({
    user: getBasicReplaySettings(globalThis.lgs?.settings?.ui?.replay),
    journey: getBasicReplaySettings(journey?.replay),
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
 * Initialize Expert settings from Basic Replay without replacing existing data.
 *
 * @param {Object} journey - Journey data to update.
 * @param {Object} basicSettings - Effective Basic Replay settings.
 * @returns {Object} Journey replay data.
 */
export const initializeExpertReplayFromBasic = (journey, basicSettings) => {
    const replay = journey?.replay ?? {}
    if (hasExpertReplayConfiguration(journey)) {
        return replay
    }

    const savedBasicCamera = getBasicReplaySettings(journey?.replay)?.camera ?? {}
    const camera = normalizeExpertReplayCamera({
        ...basicSettings?.camera,
        cameraAngle: journeyReplayCameraAngle(savedBasicCamera),
    })
    if (!hasFiniteCameraValue(savedBasicCamera.altitude ?? savedBasicCamera.groundOffset)) {
        delete camera.altitude
    }
    if (!hasFiniteCameraValue(savedBasicCamera.pitch)) {
        delete camera.pitch
    }

    return {
        ...replay,
        expert: {
            camera,
            progression: normalizeJourneyReplayProgressionStyle(basicSettings?.presentation?.progression),
            profileInfo: normalizeJourneyReplayProfileInfo(basicSettings?.presentation?.profileInfo),
        },
    }
}
