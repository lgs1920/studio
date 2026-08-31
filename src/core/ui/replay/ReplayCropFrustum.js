/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayCropFrustum.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-08-26
 * Last modified: 2026-08-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Crop-aware Cesium frustum helpers for isolated Replay HQ rendering.
 */

import {OrthographicOffCenterFrustum, PerspectiveFrustum} from 'cesium'

const finiteNumber = (value, fallback = null) => {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
}

const normalizeDimensions = dimensions => {
    const width = finiteNumber(dimensions?.width)
    const height = finiteNumber(dimensions?.height)
    if (width === null || height === null || width <= 0 || height <= 0) {
        return null
    }

    return {width, height}
}

const normalizeCropRect = (cropRect, viewport) => {
    if (!viewport) {
        return null
    }

    const left = finiteNumber(cropRect?.left ?? cropRect?.x)
    const top = finiteNumber(cropRect?.top ?? cropRect?.y)
    const width = finiteNumber(cropRect?.width)
    const height = finiteNumber(cropRect?.height)
    if ([left, top, width, height].some(value => value === null) || width <= 0 || height <= 0) {
        return null
    }

    const normalizedLeft = Math.max(0, Math.min(viewport.width, left))
    const normalizedTop = Math.max(0, Math.min(viewport.height, top))
    return {
        left:   normalizedLeft,
        top:    normalizedTop,
        width:  Math.max(1, Math.min(viewport.width - normalizedLeft, width)),
        height: Math.max(1, Math.min(viewport.height - normalizedTop, height)),
    }
}

const readPerspectivePlanes = frustum => {
    const near = finiteNumber(frustum?.near)
    const far = finiteNumber(frustum?.far)
    const aspectRatio = finiteNumber(frustum?.aspectRatio)
    const fovy = finiteNumber(frustum?.fovy)
                     ?? (finiteNumber(frustum?.fov) !== null && aspectRatio !== null
                         ? (aspectRatio <= 1
                             ? finiteNumber(frustum.fov)
                             : 2 * Math.atan(Math.tan(frustum.fov * 0.5) / aspectRatio))
                         : null)
    if (near === null || near <= 0 || far === null || fovy === null || aspectRatio === null) {
        return null
    }

    const top = near * Math.tan(fovy * 0.5)
    const right = aspectRatio * top
    const xOffset = finiteNumber(frustum?.xOffset, 0)
    const yOffset = finiteNumber(frustum?.yOffset, 0)
    return {
        kind: 'perspective',
        left: -right + xOffset,
        right: right + xOffset,
        top: top + yOffset,
        bottom: -top + yOffset,
        near,
        far,
    }
}

const readOrthographicPlanes = frustum => {
    const near = finiteNumber(frustum?.near)
    const far = finiteNumber(frustum?.far)
    const directPlanes = ['left', 'right', 'top', 'bottom']
        .map(property => finiteNumber(frustum?.[property]))
    if (near !== null && far !== null && directPlanes.every(value => value !== null)) {
        return {
            kind: 'orthographic',
            left: directPlanes[0],
            right: directPlanes[1],
            top: directPlanes[2],
            bottom: directPlanes[3],
            near,
            far,
        }
    }

    const width = finiteNumber(frustum?.width)
    const aspectRatio = finiteNumber(frustum?.aspectRatio)
    if (near === null || far === null || width === null || width <= 0 || aspectRatio === null || aspectRatio <= 0) {
        return null
    }

    const halfWidth = width * 0.5
    const halfHeight = halfWidth / aspectRatio
    return {
        kind: 'orthographic',
        left: -halfWidth,
        right: halfWidth,
        top: halfHeight,
        bottom: -halfHeight,
        near,
        far,
    }
}

const cropPlanes = ({planes, viewport, crop}) => {
    const width = planes.right - planes.left
    const height = planes.top - planes.bottom
    const leftRatio = crop.left / viewport.width
    const rightRatio = (crop.left + crop.width) / viewport.width
    const topRatio = crop.top / viewport.height
    const bottomRatio = (crop.top + crop.height) / viewport.height

    return {
        ...planes,
        left:   planes.left + width * leftRatio,
        right:  planes.left + width * rightRatio,
        top:    planes.top - height * topRatio,
        bottom: planes.top - height * bottomRatio,
    }
}

const projectionKey = ({planes, viewport, crop}) => JSON.stringify({
    planes: [planes.left, planes.right, planes.top, planes.bottom, planes.near, planes.far],
    viewport,
    crop,
})

/**
 * Capture the source camera projection and derive the exact crop sub-frustum.
 *
 * @param {Object|null} options - Source camera and crop dimensions.
 * @returns {Object|null} Serializable crop projection definition.
 */
export const captureReplayCropProjection = ({
    camera = null,
    sourceViewportDimensions = null,
    cropRect = null,
} = {}) => {
    const viewport = normalizeDimensions(sourceViewportDimensions)
    const crop = normalizeCropRect(cropRect, viewport)
    if (!viewport || !crop) {
        return null
    }

    const planes = readPerspectivePlanes(camera?.frustum) ?? readOrthographicPlanes(camera?.frustum)
    if (!planes) {
        return null
    }

    const cropped = cropPlanes({planes, viewport, crop})
    return {
        ...cropped,
        viewport,
        crop,
        key: projectionKey({planes: cropped, viewport, crop}),
    }
}

/**
 * Create the Cesium frustum used by the isolated HQ camera.
 *
 * @param {Object|null} projection - Serializable crop projection.
 * @returns {Object|null} Cesium frustum or null for invalid input.
 */
export const createReplayCropFrustum = projection => {
    if (!projection) {
        return null
    }

    if (projection.kind === 'perspective') {
        const width = projection.right - projection.left
        const height = projection.top - projection.bottom
        if (width <= 0 || height <= 0 || projection.near <= 0) {
            return null
        }

        const aspectRatio = width / height
        const fovy = 2 * Math.atan((height * 0.5) / projection.near)
        const fov = aspectRatio > 1
            ? 2 * Math.atan((width * 0.5) / projection.near)
            : fovy
        const frustum = new PerspectiveFrustum({
            fov,
            aspectRatio,
            near:    projection.near,
            far:     projection.far,
            xOffset: (projection.left + projection.right) * 0.5,
            yOffset: (projection.top + projection.bottom) * 0.5,
        })
        frustum.replayCropProjectionKey = projection.key
        return frustum
    }

    if (projection.kind === 'orthographic') {
        const frustum = new OrthographicOffCenterFrustum({
            left:   projection.left,
            right:  projection.right,
            top:    projection.top,
            bottom: projection.bottom,
            near:   projection.near,
            far:    projection.far,
        })
        frustum.aspectRatio = (projection.right - projection.left) / (projection.top - projection.bottom)
        frustum.width = projection.right - projection.left
        frustum.replayCropProjectionKey = projection.key
        return frustum
    }

    return null
}
