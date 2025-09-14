/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DragHandler.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-09-14
 * Last modified: 2025-09-14
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * A class to handle drag and resize interactions for a movable toolbar element
 * Provides functionality for dragging a toolbar within a container, managing cursor
 * behavior with an overlay, and suppressing clicks after a drag
 */
import { v4 as uuidv4 } from 'uuid'

export class DragHandler {
    // Static constants for event types
    static BEFORE_DRAG = 'beforeDrag'
    static DRAG = 'drag'
    static DRAG_START = 'dragstart'
    static DRAG_STOP = 'dragstop'
    static AFTER_DRAG = 'afterDrag'

    // Static Map to store draggable elements' data
    static #draggableElements = new Map()

    /**
     * Creates a new DragHandler instance
     * @param {Object} options - Configuration options for the drag handler
     * @param {HTMLElement} [options.grabber] - Element that initiates the drag
     * @param {HTMLElement} [options.dragger] - Alias for grabber (optional)
     * @param {HTMLElement} options.target - Element to be moved
     * @param {HTMLElement|Window} [options.container=window] - Container for bounds
     * @param {Object} [options.position={placement: 'center'}] - Positioning configuration
     * @param {string} [options.position.placement='center'] - Placement point ('top-right', 'top', 'top-left', 'left',
     *     'center', 'right', 'bottom-left', 'bottom', 'bottom-right')
     * @param {string|number} [options.position.top] - Initial top position (e.g., '33%', '250px')
     * @param {string|number} [options.position.left] - Initial left position (e.g., '50%', '250px')
     */
    constructor({grabber, dragger, target, container = window, position = {placement: 'center'}}) {
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

        this.id = uuidv4()
        this.position = {
            placement: position.placement || 'center',
            top: position.top,
            left: position.left,
        }

        this.grabber = grabberElement
        this.target = target
        this.container = container
        this.dragging = false
        this.isEnding = false // Guard against multiple handleEnd calls
        this.startX = -1
        this.startY = -1
        this.startLeft = this.position.left
        this.startTop = this.position.top
        this.movementThreshold = 5
        this.hasMoved = false
        this.wasDragging = false
        this.overlay = null

        // Transform-aware mode
        const computedTransform = getComputedStyle(this.target).transform
        this.useTransformMode = (this.target.style.transform && this.target.style.transform !== '') || (computedTransform && computedTransform !== 'none')
        this.baseTransform = this.target.style.transform || ''

        // Store initial and current position
        const initialRect = this.target.getBoundingClientRect()
        DragHandler.#draggableElements.set(this.id, {
            initialPosition: {
                top:  this.position.top,
                left: this.position.left,
                placement: this.position.placement,
            },
            currentPosition: {
                top:  initialRect.top,
                left: initialRect.left,
                placement: this.position.placement,
            },
        })

        this.handleBefore = this.handleBefore.bind(this)
        this.handleStart = this.handleStart.bind(this)
        this.handleMove = this.handleMove.bind(this)
        this.handleEnd = this.handleEnd.bind(this)

        this.grabber.style.cursor = 'grab'
        this.target.classList.add('draggable')

        this.#ensureWithinBounds()
        this.isInitialPositionInvalid = false
        this.attachEvents()
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
     * Gets the effective position of the element
     * @private
     * @returns {Object} Position with left and top properties
     */
    #getElementPosition() {
        const rect = this.target.getBoundingClientRect()
        const containerRect = this.container !== window ? this.container.getBoundingClientRect() : {left: 0, top: 0}
        let left = rect.left - containerRect.left
        let top = rect.top - containerRect.top
        if (this.container !== window) {
            left += this.container.scrollLeft
            top += this.container.scrollTop
        }
        return {left, top}
    }

    /**
     * Parses a position value and returns its pixel equivalent
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
        this.target.style.transform = ''
        const rect = this.target.getBoundingClientRect()
        const data = DragHandler.#draggableElements.get(this.id)
        if (data) {
            data.currentPosition = {
                top:  rect.top,
                left: rect.left,
                placement: this.position.placement,
            }
            DragHandler.#draggableElements.set(this.id, data)
        }
    }

    /**
     * Gets the bounding rectangle of the container
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
                width: window.innerWidth,
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
            left:  paddingLeft + borderLeft,
            top:   paddingTop + borderTop,
            right: rect.width - paddingRight - borderLeft,
            bottom: rect.height - paddingBottom - borderTop,
            width: rect.width,
            height: rect.height,
        }
    }

    /**
     * Ensures the target element stays within bounds
     * @private
     */
    #ensureWithinBounds() {
        const bounds = this.#getBounds()
        const currentPosition = this.#getElementPosition()
        const currentRect = this.target.getBoundingClientRect()
        let left = currentPosition.left
        let top = currentPosition.top

        if (this.startX === -1 && this.startY === -1) {
            const {width: containerWidth, height: containerHeight} = bounds
            const {width: targetWidth, height: targetHeight} = currentRect
            if (this.position.top !== undefined && this.position.left !== undefined) {
                const anchorX = this.#parsePositionValue(this.position.left, containerWidth)
                const anchorY = this.#parsePositionValue(this.position.top, containerHeight)
                switch (this.position.placement) {
                    case 'top-right':
                        left = bounds.left + anchorX - targetWidth
                        top = bounds.top + anchorY
                        break
                    case 'top':
                        left = bounds.left + anchorX - targetWidth / 2
                        top = bounds.top + anchorY
                        break
                    case 'top-left':
                        left = bounds.left + anchorX
                        top = bounds.top + anchorY
                        break
                    case 'left':
                        left = bounds.left + anchorX
                        top = bounds.top + anchorY - targetHeight / 2
                        break
                    case 'center':
                        left = bounds.left + anchorX - targetWidth / 2
                        top = bounds.top + anchorY - targetHeight / 2
                        break
                    case 'right':
                        left = bounds.left + anchorX - targetWidth
                        top = bounds.top + anchorY - targetHeight / 2
                        break
                    case 'bottom-left':
                        left = bounds.left + anchorX
                        top = bounds.top + anchorY - targetHeight
                        break
                    case 'bottom':
                        left = bounds.left + anchorX - targetWidth / 2
                        top = bounds.top + anchorY - targetHeight
                        break
                    case 'bottom-right':
                        left = bounds.left + anchorX - targetWidth
                        top = bounds.top + anchorY - targetHeight
                        break
                    default:
                        left = bounds.left + anchorX - targetWidth / 2
                        top = bounds.top + anchorY - targetHeight / 2
                }
            }
            else {
                const currentLeft = currentPosition.left
                const currentTop = currentPosition.top
                switch (this.position.placement) {
                    case 'top-right':
                        left = currentLeft
                        top = currentTop
                        break
                    case 'top':
                        left = currentLeft + targetWidth / 2
                        top = currentTop
                        break
                    case 'top-left':
                        left = currentLeft
                        top = currentTop
                        break
                    case 'left':
                        left = currentLeft
                        top = currentTop + targetHeight / 2
                        break
                    case 'center':
                        left = currentLeft + targetWidth / 2
                        top = currentTop + targetHeight / 2
                        break
                    case 'right':
                        left = currentLeft + targetWidth
                        top = currentTop + targetHeight / 2
                        break
                    case 'bottom-left':
                        left = currentLeft
                        top = currentTop + targetHeight
                        break
                    case 'bottom':
                        left = currentLeft + targetWidth / 2
                        top = currentTop + targetHeight
                        break
                    case 'bottom-right':
                        left = currentLeft + targetWidth
                        top = currentTop + targetHeight
                        break
                    default:
                        left = currentLeft + targetWidth / 2
                        top = currentTop + targetHeight / 2
                }
            }
        }

        if (left + currentRect.width > bounds.right) {
            left = bounds.right - currentRect.width
        }
        if (top + currentRect.height > bounds.bottom) {
            top = bounds.bottom - currentRect.height
        }
        if (left < bounds.left) {
            left = bounds.left
        }
        if (top < bounds.top) {
            top = bounds.top
        }
        this.#setElementPosition(left, top)
    }

    /**
     * Handles resize of the target element
     * @private
     */
    #handleTargetResize = () => {
        this.#ensureWithinBounds()
    }

    /**
     * Creates a transparent overlay for cursor management
     * @private
     */
    #createOverlay = () => {
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
     * Removes the overlay
     * @private
     */
    #removeOverlay = () => {
        if (this.overlay) {
            this.overlay.remove()
            this.overlay = null
        }
    }

    /**
     * Handles pointerdown or touchstart, dispatching beforeDrag
     * @param {Event} event - The pointerdown or touchstart event
     */
    handleBefore = event => {
        console.log('DragHandler: handleBefore', {event: event.type})
        const targetRect = this.target.getBoundingClientRect()
        this.target.dispatchEvent(new CustomEvent(DragHandler.BEFORE_DRAG, {
            detail: {
                value: {
                    x:     targetRect.left,
                    y:     targetRect.top,
                    width: targetRect.width,
                    height: targetRect.height,
                },
            },
        }))
        this.handleStart(event)
    }

    /**
     * Handles the start of a drag interaction
     * @param {Event} event - The pointerdown or touchstart event
     */
    handleStart = event => {
        console.log('DragHandler: handleStart', {event: event.type})
        if (this.dragging || this.isEnding) {
            console.log('DragHandler: handleStart skipped, already dragging or ending')
            return
        }
        this.dragging = false
        this.hasMoved = false
        this.wasDragging = false
        const clientX = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX
        const clientY = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY
        this.startX = clientX
        this.startY = clientY
        const currentPosition = this.#getElementPosition()
        this.startLeft = currentPosition.left
        this.startTop = currentPosition.top
        this.grabber.style.cursor = 'grab'
        this.grabber.style.touchAction = 'none'

        document.addEventListener('pointermove', this.handleMove, {passive: false})
        document.addEventListener('touchmove', this.handleMove, {passive: false})
        document.addEventListener('pointerup', this.handleEnd, {passive: false})
        document.addEventListener('touchend', this.handleEnd, {passive: false})
        document.addEventListener('pointercancel', this.handleEnd, {passive: false})
        document.addEventListener('touchcancel', this.handleEnd, {passive: false})
    }

    /**
     * Handles drag movement
     * @param {Event} event - The pointermove or touchmove event
     */
    handleMove = event => {
        if (!this.dragging && !this.hasMoved) {
            const clientX = event.type === 'touchmove' ? event.touches[0].clientX : event.clientX
            const clientY = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY
            const deltaX = Math.abs(clientX - this.startX)
            const deltaY = Math.abs(clientY - this.startY)
            if (deltaX > this.movementThreshold || deltaY > this.movementThreshold) {
                console.log('DragHandler: handleMove, drag started', {event: event.type})
                this.dragging = true
                this.hasMoved = true
                this.wasDragging = true
                this.#createOverlay()
                document.body.classList.add('no-select')
                this.target.classList.add('dragging')
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
        }

        if (!this.dragging) {
            console.log('DragHandler: handleMove skipped, not dragging')
            return
        }

        console.log('DragHandler: handleMove', {event: event.type, dragging: this.dragging})
        event.preventDefault()
        const clientX = event.type === 'touchmove' ? event.touches[0].clientX : event.clientX
        const clientY = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY
        let newX = this.startLeft + (clientX - this.startX)
        let newY = this.startTop + (clientY - this.startY)
        const bounds = this.#getBounds()
        const targetRect = this.target.getBoundingClientRect()
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
                    x:     updatedtargetRect.left,
                    y:     updatedtargetRect.top,
                    width: updatedtargetRect.width,
                    height: updatedtargetRect.height,
                },
            },
        }))
    }

    /**
     * Handles the end of a drag
     * @param {Event} event - The pointerup, touchend, pointercancel, or touchcancel event
     */
    handleEnd = event => {
        if (this.isEnding) {
            console.log('DragHandler: handleEnd skipped, already ending', {event: event.type})
            return
        }
        this.isEnding = true
        console.log('DragHandler: handleEnd', {event: event.type, dragging: this.dragging, hasMoved: this.hasMoved})

        // Remove all global event listeners
        document.removeEventListener('pointermove', this.handleMove, {passive: false})
        document.removeEventListener('touchmove', this.handleMove, {passive: false})
        document.removeEventListener('pointerup', this.handleEnd, {passive: false})
        document.removeEventListener('touchend', this.handleEnd, {passive: false})
        document.removeEventListener('pointercancel', this.handleEnd, {passive: false})
        document.removeEventListener('touchcancel', this.handleEnd, {passive: false})
        this.#removeOverlay()
        this.target.classList.remove('dragging')
        const targetRect = this.target.getBoundingClientRect()

        if (this.hasMoved) {
            event.preventDefault()
            event.stopPropagation()
            document.addEventListener('click', this.#handleDocumentClick, {capture: true, once: true})
            this.dragging = false
            this.hasMoved = false
            this.wasDragging = true
            this.grabber.style.cursor = 'grab'
            document.body.classList.remove('no-select')
            this.grabber.style.touchAction = ''
            if (this.useTransformMode) {
                this.baseTransform = this.target.style.transform || this.baseTransform || ''
            }
            this.#ensureWithinBounds()
            this.target.dispatchEvent(new CustomEvent(DragHandler.DRAG_STOP, {
                detail: {
                    value: {
                        x: targetRect.left,
                        y:     targetRect.top,
                        width: targetRect.width,
                        height: targetRect.height,
                    },
                },
            }))
        }
        else {
            this.dragging = false
            this.hasMoved = false
            this.wasDragging = false
            this.grabber.style.cursor = 'grab'
            this.grabber.style.touchAction = ''
        }

        this.target.dispatchEvent(new CustomEvent(DragHandler.AFTER_DRAG, {
            detail: {
                value: {
                    x:     targetRect.left,
                    y:     targetRect.top,
                    width: targetRect.width,
                    height: targetRect.height,
                },
            },
        }))
        this.isEnding = false
    }

    /**
     * Prevents clicks on the grabber after a drag
     * @private
     * @param {Event} event - The click event
     */
    #handleClick = event => {
        if (this.wasDragging) {
            console.log('DragHandler: handleClick prevented due to wasDragging')
            event.preventDefault()
            event.stopPropagation()
        }
    }

    /**
     * Prevents document-level clicks after a drag
     * @private
     * @param {Event} event - The click event
     */
    #handleDocumentClick = event => {
        if (this.wasDragging) {
            console.log('DragHandler: handleDocumentClick prevented due to wasDragging')
            event.preventDefault()
            event.stopPropagation()
        }
        this.wasDragging = false // Reset immediately after handling
    }

    /**
     * Handles window or container resize
     * @private
     */
    #handleResize = () => {
        this.#ensureWithinBounds()
    }

    /**
     * Attaches event listeners for drag and resize events
     */
    attachEvents() {
        if (!this.grabber) {
            console.warn('DragHandler: grabber is undefined, cannot attach events')
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
     * Cleans up event listeners and resources
     */
    destroy() {
        console.log('DragHandler: destroy', {id: this.id})
        if (this.grabber) {
            this.grabber.removeEventListener('pointerdown', this.handleBefore)
            this.grabber.removeEventListener('touchstart', this.handleBefore)
            this.grabber.removeEventListener('click', this.#handleClick)
            this.grabber.style.cursor = ''
            this.grabber.style.touchAction = ''
        }
        document.removeEventListener('pointermove', this.handleMove, {passive: false})
        document.removeEventListener('touchmove', this.handleMove, {passive: false})
        document.removeEventListener('pointerup', this.handleEnd, {passive: false})
        document.removeEventListener('touchend', this.handleEnd, {passive: false})
        document.removeEventListener('pointercancel', this.handleEnd, {passive: false})
        document.removeEventListener('touchcancel', this.handleEnd, {passive: false})
        document.removeEventListener('click', this.#handleDocumentClick, {capture: true})
        this.#removeOverlay()
        this.target.classList.remove('draggable', 'dragging')
        if (this.container === window) {
            window.removeEventListener('resize', this.#handleResize)
        }
        else if (this.resizeObserver) {
            this.resizeObserver.disconnect()
        }
        if (this.targetResizeObserver) {
            this.targetResizeObserver.disconnect()
        }
        DragHandler.#draggableElements.delete(this.id)
        this.dragging = false
        this.isEnding = false
        this.hasMoved = false
        this.wasDragging = false
    }
}