/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-14
 * Last modified: 2025-11-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * @module Widget
 * @description Generic draggable, resizable, scalable widget with snapping and dynamic mount/unmount.
 * Fully optimized: memoized callbacks, computed guidelines, centralized cleanup.
 */

import { usePointerSingleOrDouble }                                 from '@Components/hooks/usePointerSingleOrDouble'
import {
    LGS_ANIMATION_DRAGGING, LGS_ANIMATION_RESIZING, LGS_VISUAL_WIDGET, LGS_TOOLBAR, LGS_WIDGET,
    WIDGETS_CAPABILITIES,
}                        from '@Core/constants'
import { Widget2Canvas } from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'
import classNames        from 'classnames'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Moveable                                                     from 'react-moveable'
import { useSnapshot }                                              from 'valtio'

const DRAG_THRESHOLD_TOUCH = 30
const DRAG_THRESHOLD_MOUSE = 5
const CLICK_DELAY = 100

/**
 * Draggable, resizable, scalable widget with snapping support.
 *
 * @component
 * @param {Object} props
 * @param {boolean} props.isVisible - Controls visibility and mount/unmount
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {React.ReactNode} props.children - Widget content
 * @param {Object} props.config - Widget configuration object
 * @param {React.RefObject} [props.childRef] - Optional ref forwarded to child
 * @returns {JSX.Element|null} Rendered widget or null if not visible
 */
