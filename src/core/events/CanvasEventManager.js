/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-01
 * Last modified: 2025-05-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { CESIUM_EVENTS, DOUBLE_TAP_DISTANCE, DOUBLE_TAP_TIMEOUT, LONG_TAP_TIMEOUT } from '@Core/constants'
import { EVENT_SEPARATOR }                                                          from '@Core/events/cesiumEvents'
import { ScreenSpaceEventHandler, ScreenSpaceEventType }                            from 'cesium'

/**
 * CanvasEventManager - Manages all types of Cesium mouse and touch events
 * with support for custom event handling, entity targeting, and event prioritization.
 */
export class CanvasEventManager {
    /**
     * Constructor
     * @param {Object} [viewer] - The Cesium viewer instance to use
     */
    constructor(viewer) {
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

        // Map to track Cesium event type to handlers
        this.cesiumEventHandlers = new Map()

        this.viewer = viewer

        if (!this.viewer) {
            console.warn('CanvasEventManager: No Cesium viewer provided')
        }

        // Modifier keys state
        this.modifierKeys = {
            ctrl:  false,
            alt:   false,
            shift: false,
        }

        // Constants for modifiers
        this.MODIFIER_KEYS = {
            CTRL:  'CTRL',
            ALT:   'ALT',
            SHIFT: 'SHIFT',
        }

        // Event types that don't need modifier combination versions
        this.SKIP_MODIFIERS_FOR = [
            this.events.MOUSE_MOVE,
            this.events.WHEEL,
            this.events.PINCH_START,
            this.events.PINCH_MOVE,
            this.events.PINCH_END,
        ]

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
        // Create bindings for keyboard event handlers
        this.handleKeyDown = (event) => {
            if (event.key === 'Control' || event.key === 'Meta') {
                this.modifierKeys.ctrl = true
            }
            else if (event.key === 'Alt') {
                this.modifierKeys.alt = true
            }
            else if (event.key === 'Shift') {
                this.modifierKeys.shift = true
            }
        }

        this.handleKeyUp = (event) => {
            if (event.key === 'Control' || event.key === 'Meta') {
                this.modifierKeys.ctrl = false
            }
            else if (event.key === 'Alt') {
                this.modifierKeys.alt = false
            }
            else if (event.key === 'Shift') {
                this.modifierKeys.shift = false
            }
        }

        this.handleWindowBlur = () => {
            this.modifierKeys.ctrl = false
            this.modifierKeys.alt = false
            this.modifierKeys.shift = false
        }

        // Track key down events
        document.addEventListener('keydown', this.handleKeyDown)

        // Track key up events
        document.addEventListener('keyup', this.handleKeyUp)

        // Reset keys when window loses focus
        window.addEventListener('blur', this.handleWindowBlur)
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
            // Create the handler function
            const handlerFunction = (event) => {
                const enrichedEvent = this.enrichEventWithModifiers(event)

                // Handle standard event
                this.handleEvent(type, enrichedEvent)

                // Handle modifier combination events
                this.handleModifierCombinationEvents(type, enrichedEvent)
            };

            // Store the handler function for later removal if needed
            this.cesiumEventHandlers.set(cesiumType, handlerFunction)

            // Set the input action
            this.screenSpaceEventHandler.setInputAction(handlerFunction, cesiumType)
        });

        // Special handling for custom touch events (tap, long tap, double tap)
        const leftDownHandler = (event) => {
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

                // Handle DOUBLE_TAP
                this.handleEvent(this.events.DOUBLE_TAP, enrichedEvent)

                // Also handle DOUBLE_TAP events with modifiers
                this.handleModifierCombinationEvents(this.events.DOUBLE_TAP, enrichedEvent)

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

                // Also handle LONG_TAP events with modifiers
                this.handleModifierCombinationEvents(this.events.LONG_TAP, enrichedEvent)

                this.tapTimer = null
            }, this.longTapTimeout)

            // Save current tap info for potential double tap detection
            this.lastTapTime = now
            this.lastTapPosition = position

            // Handle the standard LEFT_DOWN event
            this.handleEvent(this.events.LEFT_DOWN, enrichedEvent)

            // Also handle LEFT_DOWN events with modifiers
            this.handleModifierCombinationEvents(this.events.LEFT_DOWN, enrichedEvent)
        };

        // Store the handler for later removal
        this.cesiumEventHandlers.set(ScreenSpaceEventType.LEFT_DOWN, leftDownHandler)

        // Set the input action
        this.screenSpaceEventHandler.setInputAction(leftDownHandler, ScreenSpaceEventType.LEFT_DOWN)

        // Handle tap on mouse up
        const leftUpHandler = (event) => {
            const enrichedEvent = this.enrichEventWithModifiers(event)

            // Always handle the standard LEFT_UP event
            this.handleEvent(this.events.LEFT_UP, enrichedEvent)

            // Also handle LEFT_UP events with modifiers
            this.handleModifierCombinationEvents(this.events.LEFT_UP, enrichedEvent)

            if (this.tapTimer) {
                clearTimeout(this.tapTimer)
                const now = Date.now()

                // If it's a simple tap (not a long tap or double tap in progress)
                if (this.lastTapTime && (now - this.lastTapTime) < this.longTapTimeout) {
                    this.handleEvent(this.events.TAP, enrichedEvent)

                    // Also handle TAP events with modifiers
                    this.handleModifierCombinationEvents(this.events.TAP, enrichedEvent)
                }
                this.tapTimer = null
            }
        };

        // Store the handler for later removal
        this.cesiumEventHandlers.set(ScreenSpaceEventType.LEFT_UP, leftUpHandler)

        // Set the input action
        this.screenSpaceEventHandler.setInputAction(leftUpHandler, ScreenSpaceEventType.LEFT_UP)
    }

    /**
     * Removes an input action for a specific event type
     * Similar to Cesium's removeInputAction
     * @param {ScreenSpaceEventType} eventType - The Cesium event type to remove
     */
    removeInputAction(eventType) {
        if (this.screenSpaceEventHandler) {
            // Remove from Cesium's handler
            this.screenSpaceEventHandler.removeInputAction(eventType)

            // Remove from our internal tracking
            this.cesiumEventHandlers.delete(eventType)
        }
    }

    /**
     * Generates and triggers combination events with modifiers
     * @param {string} baseEventType - Base event type (e.g., LEFT_CLICK)
     * @param {Object} event - Event data
     */
    handleModifierCombinationEvents(baseEventType, event) {
        // Don't create combination events for certain event types
        if (this.SKIP_MODIFIERS_FOR.includes(baseEventType)) {
            return
        }

        const {ctrl, alt, shift} = event.modifiers

        // No modifiers pressed, no need to generate combinations
        if (!ctrl && !alt && !shift) {
            return
        }

        // Create modifier combinations
        const modifierParts = []
        if (ctrl) {
            modifierParts.push(this.MODIFIER_KEYS.CTRL)
        }
        if (alt) {
            modifierParts.push(this.MODIFIER_KEYS.ALT)
        }
        if (shift) {
            modifierParts.push(this.MODIFIER_KEYS.SHIFT)
        }

        // Create all possible combinations of modifiers
        const allCombinations = this.generateModifierCombinations(modifierParts)

        // Trigger events for each combination
        for (const combination of allCombinations) {
            const composedEventType = combination.join(EVENT_SEPARATOR) + EVENT_SEPARATOR + baseEventType
            this.handleEvent(composedEventType, event)
        }
    }

    /**
     * Generates all possible combinations of the active modifiers
     * @param {Array<string>} modifiers - List of active modifiers
     * @returns {Array<Array<string>>} - All possible combinations
     */
    generateModifierCombinations(modifiers) {
        if (modifiers.length === 0) {
            return []
        }
        if (modifiers.length === 1) {
            return [modifiers]
        }

        const result = []

        // Add each modifier individually
        for (const mod of modifiers) {
            result.push([mod])
        }

        // If 2 or more modifiers, add all possible combinations
        if (modifiers.length >= 2) {
            // Combination of 2 modifiers
            for (let i = 0; i < modifiers.length - 1; i++) {
                for (let j = i + 1; j < modifiers.length; j++) {
                    // Create two possible orders (e.g., CTRL_ALT and ALT_CTRL)
                    result.push([modifiers[i], modifiers[j]])
                    result.push([modifiers[j], modifiers[i]])
                }
            }
        }

        // If 3 modifiers, add all permutations
        if (modifiers.length === 3) {
            const [a, b, c] = modifiers
            result.push([a, b, c])
            result.push([a, c, b])
            result.push([b, a, c])
            result.push([b, c, a])
            result.push([c, a, b]);
            result.push([c, b, a]);
        }

        return result;
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
        const oneTimeSubscribers = []

        for (const subscriber of sortedSubscribers) {
            // Skip if this subscriber is for a specific entity that doesn't match
            if (subscriber.entity && (!pickedEntity || pickedEntity !== subscriber.entity)) {
                continue
            }

            // Execute callback
            subscriber.callback.call(
                subscriber.context || this,
                event,
                pickedEntity,
            )

            // Track one-time subscribers for removal after iteration
            if (subscriber.once) {
                oneTimeSubscribers.push(subscriber.id)
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

        // Remove all Cesium input actions
        if (this.screenSpaceEventHandler) {
            // Remove all registered event handlers
            for (const [eventType] of this.cesiumEventHandlers) {
                this.screenSpaceEventHandler.removeInputAction(eventType)
            }
            this.cesiumEventHandlers.clear()

            this.screenSpaceEventHandler.destroy()
            this.screenSpaceEventHandler = null
        }

        this.handlers.clear()
        this.viewer = null
    }
}