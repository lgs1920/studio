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
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {Cartesian3, Cartographic} from 'cesium'
import {clamp, projectReplayTargetInCameraFrame} from './JourneyReplayCameraMath'

/**
 * Keep the rendered marker inside the crop by translating a camera frame.
 * Rotation, frustum and camera-to-target range remain unchanged. When requested,
 * retain the marker's prepared crop-local screen position instead of centering it.
 *
 * @param {Object} options - Physical camera frame, current marker and projection.
 * @param {{x: number, y: number}|null} [options.desiredPoint=null] - Crop-local screen position to preserve.
 * @returns {Object|null} Original frame or a corrected frame without input mutation.
 */
export const constrainReplayCameraFrameToCrop = ({
    frame,
    target,
    viewport,
    verticalFovRadians = Math.PI / 3,
    aspectRatio = null,
    markerRadius = 35,
    desiredPoint = null,
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
    const desiredX = Number.isFinite(Number(desiredPoint?.x))
        ? clamp(Number(desiredPoint.x), insetX, viewport.width - insetX)
        : null
    const desiredY = Number.isFinite(Number(desiredPoint?.y))
        ? clamp(Number(desiredPoint.y), insetY, viewport.height - insetY)
        : null
    const hasDesiredPoint = desiredX !== null && desiredY !== null
    if (hasDesiredPoint && point
        && Math.abs(point.x - desiredX) <= 0.5
        && Math.abs(point.y - desiredY) <= 0.5) {
        return frame
    }
    if (!hasDesiredPoint && point && point.x >= insetX && point.x <= viewport.width - insetX
        && point.y >= insetY && point.y <= viewport.height - insetY) {
        return frame
    }

    const direction = Cartesian3.normalize(frame.direction, new Cartesian3())
    const right = Cartesian3.normalize(Cartesian3.cross(direction, frame.up, new Cartesian3()), new Cartesian3())
    const up = Cartesian3.normalize(Cartesian3.cross(right, direction, new Cartesian3()), new Cartesian3())
    const tangentY = Math.tan(verticalFovRadians / 2)
    const tangentX = tangentY * (aspectRatio ?? canvasWidth / canvasHeight)
    const targetX = desiredX ?? (point ? clamp(point.x, insetX, viewport.width - insetX) : viewport.width / 2)
    const targetY = desiredY ?? (point ? clamp(point.y, insetY, viewport.height - insetY) : viewport.height / 2)
    const slopeX = ((targetX + cropLeft) * 2 / canvasWidth - 1) * tangentX
    const slopeY = (1 - (targetY + cropTop) * 2 / canvasHeight) * tangentY
    const rayDirection = Cartesian3.normalize(
        Cartesian3.add(
            direction,
            Cartesian3.add(
                Cartesian3.multiplyByScalar(right, slopeX, new Cartesian3()),
                Cartesian3.multiplyByScalar(up, slopeY, new Cartesian3()),
                new Cartesian3(),
            ),
            new Cartesian3(),
        ),
        new Cartesian3(),
    )
    const range = Cartesian3.distance(frame.destination, target)
    const destination = Cartesian3.subtract(
        target,
        Cartesian3.multiplyByScalar(rayDirection, range, new Cartesian3()),
        new Cartesian3(),
    )
    const destinationHeight = Cartographic.fromCartesian(destination)?.height
    const targetHeight = Cartographic.fromCartesian(target)?.height
    if (!Number.isFinite(destinationHeight) || !Number.isFinite(targetHeight)
        || destinationHeight <= targetHeight + 1) {
        return frame
    }

    return {...frame, destination}
}
