/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-05
 * Last modified: 2025-10-05
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
 * - Handle double-click/tap on cropzone to toggle between max size and previous size.
 */
export class WidgetManager {
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

    // Whether any element is being resized
    #isResizing = false

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
        if (WidgetManager.instance) {
            return WidgetManager.instance
        }
        this.#widgets = new Map()
        WidgetManager.instance = this
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
     * @param {Function} func - Function to throttle
     * @param {number} limit - Throttle limit in milliseconds
     * @returns {Function} Throttled function
     */
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

        // Attach double-click/tap event for cropzone if isCropper and resizable
        if (config.isCropper && moveable.current.resizable) {
            moveable.current.onDoubleClick = e => this.onDoubleClick(e, setPosition)
        }

        return true
    }

    /**
     * Update outside overlay clip-path based on config.cropDimensions or element styles.
     * Keeps overlay "window" aligned with the crop box.
     * @param {Object} config
     */
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

    /**
     * Handle resize event, including positioning and overlay sync.
     * Ensures the element stays centered when resizeFromCenter is true, otherwise adjusts position based on resize
     * direction. Uses config.cropDimensions for current dimensions when isCropper=true.
     * @private
     * @param {Object} e - Resize event
     * @param {HTMLElement} target - Target element
     * @param {Function} setPosition - Function to update position state
     * @param {Object} childRef - Reference to child component
     */
    #handleResize = this.#throttle((e, target, setPosition, childRef) => {
        if (!target || !e) {
            return
        }

        this.#isResizing = true
        const width = Math.round(e.width)
        const height = Math.round(e.height)
        const config = this.getConfig(this.retrieveElementId(target))

        // Store previous cropDimensions to calculate deltas
        const prevCropDimensions = config.isCropper ? {...config.cropDimensions} : {}

        // Get current position and dimensions
        const baseLeft = parseInt(target.style.left || '0', 10)
        const baseTop = parseInt(target.style.top || '0', 10)
        const currentWidth = config.isCropper ? prevCropDimensions?.width || width : parseInt(target.style.width || '0', 10) || width
        const currentHeight = config.isCropper ? prevCropDimensions?.height || height : parseInt(target.style.height || '0', 10) || height

        let finalLeft = baseLeft
        let finalTop = baseTop

        if (config?.resizeFromCenter) {
            // Center-based resize: keep the center fixed
            finalLeft = Math.round(baseLeft + (currentWidth - width) / 2)
            finalTop = Math.round(baseTop + (currentHeight - height) / 2)

            // Update centerRatio
            const container = config.container.getBoundingClientRect()
            config.centerRatio = {
                x: (finalLeft + width / 2) / container.width,
                y: (finalTop + height / 2) / container.height,
            }
        }
        else {
            // Direction-based resize: keep opposite corner fixed
            const [dx, dy] = e.direction // dx: -1 (left), 0 (none), 1 (right); dy: -1 (top), 0 (none), 1 (bottom)

            // Map direction to fixed corner
            const directionMap = {
                '1,1':   {fixed: 'nw', left: baseLeft, top: baseTop}, // se: fix nw
                '1,-1':  {fixed: 'sw', left: baseLeft, top: baseTop + (currentHeight - height)}, // ne: fix sw
                '-1,1':  {fixed: 'ne', left: baseLeft + (currentWidth - width), top: baseTop}, // sw: fix ne
                '-1,-1': {
                    fixed: 'se',
                    left:  baseLeft + (currentWidth - width),
                    top:   baseTop + (currentHeight - height),
                }, // nw: fix se
                '-1,0':  {fixed: 'e', left: baseLeft + (currentWidth - width), top: baseTop}, // w: fix e
                '1,0':   {fixed: 'w', left: baseLeft, top: baseTop}, // e: fix w
                '0,1':   {fixed: 'n', left: baseLeft, top: baseTop}, // s: fix n
                '0,-1':  {fixed: 's', left: baseLeft, top: baseTop + (currentHeight - height)}, // n: fix s
            }

            const directionKey = `${dx},${dy}`
            const directionConfig = directionMap[directionKey] || directionMap['1,1'] // Fallback to se if direction
                                                                                      // unknown
            finalLeft = directionConfig.left
            finalTop = directionConfig.top
        }

        // Clamp to bounds
        const maxLeft = Math.max(config.bounds.left, config.bounds.right - width)
        const maxTop = Math.max(config.bounds.top, config.bounds.bottom - height)
        finalLeft = Math.min(Math.max(finalLeft, config.bounds.left), maxLeft)
        finalTop = Math.min(Math.max(finalTop, config.bounds.top), maxTop)

        // Apply styles
        target.style.left = `${finalLeft}px`
        target.style.top = `${finalTop}px`
        target.style.width = `${width}px`
        target.style.height = `${height}px`
        target.style.transform = 'none'

        // Update cropDimensions after calculations
        if (config.isCropper) {
            config.cropDimensions = {left: finalLeft, top: finalTop, width, height}
        }

        // Sync overlay
        if (config?.isCropper) {
            config.element = target
            this.applyCropToOverlay(config)
        }

        // Update position state
        setPosition({left: finalLeft, top: finalTop})

        // Notify child
        if (childRef.current?.handleResize) {
            childRef.current.handleResize({left: finalLeft, top: finalTop, width, height})
        }
        this.#isResizing = false
    }, 16)

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
                resizeFromCenter: initialConfig.resizeFromCenter ?? false,
                centerRatio:            {x: 0.5, y: 0.5},
                previousCropDimensions: null, // Store previous dimensions for double-click toggle
                isMaximized:            false, // Track if cropzone is maximized
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
        if (config.resizeFromCenter) {
            config.centerRatio = {
                x: (left + widget.width / 2) / container.width,
                y: (top + widget.height / 2) / container.height,
            }
        }
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
            left:  0,
            top:   0,
            right: container.width,
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
            top:  target.top <= container.top,
            bottom: target.bottom >= container.bottom,
            left: target.left <= container.left,
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

        if (maximize) {
            // Maximize dimensions while respecting ratio and minCropSize
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
        }
        else {
            // Default behavior (non-maximized)
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
        }

        const left = Math.floor((paddedWidth - width) / 2) + padding
        const top = Math.floor((paddedHeight - height) / 2) + padding

        config.cropDimensions = {left, top, width, height}
        if (config.resizeFromCenter) {
            config.centerRatio = {x: 0.5, y: 0.5}
        }
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
     * - Preserve current position after drag
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
                // Skip if resizing to avoid interference
                if (this.#isResizing) {
                    pending = false
                    rafId = null
                    return
                }

                const oldBounds = {...config.bounds}
                const newBounds = this.refreshBounds(config, moveable)

                if (
                    newBounds.left === oldBounds.left &&
                    newBounds.top === oldBounds.top &&
                    newBounds.right === oldBounds.right &&
                    newBounds.bottom === oldBounds.bottom
                ) {
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
                    let width = config.cropDimensions?.width || parseInt(element.style.width || '0', 10)
                    let height = config.cropDimensions?.height || parseInt(element.style.height || '0', 10)

                    // Preserve current position, only clamp to new bounds
                    const maxLeft = Math.max(newBounds.left, newBounds.right - width)
                    const maxTop = Math.max(newBounds.top, newBounds.bottom - height)
                    left = Math.min(Math.max(left, newBounds.left), maxLeft)
                    top = Math.min(Math.max(top, newBounds.top), maxTop)

                    // Update centerRatio to reflect current position
                    const newContainer = config.container.getBoundingClientRect()
                    config.centerRatio = {
                        x: (left + width / 2) / newContainer.width,
                        y: (top + height / 2) / newContainer.height,
                    }

                    element.style.left = `${left}px`
                    element.style.top = `${top}px`
                    element.style.transform = 'none'
                    config.transform = undefined
                    config.position = {left, top}
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

    /**
     * Begin resize: apply resize styles and set resizing flag.
     * @param {Object} e - Moveable resizeStart event
     */
    onResizeStart = e => {
        this.#isResizing = true
        e.target.classList.add('resizing')
        const config = this.retrieveConfig(e.target)
        if (config.animationWhenResizing) {
            e.target.classList.add('resizing-animation')
        }
    }

    /**
     * During resize: update element styles and overlay.
     * @param {Object} e - Moveable resize event
     * @param {Object} refs - References containing widget and child
     * @param {Function} setPosition - Function to update position state
     */
    onResize = (e, refs, setPosition) => {
        this.#handleResize(e, refs.widget.current, setPosition, refs.child)
    }

    /**
     * End resize: clean up styles, update crop dimensions, and clear resizing flag.
     * @param {Object} e - Moveable resizeEnd event
     */
    onResizeEnd = e => {
        this.#isResizing = false
        e.target.classList.remove('resizing', 'resizing-animation')
        const config = this.retrieveConfig(e.target)
        if (config?.isCropper) {
            config.element = e.target
            const left = parseInt(e.target.style.left || '0', 10)
            const top = parseInt(e.target.style.top || '0', 10)
            const width = parseInt(e.target.style.width || '0', 10)
            const height = parseInt(e.target.style.height || '0', 10)
            config.cropDimensions = {left, top, width, height}
            this.applyCropToOverlay(config)
        }
    }

    /**
     * Handle double-click/tap on cropzone: toggle between maximized size (respecting ratio and centered) and previous
     * size.
     * @param {Object} e - Moveable doubleClick event
     * @param {Function} setPosition - Function to update position state
     */
    onDoubleClick = (e, setPosition) => {
        const config = this.retrieveConfig(e.target)
        if (!config?.isCropper || !e.isDouble) {
            return
        }

        if (config.isMaximized) {
            // Restore previous dimensions
            if (config.previousCropDimensions) {
                config.cropDimensions = {...config.previousCropDimensions}
                config.previousCropDimensions = null
                config.isMaximized = false
            }
        }
        else {
            // Store current dimensions before maximizing
            config.previousCropDimensions = {...config.cropDimensions}
            // Maximize crop dimensions
            this.cropDimensions(config, true)
            config.isMaximized = true
        }

        // Apply new dimensions and position
        const {left, top, width, height} = config.cropDimensions
        e.target.style.left = `${left}px`
        e.target.style.top = `${top}px`
        e.target.style.width = `${width}px`
        e.target.style.height = `${height}px`
        e.target.style.transform = 'none'
        config.transform = undefined
        config.position = {left, top}

        // Update centerRatio for centering
        const container = config.container.getBoundingClientRect()
        config.centerRatio = {
            x: (left + width / 2) / container.width,
            y: (top + height / 2) / container.height,
        }

        // Sync overlay
        this.applyCropToOverlay(config)

        // Update position state
        setPosition({left, top})

        // Update Moveable
        if (e.moveable) {
            e.moveable.updateRect()
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