/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetDraggable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-25
 * Last modified: 2026-01-25
 *
 *
 * Copyright © 2026 LGS1920
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

    /** @type {WidgetTransform} Reference to WidgetTransform instance */
    #widgetTransform

    /**
     * Creates or returns the singleton instance of WidgetDraggable.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     * @param {WidgetCropper} widgetCropper - The WidgetCropper instance
     * @param {WidgetTransform} widgetTransform - The WidgetTransform instance
     */
    constructor(widgetManager, widgetCropper, widgetTransform) {
        if (WidgetDraggable.#instance) {
            return WidgetDraggable.#instance
        }
        this.#widgetManager = widgetManager
        this.#widgetCropper = widgetCropper
        this.#widgetTransform = widgetTransform
        WidgetDraggable.#instance = this
    }

    /**
     * Handles the start of a drag event.
     * @param {Object} event - Drag event
     */
    onDragStart = async event => {
        const config = await this.#widgetManager.retrieveConfig(event.target)
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
    onDrag = async event => {
        const config = await this.#widgetManager.retrieveConfig(event.target)
        if (config?.isCropper && config.outsideOverlay) {
            const [dx, dy] = event.translate || [0, 0]
            const baseLeft = __.app.parsePx(event.target.style.left || '0')
            const baseTop = __.app.parsePx(event.target.style.top || '0')
            const left = baseLeft + dx
            const top = baseTop + dy
            const width = Number.isFinite(config.cropDimensions?.width) ? config.cropDimensions.width : __.app.parsePx(event.target.style.width || '0') || event.target.getBoundingClientRect().width || 200
            const height = Number.isFinite(config.cropDimensions?.height) ? config.cropDimensions.height : __.app.parsePx(event.target.style.height || '0') || event.target.getBoundingClientRect().height || 200
            if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                config.cropDimensions = {left, top, width, height}
                this.#widgetCropper.applyCropToOverlay(config)
                this.#widgetCropper.dispatchCropUpdate(config, 'drag')
            }
        }
    }

    /**
     * Handles the end of a drag event.
     * @param {Object} event - Drag event
     */
    onDragEnd = async event => {
        event.target.classList.remove('dragging', LGS_ANIMATION_DRAGGING)
        this.#widgetManager.isDragging = false
        const config = await this.#widgetManager.retrieveConfig(event.target)

        // Use transform helper to commit translate to position
        this.#widgetTransform.commitTranslateToPosition(event.target)

        config.element = event.target
        // Use the updated position from config after commitTranslateToPosition
        const left = config.position.left
        const top = config.position.top
        const width = __.app.parsePx(event.target.style.width || '0') || event.target.getBoundingClientRect().width || 200
        const height = __.app.parsePx(event.target.style.height || '0') || event.target.getBoundingClientRect().height || 200

        if (config?.isCropper) {
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
            this.#widgetCropper.dispatchCropUpdate(config, 'drag-end')
        }

        if (config.persist) {
            this.#widgetManager.saveWidgetPosition(config.id, config)
        }

        __.ui.widgetManager.setConfig(config.id, config)


    }
}