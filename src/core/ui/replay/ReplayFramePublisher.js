/**
 * Canonical replay frame publication helpers.
 */

import {
    createReplayFrameIntentFromState,
    isResolvedReplayFrameIntent,
} from './ReplayFrameIntent'

export const REPLAY_FRAME_PUBLICATION_TARGET_DRAFT = 'draft'
export const REPLAY_FRAME_PUBLICATION_TARGET_HQ = 'hq'

/**
 * Attach a canonical intent to the existing flat compatibility frame state.
 *
 * @param {Object|null} frameState - Existing replay frame state.
 * @param {Object} options - Canonical intent options.
 * @returns {Object|null} Frame publication with canonical intent metadata.
 */
export const attachReplayFrameIntent = (frameState, options = {}) => {
    if (!frameState) {
        return null
    }

    const intent = createReplayFrameIntentFromState(frameState, options)
    return Object.assign({}, frameState, {
        intent,
        intentId: intent?.id ?? null,
        intentResolved: isResolvedReplayFrameIntent(intent),
    })
}

/**
 * Publish one Draft or HQ frame while preserving compatibility store fields.
 *
 * @param {Object} options - Publication destination and frame data.
 * @returns {Object|null} Published frame state.
 */
export const publishReplayFrameState = ({
                                            replay = globalThis.lgs?.stores?.replay ?? null,
                                            plan = null,
                                            target = REPLAY_FRAME_PUBLICATION_TARGET_DRAFT,
                                            frameState = null,
                                            intentOptions = {},
                                        } = {}) => {
    const publishedFrame = attachReplayFrameIntent(frameState, intentOptions)
    if (!publishedFrame) {
        return null
    }

    if (target === REPLAY_FRAME_PUBLICATION_TARGET_HQ) {
        if (!plan?.runtime) {
            return null
        }
        plan.runtime.frameState = publishedFrame
        if (publishedFrame.intentResolved) {
            plan.runtime.resolvedFrameState = publishedFrame
        }
        return publishedFrame
    }

    if (!replay) {
        return null
    }
    replay.dynamicFrameState = publishedFrame
    if (publishedFrame.intentResolved) {
        replay.resolvedFrameState = publishedFrame
    }
    return publishedFrame
}

/**
 * Resolve the active HQ frame publication when an export is running.
 *
 * @param {Object|null} replay - Replay store or snapshot.
 * @returns {Object|null} Active HQ frame publication.
 */
export const resolvePublishedReplayExportFrame = (replay = globalThis.lgs?.stores?.replay ?? null) => {
    const runtime = replay?.deferredExportPlan?.runtime ?? null
    if (runtime?.status !== 'exporting') {
        return null
    }

    return runtime.resolvedFrameState
           ?? runtime.frameState
           ?? null
}

/**
 * Resolve the most recent complete replay frame for dynamic visual consumers.
 *
 * @param {Object|null} replay - Replay store or snapshot.
 * @returns {Object|null} Active canonical or compatibility frame publication.
 */
export const resolvePublishedReplayFrame = (replay = globalThis.lgs?.stores?.replay ?? null) => (
    resolvePublishedReplayExportFrame(replay)
    ?? ((replay?.dynamicFrameState?.active === false
         && replay?.dynamicFrameState?.playing !== true
         && replay?.dynamicFrameState?.paused !== true)
        ? replay.dynamicFrameState
        : replay?.resolvedFrameState)
    ?? replay?.dynamicFrameState
    ?? null
)

/**
 * Clear transient canonical frame publications after replay teardown.
 *
 * @param {Object} options - Publication owners to clear.
 * @returns {void}
 */
export const clearReplayFramePublications = ({
                                                 replay = globalThis.lgs?.stores?.replay ?? null,
                                                 plan = null,
                                             } = {}) => {
    if (replay) {
        replay.dynamicFrameState = null
        replay.resolvedFrameState = null
    }
    if (plan?.runtime) {
        plan.runtime.frameState = null
        plan.runtime.resolvedFrameState = null
    }
}
