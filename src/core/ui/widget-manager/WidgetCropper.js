/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCropper.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-13
 * Last modified: 2025-10-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Singleton class that manages cropping functionality for widgets.
 */
export class WidgetCropper {
    // Singleton instance
    static #instance = null

    /** @type {WidgetManager} Reference to WidgetManager instance */
    #widgetManager

    /** @type {number} Scale factor for crop dimensions */
    #CROP_SCALE_FACTOR = 1

    /** @type {{width: number, height: number}} Minimum crop size */
    #MIN_CROP_SIZE = {width: 0, height: 0}

    /**
     * Creates or returns the singleton instance of WidgetCropper.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     */
    constructor(widgetManager) {
        if (WidgetCropper.#instance) {
            return WidgetCropper.#instance
        }
        this.#widgetManager = widgetManager
        WidgetCropper.#instance = this
    }

    /**
     * Sets up cropper-specific properties for an element.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} config - Widget configuration
     */
    setupCropper = (element, config) => {
        // Initialize crop dimensions if not persisted
        const hasPersistedCrop =
                  config?.cropDimensions &&
                  Number.isFinite(config.cropDimensions.left) &&
                  Number.isFinite(config.cropDimensions.top) &&
                  Number.isFinite(config.cropDimensions.width) &&
                  Number.isFinite(config.cropDimensions.height) &&
                  config.cropDimensions.width > 0 &&
                  config.cropDimensions.height > 0
        if (!hasPersistedCrop) {
            this.cropDimensions(config)
        }

        // Apply crop dimensions
        element.style.left = `${config.cropDimensions.left}px`
        element.style.top = `${config.cropDimensions.top}px`
        element.style.width = `${config.cropDimensions.width}px`
        element.style.height = `${config.cropDimensions.height}px`
        element.style.transform = 'none'
        config.position = {left: config.cropDimensions.left, top: config.cropDimensions.top}
        this.applyCropToOverlay(config)
    }

