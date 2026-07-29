/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-25
 * Last modified: 2026-07-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * @file VideoDownloadAndShareDialog.jsx
 * @description Optimized component for previewing and downloading recorded videos.
 * Keeps preview state render-safe while using recorder data with fallbacks.
 * Uses Web Awesome components and icons.
 * All refs prefixed with _, no default export, no semicolons.
 */
import { RecordingInfo } from '@Components/MainUI/video/RecordingInfo'
import { LGSPopup }      from '@Components/LGSPopup'
import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import { exportReplayDeferredMp4 } from '@Core/ui/replay/ReplayDeferredExporter'
import { buildReplayVideoRenderSpec } from '@Core/ui/replay/ReplayVideoRenderSpec'
import { cancelVideoEditing, prepareVideoCaptureUi } from '@Components/MainUI/video/videoEditingCleanup'
import { VIDEO_CROP_ZONE } from '@Core/constants'
import {
    WaButton, WaButtonGroup, WaDialog, WaDropdown, WaDropdownItem, WaIcon, WaInput, WaTooltip,
}                        from '@web.awesome.me/webawesome-pro/dist/react'
import {
    UIToast,
}                      from '@Utils/UIToast'
import { useCallback, useEffect, useRef, useState } from 'react'
import './style.css'

const VIDEO_DRAFT_SUFFIX = '-draft'
const DEFAULT_VIDEO_FILENAME = 'video'
const DEFAULT_IMAGE_FILENAME = 'record'

const sanitizeFilenameStem = (value, fallback = DEFAULT_VIDEO_FILENAME) => {
    const sanitized = `${value ?? ''}`.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim()
    return sanitized || fallback
}

const stripVideoDraftSuffix = (value, fallback = DEFAULT_VIDEO_FILENAME) => {
    let stem = sanitizeFilenameStem(value, fallback)
    while (stem.toLowerCase().endsWith(VIDEO_DRAFT_SUFFIX)) {
        stem = stem.slice(0, -VIDEO_DRAFT_SUFFIX.length).trim()
    }
    return stem || fallback
}

const withVideoDraftSuffix = (value, fallback = DEFAULT_VIDEO_FILENAME) => {
    const stem = stripVideoDraftSuffix(value, fallback)
    return `${stem}${VIDEO_DRAFT_SUFFIX}`
}

/**
 * Stop replay playback and wait until its camera and scene focus restoration has settled.
 *
 * @returns {Promise<void>} Promise resolved after the final view is ready to reveal
 */
const preFocusVideoReplayScene = async () => {
    globalThis.__?.ui?.replayVideoSync?.stopJourneyReplay?.({deferSceneRestore: false})
    await Promise.resolve(globalThis.__?.ui?.replay?.restorePlaybackScene?.({force: true}))
}

/**
 * Release transient replay state after the final camera view is ready.
 */
const clearVideoReplayRuntimeState = () => {
    const replayStore = globalThis.lgs?.stores?.replay
    if (!replayStore) {
        return
    }

    replayStore.dynamicFrameState = null
    replayStore.replayFramePhase = null
    if (replayStore.deferredExportPlan?.runtime) {
        replayStore.deferredExportPlan.runtime.frameState = null
    }
}

const resolveHqExportRenderSpec = async () => {
    const replayStore = globalThis.lgs?.stores?.replay ?? null
    const existingPlan = replayStore?.deferredExportPlan ?? null
    const widgetManager = globalThis.__?.ui?.widgetManager ?? null

    try {
        await widgetManager?.syncCropDimensionsFromElement?.(VIDEO_CROP_ZONE, false, 'before-hq-export')
    }
    catch {
        // The cached replay crop remains usable when the cropper is not mounted.
    }

    const cropRect = widgetManager?.getWidgetConfig?.(VIDEO_CROP_ZONE)?.cropDimensions
                     ?? replayStore?.videoCropRect
                     ?? existingPlan?.renderSpec?.cropRect
                     ?? null
    const sourceCanvas = globalThis.lgs?.canvas ?? null

    if (!cropRect && !sourceCanvas) {
        return null
    }

    const renderSpec = buildReplayVideoRenderSpec({
        cropRect,
        video:        globalThis.lgs?.stores?.ui?.video ?? null,
        settings:     globalThis.lgs?.settings?.ui?.video ?? null,
        device:       globalThis.__?.device ?? null,
        sourceCanvas,
        fps:          existingPlan?.renderSpec?.fps ?? null,
        qualityIndex: existingPlan?.renderSpec?.qualityIndex ?? null,
        captureMode:  existingPlan?.renderSpec?.captureMode ?? existingPlan?.captureMode ?? null,
    })

    if (replayStore && renderSpec.cropRect) {
        replayStore.videoCropRect = {...renderSpec.cropRect}
    }

    return renderSpec
}

