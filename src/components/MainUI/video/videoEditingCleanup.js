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

import { CROP_TOOLS_WIDGETS, VIDEO_WIDGETS_BOARD } from '@Core/constants'

export const prepareVideoEditingUi = () => {
    globalThis.__?.ui?.widgetCache?.hideAllExceptBoards?.(VIDEO_WIDGETS_BOARD)
}

const closeVideoCropperMenus = () => {
    const cropper = globalThis.lgs?.stores?.ui?.video?.cropper
    if (!cropper) {
        return
    }

    cropper.ratioEditor = false
    cropper.presetEditor = false
    cropper.widgetEditor = false
}

export const prepareVideoCaptureUi = () => {
    prepareVideoEditingUi()
    closeVideoCropperMenus()
    globalThis.__?.ui?.contextMenu?.hide?.()

    const replayStore = globalThis.lgs?.stores?.replay
    if (replayStore) {
        replayStore.mainUiHidden = true
    }
}

export const restoreVideoCaptureUi = () => {
    globalThis.__?.ui?.widgetCache?.restoreAllHiddenWidgetsExcept?.(VIDEO_WIDGETS_BOARD)

    const replayStore = globalThis.lgs?.stores?.replay
    if (replayStore) {
        replayStore.mainUiHidden = false
    }
}

export const cancelVideoEditing = () => {
    lgs.stores.ui.video.editing = false
    __.ui.widgetManager.disposeByGroup(CROP_TOOLS_WIDGETS, true)

    restoreVideoCaptureUi()
    __.ui.contextMenu.hide()
    __.ui.drawerManager.close()
}
