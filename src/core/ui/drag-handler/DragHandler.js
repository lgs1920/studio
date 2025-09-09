/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DragHandler.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-09
 * Last modified: 2025-09-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * A class to handle drag and resize interactions for a movable toolbar element
 * Provides functionality for dragging a toolbar within a container, managing cursor
 * behavior with an overlay, and suppressing clicks after a drag
 */
export class DragHandler {
    // Static constants for event types
    static BEFORE_DRAG = 'beforeDrag'
    static DRAG = 'drag'
    static DRAG_START = 'dragstart'
    static DRAG_STOP = 'dragstop'
    static AFTER_DRAG = 'afterDrag'

    /**
     * Creates a new DragHandler instance
     * @param {Object} options - Configuration options for the drag handler
     * @param {HTMLElement} [options.grabber] - Element that initiates the drag
     * @param {HTMLElement} [options.dragger] - Alias for grabber (optional)
     * @param {HTMLElement} options.target - Element to be moved
     * @param {HTMLElement|Window} [options.container=window] - Container for bounds
     * @param {string} [options.left="50%"] - Initial left position (e.g., "50%", "250px")
     * @param {string} [options.top="33%"] - Initial top position (e.g., "33%", "250px")
     */
    constructor({grabber, dragger, target, container = window, left = '50%', top = '33%'}) {
        const grabberElement = grabber || dragger || target
        if (!(grabberElement instanceof HTMLElement)) {
            throw new Error('grabber (or dragger or target) must be an HTMLElement')
        }
        if (!(target instanceof HTMLElement)) {
            throw new Error('target must be an HTMLElement')
        }
        if (container !== window && !(container instanceof HTMLElement)) {
            throw new Error('container must be window or an HTMLElement')
        }

        this.startLeft = left
        this.startTop = top

        this.grabber = grabberElement
        this.target = target
        this.container = container
        this.dragging = false
        this.startX = -1
        this.startY = -1
        this.startLeft = left
        this.startTop = top

        this.movementThreshold = 5 // Pixels to detect drag vs click
        this.hasMoved = false // Tracks if movement exceeded threshold
        this.wasDragging = false // Tracks if drag occurred for click suppression
        this.overlay = null // Overlay div for cursor during drag

        // Transform-aware mode: preserve existing transforms (e.g., translate(-50%,-50%))
        const computedTransform = getComputedStyle(this.target).transform
        this.useTransformMode = (this.target.style.transform && this.target.style.transform !== '') || (computedTransform && computedTransform !== 'none')
        this.baseTransform = this.target.style.transform || '' // inline base we keep/extend
        this.dragStartVisualX = 0
        this.dragStartVisualY = 0

        this.handleBefore = this.handleBefore.bind(this)
        this.handleStart = this.handleStart.bind(this)
        this.handleMove = this.handleMove.bind(this)
        this.handleEnd = this.handleEnd.bind(this)

        // Set initial cursor style
        this.grabber.style.cursor = 'grab'

        // Add draggable class to target
        this.target.classList.add('draggable')

        this.#ensureWithinBounds()
        this.isInitialPositionInvalid = false
        this.attachEvents()
    }

    /**
     * Retrieves the top, left, width, and height of a given HTML element or window.
     * If the element is window, returns { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }.
     * @param {HTMLElement | Window} element - The HTML element or window to measure.
     * @returns {{ top: number, left: number, width: number, height: number }} - The position and dimensions of the
     *     element or window.
     */
    #computeElementBounds = (element) => {
        // Check if the element is window
        if (element === window) {
            return {
                top:    0,
                left:   0,
                width:  window.innerWidth,
                height: window.innerHeight,
            }
        }

        // Get the bounding rectangle of the HTML element
        const rect = element.getBoundingClientRect()

