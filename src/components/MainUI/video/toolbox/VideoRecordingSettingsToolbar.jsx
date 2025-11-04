/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-04
 * Last modified: 2025-11-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoRecordingSettingsToolbar.jsx
 *
 * Renders a call-to-action bar for the video cropper interface
 *
 * @module VideoRecordingSettingsToolbar
 */

import { Tunnel } from '@Components/Tunnel/Tunnel'
import {
    APP_KEY, CROP_TOOLS_WIDGETS, LGS_PROJECT, MINUTE, VIDEO_CROP_ZONE, VIDEO_TOOLS_WIDGETS,
}                 from '@Core/constants'
import {
    VideoRecorder,
}                 from '@Core/ui/video/recorder/VideoRecorder'
import {
    faGear,
}                 from '@fortawesome/pro-regular-svg-icons'
import {
    faPhotoFilm, faVideo,
}                 from '@fortawesome/pro-solid-svg-icons'
import {
    UIToast,
}                 from '@Utils/UIToast'
import {
    memo, useCallback, useMemo,
}                 from 'react'
import {
    useSnapshot,
}                 from 'valtio'

/**
 * VideoRecordingSettingsToolbar renders a call-to-action bar for the video cropper interface
 * @component
 * @returns {JSX.Element} The rendered toolbar component
 */
export const VideoRecordingSettingsToolbar = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const {maxSize, maxDuration} = useSnapshot(lgs.settings.ui.video)

    /**
     * Handles canceling the video editing process
     * @function
     */
    const handleCancel = useCallback(() => {
        $video.editing = false
        __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
        __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, false)
    }, [])

    /**
     * Initializes VideoRecorder with Cesium canvas
     * @function
     */
    const initializeRecorder = useCallback(() => {
        // Save settings
        $video.settings = {quality: $video.quality, fps: $video.fps}

        // Set canvas source
        const configs = __.ui.widgetManager.getWidgetConfigByGroup(CROP_TOOLS_WIDGETS)
        const widget = configs.find(config => config.id === VIDEO_CROP_ZONE)
        if (!widget) {
            console.warn('[VideoRecordingSettingsToolbar] No widget found for VIDEO_CROP_ZONE')
            return
        }
        // Configure recorder
        __.recorder.initialize({
                                   maxSize:     maxSize * 1048576, // MB to bytes
                                   maxDuration: maxDuration * MINUTE, // Minutes to milliseconds
                                   quality:     VideoRecorder.QUALITY[$video.quality].value,
                                   filename:   APP_KEY,
                                   fps:         VideoRecorder.FPS[$video.fps],
                                   dimensions: {
                                       width:  widget.cropDimensions.width * __.device.dpr,
                                       height: widget.cropDimensions.height * __.device.dpr,
                                   },
                                   ratio:      widget.ratio.value,
                                   metadata:   {
                                       artist: lgs.servers.studio.name,
                                       date:  new Date(),
                                       description: `Visit ${lgs.servers.site.protocol}://${lgs.servers.site.domain}`,
                                       album: LGS_PROJECT,
                                       genre: 'Adventure',
                                   },
                                   useWebGL:    true,
                               })


        const {top, left, width, height} = widget.cropDimensions
        widget.noResize = true

        __.recorder.setSource([lgs.canvas], {
            clipWidth: width * __.device.dpr,
            clipHeight: height * __.device.dpr,
            clipX: left * __.device.dpr,
            clipY: top * __.device.dpr,
            preserveAlpha: true,
        })
    }, [maxSize, maxDuration, $video.quality, $video.fps])

    /**
     * Toggles video recording
     * @function
     * @param {PointerEvent} event - Pointer event
     * @returns {Promise<void>}
     */
    const handleVideoRecording = useCallback(async event => {
        if (!__.recorder) {
            console.warn('[VideoRecordingSettingsToolbar] Recorder not initialized')
            return
        }

        try {
            initializeRecorder()
            await __.recorder.start()
            Object.assign($video, {
                recording: true,
                paused:    false,
                position:  {left: event.clientX, top: event.clientY},
            })
        }
        catch (error) {
            Object.assign($video, {
                recording: false,
                paused:    false,
                size:      0,
            })
            UIToast.error({
                              caption: 'Video capture',
                              text: `Stopped due to error:<br>${error.message} !`,
                          })
        }
    }, [initializeRecorder])

    /**
     * Steps configuration for Tunnel component
     * @type {Array<Object>}
     */
    const steps = useMemo(() => [
        {
            icon:       faGear,
            text:       'Video parameters',
            done:       false,
            mandatory:  false,
            beforeStep: index => {
                Object.assign($video.cropper, {
                    ratioEditor:   true,
                    qualityEditor: true,
                    fpsEditor:     true,
                    widgetEditor:  false,
                })
                __.ui.widgetManager.windowResizing = true
            },
            afterStep:  index => {
                Object.assign($video.cropper, {
                    ratioEditor:   false,
                    qualityEditor: false,
                    fpsEditor:     false,
                })
                steps[index].done = true
                __.ui.widgetManager.windowResizing = false
            },
        },
        {
            icon:       faPhotoFilm,
            text:       'Add widgets',
            done:       false,
            mandatory:  true,
            beforeStep: index => {
                steps[index].done = true
            },
            afterStep:  index => {
                $video.cropper.widgetEditor = false
            },
        },
        {
            icon:       faVideo,
            text:       'Start Recording',
            done:       false,
            mandatory: false,
            className: 'lgs-video-recording-trigger',
            beforeStep: index => {
                __.ui.widgetManager.windowResizing = false
            },
            onClick: async (index, event) => {
                Object.assign($video, {
                    editing:    false,
                    finalizing: false,
                })
                steps[index].done = true
                await handleVideoRecording(event)
            },
        },
    ], [handleVideoRecording])

    return (
        <>
            {video.editing && (
                <Tunnel
                    className="video-recording-settings-toolbar lgs-toolbar lgs-toolbar-horizontal"
                    steps={steps}
                    onCancel={handleCancel}
                />
            )}
        </>
    )
})