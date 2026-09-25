/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: external-window-bootstrap.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-02-18
 * Last modified: 2026-09-25
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@web.awesome.me/webawesome-pro/dist/components/button/button.js'
import '@web.awesome.me/webawesome-pro/dist/components/card/card.js'
import '@web.awesome.me/webawesome-pro/dist/components/divider/divider.js'
import '@web.awesome.me/webawesome-pro/dist/components/icon/icon.js'
import '@web.awesome.me/webawesome-pro/dist/components/progress-bar/progress-bar.js'
import '@web.awesome.me/webawesome-pro/dist/components/tooltip/tooltip.js'
import {registerLGS1920IconLibrary} from './Utils/LGS1920IconLibrary'
import '@lgs1920/timeline'

registerLGS1920IconLibrary()

/**
 * Reveal an external document after its custom elements, styles, and fonts are ready.
 *
 * @returns {Promise<void>} Completion of the external document reveal.
 */
const revealExternalDocument = async () => {
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    await Promise.all(stylesheets.map(stylesheet => new Promise(resolve => {
        if (stylesheet.sheet) {
            resolve()
            return
        }
        stylesheet.addEventListener('load', resolve, {once: true})
        stylesheet.addEventListener('error', resolve, {once: true})
    })))
    await document.fonts?.ready
    await new Promise(resolve => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => requestAnimationFrame(resolve))
            return
        }
        resolve()
    })
    document.documentElement.style.visibility = ''
}

void revealExternalDocument()
