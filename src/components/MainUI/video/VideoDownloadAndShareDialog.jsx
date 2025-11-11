/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-04
 * Last modified: 2025-11-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * @file VideoDownloadAndShareDialog.jsx
 * @description Optimized component for previewing and downloading recorded videos.
 * Prevents errors on videoData access by using Valtio snapshot safely.
 * Uses Shoelace web components and FontAwesome icons.
 * All refs prefixed with _, no default export, no semicolons.
 */

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import { VideoRecorder } from '@Core/ui/video/recorder/VideoRecorder'
import {
    faCropAlt,
    faDownload,
    faFile,
    faFilm,
    faFloppyDisk,
    faHourglass,
    faShareAlt,
    faXmark,
} from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton,
    SlDialog,
    SlIcon,
    SlInput,
    SlTooltip,
} from '@shoelace-style/shoelace/dist/react'
import { FA2SL }         from '@Utils/FA2SL'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }   from 'valtio'
import './style.css'

export const VideoDownloadAndShareDialog = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [filename, setFilename] = useState('')
    const [canDownloadAndShare, setCanDownloadAndShare] = useState(false)
    const [canShare] = useState(!!(navigator.canShare && navigator.canShare({files: []})))
    const _mainVideo = useRef(null)
    const _blurredVideo = useRef(null)
    const _videoBlob = useRef({blob: null, url: null, filename: ''})

    /**
     * Safely accesses videoData from recorder with fallback.
     * @returns {Object} Video stats with default values
     */
    const getVideoData = useCallback(() => {
        const fallback = {
            size:       0,
            duration:   0,
            fps:        0,
            dimensions: {width: 0, height: 0},
            quality:    {name: 'Unknown'},
            ratio:      {label: 'Unknown'},
        }

        try {
            const data = __.recorder?.videoData
            if (!data || typeof data !== 'object') {
                return fallback
            }

            return {
                size:       Number(data.size) || 0,
                duration:   Number(data.duration) || 0,
                fps:        Number(data.fps) || 0,
                dimensions: {
                    width:  Number(data.dimensions?.width) || 0,
                    height: Number(data.dimensions?.height) || 0,
                },
                quality:    data.quality || {name: 'Unknown'},
                ratio:      data.ratio || {label: 'Unknown'},
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

            const url = URL.createObjectURL(blob)
            const recorderFilename = __.recorder.filename({}) || 'video'
            const safeFilename = recorderFilename.replace(/[^a-zA-Z0-9_-]/g, '_')

            _videoBlob.current = {blob, url, filename: safeFilename}
            setFilename(safeFilename)
            setCanDownloadAndShare(true)
            setDialogOpen(true)
        }

        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStopRecording)

        return () => {
            __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStopRecording)
            if (_videoBlob.current.url) {
                URL.revokeObjectURL(_videoBlob.current.url)
            }
        }
    }, [])

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

    /**
     * Handle filename input with sanitization.
     */
    const handleFilenameChange = useCallback((event) => {
        const value = event.target?.value || ''
        const sanitized = value.replace(/[^a-zA-Z0-9_\-\s]/g, '')
        _videoBlob.current.filename = sanitized
        const canProceed = sanitized.length > 0
        setCanDownloadAndShare(canProceed)
        setFilename(sanitized)
    }, [])

    /**
     * Handle share action with Web Share API fallback.
     */
    const handleShare = useCallback(async () => {
        const blob = _videoBlob.current.blob
        const filename = `${_videoBlob.current.filename}.${lgs.settings.ui.video.format}`
        const file = new File([blob], filename, {type: blob.type || 'video/mp4'})

        try {
            if (navigator.canShare?.({files: [file]})) {
                await navigator.share({
                                          title: 'LGS1920 Studio Video',
                                          text:  'Check out my video created with LGS1920 Studio!',
                                          files: [file],
                                      })
                return
            }
            if (navigator.share) {
                await navigator.share({
                                          title: 'LGS1920 Studio Video',
                                          text: 'Check out my video created with LGS1920 Studio!',
                                          url:  _videoBlob.current.url,
                                      })
            }
        }
        catch (error) {
            console.error('Share failed:', error.message)
        }
    }, [])

    /**
     * Handle download via recorder API.
     */
    const handleDownload = useCallback(async () => {
        const blob = _videoBlob.current.blob
        if (!blob || blob.size === 0) {
            return
        }

        try {
            await __.recorder.download({
                                           filename: `${_videoBlob.current.filename}.${lgs.settings.ui.video.format}`,
                                           type: 'local-filesystem',
                                       })
        }
        catch (error) {
            console.error('Download failed:', error.message)
        }
    }, [])

    /**
     * Handle cancel and cleanup.
     */
    const handleCancel = useCallback(() => {
        setDialogOpen(false)
        if (_videoBlob.current.url) {
            URL.revokeObjectURL(_videoBlob.current.url)
        }
        _videoBlob.current = {blob: null, url: null, filename: ''}
        $video.editing = false
        setCanDownloadAndShare(false)
        setFilename('')
    }, [$video])

    /**
     * Prevent dialog close except via close button.
     */
    const handleDialogClose = useCallback((event) => {
        if (event.detail?.source === 'close-button') {
            handleCancel()
        }
        else {
            event.preventDefault()
        }
    }, [handleCancel])

    const videoData = getVideoData()

    return (
        <SlDialog
            id="video-preview-dialog"
            open={dialogOpen}
            onSlRequestClose={handleDialogClose}
            className="lgs-theme"
        >
            <div slot="label">
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFilm)}/>
                Download {__.app.canShare() ? 'and Share ' : ''}your video
            </div>

            <div className="video-container">
                <video
                    ref={_mainVideo}
                    src={_videoBlob.current.url}
                    controls
                    autoPlay
                    className="main-video"
                />

                <div className="blurred-video-wrapper">
                    <video
                        ref={_blurredVideo}
                        src={_videoBlob.current.url}
                        className="blurred-video"
                        muted
                        autoPlay
                    />
                </div>

                <div className="video-info lgs-card on-map">
                    <div>
                        <SlIcon library="fa" name={FA2SL.set(faCropAlt)}/>
                        {videoData.ratio.label} - {videoData.dimensions.width}x{videoData.dimensions.height}
                    </div>
                    <div>
                        <SlIcon library="fa" name={FA2SL.set(faFile)}/>
                        {__.convert(videoData.size).toBytesUnit()}
                    </div>
                    <div>
                        <SlIcon library="fa" name={FA2SL.set(faHourglass)}/>
                        {__.convert(videoData.duration).toTime()}
                    </div>
                    <div>FPS: {videoData.fps}</div>
                    <div>{videoData.quality.name}</div>
                </div>
            </div>

            <div>
                <SlInput
                    size="small"
                    name="video-file-name"
                    onSlInput={handleFilenameChange}
                    value={filename}
                    label={'File name'}
                >
                    <span slot="suffix">.{lgs.settings.ui.video.format}</span>
                </SlInput>
            </div>

            <div slot="footer" id="video-preview-dialog-footer">
                <SlTooltip content="Cancel">
                    <SlButton onClick={handleCancel}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                        Close
                    </SlButton>
                </SlTooltip>

                <div>
                    {__.app.canShare() && (
                        <SlTooltip content="Share your video">
                            <SlButton disabled={!canDownloadAndShare} onClick={handleShare}>
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faShareAlt)}/>
                                Share
                            </SlButton>
                        </SlTooltip>
                    )}

                    <SlTooltip content="Save your video">
                        <SlButton
                            variant="primary"
                            onClick={handleDownload}
                            disabled={!canDownloadAndShare}
                        >
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDownload)}/>
                            Download
                        </SlButton>
                    </SlTooltip>
                </div>
            </div>
        </SlDialog>
    )
}