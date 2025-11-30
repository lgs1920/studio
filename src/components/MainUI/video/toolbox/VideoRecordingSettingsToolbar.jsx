/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-30
 * Last modified: 2025-11-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/*******************************************************************************
 * VideoRecordingSettingsToolbar.jsx
 *
 * Renders a call-to-action bar for the video cropper interface.
 ******************************************************************************/
import { Tunnel }                                  from '@Components/Tunnel/Tunnel'
import { CROP_TOOLS_WIDGETS, VIDEO_TOOLS_WIDGETS } from '@Core/constants'
import { faGear }                         from '@fortawesome/pro-regular-svg-icons'
import { faCamera, faPhotoFilm, faVideo } from '@fortawesome/pro-solid-svg-icons'
import { memo, useCallback, useMemo, useRef } from 'react'
import { useSnapshot }                             from 'valtio'

/**
 * VideoRecordingSettingsToolbar renders a call-to-action bar for the video cropper interface.
 * @component
 * @returns {JSX.Element|null} The rendered toolbar component or null if not in editing mode.
 */
export const VideoRecordingSettingsToolbar = memo(() => {
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const _steps = useRef([])

    // --- Handlers ---
    /** Cancels the video editing process and disposes related widgets. */
    const handleCancel = useCallback(() => {
        $video.editing = false
        __.ui.widgetManager.disposeByGroup(VIDEO_TOOLS_WIDGETS, false)
        __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)
    }, [])

    const handleSnapShot = useCallback(async (event) => {
        Object.assign($video, {
            snapshot:     true,
            preRecording: false,
            recording:    false,
        })
    }, [])

    /** Starts pre-recording phase (countdown + preview). */
    const handleVideoRecording = useCallback(async (event) => {
        if (!__.recorder) {
            console.warn('[VideoRecordingSettingsToolbar] Recorder not initialized')
            return
        }

        Object.assign($video, {
            preRecording: true,
            recording:    false,
            paused:       false,
            position: {left: event.clientX, top: event.clientY},
        })
    }, [])

    // --- Tunnel Steps ---
    /** Memoized steps configuration for the Tunnel component. */
    const steps = useMemo(() => {
        _steps.current = [
            {
                icon:       faGear,
                text:       'Video parameters',
                done:       false,
                mandatory:  false,
                beforeStep: () => {
                    $video.step = 0
                    Object.assign($video.cropper, {
                        ratioEditor:   true,
                        presetEditor: true,
                        widgetEditor:  false,
                    })
                    __.ui.widgetManager.windowResizing = true
                    return true
                },
                afterStep:  () => {
                    Object.assign($video.cropper, {
                        ratioEditor:   false,
                        presetEditor: false,
                    })
                    _steps.current[0].done = true
                    __.ui.widgetManager.windowResizing = false
                    return true
                },
            },
            {
                icon:       faPhotoFilm,
                text:       'Add widgets',
                done:       false,
                mandatory:  true,
                beforeStep: () => {
                    $video.step = 1
                    _steps.current[1].done = true
                    _steps.current[2].done = true
                    _steps.current[3].done = true

                    return true
                },
                afterStep:  () => {
                    $video.cropper.widgetEditor = false
                    return true
                },
            },
            {
                icon:       faVideo,
                text:       'Start Recording',
                done:       false,
                mandatory:  false,
                className:  'lgs-video-recording-trigger',
                beforeStep: () => {
                    $video.step = 2
                    __.ui.widgetManager.windowResizing = false
                    return true
                },
                onClick:    async (index, event) => {
                    Object.assign($video, {
                        editing:    false,
                        finalizing: false,
                    })
                    await handleVideoRecording(event)
                    return true
                },
            },

            {
                icon:       faCamera,
                text:       'Snapshot',
                done:       true,
                mandatory:  false,
                beforeStep: () => {
                    $video.step = 3
                    __.ui.widgetManager.windowResizing = false
                    return true
                },
                onClick:    async (index, event) => {
                    Object.assign($video, {
                        recording:  false,
                        editing:    false,
                        finalizing: false,
                    })
                    _steps.current[3].done = true
                    await handleSnapShot(event)
                    return true
                },
            },
        ]
        return _steps.current
    }, [handleVideoRecording, handleSnapShot])

    // --- Render ---
    if (!video.editing) {
        return null
    }

    return (
        <Tunnel
            className="video-recording-settings-toolbar lgs-toolbar lgs-toolbar-horizontal"
            steps={steps}
            onCancel={handleCancel}
        />
    )
})
