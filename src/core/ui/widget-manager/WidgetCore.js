/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCore.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-20
 * Last modified: 2025-11-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Core class for managing widget configurations, bounds, and control box functionality.
 * Handles setup, positioning, and cleanup of widget elements.
 */
import { LGS_VISUAL_WIDGET, LGS_WIDGET, SECOND, WIDGETS_CAPABILITIES } from '@Core/constants'
import { v4 as uuid }                                                  from 'uuid'

export class WidgetCore {
    /** @type {WidgetManager} Reference to the WidgetManager instance */
    #widgetManager

    /** @type {WidgetTransform} Reference to the WidgetTransform instance */
    #widgetTransform

    /** @type {WidgetDBManager} Reference to the WidgetDBManager instance */
    #widgetDB

    /** @type {number} Delay in milliseconds before hiding control box */
    HIDE_DELAY = 2 * SECOND

    /** @type {number} Minimum dimension threshold for displaying cardinal handles */
    MIN_DIMENSION_THRESHOLD = 50

    /** @type {string} Data attribute key for widget specific IDs */
    #ID_KEY = 'data-widget-id'

    /** @type {Map<string, Object>} Map of widget configurations */
    #widgets = new Map()

    /** @type {Map<string, Object>} Map of moveable instances by element ID */
    #moveables = new Map()

    /** @type {string[]} Valid position anchors for widgets */
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    /** @type {boolean} Indicates if a widget is being dragged */
    #isDragging = false

    /** @type {boolean} Indicates if a widget is being resized */
    #isResizing = false

    /** @type {boolean} Indicates if a widget is being scaled */
    #isScaling = false

    /** @type {boolean} Indicates if window resizing has an impact */
    #windowResizing = true

    /** @type {Map<string, number>} Timers for hiding control boxes */
    #controlBoxTimers = new Map()

    /** @type {string|null} ID of the currently active widget */
    #current = null


    /**
     * Constructor for WidgetCore.
     * @param {WidgetManager} widgetManager - The WidgetManager instance
     * @param {WidgetTransform} widgetTransform - The WidgetTransform instance
     * @param {WidgetDBManager} widgetDB - The widgetDBManager instance
     */
    constructor(widgetManager, widgetTransform, widgetDB) {
        this.#widgetManager = widgetManager
        this.#widgetTransform = widgetTransform
        this.#widgetDB = widgetDB
    }

    /**
     * Getter for isResizing property
     * @returns {boolean} Whether a widget is being resized
     */
    get isResizing() {
        return this.#isResizing
    }

    /**
     * Setter for isResizing property
     * @param {boolean} value - New value for isResizing
     */
    set isResizing(value) {
        this.#isResizing = value
    }

    /**
     * Getter for isDragging property
     * @returns {boolean} Whether a widget is being dragged
     */
    get isDragging() {
        return this.#isDragging
    }

    /**
     * Setter for isDragging property
     * @param {boolean} value - New value for isDragging
     */
    set isDragging(value) {
        this.#isDragging = value
    }

    /**
     * Getter for isScaling property
     * @returns {boolean} Whether a widget is being scaled
     */
    get isScaling() {
        return this.#isScaling
    }

    /**
     * Setter for isScaling property
     * @param {boolean} value - New value for isScaling
     */
    set isScaling(value) {
        this.#isScaling = value
    }

    /**
     * Getter for windowResizing property
     * @returns {boolean} Whether window resizing has an impact
     */
    get windowResizing() {
        return this.#windowResizing
    }

    /**
     * Setter for windowResizing property
     * @param {boolean} value - New value for windowResizing
     */
    set windowResizing(value) {
        this.#windowResizing = value
    }

