/**
 * Lazy renderer-independent replay render plan.
 */

import {ReplayFrameTimeline} from './ReplayFrameTimeline'
import {replayContractHash, REPLAY_DEFINITION_VERSION} from './ReplayDefinition'

export const REPLAY_RENDER_PLAN_VERSION = 1
export const REPLAY_PLAN_QUALIFICATION_NOMINAL = 'nominal'
export const REPLAY_PLAN_QUALIFICATION_PARTIAL = 'partial'
export const REPLAY_PLAN_QUALIFICATION_QUALIFIED = 'qualified'

/**
 * Create a lazy replay plan that stores frame-clock metadata, never frames.
 *
 * The logical track path remains a shared plan-owned reference. Copying or
 * serializing every coordinate here would recreate the startup freeze this
 * architecture is designed to remove.
 *
 * @param {Object} options - Render plan inputs.
 * @returns {Object} Plain replay render plan.
 */
export const createReplayRenderPlan = ({
    id = null,
    definition = null,
    timeline = definition?.timeline ?? null,
    trackPath = null,
    trackPathDescriptor = definition?.trackPathDescriptor ?? null,
    cameraTrack = null,
    qualification = null,
    warnings = [],
} = {}) => {
    if (definition?.version !== REPLAY_DEFINITION_VERSION) {
        throw new TypeError('Replay render plan requires a versioned replay definition')
    }

    const frameTimeline = new ReplayFrameTimeline({
        durationMillis: timeline?.durationMillis ?? 0,
        fps: timeline?.fps ?? 30,
        direction: 1,
    })
    const frameClock = {
        durationMillis: frameTimeline.durationMillis,
        fps: frameTimeline.fps,
        direction: frameTimeline.direction,
        frameIntervalMs: frameTimeline.frameIntervalMs,
        frameCount: frameTimeline.frameCount,
        includeFinalFrame: true,
    }
    const normalizedQualification = {
        status: qualification?.status ?? REPLAY_PLAN_QUALIFICATION_NOMINAL,
        revision: qualification?.revision ?? null,
        windows: Array.isArray(qualification?.windows) ? [...qualification.windows] : [],
    }
    const identity = {
        version: REPLAY_RENDER_PLAN_VERSION,
        definitionId: definition.id,
        frameClock,
        trackPathSignature: trackPathDescriptor?.signature ?? null,
        qualificationRevision: normalizedQualification.revision,
    }

    return {
        version: REPLAY_RENDER_PLAN_VERSION,
        id: id ?? `replay-plan-${replayContractHash(identity)}`,
        definitionId: definition.id,
        definition,
        timeline,
        frameClock,
        trackPath: trackPath ?? null,
        trackPathDescriptor: trackPathDescriptor ?? null,
        cameraTrack: cameraTrack ?? null,
        qualification: normalizedQualification,
        warnings: [...warnings],
        materializedFrameCount: 0,
    }
}

/**
 * Return whether a value is a current lazy replay render plan.
 *
 * @param {*} plan - Value to inspect.
 * @returns {boolean} True for a current replay render plan.
 */
export const isReplayRenderPlan = plan => Boolean(
    plan?.version === REPLAY_RENDER_PLAN_VERSION
    && plan?.definition?.version === REPLAY_DEFINITION_VERSION,
)
