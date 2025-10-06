/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: useSingleOrDoubleEvent.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-10-05
 * Last modified: 2025-10-05
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { useEffect, useRef } from 'react'

/**
 * Hook to detect single and/or double interactions (click/tap).
 * Handles double-click via onDoubleClick (MouseEvent) and double-tap via onTouchStart (TouchEvent).
 * Cleans up timeouts on component unmount.
 *
 * @param {{
 *   onSingle?: (e: MouseEvent | TouchEvent) => void,
 *   onDouble: (e: MouseEvent | TouchEvent) => void,
 *   delay?: number
 * }} options - Interaction handlers and config.
 * @returns {(e: MouseEvent | TouchEvent) => void} - Unified event handler for JSX.
 */
export const useSingleOrDoubleEvent = ({onSingle, onDouble, delay = 300}) => {
    const lastTap = useRef(0)
    const timeoutRef = useRef(null)

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [])

    return (e) => {
        // Handle double-click (MouseEvent from onDoubleClick)
        if (e.type === 'dblclick' && typeof onDouble === 'function') {
            onDouble(e)
            return
        }

        // Handle touch events (double-tap via onTouchStart)
        if (e.type === 'touchstart' && e.touches?.length === 1) {
            const now = Date.now()
            const delta = now - lastTap.current

            if (delta < delay && typeof onDouble === 'function') {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
                onDouble(e)
            }
            else if (typeof onSingle === 'function') {
                timeoutRef.current = setTimeout(() => {
                    onSingle(e)
                    timeoutRef.current = null
                }, delay)
            }

            lastTap.current = now
        }
    }
}