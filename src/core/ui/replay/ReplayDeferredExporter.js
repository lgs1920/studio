/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayDeferredExporter.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import {WidgetDynamicRenderer} from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import {resolveWidgetCatalogGroup} from '@Core/ui/widget-manager/resolveWidgetCatalogGroup'
import { getReplayVideoWidgetKeys } from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import {resolveReplayTimelineWidgetIds} from '@Core/ui/replay/ReplayTimelinePersistence'
import {
    normalizeJourneyReplayClips, REPLAY_CLIP_SLOT_START, REPLAY_CLIP_SLOT_STOP,
}                              from '@Core/ui/replay/JourneyReplayClips'
import {
    ReplayFrameTimeline,
}                              from '@Core/ui/replay/ReplayFrameTimeline'
import {createReplayCameraDefinition} from '@Core/ui/replay/ReplayCameraDefinition'
import {createReplayCameraPoseResolver} from '@Core/ui/replay/ReplayCameraEvaluator'
import {ReplayFrameResolver}   from '@Core/ui/replay/ReplayFrameResolver'
import {createReplayDefinition} from '@Core/ui/replay/ReplayDefinition'
import {createReplayRenderPlan} from '@Core/ui/replay/ReplayRenderPlan'
import {createReplayTrackPathDescriptor} from '@Core/ui/replay/ReplayTrackPathDescriptor'
import {
    publishReplayFrameState, REPLAY_FRAME_PUBLICATION_TARGET_EXPORT,
}                              from '@Core/ui/replay/ReplayFramePublisher'
import {
    buildReplayVideoTimeline, replayClipSignature, resolveReplayVideoFramePhase,
}                              from '@Core/ui/replay/ReplayVideoTimeline'
import {
    buildReplayVideoComposerOverlays, flushReplayVideoOverlayCanvases, isReplayVideoWidgetReady,
}                              from '@Core/ui/replay/ReplayVideoOverlayComposer'
import { commitReplayWidgetFrame } from '@Core/ui/replay/ReplayWidgetFrameRenderers'
import {
    ReplayVideoRenderSession,
}                              from '@Core/ui/replay/ReplayVideoRenderSession'
import {
    buildReplayVideoRenderSpec, normalizeReplayVideoCropRect, replayVideoComposerClipFromCropRect,
}                              from '@Core/ui/replay/ReplayVideoRenderSpec'
import {
    replayVideoTraceDebug,
}                              from '@Core/ui/replay/ReplayVideoTraceDebug'
import {
    publishReplayRecordingMonitorFrame,
    startReplayRecordingMonitor,
    stopReplayRecordingMonitor,
    updateReplayRecordingMonitor,
}                              from '@Core/ui/replay/ReplayRecordingMonitor'
import {
    createReplaySceneTileReadinessCoordinator,
    prepareReplaySceneTileCache,
    prepareReplaySceneTilesForCapture,
    resolveReplayTileSpeedLevel,
}                              from '@Core/ui/replay/ReplaySceneTileReadiness'
import {
    buildReplayFrameState, currentJourneyReplayCameraSettings,
}                              from '@Core/ui/replay/JourneyReplayRuntime'
import {
    normalizeJourneyReplayReadiness,
}                              from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    IsolatedReplayRenderHost,
}                              from '@Core/ui/replay/IsolatedReplayRenderHost'
import {
    captureReplayCropProjection,
}                              from '@Core/ui/replay/ReplayCropFrustum'
import {
    captureReplaySceneDescriptor,
}                              from '@Core/ui/replay/ReplaySceneDescriptor'
import {
    REPLAY_RENDER_MODE_EXPORT, createReplayRenderContext, createReplayRenderModeContract,
}                              from '@Core/ui/replay/ReplayRenderModeContract'
import {
    CanvasOverlayComposer,
}                              from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {createReplayRecordingPerformance} from '@Core/ui/replay/ReplayRecordingPerformance'
import {acquireReplayExportRenderLoop} from '@Core/ui/replay/ReplayExportRenderLoop'
import {REPLAY_VIDEO_FPS} from '@Core/ui/replay/ReplayVideoSettings'
import {currentReplayJourney, isJourneyReplayBasicMode} from '@Core/ui/replay/ReplayUserModeConstants'
import {createBasicReplayTraceFocusClips} from '@Core/ui/replay/JourneyReplayBasicFocus'
import {currentBasicReplaySettingsForJourney} from '@Core/ui/replay/ReplayUserModes'
import {projectReplayPOIsOnSampler} from '@Core/ui/replay/JourneyReplayPOIProjection'
import {createReplayPOISpeedProfile} from '@Core/ui/replay/ReplayPOISpeedProfile'
import {
    normalizeMediabunnyMetadataTags,
}                              from '@Core/ui/replay/ReplayMediaMetadata'
import {
    UIToast,
}                              from '@Utils/UIToast'
import {
    BufferTarget, canEncodeVideo, CanvasSource, getEncodableVideoCodecs, Mp4OutputFormat, Output, QUALITY_HIGH,
    QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                              from 'mediabunny'
import {ref}                  from 'valtio'

const VIDEO_CODEC_PROBE_TIMEOUT_MS = 2500
export const DEFAULT_REPLAY_SCENE_TILE_READINESS_TIMEOUT_MS = 5000
const REPLAY_TILE_PREWARM_LOOKAHEAD_MS = 1000
const REPLAY_TILE_PREWARM_STEP_MS = 333
const REPLAY_TILE_PREWARM_MAX_SAMPLES = 3
const REPLAY_EXPORT_CODEC_KEEPALIVE_INTERVAL_MS = 5000
const REPLAY_EXPORT_CODEC_KEEPALIVE_TIMESTAMP_STEP_SECONDS = 0.000001
const REPLAY_DRY_RUN_BROWSER_YIELD_INTERVAL_MS = 50
const REPLAY_DRY_RUN_PROGRESS_UPDATE_INTERVAL_MS = 100
const REPLAY_DRY_RUN_TILE_READINESS_CHECK_TIMEOUT_MS = 250
const REPLAY_FRAME_SAMPLE_WORKER_MIN_FRAME_COUNT = 120
const REPLAY_FRAME_SAMPLE_WORKER_MAX_FRAME_COUNT = 36000
const REPLAY_FRAME_SAMPLE_WORKER_MAX_ROUTE_SAMPLE_COUNT = 50000
const REPLAY_FRAME_SAMPLE_WORKER_TIMEOUT_MS = 15000
const EXPORT_PROGRESS_UPDATE_FRAME_STEP = 1
const EXPORT_PROGRESS_FRAME_SAMPLE_WINDOW = 30

const finiteNumber = (value, fallback = null) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const clampProgress = value => Math.max(0, Math.min(1, Number(value) || 0))

/**
 * Build the Basic Replay POI speed profile from the active canonical sampler.
 *
 * @param {Object} options - Replay export timing inputs.
 * @returns {Object|null} Basic Replay speed profile or null for Expert Replay.
 */
const resolveReplayPOISpeedProfile = ({replay, journey, controller, replayDurationMillis, direction} = {}) => {
    if (!isJourneyReplayBasicMode({settings: globalThis.lgs?.settings?.ui?.replay, replay})) {
        return null
    }

    const basicSettings = currentBasicReplaySettingsForJourney(journey)
    const profile = createReplayPOISpeedProfile({
        entries: projectReplayPOIsOnSampler(replay?.nearbyPois ?? [], controller?.sampler),
        totalDistance: controller?.sampler?.totalDistance,
        replayDurationMillis,
        direction,
        basicSettings,
        enabled: true,
    })

    return profile.playbackDurationMillis !== profile.routeDurationMillis ? profile : null
}

/**
 * Resolve the selected video range from Replay preparation.
 *
 * @param {Object} options - Replay and source timeline inputs.
 * @param {Object|null} options.replay - Replay store.
 * @param {Object} options.timeline - Canonical Replay video timeline.
 * @returns {Object} Bounded export window and its initial Replay progress.
 */
const resolveReplayExportWindow = ({replay, timeline} = {}) => {
    const preparationRange = replay?.preparationTimeline?.timeline ?? {}
    const timelineDuration = Math.max(0, Number(timeline?.durationMillis) || 0)
    const requestedStart = preparationRange.rangeStartMillis === null
        || preparationRange.rangeStartMillis === undefined
        || preparationRange.rangeStartMillis === ''
        ? 0
        : finiteNumber(preparationRange.rangeStartMillis, 0) ?? 0
    const requestedEnd = preparationRange.rangeEndMillis === null
        || preparationRange.rangeEndMillis === undefined
        || preparationRange.rangeEndMillis === ''
        ? timelineDuration
        : finiteNumber(preparationRange.rangeEndMillis, timelineDuration) ?? timelineDuration
    const startMillis = Math.max(0, Math.min(timelineDuration, requestedStart))
    const endMillis = Math.max(startMillis, Math.min(timelineDuration, requestedEnd))
    const startPhase = resolveReplayVideoFramePhase({timeline, frameTimeMs: startMillis})

    return {
        startMillis,
        endMillis,
        durationMillis: endMillis - startMillis,
        startProgress: startPhase.kind === 'replay'
            ? startPhase.progress
            : startPhase.anchorProgress ?? startPhase.progress,
    }
}

/**
 * Resolve a canonical source-timeline phase for one frame in a trimmed export.
 *
 * @param {Object} options - Export plan and output frame.
 * @param {Object|null} options.plan - Deferred export plan.
 * @param {Object|null} options.frame - Frame on the trimmed output clock.
 * @returns {Object} Phase resolved at the corresponding source timeline time.
 */
const resolveReplayExportFramePhase = ({plan, frame} = {}) => {
    const frameTimeMs = Math.max(0, Number(frame?.frameTimeMs) || 0)
        + Math.max(0, Number(plan?.exportWindow?.startMillis) || 0)

    return resolveReplayVideoFramePhase({
        timeline: plan?.videoTimeline,
        frame,
        frameTimeMs,
        isFinalSceneFrame: frame?.isLast === true,
    })
}

/**
 * Project an output frame onto its source timeline timestamp for camera logic.
 *
 * @param {Object|null} frame - Frame on the zero-based output clock.
 * @param {Object|null} phase - Phase resolved on the canonical source clock.
 * @returns {Object|null} Frame carrying its source timeline timestamp.
 */
const resolveReplayExportSourceFrame = (frame, phase) => frame
    ? Object.assign({}, frame, {frameTimeMs: phase?.frameTimeMs ?? frame.frameTimeMs})
    : frame

/**
 * Resolve export progress from encoded frame order rather than replay direction.
 *
 * @param {Object} options - Frame metadata.
 * @param {Object|null} options.frame - Current encoder frame.
 * @param {number|null} options.frameCount - Total encoder frame count.
 * @returns {number|null} Monotonic export progress.
 */
const monitorProgressForFrame = ({frame = null, frameCount = null} = {}) => {
    const count = finiteNumber(frameCount, null)
    const index = finiteNumber(frame?.index, null)
    if (count !== null && count > 0 && index !== null) {
        return clampProgress((index + 1) / count)
    }

    return finiteNumber(frame?.progress, null)
}

const runtimeNow = () => globalThis.performance?.now?.() ?? Date.now()
const defaultTimestamp = () => new Date().toISOString()
const defaultReplayStore = () => globalThis.lgs?.stores?.replay ?? null
const defaultJourney = () => globalThis.lgs?.theJourney ?? null
const defaultReplayController = () => globalThis.__?.ui?.replay?.controller ?? null
const defaultReplayMode = () => globalThis.__?.ui?.replay ?? null
const defaultReplayExportFps = () => {
    const configured = globalThis.lgs?.stores?.ui?.video?.fps
    return REPLAY_VIDEO_FPS?.[configured] ?? configured ?? 30
}

/**
 * Classify frames that may use the settled scene-readiness budget.
 *
 * Moving clip frames deliberately stay on the bounded moving budget. Only
 * export boundaries and explicit holds may consume the longer settled wait.
 *
 * @param {Object} options - Export frame and resolved phase.
 * @returns {boolean} Whether the frame is a settled boundary or hold.
 */
export const isReplayExportFrameSettled = ({frame = null, phase = null} = {}) => {
    if (frame?.isFirst === true
        || frame?.isLast === true
        || phase?.isFinalSceneFrame === true
        || phase?.isLastPhaseFrame === true) {
        return true
    }

    if (phase?.kind === 'hold'
        || phase?.hold === true
        || phase?.clip?.params?.hold === true
        || phase?.clip?.params?.motion === 'hold') {
        return true
    }

    if (!phase?.clip) {
        return false
    }

    const localProgress = finiteNumber(phase.localProgress, null)
    return localProgress !== null
           && (localProgress <= 0.000001 || localProgress >= 0.999999)
}

/**
 * Select dry-run phase boundaries for bounded tile-readiness checks.
 *
 * @param {Object} options - Export frame and resolved phase.
 * @param {Object|null} options.frame - Current source timeline frame.
 * @param {Object|null} options.phase - Resolved timeline phase.
 * @returns {boolean} Whether this frame should briefly wait for scene readiness.
 */
const isReplayDryRunTileReadinessCheckpoint = ({frame = null, phase = null} = {}) => {
    const isBoundary = frame?.isFirst === true
                       || frame?.isLast === true
                       || phase?.isFinalSceneFrame === true
                       || phase?.isLastPhaseFrame === true
                       || phase?.phaseFrameIndex === 0
    const isHold = phase?.kind === 'hold'
                   || phase?.hold === true
                   || phase?.clip?.params?.hold === true
                   || phase?.clip?.params?.motion === 'hold'

    return isBoundary || (!isHold && isReplayExportFrameSettled({frame, phase}))
}

/**
 * Create the default isolated Replay render host.
 *
 * @param {Object} options - Host construction options.
 * @returns {IsolatedReplayRenderHost} New isolated host.
 */
const defaultIsolatedReplayRenderHostFactory = options => new IsolatedReplayRenderHost(options)

/**
 * Pre-warm a small rolling prefix of the export camera path through Cesium.
 *
 * The active scene camera is moved sequentially because Cesium can only
 * calculate view-dependent tile requests for one active camera. The initial
 * replay pose is restored before the first encoded frame, so pre-warming never
 * changes the exported timeline or the user camera state.
 *
 * @param {object} options - Pre-warm options.
 * @param {object|null} options.plan - Deferred export plan.
 * @param {object|null} options.replay - Replay store.
 * @param {object|null} options.controller - Replay controller.
 * @param {object|null} options.replayMode - Replay mode facade.
 * @param {object|null} options.coordinator - Tile readiness coordinator.
 * @param {number} options.lookaheadMs - Camera tile preloading horizon.
 * @param {boolean} options.dryRun - Whether to use the lighter dry-run trace cadence.
 * @param {AbortSignal|null} options.signal - Optional cancellation signal.
 * @returns {Promise<void>} Promise resolved when pre-warming is complete.
 */
const prewarmReplayScenePrefix = async ({
                                           plan = null,
                                           replay = null,
                                           controller = null,
                                           replayMode = null,
                                           coordinator = null,
                                           lookaheadMs = REPLAY_TILE_PREWARM_LOOKAHEAD_MS,
                                           dryRun = false,
                                           signal = null,
                                       } = {}) => {
    const scene = replayMode?.cesiumScene?.()
                  ?? globalThis.lgs?.scene
                  ?? globalThis.lgs?.viewer?.scene
                  ?? null
    if (!scene?.camera
        || !coordinator
        || typeof replayMode?.renderReplayExportFrame !== 'function'
        || !plan?.videoTimeline
        || Number(lookaheadMs) <= 0
        || Number(plan.videoTimeline.durationMillis) <= 0) {
        return
    }

    const timeline = new ReplayFrameTimeline({
        durationMillis: plan.exportWindow?.durationMillis ?? plan.videoTimeline.durationMillis,
        fps: plan.videoTimeline.fps,
        direction: 1,
    })
    const firstFrame = timeline.frameAtIndex(0)
    const firstPhase = resolveReplayExportFramePhase({plan, frame: firstFrame})
    const safeLookaheadMs = Math.min(
        timeline.durationMillis,
        Math.max(0, Number(lookaheadMs) || 0),
    )
    const sampleCount = Math.min(
        REPLAY_TILE_PREWARM_MAX_SAMPLES,
        Math.max(1, Math.ceil(safeLookaheadMs / REPLAY_TILE_PREWARM_STEP_MS)),
    )
    const sampleStepMs = safeLookaheadMs / sampleCount
    let prewarmed = 0

    replayVideoTraceDebug('export.tile-prewarm.start', {
        lookaheadMs,
        stepMs: sampleStepMs,
        sampleCount,
    })
    try {
        for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
            if (signal?.aborted) {
                throw new DOMException('The export tile pre-warm was aborted.', 'AbortError')
            }

            const futureFrame = timeline.frameAtTimeMs(sampleIndex * sampleStepMs)
            const futurePhase = resolveReplayExportFramePhase({plan, frame: futureFrame})
            await replayMode.renderReplayExportFrame({
                phase: futurePhase,
                frame: resolveReplayExportSourceFrame(futureFrame, futurePhase),
                plan,
                replay,
                controller,
                dryRun,
            })
            await coordinator.prepareForCapture({
                maxMillis: 100,
                signal,
            })
            prewarmed += 1
        }
    }
    catch (error) {
        if (signal?.aborted) {
            throw error
        }

        replayVideoTraceDebug('export.tile-prewarm.error', {
            message: error?.message ?? String(error),
            prewarmed,
        })
    }
    finally {
        await replayMode.renderReplayExportFrame({
            phase: firstPhase,
            frame: resolveReplayExportSourceFrame(firstFrame, firstPhase),
            plan,
            replay,
            controller,
            dryRun,
        })
        replayVideoTraceDebug('export.tile-prewarm.end', {
            prewarmed,
        })
    }
}

