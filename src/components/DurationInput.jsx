/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DurationInput.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-02-10
 * Last modified: 2026-02-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: DurationInput.jsx
 ******************************************************************************/

import { SlInput } from '@shoelace-style/shoelace/dist/react'
import React, { useCallback, useEffect, useState } from 'react'
import { useSnapshot } from 'valtio'

export const DurationInput = ({size, value, onSlInput, label, className}) => {
    const [tempValue, setTempValue] = useState('')

    const $unitSystem = lgs.settings.unitSystem
    const unitSystem = useSnapshot($unitSystem).current
    const isImperial = unitSystem === 'imperial'

    /**
     * Converts seconds from store to display format (00:00 or 00h00m).
     */
    const secondsToDisplay = useCallback((totalSeconds) => {
        if (totalSeconds === null || totalSeconds === undefined || isNaN(totalSeconds) || totalSeconds === 0) {
            return ''
        }
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)

        return isImperial
               ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
               : `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m`
    }, [isImperial])

    /**
     * Parses the display string back to seconds.
     */
    const displayToSeconds = useCallback((displayStr) => {
        const str = displayStr.trim()
        if (!str) {
            return 0
        }

        // Supports: 01:30, 01h30, 01.30, 1:30, 1h30m
        const regex = /^(\d{1,3})[hH:.](\d{1,2})[mM]?$/
        const match = str.match(regex)

        if (match) {
            const hours = parseInt(match[1], 10)
            const minutes = parseInt(match[2], 10)
            if (minutes < 60) {
                return (hours * 3600) + (minutes * 60)
            }
        }
        return null
    }, [])

    // Sync local display when external value change (e.g. source selection change)
    useEffect(() => {
        setTempValue(secondsToDisplay(value))
    }, [value, secondsToDisplay])

    const handleInput = (e) => {
        const val = e.target.value
        setTempValue(val)

        const seconds = displayToSeconds(val)
        // Only propagate if the format is valid (not null)
        if (seconds !== null && onSlInput) {
            onSlInput(seconds)
        }
    }

    const handleBlur = () => {
        // Re-format the display value on blur to ensure clean UI
        setTempValue(secondsToDisplay(value))
    }

    return (
        <SlInput
            size={size ?? 'small'}
            label={label}
            value={tempValue}
            className={className}
            onSlInput={handleInput}
            onSlBlur={handleBlur}
            placeholder={isImperial ? 'HH:MM' : 'HHhMMm'}
        />
    )
}