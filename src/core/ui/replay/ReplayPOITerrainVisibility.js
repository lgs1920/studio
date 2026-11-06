/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayPOITerrainVisibility.js
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

import {Cartesian2, Cartesian3, Cartographic} from 'cesium'

const TERRAIN_FOCUS_DEPTH_TOLERANCE_METERS = 2

/** Resolve the terrain-clamped focus position without asynchronous terrain sampling. */
const getPOIFocusPosition = (scene, poi) => {
    if (!scene?.globe || typeof scene.cartesianToCanvasCoordinates !== 'function'
        || !Number.isFinite(poi?.longitude) || !Number.isFinite(poi?.latitude)) {
        return null
    }

    const cartographic = Cartographic.fromDegrees(poi.longitude, poi.latitude)
    const height = scene.globe.getHeight?.(cartographic)
        ?? (Number.isFinite(poi.simulatedHeight) ? poi.simulatedHeight : null)
        ?? (Number.isFinite(poi.height) ? poi.height : 0)

    return Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, height)
}

/** Resolve terrain occlusion, returning null when the active scene cannot answer. */
export const isPOIAnchorOccludedByTerrain = (scene, camera, poi) => {
    const focusPosition = getPOIFocusPosition(scene, poi)
    if (!focusPosition) {
        return null
    }
    const canvasPosition = focusPosition
        ? scene.cartesianToCanvasCoordinates(focusPosition, new Cartesian2())
        : null
    const canvas = scene.canvas
    const width = Number(canvas?.clientWidth) || Number(canvas?.width)
    const height = Number(canvas?.clientHeight) || Number(canvas?.height)
    if (!canvasPosition || !Number.isFinite(width) || !Number.isFinite(height)
        || canvasPosition.x < 0 || canvasPosition.x > width
        || canvasPosition.y < 0 || canvasPosition.y > height) {
        return null
    }

    const pickRay = camera?.getPickRay?.(canvasPosition)
    if (!pickRay) {
        return null
    }

    let terrainPosition = null
    try {
        terrainPosition = scene.globe.pick(pickRay, scene)
    }
    catch {
        return null
    }
    if (!terrainPosition) {
        return null
    }

    const cameraPosition = camera.positionWC ?? camera.position
    if (!cameraPosition) {
        return null
    }

    return Cartesian3.distance(cameraPosition, terrainPosition) + TERRAIN_FOCUS_DEPTH_TOLERANCE_METERS
        < Cartesian3.distance(cameraPosition, focusPosition)
}
