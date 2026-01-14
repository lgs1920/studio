/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetRotatable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-14
 * Last modified: 2026-01-14
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Singleton class that manages rotatable functionality for widgets.
 */
export class WidgetRotatable {
    // Singleton instance
    static #instance = null

    /** @type {WidgetManager} Reference to WidgetManager instance */
    #widgetManager

    /** @type {WidgetTransform} Reference to WidgetTransform instance */
    #widgetTransform

    /**
     * Creates or returns the singleton instance of WidgetRotatable.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     * @param {WidgetTransform} widgetTransform - The WidgetTransform instance
     */
    constructor(widgetManager, widgetTransform) {
        if (WidgetRotatable.#instance) {
            return WidgetRotatable.#instance
        }
        this.#widgetManager = widgetManager
        this.#widgetTransform = widgetTransform
        WidgetRotatable.#instance = this
    }

    /**
     * Handles rotation operations, updating the widget configuration.
     * @private
     * @param {Object} event - Rotate event from Moveable or similar
     * @param {HTMLElement} target - Target element
     */
    #handleRotate = (event, target) => {
        if (!target || !event) {
            return
        }

        const elementId = this.#widgetManager.retrieveElementId(target)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        if (!config) {
            return
        }

        // Apply rotation via WidgetTransform to ensure origin and transform string consistency
        this.#widgetTransform.setRotate(target, event.rotate)

        // Update local config state
        config.rotate = Number(event.rotate.toFixed(2))
    }

    /**
     * Handles the start of a rotation event.
     * @param {Object} event - Rotate event
     */
    onRotateStart = async event => {
        this.#widgetManager.isRotating = true
        event.target.classList.add('rotating')

        // Ensure the origin is locked to center for predictable rotation
        event.target.style.transformOrigin = '50% 50%'
    }

    /**
     * Handles rotation events during interaction.
     * @param {Object} event - Rotate event
     * @param {Object} refs - References object containing widget current element
     */
    onRotate = (event, refs) => {
        this.#handleRotate(event, refs.widget?.current)
    }

    /**
     * Handles the end of a rotation event and persists the state.
     * @param {Object} event - Rotate event
     */
    onRotateEnd = async event => {
        this.#widgetManager.isRotating = false
        event.target.classList.remove('rotating')

        const elementId = this.#widgetManager.retrieveElementId(event.target)
        const config = await this.#widgetManager.retrieveConfig(event.target)

        // Synchronize config with the actual DOM transform state
        const transforms = this.#widgetTransform.getTransform(event.target)
        config.rotate = transforms.rotate

        // Save to backend/store if persistence is enabled
        if (config.persist) {
            this.#widgetManager.saveWidgetPosition(config.id, config)
        }

        // Update global UI state
        __.ui.widgetManager.setConfig(config.id, config)
    }

    /**
     * Snaps the rotation to specific increments (e.g., 45 degrees).
     * @param {number} degrees - Current rotation
     * @param {number} snapAngle - Increment to snap to
     * @returns {number} Snapped rotation
     */
    snapRotation = (degrees, snapAngle = 45) => {
        return Math.round(degrees / snapAngle) * snapAngle
    }
}