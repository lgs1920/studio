/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
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
 * VideoRecordingSettingsToolbar.jsx
 *
 * Renders a call-to-action bar for the video cropper interface
 *
 * @module VideoRecordingSettingsToolbar
 */

import { Tunnel }                                  from '@Components/Tunnel/Tunnel'
import { CROP_TOOLS_WIDGETS, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import { faGear }                                  from '@fortawesome/pro-regular-svg-icons'
import { faPhotoFilm, faVideo }                    from '@fortawesome/pro-solid-svg-icons'
import { memo, useCallback, useMemo }              from 'react'
import { useSnapshot }                             from 'valtio'

/**
 * VideoRecordingSettingsToolbar renders a call-to-action bar for the video cropper interface
 * @component
 * @returns {JSX.Element} The rendered toolbar component
 */
export const VideoRecordingSettingsToolbar = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

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

        Object.assign($video, {
            preRecording: true,
            recording:    false,
            paused:       false,
            position:     {left: event.clientX, top: event.clientY},
        })
    })


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