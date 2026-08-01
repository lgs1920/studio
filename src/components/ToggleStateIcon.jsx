/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ToggleStateIcon.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-19
 * Last modified: 2026-04-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'

// Default icons - pre-calculated for better performance
const DEFAULT_ICONS = {
    false: 'eye',
    true: 'eye-slash',
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
              appearance,
              style,
              size = 'm',
              className = '',
              tooltip,
              disabled  = false,
              buttonVariant = 'brand',
              iconVariant   = 'regular',
              family        = false,
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
            return DEFAULT_ICONS[state]
        }
        return currentIcon
    }, [icons, state])

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

    const buttonComponent = useMemo(() => (
        <WaButton
            name={currentIconName}
            size={size}
            disabled={disabled}
            onClick={toggleState}
            className={`toggle-state-icon-${state}`}
            {...(size && {size})}
            {...(id && {id})}
            {...(style && {style})}
            {...restProps}
            appearance={appearance ?? 'plain'}
            variant={buttonVariant}
        >
            <WaIcon name={currentIconName}
                    {...(family && {family})}
                    variant={iconVariant}/>
        </WaButton>
    ), [currentIconName, size, disabled, toggleState, state, id, style, restProps])


    return (
        <div className={`toggle-state-icon ${className} ${size}`}>
            {buttonComponent}
        </div>
    )
})

ToggleStateIcon.displayName = 'ToggleStateIcon'
