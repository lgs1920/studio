/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-24
 * Last modified: 2026-07-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoSceneWidgetsPortal } from '@Components/MainUI/video/VideoSceneWidgetsPortal'
import { VideoSettingsInfo }                                    from '@Components/MainUI/video/VideoSettingsInfo'
import { CropOverlay }                                          from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }       from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import {
    APP_KEY, CROP_TOOLS_WIDGETS, LGS_PROJECT, MINUTE, SECOND, VIDEO_CROP_ZONE,
    VIDEO_TOOLS_WIDGETS, WIDGET_MOUNT_TIMEOUT, VIDEO_WIDGETS_BOARD,
} from '@Core/constants'
import { prepareReplayDeferredExportPlan, warmReplayDeferredExportPlan } from '@Core/ui/replay/ReplayDeferredExporter'
import { resolveReplayTimelineDuration } from '@Core/ui/replay/ReplayProgress'
import {
    buildReplayVideoComposerOverlays,
    flushReplayVideoOverlayCanvases,
    isReplayVideoWidgetReady,
}                                                                  from '@Core/ui/replay/ReplayVideoOverlayComposer'
import { buildReplayVideoRenderSpec } from '@Core/ui/replay/ReplayVideoRenderSpec'
import { replayVideoTraceDebug } from '@Core/ui/replay/ReplayVideoTraceDebug'
import {
    publishReplayRecordingMonitorFrame,
    startReplayRecordingMonitor,
    stopReplayRecordingMonitor,
    updateReplayRecordingMonitor,
} from '@Core/ui/replay/ReplayRecordingMonitor'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import { ScreenMediaRecorder }   from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WidgetMountErrorDialog } from '@Components/MainUI/video/WidgetMountErrorDialog'
import { prepareVideoCaptureUi, restoreVideoCaptureUi } from '@Components/MainUI/video/videoEditingCleanup'
import { UIToast }                                              from '@Utils/UIToast'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }           from 'valtio'
// Softer recorder timeslice to reduce INFO event overhead.
const SOFT_TIMESLICE_MS = SECOND * 2
const VIDEO_RECORDER_INITIALIZE_TIMEOUT_MS = 6000

/**
 * Return a positive finite numeric value or null.
 *
 * @param {*} value - Candidate numeric value.
 * @returns {number|null} Positive finite value.
 */