/**
 * Create a worker client that resolves route samples progressively as export frames render.
 *
 * @param {object} options - Worker preparation options.
 * @param {object|null} options.sampler - Journey path sampler.
 * @param {object|null} options.timeline - Canonical video timeline.
 * @param {AbortSignal|null} options.signal - Optional cancellation signal.
 * @returns {{resolveSampleForFrame: Function, dispose: Function, getProcessingMillis: Function}|null} Worker client.
 */
const createReplayFrameSampleWorkerClient = ({
                                                 sampler = null,
                                                 timeline = null,
                                                 frameClockDurationMillis = timeline?.durationMillis,
                                                 timelineOffsetMillis = 0,
                                                 signal = null,
                                             } = {}) => {
    const routeSamples = sampler?.samples
    if (typeof Worker !== 'function'
        || !Array.isArray(routeSamples)
        || routeSamples.length < 2
        || routeSamples.length > REPLAY_FRAME_SAMPLE_WORKER_MAX_ROUTE_SAMPLE_COUNT
        || !(Number(sampler?.totalDistance) > 0)
        || !timeline) {
        return null
    }

    const frameTimeline = new ReplayFrameTimeline({
        durationMillis: frameClockDurationMillis,
        fps: timeline.fps,
        direction: 1,
    })
    if (frameTimeline.frameCount < REPLAY_FRAME_SAMPLE_WORKER_MIN_FRAME_COUNT
        || frameTimeline.frameCount > REPLAY_FRAME_SAMPLE_WORKER_MAX_FRAME_COUNT) {
        return null
    }

    const batchSize = 120
    const lookaheadFrames = 24
    const samplesByIndex = new Map()
    const waitersByIndex = new Map()
    let worker = null
    let timeoutId = null
    let nextIndexToRequest = 0
    let requestedThroughIndex = -1
    let processingMillis = 0
    let workerFailed = false
    let disposed = false

    /** Resolve the progress associated with one canonical export frame. */
    const progressAtIndex = index => {
        const frame = frameTimeline.frameAtIndex(index)
        const phase = resolveReplayVideoFramePhase({
            timeline,
            frame,
            frameTimeMs: frame.frameTimeMs + Math.max(0, Number(timelineOffsetMillis) || 0),
            isFinalSceneFrame: frame.isLast,
        })
        return phase?.kind === 'replay'
            ? phase.progress ?? frame.progress
            : phase?.anchorProgress ?? phase?.progress ?? frame.progress
    }

    /** Resolve a frame on the main thread after worker failure or cancellation. */
    const fallbackSample = index => sampler.atProgress(progressAtIndex(index))

    /** Resolve any frame waiters covered by a returned batch. */
    const resolveWaiters = (index, sample) => {
        const waiters = waitersByIndex.get(index) ?? []
        waitersByIndex.delete(index)
        waiters.forEach(resolve => resolve(sample))
    }

    /** Stop the worker and settle queued requests through the main-thread sampler. */
    const failWorker = () => {
        if (workerFailed) {
            return
        }
        workerFailed = true
        clearTimeout(timeoutId)
        timeoutId = null
        worker?.terminate()
        worker = null
        waitersByIndex.forEach((waiters, index) => {
            const sample = fallbackSample(index)
            waiters.forEach(resolve => resolve(sample))
        })
        waitersByIndex.clear()
    }

    /** Request the next contiguous batch when playback has entered its lookahead. */
    const requestNextBatch = () => {
        if (!worker || workerFailed || disposed || nextIndexToRequest >= frameTimeline.frameCount
            || nextIndexToRequest > requestedThroughIndex) {
            return
        }
        const startIndex = nextIndexToRequest
        const count = Math.min(batchSize, frameTimeline.frameCount - startIndex)
        const progresses = Array.from({length: count}, (_, offset) => progressAtIndex(startIndex + offset))
        nextIndexToRequest += count
        try {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(failWorker, REPLAY_FRAME_SAMPLE_WORKER_TIMEOUT_MS)
            worker.postMessage({type: 'batch', startIndex, progresses})
        }
        catch {
            failWorker()
        }
    }

    /** Handle a completed batch, then request another only when rendering needs it. */
    const handleMessage = event => {
        const {type, startIndex, samples} = event.data ?? {}
        if (type !== 'batch' || !Array.isArray(samples)) {
            failWorker()
            return
        }
        clearTimeout(timeoutId)
        timeoutId = null
        processingMillis += Number(event.data?.processingMillis) || 0
        samples.forEach((sample, offset) => {
            const index = Number(startIndex) + offset
            samplesByIndex.set(index, sample)
            resolveWaiters(index, sample)
        })
        requestNextBatch()
    }

    /** Resolve one render frame, requesting ahead by a small bounded window. */
    const resolveSampleForFrame = (frameIndex, frame) => {
        const index = Math.max(0, Math.min(frameTimeline.frameCount - 1, Math.trunc(Number(frameIndex) || 0)))
        const cachedSample = samplesByIndex.get(index)
        if (cachedSample) {
            samplesByIndex.delete(index)
            requestedThroughIndex = Math.max(requestedThroughIndex, index + lookaheadFrames)
            requestNextBatch()
            return Promise.resolve(cachedSample)
        }
        if (workerFailed || disposed || !worker) {
            return Promise.resolve(sampler.atProgress(progressAtIndex(index)))
        }
        requestedThroughIndex = Math.max(requestedThroughIndex, index + lookaheadFrames)
        const pending = new Promise(resolve => {
            const waiters = waitersByIndex.get(index) ?? []
            waiters.push(resolve)
            waitersByIndex.set(index, waiters)
        })
        requestNextBatch()
        return pending
    }

    /** Terminate worker resources after export completion. */
    const dispose = () => {
        disposed = true
        clearTimeout(timeoutId)
        timeoutId = null
        worker?.terminate()
        worker = null
        waitersByIndex.forEach((waiters, index) => {
            const sample = fallbackSample(index)
            waiters.forEach(resolve => resolve(sample))
        })
        waitersByIndex.clear()
        signal?.removeEventListener('abort', failWorker)
    }

    try {
        worker = new Worker(new URL('./ReplayFrameSamples.worker.js', import.meta.url), {type: 'module'})
        worker.addEventListener('message', handleMessage)
        worker.addEventListener('error', failWorker)
        worker.postMessage({type: 'initialize', samples: routeSamples, totalDistance: sampler.totalDistance})
        signal?.addEventListener('abort', failWorker, {once: true})
        if (signal?.aborted) {
            failWorker()
        }
        else {
            requestedThroughIndex = batchSize - 1
            requestNextBatch()
        }
    }
    catch {
        failWorker()
    }

    return {
        resolveSampleForFrame,
        dispose,
        getProcessingMillis: () => processingMillis,
    }
}

const defaultReplaySourceCanvas = () => globalThis.lgs?.canvas ?? null
const roundFocusValue = value => {
    const numeric = finiteNumber(value, null)
    return numeric === null ? null : Math.round(numeric * 1000) / 1000
}

const normalizeReplayCameraStateSnapshot = cameraState => {
    if (!cameraState || typeof cameraState !== 'object') {
        return null
    }

    return {
        destination: {
            longitude: roundFocusValue(cameraState?.destination?.longitude),
            latitude:  roundFocusValue(cameraState?.destination?.latitude),
            height:    roundFocusValue(cameraState?.destination?.height),
        },
        orientation: {
            heading: roundFocusValue(cameraState?.orientation?.heading),
            pitch:   roundFocusValue(cameraState?.orientation?.pitch),
            roll:    roundFocusValue(cameraState?.orientation?.roll),
        },
        altitude: roundFocusValue(cameraState?.altitude),
    }
}

const captureReplayCameraStateSnapshot = ({
        replay = defaultReplayStore(),
                                              cameraState = null,
                                          } = {}) => {
    return normalizeReplayCameraStateSnapshot(
        cameraState
        ?? replay?.replayEntryCameraState
        ?? globalThis.__?.ui?.replay?.replayEntryCameraState,
    )
}

const normalizeDimensions = (dimensions = {}) => {
    const width = Math.max(2, Math.round(Number(dimensions?.width) || 0))
    const height = Math.max(2, Math.round(Number(dimensions?.height) || 0))
    return {width, height}
}

const outputTargetByteLength = target => {
    const finalizedSize = finiteNumber(target?.buffer?.byteLength, null)
    if (finalizedSize !== null) {
        return Math.max(0, Math.trunc(finalizedSize))
    }

    const writtenSize = finiteNumber(target?._maxPos, null)
    if (writtenSize !== null) {
        return Math.max(0, Math.trunc(writtenSize))
    }

    return null
}

const normalizeReplayWidgetIds = (widgetIds = []) => (
    [...new Set((widgetIds ?? []).map(widgetId => `${widgetId}`))]
        .filter(Boolean)
        .sort()
)

const resolveReplayExportClips = ({replay = defaultReplayStore(), journey = currentReplayJourney()} = {}) => {
    const clips = normalizeJourneyReplayClips(
        replay?.clips
        ?? globalThis.lgs?.stores?.replay?.clips
        ?? globalThis.lgs?.settings?.ui?.replay?.clips
        ?? {},
    )

    if (isJourneyReplayBasicMode({replay})) {
        return createBasicReplayTraceFocusClips(
            replay?.camera ?? currentJourneyReplayCameraSettings(),
            currentBasicReplaySettingsForJourney(journey).endFocus,
        )
    }

    return clips
}

/**
 * Capture the compact runtime state used to validate a deferred export plan.
 *
 * The returned object deliberately stores only the data needed to decide
 * whether the current replay/video context still matches the warm plan.
 */
export const captureReplayDeferredExportContext = ({
                                                      replay = defaultReplayStore(),
                                                      controller = defaultReplayController(),
                                                      cameraState = null,
                                                      dimensions = null,
                                                      captureMode = 'deferred-master',
                                                      fps = defaultReplayExportFps(),
                                                      renderSpec = null,
                                                      replayDurationMillis = null,
                                                      replayProgressProfile = null,
                                                      sourceCanvas = defaultReplaySourceCanvas(),
                                                      widgetsBoard = VIDEO_WIDGETS_BOARD,
                                                  } = {}) => {
    const normalizedDimensions = dimensions
                                 ? normalizeDimensions(dimensions)
                                 : normalizeDimensions({
                                     width:  Number(sourceCanvas?.width) || Number(replay?.videoCropRect?.width) || 1920,
                                     height: Number(sourceCanvas?.height) || Number(replay?.videoCropRect?.height) || 1080,
                                 })
    const normalizedCropRect = normalizeReplayVideoCropRect(replay?.videoCropRect)
    const widgetCache = globalThis.__?.ui?.widgetCache ?? null
    const widgetManager = globalThis.__?.ui?.widgetManager ?? null
    const cachedEntries = [...(widgetCache?.getAll?.({widgetsBoard})?.entries?.() ?? [])]
    const cachedEntryById = new Map(cachedEntries)
    const widgetEntries = widgetsBoard === VIDEO_WIDGETS_BOARD
                         ? getReplayVideoWidgetKeys({widgetsBoard}).map(widgetId => [
                             widgetId,
                             widgetCache?.get?.(widgetId) ?? cachedEntryById.get(widgetId),
                         ])
                         : cachedEntries
    const overlays = widgetEntries.map(([widgetId, entry]) => {
        const widgetEl = widgetManager?.getElementById?.(widgetId) ?? entry?.element ?? null
        const visible = Boolean(entry?.mounted ?? widgetEl)

        return {
            id:      widgetId,
            mounted: Boolean(entry?.mounted ?? widgetEl),
            visible,
        }
    })
    const widgetSignature = overlays
        .map(({id, mounted, visible}) => `${id}:${mounted ? 1 : 0}:${visible ? 1 : 0}`)
        .join('|')

    const initialCameraState = captureReplayCameraStateSnapshot({replay, cameraState})
    const trackPath = controller?.sampler?.logicalTrackPath ?? null
    const trackPathSignature = createReplayTrackPathDescriptor(trackPath).signature
    const visibleOverlayIds = normalizeReplayWidgetIds(
        overlays
            .filter(({visible}) => visible)
            .map(({id}) => id),
    )
    const resolvedDurationMillis = finiteNumber(replayDurationMillis, null)
                                   ?? (finiteNumber(controller?.duration, null) !== null
                                       ? Number(controller.duration) * 1000
                                       : finiteNumber(replay?.durationMillis, null))
    const resolvedRenderSpec = renderSpec ?? buildReplayVideoRenderSpec({
        cropRect: normalizedCropRect,
        sourceCanvas,
        dimensions: normalizedDimensions,
        fps,
        captureMode,
    })
    const renderContext = createReplayRenderContext({
        renderMode: REPLAY_RENDER_MODE_EXPORT,
        durationMillis: resolvedDurationMillis,
        direction: controller?.direction ?? replay?.direction,
        clipSignature: replayClipSignature(resolveReplayExportClips({replay})),
        trackPathSignature,
        widgetSignature,
        initialCameraState,
        renderSpec: resolvedRenderSpec,
        trackPath,
        visibleOverlayIds,
        recordingSync: replay?.recordingSync,
    })
    const preparationTimeline = replay?.preparationTimeline?.timeline ?? {}
    const context = {
        ...renderContext.context,
        captureMode:   captureMode === 'quality' ? 'quality' : 'speed',
        fps:           Number.isFinite(Number(fps)) ? Number(fps) : defaultReplayExportFps(),
        dimensions:    normalizedDimensions,
        cropRect:      normalizedCropRect,
        cameraState:   initialCameraState,
        recordingSync: Boolean(replay?.recordingSync),
        progress:      finiteNumber(controller?.progress ?? replay?.progress, null),
        exportRange: {
            rangeStartMillis: preparationTimeline.rangeStartMillis === null
                || preparationTimeline.rangeStartMillis === undefined
                || preparationTimeline.rangeStartMillis === ''
                ? 0
                : finiteNumber(preparationTimeline.rangeStartMillis, 0) ?? 0,
            rangeEndMillis: preparationTimeline.rangeEndMillis === null
                || preparationTimeline.rangeEndMillis === undefined
                || preparationTimeline.rangeEndMillis === ''
                ? null
                : finiteNumber(preparationTimeline.rangeEndMillis, null),
        },
        visibleOverlayIds,
        widgetSignature,
        clipSignature: replayClipSignature(resolveReplayExportClips({replay})),
        ...(replayProgressProfile ? {
            poiSpeedProfileSignature: JSON.stringify(replayProgressProfile.segments.map(segment => [
                segment.routeStartMillis,
                segment.routeEndMillis,
                segment.speedFactor,
                segment.poiCrawl === true,
            ])),
        } : {}),
        renderContract: renderContext.contract,
    }

    return {
        context,
        contextKey: JSON.stringify(context),
    }
}

