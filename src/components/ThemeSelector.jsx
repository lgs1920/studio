/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ThemeSelector.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-01
 * Last modified: 2026-05-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { WaButton, WaDivider, WaDropdown, WaDropdownItem, WaIcon } from '@web.awesome.me/webawesome-pro/dist/react'
import { useEffect, useState } from 'react'
import { useSnapshot }         from 'valtio'
import { AppUtils }            from '@Utils/AppUtils'

const BRAND_OPTIONS = [
    {value: 'yellow', label: 'Yellow', swatch: 'var(--wa-color-yellow)'},
    {value: 'orange', label: 'Orange', swatch: 'var(--wa-color-orange)'},
    {value: 'red', label: 'Red', swatch: 'var(--wa-color-red-40)'},
    {value: 'pink', label: 'Pink', swatch: 'var(--wa-color-pink-70)'},
    {value: 'purple', label: 'Purple', swatch: 'var(--wa-color-purple)'},
    {value: 'blue', label: 'Blue', swatch: 'var(--wa-color-blue)'},
    {value: 'green', label: 'Green', swatch: 'var(--wa-color-green-90)'},
    {value: 'gray', label: 'Gray', swatch: 'var(--wa-color-gray)'},
]

const getSystemThemeIcon = (device) => {
    if (device.mobile) {
        return 'mobile'
    }
    if (device.tablet) {
        return 'tablet'
    }
    return 'desktop'
}

/**
 * Theme Selector component
 * @returns {JSX.Element}
 */
const ThemeSelector = () => {
    const device = useSnapshot(lgs.stores.ui.device)
    const [theme, setTheme] = useState(localStorage.getItem(AppUtils.THEME_STORAGE_KEY) || 'system')
    const [brandColor, setBrandColor] = useState(AppUtils.resolveBrandColor())
    const [isDark, setIsDark] = useState(false)
    const currentBrand = BRAND_OPTIONS.find(option => option.value === brandColor) || BRAND_OPTIONS[0]
    const systemThemeIcon = getSystemThemeIcon(device)
    const currentThemeIcon = theme === 'system' ? systemThemeIcon : isDark ? 'moon-stars' : 'sun-bright'

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

        const updateTheme = () => {
            const currentIsDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
            setIsDark(currentIsDark)
            AppUtils.setTheme(theme, brandColor)
        }

        updateTheme()
        localStorage.setItem(AppUtils.THEME_STORAGE_KEY, theme)
        localStorage.setItem(AppUtils.BRAND_COLOR_STORAGE_KEY, brandColor)

        if (theme === 'system') {
            mediaQuery.addEventListener('change', updateTheme)
            return () => mediaQuery.removeEventListener('change', updateTheme)
        }
    }, [theme, brandColor])

    /**
     * Handle the selection event
     * @param {CustomEvent} event
     */
    const handleSelect = (event) => {
        setTheme(event.detail.item.value)
    }

    const handleBrandSelect = (event) => {
        setBrandColor(event.detail.item.value)
    }

    return (
        <div className="lgs--theme-controls">
            <WaDropdown onWaSelect={handleBrandSelect} className="lgs--theme-selector">
                <WaButton slot={'trigger'} appearance="plain" variant={'neutral'}>
                    <span className="lgs-brand-color-swatch" style={{'--swatch-color': currentBrand.swatch}}/>
                </WaButton>

                {BRAND_OPTIONS.map((option) => (
                    <WaDropdownItem value={option.value} key={option.value}>
                        <span className="lgs--brand-option">
                            <span className="lgs-brand-color-swatch" style={{'--swatch-color': option.swatch}}/>
                            <span>{option.label}</span>
                        </span>
                    </WaDropdownItem>
                ))}
            </WaDropdown>

            <WaDropdown onWaSelect={handleSelect} className="lgs--theme-selector">
                <WaButton slot={'trigger'} appearance="plain" variant={'neutral'}>
                    <WaIcon name={currentThemeIcon} variant="regular"/>
                </WaButton>

                <WaDropdownItem value={'light'}>
                    <WaIcon slot="icon" name={'sun-bright'} variant="regular"/>{' Light '}
                </WaDropdownItem>

                <WaDropdownItem value={'dark'}>
                    <WaIcon slot="icon" name={'moon-stars'} variant="regular"/>{' Dark '}
                </WaDropdownItem>
                <WaDivider/>
                <WaDropdownItem value={'system'}>
                    <WaIcon slot="icon" name={systemThemeIcon} variant="regular"/>{' System '}
                </WaDropdownItem>
            </WaDropdown>
        </div>
    )
}

export default ThemeSelector
