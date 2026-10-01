/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingScreenArea.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-09-30
 * Last modified: 2026-10-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VideoSceneWidgetsPortal } from '@Components/MainUI/video/VideoSceneWidgetsPortal'
import { VideoSettingsInfo }                                    from '@Components/MainUI/video/VideoSettingsInfo'
import { CropOverlay }                                          from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }       from '@Components/ToolsUI/cropper/widgets/DefinedCropZone'
import {
    CROP_TOOLS_WIDGETS, VIDEO_CROP_ZONE,
    VIDEO_TOOLS_WIDGETS, WIDGET_MOUNT_TIMEOUT,
} from '@Core/constants'
import {
    buildReplayVideoComposerOverlays,
    flushReplayVideoOverlayCanvases,
    isReplayVideoWidgetReady,
}                                                                  from '@Core/ui/replay/ReplayVideoOverlayComposer'
import { buildReplayVideoRenderSpec } from '@Core/ui/replay/ReplayVideoRenderSpec'
import { getReplayVideoWidgetKeys } from '@Core/ui/replay/ReplayVideoWidgetPolicy'
import {
    REPLAY_DEFERRED_EXPORT_CANCEL_EVENT,
    REPLAY_DEFERRED_EXPORT_READY_EVENT,
    stopReplayRecordingMonitor,
} from '@Core/ui/replay/ReplayRecordingMonitor'
import { exportReplayDeferredMp4 } from '@Core/ui/replay/ReplayDeferredExporter'
import { CanvasOverlayComposer } from '@Core/ui/screen-media-recorder/composer/CanvasOverlayComposer'
import {REPLAY_VIDEO_FPS, REPLAY_VIDEO_QUALITY} from '@Core/ui/replay/ReplayVideoSettings'
import { WidgetMountErrorDialog } from '@Components/MainUI/video/WidgetMountErrorDialog'
import {
    cancelVideoRecording, prepareVideoCaptureUi, restoreVideoCaptureUi,
} from '@Components/MainUI/video/videoEditingCleanup'
import { UIToast }                                              from '@Utils/UIToast'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }           from 'valtio'

