/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraPitchController.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-03
 * Last modified: 2026-08-04
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Shared logical-time controller for temporary replay camera pitch redirects.
 */

import {finiteNumber} from './JourneyReplayRuntime'
import {clamp} from './JourneyReplayCameraMath'
import {
    JOURNEY_REPLAY_INTERNAL_CALL,
    JOURNEY_REPLAY_INTERNAL_STATE,
} from './JourneyReplayInternal'
import {
    REPLAY_CAMERA_IMMEDIATE_RELIEF_ACTIVATION_MILLIS,
    REPLAY_CAMERA_IMMEDIATE_RELIEF_ATTACK_MILLIS,
    REPLAY_CAMERA_IMMEDIATE_RELIEF_DISTANCE_METERS,
    REPLAY_CAMERA_NEAR_RELIEF_ACTIVATION_MILLIS,
    REPLAY_CAMERA_NEAR_RELIEF_ATTACK_MILLIS,
    REPLAY_CAMERA_NEAR_RELIEF_DISTANCE_METERS,
    REPLAY_CAMERA_NEAR_RELIEF_MAX_PITCH_OFFSET_RADIANS,
} from './JourneyReplayCameraShared'

export const REPLAY_CAMERA_PITCH_PHASE_INACTIVE = 'inactive'
export const REPLAY_CAMERA_PITCH_PHASE_PENDING = 'pending'
export const REPLAY_CAMERA_PITCH_PHASE_ATTACK = 'attack'
export const REPLAY_CAMERA_PITCH_PHASE_HOLD = 'hold'
export const REPLAY_CAMERA_PITCH_PHASE_RELEASE = 'release'

export const REPLAY_CAMERA_PITCH_ACTIVATION_MILLIS = 250
export const REPLAY_CAMERA_PITCH_ATTACK_MILLIS = 900
export const REPLAY_CAMERA_PITCH_RELEASE_CONFIRMATION_MILLIS = 150
export const REPLAY_CAMERA_PITCH_RELEASE_MILLIS = 450
export const REPLAY_CAMERA_SHALLOW_PITCH_THRESHOLD_RADIANS = -Math.PI / 6
export const REPLAY_CAMERA_SHALLOW_MAX_PITCH_OFFSET_RADIANS = 8 * Math.PI / 180
export const REPLAY_CAMERA_MAX_PITCH_OFFSET_RADIANS = 20 * Math.PI / 180

/**
 * Resolve the correction envelope from the nearest terrain obstruction.
 *
 * A close obstruction needs an immediate, wider pitch response so the marker
 * can clear a steep relief before the next replay samples are rendered.
 *
 * @param {number|null} obstructionDistanceMeters - Distance to the nearest obstructing relief.
 * @returns {{maximumPitchOffset: number, activationMillis: number, attackMillis: number}}
 * Adaptive correction envelope.
 */
export const replayCameraPitchCorrectionEnvelope = obstructionDistanceMeters => {
    const distance = obstructionDistanceMeters === null
        || obstructionDistanceMeters === undefined
        || obstructionDistanceMeters === ''
        ? null
        : finiteNumber(obstructionDistanceMeters)
    if (distance !== null && distance <= REPLAY_CAMERA_IMMEDIATE_RELIEF_DISTANCE_METERS) {
        return {
            maximumPitchOffset: REPLAY_CAMERA_NEAR_RELIEF_MAX_PITCH_OFFSET_RADIANS,
            activationMillis:    REPLAY_CAMERA_IMMEDIATE_RELIEF_ACTIVATION_MILLIS,
            attackMillis:         REPLAY_CAMERA_IMMEDIATE_RELIEF_ATTACK_MILLIS,
        }
    }
    if (distance !== null && distance <= REPLAY_CAMERA_NEAR_RELIEF_DISTANCE_METERS) {
        return {
            maximumPitchOffset: REPLAY_CAMERA_NEAR_RELIEF_MAX_PITCH_OFFSET_RADIANS,
            activationMillis:    REPLAY_CAMERA_NEAR_RELIEF_ACTIVATION_MILLIS,
            attackMillis:         REPLAY_CAMERA_NEAR_RELIEF_ATTACK_MILLIS,
        }
    }
    return {
        maximumPitchOffset: REPLAY_CAMERA_MAX_PITCH_OFFSET_RADIANS,
        activationMillis:   REPLAY_CAMERA_PITCH_ACTIVATION_MILLIS,
        attackMillis:        REPLAY_CAMERA_PITCH_ATTACK_MILLIS,
    }
}

