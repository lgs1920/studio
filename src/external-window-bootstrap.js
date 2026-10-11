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
 * Last modified: 2026-10-11
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import '@awesome.me/webawesome/dist/components/button/button.js'
import '@awesome.me/webawesome/dist/components/card/card.js'
import '@awesome.me/webawesome/dist/components/divider/divider.js'
import '@awesome.me/webawesome/dist/components/icon/icon.js'
import '@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js'
import '@awesome.me/webawesome/dist/components/tooltip/tooltip.js'
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
