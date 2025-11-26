/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-26
 * Last modified: 2025-11-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { usePointerSingleOrDouble } from '@Components/hooks/usePointerSingleOrDouble'
import {
    LGS_ANIMATION_DRAGGING,
    LGS_ANIMATION_RESIZING,
    LGS_TOOLBAR,
    LGS_VISUAL_WIDGET,
    LGS_WIDGET,
    LGS_WIDGET_SCALE_FACTOR,
    WIDGETS_CAPABILITIES,
} from '@Core/constants'
import { VideoRecorder } from '@Core/ui/video/recorder/VideoRecorder'
import { Widget2Canvas }            from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'
import classNames from 'classnames'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Moveable                     from 'react-moveable'
import { useSnapshot }              from 'valtio'

const DRAG_THRESHOLD = {touch: 30, mouse: 5}
const CLICK_DELAY = 100

/**
 * Draggable/resizable/scalable widget with full interaction support
 * @param {Object} props
 * @param {boolean} props.isVisible - Mount control
 * @param {string} [props.className=''] - Extra classes
 * @param {React.ReactNode} props.children - Widget content
 * @param {Object} props.config - Full widget configuration
 * @param {React.RefObject} [props.childRef] - Optional forwarded ref
 * @returns {JSX.Element|null}
 */
