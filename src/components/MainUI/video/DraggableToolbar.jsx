/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DraggableToolbar.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-19
 * Last modified: 2025-09-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import classNames                                          from 'classnames'
import React, { useCallback, useRef, useEffect, useState } from 'react'
import Moveable                                            from 'react-moveable'
import { Draggable }                                       from '@Core/ui/drag-handler/Draggable'

/**
 * Generic component for rendering a draggable toolbar UI
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isVisible - Whether the toolbar should be visible
 * @param {string} props.className - Additional CSS class for the toolbar container
 * @param {ReactNode} props.children - Content of the toolbar
 * @param {Object} props.config - Configuration for the toolbar, must include left and top
 * @param {string|number} props.config.left - Initial left position (e.g., '30%' or 100)
 * @param {string|number} props.config.top - Initial top position (e.g., '50%' or 100)
 * @param {string} [props.config.attachTo] - Anchor point for positioning ('center', 'top', 'left', 'right', 'bottom',
 *     'top-left', 'top-right', 'bottom-left', 'bottom-right')
 * @returns {JSX.Element} Draggable toolbar UI
 */
export const DraggableToolbar = ({isVisible, className = '', children, config}) => {
    // Reference to the toolbar element
    const _toolbar = useRef(null)
    // Reference to Moveable instance
    const _moveable = useRef(null)
    // Timer for hiding control box
    const _controlBoxTimer = useRef(null)
    // Dynamic bounds for the container
    const [bounds, setBounds] = useState({
                                             left:   0,
                                             top:    0,
                                             right:  0,
                                             bottom: 0,
                                         })
    // Current position of the toolbar
    const [, setPosition] = useState({left: 0, top: 0})
    // Control box visibility props
    const [controlBoxProps, setControlBoxProps] = useState({
                                                               renderDirections: [],
                                                               zoom:             0,
                                                           })
    // Instance of Draggable singleton
    const draggable = new Draggable()
    // Track if initialization was performed
    const _initialized = useRef(false)

    /**
     * Handles the drag event to update the toolbar position
     * @param {Object} e - Drag event from react-moveable
     */
    const handleDrag = useCallback(e => {
        draggable.updatePosition(
            _toolbar.current,
            {left: e.left, top: e.top},
            _moveable,
            true,
            setControlBoxProps,
        )
    }, [])

    /**
     * Handles drag start and shows control box if enabled
     * @param {Object} e - Drag start event
     */
    const handleDragStart = useCallback(e => {
        draggable.startHandler(e)
        _moveable.current.target = e.target
        draggable.handleControlBoxVisibility(
            _moveable,
            setControlBoxProps,
            _controlBoxTimer,
            config.showControlBox || false,
        )
    }, [])

    /**
     * Handles drag end
     * @param {Object} e - Drag end event
     */
    const handleDragEnd = useCallback(e => {
        draggable.stopHandler(e)
        _moveable.current.target = e.target
        draggable.handleControlBoxVisibility(
            _moveable,
            setControlBoxProps,
            _controlBoxTimer,
            false,
        )
    }, [])

    // Initialize position, bounds, and observe resize when toolbar is mounted
    useEffect(() => {
        if (!config || !isVisible || !_toolbar.current) {
            return
        }
        // Attempt to initialize Draggable with retry until valid dimensions
        const attemptInitialize = () => {

            const rect = _toolbar.current.getBoundingClientRect()
            // Consider dimensions valid if width and height are above a threshold (e.g., 15px)
            const hasValidDimensions = rect.width > 15 && rect.height > 15

            const success = hasValidDimensions && draggable.initialize(
                _toolbar.current,
                {
                    container:        lgs.canvas,
                    showControlBox:   config.showControlBox || false,
                    left:             config.left,
                    top:              config.top,
                    attachTo:         config.attachTo,
                    containerPadding: lgs.gutter.s,
                    opacity:          lgs.settings.ui.toolbars.opacity,
                },
                setBounds,
                setPosition,
                _moveable,
            )
            _initialized.current = true

            // Update Moveable target and rect on initialization
            if (success) {
                _moveable.current.setState({target: _toolbar.current})
                _moveable.current.updateRect()
            }
            else {
                // Retry after 100ms if initialization fails or dimensions are too small
                const timer = setTimeout(attemptInitialize, 100)
                return () => clearTimeout(timer)
            }
        }

        attemptInitialize()

        // Cleanup on unmount
        return () => {
            clearTimeout(attemptInitialize.timer)
            clearTimeout(_controlBoxTimer.current)
            if (_initialized.current) {
                draggable.cleanup(_toolbar.current)
            }
        }
    }, [isVisible, config, _toolbar.current])

    // Render draggable toolbar with children
    return (
        <>
            {isVisible && (
                <div className="lgs-toolbar-container">
                    <div className={classNames('lgs-toolbar', {
                        [className]:        className,
                        'show-control-box': config?.showControlBox || false,
                    })} ref={_toolbar}>
                        {children}
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
                        renderDirections={controlBoxProps.renderDirections}
                        zoom={controlBoxProps.zoom}
                    />
                </div>
            )}
        </>
    )
}