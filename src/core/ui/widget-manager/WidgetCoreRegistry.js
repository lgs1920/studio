/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCoreRegistry.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-23
 * Last modified: 2026-04-23
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_VISUAL_WIDGET, LGS_WIDGET, SCENE_WIDGETS_BOARD, SECOND, WIDGETS_CAPABILITIES } from '@Core/constants'
import { isNonDistortingWidget } from './widgetResizeUtils'
import { v4 as uuid }                                      from 'uuid'

/**
 * Handles widget registry, persistence, and configuration lifecycle.
 */
export class WidgetCoreRegistry {
    #hideDelay = 2 * SECOND
    #minDimensionThreshold = 50
    #idKey = 'data-widget-id'
    #widgets = new Map()
    #moveables = new Map()
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
    #isDragging = false
    #isResizing = false
    #isScaling = false
    #windowResizing = true
    #controlBoxTimers = new Map()
    #current = null
    #ttl = null

    constructor() {
    }

    #resolvePersistedRatios = (savedWidget, referenceRect, boundsRect) => {
        let leftRatio = savedWidget.leftRatio
        let topRatio = savedWidget.topRatio

        const shouldMigrateToBoardReference = savedWidget.positionReference === 'scene' &&
            savedWidget.widgetsBoard &&
            savedWidget.widgetsBoard !== SCENE_WIDGETS_BOARD
        if (shouldMigrateToBoardReference &&
            boundsRect?.width > 0 &&
            boundsRect?.height > 0 &&
            referenceRect?.width > 0 &&
            referenceRect?.height > 0) {
            const absoluteCenterX = boundsRect.left + ((leftRatio / 100) * boundsRect.width)
            const absoluteCenterY = boundsRect.top + ((topRatio / 100) * boundsRect.height)

            leftRatio = ((absoluteCenterX - referenceRect.left) / referenceRect.width) * 100
            topRatio = ((absoluteCenterY - referenceRect.top) / referenceRect.height) * 100
        }

