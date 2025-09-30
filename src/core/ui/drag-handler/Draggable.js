/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Draggable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-30
 * Last modified: 2025-09-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SECOND }       from '@Core/constants'
import { v4 as uuidv4 } from 'uuid'

/**
 * Singleton class for managing draggable elements' calculations, bounds, snapping, and resize observation.
 * Reusable for multiple elements with unique identifiers.
 */
export class Draggable {
    // Private static instance for singleton pattern
    static instance = null

    // Delay for hiding control box (3 seconds)
    HIDE_DELAY = 2 * SECOND

    // Attribute name used to identify draggable elements
    #ID_KEY = 'data-LGS-ID'

    // Private map to store configurations for elements, keyed by data-LGS-ID
    #configs = new Map()

    // Valid anchor positions for element placement
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    // Tracks whether an element is currently being dragged
    #isDragging = false

    // Map to store control box timers for each element
    #controlBoxTimers = new Map()

    #current = null

    /**
     * Creates or returns the singleton instance
     */
    constructor() {
        if (Draggable.instance) {
            return Draggable.instance
        }
        Draggable.instance = this
    }

    /**
     * Retrieves the ID of an element from its data-LGS-ID attribute
     * @param {HTMLElement} element - The draggable element
     * @returns {string|null} The element's ID or null if not found
     */
    getId = element => {
        return element.getAttribute(this.#ID_KEY)
    }

    /**
     * Throttles a function to limit its execution rate
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    throttle = (func, limit) => {
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
     * Sets up a timer to hide the control box after a delay, unless the element is being dragged or mouse is over
     * @param {Object} moveable - Moveable instance
     * @param {Object} config - Element configuration
     * @param {Function} setControlBoxProps - Function to update control box properties
     * @param {boolean} isMouseOver - Whether the mouse is over the element or its control box
     * @returns {number|undefined} Timer ID or undefined if element is being dragged or mouse is over
     * @private
     */
    #hideControlBoxWithTimer = (moveable, config, setControlBoxProps, isMouseOver) => {
        if (this.#isDragging || !config.showControlBox || isMouseOver) {
            // Do not hide if dragging, control box is disabled, or mouse is over
            return
        }
        // If element is not current, hide control box immediately
        if (this.#current !== config.id) {
            setControlBoxProps({
                                   renderDirections: [],
                                   zoom:             0,
                                   opacity:          0,
                               })
            return
        }
        // Otherwise, hide after delay for current element
        return setTimeout(() => {
            setControlBoxProps({
                                   renderDirections: [],
                                   zoom:    0,
                                   opacity: 0,
                               })
            const elementId = this.getId(moveable.current.target)
            this.#controlBoxTimers.delete(elementId)
        }, this.HIDE_DELAY)
    }

    /**
     * Initializes a draggable element with position, bounds, and resize observer
     * @param {HTMLElement} element - The draggable element
     * @param {Object} initialConfig - Initial configuration (container, left, top, attachTo, etc.)
     * @param {Function} setBounds - Function to update bounds in component state
     * @param {Function} setPosition - Function to update position in component state
     * @param {Object} moveable - Moveable instance
     * @returns {boolean} Whether initialization was successful
     */
    initialize = (element, initialConfig, setBounds, setPosition, moveable) => {
        if (!element || !initialConfig?.container) {
            return false
        }

        // Check if element is rendered (has valid dimensions)
        const elementRect = element.getBoundingClientRect()
        if (elementRect.width === 0 || elementRect.height === 0) {
            return false
        }

        // Generate or retrieve ID from data-LGS-ID
        let elementId = element.getAttribute(this.#ID_KEY)
        if (!elementId) {
            elementId = uuidv4()
            element.setAttribute(this.#ID_KEY, elementId)
        }
        moveable.current.target = element

        moveable.current.onRender = e => {
            e.target.style.opacity = lgs.settings.ui.toolbars.opacity
        }

        // Save initial controlBoxVisibility
        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        const config = this.getConfig(element, initialConfig)
        const newBounds = this.updateBounds(config, moveable)
        setBounds(newBounds)
        const newPosition = this.calculateInitialPosition(config, element, false)
        this.updatePosition(element, newPosition, moveable, false, setPosition)
        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '0 0' // Ensure left/top refer to the top-left corner
        this.observeContainerResize(config, setBounds, moveable, element, setPosition)

        if (!config.overlay) {
            this.#createOverlay(element)
        }
        return true
    }

    /**
     * Updates element position and Moveable rectangle
     * @param {HTMLElement} element - The draggable element
     * @param {Object|string} position - New position with left and top coordinates or CSS transform
     * @param {Object} moveable - Moveable instance
     * @param {boolean} isDragging - Whether the element is currently being dragged
     * @param {Function} setControlBoxProps - Function to update control box properties in component state
     */
    updatePosition = (element, position, moveable, isDragging, setControlBoxProps) => {
        const config = this.#configs.get(this.getId(element))
        if (!config) {
            return
        }

        // During drag we receive a CSS transform rule from Moveable
        if (typeof position === 'string') {
            element.style.transform = position
            config.transform = position
        }
        // During initialisation we receive an Object {left,top}
        else if (typeof position === 'object') {
            element.style.left = `${position.left}px`
            element.style.top = `${position.top}px`
            config.position = position
        }

        moveable.current.updateRect()

        if (config.showControlBox && isDragging) {
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom:    1,
                                   opacity: 1,
                               })
        }
    }

