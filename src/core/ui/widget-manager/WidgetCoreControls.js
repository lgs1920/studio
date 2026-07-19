/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCoreControls.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CREDITS_WIDGET, LGS_VISUAL_WIDGET, LOGO_WIDGET, VIDEO_CROP_ZONE, VIDEO_WIDGETS_BOARD } from '@Core/constants'
import { v4 as uuid }        from 'uuid'

/**
 * Handles widget layout, control box visibility, and setup routines.
 */
export class WidgetCoreControls {
    #registry

    /**
     * @param {WidgetCoreRegistry} registry - Registry helper for configs and persistence.
     */
    constructor(registry) {
        this.#registry = registry
    }

    #getBoundsTarget = (config) => config.boundsContainer ?? config.container

    /**
     * Keeps video widgets inside the crop using edge percentages.
     * Percentages are calculated from the live widget rectangle; persisted
     * anchors and the previous crop are deliberately ignored.
     */
    repositionWidgetsForBoard = (widgetsBoard, nextBoardRect = null) => {
        if (widgetsBoard !== VIDEO_WIDGETS_BOARD || typeof document === 'undefined') {
            return 0
        }

        const cropConfig = this.#registry.getWidgetConfig(VIDEO_CROP_ZONE)
        const liveCrop = __.ui.widgetManager.getElementById?.(VIDEO_CROP_ZONE)
        const board = liveCrop?.isConnected
            ? liveCrop
            : __.ui.widgetManager.resolveWidgetsBoardBoundsContainer(widgetsBoard)
        const measured = board?.getBoundingClientRect?.()
        const container = cropConfig?.container?.getBoundingClientRect?.()
        const fallback = nextBoardRect && container
            ? {
                left: container.left + nextBoardRect.left,
                top: container.top + nextBoardRect.top,
                width: nextBoardRect.width,
                height: nextBoardRect.height,
            }
            : nextBoardRect
        const source = measured?.width > 0 && measured?.height > 0 ? measured : fallback
        if (!source || source.width <= 0 || source.height <= 0) {
            return 0
        }

        const boardRect = {
            left: source.left ?? 0,
            top: source.top ?? 0,
            width: source.width,
            height: source.height,
            right: source.right ?? (source.left ?? 0) + source.width,
            bottom: source.bottom ?? (source.top ?? 0) + source.height,
        }
        const clamp = (value, min, max) => Math.max(min, Math.min(value, max))
        let adapted = 0

        for (const config of this.#registry.widgets.values()) {
            if (config.widgetsBoard !== widgetsBoard || config.isCropper) {
                continue
            }

            const element = config.element?.isConnected
                ? config.element
                : __.ui.widgetManager.getElementById?.(config.id)
            const rect = element?.getBoundingClientRect?.()
            if (!element?.isConnected || !rect || rect.width <= 0 || rect.height <= 0) {
                continue
            }

            const left = ((rect.left - boardRect.left) / boardRect.width) * 100
            const top = ((rect.top - boardRect.top) / boardRect.height) * 100
            const width = (rect.width / boardRect.width) * 100
            const height = (rect.height / boardRect.height) * 100
            const right = 100 - left - width
            const bottom = 100 - top - height
            const fits = left >= 0 && top >= 0 && right >= 0 && bottom >= 0
            const widgetType = config.id.split('#')[0]
            const forcedAnchor = widgetType === CREDITS_WIDGET
                ? 'bottom-left'
                : widgetType === LOGO_WIDGET
                    ? 'bottom-right'
                    : null
            if (fits && !forcedAnchor) {
                continue
            }

            const currentScaleX = Number.isFinite(Number(config.scale?.x)) && Number(config.scale.x) > 0 ? Number(config.scale.x) : 1
            const currentScaleY = Number.isFinite(Number(config.scale?.y)) && Number(config.scale.y) > 0 ? Number(config.scale.y) : 1
            // This is intentionally not constrained by minScale or the
            // widget minimum dimensions: the crop is the hard boundary.
            const fixedWidget = Boolean(forcedAnchor)
            const baseWidth = rect.width / currentScaleX
            const baseHeight = rect.height / currentScaleY
            const scaleFactor = clamp(Math.min(
                1,
                boardRect.width / (fixedWidget ? baseWidth : rect.width),
                boardRect.height / (fixedWidget ? baseHeight : rect.height),
            ), 0, 1)
            const nextScale = {
                x: fixedWidget ? scaleFactor : currentScaleX * scaleFactor,
                y: fixedWidget ? scaleFactor : currentScaleY * scaleFactor,
            }
            const scaleChanged = Number.isFinite(nextScale.x) && Number.isFinite(nextScale.y) &&
                (nextScale.x !== currentScaleX || nextScale.y !== currentScaleY)
            const renderedWidth = baseWidth * nextScale.x
            const renderedHeight = baseHeight * nextScale.y
            const renderedWidthRatio = (renderedWidth / boardRect.width) * 100
            const renderedHeightRatio = (renderedHeight / boardRect.height) * 100
            const margin = Number.isFinite(Number(config.margin)) ? Number(config.margin) : 0
            const marginLeftRatio = (margin / boardRect.width) * 100
            const marginTopRatio = (margin / boardRect.height) * 100
            const nextLeft = forcedAnchor === 'bottom-left'
                ? marginLeftRatio
                : forcedAnchor === 'bottom-right'
                    ? Math.max(0, 100 - renderedWidthRatio - marginLeftRatio)
                    : clamp(left, 0, 100 - renderedWidthRatio)
            const nextTop = forcedAnchor
                ? Math.max(0, 100 - renderedHeightRatio - marginTopRatio)
                : clamp(top, 0, 100 - renderedHeightRatio)
            const screenLeft = boardRect.left + (nextLeft / 100) * boardRect.width
            const screenTop = boardRect.top + (nextTop / 100) * boardRect.height
            const currentLeft = Number.parseFloat(element.style.left || '')
            const currentTop = Number.parseFloat(element.style.top || '')
            const currentOffsetX = Number.isFinite(currentLeft) ? rect.left - currentLeft : 0
            const currentOffsetY = Number.isFinite(currentTop) ? rect.top - currentTop : 0
            const staticOffsetX = currentOffsetX - ((baseWidth - rect.width) / 2)
            const staticOffsetY = currentOffsetY - ((baseHeight - rect.height) / 2)
            const nextOffsetX = staticOffsetX + ((baseWidth - renderedWidth) / 2)
            const nextOffsetY = staticOffsetY + ((baseHeight - renderedHeight) / 2)
            const styleLeft = screenLeft - nextOffsetX
            const styleTop = screenTop - nextOffsetY
            const positionChanged = !Number.isFinite(currentLeft) || Math.abs(currentLeft - styleLeft) > 0.5 ||
                !Number.isFinite(currentTop) || Math.abs(currentTop - styleTop) > 0.5

            if (scaleChanged) {
                config.scale = nextScale
                __.ui.widgetManager.transform.setScale(element, nextScale.x, nextScale.y)
            }
            element.style.left = `${styleLeft}px`
            element.style.top = `${styleTop}px`
            config.position = {left: styleLeft, top: styleTop}
            config.savedRatios = {
                leftRatio: nextLeft + (renderedWidthRatio / 2),
                topRatio: nextTop + (renderedHeightRatio / 2),
                leftEdgeRatio: nextLeft,
                topEdgeRatio: nextTop,
                rightEdgeRatio: 100 - nextLeft - renderedWidthRatio,
                bottomEdgeRatio: 100 - nextTop - renderedHeightRatio,
                widthRatio: renderedWidthRatio,
                heightRatio: renderedHeightRatio,
            }
            this.#registry.setConfig(config.id, config)
            this.#registry.getMoveable(config.id)?.current?.updateRect?.()
            if (config.persist || scaleChanged || positionChanged) {
                void __.ui.widgetManager.saveWidgetPosition(config.id, config)
            }
            __.ui.widgetManager.refreshEditorPreviewSnapshot(config.id)
            adapted += 1
        }
        return adapted
    }

