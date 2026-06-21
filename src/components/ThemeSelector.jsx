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

const THEME_OPTIONS = [
    {value: 'light', label: 'Light', icon: 'sun-bright'},
    {value: 'dark', label: 'Dark', icon: 'moon-stars'},
    {value: 'system', label: 'System', icon: 'desktop'},
]

const ON_MAP_THEME_OPTIONS = [
    {value: 'spring', label: 'Spring', swatch: '#7bf1a8'},
    {value: 'default', label: 'Summer', swatch: 'var(--wa-color-green-60)'},
    {value: 'fall', label: 'Fall', swatch: '#c56e12'},
    {value: 'winter', label: 'Winter', swatch: '#dbeafe'},
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
    const [onMapTheme, setOnMapTheme] = useState(AppUtils.resolveOnMapTheme())
    const currentBrand = BRAND_OPTIONS.find(option => option.value === brandColor) || BRAND_OPTIONS[0]
    const currentOnMapTheme = ON_MAP_THEME_OPTIONS.find(option => option.value === onMapTheme) || ON_MAP_THEME_OPTIONS[0]
    const systemThemeIcon = getSystemThemeIcon(device)
    const currentThemeIcon = theme === 'system' ? systemThemeIcon : theme === 'dark' ? 'moon-stars' : 'sun-bright'

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

        const updateTheme = () => {
            AppUtils.setTheme(theme, brandColor, onMapTheme)
        }

        updateTheme()
        localStorage.setItem(AppUtils.THEME_STORAGE_KEY, theme)
        localStorage.setItem(AppUtils.BRAND_COLOR_STORAGE_KEY, brandColor)
        localStorage.setItem(AppUtils.ON_MAP_THEME_STORAGE_KEY, onMapTheme)

        if (theme === 'system') {
            mediaQuery.addEventListener('change', updateTheme)
            return () => mediaQuery.removeEventListener('change', updateTheme)
        }
    }, [theme, brandColor, onMapTheme])

    /**
     * Handle the selection event
     * @param {CustomEvent} event
     */
    const handleSelect = (event) => {
        const {value} = event.detail.item
        if (THEME_OPTIONS.some(option => option.value === value)) {
            setTheme(value)
            return
        }
        if (ON_MAP_THEME_OPTIONS.some(option => option.value === value)) {
            setOnMapTheme(value)
        }
    }

    const handleBrandSelect = (event) => {
        const {value} = event.detail.item
        if (BRAND_OPTIONS.some(option => option.value === value)) {
            setBrandColor(value)
            return
        }
        if (ON_MAP_THEME_OPTIONS.some(option => option.value === value)) {
            setOnMapTheme(value)
        }
    }

    return (
        <div className="lgs--theme-controls">
            <WaDropdown onWaSelect={handleBrandSelect} className="lgs--theme-selector">
                <WaButton slot={'trigger'} appearance="plain" variant={'neutral'}>
                    <span className="lgs--theme-trigger-swatches">
                        <span className="lgs-brand-color-swatch" style={{'--swatch-color': currentBrand.swatch}}/>
                        <span className="lgs-theme-color-swatch" style={{'--swatch-color': currentOnMapTheme.swatch}}/>
                    </span>
                </WaButton>

                {BRAND_OPTIONS.map((option) => (
                    <WaDropdownItem value={option.value} key={option.value}>
                        <span className="lgs--brand-option">
                            <span className="lgs-brand-color-swatch" style={{'--swatch-color': option.swatch}}/>
                            <span>{option.label}</span>
                        </span>
                    </WaDropdownItem>
                ))}
                <WaDivider/>
                {ON_MAP_THEME_OPTIONS.map(option => (
                    <WaDropdownItem value={option.value} key={option.value}>
                        <span className="lgs--brand-option">
                            <span className="lgs-theme-color-swatch" style={{'--swatch-color': option.swatch}}/>
                            <span>{option.label}</span>
                        </span>
                    </WaDropdownItem>
                ))}
            </WaDropdown>

            <WaDropdown onWaSelect={handleSelect} className="lgs--theme-selector">
                <WaButton slot={'trigger'} appearance="plain" variant={'neutral'}>
                    <WaIcon name={currentThemeIcon} variant="regular"/>
                </WaButton>

                {THEME_OPTIONS.map(option => (
                    <WaDropdownItem value={option.value} key={option.value}>
                        <WaIcon slot="icon" name={option.icon} variant="regular"/>{` ${option.label} `}
                    </WaDropdownItem>
                ))}
            </WaDropdown>
        </div>
    )
}

export default ThemeSelector
