/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-hero.test.jsx
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
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
    WaFormatDate: ({date, ...props}) => <time {...props}>{date}</time>,
    WaIcon: () => null,
    WaProgressBar: ({children, label, value, ...props}) => (
        <div role="progressbar" aria-label={label} aria-valuenow={value} {...props}>{children}</div>
    ),
}))

import { WelcomeHero } from '@Components/MainUI/WelcomeHero'

describe('WelcomeHero', () => {
    afterEach(() => {
        cleanup()
        vi.useRealTimers()
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
        expect(document.querySelector('.welcome-hero-build-info')?.textContent).toContain('1.0.0')
        expect(document.querySelector('.welcome-hero-build-info')?.textContent).toContain('build-42')
        const siteButton = screen.getByRole('link', {name: /Visit Our Site/})
        const enterButton = screen.getByRole('button', {name: /Enter Studio/})

        expect(siteButton.getAttribute('href')).toBe('https://lgs1920.fr')
        expect(enterButton.disabled).toBe(false)
        expect(onEnter).not.toHaveBeenCalled()

        fireEvent.click(enterButton)

        expect(onEnter).toHaveBeenCalledTimes(1)
    })

    it('renders the build date with Web Awesome', () => {
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {date: '2026-08-13T12:34:56.000Z'},
            configuration: {website: {domain: 'lgs1920.fr', protocol: 'https'}},
        }

        render(<WelcomeHero/>)

        expect(document.querySelector('.welcome-hero-build-info')?.textContent).toContain('1.0.0')
        expect(document.querySelector('.welcome-hero-build-info time')?.textContent).toBe('2026-08-13T12:34:56.000Z')
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

    it('shows the current initialization step and overall progress', () => {
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {id: 'build-42'},
        }

        render(
            <WelcomeHero
                initializationProgress={{
                    activeStep: 1,
                    steps: [
                        {id: 'application', label: 'Loading application configuration'},
                        {id: 'services', label: 'Starting application services'},
                        {id: 'data', label: 'Loading terrain and journeys'},
                        {id: 'camera', label: 'Preparing the initial map view'},
                        {id: 'surface', label: 'Rendering the Studio interface'},
                        {id: 'ready', label: 'Finalizing Studio launch'},
                    ],
                }}
            />
        )

        expect(screen.getByRole('progressbar', {name: 'Studio initialization: 10%'})
            .getAttribute('aria-valuenow')).toBe('10')
        expect(document.querySelectorAll('.welcome-initialization-step').length).toBe(6)
        expect(screen.getByText('Loading application configuration').parentElement
            .classList.contains('is-complete')).toBe(true)
        expect(screen.getByText('Starting application services').parentElement
            .classList.contains('is-active')).toBe(true)
        expect(screen.getByText('Loading terrain and journeys').parentElement
            .classList.contains('welcome-initialization-step')).toBe(true)
        expect(screen.getByText('In progress')).toBeTruthy()
    })

    it('keeps completed initialization steps visible for three seconds', () => {
        vi.useFakeTimers()
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {id: 'build-42'},
        }

        render(
            <WelcomeHero
                initComplete
                appReady
                initializationProgress={{
                    activeStep: 5,
                    steps: [
                        {id: 'application', label: 'Loading application configuration'},
                        {id: 'services', label: 'Starting application services'},
                        {id: 'data', label: 'Loading terrain and journeys'},
                        {id: 'camera', label: 'Preparing the initial map view'},
                        {id: 'surface', label: 'Rendering the Studio interface'},
                        {id: 'ready', label: 'Finalizing Studio launch'},
                    ],
                }}
            />
        )

        expect(screen.getByText('Finalizing Studio launch')).toBeTruthy()
        expect(screen.getByRole('progressbar', {name: 'Studio initialization: 100%'})
            .getAttribute('aria-valuenow')).toBe('100')

        act(() => {
            vi.advanceTimersByTime(2999)
        })
        expect(screen.getByText('Finalizing Studio launch')).toBeTruthy()

        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(screen.queryByText('Finalizing Studio launch')).toBeNull()
    })

    it('keeps the progress at 60 percent until Studio is ready', () => {
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {id: 'build-42'},
        }

        render(
            <WelcomeHero
                initComplete
                initializationProgress={{
                    activeStep: 4,
                    steps: [
                        {id: 'application', label: 'Loading application configuration'},
                        {id: 'services', label: 'Starting application services'},
                        {id: 'data', label: 'Loading terrain and journeys'},
                        {id: 'camera', label: 'Preparing the initial map view'},
                        {id: 'surface', label: 'Rendering the Studio interface'},
                        {id: 'ready', label: 'Finalizing Studio launch'},
                    ],
                }}
            />
        )

        expect(screen.getByRole('progressbar', {name: 'Studio initialization: 60%'})
            .getAttribute('aria-valuenow')).toBe('60')
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

    it('promotes the incoming video element without replaying it', () => {
        vi.useFakeTimers()
        const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
        vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
        globalThis.lgs = {
            configuration: {website: {domain: 'lgs1920.fr', protocol: 'https'}},
        }

        render(
            <WelcomeHero
                backgroundMedia={{
                    id: '20260812-10548975',
                    fallbackColor: '#123456',
                    imageSources: [{src: '/fallback.webp', type: 'image/webp'}],
                    videoSources: [{src: '/assets/media/20260812-10548975-hd-3840x2160.mp4', type: 'video/mp4'}],
                    credit: null,
                }}
            />
        )

        const videos = document.querySelectorAll('.welcome-hero-video')
        const activeVideo = videos[0]
        const incomingVideo = videos[1]
        Object.defineProperty(activeVideo, 'duration', {configurable: true, value: 10})
        Object.defineProperty(activeVideo, 'currentTime', {configurable: true, writable: true, value: 8.6})
        act(() => {
            fireEvent.timeUpdate(activeVideo)
        })
        expect(incomingVideo.querySelector('source')?.getAttribute('src')).toBe('/assets/media/20260812-15404528-3840x2160.mp4')

        fireEvent.canPlay(incomingVideo)
        fireEvent.loadedData(incomingVideo)
        expect(play).toHaveBeenCalledOnce()
        expect(document.querySelector('#welcome-hero')?.classList.contains('welcome-hero-video-transitioning')).toBe(true)
        expect(document.querySelector('#welcome-hero')?.classList.contains('welcome-hero-video-crossfade-ready')).toBe(true)

        act(() => {
            vi.advanceTimersByTime(2300)
        })

        expect(document.querySelector('.welcome-hero-video-active')).toBe(incomingVideo)
        expect(play).toHaveBeenCalledOnce()
        expect(document.querySelector('#welcome-hero')?.classList.contains('welcome-hero-video-transitioning')).toBe(false)
    })
})
