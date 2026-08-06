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
        const mobileSource = splashVideo?.querySelector('source[media="(max-width: 700px)"]')
        const desktopSource = splashVideo?.querySelector('source:not([media])')

        expect(unsupportedMediaPreloadLinks).toHaveLength(0)
        expect(splashVideo).not.toBeNull()
        expect(splashVideo?.getAttribute('preload')).toBe('auto')
        expect(mobileSource?.getAttribute('src')).toBe('/assets/media/trekking-hero-mobile.mp4')
        expect(mobileSource?.getAttribute('type')).toBe('video/mp4')
        expect(desktopSource?.getAttribute('src')).toBe('/assets/media/trekking-hero-desktop.mp4')
        expect(desktopSource?.getAttribute('type')).toBe('video/mp4')
    }

    it('uses the video element preload mechanism supported by browsers', verifySupportedMediaPreloading)
}

describe('boot splash media loading', registerBootSplashMediaLoadingTests)
