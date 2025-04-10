export class InteractionHandler {
    dragging = false
    baseX = 0
    baseY = 0
    clickX = 0
    clickY = 0
    currentDeltaX = 0
    currentDeltaY = 0
    animationFrame = null
    dragger
    parent
    container
    callback
    resizeTimeout = null
    cachedBounds

    /**
     * Creates an instance of InteractionHandler to manage draggable elements.
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.dragger - Element that initiates dragging
     * @param {HTMLElement} [options.parent] - Element to be moved (defaults to dragger's parent)
     * @param {HTMLElement|Window} [options.container=window] - Container defining movement bounds
     * @param {Function} [options.callback] - Optional callback function called with position updates
     */
    constructor({dragger, parent, container = window, callback = null}) {
        this.dragger = dragger
        this.parent = parent || dragger.parentElement
        this.container = container
        this.callback = callback
        this.cachedBounds = this.bounds()

        this.handleMove = this.handleMove.bind(this)
        this.handleEnd = this.handleEnd.bind(this)
        this.handleMouseDown = this.handleMouseDown.bind(this)
        this.handleTouchStart = this.handleTouchStart.bind(this)
        this.handleResize = this.debounce(this.handleResize.bind(this), 20)

        this.attachEvents()
        this.updateBasePositions()
    }

    /**
     * Updates the base position of the parent element relative to the container.
     */
    updateBasePositions() {
        if (this.parent !== window) {
            const boundingBox = this.parent.getBoundingClientRect()
            this.baseX = boundingBox.left - this.currentDeltaX
            this.baseY = boundingBox.top - this.currentDeltaY
        }
        else {
            this.baseX = 0
            this.baseY = 0
        }
    }

    /**
     * Calculates the bounding rectangle of the container.
     * @returns {Object} Bounds object with top, left, right, and bottom properties
     */
    bounds() {
        if (this.container === window) {
            return {
                top:   0,
                left:  0,
                right: window.innerWidth,
                bottom: window.innerHeight,
            };
        }
        const containerRect = this.container.getBoundingClientRect()
        return {
            top:   containerRect.top,
            left:  containerRect.left,
            right: containerRect.right,
            bottom: containerRect.bottom,
        };
    }

    /**
     * Creates a debounced version of a function to limit its execution rate.
     * @param {Function} action - Function to debounce
     * @param {number} wait - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(action, wait) {
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(this.resizeTimeout)
                action(...args)
            }
            clearTimeout(this.resizeTimeout)
            this.resizeTimeout = setTimeout(later, wait)
        }
    }

    /**
     * Handles window resize events, updating positions and constraints while preserving relative position.
     */
    handleResize() {
        // Mettre à jour les limites en premier
        this.cachedBounds = this.bounds()
        const bounds = this.cachedBounds

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
        }

        this.animationFrame = requestAnimationFrame(() => {
            // Calculer la position actuelle absolue avant de modifier quoi que ce soit
            const currentAbsoluteX = this.baseX + this.currentDeltaX
            const currentAbsoluteY = this.baseY + this.currentDeltaY

            // Mettre à jour les positions de base après le resize
            this.updateBasePositions()

            // Recalculer les deltas pour préserver la position absolue, tout en appliquant les contraintes
            const targetX = currentAbsoluteX
            const targetY = currentAbsoluteY

            const constrainedX = Math.max(bounds.left, Math.min(targetX, bounds.right - this.parent.offsetWidth))
            const constrainedY = Math.max(bounds.top, Math.min(targetY, bounds.bottom - this.parent.offsetHeight))

            // Mettre à jour les deltas en fonction de la nouvelle base
            this.currentDeltaX = constrainedX - this.baseX
            this.currentDeltaY = constrainedY - this.baseY

            // Appliquer la transformation
            this.parent.style.transform = `translate(${this.currentDeltaX}px, ${this.currentDeltaY}px)`

            if (this.callback) {
                this.callback({
                                  x:      constrainedX,
                                  y:      constrainedY,
                                  width:  this.parent.offsetWidth,
                                  height: this.parent.offsetHeight,
                              })
            }
        })
    }

    /**
     * Handles movement events during dragging (mouse or touch).
     * @param {MouseEvent|TouchEvent} event - The movement event
     */
    handleMove(event) {
        if (!this.dragging) {
            return
        }

        const clientX = event.touches ? event.touches[0].clientX : event.clientX
        const clientY = event.touches ? event.touches[0].clientY : event.clientY

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame)
        }

        this.animationFrame = requestAnimationFrame(() => {
            const bounds = this.cachedBounds
            const deltaXFromClick = clientX - this.clickX
            const deltaYFromClick = clientY - this.clickY

            const targetX = this.baseX + this.currentDeltaX + deltaXFromClick
            const targetY = this.baseY + this.currentDeltaY + deltaYFromClick

            const constrainedX = Math.max(bounds.left, Math.min(targetX, bounds.right - this.parent.offsetWidth))
            const constrainedY = Math.max(bounds.top, Math.min(targetY, bounds.bottom - this.parent.offsetHeight))

            this.parent.style.transform = `translate(${constrainedX - this.baseX}px, ${constrainedY - this.baseY}px)`

            if (this.callback) {
                const parentRect = this.parent.getBoundingClientRect()
                this.callback({
                                  x:     constrainedX,
                                  y:     constrainedY,
                                  width: parentRect.width,
                                  height: parentRect.height,
                              });
            }
        });
    }

    /**
     * Handles the end of a dragging action (mouse up or touch end).
     * @param {MouseEvent|TouchEvent} event - The end event
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
     * Handles mouse down events to initiate dragging.
     * @param {MouseEvent} event - The mouse down event
     */
    handleMouseDown(event) {
        event.preventDefault()
        this.initializeDragging(event.clientX, event.clientY)
        document.addEventListener('mousemove', this.handleMove, {passive: false})
        document.addEventListener('mouseup', this.handleEnd, {passive: false})
        window.addEventListener('mouseup', this.handleEnd, {once: true})
    }

    /**
     * Handles touch start events to initiate dragging.
     * @param {TouchEvent} event - The touch start event
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
     * Initializes the dragging state with initial click/touch coordinates.
     * @param {number} clientX - X coordinate of the initial click/touch
     * @param {number} clientY - Y coordinate of the initial click/touch
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
     * Attaches event listeners for dragging and resizing.
     */
    attachEvents() {
        if (!this.dragger) {
            return
        }
        this.dragger.addEventListener('mousedown', this.handleMouseDown)
        this.dragger.addEventListener('touchstart', this.handleTouchStart)
        window.addEventListener('resize', this.handleResize)
    }

    /**
     * Detaches event listeners to clean up the instance.
     */
    detachEvents() {
        if (!this.dragger) {
            return
        }
        this.dragger.removeEventListener('mousedown', this.handleMouseDown)
        this.dragger.removeEventListener('touchstart', this.handleTouchStart)
        window.removeEventListener('resize', this.handleResize)
        window.removeEventListener('mouseup', this.handleEnd)
        window.removeEventListener('touchend', this.handleEnd)
    }
}