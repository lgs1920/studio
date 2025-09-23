/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DraggableUIWidget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-23
 * Last modified: 2025-09-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { Draggable }                                       from '@Core/ui/drag-handler/Draggable'
import classNames                                          from 'classnames'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Moveable                                            from 'react-moveable'

/**
 * Generic component for rendering a draggable element with snapping, rotating, resizing ...
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
 * @param {Object} [props.config.snapGrid] - Custom snap grid configuration (e.g., { x: 50, y: 50 } for 50px grid,
 *     centered on container)
 * @param {string} [props.config.snapSensitivity] - Snapping sensitivity ('low', 'medium', 'high'), defaults to
 *     'medium'
 * @returns {JSX.Element} Draggable toolbar UI
 */
export const DraggableUIWidget = ({isVisible, className = '', children, config}) => {
    const _toolbar = useRef(null)
    const _toolbarOverlay = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _longPressTimer = useRef(null)
    const [bounds, setBounds] = useState({
                                             left:   0,
                                             top:    0,
                                             right:  0,
                                             bottom: 0,
                                         })
    const [, setPosition] = useState({left: 0, top: 0})
    const [controlBoxProps, setControlBoxProps] = useState({
                                                               renderDirections: [],
                                                               zoom:    0,
                                                               opacity: 0,
                                                           })
    const [guidelines, setGuidelines] = useState({
                                                     verticalGuidelines:   [],
                                                     horizontalGuidelines: [],
                                                 })
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isReadyToDrag, setIsReadyToDrag] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    // const draggable = new Draggable()
    const _draggable = useRef(null)
    const _initialized = useRef(false)

    const getSnapSettings = useCallback(() => {
        const sensitivity = config?.snapSensitivity || 'medium'
        switch (sensitivity) {
            case 'low':
                return {snapThreshold: 15, snapGap: true}
            case 'high':
                return {snapThreshold: 5, snapGap: false}
            case 'medium':
            default:
                return {snapThreshold: 10, snapGap: true}
        }
    }, [config?.snapSensitivity])

    const getCenterGuidelines = useCallback(() => {
        const container = lgs.canvas
        if (!container) {
            console.warn('No container found for snapping')
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {width, height} = container.getBoundingClientRect()
        return {
            verticalGuidelines:   [width / 2],
            horizontalGuidelines: [height / 2],
        }
    }, [])

    const getCustomGridGuidelines = useCallback(() => {
        if (!config?.snapGrid || !lgs.canvas) {
            console.warn('No snapGrid config or container found')
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

    useEffect(() => {
        const updateGuidelines = () => {
            const {verticalGuidelines: centerVertical, horizontalGuidelines: centerHorizontal} = getCenterGuidelines()
            const {verticalGuidelines: gridVertical, horizontalGuidelines: gridHorizontal} = getCustomGridGuidelines()
            const verticalGuidelines = [...new Set([...centerVertical, ...gridVertical])].sort((a, b) => a - b)
            const horizontalGuidelines = [...new Set([...centerHorizontal, ...gridHorizontal])].sort((a, b) => a - b)
            setGuidelines({verticalGuidelines, horizontalGuidelines})
            if (_moveable.current) {
                _moveable.current.updateRect()
            }
        }

        updateGuidelines()

        const container = lgs.canvas
        if (container) {
            const resizeObserver = new ResizeObserver(() => {
                updateGuidelines()
            })
            resizeObserver.observe(container)
            return () => resizeObserver.unobserve(container)
        }
    }, [getCenterGuidelines, getCustomGridGuidelines])

    useEffect(() => {
        if (!_draggable.current) {
            _draggable.current = new Draggable()
        }
    }, [])

    const handleDrag = useCallback(event => {
        _draggable.current.updatePosition(
            _toolbar.current,
            event.transform,
            _moveable,
            true,
            setControlBoxProps,
        )
    }, [])

    const handleDragStart = useCallback(event => {
        _draggable.current.dragStartHandler(event)
        _toolbarOverlay.current.classList.remove('ready-to-drag')
        setIsReadyToDrag(false)
        setIsDragging(true)
        _draggable.current.handleControlBoxVisibility(
            _moveable,
            setControlBoxProps,
            _controlBoxTimer,
            true,
            isMouseOver,
        )
    }, [isMouseOver])

    const handleDragEnd = useCallback(event => {
        _draggable.current.dragStopHandler(event)
        setIsDragging(false)
        _draggable.current.handleControlBoxVisibility(
            _moveable,
            setControlBoxProps,
            _controlBoxTimer,
            false,
            isMouseOver,
        )
    }, [isMouseOver])

    const handleMouseEnter = useCallback(() => {
        setIsMouseOver(true)
        _draggable.current.handleControlBoxVisibility(
            _moveable,
            setControlBoxProps,
            _controlBoxTimer,
            false,
            true,
        )
    }, [])

    const handleMouseOut = useCallback(() => {
        setIsMouseOver(false)
        _draggable.current.handleControlBoxVisibility(
            _moveable,
            setControlBoxProps,
            _controlBoxTimer,
            false,
            false,
        )
    }, [])

    const handleMouseDown = useCallback(() => {
        _longPressTimer.current = setTimeout(() => {
            setIsReadyToDrag(true)
            _toolbarOverlay.current.classList.add('ready-to-drag')
        }, 300)
    }, [])

    const handleMouseUp = useCallback(() => {
        if (_longPressTimer.current) {
            clearTimeout(_longPressTimer.current)
            _longPressTimer.current = null
        }
        setIsReadyToDrag(false)
        _toolbarOverlay.current.classList.remove('ready-to-drag')
    }, [isReadyToDrag, isMouseOver])

    useEffect(() => {
        if (!isVisible || !config) {
            return
        }
        let cancelled = false
        let mo

        const tryInit = () => {
            if (cancelled || !_toolbar.current || !lgs?.canvas) {
                return
            }
            const ok = _draggable.current.initialize(
                _toolbar.current,
                {
                    container:      lgs.canvas,
                    showControlBox: !!config.showControlBox,
                    left:             config.left,
                    top:              config.top,
                    attachTo:         config.attachTo,
                    containerPadding: lgs.gutter.xs,
                    opacity:          lgs.settings.ui.toolbars.opacity,
                },
                setBounds,
                setPosition,
                _moveable,
            );
            if (ok) {
                _moveable.current?.updateRect()
            }
        };

        if (_toolbar.current) {
            // If already in DOM, init next frame
            if (document.body.contains(_toolbar.current)) {
                requestAnimationFrame(tryInit)
            }
            else {
                mo = new MutationObserver(() => {
                    if (document.body.contains(_toolbar.current)) {
                        tryInit()
                    }
                })
                mo.observe(document.body, {childList: true, subtree: true})
            }
        }

        return () => {
            cancelled = true
            mo?.disconnect()
        }
    }, [isVisible, config]);

    const {snapThreshold, snapGap} = getSnapSettings()

    return (
        <>
            {isVisible && (
                <div className="lgs-toolbar-container">
                    <div
                        className={classNames('lgs-toolbar', {
                            [className]: className,
                        })}
                        ref={_toolbar}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseEnter={handleMouseEnter}
                        onMouseOut={handleMouseOut}
                    >
                        {children}
                        <div className={'lgs-toolbar-overlay'} ref={_toolbarOverlay}
                             style={{
                                 position:      'absolute',
                                 top:           0,
                                 left:          0,
                                 width:         '100%',
                                 height:        '100%',
                                 zIndex:        '+1',
                                 pointerEvents: isDragging ? 'auto' : 'none',
                             }}
                        />
                    </div>

                    <Moveable
                        ref={_moveable}
                        target={_toolbar}
                        container={lgs.canvas}
                        origin={false}

                        draggable={true}
                        edgeDraggable={false}
                        throttleDrag={0}
                        onDrag={handleDrag}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}

                        resizable={config?.resizable || false}
                        resizeDirections={['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']}

                        onResizeStart={(event) => console.log('resize start', event)}
                        onResize={(event) => console.log('resize', event)}
                        onResizeEnd={(event) => console.log('resize end', event)}

                        scalable={config?.scalable || false}

                        snappable={config?.snappable || true}
                        snapThreshold={snapThreshold}
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
                        onMouseEnter={handleMouseEnter}
                        onMouseOut={handleMouseOut}
                    />
                </div>
            )}
        </>
    )
}