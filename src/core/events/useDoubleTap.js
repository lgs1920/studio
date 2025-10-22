/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: useDoubleTap.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-22
 * Last modified: 2025-10-22
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

/**
 * Hook to detect double-tap interactions using pointer events.
 * Handles double-tap via onPointerDown, onPointerUp, and onPointerCancel (PointerEvent).
 * Cleans up timeouts on component unmount.
 *
 * @param {{
 *   onDoubleTap?: (e: PointerEvent) => void,
 *   doubleTapDelay?: number
 * }} options - Interaction handlers and config.
 * @returns {(e: PointerEvent) => void} - Unified event handler for JSX.
 */
import { useEffect, useRef } from 'react'

export const useDoubleTap = ({onDoubleTap, doubleTapDelay = 300}) => {
    // Store last tap time for double-tap detection
    const _lastTap = useRef(0)
    // Store timeout reference for double-tap
    const _doubleTapTimeout = useRef(null)

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (_doubleTapTimeout.current) {
                clearTimeout(_doubleTapTimeout.current)
                _doubleTapTimeout.current = null
            }
        }
    }, [])

    // Unified event handler
    const handleEvent = (event) => {
        // Handle pointer events
        if (event.type === 'pointerdown') {
            if (event.isPrimary === false) {
                return
            }

            const now = Date.now()

            // Double-tap detection
            const delta = now - _lastTap.current
            if (delta < doubleTapDelay && typeof onDoubleTap === 'function') {
                clearTimeout(_doubleTapTimeout.current)
                _doubleTapTimeout.current = null
                onDoubleTap(event)
            }

            _lastTap.current = now
        }
        else if (event.type === 'pointerup' || event.type === 'pointercancel') {
            // Clear double-tap timeout
            if (_doubleTapTimeout.current) {
                clearTimeout(_doubleTapTimeout.current)
                _doubleTapTimeout.current = null
            }
        }
    }

    return handleEvent
}