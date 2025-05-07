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
        console.log(`[Touch] Emitting event: ${eventType}`)
        Array.from(this.handlers.keys())
            .filter((eventName) => {
                const {eventType: parsedEventType} = this.#parseEventName(eventName)
                return parsedEventType === eventType
            })
            .forEach((eventName) => {
                const handlers = this.handlers.get(eventName)
                handlers.forEach(({callback, options}) => {
                    try {
                        console.log(`[Touch] Executing callback for ${eventName}`)
                        callback(...args)
                        if (options.once) {
                            this.off(eventName, callback)
                        }
                    }
                    catch (error) {
                        console.error(`[Touch] Error in callback for ${eventName}:`, error)
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
     * @param {boolean} useEntity - Whether to require a picked entity.
     * @param {string[]} modifiers - Required modifier keys.
     * @returns {Function|Object} The event handler function or an object with handlers for LONG_TAP.
     * @private
     */
    #setupTouchEvents(eventType, callback, useEntity, modifiers) {
        // if (eventType === 'LONG_TAP') {
        //     const downHandler = (event) => {
        //         console.log('[Touch] LONG_TAP down event received');
        //         if (event.pointerType !== 'touch' && !this.isTouchDevice) {
        //             console.log('[Touch] Ignored: not a touch event', event.pointerType, this.isTouchDevice);
        //             return;
        //         }
        //         if (!this.#checkKeyModifiers(modifiers)) {
        //             console.log('[Touch] Ignored: invalid modifiers', modifiers);
        //             return;
        //         }
        //         const pickedEntity = this.viewer.scene.pick(event.position);
        //         console.log('[Touch] Selected entity:', pickedEntity);
        //         if (useEntity && (!pickedEntity || !pickedEntity.id)) {
        //             console.log('[Touch] Ignored: invalid or no entity selected');
        //             return;
        //         }
        //
        //         this.tapState.longTapTimer = setTimeout(() => {
        //             console.log('[Touch] LONG_TAP detected!');
        //             this.tapState.suppressTap = true;
        //             this.#emit('LONG_TAP', event, pickedEntity?.id);
        //             this.tapState.tapCount = 0;
        //         }, TOUCH_LONG_TAP_TIMEOUT);
        //     };
        //
        //     const upHandler = () => {
        //         if (this.tapState.longTapTimer) {
        //             clearTimeout(this.tapState.longTapTimer);
        //             console.log('[Touch] LONG_TAP timer cleared');
        //             this.tapState.suppressTap = false;
        //         }
        //     };
        //
        //     return { downHandler, upHandler };
        // }

        let lastTapTime = 0
        let tapTimeout = null
        let tapCount = 0

        return (event) => {
            console.log('[Touch] Event received:', eventType, event)

            if (event.pointerType !== 'touch' && !this.isTouchDevice) {
                console.log('[Touch] Ignored: not a touch event', event.pointerType, this.isTouchDevice)
                return
            }

            if (!this.#checkKeyModifiers(modifiers)) {
                console.log('[Touch] Ignored: invalid modifiers', modifiers)
                return
            }

            const pickedEntity = this.viewer.scene.pick(event.position)
            console.log('[Touch] Selected entity:', pickedEntity.id)
            if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                console.log('[Touch] Ignored: invalid or no entity selected')
                return
            }

            if (this.tapState.suppressTap) {
                console.log('[Touch] Ignored: tap suppressed by LONG_TAP')
                return
            }

            const now = Date.now()
            const timeDiff = now - lastTapTime
            lastTapTime = now
            tapCount++

            console.log('[Touch] tapCount:', tapCount, 'Delay:', timeDiff)

            if (tapCount === 1) {
                tapTimeout = setTimeout(() => {
                    if (tapCount === 1 && !this.tapState.suppressTap) {
                        this.#emit('TAP', event, pickedEntity?.id)
                    }
                    tapCount = 0
                }, TOUCH_DOUBLE_TAP_TIMEOUT + 50)
            }
            else if (tapCount === 2 && timeDiff < TOUCH_DOUBLE_TAP_TIMEOUT) {
                clearTimeout(tapTimeout)
                this.#emit('DOUBLE_TAP', event, pickedEntity?.id)
                tapCount = 0
            }
            else {
                clearTimeout(tapTimeout)
                tapCount = 1
                lastTapTime = now
                if (eventType === 'TAP') {
                    tapTimeout = setTimeout(() => {
                        if (tapCount === 1 && !this.tapState.suppressTap) {
                            this.#emit('TAP', event, pickedEntity?.id)
                            console.log('[Touch] TAP detected!')
                        }
                        tapCount = 0
                    }, TOUCH_DOUBLE_TAP_TIMEOUT + 50)
                }
            }
        };
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
            console.log(`[Touch] Event ${eventName} already registered, skipping duplicate`)
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
                if (this.events[eventType]?.type === 'LONG_TAP') {
                    //  this.screenSpaceEventHandler.setInputAction(handler.downHandler,
                    // ScreenSpaceEventType.LEFT_DOWN); this.screenSpaceEventHandler.setInputAction(handler.upHandler,
                    // ScreenSpaceEventType.LEFT_UP);
                }
                else {
                    this.screenSpaceEventHandler.setInputAction(handler, ScreenSpaceEventType.LEFT_DOWN)
                }
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
            console.log(`[Touch] No handlers found for ${eventName}`)
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
                console.log(`[Touch] Removed specific handler for ${eventName}, remaining=${handlers.length}`)
            }
            else {
                console.log(`[Touch] Callback not found for ${eventName}`)
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
            console.log(`[Touch] Removed all handlers for ${eventName}`)
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
        console.log('[Touch] CanvasEventManager destroyed')
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