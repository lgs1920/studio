/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoConverterDialog.jsx
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

import { LGSScrollbars }        from '@Components/MainUI/LGSScrollbars'
import {
    VideoRecorder,
}                               from '@Core/ui/video/recorder/VideoRecorder'
import {
    faDownload,
}                               from '@fortawesome/pro-regular-svg-icons'
import {
    SlButton, SlDetails, SlDivider, SlIcon, SlInput, SlOption, SlSelect, SlProgressBar,
}                               from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                from '@Utils/FA2SL'
import { VideoPreview }         from '@Core/ui/video/preview-download-share/VideoPreview'
import classNames               from 'classnames'
import { useCallback, useMemo } from 'react'

// Constants
const AVAILABLE_FORMATS = VideoRecorder.getAvailableFormats()
const QUALITY_PRESETS = VideoRecorder.getQualityPresets()

/**
 * VideoConvertDialog component for video conversion settings and download
 * @param {Object} props - Component props
 * @param {Object} props.video - Video state from Valtio
 * @param {string} props.inputFormat - Input video format
 * @param {string} props.finalFilename - Final filename for download
 * @param {boolean} props.isConverting - Conversion status
 * @param {number} props.progressPercentage - Conversion progress percentage
 * @param {number} props.convertedTime - Converted time in milliseconds
 * @param {number} props.duration - Video duration in seconds
 * @param {string[]} props.conversionLogs - Conversion logs
 * @param {Function} props.setConversionLogs - Function to update conversion logs
 * @param {Function} props.setIsConverting - Function to update conversion status
 * @param {Function} props.setConvertedVideoBlob - Function to set converted video blob
 * @param {Function} props.setConvertedVideoUrl - Function to set converted video URL
 * @param {Function} props.setIsConverted - Function to set conversion completed status
 * @param {Blob} props.videoBlob - Original video blob
 * @param {Object} props.metadata - Video metadata
 * @returns {JSX.Element} Video conversion form
 */
export const VideoConvertDialog = ({
                                       video,
                                       inputFormat,
                                       finalFilename,
                                       isConverting,
                                       progressPercentage,
                                       convertedTime,
                                       duration,
                                       conversionLogs,
                                       setConversionLogs,
                                       setIsConverting,
                                       setConvertedVideoBlob,
                                       setConvertedVideoUrl,
                                       setIsConverted,
                                       videoBlob,
                                       metadata,
                                   }) => {
    const videoPreview = VideoPreview.getInstance()

    // Update final filename with current timestamp
    const updatedFinalFilename = useMemo(() => {
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
        const fileExtension = AVAILABLE_FORMATS[video.format]?.extension || 'webm'
        return `${timestamp}-${video.filename || 'LGS1920'}.${fileExtension}`
    }, [video.format, video.filename])

    /**
     * Handle changes to the video filename input
     * @param {Event} e - Input event
     * @returns {void}
     */
    const handleFilenameChange = useCallback((e) => {
        __.recorder.filename = e.target.value
        video.filename = e.target.value
    }, [video])

    /**
     * Handle selection of output video format
     * @param {Event} event - Select event
     * @returns {void}
     */
    const handleFormatChange = useCallback((event) => {
        event.stopPropagation()
        event.preventDefault()
        video.format = event.target.value
        console.log('format changed', event.target.value)
        if (event.target.value === 'WEBM') {
            video.quality = 'MEDIUM'
        }
    }, [video])

    /**
     * Handle selection of quality preset
     * @param {Event} event - Select event
     * @returns {void}
     */
    const handleQualityChange = useCallback((event) => {
        event.stopPropagation()
        event.preventDefault()
        video.quality = event.target.value
    }, [video])

    /**
     * Trigger video conversion and download
     * @returns {void}
     */
    const handleConvertAndDownload = useCallback(() => {
        if (isConverting) {
            setConversionLogs((prev) => [...prev, 'Conversion already in progress'])
            return
        }
        const converter = videoPreview.initializeConverter(
            ({percentage, time, duration}) => {
                setProgressPercentage(percentage)
                setDuration(duration)
                setConvertedTime(time)
                setConversionLogs((prev) => [
                    ...prev,
                    percentage === 100 ? `Conversion completed: ${percentage}%` : `Progress: ${percentage.toFixed(2)}% (${time}s)`,
                ])
            },
            (message) => {
                console.log(message)
                setConversionLogs((prev) => [...prev, message])
            },
        )
        videoPreview.convertAndDownload(
            videoBlob,
            inputFormat,
            video.format,
            video.quality,
            updatedFinalFilename,
            metadata,
            duration,
            converter,
            (message) => setConversionLogs((prev) => [...prev, message]),
            (error) => setConversionLogs((prev) => [...prev, error]),
            AVAILABLE_FORMATS,
        ).then((convertedBlob) => {
            if (convertedBlob) {
                const convertedUrl = URL.createObjectURL(convertedBlob)
                setConvertedVideoUrl(convertedUrl)
                setConvertedVideoBlob(convertedBlob)
                setIsConverted(true)
            }
            setIsConverting(false)
        })
        setIsConverting(true)
    }, [videoBlob, inputFormat, video.format, video.quality, updatedFinalFilename, metadata, duration])

    return (
        <div className="video-preview-form">
            <SlSelect
                size="small"
                label="Format"
                value={video.format || 'MP4'}
                onSlChange={handleFormatChange}
                disabled={isConverting}
            >
                {Object.entries(AVAILABLE_FORMATS).map(([key, format]) => (
                    <SlOption key={key} value={key}>{format.description}</SlOption>
                ))}
            </SlSelect>
            <SlSelect
                size="small"
                label="Quality"
                value={video.quality || 'MEDIUM'}
                onSlChange={handleQualityChange}
                disabled={isConverting || video.format === inputFormat}
            >
                {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                    <SlOption key={key} value={key}>{preset.description}</SlOption>
                ))}
            </SlSelect>
            <SlInput
                size="small"
                label="File name prefix"
                name="video-file-name"
                value={video.filename || __.recorder.filename}
                onSlInput={handleFilenameChange}
                disabled={isConverting}
            />
            <div className="converted-video-file-name">{updatedFinalFilename}</div>
            {progressPercentage > 0 && (
                <SlProgressBar
                    value={progressPercentage}
                    label="Conversion Progress"
                    className="conversion-progress"
                />
            )}
            {conversionLogs.length > 0 && (
                <SlDetails className="conversion-logs" summary="Logs">
                    <SlDivider/>
                    <LGSScrollbars autoHide autoHeight>
                        <pre className="lgs-console">{conversionLogs.join('\n')}</pre>
                    </LGSScrollbars>
                </SlDetails>
            )}
            <SlButton
                className={classNames('conversion-trigger', {'video-conversion-in-progress': isConverting})}
                variant={isConverting ? 'warning' : 'primary'}
                onClick={handleConvertAndDownload}
                disabled={isConverting}
            >
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faDownload)}/>
                {video.format === inputFormat ? 'Download' : 'Convert'}
            </SlButton>
        </div>
    )
}