/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCore.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-20
 * Last modified: 2025-10-20
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Core class for managing widget configurations, bounds, and control box functionality.
 * Handles setup, positioning, and cleanup of widget elements.
 */
import { SECOND }       from '@Core/constants'
import { v4 as uuidv4 } from 'uuid'

export class WidgetCore {
    /** @type {WidgetManager} Reference to the WidgetManager instance */
    #widgetManager

    /** @type {WidgetTransform} Reference to the WidgetManager instance */
    #widgetTransform

    /** @type {number} Delay in milliseconds before hiding control box */
    HIDE_DELAY = 2 * SECOND

    /** @type {string} Data attribute key for element IDs */
    #ID_KEY = 'data-LGS-ID'

    /** @type {Map<string, Object>} Map of widget configurations */
    #widgets = new Map()

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
     * @param {WidgetTransform} widgetTransform - The #widgetTransform instance
     */
    constructor(widgetManager, widgetTransform) {
        this.#widgetManager = widgetManager
        this.#widgetTransform = widgetTransform
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
            const elementId = this.retrieveElementId(moveable.current.target)
            this.#controlBoxTimers.delete(elementId)
        }, this.HIDE_DELAY)
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
        // Validate inputs
        if (!element || !initialConfig?.container || !moveable.current) {
            return false
        }

        // Initialize configuration
        initialConfig.element = element
        initialConfig.moveable = moveable
        initialConfig.setPosition = setPosition
        let elementId = initialConfig.id && typeof initialConfig.id === 'string' && initialConfig.id.trim()
                        ? initialConfig.id
                        : this.retrieveElementId(element) || uuidv4()
        element.setAttribute(this.#ID_KEY, elementId)
        moveable.current.target = element
        moveable.current.onRender = e => {
            e.target.style.opacity = initialConfig.opacity
        }
        initialConfig.controlBoxVisibility = initialConfig.showControlBox || false

        // Get config for this element
        const config = await this.retrieveConfig(element, initialConfig)

        // Set default ratio if none exists
        if (!config?.ratio || !Number.isFinite(config.ratio?.aspectRatio)) {
            const fallback = __.device.isPortrait ? '9x16' : '16x9'
            config.ratio = this.getRatio(initialConfig.ratio ?? fallback)
        }

        // Apply crop dimensions for cropper elements
        if (config.isCropper) {
            this.#widgetManager.cropDimensions(config, false) // Setup cropper dimensions
            moveable.current.onDoubleClick = e => this.#widgetManager.onDoubleClick(e, setPosition)
        }

        // Set initial bounds and position
        const newBounds = this.refreshBounds(config, moveable)
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
                keepRatio:   !!config.ratio.locked,
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
        if (!config.overlay) {
            this.#createInnerOverlay(element)
        }

        // Dispatch initial crop event for croppers
        if (config.isCropper && config.cropDimensions) {
            this.#widgetManager.cropDimensions(config, false) // Trigger initial crop update
        }

        return true
    }

    /**
     * Applies position to an element, updating its style and configuration.
     * @param {HTMLElement} element - The DOM element
     * @param {Object|string} position - Position object or transform string
     * @param {Object} moveable - Moveable instance
     * @param {boolean} isDragging - Whether element is being dragged
     * @param {Function} setControlBoxProps - Function to set control box properties
     */
    applyPosition = (element, position, moveable, isDragging, setControlBoxProps) => {
        const config = this.getWidgetConfig(this.retrieveElementId(element))
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
        if (moveable?.current) {
            moveable.current.updateRect()
        }
        if (config.showControlBox && isDragging) {
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
    }

    /**
     * Manages the visibility of the control box.
     * @param {Object} moveable - Moveable instance
     * @param {Function} setControlBoxProps - Function to set control box properties
     * @param {Object} _controlBoxTimer - Timer reference
     * @param {boolean} show - Whether to show the control box
     * @param {boolean} isMouseOver - Whether mouse is over the element
     */
    manageControlBox = (moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver) => {
        const elementId = this.retrieveElementId(moveable.current.target)
        const config = this.getWidgetConfig(elementId)
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
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom:             1,
                                   opacity:          1,
                               })
        }
        else {
            _controlBoxTimer.current = this.#hideControlBoxWithTimer(moveable, config, setControlBoxProps, isMouseOver)
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
        const boundedLeft = Math.max(0, Math.min(left, container.width - defaultWidth))
        const boundedTop = Math.max(0, Math.min(top, container.height - defaultHeight))

        // Update config.position with bounded values
        config.position = {left: boundedLeft, top: boundedTop}

        return {left: boundedLeft, top: boundedTop}
    }
    /**
     * Refreshes container bounds based on current container size.
     * @param {Object} config - Widget configuration
     * @param {Object} moveable - Moveable instance
     * @returns {Object} Updated bounds object
     */
    refreshBounds = (config, moveable) => {
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
     * Creates an inner overlay element for the widget.
     * @private
     * @param {HTMLElement} element - The DOM element
     */
    #createInnerOverlay = element => {
        const overlay = document.createElement('div')
        const elementId = this.retrieveElementId(element)
        const config = this.getWidgetConfig(elementId)
        config.overlay = overlay
        const targetRect = this.#computeElementBounds(element)
        Object.assign(overlay.style, {width: `${targetRect.width || 200}px`, height: `${targetRect.height || 200}px`})
        overlay.classList.add('lgs-widget-inner-overlay')
        element.appendChild(overlay)
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
    disposeElement = element => {
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
        const timer = this.#controlBoxTimers.get(elementId)
        if (timer) {
            clearTimeout(timer)
            this.#controlBoxTimers.delete(elementId)
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
     * Sets widget configuration for an element ID.
     * @param {string} elementId - The element ID
     * @param {Object} config - Widget configuration
     */
    setConfig = (elementId, config) => {
        this.#widgets.set(elementId, config)
    }

    /**
     * Monitors container resize events and updates widget bounds and position.
     * @param {Object} config - Widget configuration
     * @param {Function} setBounds - Function to update bounds
     * @param {Object} moveable - Moveable instance
     * @param {HTMLElement} element - The DOM element
     * @param {Function} setPosition - Function to set position
     */
    monitorContainerResize = (config, setBounds, moveable, element, setPosition) => {
        if (config.observer) {
            return
        }
        const handleResize = () => {
            // Skip if resizing to avoid interference
            if (this.#isResizing) {
                return
            }
            const oldBounds = {...config.bounds}
            const newBounds = this.refreshBounds(config, moveable)
            if (newBounds.left === oldBounds.left && newBounds.top === oldBounds.top &&
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
                if (moveable && moveable.current && (config.transform || config.isCropper)) {
                    moveable.current.updateRect()
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
                          : this.retrieveElementId(element) || uuidv4()
        if (!this.#widgets.has(elementId)) {
            const anchor = initialConfig.isCropper
                           ? (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo) ? initialConfig.attachTo : 'center')
                           : (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo)
                              ? initialConfig.attachTo
                              : (initialConfig.position && this.#validPositions.includes(initialConfig.position))
                                ? initialConfig.position
                                : 'top-left')
            const ratio = __.device.isPortrait ? '9x16' : '16x9'
            const config = {
                animationWhenDragging: initialConfig.animationWhenDragging ?? false,
                animationWhenScaling:  initialConfig.animationWhenScaling ?? false,
                attachTo:              anchor,
                boundStatus:            {left: false, top: false, right: false, bottom: false},
                bounds:                {left: 0, top: 0, right: 0, bottom: 0},
                centerRatio:           {x: 0.5, y: 0.5},
                container:              initialConfig.container,
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
                minCropSize:            initialConfig.minCropSize ?? {width: 0, height: 0},
                moveable:              initialConfig.moveable,
                observer:              null,
                outsideOverlay:         initialConfig.outsideOverlay,
                persist:               initialConfig.persist ?? null,
                position:              {left: 0, top: 0},
                previousCropDimensions: null,
                ratio:                 this.getRatio(initialConfig.ratio ?? ratio),
                resizeFromCenter:      initialConfig.resizeFromCenter ?? false,
                rotate:                initialConfig.rotate ?? 0,
                scale:                 initialConfig.scale ?? {x: 1, y: 1},
                setPosition:            initialConfig.setPosition,
                showControlBox:        initialConfig.showControlBox,
                snapPoints:            [],
                top:                   initialConfig.top,
                translate:             initialConfig.translate ?? {x: 0, y: 0},
                transient:              initialConfig.transient ?? false,
                ttl:                    initialConfig.ttl ?? this.TTL,
                useRatio:              initialConfig.useRatio ?? true,
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
                    config.attachTo = savedWidget.attachTo
                }
            }
            this.#widgets.set(elementId, config)
        }
        else {
            const widget = this.#widgets.get(elementId)
            if (initialConfig.outsideOverlay) {
                widget.outsideOverlay = initialConfig.outsideOverlay
            }
            if (initialConfig.container) {
                widget.container = initialConfig.container
            }
            if (initialConfig.group !== undefined) {
                widget.group = initialConfig.group
            }
        }
        return this.getWidgetConfig(elementId)
    }
}