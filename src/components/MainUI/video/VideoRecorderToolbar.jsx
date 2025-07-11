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
import { VideoRecorder }                                  from '@Core/ui/video-recorder/VideoRecorder'
import { faPause, faPlay }                                from '@fortawesome/pro-regular-svg-icons'
import { faStop }                                         from '@fortawesome/pro-solid-svg-icons'
import { SlAnimation, SlIconButton, SlPopup }             from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                                          from '@Utils/FA2SL'
import { UIToast }                                        from '@Utils/UIToast'
import { UnitUtils }                                      from '@Utils/UnitUtils'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
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

            UIToast.warning({
                                caption: `Video capture`,
                                text:    'ON AIR !',
                            })
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

            UIToast.warning({
                                caption: `Video capture`,
                                text:    `Paused`,
                            })
        }

        // Handle resume
        const handleResume = () => {
            $settings.paused = false
            setRecordedDuration(__.recorder.duration)
            intervalRef.current = setInterval(() => {
                setRecordedDuration(__.recorder.duration)
                $settings.totalBytes = __.recorder.size
            }, SECOND)

            UIToast.success({
                                caption: `Video capture`,
                                text:    `Resumed`,
                            })
        }

        // Handle stop, max-size, or max-duration
        const handleStop = (event) => {
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
            const caption = 'Video Capture'
            switch (event.type) {
                case VideoRecorder.event.STOP:
                    UIToast.success({
                                        caption: caption,
                                        text:    `Done and saved in ${lgs.stores.main.components.video.filename}`,
                                    })
                    break
                case VideoRecorder.event.MAX_SIZE:
                    UIToast.warning({
                                        caption: caption,
                                        text:    `Stopped due to max size limit (${settings.maxSize}${'MB'}) but saved.`,
                                    })
                    break
                case VideoRecorder.event.MAX_DURATION:
                    UIToast.warning({
                                        caption: caption,
                                        text:    `Stopped due to max duration limit (${settings.maxDuration}m) but saved.`,
                                    })
            }
        }

        // Add event listeners
        __.recorder.addEventListener(VideoRecorder.event.START, handleStart)
        __.recorder.addEventListener(VideoRecorder.event.SIZE, handleSize)
        __.recorder.addEventListener(VideoRecorder.event.PAUSE, handlePause)
        __.recorder.addEventListener(VideoRecorder.event.RESUME, handleResume)
        __.recorder.addEventListener(VideoRecorder.event.STOP, handleStop)
        __.recorder.addEventListener(VideoRecorder.event.STOP, handleStop)
        __.recorder.addEventListener(VideoRecorder.event.STOP, handleStop)

        // Clean up
        return () => {
            clearInterval(intervalRef.current)
            __.recorder.removeEventListener(VideoRecorder.event.START, handleStart)
            __.recorder.removeEventListener(VideoRecorder.event.SIZE, handleSize)
            __.recorder.removeEventListener(VideoRecorder.event.PAUSE, handlePause)
            __.recorder.removeEventListener(VideoRecorder.event.RESUME, handleResume)
            __.recorder.removeEventListener(VideoRecorder.event.STOP, handleStop)
            __.recorder.removeEventListener(VideoRecorder.event.STOP, handleStop)
            __.recorder.removeEventListener(VideoRecorder.event.STOP, handleStop)
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