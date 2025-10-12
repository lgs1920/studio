/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-12
 * Last modified: 2025-10-12
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { LGS_ANIMATION_DRAGGING, LGS_ANIMATION_RESIZING, SECOND } from '@Core/constants'
import { v4 as uuidv4 }                                           from 'uuid'

/**
 * Singleton class that manages draggable widgets and crop zones.
 * Handles positioning, resizing, and cropping functionality for DOM elements.
 */
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

    /** @type {number} Scale factor for crop dimensions */
    #CROP_SCALE_FACTOR = 1

    /** @type {{width: number, height: number}} Minimum crop size */
    #MIN_CROP_SIZE = {width: 0, height: 0}

    /**
     * Creates or returns the singleton instance of WidgetManager.
     * @param {Object} store - Application store (currently unused)
     */
    constructor(store) {
        if (WidgetManager.#instance) {
            return WidgetManager.#instance
        }
        this.#widgets = new Map()
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
     * Sets up a DOM element as a widget with moveable and crop functionality.
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

        // Initialize crop dimensions if not persisted
        const hasPersistedCrop =
                  config?.cropDimensions &&
                  Number.isFinite(config.cropDimensions.left) &&
                  Number.isFinite(config.cropDimensions.top) &&
                  Number.isFinite(config.cropDimensions.width) &&
                  Number.isFinite(config.cropDimensions.height) &&
                  config.cropDimensions.width > 0 &&
                  config.cropDimensions.height > 0
        if (!hasPersistedCrop) {
            this.cropDimensions(config)
        }

        // Apply crop dimensions for cropper elements
        if (config.isCropper) {
            element.style.left = `${config.cropDimensions.left}px`
            element.style.top = `${config.cropDimensions.top}px`
            element.style.width = `${config.cropDimensions.width}px`
            element.style.height = `${config.cropDimensions.height}px`
            element.style.transform = 'none'
            config.position = {left: config.cropDimensions.left, top: config.cropDimensions.top}
            this.applyCropToOverlay(config)
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
        if (!config.isCropper) {
            const newPosition = this.computeInitialPosition(config, element, false)
            this.applyPosition(element, newPosition, moveable, false, setPosition)
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

        // Add double-click handler for croppers
        if (config.isCropper && moveable.current.resizable) {
            moveable.current.onDoubleClick = e => this.onDoubleClick(e, setPosition)
        }

        // Dispatch initial crop event for croppers
        try {
            if (config.isCropper && config.cropDimensions) {
                document.dispatchEvent(new CustomEvent('onCropUpdate', {
                    detail: {
                        id:    config.id,
                        crop:  {...config.cropDimensions},
                        ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                        phase: 'init',
                    },
                }))
            }
        }
        catch (_) {
        }

        return true
    }

    /**
     * Applies crop dimensions to the overlay element.
     * @param {Object} config - Widget configuration
     */
    applyCropToOverlay = config => {
        if (!config?.isCropper || !config.outsideOverlay) {
            return
        }
        const {left, top, width, height} = config.cropDimensions || {}
        if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
            config.outsideOverlay.style.clipPath = this.openWindowInOverlay({left, top, width, height})
        }
        else {
            this.cropDimensions(config)
            config.outsideOverlay.style.clipPath = this.openWindowInOverlay(config.cropDimensions)
        }
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
            const anchor =
                      (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo))
                      ? initialConfig.attachTo
                      : (initialConfig.position && this.#validPositions.includes(initialConfig.position))
                        ? initialConfig.position
                        : 'top-left'
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
                containerPadding: initialConfig.containerPadding,
                animationWhenDragging: initialConfig.animationWhenDragging ?? false,
                ratio:          this.getRatio(initialConfig.ratio ?? ratio),
                useRatio:       initialConfig.useRatio ?? true,
                minCropSize:    initialConfig.minCropSize ?? this.#MIN_CROP_SIZE,
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
                                   zoom:    1,
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
                                   zoom:    1,
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

        // Use provided left/top or default to 0
        if (widget.width === 0 || widget.height === 0) {
            if (config.left != null && config.top != null) {
                config.position = {
                    left: parsePosition(config.left, container.width),
                    top: parsePosition(config.top, container.height),
                }
                return config.position
            }
            return {left: 0, top: 0}
        }

        let left = parsePosition(config.left, container.width)
        let top = parsePosition(config.top, container.height)
        const attachTo = config.attachTo || 'top-left'

        // Adjust position based on anchor point
        const adjustments = {
            center:         () => ({left: left - widget.width / 2, top: top - widget.height / 2}),
            top:            () => ({left: left - widget.width / 2, top: top}),
            left:           () => ({left: left, top: top - widget.height / 2}),
            right:          () => ({left: left - widget.width, top: top - widget.height / 2}),
            bottom:         () => ({left: left - widget.width / 2, top: top - widget.height}),
            'top-left':     () => ({left, top}),
            'top-right':    () => ({left: left - widget.width, top}),
            'bottom-left':  () => ({left, top: top - widget.height}),
            'bottom-right': () => ({left: left - widget.width, top: top - widget.height}),
        }
        const adjust = adjustments[attachTo]
        if (adjust) {
            const adjusted = adjust()
            left = adjusted.left
            top = adjusted.top
        }

        // Constrain position within bounds
        left = Math.min(Math.max(left, config.bounds.left), config.bounds.right - widget.width)
        top = Math.min(Math.max(top, config.bounds.top), config.bounds.bottom - widget.height)
        config.position = {left, top}
        config.dimensions = {width: widget.width, height: widget.height}

        // Update center ratio if resizing from center
        if (config.resizeFromCenter) {
            config.centerRatio = {
                x: (left + widget.width / 2) / container.width,
                y: (top + widget.height / 2) / container.height,
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
     * Computes crop dimensions
     * @param {Object} config - Widget configuration
     * @param {boolean} maximize - Whether to maximize crop
     * @returns {Object} Crop dimensions
     */
    cropDimensions = (config, maximize = false) => {
        const container = this.refreshBounds(config)
        container.width = container.right - container.left
        container.height = container.bottom - container.top
        const padding = config.containerPadding || 0
        const paddedWidth = container.width - 2 * padding
        const paddedHeight = container.height - 2 * padding
        let width = 0
        let height = 0
        const maxWidth = Math.floor(paddedWidth * this.#CROP_SCALE_FACTOR)
        const maxHeight = Math.floor(paddedHeight * this.#CROP_SCALE_FACTOR)
        if (!config.useRatio || !config.ratio?.locked) {
            // Free ratio: maximize to full container size
            width = Math.max(config.minCropSize.width, maxWidth)
            height = Math.max(config.minCropSize.height, maxHeight)
        }
        else {
            // Locked ratio: respect aspect ratio
            const ratio = config.ratio.aspectRatio
            if (ratio === 1) {
                width = height = Math.floor(Math.max(config.minCropSize.width, Math.min(maxWidth, maxHeight)))
            }
            else if (ratio < 1) {
                height = Math.floor(Math.max(config.minCropSize.height, maxHeight))
                width = Math.floor(Math.max(config.minCropSize.width, height * ratio))
                if (width > maxWidth) {
                    width = maxWidth
                    height = Math.floor(width / ratio)
                }
            }
            else {
                width = Math.floor(Math.max(config.minCropSize.width, maxWidth))
                height = Math.floor(Math.max(config.minCropSize.height, width / ratio))
                if (height > maxHeight) {
                    height = maxHeight
                    width = Math.floor(height * ratio)
                }
            }
        }
        const left = Math.floor((paddedWidth - width) / 2) + padding
        const top = Math.floor((paddedHeight - height) / 2) + padding
        config.cropDimensions = {left, top, width, height}
        if (config.resizeFromCenter) {
            config.centerRatio = {x: 0.5, y: 0.5}
        }
        // Update ratio to reflect new dimensions
        config.ratio = {...config.ratio, aspectRatio: width / height, locked: config.ratio?.locked ?? true}
        return config.cropDimensions
    }

    /**
     * Creates a clip path for the overlay based on crop dimensions.
     * @param {Object} crop - Crop dimensions object
     * @returns {string} CSS clip-path string
     */
    openWindowInOverlay = crop => {
        return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 
      0% ${crop.top}px, 
      ${crop.left}px ${crop.top}px, 
      ${crop.left}px ${crop.top + crop.height}px, 
      ${crop.left + crop.width}px ${crop.top + crop.height}px, 
      ${crop.left + crop.width}px ${crop.top}px, 
      0% ${crop.top}px)`
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
        Object.assign(overlay.style, {width: `${targetRect.width}px`, height: `${targetRect.height}px`})
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
    onDragStart = event => {
        event.target.classList.add('dragging')
        const config = this.retrieveConfig(event.target)
        if (config.animationWhenDragging) {
            event.target.classList.add(LGS_ANIMATION_DRAGGING)
        }
        !this.#isDragging
        this.#current = this.retrieveElementId(event.target)
    }

    /**
     * Handles the end of a drag event.
     * @param {Object} event - Drag event
     */
    onDragEnd = event => {
        event.target.classList.remove('dragging', LGS_ANIMATION_DRAGGING)
        this.#isDragging = false
        const config = this.retrieveConfig(event.target)
        if (config?.isCropper) {
            const currentTransform = event.target.style.transform || ''
            const match = currentTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
            if (match) {
                const dx = parseFloat(match[1]) || 0
                const dy = parseFloat(match[2]) || 0
                const baseLeft = parseInt(event.target.style.left || '0', 10)
                const baseTop = parseInt(event.target.style.top || '0', 10)
                const finalLeft = Math.round(baseLeft + dx)
                const finalTop = Math.round(baseTop + dy)
                event.target.style.left = `${finalLeft}px`
                event.target.style.top = `${finalTop}px`
                event.target.style.transform = 'none'
                config.transform = undefined
                config.position = {left: finalLeft, top: finalTop}
            }
            config.element = event.target
            const left = parseInt(event.target.style.left || '0', 10)
            const top = parseInt(event.target.style.top || '0', 10)
            const width = parseInt(event.target.style.width || '0', 10)
            const height = parseInt(event.target.style.height || '0', 10)
            if (Number.isFinite(left) && Number.isFinite(top) && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                config.cropDimensions = {left, top, width, height}
            }
            if (config.resizeFromCenter) {
                const container = config.container.getBoundingClientRect()
                config.centerRatio = {
                    x: (left + width / 2) / container.width,
                    y: (top + height / 2) / container.height,
                }
            }
            this.applyCropToOverlay(config)
        }
    }

    /**
     * Handles the start of a resize event.
     * @param {Object} event - Resize event
     */
    onResizeStart = event => {
        this.#isResizing = true
        event.target.classList.add('resizing')
        const config = this.retrieveConfig(event.target)
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
    onResizeEnd = event => {
        this.#isResizing = false
        event.target.classList.remove('resizing', LGS_ANIMATION_RESIZING)
        const config = this.retrieveConfig(event.target)
        if (config?.isCropper) {
            config.element = event.target
            const left = parseInt(event.target.style.left || '0', 10)
            const top = parseInt(event.target.style.top || '0', 10)
            const width = parseInt(event.target.style.width || '0', 10)
            const height = parseInt(event.target.style.height || '0', 10)
            config.cropDimensions = {left, top, width, height}
            this.applyCropToOverlay(config)
            try {
                document.dispatchEvent(new CustomEvent('onCropUpdate', {
                    detail: {
                        id:    config.id,
                        crop:  {left, top, width, height},
                        ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                        phase: 'end',
                    },
                }))
            }
            catch (_) {
            }
        }
    }

    /**
     * Handles double-click events, maximizing the crop zone using cropDimensions.
     * @param {Object} event - Click event
     * @param {Function} setPosition - Function to set position
     * @param {Object} moveable - Moveable instance
     */
    onDoubleClick = (event, setPosition, moveable) => {
        const config = this.retrieveConfig(event.target)
        if (!config?.isCropper || this.#isDragging || this.#isResizing) {
            return
        }

        // Maximize using cropDimensions
        this.cropDimensions(config, true)

        // Apply styles and update state
        const {left, top, width, height} = config.cropDimensions
        Object.assign(event.target.style, {
            left:   `${left}px`,
            top:    `${top}px`,
            width:  `${width}px`,
            height: `${height}px`,
            transform: 'none',
        })
        config.transform = undefined
        config.position = {left, top}
        this.applyCropToOverlay(config)
        setPosition({left, top})
        if (moveable && moveable.current) {
            moveable.current.updateRect()
        }
        try {
            document.dispatchEvent(new CustomEvent('onCropUpdate', {
                detail: {
                    id:    config.id,
                    crop:  {left, top, width, height},
                    ratio: {aspectRatio: config.ratio.aspectRatio, locked: config.ratio.locked},
                    phase: 'toggle',
                },
            }))
        }
        catch (_) {
        }
    }

    /**
     * Updates the crop zone ratio and dimensions.
     * @param {string} cropzoneId - The crop zone ID
     * @param {number} aspectRatio - The new aspect ratio
     * @param {boolean} lockRatio - Whether to lock the ratio
     */
    updateCropRatio = (cropzoneId, aspectRatio, lockRatio) => {
        const config = this.getWidgetConfig(cropzoneId)
        if (!config || !config.isCropper) {
            console.warn('[WidgetManager] No valid cropzone found for ID:', cropzoneId)
            return
        }

        // Ensure element exists
        if (!config.element) {
            const element = this.getElementById(cropzoneId)
            if (element) {
                config.element = element
            }
            else {
                console.warn('[WidgetManager] No element found for cropzone ID:', cropzoneId)
                return
            }
        }

        // Dispatch pre-update event
        document.dispatchEvent(new CustomEvent('onBeforeCropUpdate', {
            detail: {
                id: cropzoneId,
            },
        }))

        // Clear previousCropDimensions and timeout to avoid stale state
        clearTimeout(config.restoreTimeoutId)
        config.restoreTimeoutId = null
        config.previousCropDimensions = null
        this.#current = cropzoneId

        // Calculate new dimensions based on aspect ratio
        const container = config.container.getBoundingClientRect()
        const padding = config.containerPadding || 0
        const paddedWidth = container.width - 2 * padding
        const paddedHeight = container.height - 2 * padding
        const maxWidth = Math.floor(paddedWidth * this.#CROP_SCALE_FACTOR)
        const maxHeight = Math.floor(paddedHeight * this.#CROP_SCALE_FACTOR)
        let width, height
        if (aspectRatio === 1) {
            width = height = Math.floor(Math.max(config.minCropSize.width, Math.min(maxWidth, maxHeight)))
        }
        else if (aspectRatio < 1) {
            height = Math.floor(Math.max(config.minCropSize.height, maxHeight))
            width = Math.floor(Math.max(config.minCropSize.width, height * aspectRatio))
            if (width > maxWidth) {
                width = maxWidth
                height = Math.floor(width / aspectRatio)
            }
        }
        else {
            width = Math.floor(Math.max(config.minCropSize.width, maxWidth))
            height = Math.floor(Math.max(config.minCropSize.height, width / aspectRatio))
            if (height > maxHeight) {
                height = maxHeight
                width = Math.floor(height * aspectRatio)
            }
        }

        // Center the crop zone
        const left = Math.floor((paddedWidth - width) / 2) + padding
        const top = Math.floor((paddedHeight - height) / 2) + padding
        config.cropDimensions = {left, top, width, height}
        config.position = {left, top}
        config.centerRatio = {x: (left + width / 2) / container.width, y: (top + height / 2) / container.height}
        // Update config.ratio to ensure synchronization
        config.ratio = {aspectRatio, locked: lockRatio}

        // Apply styles to element
        const element = config.element
        element.style.left = `${left}px`
        element.style.top = `${top}px`
        element.style.width = `${width}px`
        element.style.height = `${height}px`
        element.style.transform = 'none'

        // Update overlay and position
        this.applyCropToOverlay(config)
        if (config.setPosition) {
            config.setPosition({left, top})
        }
        if (config.moveable.current) {
            config.moveable.current.updateRect()
        }

        // Dispatch crop update event
        try {
            document.dispatchEvent(new CustomEvent('onCropUpdate', {
                detail: {
                    id:    cropzoneId,
                    crop:  {left, top, width, height},
                    ratio: {aspectRatio, locked: lockRatio},
                    phase: 'ratio',
                },
            }))
        }
        catch (_) {
        }
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

    getIdFromElement = element => element.getAttribute(this.#ID_KEY)

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
        this.#isResizing = true
        const width = Math.round(event.width)
        const height = Math.round(event.height)
        const config = this.getWidgetConfig(this.retrieveElementId(target))
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

        // Update crop dimensions and dispatch event
        if (config.isCropper) {
            const before = prevCropDimensions
            const after = {left: finalLeft, top: finalTop, width, height}
            config.cropDimensions = after
            if (!before ||
                before.left !== after.left ||
                before.top !== after.top ||
                before.width !== after.width ||
                before.height !== after.height) {
                try {
                    document.dispatchEvent(new CustomEvent('onCropUpdate', {
                        detail: {
                            id:    config.id,
                            crop:  {...after},
                            ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                            phase: 'resize',
                        },
                    }))
                }
                catch (_) {
                }
            }
        }

        // Update overlay and child component
        if (config?.isCropper) {
            config.element = target
            this.applyCropToOverlay(config)
        }
        setPosition({left: finalLeft, top: finalTop})
        if (childRef.current?.handleResize) {
            childRef.current.handleResize({left: finalLeft, top: finalTop, width, height})
        }
        this.#isResizing = false
    }, 16)

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
     * @param {Function} setBounds - Function to set bounds
     * @param {Object} moveable - Moveable instance
     * @param {HTMLElement} element - The DOM element
     * @param {Function} setPosition - Function to set position
     */
    monitorContainerResize = (config, setBounds, moveable, element, setPosition) => {
        if (config.observer) {
            return
        }
        const handleResize = (() => {
            let rafId = null
            let pending = false
            let lastComputed = {right: null, bottom: null, translateX: null, translateY: null}
            const computeAndApply = () => {
                if (this.#isResizing) {
                    pending = false
                    rafId = null
                    return
                }
                const oldBounds = {...config.bounds}
                const newBounds = this.refreshBounds(config, moveable)
                if (newBounds.left === oldBounds.left && newBounds.top === oldBounds.top &&
                    newBounds.right === oldBounds.right && newBounds.bottom === oldBounds.bottom) {
                    pending = false
                    rafId = null
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
                            if (lastComputed.translateX !== newTranslateX || lastComputed.translateY !== newTranslateY) {
                                config.transform = `translate(${newTranslateX}px, ${newTranslateY}px)`
                                element.style.transform = config.transform
                                lastComputed.translateX = newTranslateX
                                lastComputed.translateY = newTranslateY
                            }
                        }
                    }
                }

                // Update cropper position and dimensions
                if (config.isCropper) {
                    const t = element.style.transform || ''
                    const m = t.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)
                    const baseLeft = parseInt(element.style.left || '0', 10)
                    const baseTop = parseInt(element.style.top || '0', 10)
                    const dx = m ? parseFloat(m[1]) || 0 : 0
                    const dy = m ? parseFloat(m[2]) || 0 : 0
                    let left = Math.round(baseLeft + dx)
                    let top = Math.round(baseTop + dy)
                    let width = Number(config.cropDimensions?.width) || parseInt(element.style.width || '0', 10)
                    let height = Number(config.cropDimensions?.height) || parseInt(element.style.height || '0', 10)
                    width = Math.max(0, width)
                    height = Math.max(0, height)
                    const maxLeft = Math.max(newBounds.left, newBounds.right - width)
                    const maxTop = Math.max(newBounds.top, newBounds.bottom - height)
                    left = Math.min(Math.max(left, newBounds.left), maxLeft)
                    top = Math.min(Math.max(top, newBounds.top), maxTop)
                    element.style.left = `${left}px`
                    element.style.top = `${top}px`
                    element.style.transform = 'none'
                    config.transform = undefined
                    config.position = {left, top}
                    config.cropDimensions = {left, top, width, height}
                    this.applyCropToOverlay(config)
                    try {
                        document.dispatchEvent(new CustomEvent('onCropUpdate', {
                            detail: {
                                id:    config.id,
                                crop:  {left, top, width, height},
                                ratio: {aspectRatio: config?.ratio?.aspectRatio, locked: config?.ratio?.locked},
                                phase: 'container-resize',
                            },
                        }))
                    }
                    catch (_) {
                    }
                }
                const rightChanged = lastComputed.right !== newBounds.right
                const bottomChanged = lastComputed.bottom !== newBounds.bottom
                if (rightChanged || bottomChanged) {
                    if (moveable && moveable.current) {
                        moveable.current.updateRect()
                    }
                    lastComputed.right = newBounds.right
                    lastComputed.bottom = newBounds.bottom
                }
                pending = false
                rafId = null
            }
            return () => {
                if (pending) {
                    return
                }
                pending = true
                if (rafId !== null) {
                    cancelAnimationFrame(rafId)
                }
                rafId = requestAnimationFrame(computeAndApply)
            }
        })()
        if (config.container) {
            config.observer = new ResizeObserver(handleResize)
            config.observer.observe(config.container)
        }
    }
}