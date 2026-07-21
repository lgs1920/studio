/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayDeferredExporter.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
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
import {
    resolveVideoOverlayVisibility,
}                              from '@Core/ui/replay/ReplayOverlayResolver'
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
    CanvasOverlayComposer,
}                              from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {
    ScreenMediaRecorder,
}                              from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import {
    UIToast,
}                              from '@Utils/UIToast'
import {
    BufferTarget, canEncodeVideo, CanvasSource, getEncodableVideoCodecs, Mp4OutputFormat, Output, QUALITY_HIGH,
    QUALITY_MEDIUM, QUALITY_VERY_HIGH,
}                              from 'mediabunny'

const VIDEO_CODEC_PROBE_TIMEOUT_MS = 2500
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
const defaultReplaySourceCanvas = () => globalThis.lgs?.canvas ?? null

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

const replayClipDurationMillis = clip => Math.max(0, finiteNumber(clip?.params?.duration, 0) ?? 0) * 1000

const resolveReplayExportClips = ({replay = defaultReplayStore()} = {}) => normalizeJourneyReplayClips(
    replay?.clips
    ?? globalThis.lgs?.stores?.replay?.clips
    ?? globalThis.lgs?.settings?.ui?.replay?.clips
    ?? {},
)

const replayClipSignature = clips => JSON.stringify({
    start: (clips?.start ?? []).map(clip => ({
        clipId: clip.clipId,
        params: clip.params ?? {},
        enabled: clip.enabled !== false,
    })),
    stop:  (clips?.stop ?? []).map(clip => ({
        clipId: clip.clipId,
        params: clip.params ?? {},
        enabled: clip.enabled !== false,
    })),
})

const buildReplayVideoTimeline = ({
                                      replayDurationMillis = 0,
                                      fps = defaultReplayExportFps(),
                                      direction = 1,
                                      clips = null,
                                  } = {}) => {
    const phases = []
    let cursor = 0
    const pushPhase = phase => {
        const durationMillis = Math.max(0, finiteNumber(phase.durationMillis, 0) ?? 0)
        const next = {
            ...phase,
            durationMillis,
            startMillis: cursor,
            endMillis:   cursor + durationMillis,
        }
        phases.push(next)
        cursor += durationMillis
    }

    for (const clip of clips?.start ?? []) {
        if (clip?.enabled === false) {
            continue
        }
        pushPhase({
            kind: REPLAY_CLIP_SLOT_START,
            slot: REPLAY_CLIP_SLOT_START,
            clip,
            anchorProgress: Number(direction) < 0 ? 1 : 0,
            durationMillis: replayClipDurationMillis(clip),
        })
    }

    const replayDuration = Math.max(0, finiteNumber(replayDurationMillis, 0) ?? 0)
    pushPhase({
        kind: 'replay',
        slot: 'replay',
        anchorProgress: Number(direction) < 0 ? 1 : 0,
        durationMillis: replayDuration,
    })

    for (const clip of clips?.stop ?? []) {
        if (clip?.enabled === false) {
            continue
        }
        pushPhase({
            kind: REPLAY_CLIP_SLOT_STOP,
            slot: REPLAY_CLIP_SLOT_STOP,
            clip,
            anchorProgress: Number(direction) < 0 ? 0 : 1,
            durationMillis: replayClipDurationMillis(clip),
        })
    }

    return {
        fps,
        direction: Number(direction) < 0 ? -1 : 1,
        replayDurationMillis: replayDuration,
        durationMillis: cursor,
        phases,
        clipSignature: replayClipSignature(clips),
    }
}

