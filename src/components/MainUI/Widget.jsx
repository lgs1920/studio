/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-30
 * Last modified: 2025-10-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { usePointerSingleOrDouble } from '@Components/hooks/usePointerSingleOrDouble'

/**
 * @module Widget
 * @description A generic component for rendering a draggable, resizable, and scalable element with snapping.
 */
import {
    LGS_ANIMATION_DRAGGING, LGS_ANIMATION_RESIZING, LGS_TOOLBAR, LGS_VISUAL_WIDGET, LGS_WIDGET, WIDGETS_CAPABILITIES,
}                                   from '@Core/constants'
import classNames                   from 'classnames'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Moveable                     from 'react-moveable'
import { useSnapshot }              from 'valtio'

// Drag thresholds for touch and mouse devices (in pixels)
const DRAG_THRESHOLD_TOUCH = 30
const DRAG_THRESHOLD_MOUSE = 5
const CLICK_DELAY = 100 // Delay in ms for mouse clicks to confirm drag status

/**
 * Renders a draggable UI widget with snapping, resizing, and scaling capabilities.
 * @component
 * @param {Object} props
 * @param {boolean} props.isVisible - Determines if the widget is visible
 * @param {string} [props.className=''] - Additional CSS class names
 * @param {React.ReactNode} props.children - Child elements to render inside the widget
 * @param {Object} props.config - Configuration for draggable, resizable, and scalable settings
 * @param {React.RefObject} [props.childRef] - Optional ref for child component
 * @returns {JSX.Element} The rendered draggable widget
 */
