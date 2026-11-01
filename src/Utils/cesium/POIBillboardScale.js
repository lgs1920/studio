/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: POIBillboardScale.js
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

export const POI_BILLBOARD_NEAR_DISTANCE = 10_000
export const POI_BILLBOARD_FAR_DISTANCE = 50_000

/** Resolve the same linear distance scale configured on Cesium POI billboards. */
export const getPOIBillboardDistanceScale = distance => {
    if (!Number.isFinite(distance)) {
        return 1
    }

    const progress = (distance - POI_BILLBOARD_NEAR_DISTANCE)
        / (POI_BILLBOARD_FAR_DISTANCE - POI_BILLBOARD_NEAR_DISTANCE)
    return Math.max(0, Math.min(1, 1 - progress))
}
