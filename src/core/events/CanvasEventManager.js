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

    instance = null
    /**
     * Creates a new CanvasEventManager instance.
     * @param {Viewer} viewer - The Cesium viewer instance.
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
        this.handlers = new Map()
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        this.isTouchDevice = this.#isTouchDevice()

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

        CanvasEventManager.instnce = this
    }

    #isTouchDevice() {
        return 'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches
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
        let tapState = {
            lastTapTime:  0,
            tapCount:     0,
            isProcessing: false,
            longTapTimer: null,
            suppressTap:  false,
            pendingTap:   null,
        }

        // Helper to check conditions and get picked entity
        const checkConditions = (event) => {
            if (!this.#checkKeyModifiers(modifiers)) {
                console.log(`[Touch] Modifiers not satisfied: ${modifiers}`)
                return null
            }
            const pickedEntity = useEntity ? this.viewer.scene.pick(event.position) : null
            if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                console.log('[Touch] No valid entity picked')
                return null
            }
            return {event, pickedEntity}
        }

        // Handler for TAP
        if (this.events[eventType]?.type === 'TAP') {
            return (event) => {
                const result = checkConditions(event)
                if (!result) {
                    return
                }

                console.log(`[Touch] TAP event received: isProcessing=${tapState.isProcessing}, suppressTap=${tapState.suppressTap}`)
                if (tapState.suppressTap) {
                    console.log(`[Touch] TAP ignored: suppressTap=${tapState.suppressTap}`)
                    return
                }

                tapState.pendingTap = {event: result.event, pickedEntity: result.pickedEntity}
                tapState.tapCount = 1
                tapState.lastTapTime = Date.now()
                tapState.isProcessing = true
                console.log(`[Touch] TAP queued: tapCount=${tapState.tapCount}, time=${tapState.lastTapTime}`)

                setTimeout(() => {
                    if (tapState.tapCount === 1 && !tapState.suppressTap && tapState.pendingTap) {
                        console.log('[Touch] TAP detected!')
                        callback(tapState.pendingTap.event, tapState.pendingTap.pickedEntity?.id)
                    }
                    else {
                        console.log(`[Touch] TAP skipped: tapCount=${tapState.tapCount}, suppressTap=${tapState.suppressTap}`)
                    }
                    tapState.pendingTap = null
                    tapState.isProcessing = false
                    tapState.tapCount = 0
                    tapState.lastTapTime = 0
                }, TOUCH_DOUBLE_TAP_TIMEOUT + 10)
            }
        }

        // Handler for DOUBLE_TAP
        if (this.events[eventType]?.type === 'DOUBLE_TAP') {
            return (event) => {
                const result = checkConditions(event)
                if (!result) {
                    return
                }

                const now = Date.now()
                const timeDiff = now - tapState.lastTapTime
                console.log(`[Touch] DOUBLE_TAP event received: tapCount=${tapState.tapCount}, timeDiff=${timeDiff}`)

                if (timeDiff < TOUCH_DOUBLE_TAP_TIMEOUT && tapState.tapCount === 1) {
                    console.log(`[Touch] DOUBLE_TAP detected! timeDiff=${timeDiff}`)
                    tapState.suppressTap = true
                    tapState.tapCount = 0
                    tapState.lastTapTime = 0
                    tapState.isProcessing = false
                    tapState.pendingTap = null
                    callback(result.event, result.pickedEntity?.id)

                    setTimeout(() => {
                        tapState.suppressTap = false
                        console.log('[Touch] suppressTap reset')
                    }, TOUCH_DOUBLE_TAP_TIMEOUT)
                }
                else {
                    tapState.tapCount = 1
                    tapState.lastTapTime = now
                    tapState.isProcessing = true
                    tapState.suppressTap = false
                    tapState.pendingTap = {event: result.event, pickedEntity: result.pickedEntity}
                    console.log(`[Touch] First tap for DOUBLE_TAP: time=${now}`)
                }
            }
        }

        // Handler for LONG_TAP
        if (this.events[eventType]?.type === 'LONG_TAP') {
            const downHandler = (event) => {
                const result = checkConditions(event)
                if (!result) {
                    return
                }

                console.log('[Touch] LONG_TAP down event received')
                tapState.longTapTimer = setTimeout(() => {
                    console.log('[Touch] LONG_TAP detected!')
                    tapState.suppressTap = true
                    tapState.tapCount = 0
                    tapState.lastTapTime = 0
                    tapState.isProcessing = false
                    tapState.pendingTap = null
                    callback(result.event, result.pickedEntity?.id)

                    setTimeout(() => {
                        tapState.suppressTap = false
                        console.log('[Touch] suppressTap reset')
                    }, TOUCH_DOUBLE_TAP_TIMEOUT)
                }, TOUCH_LONG_TAP_TIMEOUT)
            }

            const upHandler = (event) => {
                if (tapState.longTapTimer) {
                    clearTimeout(tapState.longTapTimer)
                    tapState.longTapTimer = null
                    console.log('[Touch] LONG_TAP timer cleared')
                }
            }

            return {downHandler, upHandler}
        }

        console.warn(`[Touch] Unsupported event type: ${eventType}`)
        return () => {
        }
    }

    // Remove an event listener
    off(eventName) {
        if (this.handlers.has(eventName)) {
            const handler = this.handlers.get(eventName)
            if (this.events[this.#parseEventName(eventName).eventType]?.type === 'LONG_TAP') {
                this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOWN, handler.downHandler)
                this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_UP, handler.upHandler)
            }
            else {
                this.screenSpaceEventHandler.removeInputAction(this.events[this.#parseEventName(eventName).eventType].event, handler)
            }
            this.handlers.delete(eventName)
            console.log(`[Touch] Handler removed for ${eventName}, total handlers=${this.handlers.size}`)
        }
    }

    // Destroy the event manager
    destroy() {
        this.handlers.forEach((handler, eventName) => {
            this.off(eventName)
        })
        this.screenSpaceEventHandler.destroy()
        this.instance = null;
        console.log('[Touch] CanvasEventManager singleton destroyed');
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
     * Registers an event listener for the specified event name.
     * @param {string} eventName - The event name, e.g., "TAP", "DOUBLE_TAP", "LONG_TAP".
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

        // Check for duplicate registration
        if (this.handlers.has(eventName)) {
            console.log(`[Touch] Event ${eventName} already registered, skipping duplicate`)
            return
        }

        // Parse the event name
        const {modifiers, eventType} = this.#parseEventName(eventName)
        console.log(`[Touch] Registering event: ${eventName}, type=${eventType}, isTouchDevice=${this.isTouchDevice}`)

        // Handle options
        if (typeof options === 'boolean') {
            options = {once: options}
        }
        const useEntity = options?.useEntity || false

        let handler
        if (this.isTouchDevice) {
            if (this.events[eventType]?.touch) {
                console.log(`[Touch] Setting up touch handler for ${eventType}`)
                handler = this.#setupTouchEvents(eventType, callback, useEntity, modifiers)
                if (this.events[eventType]?.type === 'LONG_TAP') {
                    console.log('[Touch] Binding LONG_TAP: LEFT_DOWN and LEFT_UP')
                    this.screenSpaceEventHandler.setInputAction(handler.downHandler, ScreenSpaceEventType.LEFT_DOWN)
                    this.screenSpaceEventHandler.setInputAction(handler.upHandler, ScreenSpaceEventType.LEFT_UP)
                }
                else {
                    console.log(`[Touch] Binding ${eventType}: LEFT_DOWN`)
                    this.screenSpaceEventHandler.setInputAction(handler, ScreenSpaceEventType.LEFT_DOWN)
                }
            }
            else {
                console.log(`[Touch] Skipping ${eventType}: not a touch event`)
                return
            }
        }
        else {
            if (!this.events[eventType]?.touch) {
                console.log(`[Touch] Setting up mouse handler for ${eventType}`)
                handler = this.#setupMouseEvents(eventType, callback, useEntity, modifiers)
                this.screenSpaceEventHandler.setInputAction(handler, this.events[eventType].event)
            }
            else {
                console.log(`[Touch] Skipping ${eventType}: touch-only event on non-touch device`)
                return
            }
        }

        // Store handler
        this.handlers.set(eventName, handler)
        console.log(`[Touch] Handler stored for ${eventName}, total handlers=${this.handlers.size}`)

        // If once is true, remove the listener after registration
        if (options.once) {
            this.off(eventName)
        }
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
     * @throws {Error} If eventName is invalid or eventType is unsupported.
     */
    on(eventName, callback, options = {}) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        // Check for duplicate registration
        if (this.handlers.has(eventName)) {
            console.log(`[Touch] Event ${eventName} already registered, skipping duplicate`)
            return
        }

        // Parse the event name
        const {modifiers, eventType} = this.#parseEventName(eventName)
        console.log(`[Touch] Registering event: ${eventName}, type=${eventType}, isTouchDevice=${this.isTouchDevice}`)

        // Handle options
        if (typeof options === 'boolean') {
            options = {once: options}
        }
        const useEntity = options?.useEntity || false

        let handler
        if (this.isTouchDevice) {
            if (this.events[eventType]?.touch) {
                console.log(`[Touch] Setting up touch handler for ${eventType}`)
                handler = this.#setupTouchEvents(eventType, callback, useEntity, modifiers)
                if (this.events[eventType]?.type === 'LONG_TAP') {
                    console.log('[Touch] Binding LONG_TAP: LEFT_DOWN and LEFT_UP')
                    this.screenSpaceEventHandler.setInputAction(handler.downHandler, ScreenSpaceEventType.LEFT_DOWN)
                    this.screenSpaceEventHandler.setInputAction(handler.upHandler, ScreenSpaceEventType.LEFT_UP)
                }
                else {
                    console.log(`[Touch] Binding ${eventType}: LEFT_DOWN`)
                    this.screenSpaceEventHandler.setInputAction(handler, ScreenSpaceEventType.LEFT_DOWN)
                }
            }
            else {
                console.log(`[Touch] Skipping ${eventType}: not a touch event`)
                return
            }
        }
        else {
            if (!this.events[eventType]?.touch) {
                console.log(`[Touch] Setting up mouse handler for ${eventType}`)
                handler = this.#setupMouseEvents(eventType, callback, useEntity, modifiers)
                this.screenSpaceEventHandler.setInputAction(handler, this.events[eventType].event)
            }
            else {
                console.log(`[Touch] Skipping ${eventType}: touch-only event on non-touch device`)
                return
            }
        }

        // Store handler
        this.handlers.set(eventName, handler)
        console.log(`[Touch] Handler stored for ${eventName}, total handlers=${this.handlers.size}`)

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
    #parseEventName = (eventName) => {
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