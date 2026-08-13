/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-hero.test.jsx
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/MainUI/LogoSvg', () => ({
    LogoSvg: () => <div aria-label="Logo"/>,
}))

vi.mock('@Components/MainUI/SloganSvg', () => ({
    SloganSvg: () => <div aria-label="Slogan"/>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', () => ({
    WaButton: ({children, href, ...props}) => href
        ? <a href={href} {...props}>{children}</a>
        : <button {...props}>{children}</button>,
    WaIcon: () => null,
}))

import { WelcomeHero } from '@Components/MainUI/WelcomeHero'

describe('WelcomeHero', () => {
    afterEach(() => {
        cleanup()
        globalThis.lgs = undefined
        globalThis.__ = undefined
    })

    it('stays visible until the user clicks Enter Studio', () => {
        const onEnter = vi.fn()
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {id: 'build-42'},
            configuration: {website: {domain: 'lgs1920.fr', protocol: 'https'}},
        }
        globalThis.__ = {app: {buildUrl: ({domain, protocol}) => `${protocol}://${domain}`}}

        render(<WelcomeHero initComplete appReady onEnter={onEnter}/>)

        expect(screen.queryByText('Shape your next journey')).toBeNull()
        const siteButton = screen.getByRole('link', {name: /Visit Our Site/})
        const enterButton = screen.getByRole('button', {name: /Enter Studio/})

        expect(siteButton.getAttribute('href')).toBe('https://lgs1920.fr')
        expect(enterButton.disabled).toBe(false)
        expect(onEnter).not.toHaveBeenCalled()

        fireEvent.click(enterButton)

        expect(onEnter).toHaveBeenCalledTimes(1)
    })

    it('does not allow entering Studio before the application is ready', () => {
        const onEnter = vi.fn()
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {id: 'build-42'},
        }

        render(<WelcomeHero initComplete={false} appReady={false} onEnter={onEnter}/>)

        const button = screen.getByRole('button', {name: /Enter Studio/})

        expect(button.disabled).toBe(true)
        expect(screen.queryByRole('progressbar')).toBeNull()

        fireEvent.click(button)

        expect(onEnter).not.toHaveBeenCalled()
    })
})
