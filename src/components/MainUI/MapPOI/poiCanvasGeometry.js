/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: poiCanvasGeometry.js
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-10-24
 * Last modified: 2026-10-31
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Resolve the POI geographic anchor from the same DOM bounds used by the Cesium billboard.
 *
 * @param {{left: number, top: number, right: number, bottom: number}} elementBounds - POI wrapper bounds.
 * @param {{left: number, right: number}|undefined} cardBounds - POI card bounds, when present.
 * @param {{left: number, top: number}|undefined} anchorBounds - Explicit expanded POI anchor, when present.
 * @returns {{x: number|null, y: number}} Geographic anchor in viewport pixels.
 */
export const calculatePOIContentAnchor = (elementBounds, cardBounds, anchorBounds) => ({
    x: anchorBounds
        ? anchorBounds.left
        : cardBounds
            ? (cardBounds.left + cardBounds.right) / 2
            : null,
    y: anchorBounds ? anchorBounds.top : elementBounds.bottom,
})

/**
 * Resolve the horizontal offset from a side anchor's layout edge to its visible POI outline.
 * @param {Object} geometry - POI outline and selected side-anchor geometry.
 * @param {string} geometry.style - Selected POI display style.
 * @param {'left'|'right'} geometry.side - Selected side of the POI card.
 * @param {number} geometry.width - Untransformed POI card width in CSS pixels.
 * @param {number} geometry.height - Untransformed POI card height in CSS pixels.
 * @param {number} geometry.position - Anchor percentage along the side edge.
 * @param {number} [geometry.borderRadius=0] - Used corner radius for the rounded style.
 * @returns {number} Signed horizontal offset in CSS pixels from the card edge to its outline.
 */
export const calculatePOIStickEdgeOffset = ({
    style,
    side,
    width,
    height,
    position,
    borderRadius = 0,
}) => {
    if ((side !== 'left' && side !== 'right')
        || !Number.isFinite(width)
        || width <= 0
        || !Number.isFinite(height)
        || height <= 0
        || !Number.isFinite(position)) {
        return 0
    }

    const progress = Math.min(100, Math.max(0, position)) / 100
    if (style === 'slanted-banner') {
        return Math.tan(-15 * Math.PI / 180) * (progress - 0.5) * height
    }

    const radius = style === 'pill'
        ? Math.min(width, height) / 2
        : style === 'rounded' && Number.isFinite(borderRadius)
            ? Math.min(Math.max(0, borderRadius), width / 2, height / 2)
            : 0
    const distanceFromEnd = Math.min(progress, 1 - progress) * height
    if (!radius || distanceFromEnd >= radius) {
        return 0
    }

    const distanceFromCornerCenter = radius - distanceFromEnd
    const inset = radius - Math.sqrt(Math.max(0, radius ** 2 - distanceFromCornerCenter ** 2))
    return side === 'left' ? inset : -inset
}

/**
 * Calculate per-side capture padding for visible POI artwork outside its layout box.
 *
 * @param {Object} geometry - Measured POI outline geometry.
 * @param {number} geometry.borderWidth - Base POI border width in CSS pixels.
 * @param {number} [geometry.openFrameLineWidth=0] - Open Frame stroke width in CSS pixels.
 * @param {number} [geometry.slantedContentHeight=0] - Slanted POI content height in CSS pixels.
 * @param {number} [geometry.leaderBleed=0] - Stick overflow beyond its layout slot in CSS pixels.
 * @param {number} [geometry.rotationBleed=0] - Rotated widget overflow beyond its layout box in CSS pixels.
 * @param {number} [geometry.leaderEndpointBleed=0] - Extra radius needed around the stick's geographic endpoint.
 * @returns {number} Capture padding in CSS pixels.
 */
