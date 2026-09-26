/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: WelcomeHeroRouteBootstrap.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-26
 * Last modified: 2026-09-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {WelcomeHeroRoute} from './WelcomeHeroRoute'
import {createRoot} from 'react-dom/client'
import {flushSync} from 'react-dom'

let splashRouteRoot = null
let splashRouteHost = null

/**
 * Mount the welcome route animation directly in the static boot splash.
 *
 * @returns {boolean} True when the animation root was mounted.
 */
export const mountWelcomeHeroRouteInSplash = () => {
    if (splashRouteRoot || typeof document === 'undefined') {
        return false
    }

    const splashElement = document.querySelector('#lgs-boot-splash')
    if (!splashElement) {
        return false
    }

    splashRouteHost = document.createElement('div')
    splashRouteHost.dataset.lgsBootRouteHost = 'true'
    splashRouteHost.dataset.lgsBootRouteStatus = 'mounting'
    splashElement.append(splashRouteHost)
    splashRouteRoot = createRoot(splashRouteHost)
    flushSync(() => splashRouteRoot.render(<WelcomeHeroRoute/>))
    splashRouteHost.dataset.lgsBootRouteStatus = 'mounted'
    globalThis.performance?.mark?.('lgs.startup.splash-route-root-mounted')
    return true
}

/**
 * Stop and remove the route animation mounted in the static boot splash.
 *
 * @returns {void}
 */
export const stopWelcomeHeroRouteInSplash = () => {
    splashRouteRoot?.unmount()
    splashRouteRoot = null
    splashRouteHost?.remove()
    splashRouteHost = null
}
