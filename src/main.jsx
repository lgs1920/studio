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
 * Last modified: 2026-11-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './assets/css/app.css?v=1.0.5'
import './assets/css/themes/wa-lgs1920.css'
import './assets/css/animations.css'
import '@awesome.me/webawesome/dist/components/icon/icon.js'
import '@awesome.me/webawesome/dist/components/spinner/spinner.js'

const markStartup = name => {
    const performanceObject = globalThis.performance
    if (performanceObject?.mark) {
        performanceObject.mark(`lgs.startup.${name}`)
    }
}

markStartup('main-bootstrap-start')

let reactRoot = null

/** Render a visible startup failure even when React bootstrap has not mounted. */
const renderBootstrapFailure = async error => {
    console.log('[LGS1920][Startup] Bootstrap failed before the app was ready.', {
        error,
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
        cause: error?.cause ?? null,
    })
    document.body.classList.remove('lgs-app-booting')

    const rootElement = document.getElementById('lgs1920-container') ?? document.body
    try {
        const [{createRoot}, {InitErrorMessage}] = await Promise.all([
            import('react-dom/client'),
            import('@Components/InitErrorMessage'),
        ])
        reactRoot ??= createRoot(rootElement)
        reactRoot.render(<InitErrorMessage error={error}/>)
    }
    catch (dialogError) {
        console.error('[LGS1920][Startup] Unable to render the React startup dialog.', {
            error,
            dialogError,
        })

        const dialog = document.createElement('dialog')
        dialog.setAttribute('open', '')
        dialog.setAttribute('role', 'alertdialog')
        dialog.setAttribute('aria-modal', 'true')
        dialog.className = 'lgs-error-dialog'

        const heading = document.createElement('h1')
        heading.textContent = `${globalThis.lgs?.servers?.studio?.name ?? 'LGS1920 Development Studio'} stopped!`
        const message = document.createElement('p')
        message.textContent = error?.message ?? String(error)
        const details = document.createElement('pre')
        details.textContent = error?.stack ?? ''

        dialog.append(heading, message, details)
        rootElement.replaceChildren(dialog)
    }
}

/**
 * Patch pour Shoelace ResizeObserver bug
 * https://github.com/shoelace-style/shoelace/issues/1690
 */
const resizeObserverPrototype = globalThis.ResizeObserver?.prototype
const originalUnobserve = resizeObserverPrototype?.unobserve
if (typeof originalUnobserve === 'function') {
    resizeObserverPrototype.unobserve = function (target) {
        if (target && typeof Element !== 'undefined' && target instanceof Element) {
            originalUnobserve.call(this, target)
        }
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
        {StartupErrorBoundary},
    ] = await Promise.all([
        import('react-dom/client'),
        import('@Components/LGS1920.jsx'),
        import('@Core/LGS1920Context'),
        import('@Utils/AppUtils'),
        import('@Components/cesium/Viewer'),
        import('@Components/StartupErrorBoundary'),
    ])

    AppUtils.setTheme(localStorage.getItem('theme') || 'system')

    if (!window.lgs) {
        window.lgs = new LGS1920Context()
    }

    try {
        await ensureViewerBaseWithRetry()
    }
    catch (error) {
        console.error('[LGS1920][Cesium] Viewer bootstrap failed; stopping startup.', error)
        await renderBootstrapFailure(error)
        return
    }

    /**
     * Let's go
     */
    reactRoot = createRoot(document.getElementById('lgs1920-container'))
    reactRoot.render(
        <StartupErrorBoundary>
            <LGS1920/>
        </StartupErrorBoundary>,
    )
    markStartup('react-mounted')
}

void bootstrap().catch(error => {
    void renderBootstrapFailure(error)
})
