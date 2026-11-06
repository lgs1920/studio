/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POITerrainCapture.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-06
 * Last modified: 2026-11-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Scene-local POI masks owned by their mounted map controllers. */
const scenePreparations = new WeakMap()

/** Register a synchronous mask update returning its visibility revision. */
export const registerPOITerrainCapture = (scene, prepare) => {
    if (!scene) {
        return () => {}
    }
    let preparations = scenePreparations.get(scene)
    if (!preparations) {
        preparations = new Set()
        scenePreparations.set(scene, preparations)
    }
    preparations.add(prepare)

    return () => {
        preparations.delete(prepare)
        if (preparations.size === 0 && scenePreparations.get(scene) === preparations) {
            scenePreparations.delete(scene)
        }
    }
}

/** Update current terrain masks and return a revision for detecting late visibility writes. */
export const preparePOITerrainCapture = scene => {
    let revision = 0
    for (const prepare of scenePreparations.get(scene) ?? []) {
        revision += prepare()
    }
    return revision
}
