/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-13
 * Last modified: 2025-10-13
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Singleton class that manages draggable and resizable widgets.
 * Handles positioning and delegates cropping functionality to WidgetCropper.
 */
import { SECOND }          from '@Core/constants'
import { v4 as uuidv4 }    from 'uuid'
import { WidgetCropper }   from './WidgetCropper'
import { WidgetDraggable } from './WidgetDraggable'
import { WidgetResizable } from './WidgetResizable'

export class WidgetManager {
    // Singleton instance
    static #instance = null

    /** @type {number} Delay in milliseconds before hiding control box */
    HIDE_DELAY = 2 * SECOND

    /** @type {string} Data attribute key for element IDs */
    #ID_KEY = 'data-LGS-ID'

    /** @type {Map<string, Object>} Map of widget configurations */
    #widgets

    /** @type {string[]} Valid position anchors for widgets */
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    /** @type {boolean} Indicates if a widget is being dragged */
    #isDragging = false

    /** @type {boolean} Indicates if a widget is being resized */
    #isResizing = false

    /** @type {Map<string, number>} Timers for hiding control boxes */
    #controlBoxTimers = new Map()

    /** @type {string|null} ID of the currently active widget */
    #current = null

    /** @type {WidgetDraggable} Instance of WidgetDraggable */
    #draggable

    /** @type {WidgetResizable} Instance of WidgetResizable */
    #resizable

    /** @type {WidgetCropper} Instance of WidgetCropper */
    #cropper

