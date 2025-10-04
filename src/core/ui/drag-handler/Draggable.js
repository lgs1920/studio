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
 * Singleton class for managing draggable elements' calculations, bounds, snapping, and resize observation.
 * Reusable for multiple elements with unique identifiers.
 * @class
 */
export class Draggable {
    // Private static instance for singleton pattern
    static instance = null

    // Delay for hiding control box (3 seconds)
    HIDE_DELAY = 2 * SECOND

    // Attribute name used to identify draggable elements
    #ID_KEY = 'data-LGS-ID'

    // Private map to store configurations for elements, keyed by data-LGS-ID
    #widgets

    // Valid anchor positions for element placement
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    // Tracks whether an element is currently being dragged
    #isDragging = false

    // Map to store control box timers for each element
    #controlBoxTimers = new Map()

    // Current element being interacted with
    #current = null

    // Scale factor for cropper dimensions
    #CROP_SCALE_FACTOR = 1

    // Minimum crop size
    #MIN_CROP_SIZE = {width: 0, height: 0}

    /**
     * Creates or returns the singleton instance of Draggable.
     * @constructor
     * @param {Object} store - Valtio store (proxyMap)
     * @returns {Draggable} The singleton instance
     */
    constructor(store) {
        if (Draggable.instance) {
            return Draggable.instance
        }
        this.#widgets = new Map()
        Draggable.instance = this
    }

    /**
     * Retrieves the ID of an element from its data-LGS-ID attribute.
     * @param {HTMLElement} element - The draggable element
     * @returns {string|null} The element's ID or null if not found
     */
    retrieveElementId = element => {
        return element.getAttribute(this.#ID_KEY)
    }

    /**
     * Restricts the execution rate of a function to prevent excessive calls.
     * @param {Function} func - The function to restrict
     * @param {number} limit - The time limit in milliseconds
     * @returns {Function} The rate-restricted function
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
     * Sets up a timer to hide the control box after a delay, unless the element is being dragged or the mouse is over
     * it.
     * @private
     * @param {Object} moveable - The Moveable instance
     * @param {Object} config - The element's configuration
     * @param {Function} setControlBoxProps - Function to update control box properties
     * @param {boolean} isMouseOver - Whether the mouse is over the element or its control box
     * @returns {number|undefined} Timer ID or undefined if no timer is set
     */
    #hideControlBoxWithTimer = (moveable, config, setControlBoxProps, isMouseOver) => {
        // Prevent hiding if dragging, control box is disabled, or mouse is over
        if (this.#isDragging || !config.showControlBox || isMouseOver) {
            return
        }
        // Hide immediately if the element is not the current one
        if (this.#current !== config.id) {
            setControlBoxProps({
                                   renderDirections: [],
                                   zoom:    0,
                                   opacity: 0,
                               })
            return
        }
        // Schedule hiding after delay for the current element
        return setTimeout(() => {
            setControlBoxProps({
                                   renderDirections: [],
                                   zoom: 0,
                                   opacity: 0,
                               })
            const elementId = this.retrieveElementId(moveable.current.target)
            this.#controlBoxTimers.delete(elementId)
        }, this.HIDE_DELAY)
    }

