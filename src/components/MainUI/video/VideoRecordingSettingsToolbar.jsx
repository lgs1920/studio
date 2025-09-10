/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-10
 * Last modified: 2025-09-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Tunnel }                               from '@Components/Tunnel/Tunnel'
import { APP_KEY, LGS_PROJECT, MINUTE } from '@Core/constants'
import { DragHandler } from '@Core/ui/drag-handler/DragHandler'
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


    // Initial poitioning
    useEffect(() => {

        // Add drag capacity to the container
        const timeoutId = setTimeout(() => {
            console.log()
            _tunnel.current._dragHandler = new DragHandler({
                                                               target:    _tunnel.current,
                                                               container: lgs.canvas,
                                                               position:  {
                                                                   left:      '50%',
                                                                   top:       (__.device.isMobile && __.device.isPortrait) ? '80%' : '60%',
                                                                   placement: 'top',
                                                               },
                                                           })
            _tunnel.current.style.opacity = toolbars.opacity || 1
        }, 100)
        return () => {
            clearTimeout(timeoutId)
            if (_tunnel.current?._dragHandler) {
                _tunnel.current._dragHandler.destroy()
            }
        }
    }, [toolbars.opacity])

    /**
     * Handles canceling the video editing process
     * @function
     */
    const handleCancel = useCallback(() => {
        $video.editing = false
    }, [])


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
            $video.position = {left: event.clientX, top: event.clientY}
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
            onClick: async (index, event) => {
                $video.editing = false
                $video.finalizing = false
                steps[index].done = true
                await handleVideoRecording(event)
            },

        },
    ]
    return (
        <div ref={_tunnel} className="lgs-toolbar-container">
            {video.editing &&
                <Tunnel
                    className="video-recording-settings-toolbar lgs-toolbar lgs-toolbar-horizontal"
                    steps={steps ?? {}}
                    onCancel={handleCancel}
                />

            }
        </div>
    )
})