/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-04-30
 * Last modified: 2025-04-30
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { CESIUM_EVENTS, DOUBLE_TAP_DISTANCE, DOUBLE_TAP_TIMEOUT, LONG_TAP_TIMEOUT } from '@Core/constants'
import { ScreenSpaceEventHandler, ScreenSpaceEventType }                            from 'cesium'

/**
 * CesiumEventManager - Manages all types of Cesium mouse and touch events
 * with support for custom event handling, entity targeting, and propagation control.
 */
export class CanvasEventManager {
    /**
     * Constructor
     */
    constructor() {
        // Singleton pattern
        if (CanvasEventManager.instance) {
            return CanvasEventManager.instance
        }

        this.events = CESIUM_EVENTS
        this.handlers = new Map()
        this.longTapTimeout = LONG_TAP_TIMEOUT
        this.doubleTapTimeout = DOUBLE_TAP_TIMEOUT
        this.lastTapTime = 0
        this.lastTapPosition = null
        this.maxDoubleTapDistance = DOUBLE_TAP_DISTANCE
        this.tapTimer = null
        this.subscriptionId = 0

        // Modifier keys state
        this.modifierKeys = {
            ctrl:  false,
            alt:   false,
            shift: false,
        }

        // Track modifier keys
        this.setupModifierKeysTracking()

        // Initialize event handlers
        this.setupEventHandlers()

        // Store instance
        CanvasEventManager.instance = this
    }

