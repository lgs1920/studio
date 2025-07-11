/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: PanelButton.jsx
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

import { faCircleVideo }       from '@fortawesome/duotone-regular-svg-icons'
import { FontAwesomeIcon }     from '@Components/FontAwesomeIcon'
import { library }             from '@fortawesome/fontawesome-svg-core'
import { SlButton, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { useEffect }           from 'react'
import { useSnapshot }         from 'valtio'
import { MINUTE }              from '@Core/constants'

/**
 * PanelButton - Toggles video recording with a button
 * @param {Object} props - Component props
 * @param {string} props.tooltip - Tooltip placement (e.g., 'top', 'bottom')
 */
export const PanelButton = (props) => {
    // Access global video settings
    const $settings = lgs.settings.ui.video
    const settings = useSnapshot($settings)

    // Manage recorder events
    useEffect(() => {
        // Ensure recorder exists
        if (!__.recorder) {
            return
        }
        // Handle size updates
        const handleSizeUpdate = (e) => {
            $settings.totalBytes = e.detail.totalBytes
        }
        // Handle pause
        const handlePause = () => {
            $settings.paused = true
        }
        // Handle resume
        const handleResume = () => {
            $settings.paused = false
        }
        // Handle stop
        const handleStop = () => {
            $settings.recording = false
            $settings.paused = false
            $settings.totalBytes = 0
        }
        // Handle max size limit
        const handleMaxSize = () => {
            $settings.recording = false
            $settings.paused = false
            $settings.totalBytes = 0
        }
        // Handle max duration limit
        const handleMaxDuration = () => {
            $settings.recording = false
            $settings.paused = false
            $settings.totalBytes = 0
        }
        // Add event listeners
        __.recorder.addEventListener('video/size', handleSizeUpdate)
        __.recorder.addEventListener('video/pause', handlePause)
        __.recorder.addEventListener('video/resume', handleResume)
        __.recorder.addEventListener('video/stop', handleStop)
        __.recorder.addEventListener('video/max-size', handleMaxSize)
        __.recorder.addEventListener('video/max-duration', handleMaxDuration)
        // Clean up
        return () => {
            __.recorder.removeEventListener('video/size', handleSizeUpdate)
            __.recorder.removeEventListener('video/pause', handlePause)
            __.recorder.removeEventListener('video/resume', handleResume)
            __.recorder.removeEventListener('video/stop', handleStop)
            __.recorder.removeEventListener('video/max-size', handleMaxSize)
            __.recorder.removeEventListener('video/max-duration', handleMaxDuration)
            if (settings.recording && __.recorder) {
                __.recorder.stop()
                $settings.recording = false
                $settings.paused = false
                $settings.totalBytes = 0
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
            __.recorder.download()
        }, 'video/webm;codecs=vp9', {
                                   maxSize:     1024 * 1024 * 100, // 100 MB
                                   maxDuration: settings.maxDuration * MINUTE,
                                   bitrate:     12000000,
                                   filename:    'lgs1920',
                               })
        // Set canvas source
        __.recorder.setSource([lgs.canvas], {
            width:    lgs.canvas.width,
            height:   lgs.canvas.height,
            fps:      60,
            useWebGL: true,
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
        if (!settings.recording) {
            try {
                initializeRecorder()
                __.recorder.start()
                $settings.recording = true
                $settings.paused = false
            }
            catch (error) {
                $settings.recording = false
                $settings.paused = false
                $settings.totalBytes = 0
            }
        }
        else {
            __.recorder.stop()
            $settings.recording = false
            $settings.paused = false
            $settings.totalBytes = 0
        }
    }

    // Render button
    return (
        <SlTooltip hoist placement={props.tooltip} disabled={!settings.recording || settings.paused}
                   content={settings.recording ? null : 'Start recording'}>
            <SlButton size={'small'} className={'square-button transparent'} id={'trigger-video-recording'}
                      onClick={handleVideoRecording}
                      disabled={!__.recorder || !lgs.canvas}>
                <FontAwesomeIcon icon={faCircleVideo} beatFade={settings.recording && !settings.paused}/>
            </SlButton>
        </SlTooltip>
    )
}