/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-09
 * Last modified: 2025-10-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Tunnel }                                        from '@Components/Tunnel/Tunnel'
import { APP_KEY, LGS_PROJECT, MINUTE, VIDEO_CROP_ZONE } from '@Core/constants'
import { VideoRecorder }                                 from '@Core/ui/video/recorder/VideoRecorder'
import { faGear } from '@fortawesome/pro-regular-svg-icons'
import { faPhotoFilm, faVideo }                 from '@fortawesome/pro-solid-svg-icons'
import { UIToast }                              from '@Utils/UIToast'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useSnapshot }                          from 'valtio'

/**
 * VideoRecordingSettingsToolbar renders a call-to-action bar for the video cropper interface
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.store - Valtio store with crop state (x, y, width, height, ratioEditor, etc.)
 * @returns {JSX.Element} The rendered toolbar component
 */
export const VideoRecordingSettingsToolbar = memo(() => {

    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const settings = useSnapshot(lgs.settings.ui.video)

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

        const widget = __.ui.widgetManager.getConfig(VIDEO_CROP_ZONE)
        const {top, left, width, height} = widget.cropDimensions

        __.recorder.setSource([lgs.canvas], {
            clipWidth:  width * __.device.dpr,
            clipHeight: height * __.device.dpr,
            clipX:      left * __.device.dpr,
            clipY:      top * __.device.dpr,
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
                $video.cropper.ratioEditor = true
                $video.cropper.qualityEditor = true
                $video.cropper.fpsEditor = true
            },
            afterStep:  (index) => {
                $video.cropper.ratioEditor = false
                $video.cropper.qualityEditor = false
                $video.cropper.fpsEditor = false

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
        <>
            {video.editing &&
                <Tunnel
                    className="video-recording-settings-toolbar lgs-toolbar lgs-toolbar-horizontal"
                    steps={steps ?? {}}
                    onCancel={handleCancel}
                />

            }
        </>
    )
})