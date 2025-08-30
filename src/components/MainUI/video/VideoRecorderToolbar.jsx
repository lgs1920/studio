/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecorderToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-30
 * Last modified: 2025-08-30
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
import { FontAwesomeIcon } from '@Components/FontAwesomeIcon'
import { CropOverlay }     from '@Components/ToolsUI/cropper/CropOverlay'
import { DefinedCropZone } from '@Components/ToolsUI/cropper/DefinedCropZone'
import { DragHandler }     from '@Core/ui/drag-handler/DragHandler'
import { VideoRecorder }   from '@Core/ui/video/recorder/VideoRecorder'
import { faPause, faPlay, faStop } from '@fortawesome/pro-regular-svg-icons'
import { faCircle }        from '@fortawesome/duotone-regular-svg-icons'
import { SlIconButton, SlTooltip } from '@shoelace-style/shoelace/dist/react'
import './style.css'
import { FA2SL }           from '@Utils/FA2SL'
import { UIToast }         from '@Utils/UIToast'
import { UnitUtils }       from '@Utils/UnitUtils'
import classNames          from 'classnames'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSnapshot }     from 'valtio'

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
 * Converts physical crop values to CSS crop values
 * @param {Object} crop - Physical crop values {x, y, width, height}
 * @param {number} dpr - Device pixel ratio
 * @returns {Object} CSS crop values {x, y, width, height}
 */
