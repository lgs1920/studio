/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetScalable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-30
 * Last modified: 2026-04-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Singleton class that manages scalable functionality for widgets.
 */
import { LGS_ANIMATION_SCALING } from '@Core/constants'

export class WidgetScalable {
    // Singleton instance
    static #instance = null

    /** @type {WidgetManager} Reference to WidgetManager instance */
    #widgetManager

    /** @type {WidgetTransform} Reference to WidgetTransform instance */
    #widgetTransform

    /**
     * Creates or returns the singleton instance of WidgetScalable.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     * @param {WidgetCropper} widgetCropper - The WidgetCropper instance
     * @param {WidgetTransform} widgetTransform - The WidgetTransform instance
     */
    constructor(widgetManager, _widgetCropper, widgetTransform) {
        if (WidgetScalable.#instance) {
            return WidgetScalable.#instance
        }
        this.#widgetManager = widgetManager
        this.#widgetTransform = widgetTransform
        WidgetScalable.#instance = this
    }

    #toScaleValue = value => {
        const rounded = typeof value?.toFixed === 'function' ? value.toFixed(4) : value
        const scale = Number(rounded)
        return Number.isFinite(scale) ? scale : 1
    }

    /**
     * Clamps a scale {x, y} value according to config.min and config.max dimensions.
     * If ratio is locked, clamps both axes to the same value (most restrictive).
     * @public
     * @param {Object} scale - The scale to clamp { x: number, y: number }
     * @param {Object} config - Widget configuration
     * @returns {{ x: number, y: number }} Clamped scale
     */
    clampScale = (scale, config) => {
        // Guard clause
        if (!scale || !config?.dimensions || !config.min || !config.max) {
            return scale
        }

        const {width, height} = config.dimensions
        const minWidth = config.min.width
        const minHeight = config.min.height
        const maxWidth = config.max.width
        const maxHeight = config.max.height

        const minScaleX = minWidth / width
        const minScaleY = minHeight / height
        const maxScaleX = maxWidth / width
        const maxScaleY = maxHeight / height

        // If ratio is locked, use the most restrictive scale factor
        const isRatioLocked = config.ratio?.locked === true

        if (isRatioLocked) {
            // Compute allowed scale range for both axes
            const minScale = Math.max(minScaleX, minScaleY)
            const maxScale = Math.min(maxScaleX, maxScaleY)

            // Clamp the input scale to the common allowed range
            const clamped = Math.max(minScale, Math.min(maxScale, scale.x))
            return {x: clamped, y: clamped}
        }
        else {
            // Independent clamping per axis
            return {
                x: Math.max(minScaleX, Math.min(maxScaleX, scale.x)),
                y: Math.max(minScaleY, Math.min(maxScaleY, scale.y)),
            }
        }
    }

    /**
     * Handles scale operations, throttled to prevent excessive updates.
     * @private
     * @param {Object} event - Scale event
     * @param {HTMLElement} target - Target element
     */
    #handleScale = (event, target) => {
        if (!target || !event) {
            return
        }
        this.#widgetManager.isScaling = true

        const config = this.#widgetManager.getWidgetConfig(this.#widgetManager.retrieveElementId(target))

        // Update config
        config.scale = {
            x: this.#toScaleValue(event.scale?.[0]),
            y: this.#toScaleValue(event.scale?.[1]),
        }
        this.#widgetTransform.applyScaleVariables(target, config.scale)
        this.#widgetManager.isScaling = false
    }

    /**
     * Handles the start of a scale event.
     * @param {Object} event - Scale event
     */
    onScaleStart = async event => {
        this.#widgetManager.isScaling = true
        event.target.classList.add('scaling')
        const config = await this.#widgetManager.retrieveConfig(event.target)
        event.setMinScaleSize([config.min.width, config.min.height])
        event.setMaxScaleSize([config.max.width, config.max.height])

        if (config.animationWhenScaling) {
            event.target.classList.add(LGS_ANIMATION_SCALING)
        }
    }

    /**
     * Handles scale events, updating element scale and position.
     * @param {Object} event - Scale event
     * @param {Object} refs - References object
     */
    onScale = (event, refs) => {
        this.#handleScale(event, refs.widget?.current)
    }

    /**
     * Handles the end of a scale event.
     * @param {Object} event - Scale event
     */
    onScaleEnd = async event => {
        this.#widgetManager.isScaling = false
        event.target.classList.remove('scaling', LGS_ANIMATION_SCALING)

        const config = await this.#widgetManager.retrieveConfig(event.target)

        // Commit any translate that happened during scale to position
        this.#widgetTransform.commitTranslateToPosition(event.target)

        // Now get the transforms (scale without translate)
        const transforms = this.#widgetTransform.getTransform(event.target)
        config.scale = transforms.scale
        this.#widgetTransform.applyScaleVariables(event.target, config.scale)
        config.runtimeReady = true

        // Position was already updated by commitTranslateToPosition
        // Just make sure config.position is in sync
        const left = parseFloat(event.target.style.left || '0')
        const top = parseFloat(event.target.style.top || '0')
        config.position = {left, top}

        if (config.persist) {
            await this.#widgetManager.saveWidgetPosition(config.id, config)
        }

        __.ui.widgetManager.setConfig(config.id, config)
    }
}
