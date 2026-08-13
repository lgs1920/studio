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

vi.mock('@Components/MainUI/WelcomeHeroControls', () => ({
    WelcomeHeroControls: () => <div aria-label="Welcome hero controls"/>,
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
        expect(document.querySelector('.welcome-logo img')?.getAttribute('src')).toBe('/assets/logo/logo-horizontal.png')
        expect(document.querySelector('.welcome-logo source')?.getAttribute('srcset')).toBe('/assets/logo/logo-vertical.png')
        expect(document.querySelector('.welcome-hero-route-canvas')).toBeTruthy()
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

    it('renders the resolved video and falls back to the resolved image', () => {
        globalThis.lgs = {
            configuration: {website: {domain: 'lgs1920.fr', protocol: 'https'}},
        }

        render(
            <WelcomeHero
                backgroundMedia={{
                    fallbackColor: '#123456',
                    imageSources: [{src: '/fallback.webp', type: 'image/webp'}],
                    videoSources: [{src: '/welcome.mp4', type: 'video/mp4'}],
                    credit: {label: 'Vidéo : Pexels', url: 'https://www.pexels.com/video/10548975/'},
                }}
            />
        )

        const video = document.querySelector('.welcome-hero-video')
        const image = document.querySelector('.welcome-hero-image')

        expect(video?.querySelector('source')?.getAttribute('src')).toBe('/welcome.mp4')
        expect(video?.playbackRate).toBe(0.75)
        expect(image?.getAttribute('src')).toBe('/fallback.webp')
        expect(document.querySelector('.welcome-hero-media-credit a')?.textContent).toBe('Vidéo : Pexels')
        expect(document.querySelector('.welcome-hero-media-credit a')?.getAttribute('href')).toBe('https://www.pexels.com/video/10548975/')

        fireEvent.error(video)
        fireEvent.load(image)

        expect(document.querySelector('#welcome-hero')?.classList.contains('welcome-hero-image-visible')).toBe(true)
        expect(document.querySelector('.welcome-hero-media')?.getAttribute('style')).toContain('background-color: rgb(18, 52, 86)')
    })
})