export const calculatePOICanvasCapturePadding = ({
    borderWidth,
    openFrameLineWidth = 0,
    slantedContentHeight = 0,
    leaderBleed = 0,
    rotationBleed = 0,
    leaderEndpointBleed = 0,
}) => {
    const normalizedBorderWidth = Number.isFinite(borderWidth) ? Math.max(0, borderWidth) : 0
    const normalizedLeaderBleed = Number.isFinite(leaderBleed) ? Math.max(0, leaderBleed) : 0
    const normalizedRotationBleed = Number.isFinite(rotationBleed) ? Math.max(0, rotationBleed) : 0
    const normalizedLeaderEndpointBleed = Number.isFinite(leaderEndpointBleed)
        ? Math.max(0, leaderEndpointBleed)
        : 0
    const slantedBleed = slantedContentHeight > 0
        ? Math.tan(15 * Math.PI / 180) * slantedContentHeight / 2 + normalizedBorderWidth
        : 0

    return Math.ceil(Math.max(
        normalizedBorderWidth * 1.5,
        openFrameLineWidth,
        slantedBleed,
        normalizedLeaderBleed,
        normalizedRotationBleed + normalizedLeaderEndpointBleed,
    ) + 1)
}

/** Measure transformed artwork extending beyond the capture root's layout box. */
export const measurePOICanvasOverflow = element => {
    const bounds = element.getBoundingClientRect()
    let overflow = 0
    for (const child of element.querySelectorAll('.poi-card, .poi-card *')) {
        const childBounds = child.getBoundingClientRect()
        if (!childBounds.width && !childBounds.height && !child.matches('.poi-geographic-anchor')) {
            continue
        }
        overflow = Math.max(overflow,
            bounds.left - childBounds.left, childBounds.right - bounds.right,
            bounds.top - childBounds.top, childBounds.bottom - bounds.bottom)
    }
    return Math.ceil(overflow)
}

/**
 * Align the geographic POI anchor with its Cesium billboard position after canvas capture.
 *
 * @param {HTMLElement} element - The DOM element captured into the billboard canvas.
 * @param {number} canvasWidth - The captured canvas width in CSS pixels.
 * @param {number} canvasHeight - The captured canvas height in CSS pixels.
 * @param {Object} [captureMeta] - SnapDOM capture geometry, including bleed around the element.
 * @returns {{x: number, y: number}} Billboard pixel offset that aligns the geographic anchor. Cesium uses screen
 *     coordinates for pixel offsets, so positive y moves the image down.
 */
export const calculatePOIContentPixelOffset = (element, canvasWidth, canvasHeight, captureMeta = {}) => {
    const elementBounds = element.getBoundingClientRect()
    const cardBounds = element.querySelector('.poi-card-inner')?.getBoundingClientRect()
    const anchorBounds = element.querySelector('.poi-geographic-anchor')?.getBoundingClientRect()
    const {x: anchorX, y: anchorY} = calculatePOIContentAnchor(elementBounds, cardBounds, anchorBounds)

    if (anchorX === null
        || !elementBounds.width
        || !elementBounds.height
        || !Number.isFinite(canvasWidth)
        || canvasWidth <= 0
        || !Number.isFinite(canvasHeight)
        || canvasHeight <= 0) {
        return {x: 0, y: 0}
    }

    const viewBoxWidth = Number(captureMeta?.vbW)
    const viewBoxHeight = Number(captureMeta?.vbH)
    const contentX = Number(captureMeta?.contentX)
    const contentY = Number(captureMeta?.contentY)
    const scaleX = Number.isFinite(viewBoxWidth) && viewBoxWidth > 0
        ? canvasWidth / viewBoxWidth
        : canvasWidth / elementBounds.width
    const scaleY = Number.isFinite(viewBoxHeight) && viewBoxHeight > 0
        ? canvasHeight / viewBoxHeight
        : canvasHeight / elementBounds.height
    const anchorCanvasX = (Number.isFinite(contentX) ? contentX : 0) + anchorX - elementBounds.left
    const anchorCanvasY = (Number.isFinite(contentY) ? contentY : 0) + anchorY - elementBounds.top

    return {
        x: canvasWidth / 2 - anchorCanvasX * scaleX,
        y: canvasHeight / 2 - anchorCanvasY * scaleY,
    }
}