    /**
     * Creates or returns the singleton instance of WidgetManager.
     * @param {Object} store - Application store (currently unused)
     */
    constructor(store) {
        if (WidgetManager.#instance) {
            return WidgetManager.#instance
        }
        this.#widgets = new Map()
        this.#cropper = new WidgetCropper(this)
        this.#draggable = new WidgetDraggable(this, this.#cropper)
        this.#resizable = new WidgetResizable(this, this.#cropper)
        WidgetManager.#instance = this
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
     * @returns {boolean} True if setup is successful, false otherwise
     */
    setupElement = (element, initialConfig, setBounds, setPosition, moveable) => {
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
        const config = this.retrieveConfig(element, initialConfig)

        // Set default ratio if none exists
        if (!config?.ratio || !Number.isFinite(config.ratio?.aspectRatio)) {
            const fallback = __.device.isPortrait ? '9x16' : '16x9'
            config.ratio = this.getRatio(initialConfig.ratio ?? fallback)
        }

        // Apply crop dimensions for cropper elements
        if (config.isCropper) {
            this.#cropper.setupCropper(element, config)
            moveable.current.onDoubleClick = e => this.onDoubleClick(e, setPosition)
        }

        // Configure moveable for resizing with ratio lock
        moveable.current.request('resizable', {
            keepRatio: !!config.ratio.locked,
            deltaWidth: 0,
            deltaHeight: 0,
        }, true)

        // Set initial bounds and position
        const newBounds = this.refreshBounds(config, moveable)
        setBounds(newBounds)
        // Initialize position for all elements
        const newPosition = this.computeInitialPosition(config, element, false)
        this.applyPosition(element, newPosition, moveable, false, setPosition)

        // Initialize cropDimensions for croppers
        if (config.isCropper) {
            const rect = element.getBoundingClientRect()
            const width = Number.isFinite(initialConfig.cropDimensions?.width) ? initialConfig.cropDimensions.width : (rect.width || 200)
            const height = Number.isFinite(initialConfig.cropDimensions?.height) ? initialConfig.cropDimensions.height : (rect.height || 200)
            config.cropDimensions = {
                left: newPosition.left,
                top:  newPosition.top,
                width,
                height,
            }
            element.style.width = `${width}px`
            element.style.height = `${height}px`
            this.#cropper.applyCropToOverlay(config)
        }

        // Set default styles
        element.style.transform = 'none'
        element.style.opacity = initialConfig.opacity || 1
        element.style.transformOrigin = '0 0'

        // Initialize resize observer and overlay
        this.monitorContainerResize(config, setBounds, moveable, element, setPosition)
        if (!config.overlay) {
            this.#createInnerOverlay(element)
        }

        // Dispatch initial crop event for croppers
        if (config.isCropper && config.cropDimensions) {
            this.#cropper.dispatchCropUpdate(config, 'init')
        }

        return true
    }

    /**
     * Retrieves or creates widget configuration for an element.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} initialConfig - Initial configuration
     * @returns {Object} Widget configuration
     */
    retrieveConfig = (element, initialConfig = {}) => {
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
            this.#widgets.set(elementId, {
                id:             elementId,
                boundStatus:    {left: false, top: false, right: false, bottom: false},
                container:      initialConfig.container,
                isCropper:      initialConfig.isCropper,
                isMobile:       initialConfig.isMobile,
                bounds:         {left: 0, top: 0, right: 0, bottom: 0},
                position:       {left: 0, top: 0},
                left:           initialConfig.left,
                top:            initialConfig.top,
                attachTo:       anchor,
                snapPoints:     [],
                dimensions:     {width: 0, height: 0},
                observer:       null,
                showControlBox: initialConfig.showControlBox,
                margin: initialConfig.margin,
                animationWhenDragging: initialConfig.animationWhenDragging ?? false,
                ratio:          this.getRatio(initialConfig.ratio ?? ratio),
                useRatio:       initialConfig.useRatio ?? true,
                minCropSize: initialConfig.minCropSize ?? {width: 0, height: 0},
                outsideOverlay: initialConfig.outsideOverlay,
                resizeFromCenter: initialConfig.resizeFromCenter ?? false,
                centerRatio:    {x: 0.5, y: 0.5},
                previousCropDimensions: null,
                isMaximized:    false,
                moveable:       initialConfig.moveable,
                setPosition: initialConfig.setPosition,
                element:        initialConfig.element,
                cropDimensions: initialConfig.cropDimensions,
                persistInTable: initialConfig.persistInTable ?? false,
                group:          initialConfig.group ?? null,
            })
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
        if (typeof position === 'string') {
            element.style.transform = position
            config.transform = position
        }
        else if (typeof position === 'object') {
            element.style.left = `${position.left}px`
            element.style.top = `${position.top}px`
            config.position = position
        }
        if (moveable?.current) {
            moveable.current.updateRect()
        }
        if (config.showControlBox && isDragging) {
            setControlBoxProps({
                                   renderDirections: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'],
                                   zoom: 1,
                                   opacity: 1,
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
                                   zoom: 1,
                                   opacity: 1,
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
     * Handles drag events, updating crop overlay in real-time.
     * @param {Object} event - Drag event from Moveable
     */
    onDrag = event => this.#draggable.onDrag(event)

    /**
     * Retrieves video format ratio configuration.
     * @param {string} ratio - Ratio identifier (e.g., '16x9')
     * @returns {Object} Ratio configuration object
     */
    getRatio = ratio => lgs.configuration.videoFormats.find(p => p.value === ratio)

    /**
     * Computes initial position for a widget based on configuration.
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
        const defaultWidth = Number.isFinite(config.cropDimensions?.width) ? config.cropDimensions.width : (widget.width || 200)
        const defaultHeight = Number.isFinite(config.cropDimensions?.height) ? config.cropDimensions.height : (widget.height || 200)

        // Parse position values (supports px, %, or numbers)
        const parsePosition = (value, maxDimension) => {
            if (typeof value === 'string' && value.endsWith('%')) {
                const percent = parseFloat(value)
                return isNaN(percent) ? 0 : (percent / 100) * maxDimension
            }
            if (typeof value === 'string' && value.endsWith('px')) {
                return parseFloat(value) || 0
            }
            const numValue = typeof value === 'number' ? value : parseFloat(value)
            return isNaN(numValue) ? 0 : numValue
        }

        // Use provided left/top or center for croppers, relative to the container
        let left = config.isCropper ? (container.width - defaultWidth) / 2 : container.left + parsePosition(config.left ?? '10%', container.width)
        let top = config.isCropper ? (container.height - defaultHeight) / 2 : container.top + parsePosition(config.top ?? '10%', container.height)
        const attachTo = config.attachTo || (config.isCropper ? 'center' : 'top-left')

        // Adjust position based on anchor point, skip center adjustment for croppers
        const adjustments = {
            center:         () => config.isCropper ? ({left, top}) : ({
                left: left - defaultWidth / 2,
                top:  top - defaultHeight / 2,
            }),
            top:            () => ({left: left - defaultWidth / 2, top: top}),
            left:           () => ({left: left, top: top - defaultHeight / 2}),
            right:          () => ({left: left - defaultWidth, top: top - defaultHeight / 2}),
            bottom:         () => ({left: left - defaultWidth / 2, top: top - defaultHeight}),
            'top-left':     () => ({left, top}),
            'top-right':    () => ({left: left - defaultWidth, top}),
            'bottom-left':  () => ({left, top: top - defaultHeight}),
            'bottom-right': () => ({left: left - defaultWidth, top: top - defaultHeight}),
        }
        const adjust = adjustments[attachTo]
        if (adjust) {
            const adjusted = adjust()
            left = adjusted.left
            top = adjusted.top
        }

        // Constrain position within bounds
        left = Math.min(Math.max(left, config.bounds.left), config.bounds.right - defaultWidth)
        top = Math.min(Math.max(top, config.bounds.top), config.bounds.bottom - defaultHeight)
        config.position = {left, top}
        config.dimensions = {width: defaultWidth, height: defaultHeight}

        // Update center ratio if resizing from center
        if (config.resizeFromCenter) {
            config.centerRatio = {
                x: (left + defaultWidth / 2) / container.width,
                y: (top + defaultHeight / 2) / container.height,
            }
        }
        return config.position
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
        config.boundStatus = {
            top: target.top <= container.top,
            bottom: target.bottom >= container.bottom,
            left: target.left <= container.left,
            right: target.right >= container.right,
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
     * Disposes all widgets in a group, respecting persistInTable flag.
     * @param {string} groupId - The group identifier
     * @param {boolean} usePersist - Whether to respect persistInTable flag
     */
    disposeByGroup = (groupId, usePersist = false) => {
        const elementsToDispose = []
        for (const [elementId, config] of this.#widgets) {
            if (config.group === groupId && (!usePersist || !config.persistInTable)) {
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
     * Handles the start of a drag event.
     * @param {Object} event - Drag event
     */
    onDragStart = event => this.#draggable.onDragStart(event)

    /**
     * Handles the end of a drag event.
     * @param {Object} event - Drag event
     */
    onDragEnd = event => this.#draggable.onDragEnd(event)

    /**
     * Handles the start of a resize event.
     * @param {Object} event - Resize event
     */
    onResizeStart = event => this.#resizable.onResizeStart(event)

    /**
     * Handles resize events, updating element dimensions and position.
     * @param {Object} event - Resize event
     * @param {Object} refs - References object
     * @param {Function} setPosition - Function to set position
     */
    onResize = (event, refs, setPosition) => this.#resizable.onResize(event, refs, setPosition)

    /**
     * Handles the end of a resize event.
     * @param {Object} event - Resize event
     */
    onResizeEnd = event => this.#resizable.onResizeEnd(event)

    /**
     * Handles double-click events, maximizing the crop zone.
     * @param {Object} event - Click event
     * @param {Function} setPosition - Function to set position
     */
    onDoubleClick = (event, setPosition) => this.#cropper.onDoubleClick(event, setPosition)

    /**
     * Updates the crop zone ratio and dimensions.
     * @param {string} cropzoneId - The crop zone ID
     * @param {number} aspectRatio - The new aspect ratio
     * @param {boolean} lockRatio - Whether to lock the ratio
     */
    updateCropRatio = (cropzoneId, aspectRatio, lockRatio) => this.#cropper.updateCropRatio(cropzoneId, aspectRatio, lockRatio)

    /**
     * Computes crop dimensions.
     * @param {Object} config - Widget configuration
     * @param {boolean} maximize - Whether to maximize crop
     * @returns {Object} Crop dimensions
     */
    cropDimensions = (config, maximize = false) => this.#cropper.cropDimensions(config, maximize)

    /**
     * Applies crop dimensions to the overlay element.
     * @param {Object} config - Widget configuration
     */
    applyCropToOverlay = config => this.#cropper.applyCropToOverlay(config)

    /**
     * Creates a clip path for the overlay based on crop dimensions.
     * @param {Object} crop - Crop dimensions object
     * @returns {string} CSS clip-path string
     */
    openWindowInOverlay = crop => this.#cropper.openWindowInOverlay(crop)

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
     * Retrieves widget configuration by element ID.
     * @param {string} elementId - The element ID
     * @returns {Object|undefined} Widget configuration or undefined if not found
     */
    getWidgetConfig = elementId => this.#widgets.get(elementId)

    /**
     * Get the widget element by Id
     * @param id
     * @return {HTMLElement}
     */
    getElementById = id => document.querySelector(`[${this.#ID_KEY}="${id}"]`)

    /**
     * Get the widget ID from element
     * @param {HTMLElement} element
     * @return {string}
     */
    getIdFromElement = element => element.getAttribute(this.#ID_KEY)

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
            // Adjust transform for dragging elements
            if (config.transform) {
                const match = config.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
                if (match) {
                    const translateX = parseFloat(match[1])
                    const translateY = parseFloat(match[2])
                    let newTranslateX = translateX
                    let newTranslateY = translateY
                    const deltaRight = newBounds.right - oldBounds.right
                    const deltaBottom = newBounds.bottom - oldBounds.bottom
                    const isShrinking = deltaRight < 0 || deltaBottom < 0
                    if (isShrinking) {
                        if (config.boundStatus.right) {
                            newTranslateX = translateX + deltaRight
                        }
                        if (config.boundStatus.bottom) {
                            newTranslateY = translateY + deltaBottom
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
                    if (newTranslateX !== translateX || newTranslateY !== translateY) {
                        config.transform = `translate(${newTranslateX}px, ${newTranslateY}px)`
                        element.style.transform = config.transform
                    }
                }
            }
            // Update cropper position and dimensions
            if (config.isCropper) {
                const containerRect = config.container.getBoundingClientRect()
                const currentWidth = config.cropDimensions?.width || 200
                const currentHeight = config.cropDimensions?.height || 200
                const margin = Number.isFinite(config.margin) ? config.margin : 0
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
                // Recalculate centered position for cropper
                let newLeft, newTop
                if (config.attachTo === 'center') {
                    newLeft = (containerRect.width - newWidth) / 2
                    newTop = (containerRect.height - newHeight) / 2
                    // Constrain position within bounds
                    newLeft = Math.min(Math.max(newLeft, newBounds.left + margin), newBounds.right - newWidth - margin)
                    newTop = Math.min(Math.max(newTop, newBounds.top + margin), newBounds.bottom - newHeight - margin)
                }
                else {
                    newLeft = config.position.left
                    newTop = config.position.top
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
                this.#cropper.applyCropToOverlay(config)
                // Update Moveable only if necessary
                if (moveable && moveable.current && (config.transform || config.isCropper)) {
                    moveable.current.updateRect()
                }
                // Dispatch crop update
                this.#cropper.dispatchCropUpdate(config, 'resize')
                setPosition(config.position)
            }
        }
        if (config.container) {
            config.observer = new ResizeObserver(handleResize)
            config.observer.observe(config.container)
        }
    }

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
}