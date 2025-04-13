/**
 * Handles drag and resize interactions for a movable toolbar element.
 */
export class DragHandler {
    /**
     * Creates an InteractionHandler instance.
     * @param {Object} options - Configuration options.
     * @param {HTMLElement} [options.grabber] - Element to grab for dragging.
     * @param {HTMLElement} [options.dragger] - Alias for grabber if provided.
     * @param {HTMLElement} options.parent - The movable parent element.
     * @param {HTMLElement|Window} [options.container=window] - Container element or window.
     * @param {Function} [options.callback] - Callback for position updates.
     * @throws {Error} If grabber or parent is not an HTMLElement, or container is invalid.
     */
    constructor({grabber, dragger, parent, container = window, callback = null}) {
        const grabberElement = grabber || dragger
        if (!(grabberElement instanceof HTMLElement)) {
            throw new Error('grabber (or dragger) must be an HTMLElement')
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
        this.callback = callback
        this.dragging = false
        this.startX = 0
        this.startY = 0
        this.startLeft = 0
        this.startTop = 0
        this.isInitialPositionInvalid = !parent.style.left || !parent.style.top // Only true if no prior position

        this.handleStart = this.handleStart.bind(this)
        this.handleMove = this.handleMove.bind(this)
        this.handleEnd = this.handleEnd.bind(this)
        this.handleResize = this.handleResize.bind(this)
        this.handleParentResize = this.handleParentResize.bind(this)

        this.ensureWithinBounds()
        this.isInitialPositionInvalid = false
        this.attachEvents()
    }

    /**
     * Computes the bounding rectangle of the container.
     * @returns {Object} Bounds with left, top, right, and bottom properties.
     */
    getBounds() {
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
     * Ensures the parent element stays within container bounds.
     */
    ensureWithinBounds() {
        const bounds = this.getBounds()
        let x = parseFloat(this.parent.style.left) || 0
        let y = parseFloat(this.parent.style.top) || 0
        const currentRect = this.parent.getBoundingClientRect()

        // Center only if no prior position exists
        if (this.isInitialPositionInvalid) {
            const containerOffset = this.container !== window ? this.container.getBoundingClientRect() : {
                left: 0,
                top:  0,
            }
            x = currentRect.left - containerOffset.left
            y = currentRect.top - containerOffset.top
            const containerWidth = bounds.right - bounds.left
            const containerHeight = bounds.bottom - bounds.top
            x = bounds.left + containerWidth / 2 - currentRect.width / 2
            y = bounds.top + (containerHeight * 2) / 3 - currentRect.height / 2
        }

        // Adjust position if out of bounds
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
        if (this.callback) {
            this.callback({
                              x:      finalRect.left,
                              y:      finalRect.top,
                              width:  finalRect.width,
                              height: finalRect.height,
                          })
        }
    }

    /**
     * Handles resize of the parent element.
     */
    handleParentResize() {
        this.ensureWithinBounds()
    }

    /**
     * Starts the dragging process.
     * @param {Event} event - Mouse or touch event.
     */
    handleStart(event) {
        event.preventDefault()
        this.dragging = true
        const clientX = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX
        const clientY = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY
        this.startX = clientX
        this.startY = clientY
        this.startLeft = parseFloat(this.parent.style.left) || 0
        this.startTop = parseFloat(this.parent.style.top) || 0
        this.grabber.classList.add('dragging')
        document.body.classList.add('no-select')
        document.addEventListener('mousemove', this.handleMove, {passive: false})
        document.addEventListener('touchmove', this.handleMove, {passive: false})
        document.addEventListener('mouseup', this.handleEnd, {passive: false})
        document.addEventListener('touchend', this.handleEnd, {passive: false})
    }

    /**
     * Updates position during drag.
     * @param {Event} event - Mouse or touch event.
     */
    handleMove(event) {
        if (!this.dragging) {
            return
        }
        const clientX = event.type === 'touchmove' ? event.touches[0].clientX : event.clientX
        const clientY = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY
        const deltaX = clientX - this.startX
        const deltaY = clientY - this.startY
        let newX = this.startLeft + deltaX
        let newY = this.startTop + deltaY
        const bounds = this.getBounds()
        const parentRect = this.parent.getBoundingClientRect()
        newX = Math.max(bounds.left, Math.min(newX, bounds.right - parentRect.width))
        newY = Math.max(bounds.top, Math.min(newY, bounds.bottom - parentRect.height))
        this.parent.style.left = `${newX}px`
        this.parent.style.top = `${newY}px`

        const updatedParentRect = this.parent.getBoundingClientRect()
        if (this.callback) {
            this.callback({
                              x:      updatedParentRect.left,
                              y:      updatedParentRect.top,
                              width:  updatedParentRect.width,
                              height: updatedParentRect.height,
                          })
        }
    }

    /**
     * Ends the dragging process.
     */
    handleEnd() {
        if (!this.dragging) {
            return
        }
        this.dragging = false
        this.grabber.classList.remove('dragging')
        document.body.classList.remove('no-select')
        document.removeEventListener('mousemove', this.handleMove)
        document.removeEventListener('touchmove', this.handleMove)
        document.removeEventListener('mouseup', this.handleEnd)
        document.removeEventListener('touchend', this.handleEnd)
        this.ensureWithinBounds()
    }

    /**
     * Handles container resize events.
     */
    handleResize() {
        this.ensureWithinBounds()
    }

    /**
     * Attaches event listeners for drag and resize.
     */
    attachEvents() {
        if (!this.grabber) {
            console.warn('grabber is undefined, cannot attach events')
            return
        }
        this.grabber.addEventListener('mousedown', this.handleStart)
        this.grabber.addEventListener('touchstart', this.handleStart, {passive: false})

        if (this.container === window) {
            window.addEventListener('resize', this.handleResize)
        }
        else {
            this.resizeObserver = new ResizeObserver(() => this.handleResize())
            this.resizeObserver.observe(this.container)
        }

        this.parentResizeObserver = new ResizeObserver(() => this.handleParentResize())
        this.parentResizeObserver.observe(this.parent)
    }

    /**
     * Cleans up event listeners and observers.
     */
    destroy() {
        if (this.grabber) {
            this.grabber.removeEventListener('mousedown', this.handleStart)
            this.grabber.removeEventListener('touchstart', this.handleStart)
        }
        document.removeEventListener('mousemove', this.handleMove)
        document.removeEventListener('touchmove', this.handleMove)
        document.removeEventListener('mouseup', this.handleEnd)
        document.removeEventListener('touchend', this.handleEnd)
        if (this.container === window) {
            window.removeEventListener('resize', this.handleResize)
        }
        else if (this.resizeObserver) {
            this.resizeObserver.disconnect()
        }
        if (this.parentResizeObserver) {
            this.parentResizeObserver.disconnect()
        }
    }
}