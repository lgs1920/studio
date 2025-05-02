
/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-02
 * Last modified: 2025-05-02
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-05-02
 * Last modified: 2025-05-02
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

        // Track the selected entity for keyboard shortcuts
        this.selectedEntity = null
        // Default entity provider function (can be set later)
        this.defaultEntityProvider = null

        // Map to track Cesium event type to handlers
        this.cesiumEventHandlers = new Map()

        this.viewer = viewer

        if (!this.viewer) {
            console.warn('CanvasEventManager: No Cesium viewer provided')
        }
        else {
            // suppress default zoom
            this.viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
            this.viewer.selectionIndicator.destroy()
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
     * Sets a function that provides the default entity when no entity is explicitly selected
     * For example, this could return the current POI
     * @param {Function} providerFunction - Function that returns the default entity
     */
    setDefaultEntityProvider(providerFunction) {
        if (typeof providerFunction !== 'function') {
            throw new Error('Default entity provider must be a function')
        }
        this.defaultEntityProvider = providerFunction
    }

    /**
     * Gets the currently selected entity, or the default entity if none is selected
     * @returns {Object|null} - The selected entity or default entity, or null if neither exists
     */
    getSelectedEntity() {
        // If we have an explicitly selected entity, return it
        if (this.selectedEntity) {
            return this.selectedEntity
        }

        // Otherwise, try to get the default entity if a provider is set
        if (this.defaultEntityProvider) {
            try {
                return this.defaultEntityProvider()
            }
            catch (e) {
                console.error('Error in default entity provider:', e)
            }
        }

        // If all else fails, return null
        return null
    }

    /**
     * Sets the selected entity
     * @param {Object} entity - The entity to set as selected
     */
    setSelectedEntity(entity) {
        this.selectedEntity = entity
    }

    /**
     * Clears the selected entity
     */
    clearSelectedEntity() {
        this.selectedEntity = null
    }

    /**
     * Creates a keyboard letter event with modifiers
     * @param {string} letter - The letter key (will be converted to uppercase)
     * @param {Object} [options] - Options for the keyboard event
     * @param {boolean} [options.ctrl=false] - Whether to include Ctrl modifier
     * @param {boolean} [options.alt=false] - Whether to include Alt modifier
     * @param {boolean} [options.shift=false] - Whether to include Shift modifier
     * @returns {string} - The event name (e.g., "CTRL_R" or "SHIFT_ALT_W")
     */
    createKeyboardEventName(letter, options = {}) {
        const upperLetter = letter.toUpperCase()
        const modifiers = []

        if (options.ctrl) {
            modifiers.push(this.MODIFIER_KEYS.CTRL)
        }
        if (options.alt) {
            modifiers.push(this.MODIFIER_KEYS.ALT)
        }
        if (options.shift) {
            modifiers.push(this.MODIFIER_KEYS.SHIFT)
        }

        if (modifiers.length === 0) {
            return upperLetter
        }

        return [...modifiers, upperLetter].join(EVENT_SEPARATOR)
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
            // Handle letter keys with modifiers
            else if (event.key && event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
                // Only handle if at least one modifier is active
                if (this.modifierKeys.ctrl || this.modifierKeys.alt || this.modifierKeys.shift) {
                    const letter = event.key.toUpperCase()
                    const modifiers = []

                    if (this.modifierKeys.ctrl) {
                        modifiers.push(this.MODIFIER_KEYS.CTRL)
                    }
                    if (this.modifierKeys.alt) {
                        modifiers.push(this.MODIFIER_KEYS.ALT)
                    }
                    if (this.modifierKeys.shift) {
                        modifiers.push(this.MODIFIER_KEYS.SHIFT)
                    }

                    // Generate event name like CTRL_R or SHIFT_ALT_W
                    const eventName = [...modifiers, letter].join(EVENT_SEPARATOR)

                    // Create event data with modifiers
                    const eventData = {
                        key:   letter,
                        ctrl:  this.modifierKeys.ctrl,
                        alt:   this.modifierKeys.alt,
                        shift: this.modifierKeys.shift,
                        // Don't include position, as it's a keyboard event
                    }

                    // Get the selected entity or default entity
                    const targetEntity = this.getSelectedEntity()

                    // Dispatch the keyboard event with the selected/default entity
                    this.handleEvent(eventName, eventData, targetEntity)
                }
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
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this.viewer.canvas)

        // Disable default zoom behavior on double-click (redundant but for safety)
        this.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

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

                // For click events, track the picked entity
                if (type === this.events.LEFT_CLICK && this.viewer) {
                    // Try to pick an entity
                    if (event.position) {
                        const picked = this.viewer.scene.pick(event.position)
                        if (picked && picked.id) {
                            // Update the selected entity only if we actually picked something
                            this.selectedEntity = picked.id
                        }
                        // Note: We don't clear selection when clicking on empty space
                    }
                }

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
        }

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
        }

        // Store the handler for later removal
        this.cesiumEventHandlers.set(ScreenSpaceEventType.LEFT_UP, leftUpHandler)

        // Set the input action
        this.screenSpaceEventHandler.setInputAction(leftUpHandler, ScreenSpaceEventType.LEFT_UP)
    }

    /**
     * Check if two positions are within a maximum distance of each other
     * @param {Object} pos1 - First position {x, y}
     * @param {Object} pos2 - Second position {x, y}
     * @returns {boolean} - True if within distance
     */
    isWithinDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x
        const dy = pos1.y - pos2.y
        return Math.sqrt(dx * dx + dy * dy) <= this.maxDoubleTapDistance
    }

    /**
     * Add event-specific properties based on modifier keys
     * @param {Object} event - The event object
     * @returns {Object} - Enriched event object
     */
    enrichEventWithModifiers(event) {
        return {
            ...event,
            ctrl:  this.modifierKeys.ctrl,
            alt:   this.modifierKeys.alt,
            shift: this.modifierKeys.shift,
        }
    }

    /**
     * Handle modifier combination events (CTRL_LEFT_CLICK, etc.)
     * @param {string} type - The base event type
     * @param {Object} event - The event object with modifier information
     */
    handleModifierCombinationEvents(type, event) {
        // Skip for certain events that don't need modifier versions
        if (this.SKIP_MODIFIERS_FOR.includes(type)) {
            return
        }

        // Get active modifiers
        const activeModifiers = []
        if (event.ctrl) {
            activeModifiers.push(this.MODIFIER_KEYS.CTRL)
        }
        if (event.alt) {
            activeModifiers.push(this.MODIFIER_KEYS.ALT)
        }
        if (event.shift) {
            activeModifiers.push(this.MODIFIER_KEYS.SHIFT)
        }

        // If no modifiers are active, we're done
        if (activeModifiers.length === 0) {
            return
        }

        // Generate all possible combinations of the active modifiers
        const modifierCombinations = this.generateCombinations(activeModifiers)

        // Handle each combination
        modifierCombinations.forEach(combination => {
            const eventName = combination.join(EVENT_SEPARATOR) + EVENT_SEPARATOR + type
            this.handleEvent(eventName, event)
        })
    }

    /**
     * Generate all possible combinations of elements in an array
     * @param {Array} arr - Array of elements
     * @returns {Array} - Array of combinations
     */
    generateCombinations(arr) {
        // Start with the individual elements
        const result = arr.map(item => [item])

        // If only one element, return it
        if (arr.length <= 1) {
            return result
        }

        // Generate combinations of 2+ elements
        const allCombinations = [...result]
        for (let i = 2; i <= arr.length; i++) {
            // Get all combinations of length i
            const combinations = this.getCombinations(arr, i)
            allCombinations.push(...combinations)
        }

        return allCombinations
    }

    /**
     * Get all combinations of a specific length from an array
     * @param {Array} arr - Array of elements
     * @param {number} len - Length of combinations to generate
     * @returns {Array} - Array of combinations of specified length
     */
    getCombinations(arr, len) {
        if (len > arr.length) {
            return []
        }
        if (len === 1) {
            return arr.map(el => [el])
        }

        const result = []
        for (let i = 0; i <= arr.length - len; i++) {
            const head = arr[i]
            const tailCombinations = this.getCombinations(
                arr.slice(i + 1),
                len - 1,
            )
            for (const tailCombination of tailCombinations) {
                result.push([head, ...tailCombination])
            }
        }
        return result
    }

    /**
     * Handle an event by dispatching it to all registered handlers
     * @param {string} eventType - Type of the event to handle
     * @param {Object} eventData - Data associated with the event
     * @param {Object} [forcedEntity] - If provided, this entity will be used instead of picking from the scene
     */
    handleEvent(eventType, eventData, forcedEntity = null) {
        // Get handlers for this event type
        const eventHandlers = this.handlers.get(eventType) || []

        if (eventHandlers.length === 0) {
            return
        }

        // Clone the handlers list to allow for handlers to remove themselves during execution
        const handlers = [...eventHandlers]

        // Sort by priority (lower number = higher priority)
        handlers.sort((a, b) => a.priority - b.priority)

        // Use forced entity if provided, otherwise try to pick from scene
        let pickedEntity = forcedEntity

        // Only try to pick if not forced and we have a position
        if (!forcedEntity && eventData.position && this.viewer) {
            const picked = this.viewer.scene.pick(eventData.position)
            if (picked && picked.id) {
                pickedEntity = picked.id
            }
        }

        // Record which subscription IDs to remove (for one-time handlers)
        const toRemove = []

        // Process each handler
        for (const handler of handlers) {
            // Skip if handler specifically targets an entity and it's not the picked one
            if (handler.entity && pickedEntity !== handler.entity) {
                continue
            }

            // Check if modifier keys match the handler's requirements
            if (handler.modifiers) {
                const modifiersMatch =
                          (handler.modifiers.ctrl === undefined || handler.modifiers.ctrl === eventData.ctrl) &&
                          (handler.modifiers.alt === undefined || handler.modifiers.alt === eventData.alt) &&
                          (handler.modifiers.shift === undefined || handler.modifiers.shift === eventData.shift)

                if (!modifiersMatch) {
                    continue
                }
            }

            try {
                // Call the handler with the right context and arguments
                const shouldPropagate = handler.callback.call(
                    handler.context || this,
                    eventData,
                    pickedEntity,
                )

                // If handler returns false or propagate is explicitly false, stop propagation
                if (shouldPropagate === false || handler.propagate === false) {
                    break
                }
            }
            catch (e) {
                console.error(`Error in ${eventType} event handler:`, e)
            }

            // Mark one-time handlers for removal
            if (handler.once) {
                toRemove.push(handler.id)
            }
        }

        // Remove any one-time handlers that were executed
        for (const id of toRemove) {
            this.removeEventListener(eventType, id)
        }
    }

    /**
     * Add an event listener for a specific event type
     * @param {string} eventType - The type of event to listen for
     * @param {Function} callback - The function to call when the event occurs
     * @param {Object|boolean} [options] - Options for the event handler or a boolean for 'once'
     * @returns {string} - Subscription ID for removing the listener
     */
    addEventListener(eventType, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('addEventListener requires a function as the second parameter')
        }

        // If options is a boolean, assume it's the 'once' option
        if (typeof options === 'boolean') {
            options = {once: options}
        }

        // Generate a unique subscription ID
        const id = `${eventType}_${++this.subscriptionId}`

        // Get or create the handlers array for this event type
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, [])
        }

        // Add the handler to the list
        this.handlers.get(eventType).push({
                                              id:        id,
                                              callback:  callback,
                                              entity:    options.entity || null,
                                              propagate: options.propagate !== false,
                                              priority:  options.priority || 100,
                                              once:      options.once || false,
                                              context:   options.context || null,
                                              modifiers: options.modifiers || null,
                                          })

        return id
    }

    /**
     * Shorthand for addEventListener
     * @param {string} eventType - The type of event to listen for
     * @param {Function} callback - The function to call when the event occurs
     * @param {Object|boolean} [options] - Options for the event handler or a boolean for 'once'
     * @returns {string} - Subscription ID for removing the listener
     */
    on(eventType, callback, options = {}) {
        return this.addEventListener(eventType, callback, options)
    }

    /**
     * Remove an event listener by type and subscription ID or callback reference
     * @param {string} eventType - The type of event to remove
     * @param {string|Function} subscription - The subscription ID or callback function
     * @returns {boolean} - True if the listener was found and removed
     */
    removeEventListener(eventType, subscription) {
        // Get the handlers for this event type
        const handlers = this.handlers.get(eventType)
        if (!handlers) {
            return false
        }

        const isString = typeof subscription === 'string'
        const isFunction = typeof subscription === 'function'

        if (!isString && !isFunction) {
            throw new Error('removeEventListener requires a string ID or function as the second parameter')
        }

        // Find the handler index
        const index = handlers.findIndex(handler => {
            if (isString) {
                return handler.id === subscription
            }
            else {
                return handler.callback === subscription
            }
        })

        // If found, remove it
        if (index !== -1) {
            handlers.splice(index, 1)
            return true
        }

        return false
    }

    /**
     * Shorthand for removeEventListener
     * @param {string} eventType - The type of event to remove
     * @param {string|Function} subscription - The subscription ID or callback function
     * @returns {boolean} - True if the listener was found and removed
     */
    off(eventType, subscription) {
        return this.removeEventListener(eventType, subscription)
    }

    /**
     * Manually dispatch an event
     * @param {string} eventType - The type of event to dispatch
     * @param {Object} [eventData={}] - Data to pass to the event handlers
     */
    dispatchEvent(eventType, eventData = {}) {
        // Enrich the event data with modifier information
        const enrichedEvent = this.enrichEventWithModifiers(eventData)

        // Handle the standard event
        this.handleEvent(eventType, enrichedEvent)

        // Handle modifier combination events
        this.handleModifierCombinationEvents(eventType, enrichedEvent)
    }

    /**
     * Check if the Ctrl key is currently pressed
     * @returns {boolean} - True if the Ctrl key is pressed
     */
    isCtrlKeyPressed() {
        return this.modifierKeys.ctrl
    }

    /**
     * Check if the Alt key is currently pressed
     * @returns {boolean} - True if the Alt key is pressed
     */
    isAltKeyPressed() {
        return this.modifierKeys.alt
    }

    /**
     * Check if the Shift key is currently pressed
     * @returns {boolean} - True if the Shift key is pressed
     */
    isShiftKeyPressed() {
        return this.modifierKeys.shift
    }

    /**
     * Get the count of listeners for a specific event type
     * @param {string} eventType - The type of event to count listeners for
     * @returns {number} - Number of listeners
     */
    listenerCount(eventType) {
        const handlers = this.handlers.get(eventType)
        return handlers ? handlers.length : 0
    }

    /**
     * Check if a specific entity has any event subscriptions for a given event type
     * @param {string} eventType - The type of event to check
     * @param {Object} entity - The entity to check for
     * @returns {boolean} - True if the entity has subscriptions
     */
    hasEntitySubscriptions(eventType, entity) {
        const handlers = this.handlers.get(eventType)
        if (!handlers) {
            return false
        }

        return handlers.some(handler => handler.entity === entity)
    }
}