/**
 * Apply smoothstep easing to a normalized correction ratio.
 *
 * @param {number} value - Normalized ratio.
 * @returns {number} Eased ratio between zero and one.
 */
const smoothstep = value => {
    const ratio = clamp(finiteNumber(value) ?? 0, 0, 1)
    return ratio * ratio * (3 - (2 * ratio))
}

/**
 * Create the inactive temporary pitch correction state.
 *
 * @returns {object} Fresh correction state.
 */
export const createReplayCameraPitchCorrectionState = () => ({
    phase:          REPLAY_CAMERA_PITCH_PHASE_INACTIVE,
    hiddenSince:    null,
    visibleSince:   null,
    phaseStartedAt: null,
    startWeight:    0,
    weight:         0,
    redirectState:  null,
    reason:         null,
})

/**
 * Resolve the maximum temporary pitch offset for a nominal pitch.
 *
 * Shallow camera views convert small pitch changes into large camera
 * displacements, so they use a smaller envelope.
 *
 * @param {number|null} nominalPitch - Nominal pitch in radians.
 * @returns {number} Maximum absolute pitch offset in radians.
 */
export const replayCameraPitchCorrectionLimit = nominalPitch => (
    (finiteNumber(nominalPitch) ?? -Math.PI / 2) > REPLAY_CAMERA_SHALLOW_PITCH_THRESHOLD_RADIANS
        ? REPLAY_CAMERA_SHALLOW_MAX_PITCH_OFFSET_RADIANS
        : REPLAY_CAMERA_MAX_PITCH_OFFSET_RADIANS
)

/**
 * Resolve the ordered pitch envelopes used by visibility candidate search.
 *
 * Grazing views first use the gentle eight-degree envelope. When no candidate
 * in that envelope can restore visibility, the search expands to the normal
 * twenty-degree limit or to the adaptive near-relief limit. The controller
 * still applies the selected offset through its attack envelope.
 *
 * @param {number|null} nominalPitch - Nominal pitch in radians.
 * @param {number|null} [obstructionDistanceMeters=null] - Nearest terrain obstruction distance.
 * @returns {number[]} Ordered unique maximum pitch offsets in radians.
 */
export const replayCameraPitchCorrectionSearchLimits = (nominalPitch, obstructionDistanceMeters = null) => {
    const preferredLimit = replayCameraPitchCorrectionLimit(nominalPitch)
    const adaptiveLimit = replayCameraPitchCorrectionEnvelope(obstructionDistanceMeters).maximumPitchOffset
    const maximumLimit = Math.max(REPLAY_CAMERA_MAX_PITCH_OFFSET_RADIANS, adaptiveLimit)
    return preferredLimit < REPLAY_CAMERA_MAX_PITCH_OFFSET_RADIANS
        ? [preferredLimit, maximumLimit]
        : [maximumLimit]
}

/**
 * Scale a redirect state by its current correction weight.
 *
 * @param {object|null} redirectState - Selected proven-safe redirect.
 * @param {number} weight - Correction weight.
 * @param {number} [pitchSensitivity=1] - Pitch correction response multiplier.
 * @returns {object|null} Weighted redirect or null at zero weight.
 */
export const weightedReplayCameraRedirectState = (redirectState, weight, pitchSensitivity = 1) => {
    const safeWeight = clamp(finiteNumber(weight) ?? 0, 0, 1)
    const safePitchSensitivity = clamp(finiteNumber(pitchSensitivity) ?? 1, 0, 1)
    if (!redirectState || safeWeight <= Number.EPSILON) {
        return null
    }

    return {
        headingOffset: (finiteNumber(redirectState.headingOffset) ?? 0) * safeWeight,
        pitchOffset:   (finiteNumber(redirectState.pitchOffset) ?? 0) * safeWeight * safePitchSensitivity,
    }
}