export const Widget = ({isVisible, className = '', children, config, childRef}) => {
    const _widget = useRef(null)               // Main widget element
    const _moveable = useRef(null)             // Moveable instance
    const _controlBoxTimer = useRef(null)      // Debounce control box hide
    const _resizeRaf = useRef(0)               // RAF for resize cleanup
    const _children = childRef ?? useRef(null) // Child ref (forwarded or internal)
    const _dragConfirmed = useRef(false)       // True after drag threshold
    const _dragStart = useRef({x: 0, y: 0})  // Drag start coordinates
    const _initialized = useRef(false)         // One-time init flag

    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [, setPosition] = useState({left: 0, top: 0})
    const [controlBox, setControlBox] = useState({renderDirections: [], zoom: 0, opacity: 0})
    const [guidelines, setGuidelines] = useState({verticalGuidelines: [], horizontalGuidelines: []})
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const _w2c = useRef(null)

    const interactionLocked = (video.preRecording || video.recording) && config.type === LGS_VISUAL_WIDGET

    // Snap configuration
    const snapSettings = useMemo(() => {
        const s = config?.snapSensitivity ?? 'medium'
        return s === 'low' ? {threshold: 15, gap: true}
                           : s === 'high' ? {threshold: 5, gap: false}
                                          : {threshold: 30, gap: true}
    }, [config?.snapSensitivity])
    const {threshold: snapThreshold, gap: snapGap} = snapSettings

    // Center guidelines (canvas center)
    const centerGuidelines = useMemo(() => {
        const container = config?.container ?? lgs.canvas
        if (!container) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {width, height, left, top} = container.getBoundingClientRect()
        const cx = left + width / 2
        const cy = top + height / 2
        return {verticalGuidelines: [cx], horizontalGuidelines: [cy]}
    }, [config?.container])

    // Grid guidelines
    const gridGuidelines = useMemo(() => {
        if (!config?.snapGrid || !lgs.canvas) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {x: gx = 0, y: gy = 0} = config.snapGrid
        const rect = lgs.canvas.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const vertical = [cx]
        const horizontal = [cy]

        if (gx > 0) {
            for (let x = cx + gx; x <= rect.right; x += gx) {
                vertical.push(x)
            }
            for (let x = cx - gx; x >= rect.left; x -= gx) {
                vertical.push(x)
            }
        }
        if (gy > 0) {
            for (let y = cy + gy; y <= rect.bottom; y += gy) {
                horizontal.push(y)
            }
            for (let y = cy - gy; y >= rect.top; y -= gy) {
                horizontal.push(y)
            }
        }
        return {verticalGuidelines: vertical, horizontalGuidelines: horizontal}
    }, [config?.snapGrid])

    // Merge guidelines + observe container resize
    useEffect(() => {
        const update = () => {
            const v = [...new Set([...centerGuidelines.verticalGuidelines, ...gridGuidelines.verticalGuidelines])].sort((a, b) => a - b)
            const h = [...new Set([...centerGuidelines.horizontalGuidelines, ...gridGuidelines.horizontalGuidelines])].sort((a, b) => a - b)
            setGuidelines({verticalGuidelines: v, horizontalGuidelines: h})
            _moveable.current?.updateRect()
        }
        update()
        const container = config?.container ?? lgs.canvas
        if (!container) {
            return
        }
        const observer = new ResizeObserver(update)
        observer.observe(container)
        return () => observer.unobserve(container)
    }, [centerGuidelines, gridGuidelines])

    // Hover control box
    const handleMouseEnter = useCallback(() => {
        if (interactionLocked) {
            return
        }
        setIsMouseOver(true)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, true)
    }, [interactionLocked])

    const handleMouseLeave = useCallback(event => {
        if (interactionLocked || _dragConfirmed.current) {
            return
        }
        const rect = _widget.current?.getBoundingClientRect()
        if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, false)
    }, [interactionLocked])

    // Drag logic
    const handleDragStart = useCallback(event => {
        setIsDragging(false)
        _dragConfirmed.current = false
        const input = event.inputEvent
        _dragStart.current = {
            x: input.touches?.[0]?.clientX ?? input.clientX ?? 0,
            y: input.touches?.[0]?.clientY ?? input.clientY ?? 0,
        }
        _children.current?.onDragStart?.(event)
        __.ui.widgetManager.onDragStart(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, true, isMouseOver)
    }, [isMouseOver])

    const handleDrag = useCallback(event => {
        const input = event.inputEvent
        const threshold = input.pointerType === 'touch' ? DRAG_THRESHOLD.touch : DRAG_THRESHOLD.mouse
        const clientX = input.touches?.[0]?.clientX ?? input.clientX ?? 0
        const clientY = input.touches?.[0]?.clientY ?? input.clientY ?? 0

        if (!_dragConfirmed.current && (Math.abs(clientX - _dragStart.current.x) >= threshold || Math.abs(clientY - _dragStart.current.y) >= threshold)) {
            _dragConfirmed.current = true
            setIsDragging(true)
        }

        const element = _widget.current
        if (element) {
            const {scale} = __.ui.widgetManager.getTransform(element)
            element.style.transform = `translate(${event.translate[0]}px, ${event.translate[1]}px) scale(${scale.x}, ${scale.y})`
            __.ui.widgetManager.applyPosition(element, element.style.transform, _moveable, true, setControlBox)
        }
        __.ui.widgetManager.onDrag(event)
        _children.current?.handleDrag?.(event)
    }, [])

    const handleDragEnd = useCallback(event => {
        __.ui.widgetManager.onDragEnd(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, isMouseOver)
        setIsDragging(false)
        _dragConfirmed.current = false
        _moveable.current?.updateRect()
    }, [isMouseOver])

    // Double click & context menu
    const handleDoubleClick = useCallback(event => {
        if (interactionLocked) {
            return
        }
        __.ui.widgetManager.onDoubleClick(event, setPosition, _moveable)
    }, [interactionLocked])

    const handleContextMenu = useCallback(event => {
        if (interactionLocked) {
            return
        }
        event.preventDefault()
        const x = event.clientX ?? event.touches?.[0]?.clientX ?? _dragStart.current.x
        const y = event.clientY ?? event.touches?.[0]?.clientY ?? _dragStart.current.y
        if (x > 0 && y > 0) {
            Object.assign($widget.current, {
                canDisplayContextMenu: true,
                id:       config?.id,
                timer:    null,
                position: {x, y},
            })
        }
    }, [interactionLocked, config?.id])

    // Single / double pointer handler
    const pointerHandler = usePointerSingleOrDouble({
                                                        onSingleClickOrTap: event => {
                                                            if (_dragConfirmed.current) {
                                                                return
                                                            }
                                                            const element = event.currentTarget ?? event.target
                                                            if (event.pointerType === 'touch') {
                                                                element.click()
                                                            }
                                                            else {
                                                                setTimeout(() => element.click(), CLICK_DELAY)
                                                            }
                                                        },
                                                        onDoubleTap:        event => {
                                                            if (event.pointerType !== 'touch') {
                                                                return
                                                            }
                                                            config.isCropper ? handleDoubleClick(event) : handleContextMenu(event)
                                                        },
                                                    })

    const handlePointerDown = useCallback(event => {
        if (interactionLocked) {
            return
        }
        if (event.type === 'mousedown') {
            event.preventDefault()
        }
        _dragConfirmed.current = false
        setIsDragging(false)
        _dragStart.current = {
            x: event.touches?.[0]?.clientX ?? event.clientX ?? 0,
            y: event.touches?.[0]?.clientY ?? event.clientY ?? 0,
        }
        pointerHandler(event)
    }, [interactionLocked, pointerHandler])

    const handlePointerUp = useCallback(event => {
        if (interactionLocked) {
            return
        }
        if (_dragConfirmed.current) {
            event.preventDefault()
            event.stopPropagation()
        }
        _dragConfirmed.current = false
        pointerHandler(event)
    }, [interactionLocked, pointerHandler])

    const handlePointerCancel = useCallback(() => {
        if (interactionLocked) {
            return
        }
        setIsDragging(false)
        _dragConfirmed.current = false
    }, [interactionLocked])

    // Scale & Resize (unchanged core logic, just arrow functions)
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
    const handleBound = useCallback(() => __.ui.widgetManager.setBoundStatus(_widget.current), [])

    // Cleanup RAF & flags
    useEffect(() => () => {
        if (_resizeRaf.current) {
            cancelAnimationFrame(_resizeRaf.current)
        }
        _dragConfirmed.current = false
        setIsDragging(false)
    }, [])

    // Mount / unmount logic
    useEffect(() => {
        if (!isVisible || !config) {
            return
        }

        let cancelled = false
        config.id = __.ui.widgetManager.defineElementId(config.group, config.id)

        const clean = () => _w2c.current?.destroy()

        const init = async () => {
            if (cancelled || !_widget.current) {
                return
            }

            const fullConfig = {
                animationWhenDragging: config.animationWhenDragging ?? config.type === LGS_TOOLBAR,
                container:        config.container ?? lgs.canvas,
                contextMenu:      __.ui.widgetManager.cloneContext(config?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                cropDimensions:   config.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0},
                dynamic:          config.dynamic ?? false,
                forceEven:        config.forceEven ?? false,
                group:            config.group ?? null,
                id: config.id,
                isCropper:        config.isCropper ?? false,
                left:             config.left,
                margin:           config.margin ?? 0,
                min:              {width: config?.min?.width ?? 10, height: config?.min?.height ?? 10},
                max:              {width: config?.max?.width ?? 500, height: config?.max?.height ?? 500},
                mandatory:        config.mandatory ?? false,
                opacity:          config.opacity ?? lgs.settings.ui.toolbars.opacity,
                outsideOverlay:   config.outsideOverlay ?? false,
                persist:          config.persist ?? false,
                ratio:            config.ratio ?? null,
                resizeFromCenter: config.resizeFromCenter ?? false,
                resizable:        config.resizable ?? false,
                scalable:         config.scalable ?? false,
                showControlBox:   true,
                snap:             config.snap ?? false,
                stopPropagation:  config.stopPropagation ?? false,
                top:              config.top,
                transient:        config.transient ?? false,
                ttl:              config.ttl ?? null,
                type:             config.type ?? LGS_WIDGET,
            }

            const resolved = await __.ui.widgetManager.retrieveConfig(_widget.current, fullConfig)
            const success = await __.ui.widgetManager.setupElement(_widget.current, resolved, setBounds, setPosition, _moveable)

            if (success) {
                _initialized.current = true
                $widget.list.set(config.id, {mounted: true})
                if (interactionLocked) {
                    _w2c.current = new Widget2Canvas(_widget.current.querySelector(':scope >:not(.lgs-widget-inner-overlay)'), {
                        embedFonts: true,
                        scale: LGS_WIDGET_SCALE_FACTOR,
                        type: fullConfig.snap,
                    })
                    await _w2c.current.init()
                    // Force cleanup on stop/cancel
                    __.recorder.addEventListener(VideoRecorder.events.STOP, clean)
                    __.recorder.addEventListener(VideoRecorder.events.STOP, clean)

                }
                else {
                    _moveable.current?.updateRect()
                }
            }
            else if (!cancelled) {
                requestAnimationFrame(init)
            }
        }

        requestAnimationFrame(init)

        if (config.type === LGS_VISUAL_WIDGET) {
            const id = __.ui.widgetManager.defineElementId(config.group, config.id)
            $widget.list.set(id, {})
        }

        return () => {
            cancelled = true
            clearTimeout(_controlBoxTimer.current)
            if (_initialized.current && _widget.current && !config?.persist) {
                try {
                    __.ui.widgetManager.disposeElement(_widget.current)
                }
                catch (e) {
                    console.error('[Widget] Disposal error:', e)
                }
                _initialized.current = false
            }

            __.recorder.removeEventListener(VideoRecorder.events.STOP, clean)
            __.recorder.removeEventListener(VideoRecorder.events.STOP, clean)
        }
    }, [isVisible, config, video.recording])

    // Update Moveable when bounds change
    useEffect(() => _moveable.current?.updateRect(), [bounds])

    if (!isVisible || (config.type === LGS_VISUAL_WIDGET && !$widget.list.has(config?.id))) {
        return null
    }

    __.ui.widgetCache.mount(config.id)

    return (
        <div className="lgs-widget-container">
            <div
                className={classNames(
                    LGS_WIDGET,
                    {
                        [className]:    !!className,
                        [config?.type]: config?.type && config?.type !== LGS_WIDGET,
                        [LGS_ANIMATION_DRAGGING]: config.animationWhenDragging,
                        [LGS_ANIMATION_RESIZING]: config.animationWhenResizing,
                        dragging:       _dragConfirmed.current,
                    }
                )}
                ref={_widget}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
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
                draggable={interactionLocked ? false : (config?.draggable ?? true)}
                edgeDraggable={true}
                edge={['w', 'e', 's', 'n']}
                onDrag={handleDrag}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                throttleDrag={2}
                onBound={handleBound}
                preventDefault={false}
                keepRatio={Boolean(__.ui.widgetManager.getWidgetConfig(config?.id)?.ratio?.locked ?? config?.ratio?.locked)}
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
                resizable={interactionLocked ? false : (config?.resizable ?? false)}
                throttleResize={2}
                onScale={handleScale}
                onScaleStart={handleScaleStart}
                onScaleEnd={handleScaleEnd}
                onBeforeScale={event => event.inputEvent.shiftKey && event.setFixedDirection([0, 0])}
                scalable={interactionLocked ? false : (config?.scalable ?? false)}
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
                renderDirections={controlBox.renderDirections}
                zoom={controlBox.zoom}
                onRender={event => !config.isCropper && (event.target.style.cssText += event.cssText)}
                useMutationObserver={false}
                useResizeObserver={false}
            />
        </div>
    )
}