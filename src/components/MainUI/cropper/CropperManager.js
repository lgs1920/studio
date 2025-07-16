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
 * CropperManager handles the logic for crop region management, including calculations,
 * bounds enforcement, and interaction state updates for canvas, video, or image elements.
 *
 * @class CropperManager
 */
class CropperManager {
    /**
     * Static mapping of handle directions to their corresponding CSS cursor styles
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
     * Creates a new CropperManager instance
     * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} source - The source element to crop
     * @param {HTMLElement} [container] - The container element for bounds (defaults to source)
     * @param {Object} store - The Valtio store for crop state persistence
     * @param {Object} [options={}] - Configuration options
     */
    constructor(source, container, store, options = {}) {
        this.source = source
        this.container = container || source
        this.store = store
        this.options = {
            draggable:     true,
            resizable:     true,
            lockCentering: true,
            vibrate:       true,
            ...options,
        }
        this.dpr = window.devicePixelRatio || 1
        this.lastClickTime = 0 // Track last click/touch for double-click/tap detection
        this.doubleClickThreshold = 300 // Time in ms to detect double-click/tap

        // Get actual source dimensions
        const sourceWidth = source instanceof HTMLVideoElement ? source.videoWidth : source.width
        const sourceHeight = source instanceof HTMLVideoElement ? source.videoHeight : source.height

        // Initialize crop - center by default if no position stored
        this.crop = {
            x:      store.x ?? (sourceWidth - (store.width ?? 512)) / 2,
            y:      store.y ?? (sourceHeight - (store.height ?? 360)) / 2,
            width:  store.width ?? 512,
            height: store.height ?? 360,
        }

        this.interactionState = {
            action:               null,
            showHCenterLine:      false,
            showVCenterLine:      false,
            dragLockedHorizontal: false,
            dragLockedVertical:   false,
            isCentering:          false,
            wasJustCentered:      false,
        }
        this.timers = []
        this.rafId = null
        this.isDestroyed = false
        this.resizeStartState = null
        // Store for maximize/restore functionality
        this.savedCropState = null
        // Centering lock timers
        this.centeringLockTimers = {
            horizontal: null,
            vertical:   null,
        }

        // Initialize store if needed
        this.updateStore(this.crop)
    }

    /**
     * Updates the device pixel ratio when window size changes
     */
    updateWindowSize = () => {
        this.dpr = window.devicePixelRatio || 1
    }

    /**
     * Gets the bounds of the source element in device pixels
     * @returns {Object} The bounds object with x, y, width, and height properties
     */
    getSourceBounds = () => {
        const rect = this.container.getBoundingClientRect()
        return {
            x:      rect.left * this.dpr,
            y:      rect.top * this.dpr,
            width:  rect.width * this.dpr,
            height: rect.height * this.dpr,
        }
    }

    /**
     * Calculates styling for crop elements based on current crop and interaction state
     * @param {Object} crop - The crop region object with x, y, width, height
     * @param {Object} interactionState - The current interaction state
     * @returns {Object} Object containing all calculated styles for different crop elements
     */
    getStyles = (crop, interactionState) => {
        const sourceBounds = this.getSourceBounds()
        const dpr = this.dpr

        const overlayStyle = {
            clipPath: `polygon(
                0 0,
                100% 0,
                100% 100%,
                0 100%,
                0 ${crop.y / dpr}px,
                ${crop.x / dpr}px ${crop.y / dpr}px,
                ${crop.x / dpr}px ${(crop.y + crop.height) / dpr}px,
                ${(crop.x + crop.width) / dpr}px ${(crop.y + crop.height) / dpr}px,
                ${(crop.x + crop.width) / dpr}px ${crop.y / dpr}px,
                0 ${crop.y / dpr}px
            )`,
        }

        const hCenterLineLeftStyle = {
            left:  sourceBounds.x / dpr,
            top:   (crop.y + crop.height / 2) / dpr,
            width: Math.max(0, (crop.x - sourceBounds.x) / dpr),
        }

        const hCenterLineRightStyle = {
            left:  (crop.x + crop.width) / dpr,
            top:   (crop.y + crop.height / 2) / dpr,
            width: Math.max(0, (sourceBounds.x + sourceBounds.width - (crop.x + crop.width)) / dpr),
        }

        const vCenterLineTopStyle = {
            top:    sourceBounds.y / dpr,
            left:   (crop.x + crop.width / 2) / dpr,
            height: Math.max(0, (crop.y - sourceBounds.y) / dpr),
        }

        const vCenterLineBottomStyle = {
            top:    (crop.y + crop.height) / dpr,
            left:   (crop.x + crop.width / 2) / dpr,
            height: Math.max(0, (sourceBounds.y + sourceBounds.height - (crop.y + crop.height)) / dpr),
        }

        return {
            overlayStyle,
            hCenterLineLeftStyle,
            hCenterLineRightStyle,
            vCenterLineTopStyle,
            vCenterLineBottomStyle,
        }
    }