const getReplayExportQuality = () => {
    const qualityIndex = globalThis.lgs?.stores?.ui?.video?.quality ?? 0
    return [QUALITY_MEDIUM, QUALITY_HIGH, QUALITY_VERY_HIGH][qualityIndex] ?? QUALITY_MEDIUM
}

// Keep the browser's fastest supported encoder as the default for Replay exports.
const getReplayExportHardwareAcceleration = () => 'no-preference'

const withTimeout = async (promise, timeoutMs, message) => {
    let timeoutId = null
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs)
            }),
        ])
    }
    finally {
        clearTimeout(timeoutId)
    }
}

const getAvcCandidates = ({width, height}) => {
    const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16)
    const macroblocksPerSecond = macroblocks * defaultReplayExportFps()
    const levelHex = macroblocks > 8704 || macroblocksPerSecond > 522240 ? '33' : '2a'
    return [
        {codec: 'avc', fullCodecString: `avc1.42e0${levelHex}`, label: `baseline-${levelHex}`},
        {codec: 'avc', fullCodecString: `avc1.4d40${levelHex}`, label: `main-${levelHex}`},
        {codec: 'avc', fullCodecString: `avc1.6400${levelHex}`, label: `high-${levelHex}`},
        {codec: 'avc', fullCodecString: null, label: 'mediabunny-default'},
    ]
}

const resolveReplayExportVideoOutput = async ({width, height, browser = globalThis.__?.device?.browser ?? 'chromium'} = {}) => {
    const safe = normalizeDimensions({width, height})
    const hardwareAcceleration = getReplayExportHardwareAcceleration()
    const bitrate = getReplayExportQuality()

    if (`${browser}`.toLowerCase() !== 'firefox') {
        for (const candidate of getAvcCandidates(safe)) {
            const probeStartedAt = runtimeNow()
            replayVideoTraceDebug('export.codec.probe.start', {
                browser: `${browser}`.toLowerCase(),
                width: safe.width,
                height: safe.height,
                bitrate,
                hardwareAcceleration,
                codec: candidate.codec,
                candidate: candidate.label,
                fullCodecString: candidate.fullCodecString,
            })
            const supported = await withTimeout(
                canEncodeVideo(candidate.codec, {
                    width:              safe.width,
                    height:             safe.height,
                    bitrate,
                    alpha:              'discard',
                    latencyMode:        'realtime',
                    hardwareAcceleration,
                    ...(candidate.fullCodecString ? {fullCodecString: candidate.fullCodecString} : {}),
                }),
                VIDEO_CODEC_PROBE_TIMEOUT_MS,
                `Video codec probe timed out for ${candidate.label}.`,
            ).catch(() => false)
            replayVideoTraceDebug('export.codec.probe.end', {
                browser: `${browser}`.toLowerCase(),
                width: safe.width,
                height: safe.height,
                bitrate,
                hardwareAcceleration,
                codec: candidate.codec,
                candidate: candidate.label,
                fullCodecString: candidate.fullCodecString,
                supported,
                elapsedMs: runtimeNow() - probeStartedAt,
            })

            if (supported) {
                return {
                    codec:           candidate.codec,
                    fullCodecString: candidate.fullCodecString,
                    format:          new Mp4OutputFormat({fastStart: false}),
                    mimeType:        'video/mp4',
                    extension:       'mp4',
                    hardwareAcceleration,
                    bitrate,
                }
            }
        }
    }

    const vp9ProbeStartedAt = runtimeNow()
    replayVideoTraceDebug('export.codec.probe.start', {
        browser: `${browser}`.toLowerCase(),
        width: safe.width,
        height: safe.height,
        bitrate,
        hardwareAcceleration,
        codec: 'vp9',
        candidate: 'vp9',
        fullCodecString: null,
    })
    const encodableCodecs = await withTimeout(
        getEncodableVideoCodecs(['vp9'], {
            width:                safe.width,
            height:               safe.height,
            bitrate,
            alpha:                'discard',
            // The export runs offline. Realtime mode may drop frames when the
            // encoder is temporarily overloaded, which makes camera motion
            // appear stepped even though the rendered timeline is smooth.
            latencyMode:          'quality',
            hardwareAcceleration,
        }),
        VIDEO_CODEC_PROBE_TIMEOUT_MS,
        'Video codec probe timed out for vp9.',
    ).catch(() => [])
    replayVideoTraceDebug('export.codec.probe.end', {
        browser: `${browser}`.toLowerCase(),
        width: safe.width,
        height: safe.height,
        bitrate,
        hardwareAcceleration,
        codec: 'vp9',
        candidate: 'vp9',
        fullCodecString: null,
        supported: encodableCodecs.length > 0,
        elapsedMs: runtimeNow() - vp9ProbeStartedAt,
    })

    const codec = encodableCodecs[0] ?? null
    if (!codec) {
        return null
    }

    return {
        codec,
        fullCodecString: null,
        format:          new Mp4OutputFormat({fastStart: false}),
        mimeType:        'video/mp4',
        extension:       'mp4',
        hardwareAcceleration,
        bitrate,
    }
}

/**
 * Wait for replay widgets to report readiness with a wall-clock budget.
 *
 * The preparation phase must not depend on animation frame cadence because a
 * background tab can throttle rAF to the point where export start becomes
 * unusably slow.
 *
 * @param {object} options - Readiness wait options.
 * @param {string[]} [options.widgetKeys=[]] - Widget identifiers to wait for.
 * @param {number} [options.maxMillis=2000] - Maximum wall-clock wait budget.
 * @param {number} [options.pollIntervalMs=50] - Poll interval between checks.
 * @param {Function} [options.isWidgetReady=isReplayVideoWidgetReady] - Readiness predicate.
 * @returns {Promise<boolean>} True when every widget became ready in time.
 */
export const waitForReplayWidgetsReady = async ({
                                                    widgetKeys = [],
                                                    maxMillis = 2000,
                                                    pollIntervalMs = 50,
                                                    isWidgetReady = isReplayVideoWidgetReady,
                                                } = {}) => {
    const keys = Array.isArray(widgetKeys) ? widgetKeys.filter(Boolean) : []
    const safeMaxMillis = Math.max(0, Math.trunc(Number(maxMillis) || 0))
    const safePollIntervalMs = Math.max(0, Math.trunc(Number(pollIntervalMs) || 0))
    const waitStartedAt = runtimeNow()
    let pollCount = 0
    replayVideoTraceDebug('export.widgets.wait.start', {
        widgetCount: keys.length,
        widgetKeys: keys,
        maxMillis: safeMaxMillis,
        pollIntervalMs: safePollIntervalMs,
    })
    let missingWidgetKeys = keys.filter(widgetId => !isWidgetReady(widgetId))
    if (keys.length === 0) {
        replayVideoTraceDebug('export.widgets.wait.ready', {
            widgetCount: 0,
            widgetKeys: [],
            skipped: true,
            elapsedMs: 0,
            pollCount: 0,
        })
        return true
    }

    const deadline = Date.now() + safeMaxMillis

    while (Date.now() <= deadline) {
        if (missingWidgetKeys.length === 0) {
            replayVideoTraceDebug('export.widgets.wait.ready', {
                widgetCount: keys.length,
                widgetKeys: keys,
                elapsedMs: runtimeNow() - waitStartedAt,
                pollCount,
            })
            return true
        }

        replayVideoTraceDebug('export.widgets.wait.poll', {
            widgetCount: keys.length,
            widgetKeys: keys,
            missingWidgetKeys,
            elapsedMs: runtimeNow() - waitStartedAt,
            pollCount,
        })
        pollCount += 1
        if (safePollIntervalMs > 0) {
            await delay(safePollIntervalMs)
            missingWidgetKeys = keys.filter(widgetId => !isWidgetReady(widgetId))
            continue
        }

        await delay(0)
        missingWidgetKeys = keys.filter(widgetId => !isWidgetReady(widgetId))
    }

    missingWidgetKeys = keys.filter(widgetId => !isWidgetReady(widgetId))
    replayVideoTraceDebug('export.widgets.wait.timeout', {
        widgetCount: keys.length,
        widgetKeys: keys,
        missingWidgetKeys,
        elapsedMs: runtimeNow() - waitStartedAt,
        pollCount,
        maxMillis: safeMaxMillis,
    })
    return missingWidgetKeys.length === 0
}

/**
 * Register every widget referenced by the prepared timeline before capture.
 * Delayed timeline clips still need mounted widgets so their first visible
 * frame does not race React or widget registration.
 *
 * @param {Object} options - Replay widget preparation options.
 * @param {Object|null} [options.replay=null] - Replay state containing the timeline manifest.
 * @param {boolean} [options.basicReplay] - Whether Basic Replay restrictions apply.
 * @returns {Promise<string[]>} Registered widget IDs to await before capture.
 */
export const prepareReplayTimelineWidgets = async ({replay = null, basicReplay} = {}) => {
    const timeline = replay?.preparationTimeline
    const manifest = [...new Set([
        ...(timeline?.widgetManifest ?? []),
        ...resolveReplayTimelineWidgetIds(timeline?.tracks),
    ])]
    const widgetKeys = getReplayVideoWidgetKeys({
        widgetKeys: manifest,
        widgetsBoard: VIDEO_WIDGETS_BOARD,
        basicReplay,
    })
    const widgetList = globalThis.lgs?.stores?.ui?.widget?.list
    const registeredKeys = getReplayVideoWidgetKeys({widgetsBoard: VIDEO_WIDGETS_BOARD, basicReplay})
    const registeredTypes = new Set(registeredKeys.map(widgetId => widgetId.split('#')[0]))
    const renderer = WidgetDynamicRenderer.instance

    await Promise.all(widgetKeys.map(widgetId => {
        const isRegistered = widgetList?.has?.(widgetId)
            || (!widgetId.includes('#') && registeredTypes.has(widgetId.split('#')[0]))
        if (isRegistered) {
            return Promise.resolve()
        }

        const group = resolveWidgetCatalogGroup(widgetId, {widgetsBoard: VIDEO_WIDGETS_BOARD})
        if (!group) {
            throw new Error(`No widget catalogue group found for ${widgetId}.`)
        }
        return renderer.renderWidget(group, widgetId, {
            widgetsBoard: VIDEO_WIDGETS_BOARD,
            forceRefresh: true,
        })
    }))

    return [...new Set([...registeredKeys, ...widgetKeys])]
}

/**
 * Yield the event loop for a bounded amount of wall-clock time.
 *
 * @param {number} millis - Delay duration in milliseconds.
 * @returns {Promise<void>} Promise resolved after the delay.
 */
const delay = millis => new Promise(resolve => setTimeout(resolve, millis))

/**
 * Publish the deterministic Replay export frame consumed by dynamic widgets.
 *
 * This mirrors the live controller's `dynamicFrameState`, but it is scoped to
 * the deferred export plan so the export renderer controls the widget clock.
 * Dry run allows normal React batching because it does not read widget pixels.
 *
 * @param {Object} options - Frame publication options.
 * @param {boolean} [options.commitSynchronously=true] - Commit widget DOM before capture.
 */
const publishReplayExportFrameState = ({
                                           plan = null,
                                           replay = defaultReplayStore(),
                                           controller = defaultReplayController(),
                                           frame = null,
                                           sample = null,
                                           phase = null,
                                           logicalFrame = null,
                                           cameraPose = null,
                                           trackPath = null,
                                           commitSynchronously = true,
                                       } = {}) => {
    if (!plan?.runtime) {
        return null
    }

    const frameSample = sample
                        ?? frame?.sample
                        ?? controller?.currentSample?.()
                        ?? replay?.sample
                        ?? replay?.liveSample
                        ?? null
    const progress = finiteNumber(frame?.progress, null)
                     ?? finiteNumber(controller?.progress, null)
                     ?? finiteNumber(replay?.progress, 0)
                     ?? 0
    const direction = Number(controller?.direction ?? replay?.direction) < 0 ? -1 : 1
    const durationMillis = finiteNumber(frameSample?.journeyDurationMillis, null)
                           ?? finiteNumber(controller?.sampler?.durationMillis, null)
                           ?? (finiteNumber(controller?.duration, null) !== null ? finiteNumber(controller.duration, 0) * 1000 : null)
                           ?? finiteNumber(replay?.durationMillis, null)
    const elapsedMillis = finiteNumber(frameSample?.journeyElapsedMillis, null)
                          ?? finiteNumber(replay?.elapsedMillis, null)
                          ?? (durationMillis !== null ? Math.max(0, durationMillis * progress) : null)

    const frameState = buildReplayFrameState({
        active:          true,
        playing:         true,
        paused:          false,
        index:           Number.isFinite(Number(frame?.index)) ? Number(frame.index) : null,
        progress,
        direction,
        sample:          frameSample,
        elapsedMillis,
        durationMillis,
        frameCount:      finiteNumber(frame?.frameCount, null),
        frameTimeMs:     finiteNumber(frame?.frameTimeMs, null),
        frameIntervalMs: finiteNumber(frame?.frameIntervalMs, null),
        replayFrameIndex: finiteNumber(phase?.replayFrameIndex, null),
        replayFrameCount: finiteNumber(phase?.replayFrameCount, null),
        phase,
        source:          'exporter',
        updatedAt:       globalThis.performance?.now?.() ?? Date.now(),
        renderMode:      'export',
        planId:          plan.renderPlan?.id ?? plan.runtime?.contextKey ?? null,
        intentResolved:  true,
        cameraPose:      cameraPose
                         ?? logicalFrame?.cameraPose
                         ?? plan.renderContract?.cameraPose
                         ?? plan.runtime?.context?.renderContract?.cameraPose
                         ?? null,
        cameraFrame:     logicalFrame?.cameraFrame ?? null,
        trackPath:       trackPath
                        ?? plan.renderContract?.trackPath
                        ?? plan.runtime?.context?.renderContract?.trackPath
                        ?? null,
        initialCameraState: plan.runtime?.context?.cameraState ?? null,
        renderSpec:      plan.renderSpec ?? null,
        visibleOverlayIds: plan.runtime?.context?.visibleOverlayIds ?? [],
    })

    /** Publish canonical frame state without imposing widget rendering cadence. */
    const publishFrame = () => publishReplayFrameState({
        replay,
        plan,
        target: REPLAY_FRAME_PUBLICATION_TARGET_EXPORT,
        frameState,
        intentOptions: {
            planId: plan.renderPlan?.id ?? plan.runtime?.contextKey ?? null,
            resolved: true,
            logicalFrame,
        },
    })
    return commitSynchronously ? commitReplayWidgetFrame(publishFrame) : publishFrame()
}

const clearReplayExportFrameState = (plan = null) => {
    if (plan?.runtime) {
        plan.runtime.frameState = null
        plan.runtime.resolvedFrameState = null
    }
}

const replayExportPausedDurationMillis = ({runtime = null, now = runtimeNow()} = {}) => {
    if (!runtime) {
        return 0
    }

    const basePausedDuration = Math.max(0, finiteNumber(runtime.exportPausedDurationMillis, 0) ?? 0)
    if (runtime.exportPaused !== true) {
        return basePausedDuration
    }

    const pausedAt = finiteNumber(runtime.exportPausedAt, now)
    return basePausedDuration + (pausedAt !== null ? Math.max(0, now - pausedAt) : 0)
}

const replayExportActiveElapsedMillis = ({runtime = null, now = runtimeNow()} = {}) => {
    if (!runtime) {
        return 0
    }

    const startedAt = finiteNumber(runtime.exportStartedAt, now) ?? now
    return Math.max(0, now - startedAt - replayExportPausedDurationMillis({runtime, now}))
}

const average = values => {
    const safeValues = (values ?? []).filter(value => Number.isFinite(Number(value)) && Number(value) > 0)
    if (!safeValues.length) {
        return null
    }

    return safeValues.reduce((total, value) => total + Number(value), 0) / safeValues.length
}

