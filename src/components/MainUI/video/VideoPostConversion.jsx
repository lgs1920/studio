/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPostConversion.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-27
 * Last modified: 2025-08-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faDownload }      from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }           from '@Utils/FA2SL'
import { useCallback }     from 'react'

/**
 * VideoPostConversion component for viewing converted video details
 * @param {Object} props - Component props
 * @param {string} props.convertedVideoUrl - URL of the converted video
 * @param {string} props.finalFilename - Name of the converted file
 * @param {Object} props.videoBlob - Blob of the converted video
 * @param {number} props.duration - Duration of the video in seconds
 * @param {boolean} props.isConverted - Conversion status
 * @returns {JSX.Element} Interface for viewing converted video details
 */
export const VideoPostConversion = ({convertedVideoUrl, finalFilename, videoBlob, duration, isConverted}) => {
    // Calculate file size in MB
    const fileSizeMB = videoBlob ? (videoBlob.size / 1000000).toFixed(2) : '0.00'

    // Format duration to mm:ss
    const formatDuration = (seconds) => {
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = Math.floor(seconds % 60)
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
    }

    return (
        <div className="post-conversion-container">
            <div className="video-info">
                <div className="info-item">
                    <span>File name:</span><span>{finalFilename}</span>
                </div>
                <div className="info-item">
                    <span>File size:</span><span>{fileSizeMB} MB</span>
                </div>
                <div className="info-item">
                    <span>Duration:</span><span>{formatDuration(duration)}</span>
                </div>
            </div>
            {isConverted && (
                <SlAlert variant="success" open>
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faDownload)}/>
                    <strong>Conversion completed</strong>
                    <br/>
                    Your video has been converted successfully.
                </SlAlert>
            )}
        </div>
    )
}