/**
 * Resolve one logical-time step of the temporary pitch correction lifecycle.
 *
 * @param {object|null} previousState - Previous correction state.
 * @param {object} options - Controller inputs.
 * @param {number} options.logicalNow - Current logical timestamp in milliseconds.
 * @param {boolean} options.nominalVisible - Whether the current nominal marker is visible.
 * @param {object|null} options.candidateRedirectState - Smallest proven-safe redirect candidate.
 * @param {number|null} [options.obstructionDistanceMeters=null] - Nearest terrain obstruction distance.
 * @param {boolean} [options.isFinalFrame=false] - Force exact nominal completion.
 * @param {string|null} [options.reason='current-marker-hidden'] - Activation reason.
 * @param {number} [options.pitchSensitivity=1] - Pitch correction response multiplier.
 * @returns {{state: object, weightedRedirectState: object|null, ownsCamera: boolean, completed: boolean}}
 */
export const resolveReplayCameraPitchCorrectionState = (previousState, {
    logicalNow,
    nominalVisible,
    candidateRedirectState,
    obstructionDistanceMeters = null,
    isFinalFrame = false,
    reason = 'current-marker-hidden',
    pitchSensitivity = 1,
} = {}) => {
    const previous = previousState ?? createReplayCameraPitchCorrectionState()
    const now = finiteNumber(logicalNow) ?? 0
    const envelope = replayCameraPitchCorrectionEnvelope(obstructionDistanceMeters)
    const wasActive = previous.phase === REPLAY_CAMERA_PITCH_PHASE_ATTACK
                      || previous.phase === REPLAY_CAMERA_PITCH_PHASE_HOLD
                      || previous.phase === REPLAY_CAMERA_PITCH_PHASE_RELEASE

    if (isFinalFrame) {
        return {
            state: createReplayCameraPitchCorrectionState(),
            weightedRedirectState: null,
            ownsCamera: wasActive,
            completed: wasActive || previous.phase === REPLAY_CAMERA_PITCH_PHASE_PENDING,
        }
    }

    let next = {
        ...previous,
        redirectState: previous.redirectState ? {...previous.redirectState} : null,
    }

    if (next.phase === REPLAY_CAMERA_PITCH_PHASE_INACTIVE) {
        if (nominalVisible) {
            return {
                state: createReplayCameraPitchCorrectionState(),
                weightedRedirectState: null,
                ownsCamera: false,
                completed: false,
            }
        }
        next = {
            ...createReplayCameraPitchCorrectionState(),
            phase:       REPLAY_CAMERA_PITCH_PHASE_PENDING,
            hiddenSince: now,
            reason,
        }
    }

    if (next.phase === REPLAY_CAMERA_PITCH_PHASE_PENDING) {
        if (nominalVisible) {
            return {
                state: createReplayCameraPitchCorrectionState(),
                weightedRedirectState: null,
                ownsCamera: false,
                completed: false,
            }
        }

        const hiddenSince = finiteNumber(next.hiddenSince) ?? now
        next.hiddenSince = hiddenSince
        if (now - hiddenSince < envelope.activationMillis || !candidateRedirectState) {
            return {
                state: next,
                weightedRedirectState: null,
                ownsCamera: false,
                completed: false,
            }
        }

        next = {
            ...next,
            phase:          REPLAY_CAMERA_PITCH_PHASE_ATTACK,
            phaseStartedAt: now,
            startWeight:    0,
            weight:         0,
            redirectState:  {...candidateRedirectState},
            visibleSince:   null,
        }
    }

    if (next.phase === REPLAY_CAMERA_PITCH_PHASE_ATTACK) {
        const phaseStartedAt = finiteNumber(next.phaseStartedAt) ?? now
        const startWeight = clamp(finiteNumber(next.startWeight) ?? 0, 0, 1)
        const ratio = clamp((now - phaseStartedAt) / envelope.attackMillis, 0, 1)
        next.weight = startWeight + ((1 - startWeight) * smoothstep(ratio))
        if (ratio >= 1) {
            next.phase = REPLAY_CAMERA_PITCH_PHASE_HOLD
            next.phaseStartedAt = now
            next.startWeight = 1
            next.weight = 1
        }
    }

    if (next.phase === REPLAY_CAMERA_PITCH_PHASE_HOLD) {
        next.weight = 1
    }

    if (next.phase === REPLAY_CAMERA_PITCH_PHASE_ATTACK
        || next.phase === REPLAY_CAMERA_PITCH_PHASE_HOLD) {
        if (nominalVisible) {
            next.visibleSince ??= now
            if (now - next.visibleSince >= REPLAY_CAMERA_PITCH_RELEASE_CONFIRMATION_MILLIS) {
                next.phase = REPLAY_CAMERA_PITCH_PHASE_RELEASE
                next.phaseStartedAt = now
                next.startWeight = clamp(finiteNumber(next.weight) ?? 0, 0, 1)
            }
        }
        else {
            next.visibleSince = null
        }
    }

    if (next.phase === REPLAY_CAMERA_PITCH_PHASE_RELEASE) {
        if (!nominalVisible) {
            next.phase = REPLAY_CAMERA_PITCH_PHASE_ATTACK
            next.phaseStartedAt = now
            next.startWeight = clamp(finiteNumber(next.weight) ?? 0, 0, 1)
            next.visibleSince = null
            if (candidateRedirectState) {
                next.redirectState = {...candidateRedirectState}
            }
        }
        else {
            const phaseStartedAt = finiteNumber(next.phaseStartedAt) ?? now
            const ratio = clamp((now - phaseStartedAt) / REPLAY_CAMERA_PITCH_RELEASE_MILLIS, 0, 1)
            next.weight = clamp(
                (finiteNumber(next.startWeight) ?? 0) * (1 - smoothstep(ratio)),
                0,
                1,
            )
            if (ratio >= 1 || next.weight <= Number.EPSILON) {
                return {
                    state: createReplayCameraPitchCorrectionState(),
                    weightedRedirectState: null,
                    ownsCamera: true,
                    completed: true,
                }
            }
        }
    }

    return {
        state: next,
        weightedRedirectState: weightedReplayCameraRedirectState(next.redirectState, next.weight, pitchSensitivity),
        ownsCamera: true,
        completed: false,
    }
}

