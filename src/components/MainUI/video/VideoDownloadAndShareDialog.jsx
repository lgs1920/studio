/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-04
 * Last modified: 2025-09-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoDownloadAndShareDialog - Component for previewing and downloading recorded videos.
 * @returns {JSX.Element} Dialog with video preview and download/share options.
 */
import { LGSScrollbars }                            from '@Components/MainUI/LGSScrollbars'
import { APP_KEY }                                  from '@Core/constants'
import { VideoRecorder }                            from '@Core/ui/video/recorder/VideoRecorder'
import { faDownload, faXmark, faShareAlt, faFilm }  from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon, SlIconButton, SlInput, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                    from '@Utils/FA2SL'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                              from 'valtio'
import './style.css'

export const VideoDownloadAndShareDialog = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [filename, setFilename] = useState('')
    const _mainVideo = useRef(null)
    const _blurredVideo = useRef(null)
    const _videoBlob = useRef({})

    /**
     * Initialize and handle stop recording event.
     */
    useEffect(() => {
        const handleStopRecording = ({detail: {blob, metadata, duration, totalBytes, timestamp}}) => {
            if (!(blob instanceof Blob) || blob.size === 0) {
                console.error(`Invalid video blob (type: ${blob?.type}, size: ${blob?.size})`)
                return
            }
            const url = URL.createObjectURL(blob)
            let recorderFilename = 'video-temp'
            if (window.__?.recorder && typeof window.__.recorder.filename === 'function') {
                recorderFilename = window.__.recorder.filename({})
            }
            else {
                console.error('__recorder.filename non disponible:', window.__.recorder)
            }
            _videoBlob.current = {blob, filename: recorderFilename, url}
            setFilename(_videoBlob.current.filename)
            setDialogOpen(true)
            console.log(`Video blob received: type=${blob.type}, size=${(blob.size / 1000000).toFixed(2)}MB`)
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
     * Synchronize blurred video with main video and start playback.
     */
    useEffect(() => {
        const mainVideo = _mainVideo.current
        const blurredVideo = _blurredVideo.current
        if (!mainVideo || !blurredVideo) {
            return
        }

        const syncTime = () => {
            try {
                if (Math.abs(blurredVideo.currentTime - mainVideo.currentTime) > 0.05) {
                    blurredVideo.currentTime = mainVideo.currentTime
                }
            }
            catch (e) {
                // no-op: Safari may throw during scrubbing
            }
        }

        const handlePlay = () => {
            blurredVideo.play().catch(error => console.error(`Error playing blurred video: ${error.message}`))
            syncTime()
        }

        const handlePause = () => {
            blurredVideo.pause()
        }

        const handleRateChange = () => {
            blurredVideo.playbackRate = mainVideo.playbackRate
        }

        const handleLoadedMeta = () => {
            blurredVideo.muted = true
            blurredVideo.playbackRate = mainVideo.playbackRate
            syncTime()
        }

        const handleSeeking = () => {
            syncTime()
        }

        mainVideo.play().catch(error => console.error(`Error playing main video: ${error.message}`))

        mainVideo.addEventListener('play', handlePlay)
        mainVideo.addEventListener('pause', handlePause)
        mainVideo.addEventListener('timeupdate', syncTime)
        mainVideo.addEventListener('ratechange', handleRateChange)
        mainVideo.addEventListener('loadedmetadata', handleLoadedMeta)
        mainVideo.addEventListener('seeking', handleSeeking)

        return () => {
            mainVideo.removeEventListener('play', handlePlay)
            mainVideo.removeEventListener('pause', handlePause)
            mainVideo.removeEventListener('timeupdate', syncTime)
            mainVideo.removeEventListener('ratechange', handleRateChange)
            mainVideo.removeEventListener('loadedmetadata', handleLoadedMeta)
            mainVideo.removeEventListener('seeking', handleSeeking)
        }
    }, [])

    /**
     * Handle filename input changes.
     */
    const handleFilenameChange = (e) => {
        const val = e.target?.value ?? ''
        _videoBlob.current.filename = val
        if (!val.length) {
            const rec = window.__?.recorder
            _videoBlob.current.filename = typeof rec?.filename === 'function'
                                          ? rec.filename({filename: APP_KEY})
                                          : APP_KEY
        }
        setFilename(_videoBlob.current.filename)
    }

    /**
     * Handle share action.
     */
    const handleShare = useCallback(async () => {
        try {
            const blob = _videoBlob.current?.blob
            const filename = `${(_videoBlob.current?.filename).sanitize()}.${lgs.settings.ui.video.format}`
            console.log(filename)
            const file = new File([blob], filename, {type: blob.type || 'video/mp4'})

            if (blob && navigator.canShare && navigator.canShare({files: [file]})) {
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
                                          text:  'Check out my video created with LGS1920 Studio!',
                                          url: _videoBlob.current.url || '',
                                      })
            }
            else {
                console.error('Web Share API not supported')
            }
        }
        catch (error) {
            console.log(error)
            console.error(`Error during share: ${error.message}`)
        }
    }, [])

    /**
     * Handle save action with download.
     */
    const handleDownload = async () => {
        const blob = _videoBlob.current?.blob
        if (!(blob instanceof Blob) || blob.size === 0) {
            console.error('Invalid video blob')
            return
        }

        try {
            const nameBase = (_videoBlob.current.filename).trim().replace(/[\/\\:*?"<>|]/g, '_')
            await __.recorder.download({
                                           filename: nameBase,
                                           type:     'local-filesystem',
                                       })
        }
        catch (error) {
            console.error(`Error during download: ${error.message}`)
        }
    }

    /**
     * Handle cancel action.
     */
    const handleCancel = () => {
        setDialogOpen(false)
        if (_videoBlob.current.url) {
            try {
                URL.revokeObjectURL(_videoBlob.current.url)
            }
            catch {
            }
        }
        _videoBlob.current = {}
        $video.editing = false
    }

    /**
     * Handle continue action after download.
     */
    const handleContinue = useCallback(() => {
        __.recorder.filename = ''
        setDialogOpen(false)
        if (_videoBlob.current.url) {
            try {
                URL.revokeObjectURL(_videoBlob.current.url)
            }
            catch {
            }
        }
        _videoBlob.current = {}
        $video.editing = false
        console.log('Dialog closed after conversion')
    }, [$video])

    /**
     * Handle dialog close event to prevent closing via ESC or overlay.
     */
    const handleDialogClose = useCallback((event) => {
        if (event.detail?.source === 'close-button') {
            handleCancel()
        }
        else {
            event.preventDefault()
        }
    }, [handleCancel])

    return (
        <SlDialog
            id="video-preview-dialog"
            open={dialogOpen}
            onSlRequestClose={handleDialogClose}
            className="lgs-theme"
        >
            <div slot="label">
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFilm)}/>
                Download your video
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
            </div>
            <LGSScrollbars autoHide autoHeight>
                <SlInput
                    label="Video file name"
                    size="small"
                    name="video-file-name"
                    value={filename}
                    onSlInput={handleFilenameChange}
                />
            </LGSScrollbars>
            <div slot="footer" id="video-preview-dialog-footer">
                <SlTooltip content="Cancel">
                    <SlButton onClick={handleCancel}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                        Cancel
                    </SlButton>
                </SlTooltip>
                <SlTooltip content="Share your video">
                    <SlIconButton
                        library="fa"
                        name={FA2SL.set(faShareAlt)}
                        onClick={handleShare}
                    />
                </SlTooltip>
                <SlTooltip content="Save your video">
                    <SlButton variant="primary" onClick={handleDownload}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDownload)}/>
                        Download
                    </SlButton>
                </SlTooltip>
            </div>
        </SlDialog>
    )
}