const toCssCrop = (crop, dpr) => ({
    x:      crop?.x ? Math.floor(crop.x / dpr) : 0,
    y:      crop?.y ? Math.floor(crop.y / dpr) : 0,
    width:  crop?.width ? Math.floor(crop.width / dpr) : 0,
    height: crop?.height ? Math.floor(crop.height / dpr) : 0,
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
    const [lastSizeEventTime, setLastSizeEventTime] = useState(0)

    const _toolbar = useRef(toolbar)
    const _container = useRef(null)
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

    /**
     * Updates toolbar position based on canvas bounds
     * @param {Object} bounds - Canvas bounds {width, height}
     */
    const updatePosition = useCallback((bounds) => {
        if (!_toolbar.current || !bounds) {
            return
        }
        const cssBounds = {
            width:  Math.floor(bounds.width / __.device.dpr),
            height: Math.floor(bounds.height / __.device.dpr),
        }
        const isMobilePortrait = __.device.isMobile && __.device.isPortrait
        // Position at 50% left, 66% top, adjusted for mobile portrait
        const left = cssBounds.width * 0.5
        const top = isMobilePortrait ? cssBounds.height * 0.5 : cssBounds.height * 0.66
        _toolbar.current.style.position = 'absolute'
        _toolbar.current.style.left = `${left}px`
        _toolbar.current.style.top = `${top}px`
        _toolbar.current.style.transform = 'translateX(-50%)' // Center horizontally
        _toolbar.current.style.opacity = toolbars.opacity || 1
    }, [toolbars.opacity])

    // Manage recorder events, state, and toolbar position
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
            const startTime = Date.now()
            $video.recording = true
            $video.paused = false
            $video.totalBytes = 0
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
            setRecordedSize(e.detail.totalBytes)
            setRecordedDuration(e.detail.duration)
        }

        // Handle recording pause event
        const handlePause = () => {
            if ($video.paused) {
                return
            }
            $video.paused = true
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
            setRecordedDuration(__.recorder.duration)
            UIToast.success({
                                caption: caption,
                                text: `Resumed`,
                            })
        }

        // Handle recording stop events (stop, max-size, or max-duration)
        const handleStop = (event) => {
            if ((__.recorder && __.recorder.isRecording()) || $video.paused) {
                __.recorder.stop()
            }
            $video.recording = false
            $video.paused = false
            $video.totalBytes = 0
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

        // Initialize position
        const canvasBounds = lgs.canvas.getBoundingClientRect()
        updatePosition(canvasBounds)

        // Add drag capacity to the container
        if (_container.current) {
            _container.current._dragHandler = new DragHandler({
                                                                  grabber:   _container.current,
                                                                  parent:    _container.current,
                                                                  container: lgs.canvas,
                                                              })
        }

        // Update position on resize
        const handleResize = () => {
            const bounds = lgs.canvas.getBoundingClientRect()
            updatePosition(bounds)
        }
        window.addEventListener('resize', handleResize)

        // Add event listeners
        __.recorder.addEventListener(VideoRecorder.events.START, handleStart)
        __.recorder.addEventListener(VideoRecorder.events.INFO, handleInfo)
        __.recorder.addEventListener(VideoRecorder.events.PAUSE, handlePause)
        __.recorder.addEventListener(VideoRecorder.events.RESUME, handleResume)
        __.recorder.addEventListener(VideoRecorder.events.MAX_SIZE, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.MAX_DURATION, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.STOP, handleStop)
        __.recorder.addEventListener(VideoRecorder.events.DOWNLOAD, handleDownload)

        // Clean up function
        return () => {
            if (_container.current?._dragHandler) {
                _container.current._dragHandler.destroy()
            }
            if (__.recorder) {
                __.recorder.removeEventListener(VideoRecorder.events.START, handleStart)
                __.recorder.removeEventListener(VideoRecorder.events.INFO, handleInfo)
                __.recorder.removeEventListener(VideoRecorder.events.PAUSE, handlePause)
                __.recorder.removeEventListener(VideoRecorder.events.RESUME, handleResume)
                __.recorder.removeEventListener(VideoRecorder.events.MAX_SIZE, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.MAX_DURATION, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStop)
                __.recorder.removeEventListener(VideoRecorder.events.DOWNLOAD, handleDownload)
            }
            window.removeEventListener('resize', handleResize)
        }
    }, [__.recorder, updatePosition])

    // Update toolbar opacity when needed
    useEffect(() => {
        if (_toolbar.current) {
            _toolbar.current.style.opacity = toolbars.opacity
        }
    }, [toolbars.opacity])

    // Render toolbar only when recording is active
    return (
        <>
            {video.recording && (() => {
                // Access crop only when recording to avoid unnecessary re-renders/subscriptions
                const crop = video.cropper
                // Early return if crop is invalid
                if (!crop || !crop.x || !crop.y || !crop.width || !crop.height) {
                    return null
                }
                const dpr = __.device.dpr
                // Compute CSS crop from physical data
                const cssCrop = toCssCrop(crop, dpr)
                // Memoize style for overlay
                const overlayStyle = {
                    clipPath: `polygon(
                        0% 0%, 100% 0%, 100% 100%, 0% 100%,
                        0% ${cssCrop.y}px,
                        ${cssCrop.x}px ${cssCrop.y}px,
                        ${cssCrop.x}px ${cssCrop.y + cssCrop.height}px,
                        ${cssCrop.x + cssCrop.width}px ${cssCrop.y + cssCrop.height}px,
                        ${cssCrop.x + cssCrop.width}px ${cssCrop.y}px,
                        0% ${cssCrop.y}px
                    )`,
                }
                return (
                    <>
                        <CropOverlay style={overlayStyle}/>
                        <DefinedCropZone
                            cssCrop={cssCrop}
                            manager={{dpr: __.device.dpr}}
                            className="video-recording-in-progress"
                        />
                    </>
                )
            })()}
            <div className="video-recorder-toolbar" ref={_container}>
                <div ref={_toolbar}
                     className="lgs-toolbar-content lgs-toolbar lgs-toolbar-horizontal lgs-one-line-Card on-map">
                    <FontAwesomeIcon icon={faCircle}
                                     className={classNames(video.paused ? '' : 'fa-beat', 'video-recorder-indicator')}/>
                    <span className="duration">{formatDuration(recordedDuration)}</span>
                    <span className="size">{formatSize(recordedSize)}</span>
                    <RecorderControls
                        recording={video.recording}
                        paused={video.paused}
                        recorder={__.recorder}
                    />
                </div>
            </div>
        </>
    )
}