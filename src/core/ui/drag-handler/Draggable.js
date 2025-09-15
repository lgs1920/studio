/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Draggable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-15
 * Last modified: 2025-09-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Draggable.js
 * Singleton for managing draggable elements calculations, bounds, snaps, and resize observation.
 * Reusable for multiple elements.
 */
export class Draggable {
    // Private static instance
    static #instance = null

    // Private map to store configs for multiple elements (key: element)
    #configs = new Map()

    constructor() {
        if (Draggable.#instance) {
            return Draggable.#instance
        }
        Draggable.#instance = this
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
     * Registers or gets config for an element
     * @param {HTMLElement} element - The draggable element
     * @param {Object} initialConfig - Initial configuration (e.g., container, isMobile)
     * @returns {Object} Config for the element
     */
    getConfig = (element, initialConfig) => {
        if (!this.#configs.has(element)) {
            this.#configs.set(element, {
                container:   initialConfig.container,
                isMobile:    initialConfig.isMobile,
                bounds:      {left: 0, top: 0, right: 0, bottom: 0},
                position:    {left: 0, top: 0},
                initialLeft: initialConfig.left, // Store initial left for reference
                initialTop:  initialConfig.top,   // Store initial top for reference
                snapPoints:  [],
                dimensions:  {width: 0, height: 0},
                observer:    null,
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
            console.warn('Missing container or element for position calculation')
            return {left: 0, top: 0}
        }

        const canvasRect = config.container.getBoundingClientRect()
        const toolbarRect = element.getBoundingClientRect()

        // Convert percentage string or number to pixel value
        const parsePosition = (value, maxDimension) => {
            if (typeof value === 'string' && value.endsWith('%')) {
                const percent = parseFloat(value)
                return (percent / 100) * maxDimension
            }
            return typeof value === 'number' ? value : 0
        }

        let newLeft, newTop
        if (isResize && config.position.left !== 0 && config.position.top !== 0) {
            // During resize, try to maintain relative position based on current position
            const relativeLeft = config.position.left / (config.bounds.right || canvasRect.width)
            const relativeTop = config.position.top / (config.bounds.bottom || canvasRect.height)
            newLeft = relativeLeft * canvasRect.width
            newTop = relativeTop * canvasRect.height
            console.log('Preserving relative position:', {relativeLeft, relativeTop})
        }
        else {
            // Initial positioning uses config.initialLeft and config.initialTop
            newLeft = parsePosition(config.initialLeft, canvasRect.width)
            newTop = parsePosition(config.initialTop, canvasRect.height)
        }

        // Ensure the position stays within container bounds
        newLeft = Math.min(Math.max(newLeft, config.bounds.left), config.bounds.right - toolbarRect.width)
        newTop = Math.min(Math.max(newTop, config.bounds.top), config.bounds.bottom - toolbarRect.height)

        // Update config with calculated position and dimensions
        config.position = {left: newLeft, top: newTop}
        config.dimensions = {width: toolbarRect.width, height: toolbarRect.height}

        console.log('Calculated position:', config.position, 'Container:', canvasRect, 'Toolbar:', toolbarRect, 'IsResize:', isResize)
        return config.position
    }

    /**
     * Updates bounds based on container, applying margin from --lgs-gutter-xs
     * @param {Object} config - Element config
     * @param {Object} moveable - Moveable instance
     * @returns {Object} Updated bounds
     */
    updateBounds = (config, moveable) => {
        if (!config.container) {
            console.warn('No container available for updating bounds')
            return config.bounds
        }

        const canvasRect = config.container.getBoundingClientRect()
        // Get --lgs-gutter-xs from CSS
        const gutter = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lgs-gutter-xs')) || 8
        console.log('Applying gutter margin:', gutter)

        config.bounds = {
            left:   gutter,
            top:    gutter,
            right:  canvasRect.width - gutter,
            bottom: canvasRect.height - gutter,
        }
        console.log('Updated bounds with margin:', config.bounds)
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
        if (!config.container) {
            console.warn('Cannot observe resize: container is not defined')
            return
        }

        if (config.observer) {
            console.log('Disconnecting existing ResizeObserver for container:', config.container)
            config.observer.disconnect()
        }

        const handleResize = this.throttle(() => {
            console.log('ResizeObserver triggered for container:', config.container)
            const newBounds = this.updateBounds(config, moveable)
            setBounds(newBounds)

            // Recalculate position to keep element within bounds
            const newPosition = this.calculateInitialPosition(config, element, true)
            setPosition(newPosition)
            console.log('Repositioning element to:', newPosition)

            // Force Moveable to update its control box
            if (moveable && moveable.current) {
                moveable.current.updateRect()
                console.log('Moveable rect updated after resize')
            }
        }, 100)

        config.observer = new ResizeObserver(handleResize)
        console.log('Attaching ResizeObserver to container:', config.container)
        config.observer.observe(config.container)
    }

    /**
     * Cleans up config and observer for an element
     * @param {HTMLElement} element - The draggable element
     */
    cleanup = (element) => {
        const config = this.#configs.get(element)
        if (config?.observer) {
            console.log('Disconnecting ResizeObserver for element:', element)
            config.observer.disconnect()
        }
        this.#configs.delete(element)
    }

    /**
     * Adds class 'dragging' on drag start and sets control box opacity
     * @param {Object} e - Event from onDragStart
     */
    startHandler = (e) => {
        e.target.classList.add('dragging')
        const controlBox = e.moveable.getControlBoxElement()
        if (controlBox) {
            controlBox.style.opacity = '1'
            console.log('Control box opacity set to 1 on drag start')
        }
    }

    /**
     * Removes class 'dragging' on drag end and sets control box opacity
     * @param {Object} e - Event from onDragEnd
     */
    stopHandler = (e) => {
        e.target.classList.remove('dragging')
        const controlBox = e.moveable.getControlBoxElement()
        if (controlBox) {
            controlBox.style.opacity = '1'
            console.log('Control box opacity set to 1 on drag end')
        }
    }
}