    #throttle = (func, limit) => {
        let lastCall = 0
        return (...args) => {
            const now = performance.now()
            if (now - lastCall >= limit) {
                lastCall = now
                func(...args)
            }
        }
    }

    #hideControlBoxWithTimer = (moveable, config, setControlBoxProps, isMouseOver) => {
        if (this.#registry.isDragging || !config.showControlBox || isMouseOver) {
            return
        }
        if (this.#registry.current !== config.id) {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            return
        }
        return setTimeout(() => {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            const elementId = this.#registry.retrieveElementId(moveable.target)
            this.#registry.controlBoxTimers.delete(elementId)
        }, this.#registry.hideDelay)
    }

    #createInnerOverlay = element => {
        if (!element.querySelector('.lgs-widget-inner-overlay')) {
            const overlay = document.createElement('div')
            const elementId = this.#registry.retrieveElementId(element)
            const config = this.#registry.getWidgetConfig(elementId)
            config.overlay = overlay
            Object.assign(overlay.style, {display: 'block'})
            overlay.classList.add('lgs-widget-inner-overlay')
            if (config.stopPropagation) {
                overlay.classList.add('no-propagation')
            }
            element.appendChild(overlay)
        }
    }

    #computeRenderDirections = (rect) => {
        const widthOk = rect.width > this.#registry.minDimensionThreshold
        const heightOk = rect.height > this.#registry.minDimensionThreshold
        const directions = []

        if (widthOk) {
            directions.push('n', 's')
        }
        if (heightOk) {
            directions.push('e', 'w')
        }
        directions.push('ne', 'nw', 'se', 'sw')

        return directions
    }

    /**
     * Applies position to an element, updating its style and configuration.
     * @param {HTMLElement} element - The DOM element
     * @param {Object|string} position - Position object or transform string
     * @param {Object} moveable - Moveable instance reference
     * @param {boolean} isDragging - Whether element is being dragged
     * @param {Function} setControlBoxProps - Function to set control box properties
     */
    applyPosition = (element, position, moveable, isDragging, setControlBoxProps) => {
        const elementId = this.#registry.retrieveElementId(element)
        const config = this.#registry.getWidgetConfig(elementId)
        const mv = this.#registry.getMoveable(elementId)
        if (!config) {
            return
        }
        if (typeof position === 'string') {
            element.style.transform = position
            config.transform = position
        }
        else if (typeof position === 'object') {
            element.style.left = `${position.left}px`
            element.style.top = `${position.top}px`
            config.position = position
        }

        if (mv?.current) {
            mv.current.updateRect()
        }
        if (config.showControlBox && isDragging) {
            setControlBoxProps({
                                   renderDirections: this.#computeRenderDirections(element.getBoundingClientRect()),
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
    }

    /**
     * Manages the visibility of the control box.
     * @param {Object} moveable - Moveable instance reference
     * @param {Function} setControlBoxProps - Function to set control box properties
     * @param {Object} _controlBoxTimer - Timer reference
     * @param {boolean} show - Whether to show the control box
     * @param {boolean} isMouseOver - Whether mouse is over the element
     */
    manageControlBox = (moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver) => {
        if (!moveable?.current?.target) {
            return
        }
        const elementId = this.#registry.retrieveElementId(moveable.current.target)
        const config = this.#registry.getWidgetConfig(elementId)
        const mv = this.#registry.getMoveable(elementId)
        if (!config || !config.showControlBox) {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            clearTimeout(_controlBoxTimer.current)
            this.#registry.controlBoxTimers.delete(elementId)
            return
        }
        clearTimeout(_controlBoxTimer.current)
        this.#registry.controlBoxTimers.delete(elementId)
        if (show) {
            this.#registry.current = elementId
            setControlBoxProps({
                                   renderDirections: this.#computeRenderDirections(moveable.current.target.getBoundingClientRect()),
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
        else {
            _controlBoxTimer.current = this.#hideControlBoxWithTimer(mv.current, config, setControlBoxProps, isMouseOver)
            if (_controlBoxTimer.current) {
                this.#registry.controlBoxTimers.set(elementId, _controlBoxTimer.current)
            }
        }
    }

    /**
     * Computes initial position for a widget based on configuration, respecting container margins
     * @param {Object} config - Widget configuration
     * @param {HTMLElement} element - The DOM element
     * @returns {Object} Position object with left and top coordinates
     */
    computeInitialPosition = (config, element) => {
        if (!config.container || !element) {
            return {left: 0, top: 0}
        }
        const container = this.#getBoundsTarget(config).getBoundingClientRect()
        const widget = element.getBoundingClientRect()
        const margin = Number.isFinite(config.margin) ? config.margin : 0

        let defaultWidth = widget.width || 200
        let defaultHeight = widget.height || 200

        if ((config.fromDB || config.fromRuntime) && config.dimensions?.width && config.dimensions?.height) {
            defaultWidth = config.dimensions.width
            defaultHeight = config.dimensions.height
        }
        else if (config.isCropper) {
            defaultWidth = Number.isFinite(config.cropDimensions?.width) ? config.cropDimensions.width : (widget.width || 200)
            defaultHeight = Number.isFinite(config.cropDimensions?.height) ? config.cropDimensions.height : (widget.height || 200)
        }

        config.dimensions = {width: defaultWidth, height: defaultHeight}

        const attachTo = config.attachTo || (config.isCropper ? 'center' : 'top-left')
        const hasRuntimePosition = Number.isFinite(config.position?.left) && Number.isFinite(config.position?.top)

        let left
        let top
        if ((config.fromDB || config.fromRuntime || config.isCropper) && hasRuntimePosition) {
            left = config.position.left
            top = config.position.top
        }
        else {
            left = config.isCropper
                   ? container.left + (container.width - defaultWidth) / 2
                   : container.left + __.ui.widgetManager.transform.parsePosition(config.left ?? '50%', container.width)
            top = config.isCropper
                  ? container.top + (container.height - defaultHeight) / 2
                  : container.top + __.ui.widgetManager.transform.parsePosition(config.top ?? '50%', container.height)
            const adjustments = {
                center:         () => config.isCropper ? ({left, top}) : ({
                    left: left - defaultWidth / 2,
                    top:  top - defaultHeight / 2,
                }),
                top:            () => ({left: left - defaultWidth / 2, top: top + margin}),
                left:           () => ({left: left + margin, top: top - defaultHeight / 2}),
                right:          () => ({left: left - defaultWidth - margin, top: top - defaultHeight / 2}),
                bottom:         () => ({left: left - defaultWidth / 2, top: top - defaultHeight - margin}),
                'top-left':     () => ({left: left + margin, top: top + margin}),
                'top-right':    () => ({left: left - defaultWidth - margin, top: top + margin}),
                'bottom-left':  () => ({left: left + margin, top: top - defaultHeight - margin}),
                'bottom-right': () => ({left: left - defaultWidth - margin, top: top - defaultHeight - margin}),
            }

            if (adjustments[attachTo]) {
                ({left, top} = adjustments[attachTo]())
            }
        }

        config.position = {left, top}

        const scaleX = config.scale?.x || 1
        const scaleY = config.scale?.y || 1
        const scaledWidth = defaultWidth * scaleX
        const scaledHeight = defaultHeight * scaleY

        if (!config.fromDB && !config.fromRuntime) {
            config.position = {
                left: Math.max(
                    container.left,
                    Math.min(left, container.right - scaledWidth),
                ),
                top:  Math.max(
                    container.top,
                    Math.min(top, container.bottom - scaledHeight),
                ),
            }
        }

        return config.position
    }

    /**
     * Refreshes container bounds based on current container size.
     * @param {Object} config - Widget configuration
     * @returns {Object} Updated bounds object
     */
    refreshBounds = (config) => {
        const container = this.#getBoundsTarget(config).getBoundingClientRect()
        config.bounds = {
            left:   container.left,
            top:    container.top,
            bottom: container.bottom,
            right:  container.right,
        }
        return config.bounds
    }

    /**
     * Sets boundary status indicating if widget touches container edges.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} config - Widget configuration
     * @returns {Object} Boundary status object
     */
    setBoundStatus = (element, config = this.#registry.getWidgetConfig(this.#registry.current)) => {
        const container = this.#getBoundsTarget(config).getBoundingClientRect()
        const target = element.getBoundingClientRect()
        const margin = Number.isFinite(config.margin) ? config.margin : 0
        config.boundStatus = {
            top:    target.top <= container.top + margin,
            bottom: target.bottom >= container.bottom - margin,
            left:   target.left <= container.left + margin,
            right:  target.right >= container.right - margin,
        }
        return config.boundStatus
    }

    monitorElementResize = (config, element) => {
        if (!element || config.isCropper) {
            return
        }

        if (config.elementObserver) {
            config.elementObserver.disconnect()
            config.elementObserver = null
        }

        const syncDimensions = this.#throttle(() => {
            if (this.#registry.isResizing || this.#registry.isScaling) {
                return
            }

            if (config.skipInitialElementResizeSync) {
                config.skipInitialElementResizeSync = false
                return
            }

            const computedStyle = window.getComputedStyle(element)
            const styledWidth = parseFloat(computedStyle.width || '')
            const styledHeight = parseFloat(computedStyle.height || '')
            const rect = element.getBoundingClientRect()
            const scaleX = config.scale?.x ?? 1
            const scaleY = config.scale?.y ?? 1

            const width = Number.isFinite(styledWidth) && styledWidth > 0
                          ? styledWidth
                          : (Number.isFinite(rect.width) && rect.width > 0 && scaleX > 0
                             ? rect.width / scaleX
                             : 0)
            const height = Number.isFinite(styledHeight) && styledHeight > 0
                           ? styledHeight
                           : (Number.isFinite(rect.height) && rect.height > 0 && scaleY > 0
                              ? rect.height / scaleY
                              : 0)

            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                return
            }

            const previousWidth = config.dimensions?.width ?? 0
            const previousHeight = config.dimensions?.height ?? 0
            const changed = Math.abs(previousWidth - width) > 0.5 || Math.abs(previousHeight - height) > 0.5

            if (!changed) {
                return
            }

            config.dimensions = {width, height}

            if (config.persist && config.runtimeReady) {
                void __.ui.widgetManager.saveWidgetPosition(config.id, config)
            }
        }, 100)

        config.elementObserver = new ResizeObserver(syncDimensions)
        config.elementObserver.observe(element)
        requestAnimationFrame(syncDimensions)
    }

    /**
     * Monitors container resize events and updates widget bounds and position.
     * @param {Object} config - Widget configuration
     * @param {Function} setBounds - Function to update bounds
     * @param {Object} moveable - Moveable instance reference
     * @param {HTMLElement} element - The DOM element
     * @param {Function} setPosition - Function to set position
     */
    monitorContainerResize = (config, setBounds, moveable, element, setPosition) => {
        const referenceTarget = config.container
        const boundsTarget = this.#getBoundsTarget(config)
        if (!referenceTarget || !boundsTarget) {
            return
        }
        if (config.observer) {
            const previousTargets = config.observedTargets ?? [boundsTarget]
            previousTargets.filter(Boolean).forEach(target => {
                try {
                    config.observer.unobserve(target)
                }
                catch {
                    void 0
                }
            })
            config.observer.disconnect()
            config.observer = null
            config.observedTargets = []
        }
        const elementId = config.id

        const handleResize = (first = false) => {
            if (this.#registry.isResizing) {
                return
            }
            const oldBounds = {...config.bounds}
            const mv = this.#registry.getMoveable(elementId)
            const newBounds = this.refreshBounds(config, mv?.current)
            if (!first && config.isCropper && config.id === VIDEO_CROP_ZONE) {
                __.ui.widgetManager.applyCropToOverlay(config)
                this.repositionWidgetsForBoard(VIDEO_WIDGETS_BOARD)
            }
            if (!first && newBounds.left === oldBounds.left && newBounds.top === oldBounds.top &&
                newBounds.right === oldBounds.right && newBounds.bottom === oldBounds.bottom) {
                return
            }
            setBounds(newBounds)
            this.setBoundStatus(element, config)

            const referenceRect = config.container.getBoundingClientRect()
            const boundsRect = this.#getBoundsTarget(config).getBoundingClientRect()
            const allowAutoAdapt = this.#registry.windowResizing
            const skipInitialAutoAdapt = first && (config.fromDB || config.fromRuntime) && !config.isCropper
            const oldContainerWidth = oldBounds.right - oldBounds.left
            const oldContainerHeight = oldBounds.bottom - oldBounds.top
            const newContainerWidth = newBounds.right - newBounds.left
            const newContainerHeight = newBounds.bottom - newBounds.top
            const isContainerShrinking = newContainerWidth < oldContainerWidth ||
                newContainerHeight < oldContainerHeight
            if (config.isCropper && allowAutoAdapt && !isContainerShrinking) {
                // A window resize can move the crop board without changing its
                // crop dimensions. Video widgets live in a fixed portal and
                // must follow the board's new screen rectangle in that case.
                if (!first && config.id === VIDEO_CROP_ZONE) {
                    this.repositionWidgetsForBoard(VIDEO_WIDGETS_BOARD)
                }
                return
            }
            const margin = Number.isFinite(config.margin) ? config.margin : 0
            let isOutOfBounds = false
            const outOfBoundsDetails = {top: false, bottom: false, left: false, right: false}

            // Video-board widgets are repositioned from the crop board's
            // coordinate system by repositionWidgetsForBoard. Applying the
            // generic container ratios here afterwards reintroduces the old
            // 0%/100% jumps, especially for centered widgets.
            const isVideoBoardWidget = config.widgetsBoard === VIDEO_WIDGETS_BOARD
            if (allowAutoAdapt && !first && config.savedRatios && !config.isCropper && !isVideoBoardWidget) {
                const leftRatio = config.savedRatios.leftRatio
                const topRatio = config.savedRatios.topRatio
                const relativeCenterX = (leftRatio / 100) * referenceRect.width
                const relativeCenterY = (topRatio / 100) * referenceRect.height
                const width = config.dimensions?.width ?? element.getBoundingClientRect().width ?? 0
                const height = config.dimensions?.height ?? element.getBoundingClientRect().height ?? 0

                config.position = {
                    left: referenceRect.left + relativeCenterX - (width / 2),
                    top:  referenceRect.top + relativeCenterY - (height / 2),
                }
            }

            let scaleWasAdapted = false
            if (allowAutoAdapt && !skipInitialAutoAdapt && config.type === LGS_VISUAL_WIDGET &&
                config.widgetsBoard !== VIDEO_WIDGETS_BOARD) {
                const oldScale = {...config.scale}
                config.scale = this.adaptScaleToContainer(config, boundsRect)

                if (oldScale.x !== config.scale.x || oldScale.y !== config.scale.y) {
                    __.ui.widgetManager.transform.setScale(element, config.scale.x, config.scale.y)
                    scaleWasAdapted = true
                }
            }

            let positionWasAdapted = false
            if (allowAutoAdapt && !skipInitialAutoAdapt && !config.isCropper && !isVideoBoardWidget) {
                const adaptedPosition = this.adaptPositionToContainer(config, boundsRect)
                if (adaptedPosition.left !== config.position.left || adaptedPosition.top !== config.position.top) {
                    config.position = adaptedPosition
                    positionWasAdapted = true
                }
            }

            if ((!first && config.savedRatios && !isVideoBoardWidget) || scaleWasAdapted || positionWasAdapted) {
                element.style.left = `${config.position.left}px`
                element.style.top = `${config.position.top}px`
                setPosition(config.position)
            }

            if (!first && allowAutoAdapt && !config.isCropper && !isVideoBoardWidget &&
                (scaleWasAdapted || positionWasAdapted) && config.persist) {
                __.ui.widgetManager.saveWidgetPosition(config.id, config)
            }

            if (config.transform) {
                const transforms = __.ui.widgetManager.transform.parseTransform(config.transform)
                if (transforms.translate.x !== 0 || transforms.translate.y !== 0) {
                    let newTranslateX = transforms.translate.x
                    let newTranslateY = transforms.translate.y
                    const deltaRight = newBounds.right - oldBounds.right
                    const deltaBottom = newBounds.bottom - oldBounds.bottom
                    const isShrinking = deltaRight < 0 || deltaBottom < 0
                    if (isShrinking) {
                        if (config.boundStatus.right) {
                            newTranslateX = transforms.translate.x + deltaRight
                        }
                        if (config.boundStatus.bottom) {
                            newTranslateY = transforms.translate.y + deltaBottom
                        }
                    }
                    else {
                        if (deltaRight > 0) {
                            config.boundStatus.right = false
                        }
                        if (deltaBottom > 0) {
                            config.boundStatus.bottom = false
                        }
                    }
                    if (newTranslateX !== transforms.translate.x || newTranslateY !== transforms.translate.y) {
                        __.ui.widgetManager.transform.setTranslate(element, newTranslateX, newTranslateY)
                    }
                }
            }

            if (config.isCropper && this.#registry.windowResizing && isContainerShrinking) {
                const containerRect = boundsRect
                const currentWidth = config.cropDimensions?.width || 200
                const currentHeight = config.cropDimensions?.height || 200
                const maxWidth = containerRect.width - 2 * margin
                const maxHeight = containerRect.height - 2 * margin
                let newWidth = currentWidth
                let newHeight = currentHeight
                let newLeft = config.position.left
                let newTop = config.position.top
                const clampPosition = (width, height) => {
                    if (newLeft < newBounds.left + margin) {
                        newLeft = newBounds.left + margin
                        outOfBoundsDetails.left = true
                        isOutOfBounds = true
                    }
                    else if (newLeft + width > newBounds.right - margin) {
                        newLeft = newBounds.right - width - margin
                        outOfBoundsDetails.right = true
                        isOutOfBounds = true
                    }
                    if (newTop < newBounds.top + margin) {
                        newTop = newBounds.top + margin
                        outOfBoundsDetails.top = true
                        isOutOfBounds = true
                    }
                    else if (newTop + height > newBounds.bottom - margin) {
                        newTop = newBounds.bottom - height - margin
                        outOfBoundsDetails.bottom = true
                        isOutOfBounds = true
                    }
                }
                clampPosition(currentWidth, currentHeight)
                const needsResize = currentWidth > maxWidth || currentHeight > maxHeight
                if (needsResize) {
                    if (config.ratio?.locked) {
                        const aspectRatio = config.ratio.aspectRatio
                        newWidth = Math.min(currentWidth, maxWidth)
                        newHeight = newWidth / aspectRatio
                        if (newHeight > maxHeight) {
                            newHeight = maxHeight
                            newWidth = newHeight * aspectRatio
                        }
                    }
                    else {
                        newWidth = Math.min(currentWidth, maxWidth)
                        newHeight = Math.min(currentHeight, maxHeight)
                    }
                    const centerRatio = {
                        x: (newLeft - containerRect.left + currentWidth / 2) / containerRect.width,
                        y: (newTop - containerRect.top + currentHeight / 2) / containerRect.height,
                    }
                    newLeft = containerRect.left + centerRatio.x * containerRect.width - newWidth / 2
                    newTop = containerRect.top + centerRatio.y * containerRect.height - newHeight / 2
                    clampPosition(newWidth, newHeight)
                }
                const positionChanged = newLeft !== config.position.left || newTop !== config.position.top
                const sizeChanged = newWidth !== currentWidth || newHeight !== currentHeight
                if (!positionChanged && !sizeChanged) {
                    return
                }
                config.centerRatio = {
                    x: (newLeft - containerRect.left + newWidth / 2) / containerRect.width,
                    y: (newTop - containerRect.top + newHeight / 2) / containerRect.height,
                }
                config.cropDimensions = {
                    left:   newLeft,
                    top:    newTop,
                    width:  newWidth,
                    height: newHeight,
                }
                config.position = {
                    left: newLeft,
                    top:  newTop,
                }
                element.style.width = `${newWidth}px`
                element.style.height = `${newHeight}px`
                element.style.left = `${newLeft}px`
                element.style.top = `${newTop}px`
                __.ui.widgetManager.applyCropToOverlay(config)
                __.ui.widgetManager.setConfig(config.id, config)
                __.ui.widgetManager.dispatchCropUpdate(config, 'resize')
                if (config.persist) {
                    __.ui.widgetManager.saveWidgetPosition(config.id, config)
                }
                if (mv && mv.current && (config.transform || config.isCropper)) {
                    mv.current.updateRect()
                }
                setPosition(config.position)
                if (isOutOfBounds) {
                    outOfBoundsDetails.newPosition = {left: newLeft, top: newTop}
                    const outOfBoundsEvent = new CustomEvent('widgetOutOfBounds', {
                        detail:     outOfBoundsDetails,
                        bubbles:    true,
                        cancelable: true,
                    })
                    element.dispatchEvent(outOfBoundsEvent)
                }
            }
        }
        if (config.windowResizeHandler) {
            window.removeEventListener('resize', config.windowResizeHandler)
            config.windowResizeHandler = null
        }
        handleResize(true)
        config.observer = new ResizeObserver(this.#throttle(() => handleResize(false), 100))
        config.observedTargets = [referenceTarget, boundsTarget].filter((target, index, array) => target && array.indexOf(target) === index)
        config.observedTargets.forEach(target => config.observer.observe(target))
        config.windowResizeHandler = this.#throttle(() => handleResize(false), 100)
        window.addEventListener('resize', config.windowResizeHandler)
    }

    /**
     * Constrains position within container bounds
     *
     * @param container{width,height} - Container dimensions (getBoundingClientRect)
     * @param config - Widget configuration
     * @return {{left: number, top: number}} - new position
     */
    adaptPositionToContainer = (config, container) => {
        if (config.type === LGS_VISUAL_WIDGET) {
            const scaleX = config.scale?.x ?? 1
            const scaleY = config.scale?.y ?? 1
            const width = config.dimensions?.width ?? 0
            const height = config.dimensions?.height ?? 0
            if (width <= 0 || height <= 0) {
                return config.position
            }
            const angle = (config.rotate ?? 0) * (Math.PI / 180)
            const absCos = Math.abs(Math.cos(angle))
            const absSin = Math.abs(Math.sin(angle))
            const scaledWidth = width * scaleX
            const scaledHeight = height * scaleY
            const rotatedWidth = (scaledWidth * absCos) + (scaledHeight * absSin)
            const rotatedHeight = (scaledWidth * absSin) + (scaledHeight * absCos)
            const halfRotatedWidth = rotatedWidth / 2
            const halfRotatedHeight = rotatedHeight / 2
            const centerX = config.position.left + (width / 2)
            const centerY = config.position.top + (height / 2)
            const clamp = (value, min, max) => {
                if (min > max) {
                    return (min + max) / 2
                }
                return Math.max(min, Math.min(value, max))
            }

            const clampedCenterX = clamp(centerX, container.left + halfRotatedWidth, container.right - halfRotatedWidth)
            const clampedCenterY = clamp(centerY, container.top + halfRotatedHeight, container.bottom - halfRotatedHeight)

            return {
                left: clampedCenterX - (width / 2),
                top:  clampedCenterY - (height / 2),
            }
        }

        return {
            left: Math.max(
                container.left,
                Math.min(config.position.left, container.right - config.dimensions.width * config.scale.x),
            ),
            top:  Math.max(
                container.top,
                Math.min(config.position.top, container.bottom - config.dimensions.height * config.scale.y),
            ),
        }
    }

    /**
     * Adapts widget size to container size.
     * strictly caps the current scale to the container limits.
     *
     * @param config - Widget configuration (contains dimensions and current scale)
     * @param container - Container dimensions
     * @return {{x: number, y: number}} - Scale (clamped to fit container)
     */
    adaptScaleToContainer = (config, container) => {
        if (config.type !== LGS_VISUAL_WIDGET) {
            return config.scale || {x: 1, y: 1}
        }
        const MIN_SCALE = 0.1
        const width = config.dimensions?.width ?? 0
        const height = config.dimensions?.height ?? 0
        const scaleX = config.scale?.x ?? 1
        const scaleY = config.scale?.y ?? 1
        if (width <= 0 || height <= 0 || container.width <= 0 || container.height <= 0) {
            return config.scale || {x: 1, y: 1}
        }
        const angle = (config.rotate ?? 0) * (Math.PI / 180)
        const absCos = Math.abs(Math.cos(angle))
        const absSin = Math.abs(Math.sin(angle))
        const rotatedWidth = (width * absCos) + (height * absSin)
        const rotatedHeight = (width * absSin) + (height * absCos)

        const limitX = rotatedWidth > 0 ? container.width / rotatedWidth : 1
        const limitY = rotatedHeight > 0 ? container.height / rotatedHeight : 1
        const minScale = Number(config.minScale)
        const maxScale = Number(config.maxScale)
        const explicitMinScale = Number.isFinite(minScale) && minScale > 0 ? minScale : MIN_SCALE
        const explicitMaxScale = Number.isFinite(maxScale) && maxScale > 0 ? maxScale : Infinity
        let finalScale = Math.min(scaleX, scaleY, limitX, limitY, explicitMaxScale)

        if (!Number.isFinite(finalScale)) {
            finalScale = Math.min(scaleX, scaleY, explicitMaxScale)
        }

        if (finalScale < explicitMinScale) {
            finalScale = explicitMinScale
        }

        return {x: finalScale, y: finalScale}
    }

    /**
     * Sets up a DOM element as a widget with moveable functionality.
     * @param {HTMLElement} element - The DOM element to set up
     * @param {Object} initialConfig - Initial widget configuration
     * @param {Function} setBounds - Function to update bounds
     * @param {Function} setPosition - Function to update position
     * @param {Object} moveable - Moveable instance reference
     * @returns {Promise<boolean>} True if setup is successful, false otherwise
     */
    setupElement = async (element, initialConfig, setBounds, setPosition, moveable) => {
        if (!element || !initialConfig?.container || !moveable.current) {
            return false
        }

        initialConfig.element = element
        initialConfig.setPosition = setPosition
        let elementId = initialConfig.id && typeof initialConfig.id === 'string' && initialConfig.id.trim()
                        ? initialConfig.id
                        : this.#registry.retrieveElementId(element) || uuid()
        element.setAttribute(this.#registry.idKey, elementId)
        moveable.current.target = element
        moveable.current.onRender = e => {
            e.target.style.opacity = initialConfig.opacity
        }
        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        const config = await this.#registry.retrieveConfig(element, initialConfig)
        elementId = config.id

        if (!config?.ratio) {
            const fallback = __.device.isPortrait ? '9x16' : '16x9'
            config.ratio = this.#registry.getRatio(initialConfig.ratio ?? fallback)
        }

        const hasCropDimensions = config.isCropper &&
            Number.isFinite(config.cropDimensions?.left) &&
            Number.isFinite(config.cropDimensions?.top) &&
            Number.isFinite(config.cropDimensions?.width) &&
            Number.isFinite(config.cropDimensions?.height) &&
            config.cropDimensions.width > 0 &&
            config.cropDimensions.height > 0

        if (config.isCropper && !hasCropDimensions) {
            __.ui.widgetManager.cropDimensions(config, false)
        }

        const newBounds = this.refreshBounds(config, moveable.current)
        setBounds(newBounds)
        const newPosition = this.computeInitialPosition(config, element, false)
        this.applyPosition(element, newPosition, moveable, false, setPosition)

        if (config.isCropper) {
            const rect = element.getBoundingClientRect()
            const width = Number.isFinite(config.cropDimensions?.width) ? config.cropDimensions.width : (rect.width || 200)
            const height = Number.isFinite(config.cropDimensions?.height) ? config.cropDimensions.height : (rect.height || 200)
            config.cropDimensions = {
                left: newPosition.left,
                top:  newPosition.top,
                width,
                height,
            }
            element.style.width = `${width}px`
            element.style.height = `${height}px`
            __.ui.widgetManager.applyCropToOverlay(config)

            moveable.current.request('resizable', {
                keepRatio:   !!config.ratio?.locked || false,
                deltaWidth:  0,
                deltaHeight: 0,
            }, true)
        }
        else if ((config.fromDB || config.fromRuntime) &&
            Number.isFinite(config.dimensions?.width) &&
            Number.isFinite(config.dimensions?.height) &&
            config.dimensions.width > 0 &&
            config.dimensions.height > 0) {
            element.style.width = `${config.dimensions.width}px`
            element.style.height = `${config.dimensions.height}px`
        }

        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '50% 50%'

        // Zindex applied to parent.

        if (config.scale && (config.scale.x !== 1 || config.scale.y !== 1)) {
            __.ui.widgetManager.transform.setScale(element, config.scale.x, config.scale.y)
        }
        else {
            __.ui.widgetManager.applyScaleVariables(element, config.scale ?? {x: 1, y: 1})
        }

        if (config.rotate && config.rotate !== 0) {
            __.ui.widgetManager.transform.setRotate(element, config.rotate)
        }

        config.skipInitialElementResizeSync = Boolean(config.fromDB || config.fromRuntime)

        this.monitorContainerResize(config, setBounds, moveable, element, setPosition)
        this.monitorElementResize(config, element)
        this.#createInnerOverlay(element)
        config.runtimeReady = true

        this.#registry.setConfig(elementId, config)
        this.#registry.setMoveable(elementId, moveable)

        // The video portal can mount widgets after the crop update event.
        // Reposition once more after registration so late-mounted widgets are included.
        if (config.widgetsBoard === VIDEO_WIDGETS_BOARD) {
            this.repositionWidgetsForBoard(VIDEO_WIDGETS_BOARD)
        }

        if (config.persist && !config.fromDB && !config.fromRuntime) {
            await __.ui.widgetManager.saveWidgetPosition(elementId, config)
        }
        return true
    }

    /**
     * Creates a fully independent clone of a DOM element.
     *
     * @param {Element} element - The original DOM element to clone
     * @returns {Element} A brand new element, 100% independent and correctly sized
     */
    clone = (element) => {
        const template = document.createElement('template')
        template.innerHTML = element.outerHTML.trim()
        const clone = template.content.firstElementChild

        if (!clone) {
            return null
        }

        function getAccumulatedTransform(el) {
            let current = el
            let matrix = new DOMMatrix()

            while (current && current !== document.documentElement) {
                const style = getComputedStyle(current)
                const transform = style.transform && style.transform !== 'none'
                                  ? new DOMMatrix(style.transform)
                                  : new DOMMatrix()

                matrix = transform.multiply(matrix)

                current = current.parentElement
            }
            return matrix
        }

        const fullMatrix = getAccumulatedTransform(element)

        if (!fullMatrix.isIdentity) {
            clone.style.transform = `matrix(${fullMatrix.a}, ${fullMatrix.b}, ${fullMatrix.c}, ${fullMatrix.d}, ${fullMatrix.e}, ${fullMatrix.f})`
        }

        clone.classList.add('lgs-widget-clone')
        return clone
    }

    /**
     * Calculates logical shadow margins for the composer.
     * @param {number} x - Offset X (e.g., 0)
     * @param {number} y - Offset Y (e.g., 1)
     * @param {number} blur - Blur radius (e.g., 2)
     * @param {number} [spread=0] - Spread radius
     * @returns {Object} { top, right, bottom, left }
     */
    getShadowMargins = (x, y, blur, spread = 0) => {
        return {
            top:    Math.max(0, blur + spread - y),
            bottom: Math.max(0, blur + spread + y),
            left:   Math.max(0, blur + spread - x),
            right:  Math.max(0, blur + spread + x),
        }
    }
}
