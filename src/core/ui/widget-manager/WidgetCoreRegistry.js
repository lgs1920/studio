/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetCoreRegistry.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-26
 * Last modified: 2026-01-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { LGS_VISUAL_WIDGET, LGS_WIDGET, SECOND, WIDGETS_CAPABILITIES } from '@Core/constants'
import { v4 as uuid }                                                  from 'uuid'

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

    retrieveElementId = element => element.getAttribute(this.#idKey)

    /**
     * Retrieves video format ratio configuration.
     * @param {string} ratio - Ratio identifier (e.g., '16x9')
     * @returns {Object} Ratio configuration object
     */
    getRatio = ratio => lgs.configuration.videoFormats.find(p => p.value === ratio)

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

            // set ratio key
            let ratio = initialConfig.ratio ?? '1x1'
            if (initialConfig.type === LGS_VISUAL_WIDGET) {
                ratio = lgs.configuration.widgetRatio
            }

            config = {
                animationWhenDragging:  initialConfig.animationWhenDragging ?? false,
                animationWhenScaling:   initialConfig.animationWhenScaling ?? false,
                attachTo:               anchor,
                boundStatus:            {left: false, top: false, right: false, bottom: false},
                bounds:                 {left: 0, top: 0, right: 0, bottom: 0},
                centerRatio:            {x: 0.5, y: 0.5},
                container:              initialConfig.container,
                contextMenu:            this.cloneContext(initialConfig?.contextMenu ?? {}, WIDGETS_CAPABILITIES),
                cropDimensions:         initialConfig.cropDimensions,
                dimensions:             {width: 0, height: 0},
                dynamic:                initialConfig.dynamic ?? false,
                element:                initialConfig.element,
                group:                  initialConfig.group ?? null,
                id:                     elementId,
                isCropper:              initialConfig.isCropper,
                isMobile:               initialConfig.isMobile,
                left:                   initialConfig.left,
                mandatory:              initialConfig.mandatory ?? false,
                margin:                 initialConfig.margin,
                max:                    initialConfig.max ?? {width: 500, height: 500},
                min:                    initialConfig.min ?? {width: 10, height: 10},
                minCropSize:            initialConfig.minCropSize ?? {width: 100, height: 100},
                observer:               null,
                outsideOverlay:         initialConfig.outsideOverlay,
                persist:                initialConfig.persist ?? null,
                position:               {left: 0, top: 0},
                previousCropDimensions: null,
                ratio:                  this.getRatio(ratio),
                resizeFromCenter:       initialConfig.resizeFromCenter ?? false,
                rotate:                 initialConfig.rotate ?? 0,
                scale:                  initialConfig.scale ?? {x: 1, y: 1},
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
                widgetsBoard:           initialConfig.widgetsBoard,
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
            const savedWidget = await __.ui.widgetManager.getWidgetPosition(elementId)
            if (savedWidget) {
                config.fromDB = true

                // Restore position from ratios (%)
                const containerRect = config.container?.getBoundingClientRect()
                let absoluteLeft = 0
                let absoluteTop = 0

                if (containerRect) {
                    // Convert ratios (%) to pixels
                    const leftRatio = savedWidget.leftRatio ?? savedWidget.left ?? 0
                    const topRatio = savedWidget.topRatio ?? savedWidget.top ?? 0

                    // If we have ratios (new format), use them
                    if (savedWidget.leftRatio !== undefined && savedWidget.topRatio !== undefined) {
                        // Conversion ratio -> pixels basée sur la taille actuelle du conteneur
                        const relativeLeft = (leftRatio / 100) * containerRect.width
                        const relativeTop = (topRatio / 100) * containerRect.height
                        absoluteLeft = containerRect.left + relativeLeft
                        absoluteTop = containerRect.top + relativeTop

                        // Store ratios for use during resize
                        // Ces ratios seront réutilisés dans monitorContainerResize lors du resize du conteneur
                        config.savedRatios = {
                            leftRatio: leftRatio,
                            topRatio:  topRatio,
                        }
                    }
                    // Otherwise fallback to old pixel format for backward compatibility
                    else {
                        absoluteLeft = containerRect.left + (savedWidget.left || 0)
                        absoluteTop = containerRect.top + (savedWidget.top || 0)
                    }
                }
                else {
                    absoluteLeft = savedWidget.left || 0
                    absoluteTop = savedWidget.top || 0
                }

                config.position = {
                    left: absoluteLeft,
                    top:  absoluteTop,
                }
                config.dimensions = {
                    width:  savedWidget.width,
                    height: savedWidget.height,
                }
                config.cropDimensions = {
                    top:    absoluteTop,
                    left:   absoluteLeft,
                    width:  savedWidget.width,
                    height: savedWidget.height,
                }
                config.group = savedWidget.group || config.group
                config.scale = savedWidget.scale || {x: 1, y: 1}
                config.rotate = savedWidget.rotate || 0
                config.ratio = savedWidget.ratio
                // Keep original attachTo if saved, don't force 'top-left'
                config.attachTo = savedWidget.attachTo || config.attachTo || 'top-left'
            }
        }

        // Save it locally
        this.#widgets.set(elementId, config)

        return config
    }

    /**
     * Prepares position data for storage in database.
     * Converts pixel positions to ratios (%) relative to container.
     *
     * @param {string} widgetId - The widget ID
     * @param {Object} config - Widget configuration
     * @returns {Object} Position data formatted for storage avec leftRatio/topRatio au lieu de left/top
     */
    preparePositionDataForStorage = (widgetId, config) => {
        const scale = config.scale || {x: 1, y: 1}

        // Calculate position as ratios (%) relative to container
        let leftRatio = 0
        let topRatio = 0

        if (config.container) {
            const containerRect = config.container.getBoundingClientRect()
            // Position relative par rapport au conteneur (en pixels)
            const relativeLeft = config.position.left - containerRect.left
            const relativeTop = config.position.top - containerRect.top

            // Convert to ratios (%) - MODIFICATION PRINCIPALE
            leftRatio = containerRect.width > 0 ? (relativeLeft / containerRect.width) * 100 : 0
            topRatio = containerRect.height > 0 ? (relativeTop / containerRect.height) * 100 : 0
        }

        return {
            id:           widgetId,
            group:        config.group || null,
            widgetsBoard: config.widgetsBoard,
            leftRatio:    leftRatio,  // MODIFICATION: ratio au lieu de left
            topRatio:     topRatio,   // MODIFICATION: ratio au lieu de top
            width:        config.cropDimensions?.width || config.dimensions.width,
            height:       config.cropDimensions?.height || config.dimensions.height,
            transient:    config.transient,
            ttl:          config.ttl || null,
            scale:        scale,
            rotate:       config.rotate || 0,
            ratio:        config.ratio,
            attachTo:     config.attachTo,
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

    #widgetsStats = (groupId, widgetId) => {
        const $widget = lgs.stores.ui.widget
        const group = __.widgets.get(groupId)
        const base = widgetId.split('#')[0]
        const widget = group?.widgets?.get(base)
        const max = widget?.max ?? 1
        // we scan the cache to count widgets
        const count = [...$widget.cache.entries()].reduce((acc, [id, w]) => {
            if (id && w.group === groupId) {
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
    countWidgets = (group, widget) => {
        const {count} = this.#widgetsStats(group, widget)
        return count
    }

    /**
     * Checks if a widget has reached its maximum allowed instances.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {boolean} True if the max is reached, false otherwise.
     */
    isMaxWidgetsReached = (group, widget) => {
        const {maxReached} = this.#widgetsStats(group, widget)
        return maxReached
    }

    /**
     * Returns maximum allowed widget instances.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {number} the maximum  allowed instances
     */
    maxWidgets = (group, widget) => {
        const {max} = this.#widgetsStats(group, widget)
        return max
    }

    /**
     * Checks how many instances of a widget remain for a given group.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {number} The remaining number of instances.
     */
    remainingWidgets = (group, widget) => {
        const {max, count} = this.#widgetsStats(group, widget)
        return max - count
    }
}
