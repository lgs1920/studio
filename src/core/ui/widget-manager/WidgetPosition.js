/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetPosition.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
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
     * @param {number|null} [topRatio=null] - Optional vertical percentage for the top anchor
     * @returns {Object} New position object with left and top coordinates
     */
    #positionElement = (element, anchor, margin = this.#defaultMargin, topRatio = null) => {
        const elementId = this.#widgetManager.getIdFromElement(element)
        const config = this.#widgetManager.getWidgetConfig(elementId)
        if (!config || !config.container || !this.#validPositions.includes(anchor)) {
            return config?.position || {left: 0, top: 0}
        }

        const boundsContainer = (config.boundsContainer ?? config.container).getBoundingClientRect()
        const referenceContainer = config.container.getBoundingClientRect()
        const widget = element.getBoundingClientRect()
        const style = typeof getComputedStyle === 'function' ? getComputedStyle(element) : null
        const readMargin = value => Math.max(0, Number.parseFloat(value) || 0)
        const elementMarginLeft = readMargin(style?.marginLeft)
        const elementMarginTop = readMargin(style?.marginTop)
        const elementMarginRight = readMargin(style?.marginRight)
        const elementMarginBottom = readMargin(style?.marginBottom)
        const scaleX = config.scale?.x ?? 1
        const scaleY = config.scale?.y ?? 1
        const widgetWidth = widget.width > 0 ? widget.width : 0
        const widgetHeight = widget.height > 0 ? widget.height : 0
        const fallbackWidth = widgetWidth || 200
        const fallbackHeight = widgetHeight || 200
        const baseWidth = config.isCropper
                          ? (config.cropDimensions?.width ?? fallbackWidth)
                          : (config.dimensions?.width ?? (fallbackWidth / (scaleX || 1)))
        const baseHeight = config.isCropper
                           ? (config.cropDimensions?.height ?? fallbackHeight)
                           : (config.dimensions?.height ?? (fallbackHeight / (scaleY || 1)))
        const scaledWidth = baseWidth * scaleX
        const scaledHeight = baseHeight * scaleY
        const angle = (config.rotate ?? 0) * (Math.PI / 180)
        const absCos = Math.abs(Math.cos(angle))
        const absSin = Math.abs(Math.sin(angle))
        const rotatedWidth = (scaledWidth * absCos) + (scaledHeight * absSin)
        const rotatedHeight = (scaledWidth * absSin) + (scaledHeight * absCos)

        let centerX, centerY

        // Calculate position based on anchor point
        const positionMap = {
            'center':       () => ({
                centerX: boundsContainer.left + (boundsContainer.width / 2),
                centerY: boundsContainer.top + (boundsContainer.height / 2),
            }),
            'top':          () => ({
                centerX: boundsContainer.left + (boundsContainer.width / 2),
                centerY: boundsContainer.top + (
                    Number.isFinite(topRatio) ? (boundsContainer.height * (topRatio / 100)) : margin
                ) + (rotatedHeight / 2),
            }),
            'left':         () => ({
                centerX: boundsContainer.left + margin + (rotatedWidth / 2),
                centerY: boundsContainer.top + (boundsContainer.height / 2),
            }),
            'right':        () => ({
                centerX: boundsContainer.right - margin - (rotatedWidth / 2),
                centerY: boundsContainer.top + (boundsContainer.height / 2),
            }),
            'bottom':       () => ({
                centerX: boundsContainer.left + (boundsContainer.width / 2),
                centerY: boundsContainer.bottom - margin - (rotatedHeight / 2),
            }),
            'top-left':     () => ({
                centerX: boundsContainer.left + margin + (rotatedWidth / 2),
                centerY: boundsContainer.top + margin + (rotatedHeight / 2),
            }),
            'top-right':    () => ({
                centerX: boundsContainer.right - margin - (rotatedWidth / 2),
                centerY: boundsContainer.top + margin + (rotatedHeight / 2),
            }),
            'bottom-left':  () => ({
                centerX: boundsContainer.left + margin + (rotatedWidth / 2),
                centerY: boundsContainer.bottom - margin - (rotatedHeight / 2),
            }),
            'bottom-right': () => ({
                centerX: boundsContainer.right - margin - (rotatedWidth / 2),
                centerY: boundsContainer.bottom - margin - (rotatedHeight / 2),
            }),
        }

        // Apply position based on anchor
        if (positionMap[anchor]) {
            ({centerX, centerY} = positionMap[anchor]())
        }
        else {
            ({centerX, centerY} = positionMap['center']()) // Fallback to center
        }

        // Constrain visual bounds by clamping the center point
        const minCenterX = boundsContainer.left + margin + (rotatedWidth / 2)
        const maxCenterX = boundsContainer.right - margin - elementMarginLeft - elementMarginRight - (rotatedWidth / 2)
        const minCenterY = boundsContainer.top + margin + (rotatedHeight / 2)
        const maxCenterY = boundsContainer.bottom - margin - elementMarginTop - elementMarginBottom - (rotatedHeight / 2)
        const clampedCenterX = Math.min(Math.max(centerX, minCenterX), maxCenterX)
        const clampedCenterY = Math.min(Math.max(centerY, minCenterY), maxCenterY)
        config.position = {
            left: clampedCenterX - (baseWidth / 2),
            top:  clampedCenterY - (baseHeight / 2),
        }
        config.runtimeReady = true

        config.attachTo = anchor

        // Apply position to element
        element.style.left = `${config.position.left}px`
        element.style.top = `${config.position.top}px`
        element.style.transformOrigin = `50% 50%`
        if (config.setPosition) {
            config.setPosition(config.position)
        }

        // Keep ratios aligned with center-based persistence
        const useCropDimensions = config.isCropper &&
            Number.isFinite(config.cropDimensions?.width) &&
            Number.isFinite(config.cropDimensions?.height)
        const ratioWidth = useCropDimensions ? config.cropDimensions.width : baseWidth
        const ratioHeight = useCropDimensions ? config.cropDimensions.height : baseHeight
        const ratioCenterX = config.position.left + (ratioWidth / 2)
        const ratioCenterY = config.position.top + (ratioHeight / 2)
        const relativeCenterX = ratioCenterX - referenceContainer.left
        const relativeCenterY = ratioCenterY - referenceContainer.top
        config.savedRatios = {
            leftRatio: referenceContainer.width > 0 ? (relativeCenterX / referenceContainer.width) * 100 : 0,
            topRatio:  referenceContainer.height > 0 ? (relativeCenterY / referenceContainer.height) * 100 : 0,
        }

        if (config.persist) {
            this.#widgetManager.saveWidgetPosition(elementId, config)
        }

        const moveable = this.#widgetManager.getMoveable(elementId)
        if (moveable?.current) {
            moveable.current.updateRect()
        }

        this.#widgetManager.refreshEditorPreviewSnapshot(elementId)

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
     * Positions a widget horizontally centered at a percentage of the container height.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} topRatio - Vertical position as a percentage of the container height
     * @param {number} [margin=0] - Additional margin from the requested vertical position
     * @returns {Object} New position object
     */
    toTopPercentage = (element, topRatio, margin = 0) => this.#positionElement(element, 'top', margin, topRatio)

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
