/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: FA2WA.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-19
 * Last modified: 2026-08-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { faCameraSliders } from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import { icon } from '@fortawesome/fontawesome-svg-core'

/**
 * Web Awesome can load a trusted SVG directly through its `src` property.
 * This keeps custom `fak` kit icons independent from the default resolver.
 */
export const FA_CAMERA_SLIDERS_SRC = `data:image/svg+xml,${encodeURIComponent(icon(faCameraSliders).html.join(''))}`
