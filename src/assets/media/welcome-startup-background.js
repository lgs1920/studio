/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcome-startup-background.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-18
 * Last modified: 2026-08-20
 *
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
    const startupImage = document.querySelector('#lgs-startup-background [data-welcome-background-startup]')
    const splashImage = document.querySelector('#lgs-boot-splash .lgs-boot-splash-background-image')

    preloadWelcomeBackgroundMedia(backgroundMedia)
    applyWelcomeBackgroundToImage(startupImage, backgroundMedia)
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
}

applyStartupBackground()
