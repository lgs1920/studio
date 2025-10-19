/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: useRightClickOrLongTap.js
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
 * Hook to detect right-click or long-tap interactions with a single event handler.
 * Handles right-click via contextmenu (MouseEvent) and long-tap via touchstart (TouchEvent).
 * Cleans up timeouts on component unmount.
 *
 * @param {{
 *   onAction?: (e: MouseEvent | TouchEvent) => void,
 *   longTapDelay?: number
 * }} options - Interaction handler and config.
 * @returns {(e: MouseEvent | TouchEvent) => void} - Unified event handler for JSX.
 */
import { useEffect, useRef } from 'react'

export const useRightClickOrLongTap = ({onAction, longTapDelay = 500}) => {
    // Store touch start time
    const _touchStart = useRef(0)
    // Store timeout reference for long tap
    const _timeout = useRef(null)

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (_timeout.current) {
                clearTimeout(_timeout.current)
                _timeout.current = null
            }
        }
    }, [])

    // Unified event handler
    const handleEvent = (event) => {
        // Handle right-click (MouseEvent from contextmenu)
        if (event.type === 'contextmenu' && typeof onAction === 'function') {
            event.preventDefault() // Prevent default context menu
            onAction(event)
            return
        }

        // Handle touch events (long-tap via touchstart)
        if (event.type === 'touchstart') {
            if (event.touches?.length !== 1) {
                return
            }
            _touchStart.current = Date.now()
            _timeout.current = setTimeout(() => {
                if (typeof onAction === 'function') {
                    onAction(event)
                }
                _timeout.current = null
            }, longTapDelay)
        }
        else if (event.type === 'touchend' || event.type === 'touchcancel') {
            if (_timeout.current) {
                clearTimeout(_timeout.current)
                _timeout.current = null
            }
        }
    }

    return handleEvent
}