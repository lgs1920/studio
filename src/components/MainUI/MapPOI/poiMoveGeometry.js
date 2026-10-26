/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiMoveGeometry.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-26
 * Last modified: 2026-10-26
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { calculatePOIContentAnchor } from '@Components/MainUI/MapPOI/poiCanvasGeometry'

/**
 * Locate the visible tip of the compact pin after its card is rotated by 45 degrees.
 *
 * @param {{left: number, right: number, bottom: number}} cardRect - Rotated card bounds.
 * @param {number} cornerRadius - Bottom-right corner radius in untransformed CSS pixels.
 * @returns {{x: number, y: number}} Visible pin tip in viewport pixels.
 */
export const calculatePOIMovePinAnchor = (cardRect, cornerRadius) => ({
    x: (cardRect.left + cardRect.right) / 2,
    y: cardRect.bottom - (Math.SQRT2 - 1) * cornerRadius,
})

/**
 * Measure a cloned POI's geographic anchor and visible bounds relative to its draggable host.
 *
 * @param {{left: number, top: number, right: number, bottom: number}} hostRect - Draggable marker host bounds.
 * @param {{left: number, top: number, right: number, bottom: number}} markerRect - POI wrapper bounds.
 * @param {{left: number, top: number, right: number, bottom: number}} cardRect - POI card bounds.
 * @param {{left: number, top: number, right: number, bottom: number}} [anchorRect] - Explicit geographic anchor bounds.
 * @returns {{anchorOffset: {x: number, y: number}, markerBounds: {left: number, top: number, right: number, bottom: number}}}
 *     Geographic anchor offset and visible marker edges relative to that anchor.
 */
export const measurePOIMoveMarkerGeometry = (hostRect, markerRect, cardRect, anchorRect) => {
    const anchor = calculatePOIContentAnchor(markerRect, cardRect, anchorRect)

    return {
        anchorOffset: {
            x: anchor.x - (hostRect.left + hostRect.right) / 2,
            y: anchor.y - (hostRect.top + hostRect.bottom) / 2,
        },
        markerBounds: {
            left: markerRect.left - anchor.x,
            top: markerRect.top - anchor.y,
            right: markerRect.right - anchor.x,
            bottom: markerRect.bottom - anchor.y,
        },
    }
}

/**
 * Keep a POI geographic anchor inside the map viewport while its marker remains visible.
 *
 * @param {{x: number, y: number}} point - Requested geographic anchor in viewport pixels.
 * @param {{left: number, top: number, right: number, bottom: number}} bounds - Viewport bounds.
 * @param {{left: number, top: number, right: number, bottom: number}} markerBounds - Marker edges relative to its
 *     geographic anchor.
 * @returns {{x: number, y: number}} Clamped geographic anchor.
 */
export const clampPOIMovePoint = (point, bounds, markerBounds) => {
    const minX = bounds.left - markerBounds.left
    const maxX = Math.max(minX, bounds.right - markerBounds.right)
    const minY = bounds.top - markerBounds.top
    const maxY = Math.max(minY, bounds.bottom - markerBounds.bottom)

    return {
        x: Math.min(maxX, Math.max(minX, point.x)),
        y: Math.min(maxY, Math.max(minY, point.y)),
    }
}

/**
 * Keep a coordinate overlay inside the map viewport and above its marker when possible.
 *
 * @param {{x: number, y: number}} anchor - POI geographic anchor in viewport pixels.
 * @param {{left: number, top: number, right: number, bottom: number}} bounds - Viewport bounds.
 * @param {{left: number, top: number, right: number, bottom: number}} markerBounds - Marker edges relative to its
 *     geographic anchor.
 * @param {{width: number, height: number}} overlaySize - Overlay dimensions in pixels.
 * @param {number} gap - Pixel gap between marker and overlay.
 * @returns {{x: number, y: number}} Clamped overlay top-left position.
 */
export const placePOIMoveOverlay = (anchor, bounds, markerBounds, overlaySize, gap) => {
    const maxX = Math.max(bounds.left, bounds.right - overlaySize.width)
    const maxY = Math.max(bounds.top, bounds.bottom - overlaySize.height)
    const requestedX = anchor.x - overlaySize.width / 2
    const requestedY = anchor.y + markerBounds.top - overlaySize.height - gap

    return {
        x: Math.min(maxX, Math.max(bounds.left, requestedX)),
        y: Math.min(maxY, Math.max(bounds.top, requestedY)),
    }
}
