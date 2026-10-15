/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: ReplayPreparationConeLayout.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-15
 * Last modified: 2026-10-15
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Lay out the preparation cone in CSS pixels independently of Cesium zoom.
 * Keep its departure anchor when enough room remains, otherwise translate the
 * complete guide into the crop without collapsing its editable length.
 *
 * @param {object} options - Projected bearing, display dimensions and crop bounds.
 * @param {{x: number, y: number}} options.anchor - Projected departure position.
 * @param {{x: number, y: number}} options.direction - Projected camera bearing.
 * @param {number} options.length - Requested cone length in CSS pixels.
 * @param {number} options.baseWidthScale - Angle-dependent base width multiplier.
 * @param {number} options.iconGap - CSS pixel gap between the tip and camera icon.
 * @param {object|null} options.bounds - Inset crop bounds in overlay coordinates.
 * @returns {object|null} Complete display geometry, or null for invalid projections.
 */
export const resolveReplayPreparationConeLayout = ({anchor, direction, length, baseWidthScale, iconGap, bounds}) => {
    const directionLength = Math.hypot(direction?.x, direction?.y)
    if (![anchor?.x, anchor?.y, directionLength, length, baseWidthScale, iconGap].every(Number.isFinite)
        || directionLength <= 0 || length <= 0) {
        return null
    }

    const forward = {x: direction.x / directionLength, y: direction.y / directionLength}
    const side = {x: -forward.y, y: forward.x}
    const halfWidth = length * 0.32 * baseWidthScale
    const innerOffset = length * 0.05
    /** Create a cone-local point from forward and lateral CSS distances. */
    const localPoint = (distance, lateral = 0) => ({
        x: forward.x * distance + side.x * lateral,
        y: forward.y * distance + side.y * lateral,
    })
    const offsets = {
        rotationCenter: {x: 0, y: 0},
        left: localPoint(0, -halfWidth),
        right: localPoint(0, halfWidth),
        tip: localPoint(length),
        innerLeft: localPoint(innerOffset, -halfWidth * 0.95),
        innerRight: localPoint(innerOffset, halfWidth * 0.95),
        innerTip: localPoint(length),
        videoIcon: localPoint(length + iconGap),
    }
    // The rounded base extends past its two endpoints. Reserve its complete
    // circle as well as the tip and icon, rather than fitting triangle vertices.
    const footprint = [
        ...Object.values(offsets),
        {x: -halfWidth, y: 0}, {x: halfWidth, y: 0},
        {x: 0, y: -halfWidth}, {x: 0, y: halfWidth},
    ]
    const minimum = {x: Math.min(...footprint.map(point => point.x)), y: Math.min(...footprint.map(point => point.y))}
    const maximum = {x: Math.max(...footprint.map(point => point.x)), y: Math.max(...footprint.map(point => point.y))}
    let scale = 1
    let origin = anchor
    if (bounds) {
        /** Limit a scale around the unmodified departure for one screen axis. */
        const anchoredScale = (position, lower, upper, minimumOffset, maximumOffset) => {
            if (position < lower || position > upper) {
                return 0
            }
            return Math.min(
                1,
                minimumOffset < 0 ? (position - lower) / -minimumOffset : 1,
                maximumOffset > 0 ? (upper - position) / maximumOffset : 1,
            )
        }
        scale = Math.max(0, Math.min(
            anchoredScale(anchor.x, bounds.left, bounds.right, minimum.x, maximum.x),
            anchoredScale(anchor.y, bounds.top, bounds.bottom, minimum.y, maximum.y),
        ))
        if (scale * length < Math.min(length, 64)) {
            scale = Math.max(0, Math.min(
                1,
                (bounds.right - bounds.left) / (maximum.x - minimum.x),
                (bounds.bottom - bounds.top) / (maximum.y - minimum.y),
            ))
            origin = {
                x: Math.max(bounds.left - minimum.x * scale, Math.min(bounds.right - maximum.x * scale, anchor.x)),
                y: Math.max(bounds.top - minimum.y * scale, Math.min(bounds.bottom - maximum.y * scale, anchor.y)),
            }
        }
    }

    return Object.fromEntries(Object.entries(offsets).map(([key, point]) => [key, {
        x: origin.x + point.x * scale,
        y: origin.y + point.y * scale,
    }]))
}