    /**
     * Retrieves the element ID from its data attribute.
     * @param {HTMLElement} element - The DOM element
     * @returns {string|null} The element's ID or null if not found
     */
    retrieveElementId = element => element.getAttribute(this.#ID_KEY)

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
     * Hides the control box with a delay unless dragging or mouse is over.
     * @private
     * @param {Object} moveable - Moveable instance
     * @param {Object} config - Widget configuration
     * @param {Function} setControlBoxProps - Function to set control box properties
     * @param {boolean} isMouseOver - Whether mouse is over the element
     * @returns {number|undefined} Timeout ID or undefined
     */
    #hideControlBoxWithTimer = (moveable, config, setControlBoxProps, isMouseOver) => {
        if (this.#isDragging || !config.showControlBox || isMouseOver) {
            return
        }
        if (this.#current !== config.id) {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            return
        }
        return setTimeout(() => {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            const elementId = this.retrieveElementId(moveable.target)
            this.#controlBoxTimers.delete(elementId)
        }, this.HIDE_DELAY)
    }

    /**
     * Creates an inner overlay element for the widget.
     * @private
     * @param {HTMLElement} element - The DOM element
     */
    #createInnerOverlay = element => {
        const overlay = document.createElement('div')
        const elementId = this.retrieveElementId(element)
        const config = this.getWidgetConfig(elementId)
        config.overlay = overlay
        Object.assign(overlay.style, {
            display: 'block',
        })
        overlay.classList.add('lgs-widget-inner-overlay', config.type)
        if (config.stopPropagation) {
            overlay.classList.add('no-propagation', config.type)
        }
        element.appendChild(overlay)
    }

    /**
     * Computes the render directions for control box handles based on effective dimensions.
     * @private
     * @param {DOMRect} rect - The element's bounding rectangle
     * @returns {string[]} Array of render directions
     */
    #computeRenderDirections = (rect) => {
        const widthOk = rect.width > this.MIN_DIMENSION_THRESHOLD
        const heightOk = rect.height > this.MIN_DIMENSION_THRESHOLD
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
     * Getter for widgets list property
     * @returns {[]} List of widget elements
     */
    get widgets() {
        return this.#widgets
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
        const elementId = this.retrieveElementId(element)
        const config = this.getWidgetConfig(elementId)
        const mv = this.getMoveable(elementId)
        if (!config) {
            return
        }
        // If position is a string, it is something like transform: translate(100px, 100px)
        if (typeof position === 'string') {
            element.style.transform = position
            config.transform = position
        }
        // Then if it is an object, it's coordinates
        else if (typeof position === 'object') {
            element.style.left = `${position.left}px`
            element.style.top = `${position.top}px`
            config.position = position
        }

        // Update widget and control box position
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
        const elementId = this.retrieveElementId(moveable.current.target)
        const config = this.getWidgetConfig(elementId)
        const mv = this.getMoveable(elementId)
        if (!config || !config.showControlBox) {
            setControlBoxProps({renderDirections: [], zoom: 0, opacity: 0})
            clearTimeout(_controlBoxTimer.current)
            this.#controlBoxTimers.delete(elementId)
            return
        }
        clearTimeout(_controlBoxTimer.current)
        this.#controlBoxTimers.delete(elementId)
        if (show) {
            this.#current = elementId
            setControlBoxProps({
                                   renderDirections: this.#computeRenderDirections(moveable.current.target.getBoundingClientRect()),
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
        else {
            _controlBoxTimer.current = this.#hideControlBoxWithTimer(mv.current, config, setControlBoxProps, isMouseOver)
            if (_controlBoxTimer.current) {
                this.#controlBoxTimers.set(elementId, _controlBoxTimer.current)
            }
        }
    }

    /**
     * Retrieves video format ratio configuration.
     * @param {string} ratio - Ratio identifier (e.g., '16x9')
     * @returns {Object} Ratio configuration object
     */
    getRatio = ratio => lgs.configuration.videoFormats.find(p => p.value === ratio)

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
        if (config.isCropper) {
            defaultWidth = Number.isFinite(config.cropDimensions?.width) ? config.cropDimensions.width : (widget.width || 200)
            defaultHeight = Number.isFinite(config.cropDimensions?.height) ? config.cropDimensions.height : (widget.height || 200)
        }

        // Set config.dimensions
        config.dimensions = {width: defaultWidth, height: defaultHeight}

        // Compute left/top
        const attachTo = config.attachTo || (config.isCropper ? 'center' : 'top-left')

        let left, top
        if (config.fromDB) {
            // Use saved position from DB, relative to the container
            left = config.position?.left ?? 0
            top = config.position?.top ?? 0
        }
        else {
            // Use provided left/top or center for croppers, relative to the container
            left = config.isCropper ? (container.width - defaultWidth) / 2 : container.left + this.#widgetTransform.parsePosition(config.left ?? '50%', container.width)
            top = config.isCropper ? (container.height - defaultHeight) / 2 : container.top + this.#widgetTransform.parsePosition(config.top ?? '50%', container.height)
            // Adjust position based on anchor point, skip center adjustment for croppers
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

        // Set config.position
        config.position = {left, top}

        // Ensure widget stays within container bounds

        // Update config.position but  force the widget to remain in the container
        config.position = {
            left: Math.max(
                container.left,
                Math.min(left, container.right - defaultWidth),
            ),
            top:  Math.max(
                container.top,
                Math.min(top, container.bottom - defaultHeight),
            ),
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
    setBoundStatus = (element, config = this.getWidgetConfig(this.#current)) => {
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
     * Computes bounds for an element or window.
     * @private
     * @param {HTMLElement|Window} element - The DOM element or window
     * @returns {Object} Bounds object with top, left, width, and height
     */
    #computeElementBounds = element => {
        if (element === window) {
            return {top: 0, left: 0, width: window.innerWidth, height: window.innerHeight}
        }
        const rect = element.getBoundingClientRect()
        return {top: rect.top, left: rect.left, width: rect.width, height: rect.height}
    }

    /**
     * Disposes a single widget element, cleaning up resources.
     * @param {HTMLElement} element - The DOM element
     */
    disposeElement = async element => {
        const elementId = this.retrieveElementId(element)
        const config = this.getWidgetConfig(elementId)
        if (!config) {
            return
        }
        if (config.observer) {
            try {
                config.observer.unobserve(config.container)
            }
            catch (_) {
            }
            config.observer.disconnect()
            config.observer = null
        }
        this.#widgets.delete(elementId)
        this.#moveables.delete(elementId)
        const timer = this.#controlBoxTimers.get(elementId)
        if (timer) {
            clearTimeout(timer)
            this.#controlBoxTimers.delete(elementId)
        }

        if (config.persist) {
            await this.#widgetDB.deleteWidgetPosition(elementId)
        }
    }

    /**
     * Retrieves widget configurations by group ID.
     * @param {string} groupId - The group identifier
     * @returns {Object[]} Array of widget configurations
     */
    getWidgetConfigByGroup = groupId => {
        const configs = []
        for (const config of this.#widgets.values()) {
            if (config.group === groupId) {
                configs.push(config)
            }
        }
        return configs
    }

    /**
     * Disposes all widgets in a group, respecting persist flag.
     * @param {string} groupId - The group identifier
     * @param {boolean} usePersist - Whether to respect persist flag
     */
    disposeByGroup = (groupId, usePersist = false) => {
        const elementsToDispose = []
        for (const [elementId, config] of this.#widgets) {
            if (config.group === groupId && (!usePersist || !config.persist)) {
                elementsToDispose.push(elementId)
            }
        }
        for (const elementId of elementsToDispose) {
            const config = this.getWidgetConfig(elementId)
            if (config?.element) {
                this.disposeElement(config.element)
            }
            else {
                this.#widgets.delete(elementId)
                this.#moveables.delete(elementId)
                const timer = this.#controlBoxTimers.get(elementId)
                if (timer) {
                    clearTimeout(timer)
                    this.#controlBoxTimers.delete(elementId)
                }
            }
        }
    }

    /**
     * Retrieves widget configuration by element ID.
     * @param {string} elementId - The element ID
     * @returns {Object|undefined} Widget configuration or undefined if not found
     */
    getWidgetConfig = elementId => this.#widgets.get(elementId)

    /**
     * Retrieves the widget element by ID.
     * @param {string} id - The widget ID
     * @returns {HTMLElement|null} The DOM element or null if not found
     */
    getElementById = id => document.querySelector(`[${this.#ID_KEY}="${id}"]`)

    /**
     * Retrieves the widget ID from an element.
     * @param {HTMLElement} element - The DOM element
     * @returns {string|null} The widget ID or null if not found
     */
    getIdFromElement = element => element.getAttribute(this.#ID_KEY)

    /**
     * Retrieves the inner overlay element for a widget.
     * @param {HTMLElement} element - The DOM element
     * @returns {HTMLElement|undefined} Overlay element or undefined
     */
    getInnerOverlay = element => {
        const elementId = this.retrieveElementId(element)
        const config = this.getWidgetConfig(elementId)
        return config.overlay
    }

    /**
     * Retrieves the widget ID key.
     * @returns {string} The widget ID key
     */
    getWidgetIDKey = () => this.#ID_KEY

    /**
     * Sets widget configuration for an element ID.
     * @param {string} elementId - The element ID
     * @param {Object} config - Widget configuration
     */
    setConfig = (elementId, config) => {
        this.#widgets.set(elementId, config)
    }

    /**
     * Retrieves the moveable reference for an element ID.
     * @param {string} elementId - The element ID
     * @returns {Object|undefined} Moveable reference or undefined if not found
     */
    getMoveable = elementId => this.#moveables.get(elementId)

    /**
     * Sets the moveable reference for an element ID.
     * @param {string} elementId - The element ID
     * @param {Object} moveable - Moveable instance reference
     */
    setMoveable = (elementId, moveable) => {
        this.#moveables.set(elementId, moveable)
    }

    /**
     * Removes the moveable instance for an element ID from the moveables Map.
     * @param {string} elementId - The element ID
     */
    removeMoveable = elementId => {
        this.#moveables.delete(elementId)
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
        if (config.observer) {
            return
        }
        const elementId = config.id

        const handleResize = (first = false) => {
            // Skip if resizing to avoid interference
            if (this.#isResizing) {
                return
            }
            const oldBounds = {...config.bounds}
            const mv = this.getMoveable(elementId)
            const newBounds = this.refreshBounds(config, mv?.current)
            if (!first && newBounds.left === oldBounds.left && newBounds.top === oldBounds.top &&
                newBounds.right === oldBounds.right && newBounds.bottom === oldBounds.bottom) {
                return
            }
            setBounds(newBounds)
            this.setBoundStatus(element, config)

            // Check if widget is out of bounds and reposition if necessary
            const containerRect = config.container.getBoundingClientRect()
            const widgetRect = element.getBoundingClientRect()
            const margin = Number.isFinite(config.margin) ? config.margin : 5
            let newLeft = config.position.left
            let newTop = config.position.top
            let isOutOfBounds = false
            const outOfBoundsDetails = {
                widgetId:         config.id,
                top:              false,
                bottom:           false,
                left:             false,
                right:            false,
                margin:           margin,
                originalPosition: {...config.position},
                newPosition:      null,
            }

            // Detect out-of-bounds conditions and apply margin only to colliding sides
            if (widgetRect.left < containerRect.left + margin) {
                newLeft = containerRect.left + margin
                outOfBoundsDetails.left = true
                isOutOfBounds = true
            }
            else if (widgetRect.right > containerRect.right - margin) {
                newLeft = containerRect.right - widgetRect.width - margin
                outOfBoundsDetails.right = true
                isOutOfBounds = true
            }
            if (widgetRect.top < containerRect.top + margin) {
                newTop = containerRect.top + margin
                outOfBoundsDetails.top = true
                isOutOfBounds = true
            }
            else if (widgetRect.bottom > containerRect.bottom - margin) {
                newTop = containerRect.bottom - widgetRect.height - margin
                outOfBoundsDetails.bottom = true
                isOutOfBounds = true
            }

            // Reposition widget if out of bounds
            if (isOutOfBounds) {
                config.position = {left: newLeft, top: newTop}
                outOfBoundsDetails.newPosition = {left: newLeft, top: newTop}
                element.style.left = `${newLeft}px`
                element.style.top = `${newTop}px`
                setPosition(config.position)

                // Dispatch custom event for out-of-bounds
                const outOfBoundsEvent = new CustomEvent('widgetOutOfBounds', {
                    detail:     outOfBoundsDetails,
                    bubbles:    true,
                    cancelable: true,
                })
                element.dispatchEvent(outOfBoundsEvent)
            }

            // Adjust transform for dragging elements
            if (config.transform) {
                const transforms = this.#widgetManager.transform.parseTransform(config.transform)
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
                        this.#widgetManager.transform.setTranslate(element, newTranslateX, newTranslateY)
                    }
                }
            }

            // Update cropper position and dimensions
            if (config.isCropper && this.windowResizing) {
                const containerRect = config.container.getBoundingClientRect()
                const currentWidth = config.cropDimensions?.width || 200
                const currentHeight = config.cropDimensions?.height || 200
                const maxWidth = containerRect.width - 2 * margin
                const maxHeight = containerRect.height - 2 * margin
                let newWidth = currentWidth
                let newHeight = currentHeight
                // Maintain aspect ratio if locked
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
                // Recalculate position for cropper, maintaining relative center
                let newLeft = config.position.left
                let newTop = config.position.top
                // Use centerRatio if available, otherwise calculate from current position
                const centerRatio = config.centerRatio || {
                    x: (config.position.left + currentWidth / 2) / containerRect.width,
                    y: (config.position.top + currentHeight / 2) / containerRect.height,
                }
                // Calculate new position based on centerRatio
                newLeft = centerRatio.x * containerRect.width - newWidth / 2
                newTop = centerRatio.y * containerRect.height - newHeight / 2
                // Constrain position within bounds, applying margin only to colliding sides
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
                // Update centerRatio after repositioning
                config.centerRatio = {
                    x: (newLeft + newWidth / 2) / containerRect.width,
                    y: (newTop + newHeight / 2) / containerRect.height,
                }
                // Update crop dimensions and position
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
                // Apply dimensions and position synchronously
                element.style.width = `${newWidth}px`
                element.style.height = `${newHeight}px`
                element.style.left = `${newLeft}px`
                element.style.top = `${newTop}px`
                // Apply clip-path immediately
                this.#widgetManager.applyCropToOverlay(config)
                // Update Moveable only if necessary
                if (mv && mv.current && (config.transform || config.isCropper)) {
                    mv.current.updateRect()
                }
                // Dispatch crop update
                this.#widgetManager.cropDimensions(config, false)
                setPosition(config.position)
                // Update out-of-bounds event for cropper if necessary
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
        if (config.container) {
            handleResize(true)
            config.observer = new ResizeObserver(this.#throttle(handleResize, 100))
            config.observer.observe(config.container)
        }
    }

    /**
     * Retrieves or creates widget configuration for an element, including saved positions from browser DB.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} initialConfig - Initial configuration
     * @returns {Promise<Object>} Widget configuration
     */
    retrieveConfig = async (element, initialConfig = {}) => {
        const elementId = initialConfig.id && typeof initialConfig.id === 'string' && initialConfig.id.trim()
                          ? initialConfig.id
                          : this.retrieveElementId(element) || uuid()
        let config
        if (!this.#widgets.has(elementId)) {
            const anchor = initialConfig.isCropper
                           ? (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo) ? initialConfig.attachTo : 'center')
                           : (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo)
                              ? initialConfig.attachTo
                              : (initialConfig.position && this.#validPositions.includes(initialConfig.position))
                                ? initialConfig.position
                                : 'top-left')
            let ratio = this.getRatio(initialConfig.ratio ?? __.device.isPortrait ? '9x16' : '16x9')
            if (initialConfig.type === LGS_VISUAL_WIDGET) {
                ratio = lgs.configuration.widgetRatio
            }

            config = {
                animationWhenDragging: initialConfig.animationWhenDragging ?? false,
                animationWhenScaling:  initialConfig.animationWhenScaling ?? false,
                attachTo:              anchor,
                boundStatus:            {left: false, top: false, right: false, bottom: false},
                bounds:                {left: 0, top: 0, right: 0, bottom: 0},
                centerRatio:           {x: 0.5, y: 0.5},
                container:              initialConfig.container,
                contextMenu: __.ui.widgetManager.cloneContext(initialConfig?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                cropDimensions:        initialConfig.cropDimensions,
                dimensions:            {width: 0, height: 0},
                dynamic:               initialConfig.dynamic ?? false,
                element:               initialConfig.element,
                group:                 initialConfig.group ?? null,
                id:                    elementId,
                isCropper:              initialConfig.isCropper,
                isMobile:               initialConfig.isMobile,
                left:                   initialConfig.left,
                mandatory:             initialConfig.mandatory ?? false,
                margin:                 initialConfig.margin,
                max:  initialConfig.max ?? {width: 500, height: 500},
                min:  initialConfig.min ?? {width: 10, height: 10},
                minCropSize: initialConfig.minCropSize ?? {width: 100, height: 100},
                observer:              null,
                outsideOverlay:         initialConfig.outsideOverlay,
                persist:               initialConfig.persist ?? null,
                position:              {left: 0, top: 0},
                previousCropDimensions: null,
                ratio: ratio,
                resizeFromCenter:      initialConfig.resizeFromCenter ?? false,
                rotate:                initialConfig.rotate ?? 0,
                scale:                 initialConfig.scale ?? {x: 1, y: 1},
                setPosition:            initialConfig.setPosition,
                showControlBox:        initialConfig.showControlBox,
                snapPoints:            [],
                stopPropagation: initialConfig.stopPropagation ?? false,
                top:                   initialConfig.top,
                translate:             initialConfig.translate ?? {x: 0, y: 0},
                transient:              initialConfig.transient ?? false,
                ttl:                    initialConfig.ttl ?? this.TTL,
                type: initialConfig.type ?? LGS_WIDGET,
                useRatio:              initialConfig.useRatio ?? true,
            }
        }
        else {
            config = this.#widgets.get(elementId)
            if (initialConfig.outsideOverlay) {
                config.outsideOverlay = initialConfig.outsideOverlay
            }
            if (initialConfig.container) {
                config.container = initialConfig.container
            }
            if (initialConfig.group !== undefined) {
                config.group = initialConfig.group
            }
        }
        // Restore position from IndexedDB if available
        config.fromDB = false
        if (config.persist) {
            const savedWidget = await this.#widgetManager.getWidgetPosition(elementId)
            if (savedWidget) {
                config.fromDB = true
                config.position = {
                    left: savedWidget.left,
                    top:  savedWidget.top,
                }
                config.dimensions = {
                    width:  savedWidget.width,
                    height: savedWidget.height,
                }
                config.cropDimensions = {
                    top:    savedWidget.top,
                    left:   savedWidget.left,
                    width:  savedWidget.width,
                    height: savedWidget.height,
                }
                config.group = savedWidget.group || config.group
                config.scale = savedWidget.scale || {x: 1, y: 1}
                config.ratio = savedWidget.ratio
                config.attachTo = 'top-left'
            }
        }

        // Constrain and adapt widget size to its container
        const container = config?.container.getBoundingClientRect()
        if (container) {
            if (config.type === LGS_VISUAL_WIDGET) {
                config.scale = this.adaptScaleToContainer(config, container)
            }
            config.position = this.adaptPositionToContainer(config, container)
        }
        // Save it locally
        this.#widgets.set(elementId, config)

        return config
    }

    /**
     * Constrains position within container bounds
     *
     * @param container{width,height} - Container dimensions
     * @param config - Widget configuration
     * @return {*|{x: *, y: *}|{x: *, y: *}} - scale
     * @return {{left: *, top: *}}
     */
    adaptPositionToContainer = (config, container) => {
        //
        return {
            left: Math.max(
                container.left + config.margin,
                Math.min(config.position.left, container.right - config.dimensions.width * config.scale.x - config.margin),
            ),
            top:  Math.max(
                container.top + config.margin,
                Math.min(config.position.top, container.bottom - config.dimensions.height * config.scale.y - config.margin),
            ),
        }
    }

    /**
     * Adapts widget size to container size. It provides a new scale value.
     *
     * @param config - Widget configuration
     * @param container{width,height} - Container dimensions
     * @return {*|{x: *, y: *}|{x: *, y: *}} - scale
     */
    adaptScaleToContainer = (config, container) => {
        const maxW = container.width - 2 * config.margin
        const maxH = container.height - 2 * config.margin

        // Ensure widget fits inside container with config.margin, using uniform scale to preserve aspect ratio
        if ((config.ratio?.locked || config.useRatio) && config.ratio?.aspectRatio) {
            // Ratio is enforced (locked or useRatio) → compute scaled height from width
            const sw = config.dimensions.width * config.scale.x
            const sh = config.dimensions.height * config.scale.y
            if (sw > maxW || sh > maxH) {
                const tmp = Math.min(maxW / config.dimensions.width, maxH / config.dimensions.height)
                config.scale = {x: tmp, y: tmp}
            }
        }
        else {
            // No ratio constraint → allow independent X/Y scaling, but still use uniform scale to avoid
            // distortion
            const tmp = Math.min(maxW / (config.dimensions.width * config.scale.x), maxH /
                (config.dimensions.height * config.scale.y))
            config.scale = {x: tmp, y: tmp}
        }


        return config.scale
    }


    /**
     * Clones a context menu configuration object by ensuring all expected boolean attributes are defined.
     * If an attribute is missing in the source object, it will be set to false in the clone.
     *
     * @param {Object} source - The object to clone.
     * @param {string[]} attrs - List of expected boolean attribute names.
     * @returns {Object} A new object with all attributes from `attrs`, defaulting to false if undefined in
     *     `source`.
     */
    cloneContext = (source, attrs) =>
        Object.fromEntries(
            attrs.map(attr => [attr, source.hasOwnProperty(attr) ? source[attr] : false]),
        )

    /**
     * Checks whether at least one of the specified capability attributes is truthy in the source object.
     *
     * @param {Object} source - The object to inspect.
     * @param {string[]} attrs - List of capability attribute names to check.
     * @returns {boolean} True if at least one attribute is truthy in `source`, otherwise false.
     */
    hasCapabilities = (source, attrs) =>
        attrs.some(attr => Boolean(source?.[attr]))

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
        // Validate inputs
        if (!element || !initialConfig?.container || !moveable.current) {
            return false
        }

        // Initialize configuration
        initialConfig.element = element
        initialConfig.setPosition = setPosition
        let elementId = initialConfig.id && typeof initialConfig.id === 'string' && initialConfig.id.trim()
                        ? initialConfig.id
                        : this.retrieveElementId(element) || uuid()
        element.setAttribute(this.#ID_KEY, elementId)
        moveable.current.target = element
        moveable.current.onRender = e => {
            e.target.style.opacity = initialConfig.opacity
        }
        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        // Get config for this element
        const config = await this.retrieveConfig(element, initialConfig)

        // Set default ratio if none exists
        if (!config?.ratio) {
            const fallback = __.device.isPortrait ? '9x16' : '16x9'
            config.ratio = this.getRatio(initialConfig.ratio ?? fallback)
        }

        // Apply crop dimensions for cropper elements
        if (config.isCropper) {
            this.#widgetManager.cropDimensions(config, false) // Setup cropper dimensions
        }

        // Set initial bounds and position
        const newBounds = this.refreshBounds(config, moveable.current)
        setBounds(newBounds)
        // Initialize position for all elements
        const newPosition = this.computeInitialPosition(config, element, false)
        this.applyPosition(element, newPosition, moveable, false, setPosition)

        // Initialize cropDimensions for croppers
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
            this.#widgetManager.applyCropToOverlay(config)

            // Configure moveable for resizing with ratio lock
            moveable.current.request('resizable', {
                keepRatio:   !!config.ratio?.locked || false,    // undefined when free ratio
                deltaWidth:  0,
                deltaHeight: 0,
            }, true)
        }

        // Set default styles BEFORE any transform operations
        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '0 0'

        // Restore scale transform if saved (must be AFTER style initialization)
        if (config.fromDB && config.scale && (config.scale.x !== 1 || config.scale.y !== 1)) {
            this.#widgetManager.transform.setScale(element, config.scale.x, config.scale.y)
        }

        // Initialize resize observer and overlay
        this.monitorContainerResize(config, setBounds, moveable, element, setPosition)
        this.#createInnerOverlay(element)

        // Dispatch initial crop event for croppers
        if (config.isCropper && config.cropDimensions) {
            this.#widgetManager.cropDimensions(config, false) // Trigger initial crop update
        }
        this.setConfig(elementId, config)
        this.setMoveable(elementId, moveable)

        if (config.persist) {
            await this.#widgetDB.saveWidgetPosition(elementId, config)
        }
        return true
    }
    /**
     * Generates a unique element ID based on a widget group and identifier.
     *
     * @param {string|null} group - The widget group name used to locate configuration. If null or falsy, the ID is
     *     returned as-is.
     * @param {string|null} [id=null] - The base identifier. If null, a UUID is generated.
     * @returns {string} A unique identifier string, either:
     * - the original ID,
     * - a generated UUID,
     * - or a composite ID in the format `<id>#<uuid>` if the widget is not mandatory and its usage count is not 1.
     *
     * The function checks the app configuration for widget settings. If the widget exists and is not mandatory and not
     *     single-use, it appends a UUID to the ID to ensure uniqueness. If no widget is found, or the conditions
     *     aren't met, the original ID is used.
     */
    defineElementId = (group, id = null) => {
        // No group provided, se use ID
        if (!group) {
            return id
        }
        // No ID provided, we generate a new one
        if (id === null) {
            return uuid()
        }
        // We have group and ID
        // let's search widgets type defines in app configuration and get some settings
        const widget = __.widgets.get(group ?? null)?.widgets.get(id)
        if (widget) {
            return (!widget?.mandatory && widget?.use !== 1) ? `${id}#${uuid()}` : id
        }
        // No widget found, id is enough, let's use it
        return id
    }

    countWidgets = (group, key) => {
        let count = 0
        if (group) {
            const widgets = __.widgets.get(group)?.widgets
            if (widgets) {
                count = widgets.size
            }
        }
        return count
    }

    /**
     * Creates a fully independent clone of a DOM element
     * - Cuts all JS references (event listeners, canvas state, etc.)
     * - Preserves the exact visual size (including transform/scale from the element OR any parent)
     * - Forces layout so getBoundingClientRect() works immediately
     *
     * @param {Element} element - The original DOM element to clone
     * @returns {Element} A brand new element, 100% independent and correctly sized
     */
    clone = (element) => {
        // 1. Serialize → parse → recreate → breaks all live references
        const template = document.createElement('template')
        template.innerHTML = element.outerHTML.trim()
        const clone = template.content.firstElementChild

        if (!clone) {
            return null
        }

        // 2. Compute the FULL accumulated transform matrix (element + all parents)
        function getAccumulatedTransform(el) {
            let current = el
            let matrix = new DOMMatrix() // identity matrix

            while (current && current !== document.documentElement) {
                const style = getComputedStyle(current)
                const transform = style.transform && style.transform !== 'none'
                                  ? new DOMMatrix(style.transform)
                                  : new DOMMatrix()

                // Multiply on the left → correct composition order (child × parent)
                matrix = transform.multiply(matrix)

                current = current.parentElement
            }
            return matrix
        }

        const fullMatrix = getAccumulatedTransform(element)

        // 3. Apply the exact same transform if there is one (scale, rotate, skew, matrix…)
        if (!fullMatrix.isIdentity) {
            clone.style.transform = `matrix(${fullMatrix.a}, ${fullMatrix.b}, ${fullMatrix.c}, ${fullMatrix.d}, ${fullMatrix.e}, ${fullMatrix.f})`

            // Preserve transform-origin of the original element (important for correct scaling point)
            const origStyle = getComputedStyle(element)
            // if (origStyle.transformOrigin && origStyle.transformOrigin !== '0px 0px 0px') {
            //     clone.style.transformOrigin = origStyle.transformOrigin
            // }
        }
        //
        //       // 4. Force layout so getBoundingClientRect() never returns 0×0
        //       //    (off-screen positioning = invisible but fully rendered)
        //       clone.style.cssText += `
        //   ;display: block !important
        //   ;visibility: visible !important
        //   ;position: absolute !important
        //   ;left: -999999px !important
        //   ;top: -999999px !important
        //   ;margin: 0 !important
        //   ;padding: 0 !important
        // `;

        clone.classList.add('lgs-widget-clone')
        return clone
    }

}