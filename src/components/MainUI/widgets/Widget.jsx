/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { usePointerInteractions } from '@Components/MainUI/context-menu/usePointerInteractions'
import {
    LGS_ANIMATION_DRAGGING, LGS_ANIMATION_RESIZING, LGS_TOOLBAR, LGS_VISUAL_WIDGET, LGS_WIDGET,
    LGS_WIDGET_SCALE_EFFECTIVE,
    SCENE_WIDGETS_BOARD,
    WIDGET_EDITOR_PRE_RENDER_EVENT,
    WIDGETS_CAPABILITIES, WIDGETS_EDITOR_DRAWER,
} from '@Core/constants'
import {
    ScreenMediaRecorder,
}                                 from '@Core/ui/screen-media-recorder/recorder/ScreenMediaRecorder'
import {
    Widget2Canvas,
}                                 from '@Core/ui/widget-manager/widget-2-canvas/Widget2Canvas'
import { WaIcon }                 from '@web.awesome.me/webawesome-pro/dist/react'
import classNames                 from 'classnames'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Moveable                   from 'react-moveable'
import { useSnapshot }            from 'valtio'

const COLLAPSED_WIDGET_SIZE = 40
const DEFAULT_COLLAPSED_WIDGET_ICON = 'sliders'
const DRAG_THRESHOLD = {touch: 30, mouse: 5}
const LOCKED_FLASH_TIMEOUT = 650
const LOCKED_HINT_ICON = 'thumbtack'
const LOCKED_HINT_TIMEOUT = 2000
const ORBIT_CAMERA_ADJUSTMENT_WIDGET = 'orbit-camera-adjustment-widget'
const SUPPRESS_DOUBLE_CLICK_MS = 350
const SNAPSHOT_MAX_SIZE = 1024
const SNAPSHOT_MIN_SIZE = 240
const SNAPSHOT_MIN_PADDING = 80
const SNAPSHOT_MAX_PADDING = 220

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const normalizeWidgetIcon = icon => {
    if (typeof icon !== 'string') {
        return null
    }
    const normalized = icon.trim()
    return normalized.length > 0 ? normalized : null
}

const resolveCollapsedWidgetIcon = (...icons) => icons
    .map(normalizeWidgetIcon)
    .find(Boolean) ?? DEFAULT_COLLAPSED_WIDGET_ICON

const resolveSnapshotPreviewerRect = (widgetId) => {
    if (typeof document === 'undefined') {
        return null
    }

    const previewers = Array.from(document.querySelectorAll('.editor-preview-zone.lgs-widget-preview'))
        .map(element => ({element, rect: element.getBoundingClientRect()}))
        .filter(({rect}) => rect.width > 0 && rect.height > 0)

    const exactPreviewer = previewers.find(({element}) => element.dataset.widgetPreviewEntity === widgetId)
    return exactPreviewer?.rect ?? previewers[0]?.rect ?? null
}

const fitSnapshotRectToCanvas = (width, height, aspect, canvasRect) => {
    let nextWidth = width
    let nextHeight = height

    if (aspect && nextWidth / nextHeight < aspect) {
        nextWidth = nextHeight * aspect
    }
    else if (aspect) {
        nextHeight = nextWidth / aspect
    }

    if (nextWidth > canvasRect.width) {
        nextWidth = canvasRect.width
        nextHeight = aspect ? nextWidth / aspect : nextHeight
    }

    if (nextHeight > canvasRect.height) {
        nextHeight = canvasRect.height
        nextWidth = aspect ? nextHeight * aspect : nextWidth
    }

    return {
        width:  clamp(nextWidth, 1, canvasRect.width),
        height: clamp(nextHeight, 1, canvasRect.height),
    }
}

const finiteDimension = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback

const readLogicalDimensions = (element, config, fallback = COLLAPSED_WIDGET_SIZE) => {
    const computedStyle = element ? window.getComputedStyle(element) : null
    const styledWidth = parseFloat(element?.style?.width || computedStyle?.width || '')
    const styledHeight = parseFloat(element?.style?.height || computedStyle?.height || '')
    const rect = element?.getBoundingClientRect?.()
    const scaleX = config?.scale?.x ?? 1
    const scaleY = config?.scale?.y ?? 1

    return {
        width:  finiteDimension(
            styledWidth,
            finiteDimension(
                config?.dimensions?.width,
                finiteDimension(rect?.width && scaleX > 0 ? rect.width / scaleX : NaN, fallback),
            ),
        ),
        height: finiteDimension(
            styledHeight,
            finiteDimension(
                config?.dimensions?.height,
                finiteDimension(rect?.height && scaleY > 0 ? rect.height / scaleY : NaN, fallback),
            ),
        ),
    }
}

const readLogicalPosition = (element, config) => {
    const liveLeft = parseFloat(element?.style?.left || '')
    const liveTop = parseFloat(element?.style?.top || '')

    return {
        left: Number.isFinite(liveLeft) ? liveLeft : (config?.position?.left ?? 0),
        top:  Number.isFinite(liveTop) ? liveTop : (config?.position?.top ?? 0),
    }
}

const readInlineDimensions = (element) => ({
    width:  element?.style?.width ?? '',
    height: element?.style?.height ?? '',
})

const isPrimaryLeftPointer = (event) => {
    if (event?.isPrimary === false) {
        return false
    }
    return event?.pointerType !== 'mouse' || event?.button === 0
}

const resizeWidgetAroundCenter = (element, config, nextDimensions) => {
    if (!element || !config) {
        return
    }

    const currentDimensions = readLogicalDimensions(element, config)
    const currentPosition = readLogicalPosition(element, config)
    const centerX = currentPosition.left + (currentDimensions.width / 2)
    const centerY = currentPosition.top + (currentDimensions.height / 2)
    const width = finiteDimension(nextDimensions?.width, COLLAPSED_WIDGET_SIZE)
    const height = finiteDimension(nextDimensions?.height, COLLAPSED_WIDGET_SIZE)
    const position = {
        left: centerX - (width / 2),
        top:  centerY - (height / 2),
    }

    element.style.width = `${width}px`
    element.style.height = `${height}px`
    element.style.left = `${position.left}px`
    element.style.top = `${position.top}px`
    config.dimensions = {width, height}
    config.position = position
}