        return {leftRatio, topRatio}
    }

    /**
     * Exposes the widgets map for readonly operations.
     * @returns {Map<string, Object>}
     */
    get widgets() {
        return this.#widgets
    }

    get hideDelay() {
        return this.#hideDelay
    }

    get minDimensionThreshold() {
        return this.#minDimensionThreshold
    }

    get idKey() {
        return this.#idKey
    }

    get controlBoxTimers() {
        return this.#controlBoxTimers
    }

    get current() {
        return this.#current
    }

    set current(value) {
        this.#current = value
    }

    get validPositions() {
        return this.#validPositions
    }

    get isResizing() {
        return this.#isResizing
    }

    set isResizing(value) {
        this.#isResizing = value
    }

    get isDragging() {
        return this.#isDragging
    }

    set isDragging(value) {
        this.#isDragging = value
    }

    get isScaling() {
        return this.#isScaling
    }

    set isScaling(value) {
        this.#isScaling = value
    }

    get windowResizing() {
        return this.#windowResizing
    }

    set windowResizing(value) {
        this.#windowResizing = value
    }

    retrieveElementId = element => element.getAttribute(this.#idKey)

    /**
     * Retrieves widget configuration by element ID.
     * @param {string} elementId - The element ID
     * @returns {Object|undefined} Widget configuration or undefined if not found
     */
    getWidgetConfig = elementId => this.#widgets.get(elementId)

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
     * Sets widget configuration for an element ID.
     * @param {string} elementId - The element ID
     * @param {Object} config - Widget configuration
     */
    setConfig = (elementId, config) => {
        this.#widgets.set(elementId, config)
    }

    /**
     * Invalidates one widget runtime while preserving its persisted position.
     *
     * @param {string} elementId - Widget identifier.
     * @returns {boolean} Whether a runtime configuration was invalidated.
     */
    invalidateRuntimeById = elementId => {
        const config = this.#widgets.get(elementId)
        if (!config) {
            return false
        }

        this.#invalidateRuntimeConfig(elementId, config)
        return true
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
            const observedTargets = config.observedTargets ?? [config.boundsContainer ?? config.container]
            try {
                observedTargets.filter(Boolean).forEach(target => config.observer.unobserve(target))
            }
            catch {
                void 0
            }
            config.observer.disconnect()
            config.observer = null
        }
        if (config.elementObserver) {
            config.elementObserver.disconnect()
            config.elementObserver = null
        }
        if (config.windowResizeHandler) {
            window.removeEventListener('resize', config.windowResizeHandler)
            config.windowResizeHandler = null
        }
        if (config.cropResizeCommitTimer) {
            clearTimeout(config.cropResizeCommitTimer)
            config.cropResizeCommitTimer = null
        }
        this.#widgets.delete(elementId)
        this.#moveables.delete(elementId)
        const timer = this.#controlBoxTimers.get(elementId)
        if (timer) {
            clearTimeout(timer)
            this.#controlBoxTimers.delete(elementId)
        }

        if (config.persist) {
            await __.ui.widgetManager.deleteWidgetPosition(elementId)
        }
    }

    /**
     * Disposes all widgets in a group, respecting persist flag.
     * @param {string} groupId - The group identifier
     * @param {boolean} usePersist - Whether to respect persist flag
     */
    disposeByGroup = (groupId, usePersist = false) => {
        const elementsToDispose = []
        for (const [elementId, config] of this.#widgets) {
            if (config.group !== groupId) {
                continue
            }
            if (usePersist && config.persist) {
                this.#invalidateRuntimeConfig(elementId, config)
                continue
            }
            elementsToDispose.push(elementId)
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
     * Releases runtime resources while preserving the widget configuration and persistence record.
     * @param {string} elementId - Widget identifier
     * @param {Object} config - Widget runtime configuration
     */
    #invalidateRuntimeConfig = (elementId, config) => {
        if (config.observer) {
            const observedTargets = config.observedTargets ?? [config.boundsContainer ?? config.container]
            try {
                observedTargets.filter(Boolean).forEach(target => config.observer.unobserve(target))
            }
            catch {
                void 0
            }
            config.observer.disconnect()
            config.observer = null
        }
        if (config.elementObserver) {
            config.elementObserver.disconnect()
            config.elementObserver = null
        }
        if (config.windowResizeHandler) {
            window.removeEventListener('resize', config.windowResizeHandler)
            config.windowResizeHandler = null
        }
        if (config.cropResizeCommitTimer) {
            clearTimeout(config.cropResizeCommitTimer)
            config.cropResizeCommitTimer = null
        }
        config.element = null
        config.observedTargets = []
        config.fromDB = false
        config.fromRuntime = false
        config.runtimeReady = false
        config.skipInitialElementResizeSync = false
        __.ui.widgetCache?.unmount?.(elementId)
        this.#moveables.delete(elementId)
    }

    /**
     * Invalidates the runtime state of all widgets attached to a board without touching persistence.
     * This is used when a board is temporarily unmounted and needs to be reloaded from DB on the next mount.
     *
     * @param {string} widgetsBoard
     * @returns {number}
     */
    invalidateRuntimeByBoard = (widgetsBoard) => {
        if (!widgetsBoard) {
            return 0
        }

        let invalidated = 0
        for (const [elementId, config] of this.#widgets) {
            if (config.widgetsBoard !== widgetsBoard) {
                continue
            }
            this.#invalidateRuntimeConfig(elementId, config)
            invalidated += 1
        }

        return invalidated
    }

    /**
     * Retrieves the widget element by ID.
     * @param {string} id - The widget ID
     * @returns {HTMLElement|null} The DOM element or null if not found
     */
    getElementById = id => document.querySelector(`[${this.#idKey}="${id}"]`)

    /**
     * Retrieves the widget ID from an element.
     * @param {HTMLElement} element - The DOM element
     * @returns {string|null} The widget ID or null if not found
     */
    getIdFromElement = element => element.getAttribute(this.#idKey)

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
    getWidgetIDKey = () => this.#idKey

    /**
     * Retrieves video format ratio configuration.
     * @param {string} ratio - Ratio identifier (e.g., '16x9')
     * @returns {Object} Ratio configuration object
     */
    getRatio = ratio => lgs.configuration.videoFormats.find(p => p.value === ratio)

    #getRatioValue = ratio => ratio?.value ?? ratio ?? null

    #resolveRatioConfig = ratio => {
        if (!ratio) {
            return null
        }

        if (typeof ratio === 'object') {
            const aspectRatio = Number(ratio.aspectRatio)
            if (Number.isFinite(aspectRatio) && aspectRatio > 0) {
                return {
                    ...ratio,
                    aspectRatio,
                }
            }

            const preset = this.getRatio(ratio.value ?? ratio)
            if (preset) {
                return preset
            }

            return null
        }

        return this.getRatio(ratio)
    }

    #applyRatioToConfig = (config, ratio, resizeToRatio = false) => {
        if (!config || !ratio) {
            return
        }

        config.ratio = ratio

        if (
            !resizeToRatio ||
            !ratio.locked ||
            !Number.isFinite(ratio.aspectRatio) ||
            ratio.aspectRatio <= 0 ||
            !Number.isFinite(config.dimensions?.width) ||
            !Number.isFinite(config.dimensions?.height) ||
            config.dimensions.width <= 0 ||
            config.dimensions.height <= 0 ||
            !Number.isFinite(config.position?.left) ||
            !Number.isFinite(config.position?.top)
        ) {
            return
        }

        const centerX = config.position.left + (config.dimensions.width / 2)
        const centerY = config.position.top + (config.dimensions.height / 2)
        const nextDimensions = {
            width:  config.dimensions.height * ratio.aspectRatio,
            height: config.dimensions.height,
        }

        config.dimensions = nextDimensions
        config.position = {
            left: centerX - (nextDimensions.width / 2),
            top:  centerY - (nextDimensions.height / 2),
        }
        config.cropDimensions = {
            ...config.cropDimensions,
            left:   config.position.left,
            top:    config.position.top,
            width:  nextDimensions.width,
            height: nextDimensions.height,
        }
    }

    /**
     * Retrieves or creates widget configuration for an element, including saved positions from browser DB.
     * Calculates absolute positioning based on invariant center ratios to handle rotation/scale.
     * * @param {HTMLElement} element - The DOM element
     * @param {Object} initialConfig - Initial configuration
     * @returns {Promise<Object>} Widget configuration
     */
    retrieveConfig = async (element, initialConfig = {}) => {
        const elementId = initialConfig.id && typeof initialConfig.id === 'string' && initialConfig.id.trim()
                          ? initialConfig.id
                          : this.retrieveElementId(element) || uuid()

        let config
        const hasRuntimeConfig = this.#widgets.has(elementId)

        if (!hasRuntimeConfig) {
            const anchor = initialConfig.isCropper
                           ? (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo) ? initialConfig.attachTo : 'center')
                           : (initialConfig.attachTo && this.#validPositions.includes(initialConfig.attachTo)
                              ? initialConfig.attachTo
                              : (initialConfig.position && this.#validPositions.includes(initialConfig.position))
                                ? initialConfig.position
                                : 'top-left')

            const fallbackRatio = initialConfig.type === LGS_VISUAL_WIDGET
                                  ? lgs.configuration.widgetRatio
                                  : '1x1'
            const ratio = this.#resolveRatioConfig(initialConfig.ratio) ?? this.#resolveRatioConfig(fallbackRatio)

            config = {
                animationWhenDragging:  initialConfig.animationWhenDragging ?? false,
                animationWhenScaling:   initialConfig.animationWhenScaling ?? false,
                anchorOnScale:          initialConfig.anchorOnScale ?? null,
                attachTo:               anchor,
                boundStatus:            {left: false, top: false, right: false, bottom: false},
                bounds:                 {left: 0, top: 0, right: 0, bottom: 0},
                canHide:                initialConfig.canHide ?? false,
                canLock:                initialConfig.canLock ?? true,
                canReduce:              initialConfig.canReduce ?? true,
                centerRatio:            {x: 0.5, y: 0.5},
                collapsed:              initialConfig.collapsed ?? false,
                constrainResizeToContent: initialConfig.constrainResizeToContent ?? true,
                container:              initialConfig.container,
                contextMenu:            this.cloneContext(initialConfig?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                boundsContainer:        initialConfig.boundsContainer ?? initialConfig.container,
                cropDimensions:         initialConfig.cropDimensions,
                dimensions:             {width: 0, height: 0},
                dynamic:                initialConfig.dynamic ?? false,
                draggable:              initialConfig.draggable ?? true,
                element:                initialConfig.element,
                elementObserver:        null,
                expandedDimensions:     initialConfig.expandedDimensions ?? null,
                expandedInlineDimensions: initialConfig.expandedInlineDimensions ?? null,
                group:                  initialConfig.group ?? null,
                icon:                   initialConfig.icon ?? null,
                id:                     elementId,
                isCropper:              initialConfig.isCropper,
                isMobile:               initialConfig.isMobile,
                left:                   initialConfig.left,
                locked:                 initialConfig.locked ?? false,
                mandatory:              initialConfig.mandatory ?? false,
                margin:                 initialConfig.margin,
                max:                    initialConfig.max ?? {width: 500, height: 500},
                maxScale:               initialConfig.maxScale ?? null,
                min:                    initialConfig.min ?? {width: 10, height: 10},
                minScale:               initialConfig.minScale ?? null,
                minCropSize:            initialConfig.minCropSize ?? {width: 100, height: 100},
                observer:               null,
                onRemove:               initialConfig.onRemove ?? null,
                outsideOverlay:         initialConfig.outsideOverlay,
                positionKey:            initialConfig.positionKey,
                persist:                initialConfig.persist ?? null,
                preserveChildrenWhenCollapsed: initialConfig.preserveChildrenWhenCollapsed ?? false,
                position:               {left: 0, top: 0},
                previousCropDimensions: null,
                ratio:                  ratio,
                resizeFromCenter:       initialConfig.resizeFromCenter ?? false,
                resizeToContent:        initialConfig.resizeToContent ?? null,
                resizable:              initialConfig.resizable ?? false,
                rotate:                 initialConfig.rotate ?? 0,
                runtimeReady:           false,
                scale:                  initialConfig.scale ?? {x: 1, y: 1},
                scalable:               initialConfig.scalable ?? false,
                setPosition:            initialConfig.setPosition,
                showControlBox:         initialConfig.showControlBox,
                snap:                   initialConfig.snap ?? false,
                snapPoints:             [],
                stopPropagation:        initialConfig.stopPropagation ?? false,
                top:                    initialConfig.top,
                translate:              initialConfig.translate ?? {x: 0, y: 0},
                transient:              initialConfig.transient ?? false,
                ttl:                    initialConfig.ttl ?? this.#ttl,
                type:                   initialConfig.type ?? LGS_WIDGET,
                useRatio:               initialConfig.useRatio ?? true,
                visible:                initialConfig.visible ?? true,
                widgetsBoard:           initialConfig.widgetsBoard,
                width:                   initialConfig.width,
                height:                  initialConfig.height,
                zIndex: initialConfig.zIndex ?? 0,
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
            if (initialConfig.canLock !== undefined) {
                config.canLock = initialConfig.canLock
            }
            if (initialConfig.canHide !== undefined) {
                config.canHide = initialConfig.canHide
            }
            if (initialConfig.visible !== undefined) {
                config.visible = initialConfig.visible
            }
            if (initialConfig.canReduce !== undefined) {
                config.canReduce = initialConfig.canReduce
            }
            if (initialConfig.boundsContainer) {
                config.boundsContainer = initialConfig.boundsContainer
            }
            if (initialConfig.anchorOnScale !== undefined) {
                config.anchorOnScale = initialConfig.anchorOnScale
            }
            if (initialConfig.draggable !== undefined) {
                config.draggable = initialConfig.draggable
            }
            if (initialConfig.resizable !== undefined) {
                config.resizable = initialConfig.resizable
            }
            if (initialConfig.scalable !== undefined) {
                config.scalable = initialConfig.scalable
            }
            if (initialConfig.minScale !== undefined) {
                config.minScale = initialConfig.minScale
            }
            if (initialConfig.maxScale !== undefined) {
                config.maxScale = initialConfig.maxScale
            }
            if (initialConfig.group !== undefined) {
                config.group = initialConfig.group
            }
            if (initialConfig.icon !== undefined) {
                config.icon = initialConfig.icon
            }
            if (initialConfig.widgetsBoard !== undefined) {
                config.widgetsBoard = initialConfig.widgetsBoard
            }
            if (initialConfig.positionKey !== undefined) {
                config.positionKey = initialConfig.positionKey
            }
            if (initialConfig.onRemove !== undefined) {
                config.onRemove = initialConfig.onRemove
            }
            if (initialConfig.preserveChildrenWhenCollapsed !== undefined) {
                config.preserveChildrenWhenCollapsed = initialConfig.preserveChildrenWhenCollapsed
            }
            if (initialConfig.width !== undefined) {
                config.width = initialConfig.width
            }
            if (initialConfig.height !== undefined) {
                config.height = initialConfig.height
            }
            if (initialConfig.min !== undefined) {
                config.min = initialConfig.min
            }
            if (initialConfig.max !== undefined) {
                config.max = initialConfig.max
            }
            if (initialConfig.resizeToContent !== undefined) {
                config.resizeToContent = initialConfig.resizeToContent
            }
            if (initialConfig.constrainResizeToContent !== undefined) {
                config.constrainResizeToContent = initialConfig.constrainResizeToContent
            }
            if (initialConfig.persist !== undefined) {
                config.persist = initialConfig.persist
            }
            if (initialConfig.transient !== undefined) {
                config.transient = initialConfig.transient
            }
        }

        config.fromDB = false
        const requestedWidgetsBoard = initialConfig.widgetsBoard ?? config.widgetsBoard ?? null
        const canReuseRuntimeConfig = hasRuntimeConfig &&
            config.runtimeReady === true &&
            (config.widgetsBoard ?? null) === requestedWidgetsBoard
        config.fromRuntime = canReuseRuntimeConfig

        if (hasRuntimeConfig) {
            const requestedRatioValue = this.#getRatioValue(initialConfig.ratio)
            const defaultRatioValue = this.#getRatioValue(lgs.configuration.widgetRatio)
            const currentRatioValue = this.#getRatioValue(config.ratio)
            const shouldUseRequestedRuntimeRatio = requestedRatioValue &&
                requestedRatioValue !== currentRatioValue &&
                (!currentRatioValue || currentRatioValue === defaultRatioValue)
            const requestedRatio = shouldUseRequestedRuntimeRatio ? this.#resolveRatioConfig(initialConfig.ratio) : null

            if (requestedRatio) {
                this.#applyRatioToConfig(config, requestedRatio, true)
            }
        }

        if (config.persist && !canReuseRuntimeConfig) {
            const savedWidget = await __.ui.widgetManager.getWidgetPosition(elementId)

            const savedPositionMatchesKey = !initialConfig.positionKey
                || savedWidget?.positionKey === initialConfig.positionKey

            if (savedWidget && savedWidget.leftRatio !== undefined && savedPositionMatchesKey) {
                config.fromDB = true
                const referenceRect = config.container?.getBoundingClientRect()
                const boundsRect = config.boundsContainer?.getBoundingClientRect?.() ?? referenceRect

                if (referenceRect) {
                    const {leftRatio, topRatio} = this.#resolvePersistedRatios(savedWidget, referenceRect, boundsRect)
                    const hasFiniteRatios = Number.isFinite(leftRatio) && Number.isFinite(topRatio)

                    if (hasFiniteRatios) {
                        // Calculate absolute center position in pixels
                        const absoluteCenterX = (leftRatio / 100) * referenceRect.width
                        const absoluteCenterY = (topRatio / 100) * referenceRect.height

                        // Convert center to top-left layout position
                        // origin 50% 50% means: top-left = center - (size / 2)
                        const absoluteLeft = referenceRect.left + absoluteCenterX - (savedWidget.width / 2)
                        const absoluteTop = referenceRect.top + absoluteCenterY - (savedWidget.height / 2)

                        config.savedRatios = {leftRatio, topRatio}

                        config.position = {
                            left: absoluteLeft,
                            top:  absoluteTop,
                        }
                    }
                    else if (Number.isFinite(savedWidget.left) && Number.isFinite(savedWidget.top)) {
                        config.position = {
                            left: savedWidget.left,
                            top:  savedWidget.top,
                        }
                    }

                    config.dimensions = {
                        width:  savedWidget.width,
                        height: savedWidget.height,
                    }

                    config.cropDimensions = {
                        left:   config.position.left,
                        top:    config.position.top,
                        width:  savedWidget.width,
                        height: savedWidget.height,
                    }
                }

                config.group = savedWidget.group || config.group
                config.visible = savedWidget.visible !== false
                config.collapsed = Boolean(savedWidget.collapsed)
                config.locked = Boolean(savedWidget.locked)
                config.expandedDimensions = savedWidget.expandedDimensions ?? config.expandedDimensions
                config.expandedInlineDimensions = savedWidget.expandedInlineDimensions ?? config.expandedInlineDimensions
                if (config.canReduce === false && config.collapsed) {
                    const width = config.expandedDimensions?.width
                    const height = config.expandedDimensions?.height
                    config.collapsed = false
                    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
                        config.dimensions = {width, height}
                    }
                }
                config.icon = initialConfig.icon ?? savedWidget.icon ?? config.icon
                config.scale = savedWidget.scale || {x: 1, y: 1}
                config.rotate = savedWidget.rotate || 0
                const requestedRatioValue = this.#getRatioValue(initialConfig.ratio)
                const defaultRatioValue = this.#getRatioValue(lgs.configuration.widgetRatio)
                const savedRatioValue = this.#getRatioValue(savedWidget.ratio)
                const shouldUseRequestedRatio = requestedRatioValue &&
                    requestedRatioValue !== savedRatioValue &&
                    (!savedRatioValue || savedRatioValue === defaultRatioValue)
                const resolvedSavedRatio = this.#resolveRatioConfig(savedWidget.ratio)
                const resolvedRatio = shouldUseRequestedRatio
                                      ? this.#resolveRatioConfig(initialConfig.ratio)
                                      : resolvedSavedRatio
                if (resolvedRatio) {
                    this.#applyRatioToConfig(config, resolvedRatio, shouldUseRequestedRatio)
                }
                config.attachTo = savedWidget.attachTo || config.attachTo || 'center'
                // Prefer initialConfig.zIndex if explicitly provided (for newly added widgets)
                if (initialConfig.zIndex !== undefined) {
                    config.zIndex = initialConfig.zIndex
                }
                else if (savedWidget.zIndex !== undefined) {
                    config.zIndex = savedWidget.zIndex
                }

            }
        }

        // Crop dimensions are the rendered dimensions. Unlike regular visual
        // widgets, a crop must never combine its width/height with a scale.
        if (config.isCropper) {
            config.scale = {x: 1, y: 1}
        }

        this.#widgets.set(elementId, config)
        return config
    }

    /**
     * Prepares position data for storage in database.
     * Calculates ratios based on the widget's logical center to ensure stability.
     *
     * @param {string} widgetId - The widget ID
     * @param {Object} config - Widget configuration
     * @returns {Object|null} Position data
     */
    preparePositionDataForStorage = (widgetId, config) => {
        const element = this.getElementById(widgetId)
        const resolvedReferenceContainer = config.widgetsBoard
                                           ? __.ui.widgetManager.resolveWidgetsBoardReferenceContainer(config.widgetsBoard)
                                           : config.container
        const resolvedBoundsContainer = config.widgetsBoard
                                        ? __.ui.widgetManager.resolveWidgetsBoardBoundsContainer(config.widgetsBoard)
                                        : config.boundsContainer

        if (resolvedReferenceContainer) {
            config.container = resolvedReferenceContainer
        }
        if (resolvedBoundsContainer) {
            config.boundsContainer = resolvedBoundsContainer
        }

        if (!element || !config.container) {
            return null
        }

        const containerRect = config.container.getBoundingClientRect()

        const useCropDimensions = config.isCropper && Number.isFinite(config.cropDimensions?.width) && Number.isFinite(config.cropDimensions?.height)
        const liveLeft = parseFloat(element.style.left || '')
        const liveTop = parseFloat(element.style.top || '')
        if (Number.isFinite(liveLeft) && Number.isFinite(liveTop)) {
            config.position = {left: liveLeft, top: liveTop}
        }

        const rect = element.getBoundingClientRect()

        let width
        let height
        if (useCropDimensions) {
            width = config.cropDimensions.width
            height = config.cropDimensions.height
        }
        else {
            const computedStyle = window.getComputedStyle(element)
            const styledWidth = parseFloat(computedStyle.width || '')
            const styledHeight = parseFloat(computedStyle.height || '')
            const scaleX = config.scale?.x ?? 1
            const scaleY = config.scale?.y ?? 1

            width = Number.isFinite(styledWidth) && styledWidth > 0
                    ? styledWidth
                    : (Number.isFinite(rect.width) && rect.width > 0 && scaleX > 0
                       ? rect.width / scaleX
                       : config.dimensions.width)
            height = Number.isFinite(styledHeight) && styledHeight > 0
                     ? styledHeight
                     : (Number.isFinite(rect.height) && rect.height > 0 && scaleY > 0
                        ? rect.height / scaleY
                        : config.dimensions.height)

            config.dimensions = {width, height}
        }

        const rectCenterX = Number.isFinite(rect.left) && Number.isFinite(rect.width)
                            ? rect.left + (rect.width / 2)
                            : NaN
        const rectCenterY = Number.isFinite(rect.top) && Number.isFinite(rect.height)
                            ? rect.top + (rect.height / 2)
                            : NaN
        const positionCenterX = Number.isFinite(config.position?.left) ? config.position.left + (width / 2) : NaN
        const positionCenterY = Number.isFinite(config.position?.top) ? config.position.top + (height / 2) : NaN

        const centerX = Number.isFinite(rectCenterX) ? rectCenterX : positionCenterX
        const centerY = Number.isFinite(rectCenterY) ? rectCenterY : positionCenterY

        if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
            config.position = {
                left: centerX - (width / 2),
                top:  centerY - (height / 2),
            }
        }

        const relativeCenterX = centerX - containerRect.left
        const relativeCenterY = centerY - containerRect.top

        const computedLeftRatio = containerRect.width > 0 ? (relativeCenterX / containerRect.width) * 100 : NaN
        const computedTopRatio = containerRect.height > 0 ? (relativeCenterY / containerRect.height) * 100 : NaN
        const fallbackLeftRatio = config.savedRatios?.leftRatio
        const fallbackTopRatio = config.savedRatios?.topRatio
        const leftRatio = Number.isFinite(computedLeftRatio) ? computedLeftRatio : (Number.isFinite(fallbackLeftRatio) ? fallbackLeftRatio : 0)
        const topRatio = Number.isFinite(computedTopRatio) ? computedTopRatio : (Number.isFinite(fallbackTopRatio) ? fallbackTopRatio : 0)
        const scale = config.isCropper || isNonDistortingWidget(config)
                      ? {x: 1, y: 1}
                      : config.scale
                        ? {
                            x: Number.isFinite(Number(config.scale.x)) ? Number(config.scale.x) : 1,
                            y: Number.isFinite(Number(config.scale.y)) ? Number(config.scale.y) : 1,
                        }
                        : {x: 1, y: 1}
        const ratio = config.ratio
                      ? {
                          value: config.ratio.value ?? null,
                          aspectRatio: Number.isFinite(Number(config.ratio.aspectRatio))
                                       ? Number(config.ratio.aspectRatio)
                                       : null,
                          locked: Boolean(config.ratio.locked),
                      }
                      : null
        const expandedDimensions = config.expandedDimensions
                                   ? {
                                       width: Number.isFinite(Number(config.expandedDimensions.width))
                                              ? Number(config.expandedDimensions.width)
                                              : config.expandedDimensions.width ?? null,
                                       height: Number.isFinite(Number(config.expandedDimensions.height))
                                               ? Number(config.expandedDimensions.height)
                                               : config.expandedDimensions.height ?? null,
                                   }
                                   : null
        const expandedInlineDimensions = config.expandedInlineDimensions
                                         ? {
                                             width: config.expandedInlineDimensions.width ?? null,
                                             height: config.expandedInlineDimensions.height ?? null,
                                         }
                                         : null
        config.savedRatios = {leftRatio, topRatio}

        return {
            id:           widgetId,
            group:        config.group || null,
            widgetsBoard: config.widgetsBoard,
            left: config.position?.left,
            top:  config.position?.top,
            leftRatio: leftRatio,
            topRatio:  topRatio,
            width:  width,
            height: height,
            scale:     scale,
            rotate:       config.rotate || 0,
            ratio:        ratio,
            attachTo:  config.attachTo || 'center',
            zIndex: config.zIndex || 0,
            positionReference: config.widgetsBoard && config.widgetsBoard !== SCENE_WIDGETS_BOARD ? 'board' : 'scene',
            collapsed:          Boolean(config.collapsed),
            locked:             Boolean(config.locked),
            visible:            config.visible !== false,
            expandedDimensions: expandedDimensions,
            expandedInlineDimensions: expandedInlineDimensions,
            icon:               config.icon ?? null,
            positionKey:        config.positionKey ?? null,
        }
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
            // THe id should be unic
            return `${id}#${uuid()}`
        }
        // No widget found, id is enough, let's use it
        return id
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
            attrs.map(attr => [attr, Object.prototype.hasOwnProperty.call(source, attr) ? source[attr] : false]),
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

    #widgetsStats = (groupId, widgetId, widgetsBoard = undefined) => {
        const $widget = lgs.stores.ui.widget
        const group = __.widgets.get(groupId)
        const base = widgetId.split('#')[0]
        const widget = group?.widgets?.get(base)
        const max = widget?.max ?? 1
        // we scan the cache to count widgets
        const count = [...$widget.cache.entries()].reduce((acc, [id, w]) => {
            if (id && w.group === groupId) {
                if (widgetsBoard !== undefined && w.widgetsBoard !== widgetsBoard) {
                    return acc
                }
                const baseId = id.split('#')[0]
                if (baseId === base) {
                    acc++
                }
            }
            return acc
        }, 0)
        const maxReached = count >= max
        return {max, maxReached, count}
    }
    /**
     * Counts the instances of a widget that are present for a given group.
     * The count is based on the widget ID (i.e. the left part before #).
     *
     * @param group - group id
     * @param widget - widget id
     * @returns {number} number of instances
     *
     */
    countWidgets = (group, widget, widgetsBoard = undefined) => {
        const {count} = this.#widgetsStats(group, widget, widgetsBoard)
        return count
    }

    /**
     * Checks if a widget has reached its maximum allowed instances.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {boolean} True if the max is reached, false otherwise.
     */
    isMaxWidgetsReached = (group, widget, widgetsBoard = undefined) => {
        const {maxReached} = this.#widgetsStats(group, widget, widgetsBoard)
        return maxReached
    }

    /**
     * Returns maximum allowed widget instances.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {number} the maximum  allowed instances
     */
    maxWidgets = (group, widget, widgetsBoard = undefined) => {
        const {max} = this.#widgetsStats(group, widget, widgetsBoard)
        return max
    }

    /**
     * Checks how many instances of a widget remain for a given group.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {number} The remaining number of instances.
     */
    remainingWidgets = (group, widget, widgetsBoard = undefined) => {
        const {max, count} = this.#widgetsStats(group, widget, widgetsBoard)
        return max - count
    }
}