/**
 * Reset the shared temporary pitch correction state on a replay mode.
 *
 * @param {object} mode - Replay session mode.
 * @returns {void}
 */
export const resetReplayCameraPitchCorrection = mode => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    state.cameraPitchCorrectionState = createReplayCameraPitchCorrectionState()
    state.cameraRedirectState = null
    state.cameraNominalVisibilitySince = null
}

/**
 * Resolve and persist one shared temporary pitch correction update.
 *
 * @param {object} mode - Replay session mode.
 * @param {object} options - Runtime controller inputs.
 * @param {object} options.nominalView - Current nominal logical camera view.
 * @param {number} options.logicalNow - Current logical timestamp.
 * @param {boolean} options.nominalVisible - Current marker visibility.
 * @param {object|null} options.candidateRedirectState - Proven-safe redirect candidate.
 * @param {number|null} [options.obstructionDistanceMeters=null] - Nearest terrain obstruction distance.
 * @param {boolean} [options.isFinalFrame=false] - Whether this is the last replay frame.
 * @param {number} [options.pitchSensitivity=1] - Pitch correction response multiplier.
 * @returns {object} Persisted controller result with the resolved camera view.
 */
export const resolveReplayCameraPitchCorrection = (mode, {
    nominalView,
    logicalNow,
    nominalVisible,
    candidateRedirectState,
    obstructionDistanceMeters = null,
    isFinalFrame = false,
    pitchSensitivity = 1,
} = {}) => {
    const state = mode[JOURNEY_REPLAY_INTERNAL_STATE]
    const call = mode[JOURNEY_REPLAY_INTERNAL_CALL]
    const result = resolveReplayCameraPitchCorrectionState(
        state.cameraPitchCorrectionState,
        {
            logicalNow,
            nominalVisible,
            candidateRedirectState,
            obstructionDistanceMeters,
            isFinalFrame,
            pitchSensitivity,
        },
    )
    state.cameraPitchCorrectionState = result.state
    state.cameraRedirectState = result.state.redirectState
    const view = result.weightedRedirectState
        ? call.cameraViewWithRedirectState(nominalView, result.weightedRedirectState)
        : nominalView

    return {
        ...result,
        view,
    }
}
