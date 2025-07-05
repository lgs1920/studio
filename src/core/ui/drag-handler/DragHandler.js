/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DragHandler.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-05
 * Last modified: 2025-07-05
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
     * @param {HTMLElement} options.parent - Element to be moved
     * @param {HTMLElement|Window} [options.container=window] - Container for bounds
     */
    constructor({grabber, dragger, parent, container = window}) {
        const grabberElement = grabber || dragger || parent
        if (!(grabberElement instanceof HTMLElement)) {
            throw new Error('grabber (or dragger or parent) must be an HTMLElement')
        }
        if (!(parent instanceof HTMLElement)) {
            throw new Error('parent must be an HTMLElement')
        }
        if (container !== window && !(container instanceof HTMLElement)) {
            throw new Error('container must be window or an HTMLElement')
        }

        this.grabber = grabberElement
        this.parent = parent
        this.container = container
        this.dragging = false
        this.startX = 0
        this.startY = 0
        this.startLeft = 0
        this.startTop = 0
        this.isInitialPositionInvalid = !parent.style.left || !parent.style.top
        this.movementThreshold = 5 // Pixels to detect drag vs click
        this.hasMoved = false // Tracks if movement exceeded threshold
        this.wasDragging = false // Tracks if drag occurred for click suppression
        this.overlay = null // Overlay div for cursor during drag

        this.handleBefore = this.handleBefore.bind(this)
        this.handleStart = this.handleStart.bind(this)
        this.handleMove = this.handleMove.bind(this)
        this.handleEnd = this.handleEnd.bind(this)

        // Set initial cursor style
        this.grabber.style.cursor = 'grab'

        this.#ensureWithinBounds()
        this.isInitialPositionInvalid = false
        this.attachEvents()
    }

    /**
     * Gets the bounding rectangle of the container, adjusted for padding and borders
     * @private
     * @returns {Object} Bounds with left, top, right, and bottom properties
     */
    #getBounds() {
        if (this.container === window) {
            return {
                left:   0,
                top:    0,
                right: window.innerWidth,
                bottom: window.innerHeight,
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
        }
    }

    /**
     * Ensures the parent element stays within the container's bounds
     * Initializes position if not set and adjusts on resize
     * @private
     */
    #ensureWithinBounds() {
        const bounds = this.#getBounds()
        let x = parseFloat(this.parent.style.left) || 0
        let y = parseFloat(this.parent.style.top) || 0
        const currentRect = this.parent.getBoundingClientRect()

        if (this.isInitialPositionInvalid) {
            const containerOffset = this.container !== window ? this.container.getBoundingClientRect() : {
                left: 0,
                top: 0,
            }
            x = currentRect.left - containerOffset.left
            y = currentRect.top - containerOffset.top
            const containerWidth = bounds.right - bounds.left
            const containerHeight = bounds.bottom - bounds.top
            x = bounds.left + containerWidth / 2 - currentRect.width / 2
            y = bounds.top + (containerHeight * 2) / 3 - currentRect.height / 2
        }

        if (x + currentRect.width > bounds.right) {
            x = bounds.right - currentRect.width
        }
        if (y + currentRect.height > bounds.bottom) {
            y = bounds.bottom - currentRect.height
        }
        if (x < bounds.left) {
            x = bounds.left
        }
        if (y < bounds.top) {
            y = bounds.top
        }

        this.parent.style.position = 'absolute'
        this.parent.style.left = `${x}px`
        this.parent.style.top = `${y}px`
        this.parent.style.transform = ''

        const finalRect = this.parent.getBoundingClientRect()
        if (this.hasMoved) {
            this.parent.dispatchEvent(new CustomEvent(DragHandler.DRAG, {
                detail: {
                    value: {
                        x:      finalRect.left,
                        y:      finalRect.top,
                        width:  finalRect.width,
                        height: finalRect.height,
                    },
                },
            }))
        }
    }

    /**
     * Handles resize of the parent element to keep it within bounds
     * @private
     */
    #handleParentResize() {
        this.#ensureWithinBounds()
    }

    /**
     * Creates a transparent overlay div to manage cursor during drag
     * @private
     */
    #createOverlay() {
        this.overlay = document.createElement('div')
        const parentRect = this.parent.getBoundingClientRect()
        this.overlay.style.position = 'absolute'
        this.overlay.style.left = '0'
        this.overlay.style.top = '0'
        this.overlay.style.width = `${parentRect.width}px`
        this.overlay.style.height = `${parentRect.height}px`
        this.overlay.style.cursor = 'grabbing'
        this.overlay.style.zIndex = '9999' // High z-index to cover children
        this.overlay.style.background = 'transparent' // Invisible
        this.parent.appendChild(this.overlay)
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
     * Handles the pointerdown event, dispatching beforeDrag
     * @param {Event} event - The pointerdown event
     */
    handleBefore(event) {
        const parentRect = this.parent.getBoundingClientRect()
        this.parent.dispatchEvent(new CustomEvent(DragHandler.BEFORE_DRAG, {
            detail: {
                value: {
                    x:      parentRect.left,
                    y:      parentRect.top,
                    width:  parentRect.width,
                    height: parentRect.height,
                },
            },
        }))
        this.handleStart(event) // Proceed to handleStart
    }

    /**
     * Handles the start of a drag interaction (called after beforeDrag)
     * @param {Event} event - The pointerdown event
     */
    handleStart(event) {
        this.dragging = false
        this.hasMoved = false
        this.wasDragging = false
        const clientX = event.clientX
        const clientY = event.clientY
        this.startX = clientX
        this.startY = clientY
        this.startLeft = parseFloat(this.parent.style.left) || 0
        this.startTop = parseFloat(this.parent.style.top) || 0
        this.grabber.style.cursor = 'grab' // Ensure cursor is grab at start

        document.addEventListener('pointermove', this.handleMove, {passive: false})
        document.addEventListener('pointerup', this.handleEnd, {passive: false})
    }

    /**
     * Handles drag movement (pointermove)
     * Creates overlay and updates position if movement threshold is exceeded
     * @param {Event} event - The pointermove event
     */
    handleMove(event) {
        const clientX = event.clientX
        const clientY = event.clientY
        const deltaX = Math.abs(clientX - this.startX)
        const deltaY = Math.abs(clientY - this.startY)

        if (!this.hasMoved && (deltaX > this.movementThreshold || deltaY > this.movementThreshold)) {
            this.dragging = true
            this.hasMoved = true
            this.wasDragging = true
            this.#createOverlay() // Create overlay for cursor
            document.body.classList.add('no-select')

            const parentRect = this.parent.getBoundingClientRect()
            this.parent.dispatchEvent(new CustomEvent(DragHandler.DRAG_START, {
                detail: {
                    value: {
                        x:      parentRect.left,
                        y:      parentRect.top,
                        width:  parentRect.width,
                        height: parentRect.height,
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
        const parentRect = this.parent.getBoundingClientRect()
        newX = Math.max(bounds.left, Math.min(newX, bounds.right - parentRect.width))
        newY = Math.max(bounds.top, Math.min(newY, bounds.bottom - parentRect.height))
        this.parent.style.left = `${newX}px`
        this.parent.style.top = `${newY}px`

        // Update overlay size
        if (this.overlay) {
            const updatedRect = this.parent.getBoundingClientRect()
            this.overlay.style.width = `${updatedRect.width}px`
            this.overlay.style.height = `${updatedRect.height}px`
        }

        const updatedParentRect = this.parent.getBoundingClientRect()
        this.parent.dispatchEvent(new CustomEvent(DragHandler.DRAG, {
            detail: {
                value: {
                    x:      updatedParentRect.left,
                    y:      updatedParentRect.top,
                    width:  updatedParentRect.width,
                    height: updatedParentRect.height,
                },
            },
        }))
    }

    /**
     * Handles the end of a drag (pointerup), dispatching dragstop and afterDrag
     * @param {Event} event - The pointerup event
     */
    handleEnd(event) {
        document.removeEventListener('pointermove', this.handleMove)
        document.removeEventListener('pointerup', this.handleEnd)
        this.#removeOverlay() // Remove overlay

        const parentRect = this.parent.getBoundingClientRect()
        if (this.hasMoved) {
            event.preventDefault()
            event.stopPropagation()
            // Add document-level click handler to block clicks after drag
            document.addEventListener('click', this.#handleDocumentClick, {capture: true, once: true})
            // Timeout to ensure synthetic clicks are blocked on mobile
            setTimeout(() => {
                this.wasDragging = false // Reset after timeout
            }, 300)
            this.dragging = false
            this.hasMoved = false
            this.grabber.style.cursor = 'grab' // Revert cursor
            document.body.classList.remove('no-select')
            this.#ensureWithinBounds()

            this.parent.dispatchEvent(new CustomEvent(DragHandler.DRAG_STOP, {
                detail: {
                    value: {
                        x:      parentRect.left,
                        y:      parentRect.top,
                        width:  parentRect.width,
                        height: parentRect.height,
                    },
                },
            }))
        }
        else {
            this.dragging = false
            this.hasMoved = false
            this.grabber.style.cursor = 'grab' // Ensure cursor is grab
        }

        this.parent.dispatchEvent(new CustomEvent(DragHandler.AFTER_DRAG, {
            detail: {
                value: {
                    x:      parentRect.left,
                    y:      parentRect.top,
                    width:  parentRect.width,
                    height: parentRect.height,
                },
            },
        }))
    }

    /**
     * Prevents clicks on the grabber after a drag
     * @private
     * @param {Event} event - The click event
     */
    #handleClick(event) {
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
    #handleDocumentClick(event) {
        if (this.wasDragging) {
            event.preventDefault()
            event.stopPropagation()
        }
    }

    /**
     * Handles window or container resize to keep parent within bounds
     * @private
     */
    #handleResize() {
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
        this.grabber.addEventListener('click', this.#handleClick.bind(this), {passive: false})

        if (this.container === window) {
            window.addEventListener('resize', this.#handleResize.bind(this))
        }
        else {
            this.resizeObserver = new ResizeObserver(() => this.#handleResize())
            this.resizeObserver.observe(this.container)
        }

        this.parentResizeObserver = new ResizeObserver(() => this.#handleParentResize())
        this.parentResizeObserver.observe(this.parent)
    }

    /**
     * Cleans up event listeners and removes overlay
     */
    destroy() {
        if (this.grabber) {
            this.grabber.removeEventListener('pointerdown', this.handleBefore)
            this.grabber.removeEventListener('click', this.#handleClick.bind(this))
            this.grabber.style.cursor = '' // Reset cursor
        }
        document.removeEventListener('pointermove', this.handleMove)
        document.removeEventListener('pointerup', this.handleEnd)
        document.removeEventListener('click', this.#handleDocumentClick.bind(this))
        this.#removeOverlay() // Ensure overlay is removed
        if (this.container === window) {
            window.removeEventListener('resize', this.#handleResize.bind(this))
        }
        else if (this.resizeObserver) {
            this.resizeObserver.disconnect()
        }
        if (this.parentResizeObserver) {
            this.parentResizeObserver.disconnect()
        }
    }
}