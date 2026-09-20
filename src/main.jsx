/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: main.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-02-02
 * Last modified: 2026-09-20
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './assets/css/app.css?v=1.0.5'
import './assets/css/themes/wa-lgs1920.css'
import './assets/css/animations.css'


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
const bootstrap = async () => {
    const [media, {installNativeContextMenuBlocker}] = await Promise.all([
        import('@Assets/media/welcome-background-media'),
        import('@Core/events/NativeContextMenuBlocker'),
    ])
    installNativeContextMenuBlocker()
    const welcomeBackgroundMedia = media.getWelcomeBackgroundMedia()
    const splashElement = document.querySelector('#lgs-boot-splash')
    const splashVideo = document.querySelector('#lgs-boot-splash video')
    const splashImage = document.querySelector('#lgs-boot-splash .lgs-boot-splash-background-image')
    const hasVideo = media.applyWelcomeBackgroundToVideo(splashVideo, welcomeBackgroundMedia, {load: false})
    media.applyWelcomeBackgroundToImage(splashImage, welcomeBackgroundMedia)

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

    const [
        {createRoot},
        {LGS1920},
        {LGS1920Context},
        {AppUtils},
        {UIUtils},
    ] = await Promise.all([
        import('react-dom/client'),
        import('@Components/LGS1920.jsx'),
        import('@Core/LGS1920Context'),
        import('@Utils/AppUtils'),
        import('@Utils/UIUtils'),
    ])

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

void bootstrap().catch(error => {
    console.error('[LGS1920] Bootstrap failed:', error)
})
