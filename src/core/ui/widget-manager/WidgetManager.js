/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-08
 * Last modified: 2025-10-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { LGS_ANIMATION_DRAGGING, LGS_ANIMATION_RESIZING, SECOND } from '@Core/constants'
import { v4 as uuidv4 }                                           from 'uuid'

/**
 * Singleton that manages draggable widgets and crop zones.
 */
export class WidgetManager {
    static instance = null
    HIDE_DELAY = 2 * SECOND
    #ID_KEY = 'data-LGS-ID'
    #widgets
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
    #isDragging = false
    #isResizing = false
    #controlBoxTimers = new Map()
    #current = null
    #CROP_SCALE_FACTOR = 1
    #MIN_CROP_SIZE = {width: 0, height: 0}

    constructor(store) {
        if (WidgetManager.instance) {
            return WidgetManager.instance
        }
        this.#widgets = new Map()
        WidgetManager.instance = this
    }

    retrieveElementId = element => element.getAttribute(this.#ID_KEY)

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
        if (this.#isDragging || !config.showControlBox || isMouseOver) {
            return
        }
        if (this.#current !== config.id) {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            return
        }
        return setTimeout(() => {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            const elementId = this.retrieveElementId(moveable.current.target)
            this.#controlBoxTimers.delete(elementId)
        }, this.HIDE_DELAY)
    }

