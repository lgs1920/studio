/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-13
 * Last modified: 2025-07-13
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

        const caption = 'Video Recording'

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
                                caption: caption,
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
                                caption: caption,
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
                                caption: caption,
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
            switch (event.type) {
                case VideoRecorder.events.STOP:
                    UIToast.success({
                                        caption: caption,
                                        text: `Done. Waiting...`,
                                    })
                    break
                case VideoRecorder.events.MAX_SIZE:
                    UIToast.warning({
                                        caption: caption,
                                        text: `Stopped due to max size limit (${settings.maxSize}${'MB'}). Waiting...`,
                                    })
                    break
                case VideoRecorder.events.MAX_DURATION:
                    UIToast.warning({
                                        caption: caption,
                                        text: `Stopped due to max duration limit (${settings.maxDuration}m). Waiting...`,
                                    })
            }
        }

        // Handle Download Event
        const handleDownload = (event) => {
            UIToast.success({
                                caption: caption,
                                text: `Saved in ${event.detail.filename}`,
                            })
        }

        // Add event listeners
        __.recorder.addEventListener(VideoRecorder.events.START, handleStart)
        __.recorder.addEventListener(VideoRecorder.events.SIZE, handleSize)
        __.recorder.addEventListener(VideoRecorder.events.PAUSE, handlePause)
        __.recorder.addEventListener(VideoRecorder.events.RESUME, handleResume)
        __.recorder.addEventListener(VideoRecorder.events.MAX_SIZE, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.MAX_DURATION, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.DOWNLOAD, handleDownload)

        // Clean up
        return () => {
            clearInterval(intervalRef.current)
            __.recorder.removeEventListener(VideoRecorder.events.START, handleStart)
            __.recorder.removeEventListener(VideoRecorder.events.SIZE, handleSize)
            __.recorder.removeEventListener(VideoRecorder.events.PAUSE, handlePause)
            __.recorder.removeEventListener(VideoRecorder.events.RESUME, handleResume)
            __.recorder.removeEventListener(VideoRecorder.events.MAX_SIZE, handleStop)
            __.recorder.removeEventListener(VideoRecorder.events.MAX_DURATION, handleStop)
            __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStop)
            __.recorder.removeEventListener(VideoRecorder.events.DOWNLOAD, handleDownload)

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