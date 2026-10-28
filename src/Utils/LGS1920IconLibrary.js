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
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import * as kitIcons from '@awesome.me/kit-eb5c406148/icons/kit/custom'
import * as kitDuotoneIcons from '@awesome.me/kit-eb5c406148/icons/kit-duotone/custom'
import {
    faArrowRightArrowLeft, faCirclePlus, faQuestion, faRulerVertical, faSquare, faSquareB, faSquareCheck, faSquareH, faSquareM,
} from '@fortawesome/pro-regular-svg-icons'
import {
    faArrowsLeftRight, faArrowsUpDown, faBasketShopping, faBottleWater, faBridge, faBusStop, faCableCar,
    faCamera, faKitMedical, faLasso, faLocationDot, faLocationPin, faMugHot, faRestroom, faSignPost, faSquareDashed,
    faSquareFull, faTent, faTrain, faTriangleExclamation, faUtensils, faWater,
} from '@fortawesome/pro-solid-svg-icons'
import {faCircle} from '@fortawesome/duotone-regular-svg-icons/faCircle'
import {faDiamond} from '@fortawesome/duotone-regular-svg-icons/faDiamond'
import {LGS1920_ICON_LIBRARY, registerIconLibraryFromKits} from './useWebAwesomeKits'

/** Ordered custom and locally bundled icon definitions shared by application windows. */
export const LGS1920_ICON_KITS = [
    {family: 'classic', icons: kitIcons},
    {family: 'duotone', icons: kitDuotoneIcons},
    {family: 'duotone', variant: 'regular', icons: {faCircle, faDiamond}},
    {family: 'classic', variant: 'regular', icons: {faSquare, faSquareB, faSquareCheck, faSquareH, faSquareM}},
    {
        family: 'classic',
        variant: 'solid',
        icons: {
            faBasketShopping,
            faBottleWater,
            faBridge,
            faBusStop,
            faCableCar,
            faCamera,
            faKitMedical,
            faMugHot,
            faRestroom,
            faSignPost,
            faTent,
            faTrain,
            faTriangleExclamation,
            faUtensils,
            faWater,
        },
    },
    {
        family: 'classic',
        variant: 'solid',
        icons: {faArrowsLeftRight, faArrowsUpDown, faLasso, faLocationDot, faLocationPin, faSquareDashed, faSquareFull},
    },
    {family: 'classic', variant: 'regular', icons: {faArrowRightArrowLeft, faCirclePlus, faQuestion, faRulerVertical}},
]

/**
 * Register the application icon kits in the current browser context.
 *
 * @returns {void}
 */
export const registerLGS1920IconLibrary = () => {
    registerIconLibraryFromKits(LGS1920_ICON_LIBRARY, LGS1920_ICON_KITS)
}
