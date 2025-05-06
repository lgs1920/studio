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
     * @type {Object} Constants for event types from CESIUM_EVENTS.
     */
    events = CESIUM_EVENTS

    // Private fields for bound keydown and keyup handlers
    #boundKeydown
    #boundKeyup

    /**
     * Creates a new CanvasEventManager instance.
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
        }

        // Bind modifier key listeners
        this.#boundKeydown = (event) => this.#updateModifierState(event, true)
        this.#boundKeyup = (event) => this.#updateModifierState(event, false)
        window.addEventListener('keydown', this.#boundKeydown)
        window.addEventListener('keyup', this.#boundKeyup)

        // Prevent contextmenu events in touch mode to avoid RIGHT_CLICK
        if (this.isTouchDevice) {
            this.viewer.scene.canvas.addEventListener('contextmenu', (e) => e.preventDefault())
        }
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
        }
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
     * Sets up mouse event handling for the specified event type.
     * @param {string} eventType - Event type (e.g., LEFT_CLICK, LEFT_DOUBLE_CLICK, RIGHT_CLICK).
     * @param {Function} callback - Callback function to execute when the event is triggered.
     * @param {boolean} useEntity - Whether to require a picked entity.
     * @param {Array<string>} modifiers - Required modifier keys.
     * @returns {Function} The event handler function.
     * @private
     */
    #setupMouseEvents(eventType, callback, useEntity, modifiers) {
        let lastClickTime = 0
        let clickTimeout = null

        return (event) => {
            // Ignore RIGHT_CLICK if triggered by touch (contextmenu simulation)
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
                // Handle single left click with delay to distinguish from double click
                clearTimeout(clickTimeout)
                clickTimeout = setTimeout(() => {
                    if (timeDiff > DOUBLE_CLICK_TIMEOUT) {
                        callback(event, pickedEntity?.id)
                        console.log('🖱️ Left Click detected!') // Debug message
                    }
                }, DOUBLE_CLICK_TIMEOUT + 50)
            }
            else if (this.events[eventType]?.type === 'LEFT_DOUBLE_CLICK') {
                // Handle double left click
                clearTimeout(clickTimeout)
                callback(event, pickedEntity?.id)
                console.log('🖱️ Double Click detected!') // Debug message
            }
            else if (this.events[eventType]?.type === 'RIGHT_CLICK') {
                // Handle right click
                callback(event, pickedEntity?.id)
                console.log('🖱️ Right Click detected!') // Debug message
            }
            else {
                callback(event, pickedEntity?.id)
            }
        }
    }

    /**
     * Sets up touch event handling for TAP, DOUBLE_TAP, and LONG_TAP.
     * @param {string} eventType - The event type (e.g., TAP, DOUBLE_TAP, LONG_TAP).
     * @param {Function} callback - Callback function to execute when the event is triggered.
     * @param {boolean} useEntity - Whether to require a picked entity.
     * @param {Array<string>} modifiers - Required modifier keys.
     * @returns {Function|Object} The event handler function or an object with handlers for LONG_TAP.
     * @private
     */
    #setupTouchEvents(eventType, callback, useEntity, modifiers) {
        // Shared state for tracking taps
        let lastTapTime = 0
        let tapCount = 0
        let isProcessingTap = false

        if (this.events[eventType]?.type === 'LONG_TAP') {
            let timer = null
            // Handler for LEFT_DOWN: start timer for LONG_TAP
            const downHandler = (event) => {
                if (!this.#checkKeyModifiers(modifiers)) {
                    return
                }
                const pickedEntity = useEntity ? this.viewer.scene.pick(event.position) : null
                if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                    return
                }

                timer = setTimeout(() => {
                    callback(event, pickedEntity?.id)
                    console.log('⏳ Long Tap detected!') // Debug message
                    timer = null
                    // Reset tap state
                    tapCount = 0
                    lastTapTime = 0
                    isProcessingTap = false
                }, TOUCH_LONG_TAP_TIMEOUT)
                isProcessingTap = true
            }
            // Handler for LEFT_UP: clear timer if still active
            const upHandler = (event) => {
                if (timer) {
                    clearTimeout(timer)
                    timer = null
                    isProcessingTap = false
                }
            }
            return {downHandler, upHandler}
        }

        if (this.events[eventType]?.type === 'DOUBLE_TAP') {
            // Handler for LEFT_DOWN: track tap sequence for DOUBLE_TAP
            return (event) => {
                if (!this.#checkKeyModifiers(modifiers)) {
                    return
                }
                const pickedEntity = useEntity ? this.viewer.scene.pick(event.position) : null
                if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                    return
                }

                const now = Date.now()
                const timeDiff = now - lastTapTime

                if (timeDiff < TOUCH_DOUBLE_TAP_TIMEOUT && tapCount === 1) {
                    // Second tap within timeout: trigger DOUBLE_TAP
                    callback(event, pickedEntity?.id)
                    console.log('🚀 Double Tap detected!') // Debug message
                    tapCount = 0
                    lastTapTime = 0
                    isProcessingTap = false
                }
                else {
                    // First tap or timeout exceeded: increment tap count
                    tapCount = 1
                    lastTapTime = now
                    isProcessingTap = true
                    // Reset tap count if no second tap occurs
                    setTimeout(() => {
                        tapCount = 0
                        lastTapTime = 0
                        isProcessingTap = false
                    }, TOUCH_DOUBLE_TAP_TIMEOUT)
                }
            }
        }

        // Handler for TAP
        return (event) => {
            if (!this.#checkKeyModifiers(modifiers)) {
                return
            }
            if (isProcessingTap) {
                return
            } // Prevent TAP during DOUBLE_TAP or LONG_TAP
            const pickedEntity = useEntity ? this.viewer.scene.pick(event.position) : null
            if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                return
            }
            callback(event, pickedEntity?.id)
            console.log('📱 Tap detected!') // Debug message
        }
    }

    /**
     * Registers an event listener for the specified event name.
     * @param {string} eventName - The event name in the format "<MODIFIER>#<EVENT_TYPE>", e.g., "CTRL#CLICK".
     * @param {Function} callback - The callback function to execute when the event is triggered.
     * @param {Object|boolean} [options={}] - Options for the event listener.
     *   - If boolean, specifies whether the listener should be removed after the first trigger (once).
     *   - If object, can contain:
     *     - {boolean} [useEntity=false] - Whether to require a picked entity for the event.
     *     - {boolean} [once=false] - Whether to remove the listener after the first trigger.
     * @throws {Error} If eventName is invalid or eventType is unsupported.
     */
    on(eventName, callback, options = {}) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        // Parse the event name to extract modifiers and event type
        const {modifiers, eventType} = this.#parseEventName(eventName)

        // Handle options: if boolean, convert to { once: boolean }
        if (typeof options === 'boolean') {
            options = {once: options}
        }

        const useEntity = options?.useEntity || false

        let handler
        if (this.isTouchDevice) {
            if (this.events[eventType]?.touch) {
                // Handle touch events in touch mode
                handler = this.#setupTouchEvents(eventType, callback, useEntity, modifiers)
                if (this.events[eventType]?.type === 'LONG_TAP') {
                    // Set input actions for LONG_TAP (LEFT_DOWN and LEFT_UP)
                    this.screenSpaceEventHandler.setInputAction(handler.downHandler, ScreenSpaceEventType.LEFT_DOWN)
                    this.screenSpaceEventHandler.setInputAction(handler.upHandler, ScreenSpaceEventType.LEFT_UP)
                }
                else if (this.events[eventType]?.type === 'DOUBLE_TAP') {
                    // Use LEFT_DOWN for DOUBLE_TAP to handle tap sequence
                    this.screenSpaceEventHandler.setInputAction(handler, ScreenSpaceEventType.LEFT_DOWN)
                }
                else {
                    // Use LEFT_CLICK for TAP
                    this.screenSpaceEventHandler.setInputAction(handler, this.events[eventType].event)
                }
            }
            else {
                return
            }
        }
        else {
            if (!this.events[eventType]?.touch) {
                // Handle mouse events in non-touch mode
                handler = this.#setupMouseEvents(eventType, callback, useEntity, modifiers)
                this.screenSpaceEventHandler.setInputAction(handler, this.events[eventType].event)
            }
            else {
                return
            }
        }

        // Store handler for later removal
        this.handlers.set(eventName, handler)

        // If once is true, remove the listener after registration
        if (options.once) {
            this.off(eventName)
        }
    }

    /**
     * Unregisters an event listener.
     * @param {string} eventName - The event name to remove, e.g., "CTRL#CLICK".
     */
    off(eventName) {
        const handler = this.handlers.get(eventName)
        if (!handler) {
            return
        }

        const {eventType} = this.#parseEventName(eventName)
        if (typeof handler === 'object') {
            // Remove LONG_TAP handlers
            this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN)
            this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP)
        }
        else if (this.events[eventType]) {
            // Remove standard mouse or touch handlers
            this.screenSpaceEventHandler.removeInputAction(this.events[eventType].event)
        }
        this.handlers.delete(eventName)
    }

    /**
     * Extracts modifiers and event type from "<MODIFIER>#<EVENT_TYPE>" format.
     * @param {string} eventName - The formatted event name.
     * @returns {Object} An object containing modifiers (Array<string>) and eventType (string).
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
        }
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
    }

    /**
     * Adds an event listener using the `on` method.
     * @param {string} eventName - The event name, e.g., "CTRL#CLICK".
     * @param {Function} callback - The callback function to execute.
     * @param {Object} [options={}] - Options for the listener.
     */
    addEventListener(eventName, callback, options = {}) {
        this.on(eventName, callback, options)
    }

    /**
     * Removes a specific event listener using the `off` method.
     * @param {string} eventName - The event name to remove.
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
}