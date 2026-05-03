/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: shortcutBlockers.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-03
 * Last modified: 2026-05-03
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

export const hasActiveRemoveJourneyDialog = () => {
    const active = globalThis.lgs?.stores?.ui?.mainUI?.removeJourneyDialog?.active

    return Boolean(active?.values && Array.from(active.values()).some(Boolean))
}

export const hasActiveAppShortcutBlocker = () => hasActiveRemoveJourneyDialog()
