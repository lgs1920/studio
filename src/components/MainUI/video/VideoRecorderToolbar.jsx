/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderToolbar.jsx
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

import { SECOND }                                         from '@Core/constants'
import { faStop }                                         from '@fortawesome/pro-solid-svg-icons'
import { faPause, faPlay }                                from '@fortawesome/pro-regular-svg-icons'
import { SlAnimation, SlIconButton, SlPopup }             from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                                          from '@Utils/FA2SL'
import { UnitUtils }                                      from '@Utils/UnitUtils'
import { useEffect, useRef, useCallback, memo, useState } from 'react'
import { useSnapshot }                                    from 'valtio'

/**
 * RecorderControls - Renders play/pause and stop buttons for the recorder
 * @param {Object} props
 * @param {boolean} props.recording - Whether recording is active
 * @param {boolean} props.paused - Whether recording is paused
 * @param {Object} props.recorder - Recorder instance
 */
const RecorderControls = memo(({recording, paused, recorder}) => {
    // Memoized click handlers
    const handlePlayPause = useCallback(() => {
        if (recorder) {
            paused ? recorder.resume() : recorder.pause()
        }
    }, [recorder, paused])

    const handleStop = useCallback(() => {
        recorder?.stop()
    }, [recorder])

    return (
        <>
            <SlIconButton
                library="fa"
                name={FA2SL.set(paused ? faPlay : faPause)}
                onClick={handlePlayPause}
                disabled={!recorder}
            />
            {recording && (
                <SlIconButton
                    library="fa"
                    name={FA2SL.set(faStop)}
                    onClick={handleStop}
                    disabled={!recorder}
                />
            )}
        </>
    )
})

/**
 * VideoRecorderToolbar - Displays video recording controls and stats
 * @param {Object} props - Component props
 * @param {string} props.tooltip - Popup placement (e.g., 'top', 'bottom')
 */
export const VideoRecorderToolbar = (props) => {
    // Access global video settings
    const $settings = lgs.settings.ui.video
    const settings = useSnapshot($settings)
    // Local state for UI updates
    const [recordedDuration, setRecordedDuration] = useState(0)
    const [recordedSize, setRecordedSize] = useState(0)
    const [lastSizeEventTime, setLastSizeEventTime] = useState(0)
    // Ref to track interval ID
    const intervalRef = useRef(null)

    /**
     * Formats duration in milliseconds
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration (e.g., '1h 05m 05s')
     */
    const formatDuration = useCallback((ms) => {
        return UnitUtils.convert(ms).toTime()
    }, [])

    /**
     * Formats size in bytes
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size (e.g., '1.4MB')
     */
    const formatSize = useCallback((bytes) => {
        return UnitUtils.convert(bytes).toSize()
    }, [])

    // Manage recorder events and state
    useEffect(() => {
        // Ensure recorder exists
        if (!__.recorder) {
            return
        }

        // Handle recording start
        const handleStart = () => {
            $settings.recording = true
            $settings.paused = false
            $settings.totalBytes = 0
            setRecordedDuration(0)
            setRecordedSize(0)
            setLastSizeEventTime(Date.now())
            intervalRef.current = setInterval(() => {
                setRecordedDuration(__.recorder.duration)
                $settings.totalBytes = __.recorder.size
            }, SECOND)
        }

        // Handle size updates
        const handleSize = (e) => {
            setLastSizeEventTime(Date.now())
            setRecordedSize(e.detail.totalBytes)
        }

        // Handle pause
        const handlePause = () => {
            $settings.paused = true
            clearInterval(intervalRef.current)
            setRecordedDuration(__.recorder.duration)
        }

        // Handle resume
        const handleResume = () => {
            $settings.paused = false
            setRecordedDuration(__.recorder.duration)
            intervalRef.current = setInterval(() => {
                setRecordedDuration(__.recorder.duration)
                $settings.totalBytes = __.recorder.size
            }, SECOND)
        }

        // Handle stop, max-size, or max-duration
        const handleStop = () => {
            if (__.recorder.isRecording()) {
                __.recorder.stop()
            }
            $settings.recording = false
            $settings.paused = false
            $settings.totalBytes = 0
            setRecordedDuration(0)
            setRecordedSize(0)
            setLastSizeEventTime(0)
            clearInterval(intervalRef.current)
        }

        // Add event listeners
        __.recorder.addEventListener('video/start', handleStart)
        __.recorder.addEventListener('video/size', handleSize)
        __.recorder.addEventListener('video/pause', handlePause)
        __.recorder.addEventListener('video/resume', handleResume)
        __.recorder.addEventListener('video/stop', handleStop)
        __.recorder.addEventListener('video/max-size', handleStop)
        __.recorder.addEventListener('video/max-duration', handleStop)

        // Clean up
        return () => {
            clearInterval(intervalRef.current)
            __.recorder.removeEventListener('video/start', handleStart)
            __.recorder.removeEventListener('video/size', handleSize)
            __.recorder.removeEventListener('video/pause', handlePause)
            __.recorder.removeEventListener('video/resume', handleResume)
            __.recorder.removeEventListener('video/stop', handleStop)
            __.recorder.removeEventListener('video/max-size', handleStop)
            __.recorder.removeEventListener('video/max-duration', handleStop)
        }
    }, [__.recorder])

    // Render toolbar
    return (
        <SlPopup
            active={settings.recording}
            className={'lgs-theme'}
            anchor="trigger-video-recording"
            placement={props.tooltip}
            distance={__.tools.rem2px(__.ui.css.getCSSVariable('lgs-gutter-xs'))}
        >
            <SlAnimation>
                <div className={'lgs-one-line-card on-map small'} id="video-recorder-toolbar">
                    <span className="duration">{formatDuration(recordedDuration)}</span>
                    <span className="size">{formatSize(recordedSize)}</span>
                    <RecorderControls
                        recording={settings.recording}
                        paused={settings.paused}
                        recorder={__.recorder}
                    />
                </div>
            </SlAnimation>
        </SlPopup>
    )
}