const expandWidgetAroundCenter = (element, config) => {
    if (!element || !config) {
        return
    }

    const currentDimensions = readLogicalDimensions(element, config)
    const currentPosition = readLogicalPosition(element, config)
    const centerX = currentPosition.left + (currentDimensions.width / 2)
    const centerY = currentPosition.top + (currentDimensions.height / 2)
    const width = finiteDimension(config.expandedDimensions?.width, finiteDimension(config.dimensions?.width, COLLAPSED_WIDGET_SIZE))
    const height = finiteDimension(config.expandedDimensions?.height, finiteDimension(config.dimensions?.height, COLLAPSED_WIDGET_SIZE))
    const position = {
        left: centerX - (width / 2),
        top:  centerY - (height / 2),
    }
    const inlineDimensions = config.expandedInlineDimensions
    const isToolbar = config.type === LGS_TOOLBAR

    element.style.left = `${position.left}px`
    element.style.top = `${position.top}px`
    element.style.width = isToolbar ? `${width}px` : (inlineDimensions ? inlineDimensions.width : `${width}px`)
    element.style.height = isToolbar ? `${height}px` : (inlineDimensions ? inlineDimensions.height : `${height}px`)
    config.dimensions = {width, height}
    config.position = position
}

const resolveSnapshotRect = (canvasRect, widgetRect, previewerRect = null) => {
    const widgetLeft = widgetRect.left - canvasRect.left
    const widgetTop = widgetRect.top - canvasRect.top
    const widgetWidth = widgetRect.width || SNAPSHOT_MIN_SIZE
    const widgetHeight = widgetRect.height || SNAPSHOT_MIN_SIZE
    const widgetCenterX = widgetLeft + (widgetWidth / 2)
    const widgetCenterY = widgetTop + (widgetHeight / 2)
    const padding = clamp(Math.max(widgetWidth, widgetHeight) * 0.2, SNAPSHOT_MIN_PADDING, SNAPSHOT_MAX_PADDING)
    const previewerAspect = previewerRect?.width > 0 && previewerRect?.height > 0
                            ? previewerRect.width / previewerRect.height
                            : null
    const preferredWidth = Math.max(widgetWidth + (padding * 2), previewerRect?.width ?? SNAPSHOT_MIN_SIZE)
    const preferredHeight = Math.max(widgetHeight + (padding * 2), previewerRect?.height ?? SNAPSHOT_MIN_SIZE)
    const {width, height} = fitSnapshotRectToCanvas(preferredWidth, preferredHeight, previewerAspect, canvasRect)
    const left = clamp(widgetCenterX - (width / 2), 0, Math.max(0, canvasRect.width - width))
    const top = clamp(widgetCenterY - (height / 2), 0, Math.max(0, canvasRect.height - height))

    return {left, top, width, height}
}

const createWidgetSnapshot = (sourceCanvas, canvasRect, widgetRect, previewerRect = null) => {
    const sourceRect = resolveSnapshotRect(canvasRect, widgetRect, previewerRect)
    const scaleX = canvasRect.width > 0 ? (sourceCanvas.width / canvasRect.width) : 1
    const scaleY = canvasRect.height > 0 ? (sourceCanvas.height / canvasRect.height) : 1
    const outputScale = Math.min(
        1,
        SNAPSHOT_MAX_SIZE / Math.max(sourceRect.width, sourceRect.height),
        previewerRect?.width > 0 ? previewerRect.width / sourceRect.width : 1,
        previewerRect?.height > 0 ? previewerRect.height / sourceRect.height : 1,
    )
    const snapshotCanvas = document.createElement('canvas')

    snapshotCanvas.width = Math.max(1, Math.round(sourceRect.width * outputScale))
    snapshotCanvas.height = Math.max(1, Math.round(sourceRect.height * outputScale))
    snapshotCanvas.getContext('2d').drawImage(
        sourceCanvas,
        sourceRect.left * scaleX,
        sourceRect.top * scaleY,
        sourceRect.width * scaleX,
        sourceRect.height * scaleY,
        0,
        0,
        snapshotCanvas.width,
        snapshotCanvas.height,
    )

    return {
        image:     snapshotCanvas.toDataURL('image/webp', 0.8),
        sourceRect,
        widgetPos: {x: widgetRect.left - canvasRect.left, y: widgetRect.top - canvasRect.top},
    }
}

/**
 * Draggable, resizable and scalable widget with full pointer interaction support.
 * Synchronized with Valtio store for reactive zIndex and state management.
 *
 * @param {Object} props
 * @param {boolean} props.isVisible                 - Controls mounting of the widget
 * @param {string}  [props.className='']            - Additional CSS classes
 * @param {string}  [props.moveableClassName='']    - Additional CSS classes for the Moveable control box
 * @param {string}  [props.containerClassName='']   - Additional CSS classes for the widget container
 * @param {React.ReactNode} props.children          - Widget visual content
 * @param {Object} props.config                     - Complete widget configuration object
 * @param {React.RefObject} [props.childRef]        - Optional forwarded ref to inner content
 * @returns {JSX.Element|null}
 */
