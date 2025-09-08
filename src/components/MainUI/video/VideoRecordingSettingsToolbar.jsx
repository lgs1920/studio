/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-08
 * Last modified: 2025-09-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Tunnel }                               from '@Components/Tunnel/Tunnel'
import { APP_KEY, LGS_PROJECT, MINUTE } from '@Core/constants'
import { DragHandler }                          from '@Core/ui/drag-handler/DragHandler'
import { VideoRecorder }                        from '@Core/ui/video/recorder/VideoRecorder'
import { faGear }                       from '@fortawesome/pro-regular-svg-icons'
import { faPhotoFilm, faVideo }                 from '@fortawesome/pro-solid-svg-icons'
import { UIToast }                              from '@Utils/UIToast'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useSnapshot }                          from 'valtio'

/**
 * Positioning constants for CropRatioSelector placement
 * @type {Object.<string, number>}
 * @constant
 */
const POSITIONING = {
    Y_PERCENTAGE: 0.66,
    X_PERCENTAGE: 0.5,
}

/**
 * VideoRecordingSettingsToolbar renders a call-to-action bar for the video cropper interface
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.manager - CropperManager instance for controlling crop state
 * @param {Object} props.manager.store - Valtio store with crop state (x, y, width, height, ratioEditor, etc.)
 * @returns {JSX.Element} The rendered toolbar component
 */
