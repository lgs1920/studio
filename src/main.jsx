/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: main.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import './assets/css/theme.css'
import './assets/css/light.css'
import { createRoot } from 'react-dom/client'
import { LGS1920 }    from './LGS1920.jsx'
import './assets/css/app.css?v=1.0.5'
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
 * Let's go
 */

createRoot(document.getElementById('lgs1920-container')).render(
    <LGS1920/>,
)
