/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: videoEditingCleanup.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-06-02
 * Last modified: 2026-06-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { CROP_TOOLS_WIDGETS, VIDEO_CROP_ZONE, VIDEO_WIDGETS_BOARD } from '@Core/constants'

export const cancelVideoEditing = () => {
    void __.ui.widgetManager.syncCropDimensionsFromElement(VIDEO_CROP_ZONE, true, 'cancel-editing')
    lgs.stores.ui.video.editing = false
    __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)

    __.ui.widgetCache.restoreAllHiddenWidgetsExcept(VIDEO_WIDGETS_BOARD)
    __.ui.contextMenu.hide()
    __.ui.drawerManager.close()
}
