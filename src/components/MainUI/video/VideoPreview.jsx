/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-26
 * Last modified: 2025-07-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoPreview - React component to display recorded video in a dialog
 * @module VideoPreview
 */

import { VideoConverter }                                                     from '@Core/ui/video/converter/VideoConverter'
import { faDownload, faXmark }                                                from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDialog, SlIcon, SlInput, SlOption, SlSelect, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                                                              from '@Utils/FA2SL'
import { useEffect, useRef, useState }                                        from 'react'
import { useSnapshot }                                                        from 'valtio/index'

/**
 * VideoPreview component
 * @returns {JSX.Element} The video preview dialog component
 */
export const VideoPreview = () => {
    const [videoUrl, setVideoUrl] = useState(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [videoBlob, setVideoBlob] = useState(null)
    const [isConverting, setIsConverting] = useState(false)
    const [conversionProgress, setConversionProgress] = useState(0)
    const dialogRef = useRef(null)
    const converterRef = useRef(null)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    // Ajoutez un state pour les logs
    const [conversionLogs, setConversionLogs] = useState([])

    // Get available formats and quality presets
    const availableFormats = VideoConverter.getAvailableFormats()
    const qualityPresets = VideoConverter.getQualityPresets()

    useEffect(() => {
        // Initialize default values in store if not set
        if (!$video.format) {
            $video.format = 'MP4'
        }
        if (!$video.quality) {
            $video.quality = 'MEDIUM'
        }

        // Initialize converter
        if (!converterRef.current) {
            converterRef.current = new VideoConverter({
                                                          onProgress: (progress) => {
                                                              console.log('🔄 Conversion progress received:', progress)
                                                              const percentage = progress.percentage || 0
                                                              setConversionProgress(percentage)

                                                              // Ajouter au log
                                                              setConversionLogs(prev => [...prev, `Progress: ${percentage}%`])
                                                          },
                                                          onLog:      (message) => {
                                                              console.log('📝 VideoConverter log:', message)
                                                              setConversionLogs(prev => [...prev, message])
                                                          },
                                                      })
        }

        const handleStop = (e) => {
            const {blob} = e.detail
            console.log(e.detail)
            const url = URL.createObjectURL(blob)
            setVideoBlob(blob)
            setVideoUrl(url)
            setIsDialogOpen(true)
        }

        __.recorder.addEventListener('video/stop', handleStop)

        return () => {
            __.recorder.removeEventListener('video/stop', handleStop)
            if (videoUrl) {
                URL.revokeObjectURL(videoUrl)
            }
            // Dans le useEffect qui initialise le converter
            if (converterRef.current) {
                converterRef.current.destroy()
                converterRef.current = null
            }
        }
    }, [])

    /**
     * Handles changes to the filename input
     */
    const handleFilenameChange = (e) => {
        __.recorder.filename = e.target.value
    }

    /**
     * Handles format selection change
     */
    const handleFormatChange = (event) => {
        event.stopPropagation()
        event.preventDefault()
        $video.format = event.target.value
    }

    /**
     * Handles quality preset selection change
     */
    const handleQualityChange = (event) => {
        event.stopPropagation()
        event.preventDefault()
        $video.quality = event.target.value
    }

    /**
     * Handles the save button click to download the video
     */
    const handleSave = async (event) => {
        if (!videoBlob) {
            return
        }

        // Generate filename with timestamp and prefix first
        const timestamp = new Date()
            .toISOString()
            .replace(/[-:]/g, '')
            .replace('T', '')
            .substring(0, 14) // YYYYMMDDHHMMSS

        const prefix = __.recorder.filename || 'video'

        try {
            setIsConverting(true)
            setConversionProgress(0)

            let finalBlob = videoBlob
            let fileExtension = 'webm'

            // Always attempt conversion based on selected format and quality
            const formatInfo = availableFormats[video.format]
            if (formatInfo) {
                fileExtension = formatInfo.extension

                // Start conversion
                console.log(`Starting conversion to ${video.format} with ${video.quality} quality`)

                finalBlob = await converterRef.current.convertVideo(
                    videoBlob,
                    video.format,
                    {
                        quality:        video.quality,
                        outputFileName: `converted.${fileExtension}`,
                    },
                )

                // Conversion successful - log success
                const conversionTime = (
                    (Date.now() - converterRef.current.currentConversion?.startTime) /
                    1000
                ).toFixed(2)
                console.log(`✅ Video conversion successful in ${conversionTime}s`)
                console.log(`Original size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`)
                console.log(`Converted size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`)

                // Save the converted file
                const filename = `${timestamp}-${prefix}.${fileExtension}`
                __.recorder.download(filename, finalBlob)

                // Dispatch success event
                __.recorder.dispatchEvent(
                    new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                        detail: {
                            filename,
                            originalSize:  videoBlob.size,
                            convertedSize: finalBlob.size,
                            format:        video.format,
                            quality:       video.quality,
                            success:       true,
                            timestamp:     Date.now(),
                        },
                    }),
                )
            }
            else {
                throw new Error(`Format ${video.format} not found in available formats`)
            }
        }
        catch (error) {
            console.error('❌ Video conversion failed:', error)

            // Conversion failed - fallback to original file with webm extension
            const fallbackFilename = `${timestamp}-${prefix}.webm`
            __.recorder.download(fallbackFilename, videoBlob)

            // Show user notification about fallback
            alert(
                `Conversion to ${video.format} failed. Downloaded original WebM file instead.\nError: ${error.message}`,
            )

            // Dispatch failure event
            __.recorder.dispatchEvent(
                new CustomEvent(VideoRecorder.events.DOWNLOAD, {
                    detail: {
                        filename:      fallbackFilename,
                        originalSize:  videoBlob.size,
                        convertedSize: videoBlob.size,
                        format:        'WEBM',
                        quality:       'ORIGINAL',
                        success:       false,
                        error:         error.message,
                        timestamp:     Date.now(),
                    },
                }),
            )
        }
        finally {
            // Reset UI state
            setIsConverting(false)
            setConversionProgress(0)
            setIsDialogOpen(false)
            setVideoUrl(null)
            setVideoBlob(null)
            __.recorder.filename = ''

            if (videoUrl) {
                URL.revokeObjectURL(videoUrl)
            }

            // Close video tools
            $video.edit = false
        }
    }

    /**
     * Handles the cancel button click to close the dialog
     */
    const handleCancel = () => {
        setIsDialogOpen(false)
        setVideoUrl(null)
        setVideoBlob(null)
        __.recorder.filename = ''
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl)
        }
        // closes video tools
        $video.edit = false
    }

    /**
     * Handles dialog close requests
     */
    const handleRequestClose = (event) => {
        // Only allow closing during the bubbling phase for overlay clicks or explicit button actions
        if (event.eventPhase === Event.BUBBLING_PHASE) {
            if (
                event.detail?.source === 'overlay' || // Clicking outside the dialog
                event.target.tagName === 'SL-BUTTON' // Clicking Cancel or Save buttons
            ) {
                if (!isConverting) {
                    // Allow close only if not converting
                    return
                }
            }
        }
        // Prevent closing for all other cases, including SlSelect interactions
        event.preventDefault()
    }

    /**
     * Handles dialog after hide events
     */
    const handleAfterHide = (event) => {
        // Prevent hide completion during bubbling phase for non-intended actions
        if (event.eventPhase === Event.BUBBLING_PHASE) {
            if (
                event.detail?.source === 'overlay' || // Allow hide for overlay clicks
                event.target.tagName === 'SL-BUTTON' // Allow hide for Cancel/Save buttons
            ) {
                if (!isConverting) {
                    setIsDialogOpen(false) // Ensure state is updated
                    return
                }
            }
            // Prevent hide for other bubbling events (e.g., from SlSelect)
            event.preventDefault()
            return
        }
        // Allow hide to complete for non-bubbling phases if not converting
        if (!isConverting) {
            setIsDialogOpen(false)
        }
    }

    return (
        <SlDialog
            label={'Video Preview'}
            id="video-preview-dialog"
            open={isDialogOpen}
            onSlRequestClose={handleRequestClose}
            onSlAfterHide={handleAfterHide}
            ref={dialogRef}
            className="lgs-theme"
        >
            {videoUrl && (
                <video
                    controls
                    src={videoUrl}
                    style={{maxWidth: '100%', marginBottom: '20px'}}
                />
            )}

            <form onSubmit={(e) => e.preventDefault()}>
                <div className="video-file-name-quality-format">
                    <SlInput
                        label="Video file name prefix"
                        name="video-file-name"
                        value={__.recorder.filename || ''}
                        onSlInput={handleFilenameChange}
                        disabled={isConverting}
                    />

                    <SlSelect
                        label="Output Format"
                        value={video.format || 'MP4'}
                        onSlChange={handleFormatChange}
                        disabled={isConverting}
                    >
                        {Object.entries(availableFormats).map(([key, format]) => (
                            <SlOption key={key} value={key}>
                                {format.description}
                            </SlOption>
                        ))}
                    </SlSelect>

                    <SlSelect
                        label="Quality Preset"
                        value={video.quality || 'MEDIUM'}
                        onSlChange={handleQualityChange}
                        disabled={isConverting}
                    >
                        {Object.entries(qualityPresets).map(([key, preset]) => (
                            <SlOption key={key} value={key}>
                                {preset.description}
                            </SlOption>
                        ))}
                    </SlSelect>
                </div>

                <div
                    style={{
                        fontSize:     '0.875rem',
                        color:        'var(--sl-color-neutral-600)',
                        marginBottom: '16px',
                    }}
                >
                    Final
                    filename:{' '}
                    <code>{`<YYYYMMDDHHMMSS>-${__.recorder.filename || 'video'}.${
                        availableFormats[video.format]?.extension || 'webm'
                    }`}</code>
                </div>

                {isConverting && (
                    <div style={{marginBottom: '16px'}}>
                        <div style={{marginBottom: '8px', fontSize: '0.875rem'}}>
                            Converting video... {conversionProgress}%
                        </div>
                        <sl-progress-bar value={conversionProgress}></sl-progress-bar>
                    </div>
                )}
            </form>

            <div slot="footer" id="video-preview-dialog-footer">
                <SlTooltip content={'Cancel recording'}>
                    <SlButton
                        variant="default"
                        onClick={handleCancel}
                        disabled={isConverting}
                    >
                        <SlIcon slot="prefix" library="fa" name={FA2SL.set(faXmark)}/>
                        {'Cancel'}
                    </SlButton>
                </SlTooltip>

                <SlTooltip content={isConverting ? 'Converting video...' : 'Save your video.'}>
                    <SlButton
                        variant="primary"
                        onClick={handleSave}
                        disabled={isConverting}
                    >
                        <SlIcon
                            slot="prefix"
                            library="fa"
                            name={FA2SL.set(faDownload)}
                        />
                        {isConverting
                         ? `Converting... ${conversionProgress}%`
                         : 'Download'}
                    </SlButton>
                </SlTooltip>
            </div>
        </SlDialog>
    )
}