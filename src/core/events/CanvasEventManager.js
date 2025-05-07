/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-07
 * Last modified: 2025-05-07
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DOUBLE_CLICK_TIMEOUT }                               from '@Core/constants'
import { ScreenSpaceEventHandler, ScreenSpaceEventType }      from 'cesium'
import { CESIUM_EVENTS, EVENT_SEPARATOR, MODIFIER_SEPARATOR } from './cesiumEvents' // Configurable timeouts for touch
// events

// Configurable timeouts for touch events
const TOUCH_DOUBLE_TAP_TIMEOUT = 300 // ms
const TOUCH_LONG_TAP_TIMEOUT = 600 // ms

/**
 * Manages canvas events for a Cesium viewer, including mouse and touch interactions,
 * with support for modifier keys (Ctrl, Shift, Alt).
 * Event names are formatted as "<MODIFIER>#<EVENT_TYPE>", e.g., "CTRL#CLICK".
 */
export class CanvasEventManager {
    /**
     * Singleton instance of CanvasEventManager.
     * @type {CanvasEventManager|null}
     */
    static instance = null;

    /**
     * Event configuration from CESIUM_EVENTS.
     * @type {Object}
     */
    events = CESIUM_EVENTS

    /**
     * The Cesium viewer instance.
     * @type {Cesium.Viewer}
     */
    viewer

    /**
     * Map storing event handlers for each event name.
     * Each event name maps to an array of { handler, callback, options } objects.
     * @type {Map<string, Array<{handler: Function|Object, callback: Function, options: Object}>>}
     */
    handlers = new Map()

    /**
     * Cesium ScreenSpaceEventHandler for handling canvas events.
     * @type {Cesium.ScreenSpaceEventHandler}
     */
    screenSpaceEventHandler

    /**
     * Indicates whether the device supports touch events.
     * @type {boolean}
     */
    isTouchDevice

    /**
     * Tracks the state of modifier keys (CTRL, SHIFT, ALT).
     * @type {{CTRL: boolean, SHIFT: boolean, ALT: boolean}}
     */
    modifierState = {
        CTRL:  false,
        SHIFT: false,
        ALT:   false,
    }

    /**
     * Tracks the state of touch tap events.
     * @type {{lastTapTime: number, tapCount: number, isProcessing: boolean, longTapTimer: number|null, suppressTap:
     *     boolean, pendingTap: number|null}}
     */
    tapState = {
        lastTapTime:  0,
        tapCount:     0,
        isProcessing: false,
        longTapTimer: null,
        suppressTap:  false,
        pendingTap:   null,
    }

    /**
     * Bound keydown event handler.
     * @type {Function}
     * @private
     */
    #boundKeydown

    /**
     * Bound keyup event handler.
     * @type {Function}
     * @private
     */
    #boundKeyup

    /**
     * Creates a new CanvasEventManager instance.
     * @param {Cesium.Viewer} viewer - The Cesium viewer instance.
     * @throws {Error} If viewer is not provided or invalid.
     */
    constructor(viewer) {
        if (CanvasEventManager.instance) {
            return CanvasEventManager.instance
        }

        if (!viewer || !viewer.scene || !viewer.scene.canvas) {
            throw new Error('Invalid viewer: must be a valid Cesium Viewer instance')
        }

        this.viewer = viewer
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        this.isTouchDevice = this.#isTouchDevice()

        // Bind modifier key listeners
        this.#boundKeydown = (event) => this.#updateModifierState(event, true)
        this.#boundKeyup = (event) => this.#updateModifierState(event, false)
        window.addEventListener('keydown', this.#boundKeydown)
        window.addEventListener('keyup', this.#boundKeyup)

        // Prevent contextmenu events in touch mode to avoid RIGHT_CLICK
        if (this.isTouchDevice) {
            this.viewer.scene.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
        }

        CanvasEventManager.instance = this
    }

    /**
     * Checks if the device supports touch events.
     * @returns {boolean} True if the device supports touch events, false otherwise.
     * @private
     */
    #isTouchDevice() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches
        );
    }

