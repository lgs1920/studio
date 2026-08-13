/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-hero-controls.test.jsx
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/ThemeSelector', () => ({
    ThemeSelector: ({paletteOnly}) => <div data-palette-only={paletteOnly}/>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, ...props}) => <button {...props}>{children}</button>,
    WaDropdown: ({children, onWaSelect, ...props}) => (
        <div {...props} onClick={() => onWaSelect?.({detail: {item: {value: 'fr'}}})}>{children}</div>
    ),
    WaDropdownItem: ({children, value}) => <button type="button" value={value}>{children}</button>,
}))

import { WelcomeHeroControls } from '@Components/MainUI/WelcomeHeroControls'

describe('WelcomeHeroControls', () => {
    afterEach(() => {
        cleanup()
        localStorage.clear()
        globalThis.lgs = undefined
        document.documentElement.lang = ''
    })

    it('persists the selected language and exposes the brand-season palette', () => {
        globalThis.lgs = {lang: 'en'}

        render(<WelcomeHeroControls/>)

        expect(screen.getByRole('button', {name: 'Choose language'})).toBeTruthy()
        expect(document.querySelector('[data-palette-only="true"]')).toBeTruthy()
        expect(document.querySelector('.welcome-hero-controls').firstElementChild.dataset.paletteOnly).toBe('true')
        expect(document.querySelector('.welcome-hero-controls').lastElementChild.className).toBe('welcome-language-selector')

        fireEvent.click(screen.getByText('Français'))

        expect(localStorage.getItem('lgs-language')).toBe('fr')
        expect(document.documentElement.lang).toBe('fr')
        expect(globalThis.lgs.lang).toBe('fr')
    })
})
