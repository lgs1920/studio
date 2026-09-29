/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: boot-splash-media-loading.test.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-07-21
 * Last modified: 2026-09-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {JSDOM} from 'jsdom'
import {describe, expect, it} from 'vitest'

const indexDocument = new JSDOM(readFileSync('index.html', 'utf8')).window.document
const startupStyle = readFileSync('src/assets/css/startup-shell.css', 'utf8')
const lgs1920Source = readFileSync('src/components/LGS1920.jsx', 'utf8')
const mainSource = readFileSync('src/main.jsx', 'utf8')
const routeBootstrapSource = readFileSync('src/components/MainUI/WelcomeHeroRouteBootstrap.jsx', 'utf8')

/**
 * Registers regression coverage for boot splash media loading.
 *
 * @returns {void}
 */
const registerBootSplashMediaLoadingTests = () => {
    /**
     * Verifies that the splash uses browser-supported media preload semantics.
     *
     * @returns {void}
     */
    const verifySupportedMediaPreloading = () => {
        const unsupportedMediaPreloadLinks = indexDocument.querySelectorAll(
            'link[rel~="preload"][as="audio"], link[rel~="preload"][as="video"]'
        )
        const splashVideo = indexDocument.querySelector('#lgs-boot-splash video')
        const splashImage = indexDocument.querySelector('#lgs-boot-splash [data-welcome-background-fallback]')
        const startupImage = indexDocument.querySelector('#lgs-startup-background')

        expect(unsupportedMediaPreloadLinks).toHaveLength(0)
        expect(splashVideo).not.toBeNull()
        expect(splashVideo?.hasAttribute('data-welcome-background-media')).toBe(true)
        expect(splashVideo?.getAttribute('preload')).toBe('auto')
        expect(splashVideo?.hasAttribute('loop')).toBe(false)
        expect(mainSource).toContain("splashVideo.addEventListener('ended', rotateSplashVideo)")
        expect(splashImage).not.toBeNull()
        expect(startupImage).not.toBeNull()
        expect(startupImage?.querySelector('[data-welcome-background-startup]')).not.toBeNull()
        const splashLogo = indexDocument.querySelector('#lgs-boot-splash-logo')
        const splashSlogan = indexDocument.querySelector('#lgs-boot-splash-slogan')
        const splashSpinner = indexDocument.querySelector('#lgs-boot-splash .welcome-branding-spinner wa-spinner')
        const splashStatus = indexDocument.querySelector('#lgs-boot-splash-status')
        const startupStylesheet = indexDocument.querySelector('link[rel="stylesheet"][href="/src/assets/css/startup-shell.css"]')
        expect(splashLogo?.getAttribute('src')).toBe('/assets/logo/logo-horizontal.png')
        expect(splashSlogan?.querySelector('title')).toBeNull()
        expect(splashSlogan?.querySelector('text')?.textContent.trim()).toBe('Replay Your World Outdoors.')
        expect(splashSpinner).not.toBeNull()
        expect(splashSpinner?.getAttribute('style')).toBeNull()
        expect(splashStatus?.textContent).toBe('Starting Studio services…')
        expect(startupStylesheet).not.toBeNull()

        const splashStyle = startupStyle
        expect(splashStyle).toContain('& .lgs-boot-splash-background')
        expect(splashStyle).toContain('filter: sepia(0.2) saturate(0.8)')
        expect(splashStyle).toContain('& .lgs-boot-splash-background-image')
        expect(splashStyle).toContain('opacity: 1;')
        expect(splashStyle).toContain('& video')
        expect(splashStyle).toContain('#lgs-startup-background')
        expect(splashStyle).toContain('& img')
        expect(splashStyle).toContain('z-index: calc(var(--lgs-toast-zindex, 2147483647) - 3);')
        expect(splashStyle).toContain('&::after')
        expect(splashStyle).toContain('opacity: 1;')
        expect(splashStyle).toContain('&.lgs-boot-splash-cta-ready::after')
        expect(splashStyle).toContain('--hero-route-path-color: var(--wa-color-brand, rgb(234, 198, 115))')
        expect(splashStyle).toContain('--hero-route-glow-color: var(--wa-color-brand, rgb(234, 198, 115))')
        expect(splashStyle).toContain('--hero-route-poi-color: rgb(175, 218, 188)')
        expect(splashStyle).toContain('--track-color: var(--hero-route-poi-color)')
        expect(splashStyle).toContain('drop-shadow(0 0 .32rem color-mix(in oklab, var(--hero-route-poi-color) 82%, transparent))')
        expect(splashStyle).toContain('drop-shadow(0 0 .72rem color-mix(in oklab, var(--hero-route-poi-color) 88%, transparent))')
        expect(splashStyle).toContain('filter: drop-shadow(0 0 8px color-mix(in oklab, var(--hero-route-glow-color) 42%, transparent))')
        expect(splashStyle).toContain('.welcome-hero-route-annotations')
        expect(splashStyle).toContain('.welcome-hero-poi.is-revealed.is-positioned')
        expect(routeBootstrapSource).toContain('splashRouteRoot.render(<WelcomeHeroRoute useWorker={false}/>)')
        const routeSource = readFileSync('src/components/MainUI/WelcomeHeroRoute.jsx', 'utf8')
        expect(routeSource).toContain('const welcomeRouteModulesPromise = Promise.all([')
        expect(routeSource).toContain('const loadThreeModules = () => welcomeRouteModulesPromise')
        expect(routeSource).toContain("attributeFilter: ['class', 'data-brand-color', 'data-season-theme']")
        expect(routeSource).toContain('welcome-hero-poi-marker')
        expect(splashStyle).toContain('& .welcome-branding-spinner')
        expect(splashStyle).toContain('& > wa-spinner')
        expect(splashStyle).toContain('&.lgs-boot-splash-cta-ready .welcome-branding-spinner')
        expect(splashStyle).toContain('width: 3.5rem;')
        expect(splashStyle).toContain('font-size: 2.8rem;')
        expect(splashStyle).toContain('flex: none;')
        expect(splashStyle).toContain('display: flex;')
        expect(splashStyle).toContain('color: var(--wa-color-brand, white);')
        expect(splashStyle).toContain('opacity: 0.3;')
        expect(splashStyle).toContain('transition: opacity 1200ms ease;')
        expect(splashStyle).not.toContain('transition: opacity 180ms ease, visibility 180ms ease;')
        expect(splashStyle).toContain('linear-gradient(90deg, rgba(0, 0, 0, 0.48)')
        expect(splashStyle).not.toContain('rgba(20, 35, 28, 0.18)')
        expect(splashStyle).not.toContain('blur(')
        expect(lgs1920Source).toContain('                    showMedia={false}\n')
    }

    it('uses the video element preload mechanism supported by browsers', verifySupportedMediaPreloading)
}

describe('boot splash media loading', registerBootSplashMediaLoadingTests)
