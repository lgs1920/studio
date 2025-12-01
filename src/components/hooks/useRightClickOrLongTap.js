/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: useRightClickOrLongTap.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-12-01
 * Last modified: 2025-12-01
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { useEffect, useRef } from 'react'

/**
 * Unified hook for right-click (desktop) and long-tap (mobile) detection.
 * Prevents default browser context menu on right-click.
 * Cancels long-tap on movement or multi-touch.
 * Fully cleaned up on unmount.
 *
 * @param {Object} options
 * @param {(event: MouseEvent | TouchEvent) => void} options.onTrigger - Called on valid right-click or long-tap
 * @param {number} [options.longTapDelay=600] - Delay in ms before long-tap triggers (600ms is more natural than 500)
 * @returns {(node: HTMLElement | null) => void} - Ref callback to attach to target element
 */
export const useRightClickOrLongTap = ({onTrigger, longTapDelay = 600}) => {
    const _timeout = useRef(null)
    const _touchMoved = useRef(false)
    const _startPos = useRef({x: 0, y: 0})

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (_timeout.current) {
                clearTimeout(_timeout.current)
                _timeout.current = null
            }
        }
    }, [])

    return (element) => {
        if (!element) {
            // Cleanup if element is removed
            if (_timeout.current) {
                clearTimeout(_timeout.current)
            }
            return
        }

        // Cleanup previous listeners
        element.removeEventListener('contextmenu', handleContextMenu)
        element.removeEventListener('touchstart', handleTouchStart)
        element.removeEventListener('touchmove', handleTouchMove)
        element.removeEventListener('touchend', handleTouchEnd)
        element.removeEventListener('touchcancel', handleTouchCancel)

        // Add fresh listeners
        element.addEventListener('contextmenu', handleContextMenu)
        element.addEventListener('touchstart', handleTouchStart, {passive: true})
        element.addEventListener('touchmove', handleTouchMove, {passive: true})
        element.addEventListener('touchend', handleTouchEnd)
        element.addEventListener('touchcancel', handleTouchCancel)

        // Handlers
        function handleContextMenu(event) {
            event.preventDefault()
            event.stopPropagation()
            if (typeof onTrigger === 'function') {
                onTrigger(event)
            }
        }

        function handleTouchStart(event) {
            if (event.touches.length !== 1) {
                return
            }

            const touch = event.touches[0]
            _startPos.current = {x: touch.clientX, y: touch.clientY}
            _touchMoved.current = false

            _timeout.current = setTimeout(() => {
                if (!_touchMoved.current && typeof onTrigger === 'function') {
                    event.preventDefault() // Prevent context menu on iOS
                    onTrigger(event)
                }
                _timeout.current = null
            }, longTapDelay)
        }

        function handleTouchMove(event) {
            if (!_timeout.current) {
                return
            }

            const touch = event.touches[0]
            const dx = touch.clientX - _startPos.current.x
            const dy = touch.clientY - _startPos.current.y
            const distance = Math.hypot(dx, dy)

            // Cancel if finger moved more than 10px
            if (distance > 10) {
                _touchMoved.current = true
                clearTimeout(_timeout.current)
                _timeout.current = null
            }
        }

        function handleTouchEnd() {
            if (_timeout.current) {
                clearTimeout(_timeout.current)
                _timeout.current = null
            }
        }

        function handleTouchCancel() {
            if (_timeout.current) {
                clearTimeout(_timeout.current)
                _timeout.current = null
            }
        }
    }
}