/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: usePointerSingleOrDouble.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-25
 * Last modified: 2025-10-25
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Hook to detect single or double tap/click interactions using pointer events.
 * Handles single tap or click via `onSingleClickOrTap` and double tap via `onDoubleTap`.
 * Uses `PointerEvent` for compatibility with touch and mouse inputs.
 * Cleans up timeouts on component unmount.
 *
 * @param {{
 *   onSingleClickOrTap?: (event: PointerEvent) => void,
 *   onDoubleTap?: (event: PointerEvent) => void,
 *   doubleTapDelay?: number
 * }} options - Configuration object with event handlers and double-tap delay.
 * @returns {(event: PointerEvent) => void} - Unified event handler for attaching to JSX elements.
 */
import { useEffect, useRef } from 'react'

export const usePointerSingleOrDouble = ({onSingleClickOrTap, onDoubleTap, doubleTapDelay = 300}) => {
    // Reference to store the timestamp of the last tap or click
    const _lastTap = useRef(0)
    // Reference to store the timeout for single tap/click detection
    const _doubleTapTimeout = useRef(null)

    // Cleanup timeouts when the component unmounts
    useEffect(() => {
        return () => {
            if (_doubleTapTimeout.current) {
                clearTimeout(_doubleTapTimeout.current)
                _doubleTapTimeout.current = null
            }
        }
    }, [])

    // Handle pointer events for tap or click detection
    const handleEvent = (event) => {
        if (event.type === 'pointerdown') {
            // Ignore non-primary pointer events (e.g., multi-touch)
            if (event.isPrimary === false) {
                return
            }

            const now = Date.now()
            const delta = now - _lastTap.current

            // Detect double tap within the specified delay
            if (delta < doubleTapDelay && typeof onDoubleTap === 'function') {
                clearTimeout(_doubleTapTimeout.current)
                _doubleTapTimeout.current = null
                onDoubleTap(event)
            }
            else {
                // Schedule single tap/click if no double tap occurs
                _doubleTapTimeout.current = setTimeout(() => {
                    if (typeof onSingleClickOrTap === 'function') {
                        onSingleClickOrTap(event)
                    }
                    _doubleTapTimeout.current = null
                }, doubleTapDelay)
            }

            _lastTap.current = now
        }
        else if (event.type === 'pointerup' || event.type === 'pointercancel') {
            // Clear timeout if the interaction is interrupted
            if (_doubleTapTimeout.current) {
                clearTimeout(_doubleTapTimeout.current)
                _doubleTapTimeout.current = null
            }
        }
    }

    return handleEvent
}