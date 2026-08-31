/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayFrameIntent.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-24
 * Last modified: 2026-08-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Canonical renderer-independent replay frame intent.
 */

import {
    normalizeReplayRenderMode,
    REPLAY_RENDER_MODE_DRAFT,
} from './ReplayRenderModeContract'

export const REPLAY_FRAME_INTENT_VERSION = 1

/**
 * Clone replay data without retaining renderer or reactive object ownership.
 *
 * @param {*} value - Plain replay value to clone.
 * @returns {*} Cloned value or null when the value is empty.
 */
const cloneReplayFrameValue = value => {
    if (value === null || value === undefined) {
        return value ?? null
    }

    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value)
        }
        catch {
            // Plain JSON replay data remains the compatibility fallback.
        }
    }

    const serialized = JSON.stringify(value)
    return serialized === undefined ? null : JSON.parse(serialized)
}

/**
 * Convert a replay value to a finite number while preserving empty values.
 *
 * @param {*} value - Value to normalize.
 * @returns {number|null} Finite number or null.
 */
const optionalFiniteNumber = value => {
    if (value === null || value === undefined || value === '') {
        return null
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : null
}

/**
 * Normalize replay progress to the public zero-to-one range.
 *
 * @param {*} value - Progress value to normalize.
 * @returns {number} Normalized replay progress.
 */
const normalizeProgress = value => Math.max(0, Math.min(1, optionalFiniteNumber(value) ?? 0))

/**
 * Build a stable identifier for one frame intent publication.
 *
 * @param {Object} options - Frame identity inputs.
 * @returns {string} Stable frame intent identifier.
 */
const buildReplayFrameIntentId = ({
                                      planId = null,
                                      renderMode = REPLAY_RENDER_MODE_DRAFT,
                                      source = 'replay',
                                      frameId = null,
                                      frameIndex = null,
                                      timeMs = null,
                                  } = {}) => [
    planId ?? 'live',
    normalizeReplayRenderMode(renderMode),
    source ?? 'replay',
    optionalFiniteNumber(frameId) ?? optionalFiniteNumber(frameIndex) ?? 'frame',
    optionalFiniteNumber(timeMs) ?? 'time',
].join(':')

/**
 * Create the complete pixel intent for one logical replay timestamp.
 *
 * The intent contains data only. Cesium, DOM, canvas, media, encoder, and
 * reactive store objects must remain outside this contract.
 *
 * @param {Object} options - Canonical frame inputs.
 * @returns {Object} Canonical replay frame intent.
 */
export const createReplayFrameIntent = ({
                                             planId = null,
                                             resolved = false,
                                             renderMode = REPLAY_RENDER_MODE_DRAFT,
                                             source = 'replay',
                                             frameId = null,
                                             frameIndex = null,
                                             frameCount = null,
                                             replayFrameIndex = null,
                                             replayFrameCount = null,
                                             timeMs = null,
                                             elapsedMillis = null,
                                             durationMillis = null,
                                             frameIntervalMs = null,
                                             phase = null,
                                             progress = 0,
                                             direction = 1,
                                             sample = null,
                                             cameraPose = null,
                                             cameraCommand = null,
                                             cameraFrame = null,
                                             trackPath = null,
                                             markerState = null,
                                             traceState = null,
                                             poiStates = null,
                                             widgetStates = null,
                                             mediaStates = null,
                                             renderSpec = null,
                                             visibleOverlayIds = [],
                                             outputProfile = null,
                                             qualityRequirements = null,
                                         } = {}) => {
    const normalizedRenderMode = normalizeReplayRenderMode(renderMode)
    const normalizedTimeMs = optionalFiniteNumber(timeMs)
                              ?? optionalFiniteNumber(elapsedMillis)
    const intentId = buildReplayFrameIntentId({
        planId,
        renderMode: normalizedRenderMode,
        source,
        frameId,
        frameIndex,
        timeMs: normalizedTimeMs,
    })

    return {
        version: REPLAY_FRAME_INTENT_VERSION,
        id: intentId,
        planId: planId ?? null,
        resolved: Boolean(resolved),
        renderMode: normalizedRenderMode,
        source: source ?? 'replay',
        frame: {
            id:               optionalFiniteNumber(frameId),
            index:            optionalFiniteNumber(frameIndex),
            count:            optionalFiniteNumber(frameCount),
            replayIndex:      optionalFiniteNumber(replayFrameIndex),
            replayCount:      optionalFiniteNumber(replayFrameCount),
            timeMs:           normalizedTimeMs,
            intervalMillis:   optionalFiniteNumber(frameIntervalMs),
        },
        timeline: {
            elapsedMillis:  optionalFiniteNumber(elapsedMillis) ?? normalizedTimeMs,
            durationMillis: optionalFiniteNumber(durationMillis),
            phase:          cloneReplayFrameValue(phase),
        },
        replay: {
            progress:  normalizeProgress(progress),
            direction: Number(direction) < 0 ? -1 : 1,
            sample:    cloneReplayFrameValue(sample),
        },
        scene: {
            cameraPose:  cloneReplayFrameValue(cameraPose),
            cameraCommand: cloneReplayFrameValue(cameraCommand),
            cameraFrame: cloneReplayFrameValue(cameraFrame),
            // Track geometry is immutable plan-owned data and may contain
            // thousands of positions. Retain that shared reference instead of
            // cloning the complete journey for every replay frame.
            trackPath:   trackPath ?? null,
            markerState: cloneReplayFrameValue(markerState),
            traceState:  cloneReplayFrameValue(traceState),
        },
        composition: {
            poiStates:         cloneReplayFrameValue(poiStates),
            widgetStates:      cloneReplayFrameValue(widgetStates),
            mediaStates:       cloneReplayFrameValue(mediaStates),
            renderSpec:        cloneReplayFrameValue(renderSpec),
            visibleOverlayIds: [...new Set((visibleOverlayIds ?? []).map(id => `${id}`))]
                .filter(Boolean)
                .sort((left, right) => left.localeCompare(right)),
            outputProfile:     cloneReplayFrameValue(outputProfile),
        },
        qualityRequirements: cloneReplayFrameValue(qualityRequirements),
    }
}

/**
 * Create a canonical intent from the current compatibility frame state.
 *
 * @param {Object|null} frameState - Existing flat replay frame state.
 * @param {Object} options - Canonical intent overrides.
 * @returns {Object|null} Canonical replay frame intent.
 */
export const createReplayFrameIntentFromState = (frameState, {
    planId = null,
    resolved = false,
    logicalFrame = null,
    renderContract = frameState?.renderContract ?? null,
    markerState = null,
    traceState = null,
    poiStates = null,
    widgetStates = null,
    mediaStates = null,
    qualityRequirements = null,
} = {}) => {
    if (!frameState) {
        return null
    }

    const contractLogicalFrame = logicalFrame ?? renderContract?.logicalFrame ?? null
    return createReplayFrameIntent({
        planId,
        resolved,
        renderMode: renderContract?.renderMode ?? frameState.renderMode ?? REPLAY_RENDER_MODE_DRAFT,
        source: frameState.source,
        frameId: frameState.frameId,
        frameIndex: frameState.frameIndex ?? frameState.index,
        frameCount: frameState.frameCount,
        replayFrameIndex: frameState.replayFrameIndex,
        replayFrameCount: frameState.replayFrameCount,
        timeMs: frameState.frameTimeMs ?? contractLogicalFrame?.frameTimeMs,
        elapsedMillis: frameState.elapsedMillis ?? contractLogicalFrame?.elapsedMillis,
        durationMillis: frameState.durationMillis ?? contractLogicalFrame?.durationMillis,
        frameIntervalMs: frameState.frameIntervalMs ?? contractLogicalFrame?.frameIntervalMs,
        phase: frameState.phase ?? contractLogicalFrame?.phase,
        progress: frameState.progress ?? contractLogicalFrame?.progress,
        direction: frameState.direction,
        sample: frameState.sample ?? contractLogicalFrame?.sample,
        cameraPose: contractLogicalFrame?.cameraPose ?? renderContract?.cameraPose,
        cameraCommand: frameState.cameraCommand ?? contractLogicalFrame?.cameraCommand,
        cameraFrame: contractLogicalFrame?.cameraFrame,
        trackPath: renderContract?.trackPath,
        markerState,
        traceState,
        poiStates,
        widgetStates,
        mediaStates,
        renderSpec: renderContract?.renderSpec,
        visibleOverlayIds: renderContract?.visibleOverlayIds,
        outputProfile: renderContract?.outputProfile,
        qualityRequirements,
    })
}

/**
 * Return whether a value is a resolved canonical replay frame intent.
 *
 * @param {*} intent - Intent value to inspect.
 * @returns {boolean} True when the intent is canonical and resolved.
 */
export const isResolvedReplayFrameIntent = intent => Boolean(
    intent?.version === REPLAY_FRAME_INTENT_VERSION
    && intent?.resolved === true,
)
