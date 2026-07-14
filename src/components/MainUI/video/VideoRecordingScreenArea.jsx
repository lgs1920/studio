/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoRecorderWidget }                                  from '@Components/MainUI/video/toolbox/VideoRecorderWidget'
import { VideoSceneWidgetsPortal } from '@Components/MainUI/video/VideoSceneWidgetsPortal'
import { VideoSettingsInfo }                                    from '@Components/MainUI/video/VideoSettingsInfo'
import { CropOverlay }                                          from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }       from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import {
    APP_KEY, CROP_TOOLS_WIDGETS, LGS_PROJECT, MINUTE, SECOND, VIDEO_CROP_ZONE,
    VIDEO_TOOLS_WIDGETS, WIDGET_MOUNT_TIMEOUT, VIDEO_WIDGETS_BOARD,
} from '@Core/constants'
import { prepareReplayDeferredExportPlan, warmReplayDeferredExportPlan } from '@Core/ui/replay/ReplayDeferredExporter'
import { buildReplayVideoComposerOverlays, isReplayVideoWidgetReady } from '@Core/ui/replay/ReplayVideoOverlayComposer'
import { buildReplayVideoRenderSpec } from '@Core/ui/replay/ReplayVideoRenderSpec'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import { ScreenMediaRecorder }   from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { WidgetMountErrorDialog } from '@Components/MainUI/video/WidgetMountErrorDialog'
import { prepareVideoCaptureUi } from '@Components/MainUI/video/videoEditingCleanup'
import { UIToast }                                              from '@Utils/UIToast'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }           from 'valtio'
// Softer recorder timeslice to reduce INFO event overhead.
const SOFT_TIMESLICE_MS = SECOND * 2
const VIDEO_RECORDER_INITIALIZE_TIMEOUT_MS = 6000

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
    const {maxSize, maxDuration} = useSnapshot(lgs.settings.ui.video)
    const _cropZone = useRef(null)
    const _composer = useRef(null)
    const _pendingFinish = useRef(null)
    const _overlaysRefreshRafId = useRef(null)
    const _metricsCache = useRef(new Map())
    const _wakeLock = useRef(null)
    const _recordingStartToken = useRef(0)
    const [mountTimeoutOpen, setMountTimeoutOpen] = useState(false)
    const [mountTimeoutError] = useState({missing: [], timeoutMs: WIDGET_MOUNT_TIMEOUT})
    const [mountTimeoutAction] = useState('record')

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

    const prepareJourneyReplayForRecording = useCallback((renderSpec = null) => {
        if (!isJourneyReplaySyncRequested()) {
            return true
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

    const isWidgetReadyForRecording = useCallback((widgetId) => {
        return isReplayVideoWidgetReady(widgetId)
    }, [])

    // rAF-based refresh loop to keep overlays in sync with the recording frames.
    const startOverlaysRefresh = useCallback((composer, cropRect) => {
        stopOverlaysRefresh()
        const tick = () => {
            if (!_composer.current) {
                _overlaysRefreshRafId.current = null
                return
            }
            buildComposerOverlays(composer, cropRect)
            _overlaysRefreshRafId.current = requestAnimationFrame(tick)
        }
        _overlaysRefreshRafId.current = requestAnimationFrame(tick)
    }, [buildComposerOverlays, stopOverlaysRefresh])

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
        prepareVideoCaptureUi()
        $video.settings = {quality: $video.quality, fps: $video.fps}
        const videoFrame = await syncVideoCropFrame('before-record')
        if (!videoFrame) {
            return false
        }
        if (startToken !== _recordingStartToken.current) {
            return false
        }
        const renderSpec = buildReplayVideoRenderSpec({
            cropRect:     videoFrame.cropDimensions,
            video:        $video,
            settings:     lgs.settings.ui.video,
            device:       __.device,
            sourceCanvas: lgs.canvas,
        })
        const selectedFps = renderSpec.fps
        if (!prepareJourneyReplayForRecording(renderSpec)) {
            return false
        }
        if (isJourneyReplaySyncRequested()) {
            // Prepare the deferred master export as soon as the draft starts.
            // This only stores a compact context and warms the codec/config.
            const {exporter, plan} = prepareReplayDeferredExportPlan({
                replay: lgs.stores.replay,
                journey: lgs.theJourney,
                controller: __.ui.replay?.controller ?? null,
                fps: selectedFps,
                label: `${lgs.theJourney?.slug ?? lgs.stores.replay?.journeySlug ?? 'replay'}-master-export`,
                dimensions: renderSpec.dimensions,
                captureMode: renderSpec.captureMode,
                renderSpec,
            })
            plan.runtime.status = 'warming'
            plan.runtime.preparedAt = plan.runtime.preparedAt ?? new Date().toISOString()
            plan.runtime.warmPromise = warmReplayDeferredExportPlan({
                exporter,
                plan,
                replay: lgs.stores.replay,
                dimensions: renderSpec.dimensions,
                browser: __.device.browser,
            })
        }
        __.recorder.initialize({
                                   maxSize:    maxSize * 1048576,
                                    maxDuration: maxDuration * MINUTE,
                                    quality: ScreenMediaRecorder.QUALITY[$video.quality].value,
                                    filename:   APP_KEY,
                                    fps: selectedFps,
                                    timeslice: SOFT_TIMESLICE_MS,
                                    dimensions: renderSpec.dimensions,
                                    ratio:      videoFrame.ratio.value,
                                    captureMode: renderSpec.captureMode,
                                    metadata: {artist: lgs.servers.studio.name, date: new Date(), album: LGS_PROJECT},
                                    useWebGL:   true,
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

        if (renderSpec.captureMode === 'quality') {
            composer.setFps(0)
            __.recorder.setFrameCaptureReady(() => {
                buildComposerOverlays(composer, renderSpec.cropRect)
                return composer.renderFrame({waitForNextFrame: true})
            })
        }
        else {
            __.recorder.setFrameCaptureReady(null)
        }

        buildComposerOverlays(composer, renderSpec.cropRect)
        await composer.renderFrame({waitForNextFrame: true})
        if (startToken !== _recordingStartToken.current) {
            composer.dispose()
            return false
        }
        __.recorder.setCanvas(composer.getCanvas())
        startOverlaysRefresh(composer, renderSpec.cropRect)
        return true
    }, [maxDuration, maxSize, disposeComposer, stopOverlaysRefresh, buildComposerOverlays, startOverlaysRefresh, syncVideoCropFrame, prepareJourneyReplayForRecording, isJourneyReplaySyncRequested, $video])

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
            await __.recorder.startVideo()
            markRecordingStarted()
        }
        catch (e) {
            _recordingStartToken.current += 1
            disposeComposer()
            stopOverlaysRefresh()
            Object.assign($video, {preRecording: false, recording: false, finalizing: false, editing: true, size: 0})
            console.error('[VideoRecordingScreenArea] Video recording start failed', e)
            UIToast.error({text: e?.message ?? 'Video recording could not be started.'})
        }
    }, [$video, initializeRecorder, markRecordingStarted, disposeComposer, stopOverlaysRefresh])

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
    }, [$video, maxSize, maxDuration, buildComposerOverlays, syncVideoCropFrame])

    const waitingForAllWidgets = useCallback((widgets, onReady) => {
        if (!widgets?.length) {
            return () => {
            }
        }
        const notifyIfReady = () => {
            if (widgets.every(isWidgetReadyForRecording)) {
                onReady?.(widgets)
                return true
            }
            return false
        }
        const observer = new MutationObserver(() => {
            if (notifyIfReady()) {
                observer.disconnect()
            }
        })
        observer.observe(document.body, {childList: true, subtree: true})
        if (notifyIfReady()) {
            observer.disconnect()
        }
        return () => observer.disconnect()
    }, [isWidgetReadyForRecording])

    useEffect(() => {
        if (!$video.preRecording && !$video.snapshot) {
            return
        }
        const keys = [...__.ui.widgetCache.getAll({widgetsBoard: VIDEO_WIDGETS_BOARD}).keys()]
        if (!keys.length) {
            if ($video.preRecording) {
                void handleVideoRecording()
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
                await handleVideoRecording()
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
            window.dispatchEvent(new CustomEvent('widget-mount-timeout', {
                detail: {
                    missing,
                    action: $video.preRecording ? 'record' : 'snapshot',
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
    }, [handleVideoRecording, handlePhotoSnapshot, $video.preRecording, $video.snapshot, isWidgetReadyForRecording, waitingForAllWidgets])

    useEffect(() => {
        const hStopped = () => {
            disposeComposer()
            stopOverlaysRefresh()
            releaseWakeLock()
            updateJourneyReplayVideoCropRect(null)
        }
        const hPaused = () => {
            stopOverlaysRefresh()
            releaseWakeLock()
        }
        const hResumed = () => {
            if (_composer.current) {
                startOverlaysRefresh(_composer.current, __.ui.widgetManager.getWidgetConfig(VIDEO_CROP_ZONE)?.cropDimensions)
            }
            requestWakeLock()
        }
        const hStarted = () => {
            markRecordingStarted()
            requestWakeLock()
        }
        __.recorder.addEventListener(ScreenMediaRecorder.events.STOP, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.CANCEL, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.FINALIZE, hStopped)
        __.recorder.addEventListener(ScreenMediaRecorder.events.PAUSE, hPaused)
        __.recorder.addEventListener(ScreenMediaRecorder.events.RESUME, hResumed)
        __.recorder.addEventListener(ScreenMediaRecorder.events.START, hStarted)
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
            document.removeEventListener('visibilitychange', handleVisibility)
            updateJourneyReplayVideoCropRect(null)
        }
    }, [disposeComposer, stopOverlaysRefresh, startOverlaysRefresh, requestWakeLock, releaseWakeLock, markRecordingStarted, updateJourneyReplayVideoCropRect])

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

    return (
        <>
            <CropOverlay
                style={{clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% ${crop.top}px, ${crop.left}px ${crop.top}px, ${crop.left}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top + crop.height}px, ${crop.left + crop.width}px ${crop.top}px, 0% ${crop.top}px)`}}/>
            {(video.preRecording || video.recording) && <VideoRecorderWidget id="video-recorder-widget"/>}
            <WidgetMountErrorDialog open={mountTimeoutOpen} error={mountTimeoutError} action={mountTimeoutAction}
                                    onConfirm={() => {
                                        setMountTimeoutOpen(false)
                                        _pendingFinish.current?.()
                                    }} onCancel={() => {
                setMountTimeoutOpen(false)
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