const resolveReplayVideoFramePhase = ({timeline = null, frame = null} = {}) => {
    const frameIntervalMs = timeline?.fps > 0 ? (1000 / timeline.fps) : (1000 / 30)
    const phaseFrameMetrics = ({phase = null, localMillis = 0} = {}) => {
        if (!phase) {
            return {
                phaseFrameIndex: 0,
                phaseFrameCount: 1,
            }
        }

        const phaseIndex = timeline?.phases?.indexOf?.(phase) ?? -1
        const isLastTimelinePhase = phaseIndex >= 0 && phaseIndex === timeline.phases.length - 1
        const baseFrameCount = Math.max(1, Math.ceil(Math.max(0, Number(phase.durationMillis) || 0) / frameIntervalMs))
        const phaseFrameCount = isLastTimelinePhase ? (baseFrameCount + 1) : baseFrameCount
        const phaseFrameIndex = Math.min(
            Math.max(0, phaseFrameCount - 1),
            Math.max(0, Math.round(Math.max(0, Number(localMillis) || 0) / frameIntervalMs)),
        )

        return {
            phaseFrameIndex,
            phaseFrameCount,
        }
    }
    const fallback = {
        kind: 'replay',
        slot: 'replay',
        progress: clampProgress(frame?.progress),
        localProgress: clampProgress(frame?.progress),
        anchorProgress: Number(timeline?.direction) < 0 ? 1 : 0,
        clip: null,
        ...phaseFrameMetrics(),
    }
    if (!timeline?.phases?.length) {
        return fallback
    }

    const timeMs = Math.max(0, finiteNumber(frame?.frameTimeMs, 0) ?? 0)
    const isFinalSceneFrame = frame?.isLast === true
    const phase = timeline.phases.find(item => timeMs < item.endMillis)
                  ?? timeline.phases[timeline.phases.length - 1]
                  ?? null
    if (!phase) {
        return fallback
    }

    const localMillis = Math.max(0, Math.min(phase.durationMillis, timeMs - phase.startMillis))
    const localProgress = phase.durationMillis > 0 ? clampProgress(localMillis / phase.durationMillis) : 1
    const replayProgress = phase.kind === 'replay'
                           ? (timeline.direction < 0 ? 1 - localProgress : localProgress)
                           : phase.anchorProgress
    const metrics = phaseFrameMetrics({phase, localMillis})
    const replayFrameIndex = phase.kind === 'replay' ? metrics.phaseFrameIndex : null
    const replayFrameCount = phase.kind === 'replay' ? metrics.phaseFrameCount : null

    return {
        ...phase,
        // Keep the absolute export clock available to deterministic camera
        // transitions. `localMillis` resets at every clip/replay phase and
        // must not be used as the camera transition clock.
        frameTimeMs: timeMs,
        progress: replayProgress,
        localProgress,
        localMillis,
        ...metrics,
        replayFrameIndex,
        replayFrameCount,
        isFinalSceneFrame,
        isLastPhaseFrame: metrics.phaseFrameIndex >= (metrics.phaseFrameCount - 1),
        isLastTwoReplayFrames: phase.kind === 'replay'
                               && replayFrameCount !== null
                               && (replayFrameCount - replayFrameIndex) <= 2,
    }
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
                                                      dimensions = null,
                                                      captureMode = 'deferred-master',
                                                      fps = defaultReplayExportFps(),
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
        const visible = resolveVideoOverlayVisibility({
            widgetId,
            widgetEl,
            replay,
            controller,
        })

        return {
            id:      widgetId,
            mounted: Boolean(entry?.mounted ?? widgetEl),
            visible,
        }
    })
    const widgetSignature = overlays
        .map(({id, mounted, visible}) => `${id}:${mounted ? 1 : 0}:${visible ? 1 : 0}`)
        .join('|')

    const context = {
        version:       1,
        captureMode:   captureMode === 'quality' ? 'quality' : 'speed',
        fps:           Number.isFinite(Number(fps)) ? Number(fps) : defaultReplayExportFps(),
        dimensions:    normalizedDimensions,
        cropRect:      normalizedCropRect,
        recordingSync: Boolean(replay?.recordingSync),
        direction:     Number(controller?.direction ?? replay?.direction) < 0 ? -1 : 1,
        progress:      finiteNumber(controller?.progress ?? replay?.progress, null),
        visibleOverlayIds: normalizeReplayWidgetIds(
            overlays
                .filter(({visible}) => visible)
                .map(({id}) => id),
        ),
        widgetSignature,
        clipSignature: replayClipSignature(resolveReplayExportClips({replay})),
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

    const encodableCodecs = await withTimeout(
        getEncodableVideoCodecs(['vp9'], {
            width:                safe.width,
            height:               safe.height,
            bitrate,
            alpha:                'discard',
            latencyMode:          'realtime',
            hardwareAcceleration,
        }),
        VIDEO_CODEC_PROBE_TIMEOUT_MS,
        'Video codec probe timed out for vp9.',
    ).catch(() => [])

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

const waitForAnimationFrames = (frameCount = 1) => new Promise(resolve => {
    const raf = globalThis.requestAnimationFrame
                ?? globalThis.window?.requestAnimationFrame?.bind(globalThis.window)
                ?? (callback => setTimeout(callback, 0))
    const frames = Math.max(1, Math.trunc(Number(frameCount) || 1))
    let remaining = frames
    const step = () => {
        remaining -= 1
        if (remaining <= 0) {
            resolve()
            return
        }
        raf(step)
    }
    raf(step)
})

const waitForReplayWidgetsReady = async ({widgetKeys = [], maxFrames = 30} = {}) => {
    const keys = Array.isArray(widgetKeys) ? widgetKeys.filter(Boolean) : []
    if (keys.length === 0) {
        return true
    }

    const frames = Math.max(0, Math.trunc(Number(maxFrames) || 0))
    for (let index = 0; index <= frames; index += 1) {
        if (keys.every(isReplayVideoWidgetReady)) {
            return true
        }
        await waitForAnimationFrames(1)
    }

    return keys.every(isReplayVideoWidgetReady)
}

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

    const frameState = {
        active:        true,
        playing:       true,
        paused:        false,
        index:         Number.isFinite(Number(frame?.index)) ? Number(frame.index) : null,
        progress,
        direction,
        sample:        frameSample,
        elapsedMillis,
        durationMillis,
        frameTimeMs:   finiteNumber(frame?.frameTimeMs, null),
        frameCount:    finiteNumber(frame?.frameCount, null),
        phase,
        replayFrameIndex: finiteNumber(phase?.replayFrameIndex, null),
        replayFrameCount: finiteNumber(phase?.replayFrameCount, null),
        updatedAt:     globalThis.performance?.now?.() ?? Date.now(),
    }

    plan.runtime.frameState = frameState
    return frameState
}