const initializeReplayExportCreationProgress = ({plan = null} = {}) => {
    if (!plan?.runtime) {
        return null
    }

    const now = runtimeNow()
    const frameCount = finiteNumber(plan.manifest?.frameCount, null)
    Object.assign(plan.runtime, {
        exportStartedAt:                now,
        exportProgress:                 0,
        exportFrameIndex:               null,
        exportFrameCount:               frameCount,
        exportProcessedFrames:          0,
        exportElapsedMillis:            0,
        exportFileSize:                 0,
        exportEstimatedRemainingMillis: null,
        exportEstimatedTotalMillis:     null,
        exportAverageFrameMillis:       null,
        exportFrameDurationSamples:     [],
        exportFrameTimingStartedAt:     null,
        exportFrameTimingPausedDurationAtStart: null,
        exportLastProgressAt:                   now,
        exportLastProgressProcessedFrames:      0,
        exportLastProgressPausedDurationMillis: 0,
        exportPaused:                   false,
        exportPausedAt:                 null,
        exportPausedDurationMillis:     0,
        exportStopRequested:            false,
        exportUpdatedAt:                now,
    })

    return plan.runtime
}

const updateReplayExportFileSize = ({plan = null, bytes = null} = {}) => {
    if (!plan?.runtime) {
        return null
    }

    const size = finiteNumber(bytes, null)
    if (size === null || size < 0) {
        return plan.runtime
    }

    Object.assign(plan.runtime, {
        exportFileSize:  Math.max(0, Math.trunc(size)),
        exportUpdatedAt: runtimeNow(),
    })

    return plan.runtime
}

const installReplayExportRuntimeControls = ({plan = null, abortController = null} = {}) => {
    if (!plan?.runtime) {
        return null
    }

    const runtime = plan.runtime
    runtime.pauseExport = () => {
        if (runtime.status !== 'exporting' || runtime.exportPaused === true) {
            return
        }

        runtime.exportPaused = true
        runtime.exportPausedAt = runtimeNow()
        runtime.exportUpdatedAt = runtime.exportPausedAt
    }
    runtime.resumeExport = () => {
        if (runtime.exportPaused !== true) {
            return
        }

        const now = runtimeNow()
        const pausedAt = finiteNumber(runtime.exportPausedAt, now) ?? now
        runtime.exportPausedDurationMillis = Math.max(0, finiteNumber(runtime.exportPausedDurationMillis, 0) ?? 0) + Math.max(0, now - pausedAt)
        runtime.exportPaused = false
        runtime.exportPausedAt = null
        runtime.exportUpdatedAt = now
    }
    /**
     * Finish the current encoded frame, then finalize the partial Replay video.
     * @returns {void} Nothing.
     */
    runtime.stopExport = () => {
        if (runtime.status !== 'exporting' || runtime.exportStopRequested === true) {
            return
        }

        runtime.exportStopRequested = true
        runtime.exportUpdatedAt = runtimeNow()
        if (runtime.exportPaused === true) {
            runtime.resumeExport()
        }
    }
    runtime.abortExport = () => {
        const controller = abortController ?? runtime.abortController ?? null
        controller?.abort?.()
        return runtime.exportPromise ?? Promise.resolve()
    }

    return runtime
}

const waitForReplayExportResume = async ({plan = null, signal = null} = {}) => {
    while (plan?.runtime?.exportPaused === true && !signal?.aborted) {
        await delay(100)
    }
}

/**
 * Update export timing and progress, optionally limiting publication frequency.
 *
 * @param {object} options - Progress update inputs.
 * @param {object|null} options.plan - Deferred export plan.
 * @param {object|null} options.frame - Most recently processed frame.
 * @param {boolean} options.force - Whether to publish regardless of the interval.
 * @param {number} options.minimumIntervalMs - Minimum time between progress updates.
 * @returns {object|null} Updated runtime, or null when an interval skips the update.
 */
const updateReplayExportCreationProgress = ({
                                                plan = null,
                                                frame = null,
                                                force = false,
                                                minimumIntervalMs = 0,
                                            } = {}) => {
    if (!plan?.runtime) {
        return null
    }

    const frameIndex = finiteNumber(frame?.index, null)
    const frameCount = finiteNumber(frame?.frameCount ?? plan.manifest?.frameCount, null)
    const processedFrames = frameIndex !== null
                            ? Math.max(0, Math.trunc(frameIndex) + 1)
                            : finiteNumber(plan.runtime.exportProcessedFrames, 0)
    const safeFrameCount = frameCount !== null && frameCount > 0 ? frameCount : null
    const isLastFrame = safeFrameCount !== null && processedFrames >= safeFrameCount
    const safeMinimumIntervalMs = Math.max(0, finiteNumber(minimumIntervalMs, 0) ?? 0)
    const previousUpdateAt = finiteNumber(plan.runtime.exportLastProgressAt, null)
    const now = safeMinimumIntervalMs > 0 ? runtimeNow() : null
    const isIntervalElapsed = safeMinimumIntervalMs === 0
                              || previousUpdateAt === null
                              || (now - previousUpdateAt) >= safeMinimumIntervalMs
    const shouldUpdate = force
                         || processedFrames <= 1
                         || isLastFrame
                         || (processedFrames % EXPORT_PROGRESS_UPDATE_FRAME_STEP === 0 && isIntervalElapsed)

    if (!shouldUpdate) {
        return null
    }

    const runtime = plan.runtime
    const updateAt = now ?? runtimeNow()
    const pausedDurationMillis = replayExportPausedDurationMillis({runtime, now: updateAt})
    const elapsedMillis = replayExportActiveElapsedMillis({runtime, now: updateAt})
    const frameTimingStartedAt = runtime.exportFrameTimingStartedAt === null
                                 ? updateAt
                                 : finiteNumber(runtime.exportFrameTimingStartedAt, updateAt)
    const frameTimingPausedDurationAtStart = runtime.exportFrameTimingPausedDurationAtStart === null
                                             ? pausedDurationMillis
                                             : finiteNumber(runtime.exportFrameTimingPausedDurationAtStart, pausedDurationMillis)
    const frameElapsedMillis = Math.max(
        0,
        updateAt - frameTimingStartedAt - Math.max(0, pausedDurationMillis - frameTimingPausedDurationAtStart),
    )
    const progress = safeFrameCount !== null
                     ? clampProgress(processedFrames / safeFrameCount)
                     : clampProgress(frame?.progress)
    const previousProcessedFrames = finiteNumber(runtime.exportLastProgressProcessedFrames, 0) ?? 0
    const previousPausedDurationMillis = finiteNumber(runtime.exportLastProgressPausedDurationMillis, 0) ?? 0
    const frameDelta = Math.max(0, processedFrames - previousProcessedFrames)
    const activeDeltaMillis = previousProcessedFrames > 0 && previousUpdateAt !== null
                              ? Math.max(0, updateAt - previousUpdateAt - Math.max(0, pausedDurationMillis - previousPausedDurationMillis))
                              : 0
    const nextSamples = Array.isArray(runtime.exportFrameDurationSamples)
                        ? [...runtime.exportFrameDurationSamples]
                        : []
    if (previousProcessedFrames > 0 && frameDelta > 0 && activeDeltaMillis > 0) {
        const frameMillis = activeDeltaMillis / frameDelta
        for (let index = 0; index < frameDelta; index += 1) {
            nextSamples.push(frameMillis)
        }
        nextSamples.splice(0, Math.max(0, nextSamples.length - EXPORT_PROGRESS_FRAME_SAMPLE_WINDOW))
    }

    const recentAverageFrameMillis = average(nextSamples)
    const completedFrameIntervals = Math.max(0, processedFrames - 1)
    const lifetimeAverageFrameMillis = completedFrameIntervals > 0 && frameElapsedMillis > 0
                                       ? frameElapsedMillis / completedFrameIntervals
                                       : null
    const previousAverageFrameMillis = runtime.exportAverageFrameMillis === null
                                         || runtime.exportAverageFrameMillis === undefined
                                         ? null
                                         : finiteNumber(runtime.exportAverageFrameMillis, null)
    const measuredAverageFrameMillis = recentAverageFrameMillis !== null && lifetimeAverageFrameMillis !== null
                                       ? (recentAverageFrameMillis * 0.7) + (lifetimeAverageFrameMillis * 0.3)
                                       : recentAverageFrameMillis ?? lifetimeAverageFrameMillis ?? previousAverageFrameMillis
    const averageFrameMillis = measuredAverageFrameMillis !== null && previousAverageFrameMillis !== null
                               ? (previousAverageFrameMillis * 0.35) + (measuredAverageFrameMillis * 0.65)
                               : measuredAverageFrameMillis
    const remainingFrames = safeFrameCount !== null ? Math.max(0, safeFrameCount - processedFrames) : null
    const estimatedTotalMillis = averageFrameMillis !== null && safeFrameCount !== null
                                 ? averageFrameMillis * safeFrameCount
                                 : (progress > 0 && frameElapsedMillis > 0 ? frameElapsedMillis / progress : null)
    const estimatedRemainingMillis = remainingFrames !== null && averageFrameMillis !== null
                                     ? averageFrameMillis * remainingFrames
                                     : (estimatedTotalMillis !== null ? Math.max(0, estimatedTotalMillis - frameElapsedMillis) : null)

    Object.assign(runtime, {
        exportProgress:                 progress,
        exportFrameIndex:               frameIndex,
        exportFrameCount:               frameCount,
        exportProcessedFrames:          processedFrames,
        exportElapsedMillis:            elapsedMillis,
        exportEstimatedRemainingMillis: estimatedRemainingMillis,
        exportEstimatedTotalMillis:     estimatedTotalMillis,
        exportAverageFrameMillis:       averageFrameMillis,
        exportFrameDurationSamples:     nextSamples,
        exportFrameTimingStartedAt: frameTimingStartedAt,
        exportFrameTimingPausedDurationAtStart: frameTimingPausedDurationAtStart,
        exportLastProgressAt:                   updateAt,
        exportLastProgressProcessedFrames:      processedFrames,
        exportLastProgressPausedDurationMillis: pausedDurationMillis,
        exportUpdatedAt:                updateAt,
    })

    return runtime
}

