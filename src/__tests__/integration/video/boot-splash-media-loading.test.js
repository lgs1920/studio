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
 * Last modified: 2026-07-21
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {readFileSync} from 'node:fs'
import {JSDOM} from 'jsdom'
import {describe, expect, it} from 'vitest'

const indexDocument = new JSDOM(readFileSync('index.html', 'utf8')).window.document

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
        const splashLogo = indexDocument.querySelector('#lgs-boot-splash-logo')

        expect(unsupportedMediaPreloadLinks).toHaveLength(0)
        expect(splashVideo).not.toBeNull()
        expect(splashVideo?.hasAttribute('data-welcome-background-media')).toBe(true)
        expect(splashVideo?.getAttribute('preload')).toBe('auto')
        expect(splashImage).not.toBeNull()
        expect(startupImage).not.toBeNull()
        expect(startupImage?.querySelector('[data-welcome-background-startup]')).not.toBeNull()
        expect(splashLogo?.getAttribute('src')).toBe('/assets/logo/logo-horizontal.png')

        const splashStyle = indexDocument.querySelector('style')?.textContent ?? ''
        expect(splashStyle).toContain('#lgs-boot-splash .lgs-boot-splash-background')
        expect(splashStyle).toContain('filter: sepia(0.2) saturate(0.8)')
        expect(splashStyle).toContain('#lgs-boot-splash .lgs-boot-splash-background-image')
        expect(splashStyle).toContain('opacity: 1;')
        expect(splashStyle).toContain('#lgs-boot-splash video')
        expect(splashStyle).toContain('#lgs-startup-background')
        expect(splashStyle).toContain('#lgs-startup-background img,\n        #lgs-boot-splash .lgs-boot-splash-background')
        expect(splashStyle).toContain('z-index: 2;\n            overflow: hidden;')
        expect(splashStyle).toContain('#lgs-startup-background::after')
        expect(splashStyle).toContain('#lgs-boot-splash::after')
        expect(splashStyle).toContain('linear-gradient(90deg, rgba(0, 0, 0, 0.48)')
        expect(splashStyle).not.toContain('rgba(20, 35, 28, 0.18)')
        expect(splashStyle).not.toContain('blur(')
    }

    it('uses the video element preload mechanism supported by browsers', verifySupportedMediaPreloading)
}

describe('boot splash media loading', registerBootSplashMediaLoadingTests)
