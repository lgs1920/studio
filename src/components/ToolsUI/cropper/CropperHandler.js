/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropperHandler.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-03
 * Last modified: 2025-10-03
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * CropperHandler handles crop region management for canvas, video, or image elements
 * NOTE:
 * - Drag interactions are NOT handled here (delegated to DragHandler).
 * - This class manages: initialization, resize via handles, styles, store sync, and cropping state.
 */
export class CropperHandler {
    /**
     * Mapping of handle directions to CSS cursor styles
     * @type {Array<Array<string>>}
     * @static
     */
    static handleMap = [
        ['nw', 'nwse-resize'],
        ['ne', 'nesw-resize'],
        ['se', 'nwse-resize'],
        ['sw', 'nesw-resize'],
        ['n', 'ns-resize'],
        ['e', 'ew-resize'],
        ['s', 'ns-resize'],
        ['w', 'ew-resize'],
    ]

    /**
     * Time-related and scaling constants
     * @static
     */
    static DOUBLE_TAP_THRESHOLD = 200
    static LONG_TAP_THRESHOLD = 500
    static CENTERING_TIMEOUT = 100
    static CENTERING_LOCK_TIMEOUT = 2000
    static RESET_CENTERING_INTERVAL = 100
    static TOUCH_MOVEMENT_TIMEOUT = 100
    static CROP_SCALE_FACTOR = 1
    static INIT_CROP_SCALE_FACTOR = 0.95
    static RESIZE_DEBOUNCE_MS = 100
    static MIN_CROP_SIZE = 100
    static CENTERING_LINES_TIMEOUT = 5000 // Timeout for centering lines in milliseconds

    // Private properties for event handling and state management
    #eventHandlers
    #lastClickTime = 0
    #touchStartPosition = null
    #doubleTapStartPosition = null
    #longTapTimer = null
    #timers = []
    #rafId = null
    isDestroyed = false
    #resizeStartState = null
    #savedCropState = null
    #centeringLockTimers = {horizontal: null, vertical: null}
    #centeringLinesTimer = null
    #debounceTimer = null
    #centeringInterval = null
    #cssCrop = {x: 0, y: 0, width: 0, height: 0}
    // Pointeur dernier connu pour calculer les deltas pendant le resize (évite movementX/Y à 0)
    #lastPointer = null

