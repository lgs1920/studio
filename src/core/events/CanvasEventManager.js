/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-08
 * Last modified: 2025-05-08
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DOUBLE_CLICK_TIMEOUT, DOUBLE_TAP_TIMEOUT, EVENTS, LONG_TAP_TIMEOUT } from '@Core/constants'
import { ScreenSpaceEventHandler }                                            from 'cesium'
import { CESIUM_EVENTS, MODIFIER_SEPARATOR, MODIFIERS }                       from './cesiumEvents'

/**
 * Manages canvas events for a Cesium viewer, handling both mouse and touch interactions.
 * Supports modifier keys (Ctrl, Shift, Alt) and formats event names as "<MODIFIER>#<EVENT_TYPE>" (e.g., "CTRL#CLICK").
 * Implements a singleton pattern to ensure a single instance per viewer.
 *
 * @class
 */
export class CanvasEventManager {
    /**
     * Singleton instance of CanvasEventManager.
     * @type {CanvasEventManager|null}
     * @private
     */
    static #instance = null

    /**
     * Event configuration mapping from CESIUM_EVENTS.
     * @type {Object}
     * @private
     */
    #events = CESIUM_EVENTS

    /**
     * The Cesium viewer instance associated with this event manager.
     * @type {Viewer}
     * @private
     */
    #viewer

    /**
     * Map storing event handlers for each event name.
     * @type {Map<string, Array<{handler: Function|Object, callback: Function, options: Object}>>}
     * @private
     */
    #handlers = new Map()

    /**
     * Cesium ScreenSpaceEventHandler for managing canvas input events.
     * @type {ScreenSpaceEventHandler}
     * @private
     */
    #screenSpaceEventHandler

