/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: useDoubleOrLongTap.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-19
 * Last modified: 2025-10-19
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/
/**
 * Hook to detect double-tap or long-tap interactions.
 * Handles double-tap and long-tap via onTouchStart, onTouchEnd, and onTouchCancel (TouchEvent).
 * Cleans up timeouts on component unmount.
 *
 * @param {{
 *   onDoubleTap?: (e: TouchEvent) => void,
 *   onLongTap?: (e: TouchEvent) => void,
 *   doubleTapDelay?: number,
 *   longTapDelay?: number
 * }} options - Interaction handlers and config.
 * @returns {(e: TouchEvent) => void} - Unified event handler for JSX.
 */
import { useEffect, useRef } from 'react'

export const useDoubleOrLongTap = ({onDoubleTap, onLongTap, doubleTapDelay = 300, longTapDelay = 500}) => {
    // Store last tap time for double-tap detection
    const _lastTap = useRef(0)
    // Store touch start time for long-tap detection
    const _touchStart = useRef(0)
    // Store timeout reference for double-tap
    const _doubleTapTimeout = useRef(null)
    // Store timeout reference for long-tap
    const _longTapTimeout = useRef(null)

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (_doubleTapTimeout.current) {
                clearTimeout(_doubleTapTimeout.current)
                _doubleTapTimeout.current = null
            }
            if (_longTapTimeout.current) {
                clearTimeout(_longTapTimeout.current)
                _longTapTimeout.current = null
            }
        }
    }, [])

    // Unified event handler
    const handleEvent = (event) => {
        // Handle touch events
        if (event.type === 'touchstart') {
            if (event.touches?.length !== 1) {
                return
            }

            const now = Date.now()

            // Long-tap detection
            _touchStart.current = now
            _longTapTimeout.current = setTimeout(() => {
                if (typeof onLongTap === 'function') {
                    onLongTap(event)
                }
                _longTapTimeout.current = null
                // Clear double-tap timeout to prevent single-tap action
                if (_doubleTapTimeout.current) {
                    clearTimeout(_doubleTapTimeout.current)
                    _doubleTapTimeout.current = null
                }
            }, longTapDelay)

            // Double-tap detection
            const delta = now - _lastTap.current
            if (delta < doubleTapDelay && typeof onDoubleTap === 'function') {
                clearTimeout(_doubleTapTimeout.current)
                clearTimeout(_longTapTimeout.current)
                _doubleTapTimeout.current = null
                _longTapTimeout.current = null
                onDoubleTap(event)
            }

            _lastTap.current = now
        }
        else if (event.type === 'touchend' || event.type === 'touchcancel') {
            // Cancel long-tap if touch ends or is canceled before longTapDelay
            if (_longTapTimeout.current) {
                clearTimeout(_longTapTimeout.current)
                _longTapTimeout.current = null
            }
        }
    }

    return handleEvent
}
