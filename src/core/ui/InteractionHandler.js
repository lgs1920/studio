export class InteractionHandler {
    constructor({dragger, parent, container = window, callback = null}) {
        this.dragger = dragger
        this.parent = parent || dragger.parentElement
        this.container = container
        this.dragging = false
        this.baseX = 0
        this.baseY = 0
        this.clickX = 0
        this.clickY = 0
        this.currentDeltaX = 0
        this.currentDeltaY = 0
        this.animationFrame = null
        this.callback = callback

        this.handleMove = this.handleMove.bind(this)
        this.handleEnd = this.handleEnd.bind(this)
        this.handleMouseDown = this.handleMouseDown.bind(this)
        this.handleTouchStart = this.handleTouchStart.bind(this)

        this.attachEvents()

        const boundingBox = this.parent.getBoundingClientRect()
        this.baseX = boundingBox.left
        this.baseY = boundingBox.top
    }

    /**
     * Get container boundaries (window or any element)
     *
     * @return {{top, left, right, bottom}|{top: number, left: number, right: number, bottom: number}}
     */
    get bounds() {
        if (this.container === window) {
            return {
                top:    0,
                left:   0,
                right:  window.innerWidth,
                bottom: window.innerHeight,
            }
        }
        const containerRect = this.container.getBoundingClientRect()
        return {
            top:    containerRect.top,
            left:   containerRect.left,
            right:  containerRect.right,
            bottom: containerRect.bottom,
        }
    }

    /**
     * Drag management. It handles movement during drag (mouse or touch)
     * Updates the element's position based on cursor/finger movement
     *
     * @param event
     */
    handleMove(event) {
        // Exit if not in dragging mode
        if (!this.dragging) {
            return
        }

        // Get current cursor or touch coordinates
        const clientX = event.touches ? event.touches[0].clientX : event.clientX
        const clientY = event.touches ? event.touches[0].clientY : event.clientY

        // Cancel any pending animation to avoid conflicts
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
        }

        this.animationFrame = requestAnimationFrame(() => {
            // Get current dimensions and position of the parent element
            const parentRect = this.parent.getBoundingClientRect()

            // Calculate displacement relative to the initial click
            const deltaXFromClick = clientX - this.clickX
            const deltaYFromClick = clientY - this.clickY

            // Calculate target position: base + cumulative displacement + current move
            const targetX = this.baseX + this.currentDeltaX + deltaXFromClick
            const targetY = this.baseY + this.currentDeltaY + deltaYFromClick

            // We should stay in container
            const {top, left, right, bottom} = this.bounds
            const constrainedX = Math.max(left, Math.min(targetX, right - parentRect.width))
            const constrainedY = Math.max(top, Math.min(targetY, bottom - parentRect.height))

            // Apply CSS transformation to move the element
            this.parent.style.transform = `translate(${constrainedX - this.baseX}px, ${constrainedY - this.baseY}px)`

            // Invoke callback with new coordinates if provided
            if (this.callback) {
                this.callback({
                                  x:      constrainedX,
                                  y:      constrainedY,
                                  width:  parentRect.width,
                                  height: parentRect.height,
                              })
            }
        })
    }

    /**
     * Handle the end of a drag (release).
     * Cleans up event listeners and updates cumulative displacement
     *
     * @param event
     */
    handleEnd(event) {
        if (!this.dragging) {
            return
        }
        this.dragging = false

        document.removeEventListener('mousemove', this.handleMove)
        document.removeEventListener('mouseup', this.handleEnd)
        document.removeEventListener('touchmove', this.handleMove)
        document.removeEventListener('touchend', this.handleEnd)

        if (this.dragger) {
            this.dragger.classList.remove('dragging')
        }
        document.body.classList.remove('no-select')

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
            this.animationFrame = null
        }

        const parentRect = this.parent.getBoundingClientRect()
        this.currentDeltaX = parentRect.left - this.baseX
        this.currentDeltaY = parentRect.top - this.baseY
    }

    /**
     * Handle the start of a drag with the mouse.
     * Initializes dragging and attaches movement/end listeners
     *
     * @param event
     */
    handleMouseDown(event) {
        event.preventDefault()
        this.initializeDragging(event.clientX, event.clientY)
        document.addEventListener('mousemove', this.handleMove, {passive: false})
        document.addEventListener('mouseup', this.handleEnd, {passive: false})
        window.addEventListener('mouseup', this.handleEnd, {once: true})
    }

    /**
     * Handle the start of a drag with touch.
     * Initializes dragging and attaches movement/end listeners for touch
     *
     * @param event
     */
    handleTouchStart(event) {
        event.preventDefault()
        const touch = event.touches[0]
        this.initializeDragging(touch.clientX, touch.clientY)
        document.addEventListener('touchmove', this.handleMove, {passive: false})
        document.addEventListener('touchend', this.handleEnd, {passive: false})
        window.addEventListener('touchend', this.handleEnd, {once: true})
    }

    /**
     * initialize dragging.
     * Sets up initial click coordinates and activates drag mode
     *
     * @param clientX
     * @param clientY
     */
    initializeDragging(clientX, clientY) {
        this.clickX = clientX
        this.clickY = clientY

        this.dragging = true
        if (this.dragger) {
            this.dragger.classList.add('dragging')
        }
        document.body.classList.add('no-select')
    }

    /**
     *  Attach initial event listeners to the dragger.
     *  Sets up listeners for starting a drag (mouse or touch)
     */
    attachEvents = () => {
        if (!this.dragger) {
            return
        }
        this.dragger.addEventListener('mousedown', this.handleMouseDown)
        this.dragger.addEventListener('touchstart', this.handleTouchStart)
    }

    /**
     * Detach event listeners from the dragger.
     * Cleans up listeners when no longer needed
     */
    detachEvents() {
        if (!this.dragger) {
            return
        }
        this.dragger.removeEventListener('mousedown', this.handleMouseDown)
        this.dragger.removeEventListener('touchstart', this.handleTouchStart)
        window.removeEventListener('mouseup', this.handleEnd)
        window.removeEventListener('touchend', this.handleEnd)
    }
}