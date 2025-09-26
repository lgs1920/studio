/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DraggableUIWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-26
 * Last modified: 2025-09-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_TOOLBAR, LGS_WIDGET }                                                 from '@Core/constants'
import {
    Draggable,
}                                                                                  from '@Core/ui/drag-handler/Draggable'
import classNames                                                                  from 'classnames'
import React, { Children, cloneElement, useCallback, useEffect, useRef, useState } from 'react'
import Moveable                                                                    from 'react-moveable'

/**
 * Generic component for rendering a draggable element with snapping, rotating, resizing ...
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isVisible - Whether the widget is visible
 * @param {string} [props.className=''] - Additional CSS class names
 * @param {React.ReactNode} props.children - Child elements to render inside the widget
 * @param {Object} props.config - Configuration object for draggable settings
 * @returns {JSX.Element} The rendered draggable UI widget
 */
export const DraggableUIWidget = ({isVisible, className = '', children, config}) => {
    // Ref for the draggable element
    const _toolbar = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _draggable = useRef(null)
    const _initialized = useRef(false)
    const _children = useRef(null)

    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [, setPosition] = useState({left: 0, top: 0})
    const [controlBoxProps, setControlBoxProps] = useState({renderDirections: [], zoom: 0, opacity: 0})
    const [guidelines, setGuidelines] = useState({verticalGuidelines: [], horizontalGuidelines: []})
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isDragging, setIsDragging] = useState(false)


    // Drag settings
    const DRAG_START_THRESHOLD = 20 // Minimum pixels to start drag

    /**
     * Get snap settings based on configuration
     * @returns {Object} Snap settings with threshold and gap
     */
    const getSnapSettings = useCallback(() => {
        const sensitivity = config?.snapSensitivity || 'medium'
        switch (sensitivity) {
            case 'low':
                return {snapThreshold: 15, snapGap: true}
            case 'high':
                return {snapThreshold: 5, snapGap: false}
            case 'medium':
            default:
                return {snapThreshold: 30, snapGap: true}
        }
    }, [config?.snapSensitivity])

    const {snapThreshold, snapGap} = getSnapSettings()

    /**
     * Initialize Draggable instance
     */
    useEffect(() => {
        if (!_draggable.current) {
            _draggable.current = new Draggable()
        }
    }, [])

    /**
     * Get center guidelines for snapping
     * @returns {Object} Vertical and horizontal guidelines
     */
    const getCenterGuidelines = useCallback(() => {
        const container = lgs.canvas
        if (!container) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {width, height} = container.getBoundingClientRect()
        return {verticalGuidelines: [width / 2], horizontalGuidelines: [height / 2]}
    }, [])

    /**
     * Get custom grid guidelines for snapping
     * @returns {Object} Vertical and horizontal guidelines
     */
    const getCustomGridGuidelines = useCallback(() => {
        if (!config?.snapGrid || !lgs.canvas) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {x: gridX = 0, y: gridY = 0} = config.snapGrid
        const {width, height} = lgs.canvas.getBoundingClientRect()
        const verticalGuidelines = []
        const horizontalGuidelines = []
        const centerX = width / 2
        const centerY = height / 2
        if (gridX > 0) {
            verticalGuidelines.push(centerX)
            for (let x = centerX + gridX; x <= width; x += gridX) {
                verticalGuidelines.push(x)
            }
            for (let x = centerX - gridX; x >= 0; x -= gridX) {
                verticalGuidelines.push(x)
            }
        }
        if (gridY > 0) {
            horizontalGuidelines.push(centerY)
            for (let y = centerY + gridY; y <= height; y += gridY) {
                horizontalGuidelines.push(y)
            }
            for (let y = centerY - gridY; y >= 0; y -= gridY) {
                horizontalGuidelines.push(y)
            }
        }
        return {verticalGuidelines, horizontalGuidelines}
    }, [config?.snapGrid])

    /**
     * Update guidelines when container or config changes
     */
    useEffect(() => {
        const updateGuidelines = () => {
            const center = getCenterGuidelines()
            const grid = getCustomGridGuidelines()
            const verticalGuidelines = [...new Set([...center.verticalGuidelines, ...grid.verticalGuidelines])].sort((a, b) => a - b)
            const horizontalGuidelines = [...new Set([...center.horizontalGuidelines, ...grid.horizontalGuidelines])].sort((a, b) => a - b)
            setGuidelines({verticalGuidelines, horizontalGuidelines})
            _moveable.current?.updateRect()
        }
        updateGuidelines()
        const container = lgs.canvas
        if (container) {
            const resizeObserver = new ResizeObserver(updateGuidelines)
            resizeObserver.observe(container)
            return () => resizeObserver.unobserve(container)
        }
    }, [getCenterGuidelines, getCustomGridGuidelines])

    /**
     * Handle mouse enter event
     */
    const handleMouseEnter = useCallback(() => {
        setIsMouseOver(true)
        _draggable.current.handleControlBoxVisibility(_moveable, setControlBoxProps, _controlBoxTimer, false, true)
    }, [])

    /**
     * Handle mouse out event
     */
    const handleMouseOut = useCallback((e) => {
        if (isDragging) {
            return
        }
        const rect = _toolbar.current?.getBoundingClientRect()
        if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        _draggable.current.handleControlBoxVisibility(_moveable, setControlBoxProps, _controlBoxTimer, false, false)
    }, [isDragging])

    /**
     * Handle drag event
     * @param {Object} event - The drag event
     */
    const handleDrag = useCallback(event => {
        _draggable.current.updatePosition(_toolbar.current, event.transform, _moveable, true, setControlBoxProps)
        if (_children.current?.handleDrag) {
            _children.current.handleDrag(event)
        }
    }, [isDragging])

    /**
     * Handle drag start event
     * @param {Object} event - The drag start event
     */
    const handleDragStart = useCallback(event => {
        setIsDragging(true)
        if (_children.current?.handleDragStart) {
            _children.current.handleDragStart(event)
        }
        _draggable.current.dragStartHandler(event)
        _toolbar.current?.classList.add('dragging')

        _draggable.current.handleControlBoxVisibility(_moveable, setControlBoxProps, _controlBoxTimer, true, isMouseOver)
    }, [isMouseOver, isDragging])

    /**
     * Handle drag end event
     * @param {Object} event - The drag end event
     */
    const handleDragEnd = useCallback(event => {
        setIsDragging(false)
        if (_children.current?.handleDragEnd) {
            _children.current.handleDragEnd(event)
        }
        _draggable.current.dragStopHandler(event)
        _toolbar.current?.classList.remove('dragging')

        _draggable.current.handleControlBoxVisibility(_moveable, setControlBoxProps, _controlBoxTimer, false, isMouseOver)
    }, [isMouseOver, isDragging])

    /**
     * Initialize draggable widget and handle cleanup
     */
    useEffect(() => {
        if (!config || !isVisible) {
            return
        }
        let cancelled = false
        const tryInit = () => {
            if (cancelled || !_toolbar.current || !lgs?.canvas) {
                return
            }
            const ok = _draggable.current.initialize(
                _toolbar.current,
                {
                    container:      lgs.canvas,
                    // Although the visibility of th ControlBox is managed, we force it to show
                    // but frame is forced to be tranparent
                    showControlBox: true,
                    left:           config.left,
                    top:            config.top,
                    attachTo:       config.attachTo,
                    containerPadding: lgs.gutter.xs,
                    opacity:        lgs.settings.ui.toolbars.opacity,
                    type: LGS_WIDGET,
                },
                setBounds,
                setPosition,
                _moveable,
            )
            if (ok) {
                _initialized.current = true
                _moveable.current?.updateRect()
            }
            else {
                requestAnimationFrame(tryInit)
            }
        }
        requestAnimationFrame(() => requestAnimationFrame(tryInit))
        return () => {
            cancelled = true
            clearTimeout(_controlBoxTimer.current)
            if (_initialized.current && _toolbar.current) {
                _draggable.current.cleanup(_toolbar.current)
                _initialized.current = false
            }
        }
    }, [isVisible, config])

    /**
     * Update Moveable rect when bounds change
     */
    useEffect(() => {
        if (!lgs?.canvas) {
            return
        }
        _moveable.current?.updateRect()
    }, [bounds])

    return (
        <>
            {isVisible && (
                <div className="lgs-widget-container">
                    <div
                        className={classNames(LGS_WIDGET, {
                                                  [className]:   !!className,
                            [LGS_TOOLBAR]: config?.type === LGS_TOOLBAR,
                                              },
                        )}
                        ref={_toolbar}
                        onMouseEnter={handleMouseEnter}
                        onMouseOut={handleMouseOut}
                    >
                        {Children.count(children) === 1
                         ? cloneElement(children, {ref: _children})
                         : children}
                    </div>

                    <Moveable
                        ref={_moveable}
                        target={_toolbar}
                        container={lgs.canvas}
                        className="lgs-draggable-widget"
                        origin={false}

                        draggable={true}
                        edgeDraggable={false}
                        throttleDrag={0}
                        startDragDistance={DRAG_START_THRESHOLD}
                        onDrag={handleDrag}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}

                        resizable={config?.resizable || false}
                        resizeDirections={['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']}

                        scalable={config?.scalable || false}

                        snappable={config?.snappable ?? true}
                        snapThreshold={snapThreshold}
                        snapGap={snapGap}
                        snapCenter={true}
                        snapElement={true}
                        verticalGuidelines={guidelines.verticalGuidelines}
                        horizontalGuidelines={guidelines.horizontalGuidelines}
                        snapDirections={{
                            left: true, top: true, right: true, bottom: true, center: true, middle: true,
                        }}
                        elementGuidelines={[lgs.canvas]}

                        bounds={bounds}
                        renderDirections={controlBoxProps.renderDirections}
                        zoom={controlBoxProps.zoom}
                        onRender={(e) => {
                            e.target.style.opacity = lgs.settings.ui.toolbars.opacity
                        }}
                    />
                </div>
            )}
        </>
    )
}