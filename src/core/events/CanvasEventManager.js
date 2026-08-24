/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: CanvasEventManager.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Manages canvas events for a Cesium viewer, handling mouse, touch, and keyboard interactions.
 * Supports modifier keys (Ctrl, Shift, Alt) via options or event names (e.g., "CTRL#CLICK").
 * Event names and modifiers are case-insensitive (e.g., "ctrl#click" = "CTRL#CLICK").
 * Implements a singleton pattern to ensure a single instance per viewer.
 *
 * @class CanvasEventManager
 */
import { DOUBLE_CLICK_TIMEOUT, DOUBLE_TAP_TIMEOUT, LGS_CONTEXT_MENU_HOOK, LONG_TAP_TIMEOUT } from '@Core/constants'
import { ScreenSpaceEventHandler }                                                           from 'cesium'
import { CesiumInputGate, getCesiumInputState }                                              from './CesiumInputGate'
import { CESIUM_EVENTS, EVENT_LOWEST, EVENTS, MODIFIER_SEPARATOR, MODIFIERS }                from './cesiumEvents'

const LONG_TAP_MOVE_THRESHOLD = 10

const pickedObjectEntityId = picked => {
    const id = picked?.id
    if (!id) {
        return null
    }

    return typeof id === 'string' ? id : (id.id ?? null)
}

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
     * Cesium viewer instance associated with this event manager.
     * @type {Viewer}
     * @private
     */
    #viewer

    /**
     * Map storing event handlers for each event name.
     * Each entry contains an array of handler objects with handler, callback, options, and userData.
     * @type {Map<string, Array<{handler: Function|Object, callback: Function, options: Object, userData: any}>>}
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
     * State-driven gate for Cesium scene events and native camera controls.
     * @type {CesiumInputGate}
     * @private
     */
    #cesiumInputGate

    /**
     * Tracks touch tap event state for TAP, DOUBLE_TAP, and LONG_TAP detection.
     * @type {{lastTapTime: number, tapCount: number, isProcessing: boolean, longTapTimer: number|null, suppressTap:
     *     boolean, pendingTap: number|null}}
     * @private
     */
    #tapState = {
        lastTapTime: 0,
        tapCount:   0,
        isProcessing: false,
        longTapTimer: null,
        suppressTap: false,
        pendingTap: null,
    }

    /**
     * Stores the hovered entity ID for each mouse motion modifier.
     * @type {Map<string, string|null>}
     * @private
     */
    #hoveredEntityIds = new Map()

    /**
     * Stores the single Cesium input action used by each mouse motion modifier.
     * @type {Map<string, Function>}
     * @private
     */
    #mouseMotionActions = new Map()

    /**
     * Stores the single Cesium actions shared by TAP, DOUBLE_TAP, and LONG_TAP.
     * @type {{downHandler: Function, upHandler: Function}|null}
     * @private
     */
    #touchTapActions = null

    /**
     * Tracks the last click time for click-related events.
     * @type {number}
     * @private
     */
    #lastClickTime = 0

    /**
     * Timeout for click-related events.
     * @type {number|null}
     * @private
     */
    #clickTimeout = null

    /**
     * Tracks the last mouse position for keyboard events.
     * @type {{x: number|null, y: number|null}}
     * @private
     */
    #lastMousePosition = {x: null, y: null}

    /**
     * Tracks the state of modifier keys (Ctrl, Alt, Shift).
     * @type {{ ctrl: boolean, alt: boolean, shift: boolean }}
     * @private
     */
    #modifierState = {ctrl: false, alt: false, shift: false}

    /**
     * Cleanup callbacks for the temporary DOM event tracing listeners.
     * @type {Array<Function>}
     * @private
     */
    #canvasEventTraceCleanup = []

    /**
     * Creates or returns the singleton instance of CanvasEventManager.
     * Initializes the Cesium ScreenSpaceEventHandler and configures touch/mouse/keyboard event handling.
     *
     * @param {Cesium.Viewer} viewer - The Cesium viewer instance.
     * @throws {Error} If the viewer is invalid or missing required properties.
     */
    constructor(viewer) {
        if (CanvasEventManager.#instance) {
            return CanvasEventManager.#instance
        }

        if (!viewer || !viewer.scene || !viewer.scene.canvas) {
            throw new Error('Invalid viewer: must be a valid Cesium Viewer instance')
        }

        this.#viewer = viewer
        this.#cesiumInputGate = new CesiumInputGate(viewer)
        this.#screenSpaceEventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        this.isTouchDevice = this.#isTouchDevice()

        // Invalidate browser context menu
        document.addEventListener('contextmenu', (e) => {
            // No browser context menu on Map POI
            if (e.target.id === LGS_CONTEXT_MENU_HOOK) {
                e.preventDefault()
            }
        }, {capture: false})

        this.#viewer.scene.canvas.setAttribute('tabindex', '0')
        this.#setupSynchronizedInputGuard()
        this.#setupCanvasEventTracing()
        this.#setupCanvasFocus()
        this.#setupKeyboardEvents()
        this.#setupMousePositionTracking()
        CanvasEventManager.#instance = this
    }

    /**
     * Traces DOM input events before and at the Cesium canvas to identify an
     * overlay or another layer that intercepts the event.
     * @private
     */
    #setupCanvasEventTracing() {
        const canvas = this.#viewer.scene.canvas
        const eventTypes = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'touchstart', 'touchend']

        const describeElement = element => {
            if (!element || !element.tagName) {
                return null
            }

            return {
                tagName: element.tagName.toLowerCase(),
                id:      element.id || null,
                classes: typeof element.className === 'string' ? element.className : null,
            }
        }

        const getPosition = event => {
            const touch = event.touches?.[0] ?? event.changedTouches?.[0]
            return {
                clientX: event.clientX ?? touch?.clientX ?? null,
                clientY: event.clientY ?? touch?.clientY ?? null,
            }
        }

        const traceDomEvent = event => {
            const path = event.composedPath?.() ?? []
            const position = getPosition(event)
            const synchronizedRecordingState = getCesiumInputState()

            console.log('[CanvasEventManager] DOM event received', {
                type:          event.type,
                target:        describeElement(event.target),
                reachedCanvas: path.includes(canvas) || event.target === canvas,
                path:          path.slice(0, 8).map(describeElement).filter(Boolean),
                defaultPrevented: event.defaultPrevented,
                synchronizedRecordingState,
                ...position,
            })
        }

        eventTypes.forEach(eventType => {
            document.addEventListener(eventType, traceDomEvent, true)
            this.#canvasEventTraceCleanup.push(() => document.removeEventListener(eventType, traceDomEvent, true))
        })
    }

    /**
     * Prevents pointer and mouse input from reaching Cesium while synchronized
     * video recording owns the scene camera.
     * @private
     */
    #setupSynchronizedInputGuard() {
        const canvas = this.#viewer.scene.canvas
        const eventTypes = [
            'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
            'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick',
            'contextmenu', 'wheel',
            'touchstart', 'touchmove', 'touchend', 'touchcancel',
        ]

        const blockSynchronizedInput = event => {
            if (!this.#cesiumInputGate.isBlocked()) {
                return
            }

            const path = event.composedPath?.() ?? []
            if (!path.includes(canvas) && event.target !== canvas) {
                return
            }

            event.preventDefault()
            event.stopPropagation()
        }

        eventTypes.forEach(eventType => {
            const options = {capture: true, passive: false}
            document.addEventListener(eventType, blockSynchronizedInput, options)
            this.#canvasEventTraceCleanup.push(() => document.removeEventListener(eventType, blockSynchronizedInput, options))
        })
    }

    /**
     * Focuses the Cesium canvas when a pointer interaction starts on it so
     * subsequent wheel and keyboard-related interactions do not require an
     * additional click.
     * @private
     */
    #setupCanvasFocus() {
        const canvas = this.#viewer.scene.canvas
        const focusCanvas = () => canvas.focus({preventScroll: true})

        canvas.addEventListener('pointerdown', focusCanvas, true)
        this.#canvasEventTraceCleanup.push(() => canvas.removeEventListener('pointerdown', focusCanvas, true))
    }

    /**
     * Checks if the device supports touch events using multiple browser APIs.
     *
     * @returns {boolean} True if the device supports touch events, false otherwise.
     * @private
     */
    #isTouchDevice() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 1 ||
            window.matchMedia('(pointer: coarse)').matches
        )
    }

    /**
     * Sets up mouse position tracking for keyboard events.
     * Tracks the last mouse position (clientX, clientY) to use in keyboard events.
     * @private
     */
    #setupMousePositionTracking() {
        this.#viewer.scene.canvas.addEventListener('mousemove', (event) => {
            this.#lastMousePosition = {
                x: event.clientX,
                y: event.clientY,
            }
        })
    }

    /**
     * Sets up keyboard event listeners for KEY_DOWN and KEY_UP events.
     * Tracks modifier key states and only emits events for non-modifier keys or explicitly registered modifier keys.
     * Uses the last known mouse position for entity picking and event position.
     * @private
     */
    #setupKeyboardEvents() {
        const modifierKeys = ['control', 'alt', 'shift']

        const handleKeyEvent = (event, eventType) => {
            const key = event.key.toLowerCase()
            const isModifier = modifierKeys.includes(key)

            if (key === 'control') {
                this.#modifierState.ctrl = eventType === 'KEY_DOWN'
            }
            if (key === 'alt') {
                this.#modifierState.alt = eventType === 'KEY_DOWN'
            }
            if (key === 'shift') {
                this.#modifierState.shift = eventType === 'KEY_DOWN'
            }

            if (isModifier && !this.#handlers.get(eventType)?.some(h => h.options.keys?.includes(key))) {
                return
            }

            const eventName = eventType.toUpperCase()
            if (this.#handlers.has(eventName)) {
                const position = this.#lastMousePosition.x !== null && this.#lastMousePosition.y !== null
                                 ? {x: this.#lastMousePosition.x, y: this.#lastMousePosition.y}
                                 : null
                const pickedEntityId = position ? pickedObjectEntityId(this.#viewer.scene.pick(position)) : null

                if (key === 'alt') {
                    event.preventDefault()
                }

                this.#emit(eventName, {
                    key,
                    position,
                    clientX: position ? position.x : null,
                    clientY: position ? position.y : null,
                    ctrlKey: this.#modifierState.ctrl,
                    altKey:  this.#modifierState.alt,
                    shiftKey: this.#modifierState.shift,
                }, pickedEntityId)
            }
        }

        this.#viewer.scene.canvas.addEventListener('keydown', (event) => handleKeyEvent(event, 'KEY_DOWN'))
        this.#viewer.scene.canvas.addEventListener('keyup', (event) => handleKeyEvent(event, 'KEY_UP'))

        window.addEventListener('blur', () => {
            this.#modifierState = {ctrl: false, alt: false, shift: false}
        })
    }

    /**
     * Validates the entity based on the entity parameter and picked entity ID.
     *
     * @param {Object} event - The Cesium event object or custom event (e.g., { key, position }).
     * @param {boolean|string|string[]} entity - Entity requirement:
     *   - `false`: Return `null` regardless of clicked entity.
     *   - `'id'`: Return ID only if the clicked entity's ID matches `id`.
     *   - `['id1', 'id2', ...]`: Return ID only if the clicked entity's ID is in the array.
     *   - `[]`: Return ID only if any entity is clicked.
     * @param {Object|null} [pickedEntity] - Optional pre-picked entity to avoid redundant picking.
     * @returns {string|null} The entity ID if valid, null otherwise.
     * @private
     */
    #validateEntity(event, entity, pickedEntity = null) {
        let entityId = null
        if (pickedEntity !== null) {
            entityId = typeof pickedEntity === 'string' ? pickedEntity : (pickedEntity.id ?? null)
        }
        else if (event.position && event.position.x != null && event.position.y != null) {
            entityId = pickedObjectEntityId(this.#viewer.scene.pick(event.position))
        }

        if (entity === false) {
            return null
        }
        else if (typeof entity === 'string') {
            return entityId === entity ? entityId : null
        }
        else if (Array.isArray(entity)) {
            if (entity.length === 0) {
                return entityId ? entityId : null
            }
            else {
                return entity.includes(entityId) ? entityId : null
            }
        }

        return null
    }

    /**
     * Emits an event by executing all registered callbacks for the specified event name.
     * Callbacks are sorted by priority (highest first, descending order) and executed if entity, key, and modifier
     * requirements are met. If a callback has preventLowerPriority set to true, lower-priority callbacks are skipped.
     *
     * @param {string} eventName - The event name (e.g., "CTRL#CLICK", "TAP", "KEY_DOWN").
     * @param {Object} event - The Cesium event object or custom event (e.g., { key, position, clientX, clientY,
     *     ctrlKey, altKey, shiftKey }).
     * @param {string|null} pickedEntityId - The ID of the picked entity, or null if none.
     * @private
     */
    #emit(eventName, event, pickedEntityId) {
        if (this.#cesiumInputGate.isBlocked()) {
            return
        }

        const handlers = this.#handlers.get(eventName)
        if (!handlers) {
            return
        }

        const sortedHandlers = [...handlers].sort((a, b) => (b.options.priority - a.options.priority))
        let stopPropagation = false

        sortedHandlers.forEach(({callback, options, userData}) => {
            if (stopPropagation) {
                return
            }
            try {
                if (event.key && options.keys && !options.keys.includes(event.key)) {
                    return
                }
                if (options.modifiers && options.modifiers.length > 0) {
                    const modifiersOk = options.modifiers.every(mod => {
                        const modKey = mod.toLowerCase()
                        return modKey === 'ctrl' ? event.ctrlKey :
                               modKey === 'alt' ? event.altKey :
                               modKey === 'shift' ? event.shiftKey : false
                    })
                    const nonSpecifiedModifiersOk = ['ctrl', 'alt', 'shift'].every(mod => {
                        if (!options.modifiers.includes(mod)) {
                            return mod === 'ctrl' ? !event.ctrlKey :
                                   mod === 'alt' ? !event.altKey :
                                   mod === 'shift' ? !event.shiftKey : true
                        }
                        return true
                    })
                    if (!modifiersOk || !nonSpecifiedModifiersOk) {
                        return
                    }
                }
                const entityId = this.#validateEntity(event, options.entity ?? false, pickedEntityId)
                if (entityId !== null || options.entity === false) {
                    callback(event, entityId, options, userData)
                    if (options.once) {
                        this.off(eventName, callback)
                    }
                    if (options.preventLowerPriority) {
                        stopPropagation = true
                    }
                }
            }
            catch (error) {
                console.error(`[CanvasEventManager] Error in callback for ${eventName}:`, error)
            }
        })
    }

    /**
     * Sets up touch event handlers for TAP, DOUBLE_TAP, and LONG_TAP events.
     *
     * @returns {Object} Object containing downHandler and upHandler for touch events.
     * @private
     */
    #setupTouchEvents() {
        const validateTouchEvent = (event) => {
            if (event.pointerType !== 'touch' && !this.isTouchDevice) {
                return null
            }
            return pickedObjectEntityId(this.#viewer.scene.pick(event.position))
        }

        let lastTapTime = 0
        let tapTimeout = null
        let tapCount = 0
        let tapStartTime = 0
        let touchStartPosition = null
        let touchMoveCancelled = false

        const clearLongTapTimer = () => {
            if (this.#tapState.longTapTimer) {
                clearTimeout(this.#tapState.longTapTimer)
                this.#tapState.longTapTimer = null
            }
        }

        const clearTapTimeout = () => {
            if (tapTimeout) {
                clearTimeout(tapTimeout)
                tapTimeout = null
            }
        }

        const getClientPosition = (event) => {
            const touch = event.touches?.[0] ?? event.changedTouches?.[0]
            if (touch) {
                return {x: touch.clientX, y: touch.clientY}
            }
            if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
                return {x: event.clientX, y: event.clientY}
            }
            return null
        }

        const getClientPositionFromCanvas = (position) => {
            const rect = this.#viewer.scene.canvas.getBoundingClientRect()
            return {
                x: rect.left + position.x,
                y: rect.top + position.y,
            }
        }

        const stopMoveTracking = () => {
            document.removeEventListener('pointermove', handleTouchMove, true)
            document.removeEventListener('touchmove', handleTouchMove, true)
        }

        const cancelTouchInteraction = () => {
            touchMoveCancelled = true
            this.#tapState.suppressTap = true
            clearLongTapTimer()
            clearTapTimeout()
            tapCount = 0
            tapStartTime = 0
        }

        const handleTouchMove = (event) => {
            if (!touchStartPosition || touchMoveCancelled) {
                return
            }

            const position = getClientPosition(event)
            if (!position) {
                return
            }

            const dx = position.x - touchStartPosition.x
            const dy = position.y - touchStartPosition.y
            if (Math.hypot(dx, dy) > LONG_TAP_MOVE_THRESHOLD) {
                cancelTouchInteraction()
                stopMoveTracking()
            }
        }

        const downHandler = (event) => {
            if (this.#cesiumInputGate.isBlocked()) {
                return
            }

            const entityId = validateTouchEvent(event)
            if (entityId === null && !this.#handlers.get(EVENTS.TAP)?.some(h => h.options.entity === false) &&
                !this.#handlers.get(EVENTS.DOUBLE_TAP)?.some(h => h.options.entity === false) &&
                !this.#handlers.get(EVENTS.LONG_TAP)?.some(h => h.options.entity === false)) {
                return
            }

            const now = Date.now()
            const timeDiff = now - lastTapTime
            lastTapTime = now
            tapCount++
            tapStartTime = now
            touchStartPosition = event.position ? getClientPositionFromCanvas(event.position) : null
            touchMoveCancelled = false
            stopMoveTracking()
            document.addEventListener('pointermove', handleTouchMove, true)
            document.addEventListener('touchmove', handleTouchMove, {capture: true, passive: true})

            clearTapTimeout()
            clearLongTapTimer()

            this.#tapState.longTapTimer = setTimeout(() => {
                if (touchMoveCancelled) {
                    return
                }
                stopMoveTracking()
                touchStartPosition = null
                this.#tapState.suppressTap = true
                this.#emit(EVENTS.LONG_TAP, event, entityId)
                tapCount = 0
                tapTimeout = null
                tapStartTime = 0
            }, LONG_TAP_TIMEOUT)

            setTimeout(() => {
                if (tapStartTime && !touchMoveCancelled && Date.now() - tapStartTime >= DOUBLE_TAP_TIMEOUT && this.#tapState.longTapTimer) {
                    this.#tapState.suppressTap = true
                    clearTapTimeout()
                }
            }, DOUBLE_TAP_TIMEOUT)

            if (tapCount === 1) {
                tapTimeout = setTimeout(() => {
                    if (tapCount === 1 && !this.#tapState.suppressTap && !touchMoveCancelled) {
                        this.#emit(EVENTS.TAP, event, entityId)
                    }
                    tapCount = 0
                    tapTimeout = null
                    tapStartTime = 0
                }, DOUBLE_TAP_TIMEOUT + 50)
            }
            else if (tapCount === 2 && timeDiff < DOUBLE_TAP_TIMEOUT) {
                clearTapTimeout()
                clearLongTapTimer()
                this.#tapState.suppressTap = false
                this.#emit(EVENTS.DOUBLE_TAP, event, entityId)
                tapCount = 0
                tapTimeout = null
                tapStartTime = 0
            }
            else {
                clearTapTimeout()
                tapCount = 1
                lastTapTime = now
            }
        }

        const upHandler = () => {
            stopMoveTracking()
            clearLongTapTimer()

            this.#tapState.suppressTap = false
            touchStartPosition = null
            touchMoveCancelled = false
            tapStartTime = 0
        }

        return {downHandler, upHandler}
    }

    /**
     * Sets up mouse event handlers for the specified event type.
     *
     * @param {string} eventType - Event type (e.g., CLICK, DOUBLE_CLICK, RIGHT_CLICK, MOUSE_ENTER, MOUSE_LEAVE).
     * @param {Object|null} modifier - Modifier from event name (e.g., { name: 'CTRL', value: Cesium.Modifier }).
     * @param {string[]} requiredModifiers - Modifiers required by options.modifiers (e.g., ['ctrl', 'shift']).
     * @returns {Function} The event handler function.
     * @private
     */
    #setupMouseEvents(eventType, modifier, requiredModifiers) {
        return (event) => {
            if (this.#cesiumInputGate.isBlocked()) {
                return
            }

            if (eventType === EVENTS.RIGHT_CLICK && (this.isTouchDevice || event.pointerType === 'touch')) {
                return
            }

            const modifiersOk = requiredModifiers.every(mod => {
                const modKey = mod.toLowerCase()
                return modKey === 'ctrl' ? event.ctrlKey :
                       modKey === 'alt' ? event.altKey :
                       modKey === 'shift' ? event.shiftKey : false
            })
            if (!modifiersOk) {
                return
            }

            const position = event?.position ?? event?.endPosition
            const picked = position ? this.#viewer.scene.pick(position) : undefined
            const entityId = pickedObjectEntityId(picked)
            const eventName = modifier ? `${modifier.name}${MODIFIER_SEPARATOR}${eventType}` : eventType

            if (eventType !== EVENTS.MOUSE_MOVE) {
                console.log('[CanvasEventManager] Cesium event received by canvas', {
                    eventType,
                    eventName,
                    position: position ? {x: position.x, y: position.y} : null,
                    pickedType: picked?.constructor?.name ?? null,
                    entityId,
                })
            }

            if (!this.#handlers.has(eventName)) {
                return
            }

            if (entityId === null && !this.#handlers.get(eventName)?.some(h => h.options.entity === false)) {
                return
            }

            const now = Date.now()
            const timeDiff = now - this.#lastClickTime
            this.#lastClickTime = now

            if (eventType === 'CLICK') {
                clearTimeout(this.#clickTimeout)
                this.#clickTimeout = setTimeout(() => {
                    if (timeDiff > DOUBLE_CLICK_TIMEOUT) {
                        this.#emit(eventName, event, entityId)
                    }
                }, DOUBLE_CLICK_TIMEOUT + 50)
            }
            else if (eventType === EVENTS.DOUBLE_CLICK) {
                clearTimeout(this.#clickTimeout)
                this.#clickTimeout = null
                this.#emit(eventName, event, entityId)
            }
            else if (eventType === EVENTS.RIGHT_CLICK) {
                clearTimeout(this.#clickTimeout)
                this.#emit(eventName, event, entityId)
            }
            else if (eventType === EVENTS.DOWN || eventType === EVENTS.UP ||
                eventType === EVENTS.RIGHT_DOWN || eventType === EVENTS.RIGHT_UP ||
                eventType === EVENTS.MIDDLE_DOWN || eventType === EVENTS.MIDDLE_UP ||
                eventType === EVENTS.MOUSE_MOVE || eventType === EVENTS.WHEEL) {
                this.#emit(eventName, event, entityId)
            }
        }
    }

    /**
     * Returns whether the logical event is derived from Cesium mouse motion.
     *
     * @param {string} eventType - Logical CanvasEventManager event type.
     * @returns {boolean} True for mouse move and hover transition events.
     * @private
     */
    #isMouseMotionEvent(eventType) {
        return eventType === EVENTS.MOUSE_MOVE
               || eventType === EVENTS.MOUSE_ENTER
               || eventType === EVENTS.MOUSE_LEAVE
    }

    /**
     * Returns whether the logical event is derived from the same touch press.
     *
     * @param {string} eventType - Logical CanvasEventManager event type.
     * @returns {boolean} True for tap gesture events.
     * @private
     */
    #isTouchTapEvent(eventType) {
        return eventType === EVENTS.TAP
               || eventType === EVENTS.DOUBLE_TAP
               || eventType === EVENTS.LONG_TAP
    }

    /**
     * Returns whether a tap gesture listener remains registered.
     *
     * @returns {boolean} True when the shared Cesium touch actions must be retained.
     * @private
     */
    #hasTouchTapHandlers() {
        return [EVENTS.TAP, EVENTS.DOUBLE_TAP, EVENTS.LONG_TAP]
            .some(eventType => this.#handlers.has(eventType))
    }

    /**
     * Returns the internal key for a Cesium mouse motion modifier.
     *
     * @param {Object|null} modifier - Parsed Cesium keyboard modifier.
     * @returns {string} Stable mouse motion action key.
     * @private
     */
    #mouseMotionActionKey(modifier) {
        return modifier?.name ?? 'DEFAULT'
    }

    /**
     * Returns the registered logical event name for an optional modifier.
     *
     * @param {string} eventType - Logical CanvasEventManager event type.
     * @param {Object|null} modifier - Parsed Cesium keyboard modifier.
     * @returns {string} Normalized handler map key.
     * @private
     */
    #eventNameForModifier(eventType, modifier) {
        return modifier ? `${modifier.name}${MODIFIER_SEPARATOR}${eventType}` : eventType
    }

    /**
     * Returns whether logical mouse motion listeners remain for a modifier.
     *
     * @param {Object|null} modifier - Parsed Cesium keyboard modifier.
     * @returns {boolean} True when the shared Cesium action must be retained.
     * @private
     */
    #hasMouseMotionHandlers(modifier) {
        return [EVENTS.MOUSE_MOVE, EVENTS.MOUSE_ENTER, EVENTS.MOUSE_LEAVE]
            .some(eventType => this.#handlers.has(this.#eventNameForModifier(eventType, modifier)))
    }

    /**
     * Creates the sole Cesium MOUSE_MOVE action for a modifier and dispatches
     * movement plus entity enter/leave transitions to logical listeners.
     *
     * @param {Object|null} modifier - Parsed Cesium keyboard modifier.
     * @returns {Function} Cesium mouse motion callback.
     * @private
     */
    #setupMouseMotionEvents(modifier) {
        const actionKey = this.#mouseMotionActionKey(modifier)
        const mouseMoveEventName = this.#eventNameForModifier(EVENTS.MOUSE_MOVE, modifier)
        const mouseEnterEventName = this.#eventNameForModifier(EVENTS.MOUSE_ENTER, modifier)
        const mouseLeaveEventName = this.#eventNameForModifier(EVENTS.MOUSE_LEAVE, modifier)

        return event => {
            if (this.#cesiumInputGate.isBlocked()) {
                return
            }

            const position = event?.endPosition ?? event?.position
            const picked = position ? this.#viewer.scene.pick(position) : undefined
            const entityId = pickedObjectEntityId(picked)
            const previousEntityId = this.#hoveredEntityIds.get(actionKey) ?? null

            this.#emit(mouseMoveEventName, event, entityId)

            if (entityId === previousEntityId) {
                return
            }

            if (previousEntityId) {
                this.#emit(mouseLeaveEventName, event, previousEntityId)
            }
            if (entityId) {
                this.#emit(mouseEnterEventName, event, entityId)
            }

            this.#hoveredEntityIds.set(actionKey, entityId)
        }
    }

    /**
     * Registers an event listener with support for priority, entity filtering, modifier keys, key filtering,
     * one-time execution, selector visibility, preventing lower-priority listeners, and user-defined data.
     *
     * @param {string} eventName - The event name (e.g., "TAP", "CTRL#CLICK", case-insensitive).
     * @param {Function} callback - The callback function, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {boolean|string|string[]} [options.entity=false] - Entity requirement.
     * @param {boolean} [options.once=false] - Whether to remove the listener after triggering.
     * @param {number} [options.priority=0 or EVENT_LOWEST] - Priority of the callback (higher number = executed
     *     first).
     * @param {boolean} [options.showSelector=true] - Whether to show the .cesium-selection-wrapper for picked
     *     entities.
     * @param {boolean} [options.preventLowerPriority=false] - Whether to prevent lower-priority listeners from
     *     executing.
     * @param {string[]} [options.modifiers=[]] - Required modifier keys for mouse or keyboard events (e.g., ['ctrl',
     *     'shift'], case-insensitive).
     * @param {string[]} [options.keys=[]] - Specific keys to listen for in KEY_DOWN/KEY_UP (e.g., ['s', 'enter'],
     *     case-insensitive).
     * @param {any} [userData] - User-defined data to pass to the callback when triggered.
     * @throws {Error} If eventName is invalid, callback is not a function, or event type is unsupported.
     */
    on(eventName, callback, options = {}, userData = null) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }

        eventName = eventName.toUpperCase()
        const {modifier, eventType} = this.#parseEventName(eventName)

        if (!this.#events[eventType] && eventType !== 'KEY_DOWN' && eventType !== 'KEY_UP') {
            throw new Error(`Event type ${eventType} is not supported`)
        }

        if (typeof options === 'boolean') {
            options = {once: options}
        }
        const entity = options?.entity ?? false
        const priority = typeof options?.priority === 'number' ? options.priority : (entity === false ? EVENT_LOWEST : 0)
        const showSelector = options?.showSelector !== false
        const preventLowerPriority = options?.preventLowerPriority ?? false
        const modifiers = Array.isArray(options?.modifiers) ? options.modifiers.map(mod => mod.toLowerCase()) : []
        const keys = Array.isArray(options?.keys) ? options.keys.map(key => key.toLowerCase()) : []
        options.entity = entity
        options.priority = priority
        options.showSelector = showSelector
        options.preventLowerPriority = preventLowerPriority
        options.modifiers = modifiers
        options.keys = keys

        let handler
        if (eventType === 'KEY_DOWN' || eventType === 'KEY_UP') {
            handler = null
        }
        else if (this.isTouchDevice) {
            if (this.#events[eventType]?.touch) {
                if (this.#isTouchTapEvent(eventType)) {
                    handler = this.#touchTapActions
                    if (!handler) {
                        handler = this.#setupTouchEvents()
                        this.#touchTapActions = handler
                        this.#screenSpaceEventHandler.setInputAction(handler.downHandler, this.#events[EVENTS.TAP].event)
                        this.#screenSpaceEventHandler.setInputAction(handler.upHandler, this.#events.UP.event)
                    }
                }
                else {
                    handler = this.#setupMouseEvents(eventType, modifier, modifiers)
                    if (!this.#handlers.has(eventName)) {
                        this.#screenSpaceEventHandler.setInputAction(handler, this.#events[eventType].event)
                    }
                }
            }
            else {
                return
            }
        }
        else {
            if (!this.#events[eventType]?.touch) {
                if (this.#isMouseMotionEvent(eventType)) {
                    const actionKey = this.#mouseMotionActionKey(modifier)
                    handler = this.#mouseMotionActions.get(actionKey)
                    if (!handler) {
                        handler = this.#setupMouseMotionEvents(modifier)
                        this.#mouseMotionActions.set(actionKey, handler)
                        this.#screenSpaceEventHandler.setInputAction(
                            handler,
                            this.#events[EVENTS.MOUSE_MOVE].event,
                            modifier?.value,
                        )
                    }
                }
                else {
                    handler = this.#setupMouseEvents(eventType, modifier, modifiers)
                }
                if (!this.#handlers.has(eventName) && !this.#isMouseMotionEvent(eventType)) {
                    if (modifier && modifier.value) {
                        this.#screenSpaceEventHandler.setInputAction(
                            handler,
                            this.#events[eventType].event,
                            modifier.value,
                        )
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
        this.#handlers.get(eventName).push({handler, callback, options, userData})
    }

    /**
     * Unregisters an event listener for a specific event or all handlers for an event.
     *
     * @param {string} eventName - The event name to remove (e.g., "TAP", "CTRL#CLICK", case-insensitive).
     * @param {Function} [callback] - The specific callback to remove. If omitted, all handlers are removed.
     */
    off(eventName, callback) {
        eventName = eventName.toUpperCase()
        if (!this.#handlers.has(eventName)) {
            return
        }

        const {eventType, modifier} = this.#parseEventName(eventName)
        const handlers = this.#handlers.get(eventName)

        const removeHandler = (handler) => {
            if (this.#isMouseMotionEvent(eventType)) {
                if (this.#hasMouseMotionHandlers(modifier)) {
                    return
                }

                const actionKey = this.#mouseMotionActionKey(modifier)
                this.#screenSpaceEventHandler.removeInputAction(
                    this.#events[EVENTS.MOUSE_MOVE].event,
                    modifier?.value,
                )
                this.#mouseMotionActions.delete(actionKey)
                this.#hoveredEntityIds.delete(actionKey)
                return
            }

            if (this.#isTouchTapEvent(eventType)) {
                if (this.#hasTouchTapHandlers()) {
                    return
                }

                this.#screenSpaceEventHandler.removeInputAction(this.#events[EVENTS.TAP].event)
                this.#screenSpaceEventHandler.removeInputAction(this.#events.UP.event)
                this.#touchTapActions = null
            }
            else if (this.#events[eventType]) {
                this.#screenSpaceEventHandler.removeInputAction(this.#events[eventType].event, handler)
            }
        }

        if (callback) {
            const index = handlers.findIndex((h) => h.callback === callback)
            if (index !== -1) {
                const [removedHandler] = handlers.splice(index, 1)
                if (handlers.length === 0) {
                    this.#handlers.delete(eventName)
                    removeHandler(removedHandler.handler)
                }
            }
        }
        else {
            if (this.#handlers.get(eventName)) {
                this.#handlers.delete(eventName)
                removeHandler(handlers[0]?.handler)
            }
        }
    }

    /**
     * Removes all registered event listeners for all events.
     */
    removeAllListeners() {
        Array.from(this.#handlers.keys()).forEach((eventName) => this.off(eventName))
    }

    /**
     * Removes all listeners associated with a specific entity or group of entities.
     *
     * @param {string|string[]} entity - The entity ID or array of entity IDs to remove listeners for.
     */
    removeAllListenersByEntity(entity) {
        const entities = Array.isArray(entity) ? entity : [entity]

        this.#handlers.forEach((handlers, eventName) => {
            const filteredHandlers = handlers.filter((handler) => {
                const {options} = handler
                if (options.entity === false) {
                    return true
                }
                if (typeof options.entity === 'string') {
                    return !entities.includes(options.entity)
                }
                if (Array.isArray(options.entity)) {
                    return !options.entity.some((id) => entities.includes(id))
                }
                return true
            })

            if (filteredHandlers.length === 0) {
                this.off(eventName)
            }
            else if (filteredHandlers.length < handlers.length) {
                this.#handlers.set(eventName, filteredHandlers)
            }
        })
    }

    /**
     * Parses an event name to extract modifier and event type, case-insensitive.
     *
     * @param {string} eventName - The event name to parse (e.g., "CTRL#CLICK", "ctrl#click").
     * @returns {{modifier: {name: string, value: any}|null, eventType: string}} Parsed modifier and event type.
     * @throws {Error} If the event name is invalid.
     * @private
     */
    #parseEventName(eventName) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }

        eventName = eventName.toUpperCase()
        if (!eventName.includes(MODIFIER_SEPARATOR)) {
            return {modifier: null, eventType: eventName}
        }

        const [modifierPart, eventType] = eventName.split(MODIFIER_SEPARATOR, 2)
        return {
            modifier: {name: modifierPart, value: MODIFIERS[modifierPart]},
            eventType: eventType || modifierPart,
        }
    }

    /**
     * Cleans up all resources, removes event listeners, and resets the singleton instance.
     */
    destroy() {
        this.removeAllListeners()
        this.#cesiumInputGate.destroy()
        this.#canvasEventTraceCleanup.forEach(cleanup => cleanup())
        this.#canvasEventTraceCleanup = []
        this.#mouseMotionActions.clear()
        this.#hoveredEntityIds.clear()
        this.#touchTapActions = null
        this.#screenSpaceEventHandler.destroy()
        this.#handlers.clear()
        CanvasEventManager.#instance = null
    }

    /**
     * Alias for `on` method to add an event listener.
     *
     * @param {string} eventName - The event name (e.g., "TAP", "CTRL#CLICK", case-insensitive).
     * @param {Function} callback - The callback function to execute.
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     */
    addEventListener(eventName, callback, options = {}, userData = null) {
        this.on(eventName, callback, options, userData)
    }

    /**
     * Alias for `off` method to remove an event listener.
     *
     * @param {string} eventName - The event name to remove (case-insensitive).
     * @param {Function} [callback] - The specific callback to remove.
     */
    removeEventListener(eventName, callback) {
        this.off(eventName, callback)
    }

    /**
     * Registers a listener for the CLICK event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onClick(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('CLICK', callback, options, userData)
    }

    /**
     * Unregisters a listener for the CLICK event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offClick(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('CLICK', callback)
    }

    /**
     * Registers a listener for the DOUBLE_CLICK event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onDoubleClick(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('DOUBLE_CLICK', callback, options, userData)
    }

    /**
     * Unregisters a listener for the DOUBLE_CLICK event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offDoubleClick(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('DOUBLE_CLICK', callback)
    }

    /**
     * Registers a listener for the MOUSE_DOWN event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseDown(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('DOWN', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('DOWN', callback)
    }

    /**
     * Registers a listener for the MOUSE_UP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseUp(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('UP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('UP', callback)
    }

    /**
     * Registers a listener for the RIGHT_DOWN event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onRightDown(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_DOWN', callback, options, userData)
    }

    /**
     * Unregisters a listener for the RIGHT_DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offRightDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('RIGHT_DOWN', callback)
    }

    /**
     * Registers a listener for the RIGHT_UP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onRightUp(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_UP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the RIGHT_UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offRightUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('RIGHT_UP', callback)
    }

    /**
     * Registers a listener for the RIGHT_CLICK event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onRightClick(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('RIGHT_CLICK', callback, options, userData)
    }

    /**
     * Unregisters a listener for the RIGHT_CLICK event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offRightClick(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('RIGHT_CLICK', callback)
    }

    /**
     * Registers a listener for the MIDDLE_DOWN event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMiddleDown(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_DOWN', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MIDDLE_DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMiddleDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MIDDLE_DOWN', callback)
    }

    /**
     * Registers a listener for the MIDDLE_UP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMiddleUp(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_UP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MIDDLE_UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMiddleUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MIDDLE_UP', callback)
    }

    /**
     * Registers a listener for the MIDDLE_CLICK event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMiddleClick(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MIDDLE_CLICK', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MIDDLE_CLICK event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMiddleClick(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MIDDLE_CLICK', callback)
    }

    /**
     * Registers a listener for the MOUSE_MOVE event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseMove(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_MOVE', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_MOVE event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseMove(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_MOVE', callback)
    }

    /**
     * Registers a listener for the MOUSE_ENTER event, triggered once when the mouse starts hovering over an entity.
     * Alias for onMouseOver.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseEnter(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_ENTER', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_ENTER event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseEnter(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_ENTER', callback)
    }

    /**
     * Registers a listener for the MOUSE_LEAVE event, triggered once when the mouse leaves an entity.
     * Alias for onMouseOut.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseLeave(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_LEAVE', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_LEAVE event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseLeave(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_LEAVE', callback)
    }

    /**
     * Registers a listener for the MOUSE_OVER event, triggered once when the mouse starts hovering over an entity.
     * Alias for onMouseEnter.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseOver(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_ENTER', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_OVER event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseOver(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_ENTER', callback)
    }

    /**
     * Registers a listener for the MOUSE_OUT event, triggered once when the mouse leaves an entity.
     * Alias for onMouseLeave.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onMouseOut(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('MOUSE_LEAVE', callback, options, userData)
    }

    /**
     * Unregisters a listener for the MOUSE_OUT event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offMouseOut(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('MOUSE_LEAVE', callback)
    }

    /**
     * Registers a listener for the WHEEL event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onWheel(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('WHEEL', callback, options, userData)
    }

    /**
     * Unregisters a listener for the WHEEL event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offWheel(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('WHEEL', callback)
    }

    /**
     * Registers a listener for the TAP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onTap(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('TAP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the TAP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offTap(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('TAP', callback)
    }

    /**
     * Registers a listener for the DOUBLE_TAP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onDoubleTap(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('DOUBLE_TAP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the DOUBLE_TAP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offDoubleTap(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('DOUBLE_TAP', callback)
    }

    /**
     * Registers a listener for the LONG_TAP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onLongTap(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('LONG_TAP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the LONG_TAP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offLongTap(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('LONG_TAP', callback)
    }

    /**
     * Registers a listener for the PINCH_START event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onPinchStart(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_START', callback, options, userData)
    }

    /**
     * Unregisters a listener for the PINCH_START event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offPinchStart(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('PINCH_START', callback)
    }

    /**
     * Registers a listener for the PINCH_MOVE event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onPinchMove(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_MOVE', callback, options, userData)
    }

    /**
     * Unregisters a listener for the PINCH_MOVE event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offPinchMove(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('PINCH_MOVE', callback)
    }

    /**
     * Registers a listener for the PINCH_END event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onPinchEnd(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('PINCH_END', callback, options, userData)
    }

    /**
     * Unregisters a listener for the PINCH_END event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offPinchEnd(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('PINCH_END', callback)
    }

    /**
     * Registers a listener for the KEY_DOWN event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onKeyDown(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('KEY_DOWN', callback, options, userData)
    }

    /**
     * Unregisters a listener for the KEY_DOWN event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offKeyDown(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('KEY_DOWN', callback)
    }

    /**
     * Registers a listener for the KEY_UP event.
     *
     * @param {Function} callback - The callback function to execute, receiving (event, entityId, options, userData).
     * @param {Object|boolean} [options={}] - Listener options.
     * @param {any} [userData] - User-defined data to pass to the callback.
     * @throws {Error} If callback is not a function.
     */
    onKeyUp(callback, options = {}, userData = null) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.on('KEY_UP', callback, options, userData)
    }

    /**
     * Unregisters a listener for the KEY_UP event.
     *
     * @param {Function} callback - The callback function to remove.
     * @throws {Error} If callback is not a function.
     */
    offKeyUp(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function')
        }
        this.off('KEY_UP', callback)
    }
}
