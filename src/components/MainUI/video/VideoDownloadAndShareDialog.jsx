/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2025-09-04
 * Last modified: 2026-09-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * @file VideoDownloadAndShareDialog.jsx
 * @description Optimized component for previewing and downloading recorded videos.
 * Keeps preview state render-safe while using captured media data with fallbacks.
 * Uses Web Awesome components and icons.
 * All refs prefixed with _, no default export, no semicolons.
 */
import { RecordingInfo } from '@Components/MainUI/video/RecordingInfo'
import { LGSPopup }      from '@Components/LGSPopup'
import {ReplayMediaCapture} from '@Core/ui/replay/ReplayMediaCapture'
import { REPLAY_DEFERRED_EXPORT_READY_EVENT } from '@Core/ui/replay/ReplayRecordingMonitor'
import { cancelVideoEditing } from '@Components/MainUI/video/videoEditingCleanup'
import {
    WaButton, WaDialog, WaIcon, WaInput, WaTooltip,
}                        from '@web.awesome.me/webawesome-pro/dist/react'
import {
    UIToast,
}                      from '@Utils/UIToast'
import { useCallback, useEffect, useRef, useState } from 'react'
import './style.css'

const DEFAULT_VIDEO_FILENAME = 'video'
const DEFAULT_IMAGE_FILENAME = 'record'

const sanitizeFilenameStem = (value, fallback = DEFAULT_VIDEO_FILENAME) => {
    const sanitized = `${value ?? ''}`.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim()
    return sanitized || fallback
}

/**
 * Stop replay playback and wait until its camera and scene focus restoration has settled.
 *
 * @returns {Promise<void>} Promise resolved after the final view is ready to reveal
 */
