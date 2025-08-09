/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordButton.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-09
 * Last modified: 2025-08-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { FontAwesomeIcon }     from '@Components/FontAwesomeIcon'
import { APP_KEY, MINUTE } from '@Core/constants'
import { VideoRecorder } from '@Core/ui/video/recorder/VideoRecorder'
import { faCircleVideo }   from '@fortawesome/duotone-regular-svg-icons'
import { SlButton, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { UIToast }         from '@Utils/UIToast'
import { useEffect }           from 'react'
import { useSnapshot }         from 'valtio'

/**
 * PanelButton - Toggles video recording with a button
 * @param {Object} props - Component props
 * @param {string} props.tooltip - Tooltip placement (e.g., 'top', 'bottom')
 */
export const VideoRecordButton  = (props) => {
    // Access global video settings
    const $video = lgs.settings.ui.video
    const video = useSnapshot($video)
    const $videoSetup = lgs.stores.ui.video.cropper

    // Manage recorder events
    useEffect(() => {
        // Ensure recorder exists
        if (!__.recorder) {
            return
        }
        // Handle size updates
        const handleSizeUpdate = (e) => {
            $video.totalBytes = e.detail.totalBytes
        }
        // Handle pause
        const handlePause = () => {
            $video.paused = true
        }
        // Handle resume
        const handleResume = () => {
            $video.paused = false
        }
        // Handle stop
        const handleStop = () => {
            $video.recording = false
            $video.paused = false
            $video.totalBytes = 0
        }
        // Handle max size limit
        const handleMaxSize = () => {
            $video.recording = false
            $video.paused = false
            $video.totalBytes = 0
        }
        // Handle max duration limit
        const handleMaxDuration = () => {
            $video.recording = false
            $video.paused = false
            $video.totalBytes = 0
        }

        // Add event listeners
        __.recorder.addEventListener(VideoRecorder.events.SIZE, handleSizeUpdate)
        __.recorder.addEventListener(VideoRecorder.events.PAUSE, handlePause)
        __.recorder.addEventListener(VideoRecorder.events.RESUME, handleResume)
        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.MAX_SIZE, handleMaxSize)
        __.recorder.addEventListener(VideoRecorder.events.MAX_DURATION, handleMaxDuration)
        // Clean up
        return () => {
            __.recorder.removeEventListener(VideoRecorder.events.SIZE, handleSizeUpdate)
            __.recorder.removeEventListener(VideoRecorder.events.PAUSE, handlePause)
            __.recorder.removeEventListener(VideoRecorder.events.RESUME, handleResume)
            __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStop)
            __.recorder.removeEventListener(VideoRecorder.events.MAX_SIZE, handleMaxSize)
            __.recorder.removeEventListener(VideoRecorder.events.MAX_DURATION, handleMaxDuration)
            if (video.recording && __.recorder) {
                __.recorder.stop()
                $video.recording = false
                $video.paused = false
                $video.totalBytes = 0
            }
        }
    }, [__.recorder])

    /**
     * Initializes VideoRecorder with Cesium canvas
     */
    const initializeRecorder = () => {
        // Ensure recorder and canvas exist
        if (!__.recorder || !lgs.canvas) {
            return
        }
        // Configure recorder
        __.recorder.initialize((blob, duration) => {
        }, undefined, {
            maxSize:     video.maxSize * 1048576,      // MB
            maxDuration: video.maxDuration * MINUTE,   // MilliSeconds
            bitrate:     video.bitrate * 1000000,      // MBps
                                   filename:    APP_KEY,
            fps:         video.fps,
            useWebGL: true,

        })
        // Set canvas source
        __.recorder.setSource([lgs.canvas], {
            clipWidth:  $videoSetup.width,
            clipHeight: $videoSetup.height,
            clipX:      $videoSetup.x,
            clipY:      $videoSetup.y,
            preserveAlpha: true,
        })
    }

    /**
     * Toggles video recording
     */
    const handleVideoRecording = () => {
        // Ensure recorder exists
        if (!__.recorder) {
            return
        }
        // Start or stop recording
        if (!video.recording) {
            try {
                initializeRecorder()
                __.recorder.start()
                $video.recording = true
                $video.paused = false
            }
            catch (error) {
                $video.recording = false
                $video.paused = false
                $video.totalBytes = 0

                UIToast.error({
                                  caption: `Video capture`,
                                  text: `Stopped due to error:<br>${error.message} !`,
                              })
            }
        }
        else {
            __.recorder.pause()
            $video.paused = true
        }
    }

    // Render button
    return (
        <SlTooltip hoist
                   content={!video.recording ? 'Click to start the recording' : (video.paused ? 'Paused' : 'On air !')}>
            <SlButton size={'small'} className={'square-button transparent'} id={'trigger-video-recording'}
                      onClick={handleVideoRecording}
                      disabled={!__.recorder || !lgs.canvas}>
                <FontAwesomeIcon icon={faCircleVideo} beatFade={video.recording && !video.paused}/>
            </SlButton>
        </SlTooltip>
    )
}