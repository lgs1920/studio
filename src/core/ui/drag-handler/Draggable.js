/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Draggable.js
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

import { SECOND }       from '@Core/constants'
import { v4 as uuidv4 } from 'uuid'

/**
 * Singleton that manages draggable widgets: bounds, snapping, movement, and crop overlay sync.
 * It also observes container resize and keeps widgets clamped within bounds.
 *
 * Key responsibilities:
 * - Initialize draggable elements and assign unique IDs.
 * - Compute and apply initial position or crop dimensions.
 * - Apply transform or left/top during drag; collapse transform to styles on end.
 * - Keep an outside overlay clip-path synchronized with crop zone box.
 * - On container resize, clamp/resize the crop zone (respecting aspect ratio lock).
 */
export class Draggable {
    // Singleton instance
    static instance = null

    // Delay before hiding control box
    HIDE_DELAY = 2 * SECOND

    // Internal attribute used for element IDs
    #ID_KEY = 'data-LGS-ID'

    // Elements configurations by ID
    #widgets

    // Valid anchor positions
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    // Whether any element is being dragged
    #isDragging = false

    // Control box timers by element
    #controlBoxTimers = new Map()

    // Current active element ID
    #current = null

    // Crop scale factor inside container (1 = full)
    #CROP_SCALE_FACTOR = 1

    // Minimal crop size
    #MIN_CROP_SIZE = {width: 0, height: 0}

    /**
     * Create or return the singleton instance.
     * @param {Object} store - Optional shared store (not required).
     */
    constructor(store) {
        if (Draggable.instance) {
            return Draggable.instance
        }
        this.#widgets = new Map()
        Draggable.instance = this
    }

