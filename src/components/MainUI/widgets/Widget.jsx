/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-28
 * Last modified: 2026-01-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { usePointerInteractions } from '@Components/MainUI/context-menu/usePointerInteractions'
import {
    LGS_ANIMATION_DRAGGING, LGS_ANIMATION_RESIZING, LGS_TOOLBAR, LGS_VISUAL_WIDGET, LGS_WIDGET, LGS_WIDGET_SCALE_FACTOR,
    WIDGET_EDITOR_POST_RENDER_EVENT,
    WIDGET_EDITOR_PRE_RENDER_EVENT,
    WIDGETS_CAPABILITIES, WIDGETS_EDITOR_DRAWER,
} from '@Core/constants'
import {
    ScreenMediaRecorder,
}                                 from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import {
    Widget2Canvas,
}                                 from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'
import classNames                 from 'classnames'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Moveable                   from 'react-moveable'
import { useSnapshot }            from 'valtio'

const DRAG_THRESHOLD = {touch: 30, mouse: 5}

/**
 * Draggable, resizable and scalable widget with full pointer interaction support.
 *
 * @param {Object} props
 * @param {boolean} props.isVisible                 - Controls mounting of the widget
 * @param {string}  [props.className='']            - Additional CSS classes
 * @param {React.ReactNode} props.children         - Widget visual content
 * @param {Object} props.config                     - Complete widget configuration object
 * @param {React.RefObject} [props.childRef]        - Optional forwarded ref to inner content
 * @returns {JSX.Element|null}
 */
