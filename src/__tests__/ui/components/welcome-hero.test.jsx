/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-hero.test.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-13
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@Components/MainUI/LogoSvg', () => ({
    LogoSvg: () => <div aria-label="Logo"/>,
}))

vi.mock('@Components/MainUI/WelcomeHeroControls', () => ({
    WelcomeHeroControls: () => <div aria-label="Welcome hero controls"/>,
}))

vi.mock('@web.awesome.me/webawesome-pro/dist/react', async () => {
    const {forwardRef} = await import('react')

    return {
        WaAnimation: forwardRef(({children, delay, duration, easing, fill, iterations, name, play}, ref) => (
            <wa-animation
                ref={ref}
                data-name={name}
                data-duration={duration}
                data-delay={delay}
                data-easing={easing}
                data-fill={fill}
                data-iterations={iterations}
                data-play={play === undefined ? 'unset' : String(play)}
            >
                {children}
            </wa-animation>
        )),
        WaButton: ({children, href, ...props}) => href
            ? <a href={href} {...props}>{children}</a>
            : <button {...props}>{children}</button>,
        WaFormatDate: ({date, ...props}) => <time {...props}>{date}</time>,
        WaIcon: ({name, animation, ...props}) => <span data-animation={animation} data-icon={name} {...props}/>,
        WaSpinner: props => <wa-spinner {...props}/>,
    }
})

import { WelcomeBranding } from '@Components/MainUI/WelcomeBranding'
import { WelcomeHero } from '@Components/MainUI/WelcomeHero'
import {
    mountWelcomeHeroRouteInSplash,
    stopWelcomeHeroRouteInSplash,
} from '@Components/MainUI/WelcomeHeroRouteBootstrap'

