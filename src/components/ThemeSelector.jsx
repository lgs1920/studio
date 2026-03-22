/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ThemeSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-22
 * Last modified: 2026-03-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaDivider, WaDropdown, WaDropdownItem, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import React, { useEffect, useState }                              from 'react'

/**
 * Theme Selector component
 * @returns {JSX.Element}
 */
const ThemeSelector = () => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system')
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const $root = document.documentElement
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

        const updateTheme = () => {
            const currentIsDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
            setIsDark(currentIsDark)
            $root.classList.toggle('wa-dark', currentIsDark)
            $root.classList.toggle('wa-light', !currentIsDark)
        }

        updateTheme()
        localStorage.setItem('theme', theme)

        if (theme === 'system') {
            mediaQuery.addEventListener('change', updateTheme)
            return () => mediaQuery.removeEventListener('change', updateTheme)
        }
    }, [theme])

    /**
     * Handle the selection event
     * @param {CustomEvent} event
     */
    const handleSelect = (event) => {
        setTheme(event.detail.item.value)
    }

    return (
        <WaDropdown onWaSelect={handleSelect} slot={'header-actions'} appearance="filled-outlined"
                    className="lgs--theme-selector">
            <WaButton slot={'trigger'} appearance="plain" variant={'neutral'}>
                <WaIcon slot="start" name={isDark ? 'moon-stars' : 'sun-bright'} variant="regular"/>
            </WaButton>

            <WaDropdownItem value={'light'}>
                <WaIcon slot="icon" name={'sun-bright'} variant="regular"/>{' Light '}
            </WaDropdownItem>

            <WaDropdownItem value={'dark'}>
                <WaIcon slot="icon" name={'moon-stars'} variant="regular"/>{' Dark '}
            </WaDropdownItem>
            <WaDivider/>
            <WaDropdownItem value={'system'}>
                <WaIcon slot="icon" name="cog" variant="regular"/>{' System '}
            </WaDropdownItem>
        </WaDropdown>
    )
}

export default ThemeSelector