        return {
            top:    rect.top,
            left:   rect.left,
            width:  rect.width,
            height: rect.height,
        }
    }

    /**
     * Gets the effective position of the element
     * @private
     * @returns {Object} Position with left and top properties
     */
    #getElementPosition() {
        const rect = this.target.getBoundingClientRect()
        const containerRect = this.container !== window ? this.container.getBoundingClientRect() : {
            left: 0,
            top: 0,
        }

        let left = rect.left - containerRect.left
        let top = rect.top - containerRect.top


        // Adjust for scroll position if container is not window
        if (this.container !== window) {
            left += this.container.scrollLeft
            top += this.container.scrollTop
        }

        return {left, top}
    }

    /**
     * Parses a position value and returns its pixel equivalent
     * Accepts numbers, 'xxpx', or 'yy%' strings
     * @private
     * @param {number|string} position - The position value to parse
     * @param {number} containerDimension - The reference dimension for percentage values
     * @returns {number} Pixel value
     */
    #parsePositionValue(position, containerDimension) {
        if (typeof position === 'number') {
            return position
        }

        if (typeof position === 'string') {
            const trimmed = position.trim()

            if (trimmed.endsWith('px')) {
                const px = parseFloat(trimmed)
                return isNaN(px) ? 0 : px
            }

            if (trimmed.endsWith('%')) {
                const percent = parseFloat(trimmed)
                return isNaN(percent) ? 0 : containerDimension * (percent / 100)
            }

            const numeric = parseFloat(trimmed)
            return isNaN(numeric) ? 0 : numeric
        }

        return 0
    }
    /**
     * Sets the element position using the most appropriate method
     * @private
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    #setElementPosition(x, y) {
        this.target.style.position = 'absolute'
        this.target.style.left = `${x}px`
        this.target.style.top = `${y}px`
        this.target.style.transform = '' // Clear transform to avoid conflicts
    }

    /**
     * Gets the bounding rectangle of the container, adjusted for padding and borders
     * @private
     * @returns {Object} Bounds with left, top, right, bottom, width, and height properties
     */
    #getBounds() {
        if (this.container === window) {
            return {
                left:  0,
                top:   0,
                right: window.innerWidth,
                bottom: window.visualViewport ? window.visualViewport.height : window.innerHeight,
                width:  window.innerWidth,
                height: window.innerHeight,
            }
        }
        const rect = this.container.getBoundingClientRect()
        const styles = getComputedStyle(this.container)
        const paddingLeft = parseFloat(styles.paddingLeft) || 0
        const paddingTop = parseFloat(styles.paddingTop) || 0
        const paddingRight = parseFloat(styles.paddingRight) || 0
        const paddingBottom = parseFloat(styles.paddingBottom) || 0
        const borderLeft = parseFloat(styles.borderLeftWidth) || 0
        const borderTop = parseFloat(styles.borderTopWidth) || 0
        return {
            left:   paddingLeft + borderLeft,
            top:    paddingTop + borderTop,
            right:  rect.width - paddingRight - borderLeft,
            bottom: rect.height - paddingBottom - borderTop,
            width:  rect.width,
            height: rect.height,
        }
    }

    /**
     * Ensures the target element stays fully within the container's bounds
     * Initializes position if not set and adjusts on resize to keep element fully visible
     * @private
     */
    #ensureWithinBounds() {
        const bounds = this.#getBounds()
        const currentPosition = this.#getElementPosition()
        const currentRect = this.target.getBoundingClientRect()

        let left = currentPosition.left
        let top = currentPosition.top

        // Position the element the first time
        if (this.startX === -1 && this.startY === -1) {
            const center = {
                x: this.#parsePositionValue(this.startLeft, bounds.width),
                y: this.#parsePositionValue(this.startTop, bounds.height),
            }
            left = bounds.left + center.x - (currentRect.width / 2)
            top = bounds.top + center.y - (currentRect.height / 2)
        }

        // Ensure the entire element stays within bounds
        // Adjust x to keep the right edge within bounds.right
        if (left + currentRect.width > bounds.right) {
            left = bounds.right - currentRect.width
        }
        // Adjust y to keep the bottom edge within bounds.bottom
        if (top + currentRect.height > bounds.bottom) {
            top = bounds.bottom - currentRect.height
        }
        // Ensure left edge is not before bounds.left
        if (left < bounds.left) {
            left = bounds.left
        }
        // Ensure top edge is not before bounds.top
        if (top < bounds.top) {
            top = bounds.top
        }

        this.#setElementPosition(left, top)

        const finalRect = this.target.getBoundingClientRect()
        if (this.hasMoved) {
            this.target.dispatchEvent(new CustomEvent(DragHandler.DRAG, {
                detail: {
                    value: {
                        x:     finalRect.left,
                        y:     finalRect.top,
                        width: finalRect.width,
                        height: finalRect.height,
                    },
                },
            }))
        }
    }

    /**
     * Handles resize of the target element to keep it within bounds
     * @private
     */
    #handleTargetResize() {
        this.#ensureWithinBounds()
    }

    /**
     * Creates a transparent overlay div to manage cursor during drag
     * @private
     */
    #createOverlay() {
        this.overlay = document.createElement('div')
        const targetRect = this.target.getBoundingClientRect()
        this.overlay.style.position = 'absolute'
        this.overlay.style.left = '0'
        this.overlay.style.top = '0'
        this.overlay.style.width = `${targetRect.width}px`
        this.overlay.style.height = `${targetRect.height}px`
        this.overlay.style.cursor = 'grabbing'
        this.overlay.style.zIndex = '9999'
        this.overlay.style.background = 'transparent'
        this.target.appendChild(this.overlay)
    }

    /**
     * Removes the overlay div after drag ends
     * @private
     */
    #removeOverlay() {
        if (this.overlay) {
            this.overlay.remove()
            this.overlay = null
        }
    }

    /**
     * Handles the pointerdown or touchstart event, dispatching beforeDrag
     * @param {Event} event - The pointerdown or touchstart event
     */
    handleBefore = (event) => {
        const targetRect = this.target.getBoundingClientRect()
        this.target.dispatchEvent(new CustomEvent(DragHandler.BEFORE_DRAG, {
            detail: {
                value: {
                    x:      targetRect.left,
                    y:      targetRect.top,
                    width:  targetRect.width,
                    height: targetRect.height,
                },
            },
        }))
        this.handleStart(event)
    }

    /**
     * Handles the start of a drag interaction (called after beforeDrag)
     * @param {Event} event - The pointerdown or touchstart event
     */
    handleStart = (event) => {
        this.dragging = false
        this.hasMoved = false
        this.wasDragging = false
        const clientX = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX
        const clientY = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY
        this.startX = clientX
        this.startY = clientY

        // Get the current effective position
        const currentPosition = this.#getElementPosition()
        this.startLeft = currentPosition.left
        this.startTop = currentPosition.top

        this.grabber.style.cursor = 'grab'
        this.grabber.style.touchAction = 'none'

        document.addEventListener('pointermove', this.handleMove, {passive: false})
        document.addEventListener('touchmove', this.handleMove, {passive: false})
        document.addEventListener('pointerup', this.handleEnd, {passive: false})
        document.addEventListener('touchend', this.handleEnd, {passive: false})
    }

    /**
     * Handles drag movement (pointermove or touchmove)
     * Creates overlay and updates position if movement threshold is exceeded
     * @param {Event} event - The pointermove or touchmove event
     */
    handleMove = (event) => {
        const clientX = event.type === 'touchmove' ? event.touches[0].clientX : event.clientX
        const clientY = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY
        const deltaX = Math.abs(clientX - this.startX)
        const deltaY = Math.abs(clientY - this.startY)

        if (!this.hasMoved && (deltaX > this.movementThreshold || deltaY > this.movementThreshold)) {
            this.dragging = true
            this.hasMoved = true
            this.wasDragging = true
            this.#createOverlay()
            document.body.classList.add('no-select')
            this.target.classList.add('drag-in-progress') // Add drag-in-progress class

            const targetRect = this.target.getBoundingClientRect()
            this.target.dispatchEvent(new CustomEvent(DragHandler.DRAG_START, {
                detail: {
                    value: {
                        x:      targetRect.left,
                        y:      targetRect.top,
                        width:  targetRect.width,
                        height: targetRect.height,
                    },
                },
            }))
        }

        if (!this.dragging) {
            return
        }

        event.preventDefault()
        let newX = this.startLeft + (clientX - this.startX)
        let newY = this.startTop + (clientY - this.startY)
        const bounds = this.#getBounds()
        const targetRect = this.target.getBoundingClientRect()

        // Apply bounds constraints to keep element fully visible
        newX = Math.max(bounds.left, Math.min(newX, bounds.right - targetRect.width))
        newY = Math.max(bounds.top, Math.min(newY, bounds.bottom - targetRect.height))

        this.#setElementPosition(newX, newY)

        if (this.overlay) {
            const updatedRect = this.target.getBoundingClientRect()
            this.overlay.style.width = `${updatedRect.width}px`
            this.overlay.style.height = `${updatedRect.height}px`
        }

        const updatedtargetRect = this.target.getBoundingClientRect()
        this.target.dispatchEvent(new CustomEvent(DragHandler.DRAG, {
            detail: {
                value: {
                    x:      updatedtargetRect.left,
                    y:      updatedtargetRect.top,
                    width:  updatedtargetRect.width,
                    height: updatedtargetRect.height,
                },
            },
        }))
    }

    /**
     * Handles the end of a drag (pointerup or touchend), dispatching dragstop and afterDrag
     * @param {Event} event - The pointerup or touchend event
     */
    handleEnd = (event) => {
        document.removeEventListener('pointermove', this.handleMove)
        document.removeEventListener('touchmove', this.handleMove)
        document.removeEventListener('pointerup', this.handleEnd)
        document.removeEventListener('touchend', this.handleEnd)
        this.#removeOverlay()
        this.target.classList.remove('drag-in-progress') // Remove drag-in-progress class

        const targetRect = this.target.getBoundingClientRect()
        if (this.hasMoved) {
            event.preventDefault()
            event.stopPropagation()
            document.addEventListener('click', this.#handleDocumentClick, {capture: true, once: true})
            setTimeout(() => {
                this.wasDragging = false
            }, 300)
            this.dragging = false
            this.hasMoved = false
            this.grabber.style.cursor = 'grab'
            document.body.classList.remove('no-select')
            this.grabber.style.touchAction = ''

            // Persist new base transform in transform mode
            if (this.useTransformMode) {
                this.baseTransform = this.target.style.transform || this.baseTransform || ''
            }

            this.#ensureWithinBounds()

            this.target.dispatchEvent(new CustomEvent(DragHandler.DRAG_STOP, {
                detail: {
                    value: {
                        x:      Rect.left,
                        y:      targetRect.top,
                        width:  targetRect.width,
                        height: targetRect.height,
                    },
                },
            }))
        }
        else {
            this.dragging = false
            this.hasMoved = false
            this.grabber.style.cursor = 'grab'
            this.grabber.style.touchAction = ''
        }

        this.target.dispatchEvent(new CustomEvent(DragHandler.AFTER_DRAG, {
            detail: {
                value: {
                    x:      targetRect.left,
                    y:      targetRect.top,
                    width:  targetRect.width,
                    height: targetRect.height,
                },
            },
        }))
    }

    /**
     * Prevents clicks on the grabber after a drag
     * @private
     * @param {Event} event - The click event
     */
    #handleClick = (event) => {
        if (this.wasDragging) {
            event.preventDefault()
            event.stopPropagation()
        }
    }

    /**
     * Prevents document-level clicks after a drag
     * @private
     * @param {Event} event - The click event
     */
    #handleDocumentClick = (event) => {
        if (this.wasDragging) {
            event.preventDefault()
            event.stopPropagation()
        }
    }

    /**
     * Handles window or container resize to keep target within bounds
     * @private
     */
    #handleResize = () => {
        this.#ensureWithinBounds()
    }

    /**
     * Attaches event listeners for drag, click, and resize events
     */
    attachEvents() {
        if (!this.grabber) {
            console.warn('grabber is undefined, cannot attach events')
            return
        }
        this.grabber.addEventListener('pointerdown', this.handleBefore, {passive: false})
        this.grabber.addEventListener('touchstart', this.handleBefore, {passive: false})
        this.grabber.addEventListener('click', this.#handleClick, {passive: false})

        if (this.container === window) {
            window.addEventListener('resize', this.#handleResize)
        }
        else {
            this.resizeObserver = new ResizeObserver(() => this.#handleResize())
            this.resizeObserver.observe(this.container)
        }

        this.targetResizeObserver = new ResizeObserver(() => this.#handleTargetResize())
        this.targetResizeObserver.observe(this.target)
    }

    /**
     * Cleans up event listeners, removes overlay, and removes draggable class
     */
    destroy() {
        if (this.grabber) {
            this.grabber.removeEventListener('pointerdown', this.handleBefore)
            this.grabber.removeEventListener('touchstart', this.handleBefore)
            this.grabber.removeEventListener('click', this.#handleClick)
            this.grabber.style.cursor = ''
            this.grabber.style.touchAction = ''
        }
        document.removeEventListener('pointermove', this.handleMove)
        document.removeEventListener('touchmove', this.handleMove)
        document.removeEventListener('pointerup', this.handleEnd)
        document.removeEventListener('touchend', this.handleEnd)
        document.removeEventListener('click', this.#handleDocumentClick)
        this.#removeOverlay()
        this.target.classList.remove('draggable', 'drag-in-progress') // Remove both classes
        if (this.container === window) {
            window.removeEventListener('resize', this.#handleResize)
        }
        else if (this.resizeObserver) {
            this.resizeObserver.disconnect()
        }
        if (this.targetResizeObserver) {
            this.targetResizeObserver.disconnect()
        }
    }
}