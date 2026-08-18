/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-startup-background.js
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {
    applyWelcomeBackgroundToImage,
    getWelcomeBackgroundMedia,
    preloadWelcomeBackgroundMedia,
} from '@Assets/media/welcome-background-media'

/**
 * Applies the selected welcome image before the React application mounts.
 *
 * @returns {void}
 */
const applyStartupBackground = () => {
    if (typeof document === 'undefined' || !document.body) {
        return
    }

    const backgroundMedia = getWelcomeBackgroundMedia()
    const backgroundImage = backgroundMedia.imageSources[0]?.src
    const splashImage = document.querySelector('#lgs-boot-splash .lgs-boot-splash-background-image')

    preloadWelcomeBackgroundMedia(backgroundMedia)
    applyWelcomeBackgroundToImage(splashImage, backgroundMedia)

    if (!backgroundImage) {
        return
    }

    const preloadLink = document.createElement('link')
    preloadLink.rel = 'preload'
    preloadLink.as = 'image'
    preloadLink.href = backgroundImage
    document.head.append(preloadLink)

    document.body.style.backgroundColor = backgroundMedia.fallbackColor
    document.body.style.backgroundImage = `url("${backgroundImage}")`
    document.body.style.backgroundPosition = 'center'
    document.body.style.backgroundRepeat = 'no-repeat'
    document.body.style.backgroundSize = 'cover'
}

applyStartupBackground()
