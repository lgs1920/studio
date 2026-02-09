/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DurationInput.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-09
 * Last modified: 2026-02-09
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SlInput }                                 from '@shoelace-style/shoelace/dist/react'
import React, { useCallback, useEffect, useState } from 'react'
import { useSnapshot } from 'valtio'

/**
 * DurationInput component
 * Handles duration in HHHhMMm or HHH:MM format based on unit system.
 * Input and Output values are managed in seconds.
 *
 * @param {Object} props
 * @param {string} props.size - Shoelace input size
 * @param {number} props.value - Duration in seconds
 * @param {Function} props.onChange - Callback returning the new duration in seconds
 * @param {string} props.label - Input label
 * @returns {JSX.Element}
 */
export const DurationInput = ({size, value, onChange, label}) => {
    const [tempValue, setTempValue] = useState('')

    /**
     * Subscribe to the global unit system setting
     */
    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem).current
    const isImperial = unitSystem === 'imperial'

    /**
     * Converts seconds to a displayable string
     * Metric: HHHhMMm | Imperial: HHH:MM
     */
    const secondsToDisplay = useCallback((totalSeconds) => {
        if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds)) {
            return ''
        }

        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)

        if (isImperial) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        }

        return `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m`
    }, [isImperial])

    /**
     * Parses the string back to seconds
     * Supports Hh, :, or . as separators and up to 3 digits for hours
     */
    const displayToSeconds = useCallback((displayStr) => {
        const str = displayStr.trim()
        if (!str) {
            return 0
        }

        // Regex: 1-3 digits for hours, separator (h, H, :, .), 1-2 digits for minutes, optional m/M
        const regex = /^(\d{1,3})[hH:.](\d{1,2})[mM]?$/
        const match = str.match(regex)

        if (match) {
            const hours = parseInt(match[1], 10)
            const minutes = parseInt(match[2], 10)

            // Validate minute range
            if (minutes < 60) {
                return (hours * 3600) + (minutes * 60)
            }
        }
        return null
    }, [])

    /**
     * Sync local state with external store value on change
     */
    useEffect(() => {
        setTempValue(secondsToDisplay(value))
    }, [value, secondsToDisplay])

    /**
     * Handle live input and update parent if valid
     */
    const handleInput = (e) => {
        const val = e.target.value
        setTempValue(val)

        const seconds = displayToSeconds(val)
        if (seconds !== null && onChange) {
            onChange(seconds)
        }
    }

    /**
     * Clean up formatting on blur or revert to last valid store value
     */
    const handleBlur = () => {
        const seconds = displayToSeconds(tempValue)
        if (seconds !== null) {
            setTempValue(secondsToDisplay(seconds))
        }
        else {
            setTempValue(secondsToDisplay(value))
        }
    }

    return (
        <SlInput
            size={size ?? 'medium'}
            label={label}
            value={tempValue}
            placeholder={isImperial ? 'HHH:MM' : 'HHHhMMm'}
            onSlInput={handleInput}
            onSlBlur={handleBlur}
        />
    )
}