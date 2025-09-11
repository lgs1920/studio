/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoFPSSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-11
 * Last modified: 2025-09-11
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoFPSSelector renders a draggable toolbar for selecting video FPS
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.store - Valtio store with crop state (fpsEditor, etc.)
 * @returns {JSX.Element} Draggable video FPS selector UI
 */
import { DragHandler }                          from '@Core/ui/drag-handler/DragHandler'
import { VideoRecorder }                        from '@Core/ui/video/recorder/VideoRecorder'
import { faGripDots }                           from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlTooltip }                    from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                from '@Utils/FA2SL'
import classNames                               from 'classnames'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useSnapshot }                          from 'valtio'
import './style.css'

export const VideoFPSSelector = memo(({store}) => {
    // Access reactive cropper and video states
    const $cropper = store
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})
    // Reference to the toolbar DOM element
    const _toolbar = useRef(null)

    /**
     * Initialize default FPS from settings
     */
    useEffect(() => {
        $video.fps = lgs.settings.ui.video.fps
    }, [])

    /**
     * Initialize drag handler and handle cleanup
     */
    useEffect(() => {
        if (!cropper.fpsEditor || !_toolbar.current) {
            return
        }

        const timeoutId = setTimeout(() => {
            // Store drag handler on the toolbar element
            _toolbar.current._dragHandler = new DragHandler({
                                                                target:    _toolbar.current,
                                                                container: lgs.canvas,
                                                                position: {
                                                                    left:      '50%',
                                                                    top:       '30%',
                                                                    placement: 'bottom',
                                                                },

                                                            })
            // Update opacity
            _toolbar.current.style.opacity = toolbars.opacity || 1
        }, 100)

        return () => {
            clearTimeout(timeoutId)
            if (_toolbar.current?._dragHandler) {
                _toolbar.current._dragHandler.destroy()
            }
        }
    }, [cropper.fpsEditor, toolbars.opacity])

    /**
     * Handles selection of a FPS value
     * Updates the selected FPS and stores it in settings
     * @param {number} index - Index of the selected FPS
     * @param {Event} event - Click event from icon
     */
    const handleChangeFPS = useCallback((index, event) => {
        if (!_toolbar.current) {
            return
        }
        // Update store to keep fpsEditor active
        $cropper.fpsEditor = true
        $video.fps = index
        lgs.settings.ui.video.fps = index
    }, [$cropper])

    // Render draggable toolbar with FPS options
    return (
        <>
            {cropper.fpsEditor && (
                <div className="lgs-toolbar-container" ref={_toolbar}>
                    <div className="video-fps-selector lgs-toolbar lgs-card on-map">
                        {/* Drag handle for moving the toolbar */}
                        <SlTooltip content="Drag me">
                            <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
                        </SlTooltip>
                        <div className="buttons-bar-on-map">
                            {VideoRecorder.FPS.map((fps, index) => (
                                <SlTooltip
                                    key={fps}
                                    content={`FPS: ${fps}`}
                                    placement="top"
                                >
                                    <div
                                        className={classNames('lgs-one-line-card on-map', {'selected': index === video.fps})}
                                        onClick={event => handleChangeFPS(index, event)}
                                    >
                                        {fps}
                                    </div>
                                </SlTooltip>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
})