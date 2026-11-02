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
 * Last modified: 2026-11-02
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

/**
 * Resolve the POI geographic anchor from the same DOM bounds used by the Cesium billboard.
 *
 * @param {{left: number, top: number, right: number, bottom: number}} elementBounds - POI capture surface bounds.
 * @param {{left: number, right: number}|undefined} cardBounds - POI card bounds, when present.
 * @param {{left: number, top: number}|undefined} anchorBounds - Explicit expanded POI anchor, when present.
 * @param {{bottom: number}|undefined} pinBounds - Collapsed pin bounds, when present.
 * @param {{x: number, y: number}|null} [reducedPinAnchor] - Visible compact pin tip, when present.
 * @returns {{x: number|null, y: number}} Geographic anchor in viewport pixels.
 */
export const calculatePOIContentAnchor = (elementBounds, cardBounds, anchorBounds, pinBounds, reducedPinAnchor) => ({
    x: anchorBounds
        ? anchorBounds.left
        : reducedPinAnchor?.x ?? (cardBounds
            ? (cardBounds.left + cardBounds.right) / 2
            : pinBounds ? (pinBounds.left + pinBounds.right) / 2 : null),
    y: anchorBounds?.top ?? reducedPinAnchor?.y ?? pinBounds?.bottom ?? elementBounds.bottom,
})

/** Resolve the compact pin's geographic point from its SVG viewBox metadata. */
export const calculatePOIReducedPinAnchor = pinShape => {
    const bounds = pinShape?.getBoundingClientRect?.()
    if (!bounds?.width || !bounds.height) {
        return null
    }

    const viewBox = String(pinShape.getAttribute?.('viewBox') ?? '').trim().split(/[ ,]+/).map(Number)
    const viewBoxHeight = viewBox.length === 4 ? viewBox[3] : NaN
    const anchorAttribute = pinShape.getAttribute?.('data-poi-anchor-y')
    const anchorY = anchorAttribute === null || anchorAttribute === undefined ? NaN : Number(anchorAttribute)
    const relativeY = Number.isFinite(viewBoxHeight) && viewBoxHeight > 0
        && Number.isFinite(anchorY) && anchorY >= 0 && anchorY <= viewBoxHeight
        ? anchorY / viewBoxHeight
        : 1

    return {
        x: (bounds.left + bounds.right) / 2,
        y: bounds.top + bounds.height * relativeY,
    }
}

/**
 * Resolve the horizontal offset from a side anchor's layout edge to its visible POI outline.
 * @param {Object} geometry - POI outline and selected side-anchor geometry.
 * @param {string} geometry.style - Selected POI display style.
 * @param {'left'|'right'} geometry.side - Selected side of the POI card.
 * @param {number} geometry.width - Untransformed POI card width in CSS pixels.
 * @param {number} geometry.height - Untransformed POI card height in CSS pixels.
 * @param {number} geometry.position - Anchor percentage along the side edge.
 * @param {number} [geometry.borderRadius=0] - Used corner radius for the measured outline.
 * @param {number} [geometry.outlineOffset=0] - Horizontal offset from the card edge to the measured outline.
 * @param {number} [geometry.openFrameLineWidth=0] - Open Frame stroke width in CSS pixels.
 * @returns {number} Signed horizontal offset in CSS pixels from the card edge to its outline.
 */
export const calculatePOIStickEdgeOffset = ({
    style,
    side,
    width,
    height,
    position,
    borderRadius = 0,
    outlineOffset = 0,
    openFrameLineWidth = 0,
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
    if (style === 'open-frame') {
        const lineWidth = Number.isFinite(openFrameLineWidth) ? Math.max(0, openFrameLineWidth) : 0
        const strokeReachesAnchor = side === 'left'
            ? progress * height >= height / 2 - lineWidth / 2
            : progress * height <= height / 2 + lineWidth / 2
        return strokeReachesAnchor ? (side === 'left' ? -lineWidth : lineWidth) : 0
    }

    const slantedOffset = style === 'slanted-banner'
        ? Math.tan(-15 * Math.PI / 180) * (progress - 0.5) * height
        : 0
    const hasRoundedOutline = ['icon-frame', 'round-badge', 'rounded', 'side-accent', 'slanted-banner']
        .includes(style)
    const radius = style === 'pill'
        ? Math.min(width, height) / 2
        : hasRoundedOutline && Number.isFinite(borderRadius)
            ? Math.min(Math.max(0, borderRadius), width / 2, height / 2)
            : 0
    const distanceFromEnd = Math.min(progress, 1 - progress) * height
    if (!radius || distanceFromEnd >= radius) {
        return (Number.isFinite(outlineOffset) ? outlineOffset : 0) + slantedOffset
    }

    const distanceFromCornerCenter = radius - distanceFromEnd
    const inset = radius - Math.sqrt(Math.max(0, radius ** 2 - distanceFromCornerCenter ** 2))
    return (Number.isFinite(outlineOffset) ? outlineOffset : 0)
        + slantedOffset
        + (side === 'left' ? inset : -inset)
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
    const pinBounds = element.querySelector('.poi-reduced-pin-shape')?.getBoundingClientRect()
    const reducedPinAnchor = calculatePOIReducedPinAnchor(element.querySelector('.poi-reduced-pin-shape'))
    const {x: anchorX, y: anchorY} = calculatePOIContentAnchor(
        elementBounds,
        cardBounds,
        anchorBounds,
        pinBounds,
        reducedPinAnchor,
    )

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
