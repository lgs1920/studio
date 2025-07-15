/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CropperManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-15
 * Last modified: 2025-07-15
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Class to manage crop region logic, including bounds calculations and state updates.
 * Handles HDPI scaling and constrains crop region to source or container dimensions.
 * @class CropperManager
 */
export class CropperManager {
    /**
     * Device pixel ratio for HDPI scaling
     * @type {number}
     */
    dpr

    /**
     * Current crop region coordinates and size in device pixels
     * @type {{x: number, y: number, width: number, height: number}}
     */
    crop = {x: 0, y: 0, width: 0, height: 0}

    /**
     * Previous crop region for restore functionality
     * @type {{x: number, y: number, width: number, height: number}|null}
     */
    #previousCrop = null

    /**
     * Flag indicating if crop is maximized
     * @type {boolean}
     */
    #isMaximized = false

    /**
     * Window size state for resize tracking
     * @type {{width: number, height: number}}
     */
    #windowSize = {
        width:  window.innerWidth,
        height: window.innerHeight,
    }

    /**
     * Creates a new CropperManager instance
     * @param {HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} source - The source element to crop
     * @param {HTMLElement|null} container - The container element for bounds (optional, defaults to source)
     * @param {Object} store - The global store for cropper state
     * @throws {Error} If source is invalid
     */
    constructor(source, container, store) {
        if (!source || !(source instanceof HTMLCanvasElement || source instanceof HTMLVideoElement || source instanceof HTMLImageElement)) {
            throw new Error('Invalid source: must be a canvas, video, or image element')
        }

        this.dpr = window.devicePixelRatio || 1
        this.source = source
        this.container = container || source // Use source as default container
        this.$cropper = store // Global store reference
        this.#initCrop()
    }

    /**
     * Initializes the crop region with HDPI-adjusted values, constrained to container
     * @private
     */
    #initCrop() {
        const containerBounds = this.getSourceBounds()
        // Fallback to reasonable defaults if container dimensions are unavailable
        const containerWidth = (this.container.width || containerBounds.width / this.dpr || 1280) * this.dpr
        const containerHeight = (this.container.height || containerBounds.height / this.dpr || 720) * this.dpr
        const cropWidth = Math.min(
            this.$cropper.width || containerWidth,
            containerBounds.width,
        )
        const cropHeight = Math.min(
            this.$cropper.height || containerHeight,
            containerBounds.height,
        )
        this.crop = {
            x:      this.$cropper.x ?? (containerBounds.width - cropWidth) / 2 + containerBounds.x,
            y:      this.$cropper.y ?? (containerBounds.height - cropHeight) / 2 + containerBounds.y,
            width:  cropWidth,
            height: cropHeight,
        }
        this.#updateStore()
    }

    /**
     * Computes container bounds in device pixels for HDPI support
     * @returns {{x: number, y: number, width: number, height: number}} Container bounds
     */
    getSourceBounds() {
        const rect = this.container.getBoundingClientRect()
        return {
            x:      rect.left * this.dpr,
            y:      rect.top * this.dpr,
            width:  (this.container.width || rect.width || 1280) * this.dpr,
            height: (this.container.height || rect.height || 720) * this.dpr,
        }
    }

    /**
     * Computes bounds and aspect ratio for the crop region, constrained to container
     * @param {Object} cropper - Cropper state from global store
     * @returns {{minX: number, minY: number, maxX: number, maxY: number, minSize: number, aspectRatio: number}} Bounds
     *     and aspect ratio
     */
    getBounds(cropper) {
        const containerBounds = this.getSourceBounds()
        const minX = containerBounds.x
        const minY = containerBounds.y
        const maxX = containerBounds.x + containerBounds.width
        const maxY = containerBounds.y + containerBounds.height
        let aspectRatio = 1
        if (cropper.mode === 'ratio') {
            const preset = __.presets.ratios.find(r => r.value === cropper.presetValue)
            aspectRatio = preset?.aspectRatio || 1
        }
        else {
            const [w, h] = cropper.presetValue.split('x').map(Number)
            aspectRatio = w / h
        }
        return {minX, minY, maxX, maxY, minSize: 20 * this.dpr, aspectRatio}
    }

    /**
     * Updates window size state
     */
    updateWindowSize() {
        this.#windowSize = {
            width:  window.innerWidth,
            height: window.innerHeight,
        }
    }

    /**
     * Updates crop region when container bounds change
     * @param {Object} cropper - Cropper state from global store
     */
    updateCropOnSourceChange(cropper) {
        const bounds = this.getBounds(cropper)
        let newX = this.crop.x
        let newY = this.crop.y
        let newWidth = this.crop.width
        let newHeight = this.crop.height

        if (newX < bounds.minX) {
            newX = bounds.minX
        }
        if (newY < bounds.minY) {
            newY = bounds.minY
        }
        if (newX + newWidth > bounds.maxX || newY + newHeight > bounds.maxY) {
            if (cropper.lockRatio) {
                const widthScale = (bounds.maxX - newX) / newWidth
                const heightScale = (bounds.maxY - newY) / newHeight
                const scale = Math.min(widthScale, heightScale, 1)
                newWidth = Math.max(bounds.minSize, newWidth * scale)
                newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                if (newY + newHeight > bounds.maxY) {
                    newHeight = Math.max(bounds.minSize, bounds.maxY - newY)
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                }
                if (newX + newWidth > bounds.maxX) {
                    newWidth = Math.max(bounds.minSize, bounds.maxX - newX)
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                }
            }
            else {
                newWidth = Math.max(bounds.minSize, Math.min(newWidth, bounds.maxX - newX))
                newHeight = Math.max(bounds.minSize, Math.min(newHeight, bounds.maxY - newY))
            }
        }

        this.crop = {x: newX, y: newY, width: newWidth, height: newHeight}
        this.#updateStore()
    }

    /**
     * Updates the global store with current crop values
     * @private
     */
    #updateStore() {
        this.$cropper.x = this.crop.x
        this.$cropper.y = this.crop.y
        this.$cropper.width = this.crop.width
        this.$cropper.height = this.crop.height
    }

    /**
     * Public method to sync store with current crop values
     */
    syncStore() {
        this.#updateStore()
    }

    /**
     * Toggles between maximized and restored crop states
     * @param {Object} cropper - Cropper state from global store
     */
    maximizeRestore(cropper) {
        const bounds = this.getBounds(cropper)
        if (!this.#isMaximized) {
            this.#previousCrop = {...this.crop}
            let newWidth, newHeight, newX, newY
            if (cropper.lockRatio) {
                newWidth = bounds.maxX - bounds.minX
                newHeight = newWidth / bounds.aspectRatio
                if (newHeight > bounds.maxY - bounds.minY) {
                    newHeight = bounds.maxY - bounds.minY
                    newWidth = newHeight * bounds.aspectRatio
                }
                newX = bounds.minX + (bounds.maxX - bounds.minX - newWidth) / 2
                newY = bounds.minY + (bounds.maxY - bounds.minY - newHeight) / 2
            }
            else {
                newWidth = bounds.maxX - bounds.minX
                newHeight = bounds.maxY - bounds.minY
                newX = bounds.minX
                newY = bounds.minY
            }
            this.crop = {x: newX, y: newY, width: newWidth, height: newHeight}
            this.#isMaximized = true
        }
        else {
            if (this.#previousCrop) {
                this.crop = {...this.#previousCrop}
                this.#isMaximized = false
                this.#previousCrop = null
            }
        }
        this.#updateStore()
    }

    /**
     * Centers the crop region within the container
     * @param {Object} cropper - Cropper state from global store
     */
    centerCrop(cropper) {
        const bounds = this.getBounds(cropper)
        const newX = bounds.minX + (bounds.maxX - bounds.minX - this.crop.width) / 2
        const newY = bounds.minY + (bounds.maxY - bounds.minY - this.crop.height) / 2
        this.crop = {...this.crop, x: newX, y: newY}
        this.#updateStore()
    }

    /**
     * Updates crop region during drag or resize interactions
     * @param {string} action - Action type ('drag' or 'resize-<direction>')
     * @param {Object} cropper - Cropper state from global store
     * @param {number} clientX - X coordinate of pointer/touch in device pixels
     * @param {number} clientY - Y coordinate of pointer/touch in device pixels
     * @param {Object} start - Initial crop and pointer state
     * @param {Object} sourceBounds - Container bounds in device pixels
     * @param {boolean} dragLockedHorizontal - Horizontal drag lock state
     * @param {boolean} dragLockedVertical - Vertical drag lock state
     * @returns {{showHCenterLine: boolean, showVCenterLine: boolean, dragLockedHorizontal: boolean,
     *     dragLockedVertical: boolean}} Interaction updates
     */
    updateCrop(action, cropper, clientX, clientY, start, sourceBounds, dragLockedHorizontal, dragLockedVertical) {
        const dx = (clientX - start.clientX) * (action === 'drag' ? 0.4 : 1)
        const dy = (clientY - start.clientY) * (action === 'drag' ? 0.4 : 1)
        const bounds = this.getBounds(cropper)
        let newX = this.crop.x
        let newY = this.crop.y
        let newWidth = this.crop.width
        let newHeight = this.crop.height

        if (action === 'drag') {
            newX = Math.max(bounds.minX, Math.min(start.x + dx, bounds.maxX - this.crop.width))
            newY = Math.max(bounds.minY, Math.min(start.y + dy, bounds.maxY - this.crop.height))
            const hCenter = Math.abs((newX + this.crop.width / 2) - (sourceBounds.x + sourceBounds.width / 2)) < (5 * this.dpr)
            const vCenter = Math.abs((newY + this.crop.height / 2) - (sourceBounds.y + sourceBounds.height / 2)) < (5 * this.dpr)
            const updates = {
                showHCenterLine:      vCenter,
                showVCenterLine:      hCenter,
                dragLockedHorizontal: hCenter,
                dragLockedVertical:   vCenter,
            }
            if (hCenter || vCenter) {
                navigator.vibrate?.(200)
            }
            this.crop = {x: newX, y: newY, width: newWidth, height: newHeight}
            this.#updateStore()
            return updates
        }
        else if (action.startsWith('resize')) {
            const dir = action.replace('resize-', '')
            const useSymmetric = cropper.lockRatio && !start.isShiftPressed
            const centerX = this.crop.x + this.crop.width / 2
            const centerY = this.crop.y + this.crop.height / 2

            if (useSymmetric) {
                if (dir === 'se' || dir === 'e') {
                    newWidth = Math.max(bounds.minSize, Math.min(2 * (clientX - centerX), bounds.maxX - bounds.minX))
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    if (centerY + newHeight / 2 > bounds.maxY || centerY - newHeight / 2 < bounds.minY) {
                        newHeight = Math.max(bounds.minSize, 2 * Math.min(bounds.maxY - centerY, centerY - bounds.minY))
                        newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    }
                    newX = centerX - newWidth / 2
                    newY = centerY - newHeight / 2
                }
                else if (dir === 'sw' || dir === 'w') {
                    newWidth = Math.max(bounds.minSize, Math.min(2 * (centerX - clientX), bounds.maxX - bounds.minX))
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    if (centerY + newHeight / 2 > bounds.maxY || centerY - newHeight / 2 < bounds.minY) {
                        newHeight = Math.max(bounds.minSize, 2 * Math.min(bounds.maxY - centerY, centerY - bounds.minY))
                        newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    }
                    newX = centerX - newWidth / 2
                    newY = centerY - newHeight / 2
                }
                else if (dir === 'ne' || dir === 'n') {
                    newHeight = Math.max(bounds.minSize, Math.min(2 * (centerY - clientY), bounds.maxY - bounds.minY))
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    if (centerX + newWidth / 2 > bounds.maxX || centerX - newWidth / 2 < bounds.minX) {
                        newWidth = Math.max(bounds.minSize, 2 * Math.min(bounds.maxX - centerX, centerX - bounds.minX))
                        newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    }
                    newX = centerX - newWidth / 2
                    newY = centerY - newHeight / 2
                }
                else if (dir === 's') {
                    newHeight = Math.max(bounds.minSize, Math.min(2 * (clientY - centerY), bounds.maxY - bounds.minY))
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    if (centerX + newWidth / 2 > bounds.maxX || centerX - newWidth / 2 < bounds.minX) {
                        newWidth = Math.max(bounds.minSize, 2 * Math.min(bounds.maxX - centerX, centerX - bounds.minX))
                        newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    }
                    newX = centerX - newWidth / 2
                    newY = centerY - newHeight / 2
                }
            }
            else if (cropper.lockRatio) {
                if (dir === 'se') {
                    newWidth = Math.max(bounds.minSize, Math.min(clientX - this.crop.x, bounds.maxX - this.crop.x))
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    if (newY + newHeight > bounds.maxY) {
                        newHeight = Math.max(bounds.minSize, bounds.maxY - newY)
                        newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    }
                }
                else if (dir === 'sw') {
                    newX = Math.max(bounds.minX, Math.min(clientX, this.crop.x + this.crop.width - bounds.minSize))
                    newWidth = Math.max(bounds.minSize, this.crop.x + this.crop.width - newX)
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    if (newY + newHeight > bounds.maxY) {
                        newHeight = Math.max(bounds.minSize, bounds.maxY - newY)
                        newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                        newX = this.crop.x + this.crop.width - newWidth
                    }
                }
                else if (dir === 'ne') {
                    newY = Math.max(bounds.minY, Math.min(clientY, this.crop.y + this.crop.height - bounds.minSize))
                    newHeight = Math.max(bounds.minSize, this.crop.y + this.crop.height - newY)
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    if (newX + newWidth > bounds.maxX) {
                        newWidth = Math.max(bounds.minSize, bounds.maxX - newX)
                        newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                        newY = this.crop.y + this.crop.height - newHeight
                    }
                }
                else if (dir === 'nw') {
                    newX = Math.max(bounds.minX, Math.min(clientX, this.crop.x + this.crop.width - bounds.minSize))
                    newWidth = Math.max(bounds.minSize, this.crop.x + this.crop.width - newX)
                    newY = Math.max(bounds.minY, Math.min(clientY, this.crop.y + this.crop.height - bounds.minSize))
                    newHeight = Math.max(bounds.minSize, this.crop.y + this.crop.height - newY)
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    if (newX + newWidth > bounds.maxX) {
                        newWidth = Math.max(bounds.minSize, bounds.maxX - newX)
                        newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                        newY = this.crop.y + this.crop.height - newHeight
                    }
                    if (newY + newHeight > bounds.maxY) {
                        newHeight = Math.max(bounds.minSize, bounds.maxY - newY)
                        newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                        newX = this.crop.x + this.crop.width - newWidth
                    }
                }
                else if (dir === 'e') {
                    newWidth = Math.max(bounds.minSize, Math.min(clientX - this.crop.x, bounds.maxX - this.crop.x))
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    if (newY + newHeight > bounds.maxY) {
                        newHeight = Math.max(bounds.minSize, bounds.maxY - newY)
                        newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    }
                }
                else if (dir === 'w') {
                    newX = Math.max(bounds.minX, Math.min(clientX, this.crop.x + this.crop.width - bounds.minSize))
                    newWidth = Math.max(bounds.minSize, this.crop.x + this.crop.width - newX)
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    if (newY + newHeight > bounds.maxY) {
                        newHeight = Math.max(bounds.minSize, bounds.maxY - newY)
                        newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                        newX = this.crop.x + this.crop.width - newWidth
                    }
                }
                else if (dir === 's') {
                    newHeight = Math.max(bounds.minSize, Math.min(clientY - this.crop.y, bounds.maxY - this.crop.y))
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    if (newX + newWidth > bounds.maxX) {
                        newWidth = Math.max(bounds.minSize, bounds.maxX - newX)
                        newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    }
                }
                else if (dir === 'n') {
                    newY = Math.max(bounds.minY, Math.min(clientY, this.crop.y + this.crop.height - bounds.minSize))
                    newHeight = Math.max(bounds.minSize, this.crop.y + this.crop.height - newY)
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    if (newX + newWidth > bounds.maxX) {
                        newWidth = Math.max(bounds.minSize, bounds.maxX - newX)
                        newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                        newY = this.crop.y + this.crop.height - newHeight
                    }
                }
            }
            else {
                if (dir === 'se') {
                    newWidth = Math.max(bounds.minSize, Math.min(clientX - this.crop.x, bounds.maxX - this.crop.x))
                    newHeight = Math.max(bounds.minSize, Math.min(clientY - this.crop.y, bounds.maxY - this.crop.y))
                }
                else if (dir === 'sw') {
                    newX = Math.max(bounds.minX, Math.min(clientX, this.crop.x + this.crop.width - bounds.minSize))
                    newWidth = Math.max(bounds.minSize, this.crop.x + this.crop.width - newX)
                    newHeight = Math.max(bounds.minSize, Math.min(clientY - this.crop.y, bounds.maxY - this.crop.y))
                }
                else if (dir === 'ne') {
                    newY = Math.max(bounds.minY, Math.min(clientY, this.crop.y + this.crop.height - bounds.minSize))
                    newHeight = Math.max(bounds.minSize, this.crop.y + this.crop.height - newY)
                    newWidth = Math.max(bounds.minSize, Math.min(clientX - this.crop.x, bounds.maxX - this.crop.x))
                }
                else if (dir === 'nw') {
                    newX = Math.max(bounds.minX, Math.min(clientX, this.crop.x + this.crop.width - bounds.minSize))
                    newWidth = Math.max(bounds.minSize, this.crop.x + this.crop.width - newX)
                    newY = Math.max(bounds.minY, Math.min(clientY, this.crop.y + this.crop.height - bounds.minSize))
                    newHeight = Math.max(bounds.minSize, this.crop.y + this.crop.height - newY)
                }
                else if (dir === 'e') {
                    newWidth = Math.max(bounds.minSize, Math.min(clientX - this.crop.x, bounds.maxX - this.crop.x))
                }
                else if (dir === 'w') {
                    newX = Math.max(bounds.minX, Math.min(clientX, this.crop.x + this.crop.width - bounds.minSize))
                    newWidth = Math.max(bounds.minSize, this.crop.x + this.crop.width - newX)
                }
                else if (dir === 's') {
                    newHeight = Math.max(bounds.minSize, Math.min(clientY - this.crop.y, bounds.maxY - this.crop.y))
                }
                else if (dir === 'n') {
                    newY = Math.max(bounds.minY, Math.min(clientY, this.crop.y + this.crop.height - bounds.minSize))
                    newHeight = Math.max(bounds.minSize, this.crop.y + this.crop.height - newY)
                }
            }

            if (useSymmetric) {
                if (newX < bounds.minX) {
                    newX = bounds.minX
                    newWidth = Math.min((centerX - bounds.minX) * 2, bounds.maxX - bounds.minX)
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    newY = centerY - newHeight / 2
                }
                else if (newX + newWidth > bounds.maxX) {
                    newX = bounds.maxX - newWidth
                    newWidth = Math.min((bounds.maxX - centerX) * 2, bounds.maxX - bounds.minX)
                    newHeight = Math.max(bounds.minSize, newWidth / bounds.aspectRatio)
                    newY = centerY - newHeight / 2
                }
                if (newY < bounds.minY) {
                    newY = bounds.minY
                    newHeight = Math.min((centerY - bounds.minY) * 2, bounds.maxY - bounds.minY)
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    newX = centerX - newWidth / 2
                }
                else if (newY + newHeight > bounds.maxY) {
                    newY = bounds.maxY - newHeight
                    newHeight = Math.min((bounds.maxY - centerY) * 2, bounds.maxY - bounds.minY)
                    newWidth = Math.max(bounds.minSize, newHeight * bounds.aspectRatio)
                    newX = centerX - newWidth / 2
                }
            }

            this.crop = {x: newX, y: newY, width: newWidth, height: newHeight}
            this.#updateStore()
            return {
                showHCenterLine:      false,
                showVCenterLine:      false,
                dragLockedHorizontal: false,
                dragLockedVertical:   false,
            }
        }
    }

    /**
     * Cleans up the instance
     */
    destroy() {
        // No-op, kept for compatibility
    }
}