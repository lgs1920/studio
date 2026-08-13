/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-background-media.test.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    applyWelcomeBackgroundToVideo,
    bannerMediaCatalog,
    getWelcomeBackgroundMedia,
    getWelcomeBackgroundCatalogSchema,
    getBannerMediaChoices,
    preloadWelcomeBackgroundMedia,
    resolveWelcomeBackgroundMedia,
    selectBannerMedia,
    WELCOME_BACKGROUND_PLAYBACK_RATE,
} from '@Assets/media/welcome-background-media'
import {afterEach, describe, expect, it, vi} from 'vitest'

describe('welcome background media catalog', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('uses all videos from the shared outdoor catalog', () => {
        const choices = getBannerMediaChoices(bannerMediaCatalog, 'outdoor')
        const ids = choices.map(choice => choice.id)

        expect(choices).toHaveLength(10)
        expect(new Set(ids).size).toBe(10)
        expect(choices.every(choice => choice.type === 'video' && choice.desktopSrc && choice.fallbackImage)).toBe(true)
    })

    it('resolves the selected video and its WebP fallback', () => {
        const selection = resolveWelcomeBackgroundMedia({
            selectedId: '20260812-10548975',
            isMobile: false,
        })

        expect(selection.id).toBe('20260812-10548975')
        expect(selection.variant).toBe('desktop')
        expect(selection.videoSources[0].src).toBe('/assets/media/20260812-10548975-hd-3840x2160.mp4')
        expect(selection.imageSources[0].src).toBe('/assets/media/20260812-10548975-hd-3840x2160.webp')
    })

    it('supports deterministic random selection from the shared catalog', () => {
        expect(selectBannerMedia(bannerMediaCatalog, 'outdoor', null, () => 0).id).toBe('20260812-10548975')
        expect(selectBannerMedia(bannerMediaCatalog, 'outdoor', null, () => 0.99).id).toBe('8557574-uhd-2560-1440-30fps')
    })

    it('keeps the resolved selection stable for the current session', () => {
        expect(getWelcomeBackgroundMedia()).toBe(getWelcomeBackgroundMedia())
    })

    it('falls back to the other responsive variant and keeps image assets available', () => {
        const selection = resolveWelcomeBackgroundMedia({
            isMobile: true,
            catalog: {
                outdoor: [{
                    id:            'fallback',
                    type:          'video',
                    desktopSrc:    '/fallback.mp4',
                    fallbackImage: '/fallback.webp',
                }],
            },
            catalogKey: 'outdoor',
        })

        expect(selection.variant).toBe('mobile')
        expect(selection.videoSources).toEqual([{src: '/fallback.mp4', type: 'video/mp4'}])
        expect(selection.imageSources).toEqual([{src: '/fallback.webp', type: 'image/webp'}])
    })

    it('returns a safe visual fallback for an empty catalog', () => {
        expect(resolveWelcomeBackgroundMedia({catalog: [], isMobile: false})).toEqual({
            id:           null,
            variant:      'desktop',
            videoSources: [],
            imageSources: [],
            fallbackColor: '#050807',
            credit:       null,
        })
    })

    it('preloads the selected video and image assets', () => {
        const videoElement = document.createElement('video')
        const imageElement = document.createElement('img')
        const load = vi.spyOn(videoElement, 'load').mockImplementation(() => {})
        vi.spyOn(document, 'createElement').mockImplementation(tagName => tagName === 'video'
            ? videoElement
            : imageElement)

        preloadWelcomeBackgroundMedia({
            videoSources: [{src: '/preload.mp4', type: 'video/mp4'}],
            imageSources: [{src: '/preload.webp', type: 'image/webp'}],
        })

        expect(videoElement.preload).toBe('auto')
        expect(videoElement.src).toContain('/preload.mp4')
        expect(load).toHaveBeenCalledOnce()
        expect(imageElement.src).toContain('/preload.webp')
    })

    it('applies resolved sources to the boot splash video', () => {
        const videoElement = document.createElement('video')
        vi.spyOn(videoElement, 'load').mockImplementation(() => {})

        expect(applyWelcomeBackgroundToVideo(videoElement, {
            videoSources: resolveWelcomeBackgroundMedia({
                selectedId: '20260812-15404528',
            }).videoSources,
        })).toBe(true)
        expect(videoElement.playbackRate).toBe(WELCOME_BACKGROUND_PLAYBACK_RATE)
        expect(videoElement.querySelector('source')?.src).toContain('/assets/media/20260812-15404528-3840x2160.mp4')
        expect(videoElement.hidden).toBe(false)
    })

    it('exposes the supported catalog dimensions for future additions', () => {
        expect(getWelcomeBackgroundCatalogSchema()).toEqual([
            'id',
            'type',
            'desktopSrc',
            'mobileSrc',
            'fallbackImage',
            'desktopFallbackImage',
            'mobileFallbackImage',
            'credit',
        ])
    })
})
