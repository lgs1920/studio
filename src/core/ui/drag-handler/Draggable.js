/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Draggable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-19
 * Last modified: 2025-09-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { SECOND } from '@Core/constants'

/**
 * Draggable.js
 * Singleton for managing draggable elements calculations, bounds, snaps, and resize observation.
 * Reusable for multiple elements.
 */
export class Draggable {
    // Private static instance
    static instance = null

    // Delay for hiding control box (5 seconds)
    HIDE_DELAY = 5 * SECOND

    // Private map to store configs for elements
    #configs = new Map()

    // Valid position values
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    constructor() {
        if (Draggable.instance) {
            return Draggable.instance
        }
        Draggable.instance = this
    }

    /**
     * Throttle function to limit the rate of function calls
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
     * Sets up a timer to hide the control box after a delay
     * @param {Object} moveable - Moveable instance
     * @param {Object} config - Element config
     * @param {Function} setControlBoxProps - Function to update control box props
     * @param {Object} controlBoxTimer - Timer for hiding control box
     * @returns {number} Timer ID
     */
    #setupControlBoxTimer = (moveable, config, setControlBoxProps, controlBoxTimer) => {
        const controlBox = moveable.current.getControlBoxElement()
        controlBox.style.opacity = '1'
        const timer = setTimeout(() => {
            controlBox.style.opacity = '0'
            setControlBoxProps({
                                   renderDirections: [],
                                   zoom:             0,
                               })
        }, this.HIDE_DELAY)
        return timer
    }

    /**
     * Initializes a draggable element with position, bounds, and resize observer
     * @param {HTMLElement} element - The draggable element
     * @param {Object} initialConfig - Initial configuration (e.g., container, left, top, position)
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
     * Updates element position and Moveable rect
     * @param {HTMLElement} element - The draggable element
     * @param {Object} position - New position { left, top }
     * @param {Object} moveable - Moveable instance
     * @param {boolean} isDragging - Whether the element is currently being dragged
     * @param {Function} setControlBoxProps - Function to update control box props in component state
     */
    updatePosition = (element, position, moveable, isDragging, setControlBoxProps) => {
        const config = this.#configs.get(element)
        if (!config) {
            return
        }
        element.style.left = `${position.left}px`
        element.style.top = `${position.top}px`
        config.position = {left: position.left, top: position.top}
        moveable.current.updateRect()
        if (config.showControlBox && !isDragging) {
            const timer = this.#setupControlBoxTimer(moveable, config, setControlBoxProps, null)
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom:             1,
                               })
        }
    }

    /**
     * Handles control box visibility during drag events
     * @param {Object} moveable - Moveable instance
     * @param {Function} setControlBoxProps - Function to update control box props
     * @param {Object} controlBoxTimer - Timer for hiding control box
     * @param {boolean} show - Whether to show or hide the control box
     */
    handleControlBoxVisibility = (moveable, setControlBoxProps, controlBoxTimer, show) => {
        const config = this.#configs.get(moveable.current.target)
        if (!config) {
            return
        }
        if (!config.showControlBox) {
            show = false
        }
        const controlBox = moveable.current.getControlBoxElement()
        clearTimeout(controlBoxTimer.current)
        if (show) {
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom:             1,
                               })
            controlBox.style.opacity = '1'
        }
        else {
            controlBoxTimer.current = this.#setupControlBoxTimer(moveable, config, setControlBoxProps, controlBoxTimer)
        }
    }

    /**
     * Registers or gets config for an element
     * @param {HTMLElement} element - The draggable element
     * @param {Object} initialConfig - Initial configuration (e.g., container, left, top, position)
     * @returns {Object} Config for the element
     */
    getConfig = (element, initialConfig) => {
        if (!this.#configs.has(element)) {
            const anchor =
                      (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo))
                      ? initialConfig.attachTo
                      : (initialConfig.position && this.#validPositions.includes(initialConfig.position))
                        ? initialConfig.position
                        : 'top-left'
            this.#configs.set(element, {
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
            })
        }
        return this.#configs.get(element)
    }

    /**
     * Calculates position based on percentages or pixels, preserving relative position
     * @param {Object} config - Element config
     * @param {HTMLElement} element - The draggable element
     * @param {boolean} isResize - Whether the calculation is triggered by a resize
     * @returns {Object} { left, top }
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
     * Updates bounds based on container, applying margin from containerPadding
     * @param {Object} config - Element config
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
     * Observes container resize, updates bounds, and repositions element
     * @param {Object} config - Element config
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
     * Cleans up config and observer for an element
     * @param {HTMLElement} element - The draggable element
     */
    cleanup = (element) => {
        const config = this.#configs.get(element)
        if (!config) {
            return
        }
        if (config.observer) {
            config.observer.disconnect()
        }
        this.#configs.delete(element)
    }

    /**
     * Adds class 'dragging' on drag start
     * @param {Object} e - Event from onDragStart
     */
    startHandler = e => {
        e.target.classList.add('dragging')
    }

    /**
     * Removes class 'dragging' on drag end
     * @param {Object} e - Event from onDragEnd
     */
    stopHandler = e => {
        e.target.classList.remove('dragging')
    }
}