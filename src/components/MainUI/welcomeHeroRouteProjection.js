/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: welcomeHeroRouteProjection.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-09-22
 * Last modified: 2026-09-22
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/** Reference depth shared by the route camera and its DOM annotations. */
export const WELCOME_ROUTE_CAMERA_DISTANCE = 9.5

/** Smallest scale applied to a route POI at the back of the scene. */
export const WELCOME_ROUTE_POI_MIN_SCALE = 0.5

/**
 * Scales a route POI down when it moves behind the scene center.
 *
 * @param {number} cameraDepth - Positive distance from the camera along its viewing axis.
 * @returns {number} Perspective scale clamped to the supported POI range.
 */
export const getWelcomeRoutePoiScale = cameraDepth => {
    const safeDepth = Number.isFinite(cameraDepth) && cameraDepth > 0
        ? cameraDepth
        : WELCOME_ROUTE_CAMERA_DISTANCE
    const perspectiveScale = WELCOME_ROUTE_CAMERA_DISTANCE / safeDepth

    return Math.max(WELCOME_ROUTE_POI_MIN_SCALE, Math.min(1, perspectiveScale))
}
