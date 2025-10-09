/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Widget.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-09
 * Last modified: 2025-10-09
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { LGS_WIDGET }    from '@Core/constants'
/**
 * Widget - A lightweight class for a positionable, draggable, resizable, and rotatable widget
 * @class
 */
import { v4 as uuidv4 }  from 'uuid'
import { WidgetManager } from './WidgetManager.js'

export class Widget {
    #id
    #element
    #snapDom
    #settingsElement
    #config
    #widgetManager
    #validPositions = ['center', 'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']

    /**
     * Creates a new Widget instance
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.element - The DOM element for the widget
     * @param {string} [options.position='center'] - Initial position
     * @param {number} [options.minWidth=100] - Minimum width in pixels
     * @param {number} [options.minHeight=100] - Minimum height in pixels
     * @param {number} [options.maxWidth=1000] - Maximum width in pixels
     * @param {number} [options.maxHeight=1000] - Maximum height in pixels
     * @param {boolean} [options.required=false] - Whether the widget is required
     * @param {HTMLElement} [options.settingsElement] - DOM element for settings
     * @param {string} [options.id] - Unique identifier
     * @param {HTMLElement} [options.container=document.body] - Container element
     * @param {boolean} [options.resizable=false] - Whether the widget is resizable
     * @param {boolean} [options.snappable=true] - Whether the widget snaps to guidelines
     * @param {Object} [options.snapGrid] - Grid snapping settings {x, y}
     * @param {string} [options.snapSensitivity='medium'] - Snap sensitivity ('low', 'medium', 'high')
     * @param {boolean} [options.animationWhenDragging=false] - Enable dragging animation
     * @param {boolean} [options.animationWhenResizing=false] - Enable resizing animation
     * @param {number} [options.opacity=1] - Widget opacity
     * @param {boolean} [options.resizeFromCenter=false] - Resize from center
     */
    constructor({
                    element,
                    position = 'center',
                    minWidth = 100,
                    minHeight = 100,
                    maxWidth = 1000,
                    maxHeight = 1000,
                    required = false,
                    settingsElement = null,
                    id = uuidv4(),
                    container = document.body,
                    resizable = false,
                    snappable = true,
                    snapGrid = null,
                    snapSensitivity = 'medium',
                    animationWhenDragging = false,
                    animationWhenResizing = false,
                    opacity = 1,
                    resizeFromCenter = false,
                }) {
        if (!element || !(element instanceof HTMLElement)) {
            throw new Error('Valid DOM element is required')
        }
        if (!this.#validPositions.includes(position)) {
            throw new Error(`Invalid position: ${position}. Must be one of ${this.#validPositions.join(', ')}`)
        }

        this.#id = id
        this.#element = element
        this.#settingsElement = settingsElement
        this.#widgetManager = new WidgetManager()
        this.#config = {
            id,
            attachTo:         position,
            minCropSize:      {width: minWidth, height: minHeight},
            required,
            container,
            showControlBox:   true,
            containerPadding: 10,
            isCropper:        false,
            type:             LGS_WIDGET,
            resizable,
            snappable,
            snapGrid,
            snapSensitivity,
            animationWhenDragging,
            animationWhenResizing,
            opacity,
            resizeFromCenter,
        }

        this.#initialize()
    }

    /**
     * Initializes the widget, setting up the DOM and registering with WidgetManager
     */
    #initialize = () => {
        // Set widget ID and class
        this.#element.setAttribute('data-LGS-ID', this.#id)
        this.#element.classList.add(LGS_WIDGET)

        // Create snapshot DOM
        this.#snapDom = this.#element.cloneNode(true)
        this.#snapDom.style.display = 'none'
        this.#element.parentNode.appendChild(this.#snapDom)

        // Set initial styles
        this.#element.style.position = 'absolute'
        this.#element.style.minWidth = `${this.#config.minCropSize.width}px`
        this.#element.style.minHeight = `${this.#config.minCropSize.height}px`
        this.#element.style.maxWidth = `${this.#config.maxWidth}px`
        this.#element.style.maxHeight = `${this.#config.maxHeight}px`
        this.#element.style.opacity = this.#config.opacity

        // Register with WidgetManager
        const setupSuccess = this.#widgetManager.setupElement(
            this.#element,
            this.#config,
            bounds => this.#updateBounds(bounds),
            position => this.#updatePosition(position),
            {current: null}, // Moveable est géré par Widget.jsx
        )

        if (!setupSuccess) {
            throw new Error('Failed to initialize widget with WidgetManager')
        }
    }

    /**
     * Updates widget bounds
     * @param {Object} bounds - New bounds {left, top, right, bottom}
     */
    #updateBounds = bounds => {
        this.#config.bounds = bounds
    }

    /**
     * Updates widget position
     * @param {Object} position - New position {left, top}
     */
    #updatePosition = position => {
        this.#element.style.left = `${position.left}px`
        this.#element.style.top = `${position.top}px`
        this.#config.position = position
    }

    /**
     * Gets the widget's ID
     * @returns {string} The widget's ID
     */
    getId = () => this.#id

    /**
     * Gets the widget's DOM element
     * @returns {HTMLElement} The widget's DOM element
     */
    getElement = () => this.#element

    /**
     * Gets the snapshot DOM element
     * @returns {HTMLElement} The snapshot DOM element
     */
    getSnapDom = () => this.#snapDom

    /**
     * Gets the settings DOM element
     * @returns {HTMLElement|null} The settings DOM element
     */
    getSettingsElement = () => this.#settingsElement

    /**
     * Sets the settings DOM element
     * @param {HTMLElement} element - The settings DOM element
     */
    setSettingsElement = element => {
        if (element && !(element instanceof HTMLElement)) {
            throw new Error('Settings element must be a valid HTMLElement')
        }
        this.#settingsElement = element
    }

    /**
     * Checks if the widget is required
     * @returns {boolean} Whether the widget is required
     */
    isRequired = () => this.#config.required

    /**
     * Disposes the widget, cleaning up resources
     */
    dispose = () => {
        this.#widgetManager.disposeElement(this.#element)
        if (this.#snapDom) {
            this.#snapDom.remove()
        }
    }
}