/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-10
 * Last modified: 2025-11-10
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Singleton class acting as an interface for managing draggable and resizable widgets.
 * Delegates functionality to specialized classes.
 */
import { WidgetDBManager } from '@Core/ui/widget-manager/WidgetDBManager'
import { WidgetCore }      from './WidgetCore'
import { WidgetCropper }   from './WidgetCropper'
import { WidgetDraggable } from './WidgetDraggable'
import { WidgetPosition }  from './WidgetPosition'
import { WidgetResizable } from './WidgetResizable'
import { WidgetScalable }  from './WidgetScalable'
import { WidgetTransform } from './WidgetTransform'

export class WidgetManager {
    // Singleton instance
    static #instance = null

    /** @type {WidgetDraggable} Instance of WidgetDraggable */
    #draggable

    /** @type {WidgetResizable} Instance of WidgetResizable */
    #resizable

    /** @type {WidgetCropper} Instance of WidgetCropper */
    #cropper

    /** @type {WidgetDBManager} Instance of WidgetDBManager */
    #widgetDB

    /** @type {WidgetScalable} Instance of WidgetScalable */
    #scalable

    /** @type {WidgetTransform} Instance of WidgetTransform */
    #transform

    /** @type {WidgetPosition} Instance of WidgetPosition */
    #position

    /** @type {WidgetCore} Instance of WidgetCore */
    #core

    /**
     * Creates or returns the singleton instance of WidgetManager.
     * @param {Object} store - Application store (currently unused)
     */
    constructor(store) {
        if (WidgetManager.#instance) {
            return WidgetManager.#instance
        }
        this.#widgetDB = new WidgetDBManager(this)
        this.#transform = new WidgetTransform(this)
        this.#cropper = new WidgetCropper(this)
        this.#draggable = new WidgetDraggable(this, this.#cropper, this.#transform)
        this.#resizable = new WidgetResizable(this, this.#cropper)
        this.#scalable = new WidgetScalable(this, this.#cropper, this.#transform)
        this.#position = new WidgetPosition(this)
        this.#core = new WidgetCore(this, this.#transform, this.#widgetDB)
        WidgetManager.#instance = this
    }

    /**
     * Gets the transform helper instance.
     * @returns {WidgetTransform} The transform helper
     */
    get transform() {
        return this.#transform
    }

    /**
     * Retrieves the element ID from its data attribute.
     * @param {HTMLElement} element - The DOM element
     * @returns {string|null} The element's ID or null if not found
     */
    retrieveElementId = element => this.#core.retrieveElementId(element)

    /**
     * Sets up a DOM element as a widget with moveable functionality.
     * @param {HTMLElement} element - The DOM element to set up
     * @param {Object} initialConfig - Initial widget configuration
     * @param {Function} setBounds - Function to update bounds
     * @param {Function} setPosition - Function to update position
     * @param {Object} moveable - Moveable instance reference
     * @returns {Promise<boolean>} True if setup is successful, false otherwise
     */
    setupElement = async (element, initialConfig, setBounds, setPosition, moveable) =>
        await this.#core.setupElement(element, initialConfig, setBounds, setPosition, moveable)

    /**
     * Applies position to an element, updating its style and configuration.
     * @param {HTMLElement} element - The DOM element
     * @param {Object|string} position - Position object or transform string
     * @param {Object} moveable - Moveable instance
     * @param {boolean} isDragging - Whether element is being dragged
     * @param {Function} setControlBoxProps - Function to set control box properties
     */
    applyPosition = (element, position, moveable, isDragging, setControlBoxProps) =>
        this.#core.applyPosition(element, position, moveable, isDragging, setControlBoxProps)

    /**
     * Manages the visibility of the control box.
     * @param {Object} moveable - Moveable instance
     * @param {Function} setControlBoxProps - Function to set control box properties
     * @param {Object} _controlBoxTimer - Timer reference
     * @param {boolean} show - Whether to show the control box
     * @param {boolean} isMouseOver - Whether mouse is over the element
     */
    manageControlBox = (moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver) =>
        this.#core.manageControlBox(moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver)

