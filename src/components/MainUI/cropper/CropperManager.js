/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropperManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-17
 * Last modified: 2025-07-17
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
            let actualDelta = 0
            if (lockRatio) {
                // For locked ratio, allow shrinking but prevent enlarging beyond bounds
                const maxWidth = bounds.width - (lockRatio ? 0 : crop.x)
                const maxHeight = bounds.height - (lockRatio ? 0 : crop.y)
                let maxDeltaWidth = (maxWidth - crop.width) / 2
                let maxDeltaHeight = (maxHeight - crop.height) / 2
                switch (direction) {
                    case 'nw':
                        actualDelta = Math.max(-deltaX, -deltaY)
                        if (actualDelta > 0) {
                            actualDelta = Math.min(actualDelta, Math.min(maxDeltaWidth, maxDeltaHeight * aspectRatio))
                        }
                        break
                    case 'ne':
                        actualDelta = Math.max(deltaX, -deltaY)
                        if (actualDelta > 0) {
                            actualDelta = Math.min(actualDelta, Math.min(maxDeltaWidth, maxDeltaHeight * aspectRatio))
                        }
                        break
                    case 'se':
                        actualDelta = Math.max(deltaX, deltaY)
                        if (actualDelta > 0) {
                            actualDelta = Math.min(actualDelta, Math.min(maxDeltaWidth, maxDeltaHeight * aspectRatio))
                        }
                        break
                    case 'sw':
                        actualDelta = Math.max(-deltaX, deltaY)
                        if (actualDelta > 0) {
                            actualDelta = Math.min(actualDelta, Math.min(maxDeltaWidth, maxDeltaHeight * aspectRatio))
                        }
                        break
                    case 'n':
                    case 's':
                        const deltaYSign = direction === 'n' ? -1 : 1
                        actualDelta = deltaY * deltaYSign
                        if (actualDelta > 0) {
                            maxDeltaHeight = (maxHeight - crop.height) / 2
                            maxDeltaWidth = maxDeltaHeight * aspectRatio
                            actualDelta = Math.min(actualDelta, maxDeltaHeight) * deltaYSign
                        }
                        break
                    case 'e':
                    case 'w':
                        const deltaXSign = direction === 'w' ? -1 : 1
                        actualDelta = deltaX * deltaXSign
                        if (actualDelta > 0) {
                            maxDeltaWidth = (maxWidth - crop.width) / 2
                            maxDeltaHeight = maxDeltaWidth / aspectRatio
                            actualDelta = Math.min(Math.abs(actualDelta), maxDeltaWidth) * deltaXSign
                        }
                        break
                }
                const newWidth = crop.width + actualDelta * 2
                const newHeight = lockRatio ? newWidth / aspectRatio : crop.height + actualDelta * 2
                crop.width = Math.max(10, newWidth)
                crop.height = Math.max(10, newHeight)
                crop.x = centerX - crop.width / 2
                crop.y = centerY - crop.height / 2
            }
            else {
                switch (direction) {
                    case 'nw':
                        actualDelta = Math.max(-deltaX, -deltaY)
                        break
                    case 'ne':
                        actualDelta = Math.max(deltaX, -deltaY)
                        break
                    case 'se':
                        actualDelta = Math.max(deltaX, deltaY)
                        break
                    case 'sw':
                        actualDelta = Math.max(-deltaX, deltaY)
                        break
                    case 'n':
                    case 's':
                        actualDelta = deltaY * (direction === 'n' ? -1 : 1)
                        break
                    case 'e':
                    case 'w':
                        actualDelta = deltaX * (direction === 'w' ? -1 : 1)
                        break
                }
                const newWidth = crop.width + actualDelta * 2
                const newHeight = crop.height + actualDelta * 2
                crop.width = Math.max(10, newWidth)
                crop.height = Math.max(10, newHeight)
                crop.x = centerX - crop.width / 2
                crop.y = centerY - crop.height / 2
            }
        }
        else {
            const originalWidth = crop.width
            const originalHeight = crop.height
            const originalX = crop.x
            const originalY = crop.y
            if (lockRatio) {
                // For locked ratio, allow shrinking but prevent enlarging beyond bounds
                const maxWidth = bounds.width - crop.x
                const maxHeight = bounds.height - crop.y
                switch (direction) {
                    case 'nw':
                        crop.width = Math.max(10, originalWidth - deltaX)
                        if (deltaX > 0 && crop.width >= maxWidth) {
                            crop.width = maxWidth
                        }
                        crop.height = Math.max(10, crop.width / aspectRatio)
                        if (deltaX > 0 && crop.height > maxHeight) {
                            crop.height = maxHeight
                            crop.width = Math.max(10, crop.height * aspectRatio)
                        }
                        crop.x = originalX + originalWidth - crop.width
                        crop.y = originalY + originalHeight - crop.height
                        break
                    case 'ne':
                        crop.width = Math.max(10, originalWidth + deltaX)
                        if (deltaX > 0 && crop.width >= maxWidth) {
                            crop.width = maxWidth
                        }
                        crop.height = Math.max(10, crop.width / aspectRatio)
                        if (deltaX > 0 && crop.height > maxHeight) {
                            crop.height = maxHeight
                            crop.width = Math.max(10, crop.height * aspectRatio)
                        }
                        crop.y = originalY + originalHeight - crop.height
                        break
                    case 'se':
                        crop.width = Math.max(10, originalWidth + deltaX)
                        if (deltaX > 0 && crop.width >= maxWidth) {
                            crop.width = maxWidth
                        }
                        crop.height = Math.max(10, crop.width / aspectRatio)
                        if (deltaX > 0 && crop.height > maxHeight) {
                            crop.height = maxHeight
                            crop.width = Math.max(10, crop.height * aspectRatio)
                        }
                        break
                    case 'sw':
                        crop.width = Math.max(10, originalWidth - deltaX)
                        if (deltaX < 0 && crop.width >= maxWidth) {
                            crop.width = maxWidth
                        }
                        crop.height = Math.max(10, crop.width / aspectRatio)
                        if (deltaX < 0 && crop.height > maxHeight) {
                            crop.height = maxHeight
                            crop.width = Math.max(10, crop.height * aspectRatio)
                        }
                        crop.x = originalX + originalWidth - crop.width
                        break
                    case 'n':
                        crop.height = Math.max(10, originalHeight - deltaY)
                        if (deltaY > 0 && crop.height >= maxHeight) {
                            crop.height = maxHeight
                        }
                        crop.width = Math.max(10, crop.height * aspectRatio)
                        if (deltaY > 0 && crop.width > maxWidth) {
                            crop.width = maxWidth
                            crop.height = Math.max(10, crop.width / aspectRatio)
                        }
                        crop.y = originalY + originalHeight - crop.height
                        crop.x = originalX + (originalWidth - crop.width) / 2
                        break
                    case 'e':
                        crop.width = Math.max(10, originalWidth + deltaX)
                        if (deltaX > 0 && crop.width >= maxWidth) {
                            crop.width = maxWidth
                        }
                        crop.height = Math.max(10, crop.width / aspectRatio)
                        if (deltaX > 0 && crop.height > maxHeight) {
                            crop.height = maxHeight
                            crop.width = Math.max(10, crop.height * aspectRatio)
                        }
                        crop.y = originalY + (originalHeight - crop.height) / 2
                        break
                    case 's':
                        crop.height = Math.max(10, originalHeight + deltaY)
                        if (deltaY > 0 && crop.height >= maxHeight) {
                            crop.height = maxHeight
                        }
                        crop.width = Math.max(10, crop.height * aspectRatio)
                        if (deltaY > 0 && crop.width > maxWidth) {
                            crop.width = maxWidth
                            crop.height = Math.max(10, crop.width / aspectRatio)
                        }
                        crop.x = originalX + (originalWidth - crop.width) / 2
                        break
                    case 'w':
                        crop.width = Math.max(10, originalWidth - deltaX)
                        if (deltaX < 0 && crop.width >= maxWidth) {
                            crop.width = maxWidth
                        }
                        crop.height = Math.max(10, crop.width / aspectRatio)
                        if (deltaX < 0 && crop.height > maxHeight) {
                            crop.height = maxHeight
                            crop.width = Math.max(10, crop.height * aspectRatio)
                        }
                        crop.x = originalX + originalWidth - crop.width
                        crop.y = originalY + (originalHeight - crop.height) / 2
                        break
                }
            }
            else {
                switch (direction) {
                    case 'nw':
                        crop.width = Math.max(10, originalWidth - deltaX)
                        crop.height = Math.max(10, originalHeight - deltaY)
                        crop.x = originalX + originalWidth - crop.width
                        crop.y = originalY + originalHeight - crop.height
                        break
                    case 'ne':
                        crop.width = Math.max(10, originalWidth + deltaX)
                        crop.height = Math.max(10, originalHeight - deltaY)
                        crop.y = originalY + originalHeight - crop.height
                        break
                    case 'se':
                        crop.width = Math.max(10, originalWidth + deltaX)
                        crop.height = Math.max(10, originalHeight + deltaY)
                        break
                    case 'sw':
                        crop.width = Math.max(10, originalWidth - deltaX)
                        crop.height = Math.max(10, originalHeight + deltaY)
                        crop.x = originalX + originalWidth - crop.width
                        break
                    case 'n':
                        crop.height = Math.max(10, originalHeight - deltaY)
                        crop.y = originalY + originalHeight - crop.height
                        break
                    case 'e':
                        crop.width = Math.max(10, originalWidth + deltaX)
                        break
                    case 's':
                        crop.height = Math.max(10, originalHeight + deltaY)
                        break
                    case 'w':
                        crop.width = Math.max(10, originalWidth - deltaX)
                        crop.x = originalX + originalWidth - crop.width
                        break
                }
            }
        }
        crop.x = Math.max(0, Math.min(crop.x, bounds.width - crop.width))
        crop.y = Math.max(0, Math.min(crop.y, bounds.height - crop.height))
        if (lockRatio) {
            if (crop.x + crop.width > bounds.width) {
                crop.width = bounds.width - crop.x
                crop.height = Math.max(10, crop.width / aspectRatio)
                crop.y = centerY - crop.height / 2
            }
            if (crop.y + crop.height > bounds.height) {
                crop.height = bounds.height - crop.y
                crop.width = Math.max(10, crop.height * aspectRatio)
                crop.x = centerX - crop.width / 2
            }
        }
        else {
            if (crop.x + crop.width > bounds.width) {
                crop.width = bounds.width - crop.x
            }
            if (crop.y + crop.height > bounds.height) {
                crop.height = bounds.height - crop.y
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
        const ratio = this.crop.width / this.crop.height
        // Check if crop is maximized: centered and either full-screen or ratio-constrained
        const expectedX = (bounds.width - newCrop.width) / 2
        const expectedY = (bounds.height - newCrop.height) / 2
        const isMaximized = Math.abs(newCrop.x - expectedX) < 5 && Math.abs(newCrop.y - expectedY) < 5 &&
            (cropper.lockRatio
             ? (Math.abs(newCrop.width - bounds.width) < 5 || Math.abs(newCrop.height - bounds.height) < 5)
             : (Math.abs(newCrop.width - bounds.width) < 5 && Math.abs(newCrop.height - bounds.height) < 5))

        if (isMaximized && this.savedCropState) {
            newCrop.x = this.savedCropState.x
            newCrop.y = this.savedCropState.y
            newCrop.width = this.savedCropState.width
            newCrop.height = this.savedCropState.height
            this.savedCropState = null
        }
        else {
            if (!isMaximized) {
                this.savedCropState = {x: newCrop.x, y: newCrop.y, width: newCrop.width, height: newCrop.height}
            }
            if (cropper.lockRatio) {
                if (ratio < 1) {
                    // Portrait: Maximize height, adjust width
                    newCrop.height = bounds.height
                    newCrop.width = Math.floor(newCrop.height * ratio)
                    if (newCrop.width > bounds.width) {
                        newCrop.width = bounds.width
                        newCrop.height = Math.floor(newCrop.width / ratio)
                    }
                }
                else {
                    // Landscape: Maximize width, adjust height
                    newCrop.width = bounds.width
                    newCrop.height = Math.floor(newCrop.width / ratio)
                    if (newCrop.height > bounds.height) {
                        newCrop.height = bounds.height
                        newCrop.width = Math.floor(newCrop.height * ratio)
                    }
                }
            }
            else {
                // No lockRatio: Maximize to full screen
                newCrop.x = 0
                newCrop.y = 0
                newCrop.width = bounds.width
                newCrop.height = bounds.height
            }
            newCrop.x = Math.floor((bounds.width - newCrop.width) / 2)
            newCrop.y = Math.floor((bounds.height - newCrop.height) / 2)
        }
        newCrop.width = Math.floor(Math.max(10, newCrop.width))
        newCrop.height = Math.floor(Math.max(10, newCrop.height))
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