export const VideoRecordingScreenArea = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const _cropZone = useRef(null)
    const _pendingFinish = useRef(null)
    const _recordingStartToken = useRef(0)
    const [mountTimeoutOpen, setMountTimeoutOpen] = useState(false)
    const [mountTimeoutError, setMountTimeoutError] = useState({missing: [], timeoutMs: WIDGET_MOUNT_TIMEOUT})
    const [mountTimeoutAction, setMountTimeoutAction] = useState('record')

    /**
     * Invalidate pending export completion updates before cancellation tears down this screen.
     * @returns {void} Nothing.
     */
    const invalidateRecording = useCallback(() => {
        _recordingStartToken.current += 1
    }, [])

    /**
     * Cancel the active browser recording and restore Replay preparation.
     * @returns {void} Nothing.
     */
    const handleCancelRecording = useCallback(() => {
        void cancelVideoRecording({invalidateRecording}).finally(stopReplayRecordingMonitor)
    }, [invalidateRecording])

    useEffect(() => {
        globalThis.window?.addEventListener(REPLAY_DEFERRED_EXPORT_CANCEL_EVENT, handleCancelRecording)
        return () => globalThis.window?.removeEventListener(REPLAY_DEFERRED_EXPORT_CANCEL_EVENT, handleCancelRecording)
    }, [handleCancelRecording])

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
        || lgs.stores.replay.simplePreparationActive === true
    ), [])

    const exportJourneyReplayFrameByFrame = useCallback(async ({renderSpec, startToken}) => {
        const abortController = new AbortController()
        const recordingDate = new Date()
        const journeyTitle = lgs.theJourney?.title?.trim() || ''
        const mediaMetadata = {
            status: 'ready',
            artist: lgs.servers.studio.name,
            date: recordingDate,
            album: 'Your Adventures',
            genre: 'Adventures Replay',
            publisher: 'LGS1920 Studio',
            encodedBy: 'Mediabunny',
            ...(journeyTitle ? {title: journeyTitle, description: journeyTitle} : {}),
        }

        Object.assign($video, {
            preRecording: false,
            exporting:  true,
            finalizing:   false,
            paused:       false,
            editing:      false,
        })

        try {
            const exportPromise = exportReplayDeferredMp4({
                replay:       lgs.stores.replay,
                journey:      lgs.theJourney,
                controller:   __.ui.replay?.controller,
                replayMode:   __.ui.replay,
                fps:          renderSpec.fps,
                dimensions:   renderSpec.dimensions,
                captureMode:  'deferred-master',
                sourceCanvas: lgs.canvas,
                renderHostMode: 'visible',
                signal:       abortController.signal,
                abortController,
                mediaMetadata,
                filename:     `${journeyTitle || lgs.theJourney?.slug || 'replay'}.mp4`,
            })
            const exportRuntime = lgs.stores.replay.deferredExportPlan?.runtime
            if (exportRuntime) {
                exportRuntime.exportPromise = exportPromise
            }
            const result = await exportPromise

            if (!(result?.blob instanceof Blob) || result.blob.size <= 0) {
                throw new Error('Replay export did not produce a video file.')
            }

            const dimensions = result.plan?.dimensions ?? renderSpec.dimensions
            const renderedFrames = Array.isArray(result.frames) ? result.frames : []
            const lastRenderedFrame = renderedFrames.at(-1)
            const recordedDurationMillis = lastRenderedFrame
                                          ? lastRenderedFrame.frameTimeMs + lastRenderedFrame.frameIntervalMs
                                          : result.plan?.videoTimeline?.durationMillis ?? 0
            globalThis.window?.dispatchEvent?.(new CustomEvent(REPLAY_DEFERRED_EXPORT_READY_EVENT, {
                detail: {
                    blob: result.blob,
                    filename: result.filename,
                    mediaData: {
                        size: result.blob.size,
                        duration: recordedDurationMillis,
                        fps: result.plan?.videoTimeline?.fps ?? renderSpec.fps,
                        averageFps: result.plan?.videoTimeline?.fps ?? renderSpec.fps,
                        dimensions,
                        quality: REPLAY_VIDEO_QUALITY[$video.quality] ?? {name: 'Replay export'},
                        ratio: {label: `${dimensions.width}×${dimensions.height}`},
                        metadata: mediaMetadata,
                        mimeType: result.blob.type || 'video/mp4',
                        extension: 'mp4',
                        frameCount: result.frameCount ?? renderedFrames.length,
                    },
                },
            }))
        }
        catch (error) {
            if (error?.name !== 'AbortError') {
                UIToast.error({
                    caption: 'Replay video',
                    text: error?.message ?? 'Replay video could not be generated.',
                })
            }
        }
        finally {
            if (startToken === _recordingStartToken.current) {
                Object.assign($video, {
                    preRecording: false,
                    exporting:  false,
                    finalizing:   false,
                    paused:       false,
                    editing:      true,
                })
                restoreVideoCaptureUi()
            }
            stopReplayRecordingMonitor()
        }
    }, [$video])

    const buildComposerOverlays = useCallback((composer, cropRect, widgetKeys) => {
        buildReplayVideoComposerOverlays({
            composer,
            cropRect,
            widgetKeys: widgetKeys ?? getReplayVideoWidgetKeys(),
            metricsCache: new Map(),
        })
    }, [])

    const flushComposerOverlays = useCallback((widgetKeys = null) => (
        flushReplayVideoOverlayCanvases({widgetKeys: widgetKeys ?? getReplayVideoWidgetKeys()})
    ), [])

    const isWidgetReadyForRecording = useCallback((widgetId) => {
        return isReplayVideoWidgetReady(widgetId)
    }, [])

    const handleStartRecording = useCallback(async () => {
        const startToken = _recordingStartToken.current + 1
        _recordingStartToken.current = startToken
        if (!isJourneyReplaySyncRequested()) {
            Object.assign($video, {preRecording: false, finalizing: false, editing: true})
            UIToast.error({caption: 'Replay video', text: 'Video export requires an active Replay preparation.'})
            return
        }

        try {
            prepareVideoCaptureUi()
            $video.settings = {quality: $video.quality, fps: $video.fps}
            const videoFrame = await syncVideoCropFrame('before-replay-export')
            if (!videoFrame || startToken !== _recordingStartToken.current) {
                return
            }

            const renderSpec = buildReplayVideoRenderSpec({
                cropRect: videoFrame.cropDimensions,
                video: $video,
                settings: lgs.settings.ui.video,
                device: __.device,
                sourceCanvas: lgs.canvas,
            })
            void exportJourneyReplayFrameByFrame({renderSpec, startToken})
        }
        catch (error) {
            if (startToken === _recordingStartToken.current) {
                Object.assign($video, {preRecording: false, exporting: false, finalizing: false, editing: true})
                restoreVideoCaptureUi()
            }
            UIToast.error({caption: 'Replay video', text: error?.message ?? 'Replay video could not be started.'})
        }
    }, [$video, exportJourneyReplayFrameByFrame, isJourneyReplaySyncRequested, syncVideoCropFrame])

    const handlePhotoSnapshot = useCallback(async () => {
        prepareVideoCaptureUi()
        const videoFrame = await syncVideoCropFrame('before-snapshot')
        if (!videoFrame) {
            Object.assign($video, {snapshot: false, finalizing: false})
            return
        }
        const selectedFps = REPLAY_VIDEO_FPS[$video.fps]
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
            await __.mediaCapture.captureScreenshot(composer.getCanvas(), {
                ratio: videoFrame.ratio,
                metadata: {
                    artist: lgs.servers.studio.name,
                    date: new Date(),
                    album: 'Your Adventures',
                },
            })
            Object.assign($video, {snapshot: false, finalizing: false})
        }
        catch (e) {
            Object.assign($video, {snapshot: false, finalizing: false})
            UIToast.error({text: e.message})
        }
        finally {
            composer?.dispose()
        }
    }, [$video, buildComposerOverlays, flushComposerOverlays, syncVideoCropFrame])

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
        const keys = getReplayVideoWidgetKeys()
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
        __.ui.widgetManager.windowResizing = false

        return () => {
            __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
            __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
            updateJourneyReplayVideoCropRect(null)
            __.ui.widgetManager.windowResizing = true
        }
    }, [updateJourneyReplayVideoCropRect])

    if (!isValidCrop) {
        return null
    }

    const synchronizedRecording = video.exporting
                                  && (lgs.stores.replay.recordingSync === true
                                      || lgs.stores.replay.simplePreparationActive === true)

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
