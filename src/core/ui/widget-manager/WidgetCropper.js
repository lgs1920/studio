/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCropper.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-24
 * Last modified: 2026-04-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { VIDEO_CROP_ZONE, VIDEO_WIDGETS_BOARD } from '@Core/constants'

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
     * @param {Object} [moveable] - Moveable instance reference (optional)
     */
    setupCropper = (element, config, moveable) => {
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

        // Set moveable instance if provided
        if (moveable?.current) {
            this.#widgetManager.setMoveable(config.id, moveable)
        }
    }

    /**
     * Applies crop dimensions to the overlay element.
     * @param {Object} config - Widget configuration
     */
    applyCropToOverlay = config => {
        if (!config?.isCropper || !config.outsideOverlay || !config.cropDimensions) {
            return
        }
        let {left, top, width, height} = config.cropDimensions
        const overlayRect = config.outsideOverlay.getBoundingClientRect()
        if (config.element?.isConnected) {
            const cropRect = config.element.getBoundingClientRect()
            left = cropRect.left - overlayRect.left
            top = cropRect.top - overlayRect.top
            width = cropRect.width
            height = cropRect.height
        }
        else if (config.container) {
            const containerRect = config.container.getBoundingClientRect()
            left = left + containerRect.left - overlayRect.left
            top = top + containerRect.top - overlayRect.top
        }
        // Ensure dimensions are valid before applying clip-path
        if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            config.outsideOverlay.style.clipPath = this.openWindowInOverlay({left, top, width, height})
        }
    }

    /**
     * Synchronizes crop dimensions from the actual DOM element currently rendered on screen.
     * Useful when a cropper is about to unmount or when Firefox keeps a stale transform
     * until the final layout pass.
     *
     * @param {string} cropzoneId - Crop zone identifier
     * @param {boolean} persist - Whether to persist the synced crop after update
     * @param {string} phase - Crop update phase label
     * @returns {Promise<Object|null>} Updated crop dimensions or null when unavailable
     */
    syncCropDimensionsFromElement = async (cropzoneId, persist = false, phase = 'sync') => {
        const config = this.#widgetManager.getWidgetConfig(cropzoneId)
        if (!config?.isCropper) {
            return null
        }

        const previousCrop = config.cropDimensions ? {...config.cropDimensions} : null

        const element = config.element?.isConnected
                        ? config.element
                        : this.#widgetManager.getElementById(cropzoneId)
        const container = config.container ?? lgs.canvas

        const readPx = value => {
            if (!value) {
                return null
            }
            const px = __.app.parsePx(value || '')
            return Number.isFinite(px) ? px : null
        }

        const elementRect = element?.getBoundingClientRect?.()
        const containerRect = container?.getBoundingClientRect?.()
        const elementLeft = Number.isFinite(elementRect?.left) && Number.isFinite(containerRect?.left)
                            ? elementRect.left - containerRect.left
                            : elementRect?.left
        const elementTop = Number.isFinite(elementRect?.top) && Number.isFinite(containerRect?.top)
                           ? elementRect.top - containerRect.top
                           : elementRect?.top
        const persistedCrop = config.cropDimensions ?? {}
        // Inline dimensions are the untransformed logical crop size. DOMRect
        // can still reflect a historical transform while the editor is closing.
        const crop = {
            left:   Math.round(elementLeft ?? readPx(element?.style?.left) ?? config.position?.left ?? persistedCrop.left),
            top:    Math.round(elementTop ?? readPx(element?.style?.top) ?? config.position?.top ?? persistedCrop.top),
            width:  Math.round(readPx(element?.style?.width) ?? elementRect?.width ?? persistedCrop.width ?? 0),
            height: Math.round(readPx(element?.style?.height) ?? elementRect?.height ?? persistedCrop.height ?? 0),
        }

        if (!Number.isFinite(crop.left) ||
            !Number.isFinite(crop.top) ||
            !Number.isFinite(crop.width) ||
            !Number.isFinite(crop.height) ||
            crop.width <= 0 ||
            crop.height <= 0) {
            return config.cropDimensions ?? null
        }

        config.element = element ?? null
        config.container = container
        config.position = {left: crop.left, top: crop.top}
        config.cropDimensions = crop

        if (config.resizeFromCenter && containerRect?.width > 0 && containerRect?.height > 0) {
            config.centerRatio = {
                x: (crop.left + crop.width / 2) / containerRect.width,
                y: (crop.top + crop.height / 2) / containerRect.height,
            }
        }

        this.applyCropToOverlay(config)
        this.dispatchCropUpdate(config, phase, previousCrop)
        this.#widgetManager.setConfig(cropzoneId, config)

        if (persist && config.persist) {
            await this.#widgetManager.saveWidgetPosition(cropzoneId, config)
        }

        return crop
    }

    /**
     * Computes crop dimensions when the data are not coming from a DB record
     *
     * @param {Object} config - Widget configuration
     * @param {boolean} maximize - Whether to maximize crop
     * @returns {Object} Crop dimensions
     */
    cropDimensions = (config, maximize = false) => {

        if (!config.fromDB) {
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
        }
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
     * Updates the crop zone ratio and dimensions.
     * @param {string} cropzoneId - The crop zone ID
     * @param {string} value - The crop zone value, widthxheight, i.e., 16x9
     * @param {number} aspectRatio - The new aspect ratio
     * @param {boolean} lockRatio - Whether to lock the ratio
     */
    updateCropRatio = (cropzoneId, value, aspectRatio, lockRatio) => {
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

        const previousCrop = config.cropDimensions ? {...config.cropDimensions} : null

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
            // aspectRatio is Nan for when ratio is free
            height = Math.floor(Math.max(config.minCropSize.height,
                                         isNaN(aspectRatio) ? maxHeight : width / aspectRatio))
            if (height > maxHeight) {
                height = maxHeight
                width = Math.floor(isNaN(aspectRatio) ? height : height * aspectRatio)
            }
        }

        // Center the crop zone
        const left = Math.floor((paddedWidth - width) / 2) + padding
        const top = Math.floor((paddedHeight - height) / 2) + padding
        config.cropDimensions = {left, top, width, height}
        config.position = {left, top}
        config.centerRatio = {x: (left + width / 2) / container.width, y: (top + height / 2) / container.height}
        // Update config.ratio to ensure synchronization
        config.ratio = {value, aspectRatio, locked: lockRatio}

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
        const moveable = this.#widgetManager.getMoveable(cropzoneId)
        if (moveable?.current) {
            moveable.current.updateRect()
        }

        if (config.fromDB) {
            this.#widgetManager.saveWidgetPosition(cropzoneId, config)
        }

        // Dispatch crop update event
        this.dispatchCropUpdate(config, 'ratio', previousCrop)
    }

    /**
     * Dispatches a crop update event.
     * @param {Object} config - Widget configuration
     * @param {string} phase - The phase of the crop update
     * @param {Object|null} previousCrop - Previous crop dimensions
     */
    dispatchCropUpdate = (config, phase, previousCrop = null) => {
        try {
            if (config.id === VIDEO_CROP_ZONE) {
                this.#widgetManager.repositionWidgetsForBoard?.(
                    VIDEO_WIDGETS_BOARD,
                    config.cropDimensions,
                    previousCrop,
                )
                const refreshAfterLayout = () => {
                    const currentConfig = this.#widgetManager.getWidgetConfig(VIDEO_CROP_ZONE) ?? config
                    this.applyCropToOverlay(currentConfig)
                    // The first pass already projected mounted widgets from
                    // previousCrop to the new crop. The deferred pass is only
                    // for late-mounted widgets and must use the current crop
                    // as its reference; reusing previousCrop here applies the
                    // resize twice and sends widgets toward the corners.
                    this.#widgetManager.repositionWidgetsForBoard?.(
                        VIDEO_WIDGETS_BOARD,
                        currentConfig.cropDimensions,
                    )
                }
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(refreshAfterLayout)
                }
            }
            document.dispatchEvent(new CustomEvent('onCropUpdate', {

                detail: {
                    id:    config.id,
                    crop:  {...config.cropDimensions},
                    ratio: {
                        value: config?.ratio?.value,
                        aspectRatio: config?.ratio?.aspectRatio,
                        locked:      config?.ratio?.locked,
                    },
                    phase,
                },
            }))
        }
        catch (error) {
            console.error('[WidgetCropper] Error dispatching crop update event:', error)
        }
    }

    // /**
    //  * Handles container resize for cropper elements.
    //  * @param {Object} config - Widget configuration
    //  * @param {HTMLElement} element - The DOM element
    //  * @param {Object} moveable - Moveable instance
    //  * @param {Function} setPosition - Function to set position
    //  */
    // handleContainerResize = (config, element, moveable, setPosition) => {
    //     const t = element.style.transform || ''
    //     const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
    //     const baseLeft =  __.app.parsePx(element.style.left || '0')
    //     const baseTop =  __.app.parsePx(element.style.top || '0')
    //     const dx = m ? parseFloat(m[1]) || 0 : 0
    //     const dy = m ? parseFloat(m[2]) || 0 : 0
    //     let left = Math.round(baseLeft + dx)
    //     let top = Math.round(baseTop + dy)
    //     let width = Number(config.cropDimensions?.width) ||  __.app.parsePx(element.style.width || '0')
    //     let height = Number(config.cropDimensions?.height) ||  __.app.parsePx(element.style.height || '0')
    //     width = Math.max(0, width)
    //     height = Math.max(0, height)
    //     const maxLeft = Math.max(config.bounds.left, config.bounds.right - width)
    //     const maxTop = Math.max(config.bounds.top, config.bounds.bottom - height)
    //     left = Math.min(Math.max(left, config.bounds.left), maxLeft)
    //     top = Math.min(Math.max(top, config.bounds.top), maxTop)
    //     element.style.left = `${left}px`
    //     element.style.top = `${top}px`
    //     element.style.transform = 'none'
    //     config.transform = undefined
    //     config.position = {left, top}
    //     config.cropDimensions = {left, top, width, height}
    //     this.applyCropToOverlay(config)
    //     this.dispatchCropUpdate(config, 'container-resize')
    // }
}
