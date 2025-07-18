/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ui.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2025-07-18
 * Last modified: 2025-07-18
 *
 *
 * Copyright © 2025 LGS1920
 ******************************************************************************/

import { proxyMap } from 'valtio/utils'

/**
 * UI Store - Manages all user interface state
 * Separated from main store to avoid conflicts and improve performance
 */
export const ui = {
    device: {
        portrait:  false,
        landscape: false,
        tablet:    false,
        mobile:    false,
        desktop:   false,
    },
    drawers: {
        open:   null,
        over:   false,
        action: null,
    },

    modals: {
        altitudeChoice: {
            show:  false,
            model: 'terrain',
        },
    },

    mainUI: {
        show:                false,
        journeyLoader:       {visible: false},
        support:             {visible: false},
        journeyMenu:         {timeout: 0, active: false},
        removeJourneyDialog: {active: proxyMap()},
        rotate:              {
            clockwise: false,
            running:   false,
            target:    false,
            rpm:       4,
        },
    },

    welcome: {
        modal: false,
        flag:  false,
    },

    informationPanel: {
        tab: null,
    },

    video: {
        filename:  0,
        canDefine: false,
    },
}