    /**
     * Setup tracking for modifier keys (Ctrl, Alt, Shift)
     */
    setupModifierKeysTracking() {
        // Track key down events
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Control' || event.key === 'Meta') {
                this.modifierKeys.ctrl = true
            }
            else if (event.key === 'Alt') {
                this.modifierKeys.alt = true
            }
            else if (event.key === 'Shift') {
                this.modifierKeys.shift = true
            }
        })

        // Track key up events
        document.addEventListener('keyup', (event) => {
            if (event.key === 'Control' || event.key === 'Meta') {
                this.modifierKeys.ctrl = false
            }
            else if (event.key === 'Alt') {
                this.modifierKeys.alt = false
            }
            else if (event.key === 'Shift') {
                this.modifierKeys.shift = false
            }
        })

        // Reset keys when window loses focus
        window.addEventListener('blur', () => {
            this.modifierKeys.ctrl = false
            this.modifierKeys.alt = false
            this.modifierKeys.shift = false
        })
    }

    /**
     * Setup all event handlers for Cesium
     */
    setupEventHandlers() {
        // Create a screen space event handler for our viewer
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(lgs.viewer.canvas)

        // Map of Cesium standard events
        const cesiumEvents = [
            {type: this.events.LEFT_CLICK, cesiumType: ScreenSpaceEventType.LEFT_CLICK},
            {type: this.events.LEFT_DOUBLE_CLICK, cesiumType: ScreenSpaceEventType.LEFT_DOUBLE_CLICK},
            {type: this.events.RIGHT_DOWN, cesiumType: ScreenSpaceEventType.RIGHT_DOWN},
            {type: this.events.RIGHT_UP, cesiumType: ScreenSpaceEventType.RIGHT_UP},
            {type: this.events.RIGHT_CLICK, cesiumType: ScreenSpaceEventType.RIGHT_CLICK},
            {type: this.events.MIDDLE_DOWN, cesiumType: ScreenSpaceEventType.MIDDLE_DOWN},
            {type: this.events.MIDDLE_UP, cesiumType: ScreenSpaceEventType.MIDDLE_UP},
            {type: this.events.MIDDLE_CLICK, cesiumType: ScreenSpaceEventType.MIDDLE_CLICK},
            {type: this.events.MOUSE_MOVE, cesiumType: ScreenSpaceEventType.MOUSE_MOVE},
            {type: this.events.WHEEL, cesiumType: ScreenSpaceEventType.WHEEL},
            {type: this.events.PINCH_START, cesiumType: ScreenSpaceEventType.PINCH_START},
            {type: this.events.PINCH_MOVE, cesiumType: ScreenSpaceEventType.PINCH_MOVE},
            {type: this.events.PINCH_END, cesiumType: ScreenSpaceEventType.PINCH_END},
        ]

        // Setup handlers for standard events
        cesiumEvents.forEach(({type, cesiumType}) => {
            this.screenSpaceEventHandler.setInputAction((event) => {
                this.handleEvent(type, this.enrichEventWithModifiers(event))
            }, cesiumType)
        })

        // Special handling for custom touch events (tap, long tap, double tap)
        this.screenSpaceEventHandler.setInputAction((event) => {
            const now = Date.now()
            const position = event.position || {x: 0, y: 0}
            const enrichedEvent = this.enrichEventWithModifiers(event)

            // Check if it's a double tap
            if (this.lastTapTime && (now - this.lastTapTime) < this.doubleTapTimeout &&
                this.lastTapPosition && this.isWithinDistance(position, this.lastTapPosition)) {
                // It's a double tap
                if (this.tapTimer) {
                    clearTimeout(this.tapTimer)
                    this.tapTimer = null
                }
                this.handleEvent(this.events.DOUBLE_TAP, enrichedEvent)
                this.lastTapTime = 0
                this.lastTapPosition = null
                return
            }

            // Clear any existing timer to avoid memory leaks
            if (this.tapTimer) {
                clearTimeout(this.tapTimer)
            }

            // Start timer for long tap detection
            this.tapTimer = setTimeout(() => {
                this.handleEvent(this.events.LONG_TAP, enrichedEvent)
                this.tapTimer = null
            }, this.longTapTimeout)

            // Save current tap info for potential double tap detection
            this.lastTapTime = now
            this.lastTapPosition = position

            // Handle the standard LEFT_DOWN event
            this.handleEvent(this.events.LEFT_DOWN, enrichedEvent)
        }, ScreenSpaceEventType.LEFT_DOWN)

        // Handle tap on mouse up
        this.screenSpaceEventHandler.setInputAction((event) => {
            const enrichedEvent = this.enrichEventWithModifiers(event)

            // Always handle the standard LEFT_UP event
            this.handleEvent(this.events.LEFT_UP, enrichedEvent)

            if (this.tapTimer) {
                clearTimeout(this.tapTimer)
                const now = Date.now()

                // If it's a simple tap (not a long tap or double tap in progress)
                if (this.lastTapTime && (now - this.lastTapTime) < this.longTapTimeout) {
                    this.handleEvent(this.events.TAP, enrichedEvent)
                }
                this.tapTimer = null
            }
        }, ScreenSpaceEventType.LEFT_UP)
    }

    /**
     * Enrich an event with modifier key states
     * @param {Object} event - Original event
     * @returns {Object} Enriched event with modifier key states
     */
    enrichEventWithModifiers(event) {
        return {
            ...event,
            modifiers: {...this.modifierKeys},
        }
    }

    /**
     * Check if two positions are within the maximum distance for a double tap
     * @param {Object} pos1 - First position {x, y}
     * @param {Object} pos2 - Second position {x, y}
     * @returns {boolean} True if within distance
     */
    isWithinDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x
        const dy = pos1.y - pos2.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        return distance <= this.maxDoubleTapDistance
    }

    /**
     * Handle an event by notifying all subscribers
     * @param {string} eventType - Type of event
     * @param {Object} event - Event data
     */
    handleEvent(eventType, event) {
        if (!this.handlers.has(eventType)) {
            return
        }

        const subscribers = this.handlers.get(eventType)
        if (!subscribers || subscribers.length === 0) {
            return
        }

        // Get picked entity if position is available
        let pickedEntity = null
        if (event.position) {
            const pick = lgs.viewer.scene.pick(event.position)
            if (pick && pick.id) {
                pickedEntity = pick.id
            }
        }

        // Sort subscribers by priority
        const sortedSubscribers = [...subscribers].sort((a, b) => a.priority - b.priority)

        // Process subscribers in order
        let shouldPropagate = true
        const oneTimeSubscribers = []

        for (const subscriber of sortedSubscribers) {
            // Skip if this subscriber is for a specific entity that doesn't match
            if (subscriber.entity && (!pickedEntity || pickedEntity !== subscriber.entity)) {
                continue
            }

            // Skip if modifiers don't match
            if (subscriber.modifiers) {
                const {ctrl, alt, shift} = subscriber.modifiers

                // Skip if any required modifier isn't pressed
                if ((ctrl === true && !event.modifiers.ctrl) ||
                    (alt === true && !event.modifiers.alt) ||
                    (shift === true && !event.modifiers.shift)) {
                    continue
                }

                // Skip if any forbidden modifier is pressed
                if ((ctrl === false && event.modifiers.ctrl) ||
                    (alt === false && event.modifiers.alt) ||
                    (shift === false && event.modifiers.shift)) {
                    continue
                }
            }

            // Execute callback
            const result = subscriber.callback.call(
                subscriber.context || this,
                event,
                pickedEntity,
            )

            // Handle propagation
            if (result === false || subscriber.propagate === false) {
                shouldPropagate = false
            }

            // Track one-time subscribers for removal after iteration
            if (subscriber.once) {
                oneTimeSubscribers.push(subscriber.id)
            }

            // Stop if we shouldn't propagate
            if (!shouldPropagate) {
                break
            }
        }

        // Remove one-time subscribers after processing all events
        for (const id of oneTimeSubscribers) {
            this.removeEventListener(eventType, id)
        }
    }

    /**
     * Add an event listener - DOM-like API
     * @param {string} eventType - Event type to subscribe to
     * @param {Function} callback - Callback function
     * @param {Object|boolean} [options] - Subscription options or boolean for once
     * @param {Object} [options.entity] - Entity to filter for
     * @param {boolean} [options.propagate=true] - Whether to propagate to other handlers
     * @param {boolean} [options.once=false] - Whether to handle only once
     * @param {number} [options.priority=100] - Priority (lower = higher priority)
     * @param {Object} [options.context] - Context (this) for callback
     * @param {Object} [options.modifiers] - Modifier key requirements
     * @param {boolean} [options.modifiers.ctrl] - Ctrl key state (true=required, false=forbidden, undefined=don't
     *     care)
     * @param {boolean} [options.modifiers.alt] - Alt key state (true=required, false=forbidden, undefined=don't care)
     * @param {boolean} [options.modifiers.shift] - Shift key state (true=required, false=forbidden, undefined=don't
     *     care)
     * @returns {string} Subscription ID that can be used to remove the listener
     */
    addEventListener(eventType, callback, options = {}) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, [])
        }

        // Handle addEventListener(event, callback, true) syntax for once
        let parsedOptions = options
        if (typeof options === 'boolean') {
            parsedOptions = {once: options}
        }

        const id = `sub_${++this.subscriptionId}`

        const subscriber = {
            id,
            callback,
            entity:    parsedOptions.entity || null,
            propagate: parsedOptions.propagate !== false,
            once:      parsedOptions.once === true,
            priority:  parsedOptions.priority || 100,
            context:   parsedOptions.context || null,
            modifiers: parsedOptions.modifiers,
        }

        this.handlers.get(eventType).push(subscriber)
        return id
    }

    /**
     * Shorthand for addEventListener
     * @param {string} eventType - Event type
     * @param {Function} callback - Callback function
     * @param {Object|boolean} [options] - Options object or boolean for once
     * @returns {string} Subscription ID
     */
    on(eventType, callback, options = {}) {
        return this.addEventListener(eventType, callback, options)
    }

    /**
     * Remove an event listener
     * @param {string} eventType - Event type
     * @param {string|Function} subscriptionOrCallback - Subscription ID or callback function
     * @returns {boolean} True if successfully removed
     */
    removeEventListener(eventType, subscriptionOrCallback) {
        if (!this.handlers.has(eventType)) {
            return false
        }

        const subscribers = this.handlers.get(eventType)
        const initialCount = subscribers.length

        if (typeof subscriptionOrCallback === 'string') {
            // Unsubscribe by ID
            const newSubscribers = subscribers.filter(sub => sub.id !== subscriptionOrCallback)
            this.handlers.set(eventType, newSubscribers)
        }
        else if (typeof subscriptionOrCallback === 'function') {
            // Unsubscribe by callback reference
            const newSubscribers = subscribers.filter(sub => sub.callback !== subscriptionOrCallback)
            this.handlers.set(eventType, newSubscribers)
        }

        return this.handlers.get(eventType).length < initialCount
    }

    /**
     * Shorthand for removeEventListener
     * @param {string} eventType - Event type
     * @param {string|Function} subscriptionOrCallback - Subscription ID or callback
     * @returns {boolean} True if successfully removed
     */
    off(eventType, subscriptionOrCallback) {
        return this.removeEventListener(eventType, subscriptionOrCallback)
    }

    /**
     * Remove all listeners for an event type or all events
     * @param {string} [eventType] - Event type to clear, if omitted all events are cleared
     */
    removeAllEventListeners(eventType) {
        if (eventType) {
            this.handlers.set(eventType, [])
        }
        else {
            this.handlers.clear()
        }
    }

    /**
     * Get count of listeners for an event type
     * @param {string} eventType - Event type
     * @returns {number} Number of listeners
     */
    listenerCount(eventType) {
        if (!this.handlers.has(eventType)) {
            return 0
        }
        return this.handlers.get(eventType).length
    }

    /**
     * Get all registered subscribers for an event type
     * @param {string} eventType - Event type
     * @returns {Array} Array of subscribers
     */
    getEventListeners(eventType) {
        if (!this.handlers.has(eventType)) {
            return []
        }
        return [...this.handlers.get(eventType)]
    }

    /**
     * Check if an entity is currently targeted by an event
     * @param {string} eventType - Event type
     * @param {Object} entity - Entity to check
     * @returns {boolean} True if entity has subscriptions
     */
    hasEntitySubscriptions(eventType, entity) {
        if (!this.handlers.has(eventType)) {
            return false
        }

        return this.handlers.get(eventType).some(sub => sub.entity === entity)
    }

    /**
     * Propagate an event to canvas
     * Similar to the propagateEventToCanvas function in SceneUtils
     * @param {Event} event - Event to propagate
     */
    propagateEventToCanvas(event) {
        // Create a clone of the event
        const NativeEvent = event?.nativeEvent?.constructor ?? event.constructor
        const clone = new NativeEvent(event.type, event)
        clone.preventDefault()
        event.stopPropagation()

        // Propagate to Cesium canvas
        lgs.viewer.canvas.dispatchEvent(clone)
    }

    /**
     * Dispatch an event manually
     * @param {string} eventType - Type of event to dispatch
     * @param {Object} eventData - Event data to pass to handlers
     */
    dispatchEvent(eventType, eventData = {}) {
        const enrichedEvent = this.enrichEventWithModifiers(eventData)
        this.handleEvent(eventType, enrichedEvent)
    }

    /**
     * Check if Ctrl key is currently pressed
     * @returns {boolean} True if Ctrl key is pressed
     */
    isCtrlKeyPressed() {
        return this.modifierKeys.ctrl
    }

    /**
     * Check if Alt key is currently pressed
     * @returns {boolean} True if Alt key is pressed
     */
    isAltKeyPressed() {
        return this.modifierKeys.alt
    }

    /**
     * Check if Shift key is currently pressed
     * @returns {boolean} True if Shift key is pressed
     */
    isShiftKeyPressed() {
        return this.modifierKeys.shift
    }

    /**
     * Destroy the event manager and clean up all resources
     */
    destroy() {
        // Remove global event listeners
        document.removeEventListener('keydown', this.handleKeyDown)
        document.removeEventListener('keyup', this.handleKeyUp)
        window.removeEventListener('blur', this.handleWindowBlur)

        if (this.screenSpaceEventHandler) {
            this.screenSpaceEventHandler.destroy()
            this.screenSpaceEventHandler = null
        }

        this.handlers.clear()
        lgs.viewer = null
    }
}