    /**
     * Manages control box visibility during drag or click events
     * @param {Object} moveable - Moveable instance
     * @param {Function} setControlBoxProps - Function to update control box properties
     * @param {Object} controlBoxTimer - Timer reference for hiding control box
     * @param {boolean} show - Whether to show or hide the control box
     * @param {boolean} isMouseOver - Whether the mouse is over the element or its control box
     */
    handleControlBoxVisibility = (moveable, setControlBoxProps, controlBoxTimer, show, isMouseOver) => {
        const elementId = this.getId(moveable.current.target)
        const config = this.#configs.get(elementId)
        if (!config || !config.showControlBox) {
            // Immediately hide control box if config is missing or showControlBox is false
            setControlBoxProps({
                                   renderDirections: [],
                                   zoom:             0,
                                   opacity:          0,
                               })
            clearTimeout(controlBoxTimer.current)
            this.#controlBoxTimers.delete(elementId)
            return
        }

        // Clear any existing timer for this element
        clearTimeout(controlBoxTimer.current)
        this.#controlBoxTimers.delete(elementId)

        // If show is true (click or drag start), mark this element as current and others as non-current
        if (show) {
            this.#current = elementId
        }

        if (show) {
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom:    1,
                                   opacity: 1,
                               })
        }
        else {
            // Schedule control box to hide (immediately if not current, after delay if current and not mouse over)
            controlBoxTimer.current = this.#hideControlBoxWithTimer(moveable, config, setControlBoxProps, isMouseOver)
            if (controlBoxTimer.current) {
                this.#controlBoxTimers.set(elementId, controlBoxTimer.current)
            }
        }
    }

    /**
     * Registers or retrieves configuration for an element using its data-LGS-ID
     * @param {HTMLElement} element - The draggable element
     * @param {Object} initialConfig - Initial configuration (container, left, top, attachTo, etc.)
     * @returns {Object} Configuration for the element
     */
    getConfig = (element, initialConfig = {}) => {
        const elementId = this.getId(element)
        if (!this.#configs.has(elementId)) {
            const anchor =
                      (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo))
                      ? initialConfig.attachTo
                      : (initialConfig.position && this.#validPositions.includes(initialConfig.position))
                        ? initialConfig.position
                        : 'top-left'
            this.#configs.set(elementId, {
                id:          elementId,
                boundStatus: {left: false, top: false, right: false, bottom: false},
                container:        initialConfig.container,
                isMobile:         initialConfig.isMobile,
                bounds:           {left: 0, top: 0, right: 0, bottom: 0},
                position:         {left: 0, top: 0},
                left:             initialConfig.left,
                top:              initialConfig.top,
                attachTo:         anchor,
                snapPoints:       [],
                dimensions:       {width: 0, height: 0},
                observer:         null,
                showControlBox:   initialConfig.showControlBox,
                containerPadding: initialConfig.containerPadding,
                animationWhenDragging: initialConfig.animationWhenDragging ?? false,
            })
        }
        return this.#configs.get(elementId)
    }

    /**
     * Calculates initial position based on percentages or pixels, preserving relative position
     * @param {Object} config - Element configuration
     * @param {HTMLElement} element - The draggable element
     * @param {boolean} isResize - Whether the calculation is triggered by a resize
     * @returns {Object} Calculated position with left and top coordinates
     */
    calculateInitialPosition = (config, element, isResize = false) => {
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
                top:  top - widget.height / 2,
            }),
            top:            () => ({
                left: left - widget.width / 2,
                top:  top,
            }),
            left:           () => ({
                left: left,
                top:  top - widget.height / 2,
            }),
            right:          () => ({
                left: left - widget.width,
                top:  top - widget.height / 2,
            }),
            bottom:         () => ({
                left: left - widget.width / 2,
                top:  top - widget.height,
            }),
            'top-left':     () => ({
                left: left,
                top:  top,
            }),
            'top-right':    () => ({
                left: left - widget.width,
                top:  top,
            }),
            'bottom-left':  () => ({
                left: left,
                top:  top - widget.height,
            }),
            'bottom-right': () => ({
                left: left - widget.width,
                top:  top - widget.height,
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
     * Updates bounds based on container dimensions, applying margin from containerPadding
     * @param {Object} config - Element configuration
     * @param {Object} moveable - Moveable instance
     * @returns {Object} Updated bounds
     */
    updateBounds = (config, moveable) => {
        const container = config.container.getBoundingClientRect()
        config.bounds = {
            left:   config.containerPadding,
            top:    config.containerPadding,
            right:  container.width - config.containerPadding,
            bottom: container.height - config.containerPadding,
        }
        return config.bounds
    }

    updateBoundStatus = (element, config) => {
        const container = config.container.getBoundingClientRect()
        const target = element.getBoundingClientRect()

        config.boundStatus = {
            top:    target.top <= container.top,
            bottom: target.bottom >= container.bottom,
            left:   target.left <= container.left,
            right:  target.right >= container.right,
        }
        return config.boundStatus
    }


    /**
     * Observes container resize and updates bounds and element position
     * @param {Object} config - Element configuration
     * @param {Function} setBounds - Function to update bounds in component state
     * @param {Object} moveable - Moveable instance
     * @param {HTMLElement} element - The draggable element
     * @param {Function} setPosition - Function to update position in component state
     */
    observeContainerResize = (config, setBounds, moveable, element, setPosition) => {
        if (config.observer) {
            return
        }

        /**
         * Handles container resize events, updating bounds and element position
         * Elements bound to right or bottom edges only adjust position on container shrink
         * @private
         */
        const handleResize = (() => {
            let rafId = null
            let pending = false
            let lastComputed = {
                right:      null,
                bottom:     null,
                translateX: null,
                translateY: null,
            }

            const computeAndApply = () => {
                // Store previous bounds for delta calculations
                const oldBounds = {...config.bounds}

                // Update bounds based on new container dimensions
                const newBounds = this.updateBounds(config, moveable)
                // Avoid React/state churn if bounds are identical
                if (
                    newBounds.left === oldBounds.left &&
                    newBounds.top === oldBounds.top &&
                    newBounds.right === oldBounds.right &&
                    newBounds.bottom === oldBounds.bottom
                ) {
                    // Nothing changed; still ensure pending is cleared
                    pending = false
                    rafId = null
                    return
                }
                setBounds(newBounds)

                // Update bound status
                this.updateBoundStatus(element, config)

                // Calculate deltas for right and bottom boundaries
                const deltaRight = newBounds.right - oldBounds.right
                const deltaBottom = newBounds.bottom - oldBounds.bottom

                // Only adjust position when container shrinks and element is bound to right or bottom
                const isShrinking = deltaRight < 0 || deltaBottom < 0

                if (config.transform) {
                    const match = config.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
                    if (match) {
                        // Extract current translate values
                        const translateX = parseFloat(match[1])
                        const translateY = parseFloat(match[2])

                        // Initialize new translation values
                        let newTranslateX = translateX
                        let newTranslateY = translateY

                        // Adjust position only if container is shrinking and element is bound
                        if (isShrinking) {
                            if (config.boundStatus.right) {
                                newTranslateX = translateX + deltaRight
                            }
                            if (config.boundStatus.bottom) {
                                newTranslateY = translateY + deltaBottom
                            }
                        }
                        else {
                            // On both sides, we reset the bound status if needed
                            if (deltaRight > 0) {
                                config.boundStatus.right = false
                            }
                            if (deltaBottom > 0) {
                                config.boundStatus.bottom = false
                            }
                        }

                        // Skip DOM write if nothing actually changed
                        if (newTranslateX !== translateX || newTranslateY !== translateY) {
                            // Avoid redundant style writes (compare to last committed)
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
                }

                // Update Moveable's rectangle only if right/bottom bounds changed vs last
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
     * Cleans up configuration and observer for an element
     * @param {HTMLElement} element - The draggable element
     */
    cleanup = element => {
        const elementId = element.getAttribute(this.#ID_KEY)
        const config = this.#configs.get(elementId)
        if (!config) {
            return
        }
        if (config.observer) {
            config.observer.disconnect()
        }
        this.#configs.delete(elementId)
        const timer = this.#controlBoxTimers.get(elementId)
        if (timer) {
            clearTimeout(timer)
            this.#controlBoxTimers.delete(elementId)
        }
    }

    /**
     * Adds 'dragging' class to the element and sets dragging state on drag start
     * @param {Object} e - Drag start event from Moveable
     */
    dragStartHandler = e => {
        e.target.classList.add('dragging')
        const config = this.getConfig(e.target)
        if (config.animationWhenDragging) {
            e.target.classList.add('dragging-animation')
        }
        this.#isDragging = true
        const elementId = this.getId(e.target)
        this.#current = elementId
    }

    /**
     * Removes 'dragging' class from the element and clears dragging state on drag end
     * @param {Object} e - Drag end event from Moveable
     */
    dragStopHandler = e => {
        e.target.classList.remove('dragging', 'dragging-animation')
        this.#isDragging = false
    }

    /**
     * Retrieves the top, left, width, and height of a given HTML element or window
     * @private
     * @param {HTMLElement | Window} element - The HTML element or window to measure
     * @returns {{ top: number, left: number, width: number, height: number }}
     */
    #computeElementBounds = element => {
        if (element === window) {
            return {
                top:    0,
                left:   0,
                width:  window.innerWidth,
                height: window.innerHeight,
            }
        }
        const rect = element.getBoundingClientRect()
        return {
            top:    rect.top,
            left:   rect.left,
            width:  rect.width,
            height: rect.height,
        }
    }

    /**
     * Creates a transparent overlay that covers element and adds it to the config.
     * We need it to manage event propagation and for cursor management.
     * @private
     * @param {HTMLElement | Window} element - The HTML element
     */
    #createOverlay = element => {
        const overlay = document.createElement('div')
        const elementId = element.getAttribute(this.#ID_KEY)
        const config = this.#configs.get(elementId)
        config.overlay = overlay
        const targetRect = this.#computeElementBounds(element)
        Object.assign(overlay.style, {
            width:  `${targetRect.width}px`,
            height: `${targetRect.height}px`,
        })
        overlay.classList.add('lgs-widget-overlay')
        element.appendChild(overlay)
    }

    /**
     * Returns the overlay child
     * @param {HTMLElement | Window} element - The HTML element
     * @returns {HTMLElement} The overlay element
     */
    getOverlay = element => {
        const elementId = element.getAttribute(this.#ID_KEY)
        const config = this.#configs.get(elementId)
        return config.overlay
    }

    /**
     * Updates the bound status of the current element
     * @param {Object} boundStatus - Object containing bound status (left, top, right, bottom)
     */
    handleBound = boundStatus => {
        const config = this.#configs.get(this.#current)
        if (!config) {
            return
        }
        config.boundStatus = boundStatus
    }
}