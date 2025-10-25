/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-25
 * Last modified: 2025-10-25
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Widget.jsx
 *
 * Generic component for rendering a draggable element with snapping, rotating, resizing
 *
 * @module Widget
 */
import {
    LGS_ANIMATION_DRAGGING, LGS_ANIMATION_RESIZING, LGS_TOOLBAR, LGS_WIDGET, WIDGETS_CAPABILITIES,
}                                                                        from '@Core/constants'
import classNames                                                        from 'classnames'
import React, { cloneElement, useCallback, useEffect, useRef, useState } from 'react'
import Moveable                                                          from 'react-moveable'
import { useSnapshot }                                                   from 'valtio'
import {
    usePointerSingleOrDouble,
}                                                                        from '@Components/hooks/usePointerSingleOrDouble'

// Drag thresholds for touch and mouse devices (in pixels)
const DRAG_THRESHOLD_TOUCH = 30
const DRAG_THRESHOLD_MOUSE = 5

/**
 * Generic component for rendering a draggable element with snapping, rotating, resizing
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
    const _initialized = useRef(false)
    const _resizeRaf = useRef(0)
    const _children = childRef ?? useRef(null)
    const _touchCoords = useRef({x: 0, y: 0})
    const _isDragConfirmed = useRef(false)
    const _dragStartCoords = useRef({x: 0, y: 0}) // Store initial drag coordinates
    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [position, setPosition] = useState({left: 0, top: 0})
    const [controlBoxProps, setControlBoxProps] = useState({renderDirections: [], zoom: 0, opacity: 0})
    const [guidelines, setGuidelines] = useState({verticalGuidelines: [], horizontalGuidelines: []})
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    // Log widget rendering, event handlers, and canvas styles
    useEffect(() => {
        if (lgs.canvas) {
            const styles = getComputedStyle(lgs.canvas)
        }
    }, [isVisible, config?.id])

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
     * Handle double-click event (non-touch devices)
     * @param {MouseEvent | PointerEvent} event - The double-click event
     */
    const handleDoubleClick = useCallback(event => {
        __.ui.widgetManager.onDoubleClick(event, setPosition, _moveable)
    }, [])

    /**
     * Get center guidelines for snapping, adjusted for container offset
     * @returns {{verticalGuidelines: number[], horizontalGuidelines: number[]}} Vertical and horizontal guidelines
     */
    const getCenterGuidelines = useCallback(() => {
        const container = config?.container ?? lgs.canvas
        if (!container) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {width, height, left, top} = container.getBoundingClientRect()
        const centerX = left + width / 2
        const centerY = top + height / 2
        return {verticalGuidelines: [centerX], horizontalGuidelines: [centerY]}
    }, [config?.container])

    /**
     * Get custom grid guidelines for snapping, adjusted for container offset
     * @returns {{verticalGuidelines: number[], horizontalGuidelines: number[]}} Vertical and horizontal guidelines
     */
    const getCustomGridGuidelines = useCallback(() => {
        if (!config?.snapGrid || !lgs.canvas) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {x: gridX = 0, y: gridY = 0} = config.snapGrid
        const {width, height, left, top} = lgs.canvas.getBoundingClientRect()
        const verticalGuidelines = []
        const horizontalGuidelines = []
        const centerX = left + width / 2
        const centerY = top + height / 2
        if (gridX > 0) {
            verticalGuidelines.push(centerX)
            for (let x = centerX + gridX; x <= left + width; x += gridX) {
                verticalGuidelines.push(x)
            }
            for (let x = centerX - gridX; x >= left; x -= gridX) {
                verticalGuidelines.push(x)
            }
        }
        if (gridY > 0) {
            horizontalGuidelines.push(centerY)
            for (let y = centerY + gridY; y <= top + height; y += gridY) {
                horizontalGuidelines.push(y)
            }
            for (let y = centerY - gridY; y >= top; y -= gridY) {
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
        const container = config.container ?? lgs.canvas
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
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, true)
    }, [])

    /**
     * Handle mouse out event
     */
    const handleMouseOut = useCallback(event => {
        if (isDragging) {
            return
        }
        const rect = _widget.current?.getBoundingClientRect()
        if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, false)
    }, [isDragging])

    /**
     * Handle drag event
     * @param {Object} event - The drag event
     */
    const handleDrag = useCallback(event => {
        // Get current coordinates from the event (supporting both PointerEvent and MouseEvent)
        const currentX = event.inputEvent.clientX ?? event.inputEvent.x
        const currentY = event.inputEvent.clientY ?? event.inputEvent.y

        // Determine drag threshold based on input type
        const dragThreshold = event.inputEvent.pointerType === 'touch' ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD_MOUSE

        // Check if movement exceeds the threshold in x or y
        const deltaX = Math.abs(currentX - _dragStartCoords.current.x)
        const deltaY = Math.abs(currentY - _dragStartCoords.current.y)

        if (!_isDragConfirmed.current && (deltaX < dragThreshold && deltaY < dragThreshold)) {
            return // Do not apply drag if threshold is not met
        }

        // Set dragging state when threshold is met
        if (_isDragConfirmed.current) {
            setIsDragging(true)
        }

        _isDragConfirmed.current = true
        __.ui.widgetManager.applyPosition(_widget.current, event.transform, _moveable, true, setControlBoxProps)
        __.ui.widgetManager.onDrag(event)
        if (_children.current?.handleDrag) {
            _children.current.handleDrag(event)
        }
    }, [])

    /**
     * Handle drag start event
     * @param {Object} event - The drag start event
     */
    const handleDragStart = useCallback(event => {
        _isDragConfirmed.current
        if (_children.current?.onDragStart) {
            _children.current.onDragStart(event)
        }
        __.ui.widgetManager.onDragStart(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, true, isMouseOver)
    }, [isMouseOver])

    /**
     * Handle drag end event
     * @param {Object} event - The drag end event
     */
    const handleDragEnd = useCallback(event => {
        _isDragConfirmed.current = false
        setIsDragging(false)
        __.ui.widgetManager.onDragEnd(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, isMouseOver)
    }, [isMouseOver])

    /**
     * Handle pointer down event to capture coordinates
     * @param {PointerEvent | MouseEvent} event - The pointer down event
     */
    const handlePointerDown = useCallback(event => {
        event.stopPropagation()
        if (_isDragConfirmed.current) {
            event.preventDefault()
        }
        _touchCoords.current = {x: event.clientX ?? event.x, y: event.clientY ?? event.y}
        _dragStartCoords.current = {x: event.clientX ?? event.x, y: event.clientY ?? event.y} // Store initial
                                                                                              // coordinates for drag
        _isDragConfirmed.current = false
        // handleUserEvent(event)
    }, [])

    /**
     * Handle pointer move event to update coordinates
     * @param {PointerEvent | MouseEvent} event - The pointer move event
     */
    const handlePointerMove = useCallback(event => {
        _touchCoords.current = {x: event.clientX ?? event.x, y: event.clientY ?? event.y}
    }, [])

    /**
     * Handle pointer up event
     * @param {PointerEvent | MouseEvent} event - The pointer up event
     */
    const handlePointerUp = useCallback(event => {
        handleUserEvent(event)
    }, [])

    /**
     * Handle pointer cancel event
     * @param {PointerEvent | MouseEvent} event - The pointer cancel event
     */
    const handlePointerCancel = useCallback(event => {
        _isDragConfirmed.current = false
        _touchCoords.current = {x: 0, y: 0}
        _dragStartCoords.current = {x: 0, y: 0}
        handleUserEvent(event)
    }, [])

    /**
     * Handle context menu event
     * @param {MouseEvent | PointerEvent} event - The context menu event
     */
    const handleContextMenu = useCallback(event => {
        event.preventDefault()
        let x = event.clientX
        let y = event.clientY
        if (!x || !y || isNaN(x) || isNaN(y)) {
            x = _touchCoords.current.x
            y = _touchCoords.current.y
        }
        if (!x || !y || isNaN(x) || isNaN(y)) {
            const element = document.elementFromPoint(_touchCoords.current.x || event.clientX, _touchCoords.current.y || event.clientY)
            if (element) {
                const rect = element.getBoundingClientRect()
                x = rect.left + rect.width / 2
                y = rect.top + rect.height / 2
            }
            else {
                x = 0
                y = 0
            }
        }
        if (x > 0 && y > 0) {
            Object.assign($widget, {
                canDisplayContextMenu: true,
                id:                    config?.id,
                timer:                 null,
                position:              {x, y},
            })
        }
    }, [config])

    /**
     * Handle double-tap event for touch devices to trigger context menu or cropper double-click
     */
    const handleUserEvent = usePointerSingleOrDouble({
                                                         onSingleClickOrTap: (event) => {
                                                             // Handle single tap by triggering the native click event
                                                             const element = event.currentTarget === null ? event.target : event.currentTarget
                                                             console.log(element, !_isDragConfirmed.current)
                                                             if (element) {
                                                                 element.click() // Trigger native click event
                                                             }
                                                         },
                                                         onDoubleTap:        event => {
                                                             if (event.pointerType === 'touch') {
                                                                 if (!config.isCropper) {
                                                                     handleContextMenu(event)
                                                                 }
                                                                 else {
                                                                     handleDoubleClick(event)
                                                                 }
                                                             }
                                                         },
                                                     })

    /**
     * Handle resize event
     * @param {Object} event - The resize event
     */
    const handleResize = useCallback(event => {
        event.target.style.width = `${event.width}px`
        event.target.style.height = `${event.height}px`
        __.ui.widgetManager.onResize(event, {widget: _widget, child: _children}, setPosition)
    }, [])

    /**
     * Handle resize start event
     * @param {Object} event - The resize start event
     */
    const handleResizeStart = useCallback(event => {
        if (_children.current?.onResizeStart) {
            _children.current.onResizeStart(event)
        }
        __.ui.widgetManager.onResizeStart(event)
    }, [])

    /**
     * Handle resize end event
     * @param {Object} event - The resize end event
     */
    const handleResizeEnd = useCallback(event => {
        if (_children.current?.onResizeEnd) {
            _children.current.onResizeEnd(event)
        }
        __.ui.widgetManager.onResizeEnd(event)
    }, [])

    /**
     * Handle scale event
     * @param {Object} event - The scale event
     */
    const handleScale = useCallback(event => {
        const scaleX = event.scale?.[0] ?? 1
        const scaleY = event.scale?.[1] ?? 1
        event.target.style.transform = event.drag?.transform
                                       ? `${event.drag.transform} scale(${scaleX}, ${scaleY})`
                                       : `scale(${scaleX}, ${scaleY})`
        __.ui.widgetManager.onScale(event, {widget: _widget, child: _children}, setPosition)
    }, [])

    /**
     * Handle scale start event
     * @param {Object} event - The scale start event
     */
    const handleScaleStart = useCallback(event => {
        if (_children.current?.onScaleStart) {
            _children.current.onScaleStart(event)
        }
        __.ui.widgetManager.onScaleStart(event)
    }, [])

    /**
     * Handle scale end event
     * @param {Object} event - The scale end event
     */
    const handleScaleEnd = useCallback(event => {
        if (_children.current?.onScaleEnd) {
            _children.current.onScaleEnd(event)
        }
        __.ui.widgetManager.onScaleEnd(event)
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
            _isDragConfirmed.current = false
            _touchCoords.current = {x: 0, y: 0}
            _dragStartCoords.current = {x: 0, y: 0}
        }
    }, [])

    /**
     * Initialize the widget and handle cleanup
     */
    useEffect(() => {
        if (!config || !isVisible) {
            return
        }
        let cancelled = false
        let resizeObserver = null
        let widgetElement = null
        const tryInit = async () => {
            if (cancelled || !_widget.current) {
                return
            }
            widgetElement = _widget.current
            let initialConfig = {
                animationWhenDragging: (config.animationWhenDragging ?? null) !== null
                                       ? config.animationWhenDragging
                                       : config.type === LGS_TOOLBAR,
                attachTo:         config.attachTo,
                container:        config.container ?? lgs.canvas,
                contextMenu:      __.ui.widgetManager.cloneContext(config?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                cropDimensions:   config.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0},
                dynamic:          config.dynamic ?? false,
                forceEven:        config.forceEven ?? false,
                group:            config.group ?? null,
                id:               config.id ?? null,
                isCropper:        config.isCropper ?? false,
                left:             config.left,
                margin:           config.margin ?? 0,
                mandatory:        config.mandatory ?? false,
                opacity:          config.opacity ?? lgs.settings.ui.toolbars.opacity,
                outsideOverlay:   config.outsideOverlay ?? false,
                persist:          config.persist ?? false,
                ratio:            config.ratio ?? null,
                resizeFromCenter: config.resizeFromCenter ?? false,
                resizable:        config.resizable ?? false,
                scalable:         config.scalable ?? false,
                showControlBox:   true,
                top:              config.top,
                transient:        config.transient ?? false,
                ttl:              config.ttl ?? null,
                type:             LGS_WIDGET,
            }
            await __.ui.widgetManager.retrieveConfig(widgetElement, initialConfig)
            const ok = await __.ui.widgetManager.setupElement(
                _widget.current,
                initialConfig,
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
            if (_controlBoxTimer.current) {
                clearTimeout(_controlBoxTimer.current)
                _controlBoxTimer.current = null
            }
            if (_resizeRaf.current) {
                cancelAnimationFrame(_resizeRaf.current)
                _resizeRaf.current = 0
            }
            _isDragConfirmed.current = false
            if (_initialized.current && widgetElement && __.ui.widgetManager && !config?.persist) {
                try {
                    __.ui.widgetManager.disposeElement(widgetElement)
                }
                catch (error) {
                    console.error('[Widget] Error disposing widget:', error)
                }
                _initialized.current = false
            }
            _widget.current = null
            widgetElement = null
            if (resizeObserver && lgs.canvas) {
                resizeObserver.unobserve(lgs.canvas)
                resizeObserver = null
            }
        }
    }, [
                  isVisible,
                  config?.id,
                  config?.left,
                  config?.top,
                  config?.attachTo,
                  config?.opacity,
                  config?.animationWhenDragging,
                  config?.resizable,
                  config?.scalable,
                  config?.resizeFromCenter,
                  config?.margin,
                  config?.outsideOverlay,
                  config?.type,
                  config?.transient,
                  config?.isCropper,
              ])

    /**
     * Update Moveable rect when bounds change
     */
    useEffect(() => {
        if (!lgs?.canvas) {
            return
        }
        _moveable.current?.updateRect()
    }, [bounds])

    /**
     * Handle bound event
     * @param {Object} event - The bound event
     */
    const handleOnBound = useCallback(event => {
        __.ui.widgetManager.setBoundStatus(_widget.current)
    }, [])

    /**
     * Handle Moveable render event for debugging
     * @param {Object} event - The render event
     */
    const handleRender = useCallback(event => {
    }, [])

    return (
        <>
            {isVisible && (
                <div className="lgs-widget-container">
                    <div
                        className={classNames(
                            LGS_WIDGET,
                            {
                                [className]: !!className,
                                [config?.type]: config?.type && config?.type !== LGS_WIDGET,
                                [LGS_ANIMATION_DRAGGING]: config.animationWhenDragging,
                                [LGS_ANIMATION_RESIZING]: config.animationWhenResizing,
                            },
                        )}
                        ref={_widget}
                        onMouseEnter={handleMouseEnter}
                        onMouseOut={handleMouseOut}
                        onDoubleClick={handleDoubleClick}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onContextMenu={handleContextMenu}
                        style={{
                            touchAction:   'manipulation',
                            pointerEvents: 'auto',
                            zIndex:        1000,
                            position:      'absolute',
                        }}
                    >
                        {children}
                    </div>
                    <Moveable
                        ref={_moveable}
                        target={_widget}
                        container={lgs.canvas}
                        className="lgs-widget-control-box"
                        origin={false}
                        draggable={config?.draggable ?? true}
                        edgeDraggable={false}
                        throttleDrag={1}
                        onDrag={handleDrag}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onRender={handleRender}
                        resizable={config?.resizable || false}
                        onResize={handleResize}
                        onResizeStart={handleResizeStart}
                        onResizeEnd={handleResizeEnd}
                        keepRatio={Boolean(
                            __.ui.widgetManager.getWidgetConfig(config?.id)?.ratio?.locked ??
                            config?.ratio?.locked,
                        )}
                        throttleResize={1}
                        scalable={config?.scalable || false}
                        onScale={handleScale}
                        onScaleStart={handleScaleStart}
                        onScaleEnd={handleScaleEnd}
                        snappable={config?.snappable ?? true}
                        snapThreshold={snapThreshold}
                        snapGap={snapGap}
                        snapCenter={true}
                        snapElement={true}
                        verticalGuidelines={guidelines.verticalGuidelines}
                        horizontalGuidelines={guidelines.horizontalGuidelines}
                        snapDirections={{
                            left: true,
                            top: true,
                            right: true,
                            bottom: true,
                            center: true,
                            middle: true,
                        }}
                        elementGuidelines={[lgs.canvas]}
                        bounds={bounds}
                        onBound={handleOnBound}
                        renderDirections={controlBoxProps.renderDirections}
                        zoom={controlBoxProps.zoom}
                        useResizeObserver={true}
                        useMutationObserver={true}
                    />
                </div>
            )}
        </>
    )
}