/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: main.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-04-29
 * Last modified: 2026-04-29
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { createRoot } from 'react-dom/client'
import { LGS1920 } from '@Components/LGS1920.jsx'
import { LGS1920Context } from '@Core/LGS1920Context'
import './assets/css/app.css?v=1.0.5'
import './assets/css/themes/wa-lgs1920.css'
import './assets/css/animations.css'
import { UIUtils } from '@Utils/UIUtils'
import { AppUtils } from '@Utils/AppUtils'
import { installNativeContextMenuBlocker } from '@Core/events/NativeContextMenuBlocker'
import {
    applyWelcomeBackgroundToImage,
    applyWelcomeBackgroundToVideo,
    getWelcomeBackgroundMedia,
    preloadWelcomeBackgroundMedia,
}                                                               from '@Assets/media/welcome-background-media'

installNativeContextMenuBlocker()


/**
 * Patch pour Shoelace ResizeObserver bug
 * https://github.com/shoelace-style/shoelace/issues/1690
 */
const originalUnobserve = ResizeObserver.prototype.unobserve
ResizeObserver.prototype.unobserve = function (target) {
    if (target && target instanceof Element) {
        originalUnobserve.call(this, target)
    }
}

/**
 * Load Google Fonts once at startup
 */
const bootstrap = () => {
    const isStandalonePwa = window.matchMedia('(display-mode: standalone)').matches
    const welcomeBackgroundMedia = getWelcomeBackgroundMedia()
    preloadWelcomeBackgroundMedia(welcomeBackgroundMedia)
    const splashElement = document.querySelector('#lgs-boot-splash')
    const splashVideo = document.querySelector('#lgs-boot-splash video')
    const splashImage = document.querySelector('#lgs-boot-splash .lgs-boot-splash-background-image')
    const hasVideo = applyWelcomeBackgroundToVideo(splashVideo, welcomeBackgroundMedia)
    applyWelcomeBackgroundToImage(splashImage, welcomeBackgroundMedia)

    if (hasVideo && splashElement && splashVideo) {
        let videoReady = false
        const revealVideo = () => {
            if (videoReady) {
                return
            }

            let playPromise
            try {
                playPromise = splashVideo.play()
            }
            catch {
                return
            }
            if (playPromise?.then) {
                void playPromise.then(() => {
                    videoReady = true
                    splashElement.classList.add('lgs-boot-splash-video-ready')
                }).catch(() => {
                })
                return
            }

            videoReady = true
            splashElement.classList.add('lgs-boot-splash-video-ready')
        }

        splashVideo.addEventListener('canplay', revealVideo, {once: true})
        splashVideo.addEventListener('loadeddata', revealVideo, {once: true})
        splashVideo.addEventListener('error', () => {
            splashElement.classList.remove('lgs-boot-splash-video-ready')
        })

        if (splashVideo.readyState >= 3) {
            revealVideo()
        }
    }

    document.body.classList.toggle('lgs-app-booting', isStandalonePwa)
    document.body.classList.toggle('lgs-app-visible', !isStandalonePwa)
    AppUtils.setTheme(localStorage.getItem('theme') || 'system')

    if (!window.lgs) {
        window.lgs = new LGS1920Context()
    }

    /**
     * Let's go
     */
    createRoot(document.getElementById('lgs1920-container')).render(
        <LGS1920/>,
    )

    void UIUtils.importFonts().catch(error => {
        console.warn('Unable to load Google Fonts.', error)
    })
}

bootstrap()
