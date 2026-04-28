/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetResizable.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-27
 * Last modified: 2026-01-27
 *
 *
 * Copyright © 2026 LGS1920
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
        const baseLeft = __.app.parsePx(target.style.left || '0')
        const baseTop = __.app.parsePx(target.style.top || '0')
        const currentWidth = config.isCropper ? prevCropDimensions?.width || width : __.app.parsePx(target.style.width || '0') || width
        const currentHeight = config.isCropper ? prevCropDimensions?.height || height : __.app.parsePx(target.style.height || '0') || height
        let finalLeft
        let finalTop

        // Adjust position for center-based resizing
        if (config?.resizeFromCenter) {
            finalLeft = Math.round(baseLeft + (currentWidth - width) / 2)
            finalTop = Math.round(baseTop + (currentHeight - height) / 2)
            const container = config.container.getBoundingClientRect()
            config.centerRatio = {
                x: (finalLeft - container.left + width / 2) / container.width,
                y: (finalTop - container.top + height / 2) / container.height,
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
        config.runtimeReady = true
        if (config.isCropper) {
            const after = {left: finalLeft, top: finalTop, width, height}
            config.cropDimensions = after
            if (!prevCropDimensions ||
                prevCropDimensions.left !== after.left ||
                prevCropDimensions.top !== after.top ||
                prevCropDimensions.width !== after.width ||
                prevCropDimensions.height !== after.height) {
                this.#widgetCropper.dispatchCropUpdate(config, 'resize')
            }
            this.#widgetCropper.applyCropToOverlay(config)
        }
        else {
            config.dimensions = {width, height}
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
        config.runtimeReady = true
        if (config?.isCropper) {
            config.element = event.target
            const left = __.app.parsePx(event.target.style.left || '0')
            const top = __.app.parsePx(event.target.style.top || '0')
            const width = __.app.parsePx(event.target.style.width || '0') || event.target.getBoundingClientRect().width || 200
            const height = __.app.parsePx(event.target.style.height || '0') || event.target.getBoundingClientRect().height || 200
            config.position = {left, top}
            config.cropDimensions = {left, top, width, height}
            this.#widgetCropper.applyCropToOverlay(config)
            this.#widgetCropper.dispatchCropUpdate(config, 'end')
            this.#persistWidgetsForBoard(config.id)
        }
        else {
            const width = __.app.parsePx(event.target.style.width || '0') || event.target.getBoundingClientRect().width || config.dimensions?.width || 0
            const height = __.app.parsePx(event.target.style.height || '0') || event.target.getBoundingClientRect().height || config.dimensions?.height || 0
            config.dimensions = {width, height}
        }

        if (config.persist) {
            await this.#widgetManager.saveWidgetPosition(config.id, config)
        }

        __.ui.widgetManager.setConfig(config.id, config)

    }

    #persistWidgetsForBoard = (boardId) => {
        const widgets = __.ui.widgetCache?.getAll({widgetsBoard: boardId})
        if (!widgets || widgets.size === 0) {
            return
        }
        for (const [id] of widgets) {
            if (id === boardId) {
                continue
            }
            const config = this.#widgetManager.getWidgetConfig(id)
            if (config?.persist) {
                this.#widgetManager.saveWidgetPosition(id, config)
            }
        }
    }
}
