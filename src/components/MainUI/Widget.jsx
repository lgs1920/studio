/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-05
 * Last modified: 2025-10-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_ANIMATION_DRAGGING, LGS_TOOLBAR, LGS_WIDGET } from '@Core/constants'
import classNames                 from 'classnames'
import React, { Children, cloneElement, useCallback, useEffect, useRef, useState } from 'react'
import Moveable                   from 'react-moveable'
import { useSingleOrDoubleEvent } from '@Core/events/useSingleOrDoubleEvent'

/**
 * Generic component for rendering a draggable element with snapping, rotating, resizing ...
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isVisible - Whether the widget is visible
 * @param {string} [props.className=''] - Additional CSS class names
 * @param {React.ReactNode} props.children - Child elements to render inside the widget
 * @param {Object} props.config - Configuration object for draggable settings
 * @param {React.RefObject} [props.childRef] - Optional ref for child component
 * @returns {JSX.Element} The rendered draggable UI widget
 */
export const Widget = ({isVisible, className = '', children, config, childRef}) => {
    // Ref for the draggable element
    const _widget = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _widgetManager = useRef(null)
    const _initialized = useRef(false)
    const _resizeRaf = useRef(0)
    const _children = childRef ?? useRef(null)

    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [position, setPosition] = useState({left: 0, top: 0})
    const [controlBoxProps, setControlBoxProps] = useState({renderDirections: [], zoom: 0, opacity: 0})
    const [guidelines, setGuidelines] = useState({verticalGuidelines: [], horizontalGuidelines: []})
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

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
     * Initialize WidgetManager instance
     */
    useEffect(() => {
        if (!_widgetManager.current) {
            _widgetManager.current = __.ui.widgetManager
        }
    }, [])

    /**
     * Handle double-click or double-tap event
     * @param {MouseEvent | TouchEvent} event - The double-click or touch event
     */
    const handleDoubleClick = useCallback((event) => {
        __.ui.widgetManager.onDoubleClick(event, setPosition, _moveable)
    }, [])

    /**
     * Unified handler for single and double click/tap events
     */
    const handleDoubleClickOrTap = useSingleOrDoubleEvent({onDouble: handleDoubleClick})

    /**
     * Get center guidelines for snapping
     * @returns {{verticalGuidelines: [], horizontalGuidelines: []}} Vertical and horizontal guidelines
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
        _widgetManager.current.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, true)
    }, [])

    /**
     * Handle mouse out event
     */
    const handleMouseOut = useCallback((event) => {
        if (isDragging) {
            return
        }
        const rect = _widget.current?.getBoundingClientRect()
        if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        _widgetManager.current.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, false)
    }, [isDragging])

    /**
     * Handle drag event
     * @param {Object} event - The drag event
     */
    const handleDrag = useCallback((event) => {
        _widgetManager.current.applyPosition(_widget.current, event.transform, _moveable, true, setControlBoxProps)
        if (_children.current?.handleDrag) {
            _children.current.handleDrag(event)
        }
    }, [])

    /**
     * Handle drag start event
     * @param {Object} event - The drag start event
     */
    const handleDragStart = useCallback((event) => {
        setIsDragging(true)
        if (_children.current?.onDragStart) {
            _children.current.onDragStart(event)
        }
        _widgetManager.current.onDragStart(event)
        _widget.current?.classList.add('dragging')
        _widgetManager.current.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, true, isMouseOver)
    }, [isMouseOver])

    /**
     * Handle drag end event
     * @param {Object} event - The drag end event
     */
    const handleDragEnd = useCallback((event) => {
        setIsDragging(false)
        _widget.current?.classList.remove('dragging')
        _widgetManager.current.onDragEnd(event)
        _widgetManager.current.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, isMouseOver)
    }, [isMouseOver])

    /**
     * Handle resize event
     * @param {Object} event - The resize event
     */
    const handleResize = useCallback((event) => {
        event.target.style.width = `${event.width}px`
        event.target.style.height = `${event.height}px`
        _widgetManager.current.onResize(event, {widget: _widget, child: _children}, setPosition)
    }, [])

    /**
     * Handle resize start event
     * @param {Object} event - The resize start event
     */
    const handleResizeStart = useCallback((event) => {
        if (_children.current?.onResizeStart) {
            _children.current.onResizeStart(event)
        }
        _widgetManager.current.onResizeStart(event)
    }, [])

    /**
     * Handle resize end event
     * @param {Object} event - The resize end event
     */
    const handleResizeEnd = useCallback((event) => {
        if (_children.current?.onResizeEnd) {
            _children.current.onResizeEnd(event)
        }
        _widgetManager.current.onResizeEnd(event)
    }, [])

    /**
     * Cleanup resize animation frame
     */
    useEffect(() => {
        return () => {
            if (_resizeRaf.current) {
                cancelAnimationFrame(_resizeRaf.current)
                _resizeRaf.current = 0
            }
        }
    }, [])

    /**
     * Initialize draggable widget and handle cleanup
     */
    useEffect(() => {
        if (!config || !isVisible) {
            return
        }
        let cancelled = false
        const tryInit = () => {
            if (cancelled || !_widget.current || !lgs?.canvas) {
                return
            }
            const ok = _widgetManager.current.setupElement(
                _widget.current,
                {
                    container:      lgs.canvas,
                    isCropper:      config.isCropper ?? false,
                    showControlBox: true,
                    left:           config.left,
                    top:            config.top,
                    attachTo:       config.attachTo,
                    containerPadding: config.containerPadding ?? 0,
                    opacity:        config.opacity ?? lgs.settings.ui.toolbars.opacity,
                    type:           LGS_WIDGET,
                    animationWhenDragging: (config.animationWhenDragging ?? null) !== null
                                           ? config.animationWhenDragging
                                           : config.type === LGS_TOOLBAR,
                    outsideOverlay: config.outsideOverlay ?? false,
                    resizeFromCenter: config.resizeFromCenter ?? false,
                    resizable:      config.resizable ?? false,
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
            if (_initialized.current && _widget.current) {
                _widgetManager.current.disposeElement(_widget.current)
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

    const handleOnBound = ({bounds}) => {
        _widgetManager.current.setBoundStatus(_widget.current)
    }

    return (
        <>
            {isVisible && (
                <div className="lgs-widget-container">
                    <div
                        className={classNames(
                            LGS_WIDGET,
                            {
                                [className]: !!className,
                                [LGS_TOOLBAR]:            config?.type === LGS_TOOLBAR,
                                [LGS_ANIMATION_DRAGGING]: config.animationWhenDragging,
                            }
                        )}
                        ref={_widget}
                        onMouseEnter={handleMouseEnter}
                        onMouseOut={handleMouseOut}
                        onDoubleClick={handleDoubleClickOrTap}
                        onTouchStart={handleDoubleClickOrTap}
                    >
                        {Children.count(children) === 1 && React.isValidElement(children)
                         ? cloneElement(children, {ref: _children})
                         : children}
                    </div>

                    <Moveable
                        ref={_moveable}
                        target={_widget}
                        container={lgs.canvas}
                        className="lgs-widget-control-box"
                        origin={false}
                        draggable={true}
                        edgeDraggable={false}
                        throttleDrag={1}
                        onDrag={handleDrag}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        resizable={config?.resizable || false}
                        resizeDirections={['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']}
                        onResize={handleResize}
                        onResizeStart={handleResizeStart}
                        onResizeEnd={handleResizeEnd}
                        keepRatio={config?.ratio?.locked || true}
                        throttleResize={2}
                        scalable={config?.scalable || false}
                        snappable={config?.snappable ?? true}
                        snapThreshold={snapThreshold}
                        snapGap={snapGap}
                        snapCenter={true}
                        snapElement={true}
                        verticalGuidelines={guidelines.verticalGuidelines}
                        horizontalGuidelines={guidelines.horizontalGuidelines}
                        snapDirections={{
                            left:   true,
                            top:    true,
                            right:  true,
                            bottom: true,
                            center: true,
                            middle: true,
                        }}
                        elementGuidelines={[lgs.canvas]}
                        bounds={bounds}
                        onBound={handleOnBound}
                        renderDirections={controlBoxProps.renderDirections}
                        zoom={controlBoxProps.zoom}
                    />
                </div>
            )}
        </>
    )
}