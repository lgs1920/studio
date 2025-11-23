/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoMessage.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-11-23
 * Last modified: 2025-11-23
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import React, { useState, useEffect, useRef } from 'react'

/**
 * Message component – displays a temporary message that blinks for the last 3 seconds
 * before disappearing completely.
 *
 * @component
 * @param {Object} props - Component props
 * @param {string|React.ReactNode} props.message - Content to display inside the message
 * @param {number} [props.duration=3600] - Total lifetime of the message in seconds (default: 1 hour)
 * @param {number} [props.blinkRate=1] - Blink frequency in Hz during the final 3 seconds (1 = 1 blink per second)
 * @returns {React.ReactElement|null} The message element or null when fully hidden
 */
export const VideoMessage = ({children, duration = 3600, blinkRate = 1}) => {
    // Visibility state – false when the message is completely gone
    const [isVisible, setIsVisible] = useState(true)

    // Indicates whether we are in the final blinking phase
    const [isBlinking, setIsBlinking] = useState(false)

    // Refs for cleanup
    const _timer = useRef(null)
    const _blinkInterval = useRef(null)

    /**
     * Effect that orchestrates the whole lifecycle:
     * 1. Wait (duration - 3) seconds
     * 2. Start blinking for 3 seconds
     * 3. Hide the message completely
     */
    useEffect(() => {
        // Clear any previous timers on re-mount or prop change
        _timer.current && clearTimeout(_timer.current)
        _blinkInterval.current && clearInterval(_blinkInterval.current)

        // If duration is too short for a proper 3-second blink phase, hide immediately
        if (duration <= 3) {
            setIsVisible(false)
            return
        }

        // Schedule the start of the blinking phase
        _timer.current = setTimeout(() => {
            setIsBlinking(true)

            // Toggle visibility at the requested rate
            _blinkInterval.current = setInterval(() => {
                setIsVisible(prev => !prev)
            }, 1000 / blinkRate)
        }, (duration - 3) * 1000)

        // Schedule final disappearance after the 3-second blink period
        const finalTimeout = setTimeout(() => {
            _blinkInterval.current && clearInterval(_blinkInterval.current)
            setIsBlinking(false)
            setIsVisible(false)
        }, duration * 1000)

        // Cleanup function – runs on unmount or when dependencies change
        return () => {
            clearTimeout(_timer.current)
            clearTimeout(finalTimeout)
            clearInterval(_blinkInterval.current)
        }
    }, [duration, blinkRate])

    // Do not render anything once the message is fully hidden
    if (!isVisible && !isBlinking) {
        return null
    }

    return (
        <div
            className={`lgs-one-line-card on-map blinking lgs-video-message${isBlinking ? ' blinking' : ''}`}
            style={{
                // CSS custom property used by the blinking animation
                '--blink-rate': `${1 / blinkRate}s`,
                // Force visibility during blink phase even when isVisible is false
                opacity:   isBlinking || isVisible ? 1 : 0,
                animation: isBlinking ? `blink var(--blink-rate)` : 'none',
            }}
            role="alert"
            aria-live="polite"
        >
            {children}
        </div>
    )
}