    /**
     * Get element ID from its data attribute.
     * @param {HTMLElement} element
     * @returns {string|null}
     */
    retrieveElementId = element => {
        return element.getAttribute(this.#ID_KEY)
    }

    /**
     * Throttle calls to a function.
     * @param {Function} func
     * @param {number} limit
     * @returns {Function}
     */
    restrictRate = (func, limit) => {
        let inThrottle
        return (...args) => {
            if (!inThrottle) {
                func(...args)
                inThrottle = true
                setTimeout(() => (inThrottle = false), limit)
            }
        }
    }

    /**
     * Internal helper that hides control box after delay if applicable.
     * @private
     */
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

    /**
     * Initialize a draggable element, compute its initial position/crop,
     * and start observing container resize.
     *
     * @param {HTMLElement} element
     * @param {Object} initialConfig
     * @param {Function} setBounds
     * @param {Function} setPosition
     * @param {Object} moveable
     * @returns {boolean}
     */
    setupElement = (element, initialConfig, setBounds, setPosition, moveable) => {
        if (!element || !initialConfig?.container || !moveable.current) {
            return false
        }

        // Keep element reference
        initialConfig.element = element

        // Ensure ID
        let elementId = this.retrieveElementId(element)
        if (!elementId) {
            elementId = uuidv4()
            initialConfig.element = element
            element.setAttribute(this.#ID_KEY, elementId)
        }
        moveable.current.target = element

        // Force opacity while Moveable renders
        moveable.current.onRender = e => {
            e.target.style.opacity = initialConfig.opacity
        }

        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        // Create config if needed
        const config = this.retrieveConfig(element, initialConfig)
        this.applyCropToOverlay(config)

        // Update bounds and position/crop
        moveable.current.keepRatio = config.ratio.locked
        const newBounds = this.refreshBounds(config, moveable)
        setBounds(newBounds)
        if (config.isCropper) {
            element.style.left = `${config.cropDimensions.left}px`
            element.style.top = `${config.cropDimensions.top}px`
            element.style.width = `${config.cropDimensions.width}px`
            element.style.height = `${config.cropDimensions.height}px`
            this.applyCropToOverlay(config)
        }
        else {
            const newPosition = this.computeInitialPosition(config, element, false)
            this.applyPosition(element, newPosition, moveable, false, setPosition)
        }

        // Base styles
        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '0 0'

        // Observe container resize
        this.monitorContainerResize(config, setBounds, moveable, element, setPosition)

        // Create inner overlay if missing
        if (!config.overlay) {
            this.#createInnerOverlay(element)
        }
        return true
    }

    /**
     * Update outside overlay clip-path based on config.cropDimensions or element styles.
     * Keeps overlay "window" aligned with the crop box.
     * @param {Object} config
     */
    applyCropToOverlay = config => {
        if (!config?.isCropper) {
            return
        }
        if (config.element) {
            const left = parseInt(config.element.style.left || '0', 10)
            const top = parseInt(config.element.style.top || '0', 10)
            const width = parseInt(config.element.style.width || '0', 10)
            const height = parseInt(config.element.style.height || '0', 10)
            if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                config.cropDimensions = {left, top, width, height}
            }
            else {
                this.cropDimensions(config)
            }
        }
        else {
            this.cropDimensions(config)
        }
        if (config.outsideOverlay) {
            config.outsideOverlay.style.clipPath = this.openWindowInOverlay(config.cropDimensions)
        }
    }

    /**
     * Apply position either as transform (during drag) or as left/top (init).
     * Also updates Moveable rect and control box when dragging.
     */
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
                                   zoom: 1,
                                   opacity: 1,
                               })
        }
    }

    /**
     * Show/hide control box with delay and state handling.
     */
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
                                   zoom: 1,
                                   opacity: 1,
                               })
        }
        else {
            _controlBoxTimer.current = this.#hideControlBoxWithTimer(moveable, config, setControlBoxProps, isMouseOver)
            if (_controlBoxTimer.current) {
                this.#controlBoxTimers.set(elementId, _controlBoxTimer.current)
            }
        }
    }

    /**
     * Get or create configuration for an element.
     * Adds crop-related options including aspect ratio and min size.
     */
    retrieveConfig = (element, initialConfig = {}) => {
        const elementId = this.retrieveElementId(element)
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
                lockedOnCenter: initialConfig.lockedOnCenter ?? false, // keep center fixed on resize
            })
        }
        return this.getConfig(elementId)
    }

    /**
     * Compute initial left/top from given config (supports percentage values) and clamp to bounds.
     */
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
        return config.position
    }

    /**
     * Refresh container bounds (in pixels relative to container).
     * @param {Object} config
     * @returns {{left:number,top:number,right:number,bottom:number}}
     */
    refreshBounds = (config, moveable) => {
        const container = config.container.getBoundingClientRect()
        config.bounds = {
            left:   0,
            top:    0,
            right:  container.width,
            bottom: container.height,
        }
        return config.bounds
    }

    /**
     * Update edge-bound flags (touching top/bottom/left/right).
     * @param {HTMLElement} element
     * @param {Object} config
     * @returns {{left:boolean,top:boolean,right:boolean,bottom:boolean}}
     */
    setBoundStatus = (element, config = this.getConfig(this.#current)) => {
        const container = config.container.getBoundingClientRect()
        const target = element.getBoundingClientRect()
        config.boundStatus = {
            top:   target.top <= container.top,
            bottom: target.bottom >= container.bottom,
            left:  target.left <= container.left,
            right: target.right >= container.right,
        }
        return config.boundStatus
    }

    /**
     * Map ratio identifier to config (includes aspectRatio and optional locked flag).
     * @param {string} ratio
     * @returns {{aspectRatio:number,locked?:boolean}}
     */
    getRatio = (ratio) => {
        return lgs.configuration.videoFormats.find(p => p.value === ratio)
    }

    /**
     * Compute default crop dimensions centered within container, honoring useRatio/minCropSize.
     * @param {Object} config
     * @returns {{left:number,top:number,width:number,height:number}}
     */
    cropDimensions = (config) => {
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
        return config.cropDimensions
    }

    /**
     * Produce clip-path polygon that opens a window matching the crop box.
     * @param {{left:number,top:number,width:number,height:number}} crop
     * @returns {string}
     */
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

    /**
     * Observe container resize and:
     * - Recompute bounds
     * - Clamp or resize the crop zone to fit (keeping aspect ratio when locked)
     * - Re-sync overlay
     */
    monitorContainerResize = (config, setBounds, moveable, element, setPosition) => {
        if (config.observer) {
            return
        }

        const handleResize = (() => {
            let rafId = null
            let pending = false
            let lastComputed = {
                right: null,
                bottom: null,
                translateX: null,
                translateY: null,
            }

            const computeAndApply = () => {
                // Trace entry
                // console.debug('[Draggable] computeAndApply enter')

                const oldBounds = {...config.bounds}
                const newBounds = this.refreshBounds(config, moveable)

                // console.debug('[Draggable] bounds old->new', oldBounds, newBounds)

                if (
                    newBounds.left === oldBounds.left &&
                    newBounds.top === oldBounds.top &&
                    newBounds.right === oldBounds.right &&
                    newBounds.bottom === oldBounds.bottom
                ) {
                    // console.debug('[Draggable] computeAndApply no-op (same bounds)')
                    pending = false
                    rafId = null
                    return
                }
                setBounds(newBounds)
                this.setBoundStatus(element, config)

                const deltaRight = newBounds.right - oldBounds.right
                const deltaBottom = newBounds.bottom - oldBounds.bottom
                const isShrinking = deltaRight < 0 || deltaBottom < 0

                if (config.transform) {
                    const match = config.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
                    if (match) {
                        const translateX = parseFloat(match[1])
                        const translateY = parseFloat(match[2])
                        let newTranslateX = translateX
                        let newTranslateY = translateY

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
                    const t = element.style.transform || ''
                    const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
                    const baseLeft = parseInt(element.style.left || '0', 10)
                    const baseTop = parseInt(element.style.top || '0', 10)
                    const dx = m ? parseFloat(m[1]) || 0 : 0
                    const dy = m ? parseFloat(m[2]) || 0 : 0
                    let left = Math.round(baseLeft + dx)
                    let top = Math.round(baseTop + dy)
                    let width = parseInt(element.style.width || '0', 10)
                    let height = parseInt(element.style.height || '0', 10)

                    if (config.lockedOnCenter && width > 0 && height > 0) {
                        const cx = left + width / 2
                        const cy = top + height / 2
                        if (cx - width / 2 < newBounds.left) {
                            left += newBounds.left - (cx - width / 2)
                        }
                        if (cy - height / 2 < newBounds.top) {
                            top += newBounds.top - (cy - height / 2)
                        }
                        if (cx + width / 2 > newBounds.right) {
                            left -= (cx + width / 2) - newBounds.right
                        }
                        if (cy + height / 2 > newBounds.bottom) {
                            top -= (cy + height / 2) - newBounds.bottom
                        }
                        left = Math.round(cx - width / 2)
                        top = Math.round(cy - height / 2)
                    }

                    const maxLeft = Math.max(newBounds.left, newBounds.right - width)
                    const maxTop = Math.max(newBounds.top, newBounds.bottom - height)
                    if (left < newBounds.left) {
                        left = newBounds.left
                    }
                    if (top < newBounds.top) {
                        top = newBounds.top
                    }
                    if (left > maxLeft) {
                        left = maxLeft
                    }
                    if (top > maxTop) {
                        top = maxTop
                    }

                    element.style.left = `${left}px`
                    element.style.top = `${top}px`
                    element.style.transform = 'none'
                    config.transform = undefined
                    config.position = {left, top}
                    config.element = element
                    config.cropDimensions = {left, top, width, height}
                    this.applyCropToOverlay(config)
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
                // console.debug('[Draggable] computeAndApply done')
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

        // Safety: verify container exists before observing
        if (config.container) {
            config.observer = new ResizeObserver(handleResize)
            config.observer.observe(config.container)
        }
        else {
            // console.warn('[Draggable] No container to observe')
        }
    }

    /**
     * Dispose a draggable element: stop observing, clear timers and config.
     * @param {HTMLElement} element
     */
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

    /**
     * Begin drag: mark current element and apply drag styles.
     * @param {Object} e - Moveable dragStart event (contains target)
     */
    onDragStart = e => {
        e.target.classList.add('dragging')
        const config = this.retrieveConfig(e.target)
        if (config.animationWhenDragging) {
            e.target.classList.add('dragging-animation')
        }
        this.#isDragging = true
        const elementId = this.retrieveElementId(e.target)
        this.#current = elementId
        if (config?.isCropper) {
            config.element = e.target
        }
    }

    /**
     * End drag: collapse transform to left/top, update cropDimensions, and re-sync overlay.
     * @param {Object} e - Moveable dragEnd event
     */
    onDragEnd = e => {
        e.target.classList.remove('dragging', 'dragging-animation')
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
            this.applyCropToOverlay(config)
        }
    }

    /**
     * Compute DOM bounds for an element or the window.
     * @private
     */
    #computeElementBounds = element => {
        if (element === window) {
            return {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight}
        }
        const rect = element.getBoundingClientRect()
        return {top: rect.top, left: rect.left, width: rect.width, height: rect.height}
    }

    /**
     * Create an inner overlay DIV (transparent) inside the widget for event/cursor management.
     * @private
     */
    #createInnerOverlay = element => {
        const overlay = document.createElement('div')
        const elementId = this.retrieveElementId(element)
        const config = this.getConfig(elementId)
        config.overlay = overlay
        const targetRect = this.#computeElementBounds(element)
        Object.assign(overlay.style, {
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
        })
        overlay.classList.add('lgs-widget-inner-overlay')
        element.appendChild(overlay)
    }

    /**
     * Get inner overlay of a given element.
     * @param {HTMLElement} element
     * @returns {HTMLElement}
     */
    getInnerOverlay = element => {
        const elementId = this.retrieveElementId(element)
        const config = this.getConfig(elementId)
        return config.overlay
    }

    /**
     * Retrieve config by element ID.
     * @param {string} elementId
     * @returns {Object|undefined}
     */
    getConfig = (elementId) => {
        return this.#widgets.get(elementId)
    }

    /**
     * Set config for element ID.
     * @param {string} elementId
     * @param {Object} config
     */
    setConfig = (elementId, config) => {
        this.#widgets.set(elementId, config)
    }

}