    /**
     * Updates crop dimensions when source element changes (e.g., window resize)
     * @param {Object} cropper - The cropper state object
     * @returns {Object} The updated crop object
     */
    updateCropOnSourceChange = (cropper) => {
        const bounds = this.getSourceBounds()
        const newCrop = {...this.crop}
        newCrop.width = Math.min(newCrop.width, bounds.width)
        newCrop.height = Math.min(newCrop.height, bounds.height)
        newCrop.x = Math.max(0, Math.min(newCrop.x, bounds.width - newCrop.width))
        newCrop.y = Math.max(0, Math.min(newCrop.y, bounds.height - newCrop.height))
        this.crop = newCrop

        // Only update store if values have actually changed
        if (this.store.x !== newCrop.x || this.store.y !== newCrop.y ||
            this.store.width !== newCrop.width || this.store.height !== newCrop.height) {
            this.store.x = newCrop.x
            this.store.y = newCrop.y
            this.store.width = newCrop.width
            this.store.height = newCrop.height
        }

        return newCrop
    }

    /**
     * Handles the start of an interaction (drag or resize)
     * @param {string} action - The type of action ('drag' or 'resize-direction')
     * @param {Event} event - The DOM event that triggered the action
     * @param {Object} cropper - The cropper state object
     * @returns {Object|undefined} The updated crop object or undefined if no action taken
     */
    handleStart = (action, event, cropper) => {
        if (cropper.recording || this.isDestroyed) {
            return
        }

        // Reset flags
        this.interactionState.wasJustCentered = false

        // Check for double-click or double-tap
        const currentTime = Date.now()
        const isDoubleClick = (action === 'drag' && !event.touches &&
            (currentTime - this.lastClickTime) < this.doubleClickThreshold)
        const isDoubleTap = (action === 'drag' && event.touches && event.touches.length === 1 &&
            (currentTime - this.lastClickTime) < this.doubleClickThreshold)

        this.lastClickTime = currentTime

        if (isDoubleClick || isDoubleTap) {
            // Dispatch onClose event and exit
            this.closeCropper()
            return
        }

        // Handle centering with Ctrl+Click (without Shift)
        if (action === 'drag' && event.ctrlKey && !event.touches && !event.shiftKey) {
            this.interactionState.isCentering = true
            this.interactionState.action = 'centering'
            const newCrop = this.centerCrop(cropper)
            this.updateStore(newCrop)

            // Set flag to indicate centering just happened
            this.timers.push(setTimeout(() => {
                if (!this.isDestroyed) {
                    this.interactionState.isCentering = false
                    this.interactionState.wasJustCentered = true
                    this.interactionState.action = null
                }
            }, 100))

            return newCrop
        }

        // Handle maximize/restore with Shift+Ctrl+Click
        if (action === 'drag' && event.shiftKey && event.ctrlKey && !event.touches) {
            const newCrop = this.maximizeRestore(cropper)
            this.updateStore(newCrop)
            return newCrop
        }

        // Handle drag or resize
        this.interactionState.action = action

        // Store initial state for resize operations
        if (action.startsWith('resize-')) {
            this.resizeStartState = {
                crop:        {...this.crop},
                centerX:     this.crop.x + this.crop.width / 2,
                centerY:     this.crop.y + this.crop.height / 2,
                isSymmetric: !event.shiftKey,
                lockRatio:   cropper.lockRatio,
            }
        }

        return this.crop
    }