export const Widget = ({isVisible, className = '', children, config, childRef}) => {
    const _widget = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _initialized = useRef(false)
    const _resizeRaf = useRef(0)
    const _children = childRef ?? useRef(null)
    const _dragConfirmed = useRef(false)
    const _dragStartCoords = useRef({x: 0, y: 0})

    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [, setPosition] = useState({left: 0, top: 0})
    const [controlBoxProps, setControlBoxProps] = useState({renderDirections: [], zoom: 0, opacity: 0})
    const [guidelines, setGuidelines] = useState({verticalGuidelines: [], horizontalGuidelines: []})
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const video = useSnapshot(lgs.stores.ui.video)

    const isInteractionLocked = video.recording && config?.type === LGS_VISUAL_WIDGET

    // Memoized snap settings
    const snapSettings = useMemo(() => {
        const sensitivity = config?.snapSensitivity || 'medium'
        switch (sensitivity) {
            case 'low':
                return {snapThreshold: 15, snapGap: true}
            case 'high':
                return {snapThreshold: 5, snapGap: false}
            default:
                return {snapThreshold: 30, snapGap: true}
        }
    }, [config?.snapSensitivity])
    const {snapThreshold, snapGap} = snapSettings

    // Double click handler
    const handleDoubleClick = useCallback(event => {
        if (isInteractionLocked) {
            return
        }
        __.ui.widgetManager.onDoubleClick(event, setPosition, _moveable)
    }, [isInteractionLocked])

    // Center guidelines (canvas center)
    const centerGuidelines = useMemo(() => {
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

    // Custom grid guidelines
    const gridGuidelines = useMemo(() => {
        if (!config?.snapGrid || !lgs.canvas) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {x: gridX = 0, y: gridY = 0} = config.snapGrid
        const {width, height, left, top} = lgs.canvas.getBoundingClientRect()
        const vertical = []
        const horizontal = []
        const centerX = left + width / 2
        const centerY = top + height / 2

        if (gridX > 0) {
            vertical.push(centerX)
            for (let x = centerX + gridX; x <= left + width; x += gridX) {
                vertical.push(x)
            }
            for (let x = centerX - gridX; x >= left; x -= gridX) {
                vertical.push(x)
            }
        }
        if (gridY > 0) {
            horizontal.push(centerY)
            for (let y = centerY + gridY; y <= top + height; y += gridY) {
                horizontal.push(y)
            }
            for (let y = centerY - gridY; y >= top; y -= gridY) {
                horizontal.push(y)
            }
        }
        return {verticalGuidelines: vertical, horizontalGuidelines: horizontal}
    }, [config?.snapGrid])

    // Merge and update guidelines on container resize
    useEffect(() => {
        const update = () => {
            const v = [...new Set([...centerGuidelines.verticalGuidelines, ...gridGuidelines.verticalGuidelines])].sort((a, b) => a - b)
            const h = [...new Set([...centerGuidelines.horizontalGuidelines, ...gridGuidelines.horizontalGuidelines])].sort((a, b) => a - b)
            setGuidelines({verticalGuidelines: v, horizontalGuidelines: h})
            _moveable.current?.updateRect()
        }
        update()
        const container = config?.container ?? lgs.canvas
        if (container) {
            const ro = new ResizeObserver(update)
            ro.observe(container)
            return () => ro.unobserve(container)
        }
    }, [centerGuidelines, gridGuidelines])

    // Control box on hover
    const handleMouseEnter = useCallback(() => {
        if (isInteractionLocked) {
            return
        }
        setIsMouseOver(true)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, true)
    }, [isInteractionLocked])

    const handleMouseOut = useCallback(event => {
        if (isInteractionLocked) {
            return
        }
        if (_dragConfirmed.current) {
            return
        }
        const rect = _widget.current?.getBoundingClientRect()
        if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, false)
    }, [isInteractionLocked])

    // Drag handlers
    const handleDrag = useCallback(event => {
        const input = event.inputEvent
        const threshold = input.pointerType === 'touch' ? DRAG_THRESHOLD_TOUCH : DRAG_THRESHOLD_MOUSE
        const clientX = input.touches?.[0]?.clientX ?? input.clientX ?? 0
        const clientY = input.touches?.[0]?.clientY ?? input.clientY ?? 0
        const deltaX = Math.abs(clientX - _dragStartCoords.current.x)
        const deltaY = Math.abs(clientY - _dragStartCoords.current.y)

        if (!_dragConfirmed.current && (deltaX >= threshold || deltaY >= threshold)) {
            _dragConfirmed.current = true
            setIsDragging(true)
        }

        const target = _widget.current
        if (target) {
            const {scale} = __.ui.widgetManager.getTransform(target)
            target.style.transform = `translate(${event.translate[0]}px, ${event.translate[1]}px) scale(${scale.x}, ${scale.y})`
            __.ui.widgetManager.applyPosition(target, target.style.transform, _moveable, true, setControlBoxProps)
        }

        __.ui.widgetManager.onDrag(event)
        _children.current?.handleDrag?.(event)
    }, [])

    const handleDragStart = useCallback(event => {
        setIsDragging(false)
        _dragConfirmed.current = false
        const input = event.inputEvent
        _dragStartCoords.current = {
            x: input.touches?.[0]?.clientX ?? input.clientX ?? 0,
            y: input.touches?.[0]?.clientY ?? input.clientY ?? 0,
        }
        _children.current?.onDragStart?.(event)
        __.ui.widgetManager.onDragStart(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, true, isMouseOver)
    }, [isMouseOver])

    const handleDragEnd = useCallback(event => {
        __.ui.widgetManager.onDragEnd(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBoxProps, _controlBoxTimer, false, isMouseOver)
        setIsDragging(false)
        _dragConfirmed.current = false
        _moveable.current?.updateRect()
    }, [isMouseOver])

    // Context menu
    const handleContextMenu = useCallback(event => {
        if (isInteractionLocked) {
            return
        }
        event.preventDefault()
        let x = event.clientX ?? event.touches?.[0]?.clientX ?? _dragStartCoords.current.x
        let y = event.clientY ?? event.touches?.[0]?.clientY ?? _dragStartCoords.current.y
        if (x > 0 && y > 0) {
            Object.assign($widget.current, {
                canDisplayContextMenu: true,
                id:       config?.id,
                timer:    null,
                position: {x, y},
            })
        }
    }, [isInteractionLocked, config?.id])

    // Single/double tap/click handler
    const handleUserEvent = usePointerSingleOrDouble({
                                                         onSingleClickOrTap: event => {
                                                             if (!_dragConfirmed.current) {
                                                                 const element = event.currentTarget ?? event.target
                                                                 if (event.pointerType === 'touch') {
                                                                     element.click()
                                                                 }
                                                                 else {
                                                                     setTimeout(() => element.click(), CLICK_DELAY)
                                                                 }
                                                             }
                                                         },
                                                         onDoubleTap:        event => {
                                                             if (event.pointerType === 'touch') {
                                                                 config.isCropper ? handleDoubleClick(event) : handleContextMenu(event)
                                                             }
                                                         },
                                                     })

    // Unified pointer handlers
    const handlePointerDown = useCallback(event => {
        if (isInteractionLocked) {
            return
        }
        if (event.type === 'mousedown') {
            event.preventDefault()
        }
        _dragConfirmed.current = false
        setIsDragging(false)
        const clientX = event.touches?.[0]?.clientX ?? event.clientX ?? 0
        const clientY = event.touches?.[0]?.clientY ?? event.clientY ?? 0
        _dragStartCoords.current = {x: clientX, y: clientY}
        handleUserEvent(event)
    }, [isInteractionLocked, handleUserEvent])

    const handlePointerUp = useCallback(event => {
        if (isInteractionLocked) {
            return
        }
        if (_dragConfirmed.current) {
            event.preventDefault()
            event.stopPropagation()
        }
        _dragConfirmed.current = false
        handleUserEvent(event)
    }, [isInteractionLocked, handleUserEvent])

    const handlePointerCancel = useCallback(() => {
        if (isInteractionLocked) {
            return
        }
        setIsDragging(false)
        _dragConfirmed.current = false
    }, [isInteractionLocked])

    // Scale & Resize handlers (inchangés, utilisent déjà la config)
    const handleScale = useCallback(event => __.ui.widgetManager.onScale(event, {
        widget: _widget,
        child:  _children,
    }, setPosition), [])
    const handleScaleStart = useCallback(event => {
        _children.current?.onScaleStart?.(event)
        __.ui.widgetManager.onScaleStart(event)
    }, [])
    const handleScaleEnd = useCallback(event => {
        _children.current?.onScaleEnd?.(event)
        __.ui.widgetManager.onScaleEnd(event)
        _moveable.current?.updateRect()
    }, [])
    const handleScaleDirection = useCallback(event => event.inputEvent.shiftKey && event.setFixedDirection([0, 0]), [])

    const handleResize = useCallback(event => {
        event.target.style.width = `${event.width}px`
        event.target.style.height = `${event.height}px`
        __.ui.widgetManager.onResize(event, {widget: _widget, child: _children}, setPosition)
    }, [])
    const handleResizeStart = useCallback(event => {
        _children.current?.onResizeStart?.(event)
        __.ui.widgetManager.onResizeStart(event)
    }, [])
    const handleResizeEnd = useCallback(event => {
        _children.current?.onResizeEnd?.(event)
        __.ui.widgetManager.onResizeEnd(event)
        _moveable.current?.updateRect()
    }, [])
    const handleOnBound = useCallback(() => __.ui.widgetManager.setBoundStatus(_widget.current), [])

    // Cleanup
    useEffect(() => {
        return () => {
            if (_resizeRaf.current) {
                cancelAnimationFrame(_resizeRaf.current)
            }
            _dragConfirmed.current = false
            setIsDragging(false)
        }
    }, [])

    // Dynamic initialization and disposal
    useEffect(() => {
        if (!isVisible || !config) {
            return
        }

        let cancelled = false
        config.id = __.ui.widgetManager.defineElementId(config.group, config.id)

        const initWidget = async () => {
            if (cancelled || !_widget.current) {
                return
            }

            const fullConfig = {
                animationWhenDragging: config.animationWhenDragging ?? config.type === LGS_TOOLBAR,
                attachTo:              config.attachTo,
                container:             config.container ?? lgs.canvas,
                contextMenu:           __.ui.widgetManager.cloneContext(config?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                cropDimensions:        config.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0},
                dynamic:               config.dynamic ?? false,
                forceEven:             config.forceEven ?? false,
                group:                 config.group ?? null,
                id: config.id,
                isCropper:             config.isCropper ?? false,
                left:                  config.left,
                margin:                config.margin ?? 0,
                min:                   {width: config?.min?.width ?? 10, height: config?.min?.height ?? 10},
                max:                   {width: config?.max?.width ?? 500, height: config?.max?.height ?? 500},
                mandatory:             config.mandatory ?? false,
                opacity:               config.opacity ?? lgs.settings.ui.toolbars.opacity,
                outsideOverlay:        config.outsideOverlay ?? false,
                persist:               config.persist ?? false,
                ratio:                 config.ratio ?? null,
                resizeFromCenter:      config.resizeFromCenter ?? false,
                resizable:             config.resizable ?? false,
                scalable:              config.scalable ?? false,
                showControlBox:        true,
                stopPropagation:       config.stopPropagation ?? false,
                top:                   config.top,
                transient:             config.transient ?? false,
                ttl:                   config.ttl ?? null,
                type:                  config.type ?? LGS_WIDGET,
            }

            const resolvedConfig = await __.ui.widgetManager.retrieveConfig(_widget.current, fullConfig)
            const success = await __.ui.widgetManager.setupElement(_widget.current, resolvedConfig, setBounds, setPosition, _moveable)

            if (success) {
                _initialized.current = true
                if (isInteractionLocked) {
                    new Widget2Canvas(_widget.current.querySelector(':scope >:not(.lgs-widget-inner-overlay)'), {
                        embedFonts:      true,
                        outerTRansforms: true,
                    })
                }
                else {
                    _moveable.current?.updateRect()
                }
            }
            else if (!cancelled) {
                requestAnimationFrame(initWidget)
            }
        }

        requestAnimationFrame(initWidget)
        if (config.type === LGS_VISUAL_WIDGET) {
            const id = __.ui.widgetManager.defineElementId(config.group, config.id)
            $widget.list.set(id, {})
        }

        return () => {
            cancelled = true
            clearTimeout(_controlBoxTimer.current)
            _controlBoxTimer.current = null
            if (_initialized.current && _widget.current && !config?.persist) {
                try {
                    __.ui.widgetManager.disposeElement(_widget.current)
                }
                catch (error) {
                    console.error('[Widget] Disposal error:', error)
                }
                _initialized.current = false
            }
        }
    }, [isVisible, config, video.recording])

    // Update Moveable rect on bounds change
    useEffect(() => _moveable.current?.updateRect(), [bounds])

    if (!isVisible || (config.type === LGS_VISUAL_WIDGET && !$widget.list.has(config?.id))) {
        return null
    }

    return (
        <div className="lgs-widget-container">
            <div
                className={classNames(
                    LGS_WIDGET,
                    {
                        [className]:              !!className,
                        [config?.type]:           config?.type && config?.type !== LGS_WIDGET,
                        [LGS_ANIMATION_DRAGGING]: config.animationWhenDragging,
                        [LGS_ANIMATION_RESIZING]: config.animationWhenResizing,
                        dragging:                 _dragConfirmed.current,
                    },
                )}
                ref={_widget}
                onMouseEnter={handleMouseEnter}
                onMouseOut={handleMouseOut}
                onDoubleClick={handleDoubleClick}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onContextMenu={handleContextMenu}
                style={{touchAction: 'pan-x pan-y', pointerEvents: 'auto', zIndex: 1000, position: 'absolute'}}
            >
                {children}
            </div>

            <Moveable
                className="lgs-widget-control-box"
                container={lgs.canvas}
                origin={false}
                ref={_moveable}
                target={_widget}
                draggable={isInteractionLocked ? false : (config?.draggable ?? true)}
                edgeDraggable={true}
                edge={['w', 'e', 's', 'n']}
                onDrag={handleDrag}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                throttleDrag={2}
                onBound={handleOnBound}
                preventDefault={false}
                keepRatio={Boolean(__.ui.widgetManager.getWidgetConfig(config?.id)?.ratio?.locked ?? config?.ratio?.locked)}
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
                resizable={isInteractionLocked ? false : (config?.resizable ?? false)}
                throttleResize={2}
                onBeforeScale={handleScaleDirection}
                onScale={handleScale}
                onScaleStart={handleScaleStart}
                onScaleEnd={handleScaleEnd}
                scalable={isInteractionLocked ? false : (config?.scalable ?? false)}
                bounds={bounds}
                elementGuidelines={[lgs.canvas]}
                horizontalGuidelines={guidelines.horizontalGuidelines}
                verticalGuidelines={guidelines.verticalGuidelines}
                snapCenter={true}
                snapElement={true}
                snapGap={snapGap}
                snapThreshold={snapThreshold}
                snappable={config?.snappable ?? true}
                snapDirections={{top: true, right: true, bottom: true, left: true, center: true, middle: true}}
                renderDirections={controlBoxProps.renderDirections}
                zoom={controlBoxProps.zoom}
                onRender={event => !config.isCropper && (event.target.style.cssText += event.cssText)}
                useMutationObserver={false}
                useResizeObserver={false}
            />
        </div>
    )
}