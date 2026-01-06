/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetPosition.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Class responsible for positioning widgets relative to their container.
 * Provides methods to position widgets at specific anchor points with configurable margins.
 */
export class WidgetPosition {
    /** @type {WidgetManager} Reference to the WidgetManager instance */
    #widgetManager

    /** @type {number} Default margin for positioning */
    #defaultMargin = lgs.gutter.xs ?? 5

    /** @type {string[]} Valid position anchors for widgets */
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    /**
     * Constructor for WidgetPosition.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     */
    constructor(widgetManager) {
        this.#widgetManager = widgetManager
    }

    /**
     * Positions a widget at the specified anchor point relative to its container.
     * @private
     * @param {HTMLElement} element - The DOM element to position
     * @param {string} anchor - The anchor point (e.g., 'center', 'top-left')
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object with left and top coordinates
     */
    #positionElement = (element, anchor, margin = this.#defaultMargin) => {
        const elementId = this.#widgetManager.getIdFromElement(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)
        if (!config || !config.container || !this.#validPositions.includes(anchor)) {
            return config?.position || {left: 0, top: 0}
        }

        const container = config.container.getBoundingClientRect()
        const widget = element.getBoundingClientRect()
        const defaultWidth = widget.width || 200
        const defaultHeight = widget.height || 200

        let left, top

        // Calculate position based on anchor point
        const positionMap = {
            'center':       () => ({
                left: (container.width - defaultWidth) / 2 + container.left,
                top:  (container.height - defaultHeight) / 2 + container.top,
            }),
            'top':          () => ({
                left: (container.width - defaultWidth) / 2 + container.left,
                top:  container.top + margin,
            }),
            'left':         () => ({
                left: container.left + margin,
                top:  (container.height - defaultHeight) / 2 + container.top,
            }),
            'right':        () => ({
                left: container.right - defaultWidth - margin,
                top:  (container.height - defaultHeight) / 2 + container.top,
            }),
            'bottom':       () => ({
                left: (container.width - defaultWidth) / 2 + container.left,
                top:  container.bottom - defaultHeight - margin,
            }),
            'top-left':     () => ({
                left: container.left + margin,
                top:  container.top + margin,
            }),
            'top-right':    () => ({
                left: container.right - defaultWidth - margin,
                top:  container.top + margin,
            }),
            'bottom-left':  () => ({
                left: container.left + margin,
                top:  container.bottom - defaultHeight - margin,
            }),
            'bottom-right': () => ({
                left: container.right - defaultWidth - margin,
                top:  container.bottom - defaultHeight - margin,
            }),
        }

        // Apply position based on anchor
        if (positionMap[anchor]) {
            ({left, top} = positionMap[anchor]())
        }
        else {
            ({left, top} = positionMap['center']()) // Fallback to center
        }

        // Constrain position within container bounds
        config.position = {
            left: Math.max(container.left + margin, Math.min(left, container.right - defaultWidth - margin)),
            top:  Math.max(container.top + margin, Math.min(top, container.bottom - defaultHeight - margin)),
        }

        config.attachTo = anchor

        // Apply position to element
        element.style.left = `${left}px`
        element.style.top = `${top}px`
        element.style.transformOrigin = `0 0`
        if (config.setPosition) {
            config.setPosition(config.position)
        }

        if (config.persist) {
            this.#widgetManager.saveWidgetPosition(elementId, config)
        }

        const moveable = this.#widgetManager.getMoveable(elementId)
        if (moveable?.current) {
            moveable.current.updateRect()
        }

        return config.position
    }

    /**
     * Positions the widget at the center of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toCenter = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'center', margin)

    /**
     * Positions the widget at the top-left of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toTopLeft = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'top-left', margin)

    /**
     * Positions the widget at the top of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toTop = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'top', margin)

    /**
     * Positions the widget at the left of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toLeft = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'left', margin)

    /**
     * Positions the widget at the right of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toRight = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'right', margin)

    /**
     * Positions the widget at the bottom of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toBottom = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'bottom', margin)

    /**
     * Positions the widget at the top-right of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toTopRight = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'top-right', margin)

    /**
     * Positions the widget at the bottom-left of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toBottomLeft = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'bottom-left', margin)

    /**
     * Positions the widget at the bottom-right of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=this.#defaultMargin] - Margin to apply
     * @returns {Object} New position object
     */
    toBottomRight = (element, margin = this.#defaultMargin) => this.#positionElement(element, 'bottom-right', margin)


}