    /**
     * Updates the state of modifier keys (CTRL, SHIFT, ALT) based on key press events.
     * @param {KeyboardEvent} event - The keyboard event.
     * @param {boolean} isActive - Whether the key is pressed (true) or released (false).
     * @private
     */
    #updateModifierState(event, isActive) {
        const keyMap = {
            ControlLeft: 'CTRL',
            ControlRight: 'CTRL',
            ShiftLeft:  'SHIFT',
            ShiftRight: 'SHIFT',
            AltLeft:    'ALT',
            AltRight:   'ALT',
            Control:    'CTRL',
            Shift:      'SHIFT',
            Alt:        'ALT',
        };
        const normalizedKey = keyMap[event.key] || event.key.toUpperCase()
        if (['CTRL', 'SHIFT', 'ALT'].includes(normalizedKey)) {
            this.modifierState[normalizedKey] = isActive
        }
    }

    /**
     * Checks whether the required modifier keys are active.
     * @param {string[]} [requiredKeys=[]] - List of required keys (e.g., ["CTRL", "SHIFT"]).
     * @returns {boolean} True if all required keys are active, false otherwise.
     * @private
     */
    #checkKeyModifiers(requiredKeys = []) {
        return requiredKeys.every((key) => this.modifierState[key])
    }

    /**
     * Emits an event by executing all callbacks registered for the specified event type.
     * @param {string} eventType - The event type (e.g., TAP, DOUBLE_TAP, LONG_TAP).
     * @param {...any} args - Arguments to pass to the callbacks.
     * @private
     */
    #emit(eventType, ...args) {
        Array.from(this.handlers.keys())
            .filter((eventName) => {
                const {eventType: parsedEventType} = this.#parseEventName(eventName)
                return parsedEventType === eventType
            })
            .forEach((eventName) => {
                const handlers = this.handlers.get(eventName)
                handlers.forEach(({callback, options}) => {
                    try {
                        callback(...args)
                        if (options.once) {
                            this.off(eventName, callback)
                        }
                    }
                    catch (error) {
                        console.error(`Error in callback for ${eventName}:`, error)
                    }
                })
            })
    }

    /**
     * Checks if a callback is already registered for the specified event name.
     * @param {string} eventName - The event name (e.g., TAP, DOUBLE_TAP).
     * @param {Function} callback - The callback function to check.
     * @returns {boolean} True if the callback is already registered, false otherwise.
     * @private
     */
    #hasCallback(eventName, callback) {
        if (!this.handlers.has(eventName)) {
            return false
        }
        return this.handlers.get(eventName).some((handler) => handler.callback === callback)
    }

    /**
     * Sets up touch event handling for TAP, DOUBLE_TAP, and LONG_TAP.
     * @param {string} eventType - The event type (e.g., TAP, DOUBLE_TAP, LONG_TAP).
     * @param {Function} callback - Callback function to execute when the event is triggered.
     * @param {boolean} useEntity - Whether to require a picked entity for the event.
     * @param {string[]} modifiers - Required modifier keys (e.g., ["CTRL", "SHIFT"]).
     * @returns {Object} An object containing downHandler and upHandler for touch events.
     * @private
     */
    #setupTouchEvents(eventType, callback, useEntity, modifiers) {
        /**
         * Validates common touch event conditions and returns the picked entity.
         * @param {Object} event - The touch event object from Cesium.
         * @returns {Object|null} The picked entity, or null if validation fails.
         * @private
         */
        const validateTouchEvent = (event) => {
            // Check if the event is a touch event or if the device supports touch
            if (event.pointerType !== 'touch' && !this.isTouchDevice) {
                return null
            }

            // Verify required modifier keys
            if (!this.#checkKeyModifiers(modifiers)) {
                return null
            }

            // Pick the entity at the event position
            const pickedEntity = this.viewer.scene.pick(event.position)
            // Ensure a valid entity is selected if useEntity is true
            if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                return null
            }

            return pickedEntity
        };

        // Track the last tap time for double-tap detection
        let lastTapTime = 0
        // Store the TAP timer
        let tapTimeout = null
        // Count consecutive taps
        let tapCount = 0
        // Track the start time of the current tap
        let tapStartTime = 0

        /**
         * Handles the LEFT_DOWN event for touch interactions.
         * @param {Object} event - The Cesium LEFT_DOWN event.
         */
        const downHandler = (event) => {
            const pickedEntity = validateTouchEvent(event)
            if (!pickedEntity && pickedEntity !== null) {
                return
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
            if (this.tapState.longTapTimer) {
                clearTimeout(this.tapState.longTapTimer)
                this.tapState.longTapTimer = null;
            }

            // Start LONG_TAP timer
            this.tapState.longTapTimer = setTimeout(() => {
                this.tapState.suppressTap = true
                this.#emit('LONG_TAP', event, pickedEntity?.id)
                tapCount = 0
                tapTimeout = null
                tapStartTime = 0
            }, TOUCH_LONG_TAP_TIMEOUT)

            // Suppress TAP if tap is held beyond TOUCH_DOUBLE_TAP_TIMEOUT
            setTimeout(() => {
                if (tapStartTime && Date.now() - tapStartTime >= TOUCH_DOUBLE_TAP_TIMEOUT && this.tapState.longTapTimer) {
                    this.tapState.suppressTap = true
                    if (tapTimeout) {
                        clearTimeout(tapTimeout)
                        tapTimeout = null
                    }
                }
            }, TOUCH_DOUBLE_TAP_TIMEOUT)

            // Handle TAP and DOUBLE_TAP
            if (tapCount === 1) {
                tapTimeout = setTimeout(() => {
                    if (tapCount === 1 && !this.tapState.suppressTap) {
                        this.#emit('TAP', event, pickedEntity?.id)
                    }
                    tapCount = 0
                    tapTimeout = null
                    tapStartTime = 0
                }, TOUCH_DOUBLE_TAP_TIMEOUT + 50);
            }
            else if (tapCount === 2 && timeDiff < TOUCH_DOUBLE_TAP_TIMEOUT) {
                clearTimeout(tapTimeout)
                clearTimeout(this.tapState.longTapTimer)
                this.tapState.suppressTap = false
                this.tapState.longTapTimer = null
                this.#emit('DOUBLE_TAP', event, pickedEntity?.id)
                tapCount = 0
                tapTimeout = null
                tapStartTime = 0
            }
            else {
                clearTimeout(tapTimeout)
                tapCount = 1
                lastTapTime = now
            }
        };

        /**
         * Handles the LEFT_UP event for touch interactions.
         */
        const upHandler = () => {
            // Calculate tap duration
            const tapDuration = tapStartTime ? Date.now() - tapStartTime : 0

            // Clear LONG_TAP timer
            if (this.tapState.longTapTimer) {
                clearTimeout(this.tapState.longTapTimer)
                this.tapState.longTapTimer = null
            }

            // Reset suppressTap to allow future TAPs
            this.tapState.suppressTap = false

            // Reset tap start time
            tapStartTime = 0
        };

        return {downHandler, upHandler}
    }

    /**
     * Sets up mouse event handling for the specified event type.
     * @param {string} eventType - Event type (e.g., LEFT_CLICK, LEFT_DOUBLE_CLICK, RIGHT_CLICK).
     * @param {Function} callback - Callback function to execute when the event is triggered.
     * @param {boolean} useEntity - Whether to require a picked entity.
     * @param {string[]} modifiers - Required modifier keys.
     * @returns {Function} The event handler function.
     * @private
     */
    #setupMouseEvents(eventType, callback, useEntity, modifiers) {
        let lastClickTime = 0
        let clickTimeout = null

        return (event) => {
            if (this.events[eventType]?.type === 'RIGHT_CLICK' && (this.isTouchDevice || event.pointerType === 'touch')) {
                return
            }
            if (!this.#checkKeyModifiers(modifiers)) {
                return
            }
            const pickedEntity = this.viewer.scene.pick(event.position)
            if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                return
            }

            const now = Date.now()
            const timeDiff = now - lastClickTime
            lastClickTime = now

            if (this.events[eventType]?.type === 'LEFT_CLICK') {
                clearTimeout(clickTimeout)
                clickTimeout = setTimeout(() => {
                    if (timeDiff > DOUBLE_CLICK_TIMEOUT) {
                        callback(event, pickedEntity?.id)
                        console.log('[Mouse] Left Click detected!')
                    }
                }, DOUBLE_CLICK_TIMEOUT + 50);
            }
            else if (this.events[eventType]?.type === 'LEFT_DOUBLE_CLICK') {
                clearTimeout(clickTimeout)
                callback(event, pickedEntity?.id)
                console.log('[Mouse] Double Click detected!')
            }
            else if (this.events[eventType]?.type === 'RIGHT_CLICK') {
                callback(event, pickedEntity?.id)
                console.log('[Mouse] Right Click detected!')
            }
            else {
                callback(event, pickedEntity?.id)
            }
        };
    }

    /**
     * Registers an event listener for the specified event name.
     * @param {string} eventName - The event name, e.g., "TAP", "DOUBLE_TAP", "LONG_TAP".
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the event listener.
     *   - If boolean, specifies whether the listener should be removed after the first trigger (once).
     *   - If object, can contain:
     *     - {boolean} [useEntity=false] - Whether to require a picked entity for the event.
     *     - {boolean} [once=false] - Whether to remove the listener after the first trigger.
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

        const {modifiers, eventType} = this.#parseEventName(eventName)

        if (typeof options === 'boolean') {
            options = {once: options}
        }
        const useEntity = options?.useEntity || false

        let handler
        if (this.isTouchDevice) {
            if (this.events[eventType]?.touch) {
                handler = this.#setupTouchEvents(eventType, callback, useEntity, modifiers)
                this.screenSpaceEventHandler.setInputAction(handler.downHandler, ScreenSpaceEventType.LEFT_DOWN)
                this.screenSpaceEventHandler.setInputAction(handler.upHandler, ScreenSpaceEventType.LEFT_UP)
            }
            else {
                return
            }
        }
        else {
            if (!this.events[eventType]?.touch) {
                handler = this.#setupMouseEvents(eventType, callback, useEntity, modifiers)
                this.screenSpaceEventHandler.setInputAction(handler, this.events[eventType].event)
            }
            else {
                return
            }
        }

        if (!this.handlers.has(eventName)) {
            this.handlers.set(eventName, [])
        }
        this.handlers.get(eventName).push({handler, callback, options})

        if (options.once) {
            this.off(eventName, callback)
        }
    }

    /**
     * Unregisters an event listener.
     * @param {string} eventName - The event name to remove, e.g., "TAP", "DOUBLE_TAP".
     * @param {Function} [callback] - The specific callback to remove. If omitted, all handlers for the event are
     *     removed.
     */
    off(eventName, callback) {
        if (!this.handlers.has(eventName)) {
            return
        }

        const {eventType} = this.#parseEventName(eventName)
        const handlers = this.handlers.get(eventName)

        if (callback) {
            const index = handlers.findIndex((h) => h.callback === callback)
            if (index !== -1) {
                const {handler} = handlers[index]
                if (eventType === 'LONG_TAP') {
                    //   this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN,
                    // handler.downHandler);
                    // this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP, handler.upHandler);
                }
                else if (this.events[eventType]) {
                    this.screenSpaceEventHandler.removeInputAction(this.events[eventType].event, handler)
                }
                handlers.splice(index, 1)
            }
        }
        else {
            handlers.forEach(({handler}) => {
                if (eventType === 'LONG_TAP') {
                    this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN, handler.downHandler)
                    this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP, handler.upHandler)
                }
                else if (this.events[eventType]) {
                    this.screenSpaceEventHandler.removeInputAction(this.events[eventType].event, handler)
                }
            })
            handlers.length = 0
        }

        if (handlers.length === 0) {
            this.handlers.delete(eventName)
        }
    }

    /**
     * Extracts modifiers and event type from "<MODIFIER>#<EVENT_TYPE>" format.
     * @param {string} eventName - The formatted event name.
     * @returns {{modifiers: string[], eventType: string}} An object containing modifiers and eventType.
     * @throws {Error} If eventName is invalid.
     * @private
     */
    #parseEventName(eventName) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }

        if (!eventName.includes(MODIFIER_SEPARATOR)) {
            return {modifiers: [], eventType: eventName}
        }

        const [modifierPart, eventType] = eventName.split(MODIFIER_SEPARATOR, 2)
        return {
            modifiers: modifierPart ? modifierPart.split(EVENT_SEPARATOR) : [],
            eventType: eventType || modifierPart,
        };
    }

    /**
     * Cleans up all resources, removing event listeners and destroying the handler.
     */
    destroy() {
        this.removeAllListeners()
        window.removeEventListener('keydown', this.#boundKeydown)
        window.removeEventListener('keyup', this.#boundKeyup)
        this.screenSpaceEventHandler.destroy()
        this.handlers.clear()
        CanvasEventManager.instance = null
    }

    /**
     * Adds an event listener using the `on` method.
     * @param {string} eventName - The event name, e.g., "TAP", "DOUBLE_TAP".
     * @param {Function} callback - The callback function to execute.
     * @param {Object|boolean} [options={}] - Options for the listener.
     */
    addEventListener(eventName, callback, options = {}) {
        this.on(eventName, callback, options)
    }

    /**
     * Removes a specific event listener using the `off` method.
     * @param {string} eventName - The event name to remove.
     * @param {Function} [callback] - The specific callback to remove.
     */
    removeEventListener(eventName, callback) {
        this.off(eventName, callback)
    }

    /**
     * Removes all registered event listeners.
     */
    removeAllListeners() {
        Array.from(this.handlers.keys()).forEach((eventName) => this.off(eventName))
    }
}