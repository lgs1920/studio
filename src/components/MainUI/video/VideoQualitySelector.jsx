/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualitySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-02
 * Last modified: 2025-09-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoQualitySelector allows users to select a video quality
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.manager - CropperManager instance for crop opeQualityns
 * @param {Object} props.manager.store - Valtio store with crop state (qualityEditor, etc.)
 * @returns {JSX.Element} Draggable crop Quality selector UI
 */
import { DragHandler }                                              from '@Core/ui/drag-handler/DragHandler'
import { VideoRecorder } from '@Core/ui/video/recorder/VideoRecorder'
import { faCropSimple, faRectangle, faRectangleVertical, faSquare } from '@fortawesome/pro-regular-svg-icons'
import { faGripDots }                                               from '@fortawesome/pro-solid-svg-icons'
import { SlIcon, SlTooltip }                                        from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                    from '@Utils/FA2SL'
import classNames        from 'classnames'
import { memo, useCallback, useEffect, useRef, useState }           from 'react'
import { useSnapshot }                                              from 'valtio'
import './style.css'

/**
 * Positioning constants for CropQualitySelector placement
 * @type {Object.<string, number>}
 * @constant
 */
const POSITIONING = {
    X_PERCENTAGE: 0.33, // Position at 66% of container width
    Y_PERCENTAGE: 0.5, // Position at 50% of container height
}


/**
 * CropQualitySelector component
 */
export const VideoQualitySelector = memo(({manager}) => {
    // Access reactive cropper and toolbar states
    const $cropper = manager?.store
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})
    const [forceRender, setForceRender] = useState(0)
    // Reference to the cropper menu DOM element
    const _toolbar = useRef(null)

    // Track selected quality, defaulting to first video format
    const defaultQuality = VideoRecorder.DEFAULT_QUALITY


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
        if (!manager || !cropper.qualityEditor || !_toolbar.current) {
            return
        }

        // Set initial position
        const bounds = manager.getSourceBounds()
        updatePosition(bounds)

        // Initialize drag handler
        _toolbar.current._dragHandler = new DragHandler({
                                                            grabber: _toolbar.current,
                                                            parent:  _toolbar.current,
                                                            container: lgs.canvas,
                                                        })

        // Update position on resize
        const handleResize = () => {
            updatePosition(manager.getSourceBounds())
        }
        window.addEventListener('resize', handleResize)

        // Cleanup on unmount or when qualityEditor changes
        return () => {
            if (_toolbar.current?._dragHandler) {
                _toolbar.current._dragHandler.destroy()
            }
            window.removeEventListener('resize', handleResize)
        }
    }, [manager, cropper.qualityEditor, updatePosition])

    /**
     * Handles selection of a crop quality key
     * Updates the selected quality and resets the crop with new aspect quality
     * @function
     * @param {Object} key - Video format key (value, label, description, locked)
     * @param {Event} event - Click event from icon
     */
    const handleChangeQuality = useCallback((key, event) => {
        if (!_toolbar.current || !manager) {
            return
        }
        // Update store to keep qualityEditor active
        $cropper.qualityEditor = true
        $video.quality = key

    }, [manager, $cropper])


    // Render draggable toolbar with quality
    return (
        <>
            {cropper.qualityEditor && (
                <div className="video-quality-selector-container" ref={_toolbar}>
                    <div className="video-quality-selector lgs-toolbar lgs-card on-map">
                        {/* Drag handle for moving the toolbar */}
                        <SlTooltip content="Drag me">
                            <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
                        </SlTooltip>
                        <div className="buttons-bar-on-map">
                            {Object.entries(VideoRecorder.QUALITY).map(([key, {value, name, short}]) => (
                                    <SlTooltip
                                        key={key}
                                        content={name}
                                        placement="left"
                                    >
                                        <div
                                            className={classNames('lgs-one-line-card on-map', {'selected': key === video.quality})}
                                            onClick={event => handleChangeQuality(key, event)}>
                                            {short}
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