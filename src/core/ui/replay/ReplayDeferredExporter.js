/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayDeferredExporter.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-14
 * Last modified on: 2026-07-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ReplayFrameTimeline } from '@Core/ui/replay/ReplayFrameTimeline'
import { ReplayVideoRenderSession } from '@Core/ui/replay/ReplayVideoRenderSession'
import { resolveVideoOverlayVisibility } from '@Core/ui/replay/ReplayOverlayResolver'
import { VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { UIToast } from '@Utils/UIToast'
import {
    BufferTarget,
    canEncodeVideo,
    CanvasSource,
    getEncodableVideoCodecs,
    Mp4OutputFormat,
    Output,
    QUALITY_HIGH,
    QUALITY_MEDIUM,
    QUALITY_VERY_HIGH,
} from 'mediabunny'

const VIDEO_CODEC_PROBE_TIMEOUT_MS = 2500

const finiteNumber = (value, fallback = null) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const defaultTimestamp = () => new Date().toISOString()
const defaultReplayStore = () => globalThis.lgs?.stores?.replay ?? null
const defaultJourney = () => globalThis.lgs?.theJourney ?? null
const defaultReplayController = () => globalThis.__?.ui?.replay?.controller ?? null
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

const normalizeReplayCropRect = (cropRect = null) => {
    if (!cropRect) {
        return null
    }

    const left = finiteNumber(cropRect.left, null)
    const top = finiteNumber(cropRect.top, null)
    const width = finiteNumber(cropRect.width, null)
    const height = finiteNumber(cropRect.height, null)
    if ([left, top, width, height].some(value => value === null)) {
        return null
    }

    return {
        left:   Math.round(left),
        top:    Math.round(top),
        width:  Math.max(0, Math.round(width)),
        height: Math.max(0, Math.round(height)),
    }
}

const normalizeReplayWidgetIds = (widgetIds = []) => (
    [...new Set((widgetIds ?? []).map(widgetId => `${widgetId}`))]
        .filter(Boolean)
        .sort()
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
    const normalizedCropRect = normalizeReplayCropRect(replay?.videoCropRect)
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

const waitForAnimationFrame = () => new Promise(resolve => {
    const raf = globalThis.requestAnimationFrame
                ?? globalThis.window?.requestAnimationFrame?.bind(globalThis.window)
                ?? (callback => setTimeout(callback, 0))
    raf(() => raf(() => resolve()))
})

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
        const output = new Output({
            format: outputConfig.format,
            target: new BufferTarget(),
        })
        await output.setMetadataTags({
            title: label,
            comment: JSON.stringify(manifest),
        })

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
            onEncodedPacket:    () => {},
        })

        const maximumPacketCount = Number.isFinite(this.#timeline.frameCount)
                                   ? this.#timeline.frameCount + this.#timeline.fps
                                   : undefined
        output.addVideoTrack(source, {
            frameRate: this.#timeline.fps,
            ...(maximumPacketCount ? {maximumPacketCount} : {}),
        })

        await output.start()

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
                if (typeof onFrame === 'function') {
                    await onFrame(rendered, manifest)
                }
            },
        })

        await source.close()
        await output.finalize()

        const blob = new Blob([output.target.buffer], {type: outputConfig.mimeType})
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
                                                    dimensions = null,
                                                    captureMode = 'deferred-master',
                                                    sourceCanvas = defaultReplaySourceCanvas(),
                                                    context = null,
                                                    uiToast = UIToast,
                                                } = {}) => {
    const replayDurationMillis = Number.isFinite(Number(controller?.duration))
                                ? Math.max(0, Number(controller.duration) * 1000)
                                : Math.max(0, Number(replay?.durationMillis) || 0)
    const replayContext = context ?? captureReplayDeferredExportContext({
        replay,
        controller,
        dimensions,
        captureMode,
        fps,
        sourceCanvas,
    })
    const exporter = new ReplayDeferredExporter({
        controller,
        timeline: {
            durationMillis: replayDurationMillis,
            fps,
            direction: controller?.direction ?? replay?.direction ?? 1,
        },
    })

    const plan = {
        status:     'ready',
        createdAt:  defaultTimestamp(),
        label,
        dimensions: dimensions ? normalizeDimensions(dimensions) : null,
        captureMode,
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
                dimensions:  dimensions ? normalizeDimensions(dimensions) : null,
                contextKey:  replayContext.contextKey,
                ...(metadata ?? {}),
            },
        }),
    }
    plan.exporter = exporter

    if (replay) {
        replay.deferredExportPlan = plan
    }

    uiToast?.success?.({
        caption: 'Replay export',
        text:    'Master export plan prepared.',
    })

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
                                                    dimensions = null,
                                                    captureMode = 'deferred-master',
                                                    sourceCanvas = defaultReplaySourceCanvas(),
                                                    uiToast = UIToast,
                                                } = {}) => {
    const currentContext = captureReplayDeferredExportContext({
        replay,
        controller,
        dimensions,
        captureMode,
        fps,
        sourceCanvas,
    })
    const existingPlan = replay?.deferredExportPlan ?? null
    if (existingPlan?.runtime?.contextKey === currentContext.contextKey) {
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
        dimensions,
        captureMode,
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
                                                     filename = null,
                                                     dimensions = null,
                                                     sourceCanvas = defaultReplaySourceCanvas(),
                                                     buildCanvas = null,
                                                     uiToast = UIToast,
                                                     download = downloadBlob,
                                                 } = {}) => {
    const basePlan = resolveReplayDeferredExportPlan({
        replay,
        journey,
        controller,
        fps,
        label,
        metadata,
        dimensions,
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
        dimensions
        ?? plan.dimensions
        ?? {
            width:  Number(sourceCanvas?.width) || Number(replay?.videoCropRect?.width) || 1920,
            height: Number(sourceCanvas?.height) || Number(replay?.videoCropRect?.height) || 1080,
        },
    )

    const originalProgress = finiteNumber(controller?.progress, null)
    const originalPaused = Boolean(controller?.paused)
    const originalRunning = Boolean(controller?.running)

    try {
        const result = await exporter.exportMp4({
            label: plan.label,
            metadata: plan.manifest.metadata,
            dimensions: outputDimensions,
            buildCanvas,
            renderFrame: async ({canvas, context, frame}) => {
                if (controller?.seek) {
                    controller.seek(frame.progress)
                }
                else if (typeof replay?.progress === 'number') {
                    replay.progress = frame.progress
                }

                globalThis.lgs?.scene?.requestRender?.()
                await waitForAnimationFrame()

                const frameSource = sourceCanvas ?? defaultReplaySourceCanvas()
                if (frameSource instanceof HTMLCanvasElement) {
                    context.clearRect(0, 0, canvas.width, canvas.height)
                    context.drawImage(frameSource, 0, 0, frameSource.width, frameSource.height, 0, 0, canvas.width, canvas.height)
                }
            },
        })

        const exportFilename = filename ?? `${plan.label}.mp4`
        if (typeof download === 'function') {
            download(result.blob, exportFilename)
        }
        uiToast?.success?.({
            caption: 'Replay export',
            text:    `MP4 ready: ${exportFilename}`,
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
