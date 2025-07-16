/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropperManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-16
 * Last modified: 2025-07-16
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * CropperManager handles crop region management for canvas, video, or image elements.
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
     * Time-related constants (in milliseconds)
     * @static
     */
    static DOUBLE_TAP_THRESHOLD = 200
    static LONG_TAP_THRESHOLD = 500
    static CENTERING_TIMEOUT = 100
    static CENTERING_LOCK_TIMEOUT = 2000
    static RESET_CENTERING_INTERVAL = 100
    static TOUCH_MOVEMENT_TIMEOUT = 100

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
            draggable:        true,
            resizable:        true,
            lockCentering: true,
            vibrate:          true,
            touchSensitivity: 3,
            ...options,
        }
        this.dpr = window.devicePixelRatio || 1
        this.lastClickTime = 0
        this.touchStartPosition = null
        this.longTapTimer = null
        const bounds = this.getSourceBounds()
        this.crop = {
            x:      store.x ?? (bounds.width - (store.width ?? 512)) / 2,
            y:      store.y ?? (bounds.height - (store.height ?? 360)) / 2,
            width:  Math.min(store.width ?? 512, bounds.width),
            height: Math.min(store.height ?? 360, bounds.height),
        }
        this.crop.x = Math.max(0, Math.min(this.crop.x, bounds.width - this.crop.width))
        this.crop.y = Math.max(0, Math.min(this.crop.y, bounds.height - this.crop.height))
        this.interactionState = {
            action:             null,
            showHCenterLine:    false,
            showVCenterLine:    false,
            dragLockedHorizontal: false,
            dragLockedVertical: false,
            isCentering:        false,
            wasJustCentered:    false,
        }
        this.timers = []
        this.rafId = null
        this.isDestroyed = false
        this.resizeStartState = null
        this.savedCropState = null
        this.centeringLockTimers = {horizontal: null, vertical: null}
        this.updateStore(this.crop)
        window.addEventListener('resize', this.updateCropOnSourceChange.bind(this, this))
        window.addEventListener('orientationchange', this.updateCropOnSourceChange.bind(this, this))
    }

    /**
     * Updates device pixel ratio on window size change
     */
    updateWindowSize = () => {
        this.dpr = window.devicePixelRatio || 1
    }

    /**
     * Gets source element bounds in device pixels
     * @returns {Object} Bounds with x, y, width, height
     */
    getSourceBounds = () => {
        const rect = this.container.getBoundingClientRect()
        return {
            x:     rect.left * this.dpr,
            y:     rect.top * this.dpr,
            width: rect.width * this.dpr,
            height: rect.height * this.dpr,
        }
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
        return {
            overlayStyle:           {
                clipPath: `polygon(
    0 0, 100% 0, 100% 100%, 0 100%,
    0 ${crop.y / dpr}px,
    ${crop.x / dpr}px ${crop.y / dpr}px,
    ${crop.x / dpr}px ${(crop.y + crop.height) / dpr}px,
    ${(crop.x + crop.width) / dpr}px ${(crop.y + crop.height) / dpr}px,
    ${(crop.x + crop.width) / dpr}px ${crop.y / dpr}px,
    0 ${crop.y / dpr}px
)`,
            },
            hCenterLineLeftStyle:   {
                left:  sourceBounds.x / dpr,
                top:   (crop.y + crop.height / 2) / dpr,
                width: Math.max(0, (crop.x - sourceBounds.x) / dpr),
            },
            hCenterLineRightStyle:  {
                left:  (crop.x + crop.width) / dpr,
                top:   (crop.y + crop.height / 2) / dpr,
                width: Math.max(0, (sourceBounds.x + sourceBounds.width - (crop.x + crop.width)) / dpr),
            },
            vCenterLineTopStyle:    {
                top:    sourceBounds.y / dpr,
                left:   (crop.x + crop.width / 2) / dpr,
                height: Math.max(0, (crop.y - sourceBounds.y) / dpr),
            },
            vCenterLineBottomStyle: {
                top:    (crop.y + crop.height) / dpr,
                left:   (crop.x + crop.width / 2) / dpr,
                height: Math.max(0, (sourceBounds.y + sourceBounds.height - (crop.y + crop.height)) / dpr),
            },
        }
    }

    /**
     * Updates crop dimensions on source change (e.g., resize)
     * @param {Object} cropper - Cropper state
     * @returns {Object} Updated crop
     */
    updateCropOnSourceChange = (cropper) => {
        const bounds = this.getSourceBounds()
        const newCrop = {...this.crop}
        newCrop.width = Math.min(newCrop.width, bounds.width)
        newCrop.height = Math.min(newCrop.height, bounds.height)
        newCrop.x = Math.max(0, Math.min(newCrop.x, bounds.width - newCrop.width))
        newCrop.y = Math.max(0, Math.min(newCrop.y, bounds.height - newCrop.height))
        this.crop = newCrop
        this.updateStore(newCrop)
        return newCrop
    }

    /**
     * Checks if touch movement is significant for drag
     * @param {TouchEvent} event - Touch event
     * @returns {boolean}
     */
    isSignificantTouchMovement = (event) => {
        if (!this.touchStartPosition || !event.touches || event.touches.length !== 1) {
            return true
        }
        const touch = event.touches[0]
        const deltaX = Math.abs(touch.clientX - this.touchStartPosition.x)
        const deltaY = Math.abs(touch.clientY - this.touchStartPosition.y)
        const timeDelta = Date.now() - this.touchStartPosition.time
        return deltaX > this.options.touchSensitivity || deltaY > this.options.touchSensitivity || timeDelta > CropperManager.TOUCH_MOVEMENT_TIMEOUT
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
                this.updateStore(newCrop)
                return newCrop
            }
        }
        this.interactionState.wasJustCentered = false
        if (this.longTapTimer) {
            clearTimeout(this.longTapTimer)
            this.longTapTimer = null
        }
        if (event.touches && event.touches.length === 1) {
            this.touchStartPosition = {
                x:    event.touches[0].clientX,
                y:    event.touches[0].clientY,
                time: Date.now(),
            }
            this.longTapTimer = setTimeout(() => {
                if (!this.isDestroyed && !this.isSignificantTouchMovement(event)) {
                    const newCrop = this.maximizeRestore(cropper)
                    this.updateStore(newCrop)
                    if (this.options.vibrate && navigator.vibrate) {
                        navigator.vibrate(50)
                    }
                    this.longTapTimer = null
                }
            }, CropperManager.LONG_TAP_THRESHOLD)
            this.timers.push(this.longTapTimer)
        }
        const currentTime = Date.now()
        const isDoubleClick = action === 'drag' && !event.touches && event.button === 0 &&
            (currentTime - this.lastClickTime) < CropperManager.DOUBLE_TAP_THRESHOLD
        const isDoubleTap = action === 'drag' && event.touches && event.touches.length === 1 &&
            (currentTime - this.lastClickTime) < CropperManager.DOUBLE_TAP_THRESHOLD &&
            this.touchStartPosition &&
            Math.abs(event.touches[0].clientX - this.touchStartPosition.x) < this.options.touchSensitivity &&
            Math.abs(event.touches[0].clientY - this.touchStartPosition.y) < this.options.touchSensitivity
        this.lastClickTime = currentTime
        if (isDoubleClick || isDoubleTap) {
            if (this.longTapTimer) {
                clearTimeout(this.longTapTimer)
                this.longTapTimer = null
            }
            this.closeCropper()
            return
        }
        if (action === 'drag' && event.ctrlKey && !event.touches && !event.shiftKey && event.button === 0) {
            this.interactionState.isCentering = true
            this.interactionState.action = 'centering'
            const newCrop = this.centerCrop(cropper)
            this.updateStore(newCrop)
            this.timers.push(setTimeout(() => {
                if (!this.isDestroyed) {
                    this.interactionState.isCentering = false
                    this.interactionState.wasJustCentered = true
                    this.interactionState.action = null
                }
            }, CropperManager.CENTERING_TIMEOUT))
            return newCrop
        }
        if ((action === 'drag' || action.startsWith('resize-')) && (event.button === 0 || event.touches)) {
            this.interactionState.action = action
            if (action.startsWith('resize-')) {
                this.resizeStartState = {
                    crop:        {...this.crop},
                    centerX:     this.crop.x + this.crop.width / 2,
                    centerY:     this.crop.y + this.crop.height / 2,
                    isSymmetric: !event.shiftKey,
                    lockRatio:   cropper.lockRatio,
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
        if (this.longTapTimer && this.isSignificantTouchMovement(event)) {
            clearTimeout(this.longTapTimer)
            this.longTapTimer = null
        }
        const newCrop = {...this.crop}
        const newInteraction = {...this.interactionState}
        if (this.interactionState.action === 'drag') {
            const deltaX = ((event.movementX || (event.touches && event.touches.length === 1 ? event.touches[0].clientX - this.touchStartPosition.x : 0))) * this.dpr
            const deltaY = ((event.movementY || (event.touches && event.touches.length === 1 ? event.touches[0].clientY - this.touchStartPosition.y : 0))) * this.dpr
            newCrop.x = Math.max(0, Math.min(newCrop.x + deltaX, bounds.width - newCrop.width))
            newCrop.y = Math.max(0, Math.min(newCrop.y + deltaY, bounds.height - newCrop.height))
            if (event.touches && event.touches.length === 1) {
                this.touchStartPosition = {x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now()}
            }
            const sourceCenterX = bounds.width / 2
            const sourceCenterY = bounds.height / 2
            const cropCenterX = newCrop.x + newCrop.width / 2
            const cropCenterY = newCrop.y + newCrop.height / 2
            const isHCentered = Math.abs(cropCenterX - sourceCenterX) < 5
            const isVCentered = Math.abs(cropCenterY - sourceCenterY) < 5
            newInteraction.showVCenterLine = isHCentered
            newInteraction.showHCenterLine = isVCentered
            if (this.options.lockCentering) {
                if (isHCentered) {
                    newCrop.x = sourceCenterX - newCrop.width / 2
                    if (!newInteraction.dragLockedHorizontal) {
                        newInteraction.dragLockedHorizontal = true
                        if (this.options.vibrate && navigator.vibrate) {
                            navigator.vibrate(50)
                        }
                        if (this.centeringLockTimers.horizontal) {
                            clearTimeout(this.centeringLockTimers.horizontal)
                        }
                        this.centeringLockTimers.horizontal = setTimeout(() => {
                            if (!this.isDestroyed) {
                                this.interactionState.dragLockedHorizontal = false
                            }
                        }, CropperManager.CENTERING_LOCK_TIMEOUT)
                        this.timers.push(this.centeringLockTimers.horizontal)
                    }
                }
                if (isVCentered) {
                    newCrop.y = sourceCenterY - newCrop.height / 2
                    if (!newInteraction.dragLockedVertical) {
                        newInteraction.dragLockedVertical = true
                        if (this.options.vibrate && navigator.vibrate) {
                            navigator.vibrate(50)
                        }
                        if (this.centeringLockTimers.vertical) {
                            clearTimeout(this.centeringLockTimers.vertical)
                        }
                        this.centeringLockTimers.vertical = setTimeout(() => {
                            if (!this.isDestroyed) {
                                this.interactionState.dragLockedVertical = false
                            }
                        }, CropperManager.CENTERING_LOCK_TIMEOUT)
                        this.timers.push(this.centeringLockTimers.vertical)
                    }
                }
            }
        }
        else if (this.interactionState.action.startsWith('resize-')) {
            const direction = this.interactionState.action.replace('resize-', '')
            const deltaX = ((event.movementX || (event.touches && event.touches.length === 1 ? event.touches[0].clientX - this.touchStartPosition.x : 0))) * this.dpr
            const deltaY = ((event.movementY || (event.touches && event.touches.length === 1 ? event.touches[0].clientY - this.touchStartPosition.y : 0))) * this.dpr
            const isSymmetric = this.resizeStartState.isSymmetric
            const lockRatio = cropper.lockRatio
            this.handleResize(newCrop, direction, deltaX, deltaY, isSymmetric, lockRatio, bounds)
            if (event.touches && event.touches.length === 1) {
                this.touchStartPosition = {x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now()}
            }
            // Update symmetry based on Shift key state
            this.resizeStartState.isSymmetric = !event.shiftKey
        }
        this.crop = newCrop
        this.interactionState = newInteraction
        this.updateStore(newCrop)
        return {crop: newCrop, interaction: newInteraction}
    }

    /**
     * Handles resize operations
     * @param {Object} crop - Crop object to modify
     * @param {string} direction - Resize direction
     * @param {number} deltaX - Horizontal movement delta
     * @param {number} deltaY - Vertical movement delta
     * @param {boolean} isSymmetric - Whether to resize symmetrically
     * @param {boolean} lockRatio - Whether to maintain aspect ratio
     * @param {Object} bounds - Source bounds
     */
    handleResize = (crop, direction, deltaX, deltaY, isSymmetric, lockRatio, bounds) => {
        const centerX = crop.x + crop.width / 2
        const centerY = crop.y + crop.height / 2
        const aspectRatio = crop.width / crop.height
        if (isSymmetric) {
            switch (direction) {
                case 'nw':
                case 'ne':
                case 'se':
                case 'sw':
                    let actualDelta = 0
                    if (direction === 'nw') {
                        actualDelta = Math.max(-deltaX, -deltaY)
                    }
                    else if (direction === 'ne') {
                        actualDelta = Math.max(deltaX, -deltaY)
                    }
                    else if (direction === 'se') {
                        actualDelta = Math.max(deltaX, deltaY)
                    }
                    else if (direction === 'sw') {
                        actualDelta = Math.max(-deltaX, deltaY)
                    }
                    const newWidth = crop.width + actualDelta * 2
                    const newHeight = lockRatio ? newWidth / aspectRatio : crop.height + actualDelta * 2
                    crop.width = Math.max(10, newWidth)
                    crop.height = Math.max(10, newHeight)
                    crop.x = centerX - crop.width / 2
                    crop.y = centerY - crop.height / 2
                    break
                case 'n':
                case 's':
                    const deltaYSign = direction === 'n' ? -1 : 1
                    const newHeight2 = crop.height + deltaY * deltaYSign * 2
                    const newWidth2 = lockRatio ? newHeight2 * aspectRatio : crop.width
                    crop.width = Math.max(10, newWidth2)
                    crop.height = Math.max(10, newHeight2)
                    crop.x = centerX - crop.width / 2
                    crop.y = centerY - crop.height / 2
                    break
                case 'e':
                case 'w':
                    const deltaXSign = direction === 'w' ? -1 : 1
                    const newWidth3 = crop.width + deltaX * deltaXSign * 2
                    const newHeight3 = lockRatio ? newWidth3 / aspectRatio : crop.height
                    crop.width = Math.max(10, newWidth3)
                    crop.height = Math.max(10, newHeight3)
                    crop.x = centerX - crop.width / 2
                    crop.y = centerY - crop.height / 2
                    break
            }
        }
        else {
            const originalWidth = crop.width
            const originalHeight = crop.height
            const originalX = crop.x
            const originalY = crop.y
            switch (direction) {
                case 'nw':
                    crop.width = Math.max(10, originalWidth - deltaX)
                    crop.height = lockRatio ? crop.width / aspectRatio : Math.max(10, originalHeight - deltaY)
                    crop.x = originalX + originalWidth - crop.width
                    crop.y = originalY + originalHeight - crop.height
                    break
                case 'ne':
                    crop.width = Math.max(10, originalWidth + deltaX)
                    crop.height = lockRatio ? crop.width / aspectRatio : Math.max(10, originalHeight - deltaY)
                    crop.y = originalY + originalHeight - crop.height
                    break
                case 'se':
                    crop.width = Math.max(10, originalWidth + deltaX)
                    crop.height = lockRatio ? crop.width / aspectRatio : Math.max(10, originalHeight + deltaY)
                    break
                case 'sw':
                    crop.width = Math.max(10, originalWidth - deltaX)
                    crop.height = lockRatio ? crop.width / aspectRatio : Math.max(10, originalHeight + deltaY)
                    crop.x = originalX + originalWidth - crop.width
                    break
                case 'n':
                    crop.height = Math.max(10, originalHeight - deltaY)
                    crop.width = lockRatio ? crop.height * aspectRatio : crop.width
                    crop.y = originalY + originalHeight - crop.height
                    crop.x = lockRatio ? originalX + (originalWidth - crop.width) / 2 : crop.x
                    break
                case 'e':
                    crop.width = Math.max(10, originalWidth + deltaX)
                    crop.height = lockRatio ? crop.width / aspectRatio : crop.height
                    crop.y = lockRatio ? originalY + (originalHeight - crop.height) / 2 : crop.y
                    break
                case 's':
                    crop.height = Math.max(10, originalHeight + deltaY)
                    crop.width = lockRatio ? crop.height * aspectRatio : crop.width
                    crop.x = lockRatio ? originalX + (originalWidth - crop.width) / 2 : crop.x
                    break
                case 'w':
                    crop.width = Math.max(10, originalWidth - deltaX)
                    crop.height = lockRatio ? crop.width / aspectRatio : crop.height
                    crop.x = originalX + originalWidth - crop.width
                    crop.y = lockRatio ? originalY + (originalHeight - crop.height) / 2 : crop.y
                    break
            }
        }
        crop.x = Math.max(0, Math.min(crop.x, bounds.width - crop.width))
        crop.y = Math.max(0, Math.min(crop.y, bounds.height - crop.height))
        if (crop.x + crop.width > bounds.width) {
            crop.width = bounds.width - crop.x
        }
        if (crop.y + crop.height > bounds.height) {
            crop.height = bounds.height - crop.y
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
        if (this.longTapTimer) {
            clearTimeout(this.longTapTimer)
            this.longTapTimer = null
        }
        // Update symmetry based on Shift key state at release
        if (this.resizeStartState && event && 'shiftKey' in event) {
            this.resizeStartState.isSymmetric = !event.shiftKey
        }
        this.interactionState.action = null
        this.interactionState.isCentering = false
        this.resizeStartState = null
        this.updateStore(this.crop)
        this.timers.push(setTimeout(() => {
            if (!this.isDestroyed) {
                this.interactionState.wasJustCentered = false
            }
        }, CropperManager.CENTERING_TIMEOUT))
        return this.interactionState
    }

    /**
     * Updates store if crop values change
     * @param {Object} newCrop - New crop values
     */
    updateStore = (newCrop) => {
        if (this.isDestroyed) {
            return
        }
        if (this.store.x !== newCrop.x || this.store.y !== newCrop.y ||
            this.store.width !== newCrop.width || this.store.height !== newCrop.height) {
            this.store.x = newCrop.x
            this.store.y = newCrop.y
            this.store.width = newCrop.width
            this.store.height = newCrop.height
        }
    }

    /**
     * Centers the crop region
     * @param {Object} cropper - Cropper state
     * @returns {Object} Updated crop
     */
    centerCrop = (cropper) => {
        const bounds = this.getSourceBounds()
        const newCrop = {...this.crop}
        newCrop.x = (bounds.width - newCrop.width) / 2
        newCrop.y = (bounds.height - newCrop.height) / 2
        this.crop = newCrop
        return newCrop
    }

    /**
     * Toggles maximized/restored crop states
     * @param {Object} cropper - Cropper state
     * @returns {Object} Updated crop
     */
    maximizeRestore = (cropper) => {
        const bounds = this.getSourceBounds()
        const newCrop = {...this.crop}
        const isMaximized = Math.abs(newCrop.x) < 5 && Math.abs(newCrop.y) < 5 &&
            Math.abs(newCrop.width - bounds.width) < 5 && Math.abs(newCrop.height - bounds.height) < 5
        if (isMaximized) {
            if (this.savedCropState) {
                newCrop.x = this.savedCropState.x
                newCrop.y = this.savedCropState.y
                newCrop.width = this.savedCropState.width
                newCrop.height = this.savedCropState.height
                this.savedCropState = null
            }
            else {
                newCrop.width = bounds.width / 2
                newCrop.height = bounds.height / 2
                newCrop.x = (bounds.width - newCrop.width) / 2
                newCrop.y = (bounds.height - newCrop.height) / 2
            }
        }
        else {
            this.savedCropState = {x: newCrop.x, y: newCrop.y, width: newCrop.width, height: newCrop.height}
            newCrop.x = 0
            newCrop.y = 0
            newCrop.width = bounds.width
            newCrop.height = bounds.height
        }
        this.crop = newCrop
        return newCrop
    }

    /**
     * Closes cropper and dispatches onClose event
     */
    closeCropper = () => {
        if (this.isDestroyed) {
            return
        }
        const closeEvent = new CustomEvent('onCropperClose', {
            bubbles: true,
            cancelable: true,
            detail:  {crop: {...this.crop}},
        })
        this.source.dispatchEvent(closeEvent)
        this.destroy()
    }

    /**
     * Resets centering lines when idle
     * @param {Function} callback - Callback for state update
     * @returns {Function} Cleanup function
     */
    resetCentering = (callback) => {
        const interval = setInterval(() => {
            if (!this.interactionState.action && !this.isDestroyed) {
                const newState = {...this.interactionState, showHCenterLine: false, showVCenterLine: false}
                this.interactionState = newState
                if (callback) {
                    callback(newState)
                }
            }
        }, CropperManager.RESET_CENTERING_INTERVAL)
        this.timers.push(interval)
        return () => clearInterval(interval)
    }

    /**
     * Cleans up timers and animation frames
     */
    destroy = () => {
        this.isDestroyed = true
        this.timers.forEach(timer => {
            if (typeof timer === 'number') {
                clearTimeout(timer)
                clearInterval(timer)
            }
        })
        if (this.centeringLockTimers.horizontal) {
            clearTimeout(this.centeringLockTimers.horizontal)
        }
        if (this.centeringLockTimers.vertical) {
            clearTimeout(this.centeringLockTimers.vertical)
        }
        if (this.longTapTimer) {
            clearTimeout(this.longTapTimer)
        }
        if (this.rafId) {
            cancelAnimationFrame(this.rafId)
        }
        this.timers = []
        this.rafId = null
        this.resizeStartState = null
        this.savedCropState = null
        this.centeringLockTimers = {horizontal: null, vertical: null}
        this.longTapTimer = null
        window.removeEventListener('resize', this.updateCropOnSourceChange)
        window.removeEventListener('orientationchange', this.updateCropOnSourceChange)
    }
}

export { CropperManager }
