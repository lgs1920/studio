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
    document.body.classList.add('lgs-app-booting')
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