    setupElement = (element, initialConfig, setBounds, setPosition, moveable) => {
        if (!element || !initialConfig?.container || !moveable.current) {
            return false
        }

        initialConfig.element = element
        initialConfig.moveable = moveable
        initialConfig.setPosition = setPosition

        let elementId = initialConfig.id && typeof initialConfig.id === 'string' && initialConfig.id.trim()
                        ? initialConfig.id
                        : this.retrieveElementId(element) || uuidv4()

        element.setAttribute(this.#ID_KEY, elementId)
        moveable.current.target = element

        moveable.current.onRender = e => {
            e.target.style.opacity = initialConfig.opacity
        }

        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        const config = this.retrieveConfig(element, initialConfig)

        // Ensure ratio set (preserve existing)
        if (!config?.ratio || !Number.isFinite(config.ratio?.aspectRatio)) {
            const fallback = __.device.isPortrait ? '9x16' : '16x9'
            config.ratio = this.getRatio(initialConfig.ratio ?? fallback)
        }

        // Persisted crop?
        const hasPersistedCrop =
                  config?.cropDimensions &&
                  Number.isFinite(config.cropDimensions.left) &&
                  Number.isFinite(config.cropDimensions.top) &&
                  Number.isFinite(config.cropDimensions.width) &&
                  Number.isFinite(config.cropDimensions.height) &&
                  config.cropDimensions.width > 0 &&
                  config.cropDimensions.height > 0

        if (!hasPersistedCrop) {
            this.cropDimensions(config) // default centered; NOT maximize
        }

        // Apply crop as-is (no recompute/resize)
        if (config.isCropper) {
            element.style.left = `${config.cropDimensions.left}px`
            element.style.top = `${config.cropDimensions.top}px`
            element.style.width = `${config.cropDimensions.width}px`
            element.style.height = `${config.cropDimensions.height}px`
            element.style.transform = 'none'
            config.position = {left: config.cropDimensions.left, top: config.cropDimensions.top}
            this.applyCropToOverlay(config)
        }

        // Moveable keepRatio only
        moveable.current.request('resizable', {
            keepRatio: !!config.ratio.locked,
            deltaWidth:  0,
            deltaHeight: 0,
        }, true)

        const newBounds = this.refreshBounds(config, moveable)
        setBounds(newBounds)

        if (!config.isCropper) {
            const newPosition = this.computeInitialPosition(config, element, false)
            this.applyPosition(element, newPosition, moveable, false, setPosition)
        }

        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '0 0'

        this.monitorContainerResize(config, setBounds, moveable, element, setPosition)

        if (!config.overlay) {
            this.#createInnerOverlay(element)
        }

        if (config.isCropper && moveable.current.resizable) {
            moveable.current.onDoubleClick = e => this.onDoubleClick(e, setPosition)
        }

        // Initial event
        try {
            if (config.isCropper && config.cropDimensions) {
                document.dispatchEvent(new CustomEvent('onCropUpdate', {
                    detail: {
                        id:    config.id,
                        crop:  {...config.cropDimensions},
                        ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                        phase: 'init',
                    },
                }))
            }
        }
        catch (_) {
        }

        return true
    }

    updateCropRatio = (cropzoneId, aspectRatio, lockRatio) => {
        const config = this.getConfig(cropzoneId)
        if (!config || !config.isCropper) {
            console.warn('[WidgetManager] No valid cropzone found for ID:', cropzoneId)
            return
        }

        if (!config.element) {
            const element = document.querySelector(`[${this.#ID_KEY}="${cropzoneId}"]`)
            if (element) {
                config.element = element
            }
            else {
                console.warn('[WidgetManager] No element found for cropzone ID:', cropzoneId)
                return
            }
        }

        document.dispatchEvent(new CustomEvent('onBeforeCropUpdate', {
            detail: {
                id: cropzoneId,
            },
        }))

        this.#current = cropzoneId
        config.isMaximized = false

        const container = config.container.getBoundingClientRect()
        const padding = config.containerPadding || 0
        const paddedWidth = container.width - 2 * padding
        const paddedHeight = container.height - 2 * padding
        const maxWidth = Math.floor(paddedWidth * this.#CROP_SCALE_FACTOR)
        const maxHeight = Math.floor(paddedHeight * this.#CROP_SCALE_FACTOR)

        let width, height
        if (aspectRatio === 1) {
            width = height = Math.floor(Math.max(config.minCropSize.width, Math.min(maxWidth, maxHeight)))
        }
        else if (aspectRatio < 1) {
            height = Math.floor(Math.max(config.minCropSize.height, maxHeight))
            width = Math.floor(Math.max(config.minCropSize.width, height * aspectRatio))
            if (width > maxWidth) {
                width = maxWidth
                height = Math.floor(width / aspectRatio)
            }
        }
        else {
            width = Math.floor(Math.max(config.minCropSize.width, maxWidth))
            height = Math.floor(Math.max(config.minCropSize.height, width / aspectRatio))
            if (height > maxHeight) {
                height = maxHeight
                width = Math.floor(height * aspectRatio)
            }
        }

        const left = Math.floor((paddedWidth - width) / 2) + padding
        const top = Math.floor((paddedHeight - height) / 2) + padding

        config.cropDimensions = {left, top, width, height}
        config.position = {left, top}
        config.centerRatio = {x: (left + width / 2) / container.width, y: (top + height / 2) / container.height}

        const element = config.element
        element.style.left = `${left}px`
        element.style.top = `${top}px`
        element.style.width = `${width}px`
        element.style.height = `${height}px`
        element.style.transform = 'none'

        this.applyCropToOverlay(config)

        if (config.setPosition) {
            config.setPosition({left, top})
        }

        if (config.moveable.current) {
            config.moveable.current.updateRect()
        }

        try {
            document.dispatchEvent(new CustomEvent('onCropUpdate', {
                detail: {
                    id:    cropzoneId,
                    crop:  {left, top, width, height},
                    ratio: {aspectRatio, locked: lockRatio},
                    phase: 'ratio',
                },
            }))
        }
        catch (_) {
        }
    }

    applyCropToOverlay = config => {
        if (!config?.isCropper || !config.outsideOverlay) {
            return
        }
        const {left, top, width, height} = config.cropDimensions || {}
        if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            config.outsideOverlay.style.clipPath = this.openWindowInOverlay({left, top, width, height})
        }
        else {
            this.cropDimensions(config)
            config.outsideOverlay.style.clipPath = this.openWindowInOverlay(config.cropDimensions)
        }
    }

    retrieveConfig = (element, initialConfig = {}) => {
        const elementId = initialConfig.id && typeof initialConfig.id === 'string' && initialConfig.id.trim()
                          ? initialConfig.id
                          : this.retrieveElementId(element) || uuidv4()

        if (!this.#widgets.has(elementId)) {
            const anchor =
                      (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo))
                      ? initialConfig.attachTo
                      : (initialConfig.position && this.#validPositions.includes(initialConfig.position))
                        ? initialConfig.position
                        : 'top-left'

            const ratio = __.device.isPortrait ? '9x16' : '16x9'
            this.#widgets.set(elementId, {
                id:             elementId,
                boundStatus:    {left: false, top: false, right: false, bottom: false},
                container:      initialConfig.container,
                isCropper:      initialConfig.isCropper,
                isMobile:       initialConfig.isMobile,
                bounds:         {left: 0, top: 0, right: 0, bottom: 0},
                position:       {left: 0, top: 0},
                left:           initialConfig.left,
                top:            initialConfig.top,
                attachTo:       anchor,
                snapPoints:     [],
                dimensions:     {width: 0, height: 0},
                observer:       null,
                showControlBox: initialConfig.showControlBox,
                containerPadding: initialConfig.containerPadding,
                animationWhenDragging: initialConfig.animationWhenDragging ?? false,
                ratio:          this.getRatio(initialConfig.ratio ?? ratio),
                useRatio:       initialConfig.useRatio ?? true,
                minCropSize:    initialConfig.minCropSize ?? this.#MIN_CROP_SIZE,
                outsideOverlay: initialConfig.outsideOverlay,
                resizeFromCenter: initialConfig.resizeFromCenter ?? false,
                centerRatio: {x: 0.5, y: 0.5},
                previousCropDimensions: null,
                isMaximized:            false,
                moveable:    initialConfig.moveable,
                setPosition: initialConfig.setPosition,
                element:                initialConfig.element,
                cropDimensions:         initialConfig.cropDimensions, // allow injection if provided
            })
        }
        else {
            // Merge-in mutable runtime props if provided (e.g., outsideOverlay)
            const widget = this.#widgets.get(elementId)
            if (initialConfig.outsideOverlay) {
                widget.outsideOverlay = initialConfig.outsideOverlay
            }
            if (initialConfig.container) {
                widget.container = initialConfig.container
            }
        }
        return this.getConfig(elementId)
    }