    /**
     * Sets up a draggable element with position, bounds, and resize observer.
     * @param {HTMLElement} element - The draggable element
     * @param {Object} initialConfig - Initial configuration (container, left, top, attachTo, etc.)
     * @param {Function} setBounds - Function to update bounds in component state
     * @param {Function} setPosition - Function to update position in component state
     * @param {Object} moveable - Moveable instance
     * @returns {boolean} Whether setup was successful
     */
    setupElement = (element, initialConfig, setBounds, setPosition, moveable) => {
        // Validate required inputs
        if (!element || !initialConfig?.container || !moveable.current) {
            return false
        }

        // Keep element reference
        initialConfig.element = element

        // Assign a unique ID to the element if it doesn't have one
        let elementId = this.retrieveElementId(element)
        if (!elementId) {
            elementId = uuidv4()

            // Keep reference to the DOM element for later exact reads
            initialConfig.element = element
            element.setAttribute(this.#ID_KEY, elementId)
        }
        moveable.current.target = element

        // const setPosition = event => {
        //     const position = {left: event.left, top: event.top, width: event.width, height: event.height}
        //     // clipPath handled by Draggable; only update info state here
        //     setInfo({...position})
        // }

        // Force opacity during rendering
        moveable.current.onRender = e => {
            e.target.style.opacity = initialConfig.opacity
        }

        // Store initial control box visibility
        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        // Create and adapt configuration for this element
        const config = this.retrieveConfig(element, initialConfig)
        this.applyCropToOverlay(config)

        // Update bounds and position
        const newBounds = this.refreshBounds(config, moveable)
        setBounds(newBounds)
        if (config.isCropper) {
            element.style.left = `${config.cropDimensions.left}px`
            element.style.top = `${config.cropDimensions.top}px`
            element.style.width = `${config.cropDimensions.width}px`
            element.style.height = `${config.cropDimensions.height}px`
            // Ensure overlay matches final styles
            this.applyCropToOverlay(config)
        }
        else {
            const newPosition = this.computeInitialPosition(config, element, false)
            this.applyPosition(element, newPosition, moveable, false, setPosition)
        }

        // Set initial styles
        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '0 0' // Ensure left/top refer to the top-left corner

        // Set up resize monitoring
        this.monitorContainerResize(config, setBounds, moveable, element, setPosition)

        // Create overlay if not present
        if (!config.overlay) {
            this.#createInnerOverlay(element)
        }
        return true
    }

    applyCropToOverlay = config => {
        if (!config?.isCropper) {
            return
        }
        // Prefer current element styles if available
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
     * Applies a new position to the element and updates the Moveable rectangle.
     * @param {HTMLElement} element - The draggable element
     * @param {Object|string} position - New position with left and top coordinates or CSS transform
     * @param {Object} moveable - Moveable instance
     * @param {boolean} isDragging - Whether the element is currently being dragged
     * @param {Function} setControlBoxProps - Function to update control box properties
     */
    applyPosition = (element, position, moveable, isDragging, setControlBoxProps) => {
        const config = this.getConfig(this.retrieveElementId(element))
        if (!config) {
            return
        }

        // Apply position as transform (during drag) or left/top (during initialization)
        if (typeof position === 'string') {
            element.style.transform = position
            config.transform = position
        }
        else if (typeof position === 'object') {
            element.style.left = `${position.left}px`
            element.style.top = `${position.top}px`
            config.position = position
        }

        // Update Moveable rectangle
        moveable.current.updateRect()

        // Show control box during drag if enabled
        if (config.showControlBox && isDragging) {
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom: 1,
                                   opacity: 1,
                               })
        }
    }