    /**
     * Retrieves video format ratio configuration.
     * @param {string} ratio - Ratio identifier (e.g., '16x9')
     * @returns {Object} Ratio configuration object
     */
    getRatio = ratio => this.#core.getRatio(ratio)

    /**
     * Computes initial position for a widget based on configuration.
     * @param {Object} config - Widget configuration
     * @param {HTMLElement} element - The DOM element
     * @param {boolean} isResize - Whether this is a resize operation
     * @returns {Object} Position object with left and top coordinates
     */
    computeInitialPosition = (config, element, isResize = false) =>
        this.#core.computeInitialPosition(config, element, isResize)

    /**
     * Refreshes container bounds based on current container size.
     * @param {Object} config - Widget configuration
     * @param {Object} moveable - Moveable instance
     * @returns {Object} Updated bounds object
     */
    refreshBounds = (config, moveable) => this.#core.refreshBounds(config, moveable)

    /**
     * Sets boundary status indicating if widget touches container edges.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} config - Widget configuration
     * @returns {Object} Boundary status object
     */
    setBoundStatus = (element, config) => this.#core.setBoundStatus(element, config)

    /**
     * Retrieves widget configuration by element ID.
     * @param {string} elementId - The element ID
     * @returns {Object|undefined} Widget configuration or undefined if not found
     */
    getWidgetConfig = elementId => this.#core.getWidgetConfig(elementId)

    /**
     * Retrieves the widget element by ID.
     * @param {string} id - The widget ID
     * @returns {HTMLElement|null} The DOM element or null if not found
     */
    getElementById = id => this.#core.getElementById(id)

    /**
     * Retrieves the widget ID from an element.
     * @param {HTMLElement} element - The DOM element
     * @returns {string|null} The widget ID or null if not found
     */
    getIdFromElement = element => this.#core.getIdFromElement(element)

    /**
     * Retrieves the inner overlay element for a widget.
     * @param {HTMLElement} element - The DOM element
     * @returns {HTMLElement|undefined} Overlay element or undefined
     */
    getInnerOverlay = element => this.#core.getInnerOverlay(element)

    /**
     * Sets widget configuration for an element ID.
     * @param {string} elementId - The element ID
     * @param {Object} config - Widget configuration
     */
    setConfig = (elementId, config) => this.#core.setConfig(elementId, config)

    /**
     * Retrieves widget configurations by group ID.
     * @param {string} groupId - The group identifier
     * @returns {Object[]} Array of widget configurations
     */
    getWidgetConfigByGroup = groupId => this.#core.getWidgetConfigByGroup(groupId)

    /**
     * Disposes a single widget element, cleaning up resources.
     * @param {HTMLElement} element - The DOM element
     */
    disposeElement = element => this.#core.disposeElement(element)

    /**
     * Disposes all widgets in a group, respecting persist flag.
     * @param {string} groupId - The group identifier
     * @param {boolean} usePersist - Whether to respect persist flag
     */
    disposeByGroup = (groupId, usePersist = false) => this.#core.disposeByGroup(groupId, usePersist)

    /**
     * Monitors container resize events and updates widget bounds and position.
     * @param {Object} config - Widget configuration
     * @param {Function} setBounds - Function to update bounds
     * @param {Object} moveable - Moveable instance
     * @param {HTMLElement} element - The DOM element
     * @param {Function} setPosition - Function to set position
     */
    monitorContainerResize = (config, setBounds, moveable, element, setPosition) =>
        this.#core.monitorContainerResize(config, setBounds, moveable, element, setPosition)

    /**
     * Handles drag events, updating crop overlay in real-time.
     * @param {Object} event - Drag event from Moveable
     */
    onDrag = event => this.#draggable.onDrag(event)

    /**
     * Getter for isResizing property
     * @returns {boolean} Whether a widget is being resized
     */
    get isResizing() {
        return this.#core.isResizing
    }

    /**
     * Setter for isResizing property
     * @param {boolean} value - New value for isResizing
     */
    set isResizing(value) {
        this.#core.isResizing = value
    }

    /**
     * Getter for isDragging property
     * @returns {boolean} Whether a widget is being dragged
     */
    get isDragging() {
        return this.#core.isDragging
    }

