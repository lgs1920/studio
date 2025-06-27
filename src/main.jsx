/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: main.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-06-27
 * Last modified: 2025-06-26
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import './assets/css/theme.css'
import './assets/css/light.css'
import { createRoot } from 'react-dom/client'
import { LGS1920 }    from './LGS1920.jsx'
import './assets/css/app.css?v=1.0.5'
import './assets/css/animations.css'
/**
 * Let's go
 */

createRoot(document.getElementById('lgs1920-container')).render(
    <LGS1920/>,
)
