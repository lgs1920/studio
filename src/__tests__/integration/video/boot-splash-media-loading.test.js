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
 * Last modified: 2026-09-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {JSDOM} from 'jsdom'
import {describe, expect, it} from 'vitest'

const indexDocument = new JSDOM(readFileSync('index.html', 'utf8')).window.document
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
        const splashCog = indexDocument.querySelector('#lgs-boot-splash .welcome-branding-cog wa-icon')
        expect(splashLogo?.getAttribute('src')).toBe('/assets/logo/logo-horizontal.png')
        expect(splashSlogan?.querySelector('title')).toBeNull()
        expect(splashSlogan?.querySelector('text')?.textContent.trim()).toBe('Replay Your World Outdoors.')
        expect(splashCog?.getAttribute('name')).toBe('gear')
        expect(splashCog?.getAttribute('canvas')).toBe('auto')
        expect(splashCog?.getAttribute('variant')).toBe('regular')
        expect(splashCog?.getAttribute('animation')).toBe('spin')
        expect(splashCog?.getAttribute('style')).toBeNull()

        const splashStyle = indexDocument.querySelector('style')?.textContent ?? ''
        expect(splashStyle).toContain('#lgs-boot-splash .lgs-boot-splash-background')
        expect(splashStyle).toContain('filter: sepia(0.2) saturate(0.8)')
        expect(splashStyle).toContain('#lgs-boot-splash .lgs-boot-splash-background-image')
        expect(splashStyle).toContain('opacity: 1;')
        expect(splashStyle).toContain('#lgs-boot-splash video')
        expect(splashStyle).toContain('#lgs-startup-background')
        expect(splashStyle).toContain('#lgs-startup-background img,\n        #lgs-boot-splash .lgs-boot-splash-background')
        expect(splashStyle).toContain('z-index: calc(var(--lgs-toast-zindex, 2147483647) - 3);\n            overflow: hidden;')
        expect(splashStyle).toContain('#lgs-startup-background::after')
        expect(splashStyle).toContain('#lgs-boot-splash::after')
        expect(splashStyle).toContain('opacity: 1;')
        expect(splashStyle).toContain('#lgs-boot-splash.lgs-boot-splash-cta-ready::after')
        expect(splashStyle).toContain('--hero-route-glow-color: var(--wa-color-brand)')
        expect(splashStyle).toContain('filter: drop-shadow(0 0 8px color-mix(in oklab, var(--hero-route-glow-color) 42%, transparent))')
        expect(splashStyle).toContain('.welcome-hero-route-annotations')
        expect(splashStyle).toContain('.welcome-hero-poi.is-revealed.is-positioned')
        expect(routeBootstrapSource).toContain('splashRouteRoot.render(<WelcomeHeroRoute/>)')
        expect(readFileSync('src/components/MainUI/WelcomeHeroRoute.jsx', 'utf8')).toContain('welcome-hero-poi-marker')
        expect(splashStyle).toContain('#lgs-boot-splash .welcome-branding-cog > wa-icon')
        expect(splashStyle).toContain('#lgs-boot-splash.lgs-boot-splash-cta-ready .welcome-branding-cog')
        expect(splashStyle).toContain('transform-origin: center center;')
        expect(splashStyle).toContain('display: flex;')
        expect(splashStyle).toContain('color: var(--wa-color-brand);')
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