    /**
     * Setter for isDragging property
     * @param {boolean} value - New value for isDragging
     */
    set isDragging(value) {
        this.#core.isDragging = value
    }

    /**
     * Getter for windowResizing property
     * @returns {boolean} Whether window resizing has an impact
     */
    get windowResizing() {
        return this.#core.windowResizing
    }

    /**
     * Getter for widgets list property
     * @returns {[]} List of widget elements
     */
    get widgets() {
        return this.#core.widgets
    }

    /**
     * Generates a unique element ID based on a provided key and formatting option.
     *
     * @param {string|null} [key=null] - The base key to use for the ID. If null, a UUID is returned.
     * @param {boolean} [simple=false] - If true, returns the key as-is without appending a UUID.
     * @returns {string} A unique identifier string, either a UUID or a combination of the key and UUID.
     */
    defineElementId = (key = null, simple = false) => this.#core.defineElementId(key, simple)

    /**
     * Clones a context menu configuration object by ensuring all expected boolean attributes are defined.
     * If an attribute is missing in the source object, it will be set to false in the clone.
     *
     * @param {Object} source - The object to clone.
     * @param {string[]} attrs - List of expected boolean attribute names.
     * @returns {Object} A new object with all attributes from `attrs`, defaulting to false if undefined in `source`.
     */
    cloneContext = (source, attrs) => this.#core.cloneContext(source, attrs)

    /**
     * Checks whether at least one of the specified capability attributes is truthy in the source object.
     *
     * @param {Object} source - The object to inspect.
     * @param {string[]} attrs - List of capability attribute names to check.
     * @returns {boolean} True if at least one attribute is truthy in `source`, otherwise false.
     */
    hasCapabilities = (source, attrs) => this.#core.hasCapabilities(source, attrs)

    /**
     * Handles the start of a scale event.
     * @param {Object} event - Scale event
     */
    onScaleStart = async event => this.#scalable.onScaleStart(event)

    /**
     * Handles scale events, updating element scale and position.
     * @param {Object} event - Scale event
     * @param {Object} refs - References object
     * @param {Function} setPosition - Function to set position
     */
    onScale = (event, refs, setPosition) => this.#scalable.onScale(event, refs, setPosition)

    /**
     * Handles the end of a scale event.
     * @param {Object} event - Scale event
     */
    onScaleEnd = async event => this.#scalable.onScaleEnd(event)


    /**
     * Clamps a scale {x, y} value according to config.min and config.max dimensions.
     * If ratio is locked, clamps both axes to the same value (most restrictive).
     * @public
     * @param {Object} scale - The scale to clamp { x: number, y: number }
     * @param {Object} config - Widget configuration
     * @returns {{ x: number, y: number }} Clamped scale
     */
    clampScale = (scale, config) => this.#scalable.clampScale(scale, config)

    /**
     * Setter for windowResizing property
     * @param {boolean} value - New value for windowResizing
     */
    set windowResizing(value) {
        this.#core.windowResizing = value
    }

    /**
     * Getter for isScaling property
     * @returns {boolean} Whether a widget is being scaled
     */
    get isScaling() {
        return this.#core.isScaling
    }

    /**
     * Setter for isScaling property
     * @param {boolean} value - New value for isScaling
     */
    set isScaling(value) {
        this.#core.isScaling = value
    }

    /**
     * Applies crop dimensions to the overlay element.
     * @param {Object} config - Widget configuration
     */
    applyCropToOverlay = config => this.#cropper.applyCropToOverlay(config)

    /**
     * Retrieves or creates widget configuration for an element, including saved positions from browser DB.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} initialConfig - Initial configuration
     * @returns {Promise<Object>} Widget configuration
     */
    retrieveConfig = async (element, initialConfig) => this.#core.retrieveConfig(element, initialConfig)

    /**
     * Saves widget position and dimensions to the widgets DB.
     * @param {string} widgetId - The widget ID
     * @param {Object} config - Widget configuration
     * @returns {Promise<void>}
     */
    saveWidgetPosition = async (widgetId, config) => this.#widgetDB.saveWidgetPosition(widgetId, config)

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
     * Positions the widget at the center of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toCenter = (element, margin = 0) => this.#position.toCenter(element, margin)