    /**
     * Creates a new CropperHandler instance
     * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} source - Element to crop
     * @param {HTMLElement} [container] - Container for bounds (defaults to source)
     * @param {Object} store - Valtio store for crop state
     * @param {Object} [options={}] - Configuration options
     */
    constructor(source, container, store, options = {}) {
        // Validate source element
        if (!source) {
            throw new Error('Source element is required')
        }
        this.source = source
        this.container = container || source
        this.store = store
        this.options = {
            draggable:     true, // ignored for drag (handled externally)
            resizable: true,
            lockCentering: true, // used only for style/feedback externally if needed
            vibrate: true,
            touchSensitivity: 3,
            lockRatio: true,
            ...options,
        }
        this.dpr = window.devicePixelRatio || 1
        // Initialize crop and cssCrop states
        this.crop = this.#initializeCrop()
        this.cssCrop = this.crop
        this.interactionState = {
            action: null,
            showHCenterLine: false,
            showVCenterLine: false,
            dragLockedHorizontal: false,
            dragLockedVertical: false,
            isCentering: false,
            wasJustCentered: false,
        }
        // Store event handlers for enable/disable
        this.#eventHandlers = {
            resize: this.debounce(() => this.updateCropOnSourceChange(), CropperHandler.RESIZE_DEBOUNCE_MS),
            keydown: (event) => {
                if (!this.isDestroyed && event.key === 'Escape') {
                    this.#closeCropper()
                }
            },
        }
        // Update store with initial crop
        this.#updateStore(this.crop)
        // Enable event listeners
        this.#enableEvents()
        // Start auto reset for central indicators
        this.resetCentering()
    }

    /**
     * Gets whether a cropping (resize) interaction is in progress
     * @returns {boolean} True if resizing is active
     */
    get cropping() {
        return this.interactionState.action?.startsWith('resize-') ?? false
    }

    /**
     * Gets the CSS crop values
     * @returns {Object} CSS crop values {x, y, width, height}
     */
    get cssCrop() {
        return this.#cssCrop
    }

    /**
     * Sets the CSS crop values, converting from physical crop if provided
     * @param {Object} crop - Physical crop values {x, y, width, height}
     */
    set cssCrop(crop) {
        this.#cssCrop = this.toCssCrop(crop)
    }

    /**
     * Converts physical crop to CSS crop by dividing by DPR
     * @param {Object} crop - Physical crop values
     * @returns {Object} CSS crop values
     */
    toCssCrop = (crop) => {
        return {
            x:      Math.floor(crop.x / this.dpr),
            y:      Math.floor(crop.y / this.dpr),
            width:  Math.floor(crop.width / this.dpr),
            height: Math.floor(crop.height / this.dpr),
        }
    }

    /**
     * Converts CSS crop to physical crop by multiplying by DPR
     * @param {Object} cssCrop - CSS crop values
     * @returns {Object} Physical crop values
     */
    toPhysicalCrop = (cssCrop) => {
        return {
            x:      Math.floor(cssCrop.x * this.dpr),
            y:      Math.floor(cssCrop.y * this.dpr),
            width:  Math.floor(cssCrop.width * this.dpr),
            height: Math.floor(cssCrop.height * this.dpr),
        }
    }

    /**
     * Enables all event listeners (resize, orientationchange, keydown)
     * @private
     */
    #enableEvents = () => {
        if (this.isDestroyed) {
            return
        }
        window.addEventListener('resize', this.#eventHandlers.resize)
        window.addEventListener('orientationchange', this.#eventHandlers.resize)
        window.addEventListener('keydown', this.#eventHandlers.keydown)
    }

    /**
     * Disables all event listeners (resize, orientationchange, keydown)
     * @private
     */
    #disableEvents = () => {
        if (this.isDestroyed) {
            return
        }
        window.removeEventListener('resize', this.#eventHandlers.resize)
        window.removeEventListener('orientationchange', this.#eventHandlers.resize)
        window.removeEventListener('keydown', this.#eventHandlers.keydown)
    }

    /**
     * Initializes crop region based on source bounds and aspect ratio
     * @returns {Object} Initial crop state with x, y, width, height
     * @private
     */
    #initializeCrop = () => {
        const bounds = this.getSourceBounds()
        const aspectRatio = this.store.width && this.store.height
                            ? this.store.width / this.store.height
                            : bounds.width / bounds.height
        return this.#computeCropDimensions(bounds, aspectRatio)
    }

    /**
     * Computes crop dimensions based on bounds and aspect ratio
     * @param {Object} bounds - Source bounds (x, y, width, height)
     * @param {number} aspectRatio - Desired aspect ratio (width/height)
     * @returns {Object} Crop state with x, y, width, height
     * @private
     */
    #computeCropDimensions = (bounds, aspectRatio) => {
        let width, height
        // Apply scale factor to bounds
        const maxWidth = Math.floor(bounds.width * CropperHandler.CROP_SCALE_FACTOR)
        const maxHeight = Math.floor(bounds.height * CropperHandler.CROP_SCALE_FACTOR)
        if (aspectRatio === 1) {
            width = height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.min(maxWidth, maxHeight)))
        }
        else if (aspectRatio < 1) {
            height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, maxHeight))
            width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, height * aspectRatio))
            if (width > maxWidth) {
                width = Math.floor(maxWidth)
                height = Math.floor(width / aspectRatio)
            }
        }
        else {
            width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, maxWidth))
            height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, width / aspectRatio))
            if (height > maxHeight) {
                height = Math.floor(maxHeight)
                width = Math.floor(height * aspectRatio)
            }
        }
        // Center initial crop
        const x = Math.floor((bounds.width - width) / 2)
        const y = Math.floor((bounds.height - height) / 2)
        return this.#clampCrop({x, y, width, height}, bounds)
    }

    /**
     * Clamps crop to bounds and ensures valid values
     * Preserves x/y; does NOT recenter automatically.
     * @param {Object} crop - Crop object (x, y, width, height)
     * @param {Object} bounds - Source bounds (x, y, width, height)
     * @returns {Object} Clamped crop object
     * @private
     */
    #clampCrop = (crop, bounds) => {
        // Ensure width/height are valid and within bounds
        const width = Math.floor(Math.max(
            CropperHandler.MIN_CROP_SIZE,
            Math.min(bounds.width, isNaN(crop.width) ? CropperHandler.MIN_CROP_SIZE : crop.width),
        ))
        const height = Math.floor(Math.max(
            CropperHandler.MIN_CROP_SIZE,
            Math.min(bounds.height, isNaN(crop.height) ? CropperHandler.MIN_CROP_SIZE : crop.height),
        ))

        // Preserve x/y and clamp them into the container
        let x = Math.floor(isNaN(crop.x) ? 0 : crop.x)
        let y = Math.floor(isNaN(crop.y) ? 0 : crop.y)

        // Prevent overflow on the right/bottom
        const maxX = Math.max(0, bounds.width - width)
        const maxY = Math.max(0, bounds.height - height)
        if (x > maxX) {
            x = maxX
        }
        if (y > maxY) {
            y = maxY
        }

        // Prevent negative values
        if (x < 0) {
            x = 0
        }
        if (y < 0) {
            y = 0
        }

        // Final guard
        if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
            console.error('Invalid crop values:', {crop, bounds})
            return {...this.crop}
        }

        return {x, y, width, height}
    }

    /**
     * Debounces a function to limit execution rate
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce = (func, wait) => {
        return (...args) => {
            clearTimeout(this.#debounceTimer)
            this.#debounceTimer = setTimeout(() => func.apply(this, args), wait)
            this.#timers.push(this.#debounceTimer)
        }
    }

    /**
     * Triggers a render update by dispatching a custom event
     * @private
     */
    #triggerRenderUpdate = () => {
        if (this.isDestroyed) {
            return
        }
        const updateEvent = new CustomEvent('onCropUpdate', {
            bubbles: true,
            cancelable: false,
            detail: {crop: {...this.crop}, cssCrop: {...this.cssCrop}, source: this.source},
        })
        this.source.dispatchEvent(updateEvent)
    }

    /**
     * Resets the crop state with new parameters
     * @param {Object} params - New crop parameters
     * @param {number|null} [params.aspectRatio] - Desired aspect ratio (width/height), null for free
     * @param {boolean} [params.lockRatio=true] - Whether to lock aspect ratio
     * @param {Object} [params.options={}] - New configuration options
     * @param {string} [params.source='unknown'] - Source of the reset call
     * @returns {Object} Updated crop state
     */
    resetCrop = (params = {}) => {
        if (this.isDestroyed) {
            return this.crop
        }
        this.handleEnd()
        this.#longTapTimer && clearTimeout(this.#longTapTimer)
        this.#timers.forEach(timer => typeof timer === 'number' && (clearTimeout(timer), clearInterval(timer)))
        this.#rafId && cancelAnimationFrame(this.#rafId)
        this.#timers = []
        this.#rafId = null
        this.interactionState = {
            action: null,
            showHCenterLine: false,
            showVCenterLine: false,
            dragLockedHorizontal: false,
            dragLockedVertical: false,
            isCentering: false,
            wasJustCentered: false,
        }
        this.#resizeStartState = null
        this.#savedCropState = null
        this.#centeringLockTimers = {horizontal: null, vertical: null}
        this.#centeringLinesTimer && clearTimeout(this.#centeringLinesTimer)
        this.#centeringLinesTimer = null
        this.options = {
            ...this.options,
            ...params.options,
            lockRatio: params.lockRatio ?? this.options.lockRatio ?? true,
        }
        const bounds = this.getSourceBounds()
        const aspectRatio = Number.isFinite(params.aspectRatio)
                            ? params.aspectRatio
                            : (this.options.lockRatio ? this.crop.width / this.crop.height || 1 : null)
        const crop = params.aspectRatio === null && !this.options.lockRatio
                     ? this.#clampCrop({
                                           x:      Math.floor((bounds.width - bounds.width * CropperHandler.CROP_SCALE_FACTOR) / 2),
                                           y:      Math.floor((bounds.height - bounds.height * CropperHandler.CROP_SCALE_FACTOR) / 2),
                                           width:  Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, bounds.width * CropperHandler.CROP_SCALE_FACTOR)),
                                           height: Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, bounds.height * CropperHandler.CROP_SCALE_FACTOR)),
                                       }, bounds)
                     : this.#computeCropDimensions(bounds, aspectRatio)
        this.crop = crop
        this.cssCrop = crop
        this.store.lockRatio = this.options.lockRatio
        this.store.aspectRatio = this.options.lockRatio ? aspectRatio : null
        this.#updateStore(this.crop)
        return this.crop
    }

    /**
     * Gets source element bounds in device pixels
     * @returns {Object} Bounds with x, y, width, height
     */
    getSourceBounds = () => {
        const rect = this.container.getBoundingClientRect()
        return {
            x: Math.floor(rect.left * this.dpr),
            y: Math.floor(rect.top * this.dpr),
            width: Math.floor(rect.width * this.dpr),
            height: Math.floor(rect.height * this.dpr),
        }
    }

    /**
     * Checks if the crop area is centered in its container
     * @returns {boolean} True if the crop area is centered within a 5-pixel tolerance
     */
    isCropCentered = () => {
        const bounds = this.getSourceBounds()
        const sourceCenterX = Math.floor(bounds.width / 2)
        const sourceCenterY = Math.floor(bounds.height / 2)
        const cropCenterX = Math.floor(this.crop.x + this.crop.width / 2)
        const cropCenterY = Math.floor(this.crop.y + this.crop.height / 2)
        const tolerance = 5 // Pixels tolerance
        return (
            Math.abs(cropCenterX - sourceCenterX) < tolerance &&
            Math.abs(cropCenterY - sourceCenterY) < tolerance
        )
    }

    /**
     * Calculates styles for crop elements
     * @param {Object} crop - Crop region (x, y, width, height)
     * @param {Object} interactionState - Current interaction state
     * @returns {Object} Styles for crop elements
     */
    getStyles = (crop, interactionState = this.interactionState) => {
        const sourceBounds = this.getSourceBounds()
        // Use cssCrop directly for styling
        const cropX = this.cssCrop.x
        const cropY = this.cssCrop.y
        const cropWidth = this.cssCrop.width
        const cropHeight = this.cssCrop.height
        return {
            overlayStyle:           {
                clipPath: `polygon(
                    0% 0%, 100% 0%, 100% 100%, 0% 100%,
                    0% ${cropY}px,
                    ${cropX}px ${cropY}px,
                    ${cropX}px ${cropY + cropHeight}px,
                    ${cropX + cropWidth}px ${cropY + cropHeight}px,
                    ${cropX + cropWidth}px ${cropY}px,
                    0% ${cropY}px
                )`,
            },
            hCenterLineLeftStyle:   {
                left: 0,
                top: Math.floor(cropY + cropHeight / 2),
                width: Math.max(0, Math.floor(cropX)),
            },
            hCenterLineRightStyle:  {
                left: Math.floor(cropX + cropWidth),
                top:  Math.floor(cropY + cropHeight / 2),
                width: Math.max(0, Math.floor(sourceBounds.width / this.dpr - (cropX + cropWidth))),
            },
            vCenterLineTopStyle:    {
                top: 0,
                left: Math.floor(cropX + cropWidth / 2),
                height: Math.max(0, Math.floor(cropY)),
            },
            vCenterLineBottomStyle: {
                top:  Math.floor(cropY + cropHeight),
                left: Math.floor(cropX + cropWidth / 2),
                height: Math.max(0, Math.floor(sourceBounds.height / this.dpr - (cropY + cropHeight))),
            },
        }
    }

    /**
     * Updates crop dimensions on source change (e.g., resize)
     * @returns {Object} Updated crop
     */
    updateCropOnSourceChange = () => {
        const bounds = this.getSourceBounds()
        const aspectRatio = this.store.lockRatio && Number.isFinite(this.store.aspectRatio)
                            ? this.store.aspectRatio
                            : this.crop.width / this.crop.height || 1
        this.crop = this.store.lockRatio
                    ? this.#computeCropDimensions(bounds, aspectRatio)
                    : this.#clampCrop({
                                          x:      Math.floor((bounds.width - bounds.width * CropperHandler.CROP_SCALE_FACTOR) / 2),
                                          y:      Math.floor((bounds.height - bounds.height * CropperHandler.CROP_SCALE_FACTOR) / 2),
                                          width:  Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, bounds.width * CropperHandler.CROP_SCALE_FACTOR)),
                                          height: Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, bounds.height * CropperHandler.CROP_SCALE_FACTOR)),
                                      }, bounds)
        this.cssCrop = this.crop
        this.#updateStore(this.crop)
        return this.crop
    }

    /**
     * Checks if touch movement is significant for drag
     * (Drag is external; this helper remains for potential future gestures)
     * @param {TouchEvent} event - Touch event
     * @param {number} sensitivity - Sensitivity threshold in pixels
     * @returns {boolean} True if movement exceeds threshold
     * @private
     */
    #isSignificantTouchMovement = (event, sensitivity) => {
        if (!this.#touchStartPosition || !event.touches || event.touches.length !== 1) {
            return true
        }
        const touch = event.touches[0]
        const deltaX = Math.abs(touch.clientX - this.#touchStartPosition.x)
        const deltaY = Math.abs(touch.clientY - this.#touchStartPosition.y)
        const timeDelta = Date.now() - this.#touchStartPosition.time
        return deltaX > sensitivity || deltaY > sensitivity || timeDelta > CropperHandler.TOUCH_MOVEMENT_TIMEOUT
    }

    /**
     * Handles interaction start
     * Only handles resize-*, NOT drag
     * @param {string} action - 'resize-<direction>'
     * @param {Event} event - DOM event
     * @param {Object} cropper - Cropper state
     * @returns {Object|undefined} Updated crop or undefined
     */
    handleStart = (action, event, cropper) => {
        if (cropper.recording || this.isDestroyed) {
            return
        }
        // Drag is NOT handled here anymore (delegated to DragHandler)
        if (!action || !action.startsWith('resize-')) {
            return this.crop
        }

        this.interactionState.action = action
        this.source.classList.add('cropping') // Add cropping class
        const aspectRatio = cropper.lockRatio
                            ? (Number.isFinite(cropper.aspectRatio) ? cropper.aspectRatio : this.crop.width / this.crop.height || 1)
                            : (event.shiftKey ? this.crop.width / this.crop.height || 1 : null)

        // Capture position du pointeur pour des deltas fiables
        if (event && ('clientX' in event || (event.touches && event.touches.length))) {
            const p = event.touches && event.touches.length ? event.touches[0] : event
            this.#lastPointer = {x: p.clientX, y: p.clientY}
        }
        else {
            this.#lastPointer = null
        }

        this.#resizeStartState = {
            crop:      {...this.crop},
            centerX: Math.floor(this.crop.x + this.crop.width / 2),
            centerY: Math.floor(this.crop.y + this.crop.height / 2),
            // Force symmetric resizing anchored to the center
            isSymmetric: true,
            lockRatio: cropper.lockRatio,
            aspectRatio,
        }

        return this.crop
    }

    /**
     * Handles movement during resize
     * Only applies when action is resize-*
     * @param {Event} event - DOM event
     * @param {Object} cropper - Cropper state
     * @param {Object} bounds - Source bounds
     * @returns {Object} Updated crop and interaction state
     */
    handleMove = (event, cropper, bounds) => {
        if (!this.interactionState.action || !this.interactionState.action.startsWith('resize-') || cropper.recording || this.isDestroyed) {
            return {crop: this.crop, interaction: this.interactionState}
        }

        // Mouse safety: if buttons == 0, the mouse is up; end the resize now.
        if ('buttons' in event && event.buttons === 0) {
            const interaction = this.handleEnd(event)
            return {crop: this.crop, interaction}
        }

        const newCrop = {...this.crop}
        const newInteraction = {...this.interactionState}

        // Calcule delta via positions absolues (clientX/clientY) -> plus fiable que movementX/Y
        let deltaX = 0
        let deltaY = 0
        if (event && ('clientX' in event || (event.touches && event.touches.length))) {
            const p = event.touches && event.touches.length ? event.touches[0] : event
            if (this.#lastPointer) {
                deltaX = Math.floor((p.clientX - this.#lastPointer.x) * this.dpr)
                deltaY = Math.floor((p.clientY - this.#lastPointer.y) * this.dpr)
            }
            this.#lastPointer = {x: p.clientX, y: p.clientY}
        }
        else {
            // Fallback au cas où
            deltaX = Math.floor((event.movementX || 0) * this.dpr)
            deltaY = Math.floor((event.movementY || 0) * this.dpr)
        }

        const direction = this.interactionState.action.replace('resize-', '')
        // Always symmetric around center while resizing
        this.#resizeStartState.isSymmetric = true

        this.#handleResize(
            newCrop,
            direction,
            deltaX,
            deltaY,
            this.#resizeStartState.isSymmetric,
            cropper.lockRatio,
            this.#resizeStartState.aspectRatio,
            bounds,
        )

        // Clamp without recentering
        this.crop = this.#clampCrop(newCrop, bounds)
        this.cssCrop = this.crop
        this.interactionState = newInteraction
        this.#updateStore(this.crop)
        return {crop: this.crop, interaction: this.interactionState}
    }

    /**
     * Handles resize operations
     * @param {Object} crop - Crop object to modify
     * @param {string} direction - Resize direction (nw, ne, se, sw, n, e, s, w)
     * @param {number} deltaX - Horizontal movement delta
     * @param {number} deltaY - Vertical movement delta
     * @param {boolean} isSymmetric - Whether to resize symmetrically (center anchored)
     * @param {boolean} lockRatio - Whether to maintain aspect ratio
     * @param {number|null} aspectRatio - Aspect ratio to use (null for free resize)
     * @param {Object} bounds - Source bounds
     * @private
     */
    #handleResize = (crop, direction, deltaX, deltaY, isSymmetric, lockRatio, aspectRatio, bounds) => {
        const effectiveAspectRatio = lockRatio ? (Number.isFinite(aspectRatio) ? aspectRatio : 1) : (aspectRatio || 1)
        const centerX = this.#resizeStartState?.centerX ?? Math.floor(crop.x + crop.width / 2)
        const centerY = this.#resizeStartState?.centerY ?? Math.floor(crop.y + crop.height / 2)
        const original = {x: crop.x, y: crop.y, width: crop.width, height: crop.height}

        if (isSymmetric) {
            // Corner vectors to detect inward/outward movement
            const cornerVec = {
                nw: {x: -1, y: -1},
                ne: {x: 1, y: -1},
                se: {x: 1, y: 1},
                sw: {x: -1, y: 1},
            }

            if (cornerVec[direction]) {
                const v = cornerVec[direction]
                const proj = (deltaX * v.x) + (deltaY * v.y) // sign outward/inward
                const mag = Math.max(Math.abs(deltaX), Math.abs(deltaY))
                const signedDelta = Math.floor(mag * (proj === 0 ? 0 : (proj > 0 ? 1 : -1)))

                if (lockRatio || aspectRatio) {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + signedDelta * 2))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.width / effectiveAspectRatio)))
                }
                else {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + signedDelta * 2))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height + signedDelta * 2))
                }
            }
            else if (direction === 'n' || direction === 's') {
                const signedDelta = Math.floor(deltaY * (direction === 'n' ? -1 : 1))
                if (lockRatio || aspectRatio) {
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height + signedDelta * 2))
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.height * effectiveAspectRatio)))
                }
                else {
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height + signedDelta * 2))
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + signedDelta * 2))
                }
            }
            else if (direction === 'e' || direction === 'w') {
                const signedDelta = Math.floor(deltaX * (direction === 'w' ? -1 : 1))
                if (lockRatio || aspectRatio) {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + signedDelta * 2))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.width / effectiveAspectRatio)))
                }
                else {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + signedDelta * 2))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height + signedDelta * 2))
                }
            }

            // Re-anchor around initial center
            crop.x = Math.floor(centerX - crop.width / 2)
            crop.y = Math.floor(centerY - crop.height / 2)

            // Clamp inside bounds
            if (crop.x < 0) {
                crop.x = 0
            }
            if (crop.y < 0) {
                crop.y = 0
            }
            if (crop.x + crop.width > bounds.width) {
                crop.x = Math.max(0, bounds.width - crop.width)
            }
            if (crop.y + crop.height > bounds.height) {
                crop.y = Math.max(0, bounds.height - crop.height)
            }
            return
        }

        // Non-symmetric mode (not used in current flow, kept for completeness)
        if (lockRatio || aspectRatio) {
            switch (direction) {
                case 'nw': {
                    const dx = Math.floor(Math.max(Math.abs(deltaX), Math.abs(deltaY) * effectiveAspectRatio) * (deltaX < 0 ? -1 : 1))
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width - dx))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.width / effectiveAspectRatio)))
                    crop.x = Math.floor(original.x + original.width - crop.width)
                    crop.y = Math.floor(original.y + original.height - crop.height)
                    break
                }
                case 'ne': {
                    const dx = Math.floor(Math.max(Math.abs(deltaX), Math.abs(deltaY) * effectiveAspectRatio) * (deltaX > 0 ? 1 : -1))
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + dx))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.width / effectiveAspectRatio)))
                    crop.y = Math.floor(original.y + original.height - crop.height)
                    break
                }
                case 'se': {
                    const dx = Math.floor(Math.max(Math.abs(deltaX), Math.abs(deltaY) * effectiveAspectRatio) * (deltaX > 0 ? 1 : -1))
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + dx))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.width / effectiveAspectRatio)))
                    break
                }
                case 'sw': {
                    const dx = Math.floor(Math.max(Math.abs(deltaX), Math.abs(deltaY) * effectiveAspectRatio) * (deltaX < 0 ? -1 : 1))
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width - dx))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.width / effectiveAspectRatio)))
                    crop.x = Math.floor(original.x + original.width - crop.width)
                    break
                }
                case 'n': {
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height - deltaY))
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.height * effectiveAspectRatio)))
                    crop.y = Math.floor(original.y + original.height - crop.height)
                    crop.x = Math.floor(original.x + (original.width - crop.width) / 2)
                    break
                }
                case 's': {
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height + deltaY))
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.height * effectiveAspectRatio)))
                    crop.x = Math.floor(original.x + (original.width - crop.width) / 2)
                    break
                }
                case 'e': {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + deltaX))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.width / effectiveAspectRatio)))
                    crop.y = Math.floor(original.y + (original.height - crop.height) / 2)
                    break
                }
                case 'w': {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width - deltaX))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, Math.floor(crop.width / effectiveAspectRatio)))
                    crop.x = Math.floor(original.x + original.width - crop.width)
                    crop.y = Math.floor(original.y + (original.height - crop.height) / 2)
                    break
                }
            }
        }
        else {
            switch (direction) {
                case 'nw': {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width - deltaX))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height - deltaY))
                    crop.x = Math.floor(original.x + original.width - crop.width)
                    crop.y = Math.floor(original.y + original.height - crop.height)
                    break
                }
                case 'ne': {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + deltaX))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height - deltaY))
                    crop.y = Math.floor(original.y + original.height - crop.height)
                    break
                }
                case 'se': {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + deltaX))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height + deltaY))
                    break
                }
                case 'sw': {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width - deltaX))
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height + deltaY))
                    crop.x = Math.floor(original.x + original.width - crop.width)
                    break
                }
                case 'n': {
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height - deltaY))
                    crop.y = Math.floor(original.y + original.height - crop.height)
                    break
                }
                case 'e': {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width + deltaX))
                    break
                }
                case 's': {
                    crop.height = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.height + deltaY))
                    break
                }
                case 'w': {
                    crop.width = Math.floor(Math.max(CropperHandler.MIN_CROP_SIZE, original.width - deltaX))
                    crop.x = Math.floor(original.x + original.width - crop.width)
                    break
                }
            }
        }
    }

    /**
     * Handles interaction end
     * @param {Event} [event] - Optional DOM event for key state
     * @returns {Object} Updated interaction state
     */
    handleEnd = (event) => {
        if (this.isDestroyed) {
            return this.interactionState
        }
        this.#longTapTimer && clearTimeout(this.#longTapTimer)
        this.#longTapTimer = null
        this.#centeringLinesTimer && clearTimeout(this.#centeringLinesTimer)
        this.#centeringLinesTimer = null
        if (this.#resizeStartState && event && 'shiftKey' in event) {
            this.#resizeStartState.isSymmetric = this.store.lockRatio ? !event.shiftKey : event.shiftKey
        }
        // Reset du pointeur pour le prochain cycle
        this.#lastPointer = null

        this.interactionState.action = null
        this.interactionState.isCentering = false
        this.#resizeStartState = null
        this.source.classList.remove('cropping') // Remove cropping class
        this.#updateStore(this.crop)
        this.#timers.push(setTimeout(() => {
            if (!this.isDestroyed) {
                this.interactionState.wasJustCentered = false
            }
        }, CropperHandler.CENTERING_TIMEOUT))
        return this.interactionState
    }

    /**
     * Updates store if crop values change
     * @param {Object} newCrop - New crop values (x, y, width, height)
     * @private
     */
    #updateStore = (newCrop) => {
        if (this.isDestroyed || isNaN(newCrop.x) || isNaN(newCrop.y) || isNaN(newCrop.width) || isNaN(newCrop.height)) {
            console.error('Invalid crop values for store:', newCrop)
            return
        }
        this.store.x = Math.floor(newCrop.x)
        this.store.y = Math.floor(newCrop.y)
        this.store.width = Math.floor(newCrop.width)
        this.store.height = Math.floor(newCrop.height)
        this.store.lockRatio = this.options.lockRatio
        this.#triggerRenderUpdate()
    }

    /**
     * Centers the crop region
     * @param {Object} cropper - Cropper state
     * @returns {Object} Updated crop
     */
    centerCrop = (cropper) => {
        const bounds = this.getSourceBounds()
        const newCrop = {
            ...this.crop,
            x: Math.floor((bounds.width - this.crop.width) / 2),
            y: Math.floor((bounds.height - this.crop.height) / 2),
        }
        this.crop = this.#clampCrop(newCrop, bounds)
        this.cssCrop = this.crop
        this.#updateStore(this.crop)
        return this.crop
    }

    /**
     * Toggles maximized/restored crop states
     * @param {Object} cropper - Cropper state
     * @returns {Object} Updated crop
     */
    maximizeRestore = (cropper) => {
        const bounds = this.getSourceBounds()
        const newCrop = {...this.crop}
        const ratio = this.crop.width / this.crop.height || 1
        const expectedX = Math.floor((bounds.width - newCrop.width) / 2)
        const expectedY = Math.floor((bounds.height - newCrop.height) / 2)
        const isMaximized = Math.abs(newCrop.x - expectedX) < 5 && Math.abs(newCrop.y - expectedY) < 5 &&
            (cropper.lockRatio
             ? (Math.abs(newCrop.width - bounds.width) < 5 || Math.abs(newCrop.height - bounds.height) < 5)
             : (Math.abs(newCrop.width - bounds.width) < 5 && Math.abs(newCrop.height - bounds.height) < 5))
        if (isMaximized && this.#savedCropState) {
            newCrop.x = Math.floor(this.#savedCropState.x)
            newCrop.y = Math.floor(this.#savedCropState.y)
            newCrop.width = Math.floor(this.#savedCropState.width)
            newCrop.height = Math.floor(this.#savedCropState.height)
            this.#savedCropState = null
        }
        else {
            if (!isMaximized) {
                this.#savedCropState = {x: newCrop.x, y: newCrop.y, width: newCrop.width, height: newCrop.height}
            }
            if (cropper.lockRatio) {
                const effectiveAspectRatio = Number.isFinite(cropper.aspectRatio) ? cropper.aspectRatio : ratio
                if (ratio === 1) {
                    newCrop.width = newCrop.height = Math.floor(Math.min(bounds.width, bounds.height))
                }
                else if (ratio < 1) {
                    newCrop.height = Math.floor(bounds.height)
                    newCrop.width = Math.floor(newCrop.height * effectiveAspectRatio)
                    if (newCrop.width > bounds.width) {
                        newCrop.width = Math.floor(bounds.width)
                        newCrop.height = Math.floor(newCrop.width / effectiveAspectRatio)
                    }
                }
                else {
                    newCrop.width = Math.floor(bounds.width)
                    newCrop.height = Math.floor(newCrop.width / effectiveAspectRatio)
                    if (newCrop.height > bounds.height) {
                        newCrop.height = Math.floor(bounds.height)
                        newCrop.width = Math.floor(newCrop.height * effectiveAspectRatio)
                    }
                }
            }
            else {
                newCrop.x = 0
                newCrop.y = 0
                newCrop.width = Math.floor(bounds.width)
                newCrop.height = Math.floor(bounds.height)
            }
            newCrop.x = Math.floor((bounds.width - newCrop.width) / 2)
            newCrop.y = Math.floor((bounds.height - newCrop.height) / 2)
        }
        this.crop = this.#clampCrop(newCrop, bounds)
        this.cssCrop = this.crop
        this.#updateStore(this.crop)
        return this.crop
    }

    /**
     * Closes cropper and dispatches onClose event
     * @private
     */
    #closeCropper = () => {
        if (this.isDestroyed) {
            return
        }
        const closeEvent = new CustomEvent('onCropperClose', {
            bubbles: true,
            cancelable: true,
            detail: {crop: {...this.crop}, cssCrop: {...this.cssCrop}},
        })
        this.source.dispatchEvent(closeEvent)
        this.destroy()
    }

    /**
     * Resets centering lines when idle
     * @returns {Function} Cleanup function
     */
    resetCentering = () => {
        if (this.#centeringInterval) {
            clearInterval(this.#centeringInterval)
        }
        this.#centeringInterval = setInterval(() => {
            if (!this.interactionState.action && !this.isDestroyed) {
                this.interactionState.showHCenterLine = false
                this.interactionState.showVCenterLine = false
                this.#triggerRenderUpdate()
            }
        }, CropperHandler.RESET_CENTERING_INTERVAL)
        this.#timers.push(this.#centeringInterval)
        this.#centeringLinesTimer && clearTimeout(this.#centeringLinesTimer)
        this.#centeringLinesTimer = null
        return () => clearInterval(this.#centeringInterval)
    }

    /**
     * Cleans up timers, animation frames, and event listeners
     */
    destroy = () => {
        this.isDestroyed = true
        this.#timers.forEach(timer => typeof timer === 'number' && (clearTimeout(timer), clearInterval(timer)))
        this.#centeringLockTimers.horizontal && clearTimeout(this.#centeringLockTimers.horizontal)
        this.#centeringLockTimers.vertical && clearTimeout(this.#centeringLockTimers.vertical)
        this.#longTapTimer && clearTimeout(this.#longTapTimer)
        this.#debounceTimer && clearTimeout(this.#debounceTimer)
        this.#centeringLinesTimer && clearTimeout(this.#centeringLinesTimer)
        clearInterval(this.#centeringInterval)
        this.#timers = []
        this.#rafId && cancelAnimationFrame(this.#rafId)
        this.#rafId = null
        this.#resizeStartState = null
        this.#savedCropState = null
        this.#centeringLockTimers = {horizontal: null, vertical: null}
        this.#longTapTimer = null
        this.#debounceTimer = null
        this.#centeringLinesTimer = null
        this.#centeringInterval = null
        this.source.classList.remove('cropping') // Ensure cropping class is removed on destroy
        this.#disableEvents()
    }
}