/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-05
 * Last modified: 2025-05-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium'

/**
 * CanvasEventManager - Manages all types of Cesium mouse and touch events
 * with support for custom event handling, entity targeting, and event prioritization.
 *
 * @class
 * @property {Cesium.Viewer} viewer - The Cesium viewer instance
 * @property {Object} events - Dictionary of supported event types
 * @property {Object} modifierKeys - Tracks the state of modifier keys
 * @property {number} doubleTapTimeout - Milliseconds to wait for double tap/click detection
 * @property {number} longTapTimeout - Milliseconds to wait before triggering long tap
 * @property {Object} touchStartPosition - Starting position for touch events
 * @property {number} touchStartTime - Timestamp when touch started
 * @property {number} touchMoveThreshold - Pixel distance threshold to cancel a long tap
 * @property {Map} eventListeners - Maps event types to listener callbacks
 * @property {Map} cesiumEventHandlers - Maps Cesium event types to handler functions
 * @property {boolean} isTouchDevice - Whether the device supports touch input
 * @property {Object} selectedEntity - Currently selected Cesium entity
 */


export class CanvasEventManager {
    /**
     * Create a new canvas event manager
     * @param {Cesium.Viewer} viewer - The Cesium viewer instance
     */
    constructor(viewer) {
        // Store the viewer reference
        this.viewer = viewer

        // Define standard event types
        this.events = {
            LEFT_DOWN:         'leftDown',
            LEFT_UP:           'leftUp',
            LEFT_CLICK:        'leftClick',
            LEFT_DOUBLE_CLICK: 'leftDoubleClick',
            RIGHT_DOWN:        'rightDown',
            RIGHT_UP:          'rightUp',
            RIGHT_CLICK:       'rightClick',
            MIDDLE_DOWN:       'middleDown',
            MIDDLE_UP:         'middleUp',
            MIDDLE_CLICK:      'middleClick',
            MOUSE_MOVE:        'mouseMove',
            WHEEL:             'wheel',
            TAP:               'tap',
            DOUBLE_TAP:        'doubleTap',
            LONG_TAP:          'longTap',
            PINCH_START:       'pinchStart',
            PINCH_MOVE:        'pinchMove',
            PINCH_END:         'pinchEnd',
        }

        // For modifier combinations
        this.modifierKeys = {
            ctrl:  false,
            shift: false,
            alt:   false,
        }

        // For timing detection
        this.doubleTapTimeout = 300 // ms
        this.longTapTimeout = 500 // ms

        // For long tap detection
        this.touchStartPosition = null
        this.touchStartTime = 0
        this.longTapTimer = null
        this.longTapDetected = false

        // For movement detection
        this.touchMoveThreshold = 10 // pixels

        // Event listeners and handlers
        this.eventListeners = new Map() // Maps event type to array of handlers
        this.cesiumEventHandlers = new Map() // Maps Cesium event type to handler function
        this.screenSpaceEventHandler = null

        // Click and tap detection
        this.lastClickTime = 0
        this.lastTapTime = 0
        this.pendingClickTimer = null
        this.pendingTapTimer = null
        this.blockNextClick = false
        this.blockNextTap = false

        // Try to detect if we're on a touch device
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

        // Enhanced touch detection for mobile simulation
        this.lastTouchActivity = 0
        this.inMobileEmulation = false

        // Check if we're in mobile emulation when the app starts
        const userAgent = navigator.userAgent.toLowerCase()
        const mobilePatterns = ['android', 'iphone', 'ipad', 'mobile', 'touch']
        this.inMobileEmulation = mobilePatterns.some(pattern => userAgent.includes(pattern))

        // If in mobile emulation, set touch device flag
        if (this.inMobileEmulation) {
            this.isTouchDevice = true
            console.log('Mobile emulation detected, treating all events as touch events')
        }

        // Track entity selection
        this.selectedEntity = null

        // Set up key event listeners for modifiers
        this.setupKeyHandlers()

        // Set up the Cesium event handlers
        if (this.viewer && this.viewer.canvas) {
            this.setupEventHandlers()
        }
    }

