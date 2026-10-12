/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: JourneyReplayCameraCropConstraint.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-12
 * Last modified: 2026-10-12
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3, Cartesian4, Cartographic, Matrix4, Transforms} from 'cesium'
import {clamp, projectReplayTargetInCameraFrame} from './JourneyReplayCameraMath'

/**
 * Keep the rendered marker inside the crop by translating an eased camera frame.
 * Rotation, frustum and geodetic height remain unchanged. The minimal horizontal
 * correction reaches the crop's inner margin rather than snapping to its center.
 *
 * @param {Object} options - Physical camera frame, current marker and projection.
 * @returns {Object|null} Original frame or a corrected frame without input mutation.
 */
export const constrainReplayCameraFrameToCrop = ({
    frame,
    target,
    viewport,
    verticalFovRadians = Math.PI / 3,
    aspectRatio = null,
    markerRadius = 35,
} = {}) => {
    if (!frame?.destination || !frame.direction || !frame.up || !target
        || !(viewport?.width > 0) || !(viewport?.height > 0)) {
        return frame
    }

    const canvasWidth = viewport.canvasWidth ?? viewport.width
    const canvasHeight = viewport.canvasHeight ?? viewport.height
    const cropLeft = (viewport.left ?? 0) - (viewport.canvasLeft ?? 0)
    const cropTop = (viewport.top ?? 0) - (viewport.canvasTop ?? 0)
    const insetX = Math.min(viewport.width / 4, Math.max(markerRadius, viewport.width * 0.12))
    const insetY = Math.min(viewport.height / 4, Math.max(markerRadius, viewport.height * 0.12))
    const projection = {target, viewport, verticalFovRadians, aspectRatio}
    const point = projectReplayTargetInCameraFrame({...projection, frame})
    if (point && point.x >= insetX && point.x <= viewport.width - insetX
        && point.y >= insetY && point.y <= viewport.height - insetY) {
        return frame
    }

    const direction = Cartesian3.normalize(frame.direction, new Cartesian3())
    const right = Cartesian3.normalize(Cartesian3.cross(direction, frame.up, new Cartesian3()), new Cartesian3())
    const up = Cartesian3.normalize(Cartesian3.cross(right, direction, new Cartesian3()), new Cartesian3())
    const tangentY = Math.tan(verticalFovRadians / 2)
    const tangentX = tangentY * (aspectRatio ?? canvasWidth / canvasHeight)
    const desiredX = point ? clamp(point.x, insetX, viewport.width - insetX) : viewport.width / 2
    const desiredY = point ? clamp(point.y, insetY, viewport.height - insetY) : viewport.height / 2
    const slopeX = ((desiredX + cropLeft) * 2 / canvasWidth - 1) * tangentX
    const slopeY = (1 - (desiredY + cropTop) * 2 / canvasHeight) * tangentY
    const horizontalEquation = Cartesian3.subtract(right, Cartesian3.multiplyByScalar(direction, slopeX, new Cartesian3()), new Cartesian3())
    const verticalEquation = Cartesian3.subtract(up, Cartesian3.multiplyByScalar(direction, slopeY, new Cartesian3()), new Cartesian3())
    const basis = Transforms.eastNorthUpToFixedFrame(target)
    const east = Cartesian3.fromCartesian4(Matrix4.getColumn(basis, 0, new Cartesian4()), new Cartesian3())
    const north = Cartesian3.fromCartesian4(Matrix4.getColumn(basis, 1, new Cartesian4()), new Cartesian3())
    const a = Cartesian3.dot(horizontalEquation, east)
    const b = Cartesian3.dot(horizontalEquation, north)
    const c = Cartesian3.dot(verticalEquation, east)
    const d = Cartesian3.dot(verticalEquation, north)
    const determinant = a * d - b * c
    if (Math.abs(determinant) <= 1e-10) {
        return frame
    }

    const originalHeight = Cartographic.fromCartesian(frame.destination).height
    let destination = Cartesian3.clone(frame.destination)
    // Reproject to the original ellipsoid height after each tangent-plane solve.
    // Iteration compensates for Earth curvature without changing Replay zoom.
    for (let iteration = 0; iteration < 6; iteration += 1) {
        const relative = Cartesian3.subtract(target, destination, new Cartesian3())
        const horizontalError = Cartesian3.dot(horizontalEquation, relative)
        const verticalError = Cartesian3.dot(verticalEquation, relative)
        const eastMeters = (horizontalError * d - b * verticalError) / determinant
        const northMeters = (a * verticalError - horizontalError * c) / determinant
        const shift = Cartesian3.add(
            Cartesian3.multiplyByScalar(east, eastMeters, new Cartesian3()),
            Cartesian3.multiplyByScalar(north, northMeters, new Cartesian3()),
            new Cartesian3(),
        )
        const cartographic = Cartographic.fromCartesian(Cartesian3.add(destination, shift, new Cartesian3()))
        destination = Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, originalHeight)
    }
    return {...frame, destination}
}
