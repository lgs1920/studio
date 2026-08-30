/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetResizable.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Singleton class that manages resizable functionality for widgets.
 */
import { LGS_ANIMATION_RESIZING } from '@Core/constants'
import { constrainWidgetDimensions } from './widgetResizeUtils'

/**
 * Resolve the maximum dimensions allowed by the active widget bounds for one
 * resize direction.
 *
 * @param {Object} options - Resize geometry options.
 * @param {Object} options.config - Widget runtime configuration.
 * @param {Array<number>} options.direction - Moveable resize direction.
 * @param {number} options.left - Current absolute left position.
 * @param {number} options.top - Current absolute top position.
 * @param {number} options.width - Current widget width.
 * @param {number} options.height - Current widget height.
 * @returns {{maxWidth?: number, maxHeight?: number}} Directional bounds.
 */
const resolveDirectionalResizeBounds = ({config, direction, left, top, width, height}) => {
    const bounds = config?.bounds
    if (!bounds) {
        return {}
    }

    const [directionX, directionY] = direction
    const margin = Math.max(0, Number(config.margin) || 0)
    const leftBound = Number(bounds.left) + margin
    const rightBound = Number(bounds.right) - margin
    const topBound = Number(bounds.top) + margin
    const bottomBound = Number(bounds.bottom) - margin
    const result = {}

    if (directionX !== 0 && Number.isFinite(leftBound) && Number.isFinite(rightBound)) {
        result.maxWidth = directionX < 0
            ? (left + width) - leftBound
            : rightBound - left
    }

    if (directionY !== 0 && Number.isFinite(topBound) && Number.isFinite(bottomBound)) {
        result.maxHeight = directionY < 0
            ? (top + height) - topBound
            : bottomBound - top
    }

    return result
}

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
    #resizeStartPosition = {left: 0, top: 0}
    #pendingCropUpdateFrame = null
    #pendingCropUpdateConfig = null
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

    #runPendingCropUpdate = () => {
        this.#pendingCropUpdateFrame = null
        const config = this.#pendingCropUpdateConfig
        this.#pendingCropUpdateConfig = null

        if (!config?.isCropper || !config.cropDimensions) {
            return
        }

        // Keep the outside overlay responsive without dispatching a crop event
        // that could feed geometry back into Moveable during the same gesture.
        this.#widgetCropper.applyCropToOverlay(config)
    }

    #schedulePendingCropUpdate = config => {
        this.#pendingCropUpdateConfig = config
        if (this.#pendingCropUpdateFrame !== null) {
            return
        }
        this.#pendingCropUpdateFrame = requestAnimationFrame(this.#runPendingCropUpdate)
    }

    #flushPendingCropUpdate = () => {
        if (!this.#pendingCropUpdateConfig) {
            return
        }
        if (this.#pendingCropUpdateFrame !== null) {
            cancelAnimationFrame(this.#pendingCropUpdateFrame)
        }
        this.#runPendingCropUpdate()
    }

    #clearPendingCropUpdate = () => {
        if (this.#pendingCropUpdateFrame !== null) {
            cancelAnimationFrame(this.#pendingCropUpdateFrame)
        }
        this.#pendingCropUpdateFrame = null
        this.#pendingCropUpdateConfig = null
    }

    /**
     * Handles resize operations and keeps the DOM in sync with Moveable.
     * @private
     * @param {Object} event - Resize event
     * @param {HTMLElement} target - Target element
     * @param {Function} setPosition - Function to set position
     * @param {Object} childRef - Child reference
     */
    #handleResize = (event, target, setPosition, childRef) => {
        if (!target || !event) {
            return
        }
        this.#widgetManager.isResizing = true
        const config = this.#widgetManager.getWidgetConfig(this.#widgetManager.retrieveElementId(target))
        if (!config) {
            this.#widgetManager.isResizing = false
            return
        }

        const direction = Array.isArray(event.direction) ? event.direction : [1, 1]
        const requestedWidth = Math.round(event.width)
        const requestedHeight = Math.round(event.height)
        const baseLeft = __.app.parsePx(target.style.left || '0')
        const baseTop = __.app.parsePx(target.style.top || '0')
        const currentWidth = config.isCropper
            ? config.cropDimensions?.width || requestedWidth
            : __.app.parsePx(target.style.width || '0') || requestedWidth
        const currentHeight = config.isCropper
            ? config.cropDimensions?.height || requestedHeight
            : __.app.parsePx(target.style.height || '0') || requestedHeight
        const directionalBounds = resolveDirectionalResizeBounds({
            config,
            direction,
            left:   baseLeft,
            top:    baseTop,
            width:  currentWidth,
            height: currentHeight,
        })
        const preferredAxis = direction[0] === 0 && direction[1] !== 0 ? 'height' : 'width'
        const constrainedDimensions = config.isCropper
            ? {width: requestedWidth, height: requestedHeight}
            : constrainWidgetDimensions({
                config,
                element: target,
                width: requestedWidth,
                height: requestedHeight,
                preferredAxis,
                maxWidth: directionalBounds.maxWidth,
                maxHeight: directionalBounds.maxHeight,
            })
        const width = Math.round(constrainedDimensions.width)
        const height = Math.round(constrainedDimensions.height)
        const prevCropDimensions = config.isCropper ? {...config.cropDimensions} : {}
        const resizeOffsetX = Number.isFinite(event?.drag?.beforeDist?.[0]) ? Math.round(event.drag.beforeDist[0]) : null
        const resizeOffsetY = Number.isFinite(event?.drag?.beforeDist?.[1]) ? Math.round(event.drag.beforeDist[1]) : null
        let finalLeft
        let finalTop

        // Adjust position for center-based resizing
        if (config?.resizeFromCenter && resizeOffsetX !== null && resizeOffsetY !== null) {
            finalLeft = this.#resizeStartPosition.left + resizeOffsetX
            finalTop = this.#resizeStartPosition.top + resizeOffsetY
            const container = config.container.getBoundingClientRect()
            config.centerRatio = {
                x: (finalLeft - container.left + width / 2) / container.width,
                y: (finalTop - container.top + height / 2) / container.height,
            }
        }
        else if (config?.resizeFromCenter) {
            finalLeft = Math.round(baseLeft + (currentWidth - width) / 2)
            finalTop = Math.round(baseTop + (currentHeight - height) / 2)
            const container = config.container.getBoundingClientRect()
            config.centerRatio = {
                x: (finalLeft - container.left + width / 2) / container.width,
                y: (finalTop - container.top + height / 2) / container.height,
            }
        }
        else {
            const [dx, dy] = direction
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
                this.#schedulePendingCropUpdate(config)
            }
        }
        else {
            config.dimensions = {width, height}
        }

        // Avoid forcing a full Widget rerender on every crop frame.
        if (!config.isCropper) {
            setPosition({left: finalLeft, top: finalTop})
        }
        if (childRef.current?.handleResize) {
            childRef.current.handleResize({left: finalLeft, top: finalTop, width, height})
        }
        this.#widgetManager.isResizing = false
    }

    /**
     * Handles the start of a resize event.
     * @param {Object} event - Resize event
     */
    onResizeStart = event => {
        this.#widgetManager.isResizing = true
        this.#clearPendingCropUpdate()
        this.#resizeDirection = event.direction
        this.#resizeStartPosition = {
            left: __.app.parsePx(event.target.style.left || '0'),
            top:  __.app.parsePx(event.target.style.top || '0'),
        }
        const config = this.#widgetManager.getWidgetConfig(this.#widgetManager.retrieveElementId(event.target))

        if (config?.resizeFromCenter) {
            event.setFixedDirection?.([0, 0])
        }

        event.target.classList.add('resizing', `direction-${this.#cardinalDirections[this.#resizeDirection]}`)

        if (config?.animationWhenResizing) {
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
        this.#resizeStartPosition = {left: 0, top: 0}
        this.#flushPendingCropUpdate()

        event.target.classList.remove('resizing', LGS_ANIMATION_RESIZING, `direction-${this.#cardinalDirections[this.#resizeDirection]}`)
        const widgetId = this.#widgetManager.retrieveElementId(event.target)
        const config = this.#widgetManager.getWidgetConfig(widgetId)
                     ?? await this.#widgetManager.retrieveConfig(event.target)
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

        const widgetList = globalThis.lgs?.stores?.ui?.widget?.list
        if (!config.isCropper && widgetList?.get && widgetList?.set) {
            const entry = widgetList.get(config.id) ?? {}
            const nextEntry = {
                ...entry,
                dimensions: config.dimensions,
                position:   config.position,
            }
            widgetList.set(config.id, nextEntry)
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