const normalizeExtension = (value, fallback = 'mp4') => {
    const extension = `${value ?? ''}`.replace(/^\.+/, '').replace(/[^a-zA-Z0-9]/g, '')
    return extension || fallback
}

const buildMediaFilename = (stem, extension, fallback = DEFAULT_VIDEO_FILENAME) => (
    `${sanitizeFilenameStem(stem, fallback)}.${normalizeExtension(extension)}`
)

export const VideoDownloadAndShareDialog = () => {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [filename, setFilename] = useState('')
    const [canDownloadAndShare, setCanDownloadAndShare] = useState(false)
    const [isRecordingInfoOpen, setIsRecordingInfoOpen] = useState(false)
    const [mediaUrl, setMediaUrl] = useState(null)
    const [hqMedia, setHqMedia] = useState(null)
    const [hqExportStatus, setHqExportStatus] = useState('idle')
    const _mainVideo = useRef(null)
    const _blurredVideo = useRef(null)
    const _recordingInfoButton = useRef(null)
    const _recordingInfoPopup = useRef(null)
    const _mediaBlob = useRef({blob: null, url: null, filename: ''})
    const _hqMediaUrl = useRef(null)
    const _hqExportAbortController = useRef(null)
    const _dialogHiddenForHqExport = useRef(false)
    const _suppressNextDialogHideCleanup = useRef(false)
    const _shareInFlight = useRef(false)
    const _dialogCleanupDone = useRef(true)
    const _replayScenePreFocused = useRef(false)
    const releaseMediaUrl = useCallback(() => {
        const url = _mediaBlob.current.url
        if (url) {
            _mediaBlob.current.url = null
            URL.revokeObjectURL(url)
        }
    }, [])
    const releaseHqMediaUrl = useCallback(() => {
        const url = _hqMediaUrl.current
        if (url) {
            _hqMediaUrl.current = null
            URL.revokeObjectURL(url)
        }
    }, [])
    const getVideoExtension = useCallback(() => __.recorder.mediaData?.extension || lgs.settings.ui.video.format, [])
    const getVideoMimeType = useCallback(() => __.recorder.mediaData?.mimeType || 'video/mp4', [])
    const getRecorderFilenameStem = useCallback((fallback = DEFAULT_VIDEO_FILENAME) => (
        sanitizeFilenameStem(__.recorder.filename?.({}) || fallback, fallback)
    ), [])
    const getDraftFilenameStem = useCallback(() => (
        withVideoDraftSuffix(_mediaBlob.current.filename || getRecorderFilenameStem(), DEFAULT_VIDEO_FILENAME)
    ), [getRecorderFilenameStem])
    const getHqFilenameStem = useCallback(() => (
        stripVideoDraftSuffix(_mediaBlob.current.filename || getRecorderFilenameStem(), DEFAULT_VIDEO_FILENAME)
    ), [getRecorderFilenameStem])
    const getHqExportFilename = useCallback(() => buildMediaFilename(getHqFilenameStem(), 'mp4'), [getHqFilenameStem])
    const hasHqMedia = Boolean(hqMedia?.blob instanceof Blob)
    const isHqExporting = hqExportStatus === 'exporting'
    const isReplayVideoLinked = lgs.stores?.replay
                                  ? lgs.stores.replay.recordingSync !== false
                                  : false

    /**
     * Prepare the final replay camera view before showing the media dialog.
     *
     * @param {object} [options] - Preparation options
     * @param {boolean} [options.force=false] - Repeat preparation when a previous attempt completed
     * @returns {Promise<void>} Promise resolved when the final view has settled
     */
    const prepareReplaySceneForDialog = useCallback(async ({force = false} = {}) => {
        if (!force && _replayScenePreFocused.current) {
            return
        }

        try {
            await preFocusVideoReplayScene()
            _replayScenePreFocused.current = true
        }
        catch (error) {
            console.error('Unable to pre-focus the replay scene:', error)
        }
    }, [])

    const downloadBlobFile = useCallback((blob, downloadFilename) => {
        if (!(blob instanceof Blob) || !downloadFilename) {
            return
        }

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = downloadFilename
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 100)
    }, [])

    const waitForAnimationFrame = useCallback(() => new Promise(resolve => {
        const raf = globalThis.requestAnimationFrame
                    ?? globalThis.window?.requestAnimationFrame?.bind(globalThis.window)
                    ?? (callback => setTimeout(callback, 0))
        raf(() => raf(() => resolve()))
    }), [])

    /**
     * Safely accesses media data from recorder with fallback.
     * @returns {Object} Media stats with default values
     */
    const getMediaData = useCallback(() => {
        const fallback = {
            size:       0,
            duration:   0,
            fps:        0,
            averageFps: 0,
            dimensions: {width: 0, height: 0},
            quality:    {name: 'Unknown'},
            ratio:      {label: 'Unknown'},
        }

        try {
            if (__.recorder.isVideo() && hqMedia?.mediaData) {
                return hqMedia.mediaData
            }

            const data = __.recorder?.mediaData
            if (!data || typeof data !== 'object') {
                return fallback
            }
            if (__.recorder.isVideo()) {
                return {
                    size:       Number(data.size) || 0,
                    duration:   Number(data.duration) || 0,
                    fps:        Number(data.fps) || 0,
                    averageFps: Number(data.averageFps) || 0,
                    dimensions: {
                        width:  Number(data.dimensions?.width) || 0,
                        height: Number(data.dimensions?.height) || 0,
                    },
                    quality:    data.quality || {name: 'Unknown'},
                    ratio:      data.ratio || {label: 'Unknown'},
                }
            }
            else {
                return {
                    ratio:      data.ratio || {label: 'Unknown'},
                    size:       Number(data.size) || 0,
                    dimensions: {
                        width:  Number(data.dimensions?.width) || 0,
                        height: Number(data.dimensions?.height) || 0,
                    },
                    metadata:   data.metadata || {},
                }
            }

        }
        catch {
            return fallback
        }
    }, [hqMedia])

    /**
     * Initialize stop recording handler with blob validation.
     */
    useEffect(() => {

        const handleStopRecording = async (event) => {
            const blob = event.detail?.blob
            if (!(blob instanceof Blob) || blob.size === 0) {
                console.error('Invalid video blob received')
                return
            }

            releaseMediaUrl()
            const url = URL.createObjectURL(blob)
            const safeFilename = withVideoDraftSuffix(getRecorderFilenameStem(), DEFAULT_VIDEO_FILENAME)

            _mediaBlob.current = {
                blob,
                url,
                filename: safeFilename,
                type:     ScreenMediaRecorder.VIDEO,
            }
            _dialogCleanupDone.current = false
            setMediaUrl(url)
            setFilename(safeFilename)
            setCanDownloadAndShare(true)
            await prepareReplaySceneForDialog()
            setDialogOpen(true)
        }

        const handleCapture = (event) => {
            try {
                const imageBlob = event.detail?.blob
                if (!(imageBlob instanceof Blob) || imageBlob.size === 0) {
                    throw new Error('Invalid screenshot blob received')
                }

                releaseMediaUrl()
                const imageUrl = URL.createObjectURL(imageBlob)
                const safeFilename = sanitizeFilenameStem(getRecorderFilenameStem(DEFAULT_IMAGE_FILENAME), DEFAULT_IMAGE_FILENAME)
                _mediaBlob.current = {
                    blob:     imageBlob,
                    url:      imageUrl,
                    filename: safeFilename,
                    type:     ScreenMediaRecorder.IMAGE,
                }
                _dialogCleanupDone.current = false
                setMediaUrl(imageUrl)
                setFilename(safeFilename)
                setCanDownloadAndShare(true)
                setDialogOpen(true)
            }
            catch (error) {
                console.error('Invalid screenshot blob received', error)
                UIToast.error({caption: 'Screenshot', text: 'Unable to finalize screenshot.'})
            }
            finally {
                lgs.stores.ui.video.snapshot = false
                lgs.stores.ui.video.finalizing = false
            }
        }


        __.recorder.addEventListener(ScreenMediaRecorder.events.STOP, handleStopRecording)
        __.recorder.addEventListener(ScreenMediaRecorder.events.CAPTURED, handleCapture)

        return () => {
            __.recorder.removeEventListener(ScreenMediaRecorder.events.STOP, handleStopRecording)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.CAPTURED, handleCapture)
            releaseMediaUrl()
            void __.recorder?.releaseMedia?.()
        }
    }, [getRecorderFilenameStem, prepareReplaySceneForDialog, releaseMediaUrl])

    /**
     * Sync blurred video with main video playback.
     */
    useEffect(() => {
        if (!dialogOpen || !_mainVideo.current || !_blurredVideo.current) {
            return
        }

        const mainVideo = _mainVideo.current
        const blurredVideo = _blurredVideo.current

        const syncTime = () => {
            try {
                if (Math.abs(blurredVideo.currentTime - mainVideo.currentTime) > 0.05) {
                    blurredVideo.currentTime = mainVideo.currentTime
                }
            }
            catch {
                // Ignore sync errors during seek
            }
        }

        const handlePlay = () => blurredVideo.play().catch(() => {
        })
        const handlePause = () => blurredVideo.pause()
        const handleRateChange = () => {
            blurredVideo.playbackRate = mainVideo.playbackRate
        }
        const handleLoadedMeta = () => {
            blurredVideo.muted = true
            blurredVideo.playbackRate = mainVideo.playbackRate
            syncTime()
        }

        mainVideo.addEventListener('play', handlePlay)
        mainVideo.addEventListener('pause', handlePause)
        mainVideo.addEventListener('timeupdate', syncTime)
        mainVideo.addEventListener('ratechange', handleRateChange)
        mainVideo.addEventListener('loadedmetadata', handleLoadedMeta)
        mainVideo.addEventListener('seeking', syncTime)

        return () => {
            mainVideo.removeEventListener('play', handlePlay)
            mainVideo.removeEventListener('pause', handlePause)
            mainVideo.removeEventListener('timeupdate', syncTime)
            mainVideo.removeEventListener('ratechange', handleRateChange)
            mainVideo.removeEventListener('loadedmetadata', handleLoadedMeta)
            mainVideo.removeEventListener('seeking', syncTime)
        }
    }, [dialogOpen])

    useEffect(() => {
        if (!isRecordingInfoOpen) {
            return
        }

        const handlePointerDown = (event) => {
            const path = event.composedPath()
            if (!_recordingInfoButton.current || !_recordingInfoPopup.current) {
                return
            }

            if (!path.includes(_recordingInfoButton.current) && !path.includes(_recordingInfoPopup.current)) {
                setIsRecordingInfoOpen(false)
            }
        }

        document.addEventListener('pointerdown', handlePointerDown, true)
        return () => document.removeEventListener('pointerdown', handlePointerDown, true)
    }, [isRecordingInfoOpen])

    /**
     * Handle filename input with sanitization.
     */
    const handleFilenameChange = useCallback((event) => {
        const value = event.target?.value || ''
        const sanitized = value.replace(/[^a-zA-Z0-9_\-\s]/g, '')
        _mediaBlob.current.filename = sanitized
        releaseHqMediaUrl()
        setHqMedia(null)
        setHqExportStatus('idle')
        const canProceed = sanitized.length > 0
        setCanDownloadAndShare(canProceed)
        setFilename(sanitized)
    }, [releaseHqMediaUrl])

    /**
     * Resolve the media blob the dialog should expose.
     *
     * The final dialog prefers the replay HQ export when the replay pipeline
     * prepared a deferred master plan. Otherwise it falls back to the recorder
     * blob produced by the live draft.
     */
    const resolveSmartVideoBlob = useCallback(async (target = 'auto') => {
        if (!__.recorder.isVideo()) {
            return {
                blob:      _mediaBlob.current.blob,
                filename:   sanitizeFilenameStem(_mediaBlob.current.filename, DEFAULT_IMAGE_FILENAME),
                extension:  getVideoExtension(),
                mimeType:   getVideoMimeType(),
                isDeferred: false,
            }
        }

        const hqAvailable = hqMedia?.blob instanceof Blob
        const useHqMedia = target === 'hq' || (target === 'auto' && hqAvailable)
        if (useHqMedia && hqAvailable) {
            return {
                blob:      hqMedia.blob,
                filename:   hqMedia.filename || getHqFilenameStem(),
                extension:  hqMedia.extension || getVideoExtension(),
                mimeType:   hqMedia.mimeType || getVideoMimeType(),
                isDeferred: true,
            }
        }

        return {
            blob:      _mediaBlob.current.blob,
            filename:   getDraftFilenameStem(),
            extension:  getVideoExtension(),
            mimeType:   getVideoMimeType(),
            isDeferred: false,
        }
    }, [getDraftFilenameStem, getHqFilenameStem, getVideoExtension, getVideoMimeType, hqMedia])

    const startHqExport = useCallback(async () => {
        if (isHqExporting || !__.recorder.isVideo() || !isReplayVideoLinked) {
            return
        }

        prepareVideoCaptureUi()
        const hqRenderSpec = await resolveHqExportRenderSpec()
        const exportFilename = getHqExportFilename()
        const controller = new AbortController()
        _hqExportAbortController.current = controller
        Object.assign(lgs.stores.ui.video, {
            editing:    true,
            finalizing: true,
        })
        setHqExportStatus('exporting')
        _dialogHiddenForHqExport.current = true
        _suppressNextDialogHideCleanup.current = true
        setDialogOpen(false)

        try {
            await waitForAnimationFrame()
            releaseHqMediaUrl()
            setHqMedia(null)
            const result = await exportReplayDeferredMp4({
                replay: lgs.stores.replay,
                journey: lgs.theJourney,
                controller: __.ui.replay?.controller ?? null,
                sourceCanvas: lgs.canvas,
                dimensions: hqRenderSpec?.dimensions ?? lgs.stores.replay?.deferredExportPlan?.dimensions ?? null,
                captureMode: hqRenderSpec?.captureMode ?? lgs.stores.replay?.deferredExportPlan?.captureMode ?? null,
                filename: exportFilename,
                signal: controller.signal,
                abortController: controller,
            })

            const draftMediaData = getMediaData()
            const hqDuration = Number(result.plan?.videoTimeline?.durationMillis)
                               || Number(result.plan?.manifest?.metadata?.replayDurationMillis)
                               || Number(draftMediaData.duration)
                               || 0
            const hqFrameCount = Number(result.frameCount) || Number(result.plan?.manifest?.frameCount) || 0
            const hqFps = Number(result.plan?.renderSpec?.fps)
                          || Number(result.plan?.videoTimeline?.fps)
                          || Number(draftMediaData.fps)
                          || 0
            const hqDimensions = result.plan?.dimensions
                                  ?? lgs.stores.replay?.deferredExportPlan?.dimensions
                                  ?? result.plan?.renderSpec?.dimensions
                                  ?? result.manifest?.metadata?.dimensions
                                  ?? draftMediaData.dimensions
            const payload = {
                blob:       result.blob,
                url:        URL.createObjectURL(result.blob),
                filename:   getHqFilenameStem() || result.plan?.label || DEFAULT_VIDEO_FILENAME,
                extension:  result.extension || getVideoExtension(),
                mimeType:   result.mimeType || getVideoMimeType(),
                mediaData:  {
                    ...draftMediaData,
                    size:       Number(result.blob?.size) || 0,
                    duration:   hqDuration,
                    fps:        hqFps,
                    averageFps: hqDuration > 0 && hqFrameCount > 0 ? hqFrameCount / (hqDuration / 1000) : hqFps,
                    dimensions: {
                        width:  Number(hqDimensions?.width) || 0,
                        height: Number(hqDimensions?.height) || 0,
                    },
                    quality:    {name: 'HQ'},
                    ratio:      draftMediaData.ratio || {label: 'Unknown'},
                },
                isDeferred: true,
            }
            _hqMediaUrl.current = payload.url
            _mediaBlob.current.filename = payload.filename
            setFilename(payload.filename)
            setHqMedia(payload)
            setHqExportStatus('ready')
            Object.assign(lgs.stores.ui.video, {
                editing:    false,
                finalizing: false,
            })
            _dialogHiddenForHqExport.current = false
            _suppressNextDialogHideCleanup.current = false
            await prepareReplaySceneForDialog()
            setDialogOpen(true)
        }
        catch (error) {
            if (error?.name === 'AbortError') {
                setHqExportStatus('idle')
            }
            else {
                console.error('HQ export failed:', error?.message, error?.stack)
                UIToast.error({
                    caption: 'Replay export',
                    text:    'Unable to create the HQ video.',
                })
                setHqExportStatus('idle')
            }
            Object.assign(lgs.stores.ui.video, {
                editing:    false,
                finalizing: false,
            })
            _dialogHiddenForHqExport.current = false
            _suppressNextDialogHideCleanup.current = false
            await prepareReplaySceneForDialog({force: true})
            setDialogOpen(true)
        }
        finally {
            _hqExportAbortController.current = null
        }
    }, [__.recorder, getHqExportFilename, getHqFilenameStem, getMediaData, getVideoExtension, getVideoMimeType, isHqExporting, isReplayVideoLinked, prepareReplaySceneForDialog, releaseHqMediaUrl, waitForAnimationFrame])

    /**
     * Handle share action with Web Share API fallback.
     */
    const handleShare = useCallback(async (target = 'auto') => {
        if (_shareInFlight.current) {
            return
        }
        const exportMedia = await resolveSmartVideoBlob(target)
        const blob = exportMedia.blob
        if (!(blob instanceof Blob) || blob.size === 0) {
            UIToast.error({
                              caption: 'Share',
                              text:    'No media is available to share.',
            })
            return
        }

        _shareInFlight.current = true
        const isVideo = __.recorder.isVideo()
        const extension = isVideo ? exportMedia.extension || getVideoExtension() : lgs.settings.ui.video.image
        const file = new File(
            [blob],
            buildMediaFilename(exportMedia.filename, extension, isVideo ? DEFAULT_VIDEO_FILENAME : DEFAULT_IMAGE_FILENAME),
            {type: blob.type || (isVideo ? (exportMedia.mimeType || getVideoMimeType()) : `image/${extension}`)},
        )
        const shareMediaLabel = isVideo ? 'video' : 'shot'
        const shareData = {
            title: 'LGS1920 Studio Video',
            text:  `Check out my last ${shareMediaLabel} created with LGS1920 Studio!`,
            files: [file],
        }

        try {
            if (navigator.share) {
                try {
                    await navigator.share(shareData)
                    return
                }
                catch (error) {
                    if (error?.name === 'AbortError') {
                        return
                    }

                    if (!['TypeError', 'DataError', 'NotSupportedError'].includes(error?.name)) {
                        throw error
                    }
                }

                await navigator.share({
                                          title: shareData.title,
                                          text:  shareData.text,
                                      })
                return
            }

            UIToast.warning({
                                caption: `Share your ${shareMediaLabel}`,
                                text: 'This browser cannot share this media file directly.',
                            })

        }
        catch (error) {
            if (error?.name === 'AbortError') {
                return
            }
            console.error('Share failed:', error.message)
            UIToast.error({
                              caption: 'Share failed',
                              text:    'Unable to open the share dialog on this device.',
                          })
        }
        finally {
            _shareInFlight.current = false
        }
    }, [getVideoExtension, getVideoMimeType, resolveSmartVideoBlob])

    const mediaData = getMediaData()
    const isVideo = __.recorder.isVideo()
    const canShare = __.app.canShare()
    const previewMediaUrl = hqMedia?.url ?? mediaUrl

    /**
     * Handle download via recorder API.
     */
    /**
     * Download the current media choice.
     *
     * For replay-linked videos, this may trigger the HQ export first.
     */
    const handleDownload = useCallback(async (target = 'auto') => {
        try {
            if (__.recorder.isVideo()) {
                const media = await resolveSmartVideoBlob(target)
                const blob = media.blob
                if (!blob || blob.size === 0) {
                    return
                }
                const downloadFilename = buildMediaFilename(media.filename, media.extension || getVideoExtension(), DEFAULT_VIDEO_FILENAME)
                if (media.isDeferred) {
                    downloadBlobFile(blob, downloadFilename)
                }
                else {
                    await __.recorder.download({
                                                   filename: downloadFilename,
                                               })
                }
            }
            else {
                await __.recorder.download({
                                               filename: buildMediaFilename(_mediaBlob.current.filename, lgs.settings.ui.video.image, DEFAULT_IMAGE_FILENAME),
                                           })
            }
        }
        catch (error) {
            console.error('Download failed:', error.message)
        }
    }, [downloadBlobFile, getVideoExtension, resolveSmartVideoBlob])

    const handleShareVariantSelect = useCallback((event) => {
        const target = event?.detail?.item?.value
        if (target === 'draft' || target === 'hq') {
            void handleShare(target)
        }
    }, [handleShare])

    const handleDownloadVariantSelect = useCallback((event) => {
        const target = event?.detail?.item?.value
        if (target === 'draft' || target === 'hq') {
            void handleDownload(target)
        }
    }, [handleDownload])

    /**
     * Handle cancel and cleanup.
     */
    const handleCancel = useCallback(async () => {
        if (_dialogCleanupDone.current) {
            setDialogOpen(false)
            return
        }
        _dialogCleanupDone.current = true
        _hqExportAbortController.current?.abort?.()
        _dialogHiddenForHqExport.current = false
        _suppressNextDialogHideCleanup.current = false
        await prepareReplaySceneForDialog()
        _replayScenePreFocused.current = false
        clearVideoReplayRuntimeState()
        setDialogOpen(false)
        setIsRecordingInfoOpen(false)
        cancelVideoEditing()
        releaseMediaUrl()
        releaseHqMediaUrl()
        _mediaBlob.current = {blob: null, url: null, filename: ''}
        setHqMedia(null)
        setHqExportStatus('idle')
        _hqExportAbortController.current = null
        setMediaUrl(null)
        Object.assign(lgs.stores.ui.video, {
            preRecording:     false,
            recording:        false,
            paused:           false,
            size:             0,
            recordedDuration: 0,
            recordedSize:     0,
            currentFps:       0,
            editing:          false,
            finalizing:       false,
        })
        setCanDownloadAndShare(false)
        setFilename('')
        void __.recorder?.releaseMedia?.()
    }, [prepareReplaySceneForDialog, releaseHqMediaUrl, releaseMediaUrl])

    /**
     * Keep the cleanup aligned with the native dialog close flow.
     */
    const handleDialogHide = useCallback((event) => {
        if (event?.target && event?.currentTarget && event.target !== event.currentTarget) {
            return
        }

        if (_dialogHiddenForHqExport.current || _hqExportAbortController.current || _suppressNextDialogHideCleanup.current) {
            _suppressNextDialogHideCleanup.current = false
            return
        }

        void handleCancel()
    }, [handleCancel])

    return (
        <>
            {dialogOpen && <div className="video-preview-dialog-brand-overlay" aria-hidden="true"/>}
            <WaDialog
                id="video-preview-dialog"
                open={dialogOpen}
                onWaHide={handleDialogHide}
                lightDismiss={false}
                className="lgs-theme"
            >
            <div slot="label" className="video-preview-dialog-title">
                <WaIcon
                    className="video-preview-title-icon"
                    name={isVideo ? 'film' : 'camera-polaroid'}
                    variant="regular"
                />
                <span>
                    {`Download ${canShare ? 'and Share ' : ''}${isVideo ? 'your video' : 'your screenshot'}`}
                </span>
            </div>

            <div className="video-container">
                {isVideo ? (
                    <>
                        <video
                            ref={_mainVideo}
                            src={previewMediaUrl}
                            controls
                            autoPlay
                            className="main-video"
                        />

                        <div className="blurred-video-wrapper">
                            <video
                                ref={_blurredVideo}
                                src={previewMediaUrl}
                                className="blurred-video"
                                muted
                                autoPlay
                            />
                        </div>
                    </>
                ) : (
                     <>
                         <img src={previewMediaUrl} alt="Screenshot" className="main-video"/>
                         <div className="blurred-video-wrapper">
                             <img src={previewMediaUrl} alt="" className="blurred-video"/>
                         </div>
                     </>
                 )}
            </div>

            <div className="video-file-actions">
                <WaInput
                    appearance="filled"
                    size="s"
                    name="video-file-name"
                    label-at-start
                    onInput={handleFilenameChange}
                    value={filename}
                >
                    <span slot="label" className="video-file-label">{'File name'}</span>
                    <span slot="end" className="video-file-extension">
                        .{isVideo ? getVideoExtension() : lgs.settings.ui.video.image}
                    </span>
                </WaInput>
                <div className="video-file-info-action">
                    <WaTooltip for="video-recording-info-trigger" placement="top">
                        {'Recording information'}
                    </WaTooltip>
                    <WaButton
                        id="video-recording-info-trigger"
                        ref={_recordingInfoButton}
                        className="video-recording-info-trigger"
                        appearance="plain"
                        size="s"
                        variant="brand"
                        onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setIsRecordingInfoOpen((open) => !open)
                        }}
                    >
                        <WaIcon name="circle-info" variant="regular"/>
                    </WaButton>
                </div>
                <LGSPopup
                    ref={_recordingInfoPopup}
                    anchor="video-recording-info-trigger"
                    active={isRecordingInfoOpen}
                    onRequestClose={() => setIsRecordingInfoOpen(false)}
                    placement="top-end"
                    distance={lgs.gutter.xs}
                    flip
                    shift
                    strategy="fixed"
                >
                    <RecordingInfo
                        mediaData={mediaData}
                        isVideo={isVideo}
                    />
                </LGSPopup>
            </div>

            <div slot="footer" id="video-preview-dialog-footer">
                <div className="buttons-bar">
                    <div className="video-preview-close-action">
                        <WaTooltip for="video-preview-close">{'Cancel'}</WaTooltip>
                        <WaButton
                            id="video-preview-close"
                            className="video-preview-close-button"
                            appearance="outlined"
                            onClick={handleCancel}
                        >
                            <WaIcon slot="start" className="video-preview-action-icon" name="xmark" variant="regular"/>
                            {'Close'}
                        </WaButton>
                    </div>
                    {canShare && (
                        hasHqMedia ? (
                            <>
                                <WaTooltip for="video-preview-share">{'Share HQ video'}</WaTooltip>
                                <WaButtonGroup label="Share video">
                                    <WaButton
                                        id="video-preview-share"
                                        appearance="filled"
                                        variant="brand"
                                        disabled={!canDownloadAndShare}
                                        onClick={() => void handleShare('hq')}
                                    >
                                        <WaIcon
                                            slot="start"
                                            className="video-preview-action-icon"
                                            name="share-nodes"
                                            variant="regular"
                                        />
                                        {'Share HQ'}
                                    </WaButton>
                                    <WaDropdown placement="bottom-end" onWaSelect={handleShareVariantSelect}>
                                        <WaButton
                                            slot="trigger"
                                            appearance="filled"
                                            variant="brand"
                                            disabled={!canDownloadAndShare}
                                        >
                                            <WaIcon name="chevron-down" label="Share options"/>
                                        </WaButton>
                                        <WaDropdownItem value="hq">
                                            <WaIcon slot="icon" name="film" variant="regular"/>
                                            {'Share HQ video'}
                                        </WaDropdownItem>
                                        <WaDropdownItem value="draft">
                                            <WaIcon slot="icon" name="file-video" variant="regular"/>
                                            {'Share draft video'}
                                        </WaDropdownItem>
                                    </WaDropdown>
                                </WaButtonGroup>
                            </>
                        ) : (
                            <>
                                <WaTooltip for="video-preview-share">{'Share your video'}</WaTooltip>
                                <WaButton
                                    id="video-preview-share"
                                    appearance="filled"
                                    variant="brand"
                                    disabled={!canDownloadAndShare}
                                    onClick={() => void handleShare()}
                                >
                                    <WaIcon
                                        slot="start"
                                        className="video-preview-action-icon"
                                        name="share-nodes"
                                        variant="regular"
                                    />
                                    {'Share'}
                                </WaButton>
                            </>
                        )
                    )}
                    {hasHqMedia ? (
                        <>
                            <WaTooltip for="video-preview-download">{'Save HQ video'}</WaTooltip>
                            <WaButtonGroup label="Download video">
                                <WaButton
                                    id="video-preview-download"
                                    appearance="filled"
                                    variant="brand"
                                    disabled={!canDownloadAndShare}
                                    onClick={() => void handleDownload('hq')}
                                >
                                    <WaIcon slot="start" className="video-preview-action-icon" name="download" variant="regular"/>
                                    {'Download'}
                                </WaButton>
                                <WaDropdown placement="bottom-end" onWaSelect={handleDownloadVariantSelect}>
                                    <WaButton
                                        slot="trigger"
                                        appearance="filled"
                                        variant="brand"
                                        disabled={!canDownloadAndShare}
                                    >
                                        <WaIcon name="chevron-down" label="Download options"/>
                                    </WaButton>
                                    <WaDropdownItem value="hq">
                                        <WaIcon slot="icon" name="film" variant="regular"/>
                                        {'Download HQ'}
                                    </WaDropdownItem>
                                    <WaDropdownItem value="draft">
                                        <WaIcon slot="icon" name="file-video" variant="regular"/>
                                        {'Download draft'}
                                    </WaDropdownItem>
                                </WaDropdown>
                            </WaButtonGroup>
                        </>
                    ) : (
                        <>
                            <WaTooltip for="video-preview-download">{'Save your video'}</WaTooltip>
                            <WaButton
                                id="video-preview-download"
                                appearance="filled"
                                variant="brand"
                                disabled={!canDownloadAndShare}
                                onClick={() => void handleDownload()}
                            >
                                <WaIcon slot="start" className="video-preview-action-icon" name="download" variant="regular"/>
                                {'Download'}
                            </WaButton>
                        </>
                    )}
                    {!hasHqMedia && isReplayVideoLinked && (
                        <div className="video-preview-create-hq-action">
                            <WaTooltip for="video-preview-create-hq">{isHqExporting ? 'Creating HQ video' : 'Create an HQ version'}</WaTooltip>
                            <WaButton
                                id="video-preview-create-hq"
                                appearance="outlined"
                                variant="neutral"
                                disabled={!__?.recorder.isVideo() || isHqExporting}
                                onClick={() => void startHqExport()}
                                aria-label="Create HQ video"
                            >
                                <WaIcon slot="start" className="video-preview-action-icon" name={isHqExporting ? 'spinner-third' : 'film'} variant="regular"/>
                                {isHqExporting ? 'Creating HQ...' : 'Create HQ'}
                            </WaButton>
                        </div>
                    )}
                </div>
            </div>
            </WaDialog>
        </>
    )
}
