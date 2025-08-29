/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConverterAndDownloader.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-29
 * Last modified: 2025-08-29
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                                       from '@Components/MainUI/LGSScrollbars'
import { APP_KEY }                                             from '@Core/constants'
import { VideoConverter }                                      from '@Core/ui/video/converter/VideoConverter'
import { VideoRecorder }                                       from '@Core/ui/video/recorder/VideoRecorder'
import { faDownload, faXmark, faShareAlt, faFilm }             from '@fortawesome/pro-regular-svg-icons'
import { faGearComplex }                                       from '@fortawesome/pro-solid-svg-icons'
import { SlButton, SlDialog, SlIcon, SlIconButton, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import { VideoConversionSettings }                             from './VideoConversionSettings'
import { VideoPostConversion }                                 from './VideoPostConversion'
import './style.css'
import { FA2SL }                                               from '@Utils/FA2SL'
import classNames                                              from 'classnames'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                         from 'valtio/index'

// Constants
const AVAILABLE_FORMATS = VideoConverter.getAvailableFormats()

/**
 * VideoConverterAndDownloader component for previewing and converting recorded videos
 * @returns {JSX.Element} Video preview dialog with conversion options
 */
export const VideoConverterAndDownloader = () => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const [videoBlob, setVideoBlob] = useState(null)
    const [, setConversionLogs] = useState([])

    const _dialog = useRef(null)
    const _converter = useRef(null)
    const _mainVideo = useRef(null)
    const _blurredVideo = useRef(null)

    // Memoized dialog title based on conversion state
    const dialogTitle = useMemo(() => {
        const setup = video.conversion.doConversion ? 'Video Conversion Setup' : 'Video Downloading'
        return video.conversion.isConverted ? 'Video Conversion Completed' : setup
    }, [video.conversion.isConverted, video.conversion.doConversion])

    // Initialize VideoConverter and set default format/quality
    useEffect(() => {
        if (!$video.format) {
            $video.format = 'MP4'
        }
        if (!$video.quality) {
            $video.quality = 'MEDIUM'
        }

        _converter.current = new VideoConverter({
                                                    onProgress: ({percentage, time, duration}) => {
                                                        $video.conversion.progress.percentage = percentage
                                                        $video.conversion.duration = duration
                                                        $video.conversion.convertedTime = time
                                                        setConversionLogs((prev) => [
                                                            ...prev,
                                                            percentage === 100 ? `Conversion completed: ${percentage}%` : `Progress: ${percentage.toFixed(2)}% (${time}s)`,
                                                        ])
                                                    },
                                                    onLog:      (message) => {
                                                        setConversionLogs((prev) => [...prev, message])
                                                    },
                                                    backend:    lgs.BACKEND_API,
                                                    sse:        false,
                                                    debug:      true,
                                                })

        // Set initial filename
        $video.conversion.finalFilename = _converter.current.fileName($video.format, $video.filename || 'LGS1920')

        const handleStopRecording = ({detail: {blob, duration, metadata}}) => {
            if (!(blob instanceof Blob) || blob.size === 0) {
                setConversionLogs((prev) => [
                    ...prev,
                    `Error: Invalid video blob (type: ${blob?.type}, size: ${blob?.size})`,
                ])
                $video.conversion.errorMessage = 'Error during conversion: Invalid video blob'
                return
            }
            const url = URL.createObjectURL(blob)
            const blobExtension = blob.name ? blob.name.split('.').pop().toLowerCase() : ''
            const formatFromMime = Object.keys(AVAILABLE_FORMATS).find(
                (key) => AVAILABLE_FORMATS[key].mimeType === blob.type,
            )
            const formatFromExtension = Object.keys(AVAILABLE_FORMATS).find(
                (key) => AVAILABLE_FORMATS[key].extension === blobExtension,
            )
            const detectedFormat = formatFromMime || formatFromExtension || 'WEBM'
            $video.conversion.inputFormat = detectedFormat
            setVideoBlob(blob)
            $video.conversion.videoUrl = url
            $video.conversion.isDialogOpen = true
            $video.conversion.metadata = metadata
            $video.conversion.duration = duration
            // Initialize doConversion based on input format
            $video.conversion.doConversion = $video.format !== detectedFormat

            setConversionLogs((prev) => [
                ...prev,
                `Video blob received: type=${blob.type}, size=${(blob.size / 1000000).toFixed(2)}MB`,
            ])
        }
        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStopRecording)

        return () => {
            __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStopRecording)
            if (video.conversion.videoUrl) {
                URL.revokeObjectURL(video.conversion.videoUrl)
            }
            if (video.conversion.convertedVideoUrl) {
                URL.revokeObjectURL(video.conversion.convertedVideoUrl)
            }
            if (_converter.current) {
                _converter.current.destroy()
                _converter.current = null
            }
        }
    }, [video.conversion.videoUrl, video.conversion.convertedVideoUrl])

    // Synchronize blurred video with main video and start playback
    useEffect(() => {
        const mainVideo = _mainVideo.current
        const blurredVideo = _blurredVideo.current

        if (!mainVideo || !blurredVideo || (!video.conversion.videoUrl && !video.conversion.convertedVideoUrl)) {
            return
        }

        const syncVideos = () => {
            blurredVideo.currentTime = mainVideo.currentTime
        }

        const handlePlay = () => {
            blurredVideo.play().catch((error) => {
                setConversionLogs((prev) => [...prev, `Error playing blurred video: ${error.message}`])
                $video.conversion.errorMessage = `Error during conversion: ${error.message}`
            })
        }

        const handlePause = () => {
            blurredVideo.pause()
        }

        mainVideo.play().catch((error) => {
            setConversionLogs((prev) => [...prev, `Error playing main video: ${error.message}`])
            $video.conversion.errorMessage = `Error during conversion: ${error.message}`
        })

        mainVideo.addEventListener('play', handlePlay)
        mainVideo.addEventListener('pause', handlePause)
        mainVideo.addEventListener('timeupdate', syncVideos)

        return () => {
            mainVideo.removeEventListener('play', handlePlay)
            mainVideo.removeEventListener('pause', handlePause)
            mainVideo.removeEventListener('timeupdate', syncVideos)
        }
    }, [video.conversion.videoUrl, video.conversion.convertedVideoUrl])

    // Update main video source after conversion
    useEffect(() => {
        if (video.conversion.isConverted && video.conversion.convertedVideoUrl && _mainVideo.current && _blurredVideo.current) {
            _mainVideo.current.src = video.conversion.convertedVideoUrl
            _blurredVideo.current.src = video.conversion.convertedVideoUrl
        }
    }, [video.conversion.isConverted, video.conversion.convertedVideoUrl])

    // Update filename when format or filename changes
    useEffect(() => {
        $video.conversion.finalFilename = _converter.current.fileName(video.format, video.filename || APP_KEY)
    }, [video.format, video.filename])

    // Handle filename input changes
    const handleFilenameChange = useCallback((e) => {
        __.recorder.filename = e.target.value
        $video.filename = e.target.value
    }, [$video])

    // Handle output format selection
    const handleFormatChange = useCallback(
        (event) => {
            event.stopPropagation()
            event.preventDefault()
            const newFormat = event.target.value
            // Compare with inputFormat to determine if conversion is needed
            $video.conversion.doConversion = newFormat !== $video.conversion.inputFormat
            $video.format = newFormat
            if (newFormat === 'WEBM') {
                $video.quality = 'MEDIUM'
            }
        },
        [$video],
    )

    // Handle quality preset selection
    const handleQualityChange = useCallback(
        (event) => {
            event.stopPropagation()
            event.preventDefault()
            $video.quality = event.target.value
        },
        [$video],
    )

    // Generate final filename for conversion
    const generateFinalFilename = (format, filename) => {
        return _converter.current.fileName(format, filename || 'LGS1920')
    }

    // Handle share action
    const handleShare = useCallback(async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                                          title: 'LGS1920 Video',
                                          text:  'Check out my video created with LGS1920!',
                                          url:   video.conversion.convertedVideoUrl,
                                      })
            }
            else {
                $video.conversion.errorMessage = 'Error during conversion: Web Share API is not supported in this browser.'
            }
        }
        catch (error) {
            $video.conversion.errorMessage = `Error during conversion: ${error.message}`
        }
    }, [video.conversion.convertedVideoUrl])

    // Handle save action with conversion and download
    const handleConvertAndDownload = useCallback(async () => {
        if (video.conversion.isConverting) {
            setConversionLogs((prev) => [...prev, 'Conversion already in progress'])
            $video.conversion.errorMessage = 'Error during conversion: Conversion already in progress'
            return
        }

        if (!videoBlob || !(videoBlob instanceof Blob) || videoBlob.size === 0) {
            setConversionLogs((prev) => [...prev, 'Error: Invalid video blob'])
            $video.conversion.errorMessage = 'Error during conversion: Invalid video blob'
            return
        }

        $video.conversion.isConverting = true
        setConversionLogs((prev) => [...prev, 'Starting download process'])
        $video.conversion.progress.percentage = 0
        $video.conversion.errorMessage = null

        try {
            setConversionLogs((prev) => [
                ...prev,
                `Starting conversion to ${video.conversion.finalFilename}`,
            ])
            let finalBlob = videoBlob

            if (video.conversion.doConversion) {
                finalBlob = await _converter.current.convertVideo(videoBlob, video.conversion.inputFormat, video.format, {
                    quality:        video.quality,
                    outputFileName: video.conversion.finalFilename,
                    metadata:       video.conversion.metadata,
                    duration:       video.conversion.duration,
                    customEncoding: AVAILABLE_FORMATS[video.format],
                    audio:          VideoConverter.AUDIO_ENCODE.NONE,
                })
            }
            const mimeType = AVAILABLE_FORMATS[video.format].mimeType
            setConversionLogs((prev) => [
                ...prev,
                `Received converted blob: type=${finalBlob.type}, size=${(finalBlob.size / 1000000).toFixed(2)}MB`,
            ])

            const url = URL.createObjectURL(new Blob([finalBlob], {type: mimeType}))
            $video.conversion.convertedVideoUrl = url
            $video.conversion.isConverted = true
            setVideoBlob(finalBlob)

            setConversionLogs((prev) => [...prev, `Created download URL: ${url}`])
            const link = document.createElement('a')
            link.href = url
            link.download = video.conversion.finalFilename
            document.body.appendChild(link)
            setConversionLogs((prev) => [...prev, `Triggering download for ${video.conversion.finalFilename}`])
            link.click()
            document.body.removeChild(link)
            setConversionLogs((prev) => [
                ...prev,
                `Download initiated for ${video.conversion.finalFilename}`,
            ])

            setConversionLogs((prev) => [
                ...prev,
                finalBlob !== videoBlob
                ? `Conversion successful: ${video.format} (${(finalBlob.size / 1000000).toFixed(2)} MB)`
                : `No conversion needed: ${video.format} (${(finalBlob.size / 1000000).toFixed(2)} MB)`,
                `Downloading: ${video.conversion.finalFilename}`,
            ])
        }
        catch (error) {
            setConversionLogs((prev) => [...prev, `Error: ${error.message}`])
            $video.conversion.errorMessage = `Error during conversion: ${error.message}`
        }
        finally {
            $video.conversion.isConverting = false
        }
    }, [videoBlob, video.format, video.quality, video.conversion.inputFormat, video.conversion.metadata, video.conversion.duration, video.conversion.finalFilename])

    // Handle cancel action
    const handleCancel = useCallback(() => {
        $video.conversion.isDialogOpen = false
        $video.conversion.videoUrl = null
        setVideoBlob(null)
        $video.conversion.convertedVideoUrl = null
        $video.conversion.isConverted = false
        $video.conversion.isConverting = false
        $video.conversion.progress.percentage = 0
        $video.conversion.errorMessage = null
        __.recorder.filename = ''
        if (video.conversion.videoUrl) {
            URL.revokeObjectURL(video.conversion.videoUrl)
        }
        if (video.conversion.convertedVideoUrl) {
            URL.revokeObjectURL(video.conversion.convertedVideoUrl)
        }
        $video.editing = false
        setConversionLogs((prev) => [...prev, 'Dialog closed and resources cleaned up'])
    }, [video.conversion.videoUrl, video.conversion.convertedVideoUrl, $video])

    // Handle continue action after conversion
    const handleContinue = useCallback(() => {
        $video.conversion.isDialogOpen = false
        $video.conversion.videoUrl = null
        setVideoBlob(null)
        $video.conversion.convertedVideoUrl = null
        $video.conversion.isConverted = false
        $video.conversion.isConverting = false
        $video.conversion.progress.percentage = 0
        $video.conversion.errorMessage = null
        __.recorder.filename = ''
        if (video.conversion.videoUrl) {
            URL.revokeObjectURL(video.conversion.videoUrl)
        }
        if (video.conversion.convertedVideoUrl) {
            URL.revokeObjectURL(video.conversion.convertedVideoUrl)
        }
        $video.editing = false
        setConversionLogs((prev) => [...prev, 'Dialog closed after conversion'])
    }, [video.conversion.videoUrl, video.conversion.convertedVideoUrl, $video])

    // Handle dialog close event to prevent closing via ESC or overlay
    const handleDialogClose = useCallback(
        (event) => {
            // Only allow closing via the dialog's close button (native X button)
            if (event.detail?.source === 'close-button') {
                handleCancel()
            }
            else {
                event.preventDefault() // Prevent closing via ESC or overlay
            }
        },
        [handleCancel],
    )

    // Display text for the main button
    const setMainButtonText = useCallback(
        () => {
            if (video.conversion.isConverting) {
                return video.conversion.doConversion ? `Converting...` : 'Downloading'
            }
            if (video.conversion.isConverted) {
                return 'Close'
            }
            return video.conversion.doConversion ? 'Convert' : 'Download'
        },
        [video.conversion.isConverting, video.conversion.isConverted, video.conversion.doConversion],
    )

    // Display Icon for the main button
    const setMainButtonIcon = useCallback(
        () => {
            if (video.conversion.isConverted) {
                return faXmark
            }
            return video.conversion.doConversion ? faGearComplex : faDownload
        },
        [video.conversion.isConverting, video.conversion.isConverted, video.conversion.doConversion],
    )

    return (
        <SlDialog
            id="video-preview-dialog"
            open={video.conversion.isDialogOpen}
            onSlRequestClose={handleDialogClose}
            ref={_dialog}
            className="lgs-theme"
        >
            <div slot="label">
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faFilm)}/>
                {dialogTitle}
            </div>

            {(video.conversion.videoUrl || video.conversion.convertedVideoUrl) && (
                <div className="video-container">
                    <video
                        ref={_mainVideo}
                        controls
                        autoPlay
                        src={video.conversion.isConverted ? video.conversion.convertedVideoUrl : video.conversion.videoUrl}
                        className="main-video"
                    />
                    <div className="blurred-video-wrapper">
                        <video
                            ref={_blurredVideo}
                            src={video.conversion.isConverted ? video.conversion.convertedVideoUrl : video.conversion.videoUrl}
                            className="blurred-video"
                            muted
                            autoPlay
                        />
                    </div>
                </div>
            )}
            <LGSScrollbars autoHide autoHeight>
                {!video.conversion.isConverted && (
                    <VideoConversionSettings
                        handleFormatChange={handleFormatChange}
                        handleQualityChange={handleQualityChange}
                        handleFilenameChange={handleFilenameChange}
                    />
                )}
                {video.conversion.isConverted && <VideoPostConversion videoBlob={videoBlob}/>}
            </LGSScrollbars>
            <div slot="footer" id="video-preview-dialog-footer">
                {!video.conversion.isConverted && (
                    <SlTooltip
                        content={video.conversion.isConverting ? `Cancel ${video.conversion.doConversion ? 'conversion' : 'downloading'}` : 'Cancel recording'}>
                        <SlButton onClick={handleCancel}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                            {'Cancel'}
                        </SlButton>
                    </SlTooltip>
                )}
                {video.conversion.isConverted && (
                    <SlTooltip content="Share video">
                        <SlIconButton
                            library="fa"
                            name={FA2SL.set(faShareAlt)}
                            onClick={handleShare}
                        />
                    </SlTooltip>
                )}
                <SlTooltip
                    content={video.conversion.isConverting ? 'Converting video...' : video.conversion.isConverted ? 'Close dialog' : 'Save your video.'}
                >
                    <SlButton
                        className={classNames('conversion-trigger', {'video-conversion-in-progress': video.conversion.isConverting})}
                        variant={video.conversion.isConverting ? 'warning' : 'primary'}
                        onClick={video.conversion.isConverted ? handleContinue : handleConvertAndDownload}
                    >
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(setMainButtonIcon())}/>
                        {setMainButtonText()}
                    </SlButton>
                </SlTooltip>
            </div>
        </SlDialog>
    )
}