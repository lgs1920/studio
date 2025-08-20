/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-20
 * Last modified: 2025-08-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SECOND }                  from '@Core/constants'
import { VideoRecorder }           from '@Core/ui/video/recorder/VideoRecorder'
import { faPause, faPlay, faStop } from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlPopup, SlTooltip } from '@shoelace-style/shoelace/dist/react'
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
            <SlTooltip content={paused ? 'Click to resume' : 'Click to pause'}>
                <SlIconButton
                    library="fa"
                    name={FA2SL.set(paused ? faPlay : faPause)}
                    onClick={handlePlayPause}
                    disabled={!recorder}
                />
            </SlTooltip>
            {recording && !paused && (
                <SlTooltip content={'Click to stop'}>
                    <SlIconButton
                        library="fa"
                        name={FA2SL.set(faStop)}
                        onClick={handleStop}
                    />
                </SlTooltip>
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
    const $video = lgs.settings.ui.video
    const video = useSnapshot($video)
    // Local state for UI updates
    const [recordedDuration, setRecordedDuration] = useState(0)
    const [recordedSize, setRecordedSize] = useState(0)
    const [lastSizeEventTime, setLastSizeEventTime] = useState(0)
    // Ref to track interval ID
    const intervalRef = useRef(null)

    const _toolbar = useRef(null)
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})

    /**
     * Formats duration in milliseconds to human readable format
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration (e.g., '1h 05m 05s')
     */
    const formatDuration = useCallback((ms) => {
        return UnitUtils.convert(ms).toTime()
    }, [])

    /**
     * Formats size in bytes to human readable format
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

        // Handle recording start event
        const handleStart = () => {
            if ($video.recording) {
                return
            }

            $video.recording = true
            $video.paused = false
            $video.totalBytes = 0
            setRecordedDuration(0)
            setRecordedSize(0)
            setLastSizeEventTime(Date.now())

            // Clear existing interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }

            intervalRef.current = setInterval(() => {
                if (__.recorder) {
                    const currentDuration = __.recorder.duration
                    const currentSize = __.recorder.size
                    setRecordedDuration(currentDuration)
                    setRecordedSize(currentSize)
                    $video.totalBytes = currentSize
                }
            }, SECOND)

            UIToast.warning({
                                caption: caption,
                                text:    'ON AIR !',
                            })
        }

        // Handle size update events
        const handleSize = (e) => {
            setLastSizeEventTime(Date.now())
            setRecordedSize(e.detail.totalBytes)
        }

        // Handle recording pause event
        const handlePause = () => {
            if ($video.paused) {
                return
            }
            $video.paused = true
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
            if (__.recorder) {
                setRecordedDuration(__.recorder.duration)
            }

            UIToast.warning({
                                caption: caption,
                                text:    `Paused`,
                            })
        }

        // Handle recording resume event
        const handleResume = () => {
            if (!$video.paused) {
                return
            }
            $video.paused = false
            if (__.recorder) {
                setRecordedDuration(__.recorder.duration)
            }

            // Clear existing interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }

            intervalRef.current = setInterval(() => {
                if (__.recorder) {
                    const currentDuration = __.recorder.duration
                    const currentSize = __.recorder.size
                    setRecordedDuration(currentDuration)
                    setRecordedSize(currentSize)
                    $video.totalBytes = currentSize
                }
            }, SECOND)

            UIToast.success({
                                caption: caption,
                                text:    `Resumed`,
                            })
        }

        // Handle recording stop events (stop, max-size, or max-duration)
        const handleStop = (event) => {
            if ((__.recorder && __.recorder.isRecording()) || $video.paused) {
                __.recorder?.stop()
            }
            $video.recording = false
            $video.paused = false
            $video.totalBytes = 0
            setRecordedDuration(0)
            setRecordedSize(0)
            setLastSizeEventTime(0)

            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }

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
                                        text: `Stopped due to max size limit (${video.maxSize}${'MB'}). Waiting...`,
                                    })
                    break
                case VideoRecorder.events.MAX_DURATION:
                    UIToast.warning({
                                        caption: caption,
                                        text: `Stopped due to max duration limit (${video.maxDuration}m). Waiting...`,
                                    })
            }
        }

        // Handle download completion event
        const handleDownload = (event) => {
            UIToast.success({
                                caption: caption,
                                text: `Saved in ${event.detail.filename}`,
                            })
        }

        // Set initial toolbar opacity
        if (_toolbar.current) {
            _toolbar.current.style.opacity = toolbars.opacity
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

        // Clean up function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
            if (__.recorder) {
                __.recorder.removeEventListener(VideoRecorder.events.START, handleStart)
                __.recorder.removeEventListener(VideoRecorder.events.SIZE, handleSize)
                __.recorder.removeEventListener(VideoRecorder.events.PAUSE, handlePause)
                __.recorder.removeEventListener(VideoRecorder.events.RESUME, handleResume)
                __.recorder.removeEventListener(VideoRecorder.events.MAX_SIZE, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.MAX_DURATION, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.DOWNLOAD, handleDownload)
            }
        }
    }, [__.recorder])

    // Update toolbar opacity when needed
    useEffect(() => {
        if (_toolbar.current) {
            _toolbar.current.style.opacity = toolbars.opacity
        }
    }, [video.recording, video.paused, toolbars.opacity])

    // Render toolbar only when recording is active
    return (
        <>
            {
                video.recording &&
                <div
                    className="video-recorder-toolbar lgs-toolbar lgs-toolbar-horizontal lgs-one-line-card on-map"
                    ref={_toolbar}>
                    <span className="duration">{formatDuration(recordedDuration)}</span>
                    <span className="size">{formatSize(recordedSize)}</span>
                    <RecorderControls
                        recording={video.recording}
                        paused={video.paused}
                        recorder={__.recorder}
                    />
                </div>
            }
        </>
    )
}