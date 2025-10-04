/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DraggableUIWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-04
 * Last modified: 2025-10-04
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_ANIMATION_DRAGGING, LGS_TOOLBAR, LGS_WIDGET } from '@Core/constants'
import {
    Draggable,
}                                                          from '@Core/ui/drag-handler/Draggable'
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
export const DraggableUIWidget = ({isVisible, className = '', children, config, childRef}) => {
    // Ref for the draggable element
    const _widget = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _draggable = useRef(null)
    const _initialized = useRef(false)
    const _children = childRef ?? useRef(null)

    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [, setPosition] = useState({left: 0, top: 0})
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
     * Initialize Draggable instance
     */
    useEffect(() => {
        if (!_draggable.current) {
            _draggable.current = __.ui.draggable
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
        _draggable.current.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, true)
    }, [])

    /**
     * Handle mouse out event
     */
    const handleMouseOut = useCallback((e) => {
        if (isDragging) {
            return
        }
        const rect = _widget.current?.getBoundingClientRect()
        if (rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        _draggable.current.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, false)
    }, [isDragging])

    /**
     * Handle drag event
     * @param {Object} event - The drag event
     */
    const handleDrag = useCallback(event => {
        _draggable.current.applyPosition(_widget.current, event.transform, _moveable, true, setControlBoxProps)
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
        if (_children.current?.onDragStart) {
            _children.current.onDragStart(event)
        }
        _draggable.current.onDragStart(event)
        _widget.current?.classList.add('dragging')

        _draggable.current.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, true, isMouseOver)
    }, [isMouseOver, isDragging])

    /**
     * Handle drag end event
     * @param {Object} event - The drag end event
     */
    const handleDragEnd = useCallback(event => {
        setIsDragging(false)
        if (_children.current?.onDragEnd) {
            _children.current.onDragEnd(event)
        }
        _draggable.current.onDragEnd(event)
        _widget.current?.classList.remove('dragging')

        _draggable.current.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, isMouseOver)
    }, [isMouseOver, isDragging])

    const handleResize = useCallback((e) => {
        // e has: width, height, drag (with beforeTranslate), and target is the element
        const target = _widget.current
        if (!target) {
            return
        }

        const [tx, ty] = e.drag?.beforeTranslate || [0, 0]
        const baseLeft = parseInt(target.style.left || '0', 10)
        const baseTop = parseInt(target.style.top || '0', 10)
        const finalLeft = Math.round(baseLeft + tx)
        const finalTop = Math.round(baseTop + ty)

        // Commit styles so they reflect the latest box
        target.style.left = `${finalLeft}px`
        target.style.top = `${finalTop}px`
        target.style.width = `${Math.round(e.width)}px`
        target.style.height = `${Math.round(e.height)}px`
        target.style.transform = 'none'

        // Sync overlay
        const draggable = _draggable.current
        if (draggable) {
            const id = draggable.retrieveElementId(target)
            const cfg = draggable.getConfig(id)
            if (cfg?.isCropper) {
                cfg.element = target
                cfg.cropDimensions = {
                    left:   finalLeft,
                    top:    finalTop,
                    width:  Math.round(e.width),
                    height: Math.round(e.height),
                }
                draggable.applyCropToOverlay(cfg)
            }
        }

        // Let child update info UI
        if (_children.current?.handleResize) {
            _children.current.handleResize({
                                               left:   finalLeft,
                                               top:    finalTop,
                                               width:  Math.round(e.width),
                                               height: Math.round(e.height),
                                           })
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
            const ok = _draggable.current.setupElement(
                _widget.current,
                {
                    container:        lgs.canvas,
                    isCropper:        config.isCropper ?? false,
                    showControlBox:   true, // used only for snap lines
                    left:                  config.left,
                    top:                   config.top,
                    attachTo:              config.attachTo,
                    containerPadding: config.containerPadding ?? 0,
                    opacity:          config.opacity ?? lgs.settings.ui.toolbars.opacity,
                    type:                  LGS_WIDGET,
                    animationWhenDragging: (config.animationWhenDragging ?? null) !== null
                                           ? config.animationWhenDragging
                                           : config.type === LGS_TOOLBAR,
                    outsideOverlay:   config.outsideOverlay ?? false,
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
                _draggable.current.disposeElement(_widget.current)
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
        _draggable.current.setBoundStatus(_widget.current)
    }
    return (
        <>
            {isVisible && (
                <div className="lgs-widget-container">
                    <div
                        className={classNames(LGS_WIDGET, {
                            [className]:              !!className,
                            [LGS_TOOLBAR]:            config?.type === LGS_TOOLBAR,
                            [LGS_ANIMATION_DRAGGING]: config.animationWhenDragging,
                                              },
                        )}
                        ref={_widget}
                        onMouseEnter={handleMouseEnter}
                        onMouseOut={handleMouseOut}
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
                        throttleDrag={0}
                        onDrag={handleDrag}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}

                        resizable={config?.resizable || false}
                        resizeDirections={['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']}
                        onResize={handleResize}

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
                        onBound={handleOnBound}

                        renderDirections={controlBoxProps.renderDirections}
                        zoom={controlBoxProps.zoom}
                    />
                </div>
            )}
        </>
    )
}