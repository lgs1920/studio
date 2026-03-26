/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: rotationSyncUtils.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-03-26
 * Last modified: 2026-03-26
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
    if (!rotatingId) {
        return
    }

    const rotatingPoi = lgs.stores.main.components.pois.list.get(rotatingId)
    if (rotatingPoi?.animated) {
        await __.ui.poiManager.updatePOI(rotatingId, {animated: false})
    }
}

export const stopRotationAndSync = async () => {
    if (!__.ui.cameraManager.isRotating()) {
        return
    }

    await __.ui.cameraManager.stopRotate()
    await clearRotatingPoiAnimation()
}