const preFocusVideoReplayScene = async ({linked = false} = {}) => {
    if (!linked) {
        return
    }

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
    replayStore.resolvedFrameState = null
    replayStore.replayFramePhase = null
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
    const [deferredMediaData, setDeferredMediaData] = useState(null)
    const _mainVideo = useRef(null)
    const _blurredVideo = useRef(null)
    const _recordingInfoButton = useRef(null)
    const _recordingInfoPopup = useRef(null)
    const _mediaBlob = useRef({blob: null, url: null, filename: ''})
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
    const getVideoExtension = useCallback(() => deferredMediaData?.extension
        || __.mediaCapture.mediaData?.extension
        || lgs.settings.ui.video.format, [deferredMediaData])
    const getVideoMimeType = useCallback(() => deferredMediaData?.mimeType
        || __.mediaCapture.mediaData?.mimeType
        || 'video/mp4', [deferredMediaData])
    const getMediaFilenameStem = useCallback((fallback = DEFAULT_VIDEO_FILENAME) => (
        sanitizeFilenameStem(__.mediaCapture.filename?.({}) || fallback, fallback)
    ), [])
    const isReplayVideoLinked = lgs.stores?.replay?.recordingSync === true
                                || lgs.stores?.replay?.simplePreparationActive === true
    const getVideoFilenameStem = useCallback(() => (
        sanitizeFilenameStem(_mediaBlob.current.filename || getMediaFilenameStem(), DEFAULT_VIDEO_FILENAME)
    ), [getMediaFilenameStem])

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
            await preFocusVideoReplayScene({linked: isReplayVideoLinked})
            _replayScenePreFocused.current = true
        }
        catch (error) {
            console.error('Unable to pre-focus the replay scene:', error)
        }
    }, [isReplayVideoLinked])

    /**
     * Safely accesses media data with fallback values.
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
            metadata:   {},
        }

        try {
            if (deferredMediaData) {
                return {...fallback, ...deferredMediaData}
            }
            const data = __.mediaCapture?.mediaData
            if (!data || typeof data !== 'object') {
                return fallback
            }
            if (__.mediaCapture.isVideo()) {
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
                    metadata:   data.metadata || {},
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
    }, [deferredMediaData])

    useEffect(() => {
        const handleCapture = (event) => {
            try {
                const imageBlob = event.detail?.blob
                if (!(imageBlob instanceof Blob) || imageBlob.size === 0) {
                    throw new Error('Invalid screenshot blob received')
                }

                releaseMediaUrl()
                const imageUrl = URL.createObjectURL(imageBlob)
                const safeFilename = sanitizeFilenameStem(getMediaFilenameStem(DEFAULT_IMAGE_FILENAME), DEFAULT_IMAGE_FILENAME)
                _mediaBlob.current = {
                    blob:     imageBlob,
                    url:      imageUrl,
                    filename: safeFilename,
                    type:     ReplayMediaCapture.IMAGE,
                }
                _dialogCleanupDone.current = false
                setMediaUrl(imageUrl)
                setFilename(safeFilename)
                setCanDownloadAndShare(true)
                setDeferredMediaData(null)
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

        const handleDeferredReplayExport = async (event) => {
            const {blob, filename = DEFAULT_VIDEO_FILENAME, mediaData = {}} = event.detail ?? {}
            if (!(blob instanceof Blob) || blob.size <= 0) {
                UIToast.error({caption: 'Replay video', text: 'The generated video is empty.'})
                return
            }

            releaseMediaUrl()
            const url = URL.createObjectURL(blob)
            const safeFilename = sanitizeFilenameStem(`${filename}`.replace(/\.[^.]+$/, ''), DEFAULT_VIDEO_FILENAME)
            _mediaBlob.current = {
                blob,
                url,
                filename: safeFilename,
                type: ReplayMediaCapture.VIDEO,
                source: 'deferred-replay',
                mediaData,
            }
            __.mediaCapture.type = ReplayMediaCapture.VIDEO
            setDeferredMediaData(mediaData)
            _dialogCleanupDone.current = false
            setMediaUrl(url)
            setFilename(safeFilename)
            setCanDownloadAndShare(true)
            await prepareReplaySceneForDialog()
            setDialogOpen(true)
        }


        __.mediaCapture.addEventListener(ReplayMediaCapture.events.CAPTURED, handleCapture)
        globalThis.window?.addEventListener(REPLAY_DEFERRED_EXPORT_READY_EVENT, handleDeferredReplayExport)

        return () => {
            __.mediaCapture.removeEventListener(ReplayMediaCapture.events.CAPTURED, handleCapture)
            globalThis.window?.removeEventListener(REPLAY_DEFERRED_EXPORT_READY_EVENT, handleDeferredReplayExport)
            releaseMediaUrl()
            void __.mediaCapture?.releaseMedia?.()
        }
    }, [getMediaFilenameStem, prepareReplaySceneForDialog, releaseMediaUrl])

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
        const canProceed = sanitized.length > 0
        setCanDownloadAndShare(canProceed)
        setFilename(sanitized)
    }, [])

    /**
     * Resolve the video or screenshot already present in the dialog.
     */
    const resolveSmartVideoBlob = useCallback(async () => {
        if (!__.mediaCapture.isVideo()) {
            return {
                blob:      _mediaBlob.current.blob,
                filename:   sanitizeFilenameStem(_mediaBlob.current.filename, DEFAULT_IMAGE_FILENAME),
                extension:  getVideoExtension(),
                mimeType:   getVideoMimeType(),
            }
        }

        return {
            blob:      _mediaBlob.current.blob,
            filename:   getVideoFilenameStem(),
            extension:  getVideoExtension(),
            mimeType:   getVideoMimeType(),
        }
    }, [getVideoFilenameStem, getVideoExtension, getVideoMimeType])

    /**
     * Handle share action with Web Share API fallback.
     */
    const handleShare = useCallback(async () => {
        if (_shareInFlight.current) {
            return
        }
        const exportMedia = await resolveSmartVideoBlob()
        const blob = exportMedia.blob
        if (!(blob instanceof Blob) || blob.size === 0) {
            UIToast.error({
                              caption: 'Share',
                              text:    'No media is available to share.',
            })
            return
        }

        _shareInFlight.current = true
        const isVideo = __.mediaCapture.isVideo()
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
    const isVideo = __.mediaCapture.isVideo()
    const canShare = __.app.canShare()
    const previewMediaUrl = mediaUrl

    /**
     * Download the available Replay video or screenshot.
     */
    const handleDownload = useCallback(async () => {
        try {
            if (__.mediaCapture.isVideo()) {
                const media = await resolveSmartVideoBlob()
                const blob = media.blob
                if (!blob || blob.size === 0) {
                    return
                }
                const downloadFilename = buildMediaFilename(media.filename, media.extension || getVideoExtension(), DEFAULT_VIDEO_FILENAME)
                if (_mediaBlob.current.source === 'deferred-replay') {
                    const link = document.createElement('a')
                    link.href = _mediaBlob.current.url
                    link.download = downloadFilename
                    link.click()
                }
                else {
                    await __.mediaCapture.download({filename: downloadFilename})
                }
            }
            else {
                await __.mediaCapture.download({
                                               filename: buildMediaFilename(_mediaBlob.current.filename, lgs.settings.ui.video.image, DEFAULT_IMAGE_FILENAME),
                                           })
            }
        }
        catch (error) {
            console.error('Download failed:', error.message)
        }
    }, [getVideoExtension, resolveSmartVideoBlob])

    /**
     * Handle cancel and cleanup.
     */
    const handleCancel = useCallback(async () => {
        if (_dialogCleanupDone.current) {
            setDialogOpen(false)
            return
        }
        _dialogCleanupDone.current = true
        await prepareReplaySceneForDialog()
        _replayScenePreFocused.current = false
        clearVideoReplayRuntimeState()
        setDialogOpen(false)
        setIsRecordingInfoOpen(false)
        cancelVideoEditing()
        releaseMediaUrl()
        _mediaBlob.current = {blob: null, url: null, filename: ''}
        setMediaUrl(null)
        Object.assign(lgs.stores.ui.video, {
            preRecording:     false,
            recordingHQ:      false,
            paused:           false,
            size:             0,
            editing:          false,
            finalizing:       false,
        })
        setCanDownloadAndShare(false)
        setFilename('')
        void __.mediaCapture?.releaseMedia?.()
        setDeferredMediaData(null)
    }, [prepareReplaySceneForDialog, releaseMediaUrl])

    /**
     * Keep the cleanup aligned with the native dialog close flow.
     */
    const handleDialogHide = useCallback((event) => {
        if (event?.target && event?.currentTarget && event.target !== event.currentTarget) {
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
                        <>
                            <WaTooltip for="video-preview-share">{'Share your video'}</WaTooltip>
                            <WaButton
                                id="video-preview-share"
                                appearance="filled"
                                variant="brand"
                                disabled={!canDownloadAndShare}
                                onClick={() => void handleShare()}
                            >
                                <WaIcon slot="start" className="video-preview-action-icon" name="share-nodes" variant="regular"/>
                                {'Share'}
                            </WaButton>
                        </>
                    )}
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
                </div>
            </div>
            </WaDialog>
        </>
    )
}
