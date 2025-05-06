/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-06
 * Last modified: 2025-05-06
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { DOUBLE_CLICK_TIMEOUT }                               from '@Core/constants'
import { Cartesian2, ScreenSpaceEventHandler }                from 'cesium'
import { CESIUM_EVENTS, EVENT_SEPARATOR, MODIFIER_SEPARATOR } from './cesiumEvents' // Configurable touch event
                                                                                    // thresholds

// Configurable touch event thresholds
const TOUCH_DOUBLE_TAP_TIMEOUT = 300 // ms
const TOUCH_LONG_TAP_TIMEOUT = 600 // ms

/**
 * CanvasEventManager handles mouse, touch, and modifier-based events for a Cesium viewer.
 * Event names follow the format "<MODIFIER>#<EVENT_TYPE>" (e.g., "CTRL#CLICK").
 */
export class CanvasEventManager {
    /** @type {Object} Constants for event types */
    events = CESIUM_EVENTS;

    // Declare private fields
    #boundKeydown
    #boundKeyup

    /**
     * Creates a new CanvasEventManager.
     * @param {Viewer} viewer - The Cesium viewer instance.
     * @throws {Error} If viewer is not provided or invalid.
     */
    constructor(viewer) {
        if (!viewer || !viewer.scene || !viewer.scene.canvas) {
            throw new Error('Invalid viewer: must be a valid Cesium Viewer instance')
        }
        this.viewer = viewer
        this.handlers = new Map()
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        this.isTouchDevice =
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches

        // Track modifier key states
        this.modifierState = {
            CTRL: false,
            SHIFT: false,
            ALT:  false,
        };

        // Store touch event handler
        this.touchEndHandler = null

        // Bind modifier key listeners
        this.#boundKeydown = (event) => this.#updateModifierState(event, true)
        this.#boundKeyup = (event) => this.#updateModifierState(event, false)
        window.addEventListener('keydown', this.#boundKeydown)
        window.addEventListener('keyup', this.#boundKeyup)
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
            ShiftLeft:   'SHIFT',
            ShiftRight:  'SHIFT',
            AltLeft:     'ALT',
            AltRight:    'ALT',
            Control:     'CTRL',
            Shift:       'SHIFT',
            Alt:         'ALT',
        };
        const normalizedKey = keyMap[event.key] || event.key.toUpperCase()
        if (['CTRL', 'SHIFT', 'ALT'].includes(normalizedKey)) {
            this.modifierState[normalizedKey] = isActive
        }
    }

    /**
     * Checks whether the required modifier keys are active.
     * @param {Array<string>} requiredKeys - List of required keys (e.g., ["CTRL", "SHIFT"]).
     * @returns {boolean} True if all required keys are active, false otherwise.
     * @private
     */
    #checkKeyModifiers(requiredKeys = []) {
        return requiredKeys.every((key) => this.modifierState[key])
    }

    /**
     * Registers an event listener with "<MODIFIER>#<EVENT_TYPE>" format.
     * @param {string} eventName - Formatted event name (e.g., "CTRL#CLICK").
     * @param {Function} callback - Function to execute on event trigger.
     * @param {Object|boolean} [options={}] - Options or boolean for one-time listener.
     *                                       - {boolean} [options.once=false] - Remove after first trigger.
     *                                       - {boolean} [options.useEntity=false] - Require picked entity.
     * @throws {Error} If eventName is invalid or eventType is unsupported.
     */
    on(eventName, callback, options = {}) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        const {modifiers, eventType} = this.#parseEventName(eventName)

        // Convert boolean options to object
        if (typeof options === 'boolean') {
            options = {once: options}
        }

        const useEntity = options?.useEntity || false

        if (!this.events[eventType]) {
            throw new Error(`Unsupported event type: ${eventType}`)
        }

