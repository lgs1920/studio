/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoDownloadAndShareDialog.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-27
 * Last modified: 2026-02-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * @file VideoDownloadAndShareDialog.jsx
 * @description Optimized component for previewing and downloading recorded videos.
 * Prevents errors on _mediaData access by using Valtio snapshot safely.
 * Uses Shoelace web components and FontAwesome icons.
 * All refs prefixed with _, no default export, no semicolons.
 */


import { ScreenMediaRecorder } from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import {
    faCameraPolaroid, faCropAlt, faDownload, faFile, faFilm, faHourglass, faShareAlt, faXmark,
}                              from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlDialog, SlIcon, SlInput, SlTooltip,
}                      from '@shoelace-style/shoelace/dist/react'
import {
    FA2SL,
}                              from '@Utils/FA2SL'
import {
    UIToast,
}                      from '@Utils/UIToast'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot } from 'valtio'
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
    const _mediaBlob = useRef({blob: null, url: null, filename: ''})
    const _mediaData = useRef(null)

    /**
     * Safely accesses media data from recorder with fallback.
     * @returns {Object} Media stats with default values
     */
    const getMediaData = useCallback(() => {
        const fallback = {
            size:       0,
            duration:   0,
            fps:        0,
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

            const url = URL.createObjectURL(blob)
            const recorderFilename = __.recorder.filename({}) || 'video'
            const safeFilename = recorderFilename.replace(/[^a-zA-Z0-9_-]/g, '_')

            _mediaBlob.current = {
                blob,
                url,
                filename: safeFilename,
                type:     ScreenMediaRecorder.VIDEO,
            }
            setFilename(safeFilename)
            setCanDownloadAndShare(true)
            setDialogOpen(true)
        }

        const handleCapture = (event) => {
            const {canvas} = event.detail
            const recorderFilename = __.recorder.filename({}) || 'record'
            const safeFilename = recorderFilename.replace(/[^a-zA-Z0-9_-]/g, '_')
            _mediaBlob.current = {
                content: canvas.toDataURL(`image/${lgs.settings.ui.video.image}`, 1.0),
                filename: safeFilename,
                type:     ScreenMediaRecorder.IMAGE,
            }
            setFilename(safeFilename)
            setCanDownloadAndShare(true)
            $video.snapshot = false
            setDialogOpen(true)
        }


        __.recorder.addEventListener(ScreenMediaRecorder.events.STOP, handleStopRecording)
        __.recorder.addEventListener(ScreenMediaRecorder.events.CAPTURED, handleCapture)

        return () => {
            __.recorder.removeEventListener(ScreenMediaRecorder.events.STOP, handleStopRecording)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.CAPTURED, handleCapture)

            if (_mediaBlob.current.url) {
                URL.revokeObjectURL(_mediaBlob.current.url)
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
        _mediaBlob.current.filename = sanitized
        const canProceed = sanitized.length > 0
        setCanDownloadAndShare(canProceed)
        setFilename(sanitized)
    }, [])

    /**
     * Handle share action with Web Share API fallback.
     */
    const handleShare = useCallback(async () => {

        const getVideoFile = async () => {
            const blob = _mediaBlob.current.blob
            const filename = `${_mediaBlob.current.filename}.${lgs.settings.ui.video.format}`
            return new File([blob], filename, {type: blob.type || 'video/mp4'})
        }


        const getImageFile = async () => {
            const base64 = _mediaBlob.current.content
            const blob = __.tools.base64ToBlob(base64)
            _mediaBlob.current.blob = blob

            const filename = `${_mediaBlob.current.filename}.${lgs.settings.ui.video.image}`
            return new File([blob], filename, {type: blob.type})
        }
        _mediaData.current = getMediaData()

        const file = __.recorder.isVideo() ? await getVideoFile() : await getImageFile()
        const media = __.recorder.isVideo() ? 'video' : 'shot'
        try {
            if (navigator.canShare?.({files: [file]})) {
                await navigator.share({
                                          title: 'LGS1920 Studio Video',
                                          text: `Check out my last ${media} created with LGS1920 Studio!`,
                                          files: [file],
                                      })
                return
            }
            if (navigator.share && __.recorder.isVideo()) {
                await navigator.share({
                                          title: 'LGS1920 Studio Video',
                                          text: `Check out my last ${media}  created with LGS1920 Studio!`,
                                          url:  _mediaBlob.current.url,
                                      })
                return
            }
            UIToast.success({
                                caption: `Share your ${media}`,
                                text:    'Sorry, this is not supported by your browser. Please try again with a modern browser.',
                            })

        }
        catch (error) {
            console.error('Share failed:', error.message)
        }
    }, [])

    _mediaData.current = getMediaData()


    /**
     * Handle download via recorder API.
     */
    const handleDownload = useCallback(async () => {
        try {
            if (__.recorder.isVideo()) {
                const blob = _mediaBlob.current.blob
                if (!blob || blob.size === 0) {
                    return
                }
                await __.recorder.download({
                                               filename: `${_mediaBlob.current.filename}.${lgs.settings.ui.video.format}`,
                                               type:     'local-filesystem',
                                           })
            }
            else {
                await __.recorder.download({
                                               filename: `${_mediaBlob.current.filename}.${lgs.settings.ui.video.image}`,
                                               type:     'local-filesystem',
                                           })
            }
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
        if (_mediaBlob.current.url) {
            URL.revokeObjectURL(_mediaBlob.current.url)
        }
        _mediaBlob.current = {blob: null, url: null, filename: ''}
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

    console.log('>>>>', lgs.settings.ui.video?.adaptiveQuality?.enabled)
    return (
        <SlDialog
            id="video-preview-dialog"
            open={dialogOpen}
            onSlRequestClose={handleDialogClose}
            className="lgs-theme"
        >
            <div slot="label">
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(__.recorder.isVideo() ? faFilm : faCameraPolaroid)}/>
                {`Download ${__.app.canShare() ? 'and Share ' : ''}${__.recorder.isVideo() ? 'your video' : 'your screenshot'}`}
            </div>

            <div className="video-container">
                {__.recorder.isVideo() ? (
                    <>
                        <video
                            ref={_mainVideo}
                            src={_mediaBlob.current.url}
                            controls
                            autoPlay
                            className="main-video"
                        />

                        <div className="blurred-video-wrapper">
                            <video
                                ref={_blurredVideo}
                                src={_mediaBlob.current.url}
                                className="blurred-video"
                                muted
                                autoPlay
                            />
                        </div>
                    </>
                ) : (
                     <>
                         <img src={_mediaBlob.current.content} alt="Screenshot" className="main-video"/>
                         <div className="blurred-video-wrapper">
                             <img src={_mediaBlob.current.content} className="blurred-video"/>
                         </div>
                     </>
                 )}
                <div className="video-info lgs-card on-map">
                    <div>
                        <SlIcon library="fa" name={FA2SL.set(faCropAlt)}/>
                        {_mediaData.current.ratio.label} - {_mediaData.current.dimensions.width}x{_mediaData.current.dimensions.height}
                    </div>
                    <div>
                        <SlIcon library="fa" name={FA2SL.set(faFile)}/>
                        {__.convert(_mediaData.current.size).toBytesUnit()}
                    </div>
                    {__.recorder.isVideo() &&
                        <>
                            <div>
                                <SlIcon library="fa" name={FA2SL.set(faHourglass)}/>
                                {__.convert(_mediaData.current.duration).toTime()}
                            </div>
                            {lgs.settings.ui.video?.adaptiveQuality?.enabled
                             ? (<div>{'Auto'}</div>)
                             : (
                                 <>
                                     <div>{`FPS: ${_mediaData.current.fps}`}</div>
                                     <div>{_mediaData.current.quality?.name}</div>
                                 </>
                             )
                            }
                        </>
                    }
                </div>
            </div>

            <div className="video-file-actions">
                <SlInput
                    size="small"
                    name="video-file-name"
                    onSlInput={handleFilenameChange}
                    value={filename}
                    label={'File name'}
                >
                    <span
                        slot="suffix">.{__.recorder.isVideo() ? lgs.settings.ui.video.format : lgs.settings.ui.video.image}</span>
                </SlInput>
                <div className="video-actions">
                    {__.app.canShare() && (
                        <SlTooltip content="Share your video">
                            <SlButton disabled={!canDownloadAndShare} onClick={handleShare} variant="text">
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faShareAlt)}/>
                                {__.device.isMobile ? '' : 'Share'}
                            </SlButton>
                        </SlTooltip>
                    )}


                    <SlTooltip content="Save your video">
                        <SlButton
                            variant="text"
                            onClick={handleDownload}
                            disabled={!canDownloadAndShare}
                        >
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDownload)}/>
                            {__.device.isMobile ? '' : 'Download'}
                        </SlButton>
                    </SlTooltip>
                </div>
            </div>

            <div slot="footer" id="video-preview-dialog-footer">
                <SlTooltip content="Cancel">
                    <SlButton onClick={handleCancel}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                        {'Close'}
                    </SlButton>
                </SlTooltip>
            </div>
        </SlDialog>
    )
}