    /**
     * Tracks the state of touch tap events for TAP, DOUBLE_TAP, and LONG_TAP detection.
     * @type {{lastTapTime: number, tapCount: number, isProcessing: boolean, longTapTimer: number|null, suppressTap:
     *     boolean, pendingTap: number|null}}
     * @private
     */
    #tapState = {
        lastTapTime: 0,
        tapCount:    0,
        isProcessing: false,
        longTapTimer: null,
        suppressTap: false,
        pendingTap:  null,
    }

    /**
     * Creates a new CanvasEventManager instance or returns the existing singleton instance.
     * Initializes the Cesium ScreenSpaceEventHandler and sets up touch/mouse event handling.
     *
     * @param {Cesium.Viewer} viewer - The Cesium viewer instance.
     * @throws {Error} If the viewer is invalid or missing required properties.
     */
    constructor(viewer) {
        // Return existing instance if singleton is already initialized
        if (CanvasEventManager.#instance) {
            return CanvasEventManager.#instance
        }

        // Validate viewer
        if (!viewer || !viewer.scene || !viewer.scene.canvas) {
            throw new Error('Invalid viewer: must be a valid Cesium Viewer instance')
        }

        this.#viewer = viewer
        this.#screenSpaceEventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        this.isTouchDevice = this.#isTouchDevice()

        // Prevent context menu on touch devices to avoid unintended RIGHT_CLICK events
        if (this.isTouchDevice) {
            this.#viewer.scene.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
        }

        CanvasEventManager.#instance = this
    }

    /**
     * Detects whether the device supports touch events.
     * Checks for touch support using multiple browser APIs for robustness.
     *
     * @returns {boolean} True if the device supports touch events, false otherwise.
     * @private
     */
    #isTouchDevice() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches
        )
    }

    /**
     * Emits an event by executing all registered callbacks for the specified event name.
     * Validates each handler's entity requirement before executing its callback.
     *
     * @param {string} eventName - The event name (e.g., "CTRL#CLICK", "TAP").
     * @param {Object} event - The Cesium event object.
     * @param {string|null} pickedEntityId - The ID of the picked entity, or null if none.
     * @private
     */
    #emit(eventName, event, pickedEntityId) {
        const handlers = this.#handlers.get(eventName)
        if (handlers) {
            handlers.forEach(({callback, options}) => {
                try {
                    // Validate entity requirement for this handler using #validateEntity
                    const entityId = this.#validateEntity(event, options.entity ?? false, pickedEntityId)
                    if (entityId !== null || options.entity === false) {
                        callback(event, entityId)
                        if (options.once) {
                            this.off(eventName, callback)
                        }
                    }
                }
                catch (error) {
                    console.error(`Error in callback for ${eventName}:`, error)
                }
            })
        }
    }

    /**
     * Checks if a callback is already registered for the specified event name.
     *
     * @param {string} eventName - The event name to check (e.g., "TAP", "DOUBLE_TAP").
     * @param {Function} callback - The callback function to verify.
     * @returns {boolean} True if the callback is registered, false otherwise.
     * @private
     */
    #hasCallback(eventName, callback) {
        if (!this.#handlers.has(eventName)) {
            return false
        }
        return this.#handlers.get(eventName).some((handler) => handler.callback === callback)
    }

    /**
     * Validates the entity based on the entity parameter, optionally using a pre-picked entity ID.
     * @param {Object} event - The Cesium event object (e.g., touch or mouse event).
     * @param {boolean|string|string[]} entity - Entity requirement:
     *   - `false`: Return `null` regardless of clicked entity.
     *   - `'id'`: Return ID only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Return ID only if the clicked entity's ID is in the array.
     *   - `[]`: Return ID only if any entity is clicked.
     * @param {string|null} [pickedEntityId] - Optional pre-picked entity ID to avoid redundant picking.
     * @returns {string|null} The entity ID if valid, null otherwise.
     * @private
     */
    #validateEntity(event, entity, pickedEntityId = null) {
        // Use pre-picked entity ID if provided, otherwise pick the entity
        const entityId = pickedEntityId !== null ? pickedEntityId.id : this.#viewer.scene.pick(event.position)?.id

        // Handle different entity parameter cases
        if (entity === false) {
            return null // Always return null, regardless of entity
        }
        else if (typeof entity === 'string') {
            return entityId === entity ? entityId : null // Only return ID if it matches
        }
        else if (Array.isArray(entity)) {
            if (entity.length === 0) {
                return entityId ? entityId : null // Return ID if any entity is clicked
            }
            else {
                return entity.includes(entityId) ? entityId : null // Return ID if in array
            }
        }

        return null // Default: no emit if entity parameter is invalid
    }

    /**
     * Sets up touch event handling for TAP, DOUBLE_TAP, and LONG_TAP.
     * @param {string} eventType - The event type (e.g., TAP, DOUBLE_TAP, LONG_TAP).
     * @returns {Object} An object containing downHandler and upHandler for touch events.
     * @private
     */
    #setupTouchEvents(eventType) {
        /**
         * Validates touch event conditions and returns the picked entity ID or null.
         * @param {Object} event - The touch event object from Cesium.
         * @returns {string|null} The entity ID if valid, null otherwise.
         * @private
         */
        const validateTouchEvent = (event) => {
            // Check if the event is a touch event or if the device supports touch
            if (event.pointerType !== 'touch' && !this.isTouchDevice) {
                return null
            }
            return this.#viewer.scene.pick(event.position)?.id || null
        }

        // Track the last tap time for double-tap detection
        let lastTapTime = 0
        // Store the TAP timer
        let tapTimeout = null
        // Count consecutive taps
        let tapCount = 0
        // Track the start time of the current tap
        let tapStartTime = 0

        /**
         * Handles the DOWN event for touch interactions.
         * @param {Object} event - The Cesium LEFT_DOWN event.
         */
        const downHandler = (event) => {
            const entityId = validateTouchEvent(event)
            if (entityId === null && !this.#handlers.get(EVENTS.TAP)?.some(h => h.options.entity === false) &&
                !this.#handlers.get(EVENTS.DOUBLE_TAP)?.some(h => h.options.entity === false) &&
                !this.#handlers.get(EVENTS.LONG_TAP)?.some(h => h.options.entity === false)) {
                return // No emit if no handlers allow entity=false
            }

            const now = Date.now()
            const timeDiff = now - lastTapTime
            lastTapTime = now
            tapCount++
            tapStartTime = now

            // Cancel any existing timers
            if (tapTimeout) {
                clearTimeout(tapTimeout)
                tapTimeout = null
            }
            if (this.#tapState.longTapTimer) {
                clearTimeout(this.#tapState.longTapTimer)
                this.#tapState.longTapTimer = null
            }

            // Start LONG_TAP timer
            this.#tapState.longTapTimer = setTimeout(() => {
                this.#tapState.suppressTap = true
                this.#emit(EVENTS.LONG_TAP, event, entityId)
                tapCount = 0
                tapTimeout = null
                tapStartTime = 0
            }, LONG_TAP_TIMEOUT)

            // Suppress TAP if tap is held beyond DOUBLE_TAP_TIMEOUT
            setTimeout(() => {
                if (tapStartTime && Date.now() - tapStartTime >= DOUBLE_TAP_TIMEOUT && this.#tapState.longTapTimer) {
                    this.#tapState.suppressTap = true
                    if (tapTimeout) {
                        clearTimeout(tapTimeout)
                        tapTimeout = null
                    }
                }
            }, DOUBLE_TAP_TIMEOUT)

            // Handle TAP and DOUBLE_TAP
            if (tapCount === 1) {
                tapTimeout = setTimeout(() => {
                    if (tapCount === 1 && !this.#tapState.suppressTap) {
                        this.#emit(EVENTS.TAP, event, entityId)
                    }
                    tapCount = 0
                    tapTimeout = null
                    tapStartTime = 0
                }, DOUBLE_TAP_TIMEOUT + 50)
            }
            else if (tapCount === 2 && timeDiff < DOUBLE_TAP_TIMEOUT) {
                clearTimeout(tapTimeout)
                clearTimeout(this.#tapState.longTapTimer)
                this.#tapState.suppressTap = false
                this.#tapState.longTapTimer = null
                this.#emit(EVENTS.DOUBLE_TAP, event, entityId)
                tapCount = 0
                tapTimeout = null
                tapStartTime = 0
            }
            else {
                clearTimeout(tapTimeout)
                tapCount = 1
                lastTapTime = now
            }
        }

        /**
         * Handles the UP event for touch interactions.
         */
        const upHandler = () => {
            // Clear LONG_TAP timer
            if (this.#tapState.longTapTimer) {
                clearTimeout(this.#tapState.longTapTimer)
                this.#tapState.longTapTimer = null
            }

            // Reset suppressTap to allow future TAPs
            this.#tapState.suppressTap = false

            // Reset tap start time
            tapStartTime = 0
        }

        return {downHandler, upHandler}
    }

    /**
     * Sets up mouse event handling for the specified event type.
     * @param {string} eventType - Event type (e.g., CLICK, DOUBLE_CLICK, RIGHT_CLICK).
     * @param {string[]} modifier - Required modifier keys.
     * @returns {Function} The event handler function.
     * @private
     */
    #setupMouseEvents(eventType, modifier) {
        let lastClickTime = 0
        let clickTimeout = null

        return (event) => {
            if (eventType === EVENTS.RIGHT_CLICK && (this.isTouchDevice || event.pointerType === 'touch')) {
                return
            }

            const entityId = this.#viewer.scene.pick(event.position)?.id || null
            const eventName = modifier ? `${modifier.name}${MODIFIER_SEPARATOR}${eventType}` : eventType

            if (!this.#handlers.has(eventName)) {
                return
            }

            // Check if any handler allows entity=false to proceed with null entityId
            if (entityId === null && !this.#handlers.get(eventName)?.some(h => h.options.entity === false)) {
                return
            }

            const now = Date.now()
            const timeDiff = now - lastClickTime
            lastClickTime = now

            if (eventType === 'CLICK') {
                clearTimeout(clickTimeout)
                clickTimeout = setTimeout(() => {
                    if (timeDiff > DOUBLE_CLICK_TIMEOUT) {
                        this.#emit(eventName, event, entityId)
                    }
                }, DOUBLE_CLICK_TIMEOUT + 50)
            }
            else if (eventType === EVENTS.DOUBLE_CLICK) {
                clearTimeout(clickTimeout)
                clickTimeout = null
                this.#emit(eventName, event, entityId)
            }
            else if (eventType === EVENTS.RIGHT_CLICK) {
                clearTimeout(clickTimeout)
                this.#emit(eventName, event, entityId)
            }
        }
    }

    /**
     * Registers an event listener for a specific event.
     * Supports both touch and mouse events, with optional modifier keys and entity requirements.
     *
     * @param {string} eventName - The event name (e.g., "TAP", "CTRL#CLICK").
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If eventName is invalid or callback is not a function.
     */
    on(eventName, callback, options = {}) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        if (this.#hasCallback(eventName, callback)) {
            return
        }

        const {modifier, eventType} = this.#parseEventName(eventName)

        // Vérifier si l'eventType est supporté
        if (!this.#events[eventType]) {
            throw new Error(`Event type ${eventType} is not supported`)
        }

        // Handle boolean options for backward compatibility
        if (typeof options === 'boolean') {
            options = {once: options}
        }
        const entity = options?.entity ?? false
        options.entity = entity

        let handler
        if (this.isTouchDevice) {
            if (this.#events[eventType]?.touch) {
                handler = this.#setupTouchEvents(eventType)
                if (!this.#handlers.has(eventName)) {
                    this.#screenSpaceEventHandler.setInputAction(handler.downHandler, this.#events.DOWN.event)
                    this.#screenSpaceEventHandler.setInputAction(handler.upHandler, this.#events.UP.event)
                }
            }
            else {
                return
            }
        }
        else {
            if (!this.#events[eventType]?.touch) {
                handler = this.#setupMouseEvents(eventType, modifier)
                if (!this.#handlers.has(eventName)) {
                    if (modifier && modifier.value) {
                        this.#screenSpaceEventHandler.setInputAction(
                            handler,
                            this.#events[eventType].event,
                            modifier.value,
                        )
                    }
                    else {
                        this.#screenSpaceEventHandler.setInputAction(handler, this.#events[eventType].event)
                    }
                }
            }
            else {
                return
            }
        }

        // Ajouter le gestionnaire et le callback
        if (!this.#handlers.has(eventName)) {
            this.#handlers.set(eventName, [])
        }
        this.#handlers.get(eventName).push({handler, callback, options})
    }

    /**
     * Unregisters an event listener for a specific event.
     * Removes either a single callback or all handlers for the event.
     *
     * @param {string} eventName - The event name to remove (e.g., "TAP", "CTRL#CLICK").
     * @param {Function} [callback] - The specific callback to remove. If omitted, all handlers are removed.
     */
    off(eventName, callback) {
        if (!this.#handlers.has(eventName)) {
            return
        }

        const {eventType} = this.#parseEventName(eventName)
        const handlers = this.#handlers.get(eventName)

        const removeHandler = (handler) => {
            if (eventType === EVENTS.LONG_TAP) {
                this.#screenSpaceEventHandler.removeInputAction(this.#events.DOWN.event, handler.downHandler)
                this.#screenSpaceEventHandler.removeInputAction(this.#events.UP.event, handler.upHandler)
            }
            else if (this.#events[eventType]) {
                this.#screenSpaceEventHandler.removeInputAction(this.#events[eventType].event, handler)
            }
        }

        if (callback) {
            const index = handlers.findIndex((h) => h.callback === callback)
            if (index !== -1) {
                // Only remove the specific handler if it's the last one for the event type
                if (handlers.length === 1 && this.#handlers.get(eventName)) {
                    removeHandler(handlers[index].handler)
                    this.#handlers.delete(eventName)
                }
                handlers.splice(index, 1)
            }
        }
        else {
            // Remove all handlers for the event name
            if (this.#handlers.get(eventName)) {
                handlers.forEach(({handler}) => removeHandler(handler))
                this.#handlers.delete(eventName)
            }
            handlers.length = 0
        }

        if (handlers.length === 0) {
            this.#handlers.delete(eventName)
        }
    }

    /**
     * Parses an event name to extract modifier and event type.
     * Handles formats like "<MODIFIER>#<EVENT_TYPE>" (e.g., "CTRL#CLICK") or simple event names (e.g., "TAP").
     *
     * @param {string} eventName - The event name to parse.
     * @returns {{modifier: {name: string, value: any}|null, eventType: string}} Parsed modifier and event type.
     * @throws {Error} If the event name is invalid.
     * @private
     */
    #parseEventName(eventName) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }

        // No separator means no modifier
        if (!eventName.includes(MODIFIER_SEPARATOR)) {
            return {modifier: null, eventType: eventName}
        }

        // Get both modifier and event type
        const [modifierPart, eventType] = eventName.split(MODIFIER_SEPARATOR, 2)
        return {
            modifier:  {name: modifierPart, value: MODIFIERS[modifierPart]},
            eventType: eventType || modifierPart,
        }
    }

    /**
     * Cleans up all resources, removing event listeners and destroying the handler.
     * Resets the singleton instance.
     */
    destroy() {
        this.removeAllListeners()
        this.#screenSpaceEventHandler.destroy()
        this.#handlers.clear()
        CanvasEventManager.#instance = null
    }

    /**
     * Adds an event listener (alias for `on` method).
     *
     * @param {string} eventName - The event name (e.g., "TAP", "CTRL#CLICK").
     * @param {Function} callback - The callback function to execute.
     * @param {Object|boolean} [options={}] - Options for the listener.
     */
    addEventListener(eventName, callback, options = {}) {
        this.on(eventName, callback, options)
    }

    /**
     * Removes an event listener (alias for `off` method).
     *
     * @param {string} eventName - The event name to remove.
     * @param {Function} [callback] - The specific callback to remove.
     */
    removeEventListener(eventName, callback) {
        this.off(eventName, callback)
    }

    /**
     * Removes all registered event listeners for all events.
     */
    removeAllListeners() {
        Array.from(this.#handlers.keys()).forEach((eventName) => this.off(eventName))
    }

    /**
     * Registers a listener for the CLICK event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onClick(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('CLICK', callback, options)
    }

    /**
     * Unregisters a listener for the CLICK event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offClick(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('CLICK', callback)
    }

    /**
     * Registers a listener for the DOUBLE_CLICK event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onDoubleClick(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('DOUBLE_CLICK', callback, options)
    }

    /**
     * Unregisters a listener for the DOUBLE_CLICK event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offDoubleClick(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('DOUBLE_CLICK', callback)
    }

    /**
     * Registers a listener for the DOWN event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onDown(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('DOWN', callback, options)
    }

    /**
     * Unregisters a listener for the DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('DOWN', callback)
    }

    /**
     * Registers a listener for the UP event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onUp(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('UP', callback, options)
    }

    /**
     * Unregisters a listener for the UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('UP', callback)
    }

    /**
     * Registers a listener for the RIGHT_DOWN event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onRightDown(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_DOWN', callback, options)
    }

    /**
     * Unregisters a listener for the RIGHT_DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offRightDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('RIGHT_DOWN', callback)
    }

    /**
     * Registers a listener for the RIGHT_UP event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onRightUp(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_UP', callback, options)
    }

    /**
     * Unregisters a listener for the RIGHT_UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offRightUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('RIGHT_UP', callback)
    }

    /**
     * Registers a listener for the RIGHT_CLICK event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onRightClick(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_CLICK', callback, options)
    }

    /**
     * Unregisters a listener for the RIGHT_CLICK event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offRightClick(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('RIGHT_CLICK', callback)
    }

    /**
     * Registers a listener for the MIDDLE_DOWN event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onMiddleDown(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_DOWN', callback, options)
    }

    /**
     * Unregisters a listener for the MIDDLE_DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMiddleDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MIDDLE_DOWN', callback)
    }

    /**
     * Registers a listener for the MIDDLE_UP event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onMiddleUp(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_UP', callback, options)
    }

    /**
     * Unregisters a listener for the MIDDLE_UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMiddleUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MIDDLE_UP', callback)
    }

    /**
     * Registers a listener for the MIDDLE_CLICK event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onMiddleClick(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_CLICK', callback, options)
    }

    /**
     * Unregisters a listener for the MIDDLE_CLICK event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMiddleClick(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MIDDLE_CLICK', callback)
    }

    /**
     * Registers a listener for the MOUSE_MOVE event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onMouseMove(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_MOVE', callback, options)
    }

    /**
     * Unregisters a listener for the MOUSE_MOVE event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseMove(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_MOVE', callback)
    }

    /**
     * Registers a listener for the WHEEL event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onWheel(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('WHEEL', callback, options)
    }

    /**
     * Unregisters a listener for the WHEEL event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offWheel(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('WHEEL', callback)
    }

    /**
     * Registers a listener for the TAP event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onTap(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('TAP', callback, options)
    }

    /**
     * Unregisters a listener for the TAP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offTap(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('TAP', callback)
    }

    /**
     * Registers a listener for the DOUBLE_TAP event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onDoubleTap(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('DOUBLE_TAP', callback, options)
    }

    /**
     * Unregisters a listener for the DOUBLE_TAP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offDoubleTap(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('DOUBLE_TAP', callback)
    }

    /**
     * Registers a listener for the LONG_TAP event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onLongTap(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('LONG_TAP', callback, options)
    }

    /**
     * Unregisters a listener for the LONG_TAP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offLongTap(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('LONG_TAP', callback)
    }

    /**
     * Registers a listener for the PINCH_START event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onPinchStart(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_START', callback, options)
    }

    /**
     * Unregisters a listener for the PINCH_START event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offPinchStart(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('PINCH_START', callback)
    }

    /**
     * Registers a listener for the PINCH_MOVE event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onPinchMove(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_MOVE', callback, options)
    }

    /**
     * Unregisters a listener for the PINCH_MOVE event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offPinchMove(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('PINCH_MOVE', callback)
    }

    /**
     * Registers a listener for the PINCH_END event.
     *
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the listener.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement for the event:
     *   - `false`: Emit with `entity=null` regardless of clicked entity (default).
     *   - `'id'`: Emit only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Emit only if the clicked entity's ID is in the array.
     *   - `[]`: Emit only if any entity is clicked.
     * @param {boolean} [options.once=false] - Whether the listener should be removed after triggering.
     * @throws {Error} If callback is not a function.
     */
    onPinchEnd(callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_END', callback, options)
    }

    /**
     * Unregisters a listener for the PINCH_END event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offPinchEnd(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('PINCH_END', callback)
    }
}