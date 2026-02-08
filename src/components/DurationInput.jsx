/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DurationInput.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-08
 * Last modified: 2026-02-08
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlInput }                                 from '@shoelace-style/shoelace/dist/react'
import React, { useCallback, useEffect, useState } from 'react'

/**
 * DurationInput component
 * Handles duration in [DD ]HH:MM format where DD is optional.
 * Input and Output values are managed in seconds.
 *
 * @param {Object} props
 * @param {number} props.value - Duration in seconds
 * @param {Function} props.onChange - Callback returning the new duration in seconds
 */
export const DurationInput = ({size, value, onChange, label}) => {
    const [tempValue, setTempValue] = useState('')

    /**
     * Converts seconds to a displayable string [DD ]HH:MM
     * Days are only displayed if value >= 24h
     */
    const secondsToDisplay = useCallback((totalSeconds) => {
        if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) {
            return ''
        }

        const days = Math.floor(totalSeconds / 86400)
        const hours = Math.floor((totalSeconds % 86400) / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)

        const dStr = days > 0 ? `${String(days).padStart(2, '0')} ` : ''
        return `${dStr}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    }, [])

    /**
     * Parses the string [DD ]HH:MM back to seconds
     * If DD is missing, it defaults to 0
     */
    const displayToSeconds = useCallback((displayStr) => {
        const str = displayStr.trim()
        if (!str) {
            return 0
        }

        // Regex: Optional group 1 for days, group 2 for hours, group 3 for minutes
        // Matches "01 12:30" or "12:30"
        const regex = /^(?:(\d+)\s+)?(\d{1,2}):(\d{1,2})$/
        const match = str.match(regex)

        if (match) {
            const days = parseInt(match[1] || 0, 10)
            const hours = parseInt(match[2], 10)
            const minutes = parseInt(match[3], 10)

            // Validate logical time constraints
            if (hours < 24 && minutes < 60) {
                return (days * 86400) + (hours * 3600) + (minutes * 60)
            }
        }
        return null
    }, [])

    // Synchronize local state with external store value
    useEffect(() => {
        setTempValue(secondsToDisplay(value))
    }, [value, secondsToDisplay])

    /**
     * Finalize input on blur: update store if valid, or reset to previous value
     */
    const handleBlur = () => {
        const seconds = displayToSeconds(tempValue)
        if (seconds !== null) {
            onChange(seconds)
        }
        else {
            // Revert to last known valid value on invalid entry
            setTempValue(secondsToDisplay(value))
        }
    }

    return (
        <SlInput
            size={size ?? 'medium'}
            label={label}
            value={tempValue}
            placeholder="[DD] HH:MM"
            onSlInput={(e) => setTempValue(e.target.value)}
            onSlBlur={handleBlur}
        >
        </SlInput>
    )
}