const downloadBlob = (blob, filename) => {
    if (!(blob instanceof Blob)) {
        throw new Error('downloadBlob expects a Blob.')
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Deferred replay exporter skeleton.
 *
 * This class does not encode media by itself. It owns the deterministic frame
 * traversal and returns a manifest plus rendered frame payloads so a caller can
 * feed a future encoder or archival pipeline.
 */
export class ReplayDeferredExporter {
    #session = null
    #timeline = null
    #buildArtifact = null
    #preparedOutputConfig = null

    constructor({
                    session = null,
                    controller = null,
                    timeline = null,
                    seek = null,
                    render = null,
                    beforeFrame = null,
                    afterFrame = null,
                    resolveSample = null,
                    buildArtifact = null,
                    renderMode = REPLAY_RENDER_MODE_EXPORT,
                    renderSpec = null,
                    initialCameraState = null,
                    visibleOverlayIds = [],
                    trackPath = null,
                    definition = null,
                    renderPlan = null,
                    frameResolver = null,
                } = {}) {
        this.#timeline = timeline instanceof ReplayFrameTimeline
                         ? timeline
                         : new ReplayFrameTimeline(timeline ?? {})
        this.#session = session instanceof ReplayVideoRenderSession
                        ? session
                        : new ReplayVideoRenderSession({
                            controller,
                            timeline:      this.#timeline,
                            seek,
                            render,
                            beforeFrame,
                            afterFrame,
                            resolveSample,
                            renderMode,
                            renderSpec,
                            initialCameraState,
                            visibleOverlayIds,
                            trackPath,
                            definition,
                            renderPlan,
                            frameResolver,
                        })
        this.#buildArtifact = typeof buildArtifact === 'function'
                              ? buildArtifact
                              : payload => payload
    }

    get timeline() {
        return this.#timeline
    }

    get session() {
        return this.#session
    }

    get preparedOutputConfig() {
        return this.#preparedOutputConfig
    }

    prepareRuntime = async ({dimensions = null, browser = globalThis.__?.device?.browser ?? 'chromium'} = {}) => {
        const outputDimensions = normalizeDimensions(dimensions ?? {})
        if (outputDimensions.width <= 0 || outputDimensions.height <= 0) {
            throw new Error('ReplayDeferredExporter.prepareRuntime requires valid dimensions.')
        }

        this.#preparedOutputConfig = await resolveReplayExportVideoOutput({
            width:  outputDimensions.width,
            height: outputDimensions.height,
            browser,
        })

        if (!this.#preparedOutputConfig) {
            throw new Error(`No supported video codec for ${outputDimensions.width}x${outputDimensions.height} on this browser.`)
        }

        return this.#preparedOutputConfig
    }

    buildManifest = ({label = 'replay-export', metadata = null} = {}) => ({
        label,
        createdAt: defaultTimestamp(),
        durationMillis: this.#timeline.durationMillis,
        fps: this.#timeline.fps,
        direction: this.#timeline.direction,
        frameCount: this.#timeline.frameCount,
        frameIntervalMs: this.#timeline.frameIntervalMs,
        includeFinalFrame: true,
        metadata,
    })

    exportFrames = async ({
                              signal = null,
                              onFrame = null,
                              label = 'replay-export',
                              metadata = null,
                          } = {}) => {
        const manifest = this.buildManifest({label, metadata})
        const frames = []

        const renderedFrames = await this.#session.renderAll({
            signal,
            onFrame: async rendered => {
                frames.push(rendered)
                if (typeof onFrame === 'function') {
                    await onFrame(rendered, manifest)
                }
            },
        })

        const payload = {
            manifest,
            frames: renderedFrames,
        }

        return this.#buildArtifact({
            ...payload,
            frameCount: finiteNumber(renderedFrames?.length, 0) ?? 0,
            framesCollected: frames,
        })
    }

    /**
     * Traverse the full timeline without capturing images or creating a video.
     *
     * @param {Object} options - Dry run options.
     * @param {AbortSignal|null} [options.signal=null] - Optional cancellation signal.
     * @param {Function|null} [options.onFrame=null] - Per-frame progress callback.
     * @param {string} [options.label='replay-dry-run'] - Run label.
     * @param {Object|null} [options.metadata=null] - Timeline metadata.
     * @param {Object|null} [options.dimensions=null] - Output dimensions retained as metadata.
     * @param {Function|null} [options.renderFrame=null] - Logical Replay frame update callback.
     * @param {Function|null} [options.shouldStop=null] - Optional early-stop predicate.
     * @param {boolean} [options.seekBeforeRender=true] - Whether the session seeks before the render callback.
     * @param {number} [options.yieldIntervalMs=50] - Minimum work interval between browser task yields.
     * @param {Function|null} [options.yieldToBrowser=null] - Optional UI yield callback.
     * @returns {Promise<Object>} Dry run result without frame payloads or media output.
     */
    renderOnly = async ({
                           signal = null,
                           onFrame = null,
                           label = 'replay-dry-run',
                           metadata = null,
                           dimensions = null,
                           renderFrame = null,
                           shouldStop = null,
                           seekBeforeRender = true,
                           yieldIntervalMs = REPLAY_DRY_RUN_BROWSER_YIELD_INTERVAL_MS,
                           yieldToBrowser = null,
                       } = {}) => {
        if (typeof renderFrame !== 'function') {
            throw new Error('ReplayDeferredExporter.renderOnly requires a renderFrame callback.')
        }

        const outputDimensions = normalizeDimensions(dimensions ?? {})
        const manifest = this.buildManifest({label, metadata})
        const frameCount = await this.#session.renderEach({
            signal,
            shouldStop,
            seekBeforeRender,
            yieldBetweenFrames: true,
            yieldIntervalMs,
            yieldToBrowser,
            onFrame: async frame => {
                await renderFrame({frame, manifest, metadata})
                if (typeof onFrame === 'function') {
                    await onFrame(frame, manifest)
                }
            },
        })

        if (signal?.aborted) {
            throw new DOMException('The Replay dry run was cancelled.', 'AbortError')
        }

        return this.#buildArtifact({
            dryRun: true,
            manifest,
            frameCount,
            renderedFrameCount: frameCount,
            dimensions: outputDimensions,
            label,
        })
    }

    /**
     * Encode the deterministic timeline, or traverse logical frames without capture.
     * @param {Object} options - MP4 or dry-run options.
     * @param {boolean} [options.dryRun=false] - Update Replay frames without capture or media output.
     * @param {Object|null} [options.recordingPerformance=null] - Shared session timing collector.
     * @param {Function|null} [options.onPerformance=null] - Receive the completed or partial timing report.
     * @param {boolean} [options.seekBeforeRender=true] - Whether the session owns the initial controller seek.
     * @param {number} [options.yieldIntervalMs=50] - Dry run browser task yield interval.
     * @returns {Promise<Object>} Export or dry-run result.
     */
    exportMp4 = async ({
                           signal = null,
                           onFrame = null,
                           label = 'replay-export',
                           metadata = null,
                           dimensions = null,
                           browser = globalThis.__?.device?.browser ?? 'chromium',
                           renderFrame = null,
                           buildCanvas = null,
                           onFileSize = null,
                           shouldStop = null,
                           seekBeforeRender = true,
                           yieldIntervalMs = REPLAY_DRY_RUN_BROWSER_YIELD_INTERVAL_MS,
                           yieldToBrowser = null,
                           dryRun = false,
                           recordingPerformance = null,
                           onPerformance = null,
                       } = {}) => {
        if (dryRun === true) {
            return this.renderOnly({
                signal,
                onFrame,
                label,
                metadata,
                dimensions,
                renderFrame,
                shouldStop,
                seekBeforeRender,
                yieldIntervalMs,
                yieldToBrowser,
            })
        }

        const performance = recordingPerformance ?? createReplayRecordingPerformance()
        performance.start({
            label,
            browser,
            dimensions: normalizeDimensions(dimensions ?? {}),
            fps: this.#timeline.fps,
            plannedFrameCount: this.#timeline.frameCount,
        })
        let result = null
        let status = 'failed'
        let failure = null
        let performanceReport = null
        try {
            result = await this.#encodeMp4({
                signal, onFrame, label, metadata, dimensions, browser, renderFrame,
                buildCanvas, onFileSize, shouldStop, seekBeforeRender, recordingPerformance: performance,
            })
            status = result.frameCount < this.#timeline.frameCount ? 'stopped' : 'completed'
        }
        catch (error) {
            failure = error
            status = error?.name === 'AbortError' ? 'cancelled' : 'failed'
            throw error
        }
        finally {
            performanceReport = performance.finish({status, outputBytes: result?.blob?.size ?? null, error: failure})
            // Publish one aggregate report after cleanup, never one message per frame.
            if (typeof onPerformance === 'function') {
                try {
                    onPerformance(performanceReport)
                }
                catch (error) {
                    // Diagnostics must not replace the original encoding result or failure.
                    console.warn('[Replay video] Recording performance publication failed:', error)
                }
            }
            console.info('[Replay video] Recording performance:', performanceReport)
            console.table(performanceReport.stages.map(stage => ({
                Stage: stage.label,
                Kind: stage.kind,
                Count: stage.count,
                'Total ms': stage.totalMillis,
                'Mean ms': stage.averageMillis,
                'P50 approx ms': stage.p50Millis,
                'P95 approx ms': stage.p95Millis,
                'Max ms': stage.maxMillis,
                '% active session': stage.activeWallPercent,
            })))
        }
        return this.#buildArtifact({...result, recordingPerformance: performanceReport})
    }

    /**
     * Preserve the existing MP4 capture/encoding order while measuring its stages.
     * The caller owns the session-local collector and publishes the final report.
     */
    #encodeMp4 = async ({
        signal, onFrame, label, metadata, dimensions, browser, renderFrame,
        buildCanvas, onFileSize, shouldStop, seekBeforeRender, recordingPerformance,
    }) => {
        if (typeof renderFrame !== 'function') {
            throw new Error('ReplayDeferredExporter.exportMp4 requires a renderFrame callback.')
        }

        const outputDimensions = normalizeDimensions(dimensions ?? {})
        if (outputDimensions.width <= 0 || outputDimensions.height <= 0) {
            throw new Error('ReplayDeferredExporter.exportMp4 requires valid dimensions.')
        }

        const codecStartedAt = recordingPerformance.now()
        let outputConfig = null
        try {
            outputConfig = this.#preparedOutputConfig ?? await resolveReplayExportVideoOutput({
                width: outputDimensions.width, height: outputDimensions.height, browser,
            })
        }
        finally {
            recordingPerformance.record('codecSetup', codecStartedAt)
        }
        if (!outputConfig) {
            throw new Error(`No supported video codec for ${outputDimensions.width}x${outputDimensions.height} on this browser.`)
        }

        recordingPerformance.configure({
            codec: outputConfig.codec,
            fullCodecString: outputConfig.fullCodecString,
            bitrate: outputConfig.bitrate,
            hardwareAcceleration: outputConfig.hardwareAcceleration,
            latencyMode: 'quality',
            reusedCodecConfiguration: Boolean(this.#preparedOutputConfig),
        })
        const outputSetupStartedAt = recordingPerformance.now()
        const canvas = typeof buildCanvas === 'function'
                       ? buildCanvas(outputDimensions)
                       : document.createElement('canvas')
        canvas.width = outputDimensions.width
        canvas.height = outputDimensions.height

        const ctx = canvas.getContext('2d', {alpha: false, desynchronized: true})
        if (!ctx) {
            throw new Error('ReplayDeferredExporter.exportMp4 could not acquire a 2D canvas context.')
        }

        const manifest = this.buildManifest({label, metadata})
        const target = new BufferTarget()
        const output = new Output({
            format: outputConfig.format,
            target,
        })
        await output.setMetadataTags(normalizeMediabunnyMetadataTags(metadata))

        let encodedPacketBytes = 0
        let lastPublishedFileSize = -1
        const publishFileSize = ({force = false} = {}) => {
            if (typeof onFileSize !== 'function') {
                return
            }

            const targetBytes = outputTargetByteLength(target)
            const bytes = Math.max(targetBytes ?? 0, encodedPacketBytes)
            if (!force && bytes === lastPublishedFileSize) {
                return
            }

            lastPublishedFileSize = bytes
            const publicationStartedAt = recordingPerformance.now()
            try {
                onFileSize(bytes, {
                    encodedPacketBytes,
                    targetBytes,
                    finalized: Boolean(target.buffer),
                })
            }
            finally {
                recordingPerformance.record('fileSizePublication', publicationStartedAt)
            }
        }

        // CanvasSource snapshots the canvas into a VideoFrame synchronously in
        // add(), so it is safe to reuse this canvas without an intermediate copy.
        const source = new CanvasSource(canvas, {
            codec:                outputConfig.codec,
            bitrate:              outputConfig.bitrate,
            alpha:                'discard',
            // The export uses fixed timestamps. Realtime mode may drop
            // frames while the encoder is slower than the requested FPS.
            latencyMode:          'quality',
            hardwareAcceleration: outputConfig.hardwareAcceleration,
            ...(outputConfig.fullCodecString ? {fullCodecString: outputConfig.fullCodecString} : {}),
            // The composition canvas already uses outputDimensions, so a
            // transform would redraw every frame without changing its size.
            onEncoderConfig:    () => {},
            onEncodedPacket:    packet => {
                const packetBytes = finiteNumber(packet?.byteLength, null)
                                    ?? finiteNumber(packet?.data?.byteLength, 0)
                                    ?? 0
                const alphaBytes = finiteNumber(packet?.sideData?.alphaByteLength, null)
                                   ?? finiteNumber(packet?.sideData?.alpha?.byteLength, 0)
                                   ?? 0
                const packetSize = Math.max(0, packetBytes) + Math.max(0, alphaBytes)
                encodedPacketBytes += packetSize
                recordingPerformance.packetEncoded(packetSize)
                publishFileSize()
            },
        })

        output.addVideoTrack(source, {
            frameRate: this.#timeline.fps,
        })

        let outputStarted = false
        let outputFinalized = false
        let sourceOperation = Promise.resolve()
        let sourceOperationError = null
        let lastEncodedTimestamp = null
        let nextFrameTimestamp = null
        let keepAliveTimer = null
        let keepAliveStopped = false

        /**
         * Serialize frame submissions so keep-alive frames cannot race normal frames.
         *
         * @param {object} options - Frame submission options.
         * @param {number} options.timestamp - Timestamp in seconds.
         * @param {number} options.duration - Duration in seconds.
         * @param {object|undefined} [options.encodeOptions] - Mediabunny encode options.
         * @param {boolean} [options.keepAlive=false] - Whether this is a codec keep-alive.
         * @returns {Promise<void>} Promise resolved after the frame is submitted.
         */
        const enqueueSourceAdd = ({timestamp, duration, encodeOptions, keepAlive = false}) => {
            const queuedAt = recordingPerformance.now()
            const operation = sourceOperation.then(async () => {
                if (sourceOperationError) {
                    throw sourceOperationError
                }
                if (keepAlive && keepAliveStopped) {
                    return
                }

                let safeTimestamp = timestamp
                if (keepAlive) {
                    if (lastEncodedTimestamp === null || nextFrameTimestamp === null) {
                        return
                    }

                    safeTimestamp = Math.min(
                        nextFrameTimestamp - REPLAY_EXPORT_CODEC_KEEPALIVE_TIMESTAMP_STEP_SECONDS,
                        lastEncodedTimestamp + REPLAY_EXPORT_CODEC_KEEPALIVE_TIMESTAMP_STEP_SECONDS,
                    )
                    if (safeTimestamp <= lastEncodedTimestamp) {
                        return
                    }
                }

                recordingPerformance.record(keepAlive ? 'encoderKeepAliveQueue' : 'encoderQueueWait', queuedAt)
                const submissionStartedAt = recordingPerformance.now()
                try {
                    await source.add(safeTimestamp, duration, encodeOptions)
                }
                finally {
                    recordingPerformance.record(keepAlive ? 'encoderKeepAliveSubmission' : 'encoderSubmission', submissionStartedAt)
                }
                recordingPerformance.frameSubmitted({keepAlive, timestamp: safeTimestamp, duration})
                lastEncodedTimestamp = safeTimestamp
                publishFileSize()
            })
            sourceOperation = operation.catch(error => {
                sourceOperationError = error
            })
            return operation
        }

        /**
         * Schedule a tiny duplicate frame while Cesium is taking longer than usual.
         * The timestamp step is deliberately microscopic so the keep-alive does not
         * change the visible duration of the exported replay.
         */
        const scheduleCodecKeepAlive = () => {
            if (keepAliveStopped || keepAliveTimer !== null) {
                return
            }

            keepAliveTimer = setTimeout(() => {
                keepAliveTimer = null
                void enqueueSourceAdd({
                    timestamp: 0,
                    duration: REPLAY_EXPORT_CODEC_KEEPALIVE_TIMESTAMP_STEP_SECONDS,
                    keepAlive: true,
                })
                    .catch(() => undefined)
                    .finally(scheduleCodecKeepAlive)
            }, REPLAY_EXPORT_CODEC_KEEPALIVE_INTERVAL_MS)
        }

        try {
            outputStarted = true
            try {
                await output.start()
            }
            finally {
                recordingPerformance.record('outputSetup', outputSetupStartedAt)
            }
            publishFileSize({force: true})

            const renderedFrames = []
            let frames = null
            const frameLoopStartedAt = recordingPerformance.now()
            let frameResolutionStartedAt = frameLoopStartedAt
            try {
                frames = await this.#session.renderAll({
                    signal,
                    shouldStop,
                    seekBeforeRender,
                    onFrame: async rendered => {
                        recordingPerformance.record('frameResolution', frameResolutionStartedAt)
                        nextFrameTimestamp = rendered.frameTimeMs / 1000
                        const renderingStartedAt = recordingPerformance.now()
                        let renderResult = null
                        try {
                            renderResult = await renderFrame({
                                canvas,
                                context: ctx,
                                frame: rendered,
                                manifest,
                                metadata,
                            })
                        }
                        finally {
                            recordingPerformance.record('frameRendering', renderingStartedAt)
                        }
                        renderedFrames.push(renderResult ?? rendered)
                        await enqueueSourceAdd({
                            timestamp: rendered.frameTimeMs / 1000,
                            duration: rendered.frameIntervalMs / 1000,
                            encodeOptions: rendered.isFirst ? {keyFrame: true} : undefined,
                        })
                        scheduleCodecKeepAlive()
                        if (typeof onFrame === 'function') {
                            const progressStartedAt = recordingPerformance.now()
                            try {
                                await onFrame(rendered, manifest)
                            }
                            finally {
                                recordingPerformance.record('progressPublication', progressStartedAt)
                            }
                        }
                        frameResolutionStartedAt = recordingPerformance.now()
                    },
                })
            }
            finally {
                recordingPerformance.record('frameLoop', frameLoopStartedAt)
            }

            if (signal?.aborted) {
                throw new DOMException('The Replay export was cancelled.', 'AbortError')
            }
            keepAliveStopped = true
            if (keepAliveTimer !== null) {
                clearTimeout(keepAliveTimer)
                keepAliveTimer = null
            }
            const drainStartedAt = recordingPerformance.now()
            try {
                await source.close()
            }
            finally {
                recordingPerformance.record('encoderDrain', drainStartedAt)
            }
            const finalizeStartedAt = recordingPerformance.now()
            try {
                await output.finalize()
            }
            finally {
                recordingPerformance.record('containerFinalize', finalizeStartedAt)
            }
            outputFinalized = true

            const blobStartedAt = recordingPerformance.now()
            let blob = null
            try {
                blob = new Blob([output.target.buffer], {type: outputConfig.mimeType})
            }
            finally {
                recordingPerformance.record('blobCreation', blobStartedAt)
            }
            publishFileSize({force: true})
            if (typeof onFileSize === 'function') {
                const publicationStartedAt = recordingPerformance.now()
                try {
                    onFileSize(blob.size, {
                        encodedPacketBytes,
                        targetBytes: blob.size,
                        finalized: true,
                    })
                }
                finally {
                    recordingPerformance.record('fileSizePublication', publicationStartedAt)
                }
            }
            return {
                blob,
                manifest,
                frames,
                renderedFrames,
                frameCount: finiteNumber(frames?.length, 0) ?? 0,
                mimeType: outputConfig.mimeType,
                extension: outputConfig.extension,
                label,
            }
        }
        finally {
            keepAliveStopped = true
            if (keepAliveTimer !== null) {
                clearTimeout(keepAliveTimer)
                keepAliveTimer = null
            }
            await sourceOperation.catch(() => undefined)
            if (outputStarted && !outputFinalized && typeof output.cancel === 'function') {
                const cleanupStartedAt = recordingPerformance.now()
                try {
                    await output.cancel().catch(() => undefined)
                }
                finally {
                    recordingPerformance.record('cancellationCleanup', cleanupStartedAt)
                }
            }
        }
    }
}

/**
 * Prepare a replay deferred export plan and attach it to the replay store.
 *
 * The plan records a timeline, the chosen label, the intended output size, and
 * a compact runtime context key. It does not store frame payloads.
 */
