/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-23
 * Last modified: 2025-05-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Manages canvas events for a Cesium viewer, handling mouse, touch, and keyboard interactions.
 * Supports modifier keys (Ctrl, Shift, Alt) via options or event names (e.g., "CTRL#CLICK").
 * Event names and modifiers are case-insensitive (e.g., "ctrl#click" = "CTRL#CLICK").
 * Implements a singleton pattern to ensure a single instance per viewer.
 *
 * @class CanvasEventManager
 */
import { DOUBLE_CLICK_TIMEOUT, DOUBLE_TAP_TIMEOUT, LGS_CONTEXT_MENU_HOOK, LONG_TAP_TIMEOUT } from '@Core/constants'
import { ScreenSpaceEventHandler }                                                           from 'cesium'
import { CESIUM_EVENTS, EVENT_LOWEST, EVENTS, MODIFIER_SEPARATOR, MODIFIERS }                from './cesiumEvents'

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
     * Cesium viewer instance associated with this event manager.
     * @type {Viewer}
     * @private
     */
    #viewer

    /**
     * Map storing event handlers for each event name.
     * Each entry contains an array of handler objects with handler, callback, options, and userData.
     * @type {Map<string, Array<{handler: Function|Object, callback: Function, options: Object, userData: any}>>}
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
     * Tracks touch tap event state for TAP, DOUBLE_TAP, and LONG_TAP detection.
     * @type {{lastTapTime: number, tapCount: number, isProcessing: boolean, longTapTimer: number|null, suppressTap:
     *     boolean, pendingTap: number|null}}
     * @private
     */
    #tapState = {
        lastTapTime: 0,
        tapCount:   0,
        isProcessing: false,
        longTapTimer: null,
        suppressTap: false,
        pendingTap: null,
    }

    /**
     * Tracks the last selected entity to handle animation resets and hover events.
     * @type {string|null}
     * @private
     */
    #lastSelectedEntity = null

    /**
     * Tracks the last click time for click-related events.
     * @type {number}
     * @private
     */
    #lastClickTime = 0

    /**
     * Timeout for click-related events.
     * @type {number|null}
     * @private
     */
    #clickTimeout = null

    /**
     * Tracks the last mouse position for keyboard events.
     * @type {{x: number|null, y: number|null}}
     * @private
     */
    #lastMousePosition = {x: null, y: null}

    /**
     * Tracks the state of modifier keys (Ctrl, Alt, Shift).
     * @type {{ ctrl: boolean, alt: boolean, shift: boolean }}
     * @private
     */
    #modifierState = {ctrl: false, alt: false, shift: false}

    /**
     * Creates or returns the singleton instance of CanvasEventManager.
     * Initializes the Cesium ScreenSpaceEventHandler and configures touch/mouse/keyboard event handling.
     *
     * @param {Cesium.Viewer} viewer - The Cesium viewer instance.
     * @throws {Error} If the viewer is invalid or missing required properties.
     */
    constructor(viewer) {
        if (CanvasEventManager.#instance) {
            return CanvasEventManager.#instance
        }

        if (!viewer || !viewer.scene || !viewer.scene.canvas) {
            throw new Error('Invalid viewer: must be a valid Cesium Viewer instance')
        }

        this.#viewer = viewer
        this.#screenSpaceEventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        this.isTouchDevice = this.#isTouchDevice()

        // Invalidate browser context menu
        document.addEventListener('contextmenu', (e) => {
            // No browser context menu on Map POI
            if (e.target.id === LGS_CONTEXT_MENU_HOOK) {
                e.preventDefault()
            }
        }, {capture: false})

        this.#viewer.scene.canvas.setAttribute('tabindex', '0')
        this.#setupKeyboardEvents()
        this.#setupMousePositionTracking()
        CanvasEventManager.#instance = this
    }

    /**
     * Checks if the device supports touch events using multiple browser APIs.
     *
     * @returns {boolean} True if the device supports touch events, false otherwise.
     * @private
     */
    #isTouchDevice() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 1 ||
            window.matchMedia('(pointer: coarse)').matches
        )
    }

    /**
     * Sets up mouse position tracking for keyboard events.
     * Tracks the last mouse position (clientX, clientY) to use in keyboard events.
     * @private
     */
    #setupMousePositionTracking() {
        this.#viewer.scene.canvas.addEventListener('mousemove', (event) => {
            this.#lastMousePosition = {
                x: event.clientX,
                y: event.clientY,
            }
        })
    }

    /**
     * Sets up keyboard event listeners for KEY_DOWN and KEY_UP events.
     * Tracks modifier key states and only emits events for non-modifier keys or explicitly registered modifier keys.
     * Uses the last known mouse position for entity picking and event position.
     * @private
     */
    #setupKeyboardEvents() {
        const modifierKeys = ['control', 'alt', 'shift']

        const handleKeyEvent = (event, eventType) => {
            const key = event.key.toLowerCase()
            const isModifier = modifierKeys.includes(key)

            if (key === 'control') {
                this.#modifierState.ctrl = eventType === 'KEY_DOWN'
            }
            if (key === 'alt') {
                this.#modifierState.alt = eventType === 'KEY_DOWN'
            }
            if (key === 'shift') {
                this.#modifierState.shift = eventType === 'KEY_DOWN'
            }

            if (isModifier && !this.#handlers.get(eventType)?.some(h => h.options.keys?.includes(key))) {
                return
            }

            const eventName = eventType.toUpperCase()
            if (this.#handlers.has(eventName)) {
                const position = this.#lastMousePosition.x !== null && this.#lastMousePosition.y !== null
                                 ? {x: this.#lastMousePosition.x, y: this.#lastMousePosition.y}
                                 : null
                const pickedEntityId = position && this.#viewer.scene.pick(position)?.id || null

                if (key === 'alt') {
                    event.preventDefault()
                }

                this.#emit(eventName, {
                    key,
                    position,
                    clientX: position ? position.x : null,
                    clientY: position ? position.y : null,
                    ctrlKey: this.#modifierState.ctrl,
                    altKey:  this.#modifierState.alt,
                    shiftKey: this.#modifierState.shift,
                }, pickedEntityId)
            }
        }

        this.#viewer.scene.canvas.addEventListener('keydown', (event) => handleKeyEvent(event, 'KEY_DOWN'))
        this.#viewer.scene.canvas.addEventListener('keyup', (event) => handleKeyEvent(event, 'KEY_UP'))

        window.addEventListener('blur', () => {
            this.#modifierState = {ctrl: false, alt: false, shift: false}
        })
    }

    /**
     * Validates the entity based on the entity parameter and picked entity ID.
     *
     * @param {Object} event - The Cesium event object or custom event (e.g., { key, position }).
     * @param {boolean|string|string[]} entity - Entity requirement:
     *   - `false`: Return `null` regardless of clicked entity.
     *   - `'id'`: Return ID only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Return ID only if the clicked entity's ID is in the array.
     *   - `[]`: Return ID only if any entity is clicked.
     * @param {Object|null} [pickedEntity] - Optional pre-picked entity to avoid redundant picking.
     * @returns {string|null} The entity ID if valid, null otherwise.
     * @private
     */
    #validateEntity(event, entity, pickedEntity = null) {
        let entityId = null
        if (pickedEntity !== null) {
            entityId = pickedEntity.id || null
        }
        else if (event.position && event.position.x != null && event.position.y != null) {
            const picked = this.#viewer.scene.pick(event.position)
            entityId = picked && picked.id ? picked.id : null
        }

        if (entity === false) {
            return null
        }
        else if (typeof entity === 'string') {
            return entityId === entity ? entityId : null
        }
        else if (Array.isArray(entity)) {
            if (entity.length === 0) {
                return entityId ? entityId : null
            }
            else {
                return entity.includes(entityId) ? entityId : null
            }
        }

        return null
    }

    /**
     * Emits an event by executing all registered callbacks for the specified event name.
     * Callbacks are sorted by priority (highest first, descending order) and executed if entity, key, and modifier
     * requirements are met. If a callback has preventLowerPriority set to true, lower-priority callbacks are skipped.
     *
     * @param {string} eventName - The event name (e.g., "CTRL#CLICK", "TAP", "KEY_DOWN").
     * @param {Object} event - The Cesium event object or custom event (e.g., { key, position, clientX, clientY,
     *     ctrlKey, altKey, shiftKey }).
     * @param {string|null} pickedEntityId - The ID of the picked entity, or null if none.
     * @private
     */
    #emit(eventName, event, pickedEntityId) {
        const handlers = this.#handlers.get(eventName)
        if (!handlers) {
            return
        }

        const sortedHandlers = [...handlers].sort((a, b) => (b.options.priority - a.options.priority))
        let stopPropagation = false

        sortedHandlers.forEach(({callback, options, userData}) => {
            if (stopPropagation) {
                return
            }
            try {
                if (event.key && options.keys && !options.keys.includes(event.key)) {
                    return
                }
                if (options.modifiers && options.modifiers.length > 0) {
                    const modifiersOk = options.modifiers.every(mod => {
                        const modKey = mod.toLowerCase()
                        return modKey === 'ctrl' ? event.ctrlKey :
                               modKey === 'alt' ? event.altKey :
                               modKey === 'shift' ? event.shiftKey : false
                    })
                    const nonSpecifiedModifiersOk = ['ctrl', 'alt', 'shift'].every(mod => {
                        if (!options.modifiers.includes(mod)) {
                            return mod === 'ctrl' ? !event.ctrlKey :
                                   mod === 'alt' ? !event.altKey :
                                   mod === 'shift' ? !event.shiftKey : true
                        }
                        return true
                    })
                    if (!modifiersOk || !nonSpecifiedModifiersOk) {
                        return
                    }
                }
                const entityId = this.#validateEntity(event, options.entity ?? false, pickedEntityId)
                if (entityId !== null || options.entity === false) {
                    callback(event, entityId, options, userData)
                    if (options.once) {
                        this.off(eventName, callback)
                    }
                    if (options.preventLowerPriority) {
                        stopPropagation = true
                    }
                }
            }
            catch (error) {
                console.error(`[CanvasEventManager] Error in callback for ${eventName}:`, error)
            }
        })
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
     * Sets up touch event handlers for TAP, DOUBLE_TAP, and LONG_TAP events.
     *
     * @param {string} eventType - The event type (e.g., TAP, DOUBLE_TAP, LONG_TAP).
     * @returns {Object} Object containing downHandler and upHandler for touch events.
     * @private
     */
    #setupTouchEvents(eventType) {
        const validateTouchEvent = (event) => {
            if (event.pointerType !== 'touch' && !this.isTouchDevice) {
                return null
            }
            const picked = this.#viewer.scene.pick(event.position)
            const entityId = picked && picked.id ? picked.id : null
            return entityId
        }

        let lastTapTime = 0
        let tapTimeout = null
        let tapCount = 0
        let tapStartTime = 0

        const downHandler = (event) => {
            const entityId = validateTouchEvent(event)
            if (entityId === null && !this.#handlers.get(EVENTS.TAP)?.some(h => h.options.entity === false) &&
                !this.#handlers.get(EVENTS.DOUBLE_TAP)?.some(h => h.options.entity === false) &&
                !this.#handlers.get(EVENTS.LONG_TAP)?.some(h => h.options.entity === false)) {
                return
            }

            const now = Date.now()
            const timeDiff = now - lastTapTime
            lastTapTime = now
            tapCount++
            tapStartTime = now

            if (tapTimeout) {
                clearTimeout(tapTimeout)
                tapTimeout = null
            }
            if (this.#tapState.longTapTimer) {
                clearTimeout(this.#tapState.longTapTimer)
                this.#tapState.longTapTimer = null
            }

            this.#tapState.longTapTimer = setTimeout(() => {
                this.#tapState.suppressTap = true
                this.#emit(EVENTS.LONG_TAP, event, entityId)
                tapCount = 0
                tapTimeout = null
                tapStartTime = 0
            }, LONG_TAP_TIMEOUT)

            setTimeout(() => {
                if (tapStartTime && Date.now() - tapStartTime >= DOUBLE_TAP_TIMEOUT && this.#tapState.longTapTimer) {
                    this.#tapState.suppressTap = true
                    if (tapTimeout) {
                        clearTimeout(tapTimeout)
                        tapTimeout = null
                    }
                }
            }, DOUBLE_TAP_TIMEOUT)

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

        const upHandler = () => {
            if (this.#tapState.longTapTimer) {
                clearTimeout(this.#tapState.longTapTimer)
                this.#tapState.longTapTimer = null
            }

            this.#tapState.suppressTap = false
            tapStartTime = 0
        }

        return {downHandler, upHandler}
    }

    /**
     * Sets up mouse event handlers for the specified event type.
     *
     * @param {string} eventType - Event type (e.g., CLICK, DOUBLE_CLICK, RIGHT_CLICK, MOUSE_ENTER, MOUSE_LEAVE).
     * @param {Object|null} modifier - Modifier from event name (e.g., { name: 'CTRL', value: Cesium.Modifier }).
     * @param {string[]} requiredModifiers - Modifiers required by options.modifiers (e.g., ['ctrl', 'shift']).
     * @returns {Function} The event handler function.
     * @private
     */
    #setupMouseEvents(eventType, modifier, requiredModifiers) {
        return (event) => {
            if (eventType === EVENTS.RIGHT_CLICK && (this.isTouchDevice || event.pointerType === 'touch')) {
                return
            }

            const modifiersOk = requiredModifiers.every(mod => {
                const modKey = mod.toLowerCase()
                return modKey === 'ctrl' ? event.ctrlKey :
                       modKey === 'alt' ? event.altKey :
                       modKey === 'shift' ? event.shiftKey : false
            })
            if (!modifiersOk) {
                return
            }

            const picked = this.#viewer.scene.pick(event.position ?? event.endPosition)
            const entityId = picked && picked.id ? picked.id : null
            const eventName = modifier ? `${modifier.name}${MODIFIER_SEPARATOR}${eventType}` : eventType

            if (!this.#handlers.has(eventName)) {
                return
            }

            if (eventType === EVENTS.MOUSE_ENTER || eventType === EVENTS.MOUSE_LEAVE) {
                if (entityId !== this.#lastSelectedEntity) {
                    if (this.#lastSelectedEntity && eventType === EVENTS.MOUSE_LEAVE) {
                        this.#emit(EVENTS.MOUSE_LEAVE, event, this.#lastSelectedEntity)
                    }
                    else if (entityId) {
                        this.#emit(EVENTS.MOUSE_ENTER, event, entityId)
                    }
                    this.#lastSelectedEntity = entityId
                }
                return
            }

            if (entityId === null && !this.#handlers.get(eventName)?.some(h => h.options.entity === false)) {
                return
            }

            const now = Date.now()
            const timeDiff = now - this.#lastClickTime
            this.#lastClickTime = now

            if (eventType === 'CLICK') {
                clearTimeout(this.#clickTimeout)
                this.#clickTimeout = setTimeout(() => {
                    if (timeDiff > DOUBLE_CLICK_TIMEOUT) {
                        this.#emit(eventName, event, entityId)
                    }
                }, DOUBLE_CLICK_TIMEOUT + 50)
            }
            else if (eventType === EVENTS.DOUBLE_CLICK) {
                clearTimeout(this.#clickTimeout)
                this.#clickTimeout = null
                this.#emit(eventName, event, entityId)
            }
            else if (eventType === EVENTS.RIGHT_CLICK) {
                clearTimeout(this.#clickTimeout)
                this.#emit(eventName, event, entityId)
            }
            else if (eventType === EVENTS.MOUSE_DOWN || eventType === EVENTS.MOUSE_UP ||
                eventType === EVENTS.RIGHT_DOWN || eventType === EVENTS.RIGHT_UP ||
                eventType === EVENTS.MIDDLE_DOWN || eventType === EVENTS.MIDDLE_UP ||
                eventType === EVENTS.MOUSE_MOVE || eventType === EVENTS.WHEEL) {
                this.#emit(eventName, event, entityId)
            }
        }
    }

    /**
     * Registers an event listener with support for priority, entity filtering, modifier keys, key filtering,
     * one-time execution, selector visibility, preventing lower-priority listeners, and user-defined data.
     *
     * @param {string} eventName - The event name (e.g., "TAP", "CTRL#CLICK", case-insensitive).
     * @param {Function} callback - The callback function, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement.
     * @param {boolean} [options.once=false] - Whether to remove the listener after triggering.
     * @param {number} [options.priority=0 or EVENT_LOWEST] - Priority of the callback (higher number = executed
     *     first).
     * @param {boolean} [options.showSelector=true] - Whether to show the .cesium-selection-wrapper for picked
     *     entities.
     * @param {boolean} [options.preventLowerPriority=false] - Whether to prevent lower-priority listeners from
     *     executing.
     * @param {string[]} [options.modifiers=[]] - Required modifier keys for mouse or keyboard events (e.g., ['ctrl',
     *     'shift'], case-insensitive).
     * @param {string[]} [options.keys=[]] - Specific keys to listen for in KEY_DOWN/KEY_UP (e.g., ['s', 'enter'],
     *     case-insensitive).
     * @param {any} [userData] - User-defined data to pass to the callback when triggered.
     * @throws {Error} If eventName is invalid, callback is not a function, or event type is unsupported.
     */
    on(eventName, callback, options = {}, userData = null) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        eventName = eventName.toUpperCase()
        const {modifier, eventType} = this.#parseEventName(eventName)

        if (!this.#events[eventType] && eventType !== 'KEY_DOWN' && eventType !== 'KEY_UP') {
            throw new Error(`Event type ${eventType} is not supported`)
        }

        if (typeof options === 'boolean') {
            options = {once: options}
        }
        const entity = options?.entity ?? false
        const priority = typeof options?.priority === 'number' ? options.priority : (entity === false ? EVENT_LOWEST : 0)
        const showSelector = options?.showSelector !== false
        const preventLowerPriority = options?.preventLowerPriority ?? false
        const modifiers = Array.isArray(options?.modifiers) ? options.modifiers.map(mod => mod.toLowerCase()) : []
        const keys = Array.isArray(options?.keys) ? options.keys.map(key => key.toLowerCase()) : []
        options.entity = entity
        options.priority = priority
        options.showSelector = showSelector
        options.preventLowerPriority = preventLowerPriority
        options.modifiers = modifiers
        options.keys = keys

        let handler
        if (eventType === 'KEY_DOWN' || eventType === 'KEY_UP') {
            handler = null
        }
        else if (this.isTouchDevice) {
            if (this.#events[eventType]?.touch) {
                handler = this.#setupTouchEvents(eventType)
                if (!this.#handlers.has(eventName)) {
                    this.#screenSpaceEventHandler.setInputAction(handler.downHandler, this.#events[eventType].event)
                    this.#screenSpaceEventHandler.setInputAction(handler.upHandler, this.#events.UP.event)
                }
            }
            else {
                return
            }
        }
        else {
            if (!this.#events[eventType]?.touch) {
                handler = this.#setupMouseEvents(eventType, modifier, modifiers)
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

        if (!this.#handlers.has(eventName)) {
            this.#handlers.set(eventName, [])
        }
        this.#handlers.get(eventName).push({handler, callback, options, userData})
    }

    /**
     * Unregisters an event listener for a specific event or all handlers for an event.
     *
     * @param {string} eventName - The event name to remove (e.g., "TAP", "CTRL#CLICK", case-insensitive).
     * @param {Function} [callback] - The specific callback to remove. If omitted, all handlers are removed.
     */
    off(eventName, callback) {
        eventName = eventName.toUpperCase()
        if (!this.#handlers.has(eventName)) {
            return
        }

        const {eventType} = this.#parseEventName(eventName)
        const handlers = this.#handlers.get(eventName)

        const removeHandler = (handler) => {
            if (eventType === EVENTS.LONG_TAP) {
                this.#screenSpaceEventHandler.removeInputAction(this.#events[eventType].event, handler.downHandler)
                this.#screenSpaceEventHandler.removeInputAction(this.#events.UP.event, handler.upHandler)
            }
            else if (this.#events[eventType]) {
                this.#screenSpaceEventHandler.removeInputAction(this.#events[eventType].event, handler)
            }
        }

        if (callback) {
            const index = handlers.findIndex((h) => h.callback === callback)
            if (index !== -1) {
                if (handlers.length === 1 && this.#handlers.get(eventName)) {
                    removeHandler(handlers[index].handler)
                    this.#handlers.delete(eventName)
                }
                handlers.splice(index, 1)
            }
        }
        else {
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
     * Removes all registered event listeners for all events.
     */
    removeAllListeners() {
        Array.from(this.#handlers.keys()).forEach((eventName) => this.off(eventName))
    }

    /**
     * Removes all listeners associated with a specific entity or group of entities.
     *
     * @param {string|string[]} entity - The entity ID or array of entity IDs to remove listeners for.
     */
    removeAllListenersByEntity(entity) {
        const entities = Array.isArray(entity) ? entity : [entity]

        this.#handlers.forEach((handlers, eventName) => {
            const filteredHandlers = handlers.filter((handler) => {
                const {options} = handler
                if (options.entity === false) {
                    return true
                }
                if (typeof options.entity === 'string') {
                    return !entities.includes(options.entity)
                }
                if (Array.isArray(options.entity)) {
                    return !options.entity.some((id) => entities.includes(id))
                }
                return true
            })

            if (filteredHandlers.length === 0) {
                this.off(eventName)
            }
            else if (filteredHandlers.length < handlers.length) {
                this.#handlers.set(eventName, filteredHandlers)
            }
        })
    }

    /**
     * Parses an event name to extract modifier and event type, case-insensitive.
     *
     * @param {string} eventName - The event name to parse (e.g., "CTRL#CLICK", "ctrl#click").
     * @returns {{modifier: {name: string, value: any}|null, eventType: string}} Parsed modifier and event type.
     * @throws {Error} If the event name is invalid.
     * @private
     */
    #parseEventName(eventName) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }

        eventName = eventName.toUpperCase()
        if (!eventName.includes(MODIFIER_SEPARATOR)) {
            return {modifier: null, eventType: eventName}
        }

        const [modifierPart, eventType] = eventName.split(MODIFIER_SEPARATOR, 2)
        return {
            modifier: {name: modifierPart, value: MODIFIERS[modifierPart]},
            eventType: eventType || modifierPart,
        }
    }

    /**
     * Cleans up all resources, removes event listeners, and resets the singleton instance.
     */
    destroy() {
        this.removeAllListeners()
        this.#screenSpaceEventHandler.destroy()
        this.#handlers.clear()
        CanvasEventManager.#instance = null
    }

    /**
     * Alias for `on` method to add an event listener.
     *
     * @param {string} eventName - The event name (e.g., "TAP", "CTRL#CLICK", case-insensitive).
     * @param {Function} callback - The callback function to execute.
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     */
    addEventListener(eventName, callback, options = {}, userData = null) {
        this.on(eventName, callback, options, userData)
    }

    /**
     * Alias for `off` method to remove an event listener.
     *
     * @param {string} eventName - The event name to remove (case-insensitive).
     * @param {Function} [callback] - The specific callback to remove.
     */
    removeEventListener(eventName, callback) {
        this.off(eventName, callback)
    }

    /**
     * Registers a listener for the CLICK event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onClick(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('CLICK', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onDoubleClick(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('DOUBLE_CLICK', callback, options, userData)
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
     * Registers a listener for the MOUSE_DOWN event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseDown(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_DOWN', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_DOWN', callback)
    }

    /**
     * Registers a listener for the MOUSE_UP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseUp(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_UP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_UP', callback)
    }

    /**
     * Registers a listener for the RIGHT_DOWN event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onRightDown(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_DOWN', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onRightUp(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_UP', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onRightClick(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_CLICK', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMiddleDown(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_DOWN', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMiddleUp(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_UP', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMiddleClick(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_CLICK', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseMove(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_MOVE', callback, options, userData)
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
     * Registers a listener for the MOUSE_ENTER event, triggered once when the mouse starts hovering over an entity.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseEnter(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_ENTER', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_ENTER event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseEnter(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_ENTER', callback)
    }

    /**
     * Registers a listener for the MOUSE_LEAVE event, triggered once when the mouse leaves an entity.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseLeave(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_LEAVE', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_LEAVE event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseLeave(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_LEAVE', callback)
    }

    /**
     * Registers a listener for the WHEEL event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onWheel(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('WHEEL', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onTap(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('TAP', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onDoubleTap(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('DOUBLE_TAP', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onLongTap(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('LONG_TAP', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onPinchStart(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_START', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onPinchMove(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_MOVE', callback, options, userData)
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
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onPinchEnd(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_END', callback, options, userData)
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

    /**
     * Registers a listener for the KEY_DOWN event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onKeyDown(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('KEY_DOWN', callback, options, userData)
    }

    /**
     * Unregisters a listener for the KEY_DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offKeyDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('KEY_DOWN', callback)
    }

    /**
     * Registers a listener for the KEY_UP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onKeyUp(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('KEY_UP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the KEY_UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offKeyUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('KEY_UP', callback)
    }
}