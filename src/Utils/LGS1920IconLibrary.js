/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: LGS1920IconLibrary.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-11
 * Last modified: 2026-10-19
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import * as kitIcons from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import * as kitDuotoneIcons from '@awesome.me/kit-eb5c406148/icons/kit-duotone/custom'
import {faQuestion, faRulerVertical} from '@fortawesome/pro-regular-svg-icons'
import {LGS1920_ICON_LIBRARY, registerIconLibraryFromKits} from './useWebAwesomeKits'

/** Ordered custom and locally bundled icon definitions shared by application windows. */
export const LGS1920_ICON_KITS = [
    {family: 'classic', icons: kitIcons},
    {family: 'duotone', icons: kitDuotoneIcons},
    {family: 'classic', variant: 'regular', icons: {faQuestion, faRulerVertical}},
]

/**
 * Register the application icon kits in the current browser context.
 *
 * @returns {void}
 */
export const registerLGS1920IconLibrary = () => {
    registerIconLibraryFromKits(LGS1920_ICON_LIBRARY, LGS1920_ICON_KITS)
}