describe('WelcomeHero', () => {
    afterEach(() => {
        cleanup()
        stopWelcomeHeroRouteInSplash()
        vi.unstubAllGlobals()
        document.querySelector('#lgs-boot-splash-status')?.remove()
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

    it('uses one finite Web Awesome fade-in-up animation for the splash CTA group', () => {
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            configuration: {website: {domain: 'lgs1920.fr', protocol: 'https'}},
        }
        globalThis.__ = {app: {buildUrl: ({domain, protocol}) => `${protocol}://${domain}`}}

        const {rerender} = render(<WelcomeHero initComplete appReady/>)

        const animations = [...document.querySelectorAll('wa-animation')]
        expect(animations).toHaveLength(1)
        expect(animations[0].dataset.name).toBe('fadeInUp')
        expect(animations.every(animation => animation.dataset.duration === '650')).toBe(true)
        expect(animations.every(animation => animation.dataset.iterations === '1')).toBe(true)
        expect(animations[0].dataset.play).toBe('unset')
        expect(animations[0].play).toBe(true)
        expect(animations[0].querySelectorAll('.welcome-enter-call-for-action-inner > *')).toHaveLength(2)

        // Web Awesome clears `play` when the finite animation finishes.
        animations[0].play = false
        rerender(<WelcomeHero initComplete={false} appReady={false}/>)
        expect(animations[0].play).toBe(false)
    })

    it('skips splash CTA animation when reduced motion is preferred', () => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })))
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            configuration: {website: {domain: 'lgs1920.fr', protocol: 'https'}},
        }
        globalThis.__ = {app: {buildUrl: ({domain, protocol}) => `${protocol}://${domain}`}}

        render(<WelcomeHero initComplete appReady/>)

        expect(document.querySelectorAll('wa-animation')).toHaveLength(0)
        expect(screen.getByRole('link', {name: /Visit Our Site/})).toBeTruthy()
        expect(screen.getByRole('button', {name: /Enter Studio/})).toBeTruthy()
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
        const splashStatusElement = document.createElement('p')
        splashStatusElement.id = 'lgs-boot-splash-status'
        document.body.append(splashStatusElement)
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {id: 'build-42'},
        }

        const {rerender} = render(<WelcomeHero initComplete={false} appReady={false} onEnter={onEnter}/>)

        const button = screen.getByRole('button', {name: /Enter Studio/})
        const initializationMessage = screen.getByRole('status')

        expect(button.disabled).toBe(true)
        expect(initializationMessage.textContent).toBe('Starting Studio services…')
        expect(initializationMessage.classList.contains('welcome-initialization-message')).toBe(true)
        expect(splashStatusElement.textContent).toBe('Starting Studio services…')
        expect(document.querySelector('.welcome-enter-button [data-icon="clapperboard-play"]')).toBeTruthy()
        expect(screen.queryByRole('progressbar')).toBeNull()

        rerender(<WelcomeHero initComplete={false} appReady={false} initializationStep="journey" onEnter={onEnter}/>)
        expect(splashStatusElement.textContent).toBe('Loading your current journey…')
        expect(initializationMessage.textContent).toBe('Loading your current journey…')

        fireEvent.click(button)

        expect(onEnter).not.toHaveBeenCalled()
    })

    it('removes the initialization callout when Studio is ready', () => {
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {id: 'build-42'},
        }

        render(<WelcomeHero initComplete appReady/>)

        expect(screen.queryByText('Starting Studio services…')).toBeNull()
        expect(screen.queryByRole('progressbar')).toBeNull()
        expect(screen.getByRole('button', {name: /Enter Studio/}).disabled).toBe(false)
        expect(document.querySelector('.welcome-enter-call-for-action')).toBeTruthy()
    })

    it('leaves startup media and branding to the static splash', () => {
        globalThis.lgs = {
            configuration: {website: {domain: 'lgs1920.fr', protocol: 'https'}},
        }

        render(<WelcomeHero showMedia={false}/>)

        expect(document.querySelector('.welcome-hero-video')).toBeNull()
        expect(document.querySelector('.welcome-branding')).toBeNull()
        expect(screen.queryByLabelText('LGS1920 slogan')).toBeNull()
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

        fireEvent.ended(activeVideo)
        expect(play).not.toHaveBeenCalled()

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
    it('mounts the Three.js route animation in the boot splash', () => {
        const splashElement = document.createElement('div')
        splashElement.id = 'lgs-boot-splash'
        document.body.append(splashElement)
        globalThis.lgs = {
            versions: {studio: '1.0.0'},
            build: {id: 'build-42'},
            configuration: {website: {domain: 'lgs1920.fr', protocol: 'https'}},
        }
        globalThis.__ = {app: {buildUrl: ({domain, protocol}) => `${protocol}://${domain}`}}

        render(<WelcomeHero/>)

        expect(splashElement.querySelector('.welcome-hero-route')).toBeTruthy()
        expect(splashElement.querySelector('.welcome-hero-route-canvas')).toBeTruthy()

        splashElement.remove()
    })

    it('mounts the route before the application root is ready and cleans it up', async () => {
        const splashElement = document.createElement('div')
        splashElement.id = 'lgs-boot-splash'
        document.body.append(splashElement)

        expect(mountWelcomeHeroRouteInSplash()).toBe(true)
        await act(async () => {})

        expect(splashElement.querySelector('[data-lgs-boot-route-host] .welcome-hero-route')).toBeTruthy()

        stopWelcomeHeroRouteInSplash()

        expect(splashElement.querySelector('[data-lgs-boot-route-host]')).toBeNull()
        splashElement.remove()
    })
})

describe('WelcomeBranding', () => {
    it('renders the logo, slogan, and loading spinner while the CTA enters', () => {
        render(<WelcomeBranding/>)

        expect(document.querySelector('.welcome-branding-logo img')?.getAttribute('src'))
            .toBe('/assets/logo/logo-horizontal.png')
        expect(document.querySelector('.welcome-branding-logo source')?.getAttribute('srcset'))
            .toBe('/assets/logo/logo-vertical.png')
        expect(document.querySelector('.welcome-branding-spinner wa-spinner')).toBeTruthy()
        expect(document.querySelector('.welcome-branding')?.classList.contains('welcome-branding-cta-visible')).toBe(false)
        expect(screen.getByLabelText('LGS1920 slogan')).toBeTruthy()
    })

    it('takes over the static splash branding for its own lifecycle', () => {
        const splashElement = document.createElement('div')
        splashElement.id = 'lgs-boot-splash'
        document.body.append(splashElement)

        const {unmount} = render(<WelcomeBranding/>)

        expect(splashElement.classList.contains('lgs-boot-splash-react-ready')).toBe(true)

        unmount()

        expect(splashElement.classList.contains('lgs-boot-splash-react-ready')).toBe(false)
        splashElement.remove()
    })
})