export const Widget = ({isVisible, className = '', moveableClassName = '', containerClassName = '', children, config, childRef}) => {
    // Core DOM references
    const _widget = useRef(null)
    const _moveable = useRef(null)
    const _controlBoxTimer = useRef(null)
    const _fallbackChildren = useRef(null)
    const _children = childRef ?? _fallbackChildren
    const _dragConfirmed = useRef(false)
    const _dragStart = useRef({x: 0, y: 0})
    const _initialized = useRef(false)
    const _lastPointerDown = useRef({time: 0, x: 0, y: 0, pointerType: ''})
    const _lockedHintTimer = useRef(null)
    const _prevRotate = useRef(0)
    const _suppressClickUntil = useRef(0)
    const _w2c = useRef(null)

    // UI state
    const [bounds, setBounds] = useState({left: 0, top: 0, right: 0, bottom: 0})
    const [, setPosition] = useState({left: 0, top: 0})
    const [controlBox, setControlBox] = useState({renderDirections: [], zoom: 0, opacity: 0})
    const [guidelines, setGuidelines] = useState({verticalGuidelines: [], horizontalGuidelines: []})
    const [isMouseOver, setIsMouseOver] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [boardContainer, setBoardContainer] = useState(null)
    const [collapsed, setCollapsed] = useState(false)
    const [locked, setLocked] = useState(false)
    const [collapsedIconFallback, setCollapsedIconFallback] = useState(false)
    const [showLockedHint, setShowLockedHint] = useState(false)

    // Global stores (valtio)
    const $widget = lgs.stores.ui.widget
    const widget = useSnapshot($widget)
    const widgetListSnapshot = useSnapshot($widget.list)
    const $drawers = lgs.stores.ui.drawers
    const drawers = useSnapshot($drawers)
    const $toolbars = lgs.settings.ui.toolbars
    const toolbars = useSnapshot($toolbars)
    const $video = lgs.stores.ui.video
    const video = useSnapshot($video)

    const throttleRotate = 1
    const [widgetId] = useState(() => {
        const id = config.id
        return id && id.includes('#') ? id : __.ui.widgetManager.defineElementId(config.group, id)
    })
    const selectedId = widget.current?.id ?? null
    const isSelected = selectedId === widgetId
    const keyboardUpdate = widget.current?.keyboardUpdate ?? 0
    const widgetTypeId = widgetId?.split('#')[0] ?? widgetId
    const isTargetingBoard = Boolean(config.widgetsBoard && config.widgetsBoard !== SCENE_WIDGETS_BOARD)
    const sceneContainer = useMemo(() => {
        return isTargetingBoard ? null : __.ui.widgetManager.resolveWidgetsBoardContainer(config.widgetsBoard)
    }, [config.widgetsBoard, isTargetingBoard])
    const actualContainer = isTargetingBoard ? boardContainer : sceneContainer
    const widgetDefinition = useMemo(() => {
        const definition = config.group ? __.widgets.get(config.group)?.widgets?.get(widgetTypeId) : null
        return definition ?? null
    }, [config.group, widgetTypeId])
    const collapsedIcon = useMemo(
        () => resolveCollapsedWidgetIcon(config.icon, widgetDefinition?.icon),
        [config.icon, widgetDefinition?.icon],
    )
    const renderedCollapsedIcon = collapsedIconFallback ? DEFAULT_COLLAPSED_WIDGET_ICON : collapsedIcon
    const isVisualWidget = config.type === LGS_VISUAL_WIDGET
    const canLock = config.canLock ?? true
    const canReduce = !isVisualWidget && (config.canReduce ?? true)
    const effectiveCollapsed = canReduce && collapsed
    const effectiveLocked = canLock && locked
    const suppressLockedOverlay = widgetId === ORBIT_CAMERA_ADJUSTMENT_WIDGET
    const isCollapsedToolbar = effectiveCollapsed && config.type === LGS_TOOLBAR
    const isOnMapWidget = !isTargetingBoard
    const showLockedOverlay = effectiveLocked && showLockedHint && !suppressLockedOverlay
    const liveOpacity = config.type === LGS_TOOLBAR
                        ? (effectiveCollapsed ? 1 : (toolbars.opacity ?? config.opacity ?? 1))
                        : (config.opacity ?? 1)

    // Reactive depth resolution: priority to Store, fallback to initial Config
    const activeZIndex = widgetListSnapshot.get(widgetId)?.zIndex ?? config.zIndex
    /**
     * Ensures Moveable handles are correctly layered when zIndex changes.
     */
    useEffect(() => {
        if (_moveable.current) {
            _moveable.current.updateRect()
        }
    }, [activeZIndex])

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            setCollapsedIconFallback(false)
        })
        return () => cancelAnimationFrame(frameId)
    }, [collapsedIcon])

    useEffect(() => {
        return () => {
            if (_lockedHintTimer.current) {
                clearTimeout(_lockedHintTimer.current)
            }
        }
    }, [])

    useEffect(() => {
        const entry = widgetListSnapshot.get(widgetId)
        if (!entry) {
            return
        }
        const frameId = requestAnimationFrame(() => {
            if (entry.collapsed !== undefined) {
                setCollapsed(Boolean(entry.collapsed))
            }
            if (entry.locked !== undefined) {
                setLocked(Boolean(entry.locked))
            }
        })
        return () => cancelAnimationFrame(frameId)
    }, [widgetId, widgetListSnapshot])

    useEffect(() => {
        if (!effectiveLocked) {
            clearTimeout(_lockedHintTimer.current)
            _lockedHintTimer.current = null
            const frameId = requestAnimationFrame(() => setShowLockedHint(false))
            return () => cancelAnimationFrame(frameId)
        }
        clearTimeout(_controlBoxTimer.current)
        const frameId = requestAnimationFrame(() => {
            setControlBox({renderDirections: [], zoom: 0, opacity: 0})
            if (lgs.stores.ui.widget.current?.id === widgetId) {
                lgs.stores.ui.widget.current = {id: null}
            }
        })
        return () => cancelAnimationFrame(frameId)
    }, [effectiveLocked, widgetId])

    /**
     * Target board/container detection logic.
     */
    useEffect(() => {
        const {widgetsBoard} = config
        if (!isTargetingBoard) {
            return
        }

        const updateTarget = () => {
            const _el = __.ui.widgetManager.resolveWidgetsBoardContainer(widgetsBoard)
            setBoardContainer(current => current !== _el ? (_el ?? null) : current)
        }

        const frameId = requestAnimationFrame(updateTarget)

        const _observer = new MutationObserver(() => {
            updateTarget()
        })

        _observer.observe(document.body, {
            childList:  true,
            subtree:    true,
            attributes: true,
            attributeFilter: ['class', 'style', 'id'],
        })

        return () => {
            cancelAnimationFrame(frameId)
            _observer.disconnect()
        }
    }, [config.widgetsBoard, isTargetingBoard])

    const interactionLocked = (video.preRecording || video.recording || video.snapshot || video.finalizing) && config.type === LGS_VISUAL_WIDGET
    const showGhostOnly = Boolean(config?.showGhostDuringRecording) && video.recording && config.type === LGS_VISUAL_WIDGET
    const canInteract = !interactionLocked && !effectiveLocked
    const canDrag = canInteract && (config?.draggable ?? true)
    const canResize = canInteract && !effectiveCollapsed && (config?.resizable ?? false)
    const canScale = canInteract && !effectiveCollapsed && (config?.scalable ?? false)
    const canRotate = canInteract && !effectiveCollapsed && (config?.rotatable ?? false)

    // Snapping logic
    const snapSettings = useMemo(() => {
        const s = config?.snapSensitivity ?? 'medium'
        return s === 'low' ? {threshold: 20, gap: true} : s === 'high' ? {threshold: 5, gap: false} : {
            threshold: 10,
            gap:       true,
        }
    }, [config?.snapSensitivity])
    const {threshold: snapThreshold, gap: snapGap} = snapSettings

    const centerGuidelines = useMemo(() => {
        const container = actualContainer ?? lgs.canvas
        if (!container) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const {width, height, left, top} = container.getBoundingClientRect()
        return {verticalGuidelines: [left + width / 2], horizontalGuidelines: [top + height / 2]}
    }, [actualContainer])

    const gridGuidelines = useMemo(() => {
        if (!config?.snapGrid || !lgs.canvas) {
            return {verticalGuidelines: [], horizontalGuidelines: []}
        }
        const rect = lgs.canvas.getBoundingClientRect()
        const {x: gx = 0, y: gy = 0} = config.snapGrid
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const vertical = [cx], horizontal = [cy]
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
    }, [config.snapGrid])

    useEffect(() => {
        const update = () => {
            const v = [...new Set([...centerGuidelines.verticalGuidelines, ...gridGuidelines.verticalGuidelines])].sort((a, b) => a - b)
            const h = [...new Set([...centerGuidelines.horizontalGuidelines, ...gridGuidelines.horizontalGuidelines])].sort((a, b) => a - b)
            setGuidelines({verticalGuidelines: v, horizontalGuidelines: h})
            _moveable.current?.updateRect()
        }
        update()
        const container = actualContainer ?? lgs.canvas
        if (!container) {
            return
        }
        const observer = new ResizeObserver(update)
        observer.observe(container)
        return () => observer.unobserve(container)
    }, [centerGuidelines, gridGuidelines, actualContainer])

    // Pre-render snapshotting
    useEffect(() => {
        const handlePreRender = (event) => {
            const {entity} = event.detail
            if (entity !== widgetId) {
                return
            }
            const _sourceCanvas = lgs.canvas
            const _element = _widget.current
            if (_element && _sourceCanvas) {
                lgs.scene.render()
                const _canvasRect = _sourceCanvas.getBoundingClientRect()
                const _widgetRect = _element.getBoundingClientRect()
                if (!_canvasRect.width || !_canvasRect.height || !_sourceCanvas.width || !_sourceCanvas.height) {
                    return
                }
                const _previewerRect = resolveSnapshotPreviewerRect(widgetId)
                const snapshot = createWidgetSnapshot(_sourceCanvas, _canvasRect, _widgetRect, _previewerRect)
                $widget.currentSnapshot = {
                    entity:     widgetId,
                    image:      snapshot.image,
                    offset:     {x: snapshot.sourceRect.left, y: snapshot.sourceRect.top},
                    sourceRect: snapshot.sourceRect,
                    widgetPos:  snapshot.widgetPos,
                }
            }
        }
        window.addEventListener(WIDGET_EDITOR_PRE_RENDER_EVENT, handlePreRender)
        return () => window.removeEventListener(WIDGET_EDITOR_PRE_RENDER_EVENT, handlePreRender)
    }, [widgetId])

    const hasDrawerInPath = (event) => event.composedPath().some(target => target.tagName?.toLowerCase() === 'wa-drawer')
    const hasNoDragInPath = (event) => {
        const ElementClass = globalThis.Element
        if (!ElementClass) {
            return false
        }

        const path = event?.composedPath?.() ?? [event?.target]
        return path.some(target => target instanceof ElementClass && Boolean(target.closest?.('.lgs-widget-no-drag')))
    }

    const updateWidgetStoreEntry = useCallback((patch) => {
        const currentEntry = $widget.list.get(widgetId) ?? {}
        $widget.list.set(widgetId, {...currentEntry, ...patch})
    }, [$widget.list, widgetId])

    const showLockedHoverHint = useCallback(() => {
        if (!effectiveLocked || suppressLockedOverlay) {
            return
        }

        if (_lockedHintTimer.current) {
            clearTimeout(_lockedHintTimer.current)
        }

        setShowLockedHint(true)
        const timeout = effectiveCollapsed || isVisualWidget ? LOCKED_HINT_TIMEOUT : LOCKED_FLASH_TIMEOUT
        _lockedHintTimer.current = setTimeout(() => {
            setShowLockedHint(false)
            _lockedHintTimer.current = null
        }, timeout)
    }, [effectiveCollapsed, effectiveLocked, isVisualWidget, suppressLockedOverlay])

    const hideLockedHoverHint = useCallback(() => {
        if (_lockedHintTimer.current) {
            clearTimeout(_lockedHintTimer.current)
            _lockedHintTimer.current = null
        }
        setShowLockedHint(false)
    }, [])

    const handleCollapsedIconError = useCallback(() => {
        if (renderedCollapsedIcon !== DEFAULT_COLLAPSED_WIDGET_ICON) {
            setCollapsedIconFallback(true)
        }
    }, [renderedCollapsedIcon])

    const persistInteractionState = useCallback((widgetConfig, patch) => {
        widgetConfig.icon = collapsedIcon
        __.ui.widgetManager.setConfig(widgetId, widgetConfig)
        updateWidgetStoreEntry({icon: widgetConfig.icon, ...patch})
        if (widgetConfig.persist) {
            void __.ui.widgetManager.saveWidgetPosition(widgetId, widgetConfig)
        }
        _moveable.current?.updateRect()
        requestAnimationFrame(() => _moveable.current?.updateRect())
    }, [collapsedIcon, updateWidgetStoreEntry, widgetId])

    const blockDoubleClick = useCallback((event) => {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        event?.nativeEvent?.stopImmediatePropagation?.()
        event?.stopImmediatePropagation?.()
        _suppressClickUntil.current = performance.now() + SUPPRESS_DOUBLE_CLICK_MS
    }, [])

    const openEditorFromDoubleClick = useCallback((event) => {
        if (!isVisualWidget || interactionLocked || effectiveLocked || !__.ui.widgetManager.canEditWidget(widgetId)) {
            return false
        }

        event?.preventDefault?.()
        event?.stopPropagation?.()
        event?.nativeEvent?.stopImmediatePropagation?.()
        event?.stopImmediatePropagation?.()
        __.ui.widgetManager.editWidget(widgetId)
        return true
    }, [effectiveLocked, interactionLocked, isVisualWidget, widgetId])

    const toggleCollapsed = useCallback(() => {
        if (!canReduce || interactionLocked || effectiveLocked) {
            return
        }

        setShowLockedHint(false)
        const element = _widget.current
        const widgetConfig = __.ui.widgetManager.getWidgetConfig(widgetId)
        if (!element || !widgetConfig) {
            return
        }

        const nextCollapsed = !effectiveCollapsed
        if (nextCollapsed) {
            widgetConfig.expandedDimensions = readLogicalDimensions(element, widgetConfig)
            widgetConfig.expandedInlineDimensions = readInlineDimensions(element)
            resizeWidgetAroundCenter(element, widgetConfig, {
                width:  COLLAPSED_WIDGET_SIZE,
                height: COLLAPSED_WIDGET_SIZE,
            })
            if (config.type === LGS_TOOLBAR) {
                element.style.opacity = '1'
                element.style.color = 'var(--lgs-text-on-color, var(--lgs-light-color))'
                widgetConfig.opacity = 1
            }
        }
        else {
            expandWidgetAroundCenter(element, widgetConfig)
        }

        widgetConfig.collapsed = nextCollapsed
        setCollapsed(nextCollapsed)
        persistInteractionState(widgetConfig, {
            collapsed:          nextCollapsed,
            expandedDimensions: widgetConfig.expandedDimensions,
            expandedInlineDimensions: widgetConfig.expandedInlineDimensions,
        })
    }, [canReduce, config.type, effectiveCollapsed, effectiveLocked, interactionLocked, persistInteractionState, widgetId])

    useEffect(() => {
        if (effectiveCollapsed || config.type !== LGS_TOOLBAR || !_initialized.current || !_widget.current) {
            return
        }

        const frameId = requestAnimationFrame(() => {
            const element = _widget.current
            const widgetConfig = __.ui.widgetManager.getWidgetConfig(widgetId)
            if (!element || !widgetConfig || widgetConfig.collapsed) {
                return
            }

            const previousDimensions = readLogicalDimensions(element, widgetConfig)
            const previousPosition = readLogicalPosition(element, widgetConfig)
            const centerX = previousPosition.left + (previousDimensions.width / 2)
            const centerY = previousPosition.top + (previousDimensions.height / 2)

            element.style.width = ''
            element.style.height = ''

            const dimensions = readLogicalDimensions(element, widgetConfig)
            const position = {
                left: centerX - (dimensions.width / 2),
                top:  centerY - (dimensions.height / 2),
            }

            element.style.left = `${position.left}px`
            element.style.top = `${position.top}px`
            widgetConfig.position = position
            widgetConfig.dimensions = dimensions
            widgetConfig.expandedDimensions = dimensions
            widgetConfig.expandedInlineDimensions = {width: '', height: ''}
            __.ui.widgetManager.setConfig(widgetId, widgetConfig)
            updateWidgetStoreEntry({
                                       expandedDimensions:       dimensions,
                                       expandedInlineDimensions: widgetConfig.expandedInlineDimensions,
                                   })
            if (widgetConfig.persist) {
                void __.ui.widgetManager.saveWidgetPosition(widgetId, widgetConfig)
            }
            _moveable.current?.updateRect()
        })

        return () => cancelAnimationFrame(frameId)
    }, [config.type, effectiveCollapsed, updateWidgetStoreEntry, widgetId])

    const toggleLocked = useCallback(() => {
        if (interactionLocked || !canLock) {
            return
        }

        const widgetConfig = __.ui.widgetManager.getWidgetConfig(widgetId)
        if (!widgetConfig) {
            return
        }

        const nextLocked = !locked
        widgetConfig.locked = nextLocked
        setLocked(nextLocked)

        if (nextLocked) {
            setIsMouseOver(false)
            setIsDragging(false)
            setControlBox({renderDirections: [], zoom: 0, opacity: 0})
            if (lgs.stores.ui.widget.current?.id === widgetId) {
                lgs.stores.ui.widget.current = {id: null}
            }
        }
        else {
            const currentRotation = lgs.stores.ui.widget.current?.id === widgetId
                                    ? Number(lgs.stores.ui.widget.current?.rotate)
                                    : Number.NaN
            const configRotation = Number(__.ui.widgetManager.getWidgetConfig(widgetId)?.rotate)
            lgs.stores.ui.widget.current = {
                ...(lgs.stores.ui.widget.current ?? {}),
                id: widgetId,
                rotate: Number.isFinite(currentRotation)
                        ? currentRotation
                        : (Number.isFinite(configRotation) ? configRotation : 0),
            }
        }

        persistInteractionState(widgetConfig, {locked: nextLocked})
    }, [canLock, interactionLocked, locked, persistInteractionState, widgetId])

    const handleMouseEnter = useCallback(() => {
        showLockedHoverHint()
        if (!canInteract || (selectedId && !isSelected)) {
            return
        }
        setIsMouseOver(true)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, true)
    }, [canInteract, isSelected, selectedId, showLockedHoverHint])

    const handleMouseLeave = useCallback((event) => {
        if (effectiveLocked) {
            hideLockedHoverHint()
            return
        }
        if (!canInteract || _dragConfirmed.current || (selectedId && !isSelected)) {
            return
        }
        const rect = _widget.current?.getBoundingClientRect()
        if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
            return
        }
        setIsMouseOver(false)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, false)
    }, [canInteract, effectiveLocked, hideLockedHoverHint, isSelected, selectedId])

    const handleDragStart = useCallback((event) => {
        const input = event?.inputEvent
        if (!canDrag || !input || hasDrawerInPath(input) || hasNoDragInPath(input)) {
            event.stopDrag()
            return
        }
        setIsDragging(false)
        _dragConfirmed.current = false
        _dragStart.current = {
            x: input.touches?.[0]?.clientX ?? input.clientX ?? 0,
            y: input.touches?.[0]?.clientY ?? input.clientY ?? 0,
        }
        _children.current?.onDragStart?.(event)
        __.ui.widgetManager.onDragStart(event)
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, true, isMouseOver)
    }, [canDrag, isMouseOver])

    const handleDrag = useCallback((event) => {
        const input = event.inputEvent
        if (!canDrag || !input || hasDrawerInPath(input) || hasNoDragInPath(input)) {
            event.stopDrag()
            return
        }
        const threshold = input.pointerType === 'touch' ? DRAG_THRESHOLD.touch : DRAG_THRESHOLD.mouse
        const clientX = input.touches?.[0]?.clientX ?? input.clientX ?? 0
        const clientY = input.touches?.[0]?.clientY ?? input.clientY ?? 0
        if (!_dragConfirmed.current && (Math.abs(clientX - _dragStart.current.x) >= threshold || Math.abs(clientY - _dragStart.current.y) >= threshold)) {
            _dragConfirmed.current = true
            setIsDragging(true)
        }
        const element = _widget.current
        if (element) {
            const {scale, rotate} = __.ui.widgetManager.getTransform(element)
            const translateX = Number.isFinite(event.translate?.[0]) ? event.translate[0] : 0
            const translateY = Number.isFinite(event.translate?.[1]) ? event.translate[1] : 0
            const transform = `translate(${translateX}px, ${translateY}px) rotate(${rotate}deg) scale(${scale.x}, ${scale.y})`

            element.style.transform = transform
            event.target.style.transform = transform

            const config = __.ui.widgetManager.getWidgetConfig(__.ui.widgetManager.retrieveElementId(element))
            if (config) {
                config.translate = {x: translateX, y: translateY}
                config.transform = transform
            }
        }
        __.ui.widgetManager.onDrag(event)
        _children.current?.handleDrag?.(event)
    }, [canDrag])

    const handleDragEnd = useCallback(async (event) => {
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, false, isMouseOver)
        setIsDragging(false)
        _dragConfirmed.current = false
        await __.ui.widgetManager.onDragEnd(event)
        _moveable.current?.updateRect()
    }, [isMouseOver])

    const handleDoubleClick = useCallback((event) => {
        if (!canReduce) {
            openEditorFromDoubleClick(event)
            return
        }
        blockDoubleClick(event)
        toggleCollapsed()
    }, [blockDoubleClick, canReduce, openEditorFromDoubleClick, toggleCollapsed])

    const handlePointerDownCapture = useCallback((event) => {
        if (hasNoDragInPath(event)) {
            return
        }

        if (!canReduce || !isPrimaryLeftPointer(event) || event.ctrlKey) {
            return
        }

        const now = performance.now()
        const previous = _lastPointerDown.current
        const x = event.clientX ?? 0
        const y = event.clientY ?? 0
        const pointerType = event.pointerType ?? 'mouse'
        const isDoublePointerDown = previous.time > 0
            && now - previous.time < 300
            && previous.pointerType === pointerType
            && Math.hypot(x - previous.x, y - previous.y) < 12

        _lastPointerDown.current = isDoublePointerDown
                                   ? {time: 0, x: 0, y: 0, pointerType: ''}
                                   : {time: now, x, y, pointerType}

        if (!isDoublePointerDown) {
            return
        }

        blockDoubleClick(event)
        toggleCollapsed()
    }, [blockDoubleClick, canReduce, toggleCollapsed])

    const handleDoubleClickCapture = useCallback((event) => {
        if (hasNoDragInPath(event)) {
            return
        }

        if (!canReduce) {
            return
        }
        blockDoubleClick(event)
    }, [blockDoubleClick, canReduce])

    const handleClickCapture = useCallback((event) => {
        if (hasNoDragInPath(event)) {
            return
        }

        if (performance.now() <= _suppressClickUntil.current) {
            event.preventDefault()
            event.stopPropagation()
            event.nativeEvent?.stopImmediatePropagation?.()
            return
        }

        if (event.detail <= 1) {
            return
        }

        if (canReduce) {
            blockDoubleClick(event)
            toggleCollapsed()
        }
    }, [blockDoubleClick, canReduce, toggleCollapsed])

    const openContextMenu = useCallback((event) => {
        if (interactionLocked) {
            return
        }
        event?.preventDefault?.()
        event?.stopPropagation?.()
        event?.nativeEvent?.stopImmediatePropagation?.()
        event?.stopImmediatePropagation?.()
        const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0
        const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0
        lgs.stores.ui.contextMenu.visible = true
        lgs.stores.ui.contextMenu.type = 'widget'
        lgs.stores.ui.contextMenu.targetId = widgetId
        lgs.stores.ui.contextMenu.position = {x: clientX, y: clientY}
    }, [interactionLocked, widgetId])

    const pointerInteractionsRef = usePointerInteractions({
                                                              onDoubleTap:           handleDoubleClick,
                                                              onLongTapOrRightClick: openContextMenu,
                                                              longTapDelay:          600,
                                                              preventContextMenu:    true,
                                                          })

    const handleScale = useCallback((event) => {
        if (!canScale) {
            return
        }
        __.ui.widgetManager.onScale(event, {
            widget: _widget,
            child:  _children,
        }, setPosition)
    }, [canScale])

    const handleScaleStart = useCallback((event) => {
        if (!canScale) {
            return
        }
        _children.current?.onScaleStart?.(event)
        __.ui.widgetManager.onScaleStart(event)
    }, [canScale])

    const handleScaleEnd = useCallback((event) => {
        if (!canScale) {
            return
        }
        _children.current?.onScaleEnd?.(event)
        __.ui.widgetManager.onScaleEnd(event)
        _moveable.current?.updateRect()
    }, [canScale])

    const handleResize = useCallback((event) => {
        if (!canResize) {
            return
        }
        event.target.style.width = `${event.width}px`
        event.target.style.height = `${event.height}px`
        __.ui.widgetManager.onResize(event, {widget: _widget, child: _children}, setPosition)
    }, [canResize])

    const handleResizeStart = useCallback((event) => {
        if (!canResize) {
            return
        }
        _children.current?.onResizeStart?.(event)
        __.ui.widgetManager.onResizeStart(event)
    }, [canResize])

    const handleResizeEnd = useCallback((event) => {
        if (!canResize) {
            return
        }
        _children.current?.onResizeEnd?.(event)
        __.ui.widgetManager.onResizeEnd(event)
        _moveable.current?.updateRect()
    }, [canResize])

    const handleRotateStart = useCallback((event) => {
        if (!canRotate) {
            return
        }
        _children.current?.onRotateStart?.(event)
        __.ui.widgetManager.onRotateStart(event)
        _moveable.current?.updateRect()
    }, [canRotate])

    const handleRotate = useCallback((event) => {
        if (!canRotate) {
            return
        }
        _children.current?.onRotate?.(event)
        __.ui.widgetManager.onRotate(event, {_prevRotate})
        lgs.stores.ui.widget.current.rotate = Math.ceil(event.rotate)
    }, [canRotate])

    const handleRotateEnd = useCallback((event) => {
        if (!canRotate) {
            return
        }
        _children.current?.onRotateEnd?.(event)
        __.ui.widgetManager.onRotateEnd(event)
        _moveable.current?.updateRect()
        if (event.lastEvent) {
            lgs.stores.ui.widget.current.rotate = event.lastEvent.rotate
        }
    }, [canRotate])

    const selectWidget = useCallback(() => {
        if (!canInteract) {
            return
        }
        const drawerEntity = typeof drawers.entity === 'string' ? drawers.entity : ''
        const drawerBase = drawerEntity.split('#')[0],
              widgetBase = typeof widgetId === 'string' ? widgetId.split('#')[0] : ''
        if (drawers.open === WIDGETS_EDITOR_DRAWER && drawerBase && drawerBase !== widgetBase) {
            __.ui.drawerManager.close()
        }
        if (drawers.open === WIDGETS_EDITOR_DRAWER && drawerBase && drawerBase === widgetBase && drawers.entity !== widgetId) {
            lgs.stores.ui.drawers.entity = widgetId
        }
        const currentRotation = lgs.stores.ui.widget.current?.id === widgetId
                                ? Number(lgs.stores.ui.widget.current?.rotate)
                                : Number.NaN
        const configRotation = Number(__.ui.widgetManager.getWidgetConfig(widgetId)?.rotate)
        lgs.stores.ui.widget.current = {
            ...(lgs.stores.ui.widget.current ?? {}),
            id: widgetId,
            rotate: Number.isFinite(currentRotation)
                    ? currentRotation
                    : (Number.isFinite(configRotation) ? configRotation : 0),
        }
        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, true, true)
    }, [widgetId, drawers.entity, drawers.open, canInteract])

    const handlePointerDown = useCallback((event) => {
        if (hasNoDragInPath(event)) {
            return
        }

        if (event.ctrlKey && canLock) {
            event.preventDefault()
            event.stopPropagation()
            toggleLocked()
            return
        }
        selectWidget()
    }, [canLock, selectWidget, toggleLocked])

    const handleBound = useCallback(() => __.ui.widgetManager.setBoundStatus(_widget.current), [])

    useEffect(() => {
        if (isSelected) {
            return
        }

        if (_controlBoxTimer.current) {
            clearTimeout(_controlBoxTimer.current)
            _controlBoxTimer.current = null
        }

        const frameId = requestAnimationFrame(() => {
            setControlBox({renderDirections: [], zoom: 0, opacity: 0})
        })

        return () => cancelAnimationFrame(frameId)
    }, [isSelected])

    useEffect(() => {
        const element = _widget.current
        if (!element || typeof ResizeObserver === 'undefined') {
            return undefined
        }

        const updateRect = () => {
            _moveable.current?.updateRect()
        }

        updateRect()
        const frameId = requestAnimationFrame(updateRect)
        const observer = new ResizeObserver(() => {
            updateRect()
            requestAnimationFrame(updateRect)
        })

        observer.observe(element)

        return () => {
            cancelAnimationFrame(frameId)
            observer.disconnect()
        }
    }, [widgetId])

    useEffect(() => {
        if (!isSelected || keyboardUpdate === 0) {
            return
        }

        __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, true, true)
        const frameId = requestAnimationFrame(() => {
            _moveable.current?.updateRect()
            __.ui.widgetManager.manageControlBox(_moveable, setControlBox, _controlBoxTimer, true, true)
        })

        return () => cancelAnimationFrame(frameId)
    }, [isSelected, keyboardUpdate])

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
                return elements.some(el => el.closest?.('wa-drawer') || el.getRootNode?.()?.host?.tagName === 'WA-DRAWER' || el.classList?.contains('sl-backdrop'))
            })()
            if (isInDrawer) {
                return
            }
            const elementTarget = target instanceof Element ? target : target.parentElement
            const isMoveableControl = elementTarget?.closest('.lgs-widget-control-box') || elementTarget?.closest('.moveable-control') || elementTarget?.closest('.moveable-line')
            if (elementTarget && (widgetEl.contains(elementTarget) || isMoveableControl)) {
                return
            }
            lgs.stores.ui.widget.current = {id: null}
        }
        document.addEventListener('pointerdown', handleOutsidePointerDown, true)
        return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
    }, [isSelected])

    /**
     * Component Lifecycle: Initialization and Persistence synchronization.
     */
    useEffect(() => {
        if (!isVisible || !config || !actualContainer) {
            return
        }

        const isTargetingBoard = config.widgetsBoard && config.widgetsBoard !== SCENE_WIDGETS_BOARD
        if (isTargetingBoard && !actualContainer) {
            return
        }

        let cancelled = false
        const clean = () => _w2c.current?.destroy()

        const init = async () => {
            if (cancelled || !_widget.current) {
                return
            }

            if (isTargetingBoard) {
                const boardRect = actualContainer?.getBoundingClientRect?.()
                if (!boardRect || boardRect.width <= 0 || boardRect.height <= 0) {
                    requestAnimationFrame(init)
                    return
                }
            }

            const fullConfig = {
                animationWhenDragging: config.animationWhenDragging ?? config.type === LGS_TOOLBAR,
                attachTo:       config.attachTo ?? 'top-left',
                container:      __.ui.widgetManager.resolveWidgetsBoardReferenceContainer(config.widgetsBoard) ?? actualContainer,
                boundsContainer: actualContainer,
                canLock:        config.canLock ?? true,
                canReduce:      isVisualWidget ? false : (config.canReduce ?? true),
                collapsed:      isVisualWidget ? false : (config.collapsed ?? false),
                contextMenu:    __.ui.widgetManager.cloneContext(config?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                cropDimensions: config.cropDimensions ?? {left: 0, top: 0, width: 0, height: 0},
                dynamic:        config.dynamic ?? false,
                expandedDimensions: config.expandedDimensions ?? null,
                expandedInlineDimensions: config.expandedInlineDimensions ?? null,
                forceEven:      config.forceEven ?? false,
                group:          config.group ?? null,
                handle:         config.handle ?? null,
                icon:           collapsedIcon,
                id: widgetId,
                isCropper:      config.isCropper ?? false,
                left:           config.left,
                locked:         config.locked ?? false,
                margin:         config.margin ?? 0,
                min:            {width: config?.min?.width ?? 10, height: config?.min?.height ?? 10},
                max:            {width: config?.max?.width ?? 500, height: config?.max?.height ?? 500},
                mandatory:      config.mandatory ?? false,
                opacity: liveOpacity,
                outsideOverlay: config.outsideOverlay ?? false,
                persist:        config.persist ?? false,
                ratio:          config.ratio ?? null,
                resizeFromCenter: config.resizeFromCenter ?? false,
                resizable:      config.resizable ?? false,
                rotatable:      config.rotatable ?? false,
                scalable:       config.scalable ?? false,
                showControlBox: config.showControlBox ?? true,
                snap:           config.snap ?? false,
                stopPropagation: config.stopPropagation ?? false,
                top:            config.top,
                transient:      config.transient ?? false,
                ttl:            config.ttl ?? null,
                type:           config.type ?? LGS_WIDGET,
                widgetsBoard:   config.widgetsBoard || null,
                width:          config.width,
                zIndex:         activeZIndex, // Inject the reactive value immediately
            }

            const resolved = await __.ui.widgetManager.retrieveConfig(_widget.current, fullConfig)

            // Critical: Force the reactive zIndex over retrieved stale persistence during launch
            resolved.zIndex = activeZIndex
            resolved.showControlBox = fullConfig.showControlBox
            resolved.icon = collapsedIcon


            const success = await __.ui.widgetManager.setupElement(_widget.current, resolved, setBounds, setPosition, _moveable)

            if (success) {
                _initialized.current = true
                resolved.icon = collapsedIcon
                __.ui.widgetManager.setConfig(widgetId, resolved)
                __.ui.widgetCache.mount(widgetId)
                setCollapsed(Boolean(resolved.collapsed))
                setLocked(Boolean(resolved.locked))

                // Synchronize store entry if missing
                if (!$widget.list.has(widgetId)) {
                    $widget.list.set(widgetId, {
                        zIndex:      activeZIndex,
                        collapsed:   Boolean(resolved.collapsed),
                        icon:        collapsedIcon,
                        locked:      Boolean(resolved.locked),
                        widgetsBoard: resolved.widgetsBoard,
                    })
                }
                else {
                    updateWidgetStoreEntry({
                        collapsed:   Boolean(resolved.collapsed),
                        icon:        collapsedIcon,
                        locked:      Boolean(resolved.locked),
                        widgetsBoard: resolved.widgetsBoard,
                    })
                }

                _widget.current.style.opacity = liveOpacity
                lgs.stores.ui.widget.current.rotate = resolved.rotate

                if (interactionLocked) {
                    if (!_w2c.current) {
                        _w2c.current = new Widget2Canvas(_widget.current.querySelector(':scope >:not(.lgs-widget-inner-overlay)'), {
                            embedFonts:      true,
                            scale:           LGS_WIDGET_SCALE_EFFECTIVE,
                            type:            fullConfig.snap,
                            outerTransforms: true,
                            outerShadows:    true,
                            refreshMode:     config.refreshMode ?? (interactionLocked ? 'live' : 'mutation'),
                        })
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
                else if (_w2c.current) {
                    _w2c.current.destroy()
                    _w2c.current = null
                    _moveable.current?.updateRect()
                }
            }
            else if (!cancelled) {
                requestAnimationFrame(init)
            }
        }
        requestAnimationFrame(init)

        if (config.type === LGS_VISUAL_WIDGET && !$widget.list.has(widgetId)) {
            $widget.list.set(widgetId, {
                zIndex:      activeZIndex,
                collapsed:   false,
                icon:        config.icon ?? collapsedIcon,
                locked:      Boolean(config.locked),
                widgetsBoard: config.widgetsBoard,
            })
        }

        return () => {
            cancelled = true
            clearTimeout(_controlBoxTimer.current)
            if (_initialized.current && _widget.current && !config?.persist) {
                try {
                    __.ui.widgetManager.disposeElement(_widget.current)
                }
                catch {
                    // Ignore dispose errors during unmount; the DOM node may already be gone.
                }
                _initialized.current = false
            }
            __.recorder.removeEventListener(ScreenMediaRecorder.events.STOP, clean)
            __.recorder.removeEventListener(ScreenMediaRecorder.events.CANCEL, clean)
        }
    }, [isVisible, config, widgetId, video.preRecording, video.recording, video.snapshot, video.finalizing, actualContainer])

    useEffect(() => {
        if (!_initialized.current || !_widget.current) {
            return
        }

        _widget.current.style.opacity = liveOpacity

        const elementId = __.ui.widgetManager.retrieveElementId(_widget.current) ?? widgetId
        const storedConfig = __.ui.widgetManager.getWidgetConfig(elementId)

        if (storedConfig && storedConfig.opacity !== liveOpacity) {
            __.ui.widgetManager.setConfig(elementId, {...storedConfig, opacity: liveOpacity})
        }
    }, [widgetId, liveOpacity])

    useEffect(() => {
        const canvas = _w2c.current?.getCanvas?.()
        if (canvas) {
            canvas.style.visibility = showGhostOnly ? 'visible' : 'hidden'
        }
        if (_widget.current) {
            _widget.current.style.visibility = showGhostOnly ? 'hidden' : 'visible'
        }
    }, [showGhostOnly])

    if (!isVisible) {
        return null
    }

    return (
        <div className={classNames('lgs-widget-container', containerClassName)} data-widget={widgetId} style={{zIndex: activeZIndex}}>
            <div
                className={classNames(LGS_WIDGET, {
                    [className]:    !!className && !effectiveCollapsed,
                    [config?.type]: config?.type && config?.type !== LGS_WIDGET && !effectiveCollapsed,
                    [LGS_ANIMATION_DRAGGING]: config.animationWhenDragging,
                    [LGS_ANIMATION_RESIZING]: config.animationWhenResizing,
                    dragging: isDragging,
                    'lgs-widget-collapsed': effectiveCollapsed,
                    'lgs-widget-collapsed-toolbar': isCollapsedToolbar,
                    'lgs-widget-locked': effectiveLocked,
                    'lgs-widget-lock-hint-active': showLockedOverlay,
                    'lgs-one-line-card': effectiveCollapsed,
                    'wa-theme-lgs1920-on-map': effectiveCollapsed,
                    'recording-locked': interactionLocked,
                })}
                ref={(el) => {
                    _widget.current = el
                    pointerInteractionsRef(el)
                }}
                onClickCapture={handleClickCapture}
                onContextMenuCapture={openContextMenu}
                onDoubleClickCapture={handleDoubleClickCapture}
                onDoubleClick={handleDoubleClick}
                onPointerDownCapture={handlePointerDownCapture}
                onPointerDown={handlePointerDown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {effectiveCollapsed
                 ? (
                     <div
                         className="lgs-widget-collapsed-icon"
                         data-collapsed-icon={renderedCollapsedIcon}
                         data-widget-type={config.type}
                         title={effectiveLocked ? 'Locked widget' : 'Collapsed widget'}
                     >
                         <WaIcon
                             key={renderedCollapsedIcon}
                             name={renderedCollapsedIcon}
                             variant="regular"
                             label={showLockedOverlay ? '' : (effectiveLocked ? 'Locked widget' : 'Collapsed widget')}
                             onWaError={handleCollapsedIconError}
                             aria-hidden={showLockedOverlay}
                         />
                     </div>
                 )
                 : children
                }
                {effectiveLocked && !suppressLockedOverlay && (
                    <div className={classNames('lgs-widget-lock-overlay', {'is-visible': showLockedOverlay})}
                         aria-hidden={!showLockedOverlay}>
                        <div className={classNames('lgs-widget-lock-badge', {'lgs-widget-lock-badge-on-map': isOnMapWidget})}>
                            <WaIcon name={LOCKED_HINT_ICON} variant="regular"/>
                        </div>
                    </div>
                )}
            </div>

            <Moveable
                className={classNames('lgs-widget-control-box', moveableClassName)}
                style={{pointerEvents: isSelected && !effectiveLocked ? 'auto' : 'none'}}
                container={lgs.canvas}
                origin={false}
                ref={_moveable}
                target={_widget}
                dragTarget={config.handle}
                draggable={canDrag}
                edgeDraggable={true}
                edge={['w', 'e', 's', 'n']}
                onDrag={handleDrag}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                throttleDrag={1}
                onBound={handleBound}
                preventDefault={false}
                stopPropagation={true}
                keepRatio={Boolean(__.ui.widgetManager.getWidgetConfig(widgetId)?.ratio?.locked ?? config?.ratio?.locked)}
                resizable={canResize}
                onResize={handleResize}
                onResizeStart={handleResizeStart}
                onResizeEnd={handleResizeEnd}
                throttleResize={config?.throttleResize ?? 2}
                scalable={canScale}
                onScale={handleScale}
                onScaleStart={handleScaleStart}
                onScaleEnd={handleScaleEnd}
                onBeforeScale={(event) => event.inputEvent.shiftKey && event.setFixedDirection([0, 0])}
                rotatable={canRotate}
                throttleRotate={throttleRotate}
                onRotateStart={handleRotateStart}
                onRotate={handleRotate}
                onRotateEnd={handleRotateEnd}
                rotationPosition={'bottom'}
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
                elementSnapDirections={{top: true, left: true, bottom: true, right: true, center: true, middle: true}}
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
