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
import { CESIUM_EVENTS, EVENT_SEPARATOR, MODIFIER_SEPARATOR } from './cesiumEvents'

const TOUCH_DOUBLE_TAP_TIMEOUT = 300
const TOUCH_LONG_TAP_TIMEOUT = 600
/**
 * CesiumEventManager handles mouse, mobile, and modifier-based events.
 * Event names follow the format "<MODIFIER>#<EVENT_TYPE>".
 */
export class CanvasEventManager {
    /** @type {Object} Constants for event types */
    events = CESIUM_EVENTS

    /**
     * Creates a new CesiumEventManager.
     * @param {Viewer} viewer - The Cesium viewer instance.
     */
    constructor(viewer) {
        this.viewer = viewer
        this.handlers = new Map()
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(viewer.scene.canvas)
        this.lastTapTime = 0
        this.tapTimeout = null
        this.isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0) ||
            window.matchMedia('(pointer: coarse)').matches


        // Track modifier key states globally
        this.modifierState = {
            CTRL:  false,
            SHIFT: false,
            ALT:   false,
        }


        window.addEventListener('keydown', (event) => this.#updateModifierState(event, true))
        window.addEventListener('keyup', (event) => this.#updateModifierState(event, false))
    }

    /**
     * Updates the state of modifier keys (CTRL, SHIFT, ALT) based on key press events.
     * @param {KeyboardEvent} event - The keyboard event.
     * @param {boolean} isActive - Indicates whether the key is pressed (true) or released (false).
     * @private
     */
    #updateModifierState(event, isActive) {
        const keyMap = {
            ControlLeft:  'CTRL',
            ControlRight: 'CTRL',
            ShiftLeft:    'SHIFT',
            ShiftRight:   'SHIFT',
            AltLeft:      'ALT',
            AltRight:     'ALT',
            Control:      'CTRL',
            Shift:        'SHIFT',
            Alt:          'ALT',
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
     * Registers an event listener with "<MODIFIER>#<EVENT_TYPE>" format.
     * @param {string} eventName - Formatted event name (e.g., "CTRL#CLICK").
     * @param {Function} callback - Function to execute on event trigger.
     * @param {Object} [options={}|boolean] - true/false => once
     *                                      - options: {useEntity, once}
     */
    on(eventName, callback, options = {}) {
        const {modifiers, eventType} = this.#parseEventName(eventName)

        // If options is a boolean, convert it into an object { once: true }
        if (typeof options === 'boolean') {
            options = {once: options}
        }


        const useEntity = options?.useEntity || false

        if (this.events[eventType]) {
            let handler
            if (this.isTouchDevice) {
                handler = this.#setupTouchEvents(eventType, callback, useEntity, modifiers)
                this.viewer.scene.canvas.addEventListener('touchend', handler, false)
            }
            else {
                handler = this.#setupMouseEvents(eventType, callback, useEntity, modifiers)
            }

            if (handler) {
                // Store and attach handler to Cesium event system
                this.handlers.set(eventName, handler)
                this.screenSpaceEventHandler.setInputAction(handler, this.events[eventType].event)

                if (options.once) {
                    this.off(eventName)
                }
            }
        }
    }

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
                }, DOUBLE_CLICK_TIMEOUT + 50)
            }
            else if (this.events[eventType]?.type === 'LEFT_DOUBLE_CLICK') {
                clearTimeout(clickTimeout)
                callback(event, pickedEntity?.id)
            }
            else {
                callback(event, pickedEntity?.id)
            }
        }
    }


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
    }

    /**
     * Adds an event listener using the existing `on` method.
     * @param {string} eventName - Formatted event name (e.g., "CTRL#CLICK").
     * @param {Function} callback - The callback function.
     * @param {Object} [options={}] - Additional options (`useEntity`, `once`).
     */
    addEventListener(eventName, callback, options = {}) {
        this.on(eventName, callback, options)
    }

    /**
     * Removes a specific event listener using the existing `off` method.
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
     * (# issthe default)
     * If no "#" is found, the event type is assumed to have no modifiers.
     *
     * @param {string} eventName - The formatted event name.
     * @returns {Object} { modifiers: Array<string>, eventType: string }
     * @private
     */
    #parseEventName(eventName) {
        if (typeof eventName !== 'string' || !eventName.trim()) {
            throw new Error('Invalid event name: must be a non-empty string')
        }
        // Ensure the separator exists in the event name
        if (!eventName.includes(MODIFIER_SEPARATOR)) {
            return {modifiers: [], eventType: eventName} // No modifiers, entire name is the event
        }

        // Split based on the defined separator
        const [modifierPart, eventType] = eventName.split(MODIFIER_SEPARATOR, 2) // Ensure only 2 splits

        return {
            modifiers: modifierPart ? modifierPart.split(EVENT_SEPARATOR) : [], // Extract modifiers if present
            eventType: eventType || modifierPart, // Ensure event type is correctly assigned
        }


    }


    /**
     * Handles touch interactions (long tap and double tap).
     * @param {string} eventName - The formatted event name.
     * @param {Function} callback - Function to execute.
     * @private
     */
    #setupTouchEvents = (eventType, callback, useEntity, modifiers) => {
        if (!this.events[eventType]?.touch) {
            return null
        }

        let lastTapTime = 0
        let tapTimeout = null
        let longTapTimer = null
        let isLongTapActive = false
        return (event) => {
            if (!event.changedTouches || event.changedTouches.length === 0) {
                return
            }

            const touch = event.changedTouches[0]
            const touchPosition = new Cartesian2(touch.clientX, touch.clientY)

            if (!this.#checkKeyModifiers(modifiers)) {
                return
            }

            const tapNow = Date.now()
            const tapDiff = tapNow - lastTapTime
            lastTapTime = tapNow

            let isLongTapActive = false
            let isDoubleTapActive = false

            // 🚀 Gestion du Double Tap
            if (tapDiff < 300 && tapDiff > 0) {
                clearTimeout(longTapTimer)
                clearTimeout(tapTimeout) // Annule le TAP
                isDoubleTapActive = true // Marquer que DOUBLE_TAP a été validé
                console.log('🚀 Double Tap détecté !')
                if (this.events[eventType]?.type === 'DOUBLE_TAP') {
                    callback(event, this.viewer.scene.pick(touchPosition)?.id)
                }
                return
            }

            // 🕒 Gestion du `LONG_TAP`
            longTapTimer = setTimeout(() => {
                console.log('⏳ Long Tap détecté !')
                isLongTapActive = true
                clearTimeout(tapTimeout) // Annule immédiatement le TAP
                if (this.events[eventType]?.type === 'LONG_TAP') {
                    callback(event, this.viewer.scene.pick(touchPosition)?.id)
                }
            }, 600)

            // 📱 Gestion du `TAP`
            this.viewer.scene.canvas.addEventListener('touchend', (touchEvent) => {
                if (isLongTapActive || isDoubleTapActive) { // Empêcher TAP si LONG_TAP ou DOUBLE_TAP a été validé
                    return
                }
                isDoubleTapActive = false
                isLongTapActive = false

                console.log('📱 Tap détecté !')
                if (this.events[eventType]?.type === 'TAP') {
                    callback(event, this.viewer.scene.pick(new Cartesian2(touchEvent.changedTouches[0].clientX, touchEvent.changedTouches[0].clientY))?.id)
                }
                clearTimeout(longTapTimer)
            }, {once: true})
        }
    }

    destroy() {
        this.removeAllListeners()
        window.removeEventListener('keydown', this.#updateModifierState)
        window.removeEventListener('keyup', this.#updateModifierState)
        if (this.touchEndHandler) {
            this.viewer.scene.canvas.removeEventListener('touchend', this.touchEndHandler)
        }
        this.screenSpaceEventHandler.destroy()
    }
}