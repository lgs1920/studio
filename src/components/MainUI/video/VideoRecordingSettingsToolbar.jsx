/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoRecordingSettingsToolbar.jsx
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

import { VideoRecordButton }                              from '@Components/MainUI/video/VideoRecordButton'
import { VideoRecorderToolbar }                           from '@Components/MainUI/video/VideoRecorderToolbar'
import { ManageTunnel }                                   from '@Components/Tunnel/ManageTunnel'
import { DragHandler }                                    from '@Core/ui/drag-handler/DragHandler'
import { faUser }                                         from '@fortawesome/duotone-regular-svg-icons'
import { faCropSimple }                                   from '@fortawesome/pro-regular-svg-icons'
import { faCheck, faPhotoFilm, faVideo }                  from '@fortawesome/pro-solid-svg-icons'
import { FA2SL }                                          from '@Utils/FA2SL'
import { Fragment, memo, useCallback, useEffect, useRef } from 'react'
import { useSnapshot }                                    from 'valtio'

/**
 * Video editing steps
 * @type {Object.<string, number>}
 * @constant
 */
const VIDEO_STEP = {
    CROP:   1, // Crop phase: define video dimensions
    WIDGET: 2, // Widget phase: add blocks to video
    VIDEO:  3, // Video phase: record the video
}

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
    const _toolbar = useRef(null)
    const $cropper = manager?.store
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})

    /**
     * Handles canceling the video editing process
     * @function
     */
    const handleCancel = useCallback(() => {
        $video.edit = false
    }, [])

    /**
     * Updates menu position based on container bounds
     * @function
     * @param {Object} bounds - Container bounds from manager.getSourceBounds()
     */
    const updatePosition = (bounds) => {
        if (!_toolbar.current) {
            return
        }
        _toolbar.current.style.position = 'absolute'
        _toolbar.current.style.left = `${bounds.width * POSITIONING.X_PERCENTAGE}px`
        _toolbar.current.style.top = `${bounds.height * POSITIONING.Y_PERCENTAGE}px`
        _toolbar.current.style.width = 'auto'
        _toolbar.current.style.opacity = toolbars.opacity || 1
    }


    // Initialize drag handler and position updates
    useEffect(() => {
        if (!_toolbar.current || !manager) {
            return
        }

        // Set initial toolbar opacity
        _toolbar.current.style.opacity = toolbars.opacity || 1

        // Set initial position
        const bounds = manager.getSourceBounds()
        updatePosition(bounds)

        // Initialize drag handler
        _toolbar.current._dragHandler = new DragHandler({
                                                            grabber:   _toolbar.current,
                                                            parent:    _toolbar.current,
                                                            container: lgs.canvas,
                                                        })

        // Cleanup on unmount or when ratioEditor changes
        return () => {
            if (_toolbar.current?._dragHandler) {
                _toolbar.current._dragHandler.destroy()
            }
        }
    }, [manager, toolbars.opacity])

    /**
     * Steps configuration for ManageTunnel
     * @type {Array.<Object>}
     */
    const steps = [
        {
            icon:       faCropSimple,
            text:       'Video dimensions',
            done:       false,
            mandatory:  false,
            beforeStep: (index) => {
                $cropper.ratioEditor = true
            },
            afterStep:  (index) => {
                $cropper.ratioEditor = false
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
            afterStep:  (index) => {
            },
        },
        {
            icon:      faVideo,
            text:      'Record',
            done:      false,
            mandatory: false,
            className: 'lgs-video-recording-trigger',
        },
    ]

    return (
        <>
            {video.edit && (
                <div ref={_toolbar} className="video-recording-settings-toolbar">
                    <ManageTunnel
                        className="lgs-toolbar lgs-toolbar-horizontal"
                        steps={steps}
                        onCancel={handleCancel}
                    />
                </div>
            )}
        </>
    )
})