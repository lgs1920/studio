/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: VideoMessage.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-27
 * Last modified: 2026-04-27
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import React, { useState, useEffect, useRef } from 'react'

/**
 * Displays a temporary message that disappears after a specified duration.
 * The blinking effect is handled by CSS using the `blinking` class and `--blink-rate` variable.
 *
 * @component
 * @param {Object} props - Component props
 * @param {string|React.ReactNode} props.children - Content to display inside the message
 * @param {number} [props.duration=3600] - Total lifetime of the message in seconds (default: 1 hour)
 * @param {number} [props.blinkRate=0] - Blink rate in second (default: 0, no blinking)
 * @returns {React.ReactElement|null} The message element or null when fully hidden
 */
export const VideoMessage = ({children, duration = 3600, blinkRate = 0}) => {
    /** @type {React.MutableRefObject<NodeJS.Timeout|null>} */
    const timerRef = useRef(null)
    /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} */
    const [isVisible, setIsVisible] = useState(true)

    /**
     * Hides the message after the specified duration
     */
    useEffect(() => {
        // Cleanup previous timer
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }

        // Hide after the specified duration
        timerRef.current = setTimeout(() => {
            setIsVisible(false)
        }, duration * 1000)

        // Cleanup on unmount
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current)
            }
        }
    }, [duration])

    // Do not render if the message is fully hidden
    if (!isVisible) {
        return null
    }

    return (
        <div
            className="lgs-one-line-card wa-theme-lgs1920-on-map lgs-video-message blinking"
            style={{
                '--blink-speed': `${blinkRate}s`,
            }}
            role="alert"
            aria-live="polite"
        >
            {children}
        </div>
    )
}
