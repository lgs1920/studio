/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: rotationSyncUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-04-26
 * Last modified: 2026-04-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: rotationSyncUtils.js
 ******************************************************************************/

export const clearRotatingPoiAnimation = async () => {
    const rotatingId = lgs.stores.ui.mainUI.rotate.target?.slug
    const panoramicId = lgs.stores.ui.mainUI.panorama.target?.slug ?? lgs.stores.ui.mainUI.panorama.target?.id
    if (!rotatingId) {
        if (!panoramicId) {
            return
        }
    }

    const targetIds = [rotatingId, panoramicId].filter(Boolean)
    for (const poiId of targetIds) {
        const rotatingPoi = lgs.stores.main.components.pois.list.get(poiId)
        if (rotatingPoi?.animated) {
            await __.ui.poiManager.updatePOI(poiId, {animated: false})
        }
    }
}

export const stopRotationAndSync = async () => {
    if (!__.ui.cameraManager.isRotating() && !lgs.stores.ui.mainUI.panorama.active) {
        return
    }

    if (__.ui.cameraManager.isRotating()) {
        await __.ui.cameraManager.stopRotate()
    }
    if (lgs.stores.ui.mainUI.panorama.active) {
        lgs.stores.ui.mainUI.panorama.active = false
        lgs.stores.ui.mainUI.panorama.target = false
    }
    await clearRotatingPoiAnimation()
}
