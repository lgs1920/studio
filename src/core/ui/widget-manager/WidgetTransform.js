/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetTransform.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-15
 * Last modified: 2026-01-15
 *
 *
 * Copyright © 2026 LGS1920
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
        // Initialize default transformation values
        const result = {
            translate: {x: 0, y: 0},
            scale:     {x: 1, y: 1},
            rotate:    0,
        }

        // Early return if transform string is empty or 'none'
        if (!transformString || transformString === 'none') {
            return result
        }

        // Parse translate values from the string
        const translateMatch = transformString.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
        if (translateMatch) {
            result.translate.x = parseFloat(translateMatch[1]) || 0
            result.translate.y = parseFloat(translateMatch[2]) || 0
        }

        // Parse scale values from the string, handling uniform or separate x/y scales
        const scaleMatch = transformString.match(/scale\(([-\d.]+)(?:,\s*([-\d.]+))?\)/)
        if (scaleMatch) {
            result.scale.x = parseFloat(scaleMatch[1]) || 1
            result.scale.y = scaleMatch[2] ? parseFloat(scaleMatch[2]) : result.scale.x
        }

        // Parse rotate value from the string
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
        // Array to collect transform parts
        const parts = []

        // Add translate if values are not at origin
        if (transforms.translate && (transforms.translate.x !== 0 || transforms.translate.y !== 0)) {
            parts.push(`translate(${transforms.translate.x}px, ${transforms.translate.y}px)`)
        }

        // Add scale if values are not at 1
        if (transforms.scale && (transforms.scale.x !== 1 || transforms.scale.y !== 1)) {
            parts.push(`scale(${transforms.scale.x}, ${transforms.scale.y})`)
        }

        // Add rotate if value is not at 0
        if (transforms.rotate && transforms.rotate !== 0) {
            parts.push(`rotate(${transforms.rotate}deg)`)
        }

        // Join parts or return 'none' if no transforms
        return parts.length > 0 ? parts.join(' ') : 'none'
    }

    /**
     * Updates the translate values in the widget's transform.
     * @param {HTMLElement} element - The DOM element
     * @param {number} x - X translation value
     * @param {number} y - Y translation value
     */
    setTranslate = (element, x, y) => {
        // Retrieve widget ID and config
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        // Early return if config not found
        if (!config) {
            return
        }

        // Parse existing transform
        const currentTransform = this.parseTransform(element.style.transform)

        // Update translate values
        currentTransform.translate = {x, y}

        // Store updated translate in config
        config.translate = currentTransform.translate

        // Build and apply new transform string
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
        // Retrieve widget ID and config
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        // Early return if config not found
        if (!config) {
            return
        }

        // Parse existing transform
        const currentTransform = this.parseTransform(element.style.transform)
        // Update scale values
        currentTransform.scale = {x, y}

        // Store updated scale in config
        config.scale = currentTransform.scale

        // Build and apply new transform string
        const newTransform = this.buildTransform(currentTransform)
        element.style.transform = newTransform
        config.transform = newTransform
    }

    /**
     * Updates the rotation value in the widget's transform.
     * @param {HTMLElement} element - The DOM element
     * @param {number} degrees - Rotation in degrees
     */
    setRotate = (element, degrees) => {
        // Retrieve widget ID and config
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        // Early return if config not found
        if (!config) {
            return
        }

        // Parse existing transform
        const currentTransform = this.parseTransform(element.style.transform)

        // Update rotate value
        currentTransform.rotate = degrees

        // Store updated rotate in config
        config.rotate = degrees

        // Build and apply new transform string
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
        // Retrieve widget ID and config
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)
        // Return default transforms if config not found
        if (!config) {
            return {translate: {x: 0, y: 0}, scale: {x: 1, y: 1}, rotate: 0}
        }

        const transform = this.parseTransform(element.style.transform)
        config.scale = transform.scale
        config.translate = transform.translate
        config.rotate = transform.rotate

        return transform
    }

    /**
     * Resets all transforms for a widget.
     * @param {HTMLElement} element - The DOM element
     */
    resetTransform = element => {
        // Retrieve widget ID and config
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        // Early return if config not found
        if (!config) {
            return
        }

        // Reset transform style and config values
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
        // Retrieve widget ID and config
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        // Early return if config not found
        if (!config) {
            return
        }

        // Get current transforms
        const transforms = this.getTransform(element)

        // Apply translate to position if not zero
        if (transforms.translate.x !== 0 || transforms.translate.y !== 0) {
            // Parse current position
            const currentLeft = parseFloat(element.style.left || '0')
            const currentTop = parseFloat(element.style.top || '0')

            // Calculate new position
            const newLeft = currentLeft + transforms.translate.x
            const newTop = currentTop + transforms.translate.y

            // Update element style and config position
            element.style.transformOrigin = '50% 50%'
            element.style.left = `${newLeft}px`
            element.style.top = `${newTop}px`

            config.position = {left: newLeft, top: newTop}

            // Reset translate in transforms
            transforms.translate = {x: 0, y: 0}
            config.translate = {x: 0, y: 0}

            // Build and apply updated transform
            const newTransform = this.buildTransform(transforms)
            element.style.transform = newTransform
            config.transform = newTransform === 'none' ? undefined : newTransform
        }
    }

    /**
     * Parses position values (supports px, %, or numbers).
     * @param {string|number} value - The position value to parse
     * @param {number} maxDimension - The maximum dimension for percentage calculations
     * @returns {number} Parsed position value in pixels
     */
    parsePosition = (value, maxDimension) => {
        // Handle percentage values
        if (typeof value === 'string' && value.endsWith('%')) {
            const percent = parseFloat(value)
            return isNaN(percent) ? 0 : (percent / 100) * maxDimension
        }
        // Handle px values
        if (typeof value === 'string' && value.endsWith('px')) {
            return parseFloat(value) || 0
        }
        // Handle numeric or string numeric values
        const numValue = typeof value === 'number' ? value : parseFloat(value)
        return isNaN(numValue) ? 0 : numValue
    }

    /**
     * Returns CSS-compatible transformOrigin numbers based on a Moveable direction vector.
     *
     * @param {number} dx - Horizontal direction (-1 = left, 0 = center, 1 = right)
     * @param {number} dy - Vertical direction (-1 = top, 0 = center, 1 = bottom)
     *
     * @returns {x,y} - Numbers representing the transform origin in percentage format (e.g., '0%','100%').
     */
    getTransformOriginFromDirection = (dx, dy) => {
        return {
            x: dx === -1 ? 0 : dx === 1 ? 100 : 50,
            y: dy === -1 ? 0 : dy === 1 ? 100 : 50,
        }
    }

    /**
     * Returns the transform-origin of a DOM element as an object { x, y }.
     * By default, values are returned as percentages relative to the element's size.
     * If `inPixel` is true, values are returned in absolute pixels.
     *
     * @param {HTMLElement} element - The target DOM element.
     * @param {boolean} [inPixel=false] - Whether to return values in pixels instead of percentages.
     * @returns {{x: number, y: number}} An object representing the transform origin.
     *   - If `inPixel` is false: x and y are percentages (0–100).
     *   - If `inPixel` is true: x and y are pixel offsets from the top-left corner.
     *
     * @example
     * getTransformOrigin(myElement); // { x: 50, y: 50 }
     * getTransformOrigin(myElement, true); // { x: 120, y: 75 }
     */
    getTransformOrigin = (element, inPixel = false) => {
        const style = getComputedStyle(element)
        const origin = style.transformOrigin
        const rect = element.getBoundingClientRect()
        const [oxRaw, oyRaw] = origin.split(' ')

        const parseValue = (value, size) => {
            if (value.endsWith('%')) {
                const percent = parseFloat(value)
                return inPixel ? (percent / 100) * size : percent
            }
            const px = parseFloat(value)
            return inPixel ? px : (px / size) * 100
        }

        const x = parseValue(oxRaw, rect.width)
        const y = parseValue(oyRaw, rect.height)

        return {x, y}
    }

    /**
     * Sets the transform-origin of a DOM element using string values like '50%' or '120px'.
     *
     * @param {HTMLElement} element - The target DOM element.
     * @param {{x: string, y: string}} origin - The origin point to set.
     *   - `x` and `y` must be valid CSS length strings (e.g., '50%', '120px').
     *
     * @example
     * setTransformOrigin(myElement, { x: '50%', y: '50%' }); // center
     * setTransformOrigin(myElement, { x: '0%', y: '100%' }); // bottom-left
     * setTransformOrigin(myElement, { x: '120px', y: '75px' }); // absolute pixel origin
     */
    setTransformOrigin = (element, origin) => {
        element.style.transformOrigin = `${origin.x} ${origin.y}`
    }

    /**
     * Converts a transform-origin string object into pixel coordinates based on an element's size.
     *
     * @param {{x: string, y: string}} origin - The transform origin as CSS strings (e.g. '50%', '120px').
     * @param {DOMRect} rect - The bounding rectangle of the element (from getBoundingClientRect).
     * @returns {{x: number, y: number}} The transform origin in pixels.
     *
     * @example
     * const rect = element.getBoundingClientRect();
     * const origin = getTransformOriginFromString({ x: '100%', y: '0%' }, rect);
     * console.log(origin); // { x: rect.width, y: 0 }
     */
    getTransformOriginFromString = (origin, rect) => {
        const parse = (value, size) => {
            if (value.endsWith('%')) {
                return (parseFloat(value) / 100) * size
            }
            return parseFloat(value) // assume px
        }

        return {
            x: rect.left + parse(origin.x, rect.width),
            y: rect.top + parse(origin.y, rect.height),
        }
    }

    /**
     * Updates multiple transform values at once and applies them to the element.
     * Useful for batch updates or complex operations like combined scaling and rotation.
     * * @param {HTMLElement} element - The DOM element.
     * @param {Object} transforms - The transform values to update.
     * @param {Object} [transforms.translate] - Optional translate {x, y}.
     * @param {Object} [transforms.scale] - Optional scale {x, y}.
     * @param {number} [transforms.rotate] - Optional rotation in degrees.
     */
    setTransform = (element, transforms = {}) => {
        const elementId = this.#widgetManager.retrieveElementId(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)

        if (!config) {
            return
        }

        // Get current state to ensure we don't lose existing transformations not provided in the call
        const currentTransform = this.parseTransform(element.style.transform)

        // Merge new values if provided
        if (transforms.translate) {
            currentTransform.translate = {...transforms.translate}
            config.translate = currentTransform.translate
        }

        if (transforms.scale) {
            currentTransform.scale = {...transforms.scale}
            config.scale = currentTransform.scale
        }

        if (transforms.rotate !== undefined) {
            currentTransform.rotate = transforms.rotate
            config.rotate = currentTransform.rotate
        }

        // Apply to DOM and update config string
        const newTransformString = this.buildTransform(currentTransform)
        element.style.transform = newTransformString
        config.transform = newTransformString
    }
}