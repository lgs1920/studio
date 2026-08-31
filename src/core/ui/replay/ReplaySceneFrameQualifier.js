/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplaySceneFrameQualifier.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Asynchronous Cesium qualification for one canonical replay frame.
 */

import {
    createReplayFrameResult,
    REPLAY_FRAME_RESULT_DEGRADED,
    REPLAY_FRAME_RESULT_FAILED,
    REPLAY_FRAME_RESULT_READY,
} from './ReplayFrameResult'
import {replayCameraCommandFromIntent} from './ReplayCameraCommand'
import {applyReplayCesiumCameraCommand} from './ReplayCesiumCameraAdapter'
import {createReplaySceneTileReadinessCoordinator} from './ReplaySceneTileReadiness'

export const REPLAY_SCENE_FRAME_READINESS_READY = 'ready'
export const REPLAY_SCENE_FRAME_READINESS_TIMEOUT = 'timeout'
export const REPLAY_SCENE_FRAME_READINESS_TRANSIENT = 'transient'
export const REPLAY_SCENE_FRAME_READINESS_UNAVAILABLE = 'unavailable'

const replaySceneFrameQualifierByOwner = new WeakMap()

/**
 * Create a standard replay cancellation error.
 *
 * @returns {DOMException} Abort error.
 */
const createReplayFrameQualificationAbortError = () => new DOMException(
    'Replay scene frame qualification was aborted',
    'AbortError',
)

/**
 * Throw when qualification cannot continue for the active request.
 *
 * @param {Object} options - Cancellation state.
 * @returns {void}
 */
const throwIfReplayFrameQualificationAborted = ({disposed, signal, requestId, activeRequestId}) => {
    if (disposed || signal?.aborted || requestId !== activeRequestId) {
        throw createReplayFrameQualificationAbortError()
    }
}

/**
 * Resolve a monotonic timestamp for qualification diagnostics.
 *
 * @returns {number} Current timestamp in milliseconds.
 */
const replayFrameQualificationNow = () => globalThis.performance?.now?.() ?? Date.now()

/**
 * Build one scene qualifier that applies camera commands and optionally waits
 * for the terrain, imagery, and visible 3D Tiles required by the current view.
 *
 * @param {Object} options - Cesium scene and injectable adapters.
 * @returns {Object} Qualification and disposal API.
 */
