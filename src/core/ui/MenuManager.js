/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MenuManager.js
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

import { BOTTOM, END, MOBILE_MAX, START } from '@Core/constants'

export class MenuManager {

    constructor() {
        // Singleton
        if (MenuManager.instance) {
            return MenuManager.instance
        }

        this.reset()
        MenuManager.instance = this

    }

    reset = () => {
        if (window.innerWidth <= MOBILE_MAX) {
            lgs.editorSettingsProxy.menu.drawer = lgs.settings.ui.menu.drawers.fromBottom ? BOTTOM : TOP
        }
        else {
            lgs.editorSettingsProxy.menu.drawer = lgs.settings.ui.menu.drawers.fromStart ? START : END
        }
    }
}