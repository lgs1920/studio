/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayDeferredExporter.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-21
 * Last modified: 2026-07-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
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
    publishReplayFrameState, REPLAY_FRAME_PUBLICATION_TARGET_HQ,
}                              from '@Core/ui/replay/ReplayFramePublisher'
import {
    buildReplayVideoTimeline, replayClipSignature, resolveReplayVideoFramePhase,
}                              from '@Core/ui/replay/ReplayVideoTimeline'
import {
    buildReplayVideoComposerOverlays, isReplayVideoWidgetReady,
}                              from '@Core/ui/replay/ReplayVideoOverlayComposer'
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
    createReplaySceneTileReadinessCoordinator,
    prepareReplaySceneTileCache,
    prepareReplaySceneTilesForCapture,
    resolveReplayTileSpeedLevel,
}                              from '@Core/ui/replay/ReplaySceneTileReadiness'
import {
    buildReplayFrameState,
}                              from '@Core/ui/replay/JourneyReplayRuntime'
import {
    normalizeJourneyReplayCamera, normalizeJourneyReplayReadiness,
}                              from '@Core/ui/replay/JourneyReplayProgressionStyle'
import {
    IsolatedHqReplayRenderHost,
}                              from '@Core/ui/replay/IsolatedHqReplayRenderHost'
import {
    captureReplaySceneDescriptor,
}                              from '@Core/ui/replay/ReplaySceneDescriptor'
import {
    REPLAY_RENDER_MODE_HQ, createReplayRenderContext, createReplayRenderModeContract,
}                              from '@Core/ui/replay/ReplayRenderModeContract'
import {
    CanvasOverlayComposer,
}                              from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {
    ScreenMediaRecorder,
}                              from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import {
    normalizeMediabunnyMetadataTags,
}                              from '@Core/ui/screen-media-recorder/recorder/MediaMetadata'
import {
    UIToast,
}                              from '@Utils/UIToast'
import {
    BufferTarget, canEncodeVideo, CanvasSource, getEncodableVideoCodecs, Mp4OutputFormat, Output, QUALITY_HIGH,
    QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                              from 'mediabunny'

const VIDEO_CODEC_PROBE_TIMEOUT_MS = 2500
export const DEFAULT_REPLAY_SCENE_TILE_READINESS_TIMEOUT_MS = 5000
const REPLAY_TILE_PREWARM_LOOKAHEAD_MS = 1000
const REPLAY_TILE_PREWARM_STEP_MS = 333
const REPLAY_TILE_PREWARM_MAX_SAMPLES = 3
const REPLAY_EXPORT_CODEC_KEEPALIVE_INTERVAL_MS = 5000
const REPLAY_EXPORT_CODEC_KEEPALIVE_TIMESTAMP_STEP_SECONDS = 0.000001
const EXPORT_PROGRESS_UPDATE_FRAME_STEP = 1
const EXPORT_PROGRESS_FRAME_SAMPLE_WINDOW = 30

const finiteNumber = (value, fallback = null) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const clampProgress = value => Math.max(0, Math.min(1, Number(value) || 0))
const runtimeNow = () => globalThis.performance?.now?.() ?? Date.now()
const defaultTimestamp = () => new Date().toISOString()
const defaultReplayStore = () => globalThis.lgs?.stores?.replay ?? null
const defaultJourney = () => globalThis.lgs?.theJourney ?? null
const defaultReplayController = () => globalThis.__?.ui?.replay?.controller ?? null
const defaultReplayMode = () => globalThis.__?.ui?.replay ?? null
const defaultReplayExportFps = () => {
    const configured = globalThis.lgs?.stores?.ui?.video?.fps
    return ScreenMediaRecorder.FPS?.[configured] ?? configured ?? 30
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
 * Create the default isolated HQ replay render host.
 *
 * @param {Object} options - Host construction options.
 * @returns {IsolatedHqReplayRenderHost} New isolated host.
 */
const defaultIsolatedReplayRenderHostFactory = options => new IsolatedHqReplayRenderHost(options)

/**
 * Pre-warm a small rolling prefix of the HQ camera path through Cesium.
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
        durationMillis: plan.videoTimeline.durationMillis,
        fps: plan.videoTimeline.fps,
        direction: 1,
    })
    const firstFrame = timeline.frameAtIndex(0)
    const firstPhase = resolveReplayVideoFramePhase({
        timeline: plan.videoTimeline,
        frame: firstFrame,
    })
    const safeLookaheadMs = Math.max(0, Number(lookaheadMs) || 0)
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
                throw new DOMException('The HQ tile pre-warm was aborted.', 'AbortError')
            }

            const futureFrame = timeline.frameAtTimeMs(sampleIndex * sampleStepMs)
            const futurePhase = resolveReplayVideoFramePhase({
                timeline: plan.videoTimeline,
                frame: futureFrame,
            })
            await replayMode.renderReplayExportFrame({
                phase: futurePhase,
                frame: futureFrame,
                plan,
                replay,
                controller,
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
            frame: firstFrame,
            plan,
            replay,
            controller,
        })
        replayVideoTraceDebug('export.tile-prewarm.end', {
            prewarmed,
        })
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
    const savedState = normalizeReplayCameraStateSnapshot(
        cameraState
        ?? replay?.replayEntryCameraState
        ?? replay?.savedCameraState
        ?? globalThis.__?.ui?.replay?.savedCameraState
        ?? globalThis.__?.ui?.replay?.replayEntryCameraState,
    )
    if (savedState) {
        return savedState
    }

    const camera = globalThis.lgs?.viewer?.camera ?? null
    const position = camera?.positionCartographic ?? null
    const longitude = finiteNumber(position?.longitude, null)
    const latitude = finiteNumber(position?.latitude, null)
    const height = finiteNumber(position?.height, null)
    const hasCameraState = Boolean(camera)
                           || longitude !== null
                           || latitude !== null
                           || height !== null
    if (!hasCameraState) {
        return null
    }

    return {
        destination: {
            longitude: longitude !== null ? roundFocusValue((longitude * 180) / Math.PI) : null,
            latitude:  latitude !== null ? roundFocusValue((latitude * 180) / Math.PI) : null,
            height:    roundFocusValue(height),
        },
        orientation: {
            heading: roundFocusValue(camera?.heading ?? 0),
            pitch:   roundFocusValue(camera?.pitch ?? 0),
            roll:    roundFocusValue(camera?.roll ?? 0),
        },
        altitude: roundFocusValue(height),
    }
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

const resolveReplayExportClips = ({replay = defaultReplayStore()} = {}) => normalizeJourneyReplayClips(
    replay?.clips
    ?? globalThis.lgs?.stores?.replay?.clips
    ?? globalThis.lgs?.settings?.ui?.replay?.clips
    ?? {},
)

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
    const widgetEntries = [...(widgetCache?.getAll?.({widgetsBoard})?.entries?.() ?? [])]
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
        renderMode: REPLAY_RENDER_MODE_HQ,
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
    const context = {
        ...renderContext.context,
        captureMode:   captureMode === 'quality' ? 'quality' : 'speed',
        fps:           Number.isFinite(Number(fps)) ? Number(fps) : defaultReplayExportFps(),
        dimensions:    normalizedDimensions,
        cropRect:      normalizedCropRect,
        cameraState:   initialCameraState,
        recordingSync: Boolean(replay?.recordingSync),
        progress:      finiteNumber(controller?.progress ?? replay?.progress, null),
        visibleOverlayIds,
        widgetSignature,
        clipSignature: replayClipSignature(resolveReplayExportClips({replay})),
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

// Keep the browser's fastest supported encoder as the default for HQ exports.
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
            // HQ is an offline export. Realtime mode may drop frames when the
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
 * Yield the event loop for a bounded amount of wall-clock time.
 *
 * @param {number} millis - Delay duration in milliseconds.
 * @returns {Promise<void>} Promise resolved after the delay.
 */
const delay = millis => new Promise(resolve => setTimeout(resolve, millis))

/**
 * Publish the deterministic HQ replay frame consumed by dynamic widgets.
 *
 * This mirrors the live controller's `dynamicFrameState`, but it is scoped to
 * the deferred export plan so the HQ renderer controls the widget clock.
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
        renderMode:      'hq',
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

    return publishReplayFrameState({
        replay,
        plan,
        target: REPLAY_FRAME_PUBLICATION_TARGET_HQ,
        frameState,
        intentOptions: {
            planId: plan.renderPlan?.id ?? plan.runtime?.contextKey ?? null,
            resolved: true,
            logicalFrame,
        },
    })
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
        exportLastProgressAt:                   now,
        exportLastProgressProcessedFrames:      0,
        exportLastProgressPausedDurationMillis: 0,
        exportPaused:                   false,
        exportPausedAt:                 null,
        exportPausedDurationMillis:     0,
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
    runtime.abortExport = () => {
        const controller = abortController ?? runtime.abortController ?? null
        controller?.abort?.()
    }

    return runtime
}

const waitForReplayExportResume = async ({plan = null, signal = null} = {}) => {
    while (plan?.runtime?.exportPaused === true && !signal?.aborted) {
        await delay(100)
    }
}

const updateReplayExportCreationProgress = ({plan = null, frame = null, force = false} = {}) => {
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
    const shouldUpdate = force
                         || processedFrames <= 1
                         || isLastFrame
                         || processedFrames % EXPORT_PROGRESS_UPDATE_FRAME_STEP === 0

    if (!shouldUpdate) {
        return plan.runtime
    }

    const runtime = plan.runtime
    const now = runtimeNow()
    const pausedDurationMillis = replayExportPausedDurationMillis({runtime, now})
    const elapsedMillis = replayExportActiveElapsedMillis({runtime, now})
    const progress = safeFrameCount !== null
                     ? clampProgress(processedFrames / safeFrameCount)
                     : clampProgress(frame?.progress)
    const previousUpdateAt = finiteNumber(runtime.exportLastProgressAt, null)
    const previousProcessedFrames = finiteNumber(runtime.exportLastProgressProcessedFrames, 0) ?? 0
    const previousPausedDurationMillis = finiteNumber(runtime.exportLastProgressPausedDurationMillis, 0) ?? 0
    const frameDelta = Math.max(0, processedFrames - previousProcessedFrames)
    const activeDeltaMillis = previousUpdateAt !== null
                              ? Math.max(0, now - previousUpdateAt - Math.max(0, pausedDurationMillis - previousPausedDurationMillis))
                              : elapsedMillis
    const nextSamples = Array.isArray(runtime.exportFrameDurationSamples)
                        ? [...runtime.exportFrameDurationSamples]
                        : []
    if (frameDelta > 0 && activeDeltaMillis > 0) {
        const frameMillis = activeDeltaMillis / frameDelta
        for (let index = 0; index < frameDelta; index += 1) {
            nextSamples.push(frameMillis)
        }
        nextSamples.splice(0, Math.max(0, nextSamples.length - EXPORT_PROGRESS_FRAME_SAMPLE_WINDOW))
    }

    const recentAverageFrameMillis = average(nextSamples)
    const lifetimeAverageFrameMillis = processedFrames > 0 && elapsedMillis > 0
                                       ? elapsedMillis / processedFrames
                                       : null
    const previousAverageFrameMillis = finiteNumber(runtime.exportAverageFrameMillis, null)
    const measuredAverageFrameMillis = recentAverageFrameMillis !== null && lifetimeAverageFrameMillis !== null
                                       ? (recentAverageFrameMillis * 0.7) + (lifetimeAverageFrameMillis * 0.3)
                                       : recentAverageFrameMillis ?? lifetimeAverageFrameMillis ?? previousAverageFrameMillis
    const averageFrameMillis = measuredAverageFrameMillis !== null && previousAverageFrameMillis !== null
                               ? (previousAverageFrameMillis * 0.35) + (measuredAverageFrameMillis * 0.65)
                               : measuredAverageFrameMillis
    const remainingFrames = safeFrameCount !== null ? Math.max(0, safeFrameCount - processedFrames) : null
    const estimatedTotalMillis = averageFrameMillis !== null && safeFrameCount !== null
                                 ? averageFrameMillis * safeFrameCount
                                 : (progress > 0 ? elapsedMillis / progress : null)
    const estimatedRemainingMillis = remainingFrames !== null && averageFrameMillis !== null
                                     ? averageFrameMillis * remainingFrames
                                     : (estimatedTotalMillis !== null ? Math.max(0, estimatedTotalMillis - elapsedMillis) : null)

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
        exportLastProgressAt:                   now,
        exportLastProgressProcessedFrames:      processedFrames,
        exportLastProgressPausedDurationMillis: pausedDurationMillis,
        exportUpdatedAt:                now,
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
                    renderMode = REPLAY_RENDER_MODE_HQ,
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
                       } = {}) => {
        if (typeof renderFrame !== 'function') {
            throw new Error('ReplayDeferredExporter.exportMp4 requires a renderFrame callback.')
        }

        const outputDimensions = normalizeDimensions(dimensions ?? {})
        if (outputDimensions.width <= 0 || outputDimensions.height <= 0) {
            throw new Error('ReplayDeferredExporter.exportMp4 requires valid dimensions.')
        }

        const outputConfig = this.#preparedOutputConfig
                            ?? await resolveReplayExportVideoOutput({
                                width:  outputDimensions.width,
                                height: outputDimensions.height,
                                browser,
                            })
        if (!outputConfig) {
            throw new Error(`No supported video codec for ${outputDimensions.width}x${outputDimensions.height} on this browser.`)
        }

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
            onFileSize(bytes, {
                encodedPacketBytes,
                targetBytes,
                finalized: Boolean(target.buffer),
            })
        }

        let encoderCanvas = canvas
        let encoderContext = null
        if (typeof HTMLCanvasElement !== 'undefined'
            && canvas instanceof HTMLCanvasElement
            && typeof document !== 'undefined'
            && typeof document.createElement === 'function') {
            const stableCanvas = document.createElement('canvas')
            stableCanvas.width = outputDimensions.width
            stableCanvas.height = outputDimensions.height
            const stableContext = stableCanvas.getContext('2d', {alpha: false, desynchronized: true})
            if (stableContext?.drawImage && stableContext?.clearRect) {
                encoderCanvas = stableCanvas
                encoderContext = stableContext
            }
        }

        const source = new CanvasSource(encoderCanvas, {
            codec:                outputConfig.codec,
            bitrate:              outputConfig.bitrate,
            alpha:                'discard',
            // HQ is an offline, timestamped export. Realtime mode may drop
            // frames while the encoder is slower than the requested FPS.
            latencyMode:          'quality',
            hardwareAcceleration: outputConfig.hardwareAcceleration,
            ...(outputConfig.fullCodecString ? {fullCodecString: outputConfig.fullCodecString} : {}),
            transform:            {
                width:  outputDimensions.width,
                height: outputDimensions.height,
            },
            sizeChangeBehavior: 'fill',
            onEncoderConfig:    () => {},
            onEncodedPacket:    packet => {
                const packetBytes = finiteNumber(packet?.byteLength, null)
                                    ?? finiteNumber(packet?.data?.byteLength, 0)
                                    ?? 0
                const alphaBytes = finiteNumber(packet?.sideData?.alphaByteLength, null)
                                   ?? finiteNumber(packet?.sideData?.alpha?.byteLength, 0)
                                   ?? 0
                encodedPacketBytes += Math.max(0, packetBytes) + Math.max(0, alphaBytes)
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

                await source.add(safeTimestamp, duration, encodeOptions)
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
            await output.start()
            publishFileSize({force: true})

            const renderedFrames = []
            const frames = await this.#session.renderAll({
                signal,
                onFrame: async rendered => {
                    nextFrameTimestamp = rendered.frameTimeMs / 1000
                    const renderResult = await renderFrame({
                        canvas,
                        context: ctx,
                        frame: rendered,
                        manifest,
                        metadata,
                    })
                    renderedFrames.push(renderResult ?? rendered)
                    if (encoderContext) {
                        encoderContext.clearRect(0, 0, outputDimensions.width, outputDimensions.height)
                        encoderContext.drawImage(
                            canvas,
                            0,
                            0,
                            outputDimensions.width,
                            outputDimensions.height,
                        )
                    }
                    await enqueueSourceAdd({
                        timestamp: rendered.frameTimeMs / 1000,
                        duration: rendered.frameIntervalMs / 1000,
                        encodeOptions: rendered.isFirst ? {keyFrame: true} : undefined,
                    })
                    scheduleCodecKeepAlive()
                    if (typeof onFrame === 'function') {
                        await onFrame(rendered, manifest)
                    }
                },
            })

            await source.close()
            await output.finalize()
            outputFinalized = true

            const blob = new Blob([output.target.buffer], {type: outputConfig.mimeType})
            publishFileSize({force: true})
            if (typeof onFileSize === 'function') {
                onFileSize(blob.size, {
                    encodedPacketBytes,
                    targetBytes: blob.size,
                    finalized: true,
                })
            }
            return this.#buildArtifact({
                blob,
                manifest,
                frames,
                renderedFrames,
                frameCount: finiteNumber(frames?.length, 0) ?? 0,
                mimeType: outputConfig.mimeType,
                extension: outputConfig.extension,
                label,
            })
        }
        finally {
            keepAliveStopped = true
            if (keepAliveTimer !== null) {
                clearTimeout(keepAliveTimer)
                keepAliveTimer = null
            }
            await sourceOperation.catch(() => undefined)
            if (outputStarted && !outputFinalized && typeof output.cancel === 'function') {
                await output.cancel().catch(() => undefined)
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
    const replayClips = resolveReplayExportClips({replay})
    const videoTimeline = buildReplayVideoTimeline({
        replayDurationMillis,
        fps,
        direction,
        clips: replayClips,
    })
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
        replayDurationMillis,
        sourceCanvas,
    })
    const trackPath = controller?.sampler?.logicalTrackPath ?? null
    const trackPathDescriptor = createReplayTrackPathDescriptor(trackPath)
    const startProgress = Number(direction) < 0 ? 1 : 0
    const cameraDefinition = createReplayCameraDefinition({
        cameraSettings: replay?.camera,
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
        source: 'hq',
    })
    const renderPlan = createReplayRenderPlan({
        definition,
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
            durationMillis: videoTimeline.durationMillis,
            fps,
            direction: 1,
        },
        seek: (progress, frame = null) => {
            const phase = resolveReplayVideoFramePhase({timeline: videoTimeline, frame})
            return controller?.seek?.(phase.progress)
        },
        resolveSample: frame => {
            const phase = resolveReplayVideoFramePhase({timeline: videoTimeline, frame})
            return controller?.sampler?.atProgress?.(phase.progress)
                   ?? controller?.currentSample?.()
                   ?? null
        },
        renderMode: REPLAY_RENDER_MODE_HQ,
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
        renderContract: replayContext.context?.renderContract
                         ?? createReplayRenderModeContract({
                             renderMode: REPLAY_RENDER_MODE_HQ,
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
                clipSignature: videoTimeline.clipSignature,
                ...(metadata ?? {}),
            },
        }),
    }
    plan.exporter = exporter
    plan.videoTimeline = videoTimeline

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
 * This is intentionally asynchronous so it can run while the live draft is
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
 * prepared so the HQ export does not reuse stale assumptions.
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
        replayDurationMillis: currentDurationMillis,
        sourceCanvas,
    })
    if (existingPlan?.runtime?.contextKey === currentContext.contextKey) {
        if (mediaMetadata !== null && mediaMetadata !== undefined) {
            existingPlan.mediaMetadata = mediaMetadata
        }
        return {
            exporter: existingPlan.exporter ?? null,
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
                                                     renderHostMode = 'isolated',
                                                     isolatedRenderHostFactory = defaultIsolatedReplayRenderHostFactory,
                                                     tileReadinessTimeoutMs = DEFAULT_REPLAY_SCENE_TILE_READINESS_TIMEOUT_MS,
                                                     uiToast = UIToast,
                                                     download = downloadBlob,
                                                 } = {}) => {
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
    if (plan.runtime?.warmPromise) {
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
    let replayComposer = null
    let replayComposerFallback = false
    let restoreReplaySceneTileCache = null
    let replaySceneTileReadinessCoordinator = null
    let replaySceneTileReadinessOptions = null
    let isolatedRenderHost = null
    let isolatedRenderTarget = null
    let isolatedViewportDimensions = null
    let previousReplayExportFrame = null
    let previousReplayExportSample = null
    const exportStartedAt = runtimeNow()
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
        plan.runtime.abortController = abortController ?? null
    }
    initializeReplayExportCreationProgress({plan})
    installReplayExportRuntimeControls({plan, abortController})

    try {
        // Always leave a previous Draft scene before preparing HQ. This restores
        // the original track and camera focus when the user switches modes or
        // aborts between the two exports.
        const restoreStartedAt = runtimeNow()
        let restoreSucceeded = false
        replayVideoTraceDebug('export.draft.restore.start', {
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
            replayVideoTraceDebug('export.draft.restore.end', {
                elapsedMs: runtimeNow() - restoreStartedAt,
                restored: restoreSucceeded,
                hasRestorePlaybackScene: typeof replayMode?.restorePlaybackScene === 'function',
            })
        }


        const isolatedHostSupported = renderHostMode === 'isolated'
                                      && typeof replayMode?.setRenderTarget === 'function'
                                      && typeof replayMode?.clearRenderTarget === 'function'
                                      && typeof isolatedRenderHostFactory === 'function'
        if (isolatedHostSupported) {
            const descriptor = captureReplaySceneDescriptor()
            if (descriptor) {
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
                        readiness: normalizeJourneyReplayReadiness(
                            replay?.readiness
                            ?? globalThis.lgs?.settings?.ui?.replay?.readiness,
                        ),
                    })
                    await isolatedRenderHost.initialize()
                    isolatedRenderTarget = isolatedRenderHost.renderTarget?.() ?? null
                    if (!isolatedRenderTarget) {
                        throw new Error('The isolated HQ render host did not expose a render target')
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
                            // Continue with host teardown and the visible fallback.
                        }
                    }
                    try {
                        isolatedRenderHost?.destroy?.()
                    }
                    catch {
                        // The visible fallback must remain available after teardown failure.
                    }
                    isolatedRenderHost = null
                    isolatedRenderTarget = null
                    isolatedViewportDimensions = null
                    replayVideoTraceDebug('export.render-host.isolated.fallback', {
                        message: error?.message ?? String(error),
                    })
                    uiToast?.warning?.({
                        caption: 'HQ Video',
                        text:    'Isolated HQ rendering is unavailable. The visible map will be used.',
                    })
                }
            }
        }

        const scenePrepareStartedAt = runtimeNow()
        let scenePrepared = false
        const firstTimelinePhase = plan.videoTimeline?.phases?.[0] ?? null
        replayVideoTraceDebug('export.scene.prepare.start', {
            journeySlug: journey?.slug ?? replay?.journeySlug ?? null,
            progress: originalProgress ?? 0,
            hideReplayMarker: firstTimelinePhase?.slot === REPLAY_CLIP_SLOT_START && Boolean(firstTimelinePhase?.clip),
            hasCameraState: Boolean(plan.runtime?.context?.cameraState),
            hasPreparePlaybackSceneForExport: typeof replayMode?.preparePlaybackSceneForExport === 'function',
        })
        try {
            if (typeof replayMode?.preparePlaybackSceneForExport === 'function') {
                await replayMode.preparePlaybackSceneForExport({
                    journey,
                    progress: originalProgress ?? 0,
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
            const replayCamera = normalizeJourneyReplayCamera(
                replay?.camera
                ?? globalThis.lgs?.settings?.ui?.replay?.camera,
            )
            restoreReplaySceneTileCache = prepareReplaySceneTileCache(replayScene)
            replaySceneTileReadinessCoordinator = isolatedRenderHost
                ? {
                    prepareForCapture: options => isolatedRenderHost.prepareForCapture(options),
                }
                : createReplaySceneTileReadinessCoordinator(replayScene, {
                    enabled:                    replayReadiness.enabled,
                    policy:                     replayReadiness.policy,
                    knownFootprintTimeoutMs:    replayReadiness.knownFootprintTimeoutMs,
                    movingTimeoutMs:             replayReadiness.movingTimeoutMs,
                    settledTimeoutMs:            replayReadiness.settledTimeoutMs,
                    prewarmEnabled:              replayReadiness.prewarmEnabled,
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
        })

        const widgetKeys = [...(globalThis.__?.ui?.widgetCache?.getAll?.({widgetsBoard: VIDEO_WIDGETS_BOARD})?.keys?.() ?? [])]
        await waitForReplayWidgetsReady({widgetKeys})
        await prewarmReplayScenePrefix({
            plan,
            replay,
            controller,
            replayMode,
            coordinator: replaySceneTileReadinessCoordinator,
            lookaheadMs: replaySceneTileReadinessOptions?.readiness?.enabled !== false
                         && replaySceneTileReadinessOptions?.readiness?.prewarmEnabled !== false
                         ? replaySceneTileReadinessOptions?.camera?.playback?.tilePreloadHorizonMs
                           ?? REPLAY_TILE_PREWARM_LOOKAHEAD_MS
                         : 0,
            signal,
        })

        const result = await exporter.exportMp4({
            signal,
            label: plan.label,
            metadata: plan.mediaMetadata ?? mediaMetadata ?? metadata ?? {},
            dimensions: outputDimensions,
            buildCanvas,
            onFileSize: bytes => {
                updateReplayExportFileSize({plan, bytes})
            },
            renderFrame: async ({canvas, context, frame}) => {
                await waitForReplayExportResume({plan, signal})
                if (signal?.aborted) {
                    throw new DOMException('The HQ export was aborted.', 'AbortError')
                }

                const phase = resolveReplayVideoFramePhase({
                    timeline: plan.videoTimeline,
                    frame,
                })
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
                if (typeof replayMode?.renderReplayExportFrame === 'function') {
                    frameSample = await replayMode.renderReplayExportFrame({
                        phase,
                        frame,
                        plan,
                        replay,
                        controller,
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
                const speedLevel = resolveReplayTileSpeedLevel({
                    frame,
                    previousFrame: previousReplayExportFrame,
                    sample: frameSample,
                    previousSample: previousReplayExportSample,
                })
                previousReplayExportFrame = frame
                previousReplayExportSample = frameSample
                publishReplayExportFrameState({
                    plan,
                    replay,
                    controller,
                    frame: {
                        ...frame,
                        progress: phase.progress,
                    },
                    sample: frameSample,
                    phase,
                    logicalFrame: replayMode?.lastReplayLogicalFrame ?? null,
                    trackPath: plan.renderContract?.trackPath
                               ?? plan.runtime?.context?.renderContract?.trackPath
                               ?? controller?.sampler?.logicalTrackPath
                               ?? null,
                })
                if (replaySceneTileReadinessCoordinator) {
                    await replaySceneTileReadinessCoordinator.prepareForCapture({
                        maxMillis: tileReadinessTimeoutMs,
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
                        maxMillis: tileReadinessTimeoutMs,
                        signal,
                    })
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
                        try {
                            replayComposer = new CanvasOverlayComposer(frameSource, {
                                clip: composerClip,
                                width: composerWidth,
                                height: composerHeight,
                                fps: 0,
                                outputDpr: composerOutputDpr,
                            })
                        }
                        catch {
                            replayComposerFallback = true
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
                        })
                        await replayComposer.renderFrame()

                        const composedCanvas = replayComposer.getCanvas?.()
                        if (composedCanvas) {
                            context.clearRect(0, 0, canvas.width, canvas.height)
                            context.drawImage(composedCanvas, 0, 0, composedCanvas.width, composedCanvas.height, 0, 0, canvas.width, canvas.height)
                        }
                    }
                    else {
                        context.clearRect(0, 0, canvas.width, canvas.height)
                        context.drawImage(frameSource, 0, 0, frameSource.width, frameSource.height, 0, 0, canvas.width, canvas.height)
                    }
                }
            },
            onFrame: async frame => {
                updateReplayExportCreationProgress({plan, frame})
            },
        })

        if (signal?.aborted) {
            throw new DOMException('The HQ export was aborted.', 'AbortError')
        }
        updateReplayExportCreationProgress({
            plan,
            frame: {
                index:      Math.max(0, (finiteNumber(plan.manifest?.frameCount, 1) ?? 1) - 1),
                frameCount: finiteNumber(plan.manifest?.frameCount, null),
            },
            force: true,
        })

        const exportFilename = filename ?? `${plan.label}.mp4`
        if (typeof download === 'function') {
            download(result.blob, exportFilename)
        }
        exportSucceeded = true
        uiToast?.success?.({
            caption: 'HQ Video',
            text:    'HQ Video generated.',
        })
        return {
            ...result,
            plan,
            filename: exportFilename,
        }
    }
    finally {
        replayVideoTraceDebug('export.camera.ownership.end', {
            hasEndReplayCameraExport: typeof replayMode?.endReplayCameraExport === 'function',
        })
        replayVideoTraceDebug('export.run.end', {
            elapsedMs: runtimeNow() - exportStartedAt,
            succeeded: exportSucceeded,
            aborted: signal?.aborted === true,
            runtimeStatus: exportRuntimeStatus(),
        })
        replayMode?.endReplayCameraExport?.()
        if (controller?.seek && originalProgress !== null) {
            controller.seek(originalProgress)
        }
        else if (typeof replay?.progress === 'number' && originalProgress !== null) {
            replay.progress = originalProgress
        }
        if (originalRunning && controller?.start && !controller?.running) {
            controller.start({progress: originalProgress ?? 0})
            if (originalPaused) {
                controller.pause?.()
            }
        }
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
            plan.runtime.pauseExport = null
            plan.runtime.resumeExport = null
            plan.runtime.abortExport = null
            plan.runtime.exportPaused = false
            plan.runtime.exportPausedAt = null
        }
        clearReplayExportFrameState(plan)
        replaySceneTileReadinessCoordinator?.dispose?.()
        replaySceneTileReadinessCoordinator = null
        if (isolatedRenderTarget) {
            try {
                replayMode?.clearRenderTarget?.(isolatedRenderTarget)
            }
            catch (error) {
                replayVideoTraceDebug('export.render-host.isolated.clear.error', {
                    message: error?.message ?? String(error),
                })
            }
            isolatedRenderTarget = null
        }
        try {
            isolatedRenderHost?.destroy?.()
        }
        catch (error) {
            replayVideoTraceDebug('export.render-host.isolated.destroy.error', {
                message: error?.message ?? String(error),
            })
        }
        isolatedRenderHost = null
        if (typeof replayMode?.restorePlaybackScene === 'function') {
            await replayMode.restorePlaybackScene({force: true})
        }
        if (replay && originalReplayState) {
            Object.assign(replay, originalReplayState)
        }
        globalThis.__?.ui?.replay?.refresh?.({camera: true, suppressMoveEvents: true})
        restoreReplaySceneTileCache?.()
        restoreReplaySceneTileCache = null
        replayComposer?.dispose?.()
        globalThis.lgs?.scene?.requestRender?.()
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
