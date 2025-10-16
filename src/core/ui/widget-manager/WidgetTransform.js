/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetTransform.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-16
 * Last modified: 2025-10-16
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Singleton class that manages all transformations (translate, scale, rotate) for widgets.
 * Centralizes transform operations to prevent conflicts between drag, scale, and other transforms.
 */
export class WidgetTransform {
    // Singleton instance
    static #instance = null

    /** @type {WidgetManager} Reference to WidgetManager instance */
    #widgetManager

    /**
     * Creates or returns the singleton instance of WidgetTransform.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     */
    constructor(widgetManager) {
        if (WidgetTransform.#instance) {
            return WidgetTransform.#instance
        }
        this.#widgetManager = widgetManager
        WidgetTransform.#instance = this
    }

    /**
     * Parses a transform string and extracts individual transformations.
     * @param {string} transformString - The CSS transform string
     * @returns {Object} Object containing translate, scale, rotate values
     */
    parseTransform = transformString => {
        const result = {
            translate: {x: 0, y: 0},
            scale:     {x: 1, y: 1},
            rotate:    0,
        }

        if (!transformString || transformString === 'none') {
            return result
        }

        // Parse translate
        const translateMatch = transformString.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
        if (translateMatch) {
            result.translate.x = parseFloat(translateMatch[1]) || 0
            result.translate.y = parseFloat(translateMatch[2]) || 0
        }

        // Parse scale
        const scaleMatch = transformString.match(/scale\(([-\d.]+)(?:,\s*([-\d.]+))?\)/)
        if (scaleMatch) {
            result.scale.x = parseFloat(scaleMatch[1]) || 1
            result.scale.y = scaleMatch[2] ? parseFloat(scaleMatch[2]) : result.scale.x
        }

        // Parse rotate
        const rotateMatch = transformString.match(/rotate\(([-\d.]+)deg\)/)
        if (rotateMatch) {
            result.rotate = parseFloat(rotateMatch[1]) || 0
        }

        return result
    }

    /**
     * Builds a transform string from individual transformation values.
     * @param {Object} transforms - Object containing translate, scale, rotate values
     * @returns {string} CSS transform string
     */
    buildTransform = transforms => {
        const parts = []

        // Add translate if not at origin
        if (transforms.translate && (transforms.translate.x !== 0 || transforms.translate.y !== 0)) {
            parts.push(`translate(${transforms.translate.x}px, ${transforms.translate.y}px)`)
        }

        // Add scale if not at 1
        if (transforms.scale && (transforms.scale.x !== 1 || transforms.scale.y !== 1)) {
            parts.push(`scale(${transforms.scale.x}, ${transforms.scale.y})`)
        }

        // Add rotate if not at 0
        if (transforms.rotate && transforms.rotate !== 0) {
            parts.push(`rotate(${transforms.rotate}deg)`)
        }

        return parts.length > 0 ? parts.join(' ') : 'none'
    }

    /**
     * Updates the translate values in the widget's transform.
     * @param {HTMLElement} element - The DOM element
     * @param {number} x - X translation value
     * @param {number} y - Y translation value
     */
    setTranslate = (element, x, y) => {
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        if (!config) {
            return
        }

        // Parse existing transform
        const currentTransform = this.parseTransform(element.style.transform)

        // Update translate
        currentTransform.translate = {x, y}

        // Store in config
        config.translate = currentTransform.translate

        // Build and apply new transform
        const newTransform = this.buildTransform(currentTransform)
        element.style.transform = newTransform
        config.transform = newTransform
    }

    /**
     * Updates the scale values in the widget's transform.
     * @param {HTMLElement} element - The DOM element
     * @param {number} x - X scale value
     * @param {number} y - Y scale value
     */
    setScale = (element, x, y) => {
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        if (!config) {
            return
        }

        // Parse existing transform
        const currentTransform = this.parseTransform(element.style.transform)

        // Update scale
        currentTransform.scale = {x, y}

        // Store in config
        config.scale = currentTransform.scale

        // Build and apply new transform
        const newTransform = this.buildTransform(currentTransform)
        element.style.transform = newTransform
        config.transform = newTransform

        console.log(newTransform)
    }

    /**
     * Updates the rotation value in the widget's transform.
     * @param {HTMLElement} element - The DOM element
     * @param {number} degrees - Rotation in degrees
     */
    setRotate = (element, degrees) => {
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        if (!config) {
            return
        }

        // Parse existing transform
        const currentTransform = this.parseTransform(element.style.transform)

        // Update rotate
        currentTransform.rotate = degrees

        // Store in config
        config.rotate = degrees

        // Build and apply new transform
        const newTransform = this.buildTransform(currentTransform)
        element.style.transform = newTransform
        config.transform = newTransform
    }

    /**
     * Gets the current transform values for a widget.
     * @param {HTMLElement} element - The DOM element
     * @returns {Object} Object containing translate, scale, rotate values
     */
    getTransform = element => {
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        if (!config) {
            return {translate: {x: 0, y: 0}, scale: {x: 1, y: 1}, rotate: 0}
        }

        // Parse from element if not in config
        if (!config.transform) {
            return this.parseTransform(element.style.transform)
        }

        return this.parseTransform(config.transform)
    }

    /**
     * Resets all transforms for a widget.
     * @param {HTMLElement} element - The DOM element
     */
    resetTransform = element => {
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        if (!config) {
            return
        }

        element.style.transform = 'none'
        config.transform = undefined
        config.translate = {x: 0, y: 0}
        config.scale = {x: 1, y: 1}
        config.rotate = 0
    }

    /**
     * Commits translate transform to position (used at end of drag).
     * @param {HTMLElement} element - The DOM element
     */
    commitTranslateToPosition = element => {
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        if (!config) {
            return
        }

        const transforms = this.getTransform(element)

        if (transforms.translate.x !== 0 || transforms.translate.y !== 0) {
            // Apply translate to position
            const currentLeft = parseInt(element.style.left || '0', 10)
            const currentTop = parseInt(element.style.top || '0', 10)

            const newLeft = Math.round(currentLeft + transforms.translate.x)
            const newTop = Math.round(currentTop + transforms.translate.y)

            element.style.left = `${newLeft}px`
            element.style.top = `${newTop}px`

            config.position = {left: newLeft, top: newTop}

            // Reset translate but keep other transforms
            transforms.translate = {x: 0, y: 0}
            config.translate = {x: 0, y: 0}

            const newTransform = this.buildTransform(transforms)
            element.style.transform = newTransform
            config.transform = newTransform === 'none' ? undefined : newTransform
        }
    }
}