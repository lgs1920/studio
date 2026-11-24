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

import {Cartesian2, Cartesian3, Matrix4, SceneMode} from 'cesium'

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

/** Pick the rendered map surface at a screen position, with globe and ellipsoid fallbacks. */
export const pickMainSceneWorldPosition = (scene, camera, screenPosition) => {
    if (!scene || !camera || !screenPosition) return null
    const ray = camera.getPickRay(screenPosition)
    const ellipsoid = scene.globe?.ellipsoid ?? scene.ellipsoid
    let picked = null
    if (scene.pickPositionSupported) {
        try {
            picked = scene.pickPosition(screenPosition)
        }
        catch {
            picked = null
        }
    }
    picked ??= (ray ? scene.globe?.pick(ray, scene) : null)
        ?? camera.pickEllipsoid(screenPosition, ellipsoid)
    return picked && ellipsoid ? Cartesian3.clone(picked) : null
}

/** Translate the camera so its selected world pivot lies on the viewport center ray. */
export const recenterMainSceneCameraPivot = (scene, camera) => {
    if (!scene || !camera || scene.mode !== SceneMode.SCENE3D) return false
    const pivot = getMainSceneCameraPivot(scene, camera)
    const canvas = scene.canvas
    const width = canvas?.clientWidth ?? 0
    const height = canvas?.clientHeight ?? 0
    if (!pivot || !(width > 0 && height > 0)) return false
    const center = new Cartesian2(width / 2, height / 2)
    const centerSurface = pickMainSceneWorldPosition(scene, camera, center)
    const cameraPosition = camera.positionWC ?? camera.position
    if (!centerSurface || !cameraPosition) return false
    const displacement = Cartesian3.subtract(pivot, centerSurface, new Cartesian3())
    if (Cartesian3.magnitudeSquared(displacement) <= 1e-8) return false
    const destination = Cartesian3.add(cameraPosition, displacement, new Cartesian3())
    Matrix4.multiplyByPoint(camera.inverseTransform, destination, camera.position)
    scene.requestRender?.()
    return true
}

/** Clear one scene's pivot when its camera lifecycle is replaced. */
export const clearMainSceneCameraPivot = (scene, camera) => {
    const state = scene && pivotsByScene.get(scene)
    if (!state || (camera && state.camera !== camera)) return false
    pivotsByScene.delete(scene)
    return true
}
