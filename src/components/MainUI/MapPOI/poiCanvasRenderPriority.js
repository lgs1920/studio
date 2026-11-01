/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiCanvasRenderPriority.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-11-01
 * Last modified: 2026-11-01
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3} from 'cesium'

/** Rank a POI by current screen visibility and camera distance. */
export const getPOICanvasRenderPriority = poiId => {
    const point = globalThis.lgs?.stores?.main?.components?.pois?.list?.get(poiId)
    const scene = globalThis.lgs?.scene ?? globalThis.lgs?.viewer?.scene
    const camera = globalThis.lgs?.camera ?? globalThis.lgs?.viewer?.camera
    if (!point || !scene || !camera || !Number.isFinite(point.longitude) || !Number.isFinite(point.latitude)) {
        return 0
    }

    try {
        const position = Cartesian3.fromDegrees(point.longitude, point.latitude, point.simulatedHeight ?? point.height)
        const coordinates = scene.cartesianToCanvasCoordinates(position)
        const canvas = scene.canvas
        const isVisible = coordinates && canvas
            && coordinates.x >= 0 && coordinates.y >= 0
            && coordinates.x <= canvas.clientWidth && coordinates.y <= canvas.clientHeight
        if (!isVisible) {
            return 0
        }

        const distance = Cartesian3.distance(camera.positionWC, position)
        return Number.isFinite(distance) ? 1 + 1 / (1 + distance / 10_000) : 1
    }
    catch {
        return 0
    }
}