export const Widget = ({isVisible, className = '', children, config, childRef}) => {
    // Core DOM references
    const _widget = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _resizeRaf = useRef(0)
    const _children = childRef ?? useRef(null)
    const _dragConfirmed = useRef(false)
    const _dragStart = useRef({x: 0, y: 0})
    const _initialized = useRef(false)
    const _prevRotate = useRef(0)

    // UI state
    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [, setPosition] = useState({left: 0, top: 0})
    const [controlBox, setControlBox] = useState({renderDirections: [], zoom: 0, opacity: 0})
    const [guidelines, setGuidelines] = useState({verticalGuidelines: [], horizontalGuidelines: []})
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    // Global stores (valtio)
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const $drawers = lgs.stores.ui.drawers
    const drawers = useSnapshot($drawers)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)
    const _w2c = useRef(null)

    const throttleRotate = 1
    const selectedId = widget.current?.id ?? null
    const isSelected = selectedId === config.id

    // Interaction lock logic
    const interactionLocked =
              (video.preRecording || video.recording || video.snapshot) && config.type === LGS_VISUAL_WIDGET
    const showGhostOnly = Boolean(config?.showGhostDuringRecording) &&
        video.recording &&
        config.type === LGS_VISUAL_WIDGET

    // Snap configuration
    const snapSettings = useMemo(() => {
        const s = config?.snapSensitivity ?? 'medium'
        return s === 'low'
               ? {threshold: 20, gap: true}
               : s === 'high'
                 ? {threshold: 5, gap: false}
                 : {threshold: 10, gap: true}
    }, [config?.snapSensitivity])
    const {threshold: snapThreshold, gap: snapGap} = snapSettings

    // Guidelines computation
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

    // Sync guidelines and observers
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

    /**
     * Listen for pre-render events to perform background capture.
     */
    useEffect(() => {
        const handlePreRender = (event) => {
            const {entity} = event.detail
            if (entity !== config.id || !entity.includes('text-widget')) {
                return
            }

            const _sourceCanvas = lgs.canvas
            const _element = _widget.current
            const PREVIEW_SIZE = 512

            if (_element && _sourceCanvas) {
                lgs.scene.render()

                const _canvasRect = _sourceCanvas.getBoundingClientRect()
                const _widgetRect = _element.getBoundingClientRect()

                const _centerX = (_widgetRect.left - _canvasRect.left) + (_widgetRect.width / 2)
                const _centerY = (_widgetRect.top - _canvasRect.top) + (_widgetRect.height / 2)

                const _sourceX = Math.max(0, Math.min(_centerX - (PREVIEW_SIZE / 2), _canvasRect.width - PREVIEW_SIZE))
                const _sourceY = Math.max(0, Math.min(_centerY - (PREVIEW_SIZE / 2), _canvasRect.height - PREVIEW_SIZE))

                const _tempCanvas = document.createElement('canvas')
                _tempCanvas.width = PREVIEW_SIZE
                _tempCanvas.height = PREVIEW_SIZE
                const _ctx = _tempCanvas.getContext('2d')

                _ctx.drawImage(
                    _sourceCanvas,
                    _sourceX, _sourceY, PREVIEW_SIZE, PREVIEW_SIZE,
                    0, 0, PREVIEW_SIZE, PREVIEW_SIZE,
                )

                $widget.currentSnapshot = {
                    image:     _tempCanvas.toDataURL('image/webp', 0.8),
                    offset:    {x: _sourceX, y: _sourceY},
                    widgetPos: {x: _widgetRect.left - _canvasRect.left, y: _widgetRect.top - _canvasRect.top},
                }

                _tempCanvas.width = 0
                _tempCanvas.height = 0
            }
        }

        window.addEventListener(WIDGET_EDITOR_PRE_RENDER_EVENT, handlePreRender)
        return () => window.removeEventListener(WIDGET_EDITOR_PRE_RENDER_EVENT, handlePreRender)
    }, [config.id])

    // Visibility handlers for control box
    const handleMouseEnter = useCallback(() => {
        if (interactionLocked || (selectedId && !isSelected)) {
            return
        }
        setIsMouseOver(true)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, true)
    }, [interactionLocked, isSelected, selectedId])

    const handleMouseLeave = useCallback((event) => {
        if (interactionLocked || _dragConfirmed.current || (selectedId && !isSelected)) {
            return
        }
        const rect = _widget.current?.getBoundingClientRect()
        if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, false)
    }, [interactionLocked, isSelected, selectedId])

    // Drag lifecycle
    const handleDragStart = useCallback((event) => {
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

    const handleDrag = useCallback(async (event) => {
        const input = event.inputEvent
        const threshold = input.pointerType === 'touch' ? DRAG_THRESHOLD.touch : DRAG_THRESHOLD.mouse
        const clientX = input.touches?.[0]?.clientX ?? input.clientX ?? 0
        const clientY = input.touches?.[0]?.clientY ?? input.clientY ?? 0

        if (!_dragConfirmed.current &&
            (Math.abs(clientX - _dragStart.current.x) >= threshold || Math.abs(clientY - _dragStart.current.y) >= threshold)) {
            _dragConfirmed.current = true
            setIsDragging(true)
        }

        const element = _widget.current
        if (element) {
            const {scale, rotate} = __.ui.widgetManager.getTransform(element)
            element.style.transform = `translate(${event.translate[0]}px, ${event.translate[1]}px) rotate(${rotate}deg) scale(${scale.x}, ${scale.y})`
            event.target.style.transform = element.style.transform
            _moveable.current.updateRect()

            __.ui.widgetManager.applyPosition(element, element.style.transform, _moveable, true, setControlBox)
        }

        await __.ui.widgetManager.onDrag(event)
        _children.current?.handleDrag?.(event)
    }, [])


    const handleDragEnd = useCallback(async (event) => {
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, isMouseOver)
        setIsDragging(false)
        _dragConfirmed.current = false
        _moveable.current?.updateRect()
        await __.ui.widgetManager.onDragEnd(event)

    }, [isMouseOver])

    const handleDoubleClick = useCallback((event) => {
        if (interactionLocked) {
            return
        }
        lgs.stores.ui.widget.current = {id: config.id}

        const hasCapabilities = __.ui.widgetManager.hasCapabilities(
            config.contextMenu,
            WIDGETS_CAPABILITIES,
        )
        if (!hasCapabilities || config.contextMenu?.canEdit !== true) {
            return
        }

        const drawers = lgs.stores.ui.drawers
        const isCurrentEditor = drawers.open === WIDGETS_EDITOR_DRAWER && drawers.entity === config.id

        if (isCurrentEditor) {
            __.ui.drawerManager.close()
        }
        else {
            window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_PRE_RENDER_EVENT, {
                detail: {entity: config.id},
            }))
            __.ui.drawerManager.open(WIDGETS_EDITOR_DRAWER, {
                action: 'edit-current',
                entity: config.id,
            })
            window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_POST_RENDER_EVENT, {
                detail: {entity: config.id},
            }))
        }
    }, [interactionLocked, config.id, config.contextMenu])

    const openContextMenu = useCallback((event) => {
        if (interactionLocked) {
            return
        }

        const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0
        const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0

        lgs.stores.ui.contextMenu.visible = true
        lgs.stores.ui.contextMenu.type = 'widget'
        lgs.stores.ui.contextMenu.targetId = config.id
        lgs.stores.ui.contextMenu.position = {x: clientX, y: clientY}
    }, [interactionLocked, config?.id])

    const pointerInteractionsRef = usePointerInteractions({
                                                              onDoubleTap:           handleDoubleClick,
                                                              onLongTapOrRightClick: openContextMenu,
                                                              longTapDelay:          600,
                                                              preventContextMenu:    true,
                                                          })

    // Transform handlers
    const handleScale = useCallback((event) => __.ui.widgetManager.onScale(event, {
        widget: _widget,
        child:  _children,
    }, setPosition), [])

    const handleScaleStart = useCallback((event) => {
        _children.current?.onScaleStart?.(event)
        __.ui.widgetManager.onScaleStart(event)
    }, [])

    const handleScaleEnd = useCallback((event) => {
        _children.current?.onScaleEnd?.(event)
        __.ui.widgetManager.onScaleEnd(event)
        _moveable.current?.updateRect()
    }, [])

    const handleResize = useCallback((event) => {
        event.target.style.width = `${event.width}px`
        event.target.style.height = `${event.height}px`
        __.ui.widgetManager.onResize(event, {widget: _widget, child: _children}, setPosition)
    }, [])

    const handleResizeStart = useCallback((event) => {
        _children.current?.onResizeStart?.(event)
        __.ui.widgetManager.onResizeStart(event)
    }, [])

    const handleResizeEnd = useCallback((event) => {
        _children.current?.onResizeEnd?.(event)
        __.ui.widgetManager.onResizeEnd(event)
        _moveable.current?.updateRect()
    }, [])

    // Rotation handlers
    const handleRotateStart = useCallback((event) => {
        _children.current?.onRotateStart?.(event)
        __.ui.widgetManager.onRotateStart(event)
        _moveable.current?.updateRect()


    }, [])

    const handleRotate = useCallback((event) => {
        _children.current?.onRotate?.(event)
        __.ui.widgetManager.onRotate(event, {_prevRotate})
        const {rotate} = event
        lgs.stores.ui.widget.current.rotate = Math.ceil(rotate)
    }, [])

    const handleRotateEnd = useCallback((event) => {
        _moveable.current?.updateRect()
        _children.current?.onRotateEnd?.(event)
        __.ui.widgetManager.onRotateEnd(event)
        _moveable.current?.updateRect()

        if (event.lastEvent) {
            lgs.stores.ui.widget.current.rotate = event.lastEvent.rotate
        }


    }, [])

    const selectWidget = useCallback(() => {
        if (interactionLocked) {
            return
        }
        const drawerEntity = typeof drawers.entity === 'string' ? drawers.entity : ''
        const drawerBase = drawerEntity.split('#')[0]
        const widgetBase = typeof config.id === 'string' ? config.id.split('#')[0] : ''
        if (drawers.open === WIDGETS_EDITOR_DRAWER && drawerBase && drawerBase !== widgetBase) {
            __.ui.drawerManager.close()
        }
        if (drawers.open === WIDGETS_EDITOR_DRAWER && drawerBase && drawerBase === widgetBase &&
            drawers.entity !== config.id) {
            lgs.stores.ui.drawers.entity = config.id
        }
        lgs.stores.ui.widget.current = {id: config.id}
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, true, true)
    }, [config.id, drawers.entity, drawers.open, interactionLocked])

    const handleBound = useCallback(() => __.ui.widgetManager.setBoundStatus(_widget.current), [])

    useEffect(() => {
        return () => {
            if (_resizeRaf.current) {
                cancelAnimationFrame(_resizeRaf.current)
            }
            _dragConfirmed.current = false
            setIsDragging(false)
        }
    }, [])

    useEffect(() => {
        if (isSelected) {
            return
        }
        if (_controlBoxTimer.current) {
            clearTimeout(_controlBoxTimer.current)
            _controlBoxTimer.current = null
        }
        setControlBox({renderDirections: [], zoom: 0, opacity: 0})
    }, [isSelected])

    useEffect(() => {
        if (!isSelected) {
            return
        }
        const handleOutsidePointerDown = (event) => {
            const target = event.target
            const widgetEl = _widget.current
            if (!widgetEl || !target) {
                return
            }
            const isInDrawer = (() => {
                const path = event.composedPath ? event.composedPath() : [target]
                const elements = path.filter(node => node instanceof HTMLElement)
                // Check light DOM ancestry
                if (elements.some(el => el.closest?.('sl-drawer'))) {
                    return true
                }
                // Check shadow host ancestry
                if (elements.some(el => el.getRootNode?.()?.host?.tagName === 'SL-DRAWER')) {
                    return true
                }
                // Check overlays/backdrops used by Shoelace drawer
                if (elements.some(el => el.classList?.contains('drawer__overlay') ||
                    el.classList?.contains('sl-drawer__overlay') ||
                    el.classList?.contains('sl-backdrop'))) {
                    return true
                }
                return false
            })()
            if (isInDrawer) {
                return
            }
            const elementTarget = target instanceof Element ? target : target.parentElement
            const isMoveableControl = elementTarget?.closest('.lgs-widget-control-box') ||
                elementTarget?.closest('.moveable-control') ||
                elementTarget?.closest('.moveable-line')
            if (elementTarget && (widgetEl.contains(elementTarget) || isMoveableControl)) {
                return
            }
            lgs.stores.ui.widget.current = {id: null}
            if (_controlBoxTimer.current) {
                clearTimeout(_controlBoxTimer.current)
                _controlBoxTimer.current = null
            }
            setControlBox({renderDirections: [], zoom: 0, opacity: 0})
        }
        document.addEventListener('pointerdown', handleOutsidePointerDown, true)
        return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
    }, [isSelected])

    // Lifecycle and registration
    useEffect(() => {
        if (!isVisible || !config) {
            return
        }

        let cancelled = false
        const hasUUID = config.id && config.id.includes('#')
        config.id = hasUUID ? config.id : __.ui.widgetManager.defineElementId(config.group, config.id)

        const clean = () => _w2c.current?.destroy()

        const init = async () => {
            if (cancelled || !_widget.current) {
                return
            }

            const fullConfig = {
                animationWhenDragging: config.animationWhenDragging ?? config.type === LGS_TOOLBAR,
                attachTo: config.attachTo ?? 'top-left',
                container:       config.container ?? lgs.canvas,
                contextMenu:     __.ui.widgetManager.cloneContext(config?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                cropDimensions:  config.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0},
                dynamic:         config.dynamic ?? false,
                forceEven:       config.forceEven ?? false,
                group:           config.group ?? null,
                id: config.id,
                isCropper:       config.isCropper ?? false,
                left:            config.left,
                margin:          config.margin ?? 0,
                min:             {width: config?.min?.width ?? 10, height: config?.min?.height ?? 10},
                max:             {width: config?.max?.width ?? 500, height: config?.max?.height ?? 500},
                mandatory:       config.mandatory ?? false,
                opacity:         config.opacity ?? lgs.settings.ui.toolbars.opacity,
                outsideOverlay:  config.outsideOverlay ?? false,
                persist:         config.persist ?? false,
                ratio:           config.ratio ?? null,
                resizeFromCenter: config.resizeFromCenter ?? false,
                resizable:       config.resizable ?? false,
                rotatable: config.rotatable ?? false,
                scalable:        config.scalable ?? false,
                showControlBox:  true,
                snap:            config.snap ?? false,
                stopPropagation: config.stopPropagation ?? false,
                top:             config.top,
                transient:       config.transient ?? false,
                ttl:             config.ttl ?? null,
                type:            config.type ?? LGS_WIDGET,
                widgetsBoard: config.widgetsBoard || null,
            }

            const resolved = await __.ui.widgetManager.retrieveConfig(_widget.current, fullConfig)
            const success = await __.ui.widgetManager.setupElement(_widget.current, resolved, setBounds, setPosition, _moveable)

            if (success) {
                _initialized.current = true
                __.ui.widgetCache.mount(config.id)
                if (!$widget.list.has(config.id)) {
                    $widget.list.set(config.id, {})
                }
                _widget.current.style.opacity = 1
                lgs.stores.ui.widget.current.rotate = resolved.rotate

                if (interactionLocked) {
                    if (!_w2c.current) {
                        _w2c.current = new Widget2Canvas(
                            _widget.current.querySelector(':scope >:not(.lgs-widget-inner-overlay)'),
                            {
                                embedFonts:      true,
                                scale:           LGS_WIDGET_SCALE_FACTOR,
                                type:            fullConfig.snap,
                                outerTransforms: true,
                                outerShadows:    true,
                            },
                        )
                        await _w2c.current.init()
                    }
                    const canvas = _w2c.current.getCanvas?.()
                    if (canvas) {
                        canvas.style.visibility = showGhostOnly ? 'visible' : 'hidden'
                    }
                    if (_widget.current) {
                        _widget.current.style.visibility = showGhostOnly ? 'hidden' : 'visible'
                    }
                    __.recorder.addEventListener(ScreenMediaRecorder.events.STOP, clean)
                    __.recorder.addEventListener(ScreenMediaRecorder.events.CANCEL, clean)
                }
                else {
                    if (_w2c.current) {
                        _w2c.current.destroy()
                        _w2c.current = null
                    }
                    _moveable.current?.updateRect()
                }
            }
            else if (!cancelled) {
                requestAnimationFrame(init)
            }
        }

        requestAnimationFrame(init)

        if (config.type === LGS_VISUAL_WIDGET) {
            const hasUUID = config.id && config.id.includes('#')
            const id = hasUUID ? config.id : __.ui.widgetManager.defineElementId(config.group, config.id)
            if (!$widget.list.has(id)) {
                $widget.list.set(id, {})
            }
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
            __.recorder.removeEventListener(ScreenMediaRecorder.events.STOP, clean)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.CANCEL, clean)
        }
    }, [isVisible, config, video.recording])

    useEffect(() => _moveable.current?.updateRect(), [bounds])

    useEffect(() => {
        return () => {
            if (_w2c.current) {
                _w2c.current.destroy()
                _w2c.current = null
            }
        }
    }, [])

    useEffect(() => {
        const canvas = _w2c.current?.getCanvas?.()
        if (showGhostOnly) {
            if (canvas) {
                canvas.style.visibility = 'visible'
            }
            if (_widget.current) {
                _widget.current.style.visibility = 'hidden'
            }
        }
        else {
            if (canvas) {
                canvas.style.visibility = 'hidden'
            }
            if (_widget.current) {
                _widget.current.style.visibility = 'visible'
            }
        }
    }, [showGhostOnly])

    if (!isVisible || (config.type === LGS_VISUAL_WIDGET && !$widget.list.has(config?.id))) {
        return null
    }

    return (
        <div className="lgs-widget-container">
            <div
                className={classNames(LGS_WIDGET, {
                    [className]:              !!className,
                    [config?.type]:           config?.type && config?.type !== LGS_WIDGET,
                    [LGS_ANIMATION_DRAGGING]: config.animationWhenDragging,
                    [LGS_ANIMATION_RESIZING]: config.animationWhenResizing,
                    dragging:                 _dragConfirmed.current,
                    'recording-locked': interactionLocked,
                })}
                ref={(el) => {
                    _widget.current = el
                    pointerInteractionsRef(el)
                }}
                onPointerDown={selectWidget}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </div>

            <Moveable
                className="lgs-widget-control-box"
                container={lgs.canvas}
                origin={false}
                onClick={selectWidget}
                ref={_moveable}
                target={_widget}
                draggable={interactionLocked ? false : config?.draggable ?? true}
                edgeDraggable={true}
                edge={['w', 'e', 's', 'n']}
                onDrag={handleDrag}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                throttleDrag={2}
                onBound={handleBound}
                preventDefault={false}
                keepRatio={Boolean(
                    __.ui.widgetManager.getWidgetConfig(config?.id)?.ratio?.locked ?? config?.ratio?.locked,
                )}


                resizable={interactionLocked ? false : config?.resizable ?? false}
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
                throttleResize={2}

                scalable={interactionLocked ? false : config?.scalable ?? false}
                onScale={handleScale}
                onScaleStart={handleScaleStart}
                onScaleEnd={handleScaleEnd}
                onBeforeScale={(event) => event.inputEvent.shiftKey && event.setFixedDirection([0, 0])}

                rotatable={interactionLocked ? false : config?.rotatable ?? false}
                throttleRotate={throttleRotate}
                onRotateStart={handleRotateStart}
                onRotate={handleRotate}
                onRotateEnd={handleRotateEnd}
                rotationPosition={'bottom'}

                pinchable={true}
                onPinchStart={({target}) => {
                    target.style.transformOrigin = '50% 50%'
                }}
                onPinch={({target, transform}) => {
                    target.style.transform = transform
                }}

                bounds={bounds}
                elementGuidelines={[lgs.canvas]}
                horizontalGuidelines={guidelines.horizontalGuidelines}
                verticalGuidelines={guidelines.verticalGuidelines}
                snapCenter={true}
                snapElement={true}
                snapGap={snapGap}
                snapThreshold={snapThreshold}
                snapRotationThreshold={5}
                snapRotationDegrees={[0, -30, -45, -60, -90, -120, -135, -150, -180]}
                snappable={config?.snappable ?? true}
                snapDirections={{top: true, right: true, bottom: true, left: true, center: true, middle: true}}
                elementSnapDirections={{
                    top:    true,
                    left:   true,
                    bottom: true,
                    right:  true,
                    center: true,
                    middle: true,
                }}
                maxSnapElementGuidelineDistance={10}

                renderDirections={controlBox.renderDirections}
                zoom={controlBox.zoom}
                onRender={(event) => !config.isCropper && (event.target.style.cssText += event.cssText)}
                useMutationObserver={false}
                useResizeObserver={false}
            />
        </div>
    )
}