export const prepareReplayDeferredExportPlan = ({
                                                    replay = defaultReplayStore(),
                                                    journey = defaultJourney(),
                                                    controller = defaultReplayController(),
                                                    fps = defaultReplayExportFps(),
                                                    label = 'replay-master-export',
                                                    metadata = null,
                                                    mediaMetadata = null,
                                                    dimensions = null,
                                                    renderSpec = null,
                                                    captureMode = 'deferred-master',
                                                    sourceCanvas = defaultReplaySourceCanvas(),
                                                    context = null,
                                                    uiToast = UIToast,
                                                } = {}) => {
    const replayDurationMillis = Number.isFinite(Number(controller?.duration))
                                ? Math.max(0, Number(controller.duration) * 1000)
                                : Math.max(0, Number(replay?.durationMillis) || 0)
    const direction = controller?.direction ?? replay?.direction ?? 1
    const poiSpeedProfile = resolveReplayPOISpeedProfile({
        replay,
        journey,
        controller,
        replayDurationMillis,
        direction,
    })
    const timelineReplayDurationMillis = poiSpeedProfile?.playbackDurationMillis ?? replayDurationMillis
    const replayClips = resolveReplayExportClips({replay, journey})
    const videoTimeline = buildReplayVideoTimeline({
        replayDurationMillis: timelineReplayDurationMillis,
        fps,
        direction,
        clips: replayClips,
        replayProgressProfile: poiSpeedProfile,
    })
    const exportWindow = resolveReplayExportWindow({replay, timeline: videoTimeline})
    const effectiveRenderSpec = renderSpec ?? buildReplayVideoRenderSpec({
        cropRect: replay?.videoCropRect,
        sourceCanvas,
        dimensions,
        fps,
        captureMode,
    })
    const effectiveDimensions = dimensions
                                ? normalizeDimensions(dimensions)
                                : (effectiveRenderSpec?.dimensions ? normalizeDimensions(effectiveRenderSpec.dimensions) : null)
    const replayContext = context ?? captureReplayDeferredExportContext({
        replay,
        controller,
        dimensions: effectiveDimensions,
        captureMode,
        fps,
        renderSpec: effectiveRenderSpec,
        replayDurationMillis: timelineReplayDurationMillis,
        replayProgressProfile: poiSpeedProfile,
        sourceCanvas,
    })
    const trackPath = controller?.sampler?.logicalTrackPath ?? null
    const trackPathDescriptor = createReplayTrackPathDescriptor(trackPath)
    const startProgress = exportWindow.startProgress
    const cameraDefinition = createReplayCameraDefinition({
        cameraSettings: currentJourneyReplayCameraSettings(),
        markerSettings: replay?.marker,
        startAnchor: controller?.sampler?.atProgress?.(startProgress) ?? null,
    })
    const definition = createReplayDefinition({
        journeyId: journey?.slug ?? replay?.journeySlug ?? null,
        direction,
        timeline: videoTimeline,
        cameraDefinition,
        initialCameraState: replayContext.context?.cameraState ?? null,
        renderSpec: effectiveRenderSpec,
        crop: replayContext.context?.cropRect ?? null,
        visibleOverlayIds: replayContext.context?.visibleOverlayIds ?? [],
        trackPathDescriptor,
        qualityPolicy: replay?.readiness ?? null,
        source: 'export',
    })
    const renderPlan = createReplayRenderPlan({
        definition,
        frameClock: {
            durationMillis: exportWindow.durationMillis,
            fps,
            direction: 1,
        },
        timelineOffsetMillis: exportWindow.startMillis,
        trackPath,
        trackPathDescriptor,
    })
    const frameResolver = new ReplayFrameResolver({
        plan: renderPlan,
        resolveSample: ({progress}) => controller?.sampler?.atProgress?.(progress)
                                         ?? controller?.currentSample?.()
                                         ?? null,
        resolveCameraPose: createReplayCameraPoseResolver({
            definition: renderPlan.definition.cameraDefinition,
            sampler: controller?.sampler ?? null,
        }),
    })
    const exporter = new ReplayDeferredExporter({
        controller,
        timeline: {
            durationMillis: exportWindow.durationMillis,
            fps,
            direction: 1,
        },
        seek: (progress, frame = null, options = {}) => {
            const phase = resolveReplayVideoFramePhase({
                timeline: videoTimeline,
                frame,
                frameTimeMs: (Number(frame?.frameTimeMs) || 0) + exportWindow.startMillis,
                isFinalSceneFrame: frame?.isLast === true,
            })
            return controller?.seek?.(phase.progress, options.sample)
        },
        resolveSample: frame => {
            const phase = resolveReplayVideoFramePhase({
                timeline: videoTimeline,
                frame,
                frameTimeMs: (Number(frame?.frameTimeMs) || 0) + exportWindow.startMillis,
                isFinalSceneFrame: frame?.isLast === true,
            })
            return controller?.sampler?.atProgress?.(phase.progress)
                   ?? controller?.currentSample?.()
                   ?? null
        },
        renderMode: REPLAY_RENDER_MODE_EXPORT,
        renderSpec: effectiveRenderSpec,
        initialCameraState: replayContext.context?.cameraState ?? null,
        visibleOverlayIds: replayContext.context?.visibleOverlayIds ?? [],
        trackPath,
        definition,
        renderPlan,
        frameResolver,
    })

    const plan = {
        status:     'ready',
        createdAt:  defaultTimestamp(),
        label,
        dimensions: effectiveDimensions,
        renderSpec: effectiveRenderSpec,
        captureMode,
        mediaMetadata,
        definition,
        renderPlan,
        poiSpeedProfile,
        exportWindow,
        outputDurationMillis: exportWindow.durationMillis,
        renderContract: replayContext.context?.renderContract
                         ?? createReplayRenderModeContract({
                             renderMode: REPLAY_RENDER_MODE_EXPORT,
                             initialCameraState: replayContext.context?.cameraState,
                             renderSpec: effectiveRenderSpec,
                             visibleOverlayIds: replayContext.context?.visibleOverlayIds,
                         }),
        runtime:    {
            status:      'cold',
            preparedAt:  null,
            warmAt:      null,
            outputConfig: null,
            warmPromise: null,
            contextKey:  replayContext.contextKey,
            context:     replayContext.context,
        },
        manifest:   exporter.buildManifest({
            label,
            metadata: {
                journeySlug: journey?.slug ?? replay?.journeySlug ?? null,
                trackSlug:   replay?.trackSlug ?? null,
                captureMode,
                dimensions:  effectiveDimensions,
                renderSpec:  effectiveRenderSpec
                             ? {
                        fps:          effectiveRenderSpec.fps,
                        qualityIndex: effectiveRenderSpec.qualityIndex,
                        captureMode:  effectiveRenderSpec.captureMode,
                        cropRect:     effectiveRenderSpec.cropRect,
                        dimensions:   effectiveRenderSpec.dimensions,
                        outputDpr:    effectiveRenderSpec.outputDpr,
                    }
                             : null,
                contextKey:  replayContext.contextKey,
                replayDurationMillis,
                exportRange: exportWindow,
                clipSignature: videoTimeline.clipSignature,
                ...(metadata ?? {}),
            },
        }),
    }
    // Keep the class instance out of Valtio's deep proxying. Its private fields
    // require methods and getters to run with the original instance as `this`.
    plan.exporter = ref(exporter)
    plan.videoTimeline = videoTimeline
    plan.exportWindow = exportWindow

    if (replay) {
        replay.deferredExportPlan = plan
    }

    return {
        exporter,
        plan,
    }
}

/**
 * Warm a previously prepared export plan by resolving the codec/config.
 *
 * This is intentionally asynchronous so it can run while interactive Replay is
 * already recording.
 */
export const warmReplayDeferredExportPlan = async ({
                                                       exporter = null,
                                                       plan = null,
                                                       replay = defaultReplayStore(),
                                                       dimensions = null,
                                                       browser = globalThis.__?.device?.browser ?? 'chromium',
                                                   } = {}) => {
    if (!(exporter instanceof ReplayDeferredExporter) || !plan) {
        return {exporter, plan}
    }

    const outputConfig = await exporter.prepareRuntime({dimensions, browser})
    const runtimeContext = plan.runtime?.contextKey
                           ? {
                               contextKey: plan.runtime.contextKey,
                               context:    plan.runtime.context ?? null,
                           }
                           : captureReplayDeferredExportContext({
                               replay,
                               controller: exporter.session?.controller ?? defaultReplayController(),
                               dimensions,
                               captureMode: plan.captureMode ?? 'deferred-master',
                               fps: exporter.timeline?.fps ?? defaultReplayExportFps(),
                           })
    plan.runtime = {
        ...(plan.runtime ?? {}),
        status:       'warm',
        preparedAt:   plan.runtime?.preparedAt ?? defaultTimestamp(),
        warmAt:       defaultTimestamp(),
        warmPromise:  null,
        contextKey:   runtimeContext.contextKey,
        context:      runtimeContext.context,
        outputConfig: {
            codec: outputConfig.codec,
            mimeType: outputConfig.mimeType,
            extension: outputConfig.extension,
            hardwareAcceleration: outputConfig.hardwareAcceleration,
        },
    }
    plan.manifest = {
        ...(plan.manifest ?? {}),
        output: {
            codec: outputConfig.codec,
            mimeType: outputConfig.mimeType,
            extension: outputConfig.extension,
        },
    }

    if (replay) {
        replay.deferredExportPlan = plan
    }

    return {
        exporter,
        plan,
        outputConfig,
    }
}

/**
 * Return the current export plan if the runtime context still matches.
 *
 * When the replay crop, overlay set, or sync state changes, a new plan is
 * prepared so the Replay export does not reuse stale assumptions.
 */
export const resolveReplayDeferredExportPlan = ({
                                                    replay = defaultReplayStore(),
                                                    journey = defaultJourney(),
                                                    controller = defaultReplayController(),
                                                    fps = defaultReplayExportFps(),
                                                    label = null,
                                                    metadata = null,
                                                    mediaMetadata = null,
                                                    dimensions = null,
                                                    captureMode = null,
                                                    sourceCanvas = defaultReplaySourceCanvas(),
                                                    uiToast = UIToast,
                                                } = {}) => {
    const existingPlan = replay?.deferredExportPlan ?? null
    const requestedDimensions = dimensions ?? existingPlan?.dimensions ?? null
    const requestedCaptureMode = captureMode ?? existingPlan?.captureMode ?? 'deferred-master'
    const currentDurationMillis = Number.isFinite(Number(controller?.duration))
                                  ? Math.max(0, Number(controller.duration) * 1000)
                                  : Math.max(0, Number(replay?.durationMillis) || 0)
    const poiSpeedProfile = resolveReplayPOISpeedProfile({
        replay,
        journey,
        controller,
        replayDurationMillis: currentDurationMillis,
        direction: controller?.direction ?? replay?.direction ?? 1,
    })
    const effectiveReplayDurationMillis = poiSpeedProfile?.playbackDurationMillis ?? currentDurationMillis
    const currentRenderSpec = buildReplayVideoRenderSpec({
        cropRect: replay?.videoCropRect ?? existingPlan?.renderSpec?.cropRect ?? null,
        video: replay?.video ?? globalThis.lgs?.stores?.ui?.video ?? null,
        settings: globalThis.lgs?.settings?.ui?.video ?? null,
        sourceCanvas,
        dimensions: requestedDimensions,
        fps,
        captureMode: requestedCaptureMode,
    })
    const currentContext = captureReplayDeferredExportContext({
        replay,
        controller,
        dimensions: requestedDimensions,
        captureMode: requestedCaptureMode,
        fps,
        renderSpec: currentRenderSpec,
        replayDurationMillis: effectiveReplayDurationMillis,
        replayProgressProfile: poiSpeedProfile,
        sourceCanvas,
    })
    const existingExporter = existingPlan?.exporter ?? null
    let canReuseExistingPlan = existingPlan?.runtime?.contextKey === currentContext.contextKey

    if (canReuseExistingPlan) {
        try {
            canReuseExistingPlan = existingExporter instanceof ReplayDeferredExporter
                                  && existingExporter.timeline instanceof ReplayFrameTimeline
        }
        catch {
            // A plan created before the exporter was marked as a Valtio ref may
            // contain a proxy that cannot access the class's private fields.
            canReuseExistingPlan = false
        }
    }

    if (canReuseExistingPlan) {
        if (mediaMetadata !== null && mediaMetadata !== undefined) {
            existingPlan.mediaMetadata = mediaMetadata
        }
        return {
            exporter: existingExporter,
            plan:     existingPlan,
            context:  currentContext,
            reused:   true,
        }
    }

    const prepared = prepareReplayDeferredExportPlan({
        replay,
        journey,
        controller,
        fps,
        label: label ?? `${journey?.slug ?? replay?.journeySlug ?? 'replay'}-master-export`,
        metadata,
        mediaMetadata,
        dimensions: requestedDimensions,
        captureMode: requestedCaptureMode,
        sourceCanvas,
        context: currentContext,
        uiToast,
    })

    return {
        ...prepared,
        context: currentContext,
        reused:  false,
    }
}

/**
 * Render the deferred master export and download it immediately.
 *
 * This is the "export now" path. It still goes through the same deterministic
 * frame session and context validation as the share-friendly blob path.
 */
