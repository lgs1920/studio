/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified: 2026-06-02
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
import { cancelVideoEditing } from '@Components/MainUI/video/videoEditingCleanup'
import {
    WaButton, WaDialog, WaIcon, WaInput, WaTooltip,
}                        from '@web.awesome.me/webawesome-pro/dist/react'
import {
    UIToast,
}                      from '@Utils/UIToast'
import { useCallback, useEffect, useRef, useState } from 'react'
import './style.css'

export const VideoDownloadAndShareDialog = () => {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [filename, setFilename] = useState('')
    const [canDownloadAndShare, setCanDownloadAndShare] = useState(false)
    const [isRecordingInfoOpen, setIsRecordingInfoOpen] = useState(false)
    const [mediaUrl, setMediaUrl] = useState(null)
    const _mainVideo = useRef(null)
    const _blurredVideo = useRef(null)
    const _recordingInfoButton = useRef(null)
    const _recordingInfoPopup = useRef(null)
    const _mediaBlob = useRef({blob: null, url: null, filename: ''})
    const _hqMediaBlob = useRef({blob: null, filename: '', mimeType: null, extension: null})
    const _hqExportInFlight = useRef(null)
    const _shareInFlight = useRef(false)
    const _dialogCleanupDone = useRef(true)
    const releaseMediaUrl = useCallback(() => {
        const url = _mediaBlob.current.url
        if (url) {
            _mediaBlob.current.url = null
            URL.revokeObjectURL(url)
        }
    }, [])
    const getVideoExtension = useCallback(() => __.recorder.mediaData?.extension || lgs.settings.ui.video.format, [])
    const getVideoMimeType = useCallback(() => __.recorder.mediaData?.mimeType || 'video/mp4', [])
    const getHqExportFilename = useCallback(() => `${_mediaBlob.current.filename || __.recorder.filename({}) || 'video'}.mp4`, [])
    const hasReplayDeferredExportPlan = useCallback(() => Boolean(lgs.stores?.replay?.deferredExportPlan), [])

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
    }, [])

    /**
     * Initialize stop recording handler with blob validation.
     */
    useEffect(() => {

        const handleStopRecording = (event) => {
            const blob = event.detail?.blob
            if (!(blob instanceof Blob) || blob.size === 0) {
                console.error('Invalid video blob received')
                return
            }

            releaseMediaUrl()
            const url = URL.createObjectURL(blob)
            const recorderFilename = __.recorder.filename({}) || 'video'
            const safeFilename = recorderFilename.replace(/[^a-zA-Z0-9_-]/g, '_')

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
                const recorderFilename = __.recorder.filename({}) || 'record'
                const safeFilename = recorderFilename.replace(/[^a-zA-Z0-9_-]/g, '_')
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
    }, [releaseMediaUrl])

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
        _hqMediaBlob.current = {blob: null, filename: '', mimeType: null, extension: null}
        const canProceed = sanitized.length > 0
        setCanDownloadAndShare(canProceed)
        setFilename(sanitized)
    }, [])

    /**
     * Resolve the media blob the dialog should expose.
     *
     * The final dialog prefers the replay HQ export when the replay pipeline
     * prepared a deferred master plan. Otherwise it falls back to the recorder
     * blob produced by the live draft.
     */
    const resolveSmartVideoBlob = useCallback(async () => {
        if (!__.recorder.isVideo() || !hasReplayDeferredExportPlan()) {
            return {
                blob:      _mediaBlob.current.blob,
                filename:   _mediaBlob.current.filename,
                extension:  getVideoExtension(),
                mimeType:   getVideoMimeType(),
                isDeferred: false,
            }
        }

        if (_hqMediaBlob.current.blob instanceof Blob) {
            return {
                blob:      _hqMediaBlob.current.blob,
                filename:   _hqMediaBlob.current.filename || _mediaBlob.current.filename,
                extension:  _hqMediaBlob.current.extension || getVideoExtension(),
                mimeType:   _hqMediaBlob.current.mimeType || getVideoMimeType(),
                isDeferred: true,
            }
        }

        if (_hqExportInFlight.current) {
            return await _hqExportInFlight.current
        }

        const exportPromise = (async () => {
            const exportFilename = getHqExportFilename()
            // Reuse the same replay/export pipeline as the drawer, but keep the
            // blob in memory so the dialog can decide whether to download or share.
            const result = await exportReplayDeferredMp4({
                replay: lgs.stores.replay,
                journey: lgs.theJourney,
                controller: __.ui.replay?.controller ?? null,
                sourceCanvas: lgs.canvas,
                dimensions: lgs.canvas ? {width: lgs.canvas.width, height: lgs.canvas.height} : null,
                filename: exportFilename,
            })

            const payload = {
                blob:      result.blob,
                filename:  _mediaBlob.current.filename || result.plan?.label || 'video',
                extension: result.extension || getVideoExtension(),
                mimeType:  result.mimeType || getVideoMimeType(),
                isDeferred: true,
            }
            _hqMediaBlob.current = payload
            return payload
        })()

        _hqExportInFlight.current = exportPromise
        try {
            return await exportPromise
        }
        finally {
            _hqExportInFlight.current = null
        }
    }, [getHqExportFilename, getVideoExtension, getVideoMimeType, hasReplayDeferredExportPlan])

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
        const isVideo = __.recorder.isVideo()
        const extension = isVideo ? exportMedia.extension || getVideoExtension() : lgs.settings.ui.video.image
        const file = new File(
            [blob],
            `${exportMedia.filename}.${extension}`,
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

    /**
     * Handle download via recorder API.
     */
    /**
     * Download the current media choice.
     *
     * For replay-linked videos, this may trigger the HQ export first.
     */
    const handleDownload = useCallback(async () => {
        try {
            if (__.recorder.isVideo()) {
                const media = await resolveSmartVideoBlob()
                const blob = media.blob
                if (!blob || blob.size === 0) {
                    return
                }
                const downloadFilename = `${media.filename}.${media.extension || getVideoExtension()}`
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
                                               filename: `${_mediaBlob.current.filename}.${lgs.settings.ui.video.image}`,
                                           })
            }
        }
        catch (error) {
            console.error('Download failed:', error.message)
        }
    }, [downloadBlobFile, getVideoExtension, resolveSmartVideoBlob])

    /**
     * Handle cancel and cleanup.
     */
    const handleCancel = useCallback(() => {
        __.ui.replay?.restorePlaybackScene?.()
        if (_dialogCleanupDone.current) {
            setDialogOpen(false)
            return
        }
        _dialogCleanupDone.current = true
        setDialogOpen(false)
        setIsRecordingInfoOpen(false)
        cancelVideoEditing()
        releaseMediaUrl()
        _mediaBlob.current = {blob: null, url: null, filename: ''}
        _hqMediaBlob.current = {blob: null, filename: '', mimeType: null, extension: null}
        _hqExportInFlight.current = null
        setMediaUrl(null)
        Object.assign(lgs.stores.ui.video, {
            preRecording:     false,
            recording:        false,
            paused:           false,
            size:             0,
            recordedDuration: 0,
            recordedSize:     0,
            currentFps:       0,
            finalizing:       false,
        })
        setCanDownloadAndShare(false)
        setFilename('')
        void __.recorder?.releaseMedia?.()
    }, [releaseMediaUrl])

    /**
     * Keep the cleanup aligned with the native dialog close flow.
     */
    const handleDialogHide = useCallback((event) => {
        if (event?.target && event?.currentTarget && event.target !== event.currentTarget) {
            return
        }

        handleCancel()
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
                            src={mediaUrl}
                            controls
                            autoPlay
                            className="main-video"
                        />

                        <div className="blurred-video-wrapper">
                            <video
                                ref={_blurredVideo}
                                src={mediaUrl}
                                className="blurred-video"
                                muted
                                autoPlay
                            />
                        </div>
                    </>
                ) : (
                     <>
                         <img src={mediaUrl} alt="Screenshot" className="main-video"/>
                         <div className="blurred-video-wrapper">
                             <img src={mediaUrl} alt="" className="blurred-video"/>
                         </div>
                     </>
                 )}
            </div>

            <div className="video-file-actions">
                <WaInput
                    appearance="filled"
                    size="s"
                    name="video-file-name"
                    onInput={handleFilenameChange}
                    value={filename}
                >
                    <div slot="label" className="video-file-label">
                        <span>{'File name'}</span>
                        <div className="video-file-label-actions">
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
                    </div>
                    <span slot="end" className="video-file-extension">
                        .{isVideo ? getVideoExtension() : lgs.settings.ui.video.image}
                    </span>
                </WaInput>
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
                    <WaTooltip for="video-preview-close">{'Cancel'}</WaTooltip>
                    <WaButton id="video-preview-close" appearance="outlined" onClick={handleCancel}>
                        <WaIcon slot="start" className="video-preview-action-icon" name="xmark" variant="regular"/>
                        {'Close'}
                    </WaButton>
                    {canShare && (
                        <>
                            <WaTooltip for="video-preview-share">{'Share your video'}</WaTooltip>
                            <WaButton
                                id="video-preview-share"
                                appearance="outlined"
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
                    )}
                    <WaTooltip for="video-preview-download">{'Save your video'}</WaTooltip>
                    <WaButton
                        id="video-preview-download"
                        variant="brand"
                        disabled={!canDownloadAndShare}
                        onClick={handleDownload}
                    >
                        <WaIcon slot="start" className="video-preview-action-icon" name="download" variant="regular"/>
                        {__?.recorder.isVideo() && hasReplayDeferredExportPlan() ? 'Download HQ' : 'Download'}
                    </WaButton>
                </div>
            </div>
            </WaDialog>
        </>
    )
}