export const VideoRecordingSettingsToolbar = memo(({manager}) => {
    // Access reactive video state from Valtio store
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const settings = useSnapshot(lgs.settings.ui.video)
    const _tunnel = useRef(null)
    const _toolbar = useRef(null)
    const $cropper = manager?.store
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})

    /**
     * Handles canceling the video editing process
     * @function
     */
    const handleCancel = useCallback(() => {
        $video.editing = false
    }, [])

    /**
     * Updates menu position based on container bounds
     * @function
     * @param {Object} bounds - Container bounds from manager.getSourceBounds()
     */
    const updatePosition = (bounds) => {
        if (!_tunnel.current) {
            return
        }
        _tunnel.current.style.position = 'absolute'
        _tunnel.current.style.left = `${bounds.width * POSITIONING.X_PERCENTAGE}px`
        _tunnel.current.style.top = `${bounds.height * POSITIONING.Y_PERCENTAGE}px`
        _tunnel.current.style.width = 'auto'
        _tunnel.current.style.opacity = toolbars.opacity || 1
    }


    // Initialize drag handler and position updates
    useEffect(() => {
        if (!_tunnel.current || !manager) {
            return
        }

        const getCoordinates = (event) => {
            $video.toolbarPosition = event.detail.value
        }

        // Set initial toolbar opacity
        _tunnel.current.style.opacity = toolbars.opacity || 1

        // Set initial position
        const bounds = manager.getSourceBounds()
        updatePosition(bounds)

        // Initialize drag handler
        _tunnel.current._dragHandler = new DragHandler({
                                                           grabber:   _tunnel.current,
                                                           parent:    _tunnel.current,
                                                           container: lgs.canvas,
                                                       })
        _tunnel.current.addEventListener(DragHandler.AFTER_DRAG, getCoordinates)


        // Cleanup on unmount or when ratioEditor changes
        return () => {
            if (_tunnel.current?._dragHandler) {
                _tunnel.current._dragHandler.destroy()
                _tunnel.current.removeListener(DragHandler.AFTER_DRAG, getCoordinates)
            }
        }
    }, [manager, toolbars.opacity])

    // Manage recorder events
    useEffect(() => {
        // Ensure recorder exists
        if (!__.recorder) {
            return
        }
        // Handle size updates
        const handleSizeUpdate = (e) => {
            $video.size = e.detail.size
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
            $video.size = 0
        }
        // Handle max size limit
        const handleMaxSize = () => {
            $video.recording = false
            $video.paused = false
            $video.size = 0
        }
        // Handle max duration limit
        const handleMaxDuration = () => {
            $video.recording = false
            $video.paused = false
            $video.size = 0
        }

        const handleFinalize = () => {
            $video.finalizing = true
            console.log('ok')
        }

        // // Add event listeners
        // __.recorder.addEventListener(VideoRecorder.events.INFO, handleSizeUpdate)
        // __.recorder.addEventListener(VideoRecorder.events.PAUSE, handlePause)
        // __.recorder.addEventListener(VideoRecorder.events.RESUME, handleResume)
        // __.recorder.addEventListener(VideoRecorder.events.STOP, handleStop)
        // __.recorder.addEventListener(VideoRecorder.events.MAX_SIZE, handleMaxSize)
        // __.recorder.addEventListener(VideoRecorder.events.MAX_DURATION, handleMaxDuration)
        // __.recorder.addEventListener(VideoRecorder.events.FINALIZE, handleFinalize)

        // Clean up
        return () => {
            // __.recorder.removeEventListener(VideoRecorder.events.INFO, handleSizeUpdate)
            // __.recorder.removeEventListener(VideoRecorder.events.PAUSE, handlePause)
            // __.recorder.removeEventListener(VideoRecorder.events.RESUME, handleResume)
            // __.recorder.removeEventListener(VideoRecorder.events.STOP, handleStop)
            // __.recorder.removeEventListener(VideoRecorder.events.MAX_SIZE, handleMaxSize)
            // __.recorder.removeEventListener(VideoRecorder.events.MAX_DURATION, handleMaxDuration)
            // __.recorder.removeEventListener(VideoRecorder.events.FINALIZE, handleFinalize)

            // if (video.recording && __.recorder) {
            //     __.recorder.stop()
            //     $video.finalizing = false
            //     $video.recording = false
            //     $video.paused = false
            //     $video.size = 0
            // }
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

        // Let's save settings
        lgs.settings.ui.video.quality = $video.quality
        lgs.settings.ui.video.fps = $video.fps

        // Configure recorder
        __.recorder.initialize({
                                   maxSize:     settings.maxSize * 1048576,      // MB
                                   maxDuration: settings.maxDuration * MINUTE,   // MilliSeconds
                                   quality:  VideoRecorder.QUALITY[$video.quality].value,
                                   filename:    APP_KEY,
                                   fps:      VideoRecorder.FPS[$video.fps],
                                   metadata: {
                                       artist:      lgs.servers.studio.name,
                                       date:        new Date(),
                                       description: `Visit ${lgs.servers.site.protocol}://${lgs.servers.site.domain}`,
                                       album:       LGS_PROJECT,
                                       genre:       'Adventure',
                                   },
                                   useWebGL: true,

                               })
        // Set canvas source
        __.recorder.setSource([lgs.canvas], {
            clipWidth:     $cropper.width,
            clipHeight:    $cropper.height,
            clipX:         $cropper.x,
            clipY:         $cropper.y,
            preserveAlpha: true,
        })
    }

    /**
     * Toggles video recording
     */
    const handleVideoRecording = async (event) => {
        // Ensure recorder exists
        if (!__.recorder) {
            return
        }

        try {
            initializeRecorder()
            await __.recorder.start()
            $video.recording = true
            $video.paused = false
            $video.position = {x: event.clientX, y: event.clientY}
        }
        catch (error) {
            $video.recording = false
            $video.paused = false
            $video.size = 0

            UIToast.error({
                              caption: `Video capture`,
                              text:    `Stopped due to error:<br>${error.message} !`,
                          })
        }
    }
    const steps = [
        {
            icon:       faGear,
            text:       'Video parameters',
            done:       false,
            mandatory:  false,
            beforeStep: (index) => {
                $cropper.ratioEditor = true
                $cropper.qualityEditor = true
                $cropper.fpsEditor = true
            },
            afterStep:  (index) => {
                $cropper.ratioEditor = false
                $cropper.qualityEditor = false
                $cropper.fpsEditor = false

                steps[index].done = true
            },
        },
        {
            icon:       faPhotoFilm,
            text:       'Add widgets',
            done:       false,
            mandatory:  true,
            beforeStep: (index) => {
                steps[index].done = true
            },
        },
        {
            icon:      faVideo,
            text:      'Start Recording',
            done:      false,
            mandatory: false,
            className: 'lgs-video-recording-trigger',
            onClick: (index, event) => {
                $video.editing = false
                $video.finalizing = false
                steps[index].done = true
                handleVideoRecording(event)
            },

        },
    ]
    return (
        <div ref={_tunnel} className="video-recording-settings-toolbar">
            {video.editing &&
                <Tunnel
                    className="lgs-toolbar lgs-toolbar-horizontal"
                    steps={steps ?? {}}
                    onCancel={handleCancel}
                />

            }
            {/* <VideoRecorderToolbar toolbar={_toolbar}/> */}
        </div>
    )
})