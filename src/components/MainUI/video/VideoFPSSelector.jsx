/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoFPSSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-03
 * Last modified: 2025-09-03
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * CropFPSSelector renders a draggable toolbar for selecting crop FPSs
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.manager - CropperManager instance for crop opeFPSns
 * @param {Object} props.manager.store - Valtio store with crop state (fpsEditor, etc.)
 * @returns {JSX.Element} Draggable crop FPS selector UI
 */
import { DragHandler }                                              from '@Core/ui/drag-handler/DragHandler'
import { VideoRecorder }                                            from '@Core/ui/video/recorder/VideoRecorder'
import { faCropSimple, faRectangle, faRectangleVertical, faSquare } from '@fortawesome/pro-regular-svg-icons'
import { faGripDots }                                               from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlTooltip }                                        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import classNames                                                   from 'classnames'
import { memo, useCallback, useEffect, useRef, useState }           from 'react'
import { useSnapshot }                                              from 'valtio'
import './style.css'

/**
 * Positioning constants for CropFPSSelector placement
 * @type {Object.<string, number>}
 * @constant
 */
const POSITIONING = {
    Y_PERCENTAGE: 0.33,
    X_PERCENTAGE: 0.5,
}


/**
 * CropFPSSelector component
 */
export const VideoFPSSelector = memo(({manager}) => {
    // Access reactive cropper and toolbar states
    const $cropper = manager?.store
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})
    // Reference to the cropper menu DOM element
    const _toolbar = useRef(null)

    useEffect(() => {
        $video.fps = lgs.settings.ui.video.fps
    }, [])

    /**
     * Updates menu position based on container bounds
     * @function
     * @param {Object} bounds - Container bounds from manager.getSourceBounds()
     */
    const updatePosition = useCallback((bounds) => {
        if (!_toolbar.current || !manager || !bounds || !bounds.width || !bounds.height) {
            return
        }
        const cssBounds = {
            width:  Math.floor(bounds.width / manager.dpr),
            height: Math.floor(bounds.height / manager.dpr),
        }
        _toolbar.current.style.position = 'absolute'
        _toolbar.current.style.left = `${cssBounds.width * POSITIONING.X_PERCENTAGE}px`
        _toolbar.current.style.top = `${cssBounds.height * POSITIONING.Y_PERCENTAGE}px`
        _toolbar.current.style.width = 'auto'
        _toolbar.current.style.transform = 'translateX(-50%)' // Center horizontally
        _toolbar.current.style.opacity = toolbars.opacity || 1
    }, [toolbars.opacity, manager])

    // Initialize position and drag handler, handle resize
    useEffect(() => {
        if (!manager || !cropper.fpsEditor || !_toolbar.current) {
            return
        }

        // Set initial position
        const bounds = manager.getSourceBounds()
        updatePosition(bounds)

        // Initialize drag handler
        _toolbar.current._dragHandler = new DragHandler({
                                                            grabber:   _toolbar.current,
                                                            parent:    _toolbar.current,
                                                            container: lgs.canvas,
                                                        })

        // Update position on resize
        const handleResize = () => {
            updatePosition(manager.getSourceBounds())
        }
        window.addEventListener('resize', handleResize)

        // Cleanup on unmount or when fpsEditor changes
        return () => {
            if (_toolbar.current?._dragHandler) {
                _toolbar.current._dragHandler.destroy()
            }
            window.removeEventListener('resize', handleResize)
        }
    }, [manager, cropper.fpsEditor, updatePosition])

    /**
     * Handles selection of a crop quality key
     * Updates the selected quality and resets the crop with new aspect quality
     * @function
     * @param {Object} key - Video format key (value, label, description, locked)
     * @param {Event} event - Click event from icon
     */
    const handleChangeFPS = useCallback((index, event) => {
        if (!_toolbar.current || !manager) {
            return
        }
        // Update store to keep fpsEditor active
        $cropper.fpsEditor = true
        $video.fps = index
        lgs.settings.ui.video.fps = index

    }, [manager, $cropper])


    // Render draggable toolbar with quality
    return (
        <>
            {cropper.fpsEditor && (
                <div className="video-fps-selector-container" ref={_toolbar}>
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
                                        onClick={event => handleChangeFPS(index, event)}>
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