    /**
     * Positions the widget at the top-left of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toTopLeft = (element, margin = 0) => this.#position.toTopLeft(element, margin)

    /**
     * Positions the widget at the top of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toTop = (element, margin = 0) => this.#position.toTop(element, margin)

    /**
     * Positions the widget at the left of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toLeft = (element, margin = 0) => this.#position.toLeft(element, margin)

    /**
     * Positions the widget at the right of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toRight = (element, margin = 0) => this.#position.toRight(element, margin)

    /**
     * Positions the widget at the bottom of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toBottom = (element, margin = 0) => this.#position.toBottom(element, margin)

    /**
     * Positions the widget at the top-right of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toTopRight = (element, margin = 0) => this.#position.toTopRight(element, margin)

    /**
     * Positions the widget at the bottom-left of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toBottomLeft = (element, margin = 0) => this.#position.toBottomLeft(element, margin)

    /**
     * Positions the widget at the bottom-right of its container.
     * @param {HTMLElement} element - The DOM element to position
     * @param {number} [margin=0] - Margin to apply
     * @returns {Object} New position object
     */
    toBottomRight = (element, margin = 0) => this.#position.toBottomRight(element, margin)

    /**
     * Handles the end of a resize event.
     * @param {Object} event - Resize event
     */
    onResizeEnd = event => this.#resizable.onResizeEnd(event)

    /**
     * Updates the crop zone ratio and dimensions.
     * @param {string} cropzoneId - The crop zone ID
     * @param {string} value - The crop zone value, widthxheight, ie 16x9
     * @param {number} aspectRatio - The new aspect ratio
     * @param {boolean} lockRatio - Whether to lock the ratio
     */
    updateCropRatio = (cropzoneId, value, aspectRatio, lockRatio) => this.#cropper.updateCropRatio(cropzoneId, value, aspectRatio, lockRatio)

    /**
     * Computes crop dimensions.
     * @param {Object} config - Widget configuration
     * @param {boolean} maximize - Whether to maximize crop
     * @returns {Object} Crop dimensions
     */
    cropDimensions = (config, maximize = false) => this.#cropper.cropDimensions(config, maximize)

    /**
     * Creates a clip path for the overlay based on crop dimensions.
     * @param {Object} crop - Crop dimensions object
     * @returns {string} CSS clip-path string
     */
    openWindowInOverlay = crop => this.#cropper.openWindowInOverlay(crop)

    /**
     * Retrieves widget position from the widget DB if not expired.
     * @param {string} widgetId - The widget ID
     * @returns {Promise<Object|null>} Position data or null if not found/expired
     */
    getWidgetPosition = async widgetId => this.#widgetDB.getWidgetPosition(widgetId)

    /**
     * Retrieves all widget positions for a given group from IndexedDB if not expired.
     * @param {string} groupId - The group ID
     * @returns {Promise<Object[]>} Array of position data for the group
     */
    getWidgetsByGroup = async groupId => this.#widgetDB.getWidgetsByGroup(groupId)

    /**
     * Deletes all widget positions for a given group from IndexedDB.
     * @param {string} groupId - The group ID
     * @returns {Promise<void>}
     */
    deleteWidgetsByGroup = async groupId => this.#widgetDB.deleteWidgetsByGroup(groupId)

    /**
     * Deletes a single widget position from the widgets DB.
     * @param {string} widgetId - The widget ID
     * @returns {Promise<void>}
     */
    deleteWidgetPosition = async widgetId => this.#widgetDB.deleteWidgetPosition(widgetId)

    /**
     * Retrieves the moveable reference for an element ID.
     * @param {string} elementId - The element ID
     * @returns {Object|undefined} Moveable reference or undefined if not found
     */
    getMoveable = elementId => this.#core.getMoveable(elementId)

    /**
     * Sets the moveable reference for an element ID.
     * @param {string} elementId - The element ID
     * @param {Object} moveable - Moveable instance reference
     */
    setMoveable = (elementId, moveable) => this.#core.setMoveable(elementId, moveable)

