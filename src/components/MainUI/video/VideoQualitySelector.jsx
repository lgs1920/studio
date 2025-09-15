/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoQualitySelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-15
 * Last modified: 2025-09-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * VideoQualitySelector.jsx
 * VideoQualitySelector allows users to select a video quality
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.store - Valtio store with crop state (qualityEditor, etc.)
 * @returns {JSX.Element} Draggable crop Quality selector UI
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react'
import Moveable                                                  from 'react-moveable'
import { useSnapshot }                                           from 'valtio'
import { SlIcon, SlTooltip }                                     from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                                 from '@Utils/FA2SL'
import { faGripDots }                                            from '@fortawesome/pro-regular-svg-icons'
import classNames                                                from 'classnames'
import { VideoRecorder }                                         from '@Core/ui/video/recorder/VideoRecorder'
import './style.css'

/**
 * Component for a draggable video quality selector
 */
export const VideoQualitySelector = memo(({store}) => {
    // Access reactive cropper and toolbar states
    const $cropper = store
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const cropper = useSnapshot($cropper || {}, {sync: true})
    const toolbars = useSnapshot(lgs.settings.ui.toolbars || {})
    const [forceRender, setForceRender] = useState(0)
    // Reference to the video-quality-selector element
    const _toolbar = useRef(null)
    // Reference to Moveable instance
    const _moveable = useRef(null)
    // Dynamic bounds for the container
    const [bounds, setBounds] = useState({
                                             left:   0,
                                             top:    0,
                                             right:  0,
                                             bottom: 0,
                                         })
    // Current position of the toolbar
    const [position, setPosition] = useState({left: 0, top: 0})
    // Config from Draggable
    const [config, setConfig] = useState(null)
    // Timer for hiding control box
    const _controlBoxTimer = useRef(null)

    // Track selected quality, defaulting to first video format
    const defaultQuality = VideoRecorder.DEFAULT_QUALITY

    /**
     * Handles the drag event to update the toolbar position using left/top
     * @param {Object} e - Drag event from react-moveable
     */
    const handleDrag = (e) => {
        e.target.style.left = `${e.left}px`
        e.target.style.top = `${e.top}px`
        config.position = {left: e.left, top: e.top}
        setPosition({left: e.left, top: e.top})
        console.log('Dragged to position:', {left: e.left, top: e.top})

        // Reset control box timer on drag
        if (_moveable.current) {
            const controlBox = _moveable.current.getControlBoxElement()
            if (controlBox) {
                controlBox.style.opacity = '1'
                console.log('Control box opacity set to 1 during drag')
            }
            clearTimeout(_controlBoxTimer.current)
            _controlBoxTimer.current = setTimeout(() => {
                if (controlBox) {
                    controlBox.style.opacity = '0'
                    console.log('Control box hidden after 6 seconds')
                }
            }, 6000)
        }
    }

    /**
     * Handles drag start and resets control box timer
     * @param {Object} e - Drag start event
     */
    const handleDragStart = (e) => {
        __.ui.draggable.startHandler(e)
        clearTimeout(_controlBoxTimer.current)
        if (_moveable.current) {
            const controlBox = _moveable.current.getControlBoxElement()
            if (controlBox) {
                controlBox.style.opacity = '1'
                console.log('Control box opacity set to 1 on drag start')
            }
        }
    }

    /**
     * Handles drag end and starts control box timer
     * @param {Object} e - Drag end event
     */
    const handleDragEnd = (e) => {
        __.ui.draggable.stopHandler(e)
        if (_moveable.current) {
            const controlBox = _moveable.current.getControlBoxElement()
            if (controlBox) {
                controlBox.style.opacity = '1'
                console.log('Control box opacity set to 1 on drag end')
                _controlBoxTimer.current = setTimeout(() => {
                    controlBox.style.opacity = '0'
                    console.log('Control box hidden after 6 seconds')
                }, 6000)
            }
        }
    }

    // Initialize position and observe resize
    useEffect(() => {
        if (!cropper.qualityEditor || !lgs.canvas || !_toolbar.current) {
            console.log('Skipping initialization: qualityEditor, canvas, or toolbar not ready', {
                qualityEditor: cropper.qualityEditor,
                canvas:        lgs.canvas,
                toolbar:       _toolbar.current,
            })
            return
        }

        console.log('Initializing Draggable for VideoQualitySelector')
        const config = __.ui.draggable.getConfig(_toolbar.current, {
            container:      lgs.canvas,
            showControlBox: true,
            left:           __.device?.isMobile && __.device?.isPortrait ? '15%' : '30%',
            top:            '50%',
        })
        setConfig(config)

        // Update bounds and position immediately
        const newBounds = __.ui.draggable.updateBounds(config, _moveable.current)
        setBounds(newBounds)
        const newPosition = __.ui.draggable.calculateInitialPosition(config, _toolbar.current, false)
        setPosition(newPosition)
        _toolbar.current.style.left = `${newPosition.left}px`
        _toolbar.current.style.top = `${newPosition.top}px`
        _toolbar.current.style.transform = 'none'
        _toolbar.current.style.opacity = toolbars.opacity || 1

        // Set initial control box opacity to 0
        if (_moveable.current) {
            const controlBox = _moveable.current.getControlBoxElement()
            if (controlBox) {
                controlBox.style.opacity = '0'
                console.log('Initial control box opacity set to 0')
            }
            _moveable.current.updateRect()
            console.log('Moveable rect updated on initialization')
        }

        // Observe resize using singleton
        __.ui.draggable.observeResize(config, setBounds, _moveable, _toolbar.current, setPosition)

        return () => {
            console.log('Cleaning up Draggable for VideoQualitySelector')
            clearTimeout(_controlBoxTimer.current)
            __.ui.draggable.cleanup(_toolbar.current)
        }
    }, [cropper.qualityEditor, toolbars.opacity])

    // Update toolbar position and Moveable rect when position state changes
    useEffect(() => {
        if (_toolbar.current && position.left !== 0 && position.top !== 0) {
            console.log('Updating toolbar position:', position)
            _toolbar.current.style.left = `${position.left}px`
            _toolbar.current.style.top = `${position.top}px`
            if (_moveable.current) {
                _moveable.current.updateRect()
                console.log('Moveable rect updated after position change')
                const controlBox = _moveable.current.getControlBoxElement()
                if (controlBox) {
                    controlBox.style.opacity = '1'
                    console.log('Control box opacity set to 1 after position update')
                    clearTimeout(_controlBoxTimer.current)
                    _controlBoxTimer.current = setTimeout(() => {
                        controlBox.style.opacity = '0'
                        console.log('Control box hidden after 6 seconds')
                    }, 6000)
                }
            }
        }
    }, [position])

    /**
     * Handles selection of a crop quality key
     * @param {number} index - Index of the selected video quality
     * @param {Event} event - Click event from icon
     */
    const handleChangeQuality = useCallback((index, event) => {
        if (!_toolbar.current) {
            return
        }
        // Update store to keep qualityEditor active
        $cropper.qualityEditor = true
        $video.quality = index
    }, [$cropper])

    useEffect(() => {
        $video.quality = lgs.settings.ui.video.quality
    }, [])

    // Render draggable toolbar with quality
    return (
        <>
            {cropper.qualityEditor && (
                <div className="lgs-toolbar-container">
                    <div className="video-quality-selector lgs-toolbar lgs-card on-map" ref={_toolbar}>
                        {/* Drag handle for moving the toolbar */}
                        <SlTooltip content="Drag me">
                            <SlIcon library="fa" className="grabber" name={FA2SL.set(faGripDots)}/>
                        </SlTooltip>
                        <div className="buttons-bar-on-map">
                            {VideoRecorder.QUALITY.map(({value, name, short}, index) => (
                                <SlTooltip
                                    key={index}
                                    content={name}
                                    placement="left"
                                >
                                    <div
                                        className={classNames('lgs-one-line-card on-map', {'selected': index === video.quality})}
                                        onClick={(event) => handleChangeQuality(index, event)}
                                    >
                                        {short}
                                    </div>
                                </SlTooltip>
                            ))}
                        </div>
                    </div>
                    <Moveable
                        ref={_moveable}
                        target={_toolbar}
                        draggable={true}
                        throttleDrag={0}
                        onDrag={handleDrag}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        container={lgs.canvas}
                        origin={false}
                        snappable={true}
                        snapDirections={{
                            top:    true,
                            bottom: true,
                            left:   true,
                            right:  true,
                        }}
                        elementGuidelines={[lgs.canvas]}
                        bounds={bounds}
                    />
                </div>
            )}
        </>
    )
})