const clearReplayExportFrameState = (plan = null) => {
    if (plan?.runtime) {
        plan.runtime.frameState = null
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
        await output.setMetadataTags(metadata ?? {})

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

        const source = new CanvasSource(canvas, {
            codec:                outputConfig.codec,
            bitrate:              outputConfig.bitrate,
            alpha:                'discard',
            latencyMode:          'realtime',
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

        const maximumPacketCount = Number.isFinite(this.#timeline.frameCount)
                                   ? this.#timeline.frameCount + this.#timeline.fps
                                   : undefined
        output.addVideoTrack(source, {
            frameRate: this.#timeline.fps,
            ...(maximumPacketCount ? {maximumPacketCount} : {}),
        })

        await output.start()
        publishFileSize({force: true})

        const renderedFrames = []
        const frames = await this.#session.renderAll({
            signal,
            onFrame: async rendered => {
                const renderResult = await renderFrame({
                    canvas,
                    context: ctx,
                    frame: rendered,
                    manifest,
                    metadata,
                })
                renderedFrames.push(renderResult ?? rendered)
                await source.add(
                    rendered.frameTimeMs / 1000,
                    rendered.frameIntervalMs / 1000,
                    rendered.isFirst ? {keyFrame: true} : undefined,
                )
                publishFileSize()
                if (typeof onFrame === 'function') {
                    await onFrame(rendered, manifest)
                }
            },
        })

        await source.close()
        await output.finalize()

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
        sourceCanvas,
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
    })

    const plan = {
        status:     'ready',
        createdAt:  defaultTimestamp(),
        label,
        dimensions: effectiveDimensions,
        renderSpec: effectiveRenderSpec,
        captureMode,
        mediaMetadata,
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
    const currentContext = captureReplayDeferredExportContext({
        replay,
        controller,
        dimensions: requestedDimensions,
        captureMode: requestedCaptureMode,
        fps,
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
                                    replayFramePhase: replay.replayFramePhase,
                                    clipSequenceActive: replay.clipSequenceActive,
                                    toolbarVisible: replay.toolbarVisible,
                                    mainUiHidden: replay.mainUiHidden,
                                }
                                : null
    let exportSucceeded = false
    let replayComposer = null
    let replayComposerFallback = false
    let playbackScenePrepared = false

    if (plan.runtime) {
        plan.runtime.status = 'exporting'
        plan.runtime.abortController = abortController ?? null
    }
    initializeReplayExportCreationProgress({plan})
    installReplayExportRuntimeControls({plan, abortController})

    try {
        if (typeof replayMode?.preparePlaybackSceneForExport === 'function') {
            const firstTimelinePhase = plan.videoTimeline?.phases?.[0] ?? null
            playbackScenePrepared = await replayMode.preparePlaybackSceneForExport({
                journey,
                progress: originalProgress ?? 0,
                hideReplayMarker: firstTimelinePhase?.slot === REPLAY_CLIP_SLOT_START && Boolean(firstTimelinePhase?.clip),
            }) === true
            await waitForAnimationFrames(2)
        }

        publishReplayExportFrameState({
            plan,
            replay,
            controller,
            sample: controller?.currentSample?.() ?? replay?.sample ?? null,
        })

        const widgetKeys = [...(globalThis.__?.ui?.widgetCache?.getAll?.({widgetsBoard: VIDEO_WIDGETS_BOARD})?.keys?.() ?? [])]
        await waitForReplayWidgetsReady({widgetKeys})

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
                })
                await waitForAnimationFrames(1)

                const frameSource = sourceCanvas ?? defaultReplaySourceCanvas()
                if (frameSource instanceof HTMLCanvasElement) {
                    const cropRect = outputRenderSpec?.cropRect
                                     ?? normalizeReplayVideoCropRect(plan.runtime?.context?.cropRect ?? replay?.videoCropRect ?? null)
                    const composerClip = outputRenderSpec?.composerClip
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
                                flushWebGLBuffer: () => globalThis.lgs?.scene?.render?.(),
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
                            replay,
                            controller,
                        })
                        await replayComposer.renderFrame({waitForNextFrame: true})

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
        if (playbackScenePrepared && typeof replayMode?.restorePlaybackScene === 'function') {
            await replayMode.restorePlaybackScene({force: true})
        }
        if (replay && originalReplayState) {
            Object.assign(replay, originalReplayState)
        }
        globalThis.__?.ui?.replay?.refresh?.({camera: true, suppressMoveEvents: true})
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
