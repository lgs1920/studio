/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Draggable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-22
 * Last modified: 2025-09-22
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
    HIDE_DELAY = 3000 * SECOND

    // Attribute name used to identify draggable elements
    #ID = 'data-LGS-ID'

    // Private map to store configurations for elements, keyed by data-LGS-ID
    #configs = new Map()

    // Valid anchor positions for element placement
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    // Tracks whether an element is currently being dragged
    #isDragging = false

    // Map to store control box timers for each element
    #controlBoxTimers = new Map()

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
        return element.getAttribute(this.#ID)
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
        if (!config.current) {
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
        let elementId = element.getAttribute(this.#ID)
        if (!elementId) {
            elementId = uuidv4()
            element.setAttribute(this.#ID, elementId)
        }
        moveable.current.target = element

        // save initial controlBoxVisibility
        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        const config = this.getConfig(element, initialConfig)
        const newBounds = this.updateBounds(config, moveable)
        setBounds(newBounds)
        const newPosition = this.calculateInitialPosition(config, element, false)
        this.updatePosition(element, newPosition, moveable, false, setPosition)
        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '0 0' // Ensure left/top refer to the top-left corner
        this.observeResize(config, setBounds, moveable, element, setPosition)
        return true
    }

    /**
     * Updates element position and Moveable rectangle
     * @param {HTMLElement} element - The draggable element
     * @param {Object} position - New position with left and top coordinates
     * @param {Object} moveable - Moveable instance
     * @param {boolean} isDragging - Whether the element is currently being dragged
     * @param {Function} setControlBoxProps - Function to update control box properties in component state
     */
    updatePosition = (element, position, moveable, isDragging, setControlBoxProps) => {
        const config = this.#configs.get(this.getId(element))
        if (!config) {
            return
        }
        if (typeof position === 'string') {
            // We assume a CSS transform
            element.style.transform = position
        }
        else if (typeof position === 'object') {
            // Else it is an Object {left,top}
            element.style.left = `${position.left}px`
            element.style.top = `${position.top}px`
        }
        config.position = position
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
        console.log(config.showControlBox)
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
            this.#configs.forEach((cfg, id) => {
                cfg.current = (id === elementId)
            })
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
                current: false, // Initialize as not current
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

        const canvasRect = config.container.getBoundingClientRect()
        const toolbarRect = element.getBoundingClientRect()

        // Check for unrendered element
        if (toolbarRect.width === 0 || toolbarRect.height === 0) {
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

        let newLeft = parsePosition(config.left, canvasRect.width)
        let newTop = parsePosition(config.top, canvasRect.height)

        // Adjust position based on attachTo using a map for scalability
        const attachTo = config.attachTo || 'top-left'
        const adjustments = {
            center:         () => ({
                left: newLeft - toolbarRect.width / 2,
                top:  newTop - toolbarRect.height / 2,
            }),
            top:            () => ({
                left: newLeft - toolbarRect.width / 2,
                top:  newTop,
            }),
            left:           () => ({
                left: newLeft,
                top:  newTop - toolbarRect.height / 2,
            }),
            right:          () => ({
                left: newLeft - toolbarRect.width,
                top:  newTop - toolbarRect.height / 2,
            }),
            bottom:         () => ({
                left: newLeft - toolbarRect.width / 2,
                top:  newTop - toolbarRect.height,
            }),
            'top-left':     () => ({
                left: newLeft,
                top:  newTop,
            }),
            'top-right':    () => ({
                left: newLeft - toolbarRect.width,
                top:  newTop,
            }),
            'bottom-left':  () => ({
                left: newLeft,
                top:  newTop - toolbarRect.height,
            }),
            'bottom-right': () => ({
                left: newLeft - toolbarRect.width,
                top:  newTop - toolbarRect.height,
            }),
        }

        if (isResize && config.position.left !== 0 && config.position.top !== 0) {
            // Preserve relative position on resize
            const relativeLeft = config.position.left / config.bounds.right
            const relativeTop = config.position.top / config.bounds.bottom
            newLeft = relativeLeft * canvasRect.width
            newTop = relativeTop * canvasRect.height
        }
        else {
            // Apply anchor adjustment
            const adjust = adjustments[attachTo]
            if (adjust) {
                const adjusted = adjust()
                newLeft = adjusted.left
                newTop = adjusted.top
            }
        }

        // Ensure left and top are within bounds
        newLeft = Math.min(Math.max(newLeft, config.bounds.left), config.bounds.right - toolbarRect.width)
        newTop = Math.min(Math.max(newTop, config.bounds.top), config.bounds.bottom - toolbarRect.height)

        config.position = {left: newLeft, top: newTop}
        config.dimensions = {width: toolbarRect.width, height: toolbarRect.height}

        return config.position
    }

    /**
     * Updates bounds based on container dimensions, applying margin from containerPadding
     * @param {Object} config - Element configuration
     * @param {Object} moveable - Moveable instance
     * @returns {Object} Updated bounds
     */
    updateBounds = (config, moveable) => {
        const canvasRect = config.container.getBoundingClientRect()
        config.bounds = {
            left:   config.containerPadding,
            top:    config.containerPadding,
            right:  canvasRect.width - config.containerPadding,
            bottom: canvasRect.height - config.containerPadding,
        }
        return config.bounds
    }

    /**
     * Observes container resize and updates bounds and element position
     * @param {Object} config - Element configuration
     * @param {Function} setBounds - Function to update bounds in component state
     * @param {Object} moveable - Moveable instance
     * @param {HTMLElement} element - The draggable element
     * @param {Function} setPosition - Function to update position in component state
     */
    observeResize = (config, setBounds, moveable, element, setPosition) => {
        if (config.observer) {
            config.observer.disconnect()
        }

        const handleResize = this.throttle(() => {
            const newBounds = this.updateBounds(config, moveable)
            setBounds(newBounds)
            const newPosition = this.calculateInitialPosition(config, element, true)
            setPosition(newPosition)
            moveable.current.updateRect()
        }, 100)

        config.observer = new ResizeObserver(handleResize)
        config.observer.observe(config.container)
    }

    /**
     * Cleans up configuration and observer for an element
     * @param {HTMLElement} element - The draggable element
     */
    cleanup = element => {
        const elementId = element.getAttribute(this.#ID)
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
        this.#isDragging = true
        const elementId = this.getId(e.target)
        this.#configs.forEach((cfg, id) => {
            cfg.current = (id === elementId)
        })
    }

    /**
     * Removes 'dragging' class from the element and clears dragging state on drag end
     * @param {Object} e - Drag end event from Moveable
     */
    dragStopHandler = e => {
        e.target.classList.remove('dragging')
        this.#isDragging = false
    }
}