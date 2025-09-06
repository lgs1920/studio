/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-06
 * Last modified: 2025-09-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoDownloadAndShareDialog - Component for previewing and downloading recorded videos.
 * @returns {JSX.Element} Dialog with video preview and download/share options.
 */
import { LGSScrollbars }                            from '@Components/MainUI/LGSScrollbars'
import {
    VideoRecorder,
} from '@Core/ui/video/recorder/VideoRecorder'
import {
    faClock, faDownload, faFile, faFilm, faFloppyDisk, faShareAlt, faXmark,
} from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlDialog, SlIcon, SlInput, SlTooltip,
} from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                    from '@Utils/FA2SL'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                              from 'valtio'
import './style.css'

export const VideoDownloadAndShareDialog = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [filename, setFilename] = useState('')
    const [canDownloadAndShare, setCanDownloadAndShare] = useState(true)
    const [canShare] = useState(!!(navigator.canShare && navigator.canShare({files: []})))
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
            const recorderFilename = __.recorder.filename({})

            _videoBlob.current = {blob, filename: recorderFilename, url}
            setFilename(_videoBlob.current.filename)
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
    const handleFilenameChange = (event) => {
        _videoBlob.current.filename = event.target?.value
        setCanDownloadAndShare(_videoBlob.current.filename.length > 0)
        setFilename(_videoBlob.current.filename)
    }

    /**
     * Handle share action.
     */
    const handleShare = useCallback(async () => {
        try {
            const blob = _videoBlob.current?.blob
            const filename = `${(_videoBlob.current?.filename).sanitize()}.${lgs.settings.ui.video.format}`
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
            await __.recorder.download({
                                           filename: `${_videoBlob.current.filename}.${lgs.settings.ui.video.format}`,
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
                {`Download ${__.app.canShare() ? 'and Share ' : ''}your video`}
            </div>
            <div></div>
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
                <div className="video-info">
                    <div>

                        <SlInput
                            size="small"
                            name="video-file-name"
                            onSlInput={handleFilenameChange}
                            value={filename}
                        >
                            <SlIcon library="fa" slot="prefix" name={FA2SL.set(faFloppyDisk)}/>
                            <span slot="suffix">{`.${lgs.settings.ui.video.format}`}</span></SlInput>
                    </div>

                    <div>

                        <span><SlIcon library="fa"
                                      name={FA2SL.set(faFile)}/>{__.convert(__.recorder.size).toBytesUnit()}</span>

                        <span><SlIcon library="fa"
                                      name={FA2SL.set(faClock)}/>{__.convert(__.recorder.duration).toTime()}</span>
                    </div>
                </div>
            <div slot="footer" id="video-preview-dialog-footer">
                <SlTooltip content="Cancel">
                    <SlButton onClick={handleCancel}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                        {'Close'}
                    </SlButton>
                </SlTooltip>
                <div>
                {__.app.canShare() &&
                    <SlTooltip content="Share your video">
                        <SlButton disabled={!canDownloadAndShare} onClick={handleShare}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faShareAlt)}/>
                            {`Share`}
                            {canShare &&
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faShareAlt)}/>
                            }
                        </SlButton>
                    </SlTooltip>
                }
                <SlTooltip content="Save your video">
                    <SlButton variant="primary" onClick={handleDownload} disabled={!canDownloadAndShare}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDownload)}/>
                        {'Download'}
                    </SlButton>
                </SlTooltip>
                </div>
            </div>
        </SlDialog>
    )
}