    /**
     * Removes the moveable instance for an element ID from the moveables Map.
     * @param {string} elementId - The element ID
     */
    removeMoveable = elementId => this.#core.removeMoveable(elementId)

    /**
     * Constrains position within container bounds
     *
     * @param container {width,height} - Container dimensions
     * @param config - Widget configuration
     * @return {*|{x: *, y: *}|{x: *, y: *}} - scale
     * @return {{left: *, top: *}}
     */
    adaptPositionToContainer = (config, container) => this.#core.adaptPositionToContainer(config, container)

    /**
     * Adapts widget size to container size. It provides a new scale value.
     *
     * @param container{width,height} - Container dimensions
     * @param config - Widget configuration
     * @return {*|{x: *, y: *}|{x: *, y: *}} - scale
     */
    adaptScaleToContainer = (container, config) => this.#core.adaptScaleToContainer(container, config)

    /**
     * Builds a transform string from individual transformation values.
     * @param {Object} transforms - Object containing translate, scale, rotate values
     * @returns {string} CSS transform string
     */
    buildTransform = transforms => this.#transform.buildTransform(transforms)
    /**
     * Gets the current transform values for a widget.
     * @param {HTMLElement} element - The DOM element
     * @returns {Object} Object containing translate, scale, rotate values
     */
    getTransform = element => this.#transform.getTransform(element)

    /**
     * Parses a transform string and extracts individual transformations.
     * @param {string} transformString - The CSS transform string
     * @returns {Object} Object containing translate, scale, rotate values
     */
    parseTransform = transformString => this.#transform.parseTransform(transformString)

    /**
     * Updates the scale values in the widget's transform.
     * @param {HTMLElement} element - The DOM element
     * @param {number} x - X scale value
     * @param {number} y - Y scale value
     */
    setScale = (element, x, y) => this.#transform.setScale(element, x, y)

    /**
     * Updates the translate values in the widget's transform.
     * @param {HTMLElement} element - The DOM element
     * @param {number} x - X translation value
     * @param {number} y - Y translation value
     */
    setTranslate = (element, x, y) => this.#transform.setTranslate(element, x, y)
    /**
     * Returns CSS-compatible transformOrigin numbers based on a Moveable direction vector.
     *
     * @param {number} dx - Horizontal direction (-1 = left, 0 = center, 1 = right)
     * @param {number} dy - Vertical direction (-1 = top, 0 = center, 1 = bottom)
     *
     * @returns {x,y} - Numbers representing the transform origin in percentage format (e.g., '0%','100%').
     */
    getTransformOriginFromDirection = (dx, dy) => this.#transform.getTransformOriginFromDirection(dx, dy)

    /**
     * Returns the transform-origin of a DOM element as an object { x, y }.
     * By default, values are returned as percentages relative to the element's size.
     * If `inPixel` is true, values are returned in absolute pixels.
     *
     * @param {HTMLElement} element - The target DOM element.
     * @param {boolean} [inPixel=false] - Whether to return values in pixels instead of percentages.
     * @returns {{x: number, y: number}} An object representing the transform origin.
     *   - If `inPixel` is false: x and y are percentages (0–100).
     *   - If `inPixel` is true: x and y are pixel offsets from the top-left corner.
     */
    getTransformOrigin = (element, inPixel = false) => this.#transform.getTransformOrigin(element, inPixel)

    /**
     * Sets the transform-origin of a DOM element using string values like '50%' or '120px'.
     *
     * @param {HTMLElement} element - The target DOM element.
     * @param {{x: string, y: string}} origin - The origin point to set.
     *   - `x` and `y` must be valid CSS length strings (e.g., '50%', '120px').
     */
    setTransformOrigin = (element, origin) => this.#transform.setTransformOrigin(element, origin)

    /**
     * Converts a transform-origin string object into pixel coordinates based on an element's size.
     *
     * @param {{x: string, y: string}} origin - The transform origin as CSS strings (e.g. '50%', '120px').
     * @param {DOMRect} rect - The bounding rectangle of the element (from getBoundingClientRect).
     * @returns {{x: number, y: number}} The transform origin in pixels.
     */
    getTransformOriginFromString = (origin, rect) => this.#transform.getTransformOriginFromString(origin, rect)
}