/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: focusPOIInOpenList.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-28
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { POIS_EDITOR_DRAWER } from '@Core/constants'

/** Select a newly created POI when its list drawer is already open. */
export const focusPOIInOpenList = poiId => {
    if (lgs.stores.ui.drawers.open !== POIS_EDITOR_DRAWER
        || !lgs.stores.main.components.pois.list.has(poiId)) {
        return false
    }

    lgs.stores.main.components.pois.current = poiId
    return true
}
