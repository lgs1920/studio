/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: MainSceneCameraPivot.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-24
 * Last modified: 2026-11-24
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3} from 'cesium'

const pivotsByScene = new WeakMap()

/** Keep the selected map pivot with the Cesium scene rather than a UI widget. */
export const setMainSceneCameraPivot = (scene, camera, position) => {
    if (!scene || !camera || !position) return false
    const pivot = Cartesian3.clone(position)
    if (!pivot) return false
    pivotsByScene.set(scene, {camera, position: pivot})
    scene.requestRender?.()
    return true
}

/** Return a copy of the pivot only while its original scene camera is active. */
export const getMainSceneCameraPivot = (scene, camera) => {
    const state = scene && pivotsByScene.get(scene)
    return state?.camera === camera ? Cartesian3.clone(state.position) : null
}

/** Clear one scene's pivot when its camera lifecycle is replaced. */
export const clearMainSceneCameraPivot = (scene, camera) => {
    const state = scene && pivotsByScene.get(scene)
    if (!state || (camera && state.camera !== camera)) return false
    pivotsByScene.delete(scene)
    return true
}