        let handler
        if (this.isTouchDevice) {
            handler = this.#setupTouchEvents(eventType, callback, useEntity, modifiers)
        }
        else {
            handler = this.#setupMouseEvents(eventType, callback, useEntity, modifiers)
        }

        if (handler) {
            // Store and attach handler
            this.handlers.set(eventName, handler)
            this.screenSpaceEventHandler.setInputAction(handler, this.events[eventType].event)

            // Initialize touchend listener for touch devices
            if (this.isTouchDevice && !this.touchEndHandler && handler) {
                this.touchEndHandler = (touchEvent) => {
                    this.handlers.forEach((h, key) => {
                        const {eventType: keyEventType} = this.#parseEventName(key)
                        if (keyEventType === eventType || key.startsWith(`touchend:${eventType}`)) {
                            h(touchEvent)
                        }
                    })
                }
                this.viewer.scene.canvas.addEventListener('touchend', this.touchEndHandler, false)
            }

            if (options.once) {
                this.off(eventName)
            }
        }
    }

    /**
     * Sets up mouse event handling for the specified event type.
     * @param {string} eventType - Event type (e.g., LEFT_CLICK, LEFT_DOUBLE_CLICK).
     * @param {Function} callback - Callback function.
     * @param {boolean} useEntity - Whether to require a picked entity.
     * @param {Array<string>} modifiers - Required modifier keys.
     * @returns {Function} The event handler function.
     * @private
     */
    #setupMouseEvents = (eventType, callback, useEntity, modifiers) => {
        let lastClickTime = 0
        let clickTimeout = null

        return (event) => {
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
                    }
                }, DOUBLE_CLICK_TIMEOUT + 50);
            }
            else if (this.events[eventType]?.type === 'LEFT_DOUBLE_CLICK') {
                clearTimeout(clickTimeout)
                callback(event, pickedEntity?.id)
            }
            else {
                callback(event, pickedEntity?.id)
            }
        };
    };

    /**
     * Unregisters an event listener.
     * @param {string} eventName - Formatted event name (e.g., "CTRL#CLICK").
     */
    off(eventName) {
        if (!this.handlers.has(eventName)) {
            return
        }

        const {eventType} = this.#parseEventName(eventName)
        this.screenSpaceEventHandler.removeInputAction(this.events[eventType].event)
        this.handlers.delete(eventName)
        this.handlers.delete(`touchend:${eventType}`)

        // Remove touchend listener if no touch handlers remain
        if (this.isTouchDevice && this.touchEndHandler && !this.#hasTouchHandlers()) {
            this.viewer.scene.canvas.removeEventListener('touchend', this.touchEndHandler)
            this.touchEndHandler = null
        }
    }

    /**
     * Checks if any touch handlers are registered.
     * @returns {boolean} True if touch handlers exist, false otherwise.
     * @private
     */
    #hasTouchHandlers() {
        return Array.from(this.handlers.keys()).some((key) =>
                                                         this.#parseEventName(key).eventType.includes('TAP') || key.startsWith('touchend:'),
        )
    }

    /**
     * Adds an event listener using the `on` method.
     * @param {string} eventName - Formatted event name (e.g., "CTRL#CLICK").
     * @param {Function} callback - The callback function.
     * @param {Object} [options={}] - Options (`useEntity`, `once`).
     */
    addEventListener(eventName, callback, options = {}) {
        this.on(eventName, callback, options)
    }

    /**
     * Removes a specific event listener using the `off` method.
     * @param {string} eventName - Formatted event name (e.g., "CTRL#CLICK").
     */
    removeEventListener(eventName) {
        this.off(eventName)
    }

    /**
     * Removes all registered event listeners.
     */
    removeAllListeners() {
        this.handlers.forEach((_, eventName) => this.off(eventName))
    }

    /**
     * Extracts modifiers and event type from "<MODIFIER>#<EVENT_TYPE>" format.
     * @param {string} eventName - The formatted event name.
     * @returns {Object} { modifiers: Array<string>, eventType: string }
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
     * Sets up touch event handling for TAP, DOUBLE_TAP, and LONG_TAP.
     * @param {string} eventType - The event type (e.g., TAP, DOUBLE_TAP, LONG_TAP).
     * @param {Function} callback - Callback function.
     * @param {boolean} useEntity - Whether to require a picked entity.
     * @param {Array<string>} modifiers - Required modifier keys.
     * @returns {Function|null} The event handler function or null if unsupported.
     * @private
     */
    #setupTouchEvents = (eventType, callback, useEntity, modifiers) => {
        if (!this.events[eventType]?.touch) {
            return null
        }

        let lastTapTime = 0
        let longTapTimer = null
        let touchState = {
            isDoubleTap:   false,
            isLongTap:     false,
            touchPosition: null,
            event:         null,
        }

        return (event) => {
            if (!event.changedTouches || event.changedTouches.length === 0) {
                return
            }

            const touch = event.changedTouches[0]
            touchState.touchPosition = new Cartesian2(touch.clientX, touch.clientY)
            touchState.event = event

            if (!this.#checkKeyModifiers(modifiers)) {
                return
            }

            const tapNow = Date.now()
            const tapDiff = tapNow - lastTapTime
            lastTapTime = tapNow

            // Reset state for new touch sequence
            touchState.isDoubleTap = false
            touchState.isLongTap = false

            // Handle DOUBLE_TAP
            if (tapDiff < TOUCH_DOUBLE_TAP_TIMEOUT && tapDiff > 0) {
                clearTimeout(longTapTimer)
                touchState.isDoubleTap = true
                if (this.events[eventType]?.type === 'DOUBLE_TAP') {
                    const pickedEntity = useEntity ? this.viewer.scene.pick(touchState.touchPosition) : null
                    if (!useEntity || (pickedEntity && pickedEntity.id)) {
                        callback(event, pickedEntity?.id)
                        console.log('🚀 Double Tap detected!')
                    }
                }
                return
            }

            // Handle LONG_TAP
            longTapTimer = setTimeout(() => {
                touchState.isLongTap = true
                if (this.events[eventType]?.type === 'LONG_TAP') {
                    const pickedEntity = useEntity ? this.viewer.scene.pick(touchState.touchPosition) : null
                    if (!useEntity || (pickedEntity && pickedEntity.id)) {
                        callback(touchState.event, pickedEntity?.id)
                        console.log('⏳ Long Tap detected!')
                    }
                }
            }, TOUCH_LONG_TAP_TIMEOUT);

            // Handle TAP (on touchend)
            const touchEndHandler = (touchEvent) => {
                if (touchState.isDoubleTap || touchState.isLongTap) {
                    return
                }

                clearTimeout(longTapTimer)
                if (this.events[eventType]?.type === 'TAP') {
                    const pos = new Cartesian2(
                        touchEvent.changedTouches[0].clientX,
                        touchEvent.changedTouches[0].clientY,
                    )
                    const pickedEntity = useEntity ? this.viewer.scene.pick(pos) : null
                    if (!useEntity || (pickedEntity && pickedEntity.id)) {
                        callback(touchEvent, pickedEntity?.id)
                        console.log('📱 Tap detected!')
                    }
                }
            };

            // Register touchend handler
            this.handlers.set(`touchend:${eventType}`, touchEndHandler)
        };
    };

    /**
     * Cleans up all resources, removing event listeners and destroying the handler.
     */
    destroy() {
        this.removeAllListeners()
        window.removeEventListener('keydown', this.#boundKeydown)
        window.removeEventListener('keyup', this.#boundKeyup)
        if (this.touchEndHandler) {
            this.viewer.scene.canvas.removeEventListener('touchend', this.touchEndHandler)
            this.touchEndHandler = null
        }
        this.screenSpaceEventHandler.destroy()
        this.handlers.clear()
    }
}