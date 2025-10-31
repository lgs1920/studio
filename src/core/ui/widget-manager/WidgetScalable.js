/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetScalable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-31
 * Last modified: 2025-10-31
 *
 *
 * Copyright © 2025 LGS1920
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

    /** @type {WidgetCropper} Reference to WidgetCropper instance */
    #widgetCropper

    /** @type {WidgetTransform} Reference to WidgetTransform instance */
    #widgetTransform

    /**
     * Creates or returns the singleton instance of WidgetScalable.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     * @param {WidgetCropper} widgetCropper - The WidgetCropper instance
     * @param {WidgetTransform} widgetTransform - The WidgetTransform instance
     */
    constructor(widgetManager, widgetCropper, widgetTransform) {
        if (WidgetScalable.#instance) {
            return WidgetScalable.#instance
        }
        this.#widgetManager = widgetManager
        this.#widgetCropper = widgetCropper
        this.#widgetTransform = widgetTransform
        WidgetScalable.#instance = this
    }

    /**
     * Handles scale operations, throttled to prevent excessive updates.
     * @private
     * @param {Object} event - Scale event
     * @param {HTMLElement} target - Target element
     * @param {Function} setPosition - Function to set position
     * @param {Object} childRef - Child reference
     */
    #handleScale = (event, target, setPosition, childRef) => {
        if (!target || !event) {
            return
        }
        this.#widgetManager.isScaling = true

        const config = this.#widgetManager.getWidgetConfig(this.#widgetManager.retrieveElementId(target))

        // Get scale values from the event (
        const scaleX = Number(event.scale?.[0].toFixed(2)) ?? 1
        const scaleY = Number(event.scale?.[1].toFixed(2)) ?? 1


        // Store scale in config
        config.scale = {x: scaleX, y: scaleY}

        // Use transform helper to set scale (preserves other transforms)
        this.#widgetTransform.setScale(target, scaleX, scaleY)

        // Update child component if it has a handleScale method
        if (childRef?.current?.handleScale) {
            childRef.current.handleScale({
                                             scale:     {x: scaleX, y: scaleY},
                                             transform: target.style.transform,
                                         })
        }

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

        // Initialize scale if not present
        if (!config.scale) {
            config.scale = {x: 1, y: 1}
        }

        if (config.animationWhenScaling) {
            event.target.classList.add(LGS_ANIMATION_SCALING)
        }
    }

    /**
     * Handles scale events, updating element scale and position.
     * @param {Object} event - Scale event
     * @param {Object} refs - References object
     * @param {Function} setPosition - Function to set position
     */
    onScale = (event, refs, setPosition) => {
        this.#handleScale(event, refs.widget?.current, setPosition, refs.child)
    }

    /**
     * Handles the end of a scale event.
     * @param {Object} event - Scale event
     */
    onScaleEnd = async event => {
        this.#widgetManager.isScaling = false
        event.target.classList.remove('scaling', LGS_ANIMATION_SCALING)
        //   event.target.style.transformOrigin = '0 0'
        const config = await this.#widgetManager.retrieveConfig(event.target)

        // Extract final scale values using transform helper
        const transforms = this.#widgetTransform.getTransform(event.target)
        config.scale = transforms.scale
        const {x, y} = event.target.getBoundingClientRect()

        const style = getComputedStyle(event.target)

        config.position = {
            left: parseFloat(x) - parseFloat(style.marginLeft),
            top:  parseFloat(y) - parseFloat(style.marginTop),
        }

        if (config.persist) {
            this.#widgetManager.saveWidgetPosition(config.id, config)
        }

        __.ui.widgetManager.setConfig(config.id, config)

    }
}