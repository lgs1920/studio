/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: openCodeDependenciesDrawer.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-07-26
 * Last modified: 2026-07-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CODE_DEPENDENCIES_DRAWER, INFO_CREDITS_TAB } from '@Core/constants'

/**
 * Opens the code dependencies drawer in stacked mode.
 */
export const openCodeDependenciesDrawer = () => {
    __.ui.drawerManager.tab = INFO_CREDITS_TAB
    __.ui.drawerManager.open(CODE_DEPENDENCIES_DRAWER, {
        stacked: true,
    })
}