    /**
     * Set up handlers for keyboard events to track modifier keys
     */
    setupKeyHandlers() {
        // Fonction pour enregistrer l'état des touches modificatrices
        const trackModifierState = (event, isKeyDown) => {
            // Enregistrer l'état précédent pour détecter les changements
            const prevState = {...this.modifierKeys}

            // Mettre à jour l'état en fonction de la touche
            if (event.key === 'Control' || event.key === 'Meta' || event.keyCode === 17) {
                this.modifierKeys.ctrl = isKeyDown
            }
            else if (event.key === 'Shift' || event.keyCode === 16) {
                this.modifierKeys.shift = isKeyDown
            }
            else if (event.key === 'Alt' || event.keyCode === 18) {
                this.modifierKeys.alt = isKeyDown
            }

        }

        // Listen for keydown events to track modifier keys
        window.addEventListener('keydown', (event) => {
            trackModifierState(event, true)
        }, true) // Utiliser la phase de capture pour capturer avant tout autre gestionnaire

        // Listen for keyup events to track modifier keys
        window.addEventListener('keyup', (event) => {
            trackModifierState(event, false)
        }, true) // Utiliser la phase de capture

        // Clear modifiers when window loses focus
        window.addEventListener('blur', () => {
            this.modifierKeys.ctrl = false
            this.modifierKeys.shift = false
            this.modifierKeys.alt = false
        })

    }

    
    /**
     * Add event-specific properties based on modifier keys
     * @param {Object} event - The event object
     * @returns {Object} - Enriched event object
     */

    /**
     * Add event-specific properties based on modifier keys
     * @param {Object} event - The event object
     * @param {string} eventName - The explicit name of the event (LEFT_CLICK, RIGHT_CLICK, etc.)
     * @returns {Object} - Enriched event object
     */
    enrichEventWithModifiers(event, eventName = null) {
        // Get dynamic touch state that considers emulation
        const isTouch = this.detectTouchEvent()

        // If this is a touch event, update the last touch activity time
        if (isTouch) {
            this.lastTouchActivity = Date.now()
        }

        let ctrlKey = false
        let shiftKey = false
        let altKey = false

        // Check Cesium object
        if (event) {
            ctrlKey = ctrlKey || Boolean(event.ctrlKey)
            shiftKey = shiftKey || Boolean(event.shiftKey)
            altKey = altKey || Boolean(event.altKey)

            if (event.modifier) {
                ctrlKey = ctrlKey || Boolean(event.modifier.ctrl)
                shiftKey = shiftKey || Boolean(event.modifier.shift)
                altKey = altKey || Boolean(event.modifier.alt)
            }

            // 3. Vérifier l'événement d'origine s'il existe
            if (event.originalEvent) {
                ctrlKey = ctrlKey || Boolean(event.originalEvent.ctrlKey)
                shiftKey = shiftKey || Boolean(event.originalEvent.shiftKey)
                altKey = altKey || Boolean(event.originalEvent.altKey)
            }
        }

        // use fallback if we do not have anything
        ctrlKey = ctrlKey || this.modifierKeys.ctrl
        shiftKey = shiftKey || this.modifierKeys.shift
        altKey = altKey || this.modifierKeys.alt

        // Déterminer le type d'événement
        let eventType = 'unknown'

        // Utiliser le nom d'événement fourni explicitement si disponible
        if (eventName) {
            eventType = eventName
        }
        // Essayer de déduire le type à partir de la structure de l'événement
        else if (event) {
            if (event.type) {
                // Si l'événement a une propriété type explicite, l'utiliser
                eventType = event.type
            }
            else if (event.position) {
                // Événement de position (probablement un clic)
                if (event.startPosition && event.endPosition) {
                    eventType = eventName ?? 'MOUSE_MOVE'
                }
                else {
                    eventType = eventName ?? 'CLICK'
                }
            }
            else if (event.direction) {
                // Événement de molette
                eventType = 'WHEEL'
            }
            else if (event.dropTarget) {
                eventType = 'DROP'
            }
        }

        console.log('Modifier keys detected:', {
            ctrl:      ctrlKey,
            shift:     shiftKey,
            alt:       altKey,
            eventType: eventType,
            eventName: eventName,
        })

        const enrichedEvent = {
            ...event,
            ctrl:              ctrlKey,
            alt:               altKey,
            shift:             shiftKey,
            isTouchEvent:      isTouch,
            inMobileEmulation: this.inMobileEmulation,
        }

        return enrichedEvent
    }
    /**
     * Setup all event handlers for Cesium
     */
    setupEventHandlers() {
        // Create a screen space event handler for our viewer
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this.viewer.canvas)