export const createReplaySceneFrameQualifier = ({
    scene = null,
    camera = scene?.camera ?? null,
    readiness = {},
    applyCameraCommand = applyReplayCesiumCameraCommand,
    createReadinessCoordinator = createReplaySceneTileReadinessCoordinator,
} = {}) => {
    let disposed = false
    let activeRequestId = 0
    const readinessCoordinator = typeof createReadinessCoordinator === 'function'
        ? createReadinessCoordinator(scene, readiness)
        : null

    /**
     * Apply and qualify one canonical replay frame intent.
     *
     * Transient slider input applies the camera immediately without waiting.
     * Settled input waits with the configured bounded readiness policy.
     *
     * @param {Object} options - Intent and qualification options.
     * @returns {Promise<Object>} Applied frame and canonical execution result.
     */
    const qualify = async ({
        intent = null,
        settled = false,
        signal = null,
        maxMillis = readiness?.settledTimeoutMs ?? 5000,
        speedLevel = settled ? 'jump' : 'fast',
    } = {}) => {
        activeRequestId += 1
        const requestId = activeRequestId
        const startedAt = replayFrameQualificationNow()
        throwIfReplayFrameQualificationAborted({disposed, signal, requestId, activeRequestId})

        const command = replayCameraCommandFromIntent(intent)
        const appliedFrame = applyCameraCommand({camera, command, scene})
        if (!appliedFrame) {
            return {
                intent,
                appliedFrame: null,
                result: createReplayFrameResult({
                    intentId: intent?.id ?? null,
                    status: REPLAY_FRAME_RESULT_FAILED,
                    readiness: {
                        status: REPLAY_SCENE_FRAME_READINESS_UNAVAILABLE,
                        settled: settled === true,
                    },
                    timings: {
                        qualificationMillis: replayFrameQualificationNow() - startedAt,
                    },
                    error: new Error('Replay camera command could not be applied to the Cesium scene'),
                }),
            }
        }

        scene?.requestRender?.()
        if (settled !== true || !readinessCoordinator?.prepareForCapture) {
            return {
                intent,
                appliedFrame,
                result: createReplayFrameResult({
                    intentId: intent?.id ?? null,
                    status: REPLAY_FRAME_RESULT_READY,
                    readiness: {
                        status: REPLAY_SCENE_FRAME_READINESS_TRANSIENT,
                        settled: false,
                    },
                    timings: {
                        qualificationMillis: replayFrameQualificationNow() - startedAt,
                    },
                }),
            }
        }

        const readinessStartedAt = replayFrameQualificationNow()
        const ready = await readinessCoordinator.prepareForCapture({
            maxMillis,
            signal,
            settled: true,
            speedLevel,
        })
        throwIfReplayFrameQualificationAborted({disposed, signal, requestId, activeRequestId})

        return {
            intent,
            appliedFrame,
            result: createReplayFrameResult({
                intentId: intent?.id ?? null,
                status: ready ? REPLAY_FRAME_RESULT_READY : REPLAY_FRAME_RESULT_DEGRADED,
                readiness: {
                    status: ready
                            ? REPLAY_SCENE_FRAME_READINESS_READY
                            : REPLAY_SCENE_FRAME_READINESS_TIMEOUT,
                    settled: true,
                    waitedMillis: replayFrameQualificationNow() - readinessStartedAt,
                    maxMillis,
                },
                timings: {
                    qualificationMillis: replayFrameQualificationNow() - startedAt,
                },
            }),
        }
    }

    /**
     * Abort active work and release readiness listeners.
     *
     * @returns {void}
     */
    const dispose = () => {
        if (disposed) {
            return
        }

        disposed = true
        activeRequestId += 1
        readinessCoordinator?.dispose?.()
    }

    return {
        qualify,
        dispose,
    }
}

/**
 * Resolve a stable cache identity for one readiness configuration.
 *
 * @param {Object|null} readiness - Normalized replay readiness settings.
 * @returns {string} Readiness identity.
 */
const replaySceneFrameQualifierReadinessKey = readiness => JSON.stringify({
    enabled: readiness?.enabled !== false,
    policy: readiness?.policy ?? null,
    knownFootprintTimeoutMs: readiness?.knownFootprintTimeoutMs ?? null,
    movingTimeoutMs: readiness?.movingTimeoutMs ?? null,
    settledTimeoutMs: readiness?.settledTimeoutMs ?? null,
})

/**
 * Return the reusable scene qualifier owned by one replay session object.
 *
 * A changed scene or readiness policy disposes the previous coordinator so
 * Cesium event listeners never leak across replay lifecycles.
 *
 * @param {Object} owner - Replay session owner.
 * @param {Object} options - Current scene and readiness settings.
 * @returns {Object|null} Reusable scene qualifier.
 */
export const replaySceneFrameQualifierFor = (owner, {
    scene = null,
    readiness = {},
} = {}) => {
    if ((!owner || typeof owner !== 'object') && typeof owner !== 'function') {
        return null
    }

    const readinessKey = replaySceneFrameQualifierReadinessKey(readiness)
    const current = replaySceneFrameQualifierByOwner.get(owner)
    if (current?.scene === scene && current?.readinessKey === readinessKey) {
        return current.qualifier
    }

    current?.qualifier?.dispose?.()
    const qualifier = createReplaySceneFrameQualifier({scene, readiness})
    replaySceneFrameQualifierByOwner.set(owner, {scene, readinessKey, qualifier})
    return qualifier
}

/**
 * Dispose the scene qualifier owned by one replay session object.
 *
 * @param {Object} owner - Replay session owner.
 * @returns {boolean} Whether an owned qualifier was disposed.
 */
export const disposeReplaySceneFrameQualifier = owner => {
    if ((!owner || typeof owner !== 'object') && typeof owner !== 'function') {
        return false
    }

    const current = replaySceneFrameQualifierByOwner.get(owner)
    if (!current) {
        return false
    }

    replaySceneFrameQualifierByOwner.delete(owner)
    current.qualifier?.dispose?.()
    return true
}