    /**
     * Handles movement during drag or resize interactions
     * @param {Event} event - The DOM event containing movement data
     * @param {Object} cropper - The cropper state object
     * @param {Object} bounds - The bounds object with source dimensions
     * @returns {Object} Object containing updated crop and interaction state
     */
    handleMove = (event, cropper, bounds) => {
        if (!this.interactionState.action || cropper.recording || this.isDestroyed) {
            return {crop: this.crop, interaction: this.interactionState}
        }

        const newCrop = {...this.crop}
        const newInteraction = {...this.interactionState}

        if (this.interactionState.action === 'drag') {
            const deltaX = (event.movementX || 0) * this.dpr
            const deltaY = (event.movementY || 0) * this.dpr

            newCrop.x = Math.max(0, Math.min(newCrop.x + deltaX, bounds.width - newCrop.width))
            newCrop.y = Math.max(0, Math.min(newCrop.y + deltaY, bounds.height - newCrop.height))

            const sourceCenterX = bounds.width / 2
            const sourceCenterY = bounds.height / 2
            const cropCenterX = newCrop.x + newCrop.width / 2
            const cropCenterY = newCrop.y + newCrop.height / 2

            const isHCentered = Math.abs(cropCenterX - sourceCenterX) < 5
            const isVCentered = Math.abs(cropCenterY - sourceCenterY) < 5

            // Inverted logic for centering lines
            newInteraction.showVCenterLine = isHCentered
            newInteraction.showHCenterLine = isVCentered

            // Snap to center if close
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
                        }, 2000)
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
                        }, 2000)
                        this.timers.push(this.centeringLockTimers.vertical)
                    }
                }
            }
        }
        else if (this.interactionState.action.startsWith('resize-')) {
            const direction = this.interactionState.action.replace('resize-', '')
            const deltaX = (event.movementX || 0) * this.dpr
            const deltaY = (event.movementY || 0) * this.dpr

            const isSymmetric = !event.shiftKey
            const lockRatio = cropper.lockRatio

            this.handleResize(newCrop, direction, deltaX, deltaY, isSymmetric, lockRatio, bounds)
        }

        this.crop = newCrop
        this.interactionState = newInteraction
        this.updateStore(newCrop)
        return {crop: newCrop, interaction: newInteraction}
    }

    /**
     * Handles resize operations for different directions
     * @param {Object} crop - The crop object to modify
     * @param {string} direction - The resize direction
     * @param {number} deltaX - The horizontal movement delta
     * @param {number} deltaY - The vertical movement delta
     * @param {boolean} isSymmetric - Whether to resize symmetrically
     * @param {boolean} lockRatio - Whether to maintain aspect ratio
     * @param {Object} bounds - The bounds object
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

        // Constrain to bounds
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
     * Handles the end of an interaction
     * @returns {Object} The updated interaction state
     */
    handleEnd = () => {
        if (this.isDestroyed) {
            return this.interactionState
        }

        this.interactionState.action = null
        this.interactionState.isCentering = false
        this.resizeStartState = null
        this.updateStore(this.crop)

        // Clear the "just centered" flag after a delay
        this.timers.push(setTimeout(() => {
            if (!this.isDestroyed) {
                this.interactionState.wasJustCentered = false
            }
        }, 500))

        return this.interactionState
    }

    /**
     * Updates the store only if values have changed
     * @param {Object} newCrop - The new crop values
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
     * Centers the crop region within the source bounds
     * @param {Object} cropper - The cropper state object
     * @returns {Object} The updated crop object
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
     * Toggles between maximized and restored crop states
     * @param {Object} cropper - The cropper state object
     * @returns {Object} The updated crop object
     */
    maximizeRestore = (cropper) => {
        const bounds = this.getSourceBounds()
        const newCrop = {...this.crop}

        const isMaximized = (
            Math.abs(newCrop.x - 0) < 5 &&
            Math.abs(newCrop.y - 0) < 5 &&
            Math.abs(newCrop.width - bounds.width) < 5 &&
            Math.abs(newCrop.height - bounds.height) < 5
        )

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
            this.savedCropState = {
                x:      newCrop.x,
                y:      newCrop.y,
                width:  newCrop.width,
                height: newCrop.height,
            }

            newCrop.x = 0
            newCrop.y = 0
            newCrop.width = bounds.width
            newCrop.height = bounds.height
        }

        this.crop = newCrop
        return newCrop
    }

    /**
     * Closes the cropper, dispatching the onClose event and cleaning up
     */
    closeCropper = () => {
        if (this.isDestroyed) {
            return
        }

        // Dispatch onClose event
        const closeEvent = new CustomEvent('onCropperClose', {
            bubbles:    true,
            cancelable: true,
            detail:     {
                crop: {...this.crop},
            },
        })
        this.source.dispatchEvent(closeEvent)
        this.destroy()
    }

    /**
     * Resets centering lines when no interaction is active
     * @param {Function} callback - Callback function to call when centering is reset
     * @returns {Function} Cleanup function to clear the interval
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
        }, 100)
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
        if (this.rafId) {
            cancelAnimationFrame(this.rafId)
        }
        this.timers = []
        this.rafId = null
        this.resizeStartState = null
        this.savedCropState = null
        this.centeringLockTimers = {
            horizontal: null,
            vertical:   null,
        }
    }
}

export { CropperManager }