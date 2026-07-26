/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WidgetManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Singleton class acting as an interface for managing draggable and resizable widgets.
 * Delegates functionality to specialized classes.
 */
import {
    CAMERA_INFORMATION_WIDGET, JOURNEY_EDITOR_DRAWER, JOURNEY_TOOLBAR_WIDGET, PROFILE_WIDGET, SCENE_WIDGETS_BOARD,
    VIDEO_WIDGETS_BOARD, WIDGET_EDITOR_POST_RENDER_EVENT, WIDGET_EDITOR_PRE_RENDER_EVENT, WIDGETS_EDITOR_DRAWER,
}                                from '@Core/constants'
import { Export }                from '@Core/ui/Export'
import { WidgetDynamicRenderer } from '@Core/ui/widget-manager/dynamic-render/WidgetDynamicRender'
import { WidgetDBManager }       from '@Core/ui/widget-manager/WidgetDBManager'
import { WidgetRotatable }       from '@Core/ui/widget-manager/WidgetRotatable'
import { UIToast }               from '@Utils/UIToast'
import { WidgetCoreControls }    from './WidgetCoreControls'
import { WidgetCoreRegistry }    from './WidgetCoreRegistry'
import { WidgetCropper }         from './WidgetCropper'
import { WidgetDraggable }       from './WidgetDraggable'
import { WidgetPosition }        from './WidgetPosition'
import { WidgetResizable }       from './WidgetResizable'
import { WidgetScalable }        from './WidgetScalable'
import { WidgetTransform }       from './WidgetTransform'

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

    /** @type {WidgetRotatable} Instance of WidgetRotatable */
    #rotatable

    /** @type {WidgetTransform} Instance of WidgetTransform */
    #transform

    /** @type {WidgetPosition} Instance of WidgetPosition */
    #position

    /** @type {WidgetCoreRegistry} Instance of WidgetCoreRegistry */
    #registry

    /** @type {WidgetCoreControls} Instance of WidgetCoreControls */
    #controls

    WIDGET_RENDERED_EVENT = 'widget-rendered'
    ALL_WIDGETS_RENDERED_EVENT = 'all-widgets-rendered'
    WIDGET_NOT_MOUNTED = 'widget-not-mounted'

    /**
     * Creates or returns the singleton instance of WidgetManager.
     * @param {Object} store - Application store
     */
    constructor() {
        if (WidgetManager.#instance) {
            return WidgetManager.#instance
        }
        this.#widgetDB = new WidgetDBManager(this)
        this.#transform = new WidgetTransform(this)
        this.#cropper = new WidgetCropper(this)
        this.#draggable = new WidgetDraggable(this, this.#cropper, this.#transform)
        this.#resizable = new WidgetResizable(this, this.#cropper)
        this.#scalable = new WidgetScalable(this, this.#cropper, this.#transform)
        this.#rotatable = new WidgetRotatable(this, this.#transform)
        this.#position = new WidgetPosition(this)
        this.#registry = new WidgetCoreRegistry()
        this.#controls = new WidgetCoreControls(this.#registry)
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
     * Getter for isResizing property
     * @returns {boolean} Whether a widget is being resized
     */
    get isResizing() {
        return this.#registry.isResizing
    }

    /**
     * Setter for isResizing property
     * @param {boolean} value - New value for isResizing
     */
    set isResizing(value) {
        this.#registry.isResizing = value
    }

    /**
     * Getter for isDragging property
     * @returns {boolean} Whether a widget is being dragged
     */
    get isDragging() {
        return this.#registry.isDragging
    }

    /**
     * Setter for isDragging property
     * @param {boolean} value - New value for isDragging
     */
    set isDragging(value) {
        this.#registry.isDragging = value
    }

    /**
     * Getter for windowResizing property
     * @returns {boolean} Whether window resizing has an impact
     */
    get windowResizing() {
        return this.#registry.windowResizing
    }

    /**
     * Setter for windowResizing property
     * @param {boolean} value - New value for windowResizing
     */
    set windowResizing(value) {
        this.#registry.windowResizing = value
    }

    /**
     * Getter for widgets list property
     * @returns {[]} List of widget elements
     */
    get widgets() {
        return this.#registry.widgets
    }

    /**
     * Getter for isScaling property
     * @returns {boolean} Whether a widget is being scaled
     */
    get isScaling() {
        return this.#registry.isScaling
    }

    /**
     * Setter for isScaling property
     * @param {boolean} value - New value for isScaling
     */
    set isScaling(value) {
        this.#registry.isScaling = value
    }

    /**
     * Getter used to retrieves the widget ID key.
     * @returns {string} The widget ID key
     */
    get widgetIDKey() {
        return this.#registry.getWidgetIDKey()
    }

    /**
     * Retrieves the element ID from its data attribute.
     * @param {HTMLElement} element - The DOM element
     * @returns {string|null} The element's ID or null if not found
     */
    retrieveElementId = element => this.#registry.retrieveElementId(element)

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
        await this.#controls.setupElement(element, initialConfig, setBounds, setPosition, moveable)

    /**
     * Applies position to an element, updating its style and configuration.
     * @param {HTMLElement} element - The DOM element
     * @param {Object|string} position - Position object or transform string
     * @param {Object} moveable - Moveable instance
     * @param {boolean} isDragging - Whether element is being dragged
     * @param {Function} setControlBoxProps - Function to set control box properties
     */
    applyPosition = (element, position, moveable, isDragging, setControlBoxProps) =>
        this.#controls.applyPosition(element, position, moveable, isDragging, setControlBoxProps)

    /**
     * Manages the visibility of the control box.
     * @param {Object} moveable - Moveable instance
     * @param {Function} setControlBoxProps - Function to set control box properties
     * @param {Object} _controlBoxTimer - Timer reference
     * @param {boolean} show - Whether to show the control box
     * @param {boolean} isMouseOver - Whether mouse is over the element
     */
    manageControlBox = (moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver) =>
        this.#controls.manageControlBox(moveable, setControlBoxProps, _controlBoxTimer, show, isMouseOver)

    /**
     * Retrieves video format ratio configuration.
     * @param {string} ratio - Ratio identifier (e.g., '16x9')
     * @returns {Object} Ratio configuration object
     */
    getRatio = ratio => this.#registry.getRatio(ratio)

    /**
     * Computes initial position for a widget based on configuration.
     * @param {Object} config - Widget configuration
     * @param {HTMLElement} element - The DOM element
     * @param {boolean} isResize - Whether this is a resize operation
     * @returns {Object} Position object with left and top coordinates
     */
    computeInitialPosition = (config, element, isResize = false) =>
        this.#controls.computeInitialPosition(config, element, isResize)

    /**
     * Refreshes container bounds based on current container size.
     * @param {Object} config - Widget configuration
     * @param {Object} moveable - Moveable instance
     * @returns {Object} Updated bounds object
     */
    refreshBounds = (config, moveable) => this.#controls.refreshBounds(config, moveable)

    /**
     * Handles drag events, updating crop overlay in real-time.
     * @param {Object} event - Drag event from Moveable
     */
    onDrag = event => this.#draggable.onDrag(event)

    /**
     * Sets boundary status indicating if widget touches container edges.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} config - Widget configuration
     * @returns {Object} Boundary status object
     */
    setBoundStatus = (element, config) => this.#controls.setBoundStatus(element, config)

    /**
     * Retrieves widget configuration by element ID.
     * @param {string} elementId - The element ID
     * @returns {Object|undefined} Widget configuration or undefined if not found
     */
    getWidgetConfig = elementId => this.#registry.getWidgetConfig(elementId)

    /**
     * Retrieves the widget element by ID.
     * @param {string} id - The widget ID
     * @returns {HTMLElement|null} The DOM element or null if not found
     */
    getElementById = id => this.#registry.getElementById(id)

    /**
     * Resolves the DOM element used as the positioning reference for a widgets board.
     * Positions are stored relative to the board itself.
     *
     * @param {string|null|undefined} widgetsBoard
     * @returns {HTMLElement|null}
     */
    resolveWidgetsBoardReferenceContainer = (widgetsBoard) => this.resolveWidgetsBoardBoundsContainer(widgetsBoard)

    /**
     * Resolves the DOM element used as bounds / clipping reference for a widgets board.
     * Scene widgets are bounded by the scene canvas. Board widgets are bounded by their own `.defined` area.
     *
     * @param {string|null|undefined} widgetsBoard
     * @returns {HTMLElement|null}
     */
    resolveWidgetsBoardBoundsContainer = (widgetsBoard) => {
        if (!widgetsBoard || widgetsBoard === SCENE_WIDGETS_BOARD) {
            return lgs.canvas ?? null
        }

        if (typeof document === 'undefined') {
            return null
        }

        const definedBoard = document.querySelector(`#${widgetsBoard}.defined`)
        if (definedBoard) {
            return definedBoard
        }

        if (widgetsBoard === VIDEO_WIDGETS_BOARD) {
            return document.querySelector(`[data-widget="${widgetsBoard}"] .lgs-widget`)
                ?? document.querySelector(`[data-widget^="${widgetsBoard}#"] .lgs-widget`)
                ?? null
        }

        return document.querySelector(`[data-widget-id="${widgetsBoard}"] .crop-zone`)
    }

    /**
     * Backward-compatible alias for bounds resolution.
     *
     * @param {string|null|undefined} widgetsBoard
     * @returns {HTMLElement|null}
     */
    resolveWidgetsBoardContainer = (widgetsBoard) => this.resolveWidgetsBoardBoundsContainer(widgetsBoard)

    /**
     * Retrieves the widget ID from an element.
     * @param {HTMLElement} element - The DOM element
     * @returns {string|null} The widget ID or null if not found
     */
    getIdFromElement = element => this.#registry.getIdFromElement(element)

    /**
     * Retrieves the inner overlay element for a widget.
     * @param {HTMLElement} element - The DOM element
     * @returns {HTMLElement|undefined} Overlay element or undefined
     */
    getInnerOverlay = element => this.#registry.getInnerOverlay(element)

    /**
     * Sets widget configuration for an element ID.
     * @param {string} elementId - The element ID
     * @param {Object} config - Widget configuration
     */
    setConfig = (elementId, config) => this.#registry.setConfig(elementId, config)

    /**
     * Retrieves widget configurations by group ID.
     * @param {string} groupId - The group identifier
     * @returns {Object[]} Array of widget configurations
     */
    getWidgetConfigByGroup = groupId => this.#registry.getWidgetConfigByGroup(groupId)

    /**
     * Disposes a single widget element, cleaning up resources.
     * @param {HTMLElement} element - The DOM element
     */
    disposeElement = element => this.#registry.disposeElement(element)

    /**
     * Disposes all widgets in a group, respecting persist flag.
     * @param {string} groupId - The group identifier
     * @param {boolean} usePersist - Whether to respect persist flag
     */
    disposeByGroup = (groupId, usePersist = false) => this.#registry.disposeByGroup(groupId, usePersist)

    /**
     * Invalidates the runtime state of all widgets attached to a board without deleting persistence.
     * @param {string} widgetsBoard
     * @returns {number}
     */
    invalidateRuntimeByBoard = widgetsBoard => this.#registry.invalidateRuntimeByBoard(widgetsBoard)

    /**
     * Monitors container resize events and updates widget bounds and position.
     * @param {Object} config - Widget configuration
     * @param {Function} setBounds - Function to update bounds
     * @param {Object} moveable - Moveable instance
     * @param {HTMLElement} element - The DOM element
     * @param {Function} setPosition - Function to set position
     */
    monitorContainerResize = (config, setBounds, moveable, element, setPosition) =>
        this.#controls.monitorContainerResize(config, setBounds, moveable, element, setPosition)

    /**
     * Repositions widgets attached to a board after that board changes size.
     * @param {string} widgetsBoard
     * @param {DOMRect|Object} nextBoardRect
     * @param {DOMRect|Object} previousBoardRect
     * @returns {number}
     */
    repositionWidgetsForBoard = (widgetsBoard, nextBoardRect = null, previousBoardRect = null) =>
        this.#controls.repositionWidgetsForBoard(widgetsBoard, nextBoardRect, previousBoardRect)

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
     * Creates a perfect 1:1 clone of an element
     * - Identical DOM structure
     * - Identical class list
     * - Identical inline styles
     * - Identical computed styles
     *
     * The clone has the additional class lgs-widget-clone
     *
     * @param {HTMLElement} element Source element
     * @returns {HTMLElement} Perfect clone
     */
    clone = (element) => this.#controls.clone(element)

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
    defineElementId = (group, id = null) => this.#registry.defineElementId(group, id)

    /**
     * Clones a context menu configuration object by ensuring all expected boolean attributes are defined.
     * If an attribute is missing in the source object, it will be set to false in the clone.
     *
     * @param {Object} source - The object to clone.
     * @param {string[]} attrs - List of expected boolean attribute names.
     * @returns {Object} A new object with all attributes from `attrs`, defaulting to false if undefined in `source`.
     */
    cloneContext = (source, attrs) => this.#registry.cloneContext(source, attrs)

    /**
     * Checks whether at least one of the specified capability attributes is truthy in the source object.
     *
     * @param {Object} source - The object to inspect.
     * @param {string[]} attrs - List of capability attribute names to check.
     * @returns {boolean} True if at least one attribute is truthy in `source`, otherwise false.
     */
    hasCapabilities = (source, attrs) => this.#registry.hasCapabilities(source, attrs)

    /**
     * Retrieves or creates widget configuration for an element, including saved positions from browser DB.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} initialConfig - Initial configuration
     * @returns {Promise<Object>} Widget configuration
     */
    retrieveConfig = async (element, initialConfig) => this.#registry.retrieveConfig(element, initialConfig)
    /**
     * Counts the instances of a widget that are present for a given group.
     * The count is based on the widget ID (i.e. the left part before #).
     *
     * @param group - group id
     * @param widget - widget id
     * @returns {number} number of instances
     *
     */
    countWidgets = (group, widget, widgetsBoard = undefined) => this.#registry.countWidgets(group, widget, widgetsBoard)
    /**
     * Checks if a widget has reached its maximum allowed instances.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {boolean} True if the max is reached, false otherwise.
     */
    isMaxWidgetsReached = (group, widget, widgetsBoard = undefined) => this.#registry.isMaxWidgetsReached(group, widget, widgetsBoard)
    /**
     * Returns maximum allowed widget instances.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {number} the maximum  allowed instances
     */
    maxWidgets = (group, widget, widgetsBoard = undefined) => this.#registry.maxWidgets(group, widget, widgetsBoard)

    /**
     * Applies crop dimensions to the overlay element.
     * @param {Object} config - Widget configuration
     */

    /**
     * Checks how many instances of a widget remain for a given group.
     *
     * @param {string} group - Group ID.
     * @param {string} widget - Widget ID (can include ID prefixed, e.g., 'myWidget#uuid').
     * @returns {number} The remaining number of instances.
     */
    remainingWidgets = (group, widget, widgetsBoard = undefined) => this.#registry.remainingWidgets(group, widget, widgetsBoard)

    applyCropToOverlay = config => this.#cropper.applyCropToOverlay(config)

    /**
     * Synchronizes crop dimensions from the rendered DOM element.
     * @param {string} cropzoneId - Crop zone identifier
     * @param {boolean} persist - Whether to persist the synced crop after update
     * @param {string} phase - Crop update phase label
     * @returns {Promise<Object|null>}
     */
    syncCropDimensionsFromElement = async (cropzoneId, persist = false, phase = 'sync') =>
        await this.#cropper.syncCropDimensionsFromElement(cropzoneId, persist, phase)

    /**
     * Saves widget position and dimensions to the widgets DB.
     *
     * @param {string} widgetId - The widget ID
     * @param {Object} config - Widget configuration
     * @param preparation
     * @returns {Promise<void>}
     */
    saveWidgetPosition = async (widgetId, config, preparation = true) => {

        const positionData = preparation
                             ? this.#registry.preparePositionDataForStorage(widgetId, config)
                             : config
        if (!positionData) {
            return
        }
        await this.#widgetDB.saveWidgetPosition(widgetId, positionData)

    }

    /**
     * Refreshes the editor preview background when the edited widget moved.
     * @param {string} widgetId - The widget ID
     */
    refreshEditorPreviewSnapshot = (widgetId) => {
        if (!widgetId || typeof window === 'undefined') {
            return
        }

        const isRelevantEditor = () => {
            const drawers = lgs.stores?.ui?.drawers
            const widgetType = widgetId.split('#')[0]

            return (drawers?.open === WIDGETS_EDITOR_DRAWER && drawers.entity === widgetId) ||
                (drawers?.open === JOURNEY_EDITOR_DRAWER && widgetType === PROFILE_WIDGET)
        }

        if (!isRelevantEditor()) {
            return
        }

        const dispatch = () => {
            if (!isRelevantEditor()) {
                return
            }

            window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_PRE_RENDER_EVENT, {
                detail: {entity: widgetId},
            }))
        }

        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(dispatch)
            return
        }

        dispatch()
    }
    /**
     * Checks whether a widget can be snapped from the scene.
     *
     * @param {string|null|undefined} widgetId - The widget ID
     * @returns {boolean} True if the widget can be snapped
     */
    canSnapshotWidget = (widgetId) => {
        if (!widgetId) {
            return false
        }
        const config = this.getWidgetConfig(widgetId)
        return Boolean(config?.contextMenu?.canSnapshot && this.getElementById(widgetId))
    }
    /**
     * Checks whether a widget can be removed from the scene.
     *
     * @param {string|null|undefined} widgetId - The widget ID
     * @returns {boolean} True if the widget can be removed
     */
    canRemoveWidget = (widgetId) => {
        if (!widgetId) {
            return false
        }
        const config = this.getWidgetConfig(widgetId)
        return Boolean(config?.contextMenu?.canRemove && this.getElementById(widgetId))
    }

    /**
     * Checks whether a widget can be edited.
     *
     * @param {string|null|undefined} widgetId - The widget ID
     * @returns {boolean} True if the widget editor can be opened
     */
    canEditWidget = (widgetId) => {
        if (!widgetId) {
            return false
        }
        const config = this.getWidgetConfig(widgetId)
        return Boolean(config?.contextMenu?.canEdit && this.getElementById(widgetId))
    }

    /**
     * Opens or toggles the editor drawer for a widget.
     *
     * @param {string|null|undefined} widgetId - The widget ID
     * @param {Object} [options] - Editor options
     * @param {boolean} [options.toggle=false] - Close the editor if it is already editing this widget
     * @returns {boolean} True when the widget was editable
     */
    editWidget = (widgetId, options = {}) => {
        if (!this.canEditWidget(widgetId)) {
            return false
        }

        const {toggle = false, stacked = false} = options
        const drawers = lgs.stores?.ui?.drawers
        const isCurrentlyEditing = drawers?.open === WIDGETS_EDITOR_DRAWER && drawers.entity === widgetId

        const currentRotation = lgs.stores.ui.widget.current?.id === widgetId
                                ? Number(lgs.stores.ui.widget.current?.rotate)
                                : Number.NaN
        const configRotation = Number(this.getWidgetConfig(widgetId)?.rotate)
        lgs.stores.ui.widget.current = {
            ...(lgs.stores.ui.widget.current ?? {}),
            id: widgetId,
            rotate: Number.isFinite(currentRotation)
                    ? currentRotation
                    : (Number.isFinite(configRotation) ? configRotation : 0),
        }

        if (isCurrentlyEditing) {
            if (toggle) {
                __.ui.drawerManager?.close?.()
            }
            return true
        }

        window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_PRE_RENDER_EVENT, {
            detail: {entity: widgetId},
        }))
        __.ui.drawerManager.open(WIDGETS_EDITOR_DRAWER, {
            action: 'edit-current',
            entity: widgetId,
            stacked,
        })
        window.dispatchEvent(new CustomEvent(WIDGET_EDITOR_POST_RENDER_EVENT, {
            detail: {entity: widgetId},
        }))

        return true
    }

    /**
     * Opens or toggles the editor drawer for a widget.
     *
     * @param {string|null|undefined} widgetId - The widget ID
     * @returns {boolean} True when the widget was snapped
     */
    snapWidget = (widgetId) => {
        if (!widgetId || !this.canSnapshotWidget(widgetId)) {
            return false
        }
        const cached = lgs.stores.ui.widget.cache.get(widgetId)
        const theWidget = __.widgets.get(cached.group).widgets.get(widgetId.split('#')[0])

        const _name = `${lgs.theJourney.title} - ${theWidget.name}`
        Export.toPNG(document.querySelector(`[data-widget-id="${widgetId}"]`), _name, 2).then(() => {
            UIToast.success({caption: 'Export success', text: `Exported to ${_name}.png`})
        })
        return true
    }

    /**
     * Removes a widget and cleans up the related UI state.
     *
     * @param {string|null|undefined} widgetId - The widget ID
     * @returns {Promise<boolean>} True when a widget was removed
     */
    removeWidget = async (widgetId) => {
        if (!this.canRemoveWidget(widgetId)) {
            return false
        }

        const element = this.getElementById(widgetId)
        const type = widgetId.split('#')[0]

        WidgetDynamicRenderer.instance.destroyWidget(widgetId)

        const cameraSettings = lgs.settings?.ui?.camera
        if (type === CAMERA_INFORMATION_WIDGET && cameraSettings) {
            cameraSettings.showPosition = false
            cameraSettings.showHPR = false
            cameraSettings.showTargetPosition = false
        }

        if (type === JOURNEY_TOOLBAR_WIDGET && lgs.settings?.ui?.journeyToolbar) {
            lgs.settings.ui.journeyToolbar.show = false
        }

        const elements = lgs.settings?.widgets?.[type]?.configuration?.elements
        if (elements && Object.prototype.hasOwnProperty.call(elements, widgetId)) {
            delete elements[widgetId]
        }

        if (element) {
            await this.disposeElement(element)
        }

        const drawers = lgs.stores?.ui?.drawers
        if (drawers?.open === WIDGETS_EDITOR_DRAWER && drawers.entity === widgetId) {
            __.ui.drawerManager?.close?.()
        }

        if (lgs.stores?.ui?.widget?.current?.id === widgetId) {
            lgs.stores.ui.widget.current = {id: null}
        }

        if (lgs.stores?.ui?.contextMenu?.targetId === widgetId) {
            __.ui.contextMenu?.hide?.()
        }

        return true
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
     * Dispatches a crop update event to listeners.
     * @param {Object} config - Widget configuration
     * @param {string} phase - Update phase
     */
    dispatchCropUpdate = (config, phase) => this.#cropper.dispatchCropUpdate(config, phase)

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
     * Rehydrates all persisted widgets mounted on a specific board from IndexedDB.
     * This is used when a board is reused between sessions and the in-memory runtime
     * state has stale positions.
     *
     * @param {string} widgetsBoard
     * @returns {Promise<number>} Number of refreshed widgets
     */
    rehydrateWidgetsByBoard = async (widgetsBoard) => {
        if (!widgetsBoard) {
            return 0
        }

        const referenceContainer = this.resolveWidgetsBoardReferenceContainer(widgetsBoard)
        if (!referenceContainer) {
            return 0
        }

        const referenceRect = referenceContainer.getBoundingClientRect?.()
        if (!referenceRect || referenceRect.width <= 0 || referenceRect.height <= 0) {
            return 0
        }

        const entries = [...lgs.stores.ui.widget.list.entries()]
            .filter(([, entry]) => entry?.widgetsBoard === widgetsBoard)

        let refreshed = 0
        for (const [widgetId, entry] of entries) {
            const config = this.getWidgetConfig(widgetId)
            const element = this.getElementById(widgetId)
            const saved = await this.getWidgetPosition(widgetId)
            if (!config || !element || !saved) {
                continue
            }

            const width = Number.isFinite(saved.width)
                          ? saved.width
                          : (Number.isFinite(config.dimensions?.width) ? config.dimensions.width : element.getBoundingClientRect().width)
            const height = Number.isFinite(saved.height)
                           ? saved.height
                           : (Number.isFinite(config.dimensions?.height) ? config.dimensions.height : element.getBoundingClientRect().height)
            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                continue
            }

            const hasRatios = Number.isFinite(saved.leftRatio) && Number.isFinite(saved.topRatio)
            const left = hasRatios
                         ? referenceRect.left + ((saved.leftRatio / 100) * referenceRect.width) - (width / 2)
                         : referenceRect.left + (Number.isFinite(saved.left) ? saved.left : 0)
            const top = hasRatios
                        ? referenceRect.top + ((saved.topRatio / 100) * referenceRect.height) - (height / 2)
                        : referenceRect.top + (Number.isFinite(saved.top) ? saved.top : 0)

            config.container = referenceContainer
            config.boundsContainer = referenceContainer
            config.element = element
            config.fromDB = true
            config.fromRuntime = false
            config.runtimeReady = true
            config.savedRatios = hasRatios
                                 ? {leftRatio: saved.leftRatio, topRatio: saved.topRatio}
                                 : config.savedRatios
            config.position = {left, top}
            if (config.isCropper) {
                config.cropDimensions = {left, top, width, height}
            }
            else {
                config.dimensions = {width, height}
                const savedScale = saved.scale
                const scaleX = Number(savedScale?.x)
                const scaleY = Number(savedScale?.y)
                config.scale = Number.isFinite(scaleX) && scaleX > 0 && Number.isFinite(scaleY) && scaleY > 0
                    ? {x: scaleX, y: scaleY}
                    : config.scale ?? {x: 1, y: 1}
            }

            element.style.left = `${left}px`
            element.style.top = `${top}px`
            element.style.width = `${width}px`
            element.style.height = `${height}px`
            if (!config.isCropper) {
                this.setScale(element, config.scale.x, config.scale.y)
            }

            const moveable = this.getMoveable(widgetId)
            moveable?.current?.updateRect?.()
            config.setPosition?.(config.position)
            if (config.isCropper) {
                this.#cropper.applyCropToOverlay(config)
            }

            lgs.stores.ui.widget.list.set(widgetId, {
                ...entry,
                ...saved,
                widgetsBoard,
                left,
                top,
                width,
                height,
            })

            refreshed += 1
        }

        // Widgets may be mounted after the crop update event. Re-run the board
        // layout after the complete video board has been rehydrated. The
        // repositioner accepts cropDimensions in the crop container's local
        // coordinate system; referenceRect is an on-screen rectangle and must
        // not be passed as if it were cropDimensions (that double-counts the
        // crop offset and clamps widgets into corners).
        this.repositionWidgetsForBoard(widgetsBoard)

        return refreshed
    }

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
    getMoveable = elementId => this.#registry.getMoveable(elementId)

    /**
     * Sets the moveable reference for an element ID.
     * @param {string} elementId - The element ID
     * @param {Object} moveable - Moveable instance reference
     */
    setMoveable = (elementId, moveable) => this.#registry.setMoveable(elementId, moveable)

    /**
     * Removes the moveable instance for an element ID from the moveables Map.
     * @param {string} elementId - The element ID
     */
    removeMoveable = elementId => this.#registry.removeMoveable(elementId)

    /**
     * Constrains position within container bounds
     *
     * @param container {width,height} - Container dimensions
     * @param config - Widget configuration
     * @return {*|{x: *, y: *}|{x: *, y: *}} - scale
     * @return {{left: *, top: *}}
     */
    adaptPositionToContainer = (config, container) => this.#controls.adaptPositionToContainer(config, container)

    /**
     * Adapts widget size to container size. It provides a new scale value.
     *
     * @param container{width,height} - Container dimensions
     * @param config - Widget configuration
     * @return {*|{x: *, y: *}|{x: *, y: *}} - scale
     */
    adaptScaleToContainer = (config, container) => this.#controls.adaptScaleToContainer(config, container)

    /**
     * Calculates logical shadow margins for the composer.
     * No scale needed here as addOverlay handles it internally.
     * * @param {number} x - Offset X (e.g., 0)
     * @param {number} y - Offset Y (e.g., 1)
     * @param {number} blur - Blur radius (e.g., 2)
     * @param {number} [spread=0] - Spread radius
     * @returns {Object} { top, right, bottom, left }
     */
    getShadowMargins = (x, y, blur, spread = 0) => this.#controls.getShadowMargins(x, y, blur, spread)

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
     * Updates multiple transform values at once and applies them to the element.
     * Useful for batch updates or complex operations like combined scaling and rotation.
     * * @param {HTMLElement} element - The DOM element.
     * @param {Object} transforms - The transform values to update.
     * @param {Object} [transforms.translate] - Optional translate {x, y}.
     * @param {Object} [transforms.scale] - Optional scale {x, y}.
     * @param {number} [transforms.rotate] - Optional rotation in degrees.
     */
    setTransform = (element, transforms) => this.#transform.setTransform(element, transforms)

    /**
     * Updates the scale values in the widget's transform.
     * @param {HTMLElement} element - The DOM element
     * @param {number} x - X scale value
     * @param {number} y - Y scale value
     */
    setScale = (element, x, y) => this.#transform.setScale(element, x, y)

    /**
     * Publishes widget scale CSS variables and change events for inner renderers.
     * @param {HTMLElement} element - The DOM element
     * @param {Object} scale - Scale object {x, y}
     */
    applyScaleVariables = (element, scale) => this.#transform.applyScaleVariables(element, scale)

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

    /**
     * Handles rotation interaction.
     * @param {Object} event - Moveable rotate event
     * @param {Object} refs - Object containing references like _prevRotate
     */
    onRotate = (event, refs) => this.#rotatable.onRotate(event, refs)

    /**
     * Handles the end of a rotation event.
     * @param {Object} event - Moveable rotateEnd event
     */
    onRotateEnd = event => this.#rotatable.onRotateEnd(event)

    /**
     * Handles the start of a rotation event.
     * @param {Object} event - Moveable rotateStart event
     */
    onRotateStart = event => this.#rotatable.onRotateStart(event)
}
