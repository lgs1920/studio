/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropperManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-08-20
 * Last modified: 2025-08-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * CropperManager handles crop region management for canvas, video, or image elements
 * @class CropperManager
 */
class CropperManager {
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

    /**
     * Creates a new CropperManager instance
     * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} source - Element to crop
     * @param {HTMLElement} [container] - Container for bounds (defaults to source)
     * @param {Object} store - Valtio store for crop state
     * @param {Object} [options={}] - Configuration options
     */
    constructor(source, container, store, options = {}) {
        if (!source) {
            throw new Error('Source element is required')
        }
        this.source = source
        this.container = container || source
        this.store = store
        this.options = {
            draggable: true,
            resizable: true,
            lockCentering: true,
            vibrate: true,
            touchSensitivity: 3,
            lockRatio: true,
            ...options,
        }
        this.dpr = window.devicePixelRatio || 1


        // Initialize crop and interaction state
        this.crop = this.#initializeCrop()
        this.interactionState = {
            action:          null,
            showHCenterLine: false,
            showVCenterLine: false,
            dragLockedHorizontal: false,
            dragLockedVertical: false,
            isCentering:     false,
            wasJustCentered: false,
        }

        // Store event handlers for enable/disable
        this.#eventHandlers = {
            resize:  this.debounce(() => this.updateCropOnSourceChange(), CropperManager.RESIZE_DEBOUNCE_MS),
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
     * Enables all event listeners (resize, orientationchange, keydown)
     * @function
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
     * @function
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
        const maxWidth = Math.floor(bounds.width * CropperManager.CROP_SCALE_FACTOR)
        const maxHeight = Math.floor(bounds.height * CropperManager.CROP_SCALE_FACTOR)

        if (aspectRatio === 1) {
            // Square crop
            width = height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, Math.min(maxWidth, maxHeight)))
        }
        else if (aspectRatio < 1) {
            // Portrait orientation
            height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, maxHeight))
            width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, height * aspectRatio))
            if (width > maxWidth) {
                width = Math.floor(maxWidth)
                height = Math.floor(width / aspectRatio)
            }
        }
        else {
            // Landscape orientation
            width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, maxWidth))
            height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, width / aspectRatio))
            if (height > maxHeight) {
                height = Math.floor(maxHeight)
                width = Math.floor(height * aspectRatio)
            }
        }

        // Ensure crop is centered
        const x = Math.floor((bounds.width - width) / 2)
        const y = Math.floor((bounds.height - height) / 2)

        return this.#clampCrop({x, y, width, height}, bounds)
    }

    /**
     * Clamps crop to bounds and ensures valid values
     * @param {Object} crop - Crop object (x, y, width, height)
     * @param {Object} bounds - Source bounds (x, y, width, height)
     * @returns {Object} Clamped crop object
     * @private
     */
    #clampCrop = (crop, bounds) => {
        const result = {
            width:  Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, Math.min(bounds.width, crop.width))),
            height: Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, Math.min(bounds.height, crop.height))),
        }

        // Calculate x and y to ensure centering
        result.x = Math.floor((bounds.width - result.width) / 2)
        result.y = Math.floor((bounds.height - result.height) / 2)

        // Additional checks to prevent negative or invalid values
        if (result.x < 0 || result.y < 0 || isNaN(result.x) || isNaN(result.y) || isNaN(result.width) || isNaN(result.height)) {
            console.error('Invalid crop values:', {crop, bounds})
            return {...this.crop}
        }

        return result
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
     * @function
     * @private
     */
    #triggerRenderUpdate = () => {
        if (this.isDestroyed) {
            return
        }
        const updateEvent = new CustomEvent('onCropUpdate', {
            bubbles:    true,
            cancelable: false,
            detail:     {crop: {...this.crop}, source: this.source},
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
            action:          null,
            showHCenterLine: false,
            showVCenterLine: false,
            dragLockedHorizontal: false,
            dragLockedVertical: false,
            isCentering:     false,
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

        this.crop = params.aspectRatio === null && !this.options.lockRatio
                    ? this.#clampCrop({
                                          x:      Math.floor((bounds.width - bounds.width * CropperManager.CROP_SCALE_FACTOR) / 2),
                                          y:      Math.floor((bounds.height - bounds.height * CropperManager.CROP_SCALE_FACTOR) / 2),
                                          width:  Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, bounds.width * CropperManager.CROP_SCALE_FACTOR)),
                                          height: Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, bounds.height * CropperManager.CROP_SCALE_FACTOR)),
                                      }, bounds)
                    : this.#computeCropDimensions(bounds, aspectRatio)

        this.store.lockRatio = this.options.lockRatio
        this.store.aspectRatio = this.options.lockRatio ? aspectRatio : null
        this.#updateStore(this.crop)
        this.#triggerRenderUpdate()
        return this.crop
    }

    /**
     * Gets source element bounds in device pixels
     * @returns {Object} Bounds with x, y, width, height
     */
    getSourceBounds = () => {
        const rect = this.container.getBoundingClientRect()
        return {
            x:      Math.floor(rect.left * this.dpr),
            y:      Math.floor(rect.top * this.dpr),
            width:  Math.floor(rect.width * this.dpr),
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
    getStyles = (crop, interactionState) => {
        const sourceBounds = this.getSourceBounds()
        const dpr = this.dpr
        const cropX = Math.floor(crop.x / dpr)
        const cropY = Math.floor(crop.y / dpr)
        const cropWidth = Math.floor(crop.width / dpr)
        const cropHeight = Math.floor(crop.height / dpr)
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
                left:  0,
                top:   Math.floor(cropY + cropHeight / 2),
                width: Math.max(0, Math.floor(cropX)),
            },
            hCenterLineRightStyle:  {
                left:  Math.floor(cropX + cropWidth),
                top:   Math.floor(cropY + cropHeight / 2),
                width: Math.max(0, Math.floor(sourceBounds.width / dpr - (cropX + cropWidth))),
            },
            vCenterLineTopStyle:    {
                top:    0,
                left:   Math.floor(cropX + cropWidth / 2),
                height: Math.max(0, Math.floor(cropY)),
            },
            vCenterLineBottomStyle: {
                top:    Math.floor(cropY + cropHeight),
                left:   Math.floor(cropX + cropWidth / 2),
                height: Math.max(0, Math.floor(sourceBounds.height / dpr - (cropY + cropHeight))),
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
                                          x:      Math.floor((bounds.width - bounds.width * CropperManager.CROP_SCALE_FACTOR) / 2),
                                          y:      Math.floor((bounds.height - bounds.height * CropperManager.CROP_SCALE_FACTOR) / 2),
                                          width:  Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, bounds.width * CropperManager.CROP_SCALE_FACTOR)),
                                          height: Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, bounds.height * CropperManager.CROP_SCALE_FACTOR)),
                                      }, bounds)
        this.#updateStore(this.crop)
        return this.crop
    }

    /**
     * Checks if touch movement is significant for drag
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
        return deltaX > sensitivity || deltaY > sensitivity || timeDelta > CropperManager.TOUCH_MOVEMENT_TIMEOUT
    }

    /**
     * Handles interaction start
     * @param {string} action - Action type ('drag' or 'resize-<direction>')
     * @param {Event} event - DOM event
     * @param {Object} cropper - Cropper state
     * @returns {Object|undefined} Updated crop or undefined
     */
    handleStart = (action, event, cropper) => {
        if (cropper.recording || this.isDestroyed) {
            return
        }
        if (event.type === 'contextmenu') {
            event.preventDefault()
            event.stopPropagation()
            if (action === 'drag') {
                const newCrop = this.maximizeRestore(cropper)
                this.#updateStore(newCrop)
                return newCrop
            }
        }
        this.interactionState.wasJustCentered = false
        this.#longTapTimer && clearTimeout(this.#longTapTimer)
        this.#longTapTimer = null

        const isTouch = event.type === 'touchstart' && event.touches && event.touches.length === 1
        const currentTime = Date.now()
        if (isTouch) {
            const touch = event.touches[0]
            this.#touchStartPosition = {x: touch.clientX, y: touch.clientY, time: currentTime}
            const isDoubleTap = action === 'drag' &&
                (currentTime - this.#lastClickTime) < CropperManager.DOUBLE_TAP_THRESHOLD &&
                this.#doubleTapStartPosition &&
                Math.abs(touch.clientX - this.#doubleTapStartPosition.x) < 10 &&
                Math.abs(touch.clientY - this.#doubleTapStartPosition.y) < 10
            this.#lastClickTime = currentTime
            this.#doubleTapStartPosition = {x: touch.clientX, y: touch.clientY}
            if (isDoubleTap) {
                this.#closeCropper()
                return
            }
            this.#longTapTimer = setTimeout(() => {
                if (!this.isDestroyed && !this.#isSignificantTouchMovement({
                                                                               touches: [
                                                                                   {
                                                                                       clientX: touch.clientX,
                                                                                       clientY: touch.clientY,
                                                                                   },
                                                                               ],
                                                                           }, this.options.touchSensitivity)) {
                    const newCrop = this.maximizeRestore(cropper)
                    this.#updateStore(newCrop)
                    if (this.options.vibrate && navigator.vibrate) {
                        navigator.vibrate(50)
                    }
                    this.#longTapTimer = null
                }
            }, CropperManager.LONG_TAP_THRESHOLD)
            this.#timers.push(this.#longTapTimer)
        }
        else if (event.type === 'mousedown') {
            this.#lastClickTime = currentTime
            if (action === 'drag' && event.button === 0 &&
                (currentTime - this.#lastClickTime) < CropperManager.DOUBLE_TAP_THRESHOLD) {
                this.#closeCropper()
                return
            }
        }

        if (action === 'drag' && event.ctrlKey && !event.touches && !event.shiftKey && event.button === 0) {
            this.interactionState.isCentering = true
            this.interactionState.action = 'centering'
            const newCrop = this.centerCrop(cropper)
            this.#updateStore(newCrop)
            this.#timers.push(setTimeout(() => {
                if (!this.isDestroyed) {
                    this.interactionState.isCentering = false
                    this.interactionState.wasJustCentered = true
                    this.interactionState.action = null
                }
            }, CropperManager.CENTERING_TIMEOUT))
            return newCrop
        }

        if ((action === 'drag' || action.startsWith('resize-')) && (event.button === 0 || isTouch)) {
            this.interactionState.action = action
            if (action.startsWith('resize-')) {
                const aspectRatio = cropper.lockRatio
                                    ? (Number.isFinite(cropper.aspectRatio) ? cropper.aspectRatio : this.crop.width / this.crop.height || 1)
                                    : (event.shiftKey ? this.crop.width / this.crop.height || 1 : null)
                this.#resizeStartState = {
                    crop:    {...this.crop},
                    centerX: Math.floor(this.crop.x + this.crop.width / 2),
                    centerY: Math.floor(this.crop.y + this.crop.height / 2),
                    isSymmetric: cropper.lockRatio ? !event.shiftKey : event.shiftKey,
                    lockRatio: cropper.lockRatio,
                    aspectRatio,
                }
            }
        }
        return this.crop
    }

    /**
     * Handles movement during drag or resize
     * @param {Event} event - DOM event
     * @param {Object} cropper - Cropper state
     * @param {Object} bounds - Source bounds
     * @returns {Object} Updated crop and interaction state
     */
    handleMove = (event, cropper, bounds) => {
        if (!this.interactionState.action || cropper.recording || this.isDestroyed) {
            return {crop: this.crop, interaction: this.interactionState}
        }
        if (this.#longTapTimer && this.#isSignificantTouchMovement(event, this.options.touchSensitivity)) {
            clearTimeout(this.#longTapTimer)
            this.#longTapTimer = null
        }

        const newCrop = {...this.crop}
        const newInteraction = {...this.interactionState}
        const deltaX = Math.floor((event.movementX || (event.touches && event.touches.length === 1 ? event.touches[0].clientX - this.#touchStartPosition.x : 0)) * this.dpr)
        const deltaY = Math.floor((event.movementY || (event.touches && event.touches.length === 1 ? event.touches[0].clientY - this.#touchStartPosition.y : 0)) * this.dpr)

        if (this.interactionState.action === 'drag') {
            newCrop.x = Math.floor(Math.max(0, Math.min(newCrop.x + deltaX, bounds.width - newCrop.width)))
            newCrop.y = Math.floor(Math.max(0, Math.min(newCrop.y + deltaY, bounds.height - newCrop.height)))
            if (event.touches && event.touches.length === 1) {
                this.#touchStartPosition = {x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now()}
            }

            const sourceCenterX = Math.floor(bounds.width / 2)
            const sourceCenterY = Math.floor(bounds.height / 2)
            const cropCenterX = Math.floor(newCrop.x + newCrop.width / 2)
            const cropCenterY = Math.floor(newCrop.y + newCrop.height / 2)
            const isHCentered = Math.abs(cropCenterX - sourceCenterX) < 5
            const isVCentered = Math.abs(cropCenterY - sourceCenterY) < 5
            newInteraction.showVCenterLine = isHCentered
            newInteraction.showHCenterLine = isVCentered

            // Start or reset centering lines timeout
            if (isHCentered || isVCentered) {
                this.#centeringLinesTimer && clearTimeout(this.#centeringLinesTimer)
                this.#centeringLinesTimer = setTimeout(() => {
                    if (!this.isDestroyed) {
                        this.interactionState.showHCenterLine = false
                        this.interactionState.showVCenterLine = false
                        this.#triggerRenderUpdate()
                    }
                }, CropperManager.CENTERING_LINES_TIMEOUT)
                this.#timers.push(this.#centeringLinesTimer)
            }
            else {
                this.interactionState.showHCenterLine = false
                this.interactionState.showVCenterLine = false
                this.#centeringLinesTimer && clearTimeout(this.#centeringLinesTimer)
                this.#centeringLinesTimer = null
                this.#triggerRenderUpdate()
            }

            if (this.options.lockCentering) {
                if (isHCentered) {
                    newCrop.x = Math.floor(sourceCenterX - newCrop.width / 2)
                    if (!newInteraction.dragLockedHorizontal) {
                        newInteraction.dragLockedHorizontal = true
                        if (this.options.vibrate && navigator.vibrate) {
                            navigator.vibrate(50)
                        }
                        this.#centeringLockTimers.horizontal && clearTimeout(this.#centeringLockTimers.horizontal)
                        this.#centeringLockTimers.horizontal = setTimeout(() => {
                            if (!this.isDestroyed) {
                                this.interactionState.dragLockedHorizontal = false
                            }
                        }, CropperManager.CENTERING_LOCK_TIMEOUT)
                        this.#timers.push(this.#centeringLockTimers.horizontal)
                    }
                }
                if (isVCentered) {
                    newCrop.y = Math.floor(sourceCenterY - newCrop.height / 2)
                    if (!newInteraction.dragLockedVertical) {
                        newInteraction.dragLockedVertical = true
                        if (this.options.vibrate && navigator.vibrate) {
                            navigator.vibrate(50)
                        }
                        this.#centeringLockTimers.vertical && clearTimeout(this.#centeringLockTimers.vertical)
                        this.#centeringLockTimers.vertical = setTimeout(() => {
                            if (!this.isDestroyed) {
                                this.interactionState.dragLockedVertical = false
                            }
                        }, CropperManager.CENTERING_LOCK_TIMEOUT)
                        this.#timers.push(this.#centeringLockTimers.vertical)
                    }
                }
            }
        }
        else if (this.interactionState.action.startsWith('resize-')) {
            const direction = this.interactionState.action.replace('resize-', '')
            this.#handleResize(newCrop, direction, deltaX, deltaY, this.#resizeStartState.isSymmetric, cropper.lockRatio, this.#resizeStartState.aspectRatio, bounds)
            if (event.touches && event.touches.length === 1) {
                this.#touchStartPosition = {x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now()}
            }
            this.#resizeStartState.isSymmetric = cropper.lockRatio ? !event.shiftKey : event.shiftKey
        }

        this.crop = this.#clampCrop(newCrop, bounds)
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
     * @param {boolean} isSymmetric - Whether to resize symmetrically
     * @param {boolean} lockRatio - Whether to maintain aspect ratio
     * @param {number|null} aspectRatio - Aspect ratio to use (null for free resize)
     * @param {Object} bounds - Source bounds
     * @private
     */
    #handleResize = (crop, direction, deltaX, deltaY, isSymmetric, lockRatio, aspectRatio, bounds) => {
        const effectiveAspectRatio = lockRatio ? (Number.isFinite(aspectRatio) ? aspectRatio : 1) : (aspectRatio || 1)
        const centerX = Math.floor(crop.x + crop.width / 2)
        const centerY = Math.floor(crop.y + crop.height / 2)
        const original = {x: crop.x, y: crop.y, width: crop.width, height: crop.height}

        if (isSymmetric) {
            let delta
            if (lockRatio || aspectRatio) {
                switch (direction) {
                    case 'nw':
                        delta = Math.floor(Math.max(Math.abs(deltaX) * effectiveAspectRatio, Math.abs(deltaY)) * (deltaX > 0 || deltaY > 0 ? -1 : 1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + delta * 2))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        break
                    case 'ne':
                        delta = Math.floor(Math.max(Math.abs(deltaX) * effectiveAspectRatio, Math.abs(deltaY)) * (deltaX < 0 || deltaY > 0 ? -1 : 1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + delta * 2))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        break
                    case 'se':
                        delta = Math.floor(Math.max(Math.abs(deltaX) * effectiveAspectRatio, Math.abs(deltaY)) * (deltaX < 0 || deltaY < 0 ? -1 : 1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + delta * 2))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        break
                    case 'sw':
                        delta = Math.floor(Math.max(Math.abs(deltaX) * effectiveAspectRatio, Math.abs(deltaY)) * (deltaX > 0 || deltaY < 0 ? -1 : 1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + delta * 2))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        break
                    case 'n':
                    case 's':
                        delta = Math.floor(deltaY * (direction === 'n' ? -1 : 1))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height + delta * 2))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.height * effectiveAspectRatio))
                        break
                    case 'e':
                    case 'w':
                        delta = Math.floor(deltaX * (direction === 'w' ? -1 : 1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + delta * 2))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        break
                }
                crop.x = Math.floor(centerX - crop.width / 2)
                crop.y = Math.floor(centerY - crop.height / 2)
            }
            else {
                switch (direction) {
                    case 'nw':
                        delta = Math.floor(Math.max(-deltaX, -deltaY))
                        break
                    case 'ne':
                        delta = Math.floor(Math.max(deltaX, -deltaY))
                        break
                    case 'se':
                        delta = Math.floor(Math.max(deltaX, deltaY))
                        break
                    case 'sw':
                        delta = Math.floor(Math.max(-deltaX, deltaY))
                        break
                    case 'n':
                    case 's':
                        delta = Math.floor(deltaY * (direction === 'n' ? -1 : 1))
                        break
                    case 'e':
                    case 'w':
                        delta = Math.floor(deltaX * (direction === 'w' ? -1 : 1))
                        break
                }
                crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + delta * 2))
                crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height + delta * 2))
                crop.x = Math.floor(centerX - crop.width / 2)
                crop.y = Math.floor(centerY - crop.height / 2)
            }
        }
        else {
            if (lockRatio || aspectRatio) {
                switch (direction) {
                    case 'nw':
                        deltaX = Math.floor(Math.max(Math.abs(deltaX), Math.abs(deltaY) * effectiveAspectRatio) * (deltaX < 0 ? -1 : 1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width - deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        crop.x = Math.floor(original.x + original.width - crop.width)
                        crop.y = Math.floor(original.y + original.height - crop.height)
                        break
                    case 'ne':
                        deltaX = Math.floor(Math.max(Math.abs(deltaX), Math.abs(deltaY) * effectiveAspectRatio) * (deltaX > 0 ? 1 : -1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        crop.y = Math.floor(original.y + original.height - crop.height)
                        break
                    case 'se':
                        deltaX = Math.floor(Math.max(Math.abs(deltaX), Math.abs(deltaY) * effectiveAspectRatio) * (deltaX > 0 ? 1 : -1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        break
                    case 'sw':
                        deltaX = Math.floor(Math.max(Math.abs(deltaX), Math.abs(deltaY) * effectiveAspectRatio) * (deltaX < 0 ? -1 : 1))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width - deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        crop.x = Math.floor(original.x + original.width - crop.width)
                        break
                    case 'n':
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height - deltaY))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.height * effectiveAspectRatio))
                        crop.y = Math.floor(original.y + original.height - crop.height)
                        crop.x = Math.floor(original.x + (original.width - crop.width) / 2)
                        break
                    case 's':
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height + deltaY))
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.height * effectiveAspectRatio))
                        crop.x = Math.floor(original.x + (original.width - crop.width) / 2)
                        break
                    case 'e':
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        crop.y = Math.floor(original.y + (original.height - crop.height) / 2)
                        break
                    case 'w':
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width - deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                        crop.x = Math.floor(original.x + original.width - crop.width)
                        crop.y = Math.floor(original.y + (original.height - crop.height) / 2)
                        break
                }
            }
            else {
                switch (direction) {
                    case 'nw':
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width - deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height - deltaY))
                        crop.x = Math.floor(original.x + original.width - crop.width)
                        crop.y = Math.floor(original.y + original.height - crop.height)
                        break
                    case 'ne':
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height - deltaY))
                        crop.y = Math.floor(original.y + original.height - crop.height)
                        break
                    case 'se':
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height + deltaY))
                        break
                    case 'sw':
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width - deltaX))
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height + deltaY))
                        crop.x = Math.floor(original.x + original.width - crop.width)
                        break
                    case 'n':
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height - deltaY))
                        crop.y = Math.floor(original.y + original.height - crop.height)
                        break
                    case 'e':
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width + deltaX))
                        break
                    case 's':
                        crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.height + deltaY))
                        break
                    case 'w':
                        crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, original.width - deltaX))
                        crop.x = Math.floor(original.x + original.width - crop.width)
                        break
                }
            }
        }

        if ((lockRatio || aspectRatio) && (crop.x + crop.width > bounds.width || crop.y + crop.height > bounds.height)) {
            if (crop.x + crop.width > bounds.width) {
                crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, bounds.width - crop.x))
                crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.width / effectiveAspectRatio))
                crop.y = Math.floor(centerY - crop.height / 2)
            }
            if (crop.y + crop.height > bounds.height) {
                crop.height = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, bounds.height - crop.y))
                crop.width = Math.floor(Math.max(CropperManager.MIN_CROP_SIZE, crop.height * effectiveAspectRatio))
                crop.x = Math.floor(centerX - crop.width / 2)
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
        this.interactionState.action = null
        this.interactionState.isCentering = false
        this.#resizeStartState = null
        this.#updateStore(this.crop)
        this.#timers.push(setTimeout(() => {
            if (!this.isDestroyed) {
                this.interactionState.wasJustCentered = false
            }
        }, CropperManager.CENTERING_TIMEOUT))
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
            detail: {crop: {...this.crop}},
        })
        this.source.dispatchEvent(closeEvent)
        this.destroy()
    }

    /**
     * Resets centering lines when idle
     * @returns {Function} Cleanup function
     * @private
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
        }, CropperManager.RESET_CENTERING_INTERVAL)
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
        this.#disableEvents()
    }
}

export { CropperManager }