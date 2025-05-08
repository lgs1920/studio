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

import { DOUBLE_CLICK_TIMEOUT, DOUBLE_TAP_TIMEOUT, LONG_TAP_TIMEOUT } from '@Core/constants'
import { ScreenSpaceEventHandler }                                    from 'cesium'
import { CESIUM_EVENTS, MODIFIER_SEPARATOR, MODIFIERS }               from './cesiumEvents'

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
     * Handles errors and supports one-time listeners via the `once` option.
     *
     * @param {string} eventName - The event name (e.g., "CTRL#CLICK", "TAP").
     * @param {...any} args - Arguments to pass to the callbacks.
     * @private
     */
    #emit(eventName, ...args) {
        const handlers = this.#handlers.get(eventName)
        if (handlers) {
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
     * Sets up touch event handling for TAP, DOUBLE_TAP, and LONG_TAP.
     * @param {string} eventType - The event type (e.g., TAP, DOUBLE_TAP, LONG_TAP).
     * @param {Function} callback - Callback function to execute when the event is triggered.
     * @param {boolean} useEntity - Whether to require a picked entity for the event.
     * @returns {Object} An object containing downHandler and upHandler for touch events.
     * @private
     */
    #setupTouchEvents(eventType, callback, useEntity) {
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

            // Pick the entity at the event position
            const pickedEntity = this.#viewer.scene.pick(event.position)
            // Ensure a valid entity is selected if useEntity is true
            if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                return null
            }

            return pickedEntity
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
            if (this.#tapState.longTapTimer) {
                clearTimeout(this.#tapState.longTapTimer)
                this.#tapState.longTapTimer = null
            }

            // Start LONG_TAP timer
            this.#tapState.longTapTimer = setTimeout(() => {
                this.#tapState.suppressTap = true
                this.#emit('LONG_TAP', event, pickedEntity?.id)
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
                        this.#emit('TAP', event, pickedEntity?.id)
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
     * @param {Function} callback - Callback function to execute when the event is triggered.
     * @param {boolean} useEntity - Whether to require a picked entity.
     * @param {string[]} modifier - Required modifier keys.
     * @returns {Function} The event handler function.
     * @private
     */
    #setupMouseEvents(eventType, callback, useEntity, modifier) {
        let lastClickTime = 0
        let clickTimeout = null

        return (event) => {
            if (eventType === 'RIGHT_CLICK' && (this.isTouchDevice || event.pointerType === 'touch')) {
                return
            }

            const pickedEntity = this.#viewer.scene.pick(event.position)
            if (useEntity && (!pickedEntity || !pickedEntity.id)) {
                return
            }

            const now = Date.now()
            const timeDiff = now - lastClickTime
            lastClickTime = now

            const eventName = modifier ? `${modifier.name}${MODIFIER_SEPARATOR}${eventType}` : eventType

            if (eventName && this.#handlers.has(eventName)) {
                if (eventType === 'CLICK') {
                    clearTimeout(clickTimeout)
                    clickTimeout = setTimeout(() => {
                        if (timeDiff > DOUBLE_CLICK_TIMEOUT) {
                            this.#emit(eventName, event, pickedEntity?.id)
                        }
                    }, DOUBLE_CLICK_TIMEOUT + 50)
                }
                else if (eventType === 'DOUBLE_CLICK') {
                    clearTimeout(clickTimeout)
                    clickTimeout = null
                    this.#emit(eventName, event, pickedEntity?.id)
                }
                else if (eventType === 'RIGHT_CLICK') {
                    clearTimeout(clickTimeout)
                    this.#emit(eventName, event, pickedEntity?.id)
                }
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
     * @param {boolean} [options.useEntity=false] - Whether a picked entity is required.
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

        // Handle boolean options for backward compatibility
        if (typeof options === 'boolean') {
            options = {once: options}
        }
        const useEntity = options?.useEntity || false

        let handler
        if (this.isTouchDevice) {
            if (this.#events[eventType]?.touch) {
                handler = this.#setupTouchEvents(eventType, callback, useEntity)
                this.#screenSpaceEventHandler.setInputAction(handler.downHandler, this.#events.DOWN.event)
                this.#screenSpaceEventHandler.setInputAction(handler.upHandler, this.#events.UP.event)
            }
            else {
                return
            }
        }
        else {
            if (!this.#events[eventType]?.touch) {
                handler = this.#setupMouseEvents(eventType, callback, useEntity, modifier)
                // Only register handler if not already registered for this event type
                if (!this.#handlers.has(eventType)) {
                    if (modifier) {
                        this.#screenSpaceEventHandler.setInputAction(handler, this.#events[eventType].event, modifier)
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
        this.#handlers.get(eventName).push({handler, callback, options})

        // Handle one-time listeners
        if (options.once) {
            this.off(eventName, callback)
        }
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

        const removeHandler = (handler) => {
            if (eventType === 'LONG_TAP') {
                this.#screenSpaceEventHandler.removeInputAction(this.#events.DOWN.event, handler.downHandler)
                this.#screenSpaceEventHandler.removeInputAction(this.#events.UP.event, handler.upHandler)
            }
            else if (this.#events[eventType]) {
                this.#screenSpaceEventHandler.removeInputAction(this.#events[eventType].event, handler)
            }
        }

        const {eventType} = this.#parseEventName(eventName)
        const handlers = this.#handlers.get(eventName)

        if (callback) {
            const index = handlers.findIndex((h) => h.callback === callback)
            if (index !== -1) {
                removeHandler(handlers[index])
                handlers.splice(index, 1)
            }
        }
        else {
            handlers.forEach(({handler}) => {
                removeHandler(handler)
            })
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
}