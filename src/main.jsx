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
 * Last modified: 2026-09-30
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './assets/css/app.css?v=1.0.5'
import './assets/css/themes/wa-lgs1920.css'
import './assets/css/animations.css'
import '@web.awesome.me/webawesome-pro/dist/components/icon/icon.js'
import '@web.awesome.me/webawesome-pro/dist/components/spinner/spinner.js'

const markStartup = name => {
    const performanceObject = globalThis.performance
    if (performanceObject?.mark) {
        performanceObject.mark(`lgs.startup.${name}`)
    }
}

markStartup('main-bootstrap-start')

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
    const uiUtilsPromise = import('@Utils/UIUtils')
    void uiUtilsPromise.then(({UIUtils}) => UIUtils.importFonts()).catch(error => {
        console.warn('Unable to load Google Fonts.', error)
    })

    const [media, {installNativeContextMenuBlocker}] = await Promise.all([
        import('@Assets/media/welcome-background-media'),
        import('@Core/events/NativeContextMenuBlocker'),
    ])
    installNativeContextMenuBlocker()
    const welcomeBackgroundMedia = media.getWelcomeBackgroundMedia()
    const splashElement = document.querySelector('#lgs-boot-splash')
    const splashVideo = document.querySelector('#lgs-boot-splash video')
    const splashImage = document.querySelector('#lgs-boot-splash .lgs-boot-splash-background-image')
    const splashCredit = document.querySelector('#lgs-boot-splash-media-credit')
    const hasVideo = media.applyWelcomeBackgroundToVideo(splashVideo, welcomeBackgroundMedia, {load: false})
    media.applyWelcomeBackgroundToImage(splashImage, welcomeBackgroundMedia)
    let activeSplashChoice = media.bannerMediaCatalog.outdoor.find(choice => choice.id === welcomeBackgroundMedia.id) ?? null
    media.applyWelcomeMediaCredit(splashCredit, activeSplashChoice)
    markStartup('startup-media-ready')

    if (hasVideo && splashElement && splashVideo) {
        const revealVideo = () => {
            let playPromise
            try {
                playPromise = splashVideo.play()
            }
            catch {
                return
            }
            if (playPromise?.then) {
                void playPromise.then(() => {
                    splashElement.classList.add('lgs-boot-splash-video-ready')
                }).catch(() => {
                })
                return
            }

            splashElement.classList.add('lgs-boot-splash-video-ready')
        }

        const rotateSplashVideo = () => {
            const nextChoice = media.getNextBannerMediaChoice(
                media.bannerMediaCatalog,
                'outdoor',
                activeSplashChoice?.id ?? welcomeBackgroundMedia.id,
            )
            if (!nextChoice) {
                return
            }

            activeSplashChoice = nextChoice
            media.applyWelcomeBackgroundToVideo(splashVideo, {
                videoSources: [{
                    src:  media.getBannerMediaSource(nextChoice, welcomeBackgroundMedia.variant === 'mobile'),
                    type: 'video/mp4',
                }],
            })
            media.applyWelcomeMediaCredit(splashCredit, nextChoice)
        }

        splashVideo.addEventListener('canplay', revealVideo)
        splashVideo.addEventListener('ended', rotateSplashVideo)
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
        {ensureViewerBaseWithRetry},
    ] = await Promise.all([
        import('react-dom/client'),
        import('@Components/LGS1920.jsx'),
        import('@Core/LGS1920Context'),
        import('@Utils/AppUtils'),
        import('@Components/cesium/Viewer'),
    ])

    AppUtils.setTheme(localStorage.getItem('theme') || 'system')

    if (!window.lgs) {
        window.lgs = new LGS1920Context()
    }

    try {
        await ensureViewerBaseWithRetry()
    }
    catch (error) {
        console.error('[LGS1920][Cesium] Early viewer bootstrap failed; startup will retry.', error)
    }

    /**
     * Let's go
     */
    createRoot(document.getElementById('lgs1920-container')).render(
        <LGS1920/>,
    )
    markStartup('react-mounted')
}

void bootstrap().catch(error => {
    console.error('[LGS1920] Bootstrap failed:', error)
})