const positiveFinite = value => {
    const numeric = Number(value)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

/**
 * Resolve the duration displayed by the Draft recording monitor.
 *
 * @param {Object} options - Draft duration candidates.
 * @param {Object} options.replay - Replay snapshot.
 * @param {*} options.maxDuration - Maximum ordinary recording duration in minutes.
 * @param {*} options.controllerDurationSeconds - Current replay controller duration.
 * @param {Object|null} options.clips - Optional replay start and stop clips.
 * @returns {number|null} Draft duration in milliseconds.
 */
const resolveDraftVideoDurationMillis = ({
    replay,
    maxDuration,
    controllerDurationSeconds,
    clips,
} = {}) => {
    const controllerReplayDurationMillis = positiveFinite(controllerDurationSeconds) === null
                                            ? null
                                            : positiveFinite(controllerDurationSeconds) * 1000
    const configuredReplayDurationMillis = positiveFinite(replay?.duration) === null
                                           ? null
                                           : positiveFinite(replay?.duration) * 1000
    const replayDurationMillis = positiveFinite(replay?.deferredExportPlan?.videoTimeline?.replayDurationMillis)
                                  ?? controllerReplayDurationMillis
                                  ?? configuredReplayDurationMillis
                                  ?? positiveFinite(replay?.durationMillis)
    const replayTimelineDurationMillis = resolveReplayTimelineDuration({
        videoTimelineDurationMillis: replay?.deferredExportPlan?.videoTimeline?.durationMillis,
        replayDurationMillis,
        clips,
    })

    return replayTimelineDurationMillis
           ?? (positiveFinite(maxDuration) ?? 0) * MINUTE * 1000
}

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

export const VideoRecordingScreenArea = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const replay = useSnapshot(lgs.stores.replay)
    const {maxSize, maxDuration} = useSnapshot(lgs.settings.ui.video)
    const draftVideoDurationMillis = resolveDraftVideoDurationMillis({
        replay,
        maxDuration,
        controllerDurationSeconds: __.ui?.replay?.controller?.duration,
        clips: replay.clips ?? lgs.settings?.ui?.replay?.clips,
    })
    const _cropZone = useRef(null)
    const _composer = useRef(null)
    const _pendingFinish = useRef(null)
    const _overlaysRefreshRafId = useRef(null)
    const _metricsCache = useRef(new Map())
    const _wakeLock = useRef(null)
    const _recordingStartToken = useRef(0)
    const [mountTimeoutOpen, setMountTimeoutOpen] = useState(false)
    const [mountTimeoutError, setMountTimeoutError] = useState({missing: [], timeoutMs: WIDGET_MOUNT_TIMEOUT})
    const [mountTimeoutAction, setMountTimeoutAction] = useState('record')

    const updateJourneyReplayVideoCropRect = useCallback((cropRect = null) => {
        const replayStore = lgs.stores?.replay
        if (!replayStore) {
            return
        }

        replayStore.videoCropRect = cropRect
            && Number.isFinite(cropRect.left)
            && Number.isFinite(cropRect.top)
            && Number.isFinite(cropRect.width)
            && Number.isFinite(cropRect.height)
            && cropRect.width > 0
            && cropRect.height > 0
            ? {...cropRect}
            : null
    }, [])

    const readCrop = useCallback(() => {
        const config = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        return config?.cropDimensions
               ? {...config.cropDimensions}
               : {left: 0, top: 0, width: 0, height: 0}
    }, [])

    const [crop, setCrop] = useState(() => readCrop())

    const syncVideoCropFrame = useCallback(async (phase = 'sync', persist = false) => {
        await __.ui.widgetManager.syncCropDimensionsFromElement(VIDEO_CROP_ZONE, persist, phase)
        const config = __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)
        if (!config?.cropDimensions) {
            updateJourneyReplayVideoCropRect(null)
            return null
        }
        updateJourneyReplayVideoCropRect(config.cropDimensions)
        return config
    }, [updateJourneyReplayVideoCropRect])

    useEffect(() => {
        const syncCrop = () => {
            const next = readCrop()
            updateJourneyReplayVideoCropRect(next)
            setCrop(current => (
                                   current.left === next.left &&
                                   current.top === next.top &&
                                   current.width === next.width &&
                                   current.height === next.height
                               ) ? current : next)
        }

        syncCrop()

        const handleCropUpdate = (event) => {
            if (!event?.detail || event.detail.id === VIDEO_CROP_ZONE) {
                syncCrop()
            }
        }

        document.addEventListener('onCropUpdate', handleCropUpdate)
        return () => document.removeEventListener('onCropUpdate', handleCropUpdate)
    }, [readCrop, updateJourneyReplayVideoCropRect])

    const isValidCrop = Number.isFinite(crop.left) && crop.width > 0

    const isJourneyReplaySyncRequested = useCallback(() => (
        lgs.stores.replay.recordingSync === true
        || lgs.settings?.ui?.replay?.recordingSync === true
    ), [])

    const prepareJourneyReplayForRecording = useCallback(async (renderSpec = null) => {
        if (!isJourneyReplaySyncRequested()) {
            // A standard video must not prepare, start, or otherwise affect Replay.
            const replayVideoSync = __.ui.replayVideoSync
            if (replayVideoSync?.isArmed?.() === true) {
                replayVideoSync.disarm?.()
            }
            return true
        }

        const cameraManager = __.ui.cameraManager
        cameraManager?.stopPanoramic?.()
        if (cameraManager?.isRotating?.()) {
            await cameraManager.stopRotate()
        }

        const replay = __.ui.replay
        const prepared = await replay?.prepareReplayCamera?.({journey: lgs.theJourney})
        if (prepared === false) {
            return false
        }

        if (typeof replay?.captureCameraState === 'function') {
            const cameraCaptureStartedAt = globalThis.performance?.now?.() ?? Date.now()
            replayVideoTraceDebug('draft.recording.replay-camera.capture.start', {
                captureMode: renderSpec?.captureMode ?? $video.captureMode ?? lgs.settings.ui.video.captureMode ?? 'speed',
                startToken:   _recordingStartToken.current,
            })
            replay.captureCameraState()
            replayVideoTraceDebug('draft.recording.replay-camera.capture.end', {
                elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - cameraCaptureStartedAt,
                startToken: _recordingStartToken.current,
            })
        }

        __.ui.replayVideoSync?.arm?.({
            recorder:          __.recorder,
            replay:            __.ui.replay,
            store:             lgs.stores.replay,
            autoStopRecording: true,
            resetToStart:      true,
            captureMode:       renderSpec?.captureMode ?? $video.captureMode ?? lgs.settings.ui.video.captureMode ?? 'speed',
            captureFps:        renderSpec?.fps ?? ScreenMediaRecorder.FPS[$video.fps],
        })
        return true
    }, [isJourneyReplaySyncRequested, $video])

    // Dispose composer and release references.
    const disposeComposer = useCallback(() => {
        _composer.current?.dispose()
        _composer.current = null
    }, [])

    // Stop live overlay refresh.
    const stopOverlaysRefresh = useCallback(() => {
        if (_overlaysRefreshRafId.current) {
            cancelAnimationFrame(_overlaysRefreshRafId.current)
            _overlaysRefreshRafId.current = null
        }
        _metricsCache.current.clear()
    }, [])

    // Rebuild overlay list with pooled objects.
    const buildComposerOverlays = useCallback((composer, cropRect, widgetKeys) => {
        buildReplayVideoComposerOverlays({
            composer,
            cropRect,
            widgetKeys,
            metricsCache: _metricsCache.current,
        })
    }, [])

    const buildFinalComposerOverlays = useCallback((composer, cropRect) => {
        buildReplayVideoComposerOverlays({
            composer,
            cropRect,
            metricsCache: _metricsCache.current,
        })
    }, [])

    const flushComposerOverlays = useCallback((widgetKeys = null) => (
        flushReplayVideoOverlayCanvases({widgetKeys})
    ), [])

    const isWidgetReadyForRecording = useCallback((widgetId) => {
        return isReplayVideoWidgetReady(widgetId)
    }, [])

    const requestWakeLock = useCallback(async () => {
        try {
            if (!('wakeLock' in navigator)) {
                return
            }
            if (_wakeLock.current) {
                return
            }
            _wakeLock.current = await navigator.wakeLock.request('screen')
            _wakeLock.current.addEventListener('release', () => {
                _wakeLock.current = null
            })
        }
        catch {
            // Wake Lock is best-effort only.
            _wakeLock.current = null
        }
    }, [])

    const releaseWakeLock = useCallback(async () => {
        try {
            await _wakeLock.current?.release?.()
        }
        catch {
            // Wake Lock may already be released.
        }
        _wakeLock.current = null
    }, [])

    const initializeRecorder = useCallback(async (startToken) => {
        const initializeStartedAt = globalThis.performance?.now?.() ?? Date.now()
        replayVideoTraceDebug('draft.recording.initialize.start', {
            captureMode: $video.captureMode ?? lgs.settings.ui.video.captureMode ?? 'speed',
            captureFps:   ScreenMediaRecorder.FPS[$video.fps] ?? null,
            syncRequested: isJourneyReplaySyncRequested(),
            startToken,
        })
        try {
            const uiPrepareStartedAt = globalThis.performance?.now?.() ?? Date.now()
            replayVideoTraceDebug('draft.recording.ui.prepare.start', {
                startToken,
            })
            prepareVideoCaptureUi()
            replayVideoTraceDebug('draft.recording.ui.prepare.end', {
                elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - uiPrepareStartedAt,
                startToken,
            })

            $video.settings = {quality: $video.quality, fps: $video.fps}

            const cropSyncStartedAt = globalThis.performance?.now?.() ?? Date.now()
            replayVideoTraceDebug('draft.recording.crop.sync.start', {
                phase: 'before-record',
                persist: false,
                startToken,
            })
            const videoFrame = await syncVideoCropFrame('before-record')
            replayVideoTraceDebug('draft.recording.crop.sync.end', {
                elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - cropSyncStartedAt,
                hasVideoFrame: Boolean(videoFrame),
                startToken,
            })
            if (!videoFrame) {
                return false
            }
            if (startToken !== _recordingStartToken.current) {
                return false
            }

            const renderSpec = buildReplayVideoRenderSpec({
                cropRect: videoFrame.cropDimensions,
                video: $video,
                settings: lgs.settings.ui.video,
                device: __.device,
                sourceCanvas: lgs.canvas,
            })
            const selectedFps = renderSpec.fps
            if (isJourneyReplaySyncRequested()) {
                const replayBridgeStartedAt = globalThis.performance?.now?.() ?? Date.now()
                replayVideoTraceDebug('draft.recording.replay-bridge.start', {
                    captureMode: renderSpec.captureMode,
                    captureFps: selectedFps,
                    startToken,
                })
                if (!await prepareJourneyReplayForRecording(renderSpec)) {
                    return false
                }
                replayVideoTraceDebug('draft.recording.replay-bridge.end', {
                    elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - replayBridgeStartedAt,
                    startToken,
                    syncRequested: true,
                })

                const sceneRestoreStartedAt = globalThis.performance?.now?.() ?? Date.now()
                replayVideoTraceDebug('draft.recording.scene-restore.wait.start', {
                    timeoutMs: VIDEO_RECORDER_INITIALIZE_TIMEOUT_MS,
                    startToken,
                })
                await withTimeout(
                    Promise.resolve(__.ui.replay?.waitForSceneRestore?.()),
                    VIDEO_RECORDER_INITIALIZE_TIMEOUT_MS,
                    'Replay scene restoration timed out before video recording.',
                )
                replayVideoTraceDebug('draft.recording.scene-restore.wait.end', {
                    elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - sceneRestoreStartedAt,
                    startToken,
                })
            }
            if (startToken !== _recordingStartToken.current) {
                return false
            }

            const recordingDate = new Date()
            const recordingDateLabel = recordingDate.toLocaleDateString('sv-SE')
            const journeyTitle = lgs.theJourney?.title?.trim() || ''
            const journeyDate = lgs.theJourney?.getDate?.()
            const formattedJourneyDate = __.ui?.ui?.formatJourneyDurationDates?.(journeyDate) ?? {}
            const journeyDateTime = [formattedJourneyDate.prefix, formattedJourneyDate.sufix]
                .filter(Boolean)
                .join(' ')
            const journeyLocation = lgs.theJourney?.location?.trim() || ''
            const recordingComment = [journeyTitle, journeyDateTime, journeyLocation]
                .filter(Boolean)
                .concat('', `Recorded on ${recordingDateLabel}`)
                .join('\n')
            const recordingMetadata = {
                status: 'draft',
                artist: lgs.servers.studio.name,
                date: recordingDate,
                album: 'Your Adventures',
                genre: 'Adventures Replay',
                publisher: 'LGS1920 Studio',
                encodedBy: 'Mediabunny',
                comment: recordingComment,
                raw: {
                    '©pub': 'LGS1920 Studio',
                    '©too': 'Mediabunny',
                },
                ...(journeyTitle ? {title: `${journeyTitle} (draft version)`} : {}),
                ...(lgs.theJourney?.title ? {description: lgs.theJourney.title} : {}),
            }
            if (isJourneyReplaySyncRequested()) {
                // Prepare the deferred master export as soon as the draft starts.
                // This only stores a compact context and warms the codec/config.
                const deferredExportPrepareStartedAt = globalThis.performance?.now?.() ?? Date.now()
                replayVideoTraceDebug('draft.recording.deferred-export.plan.start', {
                    captureMode: renderSpec.captureMode,
                    dimensions: renderSpec.dimensions,
                    startToken,
                })
                const {exporter, plan} = prepareReplayDeferredExportPlan({
                    replay: lgs.stores.replay,
                    journey: lgs.theJourney,
                    controller: __.ui.replay?.controller ?? null,
                    fps: selectedFps,
                    label: `${lgs.theJourney?.slug ?? lgs.stores.replay?.journeySlug ?? 'replay'}-master-export`,
                    dimensions: renderSpec.dimensions,
                    captureMode: renderSpec.captureMode,
                    renderSpec,
                    mediaMetadata: recordingMetadata,
                })
                replayVideoTraceDebug('draft.recording.deferred-export.plan.end', {
                    elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - deferredExportPrepareStartedAt,
                    hasExporter: Boolean(exporter),
                    hasPlan: Boolean(plan),
                    startToken,
                })
                plan.runtime.status = 'warming'
                plan.runtime.preparedAt = plan.runtime.preparedAt ?? new Date().toISOString()
                const deferredExportWarmStartedAt = globalThis.performance?.now?.() ?? Date.now()
                replayVideoTraceDebug('draft.recording.deferred-export.warm.start', {
                    captureMode: renderSpec.captureMode,
                    dimensions: renderSpec.dimensions,
                    startToken,
                })
                plan.runtime.warmPromise = warmReplayDeferredExportPlan({
                    exporter,
                    plan,
                    replay: lgs.stores.replay,
                    dimensions: renderSpec.dimensions,
                    browser: __.device.browser,
                }).then(result => {
                    replayVideoTraceDebug('draft.recording.deferred-export.warm.end', {
                        elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - deferredExportWarmStartedAt,
                        hasOutputConfig: Boolean(result?.outputConfig),
                        runtimeStatus: result?.plan?.runtime?.status ?? null,
                        startToken,
                    })
                    return result
                }).catch(error => {
                    replayVideoTraceDebug('draft.recording.deferred-export.warm.error', {
                        elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - deferredExportWarmStartedAt,
                        message: error?.message ?? null,
                        name: error?.name ?? null,
                        startToken,
                    })
                    throw error
                })
            }

            __.recorder.initialize({
                maxSize: maxSize * 1048576,
                maxDuration: maxDuration * MINUTE,
                quality: ScreenMediaRecorder.QUALITY[$video.quality].value,
                filename: APP_KEY,
                fps: selectedFps,
                timeslice: SOFT_TIMESLICE_MS,
                dimensions: renderSpec.dimensions,
                ratio: videoFrame.ratio.value,
                captureMode: renderSpec.captureMode,
                metadata: recordingMetadata,
                useWebGL: true,
            })

            const {width, height} = renderSpec.cropRect
            disposeComposer()
            stopOverlaysRefresh()
            const composer = new CanvasOverlayComposer(lgs.canvas, {
                clip: renderSpec.composerClip,
                width,
                height,
                fps: selectedFps,
                outputDpr: renderSpec.outputDpr,
                flushWebGLBuffer: () => lgs.scene.render(),
            })
            _composer.current = composer

            startReplayRecordingMonitor({
                mode: 'draft',
                videoDurationMillis: draftVideoDurationMillis,
            })

            if (renderSpec.captureMode === 'quality') {
                composer.setFps(0)
            }

            // The final recorder frame must be composed from the current Cesium
            // canvas. This is required for Draft as well as HQ: without the
            // callback, Draft can submit the previous compositor frame even when
            // the replay trace is still visible on the source canvas.
            __.recorder.setFrameCaptureReady(async () => {
                return flushComposerOverlays().then(async () => {
                    buildFinalComposerOverlays(composer, renderSpec.cropRect, renderSpec.outputDpr)
                    // The replay runtime has already rendered the final Cesium frame.
                    // Waiting for another rAF makes Draft duration depend on browser
                    // throttling when the replay UI is hidden.
                    await composer.renderFrame({waitForNextFrame: false})
                    publishReplayRecordingMonitorFrame({
                        canvas: composer.getCanvas(),
                        mode: 'draft',
                        phase: 'recording',
                        progress: lgs.stores.replay?.progress,
                    })
                    return true
                })
            })

            await flushComposerOverlays()
            buildComposerOverlays(composer, renderSpec.cropRect)
            const firstComposerFrameStartedAt = globalThis.performance?.now?.() ?? Date.now()
            await composer.renderFrame({waitForNextFrame: true})
            publishReplayRecordingMonitorFrame({
                canvas: composer.getCanvas(),
                mode: 'draft',
                phase: 'recording',
                progress: lgs.stores.replay?.progress,
            })
            replayVideoTraceDebug('draft.recording.composer.first-frame.end', {
                elapsedMs: (globalThis.performance?.now?.() ?? Date.now()) - firstComposerFrameStartedAt,
                startToken,
            })
            if (startToken !== _recordingStartToken.current) {
                composer.dispose()
                return false
            }
            __.recorder.setCanvas(composer.getCanvas())
            composer.setContinuousRendering?.(false)
            return true
        }
        finally {
            const elapsedMs = (globalThis.performance?.now?.() ?? Date.now()) - initializeStartedAt
            replayVideoTraceDebug('draft.recording.initialize.end', {
                elapsedMs,
                startToken,
                syncRequested: isJourneyReplaySyncRequested(),
            })
        }
    }, [draftVideoDurationMillis, maxDuration, maxSize, disposeComposer, stopOverlaysRefresh, buildComposerOverlays, buildFinalComposerOverlays, flushComposerOverlays, syncVideoCropFrame, prepareJourneyReplayForRecording, isJourneyReplaySyncRequested, $video])

    const markRecordingStarted = useCallback(() => {
        if (!$video.preRecording && $video.recording) {
            return
        }
        Object.assign($video, {
            preRecording: false,
            recording:    true,
            finalizing:   false,
            paused:       false,
            size:         0,
        })
        UIToast.warning({caption: 'Video Recording', text: 'ON AIR!'})
    }, [$video])

    const handleVideoRecording = useCallback(async () => {
        const startToken = _recordingStartToken.current + 1
        _recordingStartToken.current = startToken
        try {
            const ready = await withTimeout(
                initializeRecorder(startToken),
                VIDEO_RECORDER_INITIALIZE_TIMEOUT_MS,
                'Video recording initialization timed out on this browser.',
            )
            if (!ready) {
                Object.assign($video, {
                    preRecording: false,
                    recording:    false,
                    finalizing:   false,
                    editing:      true,
                    size:         0,
                })
                return
            }

            if (startToken !== _recordingStartToken.current) {
                return
            }

            const recorderStartStartedAt = globalThis.performance?.now?.() ?? Date.now()
            replayVideoTraceDebug('draft.recorder.start.begin', {
                startToken,
            })
            await __.recorder.startVideo()
            const recorderStartElapsedMs = (globalThis.performance?.now?.() ?? Date.now()) - recorderStartStartedAt
            replayVideoTraceDebug('draft.recorder.start.end', {
                elapsedMs: recorderStartElapsedMs,
                startToken,
            })

            markRecordingStarted()
        }
        catch (e) {
            _recordingStartToken.current += 1
            disposeComposer()
            stopOverlaysRefresh()
            stopReplayRecordingMonitor()
            Object.assign($video, {preRecording: false, recording: false, finalizing: false, editing: true, size: 0})
            UIToast.error({text: e?.message ?? 'Video recording could not be started.'})
        }
    }, [$video, initializeRecorder, markRecordingStarted, disposeComposer, stopOverlaysRefresh])

    const handleStartRecording = useCallback(async () => {
        await handleVideoRecording()
    }, [handleVideoRecording])

    const handlePhotoSnapshot = useCallback(async () => {
        prepareVideoCaptureUi()
        const videoFrame = await syncVideoCropFrame('before-snapshot')
        if (!videoFrame) {
            Object.assign($video, {snapshot: false, finalizing: false})
            return
        }
        const selectedFps = ScreenMediaRecorder.FPS[$video.fps]
        const {top: y, left: x, width, height} = videoFrame.cropDimensions
        let composer = null

        try {
            composer = new CanvasOverlayComposer(lgs.canvas, {
                clip:             {x, y, width, height}, width, height,
                fps: selectedFps,
                flushWebGLBuffer: () => lgs.scene.render(),
            })
            await flushComposerOverlays()
            buildComposerOverlays(composer, videoFrame.cropDimensions)
            await composer.renderFrame({waitForNextFrame: true})
            __.recorder.initialize({
                                       maxSize:     maxSize * 1048576,
                                       maxDuration: maxDuration * MINUTE,
                                       quality:     ScreenMediaRecorder.QUALITY[$video.quality].value,
                                       filename:    APP_KEY,
                                       fps: selectedFps,
                                       timeslice:   SOFT_TIMESLICE_MS,
                                       ratio:       videoFrame.ratio.value,
                                       metadata:    {
                                           artist: lgs.servers.studio.name,
                                           date:   new Date(),
                                           album:  LGS_PROJECT,
                                       },
                                   })
            await __.recorder.captureScreenshot(composer.getCanvas())
            Object.assign($video, {snapshot: false, finalizing: false})
        }
        catch (e) {
            Object.assign($video, {snapshot: false, finalizing: false})
            UIToast.error({text: e.message})
        }
        finally {
            composer?.dispose()
        }
    }, [$video, maxSize, maxDuration, buildComposerOverlays, flushComposerOverlays, syncVideoCropFrame])

    const waitingForAllWidgets = useCallback((widgets, onReady) => {
        if (!widgets?.length) {
            return () => {
            }
        }
        let timeoutId = null
        let stopped = false
        let attempts = 0
        const MAX_READY_CHECKS = 60
        const notifyIfReady = () => {
            if (stopped) {
                return true
            }
            if (widgets.every(isWidgetReadyForRecording)) {
                onReady?.(widgets)
                return true
            }
            return false
        }
        const observer = new MutationObserver(() => {
            if (notifyIfReady()) {
                observer.disconnect()
                clearTimeout(timeoutId)
            }
        })
        const checkLater = () => {
            if (stopped || attempts >= MAX_READY_CHECKS || notifyIfReady()) {
                observer.disconnect()
                return
            }
            attempts += 1
            timeoutId = setTimeout(checkLater, 100)
        }

        observer.observe(document.body, {childList: true, subtree: true})
        if (!notifyIfReady()) {
            timeoutId = setTimeout(checkLater, 100)
        }

        return () => {
            stopped = true
            observer.disconnect()
            clearTimeout(timeoutId)
        }
    }, [isWidgetReadyForRecording])

    useEffect(() => {
        if (!$video.preRecording && !$video.snapshot) {
            return
        }
        const keys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()]
        if (!keys.length) {
            if ($video.preRecording) {
                void handleStartRecording()
            }
            else if ($video.snapshot) {
                void handlePhotoSnapshot()
            }
            return
        }
        let done = false
        const finish = async () => {
            if (done) {
                return
            }
            done = true
            if ($video.preRecording) {
                void handleStartRecording()
            }
            else if ($video.snapshot) {
                await handlePhotoSnapshot()
            }
        }
        const cleanup = waitingForAllWidgets(keys, finish)
        const tid = setTimeout(() => {
            if (done) {
                return
            }
            const missing = keys.filter(k => !isWidgetReadyForRecording(k))
            _pendingFinish.current = finish
            const action = $video.preRecording ? 'record' : 'snapshot'
            setMountTimeoutError({missing, timeoutMs: WIDGET_MOUNT_TIMEOUT})
            setMountTimeoutAction(action)
            setMountTimeoutOpen(true)
            window.dispatchEvent(new CustomEvent('widget-mount-timeout', {
                detail: {
                    missing,
                    action,
                },
            }))
        }, WIDGET_MOUNT_TIMEOUT)

        return () => {
            cleanup?.()
            clearTimeout(tid)
            if (_pendingFinish.current === finish) {
                _pendingFinish.current = null
            }
        }
    }, [handleStartRecording, handlePhotoSnapshot, $video.preRecording, $video.snapshot, isWidgetReadyForRecording, waitingForAllWidgets])

    useEffect(() => {
        const hStopped = event => {
            disposeComposer()
            stopOverlaysRefresh()
            releaseWakeLock()
            stopReplayRecordingMonitor()
            updateJourneyReplayVideoCropRect(null)
            const stopState = {
                preRecording: false,
                recording:    false,
                paused:       false,
                size:         0,
            }
            if (event?.type === ScreenMediaRecorder.events.CANCEL) {
                restoreVideoCaptureUi()
                Object.assign(stopState, {
                    editing:   true,
                    finalizing: false,
                })
            }
            Object.assign($video, stopState)
        }
        const hPaused = () => {
            stopOverlaysRefresh()
            releaseWakeLock()
            updateReplayRecordingMonitor({paused: true})
        }
        const hResumed = () => {
            requestWakeLock()
            updateReplayRecordingMonitor({paused: false})
        }
        const hStarted = () => {
            markRecordingStarted()
            requestWakeLock()
            updateReplayRecordingMonitor({mode: 'draft', phase: 'recording'})
        }
        __.recorder.addEventListener(ScreenMediaRecorder.events.STOP, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.CANCEL, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.FINALIZE, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.PAUSE, hPaused)
        __.recorder.addEventListener(ScreenMediaRecorder.events.RESUME, hResumed)
        __.recorder.addEventListener(ScreenMediaRecorder.events.START, hStarted)
        const hInfo = event => {
            updateReplayRecordingMonitor({
                mode: 'draft',
                phase: 'recording',
                elapsedMillis: event.detail?.duration,
                size: event.detail?.size,
                paused: event.detail?.isPaused,
            })
        }
        __.recorder.addEventListener(ScreenMediaRecorder.events.INFO, hInfo)
        const handleVisibility = () => {
            if (document.visibilityState === 'visible' && __.recorder.isRecording?.()) {
                requestWakeLock()
            }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        return () => {
            __.recorder.removeEventListener(ScreenMediaRecorder.events.STOP, hStopped)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.CANCEL, hStopped)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.FINALIZE, hStopped)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.PAUSE, hPaused)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.RESUME, hResumed)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.START, hStarted)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.INFO, hInfo)
            document.removeEventListener('visibilitychange', handleVisibility)
            updateJourneyReplayVideoCropRect(null)
        }
    }, [disposeComposer, stopOverlaysRefresh, requestWakeLock, releaseWakeLock, markRecordingStarted, updateJourneyReplayVideoCropRect, restoreVideoCaptureUi, $video])

    useEffect(() => {
        __.ui.widgetManager.windowResizing = false

        const metricsCache = _metricsCache.current
        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
            disposeComposer()
            stopOverlaysRefresh()
            releaseWakeLock()
            __.ui.widgetManager.windowResizing = true
            metricsCache.clear()
        }
    }, [disposeComposer, stopOverlaysRefresh, releaseWakeLock])

    if (!isValidCrop) {
        return null
    }

    const synchronizedRecording = video.recording
                                  && lgs.stores.replay.recordingSync === true

    return (
        <>
            <CropOverlay
                crop={crop}
                blockOutsideCrop={synchronizedRecording}
                style={{clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${crop.top}px, ${crop.left}px ${crop.top}px, ${crop.left}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top}px, 0% ${crop.top}px)`}}/>
            <WidgetMountErrorDialog open={mountTimeoutOpen} error={mountTimeoutError} action={mountTimeoutAction}
                                    onConfirm={() => {
                                        setMountTimeoutOpen(false)
                                        const finish = _pendingFinish.current
                                        _pendingFinish.current = null
                                        finish?.()
                                    }} onCancel={() => {
                setMountTimeoutOpen(false)
                _pendingFinish.current = null
                void __.recorder?.cancelVideo?.()
                $video.preRecording = false
                $video.finalizing = false
                $video.editing = true
            }}/>
            <DefinedCropZone className="lgs-on-map-theme-vars" context={$video.cropper} infoComponent={<VideoSettingsInfo/>} ref={_cropZone}/>
            <VideoSceneWidgetsPortal context={lgs.stores.ui.video.cropper}/>
        </>
    )
})

VideoRecordingScreenArea.displayName = 'VideoRecordingScreenArea'