    /**
     * Applies crop dimensions to the overlay element.
     * @param {Object} config - Widget configuration
     */
    applyCropToOverlay = config => {
        if (!config?.isCropper || !config.outsideOverlay || !config.cropDimensions) {
            return
        }
        const {left, top, width, height} = config.cropDimensions
        // Ensure dimensions are valid before applying clip-path
        if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            config.outsideOverlay.style.clipPath = this.openWindowInOverlay({left, top, width, height})
        }
    }

    /**
     * Computes crop dimensions.
     * @param {Object} config - Widget configuration
     * @param {boolean} maximize - Whether to maximize crop
     * @returns {Object} Crop dimensions
     */
    cropDimensions = (config, maximize = false) => {
        const container = this.#widgetManager.refreshBounds(config)
        container.width = container.right - container.left
        container.height = container.bottom - container.top
        const padding = config.margin || 0
        const paddedWidth = container.width - 2 * padding
        const paddedHeight = container.height - 2 * padding
        let width = 0
        let height = 0
        const maxWidth = Math.floor(paddedWidth * this.#CROP_SCALE_FACTOR)
        const maxHeight = Math.floor(paddedHeight * this.#CROP_SCALE_FACTOR)
        if (!config.useRatio || !config.ratio?.locked) {
            // Free ratio: maximize to full container size
            width = Math.max(config.minCropSize.width, maxWidth)
            height = Math.max(config.minCropSize.height, maxHeight)
        }
        else {
            // Locked ratio: respect aspect ratio
            const ratio = config.ratio.aspectRatio
            if (ratio === 1) {
                width = height = Math.floor(Math.max(config.minCropSize.width, Math.min(maxWidth, maxHeight)))
            }
            else if (ratio < 1) {
                height = Math.floor(Math.max(config.minCropSize.height, maxHeight))
                width = Math.floor(Math.max(config.minCropSize.width, height * ratio))
                if (width > maxWidth) {
                    width = maxWidth
                    height = Math.floor(width / ratio)
                }
            }
            else {
                width = Math.floor(Math.max(config.minCropSize.width, maxWidth))
                height = Math.floor(Math.max(config.minCropSize.height, width / ratio))
                if (height > maxHeight) {
                    height = maxHeight
                    width = Math.floor(height * ratio)
                }
            }
        }
        const left = Math.floor((paddedWidth - width) / 2) + padding
        const top = Math.floor((paddedHeight - height) / 2) + padding
        config.cropDimensions = {left, top, width, height}
        if (config.resizeFromCenter) {
            config.centerRatio = {x: 0.5, y: 0.5}
        }
        // Update ratio to reflect new dimensions
        config.ratio = {...config.ratio, aspectRatio: width / height, locked: config.ratio?.locked ?? true}
        return config.cropDimensions
    }

    /**
     * Creates a clip path for the overlay based on crop dimensions.
     * @param {Object} crop - Crop dimensions object
     * @returns {string} CSS clip-path string
     */
    openWindowInOverlay = crop => {
        return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 
      0% ${crop.top}px, 
      ${crop.left}px ${crop.top}px, 
      ${crop.left}px ${crop.top + crop.height}px, 
      ${crop.left + crop.width}px ${crop.top + crop.height}px, 
      ${crop.left + crop.width}px ${crop.top}px, 
      0% ${crop.top}px)`
    }

    /**
     * Handles double-click events, maximizing the crop zone.
     * @param {Object} event - Click event
     * @param {Function} setPosition - Function to set position
     */
    onDoubleClick = (event, setPosition) => {
        const config = this.#widgetManager.retrieveConfig(event.target)
        if (!config?.isCropper) {
            return
        }

        // Maximize using cropDimensions
        this.cropDimensions(config, true)

        // Apply styles and update state
        const {left, top, width, height} = config.cropDimensions
        Object.assign(event.target.style, {
            left:      `${left}px`,
            top:       `${top}px`,
            width:     `${width}px`,
            height:    `${height}px`,
            transform: 'none',
        })
        config.transform = undefined
        config.position = {left, top}
        this.applyCropToOverlay(config)
        setPosition({left, top})
        if (config.moveable && config.moveable.current) {
            config.moveable.current.updateRect()
        }
        this.dispatchCropUpdate(config, 'toggle')
    }

    /**
     * Updates the crop zone ratio and dimensions.
     * @param {string} cropzoneId - The crop zone ID
     * @param {number} aspectRatio - The new aspect ratio
     * @param {boolean} lockRatio - Whether to lock the ratio
     */
    updateCropRatio = (cropzoneId, aspectRatio, lockRatio) => {
        const config = this.#widgetManager.getWidgetConfig(cropzoneId)
        if (!config || !config.isCropper) {
            console.warn('[WidgetCropper] No valid cropzone found for ID:', cropzoneId)
            return
        }

        // Ensure element exists
        if (!config.element) {
            const element = this.#widgetManager.getElementById(cropzoneId)
            if (element) {
                config.element = element
            }
            else {
                console.warn('[WidgetCropper] No element found for cropzone ID:', cropzoneId)
                return
            }
        }

        // Dispatch pre-update event
        document.dispatchEvent(new CustomEvent('onBeforeCropUpdate', {
            detail: {
                id: cropzoneId,
            },
        }))

        // Clear previousCropDimensions and timeout to avoid stale state
        clearTimeout(config.restoreTimeoutId)
        config.restoreTimeoutId = null
        config.previousCropDimensions = null
        this.#widgetManager._current = cropzoneId

        // Calculate new dimensions based on aspect ratio
        const container = config.container.getBoundingClientRect()
        const padding = config.margin || 0
        const paddedWidth = container.width - 2 * padding
        const paddedHeight = container.height - 2 * padding
        const maxWidth = Math.floor(paddedWidth * this.#CROP_SCALE_FACTOR)
        const maxHeight = Math.floor(paddedHeight * this.#CROP_SCALE_FACTOR)
        let width, height
        if (aspectRatio === 1) {
            width = height = Math.floor(Math.max(config.minCropSize.width, Math.min(maxWidth, maxHeight)))
        }
        else if (aspectRatio < 1) {
            height = Math.floor(Math.max(config.minCropSize.height, maxHeight))
            width = Math.floor(Math.max(config.minCropSize.width, height * aspectRatio))
            if (width > maxWidth) {
                width = maxWidth
                height = Math.floor(width / aspectRatio)
            }
        }
        else {
            width = Math.floor(Math.max(config.minCropSize.width, maxWidth))
            height = Math.floor(Math.max(config.minCropSize.height, width / aspectRatio))
            if (height > maxHeight) {
                height = maxHeight
                width = Math.floor(height * aspectRatio)
            }
        }

        // Center the crop zone
        const left = Math.floor((paddedWidth - width) / 2) + padding
        const top = Math.floor((paddedHeight - height) / 2) + padding
        config.cropDimensions = {left, top, width, height}
        config.position = {left, top}
        config.centerRatio = {x: (left + width / 2) / container.width, y: (top + height / 2) / container.height}
        // Update config.ratio to ensure synchronization
        config.ratio = {aspectRatio, locked: lockRatio}

        // Apply styles to element
        const element = config.element
        element.style.left = `${left}px`
        element.style.top = `${top}px`
        element.style.width = `${width}px`
        element.style.height = `${height}px`
        element.style.transform = 'none'

        // Update overlay and position
        this.applyCropToOverlay(config)
        if (config.setPosition) {
            config.setPosition({left, top})
        }
        if (config.moveable.current) {
            config.moveable.current.updateRect()
        }

        // Dispatch crop update event
        this.dispatchCropUpdate(config, 'ratio')
    }

    /**
     * Dispatches a crop update event.
     * @param {Object} config - Widget configuration
     * @param {string} phase - The phase of the crop update
     */
    dispatchCropUpdate = (config, phase) => {
        try {
            document.dispatchEvent(new CustomEvent('onCropUpdate', {
                detail: {
                    id:    config.id,
                    crop:  {...config.cropDimensions},
                    ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                    phase,
                },
            }))
        }
        catch (error) {
            console.error('[WidgetCropper] Error dispatching crop update event:', error)
        }
    }

    /**
     * Handles container resize for cropper elements.
     * @param {Object} config - Widget configuration
     * @param {HTMLElement} element - The DOM element
     * @param {Object} moveable - Moveable instance
     * @param {Function} setPosition - Function to set position
     */
    handleContainerResize = (config, element, moveable, setPosition) => {
        const t = element.style.transform || ''
        const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
        const baseLeft = parseInt(element.style.left || '0', 10)
        const baseTop = parseInt(element.style.top || '0', 10)
        const dx = m ? parseFloat(m[1]) || 0 : 0
        const dy = m ? parseFloat(m[2]) || 0 : 0
        let left = Math.round(baseLeft + dx)
        let top = Math.round(baseTop + dy)
        let width = Number(config.cropDimensions?.width) || parseInt(element.style.width || '0', 10)
        let height = Number(config.cropDimensions?.height) || parseInt(element.style.height || '0', 10)
        width = Math.max(0, width)
        height = Math.max(0, height)
        const maxLeft = Math.max(config.bounds.left, config.bounds.right - width)
        const maxTop = Math.max(config.bounds.top, config.bounds.bottom - height)
        left = Math.min(Math.max(left, config.bounds.left), maxLeft)
        top = Math.min(Math.max(top, config.bounds.top), maxTop)
        element.style.left = `${left}px`
        element.style.top = `${top}px`
        element.style.transform = 'none'
        config.transform = undefined
        config.position = {left, top}
        config.cropDimensions = {left, top, width, height}
        this.applyCropToOverlay(config)
        this.dispatchCropUpdate(config, 'container-resize')
    }
}