export const Widget = ({isVisible, className = '', children, config, childRef}) => {
    // Refs for widget, moveable, and interaction tracking
    const _widget = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _initialized = useRef(false)
    const _resizeRaf = useRef(0)
    const _children = childRef ?? useRef(null)
    const _touchCoords = useRef({x: 0, y: 0})
    const _dragStartCoords = useRef({x: 0, y: 0})
    const _dragConfirmed = useRef(false)

    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [, setPosition] = useState({left: 0, top: 0})
    const [controlBoxProps, setControlBoxProps] = useState({renderDirections: [], zoom: 0, opacity: 0})
    const [guidelines, setGuidelines] = useState({verticalGuidelines: [], horizontalGuidelines: []})
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [dimensionsConstraint, setDimensionsConstraint] = useState({
                                                                         min: {width: 10, height: 10},
                                                                         max: {width: 500, height: 500},
                                                                     })
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)

    /**
     * Retrieves snap settings based on configuration.
     * @returns {{snapThreshold: number, snapGap: boolean}} Snap threshold and gap settings
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
     * Handles double-click events for non-touch devices.
     * @param {MouseEvent | PointerEvent} event
     */
    const handleDoubleClick = useCallback(event => {
        __.ui.widgetManager.onDoubleClick(event, setPosition, _moveable)
    }, [])

    /**
     * Calculates center guidelines for snapping, adjusted for container offset.
     * @returns {{verticalGuidelines: number[], horizontalGuidelines: number[]}}
     */
    const getCenterGuidelines = useCallback(() => {
        const container = config?.container ?? lgs.canvas
        if (!container) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {width, height, left, top} = container.getBoundingClientRect()
        return {
            verticalGuidelines:   [left + width / 2],
            horizontalGuidelines: [top + height / 2],
        }
    }, [config?.container])

    /**
     * Generates custom grid guidelines for snapping.
     * @returns {{verticalGuidelines: number[], horizontalGuidelines: number[]}}
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
     * Updates snapping guidelines when container or config changes.
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
     * Shows control box on mouse enter.
     */
    const handleMouseEnter = useCallback(() => {
        setIsMouseOver(true)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, true)
    }, [])

    /**
     * Hides control box on mouse out unless dragging.
     */
    const handleMouseOut = useCallback(event => {
        if (_dragConfirmed.current) {
            return
        }
        const rect = _widget.current?.getBoundingClientRect()
        if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, false)
    }, [])

    /**
     * Handles drag movement, confirming drag if threshold is exceeded.
     * @param {Object} event - Moveable drag event
     */
    const handleDrag = useCallback(event => {
        const inputEvent = event.inputEvent
        let currentX, currentY
        if (inputEvent.touches && inputEvent.touches.length > 0) {
            currentX = inputEvent.touches[0].clientX
            currentY = inputEvent.touches[0].clientY
        }
        else {
            currentX = inputEvent.clientX ?? inputEvent.x ?? 0
            currentY = inputEvent.clientY ?? inputEvent.y ?? 0
        }
        const dragThreshold = inputEvent.pointerType === 'touch' ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD_MOUSE
        const deltaX = Math.abs(currentX - _dragStartCoords.current.x)
        const deltaY = Math.abs(currentY - _dragStartCoords.current.y)

        if (deltaX >= dragThreshold || deltaY >= dragThreshold) {
            _dragConfirmed.current = true
            setIsDragging(true)
        }

        // Apply position without resetting scale
        const target = _widget.current
        if (target) {
            const currentTransform = __.ui.widgetManager.getTransform(target)
            const newTransform = `translate(${event.translate[0]}px, ${event.translate[1]}px) scale(${currentTransform.scale.x}, ${currentTransform.scale.y})`
            target.style.transform = newTransform
            __.ui.widgetManager.applyPosition(target, newTransform, _moveable, true, setControlBoxProps)
        }

        __.ui.widgetManager.onDrag(event)
        if (_children.current?.handleDrag) {
            _children.current.handleDrag(event)
        }
    }, [])

    /**
     * Initializes drag state and coordinates.
     * @param {Object} event - Moveable drag start event
     */
    const handleDragStart = useCallback(event => {
        setIsDragging(false)
        _dragConfirmed.current = false
        if (event.inputEvent.touches && event.inputEvent.touches.length > 0) {
            _dragStartCoords.current = {
                x: event.inputEvent.touches[0].clientX,
                y: event.inputEvent.touches[0].clientY,
            }
        }
        else {
            _dragStartCoords.current = {
                x: event.inputEvent.clientX ?? event.inputEvent.x ?? 0,
                y: event.inputEvent.clientY ?? event.inputEvent.y ?? 0,
            }
        }
        if (_children.current?.onDragStart) {
            _children.current.onDragStart(event)
        }
        __.ui.widgetManager.onDragStart(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, true, isMouseOver)
    }, [isMouseOver])

    /**
     * Resets drag state and updates control box.
     * @param {Object} event - Moveable drag end event
     */
    const handleDragEnd = useCallback(event => {
        __.ui.widgetManager.onDragEnd(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, isMouseOver)
        setIsDragging(false)
        _dragConfirmed.current = false
        // Update Moveable rectangle to ensure handles are correctly positioned
        _moveable.current?.updateRect()
    }, [isMouseOver])

    /**
     * Captures pointer down coordinates, prevents native click for mouse events only.
     * @param {PointerEvent | MouseEvent | TouchEvent} event
     */
    const handlePointerDown = useCallback(event => {
        if (event.type === 'mousedown') {
            event.preventDefault()
        }
        setIsDragging(false)
        _dragConfirmed.current = false
        if (event.touches && event.touches.length > 0) {
            _touchCoords.current = {x: event.touches[0].clientX, y: event.touches[0].clientY}
            _dragStartCoords.current = {x: event.touches[0].clientX, y: event.touches[0].clientY}
        }
        else {
            _touchCoords.current = {x: event.clientX ?? event.x ?? 0, y: event.clientY ?? event.y ?? 0}
            _dragStartCoords.current = {x: event.clientX ?? event.x ?? 0, y: event.clientY ?? event.y ?? 0}
        }
        handleUserEvent(event)
    }, [])

    /**
     * Updates touch coordinates on pointer move.
     * @param {PointerEvent | MouseEvent | TouchEvent} event
     */
    const handlePointerMove = useCallback(event => {
        if (event.touches && event.touches.length > 0) {
            _touchCoords.current = {x: event.touches[0].clientX, y: event.touches[0].clientY}
        }
        else {
            _touchCoords.current = {x: event.clientX ?? event.x ?? 0, y: event.clientY ?? event.y ?? 0}
        }
    }, [])

    /**
     * Resets drag state and handles click propagation.
     * @param {PointerEvent | MouseEvent | TouchEvent} event
     */
    const handlePointerUp = useCallback(event => {
        if (_dragConfirmed.current) {
            event.preventDefault()
            event.stopPropagation()
        }
        _dragConfirmed.current = false
        handleUserEvent(event)
    }, [])

    /**
     * Resets interaction state on pointer cancel.
     * @param {PointerEvent | MouseEvent | TouchEvent} event
     */
    const handlePointerCancel = useCallback(event => {
        setIsDragging(false)
        _dragConfirmed.current = false
        _touchCoords.current = {x: 0, y: 0}
        _dragStartCoords.current = {x: 0, y: 0}
        handleUserEvent(event)
    }, [])

    /**
     * Displays context menu at the specified coordinates.
     * @param {MouseEvent | PointerEvent | TouchEvent} event
     */
    const handleContextMenu = useCallback(event => {
        event.preventDefault()
        let x = event.clientX
        let y = event.clientY
        if (!x || !y || isNaN(x) || isNaN(y)) {
            if (event.touches && event.touches.length > 0) {
                x = event.touches[0].clientX
                y = event.touches[0].clientY
            }
            else {
                x = _touchCoords.current.x
                y = _touchCoords.current.y
            }
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
                id:       config?.id,
                timer:    null,
                position: {x, y},
            })
        }
    }, [config])

    /**
     * Handles single clicks and double taps, with immediate click for touch events.
     */
    const handleUserEvent = usePointerSingleOrDouble({
                                                         onSingleClickOrTap: event => {
                                                             if (!_dragConfirmed.current) {
                                                                 const element = event.currentTarget === null ? event.target : event.currentTarget
                                                                 if (element) {
                                                                     if (event.pointerType === 'touch') {
                                                                         element.click()
                                                                     }
                                                                     else {
                                                                         setTimeout(() => {
                                                                             element.click()
                                                                         }, CLICK_DELAY)
                                                                     }
                                                                 }
                                                             }
                                                         },
                                                         onDoubleTap: event => {
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
     * Sets transform origin based on the handle clicked for scaling, including corner handles.
     * @param {import('moveable').OnBeforeScale} event
     */
    const handleBeforeScale = useCallback(event => {
        const target = _widget.current
        if (!target) {
            return
        }

        // Get the direction of the handle clicked
        const [x, y] = event.startFixedDirection

        // Map direction to transform-origin for corners and edges
        const originX = x === 1 ? 'right' : x === -1 ? 'left' : 'center'
        const originY = y === 1 ? 'bottom' : y === -1 ? 'top' : 'center'
        target.style.transformOrigin = `${originX} ${originY}`
    }, [])

    /**
     * Applies scale transformations to the widget, adjusting scale to stay within bounds.
     * Compensates position based on transform origin and scale to maintain visual alignment for corner handles.
     * @param {Object} event - Moveable scale event
     */
    const handleScale = useCallback(event => {
        const target = _widget.current
        if (!target) {
            return
        }

        let scaleX = event.scale[0]
        let scaleY = event.scale[1]

        if (config.type === LGS_VISUAL_WIDGET) {
            const newWidth = target.offsetWidth * scaleX
            const newHeight = target.offsetHeight * scaleY

            // Clamp scale to respect min/max constraints
            scaleX = __.app.clamp(newWidth, dimensionsConstraint.min.width, dimensionsConstraint.max.width) / target.offsetWidth

            const isRatioLocked = __.ui.widgetManager.getWidgetConfig(config?.id)?.ratio?.locked || config?.ratio?.locked
            if (isRatioLocked) {
                scaleY = scaleX
                const adjustedHeight = target.offsetHeight * scaleY
                if (config.min?.height !== undefined && adjustedHeight < dimensionsConstraint.min.height) {
                    scaleY = dimensionsConstraint.min.height / target.offsetHeight
                    scaleX = scaleY
                    // __.ui.widgetManager.setTranslate(target, 0, 0)
                }
                else if (config.max?.height !== undefined && adjustedHeight > dimensionsConstraint.max.height) {
                    scaleY = dimensionsConstraint.max.height / target.offsetHeight
                    scaleX = scaleY
                    // __.ui.widgetManager.setTranslate(target, 0, 0)
                }
            }
            else {
                scaleY = __.app.clamp(newHeight, dimensionsConstraint.min.height, dimensionsConstraint.max.height) / target.offsetHeight
            }

            event.scale[0] = scaleX
            event.scale[1] = scaleY
        }

        // Apply scale transformation

        const eventTransform = __.ui.widgetManager.parseTransform(event.drag.transform)
        console.log(eventTransform, config.transform)
        // eventTransform.scale = {x: scaleX, y: scaleY}
        //  eventTransform.translate = [0, 0]
        //event.drag.transform = __.ui.widgetManager.buildTransform(eventTransform)
        target.style.transform = event.drag.transform

        __.ui.widgetManager.setScale(target, eventTransform.scale.x, eventTransform.scale.y)
        __.ui.widgetManager.setTranslate(target, eventTransform.translate.x, eventTransform.translate.y)

        __.ui.widgetManager.onScale(event, {widget: _widget, child: _children}, setPosition)

    }, [dimensionsConstraint, config.type, config?.id, config?.ratio?.locked])

    /**
     * Notifies scale start to child and widget manager
     * @param {Object} event - Moveable scale start event
     */
    const handleScaleStart = useCallback(event => {
        if (_children.current?.onScaleStart) {
            _children.current.onScaleStart(event)
        }
        __.ui.widgetManager.onScaleStart(event)
    }, [])

    /**
     * Notifies scale end to child and widget manager, and updates Moveable rectangle.
     * @param {Object} event - Moveable scale end event
     */
    const handleScaleEnd = useCallback(event => {
        if (_children.current?.onScaleEnd) {
            _children.current.onScaleEnd(event)
        }
        __.ui.widgetManager.onScaleEnd(event)
        // Update Moveable rectangle to ensure handles are correctly positioned
        _moveable.current?.updateRect()
    }, [])

    /**
     * Applies resize transformations to the widget.
     * @param {Object} event - Moveable resize event
     */
    const handleResize = useCallback(event => {
        event.target.style.width = `${event.width}px`
        event.target.style.height = `${event.height}px`
        __.ui.widgetManager.onResize(event, {widget: _widget, child: _children}, setPosition)
    }, [])

    /**
     * Notifies resize start to child and widget manager.
     * @param {Object} event - Moveable resize start event
     */
    const handleResizeStart = useCallback(event => {
        if (_children.current?.onResizeStart) {
            _children.current.onResizeStart(event)
        }
        __.ui.widgetManager.onResizeStart(event)
    }, [])

    /**
     * Notifies resize end to child and widget manager.
     * @param {Object} event - Moveable resize end event
     */
    const handleResizeEnd = useCallback(event => {
        if (_children.current?.onResizeEnd) {
            _children.current.onScaleEnd(event)
        }
        __.ui.widgetManager.onResizeEnd(event)
        // Update Moveable rectangle to ensure handles are correctly positioned
        _moveable.current?.updateRect()
    }, [])

    /**
     * Cleans up animation frame and interaction state on unmount.
     */
    useEffect(() => {
        return () => {
            if (_resizeRaf.current) {
                cancelAnimationFrame(_resizeRaf.current)
            }
            _resizeRaf.current = 0
            setIsDragging(false)
            _dragConfirmed.current = false
            _touchCoords.current = {x: 0, y: 0}
            _dragStartCoords.current = {x: 0, y: 0}
        }
    }, [])

    /**
     * Initializes widget configuration and handles cleanup.
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
                attachTo:       config.attachTo,
                container:      config.container ?? lgs.canvas,
                contextMenu:    __.ui.widgetManager.cloneContext(config?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                cropDimensions: config.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0},
                dynamic:        config.dynamic ?? false,
                forceEven:      config.forceEven ?? false,
                group:          config.group ?? null,
                id:             config.id ?? null,
                isCropper:      config.isCropper ?? false,
                left:           config.left,
                margin:         config.margin ?? 0,
                min: {width: config?.min?.width ?? 10, height: config?.min?.height ?? 10},
                max: {width: config?.max?.width ?? 500, height: config?.max?.height ?? 500},
                mandatory:      config.mandatory ?? false,
                opacity:        config.opacity ?? lgs.settings.ui.toolbars.opacity,
                outsideOverlay: config.outsideOverlay ?? false,
                persist:        config.persist ?? false,
                ratio:          config.ratio ?? null,
                resizeFromCenter: config.resizeFromCenter ?? false,
                resizable:      config.resizable ?? false,
                scalable:       config.scalable ?? false,
                showControlBox: true,
                top:            config.top,
                transient:      config.transient ?? false,
                ttl:            config.ttl ?? null,
                type: config.type ?? LGS_WIDGET,
            }

            const newConfig = await __.ui.widgetManager.retrieveConfig(widgetElement, initialConfig)
            console.log(newConfig)

            // Update constraints state with min and max from initialConfig
            setDimensionsConstraint({
                                        min: initialConfig.min,
                                        max: initialConfig.max,
                                    })

            const ok = await __.ui.widgetManager.setupElement(
                _widget.current,
                newConfig,
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
            }
            _controlBoxTimer.current = null
            if (_resizeRaf.current) {
                cancelAnimationFrame(_resizeRaf.current)
            }
            _resizeRaf.current = 0
            setIsDragging(false)
            _dragConfirmed.current = false
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
                  config?.min,
                  config?.max,
              ])

    /**
     * Updates Moveable rectangle when bounds change.
     */
    useEffect(() => {
        if (!lgs?.canvas) {
            return
        }
        _moveable.current?.updateRect()
    }, [bounds])

    /**
     * Updates widget bounds status.
     * @param {Object} event - Moveable bound event
     */
    const handleOnBound = useCallback(event => {
        __.ui.widgetManager.setBoundStatus(_widget.current)
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
                                dragging: _dragConfirmed.current,
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
                            touchAction: 'pan-x pan-y',
                            pointerEvents: 'auto',
                            zIndex:      1000,
                            position:    'absolute',
                        }}
                    >
                        {children}
                    </div>
                    <Moveable
                        // General configuration
                        className="lgs-widget-control-box"
                        container={lgs.canvas}
                        origin={false}
                        ref={_moveable}
                        target={_widget}
                        // Drag events and settings
                        draggable={config?.draggable ?? true}
                        edgeDraggable={true}
                        edge={['w', 'e', 's', 'n']}
                        onDrag={handleDrag}
                        onDragEnd={handleDragEnd}
                        onDragStart={handleDragStart}
                        throttleDrag={2}
                        // Event handling
                        onBound={handleOnBound}
                        preventDefault={false}
                        // Resize events and settings
                        keepRatio={Boolean(
                            __.ui.widgetManager.getWidgetConfig(config?.id)?.ratio?.locked ??
                            config?.ratio?.locked,
                        )}
                        onResize={handleResize}
                        onResizeEnd={handleResizeEnd}
                        onResizeStart={handleResizeStart}
                        resizable={config?.resizable || false}
                        throttleResize={2}
                        // Scale events and settings
                        onBeforeScale={handleBeforeScale}
                        onScale={handleScale}
                        onScaleEnd={handleScaleEnd}
                        onScaleStart={handleScaleStart}
                        scalable={config?.scalable || false}
                        // Snapping settings
                        bounds={bounds}
                        elementGuidelines={[lgs.canvas]}
                        horizontalGuidelines={guidelines.horizontalGuidelines}
                        snapCenter={true}
                        snapElement={true}
                        snapGap={snapGap}
                        snapThreshold={snapThreshold}
                        snappable={config?.snappable ?? true}
                        snapDirections={{
                            bottom: true,
                            center: true,
                            left:  true,
                            middle: true,
                            right: true,
                            top:   true,
                        }}
                        verticalGuidelines={guidelines.verticalGuidelines}
                        // Observers and rendering
                        renderDirections={controlBoxProps.renderDirections}
                        useMutationObserver={true}
                        useResizeObserver={true}
                        zoom={controlBoxProps.zoom}
                    />
                </div>
            )}
        </>
    )
}