    /**
     * Manages the visibility of the control box during drag or click events.
     * @param {Object} moveable - Moveable instance
     * @param {Function} setControlBoxProps - Function to update control box properties
     * @param {Object} _controlBoxTimer - React useRef for the control box timer
     * @param {boolean} show - Whether to show or hide the control box
     * @param {boolean} isMouseOver - Whether the mouse is over the element or its control box
     */
    manageControlBox = (moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver) => {
        const elementId = this.retrieveElementId(moveable.current.target)
        const config = this.getConfig(elementId)
        if (!config || !config.showControlBox) {
            // Hide control box immediately if config is missing or disabled
            setControlBoxProps({
                                   renderDirections: [],
                                   zoom:    0,
                                   opacity: 0,
                               })
            clearTimeout(_controlBoxTimer.current)
            this.#controlBoxTimers.delete(elementId)
            return
        }

        // Clear existing timer
        clearTimeout(_controlBoxTimer.current)
        this.#controlBoxTimers.delete(elementId)

        // Mark as current element if showing
        if (show) {
            this.#current = elementId
        }

        if (show) {
            // Show control box
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom: 1,
                                   opacity: 1,
                               })
        }
        else {
            // Schedule hiding of control box
            _controlBoxTimer.current = this.#hideControlBoxWithTimer(moveable, config, setControlBoxProps, isMouseOver)
            if (_controlBoxTimer.current) {
                this.#controlBoxTimers.set(elementId, _controlBoxTimer.current)
            }
        }
    }

    /**
     * Retrieves or creates configuration for an element using its data-LGS-ID.
     * @param {HTMLElement} element - The draggable element
     * @param {Object} initialConfig - Initial configuration (container, left, top, attachTo, etc.)
     * @returns {Object} Configuration for the element
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
            })
        }
        return this.getConfig(elementId)
    }

    /**
     * Computes the initial position based on percentages or pixels, preserving relative position.
     * @param {Object} config - Element configuration
     * @param {HTMLElement} element - The draggable element
     * @param {boolean} isResize - Whether the calculation is triggered by a resize
     * @returns {Object} Calculated position with left and top coordinates
     */
    computeInitialPosition = (config, element, isResize = false) => {
        if (!config.container || !element) {
            return {left: 0, top: 0}
        }

        const container = config.container.getBoundingClientRect()
        const widget = element.getBoundingClientRect()

        // Check for unrendered element
        if (widget.width === 0 || widget.height === 0) {
            return {left: 0, top: 0}
        }

        // Convert percentage string or number to pixel value relative to container
        const parsePosition = (value, maxDimension) => {
            if (typeof value === 'string' && value.endsWith('%')) {
                const percent = parseFloat(value)
                if (isNaN(percent)) {
                    return 0
                }
                return (percent / 100) * maxDimension
            }
            const numValue = typeof value === 'number' ? value : parseFloat(value)
            if (isNaN(numValue)) {
                return 0
            }
            return numValue
        }

        let left = parsePosition(config.left, container.width)
        let top = parsePosition(config.top, container.height)

        // Adjust position based on attachTo using a map for scalability
        const attachTo = config.attachTo || 'top-left'
        const adjustments = {
            center:         () => ({
                left: left - widget.width / 2,
                top: top - widget.height / 2,
            }),
            top:            () => ({
                left: left - widget.width / 2,
                top: top,
            }),
            left:           () => ({
                left: left,
                top: top - widget.height / 2,
            }),
            right:          () => ({
                left: left - widget.width,
                top: top - widget.height / 2,
            }),
            bottom:         () => ({
                left: left - widget.width / 2,
                top: top - widget.height,
            }),
            'top-left':     () => ({
                left: left,
                top: top,
            }),
            'top-right':    () => ({
                left: left - widget.width,
                top: top,
            }),
            'bottom-left':  () => ({
                left: left,
                top: top - widget.height,
            }),
            'bottom-right': () => ({
                left: left - widget.width,
                top: top - widget.height,
            }),
        }

        // Apply anchor adjustment
        const adjust = adjustments[attachTo]
        if (adjust) {
            const adjusted = adjust()
            left = adjusted.left
            top = adjusted.top
        }

        // Ensure left and top are within bounds
        left = Math.min(Math.max(left, config.bounds.left), config.bounds.right - widget.width)
        top = Math.min(Math.max(top, config.bounds.top), config.bounds.bottom - widget.height)

        config.position = {left: left, top: top}
        config.dimensions = {width: widget.width, height: widget.height}

        return config.position
    }

    /**
     * Refreshes bounds based on container dimensions, applying margin from containerPadding.
     * @param {Object} config - Element configuration
     * @param {Object} moveable - Moveable instance
     * @returns {Object} Updated bounds
     */
    refreshBounds = (config, moveable) => {
        const container = config.container.getBoundingClientRect()
        config.bounds = {
            left:   0,//config.containerPadding,
            top:    0, //config.containerPadding,
            right:  container.width/*  - config.containerPadding */,
            bottom: container.height/*  - config.containerPadding */,
        }
        return config.bounds
    }

    /**
     * Updates the bound status of an element (whether it touches container edges).
     * @param {HTMLElement} element - The draggable element
     * @param {Object} config - Element configuration
     * @returns {Object} Updated bound status
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
     * Retrieves the aspect ratio configuration for a given ratio identifier.
     * @param {string} ratio - The ratio identifier (e.g., '16x9')
     * @returns {Object} The ratio configuration
     */
    getRatio = (ratio) => {
        return lgs.configuration.videoFormats.find(p => p.value === ratio)
    }

    /**
     * Computes the dimensions and position of the crop area based on the provided configuration.
     * Ensures the crop area respects the container bounds, scale factor, and optional aspect ratio.
     * @param {Object} config - Configuration object for cropping
     * @returns {Object} Crop dimensions and position { left, top, width, height }
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
     * Open a window in the cropper outside overlay using a clip-path.
     * @param {Object} crop - Crop dimensions { left, top, width, height }
     * @returns {Object} Style object with clipPath property
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
     * Monitors container resize events and updates bounds and element position.
     * @param {Object} config - Element configuration
     * @param {Function} setBounds - Function to update bounds in component state
     * @param {Object} moveable - Moveable instance
     * @param {HTMLElement} element - The draggable element
     * @param {Function} setPosition - Function to update position in component state
     */
    monitorContainerResize = (config, setBounds, moveable, element, setPosition) => {
        if (config.observer) {
            return
        }

        // Handle resize events with requestAnimationFrame to avoid excessive updates
        const handleResize = (() => {
            let rafId = null
            let pending = false
            let lastComputed = {
                right:  null,
                bottom: null,
                translateX: null,
                translateY: null,
            }

            const computeAndApply = () => {
                // Store previous bounds
                const oldBounds = {...config.bounds}

                // Update bounds
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

                // Update bound status
                this.setBoundStatus(element, config)

                // Calculate deltas for right and bottom
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

                        // Adjust position on shrink if bound to right/bottom
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

                        // Apply new transform if changed
                        if (newTranslateX !== translateX || newTranslateY !== translateY) {
                            if (
                                lastComputed.translateX !== newTranslateX ||
                                lastComputed.translateY !== newTranslateY
                            ) {
                                config.transform = `translate(${newTranslateX}px, ${newTranslateY}px)`
                                element.style.transform = config.transform
                                lastComputed.translateX = newTranslateX
                                lastComputed.translateY = newTranslateY
                            }
                        }
                    }


                    // If cropper, re-apply overlay to match current styles or recompute
                    if (config.isCropper) {
                        config.element = element
                        this.applyCropToOverlay(config)
                    }
                }

                // Update Moveable rectangle if bounds changed
                const rightChanged = lastComputed.right !== newBounds.right
                const bottomChanged = lastComputed.bottom !== newBounds.bottom
                if (rightChanged || bottomChanged) {
                    moveable.current.updateRect()
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

        // Initialize and start ResizeObserver
        config.observer = new ResizeObserver(handleResize)
        config.observer.observe(config.container)
    }

    /**
     * Disposes of configuration and observer for an element.
     * @param {HTMLElement} element - The draggable element
     */
    disposeElement = element => {
        const elementId = this.retrieveElementId(element)
        const config = this.getConfig(elementId)
        if (!config) {
            return
        }
        if (config.observer) {
            config.observer.disconnect()
        }
        this.#widgets.delete(elementId)
        const timer = this.#controlBoxTimers.get(elementId)
        if (timer) {
            clearTimeout(timer)
            this.#controlBoxTimers.delete(elementId)
        }
    }

    /**
     * Handles drag start by adding classes and setting dragging state.
     * @param {Object} e - Drag start event from Moveable
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

        // Ensure we reference the actual element for style reads during this drag session
        if (config?.isCropper) {
            config.element = e.target
        }
    }

    /**
     * Handles drag end by removing classes and clearing dragging state.
     * @param {Object} e - Drag end event from Moveable
     */
    onDragEnd = e => {
        e.target.classList.remove('dragging', 'dragging-animation')
        this.#isDragging = false

        // Persist final styles into config and re-sync overlay to avoid stale values next session
        const config = this.retrieveConfig(e.target)
        if (config?.isCropper) {
            // If we were dragging via transform, convert it to left/top before reading styles
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

            // Now read committed styles
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
     * Computes the bounds (top, left, width, height) of an element or window.
     * @private
     * @param {HTMLElement|Window} element - The element or window to measure
     * @returns {Object} Bounds { top, left, width, height }
     */
    #computeElementBounds = element => {
        if (element === window) {
            return {
                top:   0,
                left:  0,
                width: window.innerWidth,
                height: window.innerHeight,
            }
        }
        const rect = element.getBoundingClientRect()
        return {
            top:   rect.top,
            left:  rect.left,
            width: rect.width,
            height: rect.height,
        }
    }

    /**
     * Creates a transparent overlay for the element to manage event propagation and cursor.
     * @private
     * @param {HTMLElement} element - The draggable element
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
     * Retrieves the overlay element for a given draggable element.
     * @param {HTMLElement} element - The draggable element
     * @returns {HTMLElement} The overlay element
     */
    getInnerOverlay = element => {
        const elementId = this.retrieveElementId(element)
        const config = this.getConfig(elementId)
        return config.overlay
    }

    getConfig = (elementId) => {
        return this.#widgets.get(elementId)
    }

    setConfig = (elementId, config) => {
        this.#widgets.set(elementId, config)
    }

}