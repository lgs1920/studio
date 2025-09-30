/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-30
 * Last modified: 2025-09-30
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
import { FontAwesomeIcon }                  from '@Components/FontAwesomeIcon'
import { VideoSettingsInfo } from '@Components/MainUI/video/VideoSettingsInfo'
import { CropOverlay }                      from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone }                  from '@Components/ToolsUI/cropper/DefinedCropZone'
import { VideoRecorder }                    from '@Core/ui/video/recorder/VideoRecorder'
import { faCircle }                         from '@fortawesome/duotone-regular-svg-icons'
import { faPause, faPlay, faStop, faXmark } from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlTooltip }          from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }                            from '@Utils/FA2SL'
import { UIToast }                          from '@Utils/UIToast'
import { UnitUtils }                        from '@Utils/UnitUtils'
import classNames                           from 'classnames'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }                      from 'valtio'

/**
 * RecorderControls - Renders play/pause and stop buttons for the recorder
 * @param {Object} props
 * @param {boolean} props.recording - Whether recording is active
 * @param {boolean} props.paused - Whether recording is paused
 * @param {Object} props.recorder - Recorder instance
 */
const RecorderControls = memo(({recording, paused, recorder, finalisation}) => {

    // Memoized click handlers
    const handlePlayPause = useCallback(() => {
        if (recorder) {
            paused ? recorder.resume() : recorder.pause()
        }
    }, [recorder, paused])

    const handleStop = useCallback(() => {
        finalisation(true)
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
 * Converts physical crop values to CSS crop values
 * @param {Object} crop - Physical crop values {x, y, width, height}
 * @param {number} dpr - Device pixel ratio
 * @returns {Object} CSS crop values {x, y, width, height}
 */
const toCssCrop = (crop, dpr) => ({
    x:      crop?.x == null ? 0 : Math.floor(crop.x / dpr),
    y:      crop?.y == null ? 0 : Math.floor(crop.y / dpr),
    width:  crop?.width == null ? 0 : Math.floor(crop.width / dpr),
    height: crop?.height == null ? 0 : Math.floor(crop.height / dpr),
})

/**
 * VideoRecorderToolbar component
 */
export const VideoRecorderToolbar = ({toolbar}) => {
    // Access global video settings
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    // Local state for UI updates
    const [recordedDuration, setRecordedDuration] = useState(0)
    const [recordedSize, setRecordedSize] = useState(0)
    const [, setLastSizeEventTime] = useState(0)
    const [finalisation, setFinalisation] = useState(false)

    const _toolbar = useRef(toolbar)
    // Removed _cropZone and overlay/crop UI responsibilities from this component
    const caption = 'Video Recording'

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
        return UnitUtils.convert(bytes).toBytesUnit()
    }, [])

    // Manage recorder events, state, and toolbar position
    useEffect(() => {
        // Ensure recorder exists
        if (!__.recorder) {
            return
        }

        // Handle recording start event
        const handleStart = () => {
            if ($video.recording) {
                return
            }
            const startTime = Date.now()
            $video.recording = true
            $video.finalizing = false
            $video.paused = false
            $video.size = 0
            setRecordedDuration(0)
            setRecordedSize(0)
            setLastSizeEventTime(Date.now())

            UIToast.warning({
                                caption: caption,
                                text: 'ON AIR !',
                            })
        }

        // Handle size update events
        const handleInfo = (e) => {
            setLastSizeEventTime(Date.now())
            setRecordedSize(e.detail.size)
            setRecordedDuration(e.detail.duration)
        }

        // Handle recording pause event
        const handlePause = () => {
            if ($video.paused) {
                return
            }
            $video.paused = true
            // Removed _cropZone animation control (now handled in VideoRecordingArea)
            setRecordedDuration(__.recorder.duration)
            UIToast.warning({
                                caption: caption,
                                text: `Paused`,
                            })
        }

        // Handle recording resume event
        const handleResume = () => {
            if (!$video.paused) {
                return
            }
            $video.paused = false
            // Removed _cropZone animation control (now handled in VideoRecordingArea)
            setRecordedDuration(__.recorder.duration)
            UIToast.success({
                                caption: caption,
                                text: `Resumed`,
                            })
        }

        // Handle Finalize event
        const handleFinalize = (event) => {
            if ($video.finalizing) {
                return
            }
            $video.finalizing = true
        }

        // Handle recording stop events (stop, max-size, or max-duration)
        const handleStop = (event) => {
            if ((__.recorder && __.recorder.isRecording()) || $video.paused) {
                __.recorder.stop()
            }
            $video.recording = false
            $video.paused = false
            $video.size = 0
            setRecordedDuration(0)
            setRecordedSize(0)
            setLastSizeEventTime(0)
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

        // Add event listeners
        __.recorder.addEventListener(VideoRecorder.events.START, handleStart)
        __.recorder.addEventListener(VideoRecorder.events.INFO, handleInfo)
        __.recorder.addEventListener(VideoRecorder.events.PAUSE, handlePause)
        __.recorder.addEventListener(VideoRecorder.events.RESUME, handleResume)
        __.recorder.addEventListener(VideoRecorder.events.MAX_SIZE, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.MAX_DURATION, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.DOWNLOAD, handleDownload)
        __.recorder.addEventListener(VideoRecorder.events.FINALIZE, handleFinalize)

        // Clean up function
        return () => {
            if (__.recorder) {
                __.recorder.removeEventListener(VideoRecorder.events.START, handleStart)
                __.recorder.removeEventListener(VideoRecorder.events.INFO, handleInfo)
                __.recorder.removeEventListener(VideoRecorder.events.PAUSE, handlePause)
                __.recorder.removeEventListener(VideoRecorder.events.RESUME, handleResume)
                __.recorder.removeEventListener(VideoRecorder.events.MAX_SIZE, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.MAX_DURATION, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.DOWNLOAD, handleDownload)
                __.recorder.removeEventListener(VideoRecorder.events.FINALIZE, handleFinalize)
            }
        }
    }, [__.recorder])

    const finalise = (state) => {
        setFinalisation(state)
    }

    const handleCancel = async () => {
        $video.recording = false
        $video.paused = false
        $video.size = 0
        $video.editing = true
        setRecordedDuration(0)
        setRecordedSize(0)
        setLastSizeEventTime(0)
        setFinalisation(false)

        await __.recorder.cancel()

        UIToast.warning({
                            caption: caption,
                            text:    'Recording has been canceled!',
                        })

    }

    return (
        <>
            {/* Only the toolbar remains here */}
            <div ref={_toolbar}
                 className="video-recorder-toolbar lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal lgs-one-line-card on-map">
                <FontAwesomeIcon icon={faCircle}
                                 className={classNames({
                                                           'fa-beat':    video.paused || video.finalizing,
                                                           'finalizing': video.finalizing,
                                                       }, 'video-recorder-indicator')}/>
                <span className="duration">{formatDuration(recordedDuration)}</span>
                <span className="size">{formatSize(recordedSize)}</span>
                {finalisation ? (
                    <div className="blinking">{'Finalisation...'}</div>
                ) : (
                     <RecorderControls
                         recording={video.recording}
                         paused={video.paused}
                         recorder={__.recorder}
                         finalisation={finalise}
                     />
                 )
                }
                <span/>
                <SlTooltip content={'Cancel'} placement="top">
                    <SlIconButton onClick={handleCancel} className="lgs-cancel-recording" library="fa"
                                  name={FA2SL.set(faXmark)}/>
                </SlTooltip>
            </div>
        </>
    )
}