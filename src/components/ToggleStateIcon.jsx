/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToggleStateIcon.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-27
 * Last modified: 2025-06-27
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { faEye, faEyeSlash }          from '@fortawesome/pro-regular-svg-icons'
import { SlIconButton, SlTooltip }                                from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'

// Default icons - pre-calculated for better performance
const DEFAULT_ICONS = {
    false: faEye,
    true:  faEyeSlash,
}

/**
 * A memoized toggle state icon component that switches between two states
 * @param {Object} props - Component props
 * @param {Function} props.onChange - Callback function when state changes
 * @param {boolean} props.initial - Initial state value
 * @param {Object} props.icons - Custom icons object with true/false or shown/hidden properties
 * @param {string} props.id - Element ID
 * @param {Object} props.style - Inline styles
 * @param {string} props.size - Size class
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.tooltip - Tooltip configuration with true/false properties
 * @param {boolean} props.disabled - Whether the button is disabled
 * @returns {JSX.Element} The rendered toggle state icon
 */
export const ToggleStateIcon = memo((props) => {
    const {
              onChange,
              initial   = true,
              icons: customIcons,
              id,
              style,
              size      = '',
              className = '',
              tooltip,
              disabled  = false,
              ...restProps
          } = props

    // Memoize icons to prevent recalculation and ensure valid icon definitions
    const icons = useMemo(() => {
        if (!customIcons) {
            return DEFAULT_ICONS
        }

        // Create a new icons object based on custom icons
        const processedIcons = {...DEFAULT_ICONS}

        // Handle different icon property formats
        if (customIcons.true !== undefined) {
            processedIcons.true = customIcons.true
        }
        else if (customIcons.hidden !== undefined) {
            processedIcons.true = customIcons.hidden
        }

        if (customIcons.false !== undefined) {
            processedIcons.false = customIcons.false
        }
        else if (customIcons.shown !== undefined) {
            processedIcons.false = customIcons.shown
        }

        // Validate that both icons are defined
        if (!processedIcons.true || !processedIcons.false) {
            console.warn('ToggleStateIcon: Invalid icon definitions, falling back to defaults')
            return DEFAULT_ICONS
        }

        return processedIcons
    }, [customIcons])

    // State management
    const [state, setState] = useState(initial)

    // Memoize the current icon name to avoid recalculation
    const currentIconName = useMemo(() => {
        const currentIcon = icons[state]
        if (!currentIcon) {
            console.error('ToggleStateIcon: Current icon is undefined for state:', state)
            return FA2SL.set(DEFAULT_ICONS[state])
        }
        return FA2SL.set(currentIcon)
    }, [icons, state])

    // Memoize tooltip content
    const tooltipContent = useMemo(() => {
        if (!tooltip) {
            return null
        }
        return tooltip[state] || tooltip[state ? 'true' : 'false']
    }, [tooltip, state])

    // Optimized toggle handler
    const toggleState = useCallback(async (event) => {
        if (disabled) {
            return
        }

        const newState = !state
        setState(newState)

        if (onChange) {
            try {
                await onChange(newState, event)
            }
            catch (error) {
                console.error('ToggleStateIcon onChange error:', error)
                // Revert state on error
                setState(state)
            }
        }
    }, [state, onChange, disabled])

    // Sync with initial prop changes
    useEffect(() => {
        setState(initial)
    }, [initial])

    // Memoize the button component
    const buttonComponent = useMemo(() => (
        <SlIconButton
            library="fa"
            name={currentIconName}
            size={size}
            disabled={disabled}
            onClick={toggleState}
            className={`toggle-state-icon-${state}`}
            {...(id && {id})}
            {...(style && {style})}
            {...restProps}
        />
    ), [currentIconName, size, disabled, toggleState, state, id, style, restProps])

    // Render with or without tooltip
    if (tooltipContent) {
        return (
            <div className={`toggle-state-icon ${className} ${size}`}>
                <SlTooltip content={tooltipContent}>
                    {buttonComponent}
                </SlTooltip>
            </div>
        )
    }

    return (
        <div className={`toggle-state-icon ${className} ${size}`}>
            {buttonComponent}
        </div>
    )
})

ToggleStateIcon.displayName = 'ToggleStateIcon'