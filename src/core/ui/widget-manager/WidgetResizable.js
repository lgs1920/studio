/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetResizable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-25
 * Last modified: 2025-10-25
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Singleton class that manages resizable functionality for widgets.
 */
import { LGS_ANIMATION_RESIZING } from '@Core/constants'

export class WidgetResizable {
    // Singleton instance
    static #instance = null

    /** @type {WidgetManager} Reference to WidgetManager instance */
    #widgetManager

    /** @type {WidgetCropper} Reference to WidgetCropper instance */
    #widgetCropper

    #cardinalDirections = {
        '0,-1':  'n',
        '0,1':   's',
        '1,0':   'e',
        '-1,0':  'w',
        '1,-1':  'ne',
        '-1,-1': 'nw',
        '1,1':   'se',
        '-1,1':  'sw',
    }

    #resizeDirection = ''

    /**
     * Creates or returns the singleton instance of WidgetResizable.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     * @param {WidgetCropper} widgetCropper - The WidgetCropper instance
     */
    constructor(widgetManager, widgetCropper) {
        if (WidgetResizable.#instance) {
            return WidgetResizable.#instance
        }
        this.#widgetManager = widgetManager
        this.#widgetCropper = widgetCropper
        WidgetResizable.#instance = this
    }

    /**
     * Throttles a function to limit its execution rate.
     * @private
     * @param {Function} func - The function to throttle
     * @param {number} limit - Minimum time between executions in milliseconds
     * @returns {Function} Throttled function
     */
    #throttle = (func, limit) => {
        let lastCall = 0
        return (...args) => {
            const now = performance.now()
            if (now - lastCall >= limit) {
                lastCall = now
                func(...args)
            }
        }
    }

    /**
     * Handles resize operations, throttled to prevent excessive updates.
     * @private
     * @param {Object} event - Resize event
     * @param {HTMLElement} target - Target element
     * @param {Function} setPosition - Function to set position
     * @param {Object} childRef - Child reference
     */
    #handleResize = this.#throttle((event, target, setPosition, childRef) => {
        if (!target || !event) {
            return
        }
        this.#widgetManager.isResizing = true
        const width = Math.round(event.width)
        const height = Math.round(event.height)
        const config = this.#widgetManager.getWidgetConfig(this.#widgetManager.retrieveElementId(target))
        const prevCropDimensions = config.isCropper ? {...config.cropDimensions} : {}
        const baseLeft = parseInt(target.style.left || '0', 10)
        const baseTop = parseInt(target.style.top || '0', 10)
        const currentWidth = config.isCropper ? prevCropDimensions?.width || width : parseInt(target.style.width || '0', 10) || width
        const currentHeight = config.isCropper ? prevCropDimensions?.height || height : parseInt(target.style.height || '0', 10) || height
        let finalLeft = baseLeft
        let finalTop = baseTop

        // Adjust position for center-based resizing
        if (config?.resizeFromCenter) {
            finalLeft = Math.round(baseLeft + (currentWidth - width) / 2)
            finalTop = Math.round(baseTop + (currentHeight - height) / 2)
            const container = config.container.getBoundingClientRect()
            config.centerRatio = {
                x: (finalLeft + width / 2) / container.width,
                y: (finalTop + height / 2) / container.height,
            }
        }
        else {
            const [dx, dy] = event.direction
            const directionMap = {
                '1,1':   {left: baseLeft, top: baseTop},
                '1,-1':  {left: baseLeft, top: baseTop + (currentHeight - height)},
                '-1,1':  {left: baseLeft + (currentWidth - width), top: baseTop},
                '-1,-1': {left: baseLeft + (currentWidth - width), top: baseTop + (currentHeight - height)},
                '-1,0':  {left: baseLeft + (currentWidth - width), top: baseTop},
                '1,0':   {left: baseLeft, top: baseTop},
                '0,1':   {left: baseLeft, top: baseTop},
                '0,-1':  {left: baseLeft, top: baseTop + (currentHeight - height)},
            }
            const k = `${dx},${dy}`
            const d = directionMap[k] || directionMap['1,1']
            finalLeft = d.left
            finalTop = d.top
        }

        // Constrain position within bounds
        const maxLeft = Math.max(config.bounds.left, config.bounds.right - width)
        const maxTop = Math.max(config.bounds.top, config.bounds.bottom - height)
        finalLeft = Math.min(Math.max(finalLeft, config.bounds.left), maxLeft)
        finalTop = Math.min(Math.max(finalTop, config.bounds.top), maxTop)

        // Apply styles
        target.style.left = `${finalLeft}px`
        target.style.top = `${finalTop}px`
        target.style.width = `${width}px`
        target.style.height = `${height}px`
        target.style.transform = 'none'

        // Update config.position and crop dimensions
        config.position = {left: finalLeft, top: finalTop}
        if (config.isCropper) {
            const before = prevCropDimensions
            const after = {left: finalLeft, top: finalTop, width, height}
            config.cropDimensions = after
            if (!before ||
                before.left !== after.left ||
                before.top !== after.top ||
                before.width !== after.width ||
                before.height !== after.height) {
                this.#widgetCropper.dispatchCropUpdate(config, 'resize')
            }
            this.#widgetCropper.applyCropToOverlay(config)
        }

        // Update overlay and child component
        setPosition({left: finalLeft, top: finalTop})
        if (childRef.current?.handleResize) {
            childRef.current.handleResize({left: finalLeft, top: finalTop, width, height})
        }
        this.#widgetManager.isResizing = false
    }, 16)

    /**
     * Handles the start of a resize event.
     * @param {Object} event - Resize event
     */
    onResizeStart = async event => {
        this.#widgetManager.isResizing = true
        this.#resizeDirection = event.direction
        console.log(event.target)
        event.target.classList.add('resizing', `direction-${this.#cardinalDirections[this.#resizeDirection]}`)
        const config = await this.#widgetManager.retrieveConfig(event.target)

        if (config.animationWhenResizing) {
            event.target.classList.add(LGS_ANIMATION_RESIZING)
        }
    }

    /**
     * Handles resize events, updating element dimensions and position.
     * @param {Object} event - Resize event
     * @param {Object} refs - References object
     * @param {Function} setPosition - Function to set position
     */
    onResize = (event, refs, setPosition) => {
        this.#handleResize(event, refs.widget.current, setPosition, refs.child)
    }

    /**
     * Handles the end of a resize event.
     * @param {Object} event - Resize event
     */
    onResizeEnd = async event => {
        this.#widgetManager.isResizing = false

        event.target.classList.remove('resizing', LGS_ANIMATION_RESIZING, `direction-${this.#cardinalDirections[this.#resizeDirection]}`)
        const config = await this.#widgetManager.retrieveConfig(event.target)
        if (config?.isCropper) {
            config.element = event.target
            const left = parseInt(event.target.style.left || '0', 10)
            const top = parseInt(event.target.style.top || '0', 10)
            const width = parseInt(event.target.style.width || '0', 10) || event.target.getBoundingClientRect().width || 200
            const height = parseInt(event.target.style.height || '0', 10) || event.target.getBoundingClientRect().height || 200
            config.position = {left, top}
            config.cropDimensions = {left, top, width, height}
            this.#widgetCropper.applyCropToOverlay(config)
            this.#widgetCropper.dispatchCropUpdate(config, 'end')
        }

        if (config.persist) {
            this.#widgetManager.saveWidgetPosition(config.id, config)
        }
    }
}