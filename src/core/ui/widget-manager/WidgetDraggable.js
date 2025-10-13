/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDraggable.js
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
 * Singleton class that manages draggable functionality for widgets.
 */
import { LGS_ANIMATION_DRAGGING } from '@Core/constants'

export class WidgetDraggable {
    // Singleton instance
    static #instance = null

    /** @type {WidgetManager} Reference to WidgetManager instance */
    #widgetManager

    /** @type {WidgetCropper} Reference to WidgetCropper instance */
    #widgetCropper

    /**
     * Creates or returns the singleton instance of WidgetDraggable.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     * @param {WidgetCropper} widgetCropper - The WidgetCropper instance
     */
    constructor(widgetManager, widgetCropper) {
        if (WidgetDraggable.#instance) {
            return WidgetDraggable.#instance
        }
        this.#widgetManager = widgetManager
        this.#widgetCropper = widgetCropper
        WidgetDraggable.#instance = this
    }

    /**
     * Handles the start of a drag event.
     * @param {Object} event - Drag event
     */
    onDragStart = event => {
        event.target.classList.add('dragging')
        const config = this.#widgetManager.retrieveConfig(event.target)
        if (config.animationWhenDragging) {
            event.target.classList.add(LGS_ANIMATION_DRAGGING)
        }
        this.#widgetManager.isDragging = true
        this.#widgetManager._current = this.#widgetManager.retrieveElementId(event.target)
    }

    /**
     * Handles drag events, updating crop overlay in real-time.
     * @param {Object} event - Drag event from Moveable
     */
    onDrag = event => {
        const config = this.#widgetManager.retrieveConfig(event.target)
        if (config?.isCropper && config.outsideOverlay) {
            const [dx, dy] = event.translate || [0, 0]
            const baseLeft = parseInt(event.target.style.left || '0', 10)
            const baseTop = parseInt(event.target.style.top || '0', 10)
            const left = baseLeft + dx
            const top = baseTop + dy
            const width = Number.isFinite(config.cropDimensions?.width) ? config.cropDimensions.width : parseInt(event.target.style.width || '0', 10) || event.target.getBoundingClientRect().width || 200
            const height = Number.isFinite(config.cropDimensions?.height) ? config.cropDimensions.height : parseInt(event.target.style.height || '0', 10) || event.target.getBoundingClientRect().height || 200
            if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                config.cropDimensions = {left, top, width, height}
                this.#widgetCropper.applyCropToOverlay(config)
            }
        }
    }

    /**
     * Handles the end of a drag event.
     * @param {Object} event - Drag event
     */
    onDragEnd = event => {
        event.target.classList.remove('dragging', LGS_ANIMATION_DRAGGING)
        this.#widgetManager.isDragging = false
        const config = this.#widgetManager.retrieveConfig(event.target)
        if (config?.isCropper) {
            const currentTransform = event.target.style.transform || ''
            const match = currentTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
            if (match) {
                const dx = parseFloat(match[1]) || 0
                const dy = parseFloat(match[2]) || 0
                const baseLeft = parseInt(event.target.style.left || '0', 10)
                const baseTop = parseInt(event.target.style.top || '0', 10)
                const finalLeft = Math.round(baseLeft + dx)
                const finalTop = Math.round(baseTop + dy)
                event.target.style.left = `${finalLeft}px`
                event.target.style.top = `${finalTop}px`
                event.target.style.transform = 'none'
                config.transform = undefined
                config.position = {left: finalLeft, top: finalTop}
            }
            config.element = event.target
            const left = parseInt(event.target.style.left || '0', 10)
            const top = parseInt(event.target.style.top || '0', 10)
            const width = parseInt(event.target.style.width || '0', 10) || event.target.getBoundingClientRect().width || 200
            const height = parseInt(event.target.style.height || '0', 10) || event.target.getBoundingClientRect().height || 200
            if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                config.cropDimensions = {left, top, width, height}
            }
            if (config.resizeFromCenter) {
                const container = config.container.getBoundingClientRect()
                config.centerRatio = {
                    x: (left + width / 2) / container.width,
                    y: (top + height / 2) / container.height,
                }
            }
            this.#widgetCropper.applyCropToOverlay(config)
        }
    }
}