    applyPosition = (element, position, moveable, isDragging, setControlBoxProps) => {
        const config = this.getConfig(this.retrieveElementId(element))
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
        if (moveable?.current) {
            moveable.current.updateRect()
        }
        if (config.showControlBox && isDragging) {
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
    }

    manageControlBox = (moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver) => {
        const elementId = this.retrieveElementId(moveable.current.target)
        const config = this.getConfig(elementId)
        if (!config || !config.showControlBox) {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            clearTimeout(_controlBoxTimer.current)
            this.#controlBoxTimers.delete(elementId)
            return
        }
        clearTimeout(_controlBoxTimer.current)
        this.#controlBoxTimers.delete(elementId)

        if (show) {
            this.#current = elementId
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
        else {
            _controlBoxTimer.current = this.#hideControlBoxWithTimer(moveable, config, setControlBoxProps, isMouseOver)
            if (_controlBoxTimer.current) {
                this.#controlBoxTimers.set(elementId, _controlBoxTimer.current)
            }
        }
    }

    getRatio = (ratio) => lgs.configuration.videoFormats.find(p => p.value === ratio)

    computeInitialPosition = (config, element, isResize = false) => {
        if (!config.container || !element) {
            return {left: 0, top: 0}
        }
        const container = config.container.getBoundingClientRect()
        const widget = element.getBoundingClientRect()
        if (widget.width === 0 || widget.height === 0) {
            return {left: 0, top: 0}
        }
        const parsePosition = (value, maxDimension) => {
            if (typeof value === 'string' && value.endsWith('%')) {
                const percent = parseFloat(value)
                return isNaN(percent) ? 0 : (percent / 100) * maxDimension
            }
            const numValue = typeof value === 'number' ? value : parseFloat(value)
            return isNaN(numValue) ? 0 : numValue
        }

        let left = parsePosition(config.left, container.width)
        let top = parsePosition(config.top, container.height)

        const attachTo = config.attachTo || 'top-left'
        const adjustments = {
            center:         () => ({left: left - widget.width / 2, top: top - widget.height / 2}),
            top:            () => ({left: left - widget.width / 2, top: top}),
            left:           () => ({left: left, top: top - widget.height / 2}),
            right:          () => ({left: left - widget.width, top: top - widget.height / 2}),
            bottom:         () => ({left: left - widget.width / 2, top: top - widget.height}),
            'top-left':     () => ({left, top}),
            'top-right':    () => ({left: left - widget.width, top}),
            'bottom-left':  () => ({left, top: top - widget.height}),
            'bottom-right': () => ({left: left - widget.width, top: top - widget.height}),
        }
        const adjust = adjustments[attachTo]
        if (adjust) {
            const adjusted = adjust()
            left = adjusted.left
            top = adjusted.top
        }

        left = Math.min(Math.max(left, config.bounds.left), config.bounds.right - widget.width)
        top = Math.min(Math.max(top, config.bounds.top), config.bounds.bottom - widget.height)

        config.position = {left, top}
        config.dimensions = {width: widget.width, height: widget.height}
        if (config.resizeFromCenter) {
            config.centerRatio = {
                x: (left + widget.width / 2) / container.width,
                y: (top + widget.height / 2) / container.height,
            }
        }
        return config.position
    }

    refreshBounds = (config, moveable) => {
        const container = config.container.getBoundingClientRect()
        config.bounds = {
            left:  0,
            top:   0,
            right: container.width,
            bottom: container.height,
        }
        return config.bounds
    }

    setBoundStatus = (element, config = this.getConfig(this.#current)) => {
        const container = config.container.getBoundingClientRect()
        const target = element.getBoundingClientRect()
        config.boundStatus = {
            top:  target.top <= container.top,
            bottom: target.bottom >= container.bottom,
            left: target.left <= container.left,
            right: target.right >= container.right,
        }
        return config.boundStatus
    }

    cropDimensions = (config, maximize = false) => {
        const container = this.refreshBounds(config)
        container.width = container.right - container.left
        container.height = container.bottom - container.top

        const padding = config.containerPadding || 0
        const paddedWidth = container.width - 2 * padding
        const paddedHeight = container.height - 2 * padding

        let width = 0
        let height = 0

        const maxWidth = Math.floor(paddedWidth * this.#CROP_SCALE_FACTOR)
        const maxHeight = Math.floor(paddedHeight * this.#CROP_SCALE_FACTOR)

        if (config.useRatio) {
            const ratio = config.ratio.aspectRatio
            if (ratio === 1) {
                width = height = Math.floor(Math.max(config.minCropSize.width, Math.min(maxWidth, maxHeight)))
            }
            else if (ratio < 1) {
                height = Math.floor(Math.max(config.minCropSize.height, maxHeight))
                width = Math.floor(Math.max(config.minCropSize.width, height * ratio))
                if (width > maxWidth) {
                    width = maxWidth
                    height = Math.floor(width / ratio)
                }
            }
            else {
                width = Math.floor(Math.max(config.minCropSize.width, maxWidth))
                height = Math.floor(Math.max(config.minCropSize.height, width / ratio))
                if (height > maxHeight) {
                    height = maxHeight
                    width = Math.floor(height * ratio)
                }
            }
        }
        else {
            width = maxWidth
            height = maxHeight
        }

        const left = Math.floor((paddedWidth - width) / 2) + padding
        const top = Math.floor((paddedHeight - height) / 2) + padding

        config.cropDimensions = {left, top, width, height}
        if (config.resizeFromCenter) {
            config.centerRatio = {x: 0.5, y: 0.5}
        }
        return config.cropDimensions
    }

    monitorContainerResize = (config, setBounds, moveable, element, setPosition) => {
        if (config.observer) {
            return
        }

        const handleResize = (() => {
            let rafId = null
            let pending = false
            let lastComputed = {right: null, bottom: null, translateX: null, translateY: null}

            const computeAndApply = () => {
                if (this.#isResizing) {
                    pending = false
                    rafId = null
                    return
                }

                const oldBounds = {...config.bounds}
                const newBounds = this.refreshBounds(config, moveable)
                if (newBounds.left === oldBounds.left && newBounds.top === oldBounds.top &&
                    newBounds.right === oldBounds.right && newBounds.bottom === oldBounds.bottom) {
                    pending = false
                    rafId = null
                    return
                }
                setBounds(newBounds)
                this.setBoundStatus(element, config)

                if (config.transform) {
                    const match = config.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
                    if (match) {
                        const translateX = parseFloat(match[1])
                        const translateY = parseFloat(match[2])
                        let newTranslateX = translateX
                        let newTranslateY = translateY

                        const deltaRight = newBounds.right - oldBounds.right
                        const deltaBottom = newBounds.bottom - oldBounds.bottom
                        const isShrinking = deltaRight < 0 || deltaBottom < 0
                        if (isShrinking) {
                            if (config.boundStatus.right) {
                                newTranslateX = translateX + deltaRight
                            }
                            if (config.boundStatus.bottom) {
                                newTranslateY = translateY + deltaBottom
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

                        if (newTranslateX !== translateX || newTranslateY !== translateY) {
                            if (lastComputed.translateX !== newTranslateX || lastComputed.translateY !== newTranslateY) {
                                config.transform = `translate(${newTranslateX}px, ${newTranslateY}px)`
                                element.style.transform = config.transform
                                lastComputed.translateX = newTranslateX
                                lastComputed.translateY = newTranslateY
                            }
                        }
                    }
                }

                if (config.isCropper) {
                    // Preserve width/height; only clamp left/top
                    const t = element.style.transform || ''
                    const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
                    const baseLeft = parseInt(element.style.left || '0', 10)
                    const baseTop = parseInt(element.style.top || '0', 10)
                    const dx = m ? parseFloat(m[1]) || 0 : 0
                    const dy = m ? parseFloat(m[2]) || 0 : 0
                    let left = Math.round(baseLeft + dx)
                    let top = Math.round(baseTop + dy)

                    let width = Number(config.cropDimensions?.width) || parseInt(element.style.width || '0', 10)
                    let height = Number(config.cropDimensions?.height) || parseInt(element.style.height || '0', 10)
                    width = Math.max(0, width)
                    height = Math.max(0, height)

                    const maxLeft = Math.max(newBounds.left, newBounds.right - width)
                    const maxTop = Math.max(newBounds.top, newBounds.bottom - height)
                    left = Math.min(Math.max(left, newBounds.left), maxLeft)
                    top = Math.min(Math.max(top, newBounds.top), maxTop)

                    element.style.left = `${left}px`
                    element.style.top = `${top}px`
                    element.style.transform = 'none'
                    config.transform = undefined
                    config.position = {left, top}
                    config.cropDimensions = {left, top, width, height}
                    this.applyCropToOverlay(config)

                    try {
                        document.dispatchEvent(new CustomEvent('onCropUpdate', {
                            detail: {
                                id:    config.id,
                                crop:  {left, top, width, height},
                                ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                                phase: 'container-resize',
                            },
                        }))
                    }
                    catch (_) {
                    }
                }

                const rightChanged = lastComputed.right !== newBounds.right
                const bottomChanged = lastComputed.bottom !== newBounds.bottom
                if (rightChanged || bottomChanged) {
                    if (moveable && moveable.current) {
                        moveable.current.updateRect()
                    }
                    lastComputed.right = newBounds.right
                    lastComputed.bottom = newBounds.bottom
                }

                pending = false
                rafId = null
            }

            return () => {
                if (pending) {
                    return
                }
                pending = true
                if (rafId !== null) {
                    cancelAnimationFrame(rafId)
                }
                rafId = requestAnimationFrame(computeAndApply)
            }
        })()

        if (config.container) {
            config.observer = new ResizeObserver(handleResize)
            config.observer.observe(config.container)
        }
    }

    openWindowInOverlay = (crop) => {
        return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%,
      0% ${crop.top}px,
      ${crop.left}px ${crop.top}px,
      ${crop.left}px ${crop.top + crop.height}px,
      ${crop.left + crop.width}px ${crop.top + crop.height}px,
      ${crop.left + crop.width}px ${crop.top}px,
      0% ${crop.top}px
    )`
    }

    #createInnerOverlay = element => {
        const overlay = document.createElement('div')
        const elementId = this.retrieveElementId(element)
        const config = this.getConfig(elementId)
        config.overlay = overlay
        const targetRect = this.#computeElementBounds(element)
        Object.assign(overlay.style, {width: `${targetRect.width}px`, height: `${targetRect.height}px`})
        overlay.classList.add('lgs-widget-inner-overlay')
        element.appendChild(overlay)
    }

    disposeElement = element => {
        const elementId = this.retrieveElementId(element)
        const config = this.getConfig(elementId)
        if (!config) {
            return
        }
        if (config.observer) {
            try {
                config.observer.unobserve(config.container)
            }
            catch (_) {
            }
            config.observer.disconnect()
            config.observer = null
        }
        this.#widgets.delete(elementId)
        const timer = this.#controlBoxTimers.get(elementId)
        if (timer) {
            clearTimeout(timer)
            this.#controlBoxTimers.delete(elementId)
        }
    }

    onDragStart = e => {
        e.target.classList.add('dragging')
        const config = this.retrieveConfig(e.target)
        if (config.animationWhenDragging) {
            e.target.classList.add(LGS_ANIMATION_DRAGGING)
        }
        this.#isDragging = true
        const elementId = this.retrieveElementId(e.target)
        this.#current = elementId
    }

    onDragEnd = e => {
        e.target.classList.remove('dragging', LGS_ANIMATION_DRAGGING)
        this.#isDragging = false

        const config = this.retrieveConfig(e.target)
        if (config?.isCropper) {
            const currentTransform = e.target.style.transform || ''
            const match = currentTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
            if (match) {
                const dx = parseFloat(match[1]) || 0
                const dy = parseFloat(match[2]) || 0
                const baseLeft = parseInt(e.target.style.left || '0', 10)
                const baseTop = parseInt(e.target.style.top || '0', 10)
                const finalLeft = Math.round(baseLeft + dx)
                const finalTop = Math.round(baseTop + dy)
                e.target.style.left = `${finalLeft}px`
                e.target.style.top = `${finalTop}px`
                e.target.style.transform = 'none'
                config.transform = undefined
                config.position = {left: finalLeft, top: finalTop}
            }

            config.element = e.target
            const left = parseInt(e.target.style.left || '0', 10)
            const top = parseInt(e.target.style.top || '0', 10)
            const width = parseInt(e.target.style.width || '0', 10)
            const height = parseInt(e.target.style.height || '0', 10)
            if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                config.cropDimensions = {left, top, width, height}
            }
            if (config.resizeFromCenter) {
                const container = config.container.getBoundingClientRect()
                config.centerRatio = {
                    x: (left + width / 2) / container.width,
                    y: (top + height / 2) / container.height,
                }
            }
            this.applyCropToOverlay(config)
        }
    }

    onResizeStart = e => {
        this.#isResizing = true
        e.target.classList.add('resizing')
        const config = this.retrieveConfig(e.target)
        if (config.animationWhenResizing) {
            e.target.classList.add(LGS_ANIMATION_RESIZING)
        }
    }

    onResize = (e, refs, setPosition) => {
        this.#handleResize(e, refs.widget.current, setPosition, refs.child)
    }

    onResizeEnd = e => {
        this.#isResizing = false
        e.target.classList.remove('resizing', LGS_ANIMATION_RESIZING)
        const config = this.retrieveConfig(e.target)
        if (config?.isCropper) {
            config.element = e.target
            const left = parseInt(e.target.style.left || '0', 10)
            const top = parseInt(e.target.style.top || '0', 10)
            const width = parseInt(e.target.style.width || '0', 10)
            const height = parseInt(e.target.style.height || '0', 10)
            config.cropDimensions = {left, top, width, height}
            this.applyCropToOverlay(config)

            try {
                document.dispatchEvent(new CustomEvent('onCropUpdate', {
                    detail: {
                        id:    config.id,
                        crop:  {left, top, width, height},
                        ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                        phase: 'end',
                    },
                }))
            }
            catch (_) {
            }
        }
    }

    onDoubleClick = (e, setPosition, moveable) => {
        const config = this.retrieveConfig(e.target)
        if (!config?.isCropper) {
            return
        }

        if (config.isMaximized) {
            if (config.previousCropDimensions) {
                config.cropDimensions = {...config.previousCropDimensions}
                config.previousCropDimensions = null
                config.isMaximized = false
            }
        }
        else {
            config.previousCropDimensions = {...config.cropDimensions}
            this.cropDimensions(config, true)
            config.isMaximized = true

            clearTimeout(config.restoreTimeoutId)
            config.restoreTimeoutId = setTimeout(() => {
                config.previousCropDimensions = null
                config.isMaximized = false
            }, 5000)
        }

        const {left, top, width, height} = config.cropDimensions
        Object.assign(e.target.style, {
            left:      `${left}px`,
            top:       `${top}px`,
            width:     `${width}px`,
            height:    `${height}px`,
            transform: 'none',
        })

        config.transform = undefined
        config.position = {left, top}

        const container = config.container.getBoundingClientRect()
        config.centerRatio = {
            x: (left + width / 2) / container.width,
            y: (top + height / 2) / container.height,
        }

        this.applyCropToOverlay(config)
        setPosition({left, top})
        if (moveable && moveable.current) {
            moveable.current.updateRect()
        }

        try {
            document.dispatchEvent(new CustomEvent('onCropUpdate', {
                detail: {
                    id:    config.id,
                    crop:  {left, top, width, height},
                    ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                    phase: 'toggle',
                },
            }))
        }
        catch (_) {
        }
    }

    #computeElementBounds = element => {
        if (element === window) {
            return {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight}
        }
        const rect = element.getBoundingClientRect()
        return {top: rect.top, left: rect.left, width: rect.width, height: rect.height}
    }

    getConfig = elementId => this.#widgets.get(elementId)

    getInnerOverlay = element => {
        const elementId = this.retrieveElementId(element)
        const config = this.getConfig(elementId)
        return config.overlay
    }

    #handleResize = this.#throttle((e, target, setPosition, childRef) => {
        if (!target || !e) {
            return
        }

        this.#isResizing = true
        const width = Math.round(e.width)
        const height = Math.round(e.height)
        const config = this.getConfig(this.retrieveElementId(target))

        const prevCropDimensions = config.isCropper ? {...config.cropDimensions} : {}

        const baseLeft = parseInt(target.style.left || '0', 10)
        const baseTop = parseInt(target.style.top || '0', 10)
        const currentWidth = config.isCropper ? prevCropDimensions?.width || width : parseInt(target.style.width || '0', 10) || width
        const currentHeight = config.isCropper ? prevCropDimensions?.height || height : parseInt(target.style.height || '0', 10) || height

        let finalLeft = baseLeft
        let finalTop = baseTop

        if (config?.resizeFromCenter) {
            finalLeft = Math.round(baseLeft + (currentWidth - width) / 2)
            finalTop = Math.round(baseTop + (currentHeight - height) / 2)
            const container = config.container.getBoundingClientRect()
            config.centerRatio = {
                x: (finalLeft + width / 2) / container.width,
                y: (finalTop + height / 2) / container.height,
            }
        }
        else {
            const [dx, dy] = e.direction
            const directionMap = {
                '1,1':   {left: baseLeft, top: baseTop},
                '1,-1':  {left: baseLeft, top: baseTop + (currentHeight - height)},
                '-1,1':  {left: baseLeft + (currentWidth - width), top: baseTop},
                '-1,-1': {left: baseLeft + (currentWidth - width), top: baseTop + (currentHeight - height)},
                '-1,0':  {left: baseLeft + (currentWidth - width), top: baseTop},
                '1,0':   {left: baseLeft, top: baseTop},
                '0,1':   {left: baseLeft, top: baseTop},
                '0,-1':  {left: baseLeft, top: baseTop + (currentHeight - height)},
            }
            const k = `${dx},${dy}`
            const d = directionMap[k] || directionMap['1,1']
            finalLeft = d.left
            finalTop = d.top
        }

        const maxLeft = Math.max(config.bounds.left, config.bounds.right - width)
        const maxTop = Math.max(config.bounds.top, config.bounds.bottom - height)
        finalLeft = Math.min(Math.max(finalLeft, config.bounds.left), maxLeft)
        finalTop = Math.min(Math.max(finalTop, config.bounds.top), maxTop)

        target.style.left = `${finalLeft}px`
        target.style.top = `${finalTop}px`
        target.style.width = `${width}px`
        target.style.height = `${height}px`
        target.style.transform = 'none'

        if (config.isCropper) {
            const before = prevCropDimensions
            const after = {left: finalLeft, top: finalTop, width, height}
            config.cropDimensions = after

            if (!before ||
                before.left !== after.left ||
                before.top !== after.top ||
                before.width !== after.width ||
                before.height !== after.height) {
                try {
                    document.dispatchEvent(new CustomEvent('onCropUpdate', {
                        detail: {
                            id:    config.id,
                            crop:  {...after},
                            ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                            phase: 'resize',
                        },
                    }))
                }
                catch (_) {
                }
            }
        }

        if (config?.isCropper) {
            config.element = target
            this.applyCropToOverlay(config)
        }

        setPosition({left: finalLeft, top: finalTop})

        if (childRef.current?.handleResize) {
            childRef.current.handleResize({left: finalLeft, top: finalTop, width, height})
        }
        this.#isResizing = false
    }, 16)

    setConfig = (elementId, config) => {
        this.#widgets.set(elementId, config)
    }
}