export const runReplayDeferredMp4Export = async ({
                                                     replay = defaultReplayStore(),
                                                     journey = defaultJourney(),
                                                     controller = defaultReplayController(),
                                                     fps = defaultReplayExportFps(),
                                                     label = null,
                                                     metadata = null,
                                                     mediaMetadata = null,
                                                     filename = null,
                                                     dimensions = null,
                                                     captureMode = null,
                                                     sourceCanvas = defaultReplaySourceCanvas(),
                                                     signal = null,
                                                     abortController = null,
                                                     buildCanvas = null,
                                                     replayMode = defaultReplayMode(),
                                                     renderHostMode = 'visible',
                                                     isolatedRenderHostFactory = defaultIsolatedReplayRenderHostFactory,
                                                     tileReadinessTimeoutMs = DEFAULT_REPLAY_SCENE_TILE_READINESS_TIMEOUT_MS,
                                                     uiToast = UIToast,
                                                     download = downloadBlob,
                                                     yieldIntervalMs = REPLAY_DRY_RUN_BROWSER_YIELD_INTERVAL_MS,
                                                     yieldToBrowser = null,
                                                     dryRun = false,
                                                 } = {}) => {
    const isDryRun = dryRun === true
    const existingPlan = replay?.deferredExportPlan ?? null
    const requestedDimensions = dimensions ?? existingPlan?.dimensions ?? null
    const requestedCaptureMode = captureMode ?? existingPlan?.captureMode ?? null
    const basePlan = resolveReplayDeferredExportPlan({
        replay,
        journey,
        controller,
        fps,
        label,
        metadata,
        mediaMetadata,
        dimensions: requestedDimensions,
        captureMode: requestedCaptureMode,
        sourceCanvas,
        uiToast,
    })
    const exporter = basePlan.exporter ?? null
    const plan = basePlan.plan ?? null
    if (!exporter || !plan) {
        throw new Error('ReplayDeferredExporter could not prepare an export plan.')
    }
    const replayFrameSampleWorker = createReplayFrameSampleWorkerClient({
        sampler: controller?.sampler ?? null,
        timeline: plan.videoTimeline,
        frameClockDurationMillis: exporter.timeline?.durationMillis,
        timelineOffsetMillis: plan.exportWindow?.startMillis,
        signal,
    })
    if (!isDryRun && plan.runtime?.warmPromise) {
        try {
            await plan.runtime.warmPromise
        }
        catch {
            // Fall back to preparing on demand below.
        }
    }

    const outputDimensions = normalizeDimensions(
        requestedDimensions
        ?? plan.dimensions
        ?? {
            width:  Number(sourceCanvas?.width) || Number(replay?.videoCropRect?.width) || 1920,
            height: Number(sourceCanvas?.height) || Number(replay?.videoCropRect?.height) || 1080,
        },
    )
    const outputRenderSpec = plan.renderSpec?.dimensions?.width === outputDimensions.width
                             && plan.renderSpec?.dimensions?.height === outputDimensions.height
                             ? plan.renderSpec
                             : buildReplayVideoRenderSpec({
                                 cropRect: plan.runtime?.context?.cropRect ?? replay?.videoCropRect ?? null,
                                 sourceCanvas,
                                 dimensions: outputDimensions,
                                 fps,
                                 captureMode: plan.captureMode,
                                 })
    const sourceViewportDimensions = outputRenderSpec?.sourceCanvasDimensions
                                     ?? {
                                         width:  Number(sourceCanvas?.width) || 0,
                                         height: Number(sourceCanvas?.height) || 0,
                                     }
    const cropProjection = captureReplayCropProjection({
        camera: globalThis.lgs?.camera
                ?? replayMode?.cesiumViewer?.()?.camera
                ?? globalThis.lgs?.viewer?.camera
                ?? null,
        sourceViewportDimensions,
        cropRect: outputRenderSpec?.cropRect ?? null,
    })

    const originalProgress = finiteNumber(controller?.progress, null)
    const originalPaused = Boolean(controller?.paused)
    const originalRunning = Boolean(controller?.running)
    const originalReplayState = replay
                                ? {
                                    active: replay.active,
                                    playing: replay.playing,
                                    paused: replay.paused,
                                    progress: replay.progress,
                                    sample: replay.sample,
                                    liveSample: replay.liveSample,
                                    elapsedMillis: replay.elapsedMillis,
                                    durationMillis: replay.durationMillis,
                                    dynamicFrameState: replay.dynamicFrameState,
                                    resolvedFrameState: replay.resolvedFrameState,
                                    replayFramePhase: replay.replayFramePhase,
                                    clipSequenceActive: replay.clipSequenceActive,
                                    toolbarVisible: replay.toolbarVisible,
                                    mainUiHidden: replay.mainUiHidden,
                                }
                                : null
    let exportSucceeded = false
    const cleanupErrors = []
    let replayComposer = null
    let replayComposerFallback = false
    const captureMirrors = new Set()
    const overlayMetricsCache = new Map()
    let restoreReplaySceneTileCache = null
    let replaySceneTileReadinessCoordinator = null
    let replaySceneTileReadinessOptions = null
    let isolatedRenderHost = null
    let isolatedRenderTarget = null
    let isolatedViewportDimensions = null
    let previousReplayExportFrame = null
    let previousReplayExportSample = null
    const exportStartedAt = runtimeNow()
    const monitorMode = isDryRun ? 'dry-run' : 'export'
    const dryRunTimings = {cameraTraceMillis: 0, widgetStateMillis: 0, tileReadinessMillis: 0}
    let replayFrameSampleWorkerMillis = 0
    let recordingPerformance = null
    let exportRenderLoop = null
    const flushReplayRenderTarget = () => {
        const scene = replayMode?.cesiumScene?.()
                      ?? globalThis.lgs?.scene
                      ?? globalThis.lgs?.viewer?.scene
                      ?? null
        const renderStartedAt = recordingPerformance?.now()
        try {
            if (exportRenderLoop) {
                exportRenderLoop.render()
            }
            else {
                scene?.render?.()
            }
        }
        finally {
            recordingPerformance?.record('cesiumRender', renderStartedAt)
        }
    }
    const exportRuntimeStatus = () => {
        if (signal?.aborted) {
            return 'warm'
        }

        return exportSucceeded ? 'ready' : 'warm'
    }

    replayVideoTraceDebug('export.camera.ownership.start', {
        hasBeginReplayCameraExport: typeof replayMode?.beginReplayCameraExport === 'function',
    })
    replayMode?.beginReplayCameraExport?.()
    replayVideoTraceDebug('export.run.start', {
        label: plan.label,
        captureMode: plan.captureMode,
        outputWidth: outputDimensions.width,
        outputHeight: outputDimensions.height,
        frameCount: plan.manifest?.frameCount ?? null,
        hasRestorePlaybackScene: typeof replayMode?.restorePlaybackScene === 'function',
        hasPreparePlaybackSceneForExport: typeof replayMode?.preparePlaybackSceneForExport === 'function',
    })

    if (plan.runtime) {
        plan.runtime.status = 'exporting'
        // AbortController is a native host object. Keep it outside Valtio's
        // deep proxying so AbortSignal methods retain their required receiver.
        plan.runtime.abortController = abortController ? ref(abortController) : null
    }
    startReplayRecordingMonitor({
        mode: monitorMode,
        frameCount: plan.manifest?.frameCount ?? null,
        videoDurationMillis: plan.outputDurationMillis
                             ?? plan.videoTimeline?.durationMillis
                             ?? plan.manifest?.durationMillis
                             ?? plan.manifest?.metadata?.replayDurationMillis
                             ?? null,
    })
    initializeReplayExportCreationProgress({plan})
    installReplayExportRuntimeControls({plan, abortController})

    try {
        // Always leave a previous Interactive scene before preparing export. This restores
        // the original track and camera focus when the user switches modes or
        // aborts between the two exports.
        const restoreStartedAt = runtimeNow()
        let restoreSucceeded = false
        replayVideoTraceDebug('export.interactive.restore.start', {
            force: true,
            hasRestorePlaybackScene: typeof replayMode?.restorePlaybackScene === 'function',
        })
        try {
            if (typeof replayMode?.restorePlaybackScene === 'function') {
                await replayMode.restorePlaybackScene({force: true})
            }
            restoreSucceeded = true
        }
        finally {
            replayVideoTraceDebug('export.interactive.restore.end', {
                elapsedMs: runtimeNow() - restoreStartedAt,
                restored: restoreSucceeded,
                hasRestorePlaybackScene: typeof replayMode?.restorePlaybackScene === 'function',
            })
        }


        if (renderHostMode === 'isolated') {
            const isolatedHostSupported = typeof replayMode?.setRenderTarget === 'function'
                                          && typeof replayMode?.clearRenderTarget === 'function'
                                          && typeof isolatedRenderHostFactory === 'function'
            if (!isolatedHostSupported) {
                throw new Error('Isolated Replay rendering is required, but this Replay session cannot use an isolated render target.')
            }

            const descriptor = captureReplaySceneDescriptor()
            if (!descriptor) {
                throw new Error('Isolated Replay rendering requires an active Cesium scene.')
            }

            const cropRect = outputRenderSpec?.cropRect
                             ?? normalizeReplayVideoCropRect(plan.runtime?.context?.cropRect ?? replay?.videoCropRect ?? null)
            try {
                const outputDpr = cropRect
                    ? Math.max(1, Math.min(
                        outputDimensions.width / Math.max(1, cropRect.width),
                        outputDimensions.height / Math.max(1, cropRect.height),
                    ))
                    : 1
                isolatedViewportDimensions = {
                    width: outputDimensions.width / outputDpr,
                    height: outputDimensions.height / outputDpr,
                }
                isolatedRenderHost = isolatedRenderHostFactory({
                    dimensions: outputDimensions,
                    viewportDimensions: isolatedViewportDimensions,
                    descriptor,
                    cropProjection,
                    readiness: normalizeJourneyReplayReadiness(
                        replay?.readiness
                        ?? globalThis.lgs?.settings?.ui?.replay?.readiness,
                    ),
                })
                await isolatedRenderHost.initialize()
                isolatedRenderTarget = isolatedRenderHost.renderTarget?.() ?? null
                if (!isolatedRenderTarget) {
                    throw new Error('The isolated Replay render host did not expose a render target')
                }
                replayMode.setRenderTarget(isolatedRenderTarget)
                replayVideoTraceDebug('export.render-host.isolated.ready', {
                    outputWidth: outputDimensions.width,
                    outputHeight: outputDimensions.height,
                    viewportWidth: isolatedViewportDimensions.width,
                    viewportHeight: isolatedViewportDimensions.height,
                })
            }
            catch (error) {
                if (isolatedRenderTarget) {
                    try {
                        replayMode.clearRenderTarget(isolatedRenderTarget)
                    }
                    catch {
                        // Continue cleanup if releasing a partially installed target fails.
                    }
                }
                try {
                    isolatedRenderHost?.destroy?.()
                }
                catch {
                    // The original host initialization error remains the actionable failure.
                }
                isolatedRenderHost = null
                isolatedRenderTarget = null
                isolatedViewportDimensions = null
                replayVideoTraceDebug('export.render-host.isolated.failed', {
                    message: error?.message ?? String(error),
                })
                throw new Error('Isolated Replay rendering could not be initialized.', {cause: error})
            }
        }

        const scenePrepareStartedAt = runtimeNow()
        let scenePrepared = false
        const firstExportFrame = exporter.timeline?.frameAtIndex?.(0) ?? null
        const firstTimelinePhase = resolveReplayExportFramePhase({plan, frame: firstExportFrame})
        replayVideoTraceDebug('export.scene.prepare.start', {
            journeySlug: journey?.slug ?? replay?.journeySlug ?? null,
            progress: plan.exportWindow?.startProgress ?? originalProgress ?? 0,
            hideReplayMarker: firstTimelinePhase?.slot === REPLAY_CLIP_SLOT_START && Boolean(firstTimelinePhase?.clip),
            hasCameraState: Boolean(plan.runtime?.context?.cameraState),
            hasPreparePlaybackSceneForExport: typeof replayMode?.preparePlaybackSceneForExport === 'function',
        })
        try {
            if (typeof replayMode?.preparePlaybackSceneForExport === 'function') {
                await replayMode.preparePlaybackSceneForExport({
                    journey,
                    progress: plan.exportWindow?.startProgress ?? originalProgress ?? 0,
                    hideReplayMarker: firstTimelinePhase?.slot === REPLAY_CLIP_SLOT_START && Boolean(firstTimelinePhase?.clip),
                    cameraState: plan.runtime?.context?.cameraState ?? null,
                }) === true
            }
            const replayScene = replayMode?.cesiumScene?.()
                                ?? globalThis.lgs?.scene
                                ?? globalThis.lgs?.viewer?.scene
                                ?? null
            const replayReadiness = normalizeJourneyReplayReadiness(
                replay?.readiness
                ?? globalThis.lgs?.settings?.ui?.replay?.readiness,
            )
            // Capture owns entity updates and scene draws. Pending tile waits
            // pump this same driver without a competing animation-frame loop.
            if (!isDryRun) {
                exportRenderLoop = acquireReplayExportRenderLoop({
                    viewer: replayMode?.cesiumViewer?.() ?? globalThis.lgs?.viewer ?? null,
                    scene: replayScene,
                })
            }
            const replayCamera = currentJourneyReplayCameraSettings()
            restoreReplaySceneTileCache = prepareReplaySceneTileCache(replayScene)
            replaySceneTileReadinessCoordinator = isolatedRenderHost
                ? {
                    prepareForCapture: options => isolatedRenderHost.prepareForCapture(options),
                }
                : createReplaySceneTileReadinessCoordinator(replayScene, {
                    enabled:                 replayReadiness.enabled,
                    policy:                  replayReadiness.policy,
                    knownFootprintTimeoutMs: replayReadiness.knownFootprintTimeoutMs,
                    movingTimeoutMs:         replayReadiness.movingTimeoutMs,
                    settledTimeoutMs:        replayReadiness.settledTimeoutMs,
                    prewarmEnabled:          replayReadiness.prewarmEnabled,
                    renderNow:               flushReplayRenderTarget,
                })
            replaySceneTileReadinessOptions = {
                readiness: replayReadiness,
                camera:    replayCamera,
            }
            await delay(0)
            scenePrepared = true
        }
        finally {
            replayVideoTraceDebug('export.scene.prepare.end', {
                elapsedMs: runtimeNow() - scenePrepareStartedAt,
                prepared: scenePrepared,
                hasPreparePlaybackSceneForExport: typeof replayMode?.preparePlaybackSceneForExport === 'function',
            })
        }

        publishReplayExportFrameState({
            plan,
            replay,
            controller,
            sample: controller?.currentSample?.() ?? replay?.sample ?? null,
            commitSynchronously: !isDryRun,
        })

        if (!isDryRun) {
            const widgetKeys = await prepareReplayTimelineWidgets({
                replay,
                basicReplay: isJourneyReplayBasicMode({replay}),
            })
            const widgetsReady = await waitForReplayWidgetsReady({widgetKeys})
            if (!widgetsReady) {
                throw new Error('Replay timeline widgets did not become ready before capture.')
            }
        }
        await prewarmReplayScenePrefix({
            plan,
            replay,
            controller,
            replayMode,
            dryRun: isDryRun,
            coordinator: replaySceneTileReadinessCoordinator,
            lookaheadMs: replaySceneTileReadinessOptions?.readiness?.enabled !== false
                         && replaySceneTileReadinessOptions?.readiness?.prewarmEnabled !== false
                         ? replaySceneTileReadinessOptions?.camera?.playback?.tilePreloadHorizonMs
                           ?? REPLAY_TILE_PREWARM_LOOKAHEAD_MS
                         : 0,
            signal,
        })

        if (replayFrameSampleWorker) {
            exporter.session?.setPreparedFrameSampleResolver?.(replayFrameSampleWorker.resolveSampleForFrame)
        }

        recordingPerformance = isDryRun ? null : createReplayRecordingPerformance()
        recordingPerformance?.configure({
            qualityIndex: outputRenderSpec?.qualityIndex ?? null,
            renderHostMode,
            captureMode,
            cropRect: outputRenderSpec?.cropRect ? {...outputRenderSpec.cropRect} : null,
            visibleOverlayIds: [...(plan.runtime?.context?.visibleOverlayIds ?? [])],
            routeSampleCount: controller?.sampler?.samples?.length ?? null,
            sourceDimensions: {width: sourceCanvas?.width ?? null, height: sourceCanvas?.height ?? null},
            smoothing: replay?.smoothing ? {...replay.smoothing} : null,
            renderLoopMode: exportRenderLoop ? 'manual' : 'default',
        })
        const result = await exporter.exportMp4({
            signal,
            shouldStop: () => plan.runtime?.exportStopRequested === true,
            // The callback applies the frame through the guarded Replay export boundary. A preliminary
            // seek would also run the interactive listener, rebuilding the trace and moving the camera twice.
            seekBeforeRender: false,
            dryRun: isDryRun,
            yieldIntervalMs,
            yieldToBrowser,
            label: plan.label,
            metadata: plan.mediaMetadata ?? mediaMetadata ?? metadata ?? {},
            dimensions: outputDimensions,
            buildCanvas,
            recordingPerformance,
            onPerformance: report => {
                plan.runtime.recordingPerformance = ref(report)
            },
            onFileSize: bytes => {
                updateReplayExportFileSize({plan, bytes})
                updateReplayRecordingMonitor({
                    mode: monitorMode,
                    size: bytes,
                    recordingPerformance,
                })
            },
            renderFrame: async ({canvas, context, frame}) => {
                const pauseStartedAt = plan.runtime?.exportPaused ? recordingPerformance?.now() : null
                try {
                    await waitForReplayExportResume({plan, signal})
                }
                finally {
                    recordingPerformance?.record('pauseWait', pauseStartedAt)
                }
                if (signal?.aborted) {
                    throw new DOMException('The Replay export was aborted.', 'AbortError')
                }
                const frameUpdateStartedAt = recordingPerformance?.now() ?? (isDryRun ? runtimeNow() : 0)

                const phase = resolveReplayExportFramePhase({plan, frame})
                const sourceFrame = resolveReplayExportSourceFrame(frame, phase)
                replayVideoTraceDebug('camera.export-frame', {
                    frameIndex:    frame?.index ?? null,
                    frameTimeMs:   frame?.frameTimeMs ?? null,
                    frameIntervalMs: frame?.frameIntervalMs ?? null,
                    phase:         phase?.kind ?? null,
                    localMillis:   phase?.localMillis ?? null,
                    progress:      phase?.progress ?? null,
                    fps:            plan.videoTimeline?.fps ?? null,
                })
                let frameSample = frame?.sample ?? null
                try {
                    if (typeof replayMode?.renderReplayExportFrame === 'function') {
                        frameSample = await replayMode.renderReplayExportFrame({
                            phase,
                            frame: sourceFrame,
                            plan,
                            replay,
                            controller,
                            resolvedSample: frame.sample,
                            dryRun: isDryRun,
                        }) ?? frameSample
                    }
                    else {
                        if (controller?.seek) {
                            frameSample = controller.seek(phase.progress) ?? frameSample
                        }
                        else if (typeof replay?.progress === 'number') {
                            replay.progress = phase.progress
                        }
                        globalThis.__?.ui?.replay?.refresh?.({camera: true, suppressMoveEvents: true})
                    }
                }
                finally {
                    recordingPerformance?.record('replayFrameUpdate', frameUpdateStartedAt)
                }
                const widgetStateStartedAt = recordingPerformance?.now() ?? (isDryRun ? runtimeNow() : 0)
                if (isDryRun) {
                    dryRunTimings.cameraTraceMillis += widgetStateStartedAt - frameUpdateStartedAt
                }
                try {
                    publishReplayExportFrameState({
                        plan,
                        replay,
                        controller,
                        frame: {
                            ...sourceFrame,
                            progress: phase.progress,
                        },
                        sample: frameSample,
                        phase,
                        commitSynchronously: !isDryRun,
                        logicalFrame: replayMode?.lastReplayLogicalFrame ?? null,
                        trackPath: plan.renderContract?.trackPath
                                   ?? plan.runtime?.context?.renderContract?.trackPath
                                   ?? controller?.sampler?.logicalTrackPath
                                   ?? null,
                    })
                }
                finally {
                    recordingPerformance?.record('widgetStatePublication', widgetStateStartedAt)
                }
                const tileReadinessStartedAt = recordingPerformance?.now() ?? (isDryRun ? runtimeNow() : 0)
                if (isDryRun) {
                    dryRunTimings.widgetStateMillis += tileReadinessStartedAt - widgetStateStartedAt
                }
                const isReadinessCheckpoint = !isDryRun
                                               || isReplayDryRunTileReadinessCheckpoint({frame, phase})
                const speedLevel = resolveReplayTileSpeedLevel({
                    frame,
                    previousFrame: previousReplayExportFrame,
                    sample: frameSample,
                    previousSample: previousReplayExportSample,
                })
                previousReplayExportFrame = frame
                previousReplayExportSample = frameSample
                // Intermediate dry-run frames rely on requestRender and browser yields without blocking.
                try {
                    if (!isDryRun || isReadinessCheckpoint) {
                        const maxMillis = isDryRun
                            ? Math.min(tileReadinessTimeoutMs, REPLAY_DRY_RUN_TILE_READINESS_CHECK_TIMEOUT_MS)
                            : tileReadinessTimeoutMs
                        if (replaySceneTileReadinessCoordinator) {
                            await replaySceneTileReadinessCoordinator.prepareForCapture({
                                maxMillis,
                                signal,
                                speedLevel,
                                settled: isReplayExportFrameSettled({frame, phase}),
                            })
                        }
                        else {
                            await prepareReplaySceneTilesForCapture({
                                scene: replayMode?.cesiumScene?.()
                                       ?? globalThis.lgs?.scene
                                       ?? globalThis.lgs?.viewer?.scene
                                       ?? null,
                                maxMillis,
                                signal,
                                renderNow: flushReplayRenderTarget,
                            })
                        }
                    }
                }
                finally {
                    recordingPerformance?.record('sceneTileReadiness', tileReadinessStartedAt)
                }
                // Dry run checks key scene boundaries, then skips widget capture and image composition.
                if (isDryRun) {
                    dryRunTimings.tileReadinessMillis += runtimeNow() - tileReadinessStartedAt
                    return
                }
                const frameSource = isolatedRenderHost?.canvas?.()
                                    ?? sourceCanvas
                                    ?? defaultReplaySourceCanvas()
                if (frameSource instanceof HTMLCanvasElement) {
                    const cropRect = outputRenderSpec?.cropRect
                                     ?? normalizeReplayVideoCropRect(plan.runtime?.context?.cropRect ?? replay?.videoCropRect ?? null)
                    const composerClip = isolatedRenderHost && isolatedViewportDimensions
                        ? {
                            x: 0,
                            y: 0,
                            width: isolatedViewportDimensions.width,
                            height: isolatedViewportDimensions.height,
                        }
                        : outputRenderSpec?.composerClip
                          ?? replayVideoComposerClipFromCropRect(cropRect)
                    const composerOutputDpr = outputRenderSpec?.outputDpr
                                              ?? Math.max(1, Math.min(
                                                  canvas.width / Math.max(1, cropRect?.width ?? canvas.width),
                                                  canvas.height / Math.max(1, cropRect?.height ?? canvas.height),
                                              ))
                    const composerWidth = canvas.width / composerOutputDpr
                    const composerHeight = canvas.height / composerOutputDpr
                    if (!replayComposer && !replayComposerFallback) {
                        const compositionSetupStartedAt = recordingPerformance.now()
                        try {
                            replayComposer = new CanvasOverlayComposer(frameSource, {
                                clip: composerClip,
                                width: composerWidth,
                                height: composerHeight,
                                fps: 0,
                                outputDpr: composerOutputDpr,
                                flushWebGLBuffer: flushReplayRenderTarget,
                                continuousRendering: false,
                                outputCanvas: canvas,
                                recordingPerformance,
                            })
                        }
                        catch {
                            replayComposerFallback = true
                        }
                        finally {
                            recordingPerformance.record('compositionSetup', compositionSetupStartedAt)
                        }
                    }

                    if (replayComposer) {
                        if (phase?.slot === REPLAY_CLIP_SLOT_STOP) {
                            replayVideoTraceDebug('exporter.stop.composer-overlay', {
                                frameIndex: frame?.index ?? null,
                                frameTimeMs: frame?.frameTimeMs ?? null,
                                localProgress: phase?.localProgress ?? null,
                                hasComposer: Boolean(replayComposer),
                                cropRect,
                                composerClip,
                                composerOutputDpr,
                                outputCanvasWidth: canvas.width,
                                outputCanvasHeight: canvas.height,
                                sourceCanvasWidth: frameSource.width,
                                sourceCanvasHeight: frameSource.height,
                            })
                        }
                        const captureStartedAt = recordingPerformance.now()
                        let visibleWidgetKeys = null
                        try {
                            visibleWidgetKeys = await flushReplayVideoOverlayCanvases({
                                replay, controller, frameState: plan.runtime?.frameState,
                                captureMirrors, strict: true, signal,
                            })
                        }
                        finally {
                            recordingPerformance.record('overlayCapture', captureStartedAt)
                        }
                        const layoutStartedAt = recordingPerformance.now()
                        try {
                            buildReplayVideoComposerOverlays({
                                composer:      replayComposer,
                                cropRect:      cropRect ?? {left: 0, top: 0, width: canvas.width, height: canvas.height},
                                coordinateScale: isolatedRenderHost && cropRect && isolatedViewportDimensions
                                    ? {
                                        x: isolatedViewportDimensions.width / Math.max(1, cropRect.width),
                                        y: isolatedViewportDimensions.height / Math.max(1, cropRect.height),
                                    }
                                    : null,
                                replay,
                                controller,
                                widgetKeys: visibleWidgetKeys,
                                metricsCache: overlayMetricsCache,
                            })
                        }
                        finally {
                            recordingPerformance.record('overlayLayout', layoutStartedAt)
                        }
                        await replayComposer.renderFrame()

                        const composedCanvas = replayComposer.getCanvas?.()
                        if (composedCanvas && composedCanvas !== canvas) {
                            const transferStartedAt = recordingPerformance.now()
                            try {
                                context.clearRect(0, 0, canvas.width, canvas.height)
                                context.drawImage(composedCanvas, 0, 0, composedCanvas.width, composedCanvas.height, 0, 0, canvas.width, canvas.height)
                            }
                            finally {
                                recordingPerformance.record('compositionTransfer', transferStartedAt)
                            }
                        }
                    }
                    else {
                        flushReplayRenderTarget()
                        const compositionStartedAt = recordingPerformance.now()
                        try {
                            context.clearRect(0, 0, canvas.width, canvas.height)
                            context.drawImage(frameSource, 0, 0, frameSource.width, frameSource.height, 0, 0, canvas.width, canvas.height)
                        }
                        finally {
                            recordingPerformance.record('composition', compositionStartedAt)
                        }
                    }
                }
                publishReplayRecordingMonitorFrame({
                    canvas,
                    recordingPerformance,
                    mode: monitorMode,
                    phase: plan.runtime?.exportStopRequested === true
                           ? 'finalizing'
                           : phase?.kind ?? 'rendering',
                    progress: monitorProgressForFrame({
                        frame,
                        frameCount: frame?.frameCount ?? plan.manifest?.frameCount,
                    }),
                    frameIndex: frame?.index,
                    frameCount: frame?.frameCount ?? plan.manifest?.frameCount,
                    processedFrames: (Number(frame?.index) || 0) + 1,
                })
            },
            onFrame: async frame => {
                const exportRuntime = updateReplayExportCreationProgress({
                    plan,
                    frame,
                    minimumIntervalMs: isDryRun ? REPLAY_DRY_RUN_PROGRESS_UPDATE_INTERVAL_MS : 0,
                })
                if (!exportRuntime) {
                    return
                }

                updateReplayRecordingMonitor({
                    mode: monitorMode,
                    phase: plan.runtime?.exportStopRequested === true
                        ? 'finalizing'
                        : isDryRun ? 'checking' : 'encoding',
                    progress: monitorProgressForFrame({
                        frame,
                        frameCount: frame?.frameCount ?? plan.manifest?.frameCount,
                    }) ?? exportRuntime?.exportProgress,
                    frameIndex: frame?.index,
                    frameCount: frame?.frameCount ?? plan.manifest?.frameCount,
                    processedFrames: (Number(frame?.index) || 0) + 1,
                    elapsedMillis: exportRuntime?.exportElapsedMillis,
                    estimatedRemainingMillis: exportRuntime?.exportEstimatedRemainingMillis,
                    size: exportRuntime?.exportFileSize,
                    recordingPerformance,
                })
            },
        })

        if (signal?.aborted) {
            throw new DOMException('The Replay export was aborted.', 'AbortError')
        }
        const expectedFrameCount = Math.max(0, finiteNumber(plan.manifest?.frameCount, result.frameCount) ?? 0)
        const renderedFrameCount = Math.max(0, finiteNumber(result.frameCount, result.frames?.length ?? 0) ?? 0)
        const wasStoppedEarly = plan.runtime?.exportStopRequested === true
                               && renderedFrameCount < expectedFrameCount
        if (renderedFrameCount > 0) {
            updateReplayExportCreationProgress({
                plan,
                frame: {
                    index:      renderedFrameCount - 1,
                    frameCount: expectedFrameCount,
                },
                force: true,
            })
        }
        updateReplayRecordingMonitor({
            mode:     monitorMode,
            phase:    'finalizing',
            progress: wasStoppedEarly && expectedFrameCount > 0
                      ? clampProgress(renderedFrameCount / expectedFrameCount)
                      : 1,
            frameIndex: renderedFrameCount > 0 ? renderedFrameCount - 1 : null,
            frameCount: expectedFrameCount,
            processedFrames: renderedFrameCount,
        })

        if (isDryRun) {
            exportSucceeded = true
            const totalMillis = Math.max(0, runtimeNow() - exportStartedAt)
            const timings = {
                ...dryRunTimings,
                samplePreparationWorkerMillis: replayFrameSampleWorker?.getProcessingMillis?.() ?? replayFrameSampleWorkerMillis,
                frameCount: renderedFrameCount,
                totalMillis,
                otherMillis: Math.max(0, totalMillis - dryRunTimings.cameraTraceMillis
                    - dryRunTimings.widgetStateMillis - dryRunTimings.tileReadinessMillis),
            }
            plan.runtime.dryRunTimings = timings
            console.info('[Replay dry run] Processing times in milliseconds', {frameCount: renderedFrameCount})
            console.table({
                'Camera and trace': Math.round(timings.cameraTraceMillis),
                'Widget state': Math.round(timings.widgetStateMillis),
                'Tile readiness': Math.round(timings.tileReadinessMillis),
                'Route sample prep (worker CPU)': Math.round(timings.samplePreparationWorkerMillis),
                'Preparation, frame resolution, UI yields and pauses': Math.round(timings.otherMillis),
                Total: Math.round(timings.totalMillis),
            })
            uiToast?.success?.({
                caption: 'Replay dry run',
                text:    'Dry run completed. No video file was created.',
            })
            return {
                ...result,
                plan,
                dryRun: true,
                timings,
            }
        }

        const exportFilename = filename ?? `${plan.label}.mp4`
        if (typeof download === 'function') {
            download(result.blob, exportFilename)
        }
        exportSucceeded = true
        uiToast?.success?.({
            caption: 'Replay video',
            text:    'Replay video generated.',
        })
        return {
            ...result,
            plan,
            filename: exportFilename,
            cleanupErrors,
        }
    }
    finally {
        /** Preserve an encoded artifact or the primary export error while releasing every independent resource. */
        const cleanup = async (stage, action) => {
            try {
                await action()
            }
            catch (error) {
                cleanupErrors.push({stage, message: error?.message ?? String(error)})
                console.error(`[Replay video] Export cleanup failed (${stage}):`, error)
            }
        }

        // Restore normal scene scheduling before any other teardown can fail.
        await cleanup('viewer-render-loop', () => exportRenderLoop?.release())
        exportRenderLoop = null
        await cleanup('sample-worker', () => replayFrameSampleWorker?.dispose?.())
        await cleanup('recording-monitor', stopReplayRecordingMonitor)
        for (const mirror of captureMirrors) {
            await cleanup('widget-capture', () => mirror.setFrameDriven(false))
        }
        captureMirrors.clear()
        overlayMetricsCache.clear()
        replayVideoTraceDebug('export.camera.ownership.end', {
            hasEndReplayCameraExport: typeof replayMode?.endReplayCameraExport === 'function',
        })
        replayVideoTraceDebug('export.run.end', {
            elapsedMs: runtimeNow() - exportStartedAt,
            succeeded: exportSucceeded,
            aborted: signal?.aborted === true,
            runtimeStatus: exportRuntimeStatus(),
        })
        await cleanup('camera-export', () => replayMode?.endReplayCameraExport?.())
        await cleanup('playback-progress', () => {
            if (controller?.seek && originalProgress !== null) {
                controller.seek(originalProgress)
            }
            else if (typeof replay?.progress === 'number' && originalProgress !== null) {
                replay.progress = originalProgress
            }
        })
        await cleanup('playback-transport', () => {
            if (originalRunning && controller?.start && !controller?.running) {
                controller.start({progress: originalProgress ?? 0})
                if (originalPaused) {
                    controller.pause?.()
                }
            }
        })
        if (plan.runtime) {
            if (signal?.aborted) {
                plan.runtime.status = 'warm'
            }
            else if (exportSucceeded) {
                plan.runtime.status = 'ready'
            }
            else {
                plan.runtime.status = 'warm'
            }
            plan.runtime.abortController = null
            plan.runtime.exportPromise = null
            plan.runtime.pauseExport = null
            plan.runtime.resumeExport = null
            plan.runtime.stopExport = null
            plan.runtime.abortExport = null
            plan.runtime.exportPaused = false
            plan.runtime.exportPausedAt = null
        }
        await cleanup('frame-state', () => clearReplayExportFrameState(plan))
        await cleanup('tile-readiness', () => replaySceneTileReadinessCoordinator?.dispose?.())
        replaySceneTileReadinessCoordinator = null
        if (isolatedRenderTarget) {
            await cleanup('isolated-render-target', () => replayMode?.clearRenderTarget?.(isolatedRenderTarget))
            isolatedRenderTarget = null
        }
        await cleanup('isolated-render-host', () => isolatedRenderHost?.destroy?.())
        isolatedRenderHost = null
        await cleanup('playback-scene', () => replayMode?.restorePlaybackScene?.({force: true}))
        await cleanup('replay-store', () => {
            if (replay && originalReplayState) {
                Object.assign(replay, originalReplayState)
            }
        })
        await cleanup('preparation-refresh', () => globalThis.__?.ui?.replay?.refresh?.({camera: true, suppressMoveEvents: true}))
        await cleanup('tile-cache', () => restoreReplaySceneTileCache?.())
        restoreReplaySceneTileCache = null
        await cleanup('frame-composer', () => replayComposer?.dispose?.())
        await cleanup('scene-render', () => globalThis.lgs?.scene?.requestRender?.())
        if (cleanupErrors.length > 0) {
            await cleanup('cleanup-warning', () => uiToast?.warning?.({
                caption: isDryRun ? 'Replay dry run cleanup' : 'Replay video cleanup',
                text: exportSucceeded
                    ? isDryRun
                        ? 'Dry run completed, but the scene could not be fully restored.'
                        : 'Your video is ready, but the scene could not be fully restored.'
                    : 'Replay stopped, but the scene could not be fully restored.',
            }))
        }
        if (plan.runtime) {
            plan.runtime.cleanupErrors = cleanupErrors
        }
    }
}

/**
 * Render the deferred master export without forcing a download.
 *
 * The final dialog uses this helper so it can share or hand off the blob to
 * the browser Web Share API.
 */
export const exportReplayDeferredMp4 = async (options = {}) => (
    runReplayDeferredMp4Export({
        ...options,
        download: null,
    })
)

/**
 * Traverse the deterministic Replay timeline without image capture or media output.
 *
 * @param {Object} [options={}] - Replay timeline and rendering options.
 * @returns {Promise<Object>} Dry run result and its plan.
 */
export const exportReplayDeferredDryRun = async (options = {}) => (
    runReplayDeferredMp4Export({
        ...options,
        dryRun: true,
        download: null,
    })
)
