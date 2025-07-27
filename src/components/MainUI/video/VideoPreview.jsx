/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-27
 * Last modified: 2025-07-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGSScrollbars }                                     from '@Components/MainUI/LGSScrollbars'
import { VideoConverter }                                    from '@Core/ui/video/converter/VideoConverter'
import { VideoRecorder }                                     from '@Core/ui/video/recorder/VideoRecorder'
import { faDownload, faXmark }                               from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton,
    SlDetails,
    SlDialog,
    SlDivider,
    SlIcon,
    SlInput,
    SlOption,
    SlProgressBar,
    SlSelect,
    SlTooltip,
}                                                            from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                                             from '@Utils/FA2SL'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSnapshot }                                       from 'valtio/index'

// Constants
const AVAILABLE_FORMATS = VideoConverter.getAvailableFormats()
const QUALITY_PRESETS = VideoConverter.getQualityPresets()

export const VideoPreview = () => {
    const [videoUrl, setVideoUrl] = useState(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [videoBlob, setVideoBlob] = useState(null)
    const [isConverting, setIsConverting] = useState(false)
    const [conversionProgress, setConversionProgress] = useState(0)
    const [conversionLogs, setConversionLogs] = useState([])
    const dialogRef = useRef(null)
    const converterRef = useRef(null)
    const mainVideoRef = useRef(null)
    const blurredVideoRef = useRef(null)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    // Memoized final filename
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
                                                      onProgress: ({percentage, time}) => {
                                                          const clampedPercentage = Math.max(0, Math.min(100, percentage || 0))
                                                          setConversionProgress(clampedPercentage)
                                                          setConversionLogs((prev) => [...prev, `Progress: ${clampedPercentage}%`])
                                                      },
                                                      onLog:      (message) => {
                                                          setConversionLogs((prev) => [...prev, message])
                                                      },
                                                  })

        converterRef.current.loadFFmpeg().catch((error) => {
            setConversionLogs((prev) => [...prev, `Error: Failed to load FFmpeg: ${error.message}`])
        })

        const handleStop = ({detail: {blob}}) => {
            if (!(blob instanceof Blob) || blob.size === 0) {
                setConversionLogs((prev) => [
                    ...prev,
                    `Error: Invalid video blob (type: ${blob?.type}, size: ${blob?.size})`,
                ])
                alert('Invalid video recorded. Please try again.')
                return
            }
            const url = URL.createObjectURL(blob)
            setVideoBlob(blob)
            setVideoUrl(url)
            setIsDialogOpen(true)
        }

        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStop)

        return () => {
            __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStop)
            if (videoUrl) {
                URL.revokeObjectURL(videoUrl)
            }
            if (converterRef.current) {
                converterRef.current.destroy()
                converterRef.current = null
            }
        };
    }, [videoUrl]);

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
    }, [videoUrl]);

    const handleFilenameChange = useCallback((e) => {
        __.recorder.filename = e.target.value
        $video.filename = e.target.value
    }, [$video])

    const handleFormatChange = useCallback(
        (event) => {
            event.stopPropagation()
            event.preventDefault()
            $video.format = event.target.value
        },
        [$video],
    )

    const handleQualityChange = useCallback(
        (event) => {
            event.stopPropagation()
            event.preventDefault()
            $video.quality = event.target.value
        },
        [$video],
    )

    const handleSave = useCallback(async () => {
        if (!videoBlob || !(videoBlob instanceof Blob) || videoBlob.size === 0) {
            setConversionLogs((prev) => [...prev, 'Error: Invalid video blob'])
            return
        }

        setIsConverting(true)
        setConversionLogs([])
        setConversionProgress(0)

        try {
            const fileExtension = AVAILABLE_FORMATS[video.format]?.extension || 'webm'
            let finalBlob = videoBlob
            let mimeType = AVAILABLE_FORMATS[video.format]?.mimeType || videoBlob.type

            if (video.format !== 'WEBM' && converterRef.current) {
                finalBlob = await converterRef.current.convertVideo(videoBlob, video.format, {
                    quality:        video.quality,
                    outputFileName: `converted.${fileExtension}`,
                })
                mimeType = AVAILABLE_FORMATS[video.format].mimeType
            }

            const url = URL.createObjectURL(new Blob([finalBlob], {type: mimeType}))
            const link = document.createElement('a')
            link.href = url
            link.download = finalFilename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            setConversionLogs((prev) => [
                finalBlob !== videoBlob
                ? `Conversion successful: ${video.format} (${(finalBlob.size / 1000000).toFixed(2)} MB)`
                : '',
                `Downloading: ${finalFilename}`,
            ])
        }
        catch (error) {
            setConversionLogs((prev) => [...prev, `Error: ${error.message}`])
        }
        finally {
            setIsConverting(false)
        }
    }, [videoBlob, video.format, video.quality, finalFilename]);

    const handleCancel = useCallback(() => {
        if (isConverting) {
            return
        }
        setIsDialogOpen(false)
        setVideoUrl(null)
        setVideoBlob(null)
        __.recorder.filename = ''
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl)
        }
        $video.edit = false
    }, [isConverting, videoUrl, $video]);

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
    );

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
                <form onSubmit={(e) => e.preventDefault()}>
                    <div className="video-file-name-quality-format">
                        <SlInput
                            size="small"
                            label="Video file name prefix"
                            name="video-file-name"
                            value={video.filename || __.recorder.filename}
                            onSlInput={handleFilenameChange}
                            disabled={isConverting}
                        />
                        <SlSelect
                            size="small"
                            label="Output Format"
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
                            label="Quality Preset"
                            value={video.quality || 'MEDIUM'}
                            onSlChange={handleQualityChange}
                            disabled={isConverting}
                        >
                            {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                                <SlOption key={key} value={key}>
                                    {preset.description}
                                </SlOption>
                            ))}
                        </SlSelect>
                    </div>
                    <div>
                        Final filename: <code>{finalFilename}</code>
                    </div>
                    {isConverting && (
                        <div>
                            <SlProgressBar value={conversionProgress}>{conversionProgress}%</SlProgressBar>
                        </div>
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
                        Cancel
                    </SlButton>
                </SlTooltip>
                <SlTooltip content={isConverting ? 'Converting video...' : 'Save your video.'}>
                    <SlButton variant="primary" onClick={handleSave} disabled={isConverting}>
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDownload)}/>
                        {isConverting ? `Converting... ${conversionProgress}%` : 'Download'}
                    </SlButton>
                </SlTooltip>
            </div>
        </SlDialog>
    );
};