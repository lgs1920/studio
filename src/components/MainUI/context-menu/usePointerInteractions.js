/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: usePointerInteractions.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { useEffect, useRef } from 'react'

/**
 * Custom React hook to handle pointer interactions (tap, double tap, long press, right click).
 *
 * ✅ Long press is triggered DURING the hold (after `longTapDelay` ms).
 * ✅ Single tap is triggered on release if no long press occurred.
 * ✅ Double tap is detected if two taps occur within 300 ms.
 * ✅ Right click triggers the same callback as long press.
 *
 * @param {Object}   options - Configuration object
 * @param {Function} [options.onSingleTap] - Callback for single tap
 * @param {Function} [options.onDoubleTap] - Callback for double tap
 * @param {Function} options.onLongTapOrRightClick - Callback for long press or right click
 * @param {number}   [options.longTapDelay=600] - Delay in ms before long press fires
 * @param {boolean}  [options.preventContextMenu=true] - Prevent native context menu on right click
 * @returns {function(HTMLElement|null): void} - Ref callback to attach to target element
 *
 * -----------------------------------------------------------------------------
 * Timeline (ASCII diagram)
 * -----------------------------------------------------------------------------
 *
 * Single Tap:
 *   pointerdown ───────────── pointerup
 *   |<─── release triggers single tap ───>|
 *
 * Double Tap:
 *   pointerdown ─ pointerup   pointerdown ─ pointerup
 *   |<─ tap 1 ─>|<─ tap 2 ─>|
 *   (second tap within 300 ms triggers double tap)
 *
 * Long Press:
 *   pointerdown ──────────────── [600 ms threshold] ──────────────── pointerup
 *   |<─── hold ───>| trigger long press DURING hold
 *   (release does nothing once long press fired)
 *
 * Movement Cancel:
 *   pointerdown ──── pointermove (>10px) ──── pointerup
 *   (movement cancels long press timer, no tap triggered)
 *
 * Right Click:
 *   contextmenu event ────────────────► triggers same callback as long press
 *
 * -----------------------------------------------------------------------------
 */
export const usePointerInteractions = ({
                                           onSingleTap,
                                           onDoubleTap,
                                           onLongTapOrRightClick,
                                           longTapDelay = 600,
                                           preventContextMenu = true,
                                       }) => {
    // Internal state stored in a ref (persists across renders without re-rendering)
    const state = useRef({
                             timer:     null,       // Timeout ID for long press
                             startX:    0,         // X coordinate at pointer down
                             startY:    0,         // Y coordinate at pointer down
                             moved:     false,      // Flag if pointer moved significantly
                             longFired: false,  // Flag if long press already fired
                             lastTap:   0,        // Timestamp of last tap
                             element:   null,     // Bound DOM element
                         }).current

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (state.timer) {
                clearTimeout(state.timer)
            }
        }
    }, [])

    /**
     * Reset internal flags and clear any pending timers.
     * Called after each interaction cycle.
     */
    const reset = () => {
        if (state.timer) {
            clearTimeout(state.timer)
            state.timer = null
        }
        state.moved = false
        state.longFired = false
    }

    /**
     * Main binding function: attaches pointer event handlers to the given element.
     */
    return (element) => {
        // Remove listeners from previous element if ref changes
        if (state.element && state.element !== element) {
            state.element.onpointerdown =
                state.element.onpointermove =
                    state.element.onpointerup =
                        state.element.onpointercancel =
                            state.element.oncontextmenu = null
        }
        state.element = element

        if (!element) {
            reset()
            return
        }

        /**
         * Context menu handler (right click).
         * Can be prevented to avoid native browser menu.
         */
        element.oncontextmenu = (e) => {
            if (preventContextMenu) {
                e.preventDefault()
            }
            onLongTapOrRightClick?.(e)
        }

        /**
         * Pointer down handler.
         * - Starts tracking coordinates
         * - Detects double tap
         * - Sets timer for long press
         */
        element.onpointerdown = (e) => {
            if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) {
                return
            }

            // Prevent native press-and-hold behavior on mobile
            // TODO : check if it has side effects on touch devices
            // if (e.pointerType === 'touch') {
            //   e.preventDefault()
            // }

            const now = Date.now()
            const prevTap = state.lastTap
            reset() // reset flags before starting new cycle

            state.startX = e.clientX
            state.startY = e.clientY
            state.lastTap = now

            // Double tap detection (within 300 ms)
            if (prevTap && now - prevTap < 300) {
                onDoubleTap?.(e)
                state.lastTap = 0
                reset()
                return
            }

            // Long press timer → fires DURING hold
            state.timer = setTimeout(() => {
                if (state.moved || state.longFired) {
                    return
                }
                state.longFired = true

                const longPressEvent = new PointerEvent('pointerdown', {
                    bubbles:     true,
                    cancelable:  true,
                    clientX:     state.startX,
                    clientY:     state.startY,
                    screenX:     e.screenX,
                    screenY:     e.screenY,
                    pointerType: e.pointerType,
                    isPrimary:   true,
                })

                // Legacy support: add touches array for touch devices
                if (e.pointerType === 'touch') {
                    Object.defineProperty(longPressEvent, 'touches', {
                        value:    [{clientX: state.startX, clientY: state.startY}],
                        writable: false,
                    })
                }

                onLongTapOrRightClick?.(longPressEvent)
            }, longTapDelay)
        }

        /**
         * Pointer move handler.
         * Cancels long press if movement exceeds threshold (10px).
         */
        element.onpointermove = (e) => {
            if (!e.isPrimary || state.longFired) {
                return
            }
            const dx = e.clientX - state.startX
            const dy = e.clientY - state.startY
            if (Math.hypot(dx, dy) > 10) {
                state.moved = true
                if (state.timer) {
                    clearTimeout(state.timer)
                    state.timer = null
                }
            }
        }

        /**
         * Pointer up / cancel handler.
         * - If long press already fired → do nothing
         * - Else, trigger single tap if no movement and within 300 ms
         */
        element.onpointerup = element.onpointercancel = (e) => {
            if (state.longFired) {
                // Long press already triggered → ignore release
                reset()
                return
            }

            if (!state.moved) {
                const elapsed = Date.now() - state.lastTap
                if (elapsed < 300) {
                    onSingleTap?.(e)
                }
            }
            reset()
        }
    }
}