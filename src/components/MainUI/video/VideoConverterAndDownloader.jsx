/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-24
 * Last modified: 2025-08-24
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGSScrollbars } from '@Components/MainUI/LGSScrollbars'
import {
    VideoConverter,
}                        from '@Core/ui/video/converter/VideoConverter'
import {
    VideoRecorder,
}                        from '@Core/ui/video/recorder/VideoRecorder'
import {
    faDownload, faXmark,
}                        from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlDetails, SlDialog, SlDivider, SlIcon, SlInput, SlOption, SlSelect, SlTooltip, SlProgressBar,
}                        from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }         from '@Utils/FA2SL'
import classNames        from 'classnames'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }   from 'valtio/index'

// Constants
const AVAILABLE_FORMATS = VideoConverter.getAvailableFormats()
const QUALITY_PRESETS = VideoConverter.getQualityPresets()

/**
 * VideoConverterAndDownloader component for previewing and converting recorded videos
 * @returns {JSX.Element} Video preview dialog with conversion options
 */
export const VideoConverterAndDownloader = () => {
    const [videoUrl, setVideoUrl] = useState(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [videoBlob, setVideoBlob] = useState(null)
    const [metadata, setMetadata] = useState(null)
    const [duration, setDuration] = useState(0)
    const [convertedTime, setConvertedTime] = useState(0)


    const [isConverting, setIsConverting] = useState(false)
    const [conversionLogs, setConversionLogs] = useState([])
    const [inputFormat, setInputFormat] = useState(null)
    const [progressPercentage, setProgressPercentage] = useState(0)
    const dialogRef = useRef(null)
    const converterRef = useRef(null)
    const mainVideoRef = useRef(null)
    const blurredVideoRef = useRef(null)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    // Memoized final filename based on timestamp and format
    const finalFilename = useMemo(() => {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
        const fileExtension = AVAILABLE_FORMATS[video.format]?.extension || 'webm'
        return `${timestamp}-${video.filename || 'LGS1920'}.${fileExtension}`
    }, [video.format, video.filename])

    // Initialize VideoConverter and set default format/quality
    useEffect(() => {
        if (!$video.format) {
            $video.format = 'MP4'
        }
        if (!$video.quality) {
            $video.quality = 'MEDIUM'
        }

        converterRef.current = new VideoConverter({
                                                      onProgress: ({percentage, time, duration}) => {
                                                          setProgressPercentage(percentage)
                                                          setDuration(duration)
                                                          setConvertedTime(time)
                                                          setConversionLogs((prev) => [
                                                              ...prev,
                                                              percentage === 100 ? `Conversion completed: ${percentage}%` : `Progress: ${percentage.toFixed(2)}% (${time}s)`,
                                                          ])
                                                      },
                                                      onLog:      (message) => {
                                                          console.log(message)
                                                          setConversionLogs((prev) => [...prev, message])
                                                      },
                                                      backend:    lgs.BACKEND_API,

                                                      sse:   false,
                                                      debug: true,
                                                  })

        const handleStopRecording = ({detail: {blob, duration, metadata}}) => {
            if (!(blob instanceof Blob) || blob.size === 0) {
                setConversionLogs((prev) => [
                    ...prev,
                    `Error: Invalid video blob (type: ${blob?.type}, size: ${blob?.size})`,
                ])
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
            setInputFormat(detectedFormat)
            setVideoBlob(blob)
            setVideoUrl(url)
            setIsDialogOpen(true)
            setMetadata(metadata)
            setDuration(duration)

            setConversionLogs((prev) => [
                ...prev,
                `Video blob received: type=${blob.type}, size=${(blob.size / 1000000).toFixed(2)}MB`,
            ])
        }
        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStopRecording)

        return () => {
            __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStopRecording)
            if (videoUrl) {
                URL.revokeObjectURL(videoUrl)
            }
            if (converterRef.current) {
                converterRef.current.destroy()
                converterRef.current = null
            }
        }
    }, [videoUrl])

    // Synchronize blurred video with main video
    useEffect(() => {
        const mainVideo = mainVideoRef.current
        const blurredVideo = blurredVideoRef.current

        if (!mainVideo || !blurredVideo || !videoUrl) {
            return
        }

        const syncVideos = () => {
            blurredVideo.currentTime = mainVideo.currentTime
        }

        const handlePlay = () => {
            blurredVideo.play().catch((error) => {
                setConversionLogs((prev) => [...prev, `Error playing blurred video: ${error.message}`])
            })
        }

        const handlePause = () => {
            blurredVideo.pause()
        }

        mainVideo.addEventListener('play', handlePlay)
        mainVideo.addEventListener('pause', handlePause)
        mainVideo.addEventListener('timeupdate', syncVideos)

        return () => {
            mainVideo.removeEventListener('play', handlePlay)
            mainVideo.removeEventListener('pause', handlePause)
            mainVideo.removeEventListener('timeupdate', syncVideos)
        }
    }, [videoUrl])

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
            $video.format = event.target.value
            console.log('format changed', event.target.value)
            if (event.target.value === 'WEBM') {
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

    // Handle save action with conversion and download
    const handleConvertAndDownload = useCallback(async () => {
        if (isConverting) {
            setConversionLogs((prev) => [...prev, 'Conversion already in progress'])
            return
        }

        if (!videoBlob || !(videoBlob instanceof Blob) || videoBlob.size === 0) {
            setConversionLogs((prev) => [...prev, 'Error: Invalid video blob'])
            return
        }

        setIsConverting(true)
        setConversionLogs((prev) => [...prev, 'Starting download process'])
        setProgressPercentage(0)

        try {
            const fileExtension = AVAILABLE_FORMATS[video.format]?.extension || 'webm'
            let finalBlob = videoBlob

            setConversionLogs((prev) => [
                ...prev,
                `Starting conversion to ${finalFilename}`,
            ])
            finalBlob = await converterRef.current.convertVideo(videoBlob, inputFormat, video.format, {
                quality:        video.quality,
                outputFileName: finalFilename,
                metadata:       metadata,
                duration:       duration,
                customEncoding: AVAILABLE_FORMATS[video.format],
                audio:          VideoConverter.AUDIO_ENCODE.NONE,
            })
            const mimeType = AVAILABLE_FORMATS[video.format].mimeType
            setConversionLogs((prev) => [
                ...prev,
                `Received converted blob: type=${finalBlob.type}, size=${(finalBlob.size / 1000000).toFixed(2)}MB`,
            ])

            // Download file
            const url = URL.createObjectURL(new Blob([finalBlob], {type: mimeType}))
            setConversionLogs((prev) => [...prev, `Created download URL: ${url}`])
            const link = document.createElement('a')
            link.href = url
            link.download = finalFilename
            document.body.appendChild(link)
            setConversionLogs((prev) => [...prev, `Triggering download for ${finalFilename}`])
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
            setConversionLogs((prev) => [...prev, `Download initiated for ${finalFilename}`])

            setConversionLogs((prev) => [
                ...prev,
                finalBlob !== videoBlob
                ? `Conversion successful: ${video.format} (${(finalBlob.size / 1000000).toFixed(2)} MB)`
                : `No conversion needed: ${video.format} (${(finalBlob.size / 1000000).toFixed(2)} MB)`,
                `Downloading: ${finalFilename}`,
            ])
        }
        catch (error) {
            setConversionLogs((prev) => [...prev, `Error: ${error.message}`])
        }
        finally {
            setIsConverting(false)
            setProgressPercentage(0)
        }
    }, [videoBlob, video.format, video.quality, finalFilename, inputFormat])

    // Handle cancel action
    const handleCancel = useCallback(() => {
        if (isConverting) {
            setConversionLogs((prev) => [...prev, 'Cannot cancel while converting'])
            return
        }
        setIsDialogOpen(false)
        setVideoUrl(null)
        setVideoBlob(null)
        __.recorder.filename = ''
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl)
        }
        $video.editing = false
        setConversionLogs((prev) => [...prev, 'Dialog closed and resources cleaned up'])
    }, [isConverting, videoUrl, $video])


    // Handle dialog close event
    const handleDialogClose = useCallback(
        (event) => {
            if (isConverting) {
                event.preventDefault()
                return
            }
            if (
                event.eventPhase === Event.BUBBLING_PHASE &&
                (event.detail?.source === 'overlay' || event.target.tagName === 'SL-BUTTON')
            ) {
                setIsDialogOpen(false)
            }
        },
        [isConverting],
    )

    const displayTextDuringConversion = () => {
        if (!isConverting) {
            return 'Download'
        }
        if (progressPercentage >= 100) {
            return `Conversion completed`
        }
        return `Converting... ${progressPercentage.toFixed(2)}% (${(convertedTime / 1000).toFixed(2)}/${duration}s)`
    }

    return (
        <SlDialog
            label="Video Preview"
            id="video-preview-dialog"
            open={isDialogOpen}
            onSlRequestClose={handleDialogClose}
            onSlAfterHide={handleDialogClose}
            ref={dialogRef}
            className="lgs-theme"
        >
            {videoUrl && (
                <div className="video-container">
                    <video
                        ref={mainVideoRef}
                        controls
                        src={videoUrl}
                        className="main-video"
                    />
                    <div className="blurred-video-wrapper">
                        <video
                            ref={blurredVideoRef}
                            src={videoUrl}
                            className="blurred-video"
                            muted
                        />
                    </div>
                </div>
            )}
            <LGSScrollbars autoHide autoHeight>
                <form onSubmit={(e) => e.preventDefault()} className="video-preview-form">
                    <div className="video-file-name-quality-format">
                        <SlSelect
                            size="small"
                            label={'Video Format'}
                            value={video.format || 'MP4'}
                            onSlChange={handleFormatChange}
                            disabled={isConverting}
                        >
                            {Object.entries(AVAILABLE_FORMATS).map(([key, format]) => (
                                <SlOption key={key} value={key}>
                                    {format.description}
                                </SlOption>
                            ))}
                        </SlSelect>
                        <SlSelect
                            size="small"
                            label={'Quality Preset'}
                            value={video.quality || 'MEDIUM'}
                            onSlChange={handleQualityChange}
                            disabled={isConverting || video.format === inputFormat}
                        >
                            {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                                <SlOption key={key} value={key}>
                                    {preset.description}
                                </SlOption>
                            ))}
                        </SlSelect>
                    </div>
                    <div className="video-file-name-quality-format">
                        <SlInput
                            size="small"
                            label={'Video file name prefix'}
                            name="video-file-name"
                            value={video.filename || __.recorder.filename}
                            onSlInput={handleFilenameChange}
                            disabled={isConverting}
                        />
                        <div className="converted-video-file-name">
                            <span>{'File name:'}</span><span>{finalFilename}</span>
                        </div>

                    </div>
                    {progressPercentage > 0 && (
                        <SlProgressBar
                            value={progressPercentage}
                            label={'Conversion Progress'}
                            className="conversion-progress"
                        />
                    )}
                    {conversionLogs.length > 0 && (
                        <SlDetails className="conversion-logs" summary="Conversion Logs">
                            <SlDivider/>
                            <LGSScrollbars autoHide autoHeight>
                                <pre className="lgs-console">{conversionLogs.join('\n')}</pre>
                            </LGSScrollbars>
                        </SlDetails>
                    )}
                </form>
            </LGSScrollbars>
            <div slot="footer" id="video-preview-dialog-footer">
                <SlTooltip content="Cancel recording">
                    <SlButton onClick={handleCancel} disabled={isConverting}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                        {'Cancel'}
                    </SlButton>
                </SlTooltip>
                <SlTooltip content={isConverting ? 'Converting video...' : 'Save your video.'}>
                    <SlButton
                        className={classNames('conversion-trigger', {'video-conversion-in-progress': isConverting})}
                        variant={isConverting ? 'warning' : 'primary'}
                        onClick={handleConvertAndDownload}
                    >
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDownload)}/>
                        {isConverting ? `${'Converting...'} ${progressPercentage}% (${convertedTime / 1000}/${duration}s)` : 'Download'}
                    </SlButton>
                </SlTooltip>
            </div>
        </SlDialog>
    )
}