/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCoreControls.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-28
 * Last modified: 2026-01-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_VISUAL_WIDGET } from '@Core/constants'
import { v4 as uuid }        from 'uuid'

/**
 * Handles widget layout, control box visibility, and setup routines.
 */
export class WidgetCoreControls {
    #registry

    /**
     * @param {WidgetCoreRegistry} registry - Registry helper for configs and persistence.
     */
    constructor(registry) {
        this.#registry = registry
    }

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

    #hideControlBoxWithTimer = (moveable, config, setControlBoxProps, isMouseOver) => {
        if (this.#registry.isDragging || !config.showControlBox || isMouseOver) {
            return
        }
        if (this.#registry.current !== config.id) {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            return
        }
        return setTimeout(() => {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            const elementId = this.#registry.retrieveElementId(moveable.target)
            this.#registry.controlBoxTimers.delete(elementId)
        }, this.#registry.hideDelay)
    }

    #createInnerOverlay = element => {
        if (!element.querySelector('.lgs-widget-inner-overlay')) {
            const overlay = document.createElement('div')
            const elementId = this.#registry.retrieveElementId(element)
            const config = this.#registry.getWidgetConfig(elementId)
            config.overlay = overlay
            Object.assign(overlay.style, {display: 'block'})
            overlay.classList.add('lgs-widget-inner-overlay', config.type)
            if (config.stopPropagation) {
                overlay.classList.add('no-propagation', config.type)
            }
            element.appendChild(overlay)
        }
    }

    #computeRenderDirections = (rect) => {
        const widthOk = rect.width > this.#registry.minDimensionThreshold
        const heightOk = rect.height > this.#registry.minDimensionThreshold
        const directions = []

        if (widthOk) {
            directions.push('n', 's')
        }
        if (heightOk) {
            directions.push('e', 'w')
        }
        directions.push('ne', 'nw', 'se', 'sw')

        return directions
    }

    /**
     * Applies position to an element, updating its style and configuration.
     * @param {HTMLElement} element - The DOM element
     * @param {Object|string} position - Position object or transform string
     * @param {Object} moveable - Moveable instance reference
     * @param {boolean} isDragging - Whether element is being dragged
     * @param {Function} setControlBoxProps - Function to set control box properties
     */
    applyPosition = (element, position, moveable, isDragging, setControlBoxProps) => {
        const elementId = this.#registry.retrieveElementId(element)
        const config = this.#registry.getWidgetConfig(elementId)
        const mv = this.#registry.getMoveable(elementId)
        if (!config) {
            return
        }
        if (typeof position === 'string') {
            element.style.transform = position
            config.transform = position
        }
        else if (typeof position === 'object') {
            element.style.left = `${position.left}px`
            element.style.top = `${position.top}px`
            config.position = position
        }

        if (mv?.current) {
            mv.current.updateRect()
        }
        if (config.showControlBox && isDragging) {
            setControlBoxProps({
                                   renderDirections: this.#computeRenderDirections(element.getBoundingClientRect()),
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
    }

    /**
     * Manages the visibility of the control box.
     * @param {Object} moveable - Moveable instance reference
     * @param {Function} setControlBoxProps - Function to set control box properties
     * @param {Object} _controlBoxTimer - Timer reference
     * @param {boolean} show - Whether to show the control box
     * @param {boolean} isMouseOver - Whether mouse is over the element
     */
    manageControlBox = (moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver) => {
        if (!moveable?.current?.target) {
            return
        }
        const elementId = this.#registry.retrieveElementId(moveable.current.target)
        const config = this.#registry.getWidgetConfig(elementId)
        const mv = this.#registry.getMoveable(elementId)
        if (!config || !config.showControlBox) {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            clearTimeout(_controlBoxTimer.current)
            this.#registry.controlBoxTimers.delete(elementId)
            return
        }
        clearTimeout(_controlBoxTimer.current)
        this.#registry.controlBoxTimers.delete(elementId)
        if (show) {
            this.#registry.current = elementId
            setControlBoxProps({
                                   renderDirections: this.#computeRenderDirections(moveable.current.target.getBoundingClientRect()),
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
        else {
            _controlBoxTimer.current = this.#hideControlBoxWithTimer(mv.current, config, setControlBoxProps, isMouseOver)
            if (_controlBoxTimer.current) {
                this.#registry.controlBoxTimers.set(elementId, _controlBoxTimer.current)
            }
        }
    }

    /**
     * Computes initial position for a widget based on configuration, respecting container margins
     * @param {Object} config - Widget configuration
     * @param {HTMLElement} element - The DOM element
     * @param {boolean} isResize - Whether this is a resize operation
     * @returns {Object} Position object with left and top coordinates
     */
    computeInitialPosition = (config, element, isResize = false) => {
        if (!config.container || !element) {
            return {left: 0, top: 0}
        }
        const container = config.container.getBoundingClientRect()
        const widget = element.getBoundingClientRect()
        const margin = Number.isFinite(config.margin) ? config.margin : 0

        let defaultWidth = widget.width || 200
        let defaultHeight = widget.height || 200

        if (config.fromDB && config.dimensions?.width && config.dimensions?.height) {
            defaultWidth = config.dimensions.width
            defaultHeight = config.dimensions.height
        }
        else if (config.isCropper) {
            defaultWidth = Number.isFinite(config.cropDimensions?.width) ? config.cropDimensions.width : (widget.width || 200)
            defaultHeight = Number.isFinite(config.cropDimensions?.height) ? config.cropDimensions.height : (widget.height || 200)
        }

        config.dimensions = {width: defaultWidth, height: defaultHeight}

        const attachTo = config.attachTo || (config.isCropper ? 'center' : 'top-left')

        let left
        let top
        if (config.fromDB && Number.isFinite(config.position.left) && Number.isFinite(config.position.top)) {
            left = config.position.left
            top = config.position.top
        }
        else {
            left = config.isCropper ? (container.width - defaultWidth) / 2 : container.left + __.ui.widgetManager.transform.parsePosition(config.left ?? '50%', container.width)
            top = config.isCropper ? (container.height - defaultHeight) / 2 : container.top + __.ui.widgetManager.transform.parsePosition(config.top ?? '50%', container.height)
            const adjustments = {
                center:         () => config.isCropper ? ({left, top}) : ({
                    left: left - defaultWidth / 2,
                    top:  top - defaultHeight / 2,
                }),
                top:            () => ({left: left - defaultWidth / 2, top: top + margin}),
                left:           () => ({left: left + margin, top: top - defaultHeight / 2}),
                right:          () => ({left: left - defaultWidth - margin, top: top - defaultHeight / 2}),
                bottom:         () => ({left: left - defaultWidth / 2, top: top - defaultHeight - margin}),
                'top-left':     () => ({left: left + margin, top: top + margin}),
                'top-right':    () => ({left: left - defaultWidth - margin, top: top + margin}),
                'bottom-left':  () => ({left: left + margin, top: top - defaultHeight - margin}),
                'bottom-right': () => ({left: left - defaultWidth - margin, top: top - defaultHeight - margin}),
            }

            if (adjustments[attachTo]) {
                ({left, top} = adjustments[attachTo]())
            }
        }

        config.position = {left, top}

        const scaleX = config.scale?.x || 1
        const scaleY = config.scale?.y || 1
        const scaledWidth = defaultWidth * scaleX
        const scaledHeight = defaultHeight * scaleY

        if (!config.fromDB) {
            config.position = {
                left: Math.max(
                    container.left,
                    Math.min(left, container.right - scaledWidth),
                ),
                top:  Math.max(
                    container.top,
                    Math.min(top, container.bottom - scaledHeight),
                ),
            }
        }

        return config.position
    }

    /**
     * Refreshes container bounds based on current container size.
     * @param {Object} config - Widget configuration
     * @param {Object} moveableInstance - Moveable instance
     * @returns {Object} Updated bounds object
     */
    refreshBounds = (config, moveableInstance) => {
        const container = config.container.getBoundingClientRect()
        config.bounds = {
            left:   container.left,
            top:    container.top,
            bottom: container.bottom,
            right:  container.right,
        }
        return config.bounds
    }

    /**
     * Sets boundary status indicating if widget touches container edges.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} config - Widget configuration
     * @returns {Object} Boundary status object
     */
    setBoundStatus = (element, config = this.#registry.getWidgetConfig(this.#registry.current)) => {
        const container = config.container.getBoundingClientRect()
        const target = element.getBoundingClientRect()
        const margin = Number.isFinite(config.margin) ? config.margin : 0
        config.boundStatus = {
            top:    target.top <= container.top + margin,
            bottom: target.bottom >= container.bottom - margin,
            left:   target.left <= container.left + margin,
            right:  target.right >= container.right - margin,
        }
        return config.boundStatus
    }

    /**
     * Monitors container resize events and updates widget bounds and position.
     * @param {Object} config - Widget configuration
     * @param {Function} setBounds - Function to update bounds
     * @param {Object} moveable - Moveable instance reference
     * @param {HTMLElement} element - The DOM element
     * @param {Function} setPosition - Function to set position
     */
    monitorContainerResize = (config, setBounds, moveable, element, setPosition) => {
        const target = config.isCropper ? element : config.container
        if (!target) {
            return
        }
        if (config.observer && config.observedTarget === target) {
            return
        }
        if (config.observer && config.observedTarget !== target) {
            try {
                config.observer.unobserve(config.observedTarget)
            }
            catch (_) {
            }
            config.observer.disconnect()
            config.observer = null
        }
        const elementId = config.id

        const handleResize = (first = false) => {
            if (this.#registry.isResizing) {
                return
            }
            const oldBounds = {...config.bounds}
            const mv = this.#registry.getMoveable(elementId)
            const newBounds = this.refreshBounds(config, mv?.current)
            if (!first && newBounds.left === oldBounds.left && newBounds.top === oldBounds.top &&
                newBounds.right === oldBounds.right && newBounds.bottom === oldBounds.bottom) {
                return
            }
            setBounds(newBounds)
            this.setBoundStatus(element, config)

            const containerRect = config.container.getBoundingClientRect()
            const margin = Number.isFinite(config.margin) ? config.margin : 0
            let isOutOfBounds = false
            const outOfBoundsDetails = {top: false, bottom: false, left: false, right: false}

            if (!first && config.savedRatios) {
                const leftRatio = config.savedRatios.leftRatio
                const topRatio = config.savedRatios.topRatio
                const relativeLeft = (leftRatio / 100) * containerRect.width
                const relativeTop = (topRatio / 100) * containerRect.height

                config.position = {
                    left: containerRect.left + relativeLeft,
                    top:  containerRect.top + relativeTop,
                }
            }

            let scaleWasAdapted = false
            if (config.type === LGS_VISUAL_WIDGET) {
                const oldScale = {...config.scale}
                config.scale = this.adaptScaleToContainer(config, containerRect)

                if (oldScale.x !== config.scale.x || oldScale.y !== config.scale.y) {
                    __.ui.widgetManager.transform.setScale(element, config.scale.x, config.scale.y)
                    scaleWasAdapted = true
                }
            }

            const adaptedPosition = this.adaptPositionToContainer(config, containerRect)
            let positionWasAdapted = false
            if (adaptedPosition.left !== config.position.left || adaptedPosition.top !== config.position.top) {
                config.position = adaptedPosition
                positionWasAdapted = true
            }

            if ((!first && config.savedRatios) || scaleWasAdapted || positionWasAdapted) {
                element.style.left = `${config.position.left}px`
                element.style.top = `${config.position.top}px`
                setPosition(config.position)
            }

            if ((scaleWasAdapted || positionWasAdapted) && config.persist) {
                __.ui.widgetManager.saveWidgetPosition(config.id, config)
            }

            if (first && config.fromDB) {
                config.fromDB = false
            }

            if (config.transform) {
                const transforms = __.ui.widgetManager.transform.parseTransform(config.transform)
                if (transforms.translate.x !== 0 || transforms.translate.y !== 0) {
                    let newTranslateX = transforms.translate.x
                    let newTranslateY = transforms.translate.y
                    const deltaRight = newBounds.right - oldBounds.right
                    const deltaBottom = newBounds.bottom - oldBounds.bottom
                    const isShrinking = deltaRight < 0 || deltaBottom < 0
                    if (isShrinking) {
                        if (config.boundStatus.right) {
                            newTranslateX = transforms.translate.x + deltaRight
                        }
                        if (config.boundStatus.bottom) {
                            newTranslateY = transforms.translate.y + deltaBottom
                        }
                    }
                    else {
                        if (deltaRight > 0) {
                            config.boundStatus.right = false
                        }
                        if (deltaBottom > 0) {
                            config.boundStatus.bottom = false
                        }
                    }
                    if (newTranslateX !== transforms.translate.x || newTranslateY !== transforms.translate.y) {
                        __.ui.widgetManager.transform.setTranslate(element, newTranslateX, newTranslateY)
                    }
                }
            }

            if (config.isCropper && this.#registry.windowResizing && !config.persist) {
                const containerRect = config.container.getBoundingClientRect()
                const currentWidth = config.cropDimensions?.width || 200
                const currentHeight = config.cropDimensions?.height || 200
                const maxWidth = containerRect.width - 2 * margin
                const maxHeight = containerRect.height - 2 * margin
                let newWidth = currentWidth
                let newHeight = currentHeight
                if (config.ratio?.locked) {
                    const aspectRatio = config.ratio.aspectRatio
                    newWidth = Math.min(currentWidth, maxWidth)
                    newHeight = newWidth / aspectRatio
                    if (newHeight > maxHeight) {
                        newHeight = maxHeight
                        newWidth = newHeight * aspectRatio
                    }
                }
                else {
                    newWidth = Math.min(currentWidth, maxWidth)
                    newHeight = Math.min(currentHeight, maxHeight)
                }
                let newLeft = config.position.left
                let newTop = config.position.top
                const centerRatio = config.centerRatio || {
                    x: (config.position.left + currentWidth / 2) / containerRect.width,
                    y: (config.position.top + currentHeight / 2) / containerRect.height,
                }
                newLeft = centerRatio.x * containerRect.width - newWidth / 2
                newTop = centerRatio.y * containerRect.height - newHeight / 2
                if (newLeft < newBounds.left + margin) {
                    newLeft = newBounds.left + margin
                    outOfBoundsDetails.left = true
                    isOutOfBounds = true
                }
                else if (newLeft + newWidth > newBounds.right - margin) {
                    newLeft = newBounds.right - newWidth - margin
                    outOfBoundsDetails.right = true
                    isOutOfBounds = true
                }
                if (newTop < newBounds.top + margin) {
                    newTop = newBounds.top + margin
                    outOfBoundsDetails.top = true
                    isOutOfBounds = true
                }
                else if (newTop + newHeight > newBounds.bottom - margin) {
                    newTop = newBounds.bottom - newHeight - margin
                    outOfBoundsDetails.bottom = true
                    isOutOfBounds = true
                }
                config.centerRatio = {
                    x: (newLeft + newWidth / 2) / containerRect.width,
                    y: (newTop + newHeight / 2) / containerRect.height,
                }
                config.cropDimensions = {
                    left:   newLeft,
                    top:    newTop,
                    width:  newWidth,
                    height: newHeight,
                }
                config.position = {
                    left: newLeft,
                    top:  newTop,
                }
                element.style.width = `${newWidth}px`
                element.style.height = `${newHeight}px`
                element.style.left = `${newLeft}px`
                element.style.top = `${newTop}px`
                __.ui.widgetManager.applyCropToOverlay(config)
                if (mv && mv.current && (config.transform || config.isCropper)) {
                    mv.current.updateRect()
                }
                __.ui.widgetManager.cropDimensions(config, false)
                setPosition(config.position)
                if (isOutOfBounds) {
                    outOfBoundsDetails.newPosition = {left: newLeft, top: newTop}
                    const outOfBoundsEvent = new CustomEvent('widgetOutOfBounds', {
                        detail:     outOfBoundsDetails,
                        bubbles:    true,
                        cancelable: true,
                    })
                    element.dispatchEvent(outOfBoundsEvent)
                }
            }
        }
        if (target) {
            handleResize(true)
            config.observer = new ResizeObserver(this.#throttle(handleResize, 100))
            config.observer.observe(target)
            config.observedTarget = target
        }
    }

    /**
     * Constrains position within container bounds
     *
     * @param container{width,height} - Container dimensions (getBoundingClientRect)
     * @param config - Widget configuration
     * @return {{left: number, top: number}} - new position
     */
    adaptPositionToContainer = (config, container) => {
        if (config.type === LGS_VISUAL_WIDGET) {
            const scaleX = config.scale?.x ?? 1
            const scaleY = config.scale?.y ?? 1
            const width = config.dimensions?.width ?? 0
            const height = config.dimensions?.height ?? 0
            const offsetX = (width * (1 - scaleX)) / 2
            const offsetY = (height * (1 - scaleY)) / 2

            const boundingLeft = config.position.left + offsetX
            const boundingTop = config.position.top + offsetY

            const clampedBoundingLeft = Math.max(
                container.left,
                Math.min(boundingLeft, container.right - width * scaleX),
            )
            const clampedBoundingTop = Math.max(
                container.top,
                Math.min(boundingTop, container.bottom - height * scaleY),
            )

            return {
                left: clampedBoundingLeft - offsetX,
                top:  clampedBoundingTop - offsetY,
            }
        }

        return {
            left: Math.max(
                container.left,
                Math.min(config.position.left, container.right - config.dimensions.width * config.scale.x),
            ),
            top:  Math.max(
                container.top,
                Math.min(config.position.top, container.bottom - config.dimensions.height * config.scale.y),
            ),
        }
    }

    /**
     * Adapts widget size to container size.
     * strictly caps the current scale to the container limits.
     *
     * @param config - Widget configuration (contains dimensions and current scale)
     * @param container - Container dimensions
     * @return {{x: number, y: number}} - Scale (clamped to fit container)
     */
    adaptScaleToContainer = (config, container) => {
        if (config.type !== LGS_VISUAL_WIDGET) {
            return config.scale || {x: 1, y: 1}
        }
        const MIN_SCALE = 0.1
        const width = config.dimensions?.width ?? 0
        const height = config.dimensions?.height ?? 0
        const scaleX = config.scale?.x ?? 1
        const scaleY = config.scale?.y ?? 1
        const angle = (config.rotate ?? 0) * (Math.PI / 180)
        const absCos = Math.abs(Math.cos(angle))
        const absSin = Math.abs(Math.sin(angle))
        const scaledWidth = width * scaleX
        const scaledHeight = height * scaleY
        const rotatedWidth = (scaledWidth * absCos) + (scaledHeight * absSin)
        const rotatedHeight = (scaledWidth * absSin) + (scaledHeight * absCos)

        const limitX = rotatedWidth > 0 ? container.width / rotatedWidth : 1
        const limitY = rotatedHeight > 0 ? container.height / rotatedHeight : 1
        const maxAllowedScale = Math.min(limitX, limitY)
        let finalScale = Math.min(config.scale.x, maxAllowedScale)

        if (finalScale < MIN_SCALE) {
            finalScale = MIN_SCALE
        }

        return {x: finalScale, y: finalScale}
    }

    /**
     * Sets up a DOM element as a widget with moveable functionality.
     * @param {HTMLElement} element - The DOM element to set up
     * @param {Object} initialConfig - Initial widget configuration
     * @param {Function} setBounds - Function to update bounds
     * @param {Function} setPosition - Function to update position
     * @param {Object} moveable - Moveable instance reference
     * @returns {Promise<boolean>} True if setup is successful, false otherwise
     */
    setupElement = async (element, initialConfig, setBounds, setPosition, moveable) => {
        if (!element || !initialConfig?.container || !moveable.current) {
            return false
        }

        initialConfig.element = element
        initialConfig.setPosition = setPosition
        let elementId = initialConfig.id && typeof initialConfig.id === 'string' && initialConfig.id.trim()
                        ? initialConfig.id
                        : this.#registry.retrieveElementId(element) || uuid()
        element.setAttribute(this.#registry.idKey, elementId)
        moveable.current.target = element
        moveable.current.onRender = e => {
            e.target.style.opacity = initialConfig.opacity
        }
        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        const config = await this.#registry.retrieveConfig(element, initialConfig)
        elementId = config.id

        if (!config?.ratio) {
            const fallback = __.device.isPortrait ? '9x16' : '16x9'
            config.ratio = this.#registry.getRatio(initialConfig.ratio ?? fallback)
        }

        if (config.isCropper) {
            __.ui.widgetManager.cropDimensions(config, false)
        }

        const newBounds = this.refreshBounds(config, moveable.current)
        setBounds(newBounds)
        const newPosition = this.computeInitialPosition(config, element, false)
        this.applyPosition(element, newPosition, moveable, false, setPosition)

        if (config.isCropper) {
            const rect = element.getBoundingClientRect()
            const width = Number.isFinite(config.cropDimensions?.width) ? config.cropDimensions.width : (rect.width || 200)
            const height = Number.isFinite(config.cropDimensions?.height) ? config.cropDimensions.height : (rect.height || 200)
            config.cropDimensions = {
                left: newPosition.left,
                top:  newPosition.top,
                width,
                height,
            }
            element.style.width = `${width}px`
            element.style.height = `${height}px`
            __.ui.widgetManager.applyCropToOverlay(config)

            moveable.current.request('resizable', {
                keepRatio:   !!config.ratio?.locked || false,
                deltaWidth:  0,
                deltaHeight: 0,
            }, true)
        }

        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '50% 50%'

        if (config.scale && (config.scale.x !== 1 || config.scale.y !== 1)) {
            __.ui.widgetManager.transform.setScale(element, config.scale.x, config.scale.y)
        }

        if (config.rotate && config.rotate !== 0) {
            __.ui.widgetManager.transform.setRotate(element, config.rotate)
        }

        this.monitorContainerResize(config, setBounds, moveable, element, setPosition)
        this.#createInnerOverlay(element)

        if (config.isCropper && config.cropDimensions) {
            __.ui.widgetManager.cropDimensions(config, false)
        }
        this.#registry.setConfig(elementId, config)
        this.#registry.setMoveable(elementId, moveable)

        if (config.persist && !config.fromDB) {
            await __.ui.widgetManager.saveWidgetPosition(elementId, config)
        }
        return true
    }

    /**
     * Creates a fully independent clone of a DOM element.
     *
     * @param {Element} element - The original DOM element to clone
     * @returns {Element} A brand new element, 100% independent and correctly sized
     */
    clone = (element) => {
        const template = document.createElement('template')
        template.innerHTML = element.outerHTML.trim()
        const clone = template.content.firstElementChild

        if (!clone) {
            return null
        }

        function getAccumulatedTransform(el) {
            let current = el
            let matrix = new DOMMatrix()

            while (current && current !== document.documentElement) {
                const style = getComputedStyle(current)
                const transform = style.transform && style.transform !== 'none'
                                  ? new DOMMatrix(style.transform)
                                  : new DOMMatrix()

                matrix = transform.multiply(matrix)

                current = current.parentElement
            }
            return matrix
        }

        const fullMatrix = getAccumulatedTransform(element)

        if (!fullMatrix.isIdentity) {
            clone.style.transform = `matrix(${fullMatrix.a}, ${fullMatrix.b}, ${fullMatrix.c}, ${fullMatrix.d}, ${fullMatrix.e}, ${fullMatrix.f})`
        }

        clone.classList.add('lgs-widget-clone')
        return clone
    }

    /**
     * Calculates logical shadow margins for the composer.
     * @param {number} x - Offset X (e.g., 0)
     * @param {number} y - Offset Y (e.g., 1)
     * @param {number} blur - Blur radius (e.g., 2)
     * @param {number} [spread=0] - Spread radius
     * @returns {Object} { top, right, bottom, left }
     */
    getShadowMargins = (x, y, blur, spread = 0) => {
        return {
            top:    Math.max(0, blur + spread - y),
            bottom: Math.max(0, blur + spread + y),
            left:   Math.max(0, blur + spread - x),
            right:  Math.max(0, blur + spread + x),
        }
    }
}
