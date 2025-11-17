/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-17
 * Last modified: 2025-11-17
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoRecorderToolbar - Displays video recording controls and stats
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.toolbar - Toolbar element reference
 * @returns {JSX.Element} Video recorder toolbar UI
 */
import { FontAwesomeIcon }                                from '@Components/FontAwesomeIcon'
import { VideoRecorder }                                  from '@Core/ui/video/recorder/VideoRecorder'
import { faCircle }                                       from '@fortawesome/duotone-regular-svg-icons'
import { faPause, faPlay, faStop, faXmark }               from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlTooltip }                        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                          from '@Utils/FA2SL'
import { UIToast }                                        from '@Utils/UIToast'
import { UnitUtils }                                      from '@Utils/UnitUtils'
import classNames                                         from 'classnames'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                                    from 'valtio'
import '../style.css'

/**
 * RecorderControls - Renders play/pause and stop buttons for the recorder
 * @param {Object} props
 * @param {boolean} props.recording - Whether recording is active
 * @param {boolean} props.paused - Whether recording is paused
 * @param {Object} props.recorder - Recorder instance
 * @param {Function} props.onFinalize - Callback to set finalizing state
 * @returns {JSX.Element} Recorder controls UI
 */
const RecorderControls = memo(({recording, paused, recorder, onFinalize}) => {
    // Memoized click handlers
    const handlePlayPause = useCallback(() => {
        if (recorder) {
            paused ? recorder.resume() : recorder.pause()
        }
    }, [recorder, paused])

    const handleStop = useCallback(() => {
        onFinalize(true)
        recorder?.stop()
    }, [recorder, onFinalize])

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
                <SlTooltip content="Click to stop">
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
 * VideoRecorderToolbar component
 */
export const VideoRecorderToolbar = ({toolbar}) => {
    // Access global video settings
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    // Consolidated state for performance
    const [state, setState] = useState({
                                           recordedDuration: 0,
                                           recordedSize:     0,
                                           finalizing:       false,
                                       })

    // Ref for toolbar
    const _toolbar = useRef(toolbar || null)

    // Memoized caption for toasts
    const caption = 'Video Recording'

    /**
     * Formats duration in milliseconds to human-readable format
     * @param {number} ms - Duration in milliseconds
     * @returns {string} Formatted duration (e.g., '1h 05m 05s')
     */
    const formatDuration = useCallback((ms) => UnitUtils.convert(ms).toTime(), [])

    /**
     * Formats size in bytes to human-readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size (e.g., '1.4MB')
     */
    const formatSize = useCallback((bytes) => UnitUtils.convert(bytes).toBytesUnit(), [])

    /**
     * Updates video and local state
     * @param {Object} updates - State updates
     */
    const updateState = useCallback((updates) => {
        Object.assign($video, updates)
        setState((prev) => ({...prev, ...updates}))
    }, [])

    /**
     * Shows toast notification
     * @param {string} type - Toast type ('success' or 'warning')
     * @param {string} text - Toast message
     */
    const showToast = useCallback((type, text) => {
        UIToast[type]({caption, text})
    }, [])

    // Manage recorder events
    useEffect(() => {
        if (!__.recorder) {
            console.warn('Recorder not initialized')
            return
        }

        // Event handlers
        const handleStart = () => {
            if ($video.recording) {
                return
            }
            updateState({
                            preRecording: false,
                            recording: true,
                            finalizing:       false,
                            paused:           false,
                            size:             0,
                            recordedDuration: 0,
                            recordedSize:     0,
                        })
            showToast('warning', 'ON AIR !')
        }

        const handleInfo = (event) => {
            setState((prev) => ({
                ...prev,
                recordedSize:     event.detail.size,
                recordedDuration: event.detail.duration,
            }))
        }

        const handlePause = () => {
            if ($video.paused) {
                return
            }
            updateState({paused: true, recordedDuration: __.recorder.duration})
            showToast('warning', 'Paused')
        }

        const handleResume = () => {
            if (!$video.paused) {
                return
            }
            updateState({paused: false, recordedDuration: __.recorder.duration})
            showToast('success', 'Resumed')
        }

        const handleFinalize = () => {
            if ($video.finalizing) {
                return
            }
            updateState({finalizing: true})
        }

        const handleStop = (event) => {
            if (__.recorder?.isRecording() || $video.paused) {
                __.recorder.stop()
            }
            updateState({
                            preRecording: false,
                            recording:        false,
                            paused:           false,
                            size:             0,
                            recordedDuration: 0,
                            recordedSize:     0,
                            finalizing:       false,
                        })
            switch (event.type) {
                case VideoRecorder.events.STOP:
                    showToast('success', 'Done. Waiting...')
                    break
                case VideoRecorder.events.MAX_SIZE:
                    showToast('warning', `Stopped due to max size limit (${video.maxSize}MB). Waiting...`)
                    break
                case VideoRecorder.events.MAX_DURATION:
                    showToast('warning', `Stopped due to max duration limit (${video.maxDuration}m). Waiting...`)
                    break
            }
        }

        const handleDownload = (event) => {
            showToast('success', `Saved in ${event.detail.filename}`)
        }

        // Event mappings
        const events = [
            [VideoRecorder.events.START, handleStart],
            [VideoRecorder.events.INFO, handleInfo],
            [VideoRecorder.events.PAUSE, handlePause],
            [VideoRecorder.events.RESUME, handleResume],
            [VideoRecorder.events.MAX_SIZE, handleStop],
            [VideoRecorder.events.MAX_DURATION, handleStop],
            [VideoRecorder.events.STOP, handleStop],
            [VideoRecorder.events.DOWNLOAD, handleDownload],
            [VideoRecorder.events.FINALIZE, handleFinalize],
        ]

        // Add event listeners
        events.forEach(([event, handler]) => __.recorder.addEventListener(event, handler))

        // Cleanup
        return () => {
            if (__.recorder) {
                events.forEach(([event, handler]) => __.recorder.removeEventListener(event, handler))
            }
        }
    }, [__.recorder, updateState, showToast, video.maxSize, video.maxDuration])

    // Handle cancel
    const handleCancel = useCallback(async () => {
        if (__.recorder) {
            await __.recorder.cancel()
        }
        updateState({
                        preRecording: false,
                        recording:        false,
                        paused:           false,
                        size:             0,
                        editing:          true,
                        recordedDuration: 0,
                        recordedSize:     0,
                        finalizing:       false,
                    })
        showToast('warning', 'Recording has been canceled!')
    }, [__.recorder, updateState, showToast])

    return (
        <div
            ref={_toolbar}
            className="video-recorder-widget lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal lgs-one-line-card on-map"
        >
            <FontAwesomeIcon
                icon={faCircle}
                className={classNames(
                    {
                        'fa-beat':  video.paused || video.finalizing,
                        finalizing: video.finalizing,
                    },
                    'video-recorder-indicator',
                )}
            />
            <span className="duration">{formatDuration(state.recordedDuration)}</span>
            <span className="size">{formatSize(state.recordedSize)}</span>
            {state.finalizing ? (
                <div className="blinking">Finalisation...</div>
            ) : (
                 <RecorderControls
                     recording={video.recording}
                     paused={video.paused}
                     recorder={__.recorder}
                     onFinalize={(value) => setState((prev) => ({...prev, finalizing: value}))}
                 />
             )}
            <span/>
            <SlTooltip content="Cancel" placement="top">
                <SlIconButton
                    onPointerDown={handleCancel}
                    className="lgs-cancel-recording"
                    library="fa"
                    name={FA2SL.set(faXmark)}
                />
            </SlTooltip>
        </div>
    )
}