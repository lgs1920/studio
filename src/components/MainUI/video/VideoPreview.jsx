/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoPreview.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-11
 * Last modified: 2025-07-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoPreview - React component to display recorded video in a dialog
 * @module VideoPreview
 */

import { faXmark, faDownload }                   from '@fortawesome/pro-regular-svg-icons'
import { SlDialog, SlButton, SlTooltip, SlIcon } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                                 from '@Utils/FA2SL'
import { useEffect, useState, useRef }           from 'react'

/**
 * VideoPreview component
 * @returns {JSX.Element} The video preview dialog component
 */
export const VideoPreview = () => {
    const [videoUrl, setVideoUrl] = useState(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [videoBlob, setVideoBlob] = useState(null)
    const dialogRef = useRef(null)

    useEffect(() => {
        const handleStop = (e) => {
            const {blob} = e.detail
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
        }
    }, [videoUrl])

    /**
     * Handles the save button click to download the video
     */
    const handleSave = () => {
        if (videoBlob) {
            __.recorder.download(undefined, videoBlob) // Use filename from initialize (APP_KEY)
        }
        setIsDialogOpen(false)
        setVideoUrl(null)
        setVideoBlob(null)
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl)
        }
    }

    /**
     * Handles the cancel button click to close the dialog
     */
    const handleCancel = () => {
        setIsDialogOpen(false)
        setVideoUrl(null)
        setVideoBlob(null)
        if (videoUrl) {
            URL.revokeObjectURL(videoUrl)
        }
    }

    return (
        <SlDialog label={'Video Preview'} id="video-preview-dialog"
                  open={isDialogOpen}
                  onSlAfterHide={() => setIsDialogOpen(false)}
                  ref={dialogRef}
                  className="lgs-theme"
        >
            {videoUrl && (
                <video controls src={videoUrl} style={{maxWidth: '100%', marginBottom: '10px'}}/>
            )}
            <div slot="footer" id="video-preview-dialog-footer">
                <SlTooltip content={'Cancel recording'}>
                    <SlButton variant="default" onClick={handleCancel}>
                        <SlIcon slot="prefix" library="fa"
                                name={FA2SL.set(faXmark)}/>
                        {'Cancel'}
                    </SlButton>
                </SlTooltip>

                <SlTooltip content={'Save your video.'}>
                    <SlButton variant="primary" onClick={handleSave}>
                        <SlIcon slot="prefix" library="fa"
                                name={FA2SL.set(faDownload)}/>
                        {'Download'}
                    </SlButton>
                </SlTooltip>
            </div>
        </SlDialog>
    )
}