        // Remove default handlers to implement our own
        this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK)
        this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

        // Map of Cesium standard events that don't need special handling
        const standardEvents = [
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
        standardEvents.forEach(({type, cesiumType}) => {
            // Create the handler function
            const handlerFunction = (event) => {
                console.log({type, cesiumType})
                const enrichedEvent = this.enrichEventWithModifiers(event, type)

                // Handle standard event
                this.handleEvent(type, enrichedEvent)

                // Handle modifier combination events
                this.handleModifierCombinationEvents(type, enrichedEvent)
            }

            // Store the handler function for later removal if needed
            this.cesiumEventHandlers.set(cesiumType, handlerFunction)

            // Set the input action
            this.screenSpaceEventHandler.setInputAction(handlerFunction, cesiumType)
        })

        // Special handling for RIGHT_DOWN
        this.screenSpaceEventHandler.setInputAction((event) => {
            const enrichedEvent = this.enrichEventWithModifiers(event, this.events.RIGHT_DOWN)

            // Only handle if not a touch event (prevents duplicate events on long tap)
            if (!enrichedEvent.isTouchEvent) {
                this.handleEvent(eventName, enrichedEvent)
                this.handleModifierCombinationEvents(this.events.RIGHT_DOWN, enrichedEvent)
            }
        }, ScreenSpaceEventType.RIGHT_DOWN)

        // Special handling for RIGHT_UP
        this.screenSpaceEventHandler.setInputAction((event) => {
            const enrichedEvent = this.enrichEventWithModifiers(event, this.events.RIGHT_UP)

            // Only handle if not a touch event (prevents duplicate events on long tap)
            if (!enrichedEvent.isTouchEvent) {
                this.handleEvent(this.events.RIGHT_UP, enrichedEvent)
                this.handleModifierCombinationEvents(this.events.RIGHT_UP, enrichedEvent)
            }
        }, ScreenSpaceEventType.RIGHT_UP)

        // Special handling for LEFT_DOWN - mark touch start for long tap detection
        this.screenSpaceEventHandler.setInputAction((event) => {
            // Determine if this is a touch event
            const isTouch = this.detectTouchEvent()
            console.log(event)

            // Enrich event
            const enrichedEvent = {
                ...this.enrichEventWithModifiers(event), //TODO SI isTouch
                isTouch: isTouch,
            }

            // Fire the standard LEFT_DOWN event
            this.handleEvent(this.events.LEFT_DOWN, enrichedEvent)
            this.handleModifierCombinationEvents(this.events.LEFT_DOWN, enrichedEvent)

            // For touch events, start tracking for long tap
            if (isTouch) {
                // Clear any existing long tap timer
                if (this.longTapTimer) {
                    clearTimeout(this.longTapTimer)
                }

                // Store start time and position
                this.touchStartTime = Date.now()
                this.touchStartPosition = event.position ? {...event.position} : null

                // Start long tap timer
                this.longTapTimer = setTimeout(() => {
                    // If we still have touch information, trigger long tap
                    if (this.touchStartPosition) {
                        // Create event data for long tap
                        const longTapEvent = {
                            ...enrichedEvent,
                            position: this.touchStartPosition,
                        }

                        // Dispatch long tap event
                        this.handleEvent(this.events.LONG_TAP, longTapEvent)
                        this.handleModifierCombinationEvents(this.events.LONG_TAP, longTapEvent)

                        // Mark that we've processed this touch as a long tap
                        this.blockNextTap = true
                        this.longTapDetected = true

                        // Clear start position to prevent further processing
                        this.touchStartPosition = null
                    }
                }, this.longTapTimeout)
            }
        }, ScreenSpaceEventType.LEFT_DOWN)

        // Add handler for RIGHT_CLICK to prevent it from firing on long taps
        this.screenSpaceEventHandler.setInputAction((event) => {
            // Get touch state
            const isTouch = this.detectTouchEvent()
            const enrichedEvent = this.enrichEventWithModifiers(event)

            // If touch event and long tap detected, don't fire right click
            if (isTouch && this.longTapDetected) {
                // Skip right click, we already handled as long tap
                this.longTapDetected = false
                return
            }

            // Handle right click for mouse events
            if (!isTouch) {
                this.handleEvent(this.events.RIGHT_CLICK, enrichedEvent)
                this.handleModifierCombinationEvents(this.events.RIGHT_CLICK, enrichedEvent)
            }
        }, ScreenSpaceEventType.RIGHT_CLICK)

        // Track mouse/touch movement to cancel long tap if moved
        this.screenSpaceEventHandler.setInputAction((event) => {
            // If we have a pending long tap and we've moved too far, cancel it
            if (this.touchStartPosition && event.endPosition) {
                const dx = this.touchStartPosition.x - event.endPosition.x
                const dy = this.touchStartPosition.y - event.endPosition.y
                const distance = Math.sqrt(dx * dx + dy * dy)

                // If moved beyond threshold, cancel long tap
                if (distance > this.touchMoveThreshold) {
                    clearTimeout(this.longTapTimer)
                    this.longTapTimer = null
                    this.touchStartPosition = null
                }
            }

            // Process the move event normally
            const enrichedEvent = this.enrichEventWithModifiers(event)
            this.handleEvent(this.events.MOUSE_MOVE, enrichedEvent)
            this.handleModifierCombinationEvents(this.events.MOUSE_MOVE, enrichedEvent)
        }, ScreenSpaceEventType.MOUSE_MOVE)

        // Special handling for LEFT_UP - detect movement and cancel long tap if needed
        this.screenSpaceEventHandler.setInputAction((event) => {
            // Clear long tap timer since touch has ended
            if (this.longTapTimer) {
                clearTimeout(this.longTapTimer)
                this.longTapTimer = null
            }

            // Determine if this is a touch event
            const isTouch = this.detectTouchEvent()

            // Enrich event
            const enrichedEvent = {
                ...this.enrichEventWithModifiers(event),
                isTouch: isTouch,
            }

            // Fire the standard LEFT_UP event
            this.handleEvent(this.events.LEFT_UP, enrichedEvent)
            this.handleModifierCombinationEvents(this.events.LEFT_UP, enrichedEvent)

            // If we detected a long tap, don't process as tap/click
            if (this.longTapDetected) {
                this.longTapDetected = false
                this.touchStartPosition = null
                return
            }

            // Using strict separation for mouse vs touch event streams
            if (isTouch) {
                // TOUCH EVENTS ONLY
                this.handleTouchEvents(enrichedEvent)
            }
            else {
                // MOUSE EVENTS ONLY
                this.handleMouseEvents(enrichedEvent)
            }

            // Clear touch start position
            this.touchStartPosition = null
        }, ScreenSpaceEventType.LEFT_UP)
    }

    /**
     * Handle touch-specific event processing (tap, double-tap)
     */
    handleTouchEvents(enrichedEvent) {
        // Update touch activity timestamp
        this.lastTouchActivity = Date.now()

        // Only proceed if not blocking
        if (this.blockNextTap) {
            this.blockNextTap = false
            return
        }

        const now = Date.now()
        const timeDiff = now - this.lastTapTime
        const isDoubleTap = this.lastTapTime > 0 && timeDiff <= this.doubleTapTimeout

        if (isDoubleTap) {
            // This is a double tap
            this.handleEvent(this.events.DOUBLE_TAP, enrichedEvent)
            this.handleModifierCombinationEvents(this.events.DOUBLE_TAP, enrichedEvent)

            // Reset tap timer
            this.lastTapTime = 0

            // Clear any pending taps
            clearTimeout(this.pendingTapTimer)
        }
        else {
            // Record the tap for potential double-tap
            this.lastTapTime = now

            // Schedule single tap after waiting for potential double
            clearTimeout(this.pendingTapTimer)
            this.pendingTapTimer = setTimeout(() => {
                // Only fire if we haven't detected a double-tap
                if (this.lastTapTime > 0 && this.lastTapTime === now) {
                    this.handleEvent(this.events.TAP, enrichedEvent)
                    this.handleModifierCombinationEvents(this.events.TAP, enrichedEvent)
                    this.lastTapTime = 0
                }
            }, this.doubleTapTimeout + 10)
        }
    }

    /**
     * Handle mouse-specific event processing (click, double-click)
     */
    handleMouseEvents(enrichedEvent) {
        // Only proceed if not blocking
        if (this.blockNextClick) {
            this.blockNextClick = false
            return
        }

        const now = Date.now()
        const timeDiff = now - this.lastClickTime
        const isDoubleClick = this.lastClickTime > 0 && timeDiff <= this.doubleTapTimeout

        if (isDoubleClick) {
            // This is a double click
            this.handleEvent(this.events.LEFT_DOUBLE_CLICK, enrichedEvent)
            this.handleModifierCombinationEvents(this.events.LEFT_DOUBLE_CLICK, enrichedEvent)

            // Reset click timer
            this.lastClickTime = 0

            // Clear any pending clicks
            clearTimeout(this.pendingClickTimer)
        }
        else {
            // Record the click for potential double-click
            this.lastClickTime = now

            // Schedule single click after waiting for potential double
            clearTimeout(this.pendingClickTimer)
            this.pendingClickTimer = setTimeout(() => {
                // Only fire if we haven't detected a double-click
                if (this.lastClickTime > 0) {
                    this.handleEvent(this.events.LEFT_CLICK, enrichedEvent)
                    this.handleModifierCombinationEvents(this.events.LEFT_CLICK, enrichedEvent)
                    this.lastClickTime = 0
                }
            }, this.doubleTapTimeout + 10)
        }
    }

    /**
     * Parse an event type string that may include modifiers
     * @param {string} eventType - Event type string (e.g., 'ctrl+shift+leftClick')
     * @returns {Object} Object with baseEvent and modifiers properties
     */
    parseEventType(eventType) {
        // Default result with no modifiers
        const result = {
            baseEvent: eventType,
            modifiers: {
                ctrl:  false,
                alt:   false,
                shift: false,
            },
        }

        // Check if the event type contains modifiers
        if (eventType.includes('+')) {
            const parts = eventType.split('+')

            // Last part is the base event type
            result.baseEvent = parts[parts.length - 1]

            // Check for each possible modifier
            result.modifiers.ctrl = parts.includes('ctrl')
            result.modifiers.shift = parts.includes('shift')
            result.modifiers.alt = parts.includes('alt')
        }

        return result
    }

    /**
     * Handle standard events and callbacks
     * @param {string} eventType - The type of event to handle
     * @param {Object} event - The event data
     */
    handleEvent(eventType, event) {
        // Get the entity at the event position, if available
        let pickedEntity = null

        if (this.viewer && event.position) {
            const picked = this.viewer.scene.pick(event.position)
            if (picked && picked.id) {
                pickedEntity = picked.id
                // Update the selected entity
                this.selectedEntity = pickedEntity
            }
            else {
                // If we clicked in empty space, clear the selection
                this.selectedEntity = null
            }
        }

        // Get all listeners for this event type
        const listeners = this.eventListeners.get(eventType) || []

        // Invoke each listener with the event data
        listeners.forEach(listener => {
            try {
                // If we have filter criteria, apply it
                if (listener.filter) {
                    // Skip if entity filter doesn't match
                    if (listener.filter.entity && pickedEntity !== listener.filter.entity) {
                        return
                    }
                }

                // Call the listener with the event and the picked entity
                listener.callback(event, pickedEntity)
            }
            catch (error) {
                console.error(`Error in event listener for ${eventType}:`, error)
            }
        })
    }

    /**
     * Handle events combined with modifier keys
     * @param {string} eventType - The type of event
     * @param {Object} event - The event object with modifier flags
     */
    handleModifierCombinationEvents(eventType, event) {
        console.log(`Processing ${eventType} with modifiers:`, {
            ctrl:  event.ctrl,
            shift: event.shift,
            alt:   event.alt,
        })

        // Ne traiter que les événements qui ont au moins un modificateur actif
        if (event.ctrl || event.shift || event.alt) {
            // Define all possible modifier combinations
            const modifierCombinations = [
                {condition: event.ctrl && !event.shift && !event.alt, suffix: 'CTRL'},
                {condition: !event.ctrl && event.shift && !event.alt, suffix: 'SHIFT'},
                {condition: !event.ctrl && !event.shift && event.alt, suffix: 'ALT'},
                {condition: event.ctrl && event.shift && !event.alt, suffix: 'CTRL_SHIFT'},
                {condition: event.ctrl && !event.shift && event.alt, suffix: 'CTRL_ALT'},
                {condition: !event.ctrl && event.shift && event.alt, suffix: 'SHIFT_ALT'},
                {condition: event.ctrl && event.shift && event.alt, suffix: 'CTRL_SHIFT_ALT'},
            ]

            // Process each combination
            for (const combination of modifierCombinations) {
                if (combination.condition) {
                    const modifiedEventType = `${eventType}_${combination.suffix}`
                    console.log(`Firing modified event: ${modifiedEventType}`)
                    this.handleEvent(modifiedEventType, event)
                    return // Une fois qu'une combinaison est traitée, nous pouvons sortir
                }
            }
        }
    }

    /**
     * Add event listener with support for modifier combinations in the eventType
     * @param {string} eventType - Type of event to listen for (can include modifiers like 'ctrl+leftClick')
     * @param {Function} callback - Callback function to invoke when event occurs
     * @param {Object} [filter] - Optional filter for event
     * @returns {Object} - Subscription token for removing listener
     */
    addEventListener(eventType, callback, filter = null) {
        // Create the listener object
        const listener = {callback, filter}

        // Get or create the listeners array for this event type
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, [])
        }

        // Add the listener
        const listeners = this.eventListeners.get(eventType)
        listeners.push(listener)

        // Return a subscription token for removal
        return {
            eventType,
            listener,
            remove: () => this.removeEventListener(eventType, listener),
        }
    }

    /**
     * Remove event listener
     * @param {string} eventType - Type of event
     * @param {Object} listener - Listener to remove
     */
    removeEventListener(eventType, listener) {
        // Get the listeners for this event type
        const listeners = this.eventListeners.get(eventType)
        if (!listeners) {
            return
        }

        // Remove the listener
        const index = listeners.indexOf(listener)
        if (index >= 0) {
            listeners.splice(index, 1)
        }

        // Clean up if no listeners remain
        if (listeners.length === 0) {
            this.eventListeners.delete(eventType)
        }
    }

    /**
     * Sets up multiple event handlers for an entity with a more convenient API
     * @param {Object} entity - The entity to attach events to
     * @param {Object} handlers - Object containing event handler functions
     * @returns {Object} - Object containing all subscriptions for later cleanup
     */
    setupEvents(entity, handlers) {
        // Object to track all subscriptions
        const subscriptions = {}

        // Base event names for automatic mapping
        const baseEvents = [
            // Mouse/basic events
            {name: 'Click', event: 'leftClick'},
            {name: 'RightClick', event: 'rightClick'},
            {name: 'DoubleClick', event: 'leftDoubleClick'},
            {name: 'MouseDown', event: 'leftDown'},
            {name: 'MouseUp', event: 'leftUp'},
            {name: 'RightDown', event: 'rightDown'},
            {name: 'RightUp', event: 'rightUp'},
            {name: 'MiddleClick', event: 'middleClick'},
            {name: 'MouseMove', event: 'mouseMove'},
            {name: 'Wheel', event: 'wheel'},

            // Touch events
            {name: 'Tap', event: 'tap'},
            {name: 'DoubleTap', event: 'doubleTap'},
            {name: 'LongTap', event: 'longTap'},
            {name: 'PinchStart', event: 'pinchStart'},
            {name: 'PinchMove', event: 'pinchMove'},
            {name: 'PinchEnd', event: 'pinchEnd'},
        ]

        // Modifier combinations
        const modifierCombinations = [
            {prefix: '', modifiers: ''},
            {prefix: 'Ctrl', modifiers: 'ctrl+'},
            {prefix: 'Shift', modifiers: 'shift+'},
            {prefix: 'Alt', modifiers: 'alt+'},
            {prefix: 'CtrlShift', modifiers: 'ctrl+shift+'},
            {prefix: 'CtrlAlt', modifiers: 'ctrl+alt+'},
            {prefix: 'ShiftAlt', modifiers: 'shift+alt+'},
            {prefix: 'CtrlShiftAlt', modifiers: 'ctrl+shift+alt+'},
        ]

        // Build complete event mapping automatically
        const eventMappings = {}

        // Generate all possible combinations
        baseEvents.forEach(baseEvent => {
            modifierCombinations.forEach(combo => {
                const handlerName = `on${combo.prefix}${baseEvent.name}`
                const eventType = `${combo.modifiers}${baseEvent.event}`
                eventMappings[handlerName] = eventType
            })
        })

        // Process each provided handler
        Object.entries(handlers).forEach(([handlerName, callback]) => {
            // Skip if there's no corresponding event mapping
            if (!eventMappings[handlerName]) {
                console.warn(`No event mapping for handler: ${handlerName}`)
                return
            }

            // Get the event type from the mapping
            const eventType = eventMappings[handlerName]

            // Parse the event type to extract base event and modifiers
            const parsedEventType = this.parseEventType(eventType)
            const baseEvent = parsedEventType.baseEvent
            const expectedModifiers = parsedEventType.modifiers

            // Create a wrapper that checks modifiers before calling the original callback
            const wrappedCallback = (event, pickedEntity) => {
                // Skip if entity filter doesn't match
                if (entity !== pickedEntity) {
                    return
                }

                // For events without modifiers, always call the callback
                if (!expectedModifiers.ctrl && !expectedModifiers.shift && !expectedModifiers.alt) {
                    callback(event, pickedEntity)
                    return
                }

                // For events with modifiers, check if the modifier keys match
                const modifiersMatch =
                          (!expectedModifiers.ctrl || event.ctrl) &&
                          (!expectedModifiers.shift || event.shift) &&
                          (!expectedModifiers.alt || event.alt)

                // Call the callback only if modifiers match
                if (modifiersMatch) {
                    callback(event, pickedEntity)
                }
            }

            // Register the event listener for the BASE event (without modifiers)
            subscriptions[handlerName] = this.addEventListener(
                baseEvent,  // Register with the base event type only
                wrappedCallback,
            )
        })

        return subscriptions
    }

    /**
     * Removes all event subscriptions created with setupEvents
     * @param {Object} subscriptions - The subscriptions object returned by setupEvents
     */
    removeEvents(subscriptions) {
        if (!subscriptions) {
            return
        }

        // Call remove() on each subscription
        Object.values(subscriptions).forEach(subscription => {
            if (subscription && typeof subscription.remove === 'function') {
                subscription.remove()
            }
        })
    }

    /**
     * Destroy this event manager and clean up resources
     */
    destroy() {
        // Clear all event listeners
        this.eventListeners.clear()

        // Remove Cesium event handlers
        if (this.screenSpaceEventHandler) {
            this.screenSpaceEventHandler.destroy()
            this.screenSpaceEventHandler = null
        }

        // Clear pending timers
        clearTimeout(this.pendingClickTimer)
        clearTimeout(this.pendingTapTimer)
        clearTimeout(this.longTapTimer)

        // Clear references
        this.viewer = null
        this.selectedEntity = null
    }

    /**
     * Detect if current event is from touch input
     * Enhanced to handle browser mobile simulations better
     * @returns {boolean} - True if the event is likely from a touch device
     */
    detectTouchEvent() {
        // Check if we've already determined we're in mobile emulation mode
        if (this.inMobileEmulation) {
            return true
        }

        // Check for recent touch activity
        const now = Date.now()
        const recentTouchActivity = now - this.lastTouchActivity < 1000

        // If we've had recent touch activity, it's definitely a touch device
        if (recentTouchActivity) {
            return true
        }

        // Base touch capability detection
        const hasTouchCapability = 'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0

        // For devices that report both mouse and touch capabilities,
        // use additional heuristics
        if (hasTouchCapability) {
            // Check user agent for mobile patterns
            const userAgent = navigator.userAgent.toLowerCase()
            const mobilePatterns = [
                'android', 'iphone', 'ipad', 'mobile', 'touch', 'tablet',
            ]

            const hasMobileUserAgent = mobilePatterns.some(pattern =>
                                                               userAgent.includes(pattern),
            )

            // Check for narrow screen (typical for mobile devices)
            const isNarrowScreen = window.innerWidth < 800

            // If user agent suggests mobile or screen is narrow, likely a touch device
            if (hasMobileUserAgent || isNarrowScreen) {
                return true
            }

            // DevTools mobile emulation often has touch capability but empty plugins
            const isLikelyDevToolsEmulation = window.navigator.plugins &&
                window.navigator.plugins.length === 0 &&
                hasMobileUserAgent

            if (isLikelyDevToolsEmulation) {
                return true
            }
        }

        // Use a simpler approach that's less prone to false positives
        return hasTouchCapability
    }
}